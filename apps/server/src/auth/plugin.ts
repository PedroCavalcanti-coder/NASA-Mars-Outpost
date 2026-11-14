import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { config } from '../config';
import { HttpError } from '../http';
import { verifyToken } from '../security/tokens';
import { type Authenticated, loadAuth } from './sessions';

declare module 'fastify' {
  interface FastifyRequest {
    auth: Authenticated | null;
  }
}

const bearer = (header: string | undefined) =>
  header?.startsWith('Bearer ') ? header.slice(7) : undefined;

/** Origens aceitas em requisições que alteram dados (defesa extra contra CSRF). */
function originAllowed(origin: string, host: string | undefined) {
  if (config.webOrigins.includes(origin.replace(/\/$/, ''))) return true;
  try {
    const url = new URL(origin);
    if (url.host === host) return true; // site servido pelo próprio servidor
    // Só em desenvolvimento: acesso pela rede local (o proxy do Vite troca o Host da requisição).
    return (
      !config.isProd &&
      /^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(url.hostname)
    );
  } catch {
    return false;
  }
}

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
