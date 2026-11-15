import { GAME_NAME } from '@mars/shared';
import { buildApp } from './app';
import { config } from './config';
import { closeDb } from './db/client';
import { runMigrations } from './db/migrate';
import { registerGameNamespace, flushGameSaves } from './realtime/game';
import { createSocketServer } from './realtime/socket';
import { purgeExpired } from './worlds/service';

await runMigrations();

const app = await buildApp();
const io = createSocketServer(app.server);
registerGameNamespace(io);

await app.listen({ port: config.port, host: '0.0.0.0' });
console.log(`🚀 ${GAME_NAME} — API + Socket.IO em http://localhost:${config.port}`);

// Limpeza diária de jogadores inativos e mundos sem ninguém vinculado.
const cleanup = setInterval(() => void purgeExpired().catch(() => {}), 24 * 60 * 60 * 1000);
cleanup.unref();

let closing = false;
async function shutdown() {
  if (closing) return;
  closing = true;
  clearInterval(cleanup);
  await flushGameSaves();
  io.close();
  await app.close();
  await closeDb();
  process.exit(0);
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
