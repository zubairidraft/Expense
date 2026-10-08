import { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';
import { useWorkspace } from './WorkspaceContext';
import { useAccounts } from './AccountContext';
import {
  enqueueOfflineTransaction,
  getPendingOfflineTransactions,
  removeOfflineTransaction,
  countOfflineTransactions,
} from '../lib/offlineQueue';

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

export function TransactionProvider({ children }) {
  const { user } = useAuth();
  const { currentWorkspace } = useWorkspace();
  const { refreshAccounts } = useAccounts();

  const [transactions, setTransactions] = useState(DEFAULT_GUEST_TRANSACTIONS);
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
      setTransactions(DEFAULT_GUEST_TRANSACTIONS);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const { data, error: txErr } = await supabase
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

      setTransactions(data || []);
    } catch (err) {
      console.warn('[TransactionContext] Error fetching ledger:', err.message);
      setError(err.message);
      setTransactions(DEFAULT_GUEST_TRANSACTIONS);
    } finally {
      setLoading(false);
    }
  }, [currentWorkspace?.id, user]);

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
          } else {
            console.error('[OfflineQueue] Sync failed for item:', item.idempotencyKey, rpcErr);
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
    date = new Date().toISOString().split('T')[0],
    status = 'cleared',
    merchantId = null,
    payeeName = '',
    notes = '',
    source = 'manual',
    lines = [],
    tagIds = [],
  }) => {
    const idempotencyKey = `idemp-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

    // Optimistic fallback object
    const optimisticTx = {
      id: `tx-${Date.now()}`,
      workspace_id: currentWorkspace?.id || 'guest-space',
      type,
      date,
      status,
      merchant_id: merchantId,
      payee_name: payeeName,
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
        category: l.category || null,
        account: l.account || null,
      })),
      tags: [],
    };

    if (!user || currentWorkspace?.id === 'guest-space') {
      setTransactions((prev) => [optimisticTx, ...prev]);
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
      console.warn('[TransactionContext] Booking failed or offline, queuing into outbox:', err);

      // Queue into IndexedDB as safety net
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


  // Soft delete transaction
  const deleteTransaction = async (transactionId) => {
    if (!user || currentWorkspace?.id === 'guest-space') {
      setTransactions((prev) => prev.filter((t) => t.id !== transactionId));
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

  // Update status (pending, cleared, reconciled)
  const updateStatus = async (transactionId, newStatus) => {
    if (!user || currentWorkspace?.id === 'guest-space') {
      setTransactions((prev) =>
        prev.map((t) => (t.id === transactionId ? { ...t, status: newStatus } : t))
      );
      return { error: null };
    }

    try {
      const { error: updErr } = await supabase
        .from('transactions')
        .update({ status: newStatus })
        .eq('id', transactionId);

      if (updErr) throw updErr;

      await fetchTransactions();
      return { error: null };
    } catch (err) {
      setError(err.message);
      return { error: err };
    }
  };

  // Computed Ledger Aggregates
  const totalIncome = useMemo(() => {
    return transactions
      .filter((t) => t.type === 'income')
      .reduce((sum, t) => {
        const lineSum = (t.lines || []).reduce(
          (lSum, l) => lSum + parseFloat(l.base_amount || l.amount || '0'),
          0
        );
        return sum + lineSum;
      }, 0);
  }, [transactions]);

  const totalExpense = useMemo(() => {
    return transactions
      .filter((t) => t.type === 'expense')
      .reduce((sum, t) => {
        const lineSum = (t.lines || []).reduce(
          (lSum, l) => lSum + parseFloat(l.base_amount || l.amount || '0'),
          0
        );
        return sum + lineSum;
      }, 0);
  }, [transactions]);

  const balance = totalIncome - totalExpense;

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
        updateStatus,
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
