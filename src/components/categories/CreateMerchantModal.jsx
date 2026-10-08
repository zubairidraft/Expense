import { useState } from 'react';
import { useCategories } from '../../context/CategoryContext';

export default function CreateMerchantModal({ isOpen, onClose }) {
  const { categories, createMerchant } = useCategories();

  const [name, setName] = useState('');
  const [aliasesInput, setAliasesInput] = useState('');
  const [defaultCategoryId, setDefaultCategoryId] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;

    setLoading(true);
    setErrorMsg('');

    // Parse comma-separated aliases
    const aliases = aliasesInput
      .split(',')
      .map((a) => a.trim())
      .filter((a) => a.length > 0);

    const res = await createMerchant({
      name: name.trim(),
      aliases,
      defaultCategoryId: defaultCategoryId || null,
      logoUrl: logoUrl.trim() || null,
    });

    setLoading(false);
    if (!res.error) {
      setName('');
      setAliasesInput('');
      setDefaultCategoryId('');
      setLogoUrl('');
      onClose();
    } else {
      setErrorMsg(res.error.message || 'Failed to create merchant');
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-content glass-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title-group">
            <h2 className="modal-title">Register Merchant or Payee</h2>
            <p className="modal-subtitle">
              Teach Expense Tracker to recognize bank statement aliases & auto-assign categories
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
            <label htmlFor="merch-name">Merchant Display Name</label>
            <input
              id="merch-name"
              type="text"
              required
              placeholder="e.g. Carrefour, Amazon, Deliveroo, Meezan Bank"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="input-field"
            />
          </div>

          <div className="form-group">
            <label htmlFor="merch-aliases">Recognized Aliases (Comma-separated)</label>
            <input
              id="merch-aliases"
              type="text"
              placeholder="e.g. CRFR MOE, CARREFOUR EXPRESS, MAF CARREFOUR"
              value={aliasesInput}
              onChange={(e) => setAliasesInput(e.target.value)}
              className="input-field"
            />
            <small style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', marginTop: '0.25rem' }}>
              Used by statement parsers, SMS alerts, and ledger auto-categorizers
            </small>
          </div>

          <div className="form-group">
            <label htmlFor="merch-default-cat">Default Category</label>
            <select
              id="merch-default-cat"
              className="select-field"
              value={defaultCategoryId}
              onChange={(e) => setDefaultCategoryId(e.target.value)}
            >
              <option value="">No Default Category</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.icon} {cat.name} ({cat.kind})
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="merch-logo">Logo / Favicon URL (Optional)</label>
            <input
              id="merch-logo"
              type="url"
              placeholder="https://example.com/logo.png"
              value={logoUrl}
              onChange={(e) => setLogoUrl(e.target.value)}
              className="input-field"
            />
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
              {loading ? 'Registering...' : 'Register Merchant'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
