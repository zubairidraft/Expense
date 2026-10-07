-- =============================================================================
-- Migration: 20261008000001_initial_infrastructure.sql
-- Purpose: Enable required extensions, base enums, and audit schema
-- =============================================================================

BEGIN;

-- 1. Essential Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE EXTENSION IF NOT EXISTS "btree_gist";

-- Optional in local/cloud depending on permissions, gracefully enable
DO $$
BEGIN
  CREATE EXTENSION IF NOT EXISTS "pg_cron";
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'pg_cron extension could not be enabled in this context: %', SQLERRM;
END;
$$;

-- 2. Base Domain Enums
CREATE TYPE public.workspace_type AS ENUM (
  'personal',
  'household',
  'business',
  'custom'
);

CREATE TYPE public.workspace_role AS ENUM (
  'owner',
  'admin',
  'manager',
  'member',
  'viewer'
);

CREATE TYPE public.account_nature AS ENUM (
  'asset',
  'liability'
);

CREATE TYPE public.account_type AS ENUM (
  'bank',
  'cash',
  'card',
  'savings',
  'wallet',
  'e_wallet',
  'investment',
  'loan',
  'bnpl',
  'custom'
);

CREATE TYPE public.account_visibility AS ENUM (
  'shared',
  'private'
);

CREATE TYPE public.transaction_type AS ENUM (
  'expense',
  'income',
  'transfer',
  'refund',
  'adjustment',
  'debt',
  'settlement',
  'opening'
);

CREATE TYPE public.transaction_status AS ENUM (
  'pending',
  'cleared',
  'reconciled'
);

CREATE TYPE public.transaction_source AS ENUM (
  'manual',
  'recurring',
  'import',
  'sms',
  'ai',
  'ocr'
);

CREATE TYPE public.line_direction AS ENUM (
  'in',
  'out'
);

-- 3. Utility Function: Updated At Trigger
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = clock_timestamp();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

COMMIT;
