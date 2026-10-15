-- =============================================================================
-- Reminders: per-user email opt-in + daily digest builder
-- Run once in Supabase SQL Editor. Safe to re-run.
-- =============================================================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS email_reminders boolean NOT NULL DEFAULT true;

-- Builds one row per user that has something due. Called by the send-reminders
-- Edge Function with the service role (never exposed to app users).
CREATE OR REPLACE FUNCTION public.reminder_digest()
RETURNS TABLE (user_id uuid, email text, full_name text, items jsonb)
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  WITH members AS (
    SELECT DISTINCT wm.user_id, wm.workspace_id
    FROM public.workspace_members wm
    JOIN public.profiles p ON p.id = wm.user_id AND p.email_reminders
    WHERE wm.status = 'active'
  ),
  bills AS (
    SELECT m.user_id,
           jsonb_build_object(
             'kind', 'bill',
             'title', r.title,
             'amount', r.amount,
             'currency', r.currency,
             'due', r.next_due_date,
             'days', (r.next_due_date - current_date)
           ) AS item
    FROM members m
    JOIN public.recurring_profiles r ON r.workspace_id = m.workspace_id
    WHERE r.active IS NOT FALSE
      AND r.next_due_date IS NOT NULL
      AND r.next_due_date <= current_date + GREATEST(COALESCE(r.reminder_days_before, 1), 1)
      AND r.next_due_date >= current_date - 7
  ),
  loans AS (
    SELECT m.user_id,
           jsonb_build_object(
             'kind', CASE WHEN d.direction = 'lent' THEN 'loan_to_collect' ELSE 'loan_to_pay' END,
             'title', COALESCE(c.name, 'Contact'),
             'amount', d.remaining_amount,
             'currency', d.currency,
             'due', d.due_date,
             'days', (d.due_date - current_date)
           ) AS item
    FROM members m
    JOIN public.debts d ON d.workspace_id = m.workspace_id
    LEFT JOIN public.contacts c ON c.id = d.contact_id
    WHERE d.status NOT IN ('settled', 'written_off')
      AND d.remaining_amount > 0
      AND d.due_date IS NOT NULL
      AND d.due_date <= current_date + 2
  ),
  budget_spend AS (
    SELECT m.user_id, b.id AS budget_id, b.amount AS limit_amount, b.currency,
           COALESCE(NULLIF(b.alert_threshold, 0), 80) AS threshold,
           cat.name AS category_name,
           COALESCE((
             SELECT SUM(tl.base_amount)
             FROM public.transactions t
             JOIN public.transaction_lines tl ON tl.transaction_id = t.id
             WHERE t.workspace_id = b.workspace_id
               AND t.deleted_at IS NULL
               AND t.type = 'expense'
               AND tl.direction = 'out'
               AND tl.category_id = b.category_id
               AND t.date >= COALESCE(b.start_date, date_trunc('month', current_date)::date)
               AND t.date <= COALESCE(b.end_date, (date_trunc('month', current_date) + interval '1 month - 1 day')::date)
           ), 0) AS spent
    FROM members m
    JOIN public.budgets b ON b.workspace_id = m.workspace_id
    LEFT JOIN public.categories cat ON cat.id = b.category_id
    WHERE b.amount > 0
  ),
  budgets_hit AS (
    SELECT user_id,
           jsonb_build_object(
             'kind', 'budget',
             'title', COALESCE(category_name, 'Budget'),
             'amount', spent,
             'limit', limit_amount,
             'currency', currency,
             'percent', round(spent / limit_amount * 100)
           ) AS item
    FROM budget_spend
    WHERE spent / limit_amount * 100 >= threshold
  ),
  all_items AS (
    SELECT * FROM bills UNION ALL SELECT * FROM loans UNION ALL SELECT * FROM budgets_hit
  )
  SELECT a.user_id, u.email::text, p.full_name, jsonb_agg(a.item) AS items
  FROM all_items a
  JOIN auth.users u ON u.id = a.user_id
  JOIN public.profiles p ON p.id = a.user_id
  WHERE u.email IS NOT NULL
  GROUP BY a.user_id, u.email, p.full_name;
$$;

REVOKE ALL ON FUNCTION public.reminder_digest() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reminder_digest() TO service_role;

-- -----------------------------------------------------------------------------
-- Scheduling (choose ONE):
--  A) Dashboard: Integrations -> Cron -> new job -> "Supabase Edge Function"
--     -> send-reminders, schedule: 0 4 * * *   (04:00 UTC = 09:00 Pakistan)
--  B) SQL (needs pg_cron + pg_net enabled under Database -> Extensions):
--     select cron.schedule('daily-reminders', '0 4 * * *', $$
--       select net.http_post(
--         url := 'https://nmbxopltqeilhzplwcgs.supabase.co/functions/v1/send-reminders',
--         headers := jsonb_build_object('Content-Type','application/json',
--                                       'x-cron-secret','<YOUR CRON_SECRET>'),
--         body := '{}'::jsonb);
--     $$);
-- -----------------------------------------------------------------------------
