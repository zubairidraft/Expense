import { useState } from 'react';
import { useCategories } from '../../context/CategoryContext';

const EMOJI_OPTIONS = [
  '🛒', '🏠', '💡', '🚗', '💊', '🎓',
  '🍜', '🎬', '🛍️', '✈️', '☁️', '📦',
  '💼', '⚡', '📈', '🏢', '💰', '🏋️',
  '☕', '🎁', '🐶', '📚', '💻', '🛠️'
];

const COLOR_OPTIONS = [
  '#6366f1', '#10b981', '#f59e0b', '#ec4899',
  '#06b6d4', '#3b82f6', '#8b5cf6', '#f43f5e',
  '#14b8a6', '#d946ef', '#0ea5e9', '#64748b'
];

export default function CreateCategoryModal({ isOpen, onClose }) {
  const { categories, createCategory } = useCategories();

  const [name, setName] = useState('');
  const [kind, setKind] = useState('expense');
  const [isEssential, setIsEssential] = useState(true);
  const [icon, setIcon] = useState('📦');
  const [color, setColor] = useState('#6366f1');
  const [parentId, setParentId] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  if (!isOpen) return null;

  // Potential parent categories (must be top-level and same kind)
  const availableParents = categories.filter(
    (c) => c.kind === kind && !c.parent_id
  );

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;

    setLoading(true);
    setErrorMsg('');

    const res = await createCategory({
      name: name.trim(),
      kind,
      isEssential: kind === 'expense' ? isEssential : false,
      icon,
      color,
      parentId: parentId || null,
    });

    setLoading(false);
    if (!res.error) {
      setName('');
      setIcon('📦');
      setParentId('');
      onClose();
    } else {
      setErrorMsg(res.error.message || 'Failed to create category');
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-content glass-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title-group">
            <h2 className="modal-title">Create Category</h2>
            <p className="modal-subtitle">
              Organize transactions with hierarchical classification & 50/30/20 budget tagging
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
          {/* Kind Selector */}
          <div className="form-group">
            <label>Category Type</label>
            <div className="type-selector">
              <button
                type="button"
                className={`type-btn expense ${kind === 'expense' ? 'active' : ''}`}
                onClick={() => {
                  setKind('expense');
                  setParentId('');
                }}
              >
                📉 Expense
              </button>
              <button
                type="button"
                className={`type-btn income ${kind === 'income' ? 'active' : ''}`}
                onClick={() => {
                  setKind('income');
                  setParentId('');
                }}
              >
                📈 Income
              </button>
            </div>
          </div>

          {/* Category Name */}
          <div className="form-group">
            <label htmlFor="cat-name">Category Name</label>
            <input
              id="cat-name"
              type="text"
              required
              placeholder="e.g. Gym & Fitness, Organic Produce, Subscriptions"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="input-field"
            />
          </div>

          {/* Essential / Discretionary Toggle for Expenses */}
          {kind === 'expense' && (
            <div className="form-group">
              <label>Needs vs. Wants Classification</label>
              <div className="radio-tile-group">
                <label className={`radio-tile ${isEssential ? 'selected' : ''}`}>
                  <input
                    type="radio"
                    name="essentiality"
                    checked={isEssential}
                    onChange={() => setIsEssential(true)}
                  />
                  <div className="radio-tile-content">
                    <span className="tile-title">🛡️ Need (Essential)</span>
                    <span className="tile-desc">Vital for survival & baseline living (rent, groceries, healthcare)</span>
                  </div>
                </label>

                <label className={`radio-tile ${!isEssential ? 'selected' : ''}`}>
                  <input
                    type="radio"
                    name="essentiality"
                    checked={!isEssential}
                    onChange={() => setIsEssential(false)}
                  />
                  <div className="radio-tile-content">
                    <span className="tile-title">✨ Want (Discretionary)</span>
                    <span className="tile-desc">Lifestyle, entertainment, dining out, recreation</span>
                  </div>
                </label>
              </div>
            </div>
          )}

          {/* Parent Category (Optional Hierarchy) */}
          <div className="form-group">
            <label htmlFor="parent-category">Parent Category (Optional Subcategory)</label>
            <select
              id="parent-category"
              className="select-field"
              value={parentId}
              onChange={(e) => setParentId(e.target.value)}
            >
              <option value="">None (Top-Level Category)</option>
              {availableParents.map((parent) => (
                <option key={parent.id} value={parent.id}>
                  {parent.icon} {parent.name}
                </option>
              ))}
            </select>
          </div>

          {/* Icon Picker */}
          <div className="form-group">
            <label>Select Icon</label>
            <div className="emoji-grid">
              {EMOJI_OPTIONS.map((em) => (
                <button
                  type="button"
                  key={em}
                  className={`emoji-btn ${icon === em ? 'active' : ''}`}
                  onClick={() => setIcon(em)}
                >
                  {em}
                </button>
              ))}
            </div>
          </div>

          {/* Color Picker */}
          <div className="form-group">
            <label>Select Accent Color</label>
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
              {loading ? 'Creating...' : 'Create Category'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
