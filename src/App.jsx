import { useState, useMemo } from 'react'
import { Agentation } from 'agentation'
import { useAuth } from './context/AuthContext'
import { useWorkspace } from './context/WorkspaceContext'
import { useAccounts } from './context/AccountContext'
import { useTransactions } from './context/TransactionContext'
import { CURRENCY_REGISTRY } from './lib/formatters'
import Navbar from './components/layout/Navbar'
import Sidebar from './components/layout/Sidebar'
import MobileNav from './components/layout/MobileNav'
import AuthModal from './components/auth/AuthModal'
import ProfileSettingsModal from './components/profile/ProfileSettingsModal'
import CreateWorkspaceModal from './components/workspace/CreateWorkspaceModal'
import WorkspaceMembersModal from './components/workspace/WorkspaceMembersModal'
import MoneyInput from './components/ui/MoneyInput'
import MoneyDisplay from './components/ui/MoneyDisplay'
import StatCard from './components/ui/StatCard'
import AccountsView from './components/accounts/AccountsView'
import CreateAccountModal from './components/accounts/CreateAccountModal'
import CategoriesView from './components/categories/CategoriesView'
import CreateCategoryModal from './components/categories/CreateCategoryModal'
import CreateMerchantModal from './components/categories/CreateMerchantModal'
import CreateTagModal from './components/categories/CreateTagModal'
import TransactionsView from './components/transactions/TransactionsView'
import CreateTransactionModal from './components/transactions/CreateTransactionModal'
import './App.css'


const INITIAL_TRANSACTIONS = [
  {
    id: 'tx-1',
    title: 'Client Payment (Design System)',
    amount: 3200,
    type: 'income',
    category: 'Freelance',
    date: '2026-10-06',
    icon: '💼',
  },
  {
    id: 'tx-2',
    title: 'Cloud Infrastructure (AWS & Supabase)',
    amount: 145.5,
    type: 'expense',
    category: 'Software & Tools',
    date: '2026-10-05',
    icon: '☁️',
  },
  {
    id: 'tx-3',
    title: 'Organic Groceries',
    amount: 88.2,
    type: 'expense',
    category: 'Groceries',
    date: '2026-10-04',
    icon: '🛒',
  },
  {
    id: 'tx-4',
    title: 'Office Ergonomic Chair',
    amount: 320,
    type: 'expense',
    category: 'Workplace',
    date: '2026-10-02',
    icon: '🪑',
  },
  {
    id: 'tx-5',
    title: 'Dividend Payout',
    amount: 450,
    type: 'income',
    category: 'Investments',
    date: '2026-10-01',
    icon: '📈',
  },
]

const CATEGORIES = {
  expense: [
    { label: 'Software & Tools', icon: '☁️', color: '#6366f1' },
    { label: 'Groceries', icon: '🛒', color: '#10b981' },
    { label: 'Workplace', icon: '🪑', color: '#f59e0b' },
    { label: 'Dining Out', icon: '🍜', color: '#ec4899' },
    { label: 'Transport', icon: '🚗', color: '#06b6d4' },
    { label: 'Health & Wellness', icon: '🌿', color: '#14b8a6' },
    { label: 'Other', icon: '📦', color: '#8b5cf6' },
  ],
  income: [
    { label: 'Salary / Client', icon: '💼', color: '#10b981' },
    { label: 'Freelance', icon: '⚡', color: '#6366f1' },
    { label: 'Investments', icon: '📈', color: '#3b82f6' },
    { label: 'Other Income', icon: '💰', color: '#d946ef' },
  ],
}

