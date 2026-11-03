import path from 'node:path';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import connectPgSimple from 'connect-pg-simple';
import express from 'express';
import rateLimit from 'express-rate-limit';
import session from 'express-session';
import helmet from 'helmet';
import { passport } from './auth/passport';
import { config } from './config';
import { pool } from './db/client';
import { errorHandler, notFoundHandler } from './middleware/errors';
import { authRouter } from './routes/auth';
import { dailyRouter, endlessRouter } from './routes/modes';
import { attemptsRouter, playRouter } from './routes/play';
import { leaderboardRouter, metaRouter, statsRouter } from './routes/stats';

const PgStore = connectPgSimple(session);

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  if (config.isProd) app.set('trust proxy', 1);

  app.use(
    helmet({
      contentSecurityPolicy: config.isProd
        ? {
            directives: {
              defaultSrc: ["'self'"],
              imgSrc: ["'self'", 'data:', 'blob:', 'https:'],
              styleSrc: ["'self'", "'unsafe-inline'"],
              fontSrc: ["'self'", 'data:'],
            },
          }
        : false,
    }),
  );
  app.use(express.json({ limit: '16kb' }));

  app.use(
    session({
      name: 'ballpark.sid',
      store: new PgStore({ pool, tableName: 'session', createTableIfMissing: false, pruneSessionInterval: config.isTest ? false : 60 * 15 }),
      secret: config.SESSION_SECRET,
      resave: false,
      saveUninitialized: false,
      rolling: true,
      cookie: {
        httpOnly: true,
        sameSite: 'lax',
        secure: config.isProd,
        maxAge: 1000 * 60 * 60 * 24 * 365,
      },
    }),
  );
  app.use(passport.initialize());
  app.use(passport.session());

  const authLimiter = rateLimit({
    windowMs: 15 * 60_000,
    limit: config.isTest ? 10_000 : 30,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: { error: 'Too many attempts. Try again in a few minutes.', code: 'rate_limited' },
  });

  const api = express.Router();
  api.get('/health', (_req, res) => res.json({ ok: true }));
  api.use('/auth/login', authLimiter);
  api.use('/auth/signup', authLimiter);
  api.use('/auth', authRouter);
  api.use('/meta', metaRouter);
  api.use('/play', playRouter);
  api.use('/attempts', attemptsRouter);
  api.use('/daily', dailyRouter);
  api.use('/endless', endlessRouter);
  api.use('/stats', statsRouter);
  api.use('/leaderboard', leaderboardRouter);
  api.use(notFoundHandler);
  app.use('/api', api);

  // In production the built client is served from the same origin.
  const clientDist = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../client/dist');
  if (config.isProd && existsSync(clientDist)) {
    app.use(express.static(clientDist, { index: false, maxAge: '1h' }));
    app.get('*', (_req, res) => res.sendFile(path.join(clientDist, 'index.html')));
  }

  app.use(errorHandler);
  return app;
}
