-- 020: Workspace invitations (email invite + accept flow)
-- Replaces the old client-side "addMember" that never wrote a valid row.

CREATE TABLE IF NOT EXISTS public.workspace_invitations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id    UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  email           TEXT NOT NULL CHECK (email = lower(email) AND position('@' in email) > 1),
  role            public.workspace_role NOT NULL DEFAULT 'member' CHECK (role <> 'owner'),
  token           UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  status          TEXT NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending', 'accepted', 'declined', 'revoked', 'expired')),
  invited_by      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  invited_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  expires_at      TIMESTAMPTZ NOT NULL DEFAULT (clock_timestamp() + INTERVAL '14 days'),
  responded_at    TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS workspace_invitations_one_pending
  ON public.workspace_invitations (workspace_id, email) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS workspace_invitations_email_idx
  ON public.workspace_invitations (email) WHERE status = 'pending';

ALTER TABLE public.workspace_invitations ENABLE ROW LEVEL SECURITY;

-- Owners/admins of the workspace can see its invitations. All writes go through the RPCs below.
DROP POLICY IF EXISTS "Invitations viewable by workspace owners and admins" ON public.workspace_invitations;
CREATE POLICY "Invitations viewable by workspace owners and admins"
  ON public.workspace_invitations FOR SELECT
  USING (public.get_user_workspace_role(workspace_id, auth.uid()) IN ('owner', 'admin'));

REVOKE ALL ON public.workspace_invitations FROM anon, authenticated;
GRANT SELECT ON public.workspace_invitations TO authenticated;

-- ---------------------------------------------------------------------------
-- Helper: caller's email from the JWT (lower-cased)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION private.caller_email()
RETURNS TEXT
LANGUAGE sql STABLE
AS $$ SELECT lower(NULLIF(auth.jwt() ->> 'email', '')); $$;

-- ---------------------------------------------------------------------------
-- invite_member: owner/admin invites an email with a role
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.invite_member(p_workspace_id UUID, p_email TEXT, p_role TEXT DEFAULT 'member')
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_caller_role TEXT;
  v_email TEXT := lower(trim(COALESCE(p_email, '')));
  v_role public.workspace_role;
  v_user_id UUID;
  v_ws_name TEXT;
  v_inv public.workspace_invitations;
