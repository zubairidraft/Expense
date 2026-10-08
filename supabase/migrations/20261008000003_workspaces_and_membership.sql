-- =============================================================================
-- Migration: 20261008000003_workspaces_and_membership.sql
-- Purpose: Multi-tenant Workspaces, Membership, Roles, and RLS Isolation
-- =============================================================================

BEGIN;

-- 1. Workspaces Table
CREATE TABLE IF NOT EXISTS public.workspaces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  type public.workspace_type NOT NULL DEFAULT 'personal',
  base_currency VARCHAR(3) NOT NULL DEFAULT 'USD' REFERENCES public.currencies(code) ON UPDATE CASCADE,
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  timezone TEXT NOT NULL DEFAULT 'UTC',
  month_start_day SMALLINT NOT NULL DEFAULT 1 CHECK (month_start_day >= 1 AND month_start_day <= 31),
  budgeting_style TEXT NOT NULL DEFAULT 'limit_based' CHECK (budgeting_style IN ('limit_based', 'envelope')),
  archived_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

-- 2. Workspace Members Table
CREATE TABLE IF NOT EXISTS public.workspace_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.workspace_role NOT NULL DEFAULT 'member',
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'invited', 'suspended')),
  joined_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  UNIQUE(workspace_id, user_id)
);

-- 3. Triggers for updated_at
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_workspaces_updated_at') THEN
    CREATE TRIGGER update_workspaces_updated_at
    BEFORE UPDATE ON public.workspaces
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_workspace_members_updated_at') THEN
    CREATE TRIGGER update_workspace_members_updated_at
    BEFORE UPDATE ON public.workspace_members
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
  END IF;
END;
$$;

-- 4. Fast Security Definer Helper Functions for RLS
CREATE OR REPLACE FUNCTION public.is_workspace_member(w_id UUID, u_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.workspace_members 
    WHERE workspace_id = w_id AND user_id = u_id AND status = 'active'
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.get_user_workspace_role(w_id UUID, u_id UUID)
RETURNS public.workspace_role AS $$
  SELECT role FROM public.workspace_members 
  WHERE workspace_id = w_id AND user_id = u_id AND status = 'active'
  LIMIT 1;
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

-- 5. Trigger: Auto-enroll Workspace Creator as Owner
CREATE OR REPLACE FUNCTION public.handle_new_workspace_owner()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.workspace_members (workspace_id, user_id, role, status)
  VALUES (NEW.id, NEW.owner_id, 'owner', 'active')
  ON CONFLICT (workspace_id, user_id) 
  DO UPDATE SET role = 'owner', status = 'active';
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'on_workspace_created_add_owner') THEN
    CREATE TRIGGER on_workspace_created_add_owner
    AFTER INSERT ON public.workspaces
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_workspace_owner();
  END IF;
END;
$$;

-- 6. Enable RLS
ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_members ENABLE ROW LEVEL SECURITY;

-- 7. RLS Policies: Workspaces
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'workspaces' AND policyname = 'Workspaces viewable by members or owner') THEN
    CREATE POLICY "Workspaces viewable by members or owner" ON public.workspaces
      FOR SELECT USING (
        owner_id = auth.uid() OR public.is_workspace_member(id, auth.uid())
      );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'workspaces' AND policyname = 'Workspaces insertable by authenticated users as owner') THEN
    CREATE POLICY "Workspaces insertable by authenticated users as owner" ON public.workspaces
      FOR INSERT WITH CHECK (
        owner_id = auth.uid()
      );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'workspaces' AND policyname = 'Workspaces updatable by owner or admin') THEN
    CREATE POLICY "Workspaces updatable by owner or admin" ON public.workspaces
      FOR UPDATE USING (
        owner_id = auth.uid() OR public.get_user_workspace_role(id, auth.uid()) IN ('owner', 'admin')
      ) WITH CHECK (
        owner_id = auth.uid() OR public.get_user_workspace_role(id, auth.uid()) IN ('owner', 'admin')
      );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'workspaces' AND policyname = 'Workspaces deletable only by owner') THEN
    CREATE POLICY "Workspaces deletable only by owner" ON public.workspaces
      FOR DELETE USING (
        owner_id = auth.uid()
      );
  END IF;
END;
$$;

-- 8. RLS Policies: Workspace Members
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'workspace_members' AND policyname = 'Members viewable by fellow workspace members') THEN
    CREATE POLICY "Members viewable by fellow workspace members" ON public.workspace_members
      FOR SELECT USING (
        user_id = auth.uid() OR public.is_workspace_member(workspace_id, auth.uid())
      );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'workspace_members' AND policyname = 'Members insertable by owner, admin, or self on creation') THEN
    CREATE POLICY "Members insertable by owner, admin, or self on creation" ON public.workspace_members
      FOR INSERT WITH CHECK (
        public.get_user_workspace_role(workspace_id, auth.uid()) IN ('owner', 'admin')
        OR (user_id = auth.uid() AND EXISTS (SELECT 1 FROM public.workspaces w WHERE w.id = workspace_id AND w.owner_id = auth.uid()))
      );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'workspace_members' AND policyname = 'Members updatable by owner or admin') THEN
    CREATE POLICY "Members updatable by owner or admin" ON public.workspace_members
      FOR UPDATE USING (
        public.get_user_workspace_role(workspace_id, auth.uid()) IN ('owner', 'admin')
      ) WITH CHECK (
        public.get_user_workspace_role(workspace_id, auth.uid()) IN ('owner', 'admin')
      );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'workspace_members' AND policyname = 'Members deletable by owner, admin, or self leaving') THEN
    CREATE POLICY "Members deletable by owner, admin, or self leaving" ON public.workspace_members
      FOR DELETE USING (
        user_id = auth.uid()
        OR public.get_user_workspace_role(workspace_id, auth.uid()) IN ('owner', 'admin')
      );
  END IF;
END;
$$;

-- 9. Enhance handle_new_user() to auto-create default workspace for new signups
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

  -- 1. Insert Profile
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
    v_name,
    COALESCE(NEW.raw_user_meta_data->>'avatar_url', ''),
    v_currency,
    COALESCE(NEW.raw_user_meta_data->>'locale', 'en-US'),
    COALESCE(NEW.raw_user_meta_data->>'number_format', 'intl'),
    COALESCE(NEW.raw_user_meta_data->>'date_format', 'YYYY-MM-DD'),
    COALESCE(NEW.raw_user_meta_data->>'theme', 'dark')
  )
  ON CONFLICT (id) DO NOTHING;

  -- 2. Insert Default Workspace (triggers owner membership enrollment automatically)
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

COMMIT;
