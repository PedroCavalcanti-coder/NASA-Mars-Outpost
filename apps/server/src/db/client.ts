import { neonConfig, Pool } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from 'ws';
import { config } from '../config';
import { schema } from './schema';

// Neon fala com o Postgres por WebSocket; no Node precisamos informar a implementação.
neonConfig.webSocketConstructor = ws;

export const pool = new Pool({ connectionString: config.databaseUrl, max: 8 });
// Erros em conexões ociosas não podem derrubar o processo.
pool.on('error', (err: Error) => console.error('[db] erro no pool:', err.message));

export const db = drizzle(pool, { schema });
export type Db = typeof db;

export async function closeDb() {
  await pool.end();
}
