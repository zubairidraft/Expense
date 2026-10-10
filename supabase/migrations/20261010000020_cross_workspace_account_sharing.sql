-- =============================================================================
-- Migration 020: Cross-Workspace Account Sharing & Unified Ledger Balances
-- =============================================================================
-- Features:
-- 1. Table: public.account_shares (account_id, workspace_id, can_post, detail_level, count_in_net_worth, status)
-- 2. RLS & permissions: authorized owners/admins can share & revoke.
-- 3. book_transaction_core: allows posting if account is owned OR actively shared with can_post=true.
-- 4. Unified Balance: secure account balance calculation across all originating workspaces.
-- 5. get_shared_account_activity: RPC returning foreign transaction activity masked according to detail_level.
-- 6. Workspace delete protection: blocks hard delete of workspace if foreign shared transactions exist.
-- 7. Reconciled transaction lock: blocks deletion/modification of reconciled transactions across workspaces.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Create account_shares table
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.account_shares (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  can_post BOOLEAN NOT NULL DEFAULT true,
  detail_level TEXT NOT NULL DEFAULT 'summary' CHECK (detail_level IN ('summary', 'full')),
  count_in_net_worth BOOLEAN NOT NULL DEFAULT false,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'revoked')),
  shared_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  revoked_at TIMESTAMPTZ,
  CONSTRAINT uq_account_workspace_share UNIQUE (account_id, workspace_id)
);

CREATE INDEX IF NOT EXISTS idx_account_shares_account ON public.account_shares(account_id);
CREATE INDEX IF NOT EXISTS idx_account_shares_workspace ON public.account_shares(workspace_id);
CREATE INDEX IF NOT EXISTS idx_account_shares_active ON public.account_shares(account_id, workspace_id) WHERE status = 'active';

ALTER TABLE public.account_shares ENABLE ROW LEVEL SECURITY;

-- -----------------------------------------------------------------------------
-- 2. RLS Policies for account_shares
-- -----------------------------------------------------------------------------
-- SELECT: viewable by members of either home workspace or target shared workspace
DROP POLICY IF EXISTS "Account shares viewable by involved workspace members" ON public.account_shares;
CREATE POLICY "Account shares viewable by involved workspace members" ON public.account_shares
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.accounts a
      WHERE a.id = account_shares.account_id
        AND public.is_workspace_member(a.workspace_id, auth.uid())
    )
    OR public.is_workspace_member(workspace_id, auth.uid())
  );

-- INSERT: user must be owner or admin in home workspace AND in target workspace
DROP POLICY IF EXISTS "Account shares insertable by owners/admins of both workspaces" ON public.account_shares;
CREATE POLICY "Account shares insertable by owners/admins of both workspaces" ON public.account_shares
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.accounts a
      WHERE a.id = account_shares.account_id
        AND a.visibility = 'shared'
        AND a.archived_at IS NULL
        AND public.get_user_workspace_role(a.workspace_id, auth.uid()) IN ('owner', 'admin')
    )
    AND public.get_user_workspace_role(workspace_id, auth.uid()) IN ('owner', 'admin')
  );

-- UPDATE: user must be owner or admin in home workspace
DROP POLICY IF EXISTS "Account shares updatable by home workspace admins" ON public.account_shares;
CREATE POLICY "Account shares updatable by home workspace admins" ON public.account_shares
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.accounts a
      WHERE a.id = account_shares.account_id
        AND public.get_user_workspace_role(a.workspace_id, auth.uid()) IN ('owner', 'admin')
    )
  );

-- -----------------------------------------------------------------------------
-- 3. Update public.accounts SELECT policy to include shared accounts
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Accounts viewable by authorized workspace members" ON public.accounts;
CREATE POLICY "Accounts viewable by authorized workspace members" ON public.accounts
  FOR SELECT USING (
    (
      public.is_workspace_member(workspace_id, auth.uid()) AND (
        visibility = 'shared'
        OR public.get_user_workspace_role(workspace_id, auth.uid()) = 'owner'
        OR owner_member_id IN (
          SELECT id FROM public.workspace_members 
          WHERE user_id = auth.uid() AND workspace_id = accounts.workspace_id
        )
      )
    )
    OR (
      visibility = 'shared'
      AND archived_at IS NULL
      AND EXISTS (
        SELECT 1 FROM public.account_shares s
        WHERE s.account_id = accounts.id
          AND s.status = 'active'
          AND public.is_workspace_member(s.workspace_id, auth.uid())
      )
    )
  );

