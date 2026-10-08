import { useState, useMemo } from 'react';
import { useBusiness } from '../../context/BusinessContext';
import { useWorkspace } from '../../context/WorkspaceContext';
import MoneyDisplay from '../ui/MoneyDisplay';
import StatCard from '../ui/StatCard';

export default function BusinessView({ onOpenCreateProject, onOpenCreateCostCenter }) {
  const { currentWorkspace } = useWorkspace();
  const {
    projects,
    costCenters,
    projectSummaries,
    memberAttribution,
    toggleCostCenter,
    calculateTax,
  } = useBusiness();

  const [activeTab, setActiveTab] = useState('projects'); // 'projects' | 'cost_centers' | 'household' | 'tax_calculator'

  // Tax Calculator local state
  const [taxAmountInput, setTaxAmountInput] = useState('100.00');
  const [taxRateInput, setTaxRateInput] = useState(15);
  const [isInclusive, setIsInclusive] = useState(false);

  const currencyCode = currentWorkspace?.base_currency || 'USD';

  // Live Tax Calculation
  const computedTax = useMemo(() => {
    try {
      return calculateTax(taxAmountInput || '0', parseFloat(taxRateInput) || 0, isInclusive);
    } catch {
      return { subtotal: '0.00', taxAmount: '0.00', total: '0.00' };
    }
  }, [taxAmountInput, taxRateInput, isInclusive, calculateTax]);

  // Aggregate stats
  const totalBudget = projects.reduce((sum, p) => sum + parseFloat(p.budget || 0), 0);
  const totalRevenue = projectSummaries.reduce((sum, s) => sum + parseFloat(s.totalRevenue || 0), 0);
  const totalExpense = projectSummaries.reduce((sum, s) => sum + parseFloat(s.totalExpense || 0), 0);

  return (
    <div className="business-view">
      {/* Top Stat Cards */}
      <div className="stats-grid">
        <StatCard
          label="Total Project Budgets"
          amount={totalBudget}
          type="default"
          icon="💼"
          currencyCode={currencyCode}
          meta={`${projects.length} managed client projects`}
        />
        <StatCard
          label="Tracked Project Revenue"
          amount={totalRevenue}
          type="income"
          icon="📈"
          currencyCode={currencyCode}
          meta="Billable contract inflows"
        />
        <StatCard
          label="Project Expenses"
          amount={totalExpense}
          type="expense"
          icon="📉"
          currencyCode={currencyCode}
          meta="Direct & reimbursable costs"
        />
        <StatCard
          label="Net Project Profit"
          amount={totalRevenue - totalExpense}
          type={totalRevenue >= totalExpense ? 'income' : 'expense'}
          icon="💎"
          currencyCode={currencyCode}
          meta="Operating margin"
        />
      </div>

      {/* Main Panel */}
      <section className="panel" style={{ marginTop: '1.5rem' }}>
        <div className="panel-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <div className="tab-pill-switcher" style={{ display: 'flex', gap: '0.4rem', background: 'rgba(255, 255, 255, 0.04)', padding: '0.3rem', borderRadius: '10px' }}>
            <button
              type="button"
              className={`btn-pill ${activeTab === 'projects' ? 'active' : ''}`}
              onClick={() => setActiveTab('projects')}
              style={{
                padding: '0.45rem 0.9rem',
                borderRadius: '8px',
                border: 'none',
                background: activeTab === 'projects' ? 'var(--color-primary, #6366f1)' : 'transparent',
                color: '#fff',
                fontSize: '0.85rem',
                cursor: 'pointer',
                fontWeight: 500,
              }}
            >
              💼 Projects & Budgets ({projects.length})
            </button>
            <button
              type="button"
              className={`btn-pill ${activeTab === 'cost_centers' ? 'active' : ''}`}
              onClick={() => setActiveTab('cost_centers')}
              style={{
                padding: '0.45rem 0.9rem',
                borderRadius: '8px',
                border: 'none',
                background: activeTab === 'cost_centers' ? 'var(--color-primary, #6366f1)' : 'transparent',
                color: '#fff',
                fontSize: '0.85rem',
                cursor: 'pointer',
                fontWeight: 500,
              }}
            >
              🏷️ Cost Centers ({costCenters.length})
            </button>
            <button
              type="button"
              className={`btn-pill ${activeTab === 'household' ? 'active' : ''}`}
              onClick={() => setActiveTab('household')}
              style={{
                padding: '0.45rem 0.9rem',
                borderRadius: '8px',
                border: 'none',
                background: activeTab === 'household' ? 'var(--color-primary, #6366f1)' : 'transparent',
                color: '#fff',
                fontSize: '0.85rem',
                cursor: 'pointer',
                fontWeight: 500,
              }}
            >
              👥 Member Attribution
            </button>
            <button
              type="button"
              className={`btn-pill ${activeTab === 'tax_calculator' ? 'active' : ''}`}
              onClick={() => setActiveTab('tax_calculator')}
              style={{
                padding: '0.45rem 0.9rem',
                borderRadius: '8px',
                border: 'none',
                background: activeTab === 'tax_calculator' ? 'var(--color-primary, #6366f1)' : 'transparent',
                color: '#fff',
                fontSize: '0.85rem',
                cursor: 'pointer',
                fontWeight: 500,
              }}
            >
              🧮 Tax / VAT Tool
            </button>
          </div>

          <div style={{ display: 'flex', gap: '0.5rem' }}>
            {activeTab === 'projects' && (
              <button type="button" className="btn-primary" onClick={onOpenCreateProject}>
                + New Project
              </button>
            )}
            {activeTab === 'cost_centers' && (
              <button type="button" className="btn-primary" onClick={onOpenCreateCostCenter}>
                + Add Cost Center
              </button>
            )}
          </div>
        </div>

        {/* Tab 1: Projects */}
        {activeTab === 'projects' && (
          <div style={{ marginTop: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {projects.length === 0 ? (
              <div className="empty-state">
                <span className="empty-icon">💼</span>
                <h3>No Projects Created</h3>
                <p>Track client budgets, billable hours, project costs, and profitability margins.</p>
                <button type="button" className="btn-primary" onClick={onOpenCreateProject}>
                  Create First Project
                </button>
              </div>
            ) : (
              projects.map((proj) => {
                const summary = projectSummaries.find((s) => s.projectId === proj.id);
                const burnPct = summary?.budgetBurnPercent ?? 0;
                const isOverBudget = burnPct > 100;

                return (
                  <div
                    key={proj.id}
                    style={{
                      background: 'rgba(255, 255, 255, 0.03)',
                      border: '1px solid rgba(255, 255, 255, 0.06)',
                      borderRadius: '10px',
                      padding: '1.25rem',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.5rem' }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                          <h4 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 600, color: '#f8fafc' }}>
                            {proj.name}
                          </h4>
                          {proj.code && (
                            <span
                              style={{
                                fontSize: '0.75rem',
                                padding: '0.15rem 0.5rem',
                                borderRadius: '4px',
                                background: 'rgba(99, 102, 241, 0.2)',
                                color: '#a5b4fc',
                                fontWeight: 600,
                              }}
                            >
                              {proj.code}
                            </span>
                          )}
                          <span
                            style={{
                              fontSize: '0.72rem',
                              padding: '0.1rem 0.45rem',
                              borderRadius: '4px',
                              background: proj.status === 'completed' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(56, 189, 248, 0.2)',
                              color: proj.status === 'completed' ? '#10b981' : '#38bdf8',
                              fontWeight: 600,
                              textTransform: 'uppercase',
                            }}
                          >
                            {proj.status}
                          </span>
                        </div>
                        <div style={{ fontSize: '0.82rem', color: '#94a3b8', marginTop: '0.3rem' }}>
                          Client: <strong style={{ color: '#e2e8f0' }}>{proj.client?.name || 'Internal'}</strong>
                          {proj.start_date && ` • Started: ${new Date(proj.start_date).toLocaleDateString()}`}
                        </div>
                      </div>

                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: '1.15rem', fontWeight: 700, color: '#f8fafc' }}>
                          {proj.budget ? <MoneyDisplay amount={proj.budget} currencyCode={proj.currency || currencyCode} /> : 'No Limit'}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: isOverBudget ? '#ef4444' : '#94a3b8' }}>
                          {proj.budget ? `${burnPct}% budget burned` : 'Unlimited Budget'}
                        </div>
                      </div>
                    </div>

                    {/* Budget Burn Progress Bar */}
                    {proj.budget && (
                      <div
                        style={{
                          marginTop: '0.85rem',
                          height: '6px',
                          borderRadius: '999px',
                          background: 'rgba(255, 255, 255, 0.08)',
                          overflow: 'hidden',
                        }}
                      >
                        <div
                          style={{
                            height: '100%',
                            width: `${Math.min(100, burnPct)}%`,
                            borderRadius: '999px',
                            background: isOverBudget ? '#ef4444' : burnPct > 80 ? '#f59e0b' : '#6366f1',
                          }}
                        />
                      </div>
                    )}

                    {/* Financial Metrics Strip */}
                    <div
                      style={{
                        marginTop: '1rem',
                        paddingTop: '0.75rem',
                        borderTop: '1px solid rgba(255, 255, 255, 0.05)',
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
                        gap: '0.75rem',
                      }}
                    >
                      <div>
                        <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Revenue</div>
                        <div style={{ fontSize: '0.92rem', fontWeight: 600, color: '#10b981' }}>
                          ${summary?.totalRevenue || '0.00'}
                        </div>
                      </div>
                      <div>
                        <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Total Expenses</div>
                        <div style={{ fontSize: '0.92rem', fontWeight: 600, color: '#ef4444' }}>
                          ${summary?.totalExpense || '0.00'}
                        </div>
                      </div>
                      <div>
                        <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Billable Cost</div>
                        <div style={{ fontSize: '0.92rem', fontWeight: 600, color: '#f59e0b' }}>
                          ${summary?.totalBillableExpense || '0.00'}
                        </div>
                      </div>
                      <div>
                        <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Net Margin</div>
                        <div style={{ fontSize: '0.92rem', fontWeight: 700, color: parseFloat(summary?.netProfit || 0) >= 0 ? '#10b981' : '#ef4444' }}>
                          ${summary?.netProfit || '0.00'}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* Tab 2: Cost Centers */}
        {activeTab === 'cost_centers' && (
          <div style={{ marginTop: '1.25rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1rem' }}>
            {costCenters.length === 0 ? (
              <div className="empty-state" style={{ gridColumn: '1 / -1' }}>
                <span className="empty-icon">🏷️</span>
                <h3>No Cost Centers Configured</h3>
                <p>Define cost centers to track expenses by department, business unit, or operational function.</p>
                <button type="button" className="btn-primary" onClick={onOpenCreateCostCenter}>
                  Create Cost Center
                </button>
              </div>
            ) : (
              costCenters.map((cc) => (
                <div
                  key={cc.id}
                  style={{
                    background: 'rgba(255, 255, 255, 0.03)',
                    border: '1px solid rgba(255, 255, 255, 0.06)',
                    borderRadius: '10px',
                    padding: '1.25rem',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span
                        style={{
                          fontSize: '0.75rem',
                          padding: '0.15rem 0.5rem',
                          borderRadius: '4px',
                          background: 'rgba(99, 102, 241, 0.15)',
                          color: '#a5b4fc',
                          fontWeight: 600,
                        }}
                      >
                        {cc.code || 'CC'}
                      </span>
                      <button
                        type="button"
                        onClick={() => toggleCostCenter(cc.id, cc.active)}
                        className="btn-text"
                        style={{
                          fontSize: '0.75rem',
                          padding: '0.15rem 0.5rem',
                          borderRadius: '4px',
                          background: cc.active ? 'rgba(16, 185, 129, 0.15)' : 'rgba(255, 255, 255, 0.05)',
                          color: cc.active ? '#10b981' : '#94a3b8',
                          border: 'none',
                        }}
                      >
                        {cc.active ? '● Active' : '○ Inactive'}
                      </button>
                    </div>

                    <h4 style={{ margin: '0.75rem 0 0.35rem 0', fontSize: '1rem', fontWeight: 600, color: '#f8fafc' }}>
                      {cc.name}
                    </h4>
                    <p style={{ margin: 0, fontSize: '0.82rem', color: '#94a3b8' }}>
                      {cc.description || 'General departmental tracking'}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* Tab 3: Household Member Attribution */}
        {activeTab === 'household' && (
          <div style={{ marginTop: '1.25rem' }}>
            <div style={{ marginBottom: '1rem', fontSize: '0.88rem', color: '#94a3b8' }}>
              Individual spending attribution and net contribution in shared/household workspaces:
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1rem' }}>
              {memberAttribution.map((m) => (
                <div
                  key={m.memberId}
                  style={{
                    background: 'rgba(255, 255, 255, 0.03)',
                    border: '1px solid rgba(255, 255, 255, 0.06)',
                    borderRadius: '10px',
                    padding: '1.25rem',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
                    <div
                      style={{
                        width: '40px',
                        height: '40px',
                        borderRadius: '50%',
                        background: 'linear-gradient(135deg, #6366f1, #3b82f6)',
                        color: '#fff',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 600,
                      }}
                    >
                      {m.memberName.slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <div style={{ fontWeight: 600, color: '#f8fafc', fontSize: '1rem' }}>{m.memberName}</div>
                      <div style={{ fontSize: '0.78rem', color: '#94a3b8' }}>Workspace Member</div>
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                    <div style={{ background: 'rgba(15, 23, 42, 0.4)', padding: '0.6rem', borderRadius: '6px' }}>
                      <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Total Spent</div>
                      <div style={{ fontSize: '0.95rem', fontWeight: 600, color: '#ef4444' }}>${m.totalSpent}</div>
                    </div>
                    <div style={{ background: 'rgba(15, 23, 42, 0.4)', padding: '0.6rem', borderRadius: '6px' }}>
                      <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Total Income</div>
                      <div style={{ fontSize: '0.95rem', fontWeight: 600, color: '#10b981' }}>${m.totalIncome}</div>
                    </div>
                  </div>

                  <div style={{ marginTop: '0.75rem', fontSize: '0.85rem', color: '#94a3b8' }}>
                    Net Surplus Contribution:{' '}
                    <strong style={{ color: parseFloat(m.netContribution) >= 0 ? '#10b981' : '#f59e0b' }}>
                      ${m.netContribution}
                    </strong>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tab 4: Tax / VAT Tool */}
        {activeTab === 'tax_calculator' && (
          <div style={{ marginTop: '1.25rem', maxWidth: '520px' }}>
            <div style={{ marginBottom: '1.25rem', fontSize: '0.88rem', color: '#94a3b8' }}>
              Precision Tax / VAT calculation tool powered by `@universal-expense/core` Decimal arithmetic:
            </div>

            <div
              style={{
                background: 'rgba(255, 255, 255, 0.03)',
                border: '1px solid rgba(255, 255, 255, 0.06)',
                borderRadius: '12px',
                padding: '1.5rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '1rem',
              }}
            >
              <div className="form-group">
                <label className="form-label">Calculation Mode</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                  <button
                    type="button"
                    className={`btn-filter ${!isInclusive ? 'active' : ''}`}
                    onClick={() => setIsInclusive(false)}
                    style={{
                      padding: '0.55rem',
                      borderRadius: '8px',
                      background: !isInclusive ? 'rgba(99, 102, 241, 0.25)' : 'rgba(255, 255, 255, 0.04)',
                      borderColor: !isInclusive ? '#6366f1' : 'transparent',
                      color: !isInclusive ? '#fff' : '#94a3b8',
                      fontWeight: 600,
                    }}
                  >
                    Tax Exclusive (+ Tax)
                  </button>
                  <button
                    type="button"
                    className={`btn-filter ${isInclusive ? 'active' : ''}`}
                    onClick={() => setIsInclusive(true)}
                    style={{
                      padding: '0.55rem',
                      borderRadius: '8px',
                      background: isInclusive ? 'rgba(99, 102, 241, 0.25)' : 'rgba(255, 255, 255, 0.04)',
                      borderColor: isInclusive ? '#6366f1' : 'transparent',
                      color: isInclusive ? '#fff' : '#94a3b8',
                      fontWeight: 600,
                    }}
                  >
                    Tax Inclusive (Embedded)
                  </button>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1rem' }}>
                <div className="form-group">
                  <label className="form-label">Base Amount ({currencyCode})</label>
                  <input
                    type="number"
                    step="0.01"
                    className="form-input"
                    value={taxAmountInput}
                    onChange={(e) => setTaxAmountInput(e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Tax Rate (%)</label>
                  <input
                    type="number"
                    step="0.5"
                    className="form-input"
                    value={taxRateInput}
                    onChange={(e) => setTaxRateInput(e.target.value)}
                  />
                </div>
              </div>

              {/* Result Preview Box */}
              <div
                style={{
                  background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.15), rgba(56, 189, 248, 0.08))',
                  border: '1px solid rgba(99, 102, 241, 0.3)',
                  borderRadius: '10px',
                  padding: '1.25rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.6rem',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', color: '#cbd5e1' }}>
                  <span>Net Subtotal:</span>
                  <strong style={{ color: '#f8fafc' }}>${computedTax.subtotal}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', color: '#cbd5e1' }}>
                  <span>Tax ({taxRateInput}%):</span>
                  <strong style={{ color: '#f59e0b' }}>${computedTax.taxAmount}</strong>
                </div>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    fontSize: '1.15rem',
                    fontWeight: 700,
                    color: '#10b981',
                    borderTop: '1px solid rgba(255, 255, 255, 0.1)',
                    paddingTop: '0.6rem',
                  }}
                >
                  <span>Gross Total:</span>
                  <span>${computedTax.total}</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
