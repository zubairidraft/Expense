import { useState } from 'react';
import { useBusiness } from '../../context/BusinessContext';

export default function CreateCostCenterModal({ isOpen, onClose }) {
  const { createCostCenter } = useBusiness();

  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Cost center name is required');
      return;
    }

    try {
      setSubmitting(true);
      setError(null);
      await createCostCenter({
        name: name.trim(),
        code: code.trim() || null,
        description: description.trim() || null,
        active: true,
      });
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to create cost center');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '440px' }}>
        <div className="modal-header">
          <div className="modal-title-wrap">
            <span className="modal-icon">🏷️</span>
            <h2 className="modal-title">New Cost Center</h2>
          </div>
          <button className="modal-close-btn" onClick={onClose} aria-label="Close modal">
            ✕
          </button>
        </div>

        {error && <div className="modal-error-banner">{error}</div>}

        <form onSubmit={handleSubmit} className="modal-form">
          <div className="form-group">
            <label className="form-label">Cost Center Name *</label>
            <input
              type="text"
              className="form-input"
              placeholder="e.g. Engineering, Sales, Facilities"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              autoFocus
            />
          </div>

          <div className="form-group">
            <label className="form-label">Code / Ledger Symbol</label>
            <input
              type="text"
              className="form-input"
              placeholder="e.g. CC-101, ENG-RND"
              value={code}
              onChange={(e) => setCode(e.target.value)}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Description (Optional)</label>
            <textarea
              className="form-input"
              rows={2}
              placeholder="e.g. Department responsible for platform infrastructure"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <div className="modal-actions">
            <button type="button" className="btn-secondary" onClick={onClose} disabled={submitting}>
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={submitting}>
              {submitting ? 'Creating...' : 'Create Cost Center'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
