import { Pool } from 'pg';
import { env } from '../config/env';
import { hashPassword } from '../infrastructure/security/hash';

type BootstrapInput = {
  email: string;
  password: string;
  username: string;
  firstName: string;
  lastName: string;
};

function getInput(): BootstrapInput {
  const email = process.env.BOOTSTRAP_ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.BOOTSTRAP_ADMIN_PASSWORD?.trim();
  const username = process.env.BOOTSTRAP_ADMIN_USERNAME?.trim();
  const firstName = process.env.BOOTSTRAP_ADMIN_FIRST_NAME?.trim();
  const lastName = process.env.BOOTSTRAP_ADMIN_LAST_NAME?.trim();

  if (!email || !password) {
    throw new Error('BOOTSTRAP_ADMIN_EMAIL and BOOTSTRAP_ADMIN_PASSWORD are required.');
  }

  if (password.length < 12) {
    throw new Error('BOOTSTRAP_ADMIN_PASSWORD must be at least 12 characters long.');
  }

  return {
    email,
    password,
    username: username || email.split('@')[0],
    firstName: firstName || 'System',
    lastName: lastName || 'Administrator',
  };
}

async function main(): Promise<void> {
  const input = getInput();

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

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    await client.query(
      `
      INSERT INTO tech_rica.roles(role_id, role_name, role_description, is_system_role)
      VALUES (gen_random_uuid(), 'ADMIN', 'System administrator', TRUE)
      ON CONFLICT (role_name) DO NOTHING
      `,
    );

    const existing = await client.query<{
      user_id: string;
      has_admin: boolean;
    }>(
      `
      SELECT
        u.user_id,
        EXISTS (
          SELECT 1
          FROM tech_rica.user_roles ur
          JOIN tech_rica.roles r ON r.role_id = ur.role_id
          WHERE ur.user_id = u.user_id AND r.role_name = 'ADMIN'
        ) AS has_admin
      FROM tech_rica.users u
      WHERE u.email = $1
      LIMIT 1
      `,
      [input.email],
    );

    let userId = existing.rows[0]?.user_id;

    if (!userId) {
      const passwordHash = await hashPassword(input.password);
      const created = await client.query<{ user_id: string }>(
        `
        INSERT INTO tech_rica.users (username, email, password_hash, first_name, last_name, is_active)
        VALUES ($1, $2, $3, $4, $5, TRUE)
        RETURNING user_id
        `,
        [input.username, input.email, passwordHash, input.firstName, input.lastName],
      );

      userId = created.rows[0].user_id;
    }

    await client.query(
      `
      INSERT INTO tech_rica.user_roles (user_id, role_id)
      SELECT $1, role_id
      FROM tech_rica.roles
      WHERE role_name = 'ADMIN'
      ON CONFLICT (user_id, role_id) DO NOTHING
      `,
      [userId],
    );

    await client.query('COMMIT');

    // eslint-disable-next-line no-console
    console.log(`BOOTSTRAP_ADMIN_SUCCESS email=${input.email}`);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

void main();