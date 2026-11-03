import 'dotenv/config';
import { z } from 'zod';

const env = z
  .object({
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
    PORT: z.coerce.number().int().positive().default(3001),
    DATABASE_URL: z.string().url().default('postgres://ballpark:ballpark@localhost:5434/ballpark'),
    TEST_DATABASE_URL: z.string().url().default('postgres://ballpark:ballpark@localhost:5434/ballpark_test'),
    SESSION_SECRET: z.string().min(16).default('dev-only-insecure-session-secret'),
  })
  .parse(process.env);

if (env.NODE_ENV === 'production' && env.SESSION_SECRET === 'dev-only-insecure-session-secret') {
  throw new Error('SESSION_SECRET must be set in production');
}

export const config = {
  ...env,
  isProd: env.NODE_ENV === 'production',
  isTest: env.NODE_ENV === 'test',
  databaseUrl: env.NODE_ENV === 'test' ? env.TEST_DATABASE_URL : env.DATABASE_URL,
};
