-- =============================================================================
-- Migration: 20261008000012_shared_debts_and_installments.sql
-- Purpose: Phase 14 - Shared Expenses, Contacts, Udhaar & Debts, Installment Plans (EMI/BNPL)
-- =============================================================================

BEGIN;

-- 1. Contacts Directory
CREATE TABLE IF NOT EXISTS public.contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  avatar_url TEXT,
  linked_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

CREATE INDEX IF NOT EXISTS idx_contacts_workspace ON public.contacts(workspace_id);

-- 2. Shared Expenses Header
CREATE TABLE IF NOT EXISTS public.shared_expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  transaction_id UUID REFERENCES public.transactions(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  total_amount NUMERIC(19,4) NOT NULL CHECK (total_amount > 0),
  currency TEXT NOT NULL REFERENCES public.currencies(code),
  split_method TEXT NOT NULL CHECK (split_method IN ('equal', 'exact', 'percent', 'shares')),
  payer_contact_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

CREATE INDEX IF NOT EXISTS idx_shared_expenses_workspace ON public.shared_expenses(workspace_id);

-- 3. Shared Expense Participant Splits
CREATE TABLE IF NOT EXISTS public.shared_expense_splits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shared_expense_id UUID NOT NULL REFERENCES public.shared_expenses(id) ON DELETE CASCADE,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  contact_id UUID NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  share_amount NUMERIC(19,4) NOT NULL CHECK (share_amount >= 0),
  share_percentage NUMERIC(8,4),
  shares_count NUMERIC(10,2),
  paid_amount NUMERIC(19,4) NOT NULL DEFAULT 0.00 CHECK (paid_amount >= 0),
  settled BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

CREATE INDEX IF NOT EXISTS idx_expense_splits_expense ON public.shared_expense_splits(shared_expense_id);
CREATE INDEX IF NOT EXISTS idx_expense_splits_contact ON public.shared_expense_splits(contact_id);

-- 4. Debts (Personal Lending & Borrowing / Udhaar)
CREATE TABLE IF NOT EXISTS public.debts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  contact_id UUID NOT NULL REFERENCES public.contacts(id) ON DELETE RESTRICT,
  direction TEXT NOT NULL CHECK (direction IN ('lent', 'borrowed')),
  principal NUMERIC(19,4) NOT NULL CHECK (principal > 0),
  remaining_amount NUMERIC(19,4) NOT NULL CHECK (remaining_amount >= 0),
  currency TEXT NOT NULL REFERENCES public.currencies(code),
  due_date DATE,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'partially_settled', 'settled', 'written_off')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

CREATE INDEX IF NOT EXISTS idx_debts_workspace ON public.debts(workspace_id);
CREATE INDEX IF NOT EXISTS idx_debts_contact ON public.debts(contact_id);

-- 5. Debt Events (Disbursements, Repayments, Forgiveness)
CREATE TABLE IF NOT EXISTS public.debt_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  debt_id UUID NOT NULL REFERENCES public.debts(id) ON DELETE CASCADE,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  transaction_id UUID REFERENCES public.transactions(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL CHECK (event_type IN ('disburse', 'repayment', 'forgive')),
  amount NUMERIC(19,4) NOT NULL CHECK (amount > 0),
  payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

CREATE INDEX IF NOT EXISTS idx_debt_events_debt ON public.debt_events(debt_id);

-- 6. Installment Plans (EMI / BNPL)
CREATE TABLE IF NOT EXISTS public.installment_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  liability_account_id UUID REFERENCES public.accounts(id) ON DELETE SET NULL,
  total_amount NUMERIC(19,4) NOT NULL CHECK (total_amount > 0),
  principal_amount NUMERIC(19,4) NOT NULL CHECK (principal_amount > 0),
  interest_or_fee NUMERIC(19,4) NOT NULL DEFAULT 0.00,
  currency TEXT NOT NULL REFERENCES public.currencies(code),
  total_installments INT NOT NULL CHECK (total_installments > 0),
  paid_installments INT NOT NULL DEFAULT 0,
  installment_amount NUMERIC(19,4) NOT NULL CHECK (installment_amount > 0),
  frequency TEXT NOT NULL DEFAULT 'monthly' CHECK (frequency IN ('weekly', 'biweekly', 'monthly', 'quarterly')),
  start_date DATE NOT NULL,
  next_due_date DATE,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'defaulted')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

