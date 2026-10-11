// Edge Function: send-workspace-invite
// Creates the invitation (via the invite_member RPC, so role checks run as the caller)
// and, for emails that do not have an account yet, sends Supabase's built-in invite email
// (uses the project's SMTP: the default Supabase SMTP unless a custom one is configured).
// Existing users are not emailed; they see the invitation inside the app after they sign in.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return json({ error: 'Authentication required' }, 401);

  let payload: { workspaceId?: string; email?: string; role?: string; siteUrl?: string };
  try {
    payload = await req.json();
  } catch {
    return json({ error: 'Invalid request body' }, 400);
  }
  const { workspaceId, email, role = 'member', siteUrl } = payload;
  if (!workspaceId || !email) return json({ error: 'workspaceId and email are required' }, 400);

  const url = Deno.env.get('SUPABASE_URL')!;
  const anon = Deno.env.get('SUPABASE_ANON_KEY')!;
  const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  // 1) Create the invitation as the caller (RLS / role checks enforced inside the RPC)
  const userClient = createClient(url, anon, { global: { headers: { Authorization: authHeader } } });
  const { data: inv, error: invErr } = await userClient.rpc('invite_member', {
    p_workspace_id: workspaceId,
    p_email: email,
    p_role: role,
  });
  if (invErr) return json({ error: invErr.message }, 400);

  // 2) Email only people without an account yet
  let emailed = false;
  let emailNote: string | null = null;
  if (!inv.user_exists) {
    const base = (Deno.env.get('SITE_URL') || siteUrl || '').replace(/\/$/, '');
    const admin = createClient(url, service, { auth: { autoRefreshToken: false, persistSession: false } });
    const { error: mailErr } = await admin.auth.admin.inviteUserByEmail(inv.email, {
      redirectTo: base ? `${base}/?invite=${inv.token}` : undefined,
      data: { invited_to_workspace: inv.workspace_name },
    });
    if (mailErr) {
      emailNote = mailErr.message;
    } else {
      emailed = true;
    }
  } else {
    emailNote = 'This person already has an account. They will see the invitation after signing in.';
  }

  return json({ invitation: inv, emailed, emailNote });
});
