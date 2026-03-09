CREATE TABLE IF NOT EXISTS tech_rica.auth_mfa_challenges (
  challenge_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES tech_rica.users(user_id) ON DELETE CASCADE,
  purpose TEXT NOT NULL CHECK (purpose IN ('LOGIN')),
  challenge_hash TEXT NOT NULL,
  delivery_channel TEXT NOT NULL CHECK (delivery_channel IN ('EMAIL', 'DEV')),
  expires_at TIMESTAMPTZ NOT NULL,
  consumed_at TIMESTAMPTZ,
  attempt_count INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 5,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_auth_mfa_challenges_user_created
  ON tech_rica.auth_mfa_challenges(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_auth_mfa_challenges_active
  ON tech_rica.auth_mfa_challenges(challenge_id, expires_at)
  WHERE consumed_at IS NULL;

CREATE TABLE IF NOT EXISTS tech_rica.invoices (
  invoice_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number TEXT NOT NULL UNIQUE,
  invoice_type TEXT NOT NULL CHECK (invoice_type IN ('AR', 'AP')),
  counterparty_name TEXT NOT NULL,
  issue_date DATE NOT NULL,
  due_date DATE NOT NULL,
  currency_code CHAR(3) NOT NULL DEFAULT 'USD',
  subtotal_amount NUMERIC(18,2) NOT NULL DEFAULT 0,
  tax_amount NUMERIC(18,2) NOT NULL DEFAULT 0,
  total_amount NUMERIC(18,2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'SUBMITTED', 'APPROVED', 'POSTED', 'PAID', 'VOID')),
  notes TEXT,
  created_by UUID REFERENCES tech_rica.users(user_id) ON DELETE SET NULL,
  approved_by UUID REFERENCES tech_rica.users(user_id) ON DELETE SET NULL,
  approved_at TIMESTAMPTZ,
  posted_journal_entry_id UUID REFERENCES tech_rica.journal_entries(journal_entry_id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_invoices_amounts_non_negative CHECK (
    subtotal_amount >= 0 AND tax_amount >= 0 AND total_amount >= 0
  ),
  CONSTRAINT chk_invoices_dates CHECK (due_date >= issue_date)
);

CREATE TABLE IF NOT EXISTS tech_rica.invoice_lines (
  invoice_line_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID NOT NULL REFERENCES tech_rica.invoices(invoice_id) ON DELETE CASCADE,
  line_number INTEGER NOT NULL,
  description TEXT NOT NULL,
  quantity NUMERIC(18,4) NOT NULL,
  unit_price NUMERIC(18,2) NOT NULL,
  line_total NUMERIC(18,2) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_invoice_lines_order UNIQUE (invoice_id, line_number),
  CONSTRAINT chk_invoice_lines_values CHECK (
    quantity > 0 AND unit_price >= 0 AND line_total >= 0
  )
);

CREATE INDEX IF NOT EXISTS idx_invoices_type_status_due
  ON tech_rica.invoices(invoice_type, status, due_date);

CREATE INDEX IF NOT EXISTS idx_invoices_counterparty
  ON tech_rica.invoices(counterparty_name);

CREATE TABLE IF NOT EXISTS tech_rica.budget_cycles (
  budget_cycle_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cycle_name TEXT NOT NULL,
  fiscal_year INTEGER NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'ACTIVE', 'CLOSED')),
  created_by UUID REFERENCES tech_rica.users(user_id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_budget_cycles_dates CHECK (end_date >= start_date),
  CONSTRAINT uq_budget_cycle_name_year UNIQUE (cycle_name, fiscal_year)
);

CREATE TABLE IF NOT EXISTS tech_rica.department_budgets (
  department_budget_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  budget_cycle_id UUID NOT NULL REFERENCES tech_rica.budget_cycles(budget_cycle_id) ON DELETE CASCADE,
  department_name TEXT NOT NULL,
  owner_user_id UUID REFERENCES tech_rica.users(user_id) ON DELETE SET NULL,
  planned_amount NUMERIC(18,2) NOT NULL,
  approved_amount NUMERIC(18,2) NOT NULL DEFAULT 0,
  actual_amount NUMERIC(18,2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED')),
  submitted_at TIMESTAMPTZ,
  approved_by UUID REFERENCES tech_rica.users(user_id) ON DELETE SET NULL,
  approved_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_department_budget_amounts CHECK (
    planned_amount >= 0 AND approved_amount >= 0 AND actual_amount >= 0
  ),
  CONSTRAINT uq_department_budget_cycle UNIQUE (budget_cycle_id, department_name)
);

CREATE INDEX IF NOT EXISTS idx_department_budgets_cycle_status
  ON tech_rica.department_budgets(budget_cycle_id, status);

DROP TRIGGER IF EXISTS trg_invoices_updated_at ON tech_rica.invoices;
CREATE TRIGGER trg_invoices_updated_at
BEFORE UPDATE ON tech_rica.invoices
FOR EACH ROW
EXECUTE FUNCTION tech_rica.fn_set_updated_at();

DROP TRIGGER IF EXISTS trg_budget_cycles_updated_at ON tech_rica.budget_cycles;
CREATE TRIGGER trg_budget_cycles_updated_at
BEFORE UPDATE ON tech_rica.budget_cycles
FOR EACH ROW
EXECUTE FUNCTION tech_rica.fn_set_updated_at();

DROP TRIGGER IF EXISTS trg_department_budgets_updated_at ON tech_rica.department_budgets;
CREATE TRIGGER trg_department_budgets_updated_at
BEFORE UPDATE ON tech_rica.department_budgets
FOR EACH ROW
EXECUTE FUNCTION tech_rica.fn_set_updated_at();
