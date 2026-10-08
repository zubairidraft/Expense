-- =============================================================================
-- Migration: 20261008000015_import_and_export.sql
-- Purpose: Phase 17 - Data In & Out (Import Batches, Deduplication & Export)
-- =============================================================================

BEGIN;

-- 1. Import Batches Table
CREATE TABLE IF NOT EXISTS public.import_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  source TEXT NOT NULL CHECK (source IN ('csv', 'pdf', 'ofx', 'sms', 'json')),
  filename TEXT,
  total_rows INT NOT NULL DEFAULT 0,
  imported_rows INT NOT NULL DEFAULT 0,
  skipped_rows INT NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  mapping JSONB,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

CREATE INDEX IF NOT EXISTS idx_import_batches_workspace ON public.import_batches(workspace_id);

-- 2. Import Rows Table with Deduplication Hash
CREATE TABLE IF NOT EXISTS public.import_rows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id UUID NOT NULL REFERENCES public.import_batches(id) ON DELETE CASCADE,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  row_index INT NOT NULL,
  raw_data JSONB NOT NULL,
  parsed_data JSONB,
  dedupe_hash TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'imported', 'duplicate', 'error')),
  transaction_id UUID REFERENCES public.transactions(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT uq_import_rows_hash UNIQUE(workspace_id, dedupe_hash)
);

CREATE INDEX IF NOT EXISTS idx_import_rows_batch ON public.import_rows(batch_id);
CREATE INDEX IF NOT EXISTS idx_import_rows_dedupe ON public.import_rows(workspace_id, dedupe_hash);

-- 3. Triggers for updated_at
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_import_batches_updated_at') THEN
    CREATE TRIGGER update_import_batches_updated_at
    BEFORE UPDATE ON public.import_batches
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
  END IF;
END;
$$;

-- 4. RLS Policies
ALTER TABLE public.import_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.import_rows ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'import_batches' AND policyname = 'Import batches viewable by workspace members') THEN
    CREATE POLICY "Import batches viewable by workspace members" ON public.import_batches
      FOR SELECT TO authenticated
      USING (EXISTS (SELECT 1 FROM public.workspace_members wm WHERE wm.workspace_id = import_batches.workspace_id AND wm.user_id = auth.uid()));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'import_batches' AND policyname = 'Import batches manageable by workspace members') THEN
    CREATE POLICY "Import batches manageable by workspace members" ON public.import_batches
      FOR ALL TO authenticated
      USING (EXISTS (SELECT 1 FROM public.workspace_members wm WHERE wm.workspace_id = import_batches.workspace_id AND wm.user_id = auth.uid() AND wm.role IN ('owner', 'admin', 'manager', 'member')));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'import_rows' AND policyname = 'Import rows viewable by workspace members') THEN
    CREATE POLICY "Import rows viewable by workspace members" ON public.import_rows
      FOR SELECT TO authenticated
      USING (EXISTS (SELECT 1 FROM public.workspace_members wm WHERE wm.workspace_id = import_rows.workspace_id AND wm.user_id = auth.uid()));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'import_rows' AND policyname = 'Import rows manageable by workspace members') THEN
    CREATE POLICY "Import rows manageable by workspace members" ON public.import_rows
      FOR ALL TO authenticated
      USING (EXISTS (SELECT 1 FROM public.workspace_members wm WHERE wm.workspace_id = import_rows.workspace_id AND wm.user_id = auth.uid() AND wm.role IN ('owner', 'admin', 'manager', 'member')));
  END IF;
END;
$$;

COMMIT;
