-- =============================================================================
-- Migration: 20261008000006_transaction_ledger.sql
-- Purpose: Authoritative Double-entry Ledger (Transactions, Lines, Tags, Snapshots)
-- =============================================================================

BEGIN;

-- 1. Transactions Header Table
CREATE TABLE IF NOT EXISTS public.transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('expense', 'income', 'transfer', 'refund', 'adjustment', 'debt', 'settlement', 'opening')),
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  status TEXT NOT NULL DEFAULT 'cleared' CHECK (status IN ('pending', 'cleared', 'reconciled')),
  merchant_id UUID REFERENCES public.merchants(id) ON DELETE SET NULL,
  payee_name TEXT,
  notes TEXT,
  idempotency_key TEXT NOT NULL,
  version INT NOT NULL DEFAULT 1,
  source TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'recurring', 'import', 'sms', 'ai', 'ocr')),
  deleted_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT uq_transactions_workspace_idempotency UNIQUE(workspace_id, idempotency_key)
);

-- Index for chronological ledger filtering
CREATE INDEX IF NOT EXISTS idx_transactions_workspace_date
  ON public.transactions (workspace_id, date DESC, created_at DESC)
  WHERE deleted_at IS NULL;

-- 2. Transaction Lines Table
CREATE TABLE IF NOT EXISTS public.transaction_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id UUID NOT NULL REFERENCES public.transactions(id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE RESTRICT,
  category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
  direction TEXT NOT NULL CHECK (direction IN ('in', 'out')),
  amount NUMERIC(19,4) NOT NULL CHECK (amount > 0),
  currency TEXT NOT NULL REFERENCES public.currencies(code),
  fx_rate NUMERIC(20,10) NOT NULL DEFAULT 1.0,
  base_amount NUMERIC(19,4) NOT NULL CHECK (base_amount > 0),
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

CREATE INDEX IF NOT EXISTS idx_transaction_lines_account
  ON public.transaction_lines (account_id, created_at);

CREATE INDEX IF NOT EXISTS idx_transaction_lines_tx_id
  ON public.transaction_lines (transaction_id);

-- 3. Transaction Tags Association Table
CREATE TABLE IF NOT EXISTS public.transaction_tags (
  transaction_id UUID NOT NULL REFERENCES public.transactions(id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES public.tags(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY (transaction_id, tag_id)
);

-- 4. Balance Snapshots Table
CREATE TABLE IF NOT EXISTS public.balance_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  as_of_date DATE NOT NULL,
  balance NUMERIC(19,4) NOT NULL,
  line_count INT NOT NULL DEFAULT 0,
  checksum TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT uq_balance_snapshots_account_date UNIQUE(account_id, as_of_date)
);

-- 5. Updated_at Triggers
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_transactions_updated_at') THEN
    CREATE TRIGGER update_transactions_updated_at
    BEFORE UPDATE ON public.transactions
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_transaction_lines_updated_at') THEN
    CREATE TRIGGER update_transaction_lines_updated_at
    BEFORE UPDATE ON public.transaction_lines
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
  END IF;
END;
$$;

-- 6. Enable Row Level Security
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transaction_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transaction_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.balance_snapshots ENABLE ROW LEVEL SECURITY;

-- 7. RLS Policies: Transactions
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'transactions' AND policyname = 'Transactions viewable by workspace members') THEN
    CREATE POLICY "Transactions viewable by workspace members" ON public.transactions
      FOR SELECT USING (public.is_workspace_member(workspace_id, auth.uid()));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'transactions' AND policyname = 'Transactions insertable by workspace members') THEN
    CREATE POLICY "Transactions insertable by workspace members" ON public.transactions
      FOR INSERT WITH CHECK (public.is_workspace_member(workspace_id, auth.uid()));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'transactions' AND policyname = 'Transactions updatable by workspace members') THEN
    CREATE POLICY "Transactions updatable by workspace members" ON public.transactions
      FOR UPDATE USING (
        public.is_workspace_member(workspace_id, auth.uid()) AND (status != 'reconciled' OR public.get_user_workspace_role(workspace_id, auth.uid()) IN ('owner', 'admin'))
      ) WITH CHECK (
        public.is_workspace_member(workspace_id, auth.uid())
      );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'transactions' AND policyname = 'Transactions deletable by managers') THEN
    CREATE POLICY "Transactions deletable by managers" ON public.transactions
      FOR DELETE USING (
        public.get_user_workspace_role(workspace_id, auth.uid()) IN ('owner', 'admin', 'manager')
      );
  END IF;