export default function App() {
  const { profile } = useAuth()
  const { currentWorkspace } = useWorkspace()
  const { accounts } = useAccounts()
  const {
    transactions,
    totalIncome,
    totalExpense,
    balance,
    savingsRate,
    addTransaction,
    deleteTransaction,
  } = useTransactions()

  // App Shell Navigation State
  const [activeTab, setActiveTab] = useState('overview') // 'overview' | 'transactions' | 'accounts' | 'categories' | 'budgets' | 'analytics' | 'settings'
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)

  // Modals State
  const [authModalOpen, setAuthModalOpen] = useState(false)
  const [settingsModalOpen, setSettingsModalOpen] = useState(false)
  const [createWsModalOpen, setCreateWsModalOpen] = useState(false)
  const [membersWsModalOpen, setMembersWsModalOpen] = useState(false)
  const [createAccountModalOpen, setCreateAccountModalOpen] = useState(false)
  const [createCategoryModalOpen, setCreateCategoryModalOpen] = useState(false)
  const [createMerchantModalOpen, setCreateMerchantModalOpen] = useState(false)
  const [createTagModalOpen, setCreateTagModalOpen] = useState(false)
  const [createTxModalOpen, setCreateTxModalOpen] = useState(false)

  // Ledger Quick Form State
  const [type, setType] = useState('expense')
  const [title, setTitle] = useState('')
  const [amount, setAmount] = useState('')
  const [category, setCategory] = useState(CATEGORIES.expense[0].label)
  const [searchQuery, setSearchQuery] = useState('')
  const [filterCategory, setFilterCategory] = useState('all')

  const currencyCode = currentWorkspace?.base_currency || profile?.defaultCurrency || 'USD'
  const numberFormat = profile?.numberFormat || 'intl'
  const currencyInfo = CURRENCY_REGISTRY[currencyCode] || { symbol: currencyCode }

  const filteredTransactions = useMemo(() => {
    return transactions.filter((t) => {
      const q = searchQuery.toLowerCase()
      const matchesSearch =
        (t.payee_name || t.title || '').toLowerCase().includes(q) ||
        (t.notes || '').toLowerCase().includes(q)
      const matchesCategory =
        filterCategory === 'all' ||
        t.category === filterCategory ||
        t.lines?.some((l) => l.category?.name === filterCategory)
      return matchesSearch && matchesCategory
    })
  }, [transactions, searchQuery, filterCategory])

  const categoryBreakdown = useMemo(() => {
    const expenses = transactions.filter((t) => t.type === 'expense')
    const grouped = {}
    expenses.forEach((t) => {
      const catName = t.lines?.[0]?.category?.name || t.category || 'General'
      const lineAmt = (t.lines || []).reduce(
        (acc, l) => acc + parseFloat(l.base_amount || l.amount || '0'),
        t.amount || 0
      )
      grouped[catName] = (grouped[catName] || 0) + lineAmt
    })
    return Object.entries(grouped).map(([cat, val]) => ({
      name: cat,
      amount: val,
      percent: totalExpense > 0 ? Math.round((val / totalExpense) * 100) : 0,
    }))
  }, [transactions, totalExpense])

  const handleAddTransaction = async (e) => {
    e.preventDefault()
    if (!title.trim() || !amount || Number(amount) <= 0) return

    const targetAccount = accounts[0]
    if (!targetAccount) {
      alert('Please create at least one account first.')
      return
    }

    await addTransaction({
      type,
      payeeName: title.trim(),
      date: new Date().toISOString().split('T')[0],
      status: 'cleared',
      lines: [
        {
          accountId: targetAccount.id,
          categoryId: null,
          direction: type === 'income' ? 'in' : 'out',
          amount: amount,
          currency: targetAccount.currency || currencyCode,
          baseAmount: amount,
          description: title.trim(),
        },
      ],
    })

    setTitle('')
    setAmount('')
  }


  const handleDelete = (id) => {
    setTransactions(transactions.filter((t) => t.id !== id))
  }

  const handleTabChange = (tabId) => {
    if (tabId === 'settings') {
      setSettingsModalOpen(true)
    } else {
      setActiveTab(tabId)
    }
  }

  return (
    <div className="app-shell">
      {/* Visual Annotation Toolbar for AI Agents */}
      <Agentation endpoint="http://localhost:4747" appName="Expense Tracking" />

      {/* Persistent Left Sidebar Navigation */}
      <Sidebar
        activeTab={activeTab}
        onSelectTab={handleTabChange}
        onOpenSettings={() => setMembersWsModalOpen(true)}
        isCollapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
      />

      {/* Main App Container */}
      <div className="app-main-content">
        <div className="app-container">
          {/* Top Header & Workspace Switcher */}
          <Navbar
            onOpenAuth={() => setAuthModalOpen(true)}
            onOpenSettings={() => setSettingsModalOpen(true)}
            onOpenCreateWorkspace={() => setCreateWsModalOpen(true)}
            onOpenWorkspaceMembers={() => setMembersWsModalOpen(true)}
          />

          {/* Overview Metrics Cards */}
          <section className="stats-grid" aria-label="Financial Overview">
            <StatCard
              title="Net Balance"
              icon="🏦"
              variant="balance"
              value={
                <MoneyDisplay
                  amount={balance}
                  currencyCode={currencyCode}
                  numberFormat={numberFormat}
                />
              }
              meta={`Workspace: ${currentWorkspace?.name || 'Personal'} (${currencyCode})`}
            />

            <StatCard
              title="Total Income"
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
              meta={`${transactions.filter((t) => t.type === 'income').length} records booked`}
            />

            <StatCard
              title="Total Expenses"
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
              meta={`${transactions.filter((t) => t.type === 'expense').length} records booked`}
            />

            <StatCard
              title="Savings Rate"
              icon="🎯"
              variant="default"
              value={`${savingsRate}%`}
              meta={savingsRate >= 20 ? 'Optimal savings buffer' : 'Consider reviewing budget'}
            />
          </section>

          {/* View Routing Based on Active Tab */}
          {activeTab === 'overview' && (
            <div className="dashboard-layout">
              {/* Left Column: New Transaction Form & Allocation */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>
                <section className="panel" aria-label="Add New Transaction">
                  <h2 className="panel-title">
                    <span>⚡</span> Add Transaction
                  </h2>

                  <form onSubmit={handleAddTransaction}>
                    <div className="type-selector">
                      <button
                        type="button"
                        className={`type-btn expense ${type === 'expense' ? 'active' : ''}`}
                        onClick={() => {
                          setType('expense')
                          setCategory(CATEGORIES.expense[0].label)
                        }}
                      >
                        📉 Expense
                      </button>
                      <button
                        type="button"
                        className={`type-btn income ${type === 'income' ? 'active' : ''}`}
                        onClick={() => {
                          setType('income')
                          setCategory(CATEGORIES.income[0].label)
                        }}
                      >
                        📈 Income
                      </button>
                    </div>

                    <div className="form-group">
                      <label className="form-label" htmlFor="tx-title">
                        Title / Merchant
                      </label>
                      <input
                        id="tx-title"
                        className="input-field"
                        placeholder="e.g. AWS Hosting, Groceries, Retainer"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        required
                      />
                    </div>

                    <div className="form-group">
                      <MoneyInput
                        id="tx-amount"
                        label={`Amount (${currencyInfo.symbol})`}
                        value={amount}
                        onChange={setAmount}
                        currencyCode={currencyCode}
                        placeholder="0.00"
                        required
                      />
                    </div>

                    <div className="form-group">
                      <label className="form-label" htmlFor="tx-category">
                        Category
                      </label>
                      <select
                        id="tx-category"
                        className="select-field"
                        value={category}
                        onChange={(e) => setCategory(e.target.value)}
                      >
                        {CATEGORIES[type].map((c) => (
                          <option key={c.label} value={c.label}>
                            {c.icon} {c.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <button type="submit" className="submit-btn primary-glow">
                      Add {type === 'expense' ? 'Expense' : 'Income'}
                    </button>
                  </form>
                </section>

                {/* Expense Category Breakdown */}
                {categoryBreakdown.length > 0 && (
                  <section className="panel" aria-label="Expense Breakdown">
                    <h2 className="panel-title">
                      <span>📊</span> Expense Distribution
                    </h2>
                    <div className="category-bars">
                      {categoryBreakdown.map((item) => (
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
                                background: 'var(--accent-gradient)',
                              }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>
                )}
              </div>

              {/* Right Column: Transaction History */}
              <section className="panel" aria-label="Transaction History">
                <h2 className="panel-title">
                  <span>🧾</span> Recent Activity
                </h2>

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
                    {[...CATEGORIES.expense, ...CATEGORIES.income].map((cat) => (
                      <option key={cat.label} value={cat.label}>
                        {cat.label}
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
                    filteredTransactions.map((tx) => (
                      <div key={tx.id} className="tx-item">
                        <div className="tx-left">
                          <div className="tx-category-icon">{tx.icon}</div>
                          <div>
                            <div className="tx-title">{tx.title}</div>
                            <div className="tx-sub">
                              {tx.category} • {tx.date}
                            </div>
                          </div>
                        </div>

                        <div className="tx-right">
                          <MoneyDisplay
                            amount={tx.amount}
                            currencyCode={currencyCode}
                            numberFormat={numberFormat}
                            type={tx.type}
                            showSign
                            className="tx-amount"
                          />
                          <button
                            type="button"
                            className="tx-delete-btn"
                            onClick={() => handleDelete(tx.id)}
                            title="Delete record"
                          >
                            🗑️
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </section>
            </div>
          )}

          {activeTab === 'transactions' && (
            <TransactionsView
              onOpenCreateTransaction={() => setCreateTxModalOpen(true)}
            />
          )}


          {activeTab === 'accounts' && (
            <AccountsView
              onOpenCreateAccount={() => setCreateAccountModalOpen(true)}
            />
          )}

          {activeTab === 'categories' && (
            <CategoriesView
              onOpenCreateCategory={() => setCreateCategoryModalOpen(true)}
              onOpenCreateMerchant={() => setCreateMerchantModalOpen(true)}
              onOpenCreateTag={() => setCreateTagModalOpen(true)}
            />
          )}


          {activeTab === 'budgets' && (
            <section className="panel" aria-label="Budget Limits">
              <h2 className="panel-title">
                <span>🎯</span> Category Budgets & Targets
              </h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '0.5rem' }}>
                Limit-based envelopes configured for {currentWorkspace?.name || 'Workspace'}.
              </p>
              <div className="category-bars" style={{ marginTop: '1.5rem' }}>
                <div className="cat-bar-item">
                  <div className="cat-bar-header">
                    <span>Software & Cloud Services</span>
                    <span>$145.50 / $300.00 (48%)</span>
                  </div>
                  <div className="cat-bar-track">
                    <div className="cat-bar-fill" style={{ width: '48%', background: '#6366f1' }} />
                  </div>
                </div>
                <div className="cat-bar-item">
                  <div className="cat-bar-header">
                    <span>Groceries & Supplies</span>
                    <span>$88.20 / $500.00 (17%)</span>
                  </div>
                  <div className="cat-bar-track">
                    <div className="cat-bar-fill" style={{ width: '17%', background: '#10b981' }} />
                  </div>
                </div>
              </div>
            </section>
          )}

          {activeTab === 'analytics' && (
            <section className="panel" aria-label="Visual Analytics">
              <h2 className="panel-title">
                <span>📈</span> Spending & Savings Analytics
              </h2>
              <div className="stats-grid" style={{ marginTop: '1.25rem' }}>
                <div className="stat-card">
                  <span className="stat-label">Avg Daily Spend</span>
                  <div className="stat-value">
                    <MoneyDisplay amount={totalExpense / 7} currencyCode={currencyCode} numberFormat={numberFormat} />
                  </div>
                  <span className="stat-meta">Past 7 days trajectory</span>
                </div>
                <div className="stat-card">
                  <span className="stat-label">Net Surplus</span>
                  <div className="stat-value income">
                    <MoneyDisplay amount={balance} currencyCode={currencyCode} numberFormat={numberFormat} type="income" />
                  </div>
                  <span className="stat-meta">Available to allocate to savings</span>
                </div>
              </div>
            </section>
          )}
        </div>
      </div>

      {/* Mobile Bottom Navigation Bar (<900px) */}
      <MobileNav
        activeTab={activeTab}
        onSelectTab={handleTabChange}
        onOpenQuickAdd={() => setCreateTxModalOpen(true)}
      />


      {/* Auth Modal */}
      <AuthModal
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
      />

      {/* Profile & Regional Settings Modal */}
      <ProfileSettingsModal
        isOpen={settingsModalOpen}
        onClose={() => setSettingsModalOpen(false)}
      />

      {/* Create Workspace Modal */}
      <CreateWorkspaceModal
        isOpen={createWsModalOpen}
        onClose={() => setCreateWsModalOpen(false)}
      />

      {/* Workspace Members & Settings Modal */}
      <WorkspaceMembersModal
        isOpen={membersWsModalOpen}
        onClose={() => setMembersWsModalOpen(false)}
      />

      {/* Create Account Modal */}
      <CreateAccountModal
        isOpen={createAccountModalOpen}
        onClose={() => setCreateAccountModalOpen(false)}
      />

      {/* Create Category Modal */}
      <CreateCategoryModal
        isOpen={createCategoryModalOpen}
        onClose={() => setCreateCategoryModalOpen(false)}
      />

      {/* Create Merchant Modal */}
      <CreateMerchantModal
        isOpen={createMerchantModalOpen}
        onClose={() => setCreateMerchantModalOpen(false)}
      />

      {/* Create Tag Modal */}
      <CreateTagModal
        isOpen={createTagModalOpen}
        onClose={() => setCreateTagModalOpen(false)}
      />

      {/* Book Transaction Modal */}
      <CreateTransactionModal
        isOpen={createTxModalOpen}
        onClose={() => setCreateTxModalOpen(false)}
      />
    </div>
  )
}


