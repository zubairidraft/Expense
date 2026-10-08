import { useState } from 'react';
import { useSharedDebts } from '../../context/SharedDebtsContext';
import MoneyInput from '../ui/MoneyInput';

export default function RecordDebtPaymentModal({ isOpen, onClose, debt }) {
  const { recordDebtPayment } = useSharedDebts();

  const [amount, setAmount] = useState(debt?.remaining_amount || debt?.remainingAmount || '0.00');
  const [eventType, setEventType] = useState('repayment'); // 'repayment' vs 'forgive'
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

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
            background: 'rgba(255, 255, 255, 0.03)',
            borderRadius: '8px',
            padding: '0.75rem 1rem',
            marginBottom: '1rem',
            border: '1px solid rgba(255, 255, 255, 0.06)',
          }}
        >
          <div style={{ fontSize: '0.85rem', color: '#94a3b8' }}>Contact / Party</div>
          <div style={{ fontSize: '1rem', fontWeight: 600, color: '#f8fafc' }}>
            {debt.contact?.name || 'Contact'} ({debt.direction === 'lent' ? 'They owe you' : 'You owe them'})
          </div>
          <div style={{ fontSize: '0.85rem', color: '#10b981', marginTop: '0.25rem' }}>
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
                  background: eventType === 'repayment' ? 'rgba(99, 102, 241, 0.25)' : 'rgba(255, 255, 255, 0.04)',
                  borderColor: eventType === 'repayment' ? '#6366f1' : 'transparent',
                  color: eventType === 'repayment' ? '#fff' : '#94a3b8',
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
                  background: eventType === 'forgive' ? 'rgba(239, 68, 68, 0.2)' : 'rgba(255, 255, 255, 0.04)',
                  borderColor: eventType === 'forgive' ? '#ef4444' : 'transparent',
                  color: eventType === 'forgive' ? '#ef4444' : '#94a3b8',
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
