import { GAME_ROOM_CODE_RE, NICKNAME_MAX, NICKNAME_MIN } from '@mars/shared';
import type { FastifyInstance } from 'fastify';
import { config } from '../config';
import { isNicknameTaken } from '../realtime/game';
import {
  listRecent,
  newPlayerKey,
  ownerFromCookies,
  PLAYER_KEY_COOKIE,
  parseCookies,
  purgeExpired,
  unlink,
} from './service';

const cookieOpts = {
  httpOnly: true,
  secure: config.isProd || config.cookieSameSite === 'none',
  sameSite: config.cookieSameSite,
  path: '/',
  // os navegadores limitam em ~400 dias
  maxAge: 400 * 24 * 60 * 60,
} as const;

export async function worldRoutes(app: FastifyInstance) {
  /** O visitante aceitou o cookie: nasce a chave que o liga aos mundos salvos. */
  app.post('/api/worlds/consent', async (req, reply) => {
    const existing = parseCookies(req.headers.cookie)[PLAYER_KEY_COOKIE];
    if (!existing || !/^[a-f0-9]{48}$/.test(existing)) {
      reply.setCookie(PLAYER_KEY_COOKIE, newPlayerKey(), cookieOpts);
    } else {
      reply.setCookie(PLAYER_KEY_COOKIE, existing, cookieOpts); // renova a validade
    }
    return { ok: true };
  });

  /** O visitante recusou/revogou: apaga a chave (os mundos dele deixam de ter dono). */
  app.delete('/api/worlds/consent', async (_req, reply) => {
    reply.clearCookie(PLAYER_KEY_COOKIE, { ...cookieOpts, maxAge: undefined });
    return { ok: true };
  });

  app.get('/api/worlds/recent', async (req) => {
    const owner = await ownerFromCookies(req.headers.cookie);
    if (!owner) return { canSave: false, worlds: [] };
    void purgeExpired().catch(() => {});
    return { canSave: true, worlds: await listRecent(owner) };
  });

  app.delete<{ Params: { code: string } }>('/api/worlds/:code', async (req, reply) => {
    const owner = await ownerFromCookies(req.headers.cookie);
    const code = req.params.code.toUpperCase();
    if (!owner || !GAME_ROOM_CODE_RE.test(code))
      return reply.code(404).send({ error: 'Não encontrado' });
    await unlink(owner, code);
    return { ok: true };
  });

  /** Antes de entrar: o apelido já está em uso por alguém que está na sala? */
  app.post<{ Body: { code?: string; name?: string } }>(
    '/api/worlds/check-nickname',
    async (req) => {
      const code = String(req.body?.code ?? '')
        .trim()
        .toUpperCase();
      const name = String(req.body?.name ?? '').trim();
      if (name.length < NICKNAME_MIN || name.length > NICKNAME_MAX) {
        return {
          ok: false,
          error: `O apelido precisa ter de ${NICKNAME_MIN} a ${NICKNAME_MAX} caracteres.`,
        };
      }
      if (!GAME_ROOM_CODE_RE.test(code)) return { ok: false, error: 'Código de sala inválido' };
      if (isNicknameTaken(code, name)) {
        return {
          ok: false,
          error: 'Já há um astronauta com esse apelido neste mundo. Escolha outro.',
        };
      }
      return { ok: true };
    },
  );
}
