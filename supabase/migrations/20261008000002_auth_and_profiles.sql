-- =============================================================================
-- Migration: 20261008000002_auth_and_profiles.sql
-- Purpose: User profiles table, currency RLS, auth user trigger & profile policies
-- =============================================================================

BEGIN;

-- 1. Secure Currencies Table with RLS (Read-only for all users)
ALTER TABLE IF EXISTS public.currencies ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'currencies' AND policyname = 'Currencies are viewable by everyone'
  ) THEN
    CREATE POLICY "Currencies are viewable by everyone" ON public.currencies
      FOR SELECT USING (true);
  END IF;
END;
$$;

-- 2. User Profiles Table
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL DEFAULT '',
  avatar_url TEXT DEFAULT '',
  default_currency VARCHAR(3) NOT NULL DEFAULT 'USD' REFERENCES public.currencies(code) ON UPDATE CASCADE,
  locale TEXT NOT NULL DEFAULT 'en-US',
  number_format TEXT NOT NULL DEFAULT 'intl' CHECK (number_format IN ('intl', 'lakh')),
  date_format TEXT NOT NULL DEFAULT 'YYYY-MM-DD',
  theme TEXT NOT NULL DEFAULT 'dark' CHECK (theme IN ('dark', 'light', 'system')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

-- 3. Updated At Trigger on Profiles
DROP TRIGGER IF EXISTS update_profiles_updated_at ON public.profiles;
CREATE TRIGGER update_profiles_updated_at
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 4. Enable Row Level Security (RLS) on Profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
CREATE POLICY "Users can view own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
CREATE POLICY "Users can insert own profile" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- 5. Auto-Provision Profile on Auth User Signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  v_currency TEXT;
BEGIN
  v_currency := COALESCE(NEW.raw_user_meta_data->>'default_currency', 'USD');
  -- Fallback to USD if specified currency does not exist in registry
  IF NOT EXISTS (SELECT 1 FROM public.currencies WHERE code = v_currency) THEN
    v_currency := 'USD';
  END IF;

  INSERT INTO public.profiles (
    id,
    full_name,
    avatar_url,
    default_currency,
    locale,
    number_format,
    date_format,
    theme
  )
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', ''),
    COALESCE(NEW.raw_user_meta_data->>'avatar_url', ''),
    v_currency,
    COALESCE(NEW.raw_user_meta_data->>'locale', 'en-US'),
    COALESCE(NEW.raw_user_meta_data->>'number_format', 'intl'),
    COALESCE(NEW.raw_user_meta_data->>'date_format', 'YYYY-MM-DD'),
    COALESCE(NEW.raw_user_meta_data->>'theme', 'dark')
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

COMMIT;
