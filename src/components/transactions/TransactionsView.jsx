import { useState, useMemo } from 'react';
import { useTransactions } from '../../context/TransactionContext';
import { useAccounts } from '../../context/AccountContext';
import { useWorkspace } from '../../context/WorkspaceContext';
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
  const [lastDeleted, setLastDeleted] = useState(null);
  const { accounts } = useAccounts();
  const { currentWorkspace } = useWorkspace();

  const baseCurrency = currentWorkspace?.base_currency || 'USD';

  // Filters State
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState('all'); // 'all' | 'expense' | 'income' | 'transfer' | 'refund'
  const [filterAccount, setFilterAccount] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all'); // 'all' | 'cleared' | 'pending' | 'reconciled'
  const [filterOrigin, setFilterOrigin] = useState('all'); // 'all' | 'mine' | 'shared'

  // Selected Transaction for Drawer
  const [selectedTx, setSelectedTx] = useState(null);

  // Filtered transactions
  const filteredTransactions = useMemo(() => {
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

      // Search match
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const payeeMatch = t.payee_name?.toLowerCase().includes(q);
        const notesMatch = t.notes?.toLowerCase().includes(q);
        const linesMatch = t.lines?.some(
          (l) => l.description?.toLowerCase().includes(q) || l.category?.name?.toLowerCase().includes(q)
        );
        if (!payeeMatch && !notesMatch && !linesMatch) return false;
      }

      return true;
    });
  }, [transactions, filterType, filterStatus, filterAccount, searchQuery]);

  const pendingCount = useMemo(() => {
    return transactions.filter((t) => t.status === 'pending').length;
  }, [transactions]);

  const handleDelete = (e, tx) => {
    e.stopPropagation();
    if (window.confirm(`Delete transaction "${tx.payee_name || tx.type}" from ledger?`)) {
      deleteTransaction(tx.id).then((res) => {
        if (!res?.error) {
          setLastDeleted(tx);
          setTimeout(() => setLastDeleted((cur) => (cur?.id === tx.id ? null : cur)), 10000);
        }
      });
    }
  };

  const handleUndoDelete = async () => {
    if (!lastDeleted) return;
    await restoreTransaction(lastDeleted.id, lastDeleted);
    setLastDeleted(null);
  };

  return (
    <div className="transactions-view-container">
      {ledgerError && (
        <div role="alert" className="modal-error-banner" style={{ marginBottom: '1rem' }}>
          {ledgerError}
        </div>
      )}
      {lastDeleted && (
        <div
          role="status"
          style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', marginBottom: '1rem', fontSize: '0.88rem' }}
        >
          <span>Deleted “{lastDeleted.payee_name || lastDeleted.type}”.</span>
          <button type="button" className="btn-secondary" onClick={handleUndoDelete} style={{ padding: '0.3rem 0.7rem' }}>
            Undo
          </button>
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
      <div className="accounts-action-bar" style={{ flexDirection: 'column', alignItems: 'stretch', gap: '1rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
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

          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
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
        <div className="filter-bar" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem' }}>
          <input
            type="text"
            className="input-field filter-input"
            placeholder="Search payee, remarks, or items..."
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
        </div>
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
                        title={tx.is_foreign ? `Sirf ${tx.origin_workspace_name || 'originating'} workspace se delete ho sakti hai` : "Delete record"}
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
