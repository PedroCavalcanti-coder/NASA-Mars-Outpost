// Testa a conexão com o Neon e lista as tabelas do schema `outpost`.
//   npm run db:check
import { sql } from 'drizzle-orm';
import { config } from '../config';
import { closeDb, db } from './client';

const host = new URL(config.databaseUrl).hostname.replace(/^[^.]+/, '***');
console.log(`Host: ${host}`);

try {
  const version = await db.execute(sql`select version() as version`);
  console.log(`✔ Conectado: ${String(version.rows[0]?.version).split(',')[0]}`);
  const tables = await db.execute(
    sql`select table_name from information_schema.tables where table_schema = 'outpost' order by 1`,
  );
  const names = tables.rows.map((t) => String(t.table_name));
  console.log(
    names.length
      ? `✔ Tabelas (${names.length}): ${names.join(', ')}`
      : '⚠ Nenhuma tabela em outpost ainda — rode: npm run db:migrate',
  );
  await closeDb();
} catch (e) {
  console.error(`✘ Falha ao conectar: ${(e as Error).message}`);
  process.exit(1);
}
