import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import cookie from '@fastify/cookie';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import fastifyStatic from '@fastify/static';
import { GAME_NAME, type HealthResponse } from '@mars/shared';
import { sql } from 'drizzle-orm';
import Fastify from 'fastify';
import { installAuth } from './auth/plugin';
import { authRoutes } from './auth/routes';
import { config } from './config';
import { db } from './db/client';
import { friendRoutes } from './friends/routes';
import { installErrorHandler } from './http';
import { messageRoutes } from './messages/routes';
import { originAllowed } from './security/origin';
import { worldRoutes } from './worlds/routes';

export async function buildApp() {
  const app = Fastify({
    trustProxy: config.trustProxy,
    bodyLimit: 32 * 1024,
    logger: config.isTest
      ? false
      : {
          level: config.isProd ? 'info' : 'warn',
          // nunca registrar cookies, tokens ou senhas
          redact: ['req.headers.cookie', 'req.headers.authorization', 'res.headers["set-cookie"]'],
        },
  });

  installErrorHandler(app);

  await app.register(helmet, {
    // o site é uma SPA própria; CSP restrita a si mesma + WebSocket
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:'],
        connectSrc: ["'self'", 'ws:', 'wss:'],
        fontSrc: ["'self'", 'data:'],
        frameAncestors: ["'none'"],
      },
    },
    hsts: config.isProd,
  });
  await app.register(cors, {
    origin: (origin, cb) => cb(null, !origin || originAllowed(origin)),
    credentials: true,
  });
  await app.register(cookie);
  await app.register(rateLimit, { global: true, max: 300, timeWindow: '1 minute' });
  installAuth(app);

  await app.register(authRoutes);
  await app.register(friendRoutes);
  await app.register(messageRoutes);
  await app.register(worldRoutes);

  app.get('/api/health', async (): Promise<HealthResponse> => {
    let dbOk = true;
    try {
      await db.execute(sql`select 1`);
    } catch {
      dbOk = false;
    }
    return { ok: dbOk, game: GAME_NAME, time: new Date().toISOString(), db: dbOk };
  });

  // Em produção o próprio servidor entrega o site (um único processo/porta).
  const webDist = fileURLToPath(new URL('../../web/dist', import.meta.url));
  const serveWeb = existsSync(webDist);
  if (serveWeb) await app.register(fastifyStatic, { root: webDist, wildcard: false });
  app.setNotFoundHandler((req, reply) =>
    serveWeb && !req.url.startsWith('/api') && !req.url.startsWith('/socket.io')
      ? reply.sendFile('index.html')
      : reply.code(404).send({ error: 'Não encontrado' }),
  );

  return app;
}
