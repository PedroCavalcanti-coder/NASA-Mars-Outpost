import type { FastifyReply } from 'fastify';
import { config } from '../config';

const base = {
  httpOnly: true,
  secure: config.isProd || config.cookieSameSite === 'none',
  sameSite: config.cookieSameSite,
} as const;

/** Cookie do token de acesso (cabeçalho em toda requisição) e do refresh (só em /api/auth). */
export function setAuthCookies(
  reply: FastifyReply,
  accessToken: string,
  refreshToken: string | null,
) {
  reply.setCookie(config.cookies.access, accessToken, {
    ...base,
    path: '/',
    maxAge: config.accessTtlSeconds,
  });
  if (refreshToken) {
    reply.setCookie(config.cookies.refresh, refreshToken, {
      ...base,
      path: '/api/auth',
      maxAge: config.refreshTtlSeconds,
    });
  }
  // Indicador sem segredo, legível pelo site: evita chamadas de login para visitantes anônimos.
  reply.setCookie('mo_in', '1', {
    secure: base.secure,
    sameSite: base.sameSite,
    path: '/',
    maxAge: config.refreshTtlSeconds,
  });
}

export function clearAuthCookies(reply: FastifyReply) {
  reply.clearCookie(config.cookies.access, { ...base, path: '/' });
  reply.clearCookie(config.cookies.refresh, { ...base, path: '/api/auth' });
  reply.clearCookie('mo_in', { secure: base.secure, sameSite: base.sameSite, path: '/' });
}