BEGIN
  v_caller_role := private.require_role(p_workspace_id, ARRAY['owner', 'admin']);

  IF v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' THEN
    RAISE EXCEPTION 'Please enter a valid email address';
  END IF;

  BEGIN
    v_role := lower(trim(COALESCE(p_role, 'member')))::public.workspace_role;
  EXCEPTION WHEN others THEN
    RAISE EXCEPTION 'Invalid role: %', p_role;
  END;
  IF v_role = 'owner' THEN
    RAISE EXCEPTION 'Ownership cannot be granted by invitation';
  END IF;
  IF v_role = 'admin' AND v_caller_role <> 'owner' THEN
    RAISE EXCEPTION 'Only the workspace owner can invite admins';
  END IF;

  IF v_email = private.caller_email() THEN
    RAISE EXCEPTION 'You cannot invite yourself';
  END IF;

  SELECT id INTO v_user_id FROM auth.users WHERE lower(email) = v_email LIMIT 1;

  IF v_user_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.workspace_members
    WHERE workspace_id = p_workspace_id AND user_id = v_user_id
  ) THEN
    RAISE EXCEPTION '% is already a member of this workspace', v_email;
  END IF;

  SELECT name INTO v_ws_name FROM public.workspaces WHERE id = p_workspace_id AND archived_at IS NULL;
  IF v_ws_name IS NULL THEN
    RAISE EXCEPTION 'Workspace not found or archived';
  END IF;

  -- Re-inviting refreshes the pending invitation instead of duplicating it
  UPDATE public.workspace_invitations
  SET role = v_role, invited_by = auth.uid(), invited_user_id = v_user_id,
      token = gen_random_uuid(), created_at = clock_timestamp(),
      expires_at = clock_timestamp() + INTERVAL '14 days'
  WHERE workspace_id = p_workspace_id AND email = v_email AND status = 'pending'
  RETURNING * INTO v_inv;

  IF NOT FOUND THEN
    INSERT INTO public.workspace_invitations (workspace_id, email, role, invited_by, invited_user_id)
    VALUES (p_workspace_id, v_email, v_role, auth.uid(), v_user_id)
    RETURNING * INTO v_inv;
  END IF;

  RETURN jsonb_build_object(
    'invitation_id', v_inv.id,
    'token', v_inv.token,
    'email', v_email,
    'role', v_inv.role,
    'workspace_id', p_workspace_id,
    'workspace_name', v_ws_name,
    'user_exists', v_user_id IS NOT NULL,
    'expires_at', v_inv.expires_at
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- my_pending_invitations: invitations addressed to the signed-in user's email
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.my_pending_invitations()
RETURNS TABLE (
  id UUID, token UUID, workspace_id UUID, workspace_name TEXT, role TEXT,
  invited_by_name TEXT, created_at TIMESTAMPTZ, expires_at TIMESTAMPTZ
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT i.id, i.token, i.workspace_id, w.name, i.role::TEXT,
         COALESCE(p.full_name, 'A workspace admin'), i.created_at, i.expires_at
  FROM public.workspace_invitations i
  JOIN public.workspaces w ON w.id = i.workspace_id AND w.archived_at IS NULL
  LEFT JOIN public.profiles p ON p.id = i.invited_by
  WHERE auth.uid() IS NOT NULL
    AND i.email = private.caller_email()
    AND i.status = 'pending'
    AND i.expires_at > clock_timestamp()
  ORDER BY i.created_at DESC;
$$;

-- ---------------------------------------------------------------------------
-- accept_invitation: only the invited email can accept
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.accept_invitation(p_token UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_inv public.workspace_invitations;
  v_existing RECORD;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_inv FROM public.workspace_invitations WHERE token = p_token FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invitation not found';
  END IF;
  IF v_inv.email IS DISTINCT FROM private.caller_email() THEN
    RAISE EXCEPTION 'This invitation was sent to a different email address' USING ERRCODE = '42501';
  END IF;
  IF v_inv.status <> 'pending' THEN
    RAISE EXCEPTION 'This invitation is no longer valid (%)', v_inv.status;
  END IF;
  IF v_inv.expires_at <= clock_timestamp() THEN
    UPDATE public.workspace_invitations SET status = 'expired', responded_at = clock_timestamp() WHERE id = v_inv.id;
    RAISE EXCEPTION 'This invitation has expired. Ask the workspace admin to send a new one.';
  END IF;

  SELECT * INTO v_existing FROM public.workspace_members
  WHERE workspace_id = v_inv.workspace_id AND user_id = auth.uid();

  IF FOUND THEN
    IF v_existing.status = 'suspended' THEN
      RAISE EXCEPTION 'Your access to this workspace is suspended';
    END IF;
    -- already a member: keep their current role
  ELSE
    INSERT INTO public.workspace_members (workspace_id, user_id, role, status)
    VALUES (v_inv.workspace_id, auth.uid(), v_inv.role, 'active');
  END IF;

  UPDATE public.workspace_invitations
  SET status = 'accepted', invited_user_id = auth.uid(), responded_at = clock_timestamp()
  WHERE id = v_inv.id;

  RETURN jsonb_build_object('workspace_id', v_inv.workspace_id, 'role', v_inv.role);
END;
$$;

-- ---------------------------------------------------------------------------
-- decline_invitation (invitee) / revoke_invitation (owner/admin)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.decline_invitation(p_invitation_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;
  UPDATE public.workspace_invitations
  SET status = 'declined', responded_at = clock_timestamp()
  WHERE id = p_invitation_id AND email = private.caller_email() AND status = 'pending';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invitation not found';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.revoke_invitation(p_invitation_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_ws UUID;
BEGIN
  SELECT workspace_id INTO v_ws FROM public.workspace_invitations WHERE id = p_invitation_id;
  IF v_ws IS NULL THEN
    RAISE EXCEPTION 'Invitation not found';
  END IF;
  PERFORM private.require_role(v_ws, ARRAY['owner', 'admin']);
  UPDATE public.workspace_invitations
  SET status = 'revoked', responded_at = clock_timestamp()
  WHERE id = p_invitation_id AND status = 'pending';
END;
$$;

-- ---------------------------------------------------------------------------
-- Grants: authenticated only
-- ---------------------------------------------------------------------------
REVOKE ALL ON FUNCTION private.caller_email() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.caller_email() TO authenticated;

DO $$
DECLARE f TEXT;
BEGIN
  FOREACH f IN ARRAY ARRAY[
    'public.invite_member(uuid,text,text)',
    'public.my_pending_invitations()',
    'public.accept_invitation(uuid)',
    'public.decline_invitation(uuid)',
    'public.revoke_invitation(uuid)'
  ] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', f);
  END LOOP;
END $$;
