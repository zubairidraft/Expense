-- =============================================================================
-- Migration: 20261008000018_user_onboarding.sql
-- Purpose: User Onboarding Flow, Initial Account Setup & Completion Status
-- =============================================================================

BEGIN;

-- 1. Add onboarding_completed flag to profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN NOT NULL DEFAULT FALSE;

-- 2. Update handle_new_user to ensure onboarding_completed starts as FALSE for fresh signups
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  v_currency TEXT;
  v_name TEXT;
BEGIN
  v_currency := COALESCE(NEW.raw_user_meta_data->>'default_currency', 'USD');
  IF NOT EXISTS (SELECT 1 FROM public.currencies WHERE code = v_currency) THEN
    v_currency := 'USD';
  END IF;

  v_name := COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', 'Personal');
  IF trim(v_name) = '' THEN
    v_name := 'Personal';
  END IF;

  -- Insert Profile with onboarding_completed = FALSE
  INSERT INTO public.profiles (
    id,
    full_name,
    avatar_url,
    default_currency,
    locale,
    number_format,
    date_format,
    theme,
    onboarding_completed
  )
  VALUES (
    NEW.id,
    v_name,
    COALESCE(NEW.raw_user_meta_data->>'avatar_url', ''),
    v_currency,
    COALESCE(NEW.raw_user_meta_data->>'locale', 'en-US'),
    COALESCE(NEW.raw_user_meta_data->>'number_format', 'intl'),
    COALESCE(NEW.raw_user_meta_data->>'date_format', 'YYYY-MM-DD'),
    COALESCE(NEW.raw_user_meta_data->>'theme', 'dark'),
    FALSE
  )
  ON CONFLICT (id) DO NOTHING;

  -- Insert Default Workspace
  INSERT INTO public.workspaces (
    name,
    type,
    base_currency,
    owner_id,
    timezone
  )
  VALUES (
    v_name || '''s Space',
    'personal',
    v_currency,
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'timezone', 'UTC')
  )
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 3. Stored procedure to mark onboarding complete
CREATE OR REPLACE FUNCTION public.complete_user_onboarding(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
BEGIN
  UPDATE public.profiles
  SET 
    onboarding_completed = TRUE,
    updated_at = clock_timestamp()
  WHERE id = p_user_id;

  RETURN FOUND;
END;
$$;

COMMIT;
