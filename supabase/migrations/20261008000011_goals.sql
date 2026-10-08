-- =============================================================================
-- Migration: 20261008000011_goals.sql
-- Purpose: Phase 13 - Financial Goals, Savings Targets & Allocations
-- =============================================================================

BEGIN;

-- 1. Goals Table
CREATE TABLE IF NOT EXISTS public.goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  target_amount NUMERIC(19,4) NOT NULL,
  current_amount NUMERIC(19,4) NOT NULL DEFAULT 0.00,
  currency TEXT NOT NULL DEFAULT 'USD',
  target_date DATE,
  type TEXT NOT NULL DEFAULT 'savings' CHECK (type IN ('savings', 'emergency_fund', 'debt_payoff', 'purchase', 'investment')),
  linked_account_id UUID REFERENCES public.accounts(id) ON DELETE SET NULL,
  icon TEXT NOT NULL DEFAULT '🎯',
  color TEXT NOT NULL DEFAULT '#6366f1',
  status TEXT NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'completed', 'paused')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

CREATE INDEX IF NOT EXISTS idx_goals_workspace ON public.goals(workspace_id);

-- 2. Goal Allocations Table
CREATE TABLE IF NOT EXISTS public.goal_allocations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  goal_id UUID NOT NULL REFERENCES public.goals(id) ON DELETE CASCADE,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  transaction_id UUID REFERENCES public.transactions(id) ON DELETE SET NULL,
  amount NUMERIC(19,4) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  allocated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  notes TEXT
);

CREATE INDEX IF NOT EXISTS idx_allocations_goal ON public.goal_allocations(goal_id);

-- 3. Trigger for updated_at
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_goals_updated_at') THEN
    CREATE TRIGGER update_goals_updated_at
    BEFORE UPDATE ON public.goals
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
  END IF;
END;
$$;

-- 4. RLS on goals & allocations
ALTER TABLE public.goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.goal_allocations ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'goals' AND policyname = 'Goals viewable by workspace members') THEN
    CREATE POLICY "Goals viewable by workspace members" ON public.goals
      FOR SELECT USING (public.is_workspace_member(workspace_id, auth.uid()));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'goals' AND policyname = 'Goals insertable by managers') THEN
    CREATE POLICY "Goals insertable by managers" ON public.goals
      FOR INSERT WITH CHECK (
        public.get_user_workspace_role(workspace_id, auth.uid()) IN ('owner', 'admin', 'manager')
      );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'goals' AND policyname = 'Goals updatable by managers') THEN
    CREATE POLICY "Goals updatable by managers" ON public.goals
      FOR UPDATE USING (
        public.get_user_workspace_role(workspace_id, auth.uid()) IN ('owner', 'admin', 'manager')
      ) WITH CHECK (
        public.get_user_workspace_role(workspace_id, auth.uid()) IN ('owner', 'admin', 'manager')
      );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'goals' AND policyname = 'Goals deletable by managers') THEN
    CREATE POLICY "Goals deletable by managers" ON public.goals
      FOR DELETE USING (
        public.get_user_workspace_role(workspace_id, auth.uid()) IN ('owner', 'admin', 'manager')
      );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'goal_allocations' AND policyname = 'Allocations viewable by workspace members') THEN
    CREATE POLICY "Allocations viewable by workspace members" ON public.goal_allocations
      FOR SELECT USING (public.is_workspace_member(workspace_id, auth.uid()));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'goal_allocations' AND policyname = 'Allocations insertable by managers') THEN
    CREATE POLICY "Allocations insertable by managers" ON public.goal_allocations
      FOR INSERT WITH CHECK (
        public.get_user_workspace_role(workspace_id, auth.uid()) IN ('owner', 'admin', 'manager')
      );
  END IF;
END;
$$;

COMMIT;
