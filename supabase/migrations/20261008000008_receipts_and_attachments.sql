-- =============================================================================
-- Migration: 20261008000008_receipts_and_attachments.sql
-- Purpose: Phase 10 - Receipts, Attachments & OCR Processing
-- =============================================================================

BEGIN;

-- 1. Attachments Table
CREATE TABLE IF NOT EXISTS public.attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  transaction_id UUID REFERENCES public.transactions(id) ON DELETE SET NULL,
  file_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_size INT NOT NULL,
  mime_type TEXT NOT NULL,
  ocr_status TEXT NOT NULL DEFAULT 'pending' CHECK (ocr_status IN ('pending', 'processing', 'completed', 'failed', 'none')),
  ocr_raw_text TEXT,
  ocr_extracted_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  uploaded_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

CREATE INDEX IF NOT EXISTS idx_attachments_workspace ON public.attachments(workspace_id);
CREATE INDEX IF NOT EXISTS idx_attachments_transaction ON public.attachments(transaction_id);

-- 2. Trigger for updated_at
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_attachments_updated_at') THEN
    CREATE TRIGGER update_attachments_updated_at
    BEFORE UPDATE ON public.attachments
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
  END IF;
END;
$$;

-- 3. RLS on attachments
ALTER TABLE public.attachments ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'attachments' AND policyname = 'Attachments viewable by workspace members') THEN
    CREATE POLICY "Attachments viewable by workspace members" ON public.attachments
      FOR SELECT USING (public.is_workspace_member(workspace_id, auth.uid()));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'attachments' AND policyname = 'Attachments insertable by workspace members') THEN
    CREATE POLICY "Attachments insertable by workspace members" ON public.attachments
      FOR INSERT WITH CHECK (public.is_workspace_member(workspace_id, auth.uid()));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'attachments' AND policyname = 'Attachments updatable by workspace members') THEN
    CREATE POLICY "Attachments updatable by workspace members" ON public.attachments
      FOR UPDATE USING (public.is_workspace_member(workspace_id, auth.uid()))
      WITH CHECK (public.is_workspace_member(workspace_id, auth.uid()));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'attachments' AND policyname = 'Attachments deletable by managers') THEN
    CREATE POLICY "Attachments deletable by managers" ON public.attachments
      FOR DELETE USING (
        public.get_user_workspace_role(workspace_id, auth.uid()) IN ('owner', 'admin', 'manager')
        OR uploaded_by = auth.uid()
      );
  END IF;
END;
$$;

-- 4. Storage Bucket Setup (receipts)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'receipts',
  'receipts',
  false,
  10485760, -- 10MB limit
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'application/pdf']
)
ON CONFLICT (id) DO UPDATE SET
  public = false,
  file_size_limit = 10485760;

-- Storage RLS policies for receipts bucket
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Authenticated users can upload receipts'
  ) THEN
    CREATE POLICY "Authenticated users can upload receipts"
      ON storage.objects FOR INSERT
      TO authenticated
      WITH CHECK (bucket_id = 'receipts');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Authenticated users can view receipts'
  ) THEN
    CREATE POLICY "Authenticated users can view receipts"
      ON storage.objects FOR SELECT
      TO authenticated
      USING (bucket_id = 'receipts');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Authenticated users can delete receipts'
  ) THEN
    CREATE POLICY "Authenticated users can delete receipts"
      ON storage.objects FOR DELETE
      TO authenticated
      USING (bucket_id = 'receipts');
  END IF;
END;
$$;

COMMIT;
