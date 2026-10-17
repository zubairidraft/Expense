import { useState, useEffect, useRef, useMemo } from 'react';
import { useAccounts } from '../../context/AccountContext';
import { useCategories } from '../../context/CategoryContext';
import { useTransactions } from '../../context/TransactionContext';
import { useWorkspace } from '../../context/WorkspaceContext';
import { useCurrency } from '../../context/CurrencyContext';
import { todayISO } from '../../lib/dates';

const QUICK_PRESETS = [
  { label: 'Groceries 🛒', name: 'Supermarket Groceries', categoryKey: 'food_groceries', kind: 'expense' },
  { label: 'Coffee ☕', name: 'Cafe & Coffee', categoryKey: 'dining_out', kind: 'expense' },
  { label: 'Dining 🍜', name: 'Restaurant Dinner', categoryKey: 'dining_out', kind: 'expense' },
  { label: 'Fuel / Ride 🚗', name: 'Transportation & Ride', categoryKey: 'transportation', kind: 'expense' },
  { label: 'Cloud / App ☁️', name: 'Software Subscription', categoryKey: 'software_tools', kind: 'expense' },
  { label: 'Client Income ⚡', name: 'Consulting Retainer', categoryKey: 'freelance', kind: 'income' },
];

export default function QuickAddModal({ isOpen, onClose, onOpenTransfer }) {
  const { accounts } = useAccounts();
  const { categories, expenseCategories, incomeCategories } = useCategories();
  const { addTransaction, isOnline } = useTransactions();
  const { currentWorkspace } = useWorkspace();
  const { convert, getEstimatedRate } = useCurrency() || {};

  const baseCurrency = currentWorkspace?.base_currency || 'USD';
  const amountInputRef = useRef(null);

  const [type, setType] = useState('expense'); // 'expense' | 'income' | 'transfer'
  const [date, setDate] = useState(todayISO());
  const [amount, setAmount] = useState('');
  const [payee, setPayee] = useState('');
  const [accountId, setAccountId] = useState('');
  const [toAccountId, setToAccountId] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [loading, setLoading] = useState(false);
  const [successToast, setSuccessToast] = useState('');

  // Find user's cash, bank, and card accounts for smart transfer presets
  const cashAccounts = useMemo(() => accounts.filter((a) => a.type === 'cash'), [accounts]);
  const bankAccounts = useMemo(() => accounts.filter((a) => a.type === 'bank' || a.type === 'checking' || a.type === 'savings'), [accounts]);
  const cardAccounts = useMemo(() => accounts.filter((a) => a.type === 'credit_card' || a.nature === 'liability'), [accounts]);

  // Autofocus when modal opens
  useEffect(() => {
    if (isOpen) {
      setSuccessToast('');
      setDate(todayISO());
      setTimeout(() => {
        amountInputRef.current?.focus();
      }, 50);
    }
  }, [isOpen]);

  // Default to second account for transfer destination if not set
  useEffect(() => {
    if (accounts.length > 1 && !toAccountId) {
      const other = accounts.find((a) => a.id !== (accountId || accounts[0]?.id));
      if (other) setToAccountId(other.id);
    }
  }, [accounts, accountId, toAccountId]);

  if (!isOpen) return null;

  const targetCategories = type === 'income' ? incomeCategories : expenseCategories;
  const effectiveAccountId = accountId || accounts[0]?.id || '';
  const effectiveToAccountId = toAccountId || (accounts.length > 1 ? accounts.find((a) => a.id !== effectiveAccountId)?.id || accounts[1]?.id : accounts[0]?.id || '');

  const fromAcc = accounts.find((a) => a.id === effectiveAccountId) || accounts[0];
  const toAcc = accounts.find((a) => a.id === effectiveToAccountId) || (accounts.length > 1 ? accounts[1] : accounts[0]);
  const isCrossCurrency = Boolean(fromAcc && toAcc && fromAcc.currency !== toAcc.currency);

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

  const handleTransferShortcut = (presetKey) => {
    setType('transfer');
    if (presetKey === 'cash-to-bank') {
      const src = cashAccounts[0] || accounts[0];
      const dest = bankAccounts[0] || accounts[1] || accounts[0];
      if (src) setAccountId(src.id);
      if (dest) setToAccountId(dest.id);
      setPayee('ATM Deposit to Bank');
    } else if (presetKey === 'bank-to-cash') {
      const src = bankAccounts[0] || accounts[0];
      const dest = cashAccounts[0] || accounts[1] || accounts[0];
      if (src) setAccountId(src.id);
      if (dest) setToAccountId(dest.id);
      setPayee('ATM Cash Withdrawal');
    } else if (presetKey === 'pay-card') {
      const src = bankAccounts[0] || accounts[0];
      const dest = cardAccounts[0] || accounts[1] || accounts[0];
      if (src) setAccountId(src.id);
      if (dest) setToAccountId(dest.id);
      setPayee('Credit Card Bill Payment');
    }
    amountInputRef.current?.focus();
  };

  const handleSwapAccounts = () => {
    const curFrom = effectiveAccountId;
    const curTo = effectiveToAccountId;
    setAccountId(curTo);
    setToAccountId(curFrom);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!amount || parseFloat(amount) <= 0) return;

    setLoading(true);

    if (type === 'transfer') {
      if (!fromAcc || !toAcc || fromAcc.id === toAcc.id) {
        alert('Please select two distinct accounts for the transfer.');
        setLoading(false);
        return;
      }

      if (fromAcc.is_shared && fromAcc.can_post === false) {
        alert(`Account "${fromAcc.name}" is shared as read-only. You cannot post transactions to it.`);
        setLoading(false);
        return;
      }

      let destAmount = amount;
      if (isCrossCurrency && convert) {
        destAmount = convert(amount, fromAcc.currency, toAcc.currency);
      }

      const res = await addTransaction({
        type: 'transfer',
        payeeName: payee.trim() || `${fromAcc.name} ➔ ${toAcc.name}`,
        date: date || todayISO(),
        status: 'cleared',
        source: 'manual',
        lines: [
          {
            accountId: fromAcc.id,
            direction: 'out',
            amount: amount,
            currency: fromAcc.currency || baseCurrency,
            description: `Transfer to ${toAcc.name}`,
          },
          {
            accountId: toAcc.id,
            direction: 'in',
            amount: destAmount,
            currency: toAcc.currency || baseCurrency,
            description: `Transfer from ${fromAcc.name}`,
          },
        ],
      });

      setLoading(false);

      if (res?.error) {
        setSuccessToast(`⚠️ ${res.error.message || 'Could not save'}`);
        return;
      }

      setSuccessToast(res.queuedOffline || !isOnline ? '⚡ Transfer saved to offline outbox!' : '✓ Transfer booked in <2s');
      setTimeout(() => {
        setAmount('');
        setPayee('');
        setDate(todayISO());
        onClose();
      }, 600);
      return;
    }

    const targetAccount = accounts.find((a) => a.id === effectiveAccountId) || accounts[0];

    if (!targetAccount) {
      alert('Please add at least one account first.');
      setLoading(false);
      return;
    }

    if (targetAccount.is_shared && targetAccount.can_post === false) {
      alert(`Account "${targetAccount.name}" is shared as read-only. You cannot post transactions to it.`);
      setLoading(false);
      return;
    }

    const res = await addTransaction({
      type,
      payeeName: payee.trim() || (type === 'income' ? 'Quick Income' : 'Quick Expense'),
      date: date || todayISO(),
      status: 'cleared',
      source: 'manual',
      lines: [
        {
          accountId: targetAccount.id,
          categoryId: effectiveCategoryId || null,
          direction: type === 'income' ? 'in' : 'out',
          amount: amount,
          currency: targetAccount.currency || baseCurrency,
          description: payee.trim() || 'Speed entry',
        },
      ],
    });

    setLoading(false);

    if (res?.error) {
      setSuccessToast(`⚠️ ${res.error.message || 'Could not save'}`);
      return;
    }

    if (res.queuedOffline || !isOnline) {
      setSuccessToast('⚡ Saved to offline outbox!');
    } else {
      setSuccessToast('✓ Transaction booked in <2s');
    }

    // Reset and close after brief flash
    setTimeout(() => {
      setAmount('');
      setPayee('');
      setDate(todayISO());
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
            {type === 'transfer' ? (
              <>
                <button
                  type="button"
                  className="preset-chip"
                  onClick={() => handleTransferShortcut('cash-to-bank')}
                >
                  Cash ➔ Bank 🏧
                </button>
                <button
                  type="button"
                  className="preset-chip"
                  onClick={() => handleTransferShortcut('bank-to-cash')}
                >
                  Bank ➔ Cash 💵
                </button>
                <button
                  type="button"
                  className="preset-chip"
                  onClick={() => handleTransferShortcut('pay-card')}
                >
                  Pay Credit Card 💳
                </button>
                {onOpenTransfer && (
                  <button
                    type="button"
                    className="preset-chip"
                    style={{ borderColor: 'var(--md-primary)', color: 'var(--md-primary)', fontWeight: 600 }}
                    onClick={() => {
                      onOpenTransfer({ fromAccountId: effectiveAccountId, toAccountId: effectiveToAccountId });
                      onClose();
                    }}
                  >
                    Full Transfer Dialog ↗️
                  </button>
                )}
              </>
            ) : (
              QUICK_PRESETS.map((p, idx) => (
                <button
                  type="button"
                  key={idx}
                  className="preset-chip"
                  onClick={() => handleSelectPreset(p)}
                >
                  {p.label}
                </button>
              ))
            )}
          </div>

          {/* Focal Big Money Input */}
          <div className="big-amount-wrapper">
            <span className="big-amount-currency">{type === 'transfer' ? fromAcc?.currency || baseCurrency : baseCurrency}</span>
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

          {/* Type Toggle */}
          <div className="type-selector" style={{ marginBottom: '0.75rem' }}>
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
            <button
              type="button"
              className={`type-btn transfer ${type === 'transfer' ? 'active' : ''}`}
              onClick={() => setType('transfer')}
            >
              ⇄ Transfer
            </button>
          </div>

          {/* Date & Payee */}
          <div className="form-row-2">
            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>
                📅 Date
              </label>
              <input
                type="date"
                required
                className="input-field"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                style={{ width: '100%', height: '42px' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>
                {type === 'transfer' ? '📝 Transfer Note' : '🏷️ Payee / Description'}
              </label>
              <input
                type="text"
                placeholder={type === 'transfer' ? 'Transfer description / remark' : 'e.g. Starbucks, Uber, Metro, Client'}
                className="input-field"
                value={payee}
                onChange={(e) => setPayee(e.target.value)}
                style={{ width: '100%', height: '42px' }}
              />
            </div>
          </div>

          {/* Account Fast Select */}
          {type === 'transfer' ? (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', width: '100%' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.2rem' }}>
                    From Account
                  </label>
                  <select
                    className="select-field"
                    value={effectiveAccountId}
                    onChange={(e) => setAccountId(e.target.value)}
                    style={{ width: '100%' }}
                  >
                    {accounts.map((a) => (
                      <option
                        key={a.id}
                        value={a.id}
                        disabled={a.is_shared && a.can_post === false}
                      >
                        {a.name} ({a.currency || baseCurrency})
                      </option>
                    ))}
                  </select>
                </div>

                <button
                  type="button"
                  onClick={handleSwapAccounts}
                  title="Swap accounts"
                  style={{
                    alignSelf: 'flex-end',
                    marginBottom: '2px',
                    height: '42px',
                    width: '42px',
                    borderRadius: '8px',
                    background: 'rgba(var(--md-on-surface-rgb), 0.08)',
                    border: '1px solid rgba(var(--md-on-surface-rgb), 0.15)',
                    color: 'var(--md-on-surface)',
                    cursor: 'pointer',
                    fontSize: '1.1rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  ⇄
                </button>

                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.2rem' }}>
                    To Account
                  </label>
                  <select
                    className="select-field"
                    value={effectiveToAccountId}
                    onChange={(e) => setToAccountId(e.target.value)}
                    style={{ width: '100%' }}
                  >
                    {accounts.map((a) => (
                      <option
                        key={a.id}
                        value={a.id}
                        disabled={a.id === effectiveAccountId}
                      >
                        {a.name} ({a.currency || baseCurrency})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {isCrossCurrency && (
                <div style={{ marginTop: '0.4rem', fontSize: '0.78rem', color: 'var(--text-secondary)', textAlign: 'right' }}>
                  💱 Multi-currency: {fromAcc?.currency} ➔ {toAcc?.currency}
                </div>
              )}
            </div>
          ) : (
            <div className="form-row-2">
              <select
                className="select-field"
                value={effectiveAccountId}
                onChange={(e) => setAccountId(e.target.value)}
              >
                {accounts.map((a) => (
                  <option
                    key={a.id}
                    value={a.id}
                    disabled={a.is_shared && a.can_post === false}
                  >
                    {a.name} ({a.currency}){a.is_shared ? ` (Shared${a.can_post === false ? ' - Read Only' : ''})` : ''}
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
          )}

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
