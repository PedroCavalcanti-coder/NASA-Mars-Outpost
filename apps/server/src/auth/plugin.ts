import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { config } from '../config';
import { HttpError } from '../http';
import { originAllowed } from '../security/origin';
import { verifyToken } from '../security/tokens';
import { type Authenticated, loadAuth } from './sessions';

declare module 'fastify' {
  interface FastifyRequest {
    auth: Authenticated | null;
  }
}

const bearer = (header: string | undefined) =>
  header?.startsWith('Bearer ') ? header.slice(7) : undefined;

export function installAuth(app: FastifyInstance) {
  app.decorateRequest('auth', null);

  // 1) Anti-CSRF: cookies são SameSite, e além disso rejeitamos Origin desconhecida em POST/PATCH/DELETE.
  app.addHook('onRequest', async (req) => {
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return;
    const origin = req.headers.origin;
    if (origin && !originAllowed(origin, req.headers.host)) {
      throw new HttpError(403, 'Origem não permitida');
    }
  });

  // 2) Identifica o usuário pelo cookie (site) ou pelo header Authorization (ferramentas/testes).
  app.addHook('onRequest', async (req) => {
    const token = req.cookies[config.cookies.access] ?? bearer(req.headers.authorization);
    const claims = await verifyToken(token, 'access');
    req.auth = claims ? await loadAuth(claims) : null;
  });
}

/** preHandler das rotas que exigem login. */
export async function requireAuth(req: FastifyRequest, _reply: FastifyReply) {
  if (!req.auth) throw new HttpError(401, 'Faça login para continuar');
}

/** Usuário autenticado (use depois de `requireAuth`). */
export function me(req: FastifyRequest) {
  if (!req.auth) throw new HttpError(401, 'Faça login para continuar');
  return req.auth;
}
