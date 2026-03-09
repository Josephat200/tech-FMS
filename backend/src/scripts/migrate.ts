import fs from 'fs';
import path from 'path';
import { Pool } from 'pg';
import { env } from '../config/env';

type Migration = {
  fileName: string;
  fullPath: string;
};

const pool = new Pool({
  host: env.DB_HOST,
  port: env.DB_PORT,
  database: env.DB_NAME,
  user: env.DB_USER,
  password: env.DB_PASSWORD,
  ssl:
    env.NODE_ENV === 'production'
      ? {
          rejectUnauthorized: env.DB_SSL_REJECT_UNAUTHORIZED,
          ca: env.DB_SSL_CA || undefined,
        }
      : false,
});

function getMigrationsDir(): string {
  return path.resolve(__dirname, '..', 'infrastructure', 'db', 'migrations');
}

function getMigrationFiles(): Migration[] {
  const dir = getMigrationsDir();
  const files = fs
    .readdirSync(dir)
    .filter((name) => name.endsWith('.sql'))
    .sort((a, b) => a.localeCompare(b));

  return files.map((fileName) => ({
    fileName,
    fullPath: path.join(dir, fileName),
  }));
}

async function ensureMigrationsTable(): Promise<void> {
  await pool.query(`
    CREATE SCHEMA IF NOT EXISTS tech_rica;

    CREATE TABLE IF NOT EXISTS tech_rica.schema_migrations (
      migration_id BIGSERIAL PRIMARY KEY,
      file_name TEXT NOT NULL UNIQUE,
      executed_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
}

async function getAppliedMigrations(): Promise<Set<string>> {
  const result = await pool.query<{ file_name: string }>(
    'SELECT file_name FROM tech_rica.schema_migrations ORDER BY file_name',
  );
  return new Set(result.rows.map((row) => row.file_name));
}

async function runMigrations(): Promise<void> {
  await ensureMigrationsTable();

  const migrations = getMigrationFiles();
  const applied = await getAppliedMigrations();

  for (const migration of migrations) {
    if (applied.has(migration.fileName)) {
      // eslint-disable-next-line no-console
      console.log(`SKIP ${migration.fileName}`);
      continue;
    }

    const sql = fs.readFileSync(migration.fullPath, 'utf-8');
    const client = await pool.connect();

    try {
      await client.query('BEGIN');
      await client.query(sql);
      await client.query('INSERT INTO tech_rica.schema_migrations(file_name) VALUES ($1)', [
        migration.fileName,
      ]);
      await client.query('COMMIT');
      // eslint-disable-next-line no-console
      console.log(`APPLY ${migration.fileName}`);
    } catch (error) {
      await client.query('ROLLBACK');
      // eslint-disable-next-line no-console
      console.error(`FAILED ${migration.fileName}`);
      throw error;
    } finally {
      client.release();
    }
  }
}

async function showStatus(): Promise<void> {
  await ensureMigrationsTable();
  const migrations = getMigrationFiles();
  const applied = await getAppliedMigrations();

  for (const migration of migrations) {
    const status = applied.has(migration.fileName) ? 'APPLIED' : 'PENDING';
    // eslint-disable-next-line no-console
    console.log(`${status} ${migration.fileName}`);
  }
}

async function main(): Promise<void> {
  const mode = process.argv[2] ?? 'up';

  try {
    if (mode === 'status') {
      await showStatus();
    } else {
      await runMigrations();
    }
  } finally {
    await pool.end();
  }
}

void main();
