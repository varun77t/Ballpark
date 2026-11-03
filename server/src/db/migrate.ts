import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { db, pool } from './client';

const here = path.dirname(fileURLToPath(import.meta.url));
// Works from src/db (tsx) and from dist/ (bundled build).
const candidates = [path.resolve(here, '../../drizzle'), path.resolve(here, '../drizzle')];

export async function runMigrations() {
  const { existsSync } = await import('node:fs');
  const migrationsFolder = candidates.find((p) => existsSync(path.join(p, 'meta', '_journal.json')));
  if (!migrationsFolder) throw new Error(`No migrations folder found (looked in ${candidates.join(', ')})`);
  await migrate(db, { migrationsFolder });
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  runMigrations()
    .then(() => {
      console.log('✔ migrations applied');
      return pool.end();
    })
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
