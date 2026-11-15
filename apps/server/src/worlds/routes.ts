import { GAME_ROOM_CODE_RE, hasProfanity, NICKNAME_MAX, NICKNAME_MIN, PROFANITY_NICK_MESSAGE } from '@mars/shared';
import type { FastifyInstance } from 'fastify';
import { config } from '../config';
import { isNicknameTaken, roomBase } from '../realtime/game';
import {
  ensurePlayer,
  forgetPlayer,
  linkSuit,
  listRecent,
  newPlayerKey,
  PLAYER_KEY_COOKIE,
  parseCookies,
  playerFromCookies,
  purgeExpired,
  unlink,
  worldBase,
  validPlayerKey,
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
  /** O visitante aceitou o cookie: nasce o jogador temporário e a chave que o liga aos mundos. */
  app.post('/api/worlds/consent', async (req, reply) => {
    const existing = parseCookies(req.headers.cookie)[PLAYER_KEY_COOKIE];
    const key = validPlayerKey(existing) ? existing : newPlayerKey();
    await ensurePlayer(key); // cria ou renova a validade
    reply.setCookie(PLAYER_KEY_COOKIE, key, cookieOpts);
    return { ok: true };
  });

  /** O visitante recusou/revogou: o jogador e os vínculos dele são apagados (mundo sem ninguém some). */
  app.delete('/api/worlds/consent', async (req, reply) => {
    const owner = await playerFromCookies(req.headers.cookie).catch(() => null);
    if (owner) await forgetPlayer(owner);
    reply.clearCookie(PLAYER_KEY_COOKIE, { ...cookieOpts, maxAge: undefined });
    return { ok: true };
  });

  app.get('/api/worlds/recent', async (req) => {
    const owner = await playerFromCookies(req.headers.cookie);
    if (!owner) return { canSave: false, worlds: [] };
    void purgeExpired().catch(() => {});
    return { canSave: true, worlds: await listRecent(owner) };
  });

  app.delete<{ Params: { code: string } }>('/api/worlds/:code', async (req, reply) => {
    const owner = await playerFromCookies(req.headers.cookie);
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
      const owner = await playerFromCookies(req.headers.cookie).catch(() => null);
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
      if (hasProfanity(name)) return { ok: false, error: PROFANITY_NICK_MESSAGE };
      if (!GAME_ROOM_CODE_RE.test(code)) return { ok: false, error: 'Código de sala inválido' };
      if (isNicknameTaken(code, name, owner)) {
        return {
          ok: false,
          error: 'Já há um astronauta com esse apelido neste mundo. Escolha outro.',
        };
      }
      // Quem entra só pelo código recebe a base real do mundo e, se já jogou nele, o traje que escolheu.
      const baseId = roomBase(code) ?? (await worldBase(code).catch(() => null)) ?? undefined;
      if (!baseId)
        return { ok: false, error: 'Sala não encontrada. Confira o código ou peça um novo convite.' };
      const suit = owner ? await linkSuit(owner, code).catch(() => null) : null;
      return { ok: true, baseId, hasSuit: Boolean(suit) };
    },
  );
}
