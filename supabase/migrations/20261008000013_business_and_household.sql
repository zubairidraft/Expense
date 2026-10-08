-- =============================================================================
-- Migration: 20261008000013_business_and_household.sql
-- Purpose: Phase 15 - Business & Household Modules (Projects, Clients, Cost Centers, Tax/VAT & Member Attribution)
-- =============================================================================

BEGIN;

-- 1. Projects Table
CREATE TABLE IF NOT EXISTS public.projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  code TEXT,
  client_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
  budget NUMERIC(19,4),
  currency TEXT NOT NULL REFERENCES public.currencies(code),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'on_hold', 'completed', 'archived')),
  start_date DATE,
  end_date DATE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

CREATE INDEX IF NOT EXISTS idx_projects_workspace ON public.projects(workspace_id);
CREATE INDEX IF NOT EXISTS idx_projects_client ON public.projects(client_id);

-- 2. Cost Centers Table
CREATE TABLE IF NOT EXISTS public.cost_centers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  code TEXT,
  description TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

CREATE INDEX IF NOT EXISTS idx_cost_centers_workspace ON public.cost_centers(workspace_id);

-- 3. Extend Transaction Lines for Projects, Cost Centers, Member Attribution, Tax & Billability
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'transaction_lines' AND column_name = 'project_id') THEN
    ALTER TABLE public.transaction_lines ADD COLUMN project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'transaction_lines' AND column_name = 'cost_center_id') THEN
    ALTER TABLE public.transaction_lines ADD COLUMN cost_center_id UUID REFERENCES public.cost_centers(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'transaction_lines' AND column_name = 'member_id') THEN
    ALTER TABLE public.transaction_lines ADD COLUMN member_id UUID REFERENCES public.workspace_members(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'transaction_lines' AND column_name = 'billable') THEN
    ALTER TABLE public.transaction_lines ADD COLUMN billable BOOLEAN NOT NULL DEFAULT false;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'transaction_lines' AND column_name = 'reimbursable') THEN
    ALTER TABLE public.transaction_lines ADD COLUMN reimbursable BOOLEAN NOT NULL DEFAULT false;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'transaction_lines' AND column_name = 'tax_amount') THEN
    ALTER TABLE public.transaction_lines ADD COLUMN tax_amount NUMERIC(19,4) NOT NULL DEFAULT 0.00;
  END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS idx_tx_lines_project ON public.transaction_lines(project_id);
CREATE INDEX IF NOT EXISTS idx_tx_lines_cost_center ON public.transaction_lines(cost_center_id);
CREATE INDEX IF NOT EXISTS idx_tx_lines_member ON public.transaction_lines(member_id);

-- 4. Triggers for updated_at
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_projects_updated_at') THEN
    CREATE TRIGGER update_projects_updated_at
    BEFORE UPDATE ON public.projects
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_cost_centers_updated_at') THEN
    CREATE TRIGGER update_cost_centers_updated_at
    BEFORE UPDATE ON public.cost_centers
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
  END IF;
END;
$$;

-- 5. RLS Policies
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cost_centers ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'projects' AND policyname = 'Projects viewable by workspace members') THEN
    CREATE POLICY "Projects viewable by workspace members" ON public.projects
      FOR SELECT TO authenticated
      USING (EXISTS (SELECT 1 FROM public.workspace_members wm WHERE wm.workspace_id = projects.workspace_id AND wm.user_id = auth.uid()));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'projects' AND policyname = 'Projects manageable by workspace members') THEN
    CREATE POLICY "Projects manageable by workspace members" ON public.projects
      FOR ALL TO authenticated
      USING (EXISTS (SELECT 1 FROM public.workspace_members wm WHERE wm.workspace_id = projects.workspace_id AND wm.user_id = auth.uid() AND wm.role IN ('owner', 'admin', 'manager', 'member')));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'cost_centers' AND policyname = 'Cost centers viewable by workspace members') THEN
    CREATE POLICY "Cost centers viewable by workspace members" ON public.cost_centers
      FOR SELECT TO authenticated
      USING (EXISTS (SELECT 1 FROM public.workspace_members wm WHERE wm.workspace_id = cost_centers.workspace_id AND wm.user_id = auth.uid()));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'cost_centers' AND policyname = 'Cost centers manageable by workspace members') THEN
    CREATE POLICY "Cost centers manageable by workspace members" ON public.cost_centers
      FOR ALL TO authenticated
      USING (EXISTS (SELECT 1 FROM public.workspace_members wm WHERE wm.workspace_id = cost_centers.workspace_id AND wm.user_id = auth.uid() AND wm.role IN ('owner', 'admin', 'manager', 'member')));
  END IF;
END;
$$;

-- 6. View: Project Financial Summary with security_invoker = true
CREATE OR REPLACE VIEW public.project_financial_summaries
WITH (security_invoker = true)
AS
SELECT
  p.id AS project_id,
  p.workspace_id,
  p.name AS project_name,
  p.code AS project_code,
  p.budget,
  p.currency,
  p.status,
  COALESCE(SUM(CASE WHEN l.direction = 'in' THEN l.base_amount ELSE 0 END), 0.00) AS total_revenue,
  COALESCE(SUM(CASE WHEN l.direction = 'out' THEN l.base_amount ELSE 0 END), 0.00) AS total_expense,
  COALESCE(SUM(CASE WHEN l.billable AND l.direction = 'out' THEN l.base_amount ELSE 0 END), 0.00) AS total_billable_expense,
  COALESCE(SUM(CASE WHEN l.reimbursable AND l.direction = 'out' THEN l.base_amount ELSE 0 END), 0.00) AS total_reimbursable_expense,
  COALESCE(SUM(l.tax_amount), 0.00) AS total_tax_amount,
  (COALESCE(SUM(CASE WHEN l.direction = 'in' THEN l.base_amount ELSE 0 END), 0.00) -
   COALESCE(SUM(CASE WHEN l.direction = 'out' THEN l.base_amount ELSE 0 END), 0.00)) AS net_profit
FROM public.projects p
LEFT JOIN public.transaction_lines l ON l.project_id = p.id
LEFT JOIN public.transactions t ON t.id = l.transaction_id AND t.deleted_at IS NULL
GROUP BY p.id, p.workspace_id, p.name, p.code, p.budget, p.currency, p.status;

COMMIT;