CREATE INDEX IF NOT EXISTS idx_installment_plans_workspace ON public.installment_plans(workspace_id);

-- 7. Installment Schedules
CREATE TABLE IF NOT EXISTS public.installment_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID NOT NULL REFERENCES public.installment_plans(id) ON DELETE CASCADE,
  installment_number INT NOT NULL,
  due_date DATE NOT NULL,
  amount NUMERIC(19,4) NOT NULL CHECK (amount > 0),
  paid_amount NUMERIC(19,4) NOT NULL DEFAULT 0.00,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'overdue')),
  transaction_id UUID REFERENCES public.transactions(id) ON DELETE SET NULL,
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

CREATE INDEX IF NOT EXISTS idx_installment_schedules_plan ON public.installment_schedules(plan_id);

-- Triggers for updated_at
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_contacts_updated_at') THEN
    CREATE TRIGGER update_contacts_updated_at
    BEFORE UPDATE ON public.contacts
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_shared_expenses_updated_at') THEN
    CREATE TRIGGER update_shared_expenses_updated_at
    BEFORE UPDATE ON public.shared_expenses
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_debts_updated_at') THEN
    CREATE TRIGGER update_debts_updated_at
    BEFORE UPDATE ON public.debts
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_installment_plans_updated_at') THEN
    CREATE TRIGGER update_installment_plans_updated_at
    BEFORE UPDATE ON public.installment_plans
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
  END IF;
END;
$$;

