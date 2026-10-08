import { useState } from 'react';
import { useSharedDebts } from '../../context/SharedDebtsContext';
import { useWorkspace } from '../../context/WorkspaceContext';
import MoneyInput from '../ui/MoneyInput';

export default function CreateInstallmentModal({ isOpen, onClose }) {
  const { createInstallmentPlan } = useSharedDebts();
  const { currentWorkspace } = useWorkspace();

  const [name, setName] = useState('');
  const [principalAmount, setPrincipalAmount] = useState('0.00');
  const [interestOrFee, setInterestOrFee] = useState('0.00');
  const [totalInstallments, setTotalInstallments] = useState(12);
  const [frequency, setFrequency] = useState('monthly');
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  if (!isOpen) return null;

  const total = (parseFloat(principalAmount || 0) + parseFloat(interestOrFee || 0)).toFixed(2);
  const perInstallment = (parseFloat(total) / Math.max(1, totalInstallments)).toFixed(2);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Plan name is required');
      return;
    }
    if (parseFloat(principalAmount) <= 0) {
      setError('Principal amount must be greater than zero');
      return;
    }
    if (totalInstallments <= 0) {
      setError('Installments count must be at least 1');
      return;
    }

    try {
      setSubmitting(true);
      setError(null);
      await createInstallmentPlan({
        name: name.trim(),
        principalAmount,
        interestOrFee,
        currency: currentWorkspace?.base_currency || 'USD',
        totalInstallments: parseInt(totalInstallments, 10),
        frequency,
        startDate,
        notes: notes.trim() || null,
      });
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to create installment plan');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '500px' }}>
        <div className="modal-header">
          <div className="modal-title-wrap">
            <span className="modal-icon">💳</span>
            <h2 className="modal-title">New Installment / BNPL Plan</h2>
          </div>
          <button className="modal-close-btn" onClick={onClose} aria-label="Close modal">
            ✕
          </button>
        </div>

        {error && <div className="modal-error-banner">{error}</div>}

        <form onSubmit={handleSubmit} className="modal-form">
          <div className="form-group">
            <label className="form-label">Plan Name / Item *</label>
            <input
              type="text"
              className="form-input"
              placeholder="e.g. iPhone 16 Pro (Tabby), Laptop EMI, Furniture BNPL"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              autoFocus
            />
          </div>

          <div className="form-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div className="form-group">
              <label className="form-label">Principal Amount *</label>
              <MoneyInput
                value={principalAmount}
                onChange={setPrincipalAmount}
                currencyCode={currentWorkspace?.base_currency || 'USD'}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Interest / Markup / Processing Fee</label>
              <MoneyInput
                value={interestOrFee}
                onChange={setInterestOrFee}
                currencyCode={currentWorkspace?.base_currency || 'USD'}
              />
            </div>
          </div>

          <div className="form-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div className="form-group">
              <label className="form-label">Total Installments *</label>
              <input
                type="number"
                className="form-input"
                min="1"
                max="120"
                value={totalInstallments}
                onChange={(e) => setTotalInstallments(parseInt(e.target.value, 10) || 1)}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Frequency</label>
              <select
                className="form-input"
                value={frequency}
                onChange={(e) => setFrequency(e.target.value)}
              >
                <option value="weekly">Weekly</option>
                <option value="biweekly">Bi-weekly</option>
                <option value="monthly">Monthly</option>
                <option value="quarterly">Quarterly</option>
              </select>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">First Installment Due Date</label>
            <input
              type="date"
              className="form-input"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              required
            />
          </div>

          {/* Real-time Calculation Summary Box */}
          <div
            style={{
              background: 'rgba(99, 102, 241, 0.08)',
              border: '1px solid rgba(99, 102, 241, 0.2)',
              borderRadius: '8px',
              padding: '0.75rem 1rem',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <div>
              <div style={{ fontSize: '0.78rem', color: '#94a3b8' }}>Total Obligation</div>
              <div style={{ fontSize: '1.05rem', fontWeight: 600, color: '#f8fafc' }}>
                ${total}
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '0.78rem', color: '#94a3b8' }}>Per {frequency === 'monthly' ? 'Month' : frequency}</div>
              <div style={{ fontSize: '1.15rem', fontWeight: 700, color: '#10b981' }}>
                ${perInstallment} / mo
              </div>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Notes (Optional)</label>
            <input
              type="text"
              className="form-input"
              placeholder="e.g. Card linked, auto-debit on 5th"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          <div className="modal-actions">
            <button type="button" className="btn-secondary" onClick={onClose} disabled={submitting}>
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={submitting}>
              {submitting ? 'Creating...' : 'Create Installment Plan'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
