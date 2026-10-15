import { useState, useMemo, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useWorkspace } from '../../context/WorkspaceContext';
import { useAccounts } from '../../context/AccountContext';
import { useTransactions } from '../../context/TransactionContext';
import { useRecurring } from '../../context/RecurringContext';
import { useBudgets } from '../../context/BudgetContext';
import { useSharedDebts } from '../../context/SharedDebtsContext';
import { useAnalytics } from '../../context/AnalyticsContext';
import { CURRENCY_REGISTRY } from '../../lib/formatters';
import MoneyDisplay from '../ui/MoneyDisplay';
import MoneyInput from '../ui/MoneyInput';
import StatCard from '../ui/StatCard';
import CustomizeWidgetsModal from './CustomizeWidgetsModal';
import WidgetGrid from './WidgetGrid';
import Icon from '../ui/Icon';
import { CashFlowBarChart } from '../analytics/SmartCharts';
import { todayISO } from '../../lib/dates';
import { useCategories } from '../../context/CategoryContext';
import { isLiveTransaction } from '../../lib/money';
import MonthlySummaryCard from './MonthlySummaryCard';

export const DEFAULT_WIDGETS = [
  { id: 'stats', label: 'Key Financial Metrics', icon: 'monitoring', enabled: true, w: 12, h: 2, description: 'Net Worth, Inflow, Outflow, and Savings rate' },
  { id: 'cash_flow_mini', label: 'Cash Flow Trends Chart', icon: 'insights', enabled: true, w: 8, h: 5, description: 'Visual monthly comparison of income vs expenses' },
  { id: 'quick_add', label: 'Quick Transaction Entry', icon: 'bolt', enabled: true, w: 4, h: 7, description: 'Quickly record expenses and revenues' },
  { id: 'recent_activity', label: 'Recent Ledger Activity', icon: 'receipt_long', enabled: true, w: 8, h: 7, description: 'Searchable feed of recent transactions' },
  { id: 'category_distribution', label: 'Expense Distribution', icon: 'pie_chart', enabled: true, w: 4, h: 5, description: 'Category breakdown and spending shares', empty: 'No expenses yet — add one to see the breakdown' },
  { id: 'upcoming_bills', label: 'Upcoming Bills & Subscriptions', icon: 'event_repeat', enabled: true, w: 4, h: 5, description: 'Urgent recurring bills needing settlement' },
  { id: 'debts_summary', label: 'Loans & Payables Snapshot', icon: 'handshake', enabled: true, w: 4, h: 3, description: 'Receivables from peers and outstanding obligations' },
  { id: 'budget_progress', label: 'Monthly Budget Health', icon: 'savings', enabled: true, w: 4, h: 5, description: 'Envelope spending caps and progress indicators', empty: 'No budgets yet — create one under Budgets & Goals' },
];

const WIDGET_META = Object.fromEntries(DEFAULT_WIDGETS.map((w) => [w.id, w]));
const LAYOUT_KEY = 'expense_pro_dashboard_layout_v2';

// Merge a stored layout with the available widgets
function normalizeLayout(stored, allAvailable = DEFAULT_WIDGETS, meta = WIDGET_META) {
  const base = Array.isArray(stored) ? stored : [];
  const known = base
    .filter((w) => meta[w.id] || (w.id && w.id.startsWith('account_bal_')))
    .map((w) => {
      const def = meta[w.id] || { w: 4, h: 3 };
      return {
        id: w.id,
        enabled: w.enabled !== false,
        w: Number(w.w) || def.w || 4,
        h: Number(w.h) || def.h || 3,
      };
    });
  const missing = allAvailable
    .filter((d) => !known.some((k) => k.id === d.id))
    .map(({ id, enabled, w, h }) => ({ id, enabled, w, h }));
  return [...known, ...missing];
}

function loadLayout(scope, allAvailable = DEFAULT_WIDGETS, meta = WIDGET_META) {
  try {
    const raw = localStorage.getItem(`${LAYOUT_KEY}_${scope}`);
    if (raw) return normalizeLayout(JSON.parse(raw), allAvailable, meta);
    const legacy = localStorage.getItem('expense_pro_dashboard_widgets');
    if (legacy) return normalizeLayout(JSON.parse(legacy), allAvailable, meta);
  } catch {
    /* ignore */
  }
  return normalizeLayout([], allAvailable, meta);
}

