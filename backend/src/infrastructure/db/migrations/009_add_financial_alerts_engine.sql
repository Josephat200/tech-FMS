CREATE TABLE IF NOT EXISTS tech_rica.financial_alerts (
  alert_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_type TEXT NOT NULL CHECK (alert_type IN ('OVERDUE_INVOICE', 'BUDGET_OVERRUN', 'CUSTOM')),
  severity TEXT NOT NULL CHECK (severity IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  metadata JSONB,
  status TEXT NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'ACKNOWLEDGED', 'RESOLVED')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  acknowledged_at TIMESTAMPTZ,
  acknowledged_by UUID REFERENCES tech_rica.users(user_id) ON DELETE SET NULL,
  resolved_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_financial_alerts_status_created
  ON tech_rica.financial_alerts(status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_financial_alerts_type_status
  ON tech_rica.financial_alerts(alert_type, status);

CREATE UNIQUE INDEX IF NOT EXISTS uq_financial_alerts_open_signature
  ON tech_rica.financial_alerts(alert_type, entity_type, entity_id)
  WHERE status = 'OPEN';
