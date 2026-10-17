import { useState, useMemo, useEffect } from 'react';
import { useTransactions } from '../../context/TransactionContext';
import { useAccounts } from '../../context/AccountContext';
import { useWorkspace } from '../../context/WorkspaceContext';
import { useCategories } from '../../context/CategoryContext';
import { useToast } from '../../context/ToastContext';
import MoneyDisplay from '../ui/MoneyDisplay';
import StatCard from '../ui/StatCard';
import TransactionDrawer from './TransactionDrawer';

export default function TransactionsView({
  onOpenCreateTransaction,
  onOpenTransfer,
  onEditTransfer,
  onOpenReconcile,
  onOpenRules,
  onOpenReceiptScanner,
}) {
  const { transactions, totalIncome, totalExpense, deleteTransaction, restoreTransaction, error: ledgerError } = useTransactions();
  const { showToast } = useToast();
  const { accounts } = useAccounts();
  const { categories } = useCategories();
  const { currentWorkspace } = useWorkspace();

  const baseCurrency = currentWorkspace?.base_currency || 'USD';

  // Filters State
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState('all'); // 'all' | 'expense' | 'income' | 'transfer' | 'refund'
  const [filterAccount, setFilterAccount] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all'); // 'all' | 'cleared' | 'pending' | 'reconciled'
  const [filterOrigin, setFilterOrigin] = useState('all'); // 'all' | 'mine' | 'shared'
  const [filterCategory, setFilterCategory] = useState('all');
  const [datePreset, setDatePreset] = useState('all'); // 'all' | '7d' | '30d' | 'this_month' | 'last_month'

  // Saved filters (stored on this device, per workspace)
  const storageKey = `expense_saved_filters_${currentWorkspace?.id || 'default'}`;
  const [savedFilters, setSavedFilters] = useState([]);
  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      setSavedFilters(raw ? JSON.parse(raw) : []);
    } catch {
      setSavedFilters([]);
    }
  }, [storageKey]);
  const persistSaved = (list) => {
    setSavedFilters(list);
    try {
      localStorage.setItem(storageKey, JSON.stringify(list));
    } catch {
      /* storage unavailable */
    }
  };
  const currentFilterState = {
    searchQuery, filterType, filterAccount, filterStatus, filterOrigin, filterCategory, datePreset,
  };
  const hasActiveFilter =
    searchQuery.trim() !== '' || filterType !== 'all' || filterAccount !== 'all' ||
    filterStatus !== 'all' || filterOrigin !== 'all' || filterCategory !== 'all' || datePreset !== 'all';
  const applySaved = (f) => {
    setSearchQuery(f.searchQuery || '');
    setFilterType(f.filterType || 'all');
    setFilterAccount(f.filterAccount || 'all');
    setFilterStatus(f.filterStatus || 'all');
    setFilterOrigin(f.filterOrigin || 'all');
    setFilterCategory(f.filterCategory || 'all');
    setDatePreset(f.datePreset || 'all');
  };
  const clearFilters = () => applySaved({});
  const saveCurrentFilter = () => {
    const name = window.prompt('Enter a name for this filter (e.g. "Dining Out This Month"):');
    if (!name || !name.trim()) return;
    const entry = { id: String(Date.now()), name: name.trim(), ...currentFilterState };
    persistSaved([...savedFilters.filter((f) => f.name !== entry.name), entry]);
  };
  const removeSaved = (id) => persistSaved(savedFilters.filter((f) => f.id !== id));

  // Selected Transaction for Drawer
  const [selectedTx, setSelectedTx] = useState(null);

  const dateRange = useMemo(() => {
    const now = new Date();
    const iso = (d) => {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${y}-${m}-${day}`;
    };
    if (datePreset === '7d') {
      const from = new Date(now); from.setDate(from.getDate() - 6);
      return { from: iso(from), to: iso(now) };
    }
    if (datePreset === '30d') {
      const from = new Date(now); from.setDate(from.getDate() - 29);
      return { from: iso(from), to: iso(now) };
    }
    if (datePreset === 'this_month') {
      return { from: iso(new Date(now.getFullYear(), now.getMonth(), 1)), to: iso(new Date(now.getFullYear(), now.getMonth() + 1, 0)) };
    }
    if (datePreset === 'last_month') {
      return { from: iso(new Date(now.getFullYear(), now.getMonth() - 1, 1)), to: iso(new Date(now.getFullYear(), now.getMonth(), 0)) };
    }
    return null;
  }, [datePreset]);

  // Filtered transactions
  const filteredTransactions = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const qNum = q.replace(/[,\s]/g, '');
    return transactions.filter((t) => {
      // Ownership filter
      if (filterOrigin === 'mine' && t.is_foreign) return false;
      if (filterOrigin === 'shared' && !t.is_foreign) return false;

      // Type match
      if (filterType !== 'all' && t.type !== filterType) return false;

      // Status match
      if (filterStatus !== 'all' && t.status !== filterStatus) return false;

      // Account match
      if (filterAccount !== 'all') {
        const hasAccount = t.lines?.some((l) => l.account_id === filterAccount || l.accountId === filterAccount);
        if (!hasAccount) return false;
      }

      // Category match
      if (filterCategory !== 'all') {
        const hasCat = t.lines?.some((l) => (l.category_id || l.category?.id) === filterCategory);
        if (!hasCat) return false;
      }

      // Date range
      if (dateRange) {
        const d = String(t.date || '').slice(0, 10);
        if (!d || d < dateRange.from || d > dateRange.to) return false;
      }

      // Search match: payee, notes, merchant, tags, category, account, line text, amount, date
      if (q) {
        const has = (v) => typeof v === 'string' && v.toLowerCase().includes(q);
        const amountHit =
          qNum !== '' &&
          /^[0-9.]+$/.test(qNum) &&
          (t.lines || []).some((l) => {
            const a = String(l.amount ?? l.base_amount ?? '').replace(/\.0+$/, '');
            return a === qNum || a.startsWith(qNum);
          });
        const hit =
          has(t.payee_name) ||
          has(t.notes) ||
          has(t.type) ||
          has(String(t.date || '')) ||
          has(t.merchant?.name) ||
          (t.tags || []).some((x) => has(x?.tag?.name)) ||
          (t.lines || []).some(
            (l) => has(l.description) || has(l.category?.name) || has(l.account?.name)
          ) ||
          amountHit;
        if (!hit) return false;
      }

      return true;
    });
  }, [transactions, filterType, filterStatus, filterAccount, filterOrigin, filterCategory, dateRange, searchQuery]);

  const pendingCount = useMemo(() => {
    return transactions.filter((t) => t.status === 'pending').length;
  }, [transactions]);

  const handleDelete = (e, tx) => {
    e.stopPropagation();
    deleteTransaction(tx.id).then((res) => {
      if (!res?.error) {
        showToast({
          message: `“${tx.payee_name || tx.type}” deleted`,
          actionLabel: 'Undo',
          onAction: () => restoreTransaction(tx.id, tx),
          duration: 5000,
        });
      }
    });
  };

  return (
    <div className="transactions-view-container">
      {ledgerError && (
        <div role="alert" className="modal-error-banner" style={{ marginBottom: '1rem' }}>
          {ledgerError}
        </div>
      )}
      {/* Top Stat Summary Banner */}
      <section className="stats-grid" aria-label="Ledger Statistics">
        <StatCard
          title="Total Ledger Records"
          icon="🧾"
          variant="balance"
          value={transactions.length}
          meta={`${filteredTransactions.length} matching current filters`}
        />

        <StatCard
          title="Total Inflow (Income)"
          icon="📈"
          variant="income"
          value={<MoneyDisplay amount={totalIncome} currencyCode={baseCurrency} type="income" showSign />}
          meta="All verified incoming revenues"
        />

        <StatCard
          title="Total Outflow (Expense)"
          icon="📉"
          variant="expense"
          value={<MoneyDisplay amount={totalExpense} currencyCode={baseCurrency} type="expense" showSign />}
          meta="Operational & living outflows"
        />

        <StatCard
          title="Pending Clearance"
          icon="⏳"
          variant="default"
          value={pendingCount}
          meta={pendingCount === 0 ? 'All transactions reconciled' : 'Requires statement verification'}
        />
      </section>

      {/* Action Header & Filtering Toolbar */}
      <div className="accounts-action-bar" style={{ flexDirection: 'column', alignItems: 'stretch', gap: '1rem', width: '100%', maxWidth: '100%' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem', width: '100%', maxWidth: '100%' }}>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center', width: '100%', maxWidth: '100%' }}>
            <div className="accounts-filter-group">
              <button
                className={`acc-filter-btn ${filterOrigin === 'all' ? 'active' : ''}`}
                onClick={() => setFilterOrigin('all')}
              >
                All ({transactions.length})
              </button>
              <button
                className={`acc-filter-btn ${filterOrigin === 'mine' ? 'active' : ''}`}
                onClick={() => setFilterOrigin('mine')}
              >
                This Workspace ({transactions.filter((t) => !t.is_foreign).length})
              </button>
              <button
                className={`acc-filter-btn ${filterOrigin === 'shared' ? 'active' : ''}`}
                onClick={() => setFilterOrigin('shared')}
              >
                Shared Activity ({transactions.filter((t) => t.is_foreign).length})
              </button>
            </div>

            <div className="accounts-filter-group">
              <button
                className={`acc-filter-btn ${filterType === 'all' ? 'active' : ''}`}
                onClick={() => setFilterType('all')}
              >
                All Types
              </button>
              <button
                className={`acc-filter-btn ${filterType === 'expense' ? 'active' : ''}`}
                onClick={() => setFilterType('expense')}
              >
                📉 Expenses
              </button>
              <button
                className={`acc-filter-btn ${filterType === 'income' ? 'active' : ''}`}
                onClick={() => setFilterType('income')}
              >
                📈 Income
              </button>
              <button
                className={`acc-filter-btn ${filterType === 'transfer' ? 'active' : ''}`}
                onClick={() => setFilterType('transfer')}
              >
                🔁 Transfers
              </button>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center', width: '100%', maxWidth: '100%' }}>
            {onOpenReceiptScanner && (
              <button
                type="button"
                onClick={() => onOpenReceiptScanner(null)}
                className="secondary-btn"
                style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.55rem 0.85rem' }}
                title="Scan physical receipt or invoice via OCR"
              >
                <span>📷</span> Scan Receipt
              </button>
            )}

            {onOpenRules && (
              <button
                type="button"
                onClick={onOpenRules}
                className="secondary-btn"
                style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.55rem 0.85rem' }}
                title="Automated pattern-matching rules"
              >
                <span>⚡</span> Rules
              </button>
            )}

            {onOpenReconcile && (
              <button
                type="button"
                onClick={onOpenReconcile}
                className="secondary-btn"
                style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.55rem 0.85rem' }}
                title="Bank statement reconciliation & balance lock"
              >
                <span>🔒</span> Reconcile
              </button>
            )}

            {onOpenTransfer && (
              <button
                type="button"
                onClick={() => onOpenTransfer()}
                className="secondary-btn"
                style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.55rem 0.85rem' }}
                title="Transfer money between accounts"
              >
                <span>⇄</span> Transfer
              </button>
            )}

            <button
              onClick={onOpenCreateTransaction}
              className="submit-btn primary-glow add-acc-btn"
            >
              <span>➕</span> Book Transaction
            </button>
          </div>
        </div>

        {/* Detailed Dropdown Filters & Search */}
        <div className="filter-bar" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '0.75rem', width: '100%', maxWidth: '100%' }}>
          <input
            type="text"
            className="input-field filter-input"
            placeholder="Search: naam, amount, note, merchant, tag, category..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />

          <select
            className="select-field"
            value={filterAccount}
            onChange={(e) => setFilterAccount(e.target.value)}
          >
            <option value="all">All Accounts ({accounts.length})</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name} ({a.currency})
              </option>
            ))}
          </select>

          <select
            className="select-field"
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
          >
            <option value="all">All Statuses</option>
            <option value="cleared">✓ Cleared Only</option>
            <option value="pending">⏳ Pending Only</option>
            <option value="reconciled">🔒 Reconciled Only</option>
          </select>

          <select
            className="select-field"
            value={datePreset}
            onChange={(e) => setDatePreset(e.target.value)}
            aria-label="Date range"
          >
            <option value="all">All Dates</option>
            <option value="7d">Last 7 Days</option>
            <option value="30d">Last 30 Days</option>
            <option value="this_month">This Month</option>
            <option value="last_month">Last Month</option>
          </select>

          <select
            className="select-field"
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            aria-label="Category"
          >
            <option value="all">All Categories</option>
            {(categories || []).map((c) => (
              <option key={c.id} value={c.id}>
                {c.icon ? `${c.icon} ` : ''}{c.name}
              </option>
            ))}
          </select>
        </div>

        {/* Saved filters */}
        {(savedFilters.length > 0 || hasActiveFilter) && (
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
            {savedFilters.map((f) => (
              <span
                key={f.id}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', borderRadius: '9999px', border: '1px solid rgba(148,163,184,0.4)', padding: '0.15rem 0.2rem 0.15rem 0.7rem', fontSize: '0.82rem' }}
              >
                <button
                  type="button"
                  onClick={() => applySaved(f)}
                  style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', padding: 0 }}
                  title="Apply filter"
                >
                  ⭐ {f.name}
                </button>
                <button
                  type="button"
                  onClick={() => removeSaved(f.id)}
                  aria-label={`Remove saved filter ${f.name}`}
                  style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', opacity: 0.6, padding: '0 0.4rem' }}
                >
                  ✕
                </button>
              </span>
            ))}
            {hasActiveFilter && (
              <>
                <button type="button" className="secondary-btn" onClick={saveCurrentFilter} style={{ padding: '0.3rem 0.7rem', fontSize: '0.82rem' }}>
                  💾 Save this filter
                </button>
                <button type="button" className="secondary-btn" onClick={clearFilters} style={{ padding: '0.3rem 0.7rem', fontSize: '0.82rem' }}>
                  ✕ Clear filters
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {/* Ledger Table / List */}
      <section className="panel" aria-label="Transactions Master List">
        <div className="tx-table-container">
          {filteredTransactions.length === 0 ? (
            <div className="empty-state">
              <span style={{ fontSize: '2.5rem' }}>🧾</span>
              <h3>No ledger entries found</h3>
              <p>There are no transactions matching your current search or filter criteria.</p>
              <button
                onClick={onOpenCreateTransaction}
                className="submit-btn primary-glow"
                style={{ marginTop: '1rem', width: 'auto', display: 'inline-flex' }}
              >
                ➕ Record First Transaction
              </button>
            </div>
          ) : (
            <div className="tx-list">
              {filteredTransactions.map((tx) => {
                // Calculate display amount from lines
                const primaryLine = tx.lines?.[0];
                const lineTotal = (tx.lines || []).reduce(
                  (sum, l) => sum + parseFloat(l.base_amount || l.amount || '0'),
                  0
                );

                const isTransfer = tx.type === 'transfer';
                const fromAcc = tx.lines?.find((l) => l.direction === 'out')?.account;
                const toAcc = tx.lines?.find((l) => l.direction === 'in')?.account;

                return (
                  <div
                    key={tx.id}
                    className="tx-item clickable"
                    onClick={() => setSelectedTx(tx)}
                    title="Click to view full double-entry ledger details"
                  >
                    <div className="tx-left">
                      <div className={`tx-category-icon ${tx.type}`}>
                        {isTransfer ? '🔁' : tx.type === 'income' ? '📈' : primaryLine?.category?.icon || '🛒'}
                      </div>
                      <div>
                        <div className="tx-title-row">
                          <span className="tx-title">{tx.payee_name || 'Unlabeled Payee'}</span>
                          {tx.is_foreign && (
                            <span
                              className="share-badge foreign-tx-chip"
                              title={`Recorded in ${tx.origin_workspace_name || 'other workspace'}. Read-only.`}
                              style={{
                                fontSize: '0.72rem',
                                padding: '0.15rem 0.5rem',
                                borderRadius: '9999px',
                                background: 'rgba(245, 158, 11, 0.15)',
                                color: '#d97706',
                                fontWeight: 600,
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '0.25rem',
                              }}
                            >
                              🔒 {tx.origin_workspace_name || 'Doosre workspace'} se
                            </span>
                          )}
                          <span className={`tx-status-pill ${tx.status}`}>
                            {tx.status === 'reconciled' ? '🔒' : tx.status === 'cleared' ? '✓' : '⏳'}
                          </span>
                        </div>

                        <div className="tx-sub">
                          {isTransfer ? (
                            <span>{fromAcc?.name || 'Account'} ➔ {toAcc?.name || 'Account'}</span>
                          ) : (
                            <span>
                              {primaryLine?.category?.name || 'Uncategorized'}
                              {tx.lines?.length > 1 ? ` (+${tx.lines.length - 1} splits)` : ''}
                              {' · '}
                              {primaryLine?.account?.name || 'Account'}
                            </span>
                          )}
                          {' · '}
                          <span>{tx.date}</span>
                        </div>
                      </div>
                    </div>

                    <div className="tx-right">
                      <MoneyDisplay
                        amount={lineTotal}
                        currencyCode={primaryLine?.currency || baseCurrency}
                        type={isTransfer ? 'default' : tx.type === 'income' ? 'income' : 'expense'}
                        showSign={!isTransfer}
                        className="tx-amount"
                      />

                      <button
                        type="button"
                        className="tx-delete-btn"
                        disabled={tx.is_foreign}
                        onClick={(e) => {
                          if (tx.is_foreign) return;
                          handleDelete(e, tx);
                        }}
                        title={tx.is_foreign ? `Can only be deleted from the ${tx.origin_workspace_name || 'originating'} workspace` : "Delete record"}
                        style={tx.is_foreign ? { opacity: 0.35, cursor: 'not-allowed' } : undefined}
                      >
                        {tx.is_foreign ? '🔒' : '🗑️'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* Transaction Detail Drawer */}
      <TransactionDrawer
        transaction={selectedTx}
        isOpen={Boolean(selectedTx)}
        onClose={() => setSelectedTx(null)}
        onOpenAttachReceipt={onOpenReceiptScanner}
        onEditTransfer={onEditTransfer}
      />
    </div>
  );
}
