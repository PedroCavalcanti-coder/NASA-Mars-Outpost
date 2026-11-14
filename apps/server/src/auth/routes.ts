import {
  changePasswordSchema,
  forgotPasswordSchema,
  loginSchema,
  registerSchema,
  resetPasswordSchema,
  type SessionInfo,
  updateProfileSchema,
} from '@mars/shared';
import { and, eq, gt, isNull, sql } from 'drizzle-orm';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { config } from '../config';
import { db } from '../db/client';
import { passwordResets, users } from '../db/schema';
import { HttpError, parse, uniqueViolation } from '../http';
import { sendMail } from '../mailer';
import { macToken, randomToken } from '../security/crypto';
import { burnPasswordTime, hashPassword, needsRehash, verifyPassword } from '../security/password';
import { issueToken } from '../security/tokens';
import { RESERVED_USERNAMES, toPublicUser } from '../users';
import { clearAuthCookies, setAuthCookies } from './cookies';
import { me, requireAuth } from './plugin';
import {
  createSession,
  listSessions,
  refreshSession,
  revokeSession,
  revokeUserSessions,
  sessionIdFromRefresh,
} from './sessions';

const clientInfo = (req: FastifyRequest) => ({
  ip: req.ip,
  userAgent: String(req.headers['user-agent'] ?? ''),
});

/**
 * Limite por IP para rotas sensíveis (somado ao limite global). Generoso de propósito: em eventos
 * e escolas muita gente divide o mesmo IP. A defesa contra senha adivinhada é o bloqueio por conta.
 */
const limit = (max: number, timeWindow = '1 minute') => ({
  config: { rateLimit: { max, timeWindow } },
});

async function startSession(
  reply: FastifyReply,
  req: FastifyRequest,
  user: typeof users.$inferSelect,
) {
  const s = await createSession(user, clientInfo(req));
  setAuthCookies(reply, s.accessToken, s.refreshToken);
}

