INSERT INTO tech_rica.roles(role_id, role_name, role_description, is_system_role)
VALUES (gen_random_uuid(), 'ACCOUNTANT', 'Finance accountant role', TRUE)
ON CONFLICT (role_name) DO NOTHING;

INSERT INTO tech_rica.roles(role_id, role_name, role_description, is_system_role)
VALUES (gen_random_uuid(), 'FINANCE_MANAGER', 'Finance manager role', TRUE)
ON CONFLICT (role_name) DO NOTHING;

INSERT INTO tech_rica.roles(role_id, role_name, role_description, is_system_role)
VALUES (gen_random_uuid(), 'HR', 'Human resources role', TRUE)
ON CONFLICT (role_name) DO NOTHING;

CREATE TABLE IF NOT EXISTS tech_rica.system_settings (
  setting_key TEXT PRIMARY KEY,
  setting_value JSONB NOT NULL,
  updated_by UUID REFERENCES tech_rica.users(user_id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO tech_rica.system_settings(setting_key, setting_value)
VALUES ('ADMIN_EDITING_MODE', '{"enabled": false}'::jsonb)
ON CONFLICT (setting_key) DO NOTHING;

CREATE TABLE IF NOT EXISTS tech_rica.change_requests (
  change_request_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action_type TEXT NOT NULL,
  target_resource TEXT NOT NULL,
  payload JSONB NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('PENDING', 'PROCESSING', 'APPROVED', 'REJECTED', 'FAILED')),
  requested_by UUID NOT NULL REFERENCES tech_rica.users(user_id) ON DELETE CASCADE,
  requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  approved_by UUID REFERENCES tech_rica.users(user_id) ON DELETE SET NULL,
  approved_at TIMESTAMPTZ,
  rejected_by UUID REFERENCES tech_rica.users(user_id) ON DELETE SET NULL,
  rejected_at TIMESTAMPTZ,
  rejection_reason TEXT,
  failure_reason TEXT,
  execution_result JSONB,
  executed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_change_requests_status_requested_at
  ON tech_rica.change_requests(status, requested_at DESC);

CREATE INDEX IF NOT EXISTS idx_change_requests_requested_by
  ON tech_rica.change_requests(requested_by);

CREATE TABLE IF NOT EXISTS tech_rica.audit_logs (
  audit_log_id BIGSERIAL PRIMARY KEY,
  actor_user_id UUID REFERENCES tech_rica.users(user_id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  details JSONB,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at
  ON tech_rica.audit_logs(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_logs_actor
  ON tech_rica.audit_logs(actor_user_id, created_at DESC);
