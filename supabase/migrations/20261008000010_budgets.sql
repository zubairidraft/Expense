-- =============================================================================
-- Migration: 20261008000010_budgets.sql
-- Purpose: Phase 12 - Category Budgets, Envelopes & Rollovers
-- =============================================================================

BEGIN;

-- 1. Budgets Table
CREATE TABLE IF NOT EXISTS public.budgets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES public.categories(id) ON DELETE CASCADE,
  period TEXT NOT NULL DEFAULT 'monthly' CHECK (period IN ('monthly', 'weekly', 'quarterly', 'yearly')),
  amount NUMERIC(19,4) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  rollover_enabled BOOLEAN NOT NULL DEFAULT false,
  rollover_amount NUMERIC(19,4) NOT NULL DEFAULT 0.00,
  alert_threshold INT NOT NULL DEFAULT 85 CHECK (alert_threshold BETWEEN 10 AND 100),
  start_date DATE NOT NULL,
  end_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT uq_budget_workspace_category_period UNIQUE(workspace_id, category_id, period, start_date)
);

CREATE INDEX IF NOT EXISTS idx_budgets_workspace ON public.budgets(workspace_id);
CREATE INDEX IF NOT EXISTS idx_budgets_category ON public.budgets(category_id);

-- 2. Trigger for updated_at
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_budgets_updated_at') THEN
    CREATE TRIGGER update_budgets_updated_at
    BEFORE UPDATE ON public.budgets
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
  END IF;
END;
$$;

-- 3. RLS on budgets
ALTER TABLE public.budgets ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'budgets' AND policyname = 'Budgets viewable by workspace members') THEN
    CREATE POLICY "Budgets viewable by workspace members" ON public.budgets
      FOR SELECT USING (public.is_workspace_member(workspace_id, auth.uid()));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'budgets' AND policyname = 'Budgets insertable by managers') THEN
    CREATE POLICY "Budgets insertable by managers" ON public.budgets
      FOR INSERT WITH CHECK (
        public.get_user_workspace_role(workspace_id, auth.uid()) IN ('owner', 'admin', 'manager')
      );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'budgets' AND policyname = 'Budgets updatable by managers') THEN
    CREATE POLICY "Budgets updatable by managers" ON public.budgets
      FOR UPDATE USING (
        public.get_user_workspace_role(workspace_id, auth.uid()) IN ('owner', 'admin', 'manager')
      ) WITH CHECK (
        public.get_user_workspace_role(workspace_id, auth.uid()) IN ('owner', 'admin', 'manager')
      );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'budgets' AND policyname = 'Budgets deletable by managers') THEN
    CREATE POLICY "Budgets deletable by managers" ON public.budgets
      FOR DELETE USING (
        public.get_user_workspace_role(workspace_id, auth.uid()) IN ('owner', 'admin', 'manager')
      );
  END IF;
END;
$$;

COMMIT;
