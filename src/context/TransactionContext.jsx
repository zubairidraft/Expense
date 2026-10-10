import { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';
import { useWorkspace } from './WorkspaceContext';
import { useAccounts } from './AccountContext';
import { useCategories } from './CategoryContext';
import {
  enqueueOfflineTransaction,
  getPendingOfflineTransactions,
  removeOfflineTransaction,
  countOfflineTransactions,
} from '../lib/offlineQueue';
import { sumMoney, toNum, isLiveTransaction } from '../lib/money';
import { todayISO } from '../lib/dates';

// A failure is "offline" only when the network itself failed. Validation / permission
// errors must be shown to the user, never silently queued.
const isNetworkError = (err) => {
  if (typeof navigator !== 'undefined' && !navigator.onLine) return true;
  const msg = `${err?.message || ''} ${err?.details || ''}`;
  return /failed to fetch|networkerror|network request failed|load failed|fetch failed/i.test(msg);
};

const TransactionContext = createContext(null);


const DEFAULT_GUEST_TRANSACTIONS = [
  {
    id: 'tx-1',
    workspace_id: 'guest-space',
    type: 'income',
    date: '2026-10-06',
    status: 'cleared',
    payee_name: 'Client Retainer (Design System)',
    notes: 'Q4 Milestone payment',
    idempotency_key: 'guest-tx-1-idemp-key',
    created_at: '2026-10-06T10:00:00Z',
    lines: [
      {
        id: 'line-1',
        account_id: 'acc-1',
        category_id: 'cat-freelance',
        direction: 'in',
        amount: '3200.00',
        currency: 'USD',
        fx_rate: '1.0000000000',
        base_amount: '3200.00',
        description: 'Design system deliverables',
        category: { id: 'cat-freelance', name: 'Freelance & Consulting', icon: '⚡', color: '#6366f1' },
        account: { id: 'acc-1', name: 'Main Checking Account', type: 'bank', currency: 'USD', nature: 'asset' },
      },
    ],
    tags: [{ tag: { id: 'tag-3', name: 'Project Alpha', color: '#8b5cf6' } }],
  },
  {
    id: 'tx-2',
    workspace_id: 'guest-space',
    type: 'expense',
    date: '2026-10-05',
    status: 'cleared',
    payee_name: 'Amazon Web Services & Supabase',
    notes: 'Cloud hosting & storage fees',
    idempotency_key: 'guest-tx-2-idemp-key',
    created_at: '2026-10-05T12:30:00Z',
    lines: [
      {
        id: 'line-2',
        account_id: 'acc-3',
        category_id: 'cat-software',
        direction: 'out',
        amount: '145.50',
        currency: 'USD',
        fx_rate: '1.0000000000',
        base_amount: '145.50',
        description: 'Compute nodes & db',
        category: { id: 'cat-software', name: 'Software & Cloud Tools', icon: '☁️', color: '#6366f1' },
        account: { id: 'acc-3', name: 'Platinum Travel Card', type: 'card', currency: 'USD', nature: 'liability' },
      },
    ],
    tags: [{ tag: { id: 'tag-1', name: 'Tax Deductible', color: '#10b981' } }],
  },
  {
    id: 'tx-3',
    workspace_id: 'guest-space',
    type: 'expense',
    date: '2026-10-04',
    status: 'cleared',
    payee_name: 'Carrefour Organic Market',
    notes: 'Weekly pantry replenishment',
    idempotency_key: 'guest-tx-3-idemp-key',
    created_at: '2026-10-04T16:15:00Z',
    lines: [
      {
        id: 'line-3',
        account_id: 'acc-1',
        category_id: 'cat-groceries',
        direction: 'out',
        amount: '88.20',
        currency: 'USD',
        fx_rate: '1.0000000000',
        base_amount: '88.20',
        description: 'Vegetables, fruits & coffee',
        category: { id: 'cat-groceries', name: 'Groceries & Supermarket', icon: '🛒', color: '#10b981' },
        account: { id: 'acc-1', name: 'Main Checking Account', type: 'bank', currency: 'USD', nature: 'asset' },
      },
    ],
    tags: [],
  },
  {
    id: 'tx-4',
    workspace_id: 'guest-space',
    type: 'transfer',
    date: '2026-10-03',
    status: 'cleared',
    payee_name: 'Vault Transfer',
    notes: 'ATM Cash Withdrawal',
    idempotency_key: 'guest-tx-4-idemp-key',
    created_at: '2026-10-03T11:00:00Z',
    lines: [
      {
        id: 'line-4a',
        account_id: 'acc-1',
        category_id: null,
        direction: 'out',
        amount: '200.00',
        currency: 'USD',
        fx_rate: '1.0000000000',
        base_amount: '200.00',
        description: 'ATM Withdrawal from Checking',
        account: { id: 'acc-1', name: 'Main Checking Account', type: 'bank', currency: 'USD', nature: 'asset' },
      },
      {
        id: 'line-4b',
        account_id: 'acc-2',
        category_id: null,
        direction: 'in',
        amount: '200.00',
        currency: 'USD',
        fx_rate: '1.0000000000',
        base_amount: '200.00',
        description: 'Deposited into Cash Vault',
        account: { id: 'acc-2', name: 'Physical Cash Vault', type: 'cash', currency: 'USD', nature: 'asset' },
      },
    ],
    tags: [],
  },
  {
    id: 'tx-5',
    workspace_id: 'guest-space',
    type: 'income',
    date: '2026-10-01',
    status: 'reconciled',
    payee_name: 'Vanguard Dividend Payment',
    notes: 'Index fund distributions',
    idempotency_key: 'guest-tx-5-idemp-key',
    created_at: '2026-10-01T09:00:00Z',
    lines: [
      {
        id: 'line-5',
        account_id: 'acc-1',
        category_id: 'cat-investments',
        direction: 'in',
        amount: '450.00',
        currency: 'USD',
        fx_rate: '1.0000000000',
        base_amount: '450.00',
        description: 'Quarterly dividends',
        category: { id: 'cat-investments', name: 'Investments & Dividends', icon: '📈', color: '#3b82f6' },
        account: { id: 'acc-1', name: 'Main Checking Account', type: 'bank', currency: 'USD', nature: 'asset' },
      },
    ],
    tags: [{ tag: { id: 'tag-1', name: 'Tax Deductible', color: '#10b981' } }],
  },
];

const sumByType = (txs, type) =>
  toNum(
    sumMoney(
      txs
        .filter((t) => t.type === type && isLiveTransaction(t) && !t.is_foreign)
        .flatMap((t) => (t.lines || []).map((l) => l.base_amount ?? l.amount ?? '0'))
    )
  );

const getAllRawGuestTransactions = () => {
  try {
    const raw = localStorage.getItem('expense_pro_transactions');
    if (raw !== null) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (e) {
    console.warn('[TransactionContext] Error reading stored transactions:', e);
  }
  saveRawGuestTransactions(DEFAULT_GUEST_TRANSACTIONS);
  return DEFAULT_GUEST_TRANSACTIONS;
};

const saveRawGuestTransactions = (txList) => {
  try {
    localStorage.setItem('expense_pro_transactions', JSON.stringify(txList));
  } catch (e) {
    console.warn('[TransactionContext] Error saving transactions to localStorage:', e);
  }
};

const getStoredGuestTransactions = () => {
  return getAllRawGuestTransactions();
};

const saveGuestTransactions = (txList) => {
  saveRawGuestTransactions(txList);
};

export function TransactionProvider({ children }) {
  const { user } = useAuth();
  const { currentWorkspace, workspaces = [] } = useWorkspace();
  const { refreshAccounts, accounts: allAccounts = [], accountShares = [] } = useAccounts();
  const { categories: allCategories = [] } = useCategories() || {};

  const [transactions, setTransactions] = useState(getStoredGuestTransactions);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Offline & Outbox State
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [pendingOutboxCount, setPendingOutboxCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);

  // Refresh outbox count
  const refreshOutboxCount = useCallback(async () => {
    const cnt = await countOfflineTransactions();
    setPendingOutboxCount(cnt);
  }, []);

  const fetchTransactions = useCallback(async () => {
    if (!currentWorkspace?.id || !user || currentWorkspace.id === 'guest-space') {
      const currentWsId = currentWorkspace?.id || 'guest-space';
      const rawAll = getAllRawGuestTransactions();

      // 1. Transactions directly booked in this workspace
      const localTxs = rawAll
        .filter((t) => (t.workspace_id || 'guest-space') === currentWsId)
        .map((t) => ({ ...t, is_foreign: false, read_only: false }));

      // 2. Discover shared accounts involving this workspace
      const sharesIn = (accountShares || []).filter(
        (s) => s.workspace_id === currentWsId && s.status === 'active'
      );
      const sharedInAccountIds = new Set(sharesIn.map((s) => s.account_id));

      const ownedAccountIds = new Set(
        (allAccounts || []).filter((a) => !a.is_shared).map((a) => a.id)
      );
      const sharesOut = (accountShares || []).filter(
        (s) => ownedAccountIds.has(s.account_id) && s.status === 'active'
      );

      // 3. Find foreign transactions touching these shared accounts
      const foreignTxs = [];
      rawAll.forEach((t) => {
        const txWsId = t.workspace_id || 'guest-space';
        if (txWsId === currentWsId) return;

        const relevantLines = (t.lines || []).filter((l) => {
          const accId = l.account_id || l.accountId;
          return (
            sharedInAccountIds.has(accId) ||
            sharesOut.some((s) => s.account_id === accId && s.workspace_id === txWsId)
          );
        });

        if (relevantLines.length > 0) {
          const originWs = workspaces.find((w) => w.id === txWsId);
          const originWsName = originWs?.name || 'Other Workspace';

          const firstAccId = relevantLines[0].account_id || relevantLines[0].accountId;
          const shareRule =
            sharesIn.find((s) => s.account_id === firstAccId) ||
            sharesOut.find((s) => s.account_id === firstAccId && s.workspace_id === txWsId);
          const detailLevel = shareRule?.detail_level || 'summary';

          const maskedPayee =
            detailLevel === 'full'
              ? (t.payee_name || t.title || 'Activity')
              : `Activity in ${originWsName}`;
          const maskedNotes = detailLevel === 'full' ? t.notes : null;

          foreignTxs.push({
            ...t,
            payee_name: maskedPayee,
            title: maskedPayee,
            notes: maskedNotes,
            is_foreign: true,
            read_only: true,
            origin_workspace_name: originWsName,
          });
        }
      });

      const combined = [...localTxs, ...foreignTxs].sort((a, b) => {
        if (b.date !== a.date) return (b.date || '').localeCompare(a.date || '');
        return (b.created_at || '').localeCompare(a.created_at || '');
      });

      setTransactions(combined);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // 1. Fetch local workspace transactions
      const { data: localData, error: txErr } = await supabase
        .from('transactions')
        .select(`
          *,
          lines:transaction_lines(
            *,
            category:categories(id, name, icon, color, is_essential),
            account:accounts(id, name, type, currency, nature)
          ),
          tags:transaction_tags(tag:tags(id, name, color)),
          merchant:merchants(id, name, logo_url)
        `)
        .eq('workspace_id', currentWorkspace.id)
        .is('deleted_at', null)
        .order('date', { ascending: false })
        .order('created_at', { ascending: false });

      if (txErr) throw txErr;

      const localTxs = (localData || []).map((t) => ({
        ...t,
        is_foreign: false,
        read_only: false,
      }));

      // 2. Fetch foreign activity on shared accounts via RPC
      let foreignTxs = [];
      try {
        const { data: sharedRows, error: sharedErr } = await supabase
          .rpc('get_shared_account_activity', { p_workspace_id: currentWorkspace.id });

        if (sharedErr) {
          console.warn('[TransactionContext] get_shared_account_activity error:', sharedErr.message);
        } else if (Array.isArray(sharedRows) && sharedRows.length > 0) {
          const foreignMap = new Map();
          sharedRows.forEach((row) => {
            if (!foreignMap.has(row.transaction_id)) {
              foreignMap.set(row.transaction_id, {
                id: row.transaction_id,
                workspace_id: row.origin_workspace_id,
                origin_workspace_name: row.origin_workspace_name,
                type: row.type,
                date: row.date,
                status: row.status,
                payee_name: row.payee_name,
                notes: row.notes,
                detail_level: row.detail_level,
                is_foreign: true,
                read_only: true,
                created_at: row.created_at,
                lines: [],
                tags: [],
              });
            }
            foreignMap.get(row.transaction_id).lines.push({
              id: `foreign-line-${row.transaction_id}-${row.account_id}`,
              account_id: row.account_id,
              direction: row.direction,
              amount: String(row.amount),
              currency: row.currency,
              fx_rate: '1.0000000000',
              base_amount: String(row.base_amount || row.amount),
              description: '',
              category: null,
              account: { id: row.account_id, name: row.account_name, currency: row.currency },
            });
          });
          foreignTxs = Array.from(foreignMap.values());
        }
      } catch (rpcEx) {
        console.warn('[TransactionContext] RPC call exception:', rpcEx);
      }

      const allCombined = [...localTxs, ...foreignTxs].sort((a, b) => {
        if (b.date !== a.date) return (b.date || '').localeCompare(a.date || '');
        return (b.created_at || '').localeCompare(a.created_at || '');
      });

      setTransactions(allCombined);
    } catch (err) {
      console.warn('[TransactionContext] Error fetching ledger:', err.message);
      setError(err.message);
      // Never show demo data to a signed-in user
      setTransactions([]);
    } finally {
      setLoading(false);
    }
  }, [currentWorkspace?.id, user, accountShares, allAccounts, workspaces]);

  // Sync IndexedDB outbox to Supabase
  const syncOutbox = useCallback(async () => {
    if (!user || !currentWorkspace?.id || currentWorkspace.id === 'guest-space') return;
    if (isSyncing) return;

    try {
      setIsSyncing(true);
      const pendingItems = await getPendingOfflineTransactions();
      if (!pendingItems || pendingItems.length === 0) {
        setPendingOutboxCount(0);
        return;
      }

      console.log(`[OfflineQueue] Syncing ${pendingItems.length} queued transactions...`);

      for (const item of pendingItems) {
        if (item.workspaceId === currentWorkspace.id) {
          const { error: rpcErr } = await supabase.rpc('book_transaction', {
            p_workspace_id: item.workspaceId,
            p_type: item.type,
            p_date: item.date,
            p_status: item.status || 'cleared',
            p_merchant_id: item.merchantId || null,
            p_payee_name: item.payeeName,
            p_notes: item.notes,
            p_idempotency_key: item.idempotencyKey,
            p_source: item.source || 'manual',
            p_lines: item.lines,
            p_tag_ids: item.tagIds || [],
          });

          if (!rpcErr) {
            await removeOfflineTransaction(item.idempotencyKey);
          } else if (isNetworkError(rpcErr)) {
            console.warn('[OfflineQueue] Still offline, will retry:', item.idempotencyKey);
            break;
          } else {
            // Permanent failure (validation / permission): drop it and tell the user
            console.error('[OfflineQueue] Queued item rejected by server:', item.idempotencyKey, rpcErr);
            await removeOfflineTransaction(item.idempotencyKey);
            setError(`A queued entry "${item.payeeName || item.type}" was rejected: ${rpcErr.message}`);
          }
        }
      }

      await refreshOutboxCount();
      await fetchTransactions();
      if (refreshAccounts) refreshAccounts();
    } catch (syncErr) {
      console.warn('[OfflineQueue] Sync exception:', syncErr);
    } finally {
      setIsSyncing(false);
    }
  }, [currentWorkspace?.id, user, isSyncing, refreshOutboxCount, fetchTransactions, refreshAccounts]);

  // Online / Offline Listeners
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      syncOutbox();
    };

    const handleOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Initial check
    refreshOutboxCount().then(() => {
      if (navigator.onLine) {
        syncOutbox();
      }
    });

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [syncOutbox, refreshOutboxCount]);

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  // Book a new transaction (Single line, split, or transfer)
  const addTransaction = async ({
    type,
    date = todayISO(),
    status = 'cleared',
    merchantId = null,
    payeeName = '',
    title = '',
    notes = '',
    source = 'manual',
    lines = [],
    tagIds = [],
    idempotencyKey: providedKey = null,
  }) => {
    const idempotencyKey =
      providedKey ||
      (typeof crypto !== 'undefined' && crypto.randomUUID
        ? `idemp-${crypto.randomUUID()}`
        : `idemp-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`);
    payeeName = (payeeName || title || '').trim();

    if (!Array.isArray(lines) || lines.length === 0) {
      return { data: null, error: new Error('A transaction needs at least one line') };
    }
    if (lines.some((l) => !l.accountId)) {
      return { data: null, error: new Error('Please select an account') };
    }

    // Guard: Prevent posting to shared accounts with read-only access (can_post = false)
    for (const l of lines) {
      const targetAcc = allAccounts.find((a) => a.id === l.accountId);
      if (targetAcc && targetAcc.is_shared && targetAcc.can_post === false) {
        return {
          data: null,
          error: new Error(`Account "${targetAcc.name}" is shared as read-only. You cannot post transactions to it.`),
        };
      }
    }

    const computedAmount = toNum(sumMoney(lines.map((l) => l.amount)));

    // Optimistic fallback object
    const optimisticTx = {
      id: `tx-${Date.now()}`,
      workspace_id: currentWorkspace?.id || 'guest-space',
      type,
      date,
      status,
      merchant_id: merchantId,
      payee_name: payeeName,
      title: payeeName,
      amount: computedAmount,
      notes,
      idempotency_key: idempotencyKey,
      is_offline_pending: !isOnline,
      created_at: new Date().toISOString(),
      lines: lines.map((l, idx) => ({
        id: `line-${Date.now()}-${idx}`,
        account_id: l.accountId,
        category_id: l.categoryId || null,
        direction: l.direction,
        amount: String(l.amount),
        currency: l.currency,
        fx_rate: l.fxRate || '1.0000000000',
        base_amount: String(l.baseAmount || l.amount),
        description: l.description || '',
        category: l.category || allCategories.find((c) => c.id === l.categoryId) || null,
        account: l.account || allAccounts.find((a) => a.id === l.accountId) || null,
      })),
      tags: [],
    };

    if (!user || currentWorkspace?.id === 'guest-space') {
      const rawAll = getAllRawGuestTransactions();
      const updated = [optimisticTx, ...rawAll.filter((t) => t.id !== optimisticTx.id)];
      saveRawGuestTransactions(updated);
      await fetchTransactions();
      if (refreshAccounts) refreshAccounts();
      return { data: optimisticTx, error: null };
    }

    // If currently offline, queue into IndexedDB immediately!
    if (!navigator.onLine) {
      await enqueueOfflineTransaction({
        workspaceId: currentWorkspace.id,
        type,
        date,
        status,
        merchantId,
        payeeName,
        notes,
        idempotencyKey,
        source,
        lines,
        tagIds,
      });

      await refreshOutboxCount();
      setTransactions((prev) => [optimisticTx, ...prev]);
      return { data: optimisticTx, error: null, queuedOffline: true };
    }

    try {
      setError(null);

      // Call the atomic book_transaction stored procedure
      const { data: txId, error: rpcErr } = await supabase.rpc('book_transaction', {
        p_workspace_id: currentWorkspace.id,
        p_type: type,
        p_date: date,
        p_status: status,
        p_merchant_id: merchantId || null,
        p_payee_name: payeeName,
        p_notes: notes,
        p_idempotency_key: idempotencyKey,
        p_source: source,
        p_lines: lines,
        p_tag_ids: tagIds || [],
      });

      if (rpcErr) throw rpcErr;

      // Re-fetch transactions and trigger account balance updates
      await fetchTransactions();
      if (refreshAccounts) {
        refreshAccounts();
      }

      return { data: txId, error: null };
    } catch (err) {
      if (!isNetworkError(err)) {
        // Server rejected the entry (validation / permissions). Surface it; do NOT queue.
        console.warn('[TransactionContext] Booking rejected:', err);
        setError(err.message);
        return { data: null, error: err };
      }

      console.warn('[TransactionContext] Network failure, queuing into outbox:', err);

      // Queue into IndexedDB only for genuine connectivity failures
      await enqueueOfflineTransaction({
        workspaceId: currentWorkspace.id,
        type,
        date,
        status,
        merchantId,
        payeeName,
        notes,
        idempotencyKey,
        source,
        lines,
        tagIds,
      });

      await refreshOutboxCount();
      setTransactions((prev) => [optimisticTx, ...prev]);
      return { data: optimisticTx, error: null, queuedOffline: true };
    }
  };


  // Soft delete transaction (undo available via restoreTransaction)
  const deleteTransaction = async (transactionId) => {
    const target = transactions.find((t) => t.id === transactionId);
    if (target?.is_foreign) {
      const err = new Error(
        `Cannot delete transaction from ${target.origin_workspace_name || 'another workspace'}. It can only be deleted in its originating workspace.`
      );
      setError(err.message);
      return { error: err };
    }

    if (!user || currentWorkspace?.id === 'guest-space') {
      const rawAll = getAllRawGuestTransactions();
      const updated = rawAll.filter((t) => t.id !== transactionId);
      saveRawGuestTransactions(updated);
      await fetchTransactions();
      if (refreshAccounts) refreshAccounts();
      return { error: null };
    }

    try {
      const { error: delErr } = await supabase
        .from('transactions')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', transactionId);

      if (delErr) throw delErr;

      await fetchTransactions();
      if (refreshAccounts) {
        refreshAccounts();
      }

      return { error: null };
    } catch (err) {
      setError(err.message);
      return { error: err };
    }
  };

  // Undo a soft delete
  const restoreTransaction = async (transactionId, txSnapshot = null) => {
    if (!user || currentWorkspace?.id === 'guest-space') {
      if (txSnapshot) {
        const rawAll = getAllRawGuestTransactions();
        if (!rawAll.some((t) => t.id === transactionId)) {
          saveRawGuestTransactions([txSnapshot, ...rawAll]);
          await fetchTransactions();
          if (refreshAccounts) refreshAccounts();
        }
      }
      return { error: null };
    }
    try {
      const { error: resErr } = await supabase
        .from('transactions')
        .update({ deleted_at: null })
        .eq('id', transactionId);
      if (resErr) throw resErr;
      await fetchTransactions();
      if (refreshAccounts) refreshAccounts();
      return { error: null };
    } catch (err) {
      setError(err.message);
      return { error: err };
    }
  };

  // Edit an existing transfer transaction (soft-deletes old and books new)
  const editTransferTransaction = async (oldTransactionId, newTransferData) => {
    const delRes = await deleteTransaction(oldTransactionId);
    if (delRes?.error) return { data: null, error: delRes.error };
    const addRes = await addTransaction(newTransferData);
    return addRes;
  };

  // Update status (pending, cleared, reconciled)
  const updateStatus = async (transactionId, newStatus) => {
    const target = transactions.find((t) => t.id === transactionId);
    if (target?.is_foreign) {
      const err = new Error('Cannot update status of a transaction from another workspace.');
      setError(err.message);
      return { error: err };
    }

    if (!user || currentWorkspace?.id === 'guest-space') {
      const rawAll = getAllRawGuestTransactions();
      const updated = rawAll.map((t) => (t.id === transactionId ? { ...t, status: newStatus } : t));
      saveRawGuestTransactions(updated);
      await fetchTransactions();
      if (refreshAccounts) refreshAccounts();
      return { error: null };
    }

    try {
      const { error: updErr } = await supabase
        .from('transactions')
        .update({ status: newStatus })
        .eq('id', transactionId);

      if (updErr) throw updErr;

      await fetchTransactions();
      if (refreshAccounts) refreshAccounts();
      return { error: null };
    } catch (err) {
      setError(err.message);
      return { error: err };
    }
  };

  // Computed Ledger Aggregates (decimal-safe, base currency, excludes deleted/pending)
  const totalIncome = useMemo(() => sumByType(transactions, 'income'), [transactions]);
  const totalExpense = useMemo(() => sumByType(transactions, 'expense'), [transactions]);
  const balance = toNum(sumMoney([totalIncome, -totalExpense]));

  const savingsRate = useMemo(() => {
    return totalIncome > 0
      ? Math.round(((totalIncome - totalExpense) / totalIncome) * 100)
      : 0;
  }, [totalIncome, totalExpense]);

  return (
    <TransactionContext.Provider
      value={{
        transactions,
        loading,
        error,
        totalIncome,
        totalExpense,
        balance,
        savingsRate,
        isOnline,
        pendingOutboxCount,
        isSyncing,
        syncOutbox,
        addTransaction,
        deleteTransaction,
        editTransferTransaction,
        updateStatus,
        restoreTransaction,
        refreshTransactions: fetchTransactions,
      }}
    >
      {children}
    </TransactionContext.Provider>

  );
}

export function useTransactions() {
  const ctx = useContext(TransactionContext);
  if (!ctx) {
    throw new Error('useTransactions must be used within a TransactionProvider');
  }
  return ctx;
}
