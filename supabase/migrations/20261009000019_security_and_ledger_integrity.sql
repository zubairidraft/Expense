-- =============================================================================
-- Migration: 20261009000019_security_and_ledger_integrity.sql
-- Purpose : QA fix-pack
--   1. Onboarding column/function (migration 018 was never applied remotely)
--   2. workspace_members -> profiles FK (members list embed)
--   3. FX helper + server-side base_amount / currency precision
--   4. book_transaction: auth, role, workspace ownership & ledger validation
--   5. Deferred integrity triggers (>=1 line, transfer shape, reconciled lock)
--   6. Role-based RLS for transactions / lines / tags (viewer = read-only)
--   7. SECURITY DEFINER hardening (auth required, membership, search_path)
--   8. Debt / installment payments book real ledger transactions atomically
--   9. Exchange rates: no anonymous / cross-user overwrite
--  10. Receipts storage scoped to workspace folder
--  11. Correct base-currency balances in v_account_balances_current
--  12. Recurring auto-post job (pg_cron, idempotent)
-- =============================================================================

BEGIN;

CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC, anon, authenticated;

-- -----------------------------------------------------------------------------
-- 1. Onboarding
-- -----------------------------------------------------------------------------
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN NOT NULL DEFAULT FALSE;

-- Existing users who already own accounts have effectively completed onboarding
UPDATE public.profiles p
SET onboarding_completed = TRUE
WHERE EXISTS (
  SELECT 1 FROM public.workspaces w
  JOIN public.accounts a ON a.workspace_id = w.id
  WHERE w.owner_id = p.id
);

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_currency TEXT;
  v_name TEXT;
