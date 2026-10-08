-- =============================================================================
-- Migration: 20261008000007_rules_and_reconciliation.sql
-- Purpose: Rules Engine (Auto-categorization) & Bank Statement Reconciliation
-- =============================================================================

BEGIN;

-- 1. Rules Table
CREATE TABLE IF NOT EXISTS public.rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  priority INT NOT NULL DEFAULT 100,
  active BOOLEAN NOT NULL DEFAULT true,
  conditions JSONB NOT NULL DEFAULT '[]'::jsonb,
  actions JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

CREATE INDEX IF NOT EXISTS idx_rules_workspace_priority
  ON public.rules (workspace_id, priority ASC)
  WHERE active = true;

-- 2. Statement Reconciliations Table
CREATE TABLE IF NOT EXISTS public.reconciliations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  statement_date DATE NOT NULL,
  statement_balance NUMERIC(19,4) NOT NULL,
  cleared_balance NUMERIC(19,4) NOT NULL,
  difference NUMERIC(19,4) NOT NULL DEFAULT 0.00,
  status TEXT NOT NULL DEFAULT 'completed' CHECK (status IN ('in_progress', 'completed')),
  reconciled_transaction_ids UUID[] NOT NULL DEFAULT '{}'::uuid[],
  reconciled_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

CREATE INDEX IF NOT EXISTS idx_reconciliations_account_date
  ON public.reconciliations (account_id, statement_date DESC);

-- 3. Triggers for updated_at
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_rules_updated_at') THEN
    CREATE TRIGGER update_rules_updated_at
    BEFORE UPDATE ON public.rules
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_reconciliations_updated_at') THEN
    CREATE TRIGGER update_reconciliations_updated_at
    BEFORE UPDATE ON public.reconciliations
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
  END IF;
END;
$$;

-- 4. Enable Row Level Security
ALTER TABLE public.rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reconciliations ENABLE ROW LEVEL SECURITY;

-- 5. RLS Policies: Rules
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'rules' AND policyname = 'Rules viewable by workspace members') THEN
    CREATE POLICY "Rules viewable by workspace members" ON public.rules
      FOR SELECT USING (public.is_workspace_member(workspace_id, auth.uid()));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'rules' AND policyname = 'Rules insertable by managers') THEN
    CREATE POLICY "Rules insertable by managers" ON public.rules
      FOR INSERT WITH CHECK (
        public.get_user_workspace_role(workspace_id, auth.uid()) IN ('owner', 'admin', 'manager')
      );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'rules' AND policyname = 'Rules updatable by managers') THEN
    CREATE POLICY "Rules updatable by managers" ON public.rules
      FOR UPDATE USING (
        public.get_user_workspace_role(workspace_id, auth.uid()) IN ('owner', 'admin', 'manager')
      ) WITH CHECK (
        public.get_user_workspace_role(workspace_id, auth.uid()) IN ('owner', 'admin', 'manager')
      );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'rules' AND policyname = 'Rules deletable by managers') THEN
    CREATE POLICY "Rules deletable by managers" ON public.rules
      FOR DELETE USING (
        public.get_user_workspace_role(workspace_id, auth.uid()) IN ('owner', 'admin', 'manager')
      );
  END IF;
END;
$$;

-- 6. RLS Policies: Reconciliations
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'reconciliations' AND policyname = 'Reconciliations viewable by workspace members') THEN
    CREATE POLICY "Reconciliations viewable by workspace members" ON public.reconciliations
      FOR SELECT USING (public.is_workspace_member(workspace_id, auth.uid()));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'reconciliations' AND policyname = 'Reconciliations insertable by managers') THEN
    CREATE POLICY "Reconciliations insertable by managers" ON public.reconciliations
      FOR INSERT WITH CHECK (
        public.get_user_workspace_role(workspace_id, auth.uid()) IN ('owner', 'admin', 'manager')
      );
  END IF;
END;
$$;

-- 7. Stored Procedure for Completing a Statement Reconciliation
CREATE OR REPLACE FUNCTION public.complete_statement_reconciliation(
  p_workspace_id UUID,
  p_account_id UUID,
  p_statement_date DATE,
  p_statement_balance NUMERIC(19,4),
  p_cleared_balance NUMERIC(19,4),
  p_transaction_ids UUID[]
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
DECLARE
  v_rec_id UUID;
  v_user_id UUID;
  v_diff NUMERIC(19,4);
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NOT NULL AND public.get_user_workspace_role(p_workspace_id, v_user_id) NOT IN ('owner', 'admin', 'manager') THEN
    RAISE EXCEPTION 'Access denied: caller must have manager or admin role to complete reconciliations';
  END IF;

  v_diff := p_statement_balance - p_cleared_balance;

  -- 1. Lock reconciled transactions
  IF p_transaction_ids IS NOT NULL AND array_length(p_transaction_ids, 1) > 0 THEN
    UPDATE public.transactions
    SET status = 'reconciled',
        version = version + 1
    WHERE id = ANY(p_transaction_ids)
      AND workspace_id = p_workspace_id;
  END IF;

  -- 2. Insert Reconciliation Record
  INSERT INTO public.reconciliations (
    workspace_id,
    account_id,
    statement_date,
    statement_balance,
    cleared_balance,
    difference,
    status,
    reconciled_transaction_ids,
    reconciled_by
  )
  VALUES (
    p_workspace_id,
    p_account_id,
    p_statement_date,
    p_statement_balance,
    p_cleared_balance,
    v_diff,
    'completed',
    COALESCE(p_transaction_ids, '{}'::uuid[]),
    v_user_id
  )
  RETURNING id INTO v_rec_id;

  -- 3. Upsert into Balance Snapshots for point-in-time authoritative audit
  INSERT INTO public.balance_snapshots (
    account_id,
    as_of_date,
    balance,
    line_count,
    checksum
  )
  VALUES (
    p_account_id,
    p_statement_date,
    p_statement_balance,
    COALESCE(array_length(p_transaction_ids, 1), 0),
    md5(p_account_id::text || p_statement_date::text || p_statement_balance::text)
  )
  ON CONFLICT (account_id, as_of_date) DO UPDATE
    SET balance = EXCLUDED.balance,
        line_count = EXCLUDED.line_count,
        checksum = EXCLUDED.checksum;

  RETURN v_rec_id;
END;
$func$;

COMMIT;
