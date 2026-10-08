-- =============================================================================
-- Migration: 20261008000005_categories_tags_merchants.sql
-- Purpose: Categories (Hierarchical, Needs vs Wants), Tags, and Merchants
-- =============================================================================

BEGIN;

-- 1. Categories Table
CREATE TABLE IF NOT EXISTS public.categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE,
  parent_id UUID REFERENCES public.categories(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('income', 'expense')),
  is_essential BOOLEAN NOT NULL DEFAULT false,
  icon TEXT NOT NULL DEFAULT '📦',
  color TEXT NOT NULL DEFAULT '#6366f1',
  system_key TEXT,
  archived_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

-- 2. Tags Table
CREATE TABLE IF NOT EXISTS public.tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#8b5cf6',
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  UNIQUE(workspace_id, name)
);

-- 3. Merchants Table
CREATE TABLE IF NOT EXISTS public.merchants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  aliases TEXT[] NOT NULL DEFAULT '{}',
  default_category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
  logo_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  UNIQUE(workspace_id, name)
);

-- 4. Triggers for updated_at
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_categories_updated_at') THEN
    CREATE TRIGGER update_categories_updated_at
    BEFORE UPDATE ON public.categories
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_merchants_updated_at') THEN
    CREATE TRIGGER update_merchants_updated_at
    BEFORE UPDATE ON public.merchants
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
  END IF;
END;
$$;

-- 5. Enable Row Level Security
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.merchants ENABLE ROW LEVEL SECURITY;

-- 6. RLS Policies: Categories
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'categories' AND policyname = 'Categories viewable by all or workspace members') THEN
    CREATE POLICY "Categories viewable by all or workspace members" ON public.categories
      FOR SELECT USING (
        workspace_id IS NULL OR public.is_workspace_member(workspace_id, auth.uid())
      );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'categories' AND policyname = 'Categories insertable by managers') THEN
    CREATE POLICY "Categories insertable by managers" ON public.categories
      FOR INSERT WITH CHECK (
        workspace_id IS NOT NULL AND public.get_user_workspace_role(workspace_id, auth.uid()) IN ('owner', 'admin', 'manager')
      );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'categories' AND policyname = 'Categories updatable by managers') THEN
    CREATE POLICY "Categories updatable by managers" ON public.categories
      FOR UPDATE USING (
        workspace_id IS NOT NULL AND public.get_user_workspace_role(workspace_id, auth.uid()) IN ('owner', 'admin', 'manager')
      ) WITH CHECK (
        workspace_id IS NOT NULL AND public.get_user_workspace_role(workspace_id, auth.uid()) IN ('owner', 'admin', 'manager')
      );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'categories' AND policyname = 'Categories deletable by admin and owner') THEN
    CREATE POLICY "Categories deletable by admin and owner" ON public.categories
      FOR DELETE USING (
        workspace_id IS NOT NULL AND public.get_user_workspace_role(workspace_id, auth.uid()) IN ('owner', 'admin')
      );
  END IF;
END;
$$;

-- 7. RLS Policies: Tags
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'tags' AND policyname = 'Tags viewable by workspace members') THEN
    CREATE POLICY "Tags viewable by workspace members" ON public.tags
      FOR SELECT USING (public.is_workspace_member(workspace_id, auth.uid()));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'tags' AND policyname = 'Tags insertable by workspace members') THEN
    CREATE POLICY "Tags insertable by workspace members" ON public.tags
      FOR INSERT WITH CHECK (public.is_workspace_member(workspace_id, auth.uid()));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'tags' AND policyname = 'Tags updatable by managers') THEN
    CREATE POLICY "Tags updatable by managers" ON public.tags
      FOR UPDATE USING (public.get_user_workspace_role(workspace_id, auth.uid()) IN ('owner', 'admin', 'manager'))
      WITH CHECK (public.get_user_workspace_role(workspace_id, auth.uid()) IN ('owner', 'admin', 'manager'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'tags' AND policyname = 'Tags deletable by managers') THEN
    CREATE POLICY "Tags deletable by managers" ON public.tags
      FOR DELETE USING (public.get_user_workspace_role(workspace_id, auth.uid()) IN ('owner', 'admin', 'manager'));
  END IF;
END;
$$;

-- 8. RLS Policies: Merchants
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'merchants' AND policyname = 'Merchants viewable by workspace members') THEN
    CREATE POLICY "Merchants viewable by workspace members" ON public.merchants
      FOR SELECT USING (public.is_workspace_member(workspace_id, auth.uid()));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'merchants' AND policyname = 'Merchants insertable by workspace members') THEN
    CREATE POLICY "Merchants insertable by workspace members" ON public.merchants
      FOR INSERT WITH CHECK (public.is_workspace_member(workspace_id, auth.uid()));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'merchants' AND policyname = 'Merchants updatable by managers') THEN
    CREATE POLICY "Merchants updatable by managers" ON public.merchants
      FOR UPDATE USING (public.get_user_workspace_role(workspace_id, auth.uid()) IN ('owner', 'admin', 'manager'))
      WITH CHECK (public.get_user_workspace_role(workspace_id, auth.uid()) IN ('owner', 'admin', 'manager'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'merchants' AND policyname = 'Merchants deletable by admin and owner') THEN
    CREATE POLICY "Merchants deletable by admin and owner" ON public.merchants
      FOR DELETE USING (public.get_user_workspace_role(workspace_id, auth.uid()) IN ('owner', 'admin'));
  END IF;
END;
$$;

-- 9. Seed Standard Catalog Categories (workspace_id = NULL)
INSERT INTO public.categories (name, kind, is_essential, icon, color, system_key)
VALUES
  -- Needs (Essential Expenses)
  ('Groceries & Supermarket', 'expense', true, '🛒', '#10b981', 'food_groceries'),
  ('Housing & Rent', 'expense', true, '🏠', '#f59e0b', 'housing_rent'),
  ('Utilities & Electricity', 'expense', true, '💡', '#06b6d4', 'utilities'),
  ('Transportation & Fuel', 'expense', true, '🚗', '#3b82f6', 'transportation'),
  ('Healthcare & Medicine', 'expense', true, '💊', '#14b8a6', 'healthcare'),
  ('Education & Tuition', 'expense', true, '🎓', '#8b5cf6', 'education'),
  
  -- Wants (Discretionary Expenses)
  ('Dining Out & Cafes', 'expense', false, '🍜', '#ec4899', 'dining_out'),
  ('Entertainment & Leisure', 'expense', false, '🎬', '#d946ef', 'entertainment'),
  ('Shopping & Apparel', 'expense', false, '🛍️', '#f43f5e', 'shopping'),
  ('Travel & Holidays', 'expense', false, '✈️', '#0ea5e9', 'travel'),
  ('Software & Cloud Tools', 'expense', false, '☁️', '#6366f1', 'software_tools'),
  ('Other Miscellaneous', 'expense', false, '📦', '#64748b', 'other_expense'),

  -- Income Categories
  ('Salary & Client Retainers', 'income', false, '💼', '#10b981', 'salary'),
  ('Freelance & Consulting', 'income', false, '⚡', '#6366f1', 'freelance'),
  ('Investments & Dividends', 'income', false, '📈', '#3b82f6', 'investments'),
  ('Business Revenue', 'income', false, '🏢', '#059669', 'business_revenue'),
  ('Gifts & Other Income', 'income', false, '💰', '#d946ef', 'other_income')
ON CONFLICT DO NOTHING;

COMMIT;
