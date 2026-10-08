import { useState } from 'react';
import { useWorkspace } from '../../context/WorkspaceContext';
import { CURRENCY_REGISTRY } from '../../lib/formatters';

export default function CreateWorkspaceModal({ isOpen, onClose }) {
  const { createWorkspace, currentWorkspace } = useWorkspace();
  const [name, setName] = useState('');
  const [type, setType] = useState('personal');
  const [baseCurrency, setBaseCurrency] = useState(currentWorkspace?.base_currency || 'USD');
  const [monthStartDay, setMonthStartDay] = useState(1);
  const [budgetingStyle, setBudgetingStyle] = useState('limit_based');
  const [timezone, setTimezone] = useState(
    Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
  );
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;

    setLoading(true);
    setErrorMsg('');

    const res = await createWorkspace({
      name: name.trim(),
      type,
      baseCurrency,
      timezone,
      monthStartDay: Number(monthStartDay),
      budgetingStyle,
    });

    setLoading(false);
    if (!res.error) {
      setName('');
      onClose();
    } else {
      setErrorMsg(res.error.message || 'Failed to create workspace');
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-content glass-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title-group">
            <h2 className="modal-title">Create New Workspace</h2>
            <p className="modal-subtitle">
              Set up a separate financial container for personal, family, or business
            </p>
          </div>
          <button className="modal-close-btn" onClick={onClose} aria-label="Close modal">
            ✕
          </button>
        </div>

        {errorMsg && (
          <div className="auth-alert error">
            <span>⚠️</span> {errorMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="form-group">
            <label htmlFor="ws-create-name">Workspace Name</label>
            <input
              id="ws-create-name"
              type="text"
              required
              placeholder="e.g. Dubai Household, Freelance Studio, Personal"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="input-field"
            />
          </div>

          <div className="form-row-2">
            <div className="form-group">
              <label htmlFor="ws-create-type">Workspace Type</label>
              <select
                id="ws-create-type"
                value={type}
                onChange={(e) => setType(e.target.value)}
                className="input-field"
              >
                <option value="personal">👤 Personal Space</option>
                <option value="household">🏠 Household / Family</option>
                <option value="business">🏢 Business / Freelance</option>
                <option value="custom">📁 Custom</option>
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="ws-create-currency">Base Currency</label>
              <select
                id="ws-create-currency"
                value={baseCurrency}
                onChange={(e) => setBaseCurrency(e.target.value)}
                className="input-field"
              >
                {Object.entries(CURRENCY_REGISTRY).map(([code, cur]) => (
                  <option key={code} value={code}>
                    {code} ({cur.symbol})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="form-row-2">
            <div className="form-group">
              <label htmlFor="ws-create-day">Month Start Day</label>
              <select
                id="ws-create-day"
                value={monthStartDay}
                onChange={(e) => setMonthStartDay(Number(e.target.value))}
                className="input-field"
              >
                {[...Array(31)].map((_, i) => (
                  <option key={i + 1} value={i + 1}>
                    Day {i + 1}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="ws-create-style">Budgeting Style</label>
              <select
                id="ws-create-style"
                value={budgetingStyle}
                onChange={(e) => setBudgetingStyle(e.target.value)}
                className="input-field"
              >
                <option value="limit_based">Limit-based</option>
                <option value="envelope">Envelope Budgeting</option>
              </select>
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="ws-create-timezone">Timezone</label>
            <input
              id="ws-create-timezone"
              type="text"
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              className="input-field"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="submit-btn primary-glow"
          >
            {loading ? 'Creating...' : 'Create Workspace'}
          </button>
        </form>
      </div>
    </div>
  );
}
