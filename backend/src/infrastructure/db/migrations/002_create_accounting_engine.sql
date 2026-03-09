CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS tech_rica.accounts (
  account_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_code TEXT NOT NULL UNIQUE,
  account_name TEXT NOT NULL,
  account_type TEXT NOT NULL CHECK (account_type IN ('ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE')),
  normal_balance TEXT NOT NULL CHECK (normal_balance IN ('DEBIT', 'CREDIT')),
  allow_negative BOOLEAN NOT NULL DEFAULT TRUE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS tech_rica.journal_entries (
  journal_entry_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  idempotency_key TEXT UNIQUE,
  reference_no TEXT,
  description TEXT NOT NULL,
  transaction_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'POSTED' CHECK (status IN ('POSTED', 'VOIDED')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE tech_rica.journal_entries
  ADD COLUMN IF NOT EXISTS idempotency_key TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'uq_journal_entries_idempotency_key'
      AND conrelid = 'tech_rica.journal_entries'::regclass
  ) THEN
    ALTER TABLE tech_rica.journal_entries
      ADD CONSTRAINT uq_journal_entries_idempotency_key UNIQUE (idempotency_key);
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS tech_rica.journal_lines (
  journal_line_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  journal_entry_id UUID NOT NULL REFERENCES tech_rica.journal_entries(journal_entry_id) ON DELETE CASCADE,
  line_number INTEGER NOT NULL,
  account_id UUID NOT NULL REFERENCES tech_rica.accounts(account_id) ON DELETE RESTRICT,
  line_description TEXT,
  debit_amount NUMERIC(18,2) NOT NULL DEFAULT 0,
  credit_amount NUMERIC(18,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_journal_line_amount_non_negative CHECK (debit_amount >= 0 AND credit_amount >= 0),
  CONSTRAINT chk_journal_line_one_side_only CHECK (
    (debit_amount > 0 AND credit_amount = 0)
    OR
    (credit_amount > 0 AND debit_amount = 0)
  ),
  CONSTRAINT uq_journal_entry_line UNIQUE (journal_entry_id, line_number)
);

CREATE TABLE IF NOT EXISTS tech_rica.account_balances (
  account_id UUID PRIMARY KEY REFERENCES tech_rica.accounts(account_id) ON DELETE CASCADE,
  balance NUMERIC(18,2) NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_journal_entries_transaction_date
  ON tech_rica.journal_entries(transaction_date DESC);

CREATE INDEX IF NOT EXISTS idx_journal_entries_idempotency
  ON tech_rica.journal_entries(idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_journal_lines_journal_entry_id
  ON tech_rica.journal_lines(journal_entry_id);

CREATE INDEX IF NOT EXISTS idx_journal_lines_account_id
  ON tech_rica.journal_lines(account_id);

CREATE INDEX IF NOT EXISTS idx_accounts_active_type
  ON tech_rica.accounts(is_active, account_type);

CREATE OR REPLACE FUNCTION tech_rica.fn_validate_journal_balance(p_journal_entry_id UUID)
RETURNS VOID AS $$
DECLARE
  v_debits NUMERIC(18,2);
  v_credits NUMERIC(18,2);
  v_line_count INTEGER;
BEGIN
  SELECT
    COALESCE(SUM(debit_amount), 0),
    COALESCE(SUM(credit_amount), 0),
    COUNT(*)
  INTO v_debits, v_credits, v_line_count
  FROM tech_rica.journal_lines
  WHERE journal_entry_id = p_journal_entry_id;

  IF v_line_count < 2 THEN
    RAISE EXCEPTION 'Journal entry % must have at least 2 lines', p_journal_entry_id;
  END IF;

  IF v_debits <> v_credits THEN
    RAISE EXCEPTION 'Journal entry % is unbalanced (debit %, credit %)', p_journal_entry_id, v_debits, v_credits;
  END IF;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION tech_rica.fn_journal_balance_trigger()
RETURNS TRIGGER AS $$
DECLARE
  v_journal_entry_id UUID;
BEGIN
  v_journal_entry_id := COALESCE(NEW.journal_entry_id, OLD.journal_entry_id);
  PERFORM tech_rica.fn_validate_journal_balance(v_journal_entry_id);
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_journal_balance_on_lines ON tech_rica.journal_lines;
CREATE CONSTRAINT TRIGGER trg_journal_balance_on_lines
AFTER INSERT OR UPDATE OR DELETE ON tech_rica.journal_lines
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION tech_rica.fn_journal_balance_trigger();
