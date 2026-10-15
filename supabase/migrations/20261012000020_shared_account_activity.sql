-- =============================================================================
-- Shared-account activity feed ("kisne kya kiya")
-- Returns share grants/revocations and transactions posted on shared accounts
-- for a workspace the caller belongs to. Views are not tracked.
-- Run once in Supabase SQL Editor. Safe to re-run.
-- =============================================================================
CREATE OR REPLACE FUNCTION public.shared_account_activity(p_workspace_id uuid, p_limit integer DEFAULT 100)
RETURNS TABLE (event_at timestamptz, kind text, actor_name text, account_name text, workspace_name text, detail jsonb)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.workspace_members wm
    WHERE wm.workspace_id = p_workspace_id AND wm.user_id = auth.uid() AND wm.status = 'active'
  ) THEN
    RAISE EXCEPTION 'Not a member of this workspace';
  END IF;

  RETURN QUERY
  WITH rel AS (
    SELECT s.id AS share_id, s.account_id, s.workspace_id AS target_ws, a.workspace_id AS home_ws,
           a.name AS account_name, s.created_at, s.revoked_at, s.shared_by, s.can_post, s.detail_level
    FROM public.account_shares s
    JOIN public.accounts a ON a.id = s.account_id
    WHERE s.workspace_id = p_workspace_id OR a.workspace_id = p_workspace_id
  ),
  ev AS (
    SELECT r.created_at AS at, 'share_created'::text AS k, r.shared_by AS actor, r.account_name AS acct,
           (SELECT w.name FROM public.workspaces w WHERE w.id = CASE WHEN r.home_ws = p_workspace_id THEN r.target_ws ELSE r.home_ws END) AS wsname,
           jsonb_build_object('can_post', r.can_post, 'detail_level', r.detail_level,
                              'direction', CASE WHEN r.home_ws = p_workspace_id THEN 'out' ELSE 'in' END) AS d
    FROM rel r
    UNION ALL
    SELECT r.revoked_at, 'share_revoked', NULL::uuid, r.account_name,
           (SELECT w.name FROM public.workspaces w WHERE w.id = CASE WHEN r.home_ws = p_workspace_id THEN r.target_ws ELSE r.home_ws END),
           jsonb_build_object('direction', CASE WHEN r.home_ws = p_workspace_id THEN 'out' ELSE 'in' END)
    FROM rel r WHERE r.revoked_at IS NOT NULL
    UNION ALL
    SELECT t.created_at, 'tx_posted', t.created_by, r.account_name,
           (SELECT w.name FROM public.workspaces w WHERE w.id = t.workspace_id),
           jsonb_build_object('type', t.type, 'payee', t.payee_name, 'date', t.date,
                              'amount', SUM(tl.base_amount), 'currency', MAX(tl.currency),
                              'from_other_workspace', t.workspace_id <> p_workspace_id,
                              'deleted', t.deleted_at IS NOT NULL)
    FROM rel r
    JOIN public.transaction_lines tl ON tl.account_id = r.account_id
    JOIN public.transactions t ON t.id = tl.transaction_id
    GROUP BY t.id, t.created_at, t.created_by, r.account_name, t.workspace_id, t.type, t.payee_name, t.date, t.deleted_at
  )
  SELECT e.at, e.k, COALESCE(p.full_name, u.email::text, 'Unknown'), e.acct, e.wsname, e.d
  FROM ev e
  LEFT JOIN public.profiles p ON p.id = e.actor
  LEFT JOIN auth.users u ON u.id = e.actor
  WHERE e.at IS NOT NULL
  ORDER BY e.at DESC
  LIMIT LEAST(GREATEST(p_limit, 1), 300);
END;
$$;

REVOKE ALL ON FUNCTION public.shared_account_activity(uuid, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.shared_account_activity(uuid, integer) TO authenticated;
