-- =============================================================================
-- Migration: 20261008000017_notifications.sql
-- Purpose: In-App Notification Center, Threshold Alerts & Due Reminders
-- =============================================================================

BEGIN;

-- 1. Notifications Table
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('budget_warning', 'budget_exceeded', 'debt_due', 'bill_due', 'spending_anomaly', 'system')),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  read_at TIMESTAMPTZ,
  action_url TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

-- Index for user unread alerts query
CREATE INDEX IF NOT EXISTS idx_notifications_workspace_user
  ON public.notifications (workspace_id, user_id, is_read, created_at DESC);

-- 2. Enable Row Level Security
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- 3. RLS Policies
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'notifications' AND policyname = 'Users can view their workspace notifications') THEN
    CREATE POLICY "Users can view their workspace notifications" ON public.notifications
      FOR SELECT USING (
        public.is_workspace_member(workspace_id, auth.uid()) AND (
          user_id = auth.uid() OR user_id IS NULL
        )
      );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'notifications' AND policyname = 'Users can update their notifications read status') THEN
    CREATE POLICY "Users can update their notifications read status" ON public.notifications
      FOR UPDATE USING (
        public.is_workspace_member(workspace_id, auth.uid()) AND (
          user_id = auth.uid() OR user_id IS NULL
        )
      )
      WITH CHECK (
        public.is_workspace_member(workspace_id, auth.uid()) AND (
          user_id = auth.uid() OR user_id IS NULL
        )
      );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'notifications' AND policyname = 'Workspace members can create notifications') THEN
    CREATE POLICY "Workspace members can create notifications" ON public.notifications
      FOR INSERT WITH CHECK (
        public.is_workspace_member(workspace_id, auth.uid())
      );
  END IF;
END;
$$;

-- 4. Helper RPC to mark a notification read
CREATE OR REPLACE FUNCTION public.mark_notification_read(p_notification_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
BEGIN
  UPDATE public.notifications
  SET 
    is_read = TRUE,
    read_at = clock_timestamp()
  WHERE id = p_notification_id;

  RETURN FOUND;
END;
$$;

-- 5. Helper RPC to mark all notifications read for user in workspace
CREATE OR REPLACE FUNCTION public.mark_all_notifications_read(p_workspace_id UUID)
RETURNS INT
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  v_count INT;
BEGIN
  UPDATE public.notifications
  SET 
    is_read = TRUE,
    read_at = clock_timestamp()
  WHERE workspace_id = p_workspace_id
    AND (user_id = auth.uid() OR user_id IS NULL)
    AND is_read = FALSE;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

COMMIT;