export async function authRoutes(app: FastifyInstance) {
  app.post('/api/auth/register', limit(20), async (req, reply) => {
    const input = parse(registerSchema, req.body);
    if (RESERVED_USERNAMES.has(input.username)) {
      throw new HttpError(409, 'Este apelido não está disponível', {
        username: 'Apelido indisponível',
      });
    }
    let user: typeof users.$inferSelect;
    try {
      [user] = (await db
        .insert(users)
        .values({
          name: input.name,
          username: input.username,
          email: input.email,
          passwordHash: await hashPassword(input.password),
        })
        .returning()) as [typeof users.$inferSelect];
    } catch (err) {
      const constraint = uniqueViolation(err);
      if (constraint?.includes('username'))
        throw new HttpError(409, 'Este apelido já está em uso', { username: 'Apelido já em uso' });
      if (constraint?.includes('email'))
        throw new HttpError(409, 'Este e-mail já tem uma conta', { email: 'E-mail já cadastrado' });
      throw err;
    }
    await startSession(reply, req, user);
    return reply.code(201).send(toPublicUser(user));
  });

  app.post('/api/auth/login', limit(30), async (req, reply) => {
    const input = parse(loginSchema, req.body);
    const [user] = await db.select().from(users).where(eq(users.email, input.email));
    const invalid = new HttpError(401, 'E-mail ou senha incorretos');

    if (!user) {
      await burnPasswordTime(input.password);
      throw invalid;
    }
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      throw new HttpError(
        429,
        'Conta bloqueada por tentativas incorretas. Tente de novo em alguns minutos.',
      );
    }
    if (!(await verifyPassword(input.password, user.passwordHash))) {
      const failed = user.failedLogins + 1;
      const lock = failed >= config.maxFailedLogins;
      await db
        .update(users)
        .set({
          failedLogins: lock ? 0 : failed,
          lockedUntil: lock ? new Date(Date.now() + config.lockSeconds * 1000) : user.lockedUntil,
        })
        .where(eq(users.id, user.id));
      throw invalid;
    }

    const patch: Partial<typeof users.$inferInsert> = {};
    if (user.failedLogins || user.lockedUntil)
      Object.assign(patch, { failedLogins: 0, lockedUntil: null });
    if (needsRehash(user.passwordHash)) patch.passwordHash = await hashPassword(input.password);
    if (Object.keys(patch).length) await db.update(users).set(patch).where(eq(users.id, user.id));

    await startSession(reply, req, user);
    return toPublicUser(user);
  });

  /** Renova o token de acesso com o refresh token (cookie httpOnly) e gira o refresh. */
  app.post('/api/auth/refresh', limit(60), async (req, reply) => {
    const result = await refreshSession(req.cookies[config.cookies.refresh]);
    if (!result.ok) {
      clearAuthCookies(reply);
      throw new HttpError(401, 'Sessão expirada. Entre novamente.');
    }
    setAuthCookies(reply, result.accessToken, result.refreshToken);
    return { ok: true };
  });

  app.post('/api/auth/logout', async (req, reply) => {
    const sid = req.auth?.sessionId ?? sessionIdFromRefresh(req.cookies[config.cookies.refresh]);
    // Só revoga pelo refresh se o usuário estava autenticado ou se o token confere (via refresh).
    if (req.auth) await revokeSession(req.auth.sessionId);
    else if (sid) {
      const r = await refreshSession(req.cookies[config.cookies.refresh]);
      if (r.ok) await revokeSession(r.sessionId);
    }
    clearAuthCookies(reply);
    return { ok: true };
  });

  /** Usuário atual. 401 se o token de acesso expirou (o site então chama /refresh). */
  app.get('/api/auth/me', { preHandler: requireAuth }, async (req) => toPublicUser(me(req).user));

  app.patch('/api/auth/me', { preHandler: requireAuth }, async (req) => {
    const input = parse(updateProfileSchema, req.body);
    const [user] = await db
      .update(users)
      .set({ name: input.name })
      .where(eq(users.id, me(req).user.id))
      .returning();
    return toPublicUser(user!);
  });

  app.post('/api/auth/change-password', { preHandler: requireAuth, ...limit(10) }, async (req) => {
    const input = parse(changePasswordSchema, req.body);
    const { user, sessionId } = me(req);
    if (!(await verifyPassword(input.current, user.passwordHash))) {
      throw new HttpError(401, 'Senha atual incorreta', { current: 'Senha atual incorreta' });
    }
    await db
      .update(users)
      .set({ passwordHash: await hashPassword(input.next) })
      .where(eq(users.id, user.id));
    await revokeUserSessions(user.id, sessionId); // derruba os outros dispositivos
    return { ok: true };
  });

  /**
   * Recuperação de senha. Sempre responde 200 (não revela se o e-mail existe).
   * O token tem 256 bits, vale por 1 h, é de uso único e só o HMAC dele fica no banco.
   */
  app.post('/api/auth/forgot-password', limit(10), async (req) => {
    const input = parse(forgotPasswordSchema, req.body);
    const [user] = await db.select().from(users).where(eq(users.email, input.email));
    if (user) {
      const token = randomToken();
      await db.insert(passwordResets).values({
        tokenHash: macToken(token),
        userId: user.id,
        expiresAt: sql`now() + make_interval(secs => ${config.resetTtlSeconds})`,
      });
      const link = `${config.primaryOrigin}/redefinir-senha?token=${token}`;
      await sendMail(
        user.email,
        'Redefinir sua senha — Mars Outpost',
        `Link (vale por 1 hora): ${link}`,
      );
    }
    return { ok: true };
  });

  app.post('/api/auth/reset-password', limit(10), async (req) => {
    const input = parse(resetPasswordSchema, req.body);
    const hash = macToken(input.token);
    const passwordHash = await hashPassword(input.password);
    const userId = await db.transaction(async (tx) => {
      // "consome" o token de forma atômica: só uma requisição consegue usá-lo
      const [used] = await tx
        .update(passwordResets)
        .set({ usedAt: sql`now()` })
        .where(
          and(
            eq(passwordResets.tokenHash, hash),
            isNull(passwordResets.usedAt),
            gt(passwordResets.expiresAt, sql`now()`),
          ),
        )
        .returning({ userId: passwordResets.userId });
      if (!used) return null;
      await tx
        .update(users)
        .set({ passwordHash, failedLogins: 0, lockedUntil: null })
        .where(eq(users.id, used.userId));
      return used.userId;
    });
    if (!userId) throw new HttpError(400, 'Link inválido ou expirado. Peça um novo.');
    await revokeUserSessions(userId);
    return { ok: true };
  });

  app.get(
    '/api/auth/sessions',
    { preHandler: requireAuth },
    async (req): Promise<SessionInfo[]> => {
      const { user, sessionId } = me(req);
      return (await listSessions(user.id)).map((s) => ({
        id: s.id,
        current: s.id === sessionId,
        userAgent: s.userAgent,
        ip: s.ip,
        createdAt: s.createdAt.toISOString(),
        lastUsedAt: s.lastUsedAt.toISOString(),
      }));
    },
  );

  app.delete<{ Params: { id: string } }>(
    '/api/auth/sessions/:id',
    { preHandler: requireAuth },
    async (req) => {
      const { user } = me(req);
      const target = (await listSessions(user.id)).find((s) => s.id === req.params.id);
      if (!target) throw new HttpError(404, 'Sessão não encontrada');
      await revokeSession(target.id);
      return { ok: true };
    },
  );

  /** Ingresso de 60 s para abrir o WebSocket (funciona mesmo com site e API em domínios diferentes). */
  app.post('/api/auth/socket-ticket', { preHandler: requireAuth, ...limit(30) }, async (req) => {
    const { user, sessionId } = me(req);
    return { ticket: await issueToken({ userId: user.id, sessionId }, 'socket') };
  });
}
