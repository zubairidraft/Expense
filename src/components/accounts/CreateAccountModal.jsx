import { useState } from 'react';
import { useAccounts } from '../../context/AccountContext';
import { useWorkspace } from '../../context/WorkspaceContext';
import { CURRENCY_REGISTRY } from '../../lib/formatters';
import MoneyInput from '../ui/MoneyInput';

const ACCOUNT_TYPE_CONFIG = {
  bank: { label: 'Bank Account', icon: '🏦', defaultNature: 'asset' },
  cash: { label: 'Physical Cash', icon: '💵', defaultNature: 'asset' },
  card: { label: 'Credit Card', icon: '💳', defaultNature: 'liability' },
  savings: { label: 'Savings Vault', icon: '🪙', defaultNature: 'asset' },
  wallet: { label: 'Mobile Wallet', icon: '📱', defaultNature: 'asset' },
  e_wallet: { label: 'Crypto / E-Wallet', icon: '🌐', defaultNature: 'asset' },
  investment: { label: 'Investment Portfolio', icon: '📈', defaultNature: 'asset' },
  loan: { label: 'Bank Loan', icon: '📑', defaultNature: 'liability' },
  bnpl: { label: 'BNPL / Installment', icon: '🛍️', defaultNature: 'liability' },
};

export default function CreateAccountModal({ isOpen, onClose }) {
  const { createAccount } = useAccounts();
  const { currentWorkspace } = useWorkspace();

  const [name, setName] = useState('');
  const [type, setType] = useState('bank');
  const [nature, setNature] = useState('asset');
  const [currency, setCurrency] = useState(currentWorkspace?.base_currency || 'USD');
  const [openingBalance, setOpeningBalance] = useState('0.00');
  const [creditLimit, setCreditLimit] = useState('');
  const [visibility, setVisibility] = useState('shared');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  if (!isOpen) return null;

  const handleTypeChange = (newType) => {
    setType(newType);
    setNature(ACCOUNT_TYPE_CONFIG[newType]?.defaultNature || 'asset');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;

    setLoading(true);
    setErrorMsg('');

    const res = await createAccount({
      name: name.trim(),
      type,
      nature,
      currency,
      openingBalance: openingBalance || '0.00',
      creditLimit: nature === 'liability' && creditLimit ? creditLimit : null,
      visibility,
      icon: ACCOUNT_TYPE_CONFIG[type]?.icon || '🏦',
    });

    setLoading(false);
    if (!res.error) {
      setName('');
      setOpeningBalance('0.00');
      setCreditLimit('');
      onClose();
    } else {
      setErrorMsg(res.error.message || 'Failed to create account');
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-content glass-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title-group">
            <h2 className="modal-title">Add Account or Vault</h2>
            <p className="modal-subtitle">
              Register a financial source or liability to track authoritative balances
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
            <label htmlFor="acc-name">Account Name</label>
            <input
              id="acc-name"
              type="text"
              required
              placeholder="e.g. Standard Chartered Checking, Cash Drawer"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="input-field"
            />
          </div>

          <div className="form-row-2">
            <div className="form-group">
              <label htmlFor="acc-type">Account Type</label>
              <select
                id="acc-type"
                value={type}
                onChange={(e) => handleTypeChange(e.target.value)}
                className="input-field"
              >
                {Object.entries(ACCOUNT_TYPE_CONFIG).map(([key, config]) => (
                  <option key={key} value={key}>
                    {config.icon} {config.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="acc-nature">Financial Nature</label>
              <select
                id="acc-nature"
                value={nature}
                onChange={(e) => setNature(e.target.value)}
                className="input-field"
              >
                <option value="asset">Asset (Money you own)</option>
                <option value="liability">Liability (Money you owe)</option>
              </select>
            </div>
          </div>

          <div className="form-row-2">
            <div className="form-group">
              <label htmlFor="acc-currency">Currency</label>
              <select
                id="acc-currency"
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className="input-field"
              >
                {Object.entries(CURRENCY_REGISTRY).map(([code, cur]) => (
                  <option key={code} value={code}>
                    {code} ({cur.symbol})
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="acc-visibility">Visibility</label>
              <select
                id="acc-visibility"
                value={visibility}
                onChange={(e) => setVisibility(e.target.value)}
                className="input-field"
              >
                <option value="shared">Shared (All workspace members)</option>
                <option value="private">Private (Only you & owner)</option>
              </select>
            </div>
          </div>

          <div className="form-group">
            <MoneyInput
              id="acc-opening-bal"
              label="Opening Balance"
              value={openingBalance}
              onChange={setOpeningBalance}
              currencyCode={currency}
              placeholder="0.00"
              required
            />
          </div>

          {nature === 'liability' && (
            <div className="form-group">
              <MoneyInput
                id="acc-credit-limit"
                label="Credit Limit (Optional)"
                value={creditLimit}
                onChange={setCreditLimit}
                currencyCode={currency}
                placeholder="10000.00"
              />
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="submit-btn primary-glow"
          >
            {loading ? 'Creating...' : 'Create Account'}
          </button>
        </form>
      </div>
    </div>
  );
}
