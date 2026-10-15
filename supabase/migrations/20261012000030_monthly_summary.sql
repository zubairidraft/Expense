-- Monthly summary digest (previous calendar month, per user per workspace).
-- Called by the send-monthly-summary Edge Function with the service role.
CREATE OR REPLACE FUNCTION public.monthly_summary_digest()
RETURNS TABLE (user_id uuid, email text, full_name text, workspace_name text, currency text,
               month_label text, expense numeric, income numeric, top_category text,
               top_amount numeric, prev_expense numeric)
LANGUAGE sql SECURITY DEFINER SET search_path TO 'public'
AS $$
  WITH rng AS (
    SELECT (date_trunc('month', current_date) - interval '1 month')::date AS s,
           (date_trunc('month', current_date) - interval '1 day')::date AS e,
           (date_trunc('month', current_date) - interval '2 month')::date AS ps,
           (date_trunc('month', current_date) - interval '1 month' - interval '1 day')::date AS pe
  ),
  mem AS (
    SELECT DISTINCT wm.user_id, wm.workspace_id, u.email::text AS email, p.full_name, w.name AS wname, w.base_currency
    FROM workspace_members wm
    JOIN profiles p ON p.id = wm.user_id AND p.email_reminders
    JOIN auth.users u ON u.id = wm.user_id AND u.email IS NOT NULL
    JOIN workspaces w ON w.id = wm.workspace_id AND w.archived_at IS NULL
    WHERE wm.status = 'active'
  ),
  agg AS (
    SELECT m.user_id, m.workspace_id,
      COALESCE(SUM(tl.base_amount) FILTER (WHERE t.type='expense' AND tl.direction='out' AND t.date BETWEEN r.s AND r.e),0) AS expense,
      COALESCE(SUM(tl.base_amount) FILTER (WHERE t.type='income' AND tl.direction='in' AND t.date BETWEEN r.s AND r.e),0) AS income,
      COALESCE(SUM(tl.base_amount) FILTER (WHERE t.type='expense' AND tl.direction='out' AND t.date BETWEEN r.ps AND r.pe),0) AS prev_expense
    FROM mem m CROSS JOIN rng r
    JOIN transactions t ON t.workspace_id = m.workspace_id AND t.deleted_at IS NULL AND t.date BETWEEN r.ps AND r.e
    JOIN transaction_lines tl ON tl.transaction_id = t.id
    GROUP BY m.user_id, m.workspace_id
  ),
  top AS (
    SELECT DISTINCT ON (m.workspace_id) m.workspace_id, c.name AS cname, SUM(tl.base_amount) AS amt
    FROM (SELECT DISTINCT workspace_id FROM mem) m CROSS JOIN rng r
    JOIN transactions t ON t.workspace_id = m.workspace_id AND t.deleted_at IS NULL AND t.type='expense' AND t.date BETWEEN r.s AND r.e
    JOIN transaction_lines tl ON tl.transaction_id = t.id AND tl.direction='out'
    LEFT JOIN categories c ON c.id = tl.category_id
    GROUP BY m.workspace_id, c.name
    ORDER BY m.workspace_id, SUM(tl.base_amount) DESC
  )
  SELECT m.user_id, m.email, m.full_name, m.wname, m.base_currency,
         to_char((SELECT s FROM rng), 'FMMonth YYYY'),
         a.expense, a.income, COALESCE(tp.cname,'Uncategorized'), COALESCE(tp.amt,0), a.prev_expense
  FROM mem m JOIN agg a ON a.user_id=m.user_id AND a.workspace_id=m.workspace_id
  LEFT JOIN top tp ON tp.workspace_id = m.workspace_id
  WHERE a.expense > 0 OR a.income > 0;
$$;
REVOKE ALL ON FUNCTION public.monthly_summary_digest() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.monthly_summary_digest() TO service_role;
-- Schedule (Dashboard -> Integrations -> Cron): 0 4 1 * *  (1st of month, 09:00 Pakistan)
