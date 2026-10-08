-- =============================================================================
-- pgTAP Test Suite: 07_rules_and_reconciliation.test.sql
-- Purpose: Verify rules engine and reconciliation tables & procedures
-- =============================================================================

BEGIN;
SELECT plan(8);

-- 1. Check Table Existence
SELECT has_table('public', 'rules', 'Table public.rules should exist');
SELECT has_table('public', 'reconciliations', 'Table public.reconciliations should exist');

-- 2. Verify RLS is enabled
SELECT tests.rls_is_enabled('public', 'rules', 'RLS should be enabled on rules');
SELECT tests.rls_is_enabled('public', 'reconciliations', 'RLS should be enabled on reconciliations');

-- 3. Check Columns and Constraints
SELECT has_column('public', 'rules', 'conditions', 'rules should have conditions');
SELECT has_column('public', 'rules', 'actions', 'rules should have actions');
SELECT has_column('public', 'reconciliations', 'difference', 'reconciliations should have difference');

-- 4. Verify Functions
SELECT has_function('public', 'complete_statement_reconciliation', 'Function complete_statement_reconciliation should exist');

SELECT * FROM finish();
ROLLBACK;
