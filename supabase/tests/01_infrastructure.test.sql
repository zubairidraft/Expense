-- =============================================================================
-- pgTAP Test: 01_infrastructure.test.sql
-- Purpose: Verify essential extensions, custom types, and utility functions
-- =============================================================================

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap;

SELECT plan(8);

-- Test Extensions
SELECT has_extension('uuid-ossp', 'Extension uuid-ossp should be active');
SELECT has_extension('pgcrypto', 'Extension pgcrypto should be active');
SELECT has_extension('pg_trgm', 'Extension pg_trgm should be active');

-- Test Custom Enums
SELECT has_type('workspace_type', 'Enum workspace_type should exist');
SELECT has_type('workspace_role', 'Enum workspace_role should exist');
SELECT has_type('account_nature', 'Enum account_nature should exist');
SELECT has_type('transaction_type', 'Enum transaction_type should exist');

-- Test Utility Function
SELECT has_function('public', 'set_updated_at', 'Trigger function set_updated_at should exist');

SELECT * FROM finish();

ROLLBACK;