END;
$$;

-- 8. RLS Policies: Transaction Lines
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'transaction_lines' AND policyname = 'Transaction lines viewable via workspace membership') THEN
    CREATE POLICY "Transaction lines viewable via workspace membership" ON public.transaction_lines
      FOR SELECT USING (
        EXISTS (
          SELECT 1 FROM public.transactions t
          WHERE t.id = transaction_lines.transaction_id
            AND public.is_workspace_member(t.workspace_id, auth.uid())
        )
      );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'transaction_lines' AND policyname = 'Transaction lines insertable via workspace membership') THEN
    CREATE POLICY "Transaction lines insertable via workspace membership" ON public.transaction_lines
      FOR INSERT WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.transactions t
          WHERE t.id = transaction_lines.transaction_id
            AND public.is_workspace_member(t.workspace_id, auth.uid())
        )
      );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'transaction_lines' AND policyname = 'Transaction lines updatable via workspace membership') THEN
    CREATE POLICY "Transaction lines updatable via workspace membership" ON public.transaction_lines
      FOR UPDATE USING (
        EXISTS (
          SELECT 1 FROM public.transactions t
          WHERE t.id = transaction_lines.transaction_id
            AND public.is_workspace_member(t.workspace_id, auth.uid())
        )
      ) WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.transactions t
          WHERE t.id = transaction_lines.transaction_id
            AND public.is_workspace_member(t.workspace_id, auth.uid())
        )
      );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'transaction_lines' AND policyname = 'Transaction lines deletable via workspace membership') THEN
    CREATE POLICY "Transaction lines deletable via workspace membership" ON public.transaction_lines
      FOR DELETE USING (
        EXISTS (
          SELECT 1 FROM public.transactions t
          WHERE t.id = transaction_lines.transaction_id
            AND public.get_user_workspace_role(t.workspace_id, auth.uid()) IN ('owner', 'admin', 'manager')
        )
      );
  END IF;
END;
$$;

-- 9. RLS Policies: Transaction Tags
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'transaction_tags' AND policyname = 'Transaction tags viewable by members') THEN
    CREATE POLICY "Transaction tags viewable by members" ON public.transaction_tags
      FOR SELECT USING (
        EXISTS (
          SELECT 1 FROM public.transactions t
          WHERE t.id = transaction_tags.transaction_id
            AND public.is_workspace_member(t.workspace_id, auth.uid())
        )
      );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'transaction_tags' AND policyname = 'Transaction tags insertable by members') THEN
    CREATE POLICY "Transaction tags insertable by members" ON public.transaction_tags
      FOR INSERT WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.transactions t
          WHERE t.id = transaction_tags.transaction_id
            AND public.is_workspace_member(t.workspace_id, auth.uid())
        )
      );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'transaction_tags' AND policyname = 'Transaction tags deletable by members') THEN
    CREATE POLICY "Transaction tags deletable by members" ON public.transaction_tags
      FOR DELETE USING (
        EXISTS (
          SELECT 1 FROM public.transactions t
          WHERE t.id = transaction_tags.transaction_id
            AND public.is_workspace_member(t.workspace_id, auth.uid())
        )
      );
  END IF;
END;
$$;

-- 10. RLS Policies: Balance Snapshots
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'balance_snapshots' AND policyname = 'Snapshots viewable by workspace members') THEN
    CREATE POLICY "Snapshots viewable by workspace members" ON public.balance_snapshots
      FOR SELECT USING (
        EXISTS (
          SELECT 1 FROM public.accounts a
          WHERE a.id = balance_snapshots.account_id
            AND public.is_workspace_member(a.workspace_id, auth.uid())
        )
      );
  END IF;
END;
$$;

