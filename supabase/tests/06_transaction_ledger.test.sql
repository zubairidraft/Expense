-- =============================================================================
-- pgTAP Test Suite: 06_transaction_ledger.test.sql
-- Purpose: Verify transaction ledger tables, double-entry lines, and balance calc
-- =============================================================================

BEGIN;
SELECT plan(10);

-- 1. Check Table Existence
SELECT has_table('public', 'transactions', 'Table public.transactions should exist');
SELECT has_table('public', 'transaction_lines', 'Table public.transaction_lines should exist');
SELECT has_table('public', 'transaction_tags', 'Table public.transaction_tags should exist');
SELECT has_table('public', 'balance_snapshots', 'Table public.balance_snapshots should exist');

-- 2. Verify RLS is enabled
SELECT tests.rls_is_enabled('public', 'transactions', 'RLS should be enabled on transactions');
SELECT tests.rls_is_enabled('public', 'transaction_lines', 'RLS should be enabled on transaction_lines');

-- 3. Check Columns and Constraints
SELECT has_column('public', 'transactions', 'idempotency_key', 'transactions should have idempotency_key');
SELECT has_column('public', 'transaction_lines', 'direction', 'transaction_lines should have direction');
SELECT has_column('public', 'transaction_lines', 'amount', 'transaction_lines should have amount');

-- 4. Verify Functions
SELECT has_function('public', 'book_transaction', 'Function book_transaction should exist');

SELECT * FROM finish();
ROLLBACK;
