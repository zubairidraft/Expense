import { useState } from 'react';
import { useBudgets } from '../../context/BudgetContext';
import { useCategories } from '../../context/CategoryContext';
import { useWorkspace } from '../../context/WorkspaceContext';
import MoneyInput from '../ui/MoneyInput';

export default function CreateBudgetModal({ isOpen, onClose }) {
  const { createBudget } = useBudgets();
  const { expenseCategories } = useCategories();
  const { currentWorkspace } = useWorkspace();

  const baseCurrency = currentWorkspace?.base_currency || 'USD';

  const [categoryId, setCategoryId] = useState('');
  const [period, setPeriod] = useState('monthly');
  const [amount, setAmount] = useState('');
  const [rolloverEnabled, setRolloverEnabled] = useState(false);
  const [rolloverAmount, setRolloverAmount] = useState('0.00');
  const [alertThreshold, setAlertThreshold] = useState(85);
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  if (!isOpen) return null;

  const effectiveCategoryId = categoryId || expenseCategories[0]?.id || '';

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');

    if (!amount || parseFloat(amount) <= 0) {
      setErrorMsg('Please enter a valid budget amount.');
      return;
    }

    if (!effectiveCategoryId) {
      setErrorMsg('Please select a category for this budget envelope.');
      return;
    }

    setLoading(true);
    try {
      const { error } = await createBudget({
        categoryId: effectiveCategoryId,
        period,
        amount,
        currency: baseCurrency,
        rolloverEnabled,
        rolloverAmount: rolloverEnabled ? rolloverAmount : '0.00',
        alertThreshold: Number(alertThreshold),
        startDate,
      });

      if (error) {
        setErrorMsg(error.message || 'Failed to create budget.');
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
            <h2 className="modal-title">🎯 Set Category Budget Limit</h2>
            <p className="modal-subtitle">
              Configure spending envelopes with rollover surplus and threshold alerts.
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
            <label className="input-label" htmlFor="budget-category">
              Expense Category *
            </label>
            <select
              id="budget-category"
              className="input-field"
              value={effectiveCategoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              required
            >
              {expenseCategories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.icon || '🏷️'} {c.name}
                </option>
              ))}
            </select>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '1rem' }}>
            <div>
              <MoneyInput
                id="budget-amount"
                label="Budget Limit *"
                value={amount}
                onChange={setAmount}
                currencyCode={baseCurrency}
                placeholder="500.00"
                required
              />
            </div>

            <div>
              <label className="input-label" htmlFor="budget-period">
                Period
              </label>
              <select
                id="budget-period"
                className="input-field"
                value={period}
                onChange={(e) => setPeriod(e.target.value)}
              >
                <option value="monthly">Monthly</option>
                <option value="weekly">Weekly</option>
                <option value="quarterly">Quarterly</option>
                <option value="yearly">Yearly</option>
              </select>
            </div>
          </div>

          <div>
            <label className="input-label" htmlFor="budget-start-date">
              Start Date
            </label>
            <input
              id="budget-start-date"
              type="date"
              className="input-field"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              required
            />
          </div>

          {/* Rollover Section */}
          <div
            style={{
              padding: '1rem',
              borderRadius: '10px',
              background: 'rgba(255,255,255,0.02)',
              border: '1px solid rgba(255,255,255,0.06)',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.75rem',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <strong style={{ fontSize: '0.9rem', color: '#f8fafc' }}>
                  Enable Rollover Surplus
                </strong>
                <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  Carry over unspent budget surplus to the next cycle.
                </p>
              </div>
              <input
                type="checkbox"
                checked={rolloverEnabled}
                onChange={(e) => setRolloverEnabled(e.target.checked)}
                style={{ width: '18px', height: '18px', accentColor: '#6366f1', cursor: 'pointer' }}
              />
            </div>

            {rolloverEnabled && (
              <div style={{ marginTop: '0.25rem' }}>
                <MoneyInput
                  id="budget-rollover"
                  label="Initial Rollover Surplus (Optional)"
                  value={rolloverAmount}
                  onChange={setRolloverAmount}
                  currencyCode={baseCurrency}
                  placeholder="0.00"
                />
              </div>
            )}
          </div>

          {/* Warning Threshold Slider */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
              <label className="input-label" style={{ margin: 0 }}>
                Alert Warning Threshold
              </label>
              <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#f59e0b' }}>
                {alertThreshold}%
              </span>
            </div>
            <input
              type="range"
              min="50"
              max="100"
              step="5"
              value={alertThreshold}
              onChange={(e) => setAlertThreshold(Number(e.target.value))}
              style={{ width: '100%', accentColor: '#f59e0b', cursor: 'pointer' }}
            />
            <p style={{ margin: '0.3rem 0 0', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              Warn when spent amount reaches or exceeds {alertThreshold}% of effective envelope limit.
            </p>
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
              {loading ? 'Saving...' : '🎯 Save Budget Envelope'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