-- RLS
ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shared_expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shared_expense_splits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.debts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.debt_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.installment_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.installment_schedules ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'contacts' AND policyname = 'Contacts viewable by workspace members') THEN
    CREATE POLICY "Contacts viewable by workspace members" ON public.contacts
      FOR SELECT TO authenticated
      USING (EXISTS (SELECT 1 FROM public.workspace_members wm WHERE wm.workspace_id = contacts.workspace_id AND wm.user_id = auth.uid()));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'contacts' AND policyname = 'Contacts manageable by workspace members') THEN
    CREATE POLICY "Contacts manageable by workspace members" ON public.contacts
      FOR ALL TO authenticated
      USING (EXISTS (SELECT 1 FROM public.workspace_members wm WHERE wm.workspace_id = contacts.workspace_id AND wm.user_id = auth.uid() AND wm.role IN ('owner', 'admin', 'manager', 'member')));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'shared_expenses' AND policyname = 'Shared expenses viewable by workspace members') THEN
    CREATE POLICY "Shared expenses viewable by workspace members" ON public.shared_expenses
      FOR SELECT TO authenticated
      USING (EXISTS (SELECT 1 FROM public.workspace_members wm WHERE wm.workspace_id = shared_expenses.workspace_id AND wm.user_id = auth.uid()));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'shared_expenses' AND policyname = 'Shared expenses manageable by workspace members') THEN
    CREATE POLICY "Shared expenses manageable by workspace members" ON public.shared_expenses
      FOR ALL TO authenticated
      USING (EXISTS (SELECT 1 FROM public.workspace_members wm WHERE wm.workspace_id = shared_expenses.workspace_id AND wm.user_id = auth.uid() AND wm.role IN ('owner', 'admin', 'manager', 'member')));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'shared_expense_splits' AND policyname = 'Shared splits viewable by workspace members') THEN
    CREATE POLICY "Shared splits viewable by workspace members" ON public.shared_expense_splits
      FOR SELECT TO authenticated
      USING (EXISTS (SELECT 1 FROM public.workspace_members wm WHERE wm.workspace_id = shared_expense_splits.workspace_id AND wm.user_id = auth.uid()));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'shared_expense_splits' AND policyname = 'Shared splits manageable by workspace members') THEN
    CREATE POLICY "Shared splits manageable by workspace members" ON public.shared_expense_splits
      FOR ALL TO authenticated
      USING (EXISTS (SELECT 1 FROM public.workspace_members wm WHERE wm.workspace_id = shared_expense_splits.workspace_id AND wm.user_id = auth.uid() AND wm.role IN ('owner', 'admin', 'manager', 'member')));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'debts' AND policyname = 'Debts viewable by workspace members') THEN
    CREATE POLICY "Debts viewable by workspace members" ON public.debts
      FOR SELECT TO authenticated
      USING (EXISTS (SELECT 1 FROM public.workspace_members wm WHERE wm.workspace_id = debts.workspace_id AND wm.user_id = auth.uid()));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'debts' AND policyname = 'Debts manageable by workspace members') THEN
    CREATE POLICY "Debts manageable by workspace members" ON public.debts
      FOR ALL TO authenticated
      USING (EXISTS (SELECT 1 FROM public.workspace_members wm WHERE wm.workspace_id = debts.workspace_id AND wm.user_id = auth.uid() AND wm.role IN ('owner', 'admin', 'manager', 'member')));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'debt_events' AND policyname = 'Debt events viewable by workspace members') THEN
    CREATE POLICY "Debt events viewable by workspace members" ON public.debt_events
      FOR SELECT TO authenticated
      USING (EXISTS (SELECT 1 FROM public.workspace_members wm WHERE wm.workspace_id = debt_events.workspace_id AND wm.user_id = auth.uid()));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'debt_events' AND policyname = 'Debt events manageable by workspace members') THEN
    CREATE POLICY "Debt events manageable by workspace members" ON public.debt_events
      FOR ALL TO authenticated
      USING (EXISTS (SELECT 1 FROM public.workspace_members wm WHERE wm.workspace_id = debt_events.workspace_id AND wm.user_id = auth.uid() AND wm.role IN ('owner', 'admin', 'manager', 'member')));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'installment_plans' AND policyname = 'Installment plans viewable by workspace members') THEN
    CREATE POLICY "Installment plans viewable by workspace members" ON public.installment_plans
      FOR SELECT TO authenticated
      USING (EXISTS (SELECT 1 FROM public.workspace_members wm WHERE wm.workspace_id = installment_plans.workspace_id AND wm.user_id = auth.uid()));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'installment_plans' AND policyname = 'Installment plans manageable by workspace members') THEN
    CREATE POLICY "Installment plans manageable by workspace members" ON public.installment_plans
      FOR ALL TO authenticated
      USING (EXISTS (SELECT 1 FROM public.workspace_members wm WHERE wm.workspace_id = installment_plans.workspace_id AND wm.user_id = auth.uid() AND wm.role IN ('owner', 'admin', 'manager', 'member')));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'installment_schedules' AND policyname = 'Installment schedules viewable by plan workspace members') THEN
    CREATE POLICY "Installment schedules viewable by plan workspace members" ON public.installment_schedules
      FOR SELECT TO authenticated
      USING (EXISTS (SELECT 1 FROM public.installment_plans p JOIN public.workspace_members wm ON wm.workspace_id = p.workspace_id WHERE p.id = installment_schedules.plan_id AND wm.user_id = auth.uid()));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'installment_schedules' AND policyname = 'Installment schedules manageable by plan workspace members') THEN
    CREATE POLICY "Installment schedules manageable by plan workspace members" ON public.installment_schedules
      FOR ALL TO authenticated
      USING (EXISTS (SELECT 1 FROM public.installment_plans p JOIN public.workspace_members wm ON wm.workspace_id = p.workspace_id WHERE p.id = installment_schedules.plan_id AND wm.user_id = auth.uid() AND wm.role IN ('owner', 'admin', 'manager', 'member')));
  END IF;
