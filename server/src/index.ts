import { createApp } from './app';
import { config } from './config';
import { pool } from './db/client';

const app = createApp();

const server = app.listen(config.PORT, () => {
  console.log(`⚾ Ballpark API listening on http://localhost:${config.PORT}`);
});

function shutdown() {
  server.close(() => {
    pool.end().finally(() => process.exit(0));
  });
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
