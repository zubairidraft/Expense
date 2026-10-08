import { useState, useMemo } from 'react';
import { useBudgets } from '../../context/BudgetContext';
import { useCategories } from '../../context/CategoryContext';
import { useWorkspace } from '../../context/WorkspaceContext';
import MoneyDisplay from '../ui/MoneyDisplay';
import StatCard from '../ui/StatCard';

export default function BudgetsView({ onOpenCreateBudget }) {
  const { budgets, getUtilization, deleteBudget } = useBudgets();
  const { categories } = useCategories();
  const { currentWorkspace } = useWorkspace();

  const baseCurrency = currentWorkspace?.base_currency || 'USD';
  const [filterMode, setFilterMode] = useState('all'); // 'all' | 'warnings' | 'healthy'

  // Map category details
  const getCategoryDetails = (catId) => {
    const found = categories.find((c) => c.id === catId);
    return {
      name: found?.name || 'General Category',
      icon: found?.icon || '📦',
      color: found?.color || '#6366f1',
    };
  };

  // Compute live utilization for each budget
  const budgetCards = useMemo(() => {
    return budgets.map((b) => {
      const util = getUtilization(b);
      const cat = getCategoryDetails(b.category_id || b.categoryId);
      return {
        ...b,
        util,
        categoryName: cat.name,
        categoryIcon: cat.icon,
        categoryColor: cat.color,
      };
    });
  }, [budgets, getUtilization, categories]);

  // Overall totals
  const overallStats = useMemo(() => {
    let totalCap = 0;
    let totalSpent = 0;

    for (const item of budgetCards) {
      totalCap += parseFloat(item.util.effectiveLimit);
      totalSpent += parseFloat(item.util.spentAmount);
    }

    const totalRemaining = totalCap - totalSpent;
    const overallPct = totalCap > 0 ? Math.round((totalSpent / totalCap) * 100) : 0;

    return {
      totalCap,
      totalSpent,
      totalRemaining,
      overallPct,
    };
  }, [budgetCards]);

  const filteredBudgets = useMemo(() => {
    return budgetCards.filter((b) => {
      if (filterMode === 'warnings') return b.util.isWarning || b.util.isExceeded;
      if (filterMode === 'healthy') return !b.util.isWarning && !b.util.isExceeded;
      return true;
    });
  }, [budgetCards, filterMode]);

  const handleDelete = async (budgetId) => {
    if (window.confirm('Delete this category budget envelope?')) {
      await deleteBudget(budgetId);
    }
  };

  return (
    <div className="accounts-view" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Overview Stat Cards */}
      <section className="stats-grid">
        <StatCard
          title="Total Budget Limit Pool"
          icon="🎯"
          variant="default"
          value={<MoneyDisplay amount={overallStats.totalCap} currencyCode={baseCurrency} />}
          meta="Cumulative category caps"
        />

        <StatCard
          title="Total Period Spent"
          icon="📉"
          variant={overallStats.overallPct >= 85 ? 'expense' : 'default'}
          value={
            <MoneyDisplay
              amount={overallStats.totalSpent}
              currencyCode={baseCurrency}
              type="expense"
              showSign
            />
          }
          meta={`${overallStats.overallPct}% of total budget consumed`}
        />

        <StatCard
          title="Remaining Budget Buffer"
          icon="🛡️"
          variant={overallStats.totalRemaining >= 0 ? 'income' : 'expense'}
          value={
            <MoneyDisplay
              amount={overallStats.totalRemaining}
              currencyCode={baseCurrency}
            />
          }
          meta={overallStats.totalRemaining < 0 ? 'Deficit across envelopes' : 'Available discretionary headroom'}
        />
      </section>

      {/* Toolbar & Filter Bar */}
      <div className="accounts-action-bar">
        <div className="accounts-filter-group">
          <button
            className={`acc-filter-btn ${filterMode === 'all' ? 'active' : ''}`}
            onClick={() => setFilterMode('all')}
          >
            All Envelopes ({budgetCards.length})
          </button>
          <button
            className={`acc-filter-btn ${filterMode === 'warnings' ? 'active' : ''}`}
            onClick={() => setFilterMode('warnings')}
          >
            ⚠️ Alert / Exceeded ({budgetCards.filter((b) => b.util.isWarning || b.util.isExceeded).length})
          </button>
          <button
            className={`acc-filter-btn ${filterMode === 'healthy' ? 'active' : ''}`}
            onClick={() => setFilterMode('healthy')}
          >
            ✓ On Track
          </button>
        </div>

        <button
          onClick={onOpenCreateBudget}
          className="submit-btn primary-glow add-acc-btn"
        >
          <span>➕</span> Set Category Budget
        </button>
      </div>

      {/* Category Envelopes Grid */}
      {filteredBudgets.length === 0 ? (
        <div className="empty-state" style={{ padding: '3.5rem 1rem' }}>
          <div style={{ fontSize: '3rem', marginBottom: '0.5rem' }}>🎯</div>
          <h3>No budget envelopes found</h3>
          <p style={{ color: 'var(--text-muted)' }}>
            Start zero-based or limit-based envelope budgeting to control spending.
          </p>
          <button
            type="button"
            className="submit-btn primary-glow"
            style={{ marginTop: '1rem' }}
            onClick={onOpenCreateBudget}
          >
            Create First Envelope
          </button>
        </div>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
            gap: '1.25rem',
          }}
        >
          {filteredBudgets.map((b) => {
            const { util } = b;
            const pct = Math.min(util.percentageUsed, 100);
            const fillColor = util.isExceeded
              ? '#ef4444'
              : util.isWarning
              ? '#f59e0b'
              : b.categoryColor || '#10b981';

            return (
              <div
                key={b.id}
                className="glass-card"
                style={{
                  padding: '1.25rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '1rem',
                  position: 'relative',
                  border: util.isExceeded
                    ? '1px solid rgba(239, 68, 68, 0.4)'
                    : util.isWarning
                    ? '1px solid rgba(245, 158, 11, 0.4)'
                    : '1px solid rgba(255, 255, 255, 0.08)',
                }}
              >
                {/* Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <div
                      style={{
                        width: '42px',
                        height: '42px',
                        borderRadius: '10px',
                        background: 'rgba(255, 255, 255, 0.05)',
                        border: `1px solid ${b.categoryColor}33`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '1.3rem',
                      }}
                    >
                      {b.categoryIcon}
                    </div>

                    <div>
                      <strong style={{ fontSize: '1rem', color: '#f8fafc', display: 'block' }}>
                        {b.categoryName}
                      </strong>
                      <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.15rem' }}>
                        <span
                          style={{
                            fontSize: '0.7rem',
                            color: 'var(--text-muted)',
                            background: 'rgba(255, 255, 255, 0.04)',
                            padding: '0.1rem 0.4rem',
                            borderRadius: '4px',
                            textTransform: 'capitalize',
                          }}
                        >
                          {b.period}
                        </span>
                        {b.rollover_enabled && (
                          <span
                            style={{
                              fontSize: '0.7rem',
                              color: '#a5b4fc',
                              background: 'rgba(99, 102, 241, 0.15)',
                              padding: '0.1rem 0.4rem',
                              borderRadius: '4px',
                            }}
                          >
                            Rollover: +${parseFloat(b.rollover_amount || '0').toFixed(0)}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Status Pill */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    {util.isExceeded ? (
                      <span
                        style={{
                          fontSize: '0.72rem',
                          background: 'rgba(239, 68, 68, 0.2)',
                          color: '#f87171',
                          padding: '0.2rem 0.5rem',
                          borderRadius: '6px',
                          fontWeight: 700,
                        }}
                      >
                        Exceeded {util.percentageUsed}%
                      </span>
                    ) : util.isWarning ? (
                      <span
                        style={{
                          fontSize: '0.72rem',
                          background: 'rgba(245, 158, 11, 0.2)',
                          color: '#fbbf24',
                          padding: '0.2rem 0.5rem',
                          borderRadius: '6px',
                          fontWeight: 700,
                        }}
                      >
                        Warning {util.percentageUsed}%
                      </span>
                    ) : (
                      <span
                        style={{
                          fontSize: '0.72rem',
                          background: 'rgba(16, 185, 129, 0.2)',
                          color: '#34d399',
                          padding: '0.2rem 0.5rem',
                          borderRadius: '6px',
                          fontWeight: 700,
                        }}
                      >
                        {util.percentageUsed}% Used
                      </span>
                    )}

                    <button
                      type="button"
                      onClick={() => handleDelete(b.id)}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: '#ef4444',
                        cursor: 'pointer',
                        padding: '0.2rem',
                      }}
                      title="Delete Budget"
                    >
                      🗑️
                    </button>
                  </div>
                </div>

                {/* Spent vs Cap Numbers */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.35rem' }}>
                    <span style={{ fontSize: '1.25rem', fontWeight: 800, color: '#f8fafc' }}>
                      <MoneyDisplay amount={parseFloat(util.spentAmount)} currencyCode={util.currency} />
                    </span>
                    <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                      spent of <MoneyDisplay amount={parseFloat(util.effectiveLimit)} currencyCode={util.currency} />
                    </span>
                  </div>

                  <span
                    style={{
                      fontSize: '0.85rem',
                      fontWeight: 600,
                      color: parseFloat(util.remainingAmount) < 0 ? '#ef4444' : '#34d399',
                    }}
                  >
                    {parseFloat(util.remainingAmount) < 0
                      ? `-${baseCurrency} ${Math.abs(parseFloat(util.remainingAmount)).toFixed(2)} over`
                      : `${baseCurrency} ${parseFloat(util.remainingAmount).toFixed(2)} left`}
                  </span>
                </div>

                {/* Progress Bar Track */}
                <div
                  style={{
                    height: '10px',
                    borderRadius: '9999px',
                    background: 'rgba(255, 255, 255, 0.08)',
                    overflow: 'hidden',
                    position: 'relative',
                  }}
                >
                  <div
                    style={{
                      width: `${pct}%`,
                      height: '100%',
                      background: fillColor,
                      borderRadius: '9999px',
                      transition: 'width 0.3s ease, background 0.3s ease',
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
