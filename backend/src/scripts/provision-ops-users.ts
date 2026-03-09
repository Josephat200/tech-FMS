import crypto from 'crypto';
import { Pool } from 'pg';
import { env } from '../config/env';
import { hashPassword } from '../infrastructure/security/hash';

type ProvisionUser = {
  email: string;
  username: string;
  firstName: string;
  lastName: string;
  role: 'ADMIN' | 'ACCOUNTANT' | 'FINANCE_MANAGER' | 'HR' | 'AUDITOR' | 'DEPARTMENT_MANAGER' | 'USER';
};

type Credential = {
  email: string;
  password: string;
  role: ProvisionUser['role'];
};

const usersToProvision: ProvisionUser[] = [
  {
    email: 'admin@techrica.local',
    username: 'admin.techrica',
    firstName: 'System',
    lastName: 'Administrator',
    role: 'ADMIN',
  },
  {
    email: 'accountant@techrica.local',
    username: 'accountant.techrica',
    firstName: 'Finance',
    lastName: 'Accountant',
    role: 'ACCOUNTANT',
  },
  {
    email: 'financemanager@techrica.local',
    username: 'financemanager.techrica',
    firstName: 'Finance',
    lastName: 'Manager',
    role: 'FINANCE_MANAGER',
  },
  {
    email: 'hr@techrica.local',
    username: 'hr.techrica',
    firstName: 'Human',
    lastName: 'Resources',
    role: 'HR',
  },
  {
    email: 'itsupport@techrica.local',
    username: 'it.techrica',
    firstName: 'IT',
    lastName: 'Support',
    role: 'USER',
  },
];

function generatePassword(): string {
  const random = crypto.randomBytes(12).toString('base64url');
  return `Tmp#${random}9aA`;
}

async function ensureRoleExists(client: Pool, roleName: ProvisionUser['role']): Promise<void> {
  await client.query(
    `
      INSERT INTO tech_rica.roles(role_id, role_name, role_description, is_system_role)
      VALUES (gen_random_uuid(), $1, $2, TRUE)
      ON CONFLICT (role_name) DO NOTHING
    `,
    [roleName, `${roleName} role`],
  );
}

async function upsertUser(
  client: Pool,
  input: ProvisionUser,
  passwordHash: string,
): Promise<{ userId: string }> {
  const result = await client.query<{ user_id: string }>(
    `
      INSERT INTO tech_rica.users (username, email, password_hash, first_name, last_name, is_active)
      VALUES ($1, $2, $3, $4, $5, TRUE)
      ON CONFLICT (email)
      DO UPDATE SET
        username = EXCLUDED.username,
        password_hash = EXCLUDED.password_hash,
        first_name = EXCLUDED.first_name,
        last_name = EXCLUDED.last_name,
        is_active = TRUE,
        updated_at = now()
      RETURNING user_id
    `,
    [input.username, input.email, passwordHash, input.firstName, input.lastName],
  );

  return { userId: result.rows[0].user_id };
}

async function assignSingleRole(
  client: Pool,
  userId: string,
  roleName: ProvisionUser['role'],
): Promise<void> {
  await client.query('BEGIN');
  try {
    await client.query('DELETE FROM tech_rica.user_roles WHERE user_id = $1', [userId]);

    await client.query(
      `
        INSERT INTO tech_rica.user_roles (user_id, role_id)
        SELECT $1, role_id
        FROM tech_rica.roles
        WHERE role_name = $2
      `,
      [userId, roleName],
    );

    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  }
}

async function main(): Promise<void> {
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

  const credentials: Credential[] = [];

  try {
    for (const user of usersToProvision) {
      await ensureRoleExists(pool, user.role);

      const password = generatePassword();
      const passwordHash = await hashPassword(password);
      const { userId } = await upsertUser(pool, user, passwordHash);
      await assignSingleRole(pool, userId, user.role);

      credentials.push({
        email: user.email,
        password,
        role: user.role,
      });
    }

    process.stdout.write(JSON.stringify({ credentials }, null, 2));
  } finally {
    await pool.end();
  }
}

void main();
