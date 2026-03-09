import { pgPool } from '../../../../infrastructure/db/postgres';

type DateRange = {
  from: string;
  to: string;
};

type AsOfDate = {
  asOf: string;
};

export class FinancialReportService {
  async getTrialBalance({ asOf }: AsOfDate) {
    const linesResult = await pgPool.query<{
      account_id: string;
      account_code: string;
      account_name: string;
      account_type: string;
      total_debits: string;
      total_credits: string;
      closing_debit: string;
      closing_credit: string;
    }>(
      `
        WITH movement AS (
          SELECT
            a.account_id,
            a.account_code,
            a.account_name,
            a.account_type,
            COALESCE(SUM(jl.debit_amount), 0)::numeric(18,2) AS total_debits,
            COALESCE(SUM(jl.credit_amount), 0)::numeric(18,2) AS total_credits,
            (COALESCE(SUM(jl.debit_amount), 0) - COALESCE(SUM(jl.credit_amount), 0))::numeric(18,2) AS signed_balance
          FROM tech_rica.accounts a
          LEFT JOIN tech_rica.journal_lines jl ON jl.account_id = a.account_id
          LEFT JOIN tech_rica.journal_entries je
            ON je.journal_entry_id = jl.journal_entry_id
            AND je.status = 'POSTED'
            AND je.transaction_date <= $1::date
          WHERE a.is_active = TRUE
          GROUP BY a.account_id, a.account_code, a.account_name, a.account_type
        )
        SELECT
          account_id,
          account_code,
          account_name,
          account_type,
          total_debits,
          total_credits,
          GREATEST(signed_balance, 0)::numeric(18,2) AS closing_debit,
          GREATEST(-signed_balance, 0)::numeric(18,2) AS closing_credit
        FROM movement
        WHERE total_debits <> 0 OR total_credits <> 0
        ORDER BY account_code
      `,
      [asOf],
    );

    const totalsResult = await pgPool.query<{
      total_debit: string;
      total_credit: string;
    }>(
      `
        WITH trial AS (
          WITH movement AS (
            SELECT
              a.account_id,
              (COALESCE(SUM(jl.debit_amount), 0) - COALESCE(SUM(jl.credit_amount), 0))::numeric(18,2) AS signed_balance
            FROM tech_rica.accounts a
            LEFT JOIN tech_rica.journal_lines jl ON jl.account_id = a.account_id
            LEFT JOIN tech_rica.journal_entries je
              ON je.journal_entry_id = jl.journal_entry_id
              AND je.status = 'POSTED'
              AND je.transaction_date <= $1::date
            WHERE a.is_active = TRUE
            GROUP BY a.account_id
          )
          SELECT
            GREATEST(signed_balance, 0)::numeric(18,2) AS debit_side,
            GREATEST(-signed_balance, 0)::numeric(18,2) AS credit_side
          FROM movement
        )
        SELECT
          COALESCE(SUM(debit_side),0)::numeric(18,2) AS total_debit,
          COALESCE(SUM(credit_side),0)::numeric(18,2) AS total_credit
        FROM trial
      `,
      [asOf],
    );

    return {
      asOf,
      lines: linesResult.rows,
      totals: totalsResult.rows[0],
    };
  }

