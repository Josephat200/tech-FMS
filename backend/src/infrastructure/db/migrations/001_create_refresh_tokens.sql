CREATE TABLE IF NOT EXISTS tech_rica.refresh_tokens (
  refresh_token_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES tech_rica.users(user_id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  issued_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  CHECK (expires_at > issued_at)
);

CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_id
  ON tech_rica.refresh_tokens(user_id);

CREATE INDEX IF NOT EXISTS idx_refresh_tokens_expires_at
  ON tech_rica.refresh_tokens(expires_at);

CREATE INDEX IF NOT EXISTS idx_refresh_tokens_active_lookup
  ON tech_rica.refresh_tokens(token_hash)
  WHERE revoked_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_active
  ON tech_rica.refresh_tokens(user_id, expires_at)
  WHERE revoked_at IS NULL;

INSERT INTO tech_rica.roles(role_id, role_name, role_description, is_system_role)
VALUES (gen_random_uuid(), 'USER', 'Default application user role', TRUE)
ON CONFLICT (role_name) DO NOTHING;
