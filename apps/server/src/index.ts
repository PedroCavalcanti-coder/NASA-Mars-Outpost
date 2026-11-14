import { GAME_NAME } from '@mars/shared';
import { buildApp } from './app';
import { purgeSessions } from './auth/sessions';
import { config } from './config';
import { closeDb } from './db/client';
import { runMigrations } from './db/migrate';
import { registerGameNamespace } from './realtime/game';
import { createSocketServer } from './realtime/socket';

await runMigrations();

const app = await buildApp();
const io = createSocketServer(app.server);
registerGameNamespace(io);

await app.listen({ port: config.port, host: '0.0.0.0' });
console.log(`🚀 ${GAME_NAME} — API + Socket.IO em http://localhost:${config.port}`);

// Limpeza diária de sessões antigas.
const cleanup = setInterval(() => void purgeSessions().catch(() => {}), 24 * 60 * 60 * 1000);
cleanup.unref();

let closing = false;
async function shutdown() {
  if (closing) return;
  closing = true;
  clearInterval(cleanup);
  io.close();
  await app.close();
  await closeDb();
  process.exit(0);
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
