-- =============================================================================
-- pgTAP Test: 03_workspaces.test.sql
-- Purpose: Verify workspaces & workspace_members tables, constraints, RLS & triggers
-- =============================================================================

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap;

SELECT plan(10);

-- 1. Tables existence
SELECT has_table('public', 'workspaces', 'public.workspaces table should exist');
SELECT has_table('public', 'workspace_members', 'public.workspace_members table should exist');

-- 2. Primary Keys
SELECT col_is_pk('public', 'workspaces', 'id', 'id should be the primary key of workspaces');
SELECT col_is_pk('public', 'workspace_members', 'id', 'id should be the primary key of workspace_members');

-- 3. Foreign Keys
SELECT fk_ok('public', 'workspaces', 'base_currency', 'public', 'currencies', 'code', 'base_currency references currencies(code)');
SELECT fk_ok('public', 'workspace_members', 'workspace_id', 'public', 'workspaces', 'id', 'workspace_id references workspaces(id)');

-- 4. Unique Constraint on Membership
SELECT col_is_unique('public', 'workspace_members', ARRAY['workspace_id', 'user_id'], 'workspace_id + user_id pair should be unique');

-- 5. RLS Helpers
SELECT has_function('public', 'is_workspace_member', ARRAY['uuid', 'uuid'], 'is_workspace_member function exists');
SELECT has_function('public', 'get_user_workspace_role', ARRAY['uuid', 'uuid'], 'get_user_workspace_role function exists');

-- 6. Owner Enrollment Trigger Function
SELECT has_function('public', 'handle_new_workspace_owner', 'handle_new_workspace_owner function exists');

SELECT * FROM finish();

ROLLBACK;
