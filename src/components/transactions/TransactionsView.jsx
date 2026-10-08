import { useState, useMemo } from 'react';
import { useTransactions } from '../../context/TransactionContext';
import { useAccounts } from '../../context/AccountContext';
import { useWorkspace } from '../../context/WorkspaceContext';
import MoneyDisplay from '../ui/MoneyDisplay';
import StatCard from '../ui/StatCard';
import TransactionDrawer from './TransactionDrawer';

export default function TransactionsView({
  onOpenCreateTransaction,
  onOpenReconcile,
  onOpenRules,
}) {
  const { transactions, totalIncome, totalExpense, deleteTransaction } = useTransactions();
  const { accounts } = useAccounts();
  const { currentWorkspace } = useWorkspace();

  const baseCurrency = currentWorkspace?.base_currency || 'USD';

  // Filters State
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState('all'); // 'all' | 'expense' | 'income' | 'transfer' | 'refund'
  const [filterAccount, setFilterAccount] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all'); // 'all' | 'cleared' | 'pending' | 'reconciled'

  // Selected Transaction for Drawer
  const [selectedTx, setSelectedTx] = useState(null);

  // Filtered transactions
  const filteredTransactions = useMemo(() => {
    return transactions.filter((t) => {
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
      deleteTransaction(tx.id);
    }
  };

  return (
    <div className="transactions-view-container">
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

          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
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
                        onClick={(e) => handleDelete(e, tx)}
                        title="Delete record"
                      >
                        🗑️
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
      />
    </div>
  );
}