-- 11. Stored Procedure for Atomic Transaction Booking
CREATE OR REPLACE FUNCTION public.book_transaction(
  p_workspace_id UUID,
  p_type TEXT,
  p_date DATE,
  p_status TEXT,
  p_merchant_id UUID,
  p_payee_name TEXT,
  p_notes TEXT,
  p_idempotency_key TEXT,
  p_source TEXT,
  p_lines JSONB,
  p_tag_ids UUID[] DEFAULT '{}'::UUID[]
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_transaction_id UUID;
  v_user_id UUID;
  v_line JSONB;
  v_tag_id UUID;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NOT NULL AND NOT public.is_workspace_member(p_workspace_id, v_user_id) THEN
    RAISE EXCEPTION 'Access denied: caller is not a member of workspace %', p_workspace_id;
  END IF;

  -- 1. Insert Transaction Header (or return existing if idempotency key matches)
  INSERT INTO public.transactions (
    workspace_id,
    type,
    date,
    status,
    merchant_id,
    payee_name,
    notes,
    idempotency_key,
    source,
    created_by
  )
  VALUES (
    p_workspace_id,
    p_type,
    COALESCE(p_date, CURRENT_DATE),
    COALESCE(p_status, 'cleared'),
    p_merchant_id,
    p_payee_name,
    p_notes,
    p_idempotency_key,
    COALESCE(p_source, 'manual'),
    v_user_id
  )
  ON CONFLICT (workspace_id, idempotency_key) DO UPDATE
    SET version = public.transactions.version -- harmless update to return existing ID
  RETURNING id INTO v_transaction_id;

  -- If this was a deduplicated hit where lines were already recorded, return transaction ID
  IF EXISTS (SELECT 1 FROM public.transaction_lines WHERE transaction_id = v_transaction_id) THEN
    RETURN v_transaction_id;
  END IF;

  -- 2. Insert Lines
  FOR v_line IN SELECT * FROM jsonb_array_elements(p_lines)
  LOOP
    INSERT INTO public.transaction_lines (
      transaction_id,
      account_id,
      category_id,
      direction,
      amount,
      currency,
      fx_rate,
      base_amount,
      description
    )
    VALUES (
      v_transaction_id,
      (v_line->>'accountId')::UUID,
      NULLIF(v_line->>'categoryId', '')::UUID,
      v_line->>'direction',
      (v_line->>'amount')::NUMERIC(19,4),
      v_line->>'currency',
      COALESCE((v_line->>'fxRate')::NUMERIC(20,10), 1.0),
      COALESCE((v_line->>'baseAmount')::NUMERIC(19,4), (v_line->>'amount')::NUMERIC(19,4)),
      v_line->>'description'
    );
  END LOOP;

  -- 3. Link Tags
  IF p_tag_ids IS NOT NULL AND array_length(p_tag_ids, 1) > 0 THEN
    FOREACH v_tag_id IN ARRAY p_tag_ids
    LOOP
      INSERT INTO public.transaction_tags (transaction_id, tag_id)
      VALUES (v_transaction_id, v_tag_id)
      ON CONFLICT DO NOTHING;
    END LOOP;
  END IF;

  RETURN v_transaction_id;
END;
$$;

-- 12. Helper Function for Real-time Calculated Account Balance
CREATE OR REPLACE FUNCTION public.get_account_balance(p_account_id UUID)
RETURNS NUMERIC(19,4)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_nature TEXT;
  v_opening NUMERIC(19,4);
  v_in_sum NUMERIC(19,4);
  v_out_sum NUMERIC(19,4);
  v_balance NUMERIC(19,4);
BEGIN
  SELECT nature, opening_balance
  INTO v_nature, v_opening
  FROM public.accounts
  WHERE id = p_account_id;

  IF NOT FOUND THEN
    RETURN 0.00;
  END IF;

  SELECT
    COALESCE(SUM(CASE WHEN l.direction = 'in' THEN l.amount ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN l.direction = 'out' THEN l.amount ELSE 0 END), 0)
  INTO v_in_sum, v_out_sum
  FROM public.transaction_lines l
  JOIN public.transactions t ON t.id = l.transaction_id
  WHERE l.account_id = p_account_id
    AND t.deleted_at IS NULL;

  IF v_nature = 'asset' THEN
    v_balance := v_opening + v_in_sum - v_out_sum;
  ELSE
    -- Liability (Credit card / loan balance owed)
    v_balance := v_opening + v_out_sum - v_in_sum;
  END IF;

  RETURN v_balance;
END;
$$;

COMMIT;
