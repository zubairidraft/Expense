import { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';
import { useWorkspace } from './WorkspaceContext';

const AccountContext = createContext(null);

const DEFAULT_GUEST_ACCOUNTS = [
  {
    id: 'acc-1',
    workspace_id: 'guest-space',
    name: 'Main Checking Account',
    type: 'bank',
    nature: 'asset',
    currency: 'USD',
    opening_balance: '3500.00',
    opening_date: '2026-10-01',
    credit_limit: null,
    visibility: 'shared',
    icon: '🏦',
    color: '#6366f1',
  },
  {
    id: 'acc-2',
    workspace_id: 'guest-space',
    name: 'Physical Cash Vault',
    type: 'cash',
    nature: 'asset',
    currency: 'USD',
    opening_balance: '480.00',
    opening_date: '2026-10-01',
    credit_limit: null,
    visibility: 'shared',
    icon: '💵',
    color: '#10b981',
  },
  {
    id: 'acc-3',
    workspace_id: 'guest-space',
    name: 'Platinum Travel Card',
    type: 'card',
    nature: 'liability',
    currency: 'USD',
    opening_balance: '145.50',
    opening_date: '2026-10-01',
    credit_limit: '10000.00',
    visibility: 'shared',
    icon: '💳',
    color: '#f43f5e',
  },
];

export function AccountProvider({ children }) {
  const { user } = useAuth();
  const { currentWorkspace } = useWorkspace();
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchAccounts = useCallback(async () => {
    if (!currentWorkspace?.id || !user) {
      setAccounts(DEFAULT_GUEST_ACCOUNTS);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const { data, error: accErr } = await supabase
        .from('accounts')
        .select('*')
        .eq('workspace_id', currentWorkspace.id)
        .is('archived_at', null)
        .order('created_at', { ascending: true });

      if (accErr) throw accErr;

      if (data && data.length > 0) {
        setAccounts(data);
      } else {
        // If workspace has no accounts yet, provide template default
        setAccounts([]);
      }
    } catch (err) {
      console.warn('[AccountContext] Error fetching accounts:', err.message);
      setError(err.message);
      setAccounts(DEFAULT_GUEST_ACCOUNTS);
    } finally {
      setLoading(false);
    }
  }, [currentWorkspace?.id, user]);

  useEffect(() => {
    fetchAccounts();
  }, [fetchAccounts]);

  const createAccount = async ({
    name,
    type,
    nature,
    currency = currentWorkspace?.base_currency || 'USD',
    openingBalance = '0.00',
    openingDate = new Date().toISOString().split('T')[0],
    creditLimit = null,
    visibility = 'shared',
    icon = '🏦',
    color = '#6366f1',
  }) => {
    if (!user || currentWorkspace?.id === 'guest-space') {
      const newAcc = {
        id: `acc-${Date.now()}`,
        workspace_id: currentWorkspace?.id || 'guest-space',
        name,
        type,
        nature,
        currency,
        opening_balance: openingBalance,
        opening_date: openingDate,
        credit_limit: creditLimit,
        visibility,
        icon,
        color,
      };
      setAccounts((prev) => [...prev, newAcc]);
      return { data: newAcc, error: null };
    }

    try {
      setError(null);
      const { data, error: insertErr } = await supabase
        .from('accounts')
        .insert({
          workspace_id: currentWorkspace.id,
          name,
          type,
          nature,
          currency,
          opening_balance: openingBalance,
          opening_date: openingDate,
          credit_limit: creditLimit || null,
          visibility,
          icon,
          color,
        })
        .select()
        .single();

      if (insertErr) throw insertErr;

      await fetchAccounts();
      return { data, error: null };
    } catch (err) {
      console.error('[AccountContext] Create account error:', err);
      setError(err.message);
      return { data: null, error: err };
    }
  };

  const updateAccount = async (accountId, updates) => {
    if (!user || currentWorkspace?.id === 'guest-space') {
      setAccounts((prev) =>
        prev.map((a) => (a.id === accountId ? { ...a, ...updates } : a))
      );
      return { error: null };
    }

    try {
      const { error: updErr } = await supabase
        .from('accounts')
        .update(updates)
        .eq('id', accountId);

      if (updErr) throw updErr;

      await fetchAccounts();
      return { error: null };
    } catch (err) {
      setError(err.message);
      return { error: err };
    }
  };

  const archiveAccount = async (accountId) => {
    if (!user || currentWorkspace?.id === 'guest-space') {
      setAccounts((prev) => prev.filter((a) => a.id !== accountId));
      return { error: null };
    }

    try {
      const { error: archErr } = await supabase
        .from('accounts')
        .update({ archived_at: new Date().toISOString() })
        .eq('id', accountId);

      if (archErr) throw archErr;

      await fetchAccounts();
      return { error: null };
    } catch (err) {
      setError(err.message);
      return { error: err };
    }
  };

  // Mathematical aggregates
  const totalAssets = useMemo(() => {
    return accounts
      .filter((a) => a.nature === 'asset')
      .reduce((sum, curr) => sum + parseFloat(curr.opening_balance || '0'), 0);
  }, [accounts]);

  const totalLiabilities = useMemo(() => {
    return accounts
      .filter((a) => a.nature === 'liability')
      .reduce((sum, curr) => sum + parseFloat(curr.opening_balance || '0'), 0);
  }, [accounts]);

  const netWorth = totalAssets - totalLiabilities;

  return (
    <AccountContext.Provider
      value={{
        accounts,
        loading,
        error,
        totalAssets,
        totalLiabilities,
        netWorth,
        createAccount,
        updateAccount,
        archiveAccount,
        refreshAccounts: fetchAccounts,
      }}
    >
      {children}
    </AccountContext.Provider>
  );
}

export function useAccounts() {
  const ctx = useContext(AccountContext);
  if (!ctx) {
    throw new Error('useAccounts must be used within an AccountProvider');
  }
  return ctx;
}