  async getIncomeStatement({ from, to }: DateRange) {
    const rows = await pgPool.query<{
      account_code: string;
      account_name: string;
      account_type: 'REVENUE' | 'EXPENSE';
      amount: string;
    }>(
      `
        WITH period_activity AS (
          SELECT
            a.account_code,
            a.account_name,
            a.account_type,
            COALESCE(SUM(jl.debit_amount),0) AS debits,
            COALESCE(SUM(jl.credit_amount),0) AS credits
          FROM tech_rica.accounts a
          JOIN tech_rica.journal_lines jl ON jl.account_id = a.account_id
          JOIN tech_rica.journal_entries je ON je.journal_entry_id = jl.journal_entry_id
          WHERE je.status = 'POSTED'
            AND je.transaction_date BETWEEN $1::date AND $2::date
            AND a.account_type IN ('REVENUE', 'EXPENSE')
          GROUP BY a.account_code, a.account_name, a.account_type
        )
        SELECT
          account_code,
          account_name,
          account_type,
          CASE
            WHEN account_type = 'REVENUE' THEN (credits - debits)
            ELSE (debits - credits)
          END::numeric(18,2) AS amount
        FROM period_activity
        ORDER BY account_type, account_code
      `,
      [from, to],
    );

    const totals = rows.rows.reduce(
      (acc, row) => {
        const amount = Number(row.amount);
        if (row.account_type === 'REVENUE') {
          acc.totalRevenue += amount;
        } else {
          acc.totalExpense += amount;
        }
        return acc;
      },
      { totalRevenue: 0, totalExpense: 0 },
    );

    return {
      from,
      to,
      revenue: rows.rows.filter((row) => row.account_type === 'REVENUE'),
      expenses: rows.rows.filter((row) => row.account_type === 'EXPENSE'),
      totals: {
        ...totals,
        netIncome: Number((totals.totalRevenue - totals.totalExpense).toFixed(2)),
      },
    };
  }

  async getBalanceSheet({ asOf }: AsOfDate) {
    const rows = await pgPool.query<{
      account_code: string;
      account_name: string;
      account_type: 'ASSET' | 'LIABILITY' | 'EQUITY' | 'REVENUE' | 'EXPENSE';
      signed_balance: string;
    }>(
      `
        WITH balances AS (
          SELECT
            a.account_code,
            a.account_name,
            a.account_type,
            (COALESCE(SUM(jl.debit_amount),0) - COALESCE(SUM(jl.credit_amount),0))::numeric(18,2) AS signed_balance
          FROM tech_rica.accounts a
          LEFT JOIN tech_rica.journal_lines jl ON jl.account_id = a.account_id
          LEFT JOIN tech_rica.journal_entries je
            ON je.journal_entry_id = jl.journal_entry_id
            AND je.status = 'POSTED'
            AND je.transaction_date <= $1::date
          WHERE a.is_active = TRUE
          GROUP BY a.account_code, a.account_name, a.account_type
        )
        SELECT account_code, account_name, account_type, signed_balance
        FROM balances
        WHERE signed_balance <> 0
        ORDER BY account_type, account_code
      `,
      [asOf],
    );

    const assets: Array<{ accountCode: string; accountName: string; amount: number }> = [];
    const liabilities: Array<{ accountCode: string; accountName: string; amount: number }> = [];
    const equity: Array<{ accountCode: string; accountName: string; amount: number }> = [];

    let retainedEarnings = 0;

    for (const row of rows.rows) {
      const signed = Number(row.signed_balance);

      if (row.account_type === 'ASSET') {
        assets.push({
          accountCode: row.account_code,
          accountName: row.account_name,
          amount: Number(signed.toFixed(2)),
        });
      } else if (row.account_type === 'LIABILITY') {
        liabilities.push({
          accountCode: row.account_code,
          accountName: row.account_name,
          amount: Number((-signed).toFixed(2)),
        });
      } else if (row.account_type === 'EQUITY') {
        equity.push({
          accountCode: row.account_code,
          accountName: row.account_name,
          amount: Number((-signed).toFixed(2)),
        });
      } else if (row.account_type === 'REVENUE') {
        retainedEarnings += -signed;
      } else if (row.account_type === 'EXPENSE') {
        retainedEarnings -= signed;
      }
    }

    if (retainedEarnings !== 0) {
      equity.push({
        accountCode: 'RETAINED_EARNINGS',
        accountName: 'Retained Earnings (Auto)',
        amount: Number(retainedEarnings.toFixed(2)),
      });
    }

    const totalAssets = Number(assets.reduce((sum, item) => sum + item.amount, 0).toFixed(2));
    const totalLiabilities = Number(
      liabilities.reduce((sum, item) => sum + item.amount, 0).toFixed(2),
    );
    const totalEquity = Number(equity.reduce((sum, item) => sum + item.amount, 0).toFixed(2));

    return {
      asOf,
      assets,
      liabilities,
      equity,
      totals: {
        totalAssets,
        totalLiabilities,
        totalEquity,
        totalLiabilitiesAndEquity: Number((totalLiabilities + totalEquity).toFixed(2)),
      },
    };
  }