-- -----------------------------------------------------------------------------
-- 4. Helper Function: Share Account RPC
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.share_account(
  p_account_id UUID,
  p_target_workspace_id UUID,
  p_can_post BOOLEAN DEFAULT true,
  p_detail_level TEXT DEFAULT 'summary',
  p_count_in_net_worth BOOLEAN DEFAULT false
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_home_ws UUID;
  v_visibility TEXT;
  v_archived TIMESTAMPTZ;
  v_caller UUID := auth.uid();
  v_share_id UUID;
BEGIN
  SELECT workspace_id, visibility, archived_at INTO v_home_ws, v_visibility, v_archived
  FROM public.accounts
  WHERE id = p_account_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Account not found';
  END IF;

  IF v_archived IS NOT NULL THEN
    RAISE EXCEPTION 'Archived accounts cannot be shared';
  END IF;

  IF v_visibility = 'private' THEN
    RAISE EXCEPTION 'Private accounts cannot be shared. Change visibility to shared first.';
  END IF;

  IF v_home_ws = p_target_workspace_id THEN
    RAISE EXCEPTION 'Cannot share an account with its own home workspace';
  END IF;

  IF public.get_user_workspace_role(v_home_ws, v_caller) NOT IN ('owner', 'admin') THEN
    RAISE EXCEPTION 'Only owners or admins of the home workspace can share this account';
  END IF;

  IF public.get_user_workspace_role(p_target_workspace_id, v_caller) NOT IN ('owner', 'admin') THEN
    RAISE EXCEPTION 'You must be an owner or admin of the target workspace to accept the share';
  END IF;

  IF p_detail_level NOT IN ('summary', 'full') THEN
    RAISE EXCEPTION 'Detail level must be summary or full';
  END IF;

  INSERT INTO public.account_shares (
    account_id, workspace_id, can_post, detail_level, count_in_net_worth, status, shared_by, revoked_at
  )
  VALUES (
    p_account_id, p_target_workspace_id, COALESCE(p_can_post, true),
    COALESCE(p_detail_level, 'summary'), COALESCE(p_count_in_net_worth, false),
    'active', v_caller, NULL
  )
  ON CONFLICT (account_id, workspace_id)
  DO UPDATE SET
    can_post = EXCLUDED.can_post,
    detail_level = EXCLUDED.detail_level,
    count_in_net_worth = EXCLUDED.count_in_net_worth,
    status = 'active',
    revoked_at = NULL,
    updated_at = now()
  RETURNING id INTO v_share_id;

  RETURN v_share_id;
END;
$$;

-- -----------------------------------------------------------------------------
-- 5. Helper Function: Revoke Account Share RPC
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.revoke_account_share(
  p_account_id UUID,
  p_target_workspace_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_home_ws UUID;
  v_caller UUID := auth.uid();
BEGIN
  SELECT workspace_id INTO v_home_ws FROM public.accounts WHERE id = p_account_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Account not found';
  END IF;

  -- Allowed if caller is owner/admin in home workspace OR owner/admin in target workspace
  IF public.get_user_workspace_role(v_home_ws, v_caller) NOT IN ('owner', 'admin')
     AND public.get_user_workspace_role(p_target_workspace_id, v_caller) NOT IN ('owner', 'admin') THEN
    RAISE EXCEPTION 'Permission denied to revoke account share';
  END IF;

  UPDATE public.account_shares
  SET status = 'revoked',
      can_post = false,
      revoked_at = now(),
      updated_at = now()
  WHERE account_id = p_account_id
    AND workspace_id = p_target_workspace_id;

  RETURN true;
END;
$$;

-- -----------------------------------------------------------------------------
-- 6. Update private.book_transaction_core to allow active shared accounts
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION private.book_transaction_core(
  p_workspace_id UUID,
  p_user_id UUID,
  p_type TEXT,
  p_date DATE,
  p_status TEXT,
  p_merchant_id UUID,
  p_payee_name TEXT,
  p_notes TEXT,
  p_idempotency_key TEXT,
  p_source TEXT,
  p_lines JSONB,
  p_tag_ids UUID[] DEFAULT '{}'::UUID[],
  p_caller_role TEXT DEFAULT 'owner'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tx_id UUID;
  v_base TEXT;
  v_line JSONB;
  v_acc RECORD;
  v_dir TEXT;
  v_amount NUMERIC;
  v_minor INT;
  v_base_minor INT;
  v_fx NUMERIC;
  v_base_amount NUMERIC;
  v_cat UUID;
  v_cat_ws UUID;
  v_date DATE := COALESCE(p_date, CURRENT_DATE);
  v_count INT;
  v_tag UUID;
  v_member_id UUID;
  v_fee_cat UUID;
  v_is_shared BOOLEAN;
BEGIN
  IF p_idempotency_key IS NULL OR length(trim(p_idempotency_key)) = 0 THEN
    RAISE EXCEPTION 'Idempotency key is required';
  END IF;

  -- Idempotent replay: return the existing transaction untouched
  SELECT id INTO v_tx_id FROM public.transactions
  WHERE workspace_id = p_workspace_id AND idempotency_key = p_idempotency_key;
  IF v_tx_id IS NOT NULL THEN
    RETURN v_tx_id;
  END IF;

  SELECT base_currency INTO v_base FROM public.workspaces WHERE id = p_workspace_id AND archived_at IS NULL;
  IF v_base IS NULL THEN
    RAISE EXCEPTION 'Workspace not found or archived';
  END IF;
  v_base_minor := private.currency_minor_units(v_base);

  IF p_type NOT IN ('expense', 'income', 'transfer', 'refund', 'adjustment', 'debt', 'settlement', 'opening') THEN
    RAISE EXCEPTION 'Invalid transaction type: %', p_type;
  END IF;

  IF p_lines IS NULL OR jsonb_typeof(p_lines) <> 'array' OR jsonb_array_length(p_lines) = 0 THEN
    RAISE EXCEPTION 'A transaction needs at least one line';
  END IF;

  IF p_merchant_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.merchants WHERE id = p_merchant_id AND workspace_id = p_workspace_id
  ) THEN
    RAISE EXCEPTION 'Merchant does not belong to this workspace';
  END IF;

  SELECT id INTO v_member_id FROM public.workspace_members
  WHERE workspace_id = p_workspace_id AND user_id = p_user_id AND status = 'active';

  INSERT INTO public.transactions (
    workspace_id, type, date, status, merchant_id, payee_name, notes, idempotency_key, source, created_by
  )
  VALUES (
    p_workspace_id, p_type, v_date, COALESCE(p_status, 'cleared'), p_merchant_id,
    NULLIF(trim(COALESCE(p_payee_name, '')), ''), p_notes, p_idempotency_key,
    COALESCE(p_source, 'manual'), p_user_id
  )
  RETURNING id INTO v_tx_id;

  FOR v_line IN SELECT * FROM jsonb_array_elements(p_lines)
  LOOP
    SELECT * INTO v_acc FROM public.accounts
    WHERE id = private.try_uuid(v_line->>'accountId');

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Account % does not exist', v_line->>'accountId';
    END IF;

    -- Validate account belongs to this workspace OR is an active share with can_post = true
    IF v_acc.workspace_id <> p_workspace_id THEN
      SELECT EXISTS (
        SELECT 1 FROM public.account_shares
        WHERE account_id = v_acc.id
          AND workspace_id = p_workspace_id
          AND status = 'active'
          AND can_post = true
      ) INTO v_is_shared;

      IF NOT v_is_shared THEN
        RAISE EXCEPTION 'Account "%" does not belong to this workspace and is not actively shared with posting rights', v_acc.name;
      END IF;

      IF v_acc.visibility = 'private' THEN
        RAISE EXCEPTION 'Private accounts cannot be posted to from other workspaces';
      END IF;
    ELSE
      -- Owned account check
      IF v_acc.visibility = 'private'
         AND p_caller_role <> 'owner'
         AND v_acc.owner_member_id IS DISTINCT FROM v_member_id THEN
        RAISE EXCEPTION 'Account "%" is private to another member', v_acc.name;
      END IF;
    END IF;

    IF v_acc.archived_at IS NOT NULL THEN
      RAISE EXCEPTION 'Account "%" is archived', v_acc.name;
    END IF;

    v_dir := v_line->>'direction';
    IF v_dir NOT IN ('in', 'out') THEN
      RAISE EXCEPTION 'Line direction must be in or out';
    END IF;

    BEGIN
      v_amount := (v_line->>'amount')::NUMERIC;
    EXCEPTION WHEN others THEN
      RAISE EXCEPTION 'Invalid amount: %', v_line->>'amount';
    END;
    IF v_amount IS NULL OR v_amount <= 0 THEN
      RAISE EXCEPTION 'Amount must be greater than zero';
    END IF;

    -- Currency always comes from the account; enforce precision
    v_minor := private.currency_minor_units(v_acc.currency);
    IF v_amount <> round(v_amount, v_minor) THEN
      RAISE EXCEPTION 'Amount % has more decimals than % allows (%)', v_amount, v_acc.currency, v_minor;
    END IF;

    -- Compute base_amount according to originating workspace's base currency
    IF v_acc.currency = v_base THEN
      v_fx := 1;
    ELSE
      v_fx := NULLIF((v_line->>'fxRate'), '')::NUMERIC;
      IF v_fx IS NULL OR v_fx <= 0 OR (v_fx = 1 AND v_acc.currency <> v_base) THEN
        v_fx := public.get_fx_rate(v_acc.currency, v_base, v_date);
      END IF;
      IF v_fx IS NULL THEN
        RAISE EXCEPTION 'No exchange rate available for % -> %. Add one under FX Rates.', v_acc.currency, v_base;
      END IF;
    END IF;
    v_base_amount := round(v_amount * v_fx, v_base_minor);
    IF v_base_amount <= 0 THEN
      v_base_amount := power(10::NUMERIC, -v_base_minor);
    END IF;

    -- Categories belong to the originating workspace (or null for transfers/adjustments)
    v_cat := private.try_uuid(v_line->>'categoryId');
    IF v_cat IS NOT NULL THEN
      SELECT workspace_id INTO v_cat_ws FROM public.categories WHERE id = v_cat;
      IF v_cat_ws IS DISTINCT FROM p_workspace_id THEN
        RAISE EXCEPTION 'Category % does not belong to this workspace', v_cat;
      END IF;
    END IF;

    INSERT INTO public.transaction_lines (
      transaction_id, account_id, category_id, direction, amount, currency,
      fx_rate, base_amount, description, billable, reimbursable
    )
    VALUES (
      v_tx_id, v_acc.id, v_cat, v_dir, v_amount, v_acc.currency,
      v_fx, v_base_amount, NULLIF(trim(COALESCE(v_line->>'description', '')), ''),
      COALESCE((v_line->>'billable')::BOOLEAN, false),
      COALESCE((v_line->>'reimbursable')::BOOLEAN, false)
    );
  END LOOP;

  -- Enforce double-entry line count rules
  SELECT count(*) INTO v_count FROM public.transaction_lines WHERE transaction_id = v_tx_id;
  IF p_type = 'transfer' AND v_count < 2 THEN
    RAISE EXCEPTION 'A transfer must have at least 2 legs (out and in)';
  END IF;

  -- Attach tags (belong to originating workspace)
  IF p_tag_ids IS NOT NULL AND array_length(p_tag_ids, 1) > 0 THEN
    FOREACH v_tag IN ARRAY p_tag_ids
    LOOP
      IF NOT EXISTS (SELECT 1 FROM public.tags WHERE id = v_tag AND workspace_id = p_workspace_id) THEN
        RAISE EXCEPTION 'Tag % does not belong to this workspace', v_tag;
      END IF;
      INSERT INTO public.transaction_tags (transaction_id, tag_id)
      VALUES (v_tx_id, v_tag)
      ON CONFLICT DO NOTHING;
    END LOOP;
  END IF;

  RETURN v_tx_id;
END;
$$;

-- -----------------------------------------------------------------------------
-- 7. Unified Global Balance Function & View
-- -----------------------------------------------------------------------------
-- Calculates true balance across all originating workspaces for accounts caller has access to
CREATE OR REPLACE FUNCTION public.get_account_balance(p_account_id UUID)
RETURNS NUMERIC(19,4)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_acc RECORD;
  v_caller UUID := auth.uid();
  v_total_in NUMERIC(19,4);
  v_total_out NUMERIC(19,4);
  v_bal NUMERIC(19,4);
BEGIN
  SELECT a.* INTO v_acc FROM public.accounts a WHERE a.id = p_account_id;
  IF NOT FOUND THEN
    RETURN 0;
  END IF;

  -- Caller must be member of home workspace OR member of active shared workspace
  IF NOT (
    public.is_workspace_member(v_acc.workspace_id, v_caller)
    OR EXISTS (
      SELECT 1 FROM public.account_shares s
      WHERE s.account_id = p_account_id
        AND s.status = 'active'
        AND public.is_workspace_member(s.workspace_id, v_caller)
    )
  ) THEN
    RAISE EXCEPTION 'Permission denied to view balance for account %', p_account_id;
  END IF;

  SELECT
    COALESCE(SUM(tl.amount) FILTER (WHERE tl.direction = 'in'), 0)::NUMERIC(19,4),
    COALESCE(SUM(tl.amount) FILTER (WHERE tl.direction = 'out'), 0)::NUMERIC(19,4)
  INTO v_total_in, v_total_out
  FROM public.transaction_lines tl
  JOIN public.transactions t ON t.id = tl.transaction_id
  WHERE tl.account_id = p_account_id
    AND t.deleted_at IS NULL
    AND t.status IN ('cleared', 'reconciled');

  IF v_acc.nature = 'asset' THEN
    v_bal := v_acc.opening_balance + v_total_in - v_total_out;
  ELSE
    v_bal := v_acc.opening_balance + v_total_out - v_total_in;
  END IF;

  RETURN v_bal;
END;
$$;

-- Secure view: incorporates both owned accounts and shared accounts for a given workspace
CREATE OR REPLACE VIEW public.v_account_balances_current
WITH (security_invoker = true) AS
WITH accessible_accounts AS (
  -- Accounts owned by home workspace
  SELECT 
    a.id, a.workspace_id, a.name, a.type, a.nature, a.currency,
    a.opening_balance, a.icon, a.color, a.visibility, a.archived_at,
    w.base_currency,
    false AS is_shared,
    'home'::TEXT AS share_relation,
    true AS can_post,
    true AS count_in_net_worth
  FROM public.accounts a
  JOIN public.workspaces w ON w.id = a.workspace_id
  WHERE a.archived_at IS NULL

  UNION ALL

  -- Accounts shared into target workspace
  SELECT 
    a.id, s.workspace_id, a.name, a.type, a.nature, a.currency,
    a.opening_balance, a.icon, a.color, a.visibility, a.archived_at,
    w.base_currency,
    true AS is_shared,
    'shared_in'::TEXT AS share_relation,
    s.can_post,
    s.count_in_net_worth
  FROM public.account_shares s
  JOIN public.accounts a ON a.id = s.account_id
  JOIN public.workspaces w ON w.id = s.workspace_id
  WHERE s.status = 'active'
    AND a.archived_at IS NULL
),
balances AS (
  SELECT aa.*,
         public.get_account_balance(aa.id) AS bal
  FROM accessible_accounts aa
)
SELECT
  b.id AS account_id,
  b.workspace_id,
  b.name AS account_name,
  b.type AS account_type,
  b.nature AS account_nature,
  b.currency,
  b.opening_balance,
  b.icon,
  b.color,
  b.visibility,
  b.archived_at,
  b.is_shared,
  b.share_relation,
  b.can_post,
  b.count_in_net_worth,
  b.bal AS current_balance,
  round(b.bal * COALESCE(public.get_fx_rate(b.currency, b.base_currency, CURRENT_DATE), 0), 4)::NUMERIC(19,4) AS current_base_balance
FROM balances b;

-- -----------------------------------------------------------------------------
-- 8. RPC: get_shared_account_activity
-- -----------------------------------------------------------------------------
-- Returns foreign transactions on shared accounts with field masking according to detail_level
CREATE OR REPLACE FUNCTION public.get_shared_account_activity(
  p_workspace_id UUID,
  p_account_id UUID DEFAULT NULL
)
RETURNS TABLE (
  transaction_id UUID,
  origin_workspace_id UUID,
  origin_workspace_name TEXT,
  account_id UUID,
  account_name TEXT,
  date DATE,
  type TEXT,
  status TEXT,
  direction TEXT,
  amount NUMERIC,
  currency TEXT,
  base_amount NUMERIC,
  payee_name TEXT,
  notes TEXT,
  detail_level TEXT,
  is_foreign BOOLEAN,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller UUID := auth.uid();
BEGIN
  -- Validate caller has access to p_workspace_id
  IF NOT public.is_workspace_member(p_workspace_id, v_caller) THEN
    RAISE EXCEPTION 'Access denied to workspace %', p_workspace_id;
  END IF;

  RETURN QUERY
  SELECT
    t.id AS transaction_id,
    t.workspace_id AS origin_workspace_id,
    w_origin.name AS origin_workspace_name,
    a.id AS account_id,
    a.name AS account_name,
    t.date,
    t.type,
    t.status,
    tl.direction,
    tl.amount,
    tl.currency,
    tl.base_amount,
    CASE
      WHEN s.detail_level = 'full' THEN t.payee_name
      ELSE ('Activity in ' || w_origin.name)
    END AS payee_name,
    CASE
      WHEN s.detail_level = 'full' THEN t.notes
      ELSE NULL
    END AS notes,
    s.detail_level,
    true AS is_foreign,
    t.created_at
  FROM public.transactions t
  JOIN public.workspaces w_origin ON w_origin.id = t.workspace_id
  JOIN public.transaction_lines tl ON tl.transaction_id = t.id
  JOIN public.accounts a ON a.id = tl.account_id
  JOIN public.account_shares s ON s.account_id = a.id
  WHERE t.deleted_at IS NULL
    AND t.workspace_id <> p_workspace_id
    AND (
      -- Case 1: Account is owned by p_workspace_id and shared with t.workspace_id
      (a.workspace_id = p_workspace_id AND s.workspace_id = t.workspace_id)
      OR
      -- Case 2: Account is shared with p_workspace_id and transaction was posted from home or another shared ws
      (s.workspace_id = p_workspace_id)
    )
    AND (p_account_id IS NULL OR a.id = p_account_id)
  ORDER BY t.date DESC, t.created_at DESC;
END;
$$;

-- -----------------------------------------------------------------------------
-- 9. Protect Reconciled Transactions from Cross-Workspace Tampering
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION private.check_reconciled_transaction_lock()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.status = 'reconciled' THEN
      RAISE EXCEPTION 'Cannot delete reconciled transaction. Please have home workspace unlock/un-reconcile it first.';
    END IF;
    RETURN OLD;
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.status = 'reconciled' AND NEW.status <> 'reconciled' THEN
      -- Only owners/admins of the home workspace of involved accounts can un-reconcile
      IF NOT EXISTS (
        SELECT 1 FROM public.transaction_lines tl
        JOIN public.accounts a ON a.id = tl.account_id
        WHERE tl.transaction_id = OLD.id
          AND public.get_user_workspace_role(a.workspace_id, auth.uid()) IN ('owner', 'admin')
      ) THEN
        RAISE EXCEPTION 'Only owner/admin of the account home workspace can unlock a reconciled transaction.';
      END IF;
    END IF;
    RETURN NEW;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_reconciled_transaction_lock ON public.transactions;
CREATE TRIGGER trg_reconciled_transaction_lock
  BEFORE UPDATE OR DELETE ON public.transactions
  FOR EACH ROW
  EXECUTE FUNCTION private.check_reconciled_transaction_lock();

-- -----------------------------------------------------------------------------
-- 10. Workspace Hard-Delete Protection Trigger
-- -----------------------------------------------------------------------------
-- Prevents hard deleting a workspace if it has transactions linked to accounts owned by other workspaces
CREATE OR REPLACE FUNCTION private.prevent_delete_workspace_with_shared_transactions()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.transactions t
    JOIN public.transaction_lines tl ON tl.transaction_id = t.id
    JOIN public.accounts a ON a.id = tl.account_id
    WHERE t.workspace_id = OLD.id
      AND a.workspace_id <> OLD.id
  ) THEN
    RAISE EXCEPTION 'Workspace "%" contains transactions on shared accounts owned by other workspaces. Archive the workspace instead of permanently deleting it to preserve ledger integrity.', OLD.name;
  END IF;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_delete_workspace_with_shared_tx ON public.workspaces;
CREATE TRIGGER trg_prevent_delete_workspace_with_shared_tx
  BEFORE DELETE ON public.workspaces
  FOR EACH ROW
  EXECUTE FUNCTION private.prevent_delete_workspace_with_shared_transactions();

-- -----------------------------------------------------------------------------
-- 11. View: Overview of Account Shares for UI
-- -----------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.v_account_shares_overview
WITH (security_invoker = true) AS
SELECT
  s.id AS share_id,
  s.account_id,
  a.name AS account_name,
  a.currency AS account_currency,
  a.workspace_id AS home_workspace_id,
  w_home.name AS home_workspace_name,
  s.workspace_id AS target_workspace_id,
  w_target.name AS target_workspace_name,
  s.can_post,
  s.detail_level,
  s.count_in_net_worth,
  s.status,
  s.created_at,
  s.revoked_at,
  s.shared_by
FROM public.account_shares s
JOIN public.accounts a ON a.id = s.account_id
JOIN public.workspaces w_home ON w_home.id = a.workspace_id
JOIN public.workspaces w_target ON w_target.id = s.workspace_id;
