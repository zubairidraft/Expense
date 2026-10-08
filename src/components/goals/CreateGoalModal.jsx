import { useState } from 'react';
import { useGoals } from '../../context/GoalContext';
import { useAccounts } from '../../context/AccountContext';
import { useWorkspace } from '../../context/WorkspaceContext';
import MoneyInput from '../ui/MoneyInput';

const GOAL_ICONS = ['🎯', '🛡️', '🏠', '💻', '🕋', '🚗', '🌴', '💍', '🎓', '📈'];

export default function CreateGoalModal({ isOpen, onClose }) {
  const { createGoal } = useGoals();
  const { accounts } = useAccounts();
  const { currentWorkspace } = useWorkspace();

  const baseCurrency = currentWorkspace?.base_currency || 'USD';

  const [name, setName] = useState('');
  const [targetAmount, setTargetAmount] = useState('');
  const [currentAmount, setCurrentAmount] = useState('0.00');
  const [targetDate, setTargetDate] = useState('');
  const [type, setType] = useState('savings');
  const [icon, setIcon] = useState('🎯');
  const [linkedAccountId, setLinkedAccountId] = useState('');

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');

    if (!name.trim()) {
      setErrorMsg('Please specify a name for this financial goal.');
      return;
    }

    if (!targetAmount || parseFloat(targetAmount) <= 0) {
      setErrorMsg('Please enter a valid target amount.');
      return;
    }

    setLoading(true);
    try {
      const { error } = await createGoal({
        name: name.trim(),
        targetAmount,
        currentAmount: currentAmount || '0.00',
        currency: baseCurrency,
        targetDate: targetDate || null,
        type,
        icon,
        linkedAccountId: linkedAccountId || null,
      });

      if (error) {
        setErrorMsg(error.message || 'Failed to create goal.');
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
        style={{ maxWidth: '600px', maxHeight: '90vh', overflowY: 'auto' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <div>
            <h2 className="modal-title">🏆 Create Financial Goal</h2>
            <p className="modal-subtitle">
              Set savings targets, emergency reserves, debt payoff goals, and track monthly trajectories.
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
              background: 'rgba(239, 68, 68, 0.15)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              color: '#f87171',
              marginBottom: '1rem',
              fontSize: '0.875rem',
            }}
          >
            ⚠️ {errorMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div>
            <label className="input-label" htmlFor="goal-name">
              Goal Name *
            </label>
            <input
              id="goal-name"
              type="text"
              className="input-field"
              placeholder="e.g. 6-Month Emergency Fund, Down Payment, M4 MacBook"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>

          {/* Icon Selector */}
          <div>
            <label className="input-label">Select Goal Icon</label>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              {GOAL_ICONS.map((ic) => (
                <button
                  key={ic}
                  type="button"
                  onClick={() => setIcon(ic)}
                  style={{
                    fontSize: '1.4rem',
                    width: '42px',
                    height: '42px',
                    borderRadius: '8px',
                    border: icon === ic ? '2px solid #6366f1' : '1px solid rgba(255, 255, 255, 0.1)',
                    background: icon === ic ? 'rgba(99, 102, 241, 0.2)' : 'rgba(255, 255, 255, 0.03)',
                    cursor: 'pointer',
                  }}
                >
                  {ic}
                </button>
              ))}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div>
              <label className="input-label" htmlFor="goal-type">
                Goal Category
              </label>
              <select
                id="goal-type"
                className="input-field"
                value={type}
                onChange={(e) => setType(e.target.value)}
              >
                <option value="savings">General Savings</option>
                <option value="emergency_fund">Emergency Fund</option>
                <option value="debt_payoff">Debt Payoff</option>
                <option value="purchase">Major Purchase</option>
                <option value="investment">Investment Asset</option>
              </select>
            </div>

            <div>
              <label className="input-label" htmlFor="goal-target-date">
                Target Deadline (Optional)
              </label>
              <input
                id="goal-target-date"
                type="date"
                className="input-field"
                value={targetDate}
                onChange={(e) => setTargetDate(e.target.value)}
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div>
              <MoneyInput
                id="goal-target-amt"
                label="Target Amount *"
                value={targetAmount}
                onChange={setTargetAmount}
                currencyCode={baseCurrency}
                placeholder="10000.00"
                required
              />
            </div>

            <div>
              <MoneyInput
                id="goal-current-amt"
                label="Current Starting Amount"
                value={currentAmount}
                onChange={setCurrentAmount}
                currencyCode={baseCurrency}
                placeholder="0.00"
              />
            </div>
          </div>

          <div>
            <label className="input-label" htmlFor="goal-account">
              Linked Vault / Account (Optional)
            </label>
            <select
              id="goal-account"
              className="input-field"
              value={linkedAccountId}
              onChange={(e) => setLinkedAccountId(e.target.value)}
            >
              <option value="">No linked account (general goal)</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name} ({a.currency}) · {a.type}
                </option>
              ))}
            </select>
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
              {loading ? 'Creating...' : '🏆 Create Goal'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
