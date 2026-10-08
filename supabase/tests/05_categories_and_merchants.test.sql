-- =============================================================================
-- pgTAP Test: 05_categories_and_merchants.test.sql
-- Purpose: Verify categories (seed rows, hierarchy, essential flags), tags, merchants
-- =============================================================================

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap;

SELECT plan(10);

-- 1. Tables existence
SELECT has_table('public', 'categories', 'public.categories table should exist');
SELECT has_table('public', 'tags', 'public.tags table should exist');
SELECT has_table('public', 'merchants', 'public.merchants table should exist');

-- 2. Primary Keys
SELECT col_is_pk('public', 'categories', 'id', 'id should be the primary key of categories');
SELECT col_is_pk('public', 'tags', 'id', 'id should be the primary key of tags');
SELECT col_is_pk('public', 'merchants', 'id', 'id should be the primary key of merchants');

-- 3. Foreign Keys
SELECT fk_ok('public', 'categories', 'parent_id', 'public', 'categories', 'id', 'parent_id references categories(id)');
SELECT fk_ok('public', 'merchants', 'default_category_id', 'public', 'categories', 'id', 'default_category_id references categories(id)');

-- 4. Seed Categories Count
SELECT is(
  (SELECT count(*)::int FROM public.categories WHERE workspace_id IS NULL),
  17,
  'There should be 17 global seed categories'
);

-- 5. RLS Enabled
SELECT is(
  (SELECT relrowsecurity FROM pg_class WHERE relname = 'categories'),
  true,
  'categories has RLS enabled'
);

SELECT * FROM finish();

ROLLBACK;
