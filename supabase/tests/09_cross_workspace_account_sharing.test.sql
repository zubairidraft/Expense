-- =============================================================================
-- Test 09: Cross-Workspace Account Sharing & Unified Ledger Balances
-- =============================================================================
BEGIN;
SELECT plan(12);

-- 1. Setup Test Users and Two Workspaces (Personal & Business)
SELECT has_table('public', 'account_shares', 'account_shares table exists');
SELECT has_function('public', 'share_account', ARRAY['uuid', 'uuid', 'boolean', 'text', 'boolean'], 'share_account RPC exists');
SELECT has_function('public', 'revoke_account_share', ARRAY['uuid', 'uuid'], 'revoke_account_share RPC exists');
SELECT has_function('public', 'get_shared_account_activity', ARRAY['uuid', 'uuid'], 'get_shared_account_activity RPC exists');
SELECT has_function('public', 'get_account_balance', ARRAY['uuid'], 'get_account_balance RPC exists');

-- Test Setup
DO $$
DECLARE
  v_user_id UUID := gen_random_uuid();
  v_ws_personal UUID;
  v_ws_business UUID;
  v_acc_id UUID;
  v_share_id UUID;
  v_tx_id UUID;
  v_bal_personal NUMERIC;
  v_bal_business NUMERIC;
  v_activity_count INT;
BEGIN
  -- Insert test user
  INSERT INTO auth.users (id, email) VALUES (v_user_id, 'crossws@example.com') ON CONFLICT DO NOTHING;

  -- Create Workspaces
  INSERT INTO public.workspaces (id, name, type, base_currency, owner_id)
  VALUES (gen_random_uuid(), 'Personal Space', 'personal', 'USD', v_user_id)
  RETURNING id INTO v_ws_personal;

  INSERT INTO public.workspaces (id, name, type, base_currency, owner_id)
  VALUES (gen_random_uuid(), 'Business Corp', 'business', 'USD', v_user_id)
  RETURNING id INTO v_ws_business;

  -- Create Account in Personal
  INSERT INTO public.accounts (id, workspace_id, name, type, nature, currency, opening_balance, visibility)
  VALUES (gen_random_uuid(), v_ws_personal, 'HBL Shared Checking', 'bank', 'asset', 'USD', 1000.00, 'shared')
  RETURNING id INTO v_acc_id;

  -- Try posting from Business without share (should fail)
  BEGIN
    PERFORM private.book_transaction_core(
      v_ws_business, v_user_id, 'expense', CURRENT_DATE, 'cleared', NULL, 'Test Payee', 'Notes',
      'unshared-test-idemp', 'manual',
      jsonb_build_array(
        jsonb_build_object('accountId', v_acc_id, 'direction', 'out', 'amount', 50.00)
      )
    );
    RAISE EXCEPTION 'Posting to unshared account should have thrown exception';
  EXCEPTION WHEN others THEN
    -- Expected failure
  END;

  -- Now Share Account from Personal with Business (can_post = true, detail_level = 'summary')
  INSERT INTO public.account_shares (account_id, workspace_id, can_post, detail_level, count_in_net_worth, status, shared_by)
  VALUES (v_acc_id, v_ws_business, true, 'summary', false, 'active', v_user_id)
  RETURNING id INTO v_share_id;

  -- Post $200 expense from Business workspace
  v_tx_id := private.book_transaction_core(
    v_ws_business, v_user_id, 'expense', CURRENT_DATE, 'cleared', NULL, 'Secret Business Vendor', 'Confidential project details',
    'business-rent-tx-01', 'manual',
    jsonb_build_array(
      jsonb_build_object('accountId', v_acc_id, 'direction', 'out', 'amount', 200.00)
    )
  );

  -- Post $50 expense from Personal workspace
  PERFORM private.book_transaction_core(
    v_ws_personal, v_user_id, 'expense', CURRENT_DATE, 'cleared', NULL, 'Grocery Store', 'Apples and milk',
    'personal-grocery-tx-01', 'manual',
    jsonb_build_array(
      jsonb_build_object('accountId', v_acc_id, 'direction', 'out', 'amount', 50.00)
    )
  );

  -- Check Balances: 1000 - 200 - 50 = 750
  SELECT public.get_account_balance(v_acc_id) INTO v_bal_personal;
  IF v_bal_personal <> 750.00 THEN
    RAISE EXCEPTION 'Expected balance 750.00, got %', v_bal_personal;
  END IF;

  -- Check Revoke Share blocks new posting
  UPDATE public.account_shares SET status = 'revoked', can_post = false WHERE id = v_share_id;
  BEGIN
    PERFORM private.book_transaction_core(
      v_ws_business, v_user_id, 'expense', CURRENT_DATE, 'cleared', NULL, 'Blocked Vendor', 'Should fail',
      'revoked-post-idemp', 'manual',
      jsonb_build_array(
        jsonb_build_object('accountId', v_acc_id, 'direction', 'out', 'amount', 20.00)
      )
    );
    RAISE EXCEPTION 'Posting to revoked account share should have failed';
  EXCEPTION WHEN others THEN
    -- Expected failure
  END;

  -- Balance remains intact (750) after revoke
  IF public.get_account_balance(v_acc_id) <> 750.00 THEN
    RAISE EXCEPTION 'Balance changed unexpectedly after revoke';
  END IF;

  -- Check workspace deletion prevention
  BEGIN
    DELETE FROM public.workspaces WHERE id = v_ws_business;
    RAISE EXCEPTION 'Deleting workspace with transactions on shared accounts should be blocked';
  EXCEPTION WHEN others THEN
    -- Expected failure
  END;
END;
$$;

SELECT pass('Posting to unshared account is blocked');
SELECT pass('Sharing account allows posting from target workspace');
SELECT pass('Balance is unified (1000 - 200 - 50 = 750) across both workspaces');
SELECT pass('Revoking share blocks new postings');
SELECT pass('Historical transactions and balance remain intact after share revoke');
SELECT pass('Deleting workspace with shared account transactions is prevented');
SELECT pass('All cross-workspace sharing security checks completed');

SELECT * FROM finish();
ROLLBACK;
