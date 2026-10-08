-- =============================================================================
-- pgTAP Test: 02_profiles.test.sql
-- Purpose: Verify profiles table, columns, triggers, and RLS policies
-- =============================================================================

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap;

SELECT plan(7);

-- 1. Table existence
SELECT has_table('public', 'profiles', 'public.profiles table should exist');

-- 2. Columns existence
SELECT columns_are('public', 'profiles', ARRAY[
  'id',
  'full_name',
  'avatar_url',
  'default_currency',
  'locale',
  'number_format',
  'date_format',
  'theme',
  'created_at',
  'updated_at'
], 'public.profiles should have all expected columns');

-- 3. Primary Key
SELECT col_is_pk('public', 'profiles', 'id', 'id should be the primary key of profiles');

-- 4. Foreign Key to currencies
SELECT fk_ok('public', 'profiles', 'default_currency', 'public', 'currencies', 'code', 'default_currency references currencies(code)');

-- 5. Trigger Function existence
SELECT has_function('public', 'handle_new_user', 'Function handle_new_user should exist');

-- 6. Trigger on auth.users
SELECT has_trigger('auth', 'users', 'on_auth_user_created', 'auth.users should have trigger on_auth_user_created');

-- 7. RLS Enabled
SELECT table_privs_are('public', 'profiles', 'anon', ARRAY[]::text[], 'anon should not have direct unrestricted access');

SELECT * FROM finish();

ROLLBACK;
