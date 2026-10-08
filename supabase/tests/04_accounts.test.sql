-- =============================================================================
-- pgTAP Test: 04_accounts.test.sql
-- Purpose: Verify accounts table, nature (asset/liability), currencies FK, RLS
-- =============================================================================

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap;

SELECT plan(8);

-- 1. Table existence
SELECT has_table('public', 'accounts', 'public.accounts table should exist');

-- 2. Primary Key
SELECT col_is_pk('public', 'accounts', 'id', 'id should be the primary key of accounts');

-- 3. Foreign Keys
SELECT fk_ok('public', 'accounts', 'workspace_id', 'public', 'workspaces', 'id', 'workspace_id references workspaces(id)');
SELECT fk_ok('public', 'accounts', 'currency', 'public', 'currencies', 'code', 'currency references currencies(code)');

-- 4. Custom Enum Columns
SELECT col_type_is('public', 'accounts', 'type', 'public.account_type', 'type column has account_type enum');
SELECT col_type_is('public', 'accounts', 'nature', 'public.account_nature', 'nature column has account_nature enum');
SELECT col_type_is('public', 'accounts', 'visibility', 'public.account_visibility', 'visibility column has account_visibility enum');

-- 5. Trigger
SELECT has_trigger('public', 'accounts', 'update_accounts_updated_at', 'accounts has updated_at trigger');

SELECT * FROM finish();

ROLLBACK;
