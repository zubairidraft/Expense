import { useState, useMemo } from 'react';
import { useRecurring } from '../../context/RecurringContext';
import { useWorkspace } from '../../context/WorkspaceContext';
import MoneyDisplay from '../ui/MoneyDisplay';
import StatCard from '../ui/StatCard';

export default function RecurringView({ onOpenCreateRecurring }) {
  const {
    recurringProfiles,
    updateRecurringProfile,
    deleteRecurringProfile,
    markAsPaid,
    getCashFlowProjection,
  } = useRecurring();

  const { currentWorkspace } = useWorkspace();
  const baseCurrency = currentWorkspace?.base_currency || 'USD';

  const [activeTab, setActiveTab] = useState('upcoming'); // 'upcoming' | 'projection' | 'profiles'
  const [projectionDays, setProjectionDays] = useState(30); // 30 | 60 | 90
  const [markingId, setMarkingId] = useState(null);

  // Compute projection
  const projection = useMemo(() => {
    return getCashFlowProjection(projectionDays);
  }, [getCashFlowProjection, projectionDays]);

  // Sort upcoming profiles
  const upcomingBills = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    return [...recurringProfiles]
      .filter((p) => p.active)
      .sort((a, b) => (a.next_due_date || a.nextDueDate).localeCompare(b.next_due_date || b.nextDueDate));
  }, [recurringProfiles]);

  const handleMarkPaid = async (profileId) => {
    setMarkingId(profileId);
    try {
      await markAsPaid(profileId, true);
    } finally {
      setMarkingId(null);
    }
  };

  const handleToggleActive = async (profile) => {
    await updateRecurringProfile(profile.id, { active: !profile.active });
  };

  const handleDelete = async (profileId) => {
    if (window.confirm('Delete this recurring profile?')) {
      await deleteRecurringProfile(profileId);
    }
  };

  const getDaysLeft = (dueDateStr) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const due = new Date(dueDateStr + 'T00:00:00Z');
    due.setHours(0, 0, 0, 0);
    const diffDays = Math.round((due - today) / (1000 * 60 * 60 * 24));

    if (diffDays < 0) return { text: `${Math.abs(diffDays)}d Overdue`, color: '#ef4444' };
    if (diffDays === 0) return { text: 'Due Today', color: '#f59e0b' };
    if (diffDays === 1) return { text: 'Due Tomorrow', color: '#38bdf8' };
    return { text: `In ${diffDays} days`, color: '#94a3b8' };
  };

  return (
    <div className="accounts-view" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Overview Stat Cards */}
      <section className="stats-grid">
        <StatCard
          title="30-Day Outflow Projection"
          icon="📅"
          variant="expense"
          value={
            <MoneyDisplay
              amount={parseFloat(projection.projectedOutflow)}
              currencyCode={baseCurrency}
              type="expense"
              showSign
            />
          }
          meta="Committed recurring obligations"
        />

        <StatCard
          title="Projected Ending Balance"
          icon="📈"
          variant={parseFloat(projection.projectedEndingBalance) >= 0 ? 'income' : 'expense'}
          value={
            <MoneyDisplay
              amount={parseFloat(projection.projectedEndingBalance)}
              currencyCode={baseCurrency}
            />
          }
          meta={projection.hasLowBalanceWarning ? '⚠️ Low balance risk projected' : 'Adequate runway projected'}
        />

        <StatCard
          title="Active Subscriptions & Bills"
          icon="🔁"
          variant="default"
          value={recurringProfiles.filter((p) => p.active).length}
          meta={`${recurringProfiles.length} total profiles configured`}
        />
      </section>

      {/* Toolbar & View Tabs */}
      <div className="accounts-action-bar">
        <div className="accounts-filter-group">
          <button
            className={`acc-filter-btn ${activeTab === 'upcoming' ? 'active' : ''}`}
            onClick={() => setActiveTab('upcoming')}
          >
            📅 Upcoming Due Dates ({upcomingBills.length})
          </button>
          <button
            className={`acc-filter-btn ${activeTab === 'projection' ? 'active' : ''}`}
            onClick={() => setActiveTab('projection')}
          >
            📊 Cash Flow Projection
          </button>
          <button
            className={`acc-filter-btn ${activeTab === 'profiles' ? 'active' : ''}`}
            onClick={() => setActiveTab('profiles')}
          >
            ⚙️ All Profiles ({recurringProfiles.length})
          </button>
        </div>

        <button
          onClick={onOpenCreateRecurring}
          className="submit-btn primary-glow add-acc-btn"
        >
          <span>➕</span> New Recurring Bill
        </button>
      </div>

      {/* TAB 1: UPCOMING DUE DATES */}
      {activeTab === 'upcoming' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {upcomingBills.length === 0 ? (
            <div className="empty-state" style={{ padding: '3rem' }}>
              <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>🎉</div>
              <p>No active recurring bills due.</p>
            </div>
          ) : (
            upcomingBills.map((bill) => {
              const dueStr = bill.next_due_date || bill.nextDueDate;
              const dueInfo = getDaysLeft(dueStr);
              const isExpense = bill.type === 'expense';

              return (
                <div
                  key={bill.id}
                  className="glass-card"
                  style={{
                    padding: '1rem 1.25rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '1rem',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <div
                      style={{
                        width: '42px',
                        height: '42px',
                        borderRadius: '10px',
                        background: isExpense ? 'rgba(239, 68, 68, 0.15)' : 'rgba(16, 185, 129, 0.15)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '1.25rem',
                      }}
                    >
                      {isExpense ? '📉' : '📈'}
                    </div>

                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <strong style={{ fontSize: '1rem', color: '#f8fafc' }}>{bill.title}</strong>
                        <span
                          style={{
                            fontSize: '0.72rem',
                            padding: '0.15rem 0.45rem',
                            borderRadius: '4px',
                            background: 'rgba(255, 255, 255, 0.06)',
                            color: 'var(--text-muted, #94a3b8)',
                            textTransform: 'capitalize',
                          }}
                        >
                          {bill.frequency}
                        </span>
                        {bill.auto_post && (
                          <span
                            style={{
                              fontSize: '0.72rem',
                              padding: '0.15rem 0.45rem',
                              borderRadius: '4px',
                              background: 'rgba(99, 102, 241, 0.2)',
                              color: '#818cf8',
                            }}
                          >
                            Auto-Post
                          </span>
                        )}
                      </div>

                      <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.2rem', fontSize: '0.82rem' }}>
                        <span style={{ color: dueInfo.color, fontWeight: 600 }}>{dueInfo.text}</span>
                        <span style={{ color: 'var(--text-muted)' }}>·</span>
                        <span style={{ color: 'var(--text-muted)' }}>Due: {dueStr}</span>
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '1.1rem', fontWeight: 700 }}>
                        <MoneyDisplay
                          amount={parseFloat(bill.amount)}
                          currencyCode={bill.currency || baseCurrency}
                          type={isExpense ? 'expense' : 'income'}
                          showSign
                        />
                      </div>
                    </div>

                    <button
                      type="button"
                      className="submit-btn primary-glow"
                      style={{ padding: '0.45rem 0.85rem', fontSize: '0.82rem' }}
                      disabled={markingId === bill.id}
                      onClick={() => handleMarkPaid(bill.id)}
                    >
                      {markingId === bill.id ? 'Booking...' : '✓ Mark Paid'}
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* TAB 2: CASH FLOW PROJECTION */}
      {activeTab === 'projection' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* Horizon Selector */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              {[30, 60, 90].map((days) => (
                <button
                  key={days}
                  type="button"
                  className={`acc-filter-btn ${projectionDays === days ? 'active' : ''}`}
                  onClick={() => setProjectionDays(days)}
                >
                  {days} Days Horizon
                </button>
              ))}
            </div>

            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted, #94a3b8)' }}>
              Banker&apos;s decimal projection based on active recurring schedules
            </span>
          </div>

          {/* Low Balance Warning Banner */}
          {projection.hasLowBalanceWarning && (
            <div
              style={{
                padding: '1rem',
                borderRadius: '10px',
                background: 'rgba(239, 68, 68, 0.15)',
                border: '1px solid rgba(239, 68, 68, 0.35)',
                color: '#f87171',
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
              }}
            >
              <span style={{ fontSize: '1.5rem' }}>⚠️</span>
              <div>
                <strong>Cash Flow Deficit Warning!</strong>
                <p style={{ margin: '0.2rem 0 0', fontSize: '0.85rem' }}>
                  Projected balance dips into negative (lowest: {projection.lowestProjectedBalance} {baseCurrency}) within the next {projectionDays} days. Consider delaying discretionary spending or adjusting funding.
                </p>
              </div>
            </div>
          )}

          {/* Projection Summary Bar */}
          <div
            className="glass-card"
            style={{
              padding: '1.25rem',
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
              gap: '1rem',
              alignItems: 'center',
            }}
          >
            <div>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Starting Ledger Balance</span>
              <div style={{ fontSize: '1.1rem', fontWeight: 600 }}>
                <MoneyDisplay amount={parseFloat(projection.startingBalance)} currencyCode={baseCurrency} />
              </div>
            </div>

            <div>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Projected Inflow (+)</span>
              <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#34d399' }}>
                +<MoneyDisplay amount={parseFloat(projection.projectedInflow)} currencyCode={baseCurrency} />
              </div>
            </div>

            <div>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Projected Outflow (−)</span>
              <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#f87171' }}>
                −<MoneyDisplay amount={parseFloat(projection.projectedOutflow)} currencyCode={baseCurrency} />
              </div>
            </div>

            <div>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Projected Ending Balance</span>
              <div
                style={{
                  fontSize: '1.25rem',
                  fontWeight: 800,
                  color: parseFloat(projection.projectedEndingBalance) >= 0 ? '#34d399' : '#f87171',
                }}
              >
                <MoneyDisplay amount={parseFloat(projection.projectedEndingBalance)} currencyCode={baseCurrency} />
              </div>
            </div>
          </div>

          {/* Occurrences Chronological Feed */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <h3 style={{ fontSize: '0.95rem', color: '#cbd5e1', margin: '0.5rem 0' }}>
              Projected Timeline ({projection.occurrences.length} scheduled occurrences)
            </h3>

            {projection.occurrences.length === 0 ? (
              <p style={{ color: 'var(--text-muted)' }}>No scheduled occurrences in this horizon.</p>
            ) : (
              projection.occurrences.map((occ, idx) => {
                const isExpense = occ.type === 'expense';
                return (
                  <div
                    key={idx}
                    style={{
                      padding: '0.75rem 1rem',
                      borderRadius: '8px',
                      background: 'rgba(255,255,255,0.02)',
                      border: '1px solid rgba(255,255,255,0.05)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                      <span style={{ fontSize: '0.82rem', color: '#38bdf8', minWidth: '90px' }}>
                        {occ.date}
                      </span>
                      <strong style={{ fontSize: '0.92rem', color: '#f8fafc' }}>{occ.title}</strong>
                    </div>

                    <div style={{ fontWeight: 700 }}>
                      <MoneyDisplay
                        amount={parseFloat(occ.amount)}
                        currencyCode={occ.currency || baseCurrency}
                        type={isExpense ? 'expense' : 'income'}
                        showSign
                      />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* TAB 3: ALL RECURRING PROFILES */}
      {activeTab === 'profiles' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {recurringProfiles.map((p) => (
            <div
              key={p.id}
              className="glass-card"
              style={{
                padding: '1rem 1.25rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                opacity: p.active ? 1 : 0.6,
              }}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <strong style={{ fontSize: '1rem', color: '#f8fafc' }}>{p.title}</strong>
                  <span
                    style={{
                      fontSize: '0.72rem',
                      padding: '0.15rem 0.45rem',
                      borderRadius: '4px',
                      background: 'rgba(255,255,255,0.06)',
                      color: 'var(--text-muted)',
                      textTransform: 'capitalize',
                    }}
                  >
                    {p.frequency}
                  </span>
                </div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                  Next Due: {p.next_due_date || p.nextDueDate}
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <div style={{ fontWeight: 700, fontSize: '1rem' }}>
                  <MoneyDisplay
                    amount={parseFloat(p.amount)}
                    currencyCode={p.currency || baseCurrency}
                    type={p.type === 'expense' ? 'expense' : 'income'}
                    showSign
                  />
                </div>

                <button
                  type="button"
                  className="secondary-btn"
                  style={{ fontSize: '0.75rem', padding: '0.3rem 0.6rem' }}
                  onClick={() => handleToggleActive(p)}
                >
                  {p.active ? 'Active' : 'Paused'}
                </button>

                <button
                  type="button"
                  onClick={() => handleDelete(p.id)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#ef4444',
                    cursor: 'pointer',
                    padding: '0.25rem',
                  }}
                  title="Delete Profile"
                >
                  🗑️
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
