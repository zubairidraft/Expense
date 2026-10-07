import { useState, useMemo } from 'react'
import { Agentation } from 'agentation'
import './App.css'

const INITIAL_TRANSACTIONS = [
  {
    id: 'tx-1',
    title: 'Client Payment (Design System)',
    amount: 3200,
    type: 'income',
    category: 'Freelance',
    date: '2026-10-06',
    icon: '💼'
  },
  {
    id: 'tx-2',
    title: 'Cloud Infrastructure (AWS & Supabase)',
    amount: 145.5,
    type: 'expense',
    category: 'Software & Tools',
    date: '2026-10-05',
    icon: '☁️'
  },
  {
    id: 'tx-3',
    title: 'Organic Groceries',
    amount: 88.2,
    type: 'expense',
    category: 'Groceries',
    date: '2026-10-04',
    icon: '🛒'
  },
  {
    id: 'tx-4',
    title: 'Office Ergonomic Chair',
    amount: 320,
    type: 'expense',
    category: 'Workplace',
    date: '2026-10-02',
    icon: '🪑'
  },
  {
    id: 'tx-5',
    title: 'Dividend Payout',
    amount: 450,
    type: 'income',
    category: 'Investments',
    date: '2026-10-01',
    icon: '📈'
  }
]

const CATEGORIES = {
  expense: [
    { label: 'Software & Tools', icon: '☁️', color: '#6366f1' },
    { label: 'Groceries', icon: '🛒', color: '#10b981' },
    { label: 'Workplace', icon: '🪑', color: '#f59e0b' },
    { label: 'Dining Out', icon: '🍜', color: '#ec4899' },
    { label: 'Transport', icon: '🚗', color: '#06b6d4' },
    { label: 'Health & Wellness', icon: '🌿', color: '#14b8a6' },
    { label: 'Other', icon: '📦', color: '#8b5cf6' }
  ],
  income: [
    { label: 'Salary / Client', icon: '💼', color: '#10b981' },
    { label: 'Freelance', icon: '⚡', color: '#6366f1' },
    { label: 'Investments', icon: '📈', color: '#3b82f6' },
    { label: 'Other Income', icon: '💰', color: '#d946ef' }
  ]
}