BEGIN
  v_currency := COALESCE(NEW.raw_user_meta_data->>'default_currency', 'USD');
  IF NOT EXISTS (SELECT 1 FROM public.currencies WHERE code = v_currency) THEN
    v_currency := 'USD';
  END IF;

  v_name := COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', 'Personal');
  IF trim(v_name) = '' THEN
    v_name := 'Personal';
  END IF;

  INSERT INTO public.profiles (
    id, full_name, avatar_url, default_currency, locale, number_format, date_format, theme, onboarding_completed
  )
  VALUES (
    NEW.id,
    v_name,
    COALESCE(NEW.raw_user_meta_data->>'avatar_url', ''),
    v_currency,
    COALESCE(NEW.raw_user_meta_data->>'locale', 'en-US'),
    COALESCE(NEW.raw_user_meta_data->>'number_format', 'intl'),
    COALESCE(NEW.raw_user_meta_data->>'date_format', 'YYYY-MM-DD'),
    COALESCE(NEW.raw_user_meta_data->>'theme', 'dark'),
    FALSE
  )
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.workspaces (name, type, base_currency, owner_id, timezone)
  VALUES (
    v_name || '''s Space',
    'personal',
    v_currency,
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'timezone', 'UTC')
  )
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.complete_user_onboarding(p_user_id UUID DEFAULT NULL)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;
  IF p_user_id IS NOT NULL AND p_user_id <> auth.uid() THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  UPDATE public.profiles
  SET onboarding_completed = TRUE,
      updated_at = clock_timestamp()
  WHERE id = auth.uid();

  RETURN FOUND;
END;
$$;

-- -----------------------------------------------------------------------------
-- 2. workspace_members.user_id -> profiles.id (lets PostgREST embed profiles)
-- -----------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'workspace_members_user_profile_fkey'
  ) THEN
    ALTER TABLE public.workspace_members
      ADD CONSTRAINT workspace_members_user_profile_fkey
      FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
  END IF;
END;
$$;

-- -----------------------------------------------------------------------------
-- 3. Helpers: role, FX rate, currency precision, safe uuid
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION private.try_uuid(p_text TEXT)
RETURNS UUID
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  RETURN p_text::UUID;
EXCEPTION WHEN others THEN
  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION private.caller_role(p_workspace_id UUID)
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role::TEXT FROM public.workspace_members
  WHERE workspace_id = p_workspace_id AND user_id = auth.uid() AND status = 'active'
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION private.require_role(p_workspace_id UUID, p_allowed TEXT[])
RETURNS TEXT
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role TEXT;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;
  v_role := private.caller_role(p_workspace_id);
  IF v_role IS NULL THEN
    RAISE EXCEPTION 'Access denied: you are not a member of this workspace' USING ERRCODE = '42501';
  END IF;
  IF NOT (v_role = ANY (p_allowed)) THEN
    RAISE EXCEPTION 'Access denied: your role (%) cannot perform this action', v_role USING ERRCODE = '42501';
  END IF;
  RETURN v_role;
END;
$$;

-- Latest rate on/before p_date; falls back to nearest later rate; inverse; USD pivot.
CREATE OR REPLACE FUNCTION public.get_fx_rate(p_from TEXT, p_to TEXT, p_date DATE DEFAULT CURRENT_DATE)
RETURNS NUMERIC
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
  v_rate NUMERIC;
  v_a NUMERIC;
  v_b NUMERIC;
BEGIN
  IF p_from IS NULL OR p_to IS NULL THEN
    RETURN NULL;
  END IF;
  IF p_from = p_to THEN
    RETURN 1;
  END IF;

  SELECT rate INTO v_rate FROM public.exchange_rates
  WHERE base_currency = p_from AND quote_currency = p_to
  ORDER BY (effective_date > p_date), abs(effective_date - p_date)
  LIMIT 1;
  IF v_rate IS NOT NULL THEN RETURN v_rate; END IF;

  SELECT 1 / rate INTO v_rate FROM public.exchange_rates
  WHERE base_currency = p_to AND quote_currency = p_from
  ORDER BY (effective_date > p_date), abs(effective_date - p_date)
  LIMIT 1;
  IF v_rate IS NOT NULL THEN RETURN round(v_rate, 10); END IF;

  IF p_from <> 'USD' AND p_to <> 'USD' THEN
    v_a := public.get_fx_rate(p_from, 'USD', p_date);
    v_b := public.get_fx_rate('USD', p_to, p_date);
    IF v_a IS NOT NULL AND v_b IS NOT NULL THEN
      RETURN round(v_a * v_b, 10);
    END IF;
  END IF;

  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION private.currency_minor_units(p_code TEXT)
RETURNS INT
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT COALESCE((SELECT minor_units::INT FROM public.currencies WHERE code = p_code), 2);
$$;

-- System category used for transfer fees
INSERT INTO public.categories (workspace_id, name, kind, is_essential, icon, color, system_key)
SELECT NULL, 'Bank Fees & Charges', 'expense', FALSE, '🏦', '#64748b', 'bank_fees'
WHERE NOT EXISTS (SELECT 1 FROM public.categories WHERE system_key = 'bank_fees' AND workspace_id IS NULL);

-- -----------------------------------------------------------------------------
-- 4. Ledger core (private, no auth) + public book_transaction (auth + role)
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

    IF NOT FOUND OR v_acc.workspace_id <> p_workspace_id THEN
      RAISE EXCEPTION 'Account % does not belong to this workspace', v_line->>'accountId';
    END IF;
    IF v_acc.archived_at IS NOT NULL THEN
      RAISE EXCEPTION 'Account "%" is archived', v_acc.name;
    END IF;
    IF v_acc.visibility = 'private'
       AND p_caller_role <> 'owner'
       AND v_acc.owner_member_id IS DISTINCT FROM v_member_id THEN
      RAISE EXCEPTION 'Account "%" is private to another member', v_acc.name;
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

    v_cat := private.try_uuid(NULLIF(v_line->>'categoryId', ''));
    IF COALESCE((v_line->>'isFee')::BOOLEAN, FALSE) AND v_cat IS NULL THEN
      SELECT id INTO v_fee_cat FROM public.categories WHERE system_key = 'bank_fees' AND workspace_id IS NULL LIMIT 1;
      v_cat := v_fee_cat;
    END IF;
    IF v_cat IS NOT NULL THEN
      SELECT workspace_id INTO v_cat_ws FROM public.categories WHERE id = v_cat;
      IF NOT FOUND OR (v_cat_ws IS NOT NULL AND v_cat_ws <> p_workspace_id) THEN
        RAISE EXCEPTION 'Category does not belong to this workspace';
      END IF;
    END IF;

    -- Direction rules by type
    IF p_type = 'expense' AND v_dir <> 'out' THEN
      RAISE EXCEPTION 'Expense lines must be outflows';
    ELSIF p_type IN ('income', 'refund') AND v_dir <> 'in' THEN
      RAISE EXCEPTION '% lines must be inflows', initcap(p_type);
    END IF;

    INSERT INTO public.transaction_lines (
      transaction_id, account_id, category_id, direction, amount, currency, fx_rate, base_amount, description
    )
    VALUES (
      v_tx_id, v_acc.id, v_cat, v_dir, v_amount, v_acc.currency, v_fx, v_base_amount, v_line->>'description'
    );
  END LOOP;

  IF p_tag_ids IS NOT NULL AND array_length(p_tag_ids, 1) > 0 THEN
    FOREACH v_tag IN ARRAY p_tag_ids
    LOOP
      IF NOT EXISTS (SELECT 1 FROM public.tags WHERE id = v_tag AND workspace_id = p_workspace_id) THEN
        RAISE EXCEPTION 'Tag does not belong to this workspace';
      END IF;
      INSERT INTO public.transaction_tags (transaction_id, tag_id)
      VALUES (v_tx_id, v_tag)
      ON CONFLICT DO NOTHING;
    END LOOP;
  END IF;

  RETURN v_tx_id;
END;
$$;

DROP FUNCTION IF EXISTS public.book_transaction(UUID, TEXT, DATE, TEXT, UUID, TEXT, TEXT, TEXT, TEXT, JSONB, UUID[]);
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
  v_role TEXT;
BEGIN
  v_role := private.require_role(p_workspace_id, ARRAY['owner', 'admin', 'manager', 'member']);
  IF p_status = 'reconciled' THEN
    RAISE EXCEPTION 'New transactions cannot be created as reconciled';
  END IF;
  RETURN private.book_transaction_core(
    p_workspace_id, auth.uid(), p_type, p_date, p_status, p_merchant_id, p_payee_name,
    p_notes, p_idempotency_key, p_source, p_lines, p_tag_ids, v_role
  );
END;
$$;

-- -----------------------------------------------------------------------------
-- 5. Integrity triggers (deferred: checked at COMMIT)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION private.check_transaction_integrity(p_tx_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tx RECORD;
  v_lines INT;
  v_in INT;
  v_out INT;
  v_in_acc UUID;
BEGIN
  SELECT * INTO v_tx FROM public.transactions WHERE id = p_tx_id;
  IF NOT FOUND OR v_tx.deleted_at IS NOT NULL THEN
    RETURN;
  END IF;

  SELECT count(*), count(*) FILTER (WHERE direction = 'in'), count(*) FILTER (WHERE direction = 'out')
  INTO v_lines, v_in, v_out
  FROM public.transaction_lines WHERE transaction_id = p_tx_id;

  IF v_lines = 0 THEN
    RAISE EXCEPTION 'Ledger integrity: transaction % has no lines', p_tx_id;
  END IF;

  IF v_tx.type = 'transfer' THEN
    IF v_in <> 1 OR v_out < 1 THEN
      RAISE EXCEPTION 'Ledger integrity: a transfer needs exactly one inflow line and at least one outflow line';
    END IF;
    SELECT account_id INTO v_in_acc FROM public.transaction_lines WHERE transaction_id = p_tx_id AND direction = 'in';
    IF EXISTS (
      SELECT 1 FROM public.transaction_lines
      WHERE transaction_id = p_tx_id AND direction = 'out' AND account_id = v_in_acc
    ) THEN
      RAISE EXCEPTION 'Ledger integrity: transfer source and destination must be different accounts';
    END IF;
  ELSIF v_tx.type = 'expense' AND v_in > 0 THEN
    RAISE EXCEPTION 'Ledger integrity: expense cannot contain inflow lines';
  ELSIF v_tx.type IN ('income', 'refund') AND v_out > 0 THEN
    RAISE EXCEPTION 'Ledger integrity: % cannot contain outflow lines', v_tx.type;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION private.trg_lines_integrity()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM private.check_transaction_integrity(OLD.transaction_id);
  ELSE
    PERFORM private.check_transaction_integrity(NEW.transaction_id);
    IF TG_OP = 'UPDATE' AND OLD.transaction_id <> NEW.transaction_id THEN
      PERFORM private.check_transaction_integrity(OLD.transaction_id);
    END IF;
  END IF;
  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION private.trg_header_integrity()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM private.check_transaction_integrity(NEW.id);
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_transaction_lines_integrity ON public.transaction_lines;
CREATE CONSTRAINT TRIGGER trg_transaction_lines_integrity
  AFTER INSERT OR UPDATE OR DELETE ON public.transaction_lines
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION private.trg_lines_integrity();

DROP TRIGGER IF EXISTS trg_transactions_integrity ON public.transactions;
CREATE CONSTRAINT TRIGGER trg_transactions_integrity
  AFTER INSERT OR UPDATE OF type, deleted_at ON public.transactions
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION private.trg_header_integrity();

-- Reconciled lock on lines + money fields immutable via direct UPDATE
CREATE OR REPLACE FUNCTION private.trg_lines_guard()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tx RECORD;
  v_role TEXT;
BEGIN
  SELECT * INTO v_tx FROM public.transactions
  WHERE id = COALESCE(NEW.transaction_id, OLD.transaction_id);
  IF NOT FOUND THEN
    IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
    RETURN NEW;
  END IF;

  IF auth.uid() IS NOT NULL AND v_tx.status = 'reconciled' THEN
    v_role := private.caller_role(v_tx.workspace_id);
    IF v_role IS NULL OR v_role NOT IN ('owner', 'admin') THEN
      RAISE EXCEPTION 'This transaction is reconciled and locked';
    END IF;
  END IF;

  IF TG_OP = 'UPDATE' AND auth.uid() IS NOT NULL AND (
       NEW.account_id IS DISTINCT FROM OLD.account_id
    OR NEW.amount IS DISTINCT FROM OLD.amount
    OR NEW.currency IS DISTINCT FROM OLD.currency
    OR NEW.fx_rate IS DISTINCT FROM OLD.fx_rate
    OR NEW.base_amount IS DISTINCT FROM OLD.base_amount
    OR NEW.direction IS DISTINCT FROM OLD.direction
  ) THEN
    RAISE EXCEPTION 'Money fields of a ledger line cannot be edited directly; delete and re-book the transaction';
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_transaction_lines_guard ON public.transaction_lines;
CREATE TRIGGER trg_transaction_lines_guard
  BEFORE UPDATE OR DELETE ON public.transaction_lines
  FOR EACH ROW EXECUTE FUNCTION private.trg_lines_guard();

-- -----------------------------------------------------------------------------
-- 6. Role-based RLS (viewer = read-only)
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Transactions insertable by workspace members" ON public.transactions;
CREATE POLICY "Transactions insertable by workspace members" ON public.transactions
  FOR INSERT WITH CHECK (
    public.get_user_workspace_role(workspace_id, auth.uid()) IN ('owner', 'admin', 'manager', 'member')
  );

DROP POLICY IF EXISTS "Transactions updatable by workspace members" ON public.transactions;
CREATE POLICY "Transactions updatable by workspace members" ON public.transactions
  FOR UPDATE USING (
    public.get_user_workspace_role(workspace_id, auth.uid()) IN ('owner', 'admin', 'manager', 'member')
    AND (status <> 'reconciled' OR public.get_user_workspace_role(workspace_id, auth.uid()) IN ('owner', 'admin'))
  ) WITH CHECK (
    public.get_user_workspace_role(workspace_id, auth.uid()) IN ('owner', 'admin', 'manager', 'member')
  );

DROP POLICY IF EXISTS "Transaction lines insertable via workspace membership" ON public.transaction_lines;
CREATE POLICY "Transaction lines insertable via workspace membership" ON public.transaction_lines
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.transactions t
      WHERE t.id = transaction_lines.transaction_id
        AND public.get_user_workspace_role(t.workspace_id, auth.uid()) IN ('owner', 'admin', 'manager', 'member')
    )
  );

DROP POLICY IF EXISTS "Transaction lines updatable via workspace membership" ON public.transaction_lines;
CREATE POLICY "Transaction lines updatable via workspace membership" ON public.transaction_lines
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.transactions t
      WHERE t.id = transaction_lines.transaction_id
        AND public.get_user_workspace_role(t.workspace_id, auth.uid()) IN ('owner', 'admin', 'manager', 'member')
    )
  ) WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.transactions t
      WHERE t.id = transaction_lines.transaction_id
        AND public.get_user_workspace_role(t.workspace_id, auth.uid()) IN ('owner', 'admin', 'manager', 'member')
    )
  );

DROP POLICY IF EXISTS "Transaction tags insertable by members" ON public.transaction_tags;
CREATE POLICY "Transaction tags insertable by members" ON public.transaction_tags
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.transactions t
      WHERE t.id = transaction_tags.transaction_id
        AND public.get_user_workspace_role(t.workspace_id, auth.uid()) IN ('owner', 'admin', 'manager', 'member')
    )
  );

DROP POLICY IF EXISTS "Transaction tags deletable by members" ON public.transaction_tags;
CREATE POLICY "Transaction tags deletable by members" ON public.transaction_tags
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.transactions t
      WHERE t.id = transaction_tags.transaction_id
        AND public.get_user_workspace_role(t.workspace_id, auth.uid()) IN ('owner', 'admin', 'manager', 'member')
    )
  );

-- -----------------------------------------------------------------------------
-- 7. Balance function -> invoker (RLS applies), account currency amounts
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_account_balance(p_account_id UUID)
RETURNS NUMERIC(19,4)
LANGUAGE plpgsql
SECURITY INVOKER
STABLE
SET search_path = public
AS $$
DECLARE
  v_nature TEXT;
  v_opening NUMERIC(19,4);
  v_in NUMERIC(19,4);
  v_out NUMERIC(19,4);
BEGIN
  SELECT nature::TEXT, opening_balance INTO v_nature, v_opening
  FROM public.accounts WHERE id = p_account_id;
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  SELECT
    COALESCE(SUM(l.amount) FILTER (WHERE l.direction = 'in'), 0),
    COALESCE(SUM(l.amount) FILTER (WHERE l.direction = 'out'), 0)
  INTO v_in, v_out
  FROM public.transaction_lines l
  JOIN public.transactions t ON t.id = l.transaction_id
  WHERE l.account_id = p_account_id
    AND t.deleted_at IS NULL
    AND t.status IN ('cleared', 'reconciled');

  IF v_nature = 'asset' THEN
    RETURN v_opening + v_in - v_out;
  END IF;
  RETURN v_opening + v_out - v_in;
END;
$$;

-- -----------------------------------------------------------------------------
-- 8. Debt & installment payments -> atomic ledger bookings
-- -----------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.record_debt_payment(UUID, NUMERIC, TEXT, TEXT, DATE);
CREATE OR REPLACE FUNCTION public.record_debt_payment(
  p_debt_id UUID,
  p_amount NUMERIC,
  p_event_type TEXT DEFAULT 'repayment',
  p_notes TEXT DEFAULT NULL,
  p_payment_date DATE DEFAULT CURRENT_DATE,
  p_account_id UUID DEFAULT NULL,
  p_idempotency_key TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_debt RECORD;
  v_role TEXT;
  v_new_remaining NUMERIC;
  v_new_status TEXT;
  v_event_id UUID;
  v_tx_id UUID;
  v_contact TEXT;
  v_key TEXT;
  v_acc_currency TEXT;
BEGIN
  SELECT * INTO v_debt FROM public.debts WHERE id = p_debt_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Debt record not found';
  END IF;

  v_role := private.require_role(v_debt.workspace_id, ARRAY['owner', 'admin', 'manager', 'member']);

  IF p_event_type NOT IN ('repayment', 'forgive') THEN
    RAISE EXCEPTION 'Invalid payment event type';
  END IF;
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'Payment amount must be greater than zero';
  END IF;
  IF v_debt.status IN ('settled', 'written_off') THEN
    RAISE EXCEPTION 'This debt is already closed';
  END IF;
  IF p_amount > v_debt.remaining_amount THEN
    RAISE EXCEPTION 'Payment (%) is more than the remaining balance (%)', p_amount, v_debt.remaining_amount;
  END IF;

  SELECT name INTO v_contact FROM public.contacts WHERE id = v_debt.contact_id;

  -- Cash movement only for real repayments with an account
  IF p_event_type = 'repayment' AND p_account_id IS NOT NULL THEN
    SELECT currency INTO v_acc_currency FROM public.accounts
    WHERE id = p_account_id AND workspace_id = v_debt.workspace_id;
    IF v_acc_currency IS NULL THEN
      RAISE EXCEPTION 'Account does not belong to this workspace';
    END IF;
    IF v_acc_currency <> v_debt.currency THEN
      RAISE EXCEPTION 'Account currency (%) must match the debt currency (%)', v_acc_currency, v_debt.currency;
    END IF;

    v_key := COALESCE(p_idempotency_key, 'debt-' || p_debt_id || '-' || gen_random_uuid());
    v_tx_id := private.book_transaction_core(
      v_debt.workspace_id, auth.uid(), 'debt', COALESCE(p_payment_date, CURRENT_DATE), 'cleared', NULL,
      CASE WHEN v_debt.direction = 'borrowed'
           THEN 'Loan repayment to ' || COALESCE(v_contact, 'contact')
           ELSE 'Loan recovery from ' || COALESCE(v_contact, 'contact') END,
      p_notes, v_key, 'manual',
      jsonb_build_array(jsonb_build_object(
        'accountId', p_account_id,
        'direction', CASE WHEN v_debt.direction = 'borrowed' THEN 'out' ELSE 'in' END,
        'amount', p_amount::TEXT,
        'description', 'Debt ' || p_event_type
      )),
      '{}'::UUID[], v_role
    );
  END IF;

  v_new_remaining := v_debt.remaining_amount - p_amount;
  v_new_status := CASE
    WHEN v_new_remaining = 0 AND p_event_type = 'forgive' THEN 'written_off'
    WHEN v_new_remaining = 0 THEN 'settled'
    ELSE 'partially_settled' END;

  UPDATE public.debts
  SET remaining_amount = v_new_remaining, status = v_new_status, updated_at = clock_timestamp()
  WHERE id = p_debt_id;

  INSERT INTO public.debt_events (debt_id, workspace_id, transaction_id, event_type, amount, payment_date, notes)
  VALUES (p_debt_id, v_debt.workspace_id, v_tx_id, p_event_type, p_amount, COALESCE(p_payment_date, CURRENT_DATE), p_notes)
  RETURNING id INTO v_event_id;

  RETURN jsonb_build_object(
    'debt_id', p_debt_id,
    'event_id', v_event_id,
    'transaction_id', v_tx_id,
    'previous_remaining', v_debt.remaining_amount,
    'new_remaining', v_new_remaining,
    'status', v_new_status
  );
END;
$$;

DROP FUNCTION IF EXISTS public.pay_installment_schedule(UUID, NUMERIC, UUID);
CREATE OR REPLACE FUNCTION public.pay_installment_schedule(
  p_schedule_id UUID,
  p_amount NUMERIC DEFAULT NULL,
  p_from_account_id UUID DEFAULT NULL,
  p_idempotency_key TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sched RECORD;
  v_plan RECORD;
  v_role TEXT;
  v_amount NUMERIC;
  v_tx_id UUID;
  v_lines JSONB;
  v_type TEXT;
  v_paid_count INT;
  v_all_count INT;
  v_next_due DATE;
  v_src_currency TEXT;
BEGIN
  SELECT * INTO v_sched FROM public.installment_schedules WHERE id = p_schedule_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Installment not found';
  END IF;
  SELECT * INTO v_plan FROM public.installment_plans WHERE id = v_sched.plan_id FOR UPDATE;

  v_role := private.require_role(v_plan.workspace_id, ARRAY['owner', 'admin', 'manager', 'member']);

  IF v_sched.status = 'paid' THEN
    RAISE EXCEPTION 'This installment is already paid';
  END IF;

  v_amount := COALESCE(p_amount, v_sched.amount);
  IF v_amount <= 0 THEN
    RAISE EXCEPTION 'Amount must be greater than zero';
  END IF;

  IF p_from_account_id IS NOT NULL THEN
    SELECT currency INTO v_src_currency FROM public.accounts
    WHERE id = p_from_account_id AND workspace_id = v_plan.workspace_id;
    IF v_src_currency IS NULL THEN
      RAISE EXCEPTION 'Account does not belong to this workspace';
    END IF;

    IF v_plan.liability_account_id IS NOT NULL THEN
      v_type := 'transfer';
      v_lines := jsonb_build_array(
        jsonb_build_object('accountId', p_from_account_id, 'direction', 'out', 'amount', v_amount::TEXT,
                           'description', v_plan.name || ' installment #' || v_sched.installment_number),
        jsonb_build_object('accountId', v_plan.liability_account_id, 'direction', 'in', 'amount', v_amount::TEXT,
                           'description', v_plan.name || ' installment #' || v_sched.installment_number)
      );
    ELSE
      v_type := 'expense';
      v_lines := jsonb_build_array(
        jsonb_build_object('accountId', p_from_account_id, 'direction', 'out', 'amount', v_amount::TEXT,
                           'description', v_plan.name || ' installment #' || v_sched.installment_number)
      );
    END IF;

    v_tx_id := private.book_transaction_core(
      v_plan.workspace_id, auth.uid(), v_type, CURRENT_DATE, 'cleared', NULL,
      v_plan.name || ' installment', NULL,
      COALESCE(p_idempotency_key, 'installment-' || p_schedule_id),
      'manual', v_lines, '{}'::UUID[], v_role
    );
  END IF;

  UPDATE public.installment_schedules
  SET status = 'paid', paid_amount = v_amount, paid_at = clock_timestamp(), transaction_id = v_tx_id
  WHERE id = p_schedule_id;

  SELECT COUNT(*) FILTER (WHERE status = 'paid'), COUNT(*)
  INTO v_paid_count, v_all_count
  FROM public.installment_schedules WHERE plan_id = v_plan.id;

  SELECT MIN(due_date) INTO v_next_due
  FROM public.installment_schedules WHERE plan_id = v_plan.id AND status = 'pending';

  UPDATE public.installment_plans
  SET paid_installments = v_paid_count,
      next_due_date = v_next_due,
      status = CASE WHEN v_paid_count >= v_all_count THEN 'completed' ELSE 'active' END,
      updated_at = clock_timestamp()
  WHERE id = v_plan.id;

  RETURN jsonb_build_object(
    'plan_id', v_plan.id,
    'schedule_id', p_schedule_id,
    'transaction_id', v_tx_id,
    'paid_installments', v_paid_count,
    'total_installments', v_all_count,
    'next_due_date', v_next_due,
    'status', CASE WHEN v_paid_count >= v_all_count THEN 'completed' ELSE 'active' END
  );
END;
$$;

-- -----------------------------------------------------------------------------
-- 9. Reconciliation hardening
-- -----------------------------------------------------------------------------
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
AS $$
DECLARE
  v_rec_id UUID;
  v_ids UUID[];
BEGIN
  PERFORM private.require_role(p_workspace_id, ARRAY['owner', 'admin', 'manager']);

  IF NOT EXISTS (SELECT 1 FROM public.accounts WHERE id = p_account_id AND workspace_id = p_workspace_id) THEN
    RAISE EXCEPTION 'Account does not belong to this workspace';
  END IF;

  -- Only lock live transactions of this workspace that actually touch this account
  SELECT COALESCE(array_agg(DISTINCT t.id), '{}'::UUID[]) INTO v_ids
  FROM public.transactions t
  JOIN public.transaction_lines l ON l.transaction_id = t.id
  WHERE t.id = ANY (COALESCE(p_transaction_ids, '{}'::UUID[]))
    AND t.workspace_id = p_workspace_id
    AND t.deleted_at IS NULL
    AND l.account_id = p_account_id;

  UPDATE public.transactions
  SET status = 'reconciled', version = version + 1
  WHERE id = ANY (v_ids);

  INSERT INTO public.reconciliations (
    workspace_id, account_id, statement_date, statement_balance, cleared_balance,
    difference, status, reconciled_transaction_ids, reconciled_by
  )
  VALUES (
    p_workspace_id, p_account_id, p_statement_date, p_statement_balance, p_cleared_balance,
    p_statement_balance - p_cleared_balance, 'completed', v_ids, auth.uid()
  )
  RETURNING id INTO v_rec_id;

  INSERT INTO public.balance_snapshots (account_id, as_of_date, balance, line_count, checksum)
  VALUES (
    p_account_id, p_statement_date, p_statement_balance, COALESCE(array_length(v_ids, 1), 0),
    md5(p_account_id::TEXT || p_statement_date::TEXT || p_statement_balance::TEXT)
  )
  ON CONFLICT (account_id, as_of_date) DO UPDATE
    SET balance = EXCLUDED.balance, line_count = EXCLUDED.line_count, checksum = EXCLUDED.checksum;

  RETURN v_rec_id;
END;
$$;

-- -----------------------------------------------------------------------------
-- 10. Exchange rates: authenticated only, no overwriting other users' rates
-- -----------------------------------------------------------------------------
ALTER TABLE public.exchange_rates
  ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;

DROP POLICY IF EXISTS "Exchange rates manageable by authenticated" ON public.exchange_rates;
DROP POLICY IF EXISTS "Exchange rates viewable by authenticated" ON public.exchange_rates;
CREATE POLICY "Exchange rates viewable by authenticated" ON public.exchange_rates
  FOR SELECT TO authenticated USING (TRUE);

CREATE OR REPLACE FUNCTION public.upsert_exchange_rate(
  p_base TEXT,
  p_quote TEXT,
  p_rate NUMERIC,
  p_date DATE DEFAULT CURRENT_DATE,
  p_source TEXT DEFAULT 'manual'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_inv NUMERIC;
  v_existing RECORD;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;
  IF p_rate IS NULL OR p_rate <= 0 THEN
    RAISE EXCEPTION 'Exchange rate must be greater than zero';
  END IF;
  IF p_base = p_quote THEN
    RAISE EXCEPTION 'Base and quote currency must differ';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.currencies WHERE code = p_base AND active)
     OR NOT EXISTS (SELECT 1 FROM public.currencies WHERE code = p_quote AND active) THEN
    RAISE EXCEPTION 'Unknown or inactive currency';
  END IF;

  -- Users may only overwrite manual rates they created themselves
  SELECT * INTO v_existing FROM public.exchange_rates
  WHERE base_currency = p_base AND quote_currency = p_quote AND effective_date = COALESCE(p_date, CURRENT_DATE);
  IF FOUND AND (v_existing.source <> 'manual' OR v_existing.created_by IS DISTINCT FROM auth.uid()) THEN
    RAISE EXCEPTION 'A rate for % -> % on % already exists and cannot be overwritten', p_base, p_quote, COALESCE(p_date, CURRENT_DATE);
  END IF;

  v_inv := round(1.0 / p_rate, 10);

  INSERT INTO public.exchange_rates (base_currency, quote_currency, rate, effective_date, source, created_by)
  VALUES (p_base, p_quote, p_rate, COALESCE(p_date, CURRENT_DATE), 'manual', auth.uid())
  ON CONFLICT (base_currency, quote_currency, effective_date)
  DO UPDATE SET rate = EXCLUDED.rate, created_at = clock_timestamp()
  WHERE public.exchange_rates.created_by = auth.uid() AND public.exchange_rates.source = 'manual';

  INSERT INTO public.exchange_rates (base_currency, quote_currency, rate, effective_date, source, created_by)
  VALUES (p_quote, p_base, v_inv, COALESCE(p_date, CURRENT_DATE), 'manual', auth.uid())
  ON CONFLICT (base_currency, quote_currency, effective_date)
  DO UPDATE SET rate = EXCLUDED.rate, created_at = clock_timestamp()
  WHERE public.exchange_rates.created_by = auth.uid() AND public.exchange_rates.source = 'manual';

  RETURN jsonb_build_object('base', p_base, 'quote', p_quote, 'rate', p_rate, 'inverse_rate', v_inv,
                            'date', COALESCE(p_date, CURRENT_DATE), 'source', 'manual');
END;
$$;

ALTER FUNCTION public.mark_notification_read(UUID) SET search_path = public;
ALTER FUNCTION public.mark_all_notifications_read(UUID) SET search_path = public;

-- -----------------------------------------------------------------------------
-- 11. Receipts storage: first folder segment must be a workspace you belong to
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Authenticated users can upload receipts" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can view receipts" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete receipts" ON storage.objects;

CREATE POLICY "Workspace members can upload receipts" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'receipts'
    AND public.get_user_workspace_role(private.try_uuid((storage.foldername(name))[1]), auth.uid())
        IN ('owner', 'admin', 'manager', 'member')
  );

CREATE POLICY "Workspace members can view receipts" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'receipts'
    AND public.is_workspace_member(private.try_uuid((storage.foldername(name))[1]), auth.uid())
  );

CREATE POLICY "Workspace managers can delete receipts" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'receipts'
    AND public.get_user_workspace_role(private.try_uuid((storage.foldername(name))[1]), auth.uid())
        IN ('owner', 'admin', 'manager')
  );

GRANT USAGE ON SCHEMA private TO authenticated;
GRANT EXECUTE ON FUNCTION private.try_uuid(TEXT) TO authenticated;

-- -----------------------------------------------------------------------------
-- 12. Correct base-currency balance (account balance x FX, not mixed sums)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.v_account_balances_current
WITH (security_invoker = true) AS
WITH line_totals AS (
  SELECT tl.account_id,
         COALESCE(SUM(tl.amount) FILTER (WHERE tl.direction = 'in'), 0)::NUMERIC(19,4) AS total_in,
         COALESCE(SUM(tl.amount) FILTER (WHERE tl.direction = 'out'), 0)::NUMERIC(19,4) AS total_out,
         COALESCE(SUM(tl.base_amount) FILTER (WHERE tl.direction = 'in'), 0)::NUMERIC(19,4) AS total_base_in,
         COALESCE(SUM(tl.base_amount) FILTER (WHERE tl.direction = 'out'), 0)::NUMERIC(19,4) AS total_base_out
  FROM public.transaction_lines tl
  JOIN public.transactions t ON t.id = tl.transaction_id
  WHERE t.deleted_at IS NULL AND t.status IN ('cleared', 'reconciled')
  GROUP BY tl.account_id
),
balances AS (
  SELECT a.*,
         CASE WHEN a.nature = 'asset'
              THEN a.opening_balance + COALESCE(lt.total_in, 0) - COALESCE(lt.total_out, 0)
              ELSE a.opening_balance + COALESCE(lt.total_out, 0) - COALESCE(lt.total_in, 0)
         END::NUMERIC(19,4) AS bal,
         w.base_currency
  FROM public.accounts a
  JOIN public.workspaces w ON w.id = a.workspace_id
  LEFT JOIN line_totals lt ON lt.account_id = a.id
  WHERE a.archived_at IS NULL
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
  b.bal AS current_balance,
  round(b.bal * COALESCE(public.get_fx_rate(b.currency, b.base_currency, CURRENT_DATE), 0), 4)::NUMERIC(19,4) AS current_base_balance
FROM balances b;

-- -----------------------------------------------------------------------------
-- 13. Recurring auto-post (idempotent per profile + due date)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION private.advance_due_date(p_date DATE, p_frequency TEXT, p_interval INT, p_anchor DATE)
RETURNS DATE
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_int INT := GREATEST(COALESCE(p_interval, 1), 1);
  v_next DATE;
  v_anchor_day INT := EXTRACT(DAY FROM COALESCE(p_anchor, p_date))::INT;
  v_last INT;
BEGIN
  IF p_frequency = 'daily' THEN
    RETURN p_date + v_int;
  ELSIF p_frequency = 'weekly' THEN
    RETURN p_date + 7 * v_int;
  ELSIF p_frequency = 'biweekly' THEN
    RETURN p_date + 14 * v_int;
  ELSIF p_frequency IN ('monthly', 'quarterly', 'yearly', 'annually') THEN
    v_next := (date_trunc('month', p_date) + make_interval(months =>
                 v_int * CASE p_frequency WHEN 'monthly' THEN 1 WHEN 'quarterly' THEN 3 ELSE 12 END))::DATE;
    v_last := EXTRACT(DAY FROM (date_trunc('month', v_next) + INTERVAL '1 month - 1 day'))::INT;
    RETURN make_date(EXTRACT(YEAR FROM v_next)::INT, EXTRACT(MONTH FROM v_next)::INT, LEAST(v_anchor_day, v_last));
  END IF;
  RETURN (p_date + make_interval(months => v_int))::DATE;
END;
$$;

CREATE OR REPLACE FUNCTION private.process_due_recurring()
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rec RECORD;
  v_due DATE;
  v_today DATE;
  v_posted INT := 0;
  v_guard INT;
BEGIN
  FOR v_rec IN
    SELECT r.*, w.timezone FROM public.recurring_profiles r
    JOIN public.workspaces w ON w.id = r.workspace_id
    WHERE r.active AND r.auto_post AND r.account_id IS NOT NULL
      AND r.type IN ('expense', 'income')
    FOR UPDATE OF r SKIP LOCKED
  LOOP
    v_today := (now() AT TIME ZONE COALESCE(v_rec.timezone, 'UTC'))::DATE;
    v_due := v_rec.next_due_date;
    v_guard := 0;
    WHILE v_due IS NOT NULL AND v_due <= v_today
          AND (v_rec.end_date IS NULL OR v_due <= v_rec.end_date) AND v_guard < 24
    LOOP
      BEGIN
        PERFORM private.book_transaction_core(
          v_rec.workspace_id, NULL, v_rec.type, v_due, 'cleared', NULL, v_rec.title,
          'Auto-posted recurring: ' || v_rec.title,
          'recurring-' || v_rec.id || '-' || v_due, 'recurring',
          jsonb_build_array(jsonb_build_object(
            'accountId', v_rec.account_id,
            'categoryId', v_rec.category_id,
            'direction', CASE WHEN v_rec.type = 'income' THEN 'in' ELSE 'out' END,
            'amount', v_rec.amount::TEXT,
            'description', v_rec.title
          )),
          '{}'::UUID[], 'owner'
        );
        v_posted := v_posted + 1;
      EXCEPTION WHEN others THEN
        RAISE WARNING 'Recurring % could not post for %: %', v_rec.id, v_due, SQLERRM;
        EXIT;
      END;
      v_due := private.advance_due_date(v_due, v_rec.frequency, v_rec.interval, v_rec.start_date);
      v_guard := v_guard + 1;
    END LOOP;

    IF v_due IS DISTINCT FROM v_rec.next_due_date THEN
      UPDATE public.recurring_profiles SET next_due_date = v_due WHERE id = v_rec.id;
    END IF;
  END LOOP;
  RETURN v_posted;
END;
$$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.unschedule(jobid) FROM cron.job WHERE jobname = 'process-due-recurring';
    PERFORM cron.schedule('process-due-recurring', '15 * * * *', 'SELECT private.process_due_recurring();');
  END IF;
END;
$$;

-- -----------------------------------------------------------------------------
-- 14. EXECUTE privileges: nothing callable anonymously
-- -----------------------------------------------------------------------------
REVOKE EXECUTE ON FUNCTION public.book_transaction(UUID, TEXT, DATE, TEXT, UUID, TEXT, TEXT, TEXT, TEXT, JSONB, UUID[]) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.complete_statement_reconciliation(UUID, UUID, DATE, NUMERIC, NUMERIC, UUID[]) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_account_balance(UUID) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_user_workspace_role(UUID, UUID) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_workspace_member(UUID, UUID) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.pay_installment_schedule(UUID, NUMERIC, UUID, TEXT) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.record_debt_payment(UUID, NUMERIC, TEXT, TEXT, DATE, UUID, TEXT) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.upsert_exchange_rate(TEXT, TEXT, NUMERIC, DATE, TEXT) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.complete_user_onboarding(UUID) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.mark_notification_read(UUID) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.mark_all_notifications_read(UUID) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_fx_rate(TEXT, TEXT, DATE) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.book_transaction(UUID, TEXT, DATE, TEXT, UUID, TEXT, TEXT, TEXT, TEXT, JSONB, UUID[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.complete_statement_reconciliation(UUID, UUID, DATE, NUMERIC, NUMERIC, UUID[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_account_balance(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_workspace_role(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_workspace_member(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.pay_installment_schedule(UUID, NUMERIC, UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_debt_payment(UUID, NUMERIC, TEXT, TEXT, DATE, UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.upsert_exchange_rate(TEXT, TEXT, NUMERIC, DATE, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.complete_user_onboarding(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_notification_read(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_all_notifications_read(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_fx_rate(TEXT, TEXT, DATE) TO authenticated;

-- Trigger-only functions must never be callable through the API
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_workspace_owner() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.set_updated_at() FROM PUBLIC, anon, authenticated;

-- Private helpers: owner only (they run via SECURITY DEFINER callers / triggers / cron)
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA private FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.try_uuid(TEXT) TO authenticated;

COMMIT;