  async getCashFlowStatement({ from, to }: DateRange) {
    const rows = await pgPool.query<{
      section: 'OPERATING' | 'INVESTING' | 'FINANCING' | 'UNCLASSIFIED';
      amount: string;
    }>(
      `
        WITH cash_entry_movements AS (
          SELECT
            je.journal_entry_id,
            COALESCE(SUM(
              CASE
                WHEN cash_ac.normal_balance = 'DEBIT'
                  THEN (cash_jl.debit_amount - cash_jl.credit_amount)
                ELSE (cash_jl.credit_amount - cash_jl.debit_amount)
              END
            ), 0)::numeric(18,2) AS cash_delta
          FROM tech_rica.journal_entries je
          JOIN tech_rica.journal_lines cash_jl ON cash_jl.journal_entry_id = je.journal_entry_id
          JOIN tech_rica.accounts cash_ac ON cash_ac.account_id = cash_jl.account_id
          WHERE je.status = 'POSTED'
            AND je.transaction_date BETWEEN $1::date AND $2::date
            AND cash_ac.is_cash_account = TRUE
          GROUP BY je.journal_entry_id
        ),
        counterpart_amounts AS (
          SELECT
            jl.journal_entry_id,
            CASE
              WHEN a.account_type IN ('REVENUE', 'EXPENSE') THEN 'OPERATING'
              WHEN a.account_type = 'ASSET' THEN 'INVESTING'
              WHEN a.account_type IN ('LIABILITY', 'EQUITY') THEN 'FINANCING'
              ELSE 'UNCLASSIFIED'
            END AS section,
            SUM((jl.debit_amount + jl.credit_amount))::numeric(18,2) AS amount_weight
          FROM tech_rica.journal_lines jl
          JOIN tech_rica.accounts a ON a.account_id = jl.account_id
          WHERE a.is_cash_account = FALSE
          GROUP BY jl.journal_entry_id, section
        ),
        entry_weight_totals AS (
          SELECT
            journal_entry_id,
            SUM(amount_weight)::numeric(18,2) AS total_weight
          FROM counterpart_amounts
          GROUP BY journal_entry_id
        ),
        allocated AS (
          SELECT
            ca.section,
            CASE
              WHEN ewt.total_weight = 0 THEN 0
              ELSE cem.cash_delta * (ca.amount_weight / ewt.total_weight)
            END::numeric(18,2) AS allocated_amount
          FROM cash_entry_movements cem
          JOIN counterpart_amounts ca ON ca.journal_entry_id = cem.journal_entry_id
          JOIN entry_weight_totals ewt ON ewt.journal_entry_id = cem.journal_entry_id
        )
        SELECT
          section,
          COALESCE(SUM(allocated_amount),0)::numeric(18,2) AS amount
        FROM allocated
        GROUP BY section
      `,
      [from, to],
    );

    const sections = {
      operating: 0,
      investing: 0,
      financing: 0,
      unclassified: 0,
    };

    for (const row of rows.rows) {
      const amount = Number(row.amount);
      if (row.section === 'OPERATING') sections.operating = amount;
      if (row.section === 'INVESTING') sections.investing = amount;
      if (row.section === 'FINANCING') sections.financing = amount;
      if (row.section === 'UNCLASSIFIED') sections.unclassified = amount;
    }

    return {
      from,
      to,
      sections,
      netCashMovement: Number(
        (sections.operating + sections.investing + sections.financing + sections.unclassified).toFixed(2),
      ),
    };
  }
}