export default function App() {
  const [transactions, setTransactions] = useState(INITIAL_TRANSACTIONS)
  const [type, setType] = useState('expense')
  const [title, setTitle] = useState('')
  const [amount, setAmount] = useState('')
  const [category, setCategory] = useState(CATEGORIES.expense[0].label)
  const [searchQuery, setSearchQuery] = useState('')
  const [filterCategory, setFilterCategory] = useState('all')

  const totalIncome = useMemo(() => {
    return transactions
      .filter((t) => t.type === 'income')
      .reduce((acc, curr) => acc + curr.amount, 0)
  }, [transactions])

  const totalExpense = useMemo(() => {
    return transactions
      .filter((t) => t.type === 'expense')
      .reduce((acc, curr) => acc + curr.amount, 0)
  }, [transactions])

  const balance = totalIncome - totalExpense
  const savingsRate = totalIncome > 0 ? Math.round(((totalIncome - totalExpense) / totalIncome) * 100) : 0

  const filteredTransactions = useMemo(() => {
    return transactions.filter((t) => {
      const matchesSearch = t.title.toLowerCase().includes(searchQuery.toLowerCase())
      const matchesCategory = filterCategory === 'all' || t.category === filterCategory
      return matchesSearch && matchesCategory
    })
  }, [transactions, searchQuery, filterCategory])

  const categoryBreakdown = useMemo(() => {
    const expenses = transactions.filter((t) => t.type === 'expense')
    const grouped = {}
    expenses.forEach((t) => {
      grouped[t.category] = (grouped[t.category] || 0) + t.amount
    })
    return Object.entries(grouped).map(([cat, val]) => ({
      name: cat,
      amount: val,
      percent: totalExpense > 0 ? Math.round((val / totalExpense) * 100) : 0
    }))
  }, [transactions, totalExpense])

  const handleAddTransaction = (e) => {
    e.preventDefault()
    if (!title.trim() || !amount || Number(amount) <= 0) return

    const categoryList = CATEGORIES[type]
    const matched = categoryList.find((c) => c.label === category) || categoryList[0]

    const newTx = {
      id: `tx-${Date.now()}`,
      title: title.trim(),
      amount: parseFloat(amount),
      type,
      category: matched.label,
      date: new Date().toISOString().split('T')[0],
      icon: matched.icon
    }

    setTransactions([newTx, ...transactions])
    setTitle('')
    setAmount('')
  }

  const handleDelete = (id) => {
    setTransactions(transactions.filter((t) => t.id !== id))
  }

  return (
    <div className="app-container">
      {/* Visual Annotation Toolbar for AI Agents */}
      <Agentation endpoint="http://localhost:4747" appName="Expense Tracking" />

      {/* Top Header */}
      <header className="app-header">
        <div className="brand-section">
          <div className="brand-icon">💳</div>
          <div>
            <h1 className="app-title">Expense Tracker Pro</h1>
            <p className="app-subtitle">AI-Assisted Smart Financial Manager & Budgeting</p>
          </div>
        </div>

        <div className="header-badges">
          <div className="agent-badge" title="Agentation Visual Feedback is Active">
            <span className="pulse-dot"></span>
            Agentation Active
          </div>
        </div>
      </header>

      {/* Overview Metric Cards */}
      <section className="stats-grid" aria-label="Financial Overview">
        <div className="stat-card balance">
          <div className="stat-header">
            <span className="stat-label">Net Balance</span>
            <span className="stat-icon">🏦</span>
          </div>
          <div className="stat-value">
            ${balance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="stat-meta">Live calculated from transactions</div>
        </div>

        <div className="stat-card">
          <div className="stat-header">
            <span className="stat-label">Total Income</span>
            <span className="stat-icon">📈</span>
          </div>
          <div className="stat-value income">
            +${totalIncome.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="stat-meta">{transactions.filter(t => t.type === 'income').length} income records</div>
        </div>

        <div className="stat-card">
          <div className="stat-header">
            <span className="stat-label">Total Expenses</span>
            <span className="stat-icon">📉</span>
          </div>
          <div className="stat-value expense">
            -${totalExpense.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="stat-meta">{transactions.filter(t => t.type === 'expense').length} expense records</div>
        </div>

        <div className="stat-card">
          <div className="stat-header">
            <span className="stat-label">Savings Rate</span>
            <span className="stat-icon">🎯</span>
          </div>
          <div className="stat-value">
            {savingsRate}%
          </div>
          <div className="stat-meta">{savingsRate >= 20 ? 'Optimal savings buffer' : 'Consider reviewing budget'}</div>
        </div>
      </section>

      {/* Main Grid: Add Transaction Form & History */}
      <div className="dashboard-layout">
        {/* Left Column: New Transaction Form & Category Allocation */}
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
                <label className="form-label" htmlFor="tx-title">Title / Merchant</label>
                <input
                  id="tx-title"
                  className="input-field"
                  placeholder="e.g. AWS Hosting, Groceries, Client Retainer"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="tx-amount">Amount ($)</label>
                <input
                  id="tx-amount"
                  className="input-field"
                  type="number"
                  step="0.01"
                  min="0.01"
                  placeholder="0.00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="tx-category">Category</label>
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

              <button type="submit" className="submit-btn">
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
                      <span>${item.amount.toFixed(2)} ({item.percent}%)</span>
                    </div>
                    <div className="cat-bar-track">
                      <div
                        className="cat-bar-fill"
                        style={{
                          width: `${item.percent}%`,
                          background: 'var(--accent-gradient)'
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
                    <span className={`tx-amount ${tx.type}`}>
                      {tx.type === 'income' ? '+' : '-'}$
                      {tx.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
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
    </div>
  )
}
