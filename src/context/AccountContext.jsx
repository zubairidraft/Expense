import { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';
import { useWorkspace } from './WorkspaceContext';
import { dec, sumMoney, toNum, computeAccountBalance } from '../lib/money';
import { todayISO } from '../lib/dates';

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

const getStoredGuestAccounts = () => {
  try {
    const raw = localStorage.getItem('expense_pro_accounts');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch (e) {
    console.warn('[AccountContext] Error reading stored accounts:', e);
  }
  saveGuestAccounts(DEFAULT_GUEST_ACCOUNTS);
  return DEFAULT_GUEST_ACCOUNTS;
};

const saveGuestAccounts = (accList) => {
  try {
    localStorage.setItem('expense_pro_accounts', JSON.stringify(accList));
  } catch (e) {
    console.warn('[AccountContext] Error saving accounts to localStorage:', e);
  }
};

const getStoredGuestShares = () => {
  try {
    const raw = localStorage.getItem('expense_pro_account_shares');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (e) {
    console.warn('[AccountContext] Error reading stored shares:', e);
  }
  return [];
};

const saveGuestShares = (shares) => {
  try {
    localStorage.setItem('expense_pro_account_shares', JSON.stringify(shares));
  } catch (e) {
    console.warn('[AccountContext] Error saving shares:', e);
  }
};

export function AccountProvider({ children }) {
  const { user } = useAuth();
  const { currentWorkspace, workspaces = [] } = useWorkspace();
  const [accounts, setAccounts] = useState(getStoredGuestAccounts);
  const [accountShares, setAccountShares] = useState(getStoredGuestShares);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [guestTxVersion, setGuestTxVersion] = useState(0);

  const isGuestMode = !user || !currentWorkspace?.id || currentWorkspace.id === 'guest-space';

  const fetchAccounts = useCallback(async () => {
    if (!currentWorkspace?.id || !user || currentWorkspace.id === 'guest-space') {
      const allGuestAccs = getStoredGuestAccounts();
      const allShares = getStoredGuestShares();
      setAccountShares(allShares);

      // In guest mode: active accounts for this workspace = owned + shared in
      const currentWsId = currentWorkspace?.id || 'guest-space';
      const activeSharesIn = allShares.filter((s) => s.workspace_id === currentWsId && s.status === 'active');
      const sharedInAccIds = new Set(activeSharesIn.map((s) => s.account_id));

      const scopedAccounts = allGuestAccs
        .filter((a) => a.workspace_id === currentWsId || sharedInAccIds.has(a.id))
        .map((a) => {
          const share = activeSharesIn.find((s) => s.account_id === a.id);
          const isSharedIn = !!share;
          const homeWs = workspaces.find((w) => w.id === a.workspace_id);
          return {
            ...a,
            is_shared: isSharedIn,
            can_post: isSharedIn ? share.can_post : true,
            detail_level: isSharedIn ? share.detail_level : 'full',
            count_in_net_worth: isSharedIn ? share.count_in_net_worth : true,
            home_workspace_name: homeWs?.name || 'Home Workspace',
          };
        });

      setAccounts(scopedAccounts);
      setGuestTxVersion((v) => v + 1);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Fetch unified balances view and shares overview in parallel
      const [{ data: balRows, error: balErr }, { data: shareRows, error: shareErr }] = await Promise.all([
        supabase
          .from('v_account_balances_current')
          .select('*')
          .eq('workspace_id', currentWorkspace.id),
        supabase
          .from('v_account_shares_overview')
          .select('*'),
      ]);

      let balRowsData = balRows;
      if (balErr || !balRowsData) {
        console.warn('[AccountContext] v_account_balances_current unavailable, falling back to base accounts table:', balErr?.message);
        const { data: rawAccs, error: rawErr } = await supabase
          .from('accounts')
          .select('*')
          .eq('workspace_id', currentWorkspace.id)
          .is('archived_at', null)
          .order('name');

        if (rawErr) {
          console.error('[AccountContext] Fallback error fetching accounts:', rawErr);
          throw rawErr;
        }

        balRowsData = (rawAccs || []).map((a) => ({
          account_id: a.id,
          workspace_id: a.workspace_id,
          account_name: a.name,
          account_type: a.type,
          account_nature: a.nature,
          currency: a.currency,
          opening_balance: a.opening_balance,
          icon: a.icon,
          color: a.color,
          visibility: a.visibility,
          archived_at: a.archived_at,
          current_balance: a.opening_balance,
          current_base_balance: a.opening_balance,
          is_shared: false,
          share_relation: 'home',
          can_post: true,
          count_in_net_worth: true,
        }));
      }

      if (shareErr) console.warn('[AccountContext] Share overview error:', shareErr.message);

      setAccountShares(shareRows || []);

      const sharesByAccount = new Map();
      (shareRows || []).forEach((s) => {
        if (!sharesByAccount.has(s.account_id)) sharesByAccount.set(s.account_id, []);
        sharesByAccount.get(s.account_id).push(s);
      });

      const formatted = (balRowsData || []).map((row) => {
        const sharesOut = (sharesByAccount.get(row.account_id) || []).filter((s) => s.status === 'active');
        return {
          id: row.account_id,
          workspace_id: row.workspace_id,
          name: row.account_name,
          type: row.account_type,
          nature: row.account_nature,
          currency: row.currency,
          opening_balance: row.opening_balance,
          icon: row.icon,
          color: row.color,
          visibility: row.visibility,
          archived_at: row.archived_at,
          balance: String(row.current_balance ?? '0'),
          base_balance: row.current_base_balance ? String(row.current_base_balance) : null,
          is_shared: !!row.is_shared,
          share_relation: row.share_relation,
          can_post: row.can_post !== false,
          count_in_net_worth: row.count_in_net_worth === true,
          shares_out: sharesOut,
        };
      });

      setAccounts(formatted);
    } catch (err) {
      console.warn('[AccountContext] Error fetching accounts:', err.message);
      setError(err.message);
      setAccounts([]);
    } finally {
      setLoading(false);
    }
  }, [currentWorkspace?.id, user, workspaces]);

  useEffect(() => {
    fetchAccounts();
  }, [fetchAccounts]);

  const shareAccount = async ({
    accountId,
    targetWorkspaceId,
    canPost = true,
    detailLevel = 'summary',
    countInNetWorth = false,
  }) => {
    if (isGuestMode) {
      const allShares = getStoredGuestShares();
      const existingIdx = allShares.findIndex(
        (s) => s.account_id === accountId && s.workspace_id === targetWorkspaceId
      );
      const newShare = {
        id: `share-${Date.now()}`,
        account_id: accountId,
        workspace_id: targetWorkspaceId,
        can_post: canPost,
        detail_level: detailLevel,
        count_in_net_worth: countInNetWorth,
        status: 'active',
        created_at: new Date().toISOString(),
      };

      let next;
      if (existingIdx >= 0) {
        next = allShares.map((s, idx) => (idx === existingIdx ? { ...s, ...newShare, id: s.id } : s));
      } else {
        next = [...allShares, newShare];
      }
      saveGuestShares(next);
      setAccountShares(next);
      await fetchAccounts();
      return { error: null };
    }

    try {
      const { data, error: rpcErr } = await supabase.rpc('share_account', {
        p_account_id: accountId,
        p_target_workspace_id: targetWorkspaceId,
        p_can_post: canPost,
        p_detail_level: detailLevel,
        p_count_in_net_worth: countInNetWorth,
      });

      if (rpcErr) throw rpcErr;
      await fetchAccounts();
      return { data, error: null };
    } catch (err) {
      console.error('[AccountContext] shareAccount error:', err);
      return { data: null, error: err };
    }
  };

  const revokeAccountShare = async (accountId, targetWorkspaceId) => {
    if (isGuestMode) {
      const allShares = getStoredGuestShares();
      const next = allShares.map((s) =>
        s.account_id === accountId && s.workspace_id === targetWorkspaceId
          ? { ...s, status: 'revoked', can_post: false, revoked_at: new Date().toISOString() }
          : s
      );
      saveGuestShares(next);
      setAccountShares(next);
      await fetchAccounts();
      return { error: null };
    }

    try {
      const { error: rpcErr } = await supabase.rpc('revoke_account_share', {
        p_account_id: accountId,
        p_target_workspace_id: targetWorkspaceId,
      });

      if (rpcErr) throw rpcErr;
      await fetchAccounts();
      return { error: null };
    } catch (err) {
      console.error('[AccountContext] revokeAccountShare error:', err);
      return { error: err };
    }
  };

  const fetchAccountShares = useCallback(async (accountId) => {
    if (isGuestMode) {
      const all = getStoredGuestShares();
      return all.filter((s) => s.account_id === accountId);
    }
    try {
      const { data, error: err } = await supabase
        .from('v_account_shares_overview')
        .select('*')
        .eq('account_id', accountId);
      if (err) throw err;
      return data || [];
    } catch (err) {
      console.warn('[AccountContext] fetchAccountShares error:', err);
      return [];
    }
  }, [isGuestMode]);

  const createAccount = async ({
    name,
    type,
    nature,
    currency = currentWorkspace?.base_currency || 'USD',
    openingBalance = '0.00',
    openingDate = todayISO(),
    creditLimit = null,
    visibility = 'shared',
    icon = '🏦',
    color = '#6366f1',
  }) => {
    if (isGuestMode) {
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
      const all = getStoredGuestAccounts();
      const next = [...all, newAcc];
      saveGuestAccounts(next);
      await fetchAccounts();
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

  const createMultipleAccounts = async (accountList) => {
    if (!accountList || accountList.length === 0) return { data: [], error: null };

    if (isGuestMode) {
      const created = accountList.map((acc, idx) => ({
        id: `acc-${Date.now()}-${idx}`,
        workspace_id: currentWorkspace?.id || 'guest-space',
        name: acc.name,
        type: acc.type || 'bank',
        nature: acc.nature || 'asset',
        currency: acc.currency || currentWorkspace?.base_currency || 'USD',
        opening_balance: acc.openingBalance || '0.00',
        opening_date: acc.openingDate || todayISO(),
        credit_limit: acc.creditLimit || null,
        visibility: 'shared',
        icon: acc.icon || '🏦',
        color: acc.color || '#6366f1',
      }));
      const all = getStoredGuestAccounts();
      const next = [...all, ...created];
      saveGuestAccounts(next);
      await fetchAccounts();
      return { data: created, error: null };
    }

    try {
      setError(null);
      const rows = accountList.map((acc) => ({
        workspace_id: currentWorkspace.id,
        name: acc.name,
        type: acc.type || 'bank',
        nature: acc.nature || 'asset',
        currency: acc.currency || currentWorkspace?.base_currency || 'USD',
        opening_balance: acc.openingBalance || '0.00',
        opening_date: acc.openingDate || todayISO(),
        credit_limit: acc.creditLimit || null,
        visibility: 'shared',
        icon: acc.icon || '🏦',
        color: acc.color || '#6366f1',
      }));

      const { data, error: insertErr } = await supabase
        .from('accounts')
        .insert(rows)
        .select();

      if (insertErr) throw insertErr;

      await fetchAccounts();
      return { data, error: null };
    } catch (err) {
      console.error('[AccountContext] Create multiple accounts error:', err);
      setError(err.message);
      return { data: null, error: err };
    }
  };

  const updateAccount = async (accountId, updates) => {
    if (isGuestMode) {
      const all = getStoredGuestAccounts();
      const next = all.map((a) => (a.id === accountId ? { ...a, ...updates } : a));
      saveGuestAccounts(next);
      await fetchAccounts();
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
    if (isGuestMode) {
      const all = getStoredGuestAccounts();
      const next = all.filter((a) => a.id !== accountId);
      saveGuestAccounts(next);
      await fetchAccounts();
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

  // Guest mode: derive balances from the locally stored ledger (sums all transactions on the account across workspaces)
  const accountsWithBalances = useMemo(() => {
    if (!isGuestMode) return accounts;
    let guestTx = [];
    try {
      const raw = localStorage.getItem('expense_pro_transactions');
      guestTx = raw ? JSON.parse(raw) : [];
    } catch {
      guestTx = [];
    }
    return accounts.map((a) => {
      const bal = computeAccountBalance(a, Array.isArray(guestTx) ? guestTx : []).toFixed(4);
      return { ...a, balance: bal, base_balance: bal };
    });
  }, [accounts, isGuestMode, guestTxVersion]);

  // Aggregates in workspace base currency (decimal-safe)
  const baseValue = (a) => (a.base_balance !== null && a.base_balance !== undefined ? a.base_balance : a.balance);

  // Net worth: only count owned accounts OR shared accounts with count_in_net_worth = true (Decision 2)
  const eligibleForNetWorth = (a) => !a.is_shared || a.count_in_net_worth === true;

  const totalAssets = useMemo(
    () => toNum(sumMoney(accountsWithBalances.filter((a) => a.nature === 'asset' && eligibleForNetWorth(a)).map(baseValue))),
    [accountsWithBalances]
  );

  const totalLiabilities = useMemo(
    () => toNum(sumMoney(accountsWithBalances.filter((a) => a.nature === 'liability' && eligibleForNetWorth(a)).map(baseValue))),
    [accountsWithBalances]
  );

  const netWorth = toNum(dec(totalAssets).minus(dec(totalLiabilities)));

  return (
    <AccountContext.Provider
      value={{
        accounts: accountsWithBalances,
        accountShares,
        loading,
        error,
        totalAssets,
        totalLiabilities,
        netWorth,
        createAccount,
        createMultipleAccounts,
        updateAccount,
        archiveAccount,
        shareAccount,
        revokeAccountShare,
        fetchAccountShares,
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
