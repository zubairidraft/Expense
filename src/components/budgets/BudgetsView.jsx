import { useState, useMemo } from 'react';
import { useBudgets } from '../../context/BudgetContext';
import { useGoals } from '../../context/GoalContext';
import { useCategories } from '../../context/CategoryContext';
import { useWorkspace } from '../../context/WorkspaceContext';
import MoneyDisplay from '../ui/MoneyDisplay';
import StatCard from '../ui/StatCard';

export default function BudgetsView({
  onOpenCreateBudget,
  onOpenCreateGoal,
  onOpenAllocateGoal,
}) {
  const { budgets, getUtilization, deleteBudget } = useBudgets();
  const { goals, getGoalProgress, deleteGoal } = useGoals();
  const { categories } = useCategories();
  const { currentWorkspace } = useWorkspace();

  const baseCurrency = currentWorkspace?.base_currency || 'USD';
  const [mainTab, setMainTab] = useState('envelopes'); // 'envelopes' | 'goals'
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

  // Overall budget totals
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

  // Goal Cards & Progress metrics
  const goalCards = useMemo(() => {
    return goals.map((g) => {
      const progress = getGoalProgress(g);
      return {
        ...g,
        progress,
      };
    });
  }, [goals, getGoalProgress]);

  const goalStats = useMemo(() => {
    let totalTarget = 0;
    let totalSaved = 0;
    let completedCount = 0;

    for (const g of goalCards) {
      totalTarget += parseFloat(g.progress.targetAmount);
      totalSaved += parseFloat(g.progress.currentAmount);
      if (g.progress.isCompleted) completedCount += 1;
    }

    const totalRemaining = Math.max(0, totalTarget - totalSaved);
    const overallPct = totalTarget > 0 ? Math.round((totalSaved / totalTarget) * 100) : 0;

    return {
      totalTarget,
      totalSaved,
      totalRemaining,
      completedCount,
      overallPct,
    };
  }, [goalCards]);

  const handleDeleteBudget = async (budgetId) => {
    if (window.confirm('Delete this category budget envelope?')) {
      await deleteBudget(budgetId);
    }
  };

  const handleDeleteGoal = async (goalId) => {
    if (window.confirm('Delete this financial goal?')) {
      await deleteGoal(goalId);
    }
  };

  return (
    <div className="accounts-view" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Primary Section Switcher (Envelopes vs Goals) */}
      <div style={{ display: 'flex', gap: '0.75rem', borderBottom: '1px solid rgba(255, 255, 255, 0.08)', paddingBottom: '0.75rem' }}>
        <button
          type="button"
          onClick={() => setMainTab('envelopes')}
          style={{
            fontSize: '1.05rem',
            fontWeight: 700,
            padding: '0.5rem 1rem',
            borderRadius: '10px',
            border: 'none',
            cursor: 'pointer',
            background: mainTab === 'envelopes' ? 'rgba(99, 102, 241, 0.2)' : 'transparent',
            color: mainTab === 'envelopes' ? '#818cf8' : 'var(--text-muted, #94a3b8)',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
          }}
        >
          <span>🎯</span> Category Budgets ({budgets.length})
        </button>

        <button
          type="button"
          onClick={() => setMainTab('goals')}
          style={{
            fontSize: '1.05rem',
            fontWeight: 700,
            padding: '0.5rem 1rem',
            borderRadius: '10px',
            border: 'none',
            cursor: 'pointer',
            background: mainTab === 'goals' ? 'rgba(99, 102, 241, 0.2)' : 'transparent',
            color: mainTab === 'goals' ? '#818cf8' : 'var(--text-muted, #94a3b8)',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
          }}
        >
          <span>🏆</span> Savings Goals ({goals.length})
        </button>
      </div>

      {/* ===================== TAB 1: CATEGORY ENVELOPES ===================== */}
      {mainTab === 'envelopes' && (
        <>
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
                          onClick={() => handleDeleteBudget(b.id)}
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
        </>
      )}

      {/* ===================== TAB 2: FINANCIAL GOALS ===================== */}
      {mainTab === 'goals' && (
        <>
          <section className="stats-grid">
            <StatCard
              title="Total Goals Target"
              icon="🏆"
              variant="default"
              value={<MoneyDisplay amount={goalStats.totalTarget} currencyCode={baseCurrency} />}
              meta={`${goals.length} target milestones configured`}
            />

            <StatCard
              title="Total Accumulated Savings"
              icon="💰"
              variant="income"
              value={<MoneyDisplay amount={goalStats.totalSaved} currencyCode={baseCurrency} />}
              meta={`${goalStats.overallPct}% of target funded`}
            />

            <StatCard
              title="Remaining Target Needed"
              icon="⏳"
              variant="default"
              value={<MoneyDisplay amount={goalStats.totalRemaining} currencyCode={baseCurrency} />}
              meta={`${goalStats.completedCount} goals achieved!`}
            />
          </section>

          <div className="accounts-action-bar">
            <div>
              <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                Track dedicated savings vaults, emergency funds, and long-term milestones.
              </span>
            </div>

            <button
              onClick={onOpenCreateGoal}
              className="submit-btn primary-glow add-acc-btn"
            >
              <span>➕</span> Create New Goal
            </button>
          </div>

          {goalCards.length === 0 ? (
            <div className="empty-state" style={{ padding: '3.5rem 1rem' }}>
              <div style={{ fontSize: '3rem', marginBottom: '0.5rem' }}>🏆</div>
              <h3>No financial goals established yet</h3>
              <p style={{ color: 'var(--text-muted)' }}>
                Set up an Emergency Fund, Travel Fund, or Major Purchase goal.
              </p>
              <button
                type="button"
                className="submit-btn primary-glow"
                style={{ marginTop: '1rem' }}
                onClick={onOpenCreateGoal}
              >
                Create First Goal
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
              {goalCards.map((g) => {
                const { progress } = g;
                const isComplete = progress.isCompleted;

                return (
                  <div
                    key={g.id}
                    className="glass-card"
                    style={{
                      padding: '1.25rem',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '1rem',
                      border: isComplete
                        ? '1px solid rgba(16, 185, 129, 0.4)'
                        : '1px solid rgba(255, 255, 255, 0.08)',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <div
                          style={{
                            width: '44px',
                            height: '44px',
                            borderRadius: '12px',
                            background: isComplete ? 'rgba(16, 185, 129, 0.15)' : 'rgba(99, 102, 241, 0.15)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '1.4rem',
                          }}
                        >
                          {g.icon || '🎯'}
                        </div>

                        <div>
                          <strong style={{ fontSize: '1rem', color: '#f8fafc', display: 'block' }}>
                            {g.name}
                          </strong>
                          <span
                            style={{
                              fontSize: '0.72rem',
                              color: 'var(--text-muted)',
                              textTransform: 'capitalize',
                            }}
                          >
                            {g.type?.replace('_', ' ') || 'Savings'}
                            {g.target_date && ` · By ${g.target_date}`}
                          </span>
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span
                          style={{
                            fontSize: '0.72rem',
                            padding: '0.2rem 0.55rem',
                            borderRadius: '6px',
                            background: isComplete ? 'rgba(16, 185, 129, 0.2)' : 'rgba(99, 102, 241, 0.2)',
                            color: isComplete ? '#34d399' : '#818cf8',
                            fontWeight: 700,
                          }}
                        >
                          {isComplete ? '🎉 Achieved!' : `${progress.percentage}% Funded`}
                        </span>

                        <button
                          type="button"
                          onClick={() => handleDeleteGoal(g.id)}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: '#ef4444',
                            cursor: 'pointer',
                            padding: '0.2rem',
                          }}
                          title="Delete Goal"
                        >
                          🗑️
                        </button>
                      </div>
                    </div>

                    {/* Numbers */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.35rem' }}>
                        <span style={{ fontSize: '1.3rem', fontWeight: 800, color: '#f8fafc' }}>
                          <MoneyDisplay amount={parseFloat(progress.currentAmount)} currencyCode={g.currency || baseCurrency} />
                        </span>
                        <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                          of <MoneyDisplay amount={parseFloat(progress.targetAmount)} currencyCode={g.currency || baseCurrency} />
                        </span>
                      </div>

                      <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#38bdf8' }}>
                        <MoneyDisplay amount={parseFloat(progress.remainingAmount)} currencyCode={g.currency || baseCurrency} /> left
                      </span>
                    </div>

                    {/* Progress Bar */}
                    <div
                      style={{
                        height: '10px',
                        borderRadius: '9999px',
                        background: 'rgba(255, 255, 255, 0.08)',
                        overflow: 'hidden',
                      }}
                    >
                      <div
                        style={{
                          width: `${progress.percentage}%`,
                          height: '100%',
                          background: isComplete ? '#10b981' : '#6366f1',
                          borderRadius: '9999px',
                          transition: 'width 0.4s ease',
                        }}
                      />
                    </div>

                    {/* Monthly Trajectory Requirement & Allocate Action */}
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginTop: '0.25rem',
                        paddingTop: '0.75rem',
                        borderTop: '1px solid rgba(255, 255, 255, 0.06)',
                      }}
                    >
                      <div>
                        {progress.monthlyContributionNeeded ? (
                          <span style={{ fontSize: '0.78rem', color: '#f59e0b', fontWeight: 600 }}>
                            📈 ~${progress.monthlyContributionNeeded}/mo needed
                          </span>
                        ) : (
                          <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                            {isComplete ? 'Goal reached' : 'Flexible timeline'}
                          </span>
                        )}
                      </div>

                      {!isComplete && onOpenAllocateGoal && (
                        <button
                          type="button"
                          className="submit-btn primary-glow"
                          style={{ padding: '0.35rem 0.75rem', fontSize: '0.78rem' }}
                          onClick={() => onOpenAllocateGoal(g)}
                        >
                          💰 Allocate Funds
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
