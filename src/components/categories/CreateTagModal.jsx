import { useState } from 'react';
import { useCategories } from '../../context/CategoryContext';

const COLOR_OPTIONS = [
  '#8b5cf6', '#ec4899', '#3b82f6', '#10b981',
  '#f59e0b', '#06b6d4', '#f43f5e', '#6366f1',
  '#14b8a6', '#64748b'
];

export default function CreateTagModal({ isOpen, onClose }) {
  const { createTag } = useCategories();

  const [name, setName] = useState('');
  const [color, setColor] = useState('#8b5cf6');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;

    setLoading(true);
    setErrorMsg('');

    const res = await createTag({
      name: name.trim(),
      color,
    });

    setLoading(false);
    if (!res.error) {
      setName('');
      onClose();
    } else {
      setErrorMsg(res.error.message || 'Failed to create tag');
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-content glass-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title-group">
            <h2 className="modal-title">Create Custom Tag</h2>
            <p className="modal-subtitle">
              Add flexible cross-cutting labels for projects, tax, or life events
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
            <label htmlFor="tag-name">Tag Label</label>
            <input
              id="tag-name"
              type="text"
              required
              placeholder="e.g. Tax Deductible, Dubai Trip 2026, Reimbursable"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="input-field"
            />
          </div>

          <div className="form-group">
            <label>Tag Accent Color</label>
            <div className="color-grid">
              {COLOR_OPTIONS.map((c) => (
                <button
                  type="button"
                  key={c}
                  className={`color-btn ${color === c ? 'active' : ''}`}
                  style={{ backgroundColor: c }}
                  onClick={() => setColor(c)}
                  aria-label={`Select color ${c}`}
                />
              ))}
            </div>
          </div>

          <div className="modal-actions" style={{ marginTop: '1.5rem' }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onClose}
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary primary-glow"
              disabled={loading}
            >
              {loading ? 'Creating...' : 'Create Tag'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
