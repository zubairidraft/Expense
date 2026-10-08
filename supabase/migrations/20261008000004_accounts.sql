-- =============================================================================
-- Migration: 20261008000004_accounts.sql
-- Purpose: Financial Accounts (Asset vs Liability), Multi-currency, RLS Isolation
-- =============================================================================

BEGIN;

-- 1. Accounts Table
CREATE TABLE IF NOT EXISTS public.accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type public.account_type NOT NULL,
  nature public.account_nature NOT NULL,
  currency VARCHAR(3) NOT NULL REFERENCES public.currencies(code) ON UPDATE CASCADE,
  opening_balance NUMERIC(19,4) NOT NULL DEFAULT 0.0000,
  opening_date DATE NOT NULL DEFAULT CURRENT_DATE,
  credit_limit NUMERIC(19,4),
  visibility public.account_visibility NOT NULL DEFAULT 'shared',
  owner_member_id UUID REFERENCES public.workspace_members(id) ON DELETE SET NULL,
  icon TEXT NOT NULL DEFAULT '🏦',
  color TEXT NOT NULL DEFAULT '#6366f1',
  archived_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

-- 2. Updated At Trigger
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_accounts_updated_at') THEN
    CREATE TRIGGER update_accounts_updated_at
    BEFORE UPDATE ON public.accounts
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
  END IF;
END;
$$;

-- 3. Enable Row Level Security
ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;

-- 4. RLS Policies
DO $$
BEGIN
  -- Read: Shared accounts for any workspace member, or private for owner / account owner
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'accounts' AND policyname = 'Accounts viewable by authorized workspace members') THEN
    CREATE POLICY "Accounts viewable by authorized workspace members" ON public.accounts
      FOR SELECT USING (
        public.is_workspace_member(workspace_id, auth.uid()) AND (
          visibility = 'shared'
          OR public.get_user_workspace_role(workspace_id, auth.uid()) = 'owner'
          OR owner_member_id IN (
            SELECT id FROM public.workspace_members 
            WHERE user_id = auth.uid() AND workspace_id = accounts.workspace_id
          )
        )
      );
  END IF;

  -- Insert: Owner, Admin, Manager of workspace
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'accounts' AND policyname = 'Accounts insertable by managers and above') THEN
    CREATE POLICY "Accounts insertable by managers and above" ON public.accounts
      FOR INSERT WITH CHECK (
        public.get_user_workspace_role(workspace_id, auth.uid()) IN ('owner', 'admin', 'manager')
      );
  END IF;

  -- Update: Owner, Admin, Manager of workspace
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'accounts' AND policyname = 'Accounts updatable by managers and above') THEN
    CREATE POLICY "Accounts updatable by managers and above" ON public.accounts
      FOR UPDATE USING (
        public.get_user_workspace_role(workspace_id, auth.uid()) IN ('owner', 'admin', 'manager')
      ) WITH CHECK (
        public.get_user_workspace_role(workspace_id, auth.uid()) IN ('owner', 'admin', 'manager')
      );
  END IF;

  -- Delete: Owner and Admin only
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'accounts' AND policyname = 'Accounts deletable by admin and owner') THEN
    CREATE POLICY "Accounts deletable by admin and owner" ON public.accounts
      FOR DELETE USING (
        public.get_user_workspace_role(workspace_id, auth.uid()) IN ('owner', 'admin')
      );
  END IF;
END;
$$;

COMMIT;
