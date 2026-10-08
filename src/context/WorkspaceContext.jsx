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

  const fetchWorkspaces = useCallback(async () => {
    if (!user) {
      setWorkspaces([defaultGuestWorkspace]);
      setCurrentWorkspaceId('guest-space');
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
      setWorkspaces([newWs, ...workspaces]);
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
        setWorkspaces((prev) =>
          prev.map((w) => (w.id === workspaceId ? { ...w, ...updates } : w))
        );
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
        setWorkspaces((prev) => prev.filter((w) => w.id !== workspaceId));
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
    if (!user || workspaceId === 'guest-space') {
      setMembers([
        {
          id: 'guest-member',
          user_id: 'guest',
          role: 'owner',
          status: 'active',
          profile: { full_name: profile.fullName || 'Guest User' },
        },
      ]);
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
        .eq('workspace_id', workspaceId);

      if (mErr) throw mErr;
      setMembers(data || []);
    } catch (err) {
      console.warn('[WorkspaceContext] Error fetching members:', err.message);
    }
  }, [user, profile.fullName]);

  const inviteMember = async (workspaceId, { email, role = 'member' }) => {
    try {
      // In production, would trigger Supabase invite or insert into members
      return { data: { email, role }, error: null };
    } catch (err) {
      return { data: null, error: err };
    }
  };

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
        inviteMember,
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
