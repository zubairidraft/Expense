-- =============================================================================
-- Migration: 20261008000016_analytics_views.sql
-- Purpose: Security Invoker Analytics Views for Spending, Cash Flow, Balances & Net Worth
-- =============================================================================

BEGIN;

-- 1. Monthly Spending by Category View
-- Aggregates cleared/reconciled expenses by year, month, and category within workspace
CREATE OR REPLACE VIEW public.v_monthly_spending_by_category
WITH (security_invoker = true)
AS
SELECT 
  t.workspace_id,
  DATE_TRUNC('month', t.date)::DATE AS month_date,
  EXTRACT(YEAR FROM t.date)::INT AS year,
  EXTRACT(MONTH FROM t.date)::INT AS month,
  tl.category_id,
  COALESCE(c.name, 'Uncategorized') AS category_name,
  COALESCE(c.color, '#94a3b8') AS category_color,
  COALESCE(c.icon, '📦') AS category_icon,
  COUNT(DISTINCT t.id)::INT AS transaction_count,
  SUM(tl.base_amount)::NUMERIC(19,4) AS total_amount
FROM public.transactions t
JOIN public.transaction_lines tl ON tl.transaction_id = t.id
LEFT JOIN public.categories c ON c.id = tl.category_id
WHERE t.deleted_at IS NULL
  AND t.type = 'expense'
  AND tl.direction = 'out'
  AND t.status IN ('cleared', 'reconciled')
GROUP BY 
  t.workspace_id,
  DATE_TRUNC('month', t.date),
  EXTRACT(YEAR FROM t.date),
  EXTRACT(MONTH FROM t.date),
  tl.category_id,
  c.name,
  c.color,
  c.icon;

-- 2. Monthly Cash Flow View (Income vs Expense vs Net Savings)
CREATE OR REPLACE VIEW public.v_cash_flow_monthly
WITH (security_invoker = true)
AS
WITH monthly_flows AS (
  SELECT
    t.workspace_id,
    DATE_TRUNC('month', t.date)::DATE AS month_date,
    EXTRACT(YEAR FROM t.date)::INT AS year,
    EXTRACT(MONTH FROM t.date)::INT AS month,
    SUM(CASE WHEN t.type = 'income' AND tl.direction = 'in' THEN tl.base_amount ELSE 0 END)::NUMERIC(19,4) AS total_income,
    SUM(CASE WHEN t.type = 'expense' AND tl.direction = 'out' THEN tl.base_amount ELSE 0 END)::NUMERIC(19,4) AS total_expense
  FROM public.transactions t
  JOIN public.transaction_lines tl ON tl.transaction_id = t.id
  WHERE t.deleted_at IS NULL
    AND t.status IN ('cleared', 'reconciled')
    AND t.type IN ('income', 'expense')
  GROUP BY 
    t.workspace_id, 
    DATE_TRUNC('month', t.date),
    EXTRACT(YEAR FROM t.date),
    EXTRACT(MONTH FROM t.date)
)
SELECT
  workspace_id,
  month_date,
  year,
  month,
  total_income,
  total_expense,
  (total_income - total_expense)::NUMERIC(19,4) AS net_cash_flow,
  CASE 
    WHEN total_income > 0 THEN 
      ROUND((((total_income - total_expense) / total_income) * 100)::NUMERIC, 2)
    ELSE 0.00
  END AS savings_rate_percent
FROM monthly_flows;

-- 3. Current Account Balances View
-- Computes real-time cleared balance from opening balance + lines based on account nature
CREATE OR REPLACE VIEW public.v_account_balances_current
WITH (security_invoker = true)
AS
WITH line_totals AS (
  SELECT
    tl.account_id,
    COALESCE(SUM(CASE WHEN tl.direction = 'in' THEN tl.amount ELSE 0 END), 0)::NUMERIC(19,4) AS total_in,
    COALESCE(SUM(CASE WHEN tl.direction = 'out' THEN tl.amount ELSE 0 END), 0)::NUMERIC(19,4) AS total_out,
    COALESCE(SUM(CASE WHEN tl.direction = 'in' THEN tl.base_amount ELSE 0 END), 0)::NUMERIC(19,4) AS total_base_in,
    COALESCE(SUM(CASE WHEN tl.direction = 'out' THEN tl.base_amount ELSE 0 END), 0)::NUMERIC(19,4) AS total_base_out
  FROM public.transaction_lines tl
  JOIN public.transactions t ON t.id = tl.transaction_id
  WHERE t.deleted_at IS NULL
    AND t.status IN ('cleared', 'reconciled')
  GROUP BY tl.account_id
)
SELECT
  a.id AS account_id,
  a.workspace_id,
  a.name AS account_name,
  a.type AS account_type,
  a.nature AS account_nature,
  a.currency,
  a.opening_balance,
  a.icon,
  a.color,
  a.visibility,
  a.archived_at,
  -- For Asset accounts: balance = opening + in - out
  -- For Liability accounts: balance = opening + out - in (positive represents debt owed)
  CASE 
    WHEN a.nature = 'asset' THEN 
      (a.opening_balance + COALESCE(lt.total_in, 0) - COALESCE(lt.total_out, 0))::NUMERIC(19,4)
    ELSE 
      (a.opening_balance + COALESCE(lt.total_out, 0) - COALESCE(lt.total_in, 0))::NUMERIC(19,4)
  END AS current_balance,
  CASE 
    WHEN a.nature = 'asset' THEN 
      (a.opening_balance + COALESCE(lt.total_base_in, 0) - COALESCE(lt.total_base_out, 0))::NUMERIC(19,4)
    ELSE 
      (a.opening_balance + COALESCE(lt.total_base_out, 0) - COALESCE(lt.total_base_in, 0))::NUMERIC(19,4)
  END AS current_base_balance
FROM public.accounts a
LEFT JOIN line_totals lt ON lt.account_id = a.id
WHERE a.archived_at IS NULL;

-- 4. Net Worth Snapshot View
-- Summarizes workspace total assets, liabilities, and net worth
CREATE OR REPLACE VIEW public.v_net_worth_snapshot
WITH (security_invoker = true)
AS
SELECT
  workspace_id,
  COALESCE(SUM(CASE WHEN account_nature = 'asset' THEN current_base_balance ELSE 0 END), 0)::NUMERIC(19,4) AS total_assets,
  COALESCE(SUM(CASE WHEN account_nature = 'liability' THEN current_base_balance ELSE 0 END), 0)::NUMERIC(19,4) AS total_liabilities,
  (
    COALESCE(SUM(CASE WHEN account_nature = 'asset' THEN current_base_balance ELSE 0 END), 0) -
    COALESCE(SUM(CASE WHEN account_nature = 'liability' THEN current_base_balance ELSE 0 END), 0)
  )::NUMERIC(19,4) AS net_worth
FROM public.v_account_balances_current
GROUP BY workspace_id;

COMMIT;
