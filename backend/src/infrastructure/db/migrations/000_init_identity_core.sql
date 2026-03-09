CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS citext;

CREATE SCHEMA IF NOT EXISTS tech_rica;

CREATE TABLE IF NOT EXISTS tech_rica.users (
  user_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username CITEXT NOT NULL UNIQUE,
  email CITEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS tech_rica.roles (
  role_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role_name TEXT NOT NULL UNIQUE,
  role_description TEXT,
  is_system_role BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS tech_rica.user_roles (
  user_id UUID NOT NULL REFERENCES tech_rica.users(user_id) ON DELETE CASCADE,
  role_id UUID NOT NULL REFERENCES tech_rica.roles(role_id) ON DELETE CASCADE,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, role_id)
);

CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON tech_rica.user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_role_id ON tech_rica.user_roles(role_id);

INSERT INTO tech_rica.roles(role_id, role_name, role_description, is_system_role)
VALUES (gen_random_uuid(), 'ADMIN', 'System administrator', TRUE)
ON CONFLICT (role_name) DO NOTHING;

INSERT INTO tech_rica.roles(role_id, role_name, role_description, is_system_role)
VALUES (gen_random_uuid(), 'USER', 'Default application user', TRUE)
ON CONFLICT (role_name) DO NOTHING;

CREATE OR REPLACE FUNCTION tech_rica.fn_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_users_updated_at ON tech_rica.users;
CREATE TRIGGER trg_users_updated_at
BEFORE UPDATE ON tech_rica.users
FOR EACH ROW
EXECUTE FUNCTION tech_rica.fn_set_updated_at();
