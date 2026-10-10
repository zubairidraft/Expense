-- =============================================================================
-- pgTAP Test Suite: 08_security_and_ledger_integrity.test.sql
-- Purpose: Verify QA fix-pack (migration 019): anonymous access, ledger
--          validation, integrity triggers, onboarding column, FX helper.
-- =============================================================================

BEGIN;
SELECT plan(16);

-- 1. Anonymous role can no longer execute money-moving SECURITY DEFINER functions
SELECT ok(NOT has_function_privilege('anon', 'public.book_transaction(uuid,text,date,text,uuid,text,text,text,text,jsonb,uuid[])', 'EXECUTE'),
  'anon cannot execute book_transaction');
SELECT ok(NOT has_function_privilege('anon', 'public.record_debt_payment(uuid,numeric,text,text,date,uuid,text)', 'EXECUTE'),
  'anon cannot execute record_debt_payment');
SELECT ok(NOT has_function_privilege('anon', 'public.pay_installment_schedule(uuid,numeric,uuid,text)', 'EXECUTE'),
  'anon cannot execute pay_installment_schedule');
SELECT ok(NOT has_function_privilege('anon', 'public.upsert_exchange_rate(text,text,numeric,date,text)', 'EXECUTE'),
  'anon cannot execute upsert_exchange_rate');
SELECT ok(NOT has_function_privilege('anon', 'public.get_account_balance(uuid)', 'EXECUTE'),
  'anon cannot execute get_account_balance');
SELECT ok(NOT has_function_privilege('authenticated', 'public.handle_new_user()', 'EXECUTE'),
  'trigger function handle_new_user is not callable through the API');

-- 2. Onboarding + members embed
SELECT has_column('public', 'profiles', 'onboarding_completed', 'profiles.onboarding_completed exists');
SELECT has_function('public', 'complete_user_onboarding', ARRAY['uuid'], 'complete_user_onboarding exists');
SELECT ok(EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'workspace_members_user_profile_fkey'),
  'workspace_members.user_id references profiles');

-- 3. Integrity triggers present and deferred
SELECT ok(EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_transaction_lines_integrity' AND tgdeferrable AND tginitdeferred),
  'deferred integrity trigger on transaction_lines');
SELECT ok(EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_transactions_integrity' AND tgdeferrable AND tginitdeferred),
  'deferred integrity trigger on transactions');
SELECT ok(EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_transaction_lines_guard'),
  'reconciled-lock guard on transaction_lines');

-- 4. book_transaction refuses unauthenticated callers (auth.uid() is NULL here)
SELECT throws_ok(
  $$ SELECT public.book_transaction(gen_random_uuid(), 'expense', CURRENT_DATE, 'cleared', NULL, 'x', NULL,
       'test-key', 'manual', '[]'::jsonb, '{}'::uuid[]) $$,
  '42501', NULL, 'book_transaction requires authentication');

-- 5. FX helper
SELECT is(public.get_fx_rate('USD', 'USD', CURRENT_DATE), 1::numeric, 'same-currency FX rate is 1');
SELECT ok(public.get_fx_rate('ZZZ', 'USD', CURRENT_DATE) IS NULL, 'unknown currency pair returns NULL');

-- 6. Month-end recurring clamp
SELECT is(private.advance_due_date('2027-01-31'::date, 'monthly', 1, '2027-01-31'::date), '2027-02-28'::date,
  'monthly on the 31st falls back to the last day of February');

SELECT * FROM finish();
ROLLBACK;
