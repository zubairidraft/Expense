import { useState, useEffect, useRef } from 'react';
import { useAccounts } from '../../context/AccountContext';
import { useCategories } from '../../context/CategoryContext';
import { useTransactions } from '../../context/TransactionContext';
import { useWorkspace } from '../../context/WorkspaceContext';

const QUICK_PRESETS = [
  { label: 'Groceries 🛒', name: 'Supermarket Groceries', categoryKey: 'food_groceries', kind: 'expense' },
  { label: 'Coffee ☕', name: 'Cafe & Coffee', categoryKey: 'dining_out', kind: 'expense' },
  { label: 'Dining 🍜', name: 'Restaurant Dinner', categoryKey: 'dining_out', kind: 'expense' },
  { label: 'Fuel / Ride 🚗', name: 'Transportation & Ride', categoryKey: 'transportation', kind: 'expense' },
  { label: 'Cloud / App ☁️', name: 'Software Subscription', categoryKey: 'software_tools', kind: 'expense' },
  { label: 'Client Income ⚡', name: 'Consulting Retainer', categoryKey: 'freelance', kind: 'income' },
];

export default function QuickAddModal({ isOpen, onClose }) {
  const { accounts } = useAccounts();
  const { categories, expenseCategories, incomeCategories } = useCategories();
  const { addTransaction, isOnline } = useTransactions();
  const { currentWorkspace } = useWorkspace();

  const baseCurrency = currentWorkspace?.base_currency || 'USD';
  const amountInputRef = useRef(null);

  const [type, setType] = useState('expense');
  const [amount, setAmount] = useState('');
  const [payee, setPayee] = useState('');
  const [accountId, setAccountId] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [loading, setLoading] = useState(false);
  const [successToast, setSuccessToast] = useState('');

  // Autofocus when modal opens
  useEffect(() => {
    if (isOpen) {
      setSuccessToast('');
      setTimeout(() => {
        amountInputRef.current?.focus();
      }, 50);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const targetCategories = type === 'income' ? incomeCategories : expenseCategories;
  const effectiveAccountId = accountId || accounts[0]?.id || '';
  const effectiveCategoryId = categoryId || targetCategories[0]?.id || '';

  const handleSelectPreset = (preset) => {
    setType(preset.kind);
    setPayee(preset.name);

    // Find category matching system_key or fallback
    const matched = categories.find((c) => c.system_key === preset.categoryKey);
    if (matched) {
      setCategoryId(matched.id);
    }
    amountInputRef.current?.focus();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!amount || parseFloat(amount) <= 0) return;

    setLoading(true);
    const targetAccount = accounts.find((a) => a.id === effectiveAccountId) || accounts[0];

    if (!targetAccount) {
      alert('Please add at least one account first.');
      setLoading(false);
      return;
    }

    const res = await addTransaction({
      type,
      payeeName: payee.trim() || (type === 'income' ? 'Quick Income' : 'Quick Expense'),
      date: new Date().toISOString().split('T')[0],
      status: 'cleared',
      source: 'manual',
      lines: [
        {
          accountId: targetAccount.id,
          categoryId: effectiveCategoryId || null,
          direction: type === 'income' ? 'in' : 'out',
          amount: amount,
          currency: targetAccount.currency || baseCurrency,
          baseAmount: amount,
          description: payee.trim() || 'Speed entry',
        },
      ],
    });

    setLoading(false);

    if (res.queuedOffline || !isOnline) {
      setSuccessToast('⚡ Saved to offline outbox!');
    } else {
      setSuccessToast('✓ Transaction booked in <2s');
    }

    // Reset and close after brief flash
    setTimeout(() => {
      setAmount('');
      setPayee('');
      onClose();
    }, 600);
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-content glass-card quick-add-card" onClick={(e) => e.stopPropagation()}>
        <div className="quick-add-header">
          <div className="quick-add-title-group">
            <span className="quick-add-bolt">⚡</span>
            <div>
              <h2 className="quick-add-title">Quick Add Transaction</h2>
              <span className="quick-add-sub">Sub-10 second speed entry · Works 100% offline</span>
            </div>
          </div>

          <button className="modal-close-btn" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>

        {successToast && (
          <div className="quick-add-success-banner">
            <span>{successToast}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="quick-add-form">
          {/* Quick Presets Cloud */}
          <div className="quick-presets-scroll">
            {QUICK_PRESETS.map((p, idx) => (
              <button
                type="button"
                key={idx}
                className="preset-chip"
                onClick={() => handleSelectPreset(p)}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Focal Big Money Input */}
          <div className="big-amount-wrapper">
            <span className="big-amount-currency">{baseCurrency}</span>
            <input
              ref={amountInputRef}
              type="number"
              step="0.01"
              required
              placeholder="0.00"
              className="big-amount-input"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>

          {/* Type Toggle & Payee */}
          <div className="form-row-2">
            <div className="type-selector" style={{ marginBottom: 0 }}>
              <button
                type="button"
                className={`type-btn expense ${type === 'expense' ? 'active' : ''}`}
                onClick={() => setType('expense')}
              >
                📉 Outflow
              </button>
              <button
                type="button"
                className={`type-btn income ${type === 'income' ? 'active' : ''}`}
                onClick={() => setType('income')}
              >
                📈 Inflow
              </button>
            </div>

            <input
              type="text"
              placeholder="Payee / Description (e.g. Starbucks, Uber, Metro)"
              className="input-field"
              value={payee}
              onChange={(e) => setPayee(e.target.value)}
            />
          </div>

          {/* Account & Category Fast Select */}
          <div className="form-row-2">
            <select
              className="select-field"
              value={effectiveAccountId}
              onChange={(e) => setAccountId(e.target.value)}
            >
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name} ({a.currency})
                </option>
              ))}
            </select>

            <select
              className="select-field"
              value={effectiveCategoryId}
              onChange={(e) => setCategoryId(e.target.value)}
            >
              {targetCategories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.icon} {c.name}
                </option>
              ))}
            </select>
          </div>

          <div className="quick-add-footer">
            <span className="shortcut-hint">Tip: Press Enter to log instantly</span>
            <button
              type="submit"
              className="submit-btn primary-glow"
              disabled={loading}
              style={{ width: 'auto', minWidth: '160px' }}
            >
              {loading ? 'Logging...' : '⚡ Instant Log'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
