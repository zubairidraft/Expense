import { useState, useMemo } from 'react';
import { useRecurring } from '../../context/RecurringContext';
import { useWorkspace } from '../../context/WorkspaceContext';
import { useAccounts } from '../../context/AccountContext';
import MoneyDisplay from '../ui/MoneyDisplay';
import StatCard from '../ui/StatCard';
import { todayISO } from '../../lib/dates';

export default function RecurringView({ onOpenCreateRecurring }) {
  const {
    recurringProfiles,
    updateRecurringProfile,
    deleteRecurringProfile,
    markAsPaid,
    getCashFlowProjection,
  } = useRecurring();

  const { currentWorkspace } = useWorkspace();
  const { accounts } = useAccounts();
  const baseCurrency = currentWorkspace?.base_currency || 'USD';

  const [activeTab, setActiveTab] = useState('upcoming'); // 'upcoming' | 'projection' | 'profiles'
  const [projectionDays, setProjectionDays] = useState(30); // 30 | 60 | 90
  const [markingId, setMarkingId] = useState(null);
  const [payModalBill, setPayModalBill] = useState(null);
  const [selectedPayAccountId, setSelectedPayAccountId] = useState('');
  const [paymentDate, setPaymentDate] = useState(() => todayISO());
  const [payError, setPayError] = useState('');

  // Compute projection
  const projection = useMemo(() => {
    return getCashFlowProjection(projectionDays);
  }, [getCashFlowProjection, projectionDays]);

  // Sort upcoming profiles
  const upcomingBills = useMemo(() => {
    return [...recurringProfiles]
      .filter((p) => p.active)
      .sort((a, b) => (a.next_due_date || a.nextDueDate).localeCompare(b.next_due_date || b.nextDueDate));
  }, [recurringProfiles]);

  const handleOpenPayModal = (bill) => {
    setPayModalBill(bill);
    setSelectedPayAccountId(bill.account_id || bill.accountId || accounts[0]?.id || '');
    setPaymentDate(todayISO());
    setPayError('');
  };

  const handleConfirmPayment = async (e) => {
    e.preventDefault();
    if (!payModalBill) return;
    setMarkingId(payModalBill.id);
    setPayError('');
    try {
      const res = await markAsPaid(payModalBill.id, selectedPayAccountId, paymentDate);
      if (res?.error) {
        setPayError(res.error.message || 'Payment could not be recorded.');
        return;
      }
      setPayModalBill(null);
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
                  className="glass-card recurring-bill-card"
                  style={{
                    padding: '1rem 1.25rem',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <div
                      style={{
                        width: '42px',
                        height: '42px',
                        borderRadius: '10px',
                        background: isExpense ? 'rgba(var(--md-error-rgb), 0.15)' : 'rgba(var(--md-success-rgb), 0.15)',
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
                        <strong style={{ fontSize: '1rem', color: 'var(--md-on-surface)' }}>{bill.title}</strong>
                        <span
                          style={{
                            fontSize: '0.72rem',
                            padding: '0.15rem 0.45rem',
                            borderRadius: '4px',
                            background: 'rgba(var(--md-on-surface-rgb), 0.06)',
                            color: 'var(--text-muted, var(--md-on-surface-variant))',
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
                              background: 'rgba(var(--md-primary-rgb), 0.2)',
                              color: 'var(--md-primary)',
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
                      onClick={() => handleOpenPayModal(bill)}
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

            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted, var(--md-on-surface-variant))' }}>
              Banker&apos;s decimal projection based on active recurring schedules
            </span>
          </div>

          {/* Low Balance Warning Banner */}
          {projection.hasLowBalanceWarning && (
            <div
              style={{
                padding: '1rem',
                borderRadius: '10px',
                background: 'rgba(var(--md-error-rgb), 0.15)',
                border: '1px solid rgba(var(--md-error-rgb), 0.35)',
                color: 'var(--md-error)',
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
              <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--md-success)' }}>
                +<MoneyDisplay amount={parseFloat(projection.projectedInflow)} currencyCode={baseCurrency} />
              </div>
            </div>

            <div>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Projected Outflow (−)</span>
              <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--md-error)' }}>
                −<MoneyDisplay amount={parseFloat(projection.projectedOutflow)} currencyCode={baseCurrency} />
              </div>
            </div>

            <div>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Projected Ending Balance</span>
              <div
                style={{
                  fontSize: '1.25rem',
                  fontWeight: 800,
                  color: parseFloat(projection.projectedEndingBalance) >= 0 ? 'var(--md-success)' : 'var(--md-error)',
                }}
              >
                <MoneyDisplay amount={parseFloat(projection.projectedEndingBalance)} currencyCode={baseCurrency} />
              </div>
            </div>
          </div>

          {/* Occurrences Chronological Feed */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <h3 style={{ fontSize: '0.95rem', color: 'var(--md-on-surface-variant)', margin: '0.5rem 0' }}>
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
                      background: 'rgba(var(--md-on-surface-rgb), 0.02)',
                      border: '1px solid rgba(var(--md-on-surface-rgb), 0.05)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                      <span style={{ fontSize: '0.82rem', color: 'var(--md-info)', minWidth: '90px' }}>
                        {occ.date}
                      </span>
                      <strong style={{ fontSize: '0.92rem', color: 'var(--md-on-surface)' }}>{occ.title}</strong>
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
                  <strong style={{ fontSize: '1rem', color: 'var(--md-on-surface)' }}>{p.title}</strong>
                  <span
                    style={{
                      fontSize: '0.72rem',
                      padding: '0.15rem 0.45rem',
                      borderRadius: '4px',
                      background: 'rgba(var(--md-on-surface-rgb), 0.06)',
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
                    color: 'var(--md-error)',
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

      {/* Account Deduction Confirmation Modal */}
      {payModalBill && (
        <div className="modal-backdrop" onClick={() => setPayModalBill(null)}>
          <div
            className="modal-content"
            style={{ maxWidth: '440px', width: '90%' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <h3 className="modal-title">
                💳 Confirm {payModalBill.type === 'income' ? 'Income Deposit' : 'Payment Deduction'}
              </h3>
              <button
                type="button"
                className="modal-close"
                onClick={() => setPayModalBill(null)}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleConfirmPayment}>
              <div style={{ marginBottom: '1.25rem' }}>
                <div
                  style={{
                    padding: '1rem',
                    borderRadius: '10px',
                    background: 'rgba(var(--md-primary-rgb), 0.08)',
                    border: '1px solid rgba(var(--md-primary-rgb), 0.2)',
                    marginBottom: '1rem',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: 600, fontSize: '1rem' }}>{payModalBill.title}</span>
                    <span style={{ fontSize: '1.2rem', fontWeight: 700, color: payModalBill.type === 'income' ? 'var(--md-success)' : 'var(--md-error)' }}>
                      {payModalBill.type === 'income' ? '+' : '-'}${parseFloat(payModalBill.amount).toFixed(2)} {payModalBill.currency || baseCurrency}
                    </span>
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.35rem' }}>
                    Next Due Date: {payModalBill.next_due_date || payModalBill.nextDueDate} · {payModalBill.frequency}
                  </div>
                </div>

                <div className="form-group" style={{ marginBottom: '1rem' }}>
                  <label className="form-label">
                    {payModalBill.type === 'income' ? 'Deposit Into Account' : 'Deduct Payment From Account'}
                  </label>
                  <select
                    className="select-field"
                    value={selectedPayAccountId}
                    onChange={(e) => setSelectedPayAccountId(e.target.value)}
                    required
                  >
                    {accounts.map((acc) => (
                      <option key={acc.id} value={acc.id}>
                        {acc.icon || '🏦'} {acc.name} ({acc.currency || baseCurrency}) — Bal: {acc.balance !== undefined ? acc.balance : acc.opening_balance || 0}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Payment Date</label>
                  <input
                    type="date"
                    className="input-field"
                    value={paymentDate}
                    onChange={(e) => setPaymentDate(e.target.value)}
                    required
                  />
                </div>
              </div>

              {payError && (
                <div className="error-message" role="alert" style={{ color: 'var(--color-danger, var(--md-error))', marginBottom: '0.75rem', fontSize: '0.85rem' }}>
                  {payError}
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setPayModalBill(null)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="submit-btn primary-glow"
                  disabled={markingId === payModalBill.id}
                >
                  {markingId === payModalBill.id ? 'Processing...' : 'Confirm & Deduct'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
