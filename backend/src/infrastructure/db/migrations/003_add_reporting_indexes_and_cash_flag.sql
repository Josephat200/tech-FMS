ALTER TABLE tech_rica.accounts
  ADD COLUMN IF NOT EXISTS is_cash_account BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_journal_entries_status_date
  ON tech_rica.journal_entries(status, transaction_date);

CREATE INDEX IF NOT EXISTS idx_journal_lines_entry_account
  ON tech_rica.journal_lines(journal_entry_id, account_id);

CREATE INDEX IF NOT EXISTS idx_accounts_type_active_cash
  ON tech_rica.accounts(account_type, is_active, is_cash_account);

CREATE INDEX IF NOT EXISTS idx_journal_lines_account_amounts
  ON tech_rica.journal_lines(account_id, debit_amount, credit_amount);
