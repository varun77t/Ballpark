/** Prepares the test database (TEST_DATABASE_URL): migrate, seed, and wipe player data. */
export default async function setup() {
  process.env.NODE_ENV = 'test';
  const { runMigrations } = await import('../src/db/migrate');
  const { seed } = await import('../src/db/seed/seed');
  const { pool } = await import('../src/db/client');
  await runMigrations();
  await seed();
  await pool.query('delete from daily_challenges; delete from users; delete from session');
  await pool.end();
}
