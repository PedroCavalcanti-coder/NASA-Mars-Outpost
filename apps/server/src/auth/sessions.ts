import { and, eq, getTableColumns, gt, isNull, ne, sql } from 'drizzle-orm';
import { config } from '../config';
import { db } from '../db/client';
import { sessions, users } from '../db/schema';
import { bus } from '../events';
import { macToken, randomToken, safeEqualHex } from '../security/crypto';
import { issueToken } from '../security/tokens';

export type UserRow = typeof users.$inferSelect;

export interface ClientInfo {
  ip: string;
  userAgent: string;
}

export interface Authenticated {
  user: UserRow;
  sessionId: string;
}

/** Datas calculadas pelo relógio do banco: evita divergência entre servidor de app e Postgres. */
const inSeconds = (n: number) => sql`now() + make_interval(secs => ${n})`;

/** O refresh token é `<id da sessão>.<segredo>`; só o HMAC do token inteiro fica no banco. */
const formatRefresh = (sessionId: string, secret: string) => `${sessionId}.${secret}`;
function splitRefresh(token: string | undefined): { sid: string; secret: string } | null {
  if (!token) return null;
  const dot = token.indexOf('.');
  if (dot !== 36) return null; // uuid
  return { sid: token.slice(0, dot), secret: token.slice(dot + 1) };
}

export async function createSession(user: UserRow, client: ClientInfo) {
  const secret = randomToken();
  const [row] = await db
    .insert(sessions)
    .values({
      userId: user.id,
      refreshHash: '',
      userAgent: client.userAgent.slice(0, 200),
      ip: client.ip.slice(0, 64),
      expiresAt: inSeconds(config.refreshTtlSeconds),
    })
    .returning({ id: sessions.id });
  const refreshToken = formatRefresh(row!.id, secret);
  await db
    .update(sessions)
    .set({ refreshHash: macToken(refreshToken) })
    .where(eq(sessions.id, row!.id));
  return {
    sessionId: row!.id,
    refreshToken,
    accessToken: await issueToken({ userId: user.id, sessionId: row!.id }),
  };
}

export type RefreshResult =
  | {
      ok: true;
      accessToken: string;
      refreshToken: string | null;
      userId: string;
      sessionId: string;
    }
  | { ok: false };

/**
 * Rotação do refresh token a cada uso.
 * - token atual -> gera um novo (o anterior vira `prev`)
 * - token anterior reapresentado dentro de {@link config.refreshGraceSeconds}: duas abas
 *   renovando ao mesmo tempo; só devolvemos um novo token de acesso
 * - token anterior reapresentado depois da janela: alguém copiou o cookie -> sessão revogada
 */
export async function refreshSession(token: string | undefined): Promise<RefreshResult> {
  const parts = splitRefresh(token);
  if (!parts || !token) return { ok: false };
  const [session] = await db
    .select({
      ...getTableColumns(sessions),
      rotatedAgo: sql<number | null>`extract(epoch from (now() - ${sessions.rotatedAt}))::float8`,
    })
    .from(sessions)
    .where(
      and(
        eq(sessions.id, parts.sid),
        isNull(sessions.revokedAt),
        gt(sessions.expiresAt, sql`now()`),
      ),
    );
  if (!session) return { ok: false };

  const presented = macToken(token);
  const ticket = (refreshToken: string | null) =>
    issueToken({ userId: session.userId, sessionId: session.id }).then((accessToken) => ({
      ok: true as const,
      accessToken,
      refreshToken,
      userId: session.userId,
      sessionId: session.id,
    }));

  if (safeEqualHex(presented, session.refreshHash)) {
    const next = formatRefresh(session.id, randomToken());
    const rotated = await db
      .update(sessions)
      .set({
        prevRefreshHash: session.refreshHash,
        refreshHash: macToken(next),
        rotatedAt: sql`now()`,
        lastUsedAt: sql`now()`,
        expiresAt: inSeconds(config.refreshTtlSeconds),
      })
      .where(and(eq(sessions.id, session.id), eq(sessions.refreshHash, session.refreshHash)))
      .returning({ id: sessions.id });
    // outra requisição girou o token primeiro: tratamos como dentro da janela de tolerância
    return rotated.length ? ticket(next) : ticket(null);
  }

  if (session.prevRefreshHash && safeEqualHex(presented, session.prevRefreshHash)) {
    if ((session.rotatedAgo ?? Infinity) <= config.refreshGraceSeconds) return ticket(null);
    await revokeSession(session.id); // reutilização de token antigo
  }
  return { ok: false };
}

/** Valida um token de acesso e confirma que a sessão continua ativa (revogação imediata). */
export async function loadAuth(claims: {
  userId: string;
  sessionId: string;
}): Promise<Authenticated | null> {
  const [row] = await db
    .select({ user: users, sessionId: sessions.id })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(
      and(
        eq(sessions.id, claims.sessionId),
        eq(sessions.userId, claims.userId),
        isNull(sessions.revokedAt),
        gt(sessions.expiresAt, sql`now()`),
      ),
    );
  return row ? { user: row.user, sessionId: row.sessionId } : null;
}

export async function revokeSession(sessionId: string) {
  await db
    .update(sessions)
    .set({ revokedAt: sql`now()` })
    .where(and(eq(sessions.id, sessionId), isNull(sessions.revokedAt)));
  bus.publish('session:revoked', sessionId);
}

/** Encerra todas as sessões do usuário, opcionalmente poupando a atual. */
export async function revokeUserSessions(userId: string, exceptSessionId: string | null = null) {
  await db
    .update(sessions)
    .set({ revokedAt: sql`now()` })
    .where(
      and(
        eq(sessions.userId, userId),
        isNull(sessions.revokedAt),
        exceptSessionId ? ne(sessions.id, exceptSessionId) : undefined,
      ),
    );
  bus.publish('user:sessions-revoked', userId, exceptSessionId);
}

export function sessionIdFromRefresh(token: string | undefined) {
  return splitRefresh(token)?.sid ?? null;
}

export async function listSessions(userId: string) {
  return db
    .select()
    .from(sessions)
    .where(
      and(
        eq(sessions.userId, userId),
        isNull(sessions.revokedAt),
        gt(sessions.expiresAt, sql`now()`),
      ),
    )
    .orderBy(sql`${sessions.lastUsedAt} desc`);
}

/** Remove sessões vencidas/revogadas há mais de 7 dias (chamada periodicamente). */
export async function purgeSessions() {
  await db
    .delete(sessions)
    .where(
      sql`${sessions.expiresAt} < now() - interval '7 days' or ${sessions.revokedAt} < now() - interval '7 days'`,
    );
}
