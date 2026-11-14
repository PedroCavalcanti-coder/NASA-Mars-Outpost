import { resolve } from 'node:path';
import { migrate } from 'drizzle-orm/neon-serverless/migrator';
import { db } from './client';

// Scripts rodam com cwd = apps/server (npm -w), tanto em dev (tsx) quanto no bundle (dist/).
const migrationsFolder = process.env.MIGRATIONS_DIR ?? resolve(process.cwd(), 'drizzle');

/**
 * Aplica as migrações SQL (pasta ./drizzle). Idempotente.
 * O controle de migrações fica em `outpost.__migrations`, longe do `drizzle.__drizzle_migrations`
 * do protótipo antigo que divide este banco.
 */
export async function runMigrations() {
  await migrate(db, {
    migrationsFolder,
    migrationsSchema: 'outpost',
    migrationsTable: '__migrations',
  });
}