export default function DashboardView({ onNavigateTab, onOpenOnboarding, onOpenTransfer }) {
  const { profile, user } = useAuth();
  const { currentWorkspace } = useWorkspace();
  const { accounts, netWorth } = useAccounts();
  const { transactions, addTransaction, deleteTransaction, totalIncome, totalExpense, savingsRate } = useTransactions();
  const { expenseCategories = [], incomeCategories = [], categories: allCategories = [] } = useCategories() || {};
  const realCategories = { expense: expenseCategories, income: incomeCategories };
  const { recurringProfiles = [] } = useRecurring() || {};
  const { budgets = [] } = useBudgets() || {};
  const { debts = [] } = useSharedDebts() || {};
  const { cashFlowHistory = [] } = useAnalytics() || {};

  const currencyCode = currentWorkspace?.base_currency || profile?.defaultCurrency || 'USD';
  const numberFormat = profile?.numberFormat || 'intl';
  const currencyInfo = CURRENCY_REGISTRY[currencyCode] || { symbol: '$' };

  // Dynamic widgets for individual accounts
  const accountWidgets = useMemo(() => {
    return (accounts || []).map((acc) => ({
      id: `account_bal_${acc.id}`,
      accountId: acc.id,
      label: `${acc.name} Balance`,
      icon: 'account_balance_wallet',
      enabled: false,
      w: 4,
      h: 3,
      description: `Live balance monitor for ${acc.name} (${acc.currency || currencyCode})`,
      isAccountWidget: true,
      account: acc,
    }));
  }, [accounts, currencyCode]);

  const allAvailableWidgets = useMemo(() => {
    return [...DEFAULT_WIDGETS, ...accountWidgets];
  }, [accountWidgets]);

  const allWidgetMeta = useMemo(() => {
    return Object.fromEntries(allAvailableWidgets.map((w) => [w.id, w]));
  }, [allAvailableWidgets]);

  // Dashboard layout (order, visibility, width & height) per user, per device
  const layoutScope = user?.id || 'guest';
  const [layout, setLayout] = useState(() => loadLayout(layoutScope, allAvailableWidgets, allWidgetMeta));
  const [editingLayout, setEditingLayout] = useState(false);
  const [customizeModalOpen, setCustomizeModalOpen] = useState(false);

  useEffect(() => {
    setLayout((prev) => normalizeLayout(prev, allAvailableWidgets, allWidgetMeta));
  }, [allAvailableWidgets, allWidgetMeta]);

  useEffect(() => {
    setLayout(loadLayout(layoutScope, allAvailableWidgets, allWidgetMeta));
  }, [layoutScope]);

  const saveLayout = (next) => {
    setLayout(next);
    try {
      localStorage.setItem(`${LAYOUT_KEY}_${layoutScope}`, JSON.stringify(next));
    } catch {
      /* ignore */
    }
  };

  const widgets = layout.map((l) => ({ ...allWidgetMeta[l.id], ...l }));

  const handleToggleWidget = (widgetId) => {
    saveLayout(layout.map((w) => (w.id === widgetId ? { ...w, enabled: !w.enabled } : w)));
  };

  const handleResetWidgets = () => {
    saveLayout(normalizeLayout([], allAvailableWidgets, allWidgetMeta));
  };

  // Quick Add Form State
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [type, setType] = useState('expense');
  const [category, setCategory] = useState(''); // category id
  const [transferToAccountId, setTransferToAccountId] = useState('');
  const [quickAddError, setQuickAddError] = useState('');
  const [selectedAccountId, setSelectedAccountId] = useState(accounts[0]?.id || '');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState('all');

  useEffect(() => {
    if (accounts.length > 0 && !selectedAccountId) {
      setSelectedAccountId(accounts[0].id);
    }
  }, [accounts, selectedAccountId]);

  // Category Breakdown (every expense line, base currency, live transactions only)
  const categoryBreakdown = useMemo(() => {
    const totals = {};
    let totalExp = 0;
    transactions
      .filter((t) => t.type === 'expense' && isLiveTransaction(t))
      .forEach((tx) => {
        (tx.lines || []).forEach((l) => {
          if (l.direction !== 'out') return;
          const cat = l.category?.name || tx.category || 'Uncategorized';
          const amt = parseFloat(l.base_amount ?? l.amount ?? 0);
          totals[cat] = (totals[cat] || 0) + amt;
          totalExp += amt;
        });
      });

    return Object.entries(totals)
      .map(([name, amt]) => ({
        name,
        amount: amt,
        percent: totalExp > 0 ? Math.round((amt / totalExp) * 100) : 0,
      }))
      .sort((a, b) => b.amount - a.amount);
  }, [transactions]);

  // Filtered Activity
  const filteredTransactions = useMemo(() => {
    return transactions.filter((tx) => {
      const displayTitle = tx.title || tx.payee_name || '';
      const displayCat = tx.category || tx.lines?.[0]?.category?.name || 'General';
      const matchesSearch = displayTitle.toLowerCase().includes(searchQuery.toLowerCase()) ||
        displayCat.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCat = filterCategory === 'all' || displayCat === filterCategory;
      return matchesSearch && matchesCat;
    });
  }, [transactions, searchQuery, filterCategory]);

  const handleAddTransaction = async (e) => {
    e.preventDefault();
    setQuickAddError('');
    if (!title.trim() || !amount || parseFloat(amount) <= 0) return;

    const acc = accounts.find((a) => a.id === (selectedAccountId || accounts[0]?.id));
    if (!acc) {
      setQuickAddError('Please add an account first.');
      return;
    }

    if (acc.is_shared && acc.can_post === false) {
      setQuickAddError(`Account "${acc.name}" is shared as read-only.`);
      return;
    }

    if (type === 'transfer') {
      const destAccId = transferToAccountId || accounts.find((a) => a.id !== acc.id)?.id;
      const destAcc = accounts.find((a) => a.id === destAccId);

      if (!destAcc || destAcc.id === acc.id) {
        setQuickAddError('Please select two distinct accounts for the transfer.');
        return;
      }

      const res = await addTransaction({
        type: 'transfer',
        payeeName: title.trim() || `${acc.name} ➔ ${destAcc.name}`,
        date: todayISO(),
        lines: [
          {
            accountId: acc.id,
            direction: 'out',
            amount: String(amount),
            currency: acc.currency || currencyCode,
            description: `Transfer to ${destAcc.name}`,
          },
          {
            accountId: destAcc.id,
            direction: 'in',
            amount: String(amount),
            currency: destAcc.currency || currencyCode,
            description: `Transfer from ${acc.name}`,
          },
        ],
      });

      if (res?.error) {
        setQuickAddError(res.error.message || 'Could not save the transfer.');
        return;
      }

      setTitle('');
      setAmount('');
      return;
    }

    const catId = category || realCategories[type]?.[0]?.id || null;

    const res = await addTransaction({
      type,
      payeeName: title.trim(),
      date: todayISO(),
      lines: [
        {
          accountId: acc.id,
          categoryId: catId,
          direction: type === 'income' ? 'in' : 'out',
          amount: String(amount),
          currency: acc.currency || currencyCode,
          description: title.trim(),
        },
      ],
    });

    if (res?.error) {
      setQuickAddError(res.error.message || 'Could not save the transaction.');
      return;
    }

    setTitle('');
    setAmount('');
  };

  // Widget renderers (content only; size & position are handled by WidgetGrid)
  const widgetRenderers = {
    stats: () => (
      (
        <section className="stats-grid" aria-label="Key Performance Indicators">
          <StatCard
            title="Net Worth / Balance"
            icon="💎"
            variant="balance"
            value={
              <MoneyDisplay
                amount={netWorth}
                currencyCode={currencyCode}
                numberFormat={numberFormat}
              />
            }
            meta={`Workspace: ${currentWorkspace?.name || 'Personal'} (${currencyCode})`}
          />

          <StatCard
            title="Total Inflows"
            icon="📈"
            variant="income"
            value={
              <MoneyDisplay
                amount={totalIncome}
                currencyCode={currencyCode}
                numberFormat={numberFormat}
                type="income"
                showSign
              />
            }
            meta={`${transactions.filter((t) => t.type === 'income').length} income records`}
          />

          <StatCard
            title="Total Outflows"
            icon="📉"
            variant="expense"
            value={
              <MoneyDisplay
                amount={totalExpense}
                currencyCode={currencyCode}
                numberFormat={numberFormat}
                type="expense"
                showSign
              />
            }
            meta={`${transactions.filter((t) => t.type === 'expense').length} expense records`}
          />

          <StatCard
            title="Savings Rate"
            icon="🎯"
            variant="default"
            value={`${savingsRate}%`}
            meta={savingsRate >= 20 ? 'Optimal savings buffer' : 'Consider reviewing budget'}
          />
        </section>
      )
    ),
    cash_flow_mini: () => (
      (
        <section className="panel glass-card" style={{ padding: '1.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
            <div>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 600, margin: 0, color: 'var(--text-primary)' }}>
                📈 Cash Flow Inflows vs Outflows
              </h3>
              <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                Monthly trajectory and performance curve
              </span>
            </div>
            {onNavigateTab && (
              <button
                type="button"
                className="btn-text"
                onClick={() => onNavigateTab('analytics')}
                style={{ fontSize: '0.82rem', color: 'var(--md-primary)' }}
              >
                View Full Analytics →
              </button>
            )}
          </div>
          <CashFlowBarChart data={cashFlowHistory} currency={currencyCode} />
        </section>
      )
    ),
    quick_add: () => (
      (
            <section className="panel" aria-label="Add New Transaction">
              <h2 className="panel-title">
                <span>⚡</span> Quick Add Transaction
              </h2>

              <form onSubmit={handleAddTransaction}>
                <div className="type-selector">
                  <button
                    type="button"
                    className={`type-btn expense ${type === 'expense' ? 'active' : ''}`}
                    onClick={() => {
                      setType('expense');
                      setCategory('');
                    }}
                  >
                    📉 Expense
                  </button>
                  <button
                    type="button"
                    className={`type-btn income ${type === 'income' ? 'active' : ''}`}
                    onClick={() => {
                      setType('income');
                      setCategory('');
                    }}
                  >
                    📈 Income
                  </button>
                  <button
                    type="button"
                    className={`type-btn transfer ${type === 'transfer' ? 'active' : ''}`}
                    onClick={() => {
                      setType('transfer');
                      setCategory('');
                    }}
                  >
                    ⇄ Transfer
                  </button>
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="dash-tx-title">
                    {type === 'transfer' ? 'Transfer Note / Description' : 'Title / Merchant'}
                  </label>
                  <input
                    id="dash-tx-title"
                    className="input-field"
                    placeholder={type === 'transfer' ? 'e.g. ATM withdrawal, savings deposit' : 'e.g. AWS Hosting, Groceries, Client Retainer'}
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group">
                  <MoneyInput
                    id="dash-tx-amount"
                    label={`Amount (${currencyInfo.symbol})`}
                    value={amount}
                    onChange={setAmount}
                    currencyCode={currencyCode}
                    placeholder="0.00"
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="dash-tx-account">
                    {type === 'transfer' ? 'Source Account (From)' : 'Account / Vault'}
                  </label>
                  <select
                    id="dash-tx-account"
                    className="select-field"
                    value={selectedAccountId || accounts[0]?.id || ''}
                    onChange={(e) => setSelectedAccountId(e.target.value)}
                    required
                  >
                    {accounts.map((acc) => (
                      <option key={acc.id} value={acc.id}>
                        {acc.icon || '💳'} {acc.name} ({acc.currency || currencyCode})
                      </option>
                    ))}
                  </select>
                </div>

                {type === 'transfer' ? (
                  <div className="form-group">
                    <label className="form-label" htmlFor="dash-tx-dest-account">
                      Destination Account (To)
                    </label>
                    <select
                      id="dash-tx-dest-account"
                      className="select-field"
                      value={transferToAccountId || accounts.find((a) => a.id !== (selectedAccountId || accounts[0]?.id))?.id || accounts[1]?.id || ''}
                      onChange={(e) => setTransferToAccountId(e.target.value)}
                      required
                    >
                      {accounts
                        .filter((a) => a.id !== (selectedAccountId || accounts[0]?.id))
                        .map((acc) => (
                          <option key={acc.id} value={acc.id}>
                            {acc.icon || '💳'} {acc.name} ({acc.currency || currencyCode})
                          </option>
                        ))}
                    </select>
                  </div>
                ) : (
                  <div className="form-group">
                    <label className="form-label" htmlFor="dash-tx-category">
                      Category
                    </label>
                    <select
                      id="dash-tx-category"
                      className="select-field"
                      value={category || realCategories[type]?.[0]?.id || ''}
                      onChange={(e) => setCategory(e.target.value)}
                    >
                      {(realCategories[type] || []).map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.icon} {c.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {quickAddError && (
                  <div role="alert" style={{ color: 'var(--md-error)', fontSize: '0.82rem', marginBottom: '0.5rem' }}>
                    {quickAddError}
                  </div>
                )}

                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  <button type="submit" className="submit-btn primary-glow" style={{ flex: 1 }}>
                    {type === 'transfer' ? '⇄ Book Transfer' : `Add ${type === 'expense' ? 'Expense' : 'Income'}`}
                  </button>

                  {type === 'transfer' && onOpenTransfer && (
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={() => onOpenTransfer({ fromAccountId: selectedAccountId, toAccountId: transferToAccountId })}
                      title="Open full transfer dialog with fees and multi-currency rates"
                      style={{ padding: '0.65rem 0.85rem' }}
                    >
                      ↗️
                    </button>
                  )}
                </div>
              </form>
            </section>
          )
    ),
    category_distribution: () => (
      categoryBreakdown.length > 0 && (
            <section className="panel" aria-label="Expense Breakdown">
              <h2 className="panel-title">
                <span>🍩</span> Category Spending Distribution
              </h2>
              <div className="category-bars">
                {categoryBreakdown.slice(0, 5).map((item) => (
                  <div key={item.name} className="cat-bar-item">
                    <div className="cat-bar-header">
                      <span>{item.name}</span>
                      <span>
                        <MoneyDisplay
                          amount={item.amount}
                          currencyCode={currencyCode}
                          numberFormat={numberFormat}
                        />{' '}
                        ({item.percent}%)
                      </span>
                    </div>
                    <div className="cat-bar-track">
                      <div
                        className="cat-bar-fill"
                        style={{
                          width: `${item.percent}%`,
                          background: 'var(--accent-gradient, var(--md-primary))',
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )
    ),
    debts_summary: () => (
      (
            <section className="panel glass-card" style={{ padding: '1.25rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                <h3 style={{ fontSize: '1.05rem', fontWeight: 600, margin: 0, color: 'var(--text-primary)' }}>
                  🤝 Loans & Payables Snapshot
                </h3>
                {onNavigateTab && (
                  <button
                    type="button"
                    className="btn-text"
                    onClick={() => onNavigateTab('shared')}
                    style={{ fontSize: '0.8rem', color: 'var(--md-primary)' }}
                  >
                    Manage →
                  </button>
                )}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div style={{ padding: '0.75rem', borderRadius: '8px', background: 'rgba(var(--md-success-rgb), 0.08)', border: '1px solid rgba(var(--md-success-rgb), 0.2)' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--md-success)', fontWeight: 600 }}>Owed To You</div>
                  <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--md-success)', marginTop: '0.2rem' }}>
                    ${debts.filter((d) => d.direction === 'lent' && d.status !== 'settled').reduce((sum, d) => sum + parseFloat(d.remaining_amount || 0), 0).toFixed(2)}
                  </div>
                </div>
                <div style={{ padding: '0.75rem', borderRadius: '8px', background: 'rgba(var(--md-error-rgb), 0.08)', border: '1px solid rgba(var(--md-error-rgb), 0.2)' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--md-error)', fontWeight: 600 }}>You Owe</div>
                  <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--md-error)', marginTop: '0.2rem' }}>
                    ${debts.filter((d) => d.direction === 'borrowed' && d.status !== 'settled').reduce((sum, d) => sum + parseFloat(d.remaining_amount || 0), 0).toFixed(2)}
                  </div>
                </div>
              </div>
            </section>
          )
    ),
    upcoming_bills: () => (
      (
            <section className="panel glass-card" style={{ padding: '1.25rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                <h3 style={{ fontSize: '1.05rem', fontWeight: 600, margin: 0, color: 'var(--text-primary)' }}>
                  🔁 Upcoming Bills & Subscriptions
                </h3>
                {onNavigateTab && (
                  <button
                    type="button"
                    className="btn-text"
                    onClick={() => onNavigateTab('recurring')}
                    style={{ fontSize: '0.8rem', color: 'var(--md-primary)' }}
                  >
                    View All Bills →
                  </button>
                )}
              </div>
              {recurringProfiles.length === 0 ? (
                <div style={{ padding: '1rem', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                  No upcoming recurring bills.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {recurringProfiles.slice(0, 3).map((bill) => (
                    <div
                      key={bill.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '0.6rem 0.8rem',
                        borderRadius: '8px',
                        background: 'var(--bg-main, rgba(0,0,0,0.1))',
                        border: '1px solid var(--border-color, rgba(var(--md-on-surface-rgb), 0.06))',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span style={{ fontSize: '1.1rem' }}>{bill.icon || '🔁'}</span>
                        <div>
                          <div style={{ fontWeight: 600, fontSize: '0.88rem', color: 'var(--text-primary)' }}>
                            {bill.title}
                          </div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                            Due: {bill.next_due_date || 'Upcoming'}
                          </div>
                        </div>
                      </div>
                      <div style={{ fontWeight: 700, color: 'var(--md-error)', fontSize: '0.9rem' }}>
                        -${parseFloat(bill.amount || 0).toFixed(2)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          )
    ),
    budget_progress: () => (
      budgets.length > 0 && (
            <section className="panel glass-card" style={{ padding: '1.25rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                <h3 style={{ fontSize: '1.05rem', fontWeight: 600, margin: 0, color: 'var(--text-primary)' }}>
                  🎯 Budget Envelopes Progress
                </h3>
                {onNavigateTab && (
                  <button
                    type="button"
                    className="btn-text"
                    onClick={() => onNavigateTab('budgets')}
                    style={{ fontSize: '0.8rem', color: 'var(--md-primary)' }}
                  >
                    All Budgets →
                  </button>
                )}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {budgets.slice(0, 3).map((b) => {
                  const spent = parseFloat(b.spent || 0);
                  const limit = parseFloat(b.amount || 1);
                  const pct = Math.min(100, Math.round((spent / limit) * 100));
                  const isOver = spent > limit;

                  return (
                    <div key={b.id}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', marginBottom: '0.25rem' }}>
                        <span style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{b.name || b.category?.name || 'Budget'}</span>
                        <span style={{ color: isOver ? 'var(--md-error)' : 'var(--text-secondary)' }}>
                          ${spent.toFixed(0)} / ${limit.toFixed(0)} ({pct}%)
                        </span>
                      </div>
                      <div style={{ height: '6px', background: 'rgba(0,0,0,0.1)', borderRadius: '3px', overflow: 'hidden' }}>
                        <div
                          style={{
                            height: '100%',
                            width: `${pct}%`,
                            background: isOver ? 'var(--md-error)' : pct > 80 ? 'var(--md-warning)' : 'var(--md-success)',
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          )
    ),
    recent_activity: () => (
      (
            <section className="panel" aria-label="Transaction History">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                <h2 className="panel-title" style={{ margin: 0 }}>
                  <span>🧾</span> Recent Activity
                </h2>
                {onNavigateTab && (
                  <button
                    type="button"
                    className="btn-text"
                    onClick={() => onNavigateTab('transactions')}
                    style={{ fontSize: '0.8rem', color: 'var(--md-primary)' }}
                  >
                    Full Ledger →
                  </button>
                )}
              </div>

              <div className="filter-bar">
                <input
                  type="text"
                  className="input-field filter-input"
                  placeholder="Search transactions..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
                <select
                  className="select-field filter-select"
                  value={filterCategory}
                  onChange={(e) => setFilterCategory(e.target.value)}
                >
                  <option value="all">All Categories</option>
                  {allCategories.map((cat) => (
                    <option key={cat.id} value={cat.name}>
                      {cat.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="tx-list">
                {filteredTransactions.length === 0 ? (
                  <div className="empty-state">
                    <p>No matching transactions found.</p>
                  </div>
                ) : (
                  filteredTransactions.slice(0, 10).map((tx) => {
                    const displayTitle = tx.title || tx.payee_name || 'Untitled';
                    const displayCat = tx.category || tx.lines?.[0]?.category?.name || 'General';
                    const displayIcon = tx.icon || tx.lines?.[0]?.category?.icon || (tx.type === 'income' ? '💰' : '💳');
                    const displayAmount = tx.amount !== undefined
                      ? tx.amount
                      : (tx.lines || []).reduce((sum, l) => sum + parseFloat(l.base_amount || l.amount || 0), 0);

                    return (
                      <div key={tx.id} className="tx-item">
                        <div className="tx-left">
                          <div className="tx-category-icon">{displayIcon}</div>
                          <div>
                            <div className="tx-title">{displayTitle}</div>
                            <div className="tx-sub">
                              {displayCat} • {tx.date}
                            </div>
                          </div>
                        </div>

                        <div className="tx-right">
                          <MoneyDisplay
                            amount={displayAmount}
                            currencyCode={currencyCode}
                            numberFormat={numberFormat}
                            type={tx.type}
                            showSign
                            className="tx-amount"
                          />
                          <button
                            type="button"
                            className="tx-delete-btn"
                            onClick={() => deleteTransaction(tx.id)}
                            title="Delete record"
                          >
                            🗑️
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </section>
          )
    ),
  };

  const renderAccountWidget = (acc) => {
    const isPositive = parseFloat(acc.balance || 0) >= 0;
    return (
      <section
        className="panel glass-card account-balance-widget"
        style={{
          padding: '1.25rem',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          height: '100%',
          boxSizing: 'border-box',
          position: 'relative',
        }}
        aria-label={`${acc.name} Balance`}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', minWidth: 0 }}>
            <div
              style={{
                width: '42px',
                height: '42px',
                borderRadius: '12px',
                background: 'var(--md-primary-container)',
                color: 'var(--md-on-primary-container)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1.35rem',
                flexShrink: 0,
              }}
            >
              {acc.icon || '💳'}
            </div>
            <div style={{ minWidth: 0 }}>
              <h3
                style={{
                  fontSize: '1.05rem',
                  fontWeight: 700,
                  margin: 0,
                  color: 'var(--text-primary)',
                  lineHeight: 1.25,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
                title={acc.name}
              >
                {acc.name}
              </h3>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginTop: '0.25rem', flexWrap: 'wrap' }}>
                <span
                  style={{
                    fontSize: '0.7rem',
                    padding: '0.1rem 0.5rem',
                    borderRadius: '999px',
                    textTransform: 'capitalize',
                    background: 'rgba(var(--md-primary-rgb), 0.12)',
                    color: 'var(--md-primary)',
                    fontWeight: 600,
                  }}
                >
                  {acc.nature || acc.type || 'Account'}
                </span>
                {acc.is_shared && (
                  <span
                    style={{
                      fontSize: '0.7rem',
                      padding: '0.1rem 0.5rem',
                      borderRadius: '999px',
                      background: 'rgba(var(--md-secondary-rgb, 100, 116, 139), 0.15)',
                      color: 'var(--text-secondary)',
                      fontWeight: 500,
                    }}
                  >
                    🔗 Shared
                  </span>
                )}
              </div>
            </div>
          </div>

          {onNavigateTab && (
            <button
              type="button"
              className="btn-text"
              onClick={() => onNavigateTab('accounts')}
              style={{
                fontSize: '0.8rem',
                color: 'var(--md-primary)',
                padding: '0.2rem 0.4rem',
                flexShrink: 0,
              }}
              title="Manage in Accounts view"
            >
              Manage →
            </button>
          )}
        </div>

        <div style={{ margin: '1rem 0 0.75rem' }}>
          <div
            style={{
              fontSize: '0.72rem',
              color: 'var(--text-secondary)',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              fontWeight: 600,
              marginBottom: '0.25rem',
            }}
          >
            Live Available Balance
          </div>
          <div
            style={{
              fontSize: '1.75rem',
              fontWeight: 800,
              color: isPositive ? 'var(--text-primary)' : 'var(--md-error)',
              letterSpacing: '-0.02em',
            }}
          >
            <MoneyDisplay
              amount={acc.balance}
              currencyCode={acc.currency || currencyCode}
              numberFormat={numberFormat}
            />
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            paddingTop: '0.65rem',
            borderTop: '1px solid var(--border-subtle, rgba(var(--md-on-surface-rgb), 0.08))',
            fontSize: '0.78rem',
            color: 'var(--text-secondary)',
          }}
        >
          <span>
            Vault Currency: <strong style={{ color: 'var(--text-primary)' }}>{acc.currency || currencyCode}</strong>
          </span>
          {onNavigateTab && (
            <button
              type="button"
              onClick={() => onNavigateTab('transactions')}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--md-primary)',
                cursor: 'pointer',
                padding: 0,
                fontSize: '0.78rem',
                fontWeight: 600,
              }}
            >
              Ledger Activity ↗
            </button>
          )}
        </div>
      </section>
    );
  };

  return (
    <div className="dashboard-view" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', paddingTop: '0.5rem' }}>
      {/* Dashboard toolbar */}
      <div className="dash-toolbar">
        <div>
          <h1>Dashboard</h1>
          <p>
            {editingLayout
              ? 'Drag widgets to move them, drag the edges or corner to resize. Changes save automatically.'
              : 'Your money at a glance. Click "Edit layout" to resize or rearrange widgets.'}
          </p>
        </div>

        <div className="dash-toolbar-actions">
          {editingLayout && (
            <button type="button" className="md-btn-text" onClick={handleResetWidgets}>
              <Icon name="restart_alt" size={18} /> Reset layout
            </button>
          )}
          <button type="button" className="md-btn-outlined" onClick={() => setCustomizeModalOpen(true)}>
            <Icon name="widgets" size={18} />
            Widgets {widgets.filter((w) => w.enabled).length}/{widgets.length}
          </button>
          <button
            type="button"
            className={editingLayout ? 'md-btn-filled' : 'md-btn-tonal'}
            onClick={() => setEditingLayout((v) => !v)}
            aria-pressed={editingLayout}
          >
            <Icon name={editingLayout ? 'done' : 'space_dashboard'} size={18} />
            {editingLayout ? 'Done' : 'Edit layout'}
          </button>
        </div>
      </div>

      <MonthlySummaryCard />

      {/* Resizable, reorderable widget grid */}
      <WidgetGrid
        items={layout}
        onChange={saveLayout}
        editing={editingLayout}
        meta={allWidgetMeta}
        renderWidget={(id) => {
          if (id.startsWith('account_bal_')) {
            const accId = id.replace('account_bal_', '');
            const acc = accounts.find((a) => a.id === accId);
            if (!acc) return null;
            return renderAccountWidget(acc);
          }
          return widgetRenderers[id] ? widgetRenderers[id]() : null;
        }}
      />

      {/* Customize Widgets Modal */}
      <CustomizeWidgetsModal
        isOpen={customizeModalOpen}
        onClose={() => setCustomizeModalOpen(false)}
        widgets={widgets}
        onToggleWidget={handleToggleWidget}
        onResetWidgets={handleResetWidgets}
      />
    </div>
  );
}
