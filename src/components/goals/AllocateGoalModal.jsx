import { useState } from 'react';
import { useGoals } from '../../context/GoalContext';
import { useWorkspace } from '../../context/WorkspaceContext';
import MoneyInput from '../ui/MoneyInput';

export default function AllocateGoalModal({ isOpen, onClose, goal }) {
  const { allocateFunds } = useGoals();
  const { currentWorkspace } = useWorkspace();
  const baseCurrency = currentWorkspace?.base_currency || 'USD';

  const [amount, setAmount] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  if (!isOpen || !goal) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');

    if (!amount || parseFloat(amount) <= 0) {
      setErrorMsg('Please enter a valid contribution amount.');
      return;
    }

    setLoading(true);
    try {
      const { error } = await allocateFunds(goal.id, amount, notes);
      if (error) {
        setErrorMsg(error.message || 'Failed to allocate funds.');
      } else {
        onClose();
      }
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-card"
        style={{ maxWidth: '480px' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <div>
            <h2 className="modal-title">💰 Allocate to Goal</h2>
            <p className="modal-subtitle">
              Add savings contribution towards &ldquo;{goal.name}&rdquo;.
            </p>
          </div>
          <button className="modal-close-btn" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>

        {errorMsg && (
          <div
            style={{
              padding: '0.75rem 1rem',
              borderRadius: '8px',
              background: 'rgba(var(--md-error-rgb), 0.15)',
              border: '1px solid rgba(var(--md-error-rgb), 0.3)',
              color: 'var(--md-error)',
              marginBottom: '1rem',
              fontSize: '0.875rem',
            }}
          >
            ⚠️ {errorMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
          <div>
            <MoneyInput
              id="alloc-amount"
              label="Contribution Amount *"
              value={amount}
              onChange={setAmount}
              currencyCode={goal.currency || baseCurrency}
              placeholder="100.00"
              required
            />
          </div>

          <div>
            <label className="input-label" htmlFor="alloc-notes">
              Notes (Optional)
            </label>
            <input
              id="alloc-notes"
              type="text"
              className="input-field"
              placeholder="e.g. October surplus allocation"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
            <button type="button" className="secondary-btn" onClick={onClose}>
              Cancel
            </button>
            <button
              type="submit"
              className="submit-btn primary-glow"
              disabled={loading}
            >
              {loading ? 'Allocating...' : '✓ Add to Goal'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
