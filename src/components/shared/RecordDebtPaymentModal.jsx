import { useState, useEffect } from 'react';
import { useSharedDebts } from '../../context/SharedDebtsContext';
import { useAccounts } from '../../context/AccountContext';
import MoneyInput from '../ui/MoneyInput';
import { todayISO } from '../../lib/dates';

export default function RecordDebtPaymentModal({ isOpen, onClose, debt }) {
  const { recordDebtPayment } = useSharedDebts();
  const { accounts } = useAccounts();

  const [amount, setAmount] = useState(debt?.remaining_amount || debt?.remainingAmount || '0.00');
  const [accountId, setAccountId] = useState(accounts[0]?.id || '');
  const [eventType, setEventType] = useState('repayment'); // 'repayment' vs 'forgive'
  const [paymentDate, setPaymentDate] = useState(todayISO());
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (debt) {
      setAmount(debt?.remaining_amount || debt?.remainingAmount || '0.00');
      // Default to an account in the same currency as the debt
      const match = accounts.find((a) => a.currency === debt.currency);
      if (match) setAccountId(match.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debt]);

  useEffect(() => {
    if (accounts?.length && !accountId) {
      setAccountId(accounts[0].id);
    }
  }, [accounts, accountId]);

  if (!isOpen || !debt) return null;

  const remaining = parseFloat(debt.remaining_amount || debt.remainingAmount || 0);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const payAmt = parseFloat(amount);
    if (payAmt <= 0) {
      setError('Payment amount must be greater than zero');
      return;
    }
    if (payAmt > remaining) {
      setError(`Payment cannot exceed remaining debt balance ($${remaining.toFixed(2)})`);
      return;
    }

    try {
      setSubmitting(true);
      setError(null);
      await recordDebtPayment({
        debtId: debt.id,
        amount,
        eventType,
        paymentDate,
        notes: notes.trim() || null,
        accountId: eventType === 'repayment' ? accountId : null,
      });
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to record payment');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '440px' }}>
        <div className="modal-header">
          <div className="modal-title-wrap">
            <span className="modal-icon">💵</span>
            <h2 className="modal-title">Record Debt Repayment</h2>
          </div>
          <button className="modal-close-btn" onClick={onClose} aria-label="Close modal">
            ✕
          </button>
        </div>

        {error && <div className="modal-error-banner">{error}</div>}

        <div
          style={{
            background: 'rgba(var(--md-on-surface-rgb), 0.03)',
            borderRadius: '8px',
            padding: '0.75rem 1rem',
            marginBottom: '1rem',
            border: '1px solid rgba(var(--md-on-surface-rgb), 0.06)',
          }}
        >
          <div style={{ fontSize: '0.85rem', color: 'var(--md-on-surface-variant)' }}>Contact / Party</div>
          <div style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--md-on-surface)' }}>
            {debt.contact?.name || 'Contact'} ({debt.direction === 'lent' ? 'They owe you' : 'You owe them'})
          </div>
          <div style={{ fontSize: '0.85rem', color: 'var(--md-success)', marginTop: '0.25rem' }}>
            Outstanding Balance: <strong>${remaining.toFixed(2)} {debt.currency}</strong>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="modal-form">
          <div className="form-group">
            <label className="form-label">Payment Type</label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
              <button
                type="button"
                className={`btn-filter ${eventType === 'repayment' ? 'active' : ''}`}
                onClick={() => setEventType('repayment')}
                style={{
                  padding: '0.5rem',
                  fontSize: '0.85rem',
                  background: eventType === 'repayment' ? 'rgba(var(--md-primary-rgb), 0.25)' : 'rgba(var(--md-on-surface-rgb), 0.04)',
                  borderColor: eventType === 'repayment' ? 'var(--md-primary)' : 'transparent',
                  color: eventType === 'repayment' ? 'var(--md-on-primary)' : 'var(--md-on-surface-variant)',
                }}
              >
                💸 Repayment (Settled)
              </button>
              <button
                type="button"
                className={`btn-filter ${eventType === 'forgive' ? 'active' : ''}`}
                onClick={() => setEventType('forgive')}
                style={{
                  padding: '0.5rem',
                  fontSize: '0.85rem',
                  background: eventType === 'forgive' ? 'rgba(var(--md-error-rgb), 0.2)' : 'rgba(var(--md-on-surface-rgb), 0.04)',
                  borderColor: eventType === 'forgive' ? 'var(--md-error)' : 'transparent',
                  color: eventType === 'forgive' ? 'var(--md-error)' : 'var(--md-on-surface-variant)',
                }}
              >
                🤝 Forgive Balance
              </button>
            </div>
          </div>

          <div className="form-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div className="form-group">
              <label className="form-label">Amount *</label>
              <MoneyInput
                value={amount}
                onChange={setAmount}
                currencyCode={debt.currency || 'USD'}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Payment Date</label>
              <input
                type="date"
                className="form-input"
                value={paymentDate}
                onChange={(e) => setPaymentDate(e.target.value)}
                required
              />
            </div>
          </div>

          {eventType === 'repayment' && (
            <div className="form-group">
              <label className="form-label">
                {debt.direction === 'borrowed' ? '📤 Deduct Payment From Account *' : '📥 Deposit Repayment Into Account *'}
              </label>
              <select
                className="form-input"
                value={accountId}
                onChange={(e) => setAccountId(e.target.value)}
                required
              >
                <option value="">Select account...</option>
                {accounts.map((acc) => (
                  <option key={acc.id} value={acc.id}>
                    {acc.icon || '💳'} {acc.name} ({acc.currency})
                  </option>
                ))}
              </select>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary, var(--md-on-surface-variant))', marginTop: '0.3rem' }}>
                {debt.direction === 'borrowed'
                  ? '💡 Payment will be deducted from this account to settle your debt.'
                  : '💡 Debt recovery funds will be added into this account.'}
              </div>
            </div>
          )}

          <div className="form-group">
            <label className="form-label">Notes (Optional)</label>
            <input
              type="text"
              className="form-input"
              placeholder="e.g. Bank transfer, cash return, partially paid"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          <div className="modal-actions">
            <button type="button" className="btn-secondary" onClick={onClose} disabled={submitting}>
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={submitting}>
              {submitting ? 'Recording...' : 'Confirm Repayment'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
