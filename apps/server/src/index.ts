import { GAME_NAME, type HealthResponse } from '@mars/shared';
import Fastify from 'fastify';
import { config } from './config';

const app = Fastify({ logger: true });

app.get(
  '/api/health',
  async (): Promise<HealthResponse> => ({
    ok: true,
    game: GAME_NAME,
    time: new Date().toISOString(),
  }),
);

app.listen({ port: config.port, host: '0.0.0.0' }).then(() => {
  console.log(`🚀 ${GAME_NAME} server em http://localhost:${config.port}`);
});
