import { useState } from 'react';
import { useBusiness } from '../../context/BusinessContext';
import { useSharedDebts } from '../../context/SharedDebtsContext';
import { useWorkspace } from '../../context/WorkspaceContext';
import MoneyInput from '../ui/MoneyInput';

export default function CreateProjectModal({ isOpen, onClose }) {
  const { createProject } = useBusiness();
  const { contacts } = useSharedDebts();
  const { currentWorkspace } = useWorkspace();

  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [clientId, setClientId] = useState('');
  const [budget, setBudget] = useState('0.00');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Project name is required');
      return;
    }

    try {
      setSubmitting(true);
      setError(null);
      await createProject({
        name: name.trim(),
        code: code.trim() || null,
        clientId: clientId || null,
        budget: parseFloat(budget) > 0 ? budget : null,
        currency: currentWorkspace?.base_currency || 'USD',
        status: 'active',
        startDate: startDate || null,
        endDate: endDate || null,
        notes: notes.trim() || null,
      });
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to create project');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '520px' }}>
        <div className="modal-header">
          <div className="modal-title-wrap">
            <span className="modal-icon">💼</span>
            <h2 className="modal-title">Create Client Project</h2>
          </div>
          <button className="modal-close-btn" onClick={onClose} aria-label="Close modal">
            ✕
          </button>
        </div>

        {error && <div className="modal-error-banner">{error}</div>}

        <form onSubmit={handleSubmit} className="modal-form">
          <div className="form-group">
            <label className="form-label">Project Name *</label>
            <input
              type="text"
              className="form-input"
              placeholder="e.g. Website Redesign, Mobile App MVP, Annual Audit"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              autoFocus
            />
          </div>

          <div className="form-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div className="form-group">
              <label className="form-label">Project Code / Tag</label>
              <input
                type="text"
                className="form-input"
                placeholder="e.g. PRJ-2026-01"
                value={code}
                onChange={(e) => setCode(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Client / Sponsor</label>
              <select
                className="form-input"
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
              >
                <option value="">Internal / No Client</option>
                {contacts.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Budget Limit ({currentWorkspace?.base_currency || 'USD'})</label>
            <MoneyInput
              value={budget}
              onChange={setBudget}
              currencyCode={currentWorkspace?.base_currency || 'USD'}
            />
          </div>

          <div className="form-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div className="form-group">
              <label className="form-label">Start Date</label>
              <input
                type="date"
                className="form-input"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Target Completion Date</label>
              <input
                type="date"
                className="form-input"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Notes (Optional)</label>
            <input
              type="text"
              className="form-input"
              placeholder="e.g. Milestone-based billing, tax inclusive"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          <div className="modal-actions">
            <button type="button" className="btn-secondary" onClick={onClose} disabled={submitting}>
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={submitting}>
              {submitting ? 'Creating...' : 'Create Project'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
