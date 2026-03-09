import { Pool } from 'pg';
import { env } from '../../config/env';

export const pgPool = new Pool({
  host: env.DB_HOST,
  port: env.DB_PORT,
  database: env.DB_NAME,
  user: env.DB_USER,
  password: env.DB_PASSWORD,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
  ssl:
    env.NODE_ENV === 'production'
      ? {
          rejectUnauthorized: env.DB_SSL_REJECT_UNAUTHORIZED,
          ca: env.DB_SSL_CA || undefined,
        }
      : false,
});

export async function verifyPostgresConnection(): Promise<void> {
  const client = await pgPool.connect();
  try {
    await client.query('SELECT 1');
  } finally {
    client.release();
  }
}
