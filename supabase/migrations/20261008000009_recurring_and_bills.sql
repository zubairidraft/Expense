-- =============================================================================
-- Migration: 20261008000009_recurring_and_bills.sql
-- Purpose: Phase 11 - Recurring Profiles, Subscriptions & Bills Calendar
-- =============================================================================

BEGIN;

-- 1. Recurring Profiles Table
CREATE TABLE IF NOT EXISTS public.recurring_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('expense', 'income', 'transfer')),
  frequency TEXT NOT NULL CHECK (frequency IN ('daily', 'weekly', 'biweekly', 'monthly', 'quarterly', 'yearly')),
  interval INT NOT NULL DEFAULT 1,
  start_date DATE NOT NULL,
  end_date DATE,
  next_due_date DATE NOT NULL,
  amount NUMERIC(19,4) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  account_id UUID REFERENCES public.accounts(id) ON DELETE SET NULL,
  category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
  auto_post BOOLEAN NOT NULL DEFAULT false,
  active BOOLEAN NOT NULL DEFAULT true,
  reminder_days_before INT NOT NULL DEFAULT 3,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

CREATE INDEX IF NOT EXISTS idx_recurring_workspace ON public.recurring_profiles(workspace_id);
CREATE INDEX IF NOT EXISTS idx_recurring_due_date ON public.recurring_profiles(workspace_id, next_due_date ASC)
  WHERE active = true;

-- 2. Trigger for updated_at
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_recurring_profiles_updated_at') THEN
    CREATE TRIGGER update_recurring_profiles_updated_at
    BEFORE UPDATE ON public.recurring_profiles
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
  END IF;
END;
$$;

-- 3. RLS on recurring_profiles
ALTER TABLE public.recurring_profiles ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'recurring_profiles' AND policyname = 'Recurring viewable by workspace members') THEN
    CREATE POLICY "Recurring viewable by workspace members" ON public.recurring_profiles
      FOR SELECT USING (public.is_workspace_member(workspace_id, auth.uid()));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'recurring_profiles' AND policyname = 'Recurring insertable by managers') THEN
    CREATE POLICY "Recurring insertable by managers" ON public.recurring_profiles
      FOR INSERT WITH CHECK (
        public.get_user_workspace_role(workspace_id, auth.uid()) IN ('owner', 'admin', 'manager')
      );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'recurring_profiles' AND policyname = 'Recurring updatable by managers') THEN
    CREATE POLICY "Recurring updatable by managers" ON public.recurring_profiles
      FOR UPDATE USING (
        public.get_user_workspace_role(workspace_id, auth.uid()) IN ('owner', 'admin', 'manager')
      ) WITH CHECK (
        public.get_user_workspace_role(workspace_id, auth.uid()) IN ('owner', 'admin', 'manager')
      );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'recurring_profiles' AND policyname = 'Recurring deletable by managers') THEN
    CREATE POLICY "Recurring deletable by managers" ON public.recurring_profiles
      FOR DELETE USING (
        public.get_user_workspace_role(workspace_id, auth.uid()) IN ('owner', 'admin', 'manager')
      );
  END IF;
END;
$$;

COMMIT;