END;
$$;

-- Stored Procedure: Record debt repayment / forgiveness
CREATE OR REPLACE FUNCTION public.record_debt_payment(
  p_debt_id UUID,
  p_amount NUMERIC,
  p_event_type TEXT,
  p_notes TEXT DEFAULT NULL,
  p_payment_date DATE DEFAULT CURRENT_DATE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_debt RECORD;
  v_new_remaining NUMERIC;
  v_new_status TEXT;
  v_event_id UUID;
BEGIN
  SELECT * INTO v_debt FROM public.debts WHERE id = p_debt_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Debt record % not found', p_debt_id;
  END IF;

  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'Payment amount must be greater than zero';
  END IF;

  v_new_remaining := GREATEST(0.00, v_debt.remaining_amount - p_amount);
  
  IF v_new_remaining = 0.00 THEN
    v_new_status := 'settled';
  ELSE
    v_new_status := 'partially_settled';
  END IF;

  UPDATE public.debts
  SET remaining_amount = v_new_remaining,
      status = v_new_status,
      updated_at = clock_timestamp()
  WHERE id = p_debt_id;

  INSERT INTO public.debt_events (debt_id, workspace_id, event_type, amount, payment_date, notes)
  VALUES (p_debt_id, v_debt.workspace_id, p_event_type, p_amount, p_payment_date, p_notes)
  RETURNING id INTO v_event_id;

  RETURN jsonb_build_object(
    'debt_id', p_debt_id,
    'event_id', v_event_id,
    'previous_remaining', v_debt.remaining_amount,
    'new_remaining', v_new_remaining,
    'status', v_new_status
  );
END;
$$;

-- Stored Procedure: Mark installment schedule paid
CREATE OR REPLACE FUNCTION public.pay_installment_schedule(
  p_schedule_id UUID,
  p_amount NUMERIC DEFAULT NULL,
  p_transaction_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_sched RECORD;
  v_plan RECORD;
  v_paid_count INT;
  v_all_count INT;
  v_next_due DATE;
BEGIN
  SELECT * INTO v_sched FROM public.installment_schedules WHERE id = p_schedule_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Installment schedule % not found', p_schedule_id;
  END IF;

  SELECT * INTO v_plan FROM public.installment_plans WHERE id = v_sched.plan_id FOR UPDATE;

  UPDATE public.installment_schedules
  SET status = 'paid',
      paid_amount = COALESCE(p_amount, v_sched.amount),
      paid_at = clock_timestamp(),
      transaction_id = p_transaction_id
  WHERE id = p_schedule_id;

  -- Count paid schedules
  SELECT COUNT(*) FILTER (WHERE status = 'paid'), COUNT(*)
  INTO v_paid_count, v_all_count
  FROM public.installment_schedules
  WHERE plan_id = v_plan.id;

  -- Find next pending due date
  SELECT MIN(due_date) INTO v_next_due
  FROM public.installment_schedules
  WHERE plan_id = v_plan.id AND status = 'pending';

  UPDATE public.installment_plans
  SET paid_installments = v_paid_count,
      next_due_date = v_next_due,
      status = CASE WHEN v_paid_count >= v_all_count THEN 'completed' ELSE 'active' END,
      updated_at = clock_timestamp()
  WHERE id = v_plan.id;

  RETURN jsonb_build_object(
    'plan_id', v_plan.id,
    'schedule_id', p_schedule_id,
    'paid_installments', v_paid_count,
    'total_installments', v_all_count,
    'next_due_date', v_next_due,
    'status', CASE WHEN v_paid_count >= v_all_count THEN 'completed' ELSE 'active' END
  );
END;
$$;

COMMIT;
