import { closeDb } from './client';
import { runMigrations } from './migrate';

await runMigrations();
console.log('✔ Migrações aplicadas (schema outpost).');
await closeDb();
