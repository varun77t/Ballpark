import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import { config } from '../config';
import * as schema from './schema';

export const pool = new pg.Pool({ connectionString: config.databaseUrl, max: 10 });

export const db = drizzle(pool, { schema });

export type DB = typeof db;
/** A transaction handle or the root db — services accept either. */
export type Tx = Parameters<Parameters<DB['transaction']>[0]>[0] | DB;
