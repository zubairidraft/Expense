import { useState } from 'react';
import { useSharedDebts } from '../../context/SharedDebtsContext';
import { useWorkspace } from '../../context/WorkspaceContext';
import { useAccounts } from '../../context/AccountContext';
import MoneyDisplay from '../ui/MoneyDisplay';
import StatCard from '../ui/StatCard';

export default function SharedDebtsView({
  onOpenCreateSharedExpense,
  onOpenCreateDebt,
  onOpenCreateInstallment,
  onOpenCreateContact,
  onOpenRecordPayment,
}) {
  const { currentWorkspace } = useWorkspace();
  const {
    contacts,
    sharedExpenses,
    debts,
    installmentPlans,
    simplifiedSettlements,
    settleExpenseSplit,
    payInstallment,
  } = useSharedDebts();

  const { accounts = [] } = useAccounts() || {};
  const [payFrom, setPayFrom] = useState({}); // planId -> accountId
  const [installmentError, setInstallmentError] = useState('');

  const handlePayInstallment = async (planId) => {
    setInstallmentError('');
    try {
      await payInstallment(planId, payFrom[planId] || null);
    } catch (err) {
      setInstallmentError(err.message || 'Could not record the installment payment.');
    }
  };

  const [activeTab, setActiveTab] = useState('debts'); // 'debts' | 'shared' | 'installments' | 'contacts'

  const currencyCode = currentWorkspace?.base_currency || 'USD';

  // Summary figures
  const totalLent = debts
    .filter((d) => d.direction === 'lent' && d.status !== 'settled')
    .reduce((sum, d) => sum + parseFloat(d.remaining_amount || d.remainingAmount || 0), 0);

  const totalBorrowed = debts
    .filter((d) => d.direction === 'borrowed' && d.status !== 'settled')
    .reduce((sum, d) => sum + parseFloat(d.remaining_amount || d.remainingAmount || 0), 0);

  const activeInstallmentsCount = installmentPlans.filter((p) => p.status === 'active').length;

  return (
    <div className="shared-debts-view">
      {/* Overview Stat Cards */}
      <div className="stats-grid">
        <StatCard
          label="You Are Owed (Lent / Udhaar)"
          amount={totalLent}
          type="income"
          icon="🤝"
          currencyCode={currencyCode}
          meta={`${debts.filter((d) => d.direction === 'lent' && d.status !== 'settled').length} active receivables`}
        />
        <StatCard
          label="You Owe (Borrowed / Debts)"
          amount={totalBorrowed}
          type="expense"
          icon="📥"
          currencyCode={currencyCode}
          meta={`${debts.filter((d) => d.direction === 'borrowed' && d.status !== 'settled').length} active obligations`}
        />
        <StatCard
          label="Net Peer Position"
          amount={totalLent - totalBorrowed}
          type={totalLent >= totalBorrowed ? 'income' : 'expense'}
          icon="⚖️"
          currencyCode={currencyCode}
          meta="Net peer debt balance"
        />
        <StatCard
          label="Active EMI / BNPL Plans"
          amount={installmentPlans.reduce((sum, p) => p.status === 'active' ? sum + parseFloat(p.installment_amount || p.installmentAmount || 0) : sum, 0)}
          type="default"
          icon="💳"
          currencyCode={currencyCode}
          meta={`${activeInstallmentsCount} ongoing installment plans`}
        />
      </div>

      {/* Settle-Up Simplification Board */}
      {simplifiedSettlements.length > 0 && (
        <section
          style={{
            marginTop: '1.5rem',
            background: 'linear-gradient(135deg, rgba(var(--md-primary-rgb), 0.12), rgba(168, 85, 247, 0.08))',
            border: '1px solid rgba(var(--md-primary-rgb), 0.25)',
            borderRadius: '12px',
            padding: '1.25rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <span style={{ fontSize: '1.3rem' }}>⚡</span>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 600, color: 'var(--md-on-surface)' }}>
                  Smart Settle-Up Debt Simplification
                </h3>
                <span style={{ fontSize: '0.8rem', color: 'var(--md-on-surface-variant)' }}>
                  Graph algorithm minimized group cash flows into {simplifiedSettlements.length} direct transfers
                </span>
              </div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '0.75rem' }}>
            {simplifiedSettlements.map((s, idx) => {
              const fromContact = contacts.find((c) => c.id === s.fromContactId);
              const toContact = contacts.find((c) => c.id === s.toContactId);
              const fromName = s.fromContactId === 'me' ? 'You' : (fromContact?.name || 'Contact');
              const toName = s.toContactId === 'me' ? 'You' : (toContact?.name || 'Contact');

              return (
                <div
                  key={idx}
                  style={{
                    background: 'rgba(var(--md-surface-rgb), 0.65)',
                    border: '1px solid rgba(var(--md-on-surface-rgb), 0.06)',
                    borderRadius: '8px',
                    padding: '0.75rem 1rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.9rem' }}>
                    <span style={{ fontWeight: 600, color: 'var(--md-warning)' }}>{fromName}</span>
                    <span style={{ color: 'var(--md-on-surface-variant)' }}>➔</span>
                    <span style={{ fontWeight: 600, color: 'var(--md-success)' }}>{toName}</span>
                  </div>
                  <span style={{ fontWeight: 700, color: 'var(--md-info)', fontSize: '0.95rem' }}>
                    ${s.amount}
                  </span>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Main Hub Tabs & Actions */}
      <section className="panel" style={{ marginTop: '1.5rem' }}>
        <div className="panel-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <div className="tab-pill-switcher" style={{ display: 'flex', gap: '0.4rem', background: 'rgba(var(--md-on-surface-rgb), 0.04)', padding: '0.3rem', borderRadius: '10px' }}>
            <button
              type="button"
              className={`btn-pill ${activeTab === 'shared' ? 'active' : ''}`}
              onClick={() => setActiveTab('shared')}
              style={{
                padding: '0.45rem 0.9rem',
                borderRadius: '8px',
                border: 'none',
                background: activeTab === 'shared' ? 'var(--color-primary, var(--md-primary))' : 'transparent',
                color: 'var(--md-on-primary)',
                fontSize: '0.85rem',
                cursor: 'pointer',
                fontWeight: 500,
              }}
            >
              🤝 Shared Expenses ({sharedExpenses.length})
            </button>
            <button
              type="button"
              className={`btn-pill ${activeTab === 'debts' ? 'active' : ''}`}
              onClick={() => setActiveTab('debts')}
              style={{
                padding: '0.45rem 0.9rem',
                borderRadius: '8px',
                border: 'none',
                background: activeTab === 'debts' ? 'var(--color-primary, var(--md-primary))' : 'transparent',
                color: 'var(--md-on-primary)',
                fontSize: '0.85rem',
                cursor: 'pointer',
                fontWeight: 500,
              }}
            >
              📜 Personal Debts / Udhaar ({debts.length})
            </button>
            <button
              type="button"
              className={`btn-pill ${activeTab === 'installments' ? 'active' : ''}`}
              onClick={() => setActiveTab('installments')}
              style={{
                padding: '0.45rem 0.9rem',
                borderRadius: '8px',
                border: 'none',
                background: activeTab === 'installments' ? 'var(--color-primary, var(--md-primary))' : 'transparent',
                color: 'var(--md-on-primary)',
                fontSize: '0.85rem',
                cursor: 'pointer',
                fontWeight: 500,
              }}
            >
              💳 Installments & BNPL ({installmentPlans.length})
            </button>
            <button
              type="button"
              className={`btn-pill ${activeTab === 'contacts' ? 'active' : ''}`}
              onClick={() => setActiveTab('contacts')}
              style={{
                padding: '0.45rem 0.9rem',
                borderRadius: '8px',
                border: 'none',
                background: activeTab === 'contacts' ? 'var(--color-primary, var(--md-primary))' : 'transparent',
                color: 'var(--md-on-primary)',
                fontSize: '0.85rem',
                cursor: 'pointer',
                fontWeight: 500,
              }}
            >
              👥 Contacts ({contacts.length})
            </button>
          </div>

          <div style={{ display: 'flex', gap: '0.5rem' }}>
            {activeTab === 'shared' && (
              <button type="button" className="btn-primary" onClick={onOpenCreateSharedExpense}>
                + Add Shared Expense
              </button>
            )}
            {activeTab === 'debts' && (
              <button type="button" className="btn-primary" onClick={onOpenCreateDebt}>
                + Record Udhaar / Debt
              </button>
            )}
            {activeTab === 'installments' && (
              <button type="button" className="btn-primary" onClick={onOpenCreateInstallment}>
                + New Installment Plan
              </button>
            )}
            {activeTab === 'contacts' && (
              <button type="button" className="btn-primary" onClick={onOpenCreateContact}>
                + Add Contact
              </button>
            )}
          </div>
        </div>

        {/* Tab 1: Shared Expenses */}
        {activeTab === 'shared' && (
          <div style={{ marginTop: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {sharedExpenses.length === 0 ? (
              <div className="empty-state">
                <span className="empty-icon">🤝</span>
                <h3>No Shared Expenses Yet</h3>
                <p>Split group dinners, rent, utilities, and travel bills with friends and family.</p>
                <button type="button" className="btn-primary" onClick={onOpenCreateSharedExpense}>
                  Record First Shared Bill
                </button>
              </div>
            ) : (
              sharedExpenses.map((exp) => {
                const payerContact = contacts.find((c) => c.id === exp.payer_contact_id);
                const payerName = payerContact ? payerContact.name : 'You (Paid upfront)';

                return (
                  <div
                    key={exp.id}
                    style={{
                      background: 'rgba(var(--md-on-surface-rgb), 0.03)',
                      border: '1px solid rgba(var(--md-on-surface-rgb), 0.06)',
                      borderRadius: '10px',
                      padding: '1.25rem',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.5rem' }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <h4 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 600, color: 'var(--md-on-surface)' }}>
                            {exp.title}
                          </h4>
                          <span
                            style={{
                              fontSize: '0.75rem',
                              padding: '0.15rem 0.5rem',
                              borderRadius: '4px',
                              background: 'rgba(var(--md-primary-rgb), 0.2)',
                              color: 'var(--md-primary)',
                              textTransform: 'uppercase',
                              fontWeight: 600,
                            }}
                          >
                            {exp.split_method} split
                          </span>
                        </div>
                        <div style={{ fontSize: '0.82rem', color: 'var(--md-on-surface-variant)', marginTop: '0.3rem' }}>
                          Payer: <strong style={{ color: 'var(--md-on-surface)' }}>{payerName}</strong> • {exp.created_at ? new Date(exp.created_at).toLocaleDateString() : 'Recent'}
                        </div>
                      </div>

                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--md-on-surface)' }}>
                          <MoneyDisplay amount={exp.total_amount} currencyCode={exp.currency || currencyCode} />
                        </div>
                      </div>
                    </div>

                    {/* Participant Splits */}
                    <div style={{ marginTop: '1rem', borderTop: '1px solid rgba(var(--md-on-surface-rgb), 0.05)', paddingTop: '0.75rem' }}>
                      <div style={{ fontSize: '0.78rem', color: 'var(--md-on-surface-variant)', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        Participant Breakdown
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '0.5rem' }}>
                        {(exp.splits || []).map((s) => {
                          const contact = contacts.find((c) => c.id === s.contact_id);
                          const contactName = contact ? contact.name : 'Participant';

                          return (
                            <div
                              key={s.id}
                              style={{
                                background: 'rgba(var(--md-on-surface-rgb), 0.4)',
                                padding: '0.5rem 0.75rem',
                                borderRadius: '6px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                border: '1px solid rgba(var(--md-on-surface-rgb), 0.04)',
                              }}
                            >
                              <div>
                                <div style={{ fontSize: '0.85rem', fontWeight: 500, color: 'var(--md-on-surface)' }}>{contactName}</div>
                                <div style={{ fontSize: '0.78rem', color: s.settled ? 'var(--md-success)' : 'var(--md-warning)' }}>
                                  {s.settled ? '✓ Settled' : 'Pending repayment'}
                                </div>
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <span style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--md-on-surface)' }}>
                                  ${s.share_amount || s.shareAmount}
                                </span>
                                {!s.settled && (
                                  <button
                                    type="button"
                                    onClick={() => settleExpenseSplit(s.id)}
                                    className="btn-text"
                                    style={{ fontSize: '0.72rem', color: 'var(--md-success)', border: '1px solid var(--md-success)', padding: '0.1rem 0.35rem', borderRadius: '4px' }}
                                    title="Mark settled"
                                  >
                                    Settle
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* Tab 2: Personal Debts (Udhaar) */}
        {activeTab === 'debts' && (
          <div style={{ marginTop: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {debts.length === 0 ? (
              <div className="empty-state">
                <span className="empty-icon">📜</span>
                <h3>No Personal Debts Recorded</h3>
                <p>Track informal loans (Udhaar), friendly lending, and emergency borrowings with due dates.</p>
                <button type="button" className="btn-primary" onClick={onOpenCreateDebt}>
                  Record First Debt
                </button>
              </div>
            ) : (
              debts.map((d) => {
                const isLent = d.direction === 'lent';
                const remaining = parseFloat(d.remaining_amount || d.remainingAmount || 0);
                const principal = parseFloat(d.principal || 0);
                const isOverdue = d.due_date && new Date(d.due_date) < new Date() && d.status !== 'settled';

                return (
                  <div
                    key={d.id}
                    style={{
                      background: 'rgba(var(--md-on-surface-rgb), 0.03)',
                      border: '1px solid rgba(var(--md-on-surface-rgb), 0.06)',
                      borderRadius: '10px',
                      padding: '1.25rem',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      flexWrap: 'wrap',
                      gap: '1rem',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                      <div
                        style={{
                          width: '42px',
                          height: '42px',
                          borderRadius: '10px',
                          background: isLent ? 'rgba(var(--md-success-rgb), 0.15)' : 'rgba(var(--md-warning-rgb), 0.15)',
                          color: isLent ? 'var(--md-success)' : 'var(--md-warning)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '1.2rem',
                        }}
                      >
                        {isLent ? '🤝' : '📥'}
                      </div>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                          <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: 600, color: 'var(--md-on-surface)' }}>
                            {d.contact?.name || 'Contact'}
                          </h4>
                          <span
                            style={{
                              fontSize: '0.75rem',
                              padding: '0.15rem 0.5rem',
                              borderRadius: '4px',
                              background: isLent ? 'rgba(var(--md-success-rgb), 0.2)' : 'rgba(var(--md-warning-rgb), 0.2)',
                              color: isLent ? 'var(--md-success)' : 'var(--md-warning)',
                              fontWeight: 600,
                            }}
                          >
                            {isLent ? 'Lent (Receivable)' : 'Borrowed (Payable)'}
                          </span>
                          {d.status === 'settled' && (
                            <span style={{ fontSize: '0.72rem', color: 'var(--md-success)', background: 'rgba(var(--md-success-rgb), 0.1)', padding: '0.1rem 0.4rem', borderRadius: '4px' }}>
                              Settled
                            </span>
                          )}
                          {isOverdue && (
                            <span style={{ fontSize: '0.72rem', color: 'var(--md-error)', background: 'rgba(var(--md-error-rgb), 0.1)', padding: '0.1rem 0.4rem', borderRadius: '4px' }}>
                              Overdue
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: '0.82rem', color: 'var(--md-on-surface-variant)', marginTop: '0.25rem' }}>
                          {d.notes || 'Personal loan agreement'} • Due: {d.due_date ? new Date(d.due_date).toLocaleDateString() : 'No deadline'}
                        </div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: '1.15rem', fontWeight: 700, color: isLent ? 'var(--md-success)' : 'var(--md-warning)' }}>
                          ${remaining.toFixed(2)}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--md-on-surface-variant)' }}>
                          of ${principal.toFixed(2)} principal
                        </div>
                      </div>

                      {d.status !== 'settled' && onOpenRecordPayment && (
                        <button
                          type="button"
                          className="btn-secondary"
                          style={{ padding: '0.45rem 0.85rem', fontSize: '0.82rem' }}
                          onClick={() => onOpenRecordPayment(d)}
                        >
                          Record Payment
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* Tab 3: Installments & BNPL */}
        {activeTab === 'installments' && (
          <div style={{ marginTop: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {installmentError && (
              <div role="alert" style={{ color: 'var(--md-error)', fontSize: '0.85rem' }}>
                {installmentError}
              </div>
            )}
            {installmentPlans.length === 0 ? (
              <div className="empty-state">
                <span className="empty-icon">💳</span>
                <h3>No Installment Plans Active</h3>
                <p>Track consumer financing, Apple BNPL, Tabby, Tamara, and bank EMI schedules with ease.</p>
                <button type="button" className="btn-primary" onClick={onOpenCreateInstallment}>
                  Create First Installment Plan
                </button>
              </div>
            ) : (
              installmentPlans.map((plan) => {
                const totalInstallments = plan.total_installments || plan.totalInstallments || 1;
                const paidInstallments = plan.paid_installments || plan.paidInstallments || 0;
                const progressPct = Math.round((paidInstallments / totalInstallments) * 100);
                const isCompleted = plan.status === 'completed' || paidInstallments >= totalInstallments;

                return (
                  <div
                    key={plan.id}
                    style={{
                      background: 'rgba(var(--md-on-surface-rgb), 0.03)',
                      border: '1px solid rgba(var(--md-on-surface-rgb), 0.06)',
                      borderRadius: '10px',
                      padding: '1.25rem',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.5rem' }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                          <h4 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 600, color: 'var(--md-on-surface)' }}>
                            {plan.name}
                          </h4>
                          <span
                            style={{
                              fontSize: '0.75rem',
                              padding: '0.15rem 0.5rem',
                              borderRadius: '4px',
                              background: isCompleted ? 'rgba(var(--md-success-rgb), 0.2)' : 'rgba(var(--md-primary-rgb), 0.2)',
                              color: isCompleted ? 'var(--md-success)' : 'var(--md-primary)',
                              fontWeight: 600,
                            }}
                          >
                            {isCompleted ? 'Completed' : `${plan.frequency} EMI`}
                          </span>
                        </div>
                        <div style={{ fontSize: '0.82rem', color: 'var(--md-on-surface-variant)', marginTop: '0.25rem' }}>
                          Next Due: <strong style={{ color: 'var(--md-on-surface)' }}>{plan.next_due_date || plan.nextDueDate || 'N/A'}</strong> • Total: ${plan.total_amount || plan.totalAmount}
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--md-info)' }}>
                            ${plan.installment_amount || plan.installmentAmount} / {plan.frequency === 'monthly' ? 'mo' : plan.frequency}
                          </div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--md-on-surface-variant)' }}>
                            {paidInstallments} of {totalInstallments} paid ({progressPct}%)
                          </div>
                        </div>

                        {!isCompleted && (
                          <>
                            <select
                              className="form-select"
                              aria-label="Pay from account"
                              value={payFrom[plan.id] || ''}
                              onChange={(e) => setPayFrom((prev) => ({ ...prev, [plan.id]: e.target.value }))}
                              style={{ maxWidth: '170px', fontSize: '0.8rem', padding: '0.4rem' }}
                            >
                              <option value="">Mark paid only (no account)</option>
                              {accounts
                                .filter((a) => a.nature === 'asset')
                                .map((a) => (
                                  <option key={a.id} value={a.id}>
                                    {a.name} ({a.currency})
                                  </option>
                                ))}
                            </select>
                            <button
                              type="button"
                              className="btn-secondary"
                              style={{ padding: '0.45rem 0.85rem', fontSize: '0.82rem' }}
                              onClick={() => handlePayInstallment(plan.id)}
                            >
                              Pay Due
                            </button>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Progress Bar */}
                    <div
                      style={{
                        marginTop: '1rem',
                        height: '6px',
                        borderRadius: '999px',
                        background: 'rgba(var(--md-on-surface-rgb), 0.08)',
                        overflow: 'hidden',
                      }}
                    >
                      <div
                        style={{
                          height: '100%',
                          width: `${progressPct}%`,
                          borderRadius: '999px',
                          background: isCompleted ? 'var(--md-success)' : 'linear-gradient(90deg, var(--md-primary), var(--md-info))',
                          transition: 'width 0.4s ease',
                        }}
                      />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* Tab 4: Contacts Directory */}
        {activeTab === 'contacts' && (
          <div style={{ marginTop: '1.25rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1rem' }}>
            {contacts.length === 0 ? (
              <div className="empty-state" style={{ gridColumn: '1 / -1' }}>
                <span className="empty-icon">👥</span>
                <h3>No Contacts Added</h3>
                <p>Add friends, roommates, and business clients to share bills or track loans.</p>
                <button type="button" className="btn-primary" onClick={onOpenCreateContact}>
                  Add First Contact
                </button>
              </div>
            ) : (
              contacts.map((c) => (
                <div
                  key={c.id}
                  style={{
                    background: 'rgba(var(--md-on-surface-rgb), 0.03)',
                    border: '1px solid rgba(var(--md-on-surface-rgb), 0.06)',
                    borderRadius: '10px',
                    padding: '1rem',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
                    <div
                      style={{
                        width: '36px',
                        height: '36px',
                        borderRadius: '50%',
                        background: 'rgba(var(--md-primary-rgb), 0.2)',
                        color: 'var(--md-primary)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 600,
                        fontSize: '0.9rem',
                      }}
                    >
                      {c.name.slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <div style={{ fontWeight: 600, color: 'var(--md-on-surface)', fontSize: '0.95rem' }}>{c.name}</div>
                      <div style={{ fontSize: '0.78rem', color: 'var(--md-on-surface-variant)' }}>{c.notes || 'Peer Contact'}</div>
                    </div>
                  </div>
                  {c.phone && <div style={{ fontSize: '0.8rem', color: 'var(--md-on-surface-variant)' }}>📞 {c.phone}</div>}
                  {c.email && <div style={{ fontSize: '0.8rem', color: 'var(--md-on-surface-variant)' }}>✉️ {c.email}</div>}
                </div>
              ))
            )}
          </div>
        )}
      </section>
    </div>
  );
}
