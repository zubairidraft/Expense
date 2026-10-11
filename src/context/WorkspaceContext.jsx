import { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';

const WorkspaceContext = createContext(null);

export function WorkspaceProvider({ children }) {
  const { user, profile } = useAuth();
  const [workspaces, setWorkspaces] = useState([]);
  const [currentWorkspaceId, setCurrentWorkspaceId] = useState(() => {
    return localStorage.getItem('active_workspace_id') || null;
  });
  const [members, setMembers] = useState([]);
  const [invitations, setInvitations] = useState([]); // pending invitations sent from the current workspace
  const [myInvitations, setMyInvitations] = useState([]); // pending invitations addressed to me
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Default guest workspace
  const defaultGuestWorkspace = useMemo(() => ({
    id: 'guest-space',
    name: `${profile.fullName || 'Personal'}'s Space`,
    type: 'personal',
    base_currency: profile.defaultCurrency || 'USD',
    owner_id: 'guest',
    timezone: 'UTC',
    month_start_day: 1,
    budgeting_style: 'limit_based',
    role: 'owner',
  }), [profile.fullName, profile.defaultCurrency]);

  const getStoredGuestWorkspaces = useCallback((defaultWs) => {
    try {
      const raw = localStorage.getItem('expense_pro_workspaces');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          if (!parsed.some((w) => w.id === defaultWs.id)) {
            return [defaultWs, ...parsed];
          }
          return parsed;
        }
      }
    } catch (e) {
      console.warn('[WorkspaceContext] Error reading stored workspaces:', e);
    }
    return [defaultWs];
  }, []);

  const saveGuestWorkspaces = (wsList) => {
    try {
      localStorage.setItem('expense_pro_workspaces', JSON.stringify(wsList));
    } catch (e) {
      console.warn('[WorkspaceContext] Error saving workspaces:', e);
    }
  };

  const fetchWorkspaces = useCallback(async () => {
    if (!user) {
      const list = getStoredGuestWorkspaces(defaultGuestWorkspace);
      setWorkspaces(list);
      const savedId = localStorage.getItem('active_workspace_id');
      if (savedId && list.some((w) => w.id === savedId)) {
        setCurrentWorkspaceId(savedId);
      } else {
        setCurrentWorkspaceId(list[0].id);
        localStorage.setItem('active_workspace_id', list[0].id);
      }
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Fetch workspaces where user is owner or member
      const { data, error: fetchErr } = await supabase
        .from('workspaces')
        .select(`
          *,
          workspace_members (
            id,
            user_id,
            role,
            status
          )
        `)
        .is('archived_at', null)
        .order('created_at', { ascending: false });

      if (fetchErr) throw fetchErr;

      if (data && data.length > 0) {
        const enriched = data.map((ws) => {
          const userMember = ws.workspace_members?.find((m) => m.user_id === user.id);
          const role = ws.owner_id === user.id ? 'owner' : (userMember?.role || 'member');
          return {
            ...ws,
            role,
          };
        });

        setWorkspaces(enriched);

        // Keep current or select first
        const savedId = localStorage.getItem('active_workspace_id');
        const exists = enriched.some((w) => w.id === savedId);
        if (exists) {
          setCurrentWorkspaceId(savedId);
        } else {
          setCurrentWorkspaceId(enriched[0].id);
          localStorage.setItem('active_workspace_id', enriched[0].id);
        }
      } else {
        // Fallback if no workspaces yet
        setWorkspaces([defaultGuestWorkspace]);
        setCurrentWorkspaceId(defaultGuestWorkspace.id);
      }
    } catch (err) {
      console.warn('[WorkspaceContext] Error fetching workspaces:', err.message);
      setError(err.message);
      setWorkspaces([defaultGuestWorkspace]);
      setCurrentWorkspaceId(defaultGuestWorkspace.id);
    } finally {
      setLoading(false);
    }
  }, [user, defaultGuestWorkspace]);

  useEffect(() => {
    fetchWorkspaces();
  }, [fetchWorkspaces]);

  const currentWorkspace = useMemo(() => {
    if (!workspaces.length) return defaultGuestWorkspace;
    return workspaces.find((w) => w.id === currentWorkspaceId) || workspaces[0];
  }, [workspaces, currentWorkspaceId, defaultGuestWorkspace]);

  const switchWorkspace = (workspaceId) => {
    setCurrentWorkspaceId(workspaceId);
    localStorage.setItem('active_workspace_id', workspaceId);
  };

  const createWorkspace = async ({
    name,
    type = 'personal',
    baseCurrency = profile.defaultCurrency || 'USD',
    timezone = 'UTC',
    monthStartDay = 1,
    budgetingStyle = 'limit_based',
  }) => {
    if (!user) {
      // Create local workspace for guest
      const newWs = {
        id: `guest-${Date.now()}`,
        name,
        type,
        base_currency: baseCurrency,
        owner_id: 'guest',
        timezone,
        month_start_day: monthStartDay,
        budgeting_style: budgetingStyle,
        role: 'owner',
      };
      const next = [newWs, ...workspaces.filter((w) => w.id !== newWs.id)];
      saveGuestWorkspaces(next);
      setWorkspaces(next);
      switchWorkspace(newWs.id);
      return { data: newWs, error: null };
    }

    try {
      setError(null);
      const { data, error: insertErr } = await supabase
        .from('workspaces')
        .insert({
          name,
          type,
          base_currency: baseCurrency,
          owner_id: user.id,
          timezone,
          month_start_day: monthStartDay,
          budgeting_style: budgetingStyle,
        })
        .select()
        .single();

      if (insertErr) throw insertErr;

      await fetchWorkspaces();
      if (data) {
        switchWorkspace(data.id);
      }
      return { data, error: null };
    } catch (err) {
      console.error('[WorkspaceContext] Create workspace error:', err);
      setError(err.message);
      return { data: null, error: err };
    }
  };

  const updateWorkspace = async (workspaceId, updates) => {
    try {
      if (!user) {
        const next = workspaces.map((w) => (w.id === workspaceId ? { ...w, ...updates } : w));
        saveGuestWorkspaces(next);
        setWorkspaces(next);
        return { error: null };
      }

      const { error: updErr } = await supabase
        .from('workspaces')
        .update(updates)
        .eq('id', workspaceId);

      if (updErr) throw updErr;

      await fetchWorkspaces();
      return { error: null };
    } catch (err) {
      setError(err.message);
      return { error: err };
    }
  };

  const archiveWorkspace = async (workspaceId) => {
    try {
      if (!user) {
        const next = workspaces.filter((w) => w.id !== workspaceId);
        saveGuestWorkspaces(next);
        setWorkspaces(next);
        if (currentWorkspaceId === workspaceId && next.length > 0) {
          switchWorkspace(next[0].id);
        }
        return { error: null };
      }

      const { error: archErr } = await supabase
        .from('workspaces')
        .update({ archived_at: new Date().toISOString() })
        .eq('id', workspaceId);

      if (archErr) throw archErr;

      await fetchWorkspaces();
      return { error: null };
    } catch (err) {
      setError(err.message);
      return { error: err };
    }
  };

  const fetchMembers = useCallback(async (workspaceId) => {
    const wsId = workspaceId || currentWorkspaceId || 'guest-space';
    if (!user || wsId === 'guest-space') {
      try {
        const stored = localStorage.getItem(`expense_pro_ws_members_${wsId}`);
        if (stored) {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setMembers(parsed);
            return;
          }
        }
      } catch (e) {
        console.warn('Failed to parse stored members:', e);
      }

      const defaultList = [
        {
          id: 'guest-member-owner',
          user_id: 'guest',
          role: 'owner',
          status: 'active',
          joined_at: new Date().toISOString(),
          profiles: { full_name: profile.fullName || 'Guest User (Owner)', default_currency: profile.defaultCurrency || 'USD' },
        },
        {
          id: 'guest-member-collab',
          user_id: 'collab-1',
          role: 'admin',
          status: 'active',
          joined_at: new Date().toISOString(),
          profiles: { full_name: 'Sarah Connor (Accountant)', default_currency: profile.defaultCurrency || 'USD' },
        },
      ];
      setMembers(defaultList);
      try {
        localStorage.setItem(`expense_pro_ws_members_${wsId}`, JSON.stringify(defaultList));
      } catch (e) {}
      return;
    }

    try {
      const { data, error: mErr } = await supabase
        .from('workspace_members')
        .select(`
          id,
          user_id,
          role,
          status,
          joined_at,
          profiles:user_id (
            full_name,
            avatar_url,
            default_currency
          )
        `)
        .eq('workspace_id', wsId);

      if (mErr) throw mErr;
      setMembers(data || []);
    } catch (err) {
      console.warn('[WorkspaceContext] Error fetching members:', err.message);
    }
  }, [user, profile.fullName, profile.defaultCurrency, currentWorkspaceId]);

  const isRealWorkspace = (wsId) => !!user && !!wsId && wsId !== 'guest-space';

  // Guest mode only: members live in localStorage (no real accounts, nobody is emailed)
  const addGuestMember = (wsId, { name, email, role }) => {
    const newMember = {
      id: `m-${Date.now()}`,
      user_id: `user-${Date.now()}`,
      role: role.toLowerCase(),
      status: 'active',
      joined_at: new Date().toISOString(),
      email,
      profiles: {
        full_name: name || email.split('@')[0],
        default_currency: currentWorkspace?.base_currency || 'USD',
      },
    };
    setMembers((prev) => {
      const updated = [...prev, newMember];
      try {
        localStorage.setItem(`expense_pro_ws_members_${wsId}`, JSON.stringify(updated));
      } catch (e) {}
      return updated;
    });
    return { data: newMember, error: null };
  };

  const fetchInvitations = useCallback(async (workspaceId) => {
    const wsId = workspaceId || currentWorkspaceId;
    if (!isRealWorkspace(wsId)) {
      setInvitations([]);
      return;
    }
    const { data, error: invErr } = await supabase
      .from('workspace_invitations')
      .select('id, email, role, status, created_at, expires_at')
      .eq('workspace_id', wsId)
      .eq('status', 'pending')
      .order('created_at', { ascending: false });
    if (invErr) {
      // Members without owner/admin rights simply cannot see invitations
      setInvitations([]);
      return;
    }
    setInvitations(data || []);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, currentWorkspaceId]);

  // Invite by email. Signed-in: creates a real invitation (and emails people without an account).
  const inviteMember = async (workspaceId, { email, role = 'member', name }) => {
    const wsId = workspaceId || currentWorkspaceId || 'guest-space';
    if (!isRealWorkspace(wsId)) {
      return addGuestMember(wsId, { name, email, role });
    }

    const cleanEmail = (email || '').trim();
    let result = null;

    // 1) Edge function: creates the invitation and sends the email
    try {
      const { data, error: fnErr } = await supabase.functions.invoke('send-workspace-invite', {
        body: { workspaceId: wsId, email: cleanEmail, role, siteUrl: window.location.origin },
      });
      if (fnErr) {
        const status = fnErr.context?.status;
        if (status && status !== 404) {
          let message = fnErr.message;
          try {
            const body = await fnErr.context.json();
            if (body?.error) message = body.error;
          } catch (e) {}
          return { data: null, error: new Error(message) };
        }
        // 404 / network: function not deployed yet -> fall through to the database call
      } else if (data?.invitation) {
        result = { invitation: data.invitation, emailed: !!data.emailed, emailNote: data.emailNote || null };
      }
    } catch (e) {
      // fall through
    }

    // 2) Fallback: create the invitation without sending an email
    if (!result) {
      const { data, error: rpcErr } = await supabase.rpc('invite_member', {
        p_workspace_id: wsId,
        p_email: cleanEmail,
        p_role: role,
      });
      if (rpcErr) return { data: null, error: new Error(rpcErr.message) };
      result = {
        invitation: data,
        emailed: false,
        emailNote: data?.user_exists
          ? 'This person already has an account. They will see the invitation after signing in.'
          : 'Invitation saved, but the email could not be sent (email service not set up). Ask them to sign up with this email address; the invitation will be waiting.',
      };
    }

    await fetchInvitations(wsId);
    return { data: result, error: null };
  };

  const addMember = async (workspaceId, member) => inviteMember(workspaceId, member);

  const revokeInvitation = async (invitationId) => {
    const { error: revErr } = await supabase.rpc('revoke_invitation', { p_invitation_id: invitationId });
    if (revErr) return { error: new Error(revErr.message) };
    await fetchInvitations();
    return { error: null };
  };

  const removeMember = async (workspaceId, memberId) => {
    const wsId = workspaceId || currentWorkspaceId || 'guest-space';
    if (!isRealWorkspace(wsId)) {
      setMembers((prev) => {
        const updated = prev.filter((m) => m.id !== memberId);
        try {
          localStorage.setItem(`expense_pro_ws_members_${wsId}`, JSON.stringify(updated));
        } catch (e) {}
        return updated;
      });
      return { error: null };
    }

    const { data, error: delErr } = await supabase
      .from('workspace_members')
      .delete()
      .eq('id', memberId)
      .select('id');
    if (delErr) return { error: new Error(delErr.message) };
    if (!data || data.length === 0) {
      return { error: new Error('Could not remove this member (not allowed or already removed).') };
    }
    await fetchMembers(wsId);
    return { error: null };
  };

  // ---- Invitations addressed to the signed-in user ----
  const fetchMyInvitations = useCallback(async () => {
    if (!user) {
      setMyInvitations([]);
      return;
    }
    const { data, error: invErr } = await supabase.rpc('my_pending_invitations');
    if (invErr) {
      setMyInvitations([]);
      return;
    }
    setMyInvitations(data || []);
  }, [user]);

  const acceptInvitation = async (token) => {
    const { data, error: accErr } = await supabase.rpc('accept_invitation', { p_token: token });
    if (accErr) return { data: null, error: new Error(accErr.message) };
    await fetchWorkspaces();
    if (data?.workspace_id) {
      setCurrentWorkspaceId(data.workspace_id);
      try {
        localStorage.setItem('active_workspace_id', data.workspace_id);
      } catch (e) {}
    }
    await fetchMyInvitations();
    return { data, error: null };
  };

  const declineInvitation = async (invitationId) => {
    const { error: decErr } = await supabase.rpc('decline_invitation', { p_invitation_id: invitationId });
    if (decErr) return { error: new Error(decErr.message) };
    await fetchMyInvitations();
    return { error: null };
  };

  useEffect(() => {
    fetchMyInvitations();
  }, [fetchMyInvitations]);

  // Opening the app from an emailed invite link (?invite=<token>) accepts it once signed in
  useEffect(() => {
    if (!user) return;
    const params = new URLSearchParams(window.location.search);
    const token = params.get('invite');
    if (!token) return;
    params.delete('invite');
    const qs = params.toString();
    window.history.replaceState({}, '', window.location.pathname + (qs ? `?${qs}` : '') + window.location.hash);
    acceptInvitation(token).then((res) => {
      if (res?.error) console.warn('[WorkspaceContext] Invite link not accepted:', res.error.message);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  return (
    <WorkspaceContext.Provider
      value={{
        workspaces,
        currentWorkspace,
        currentWorkspaceId,
        members,
        loading,
        error,
        switchWorkspace,
        createWorkspace,
        updateWorkspace,
        archiveWorkspace,
        fetchMembers,
        addMember,
        removeMember,
        inviteMember,
        invitations,
        fetchInvitations,
        revokeInvitation,
        myInvitations,
        fetchMyInvitations,
        acceptInvitation,
        declineInvitation,
        refreshWorkspaces: fetchWorkspaces,
      }}
    >
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspace() {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) {
    throw new Error('useWorkspace must be used within a WorkspaceProvider');
  }
  return ctx;
}
