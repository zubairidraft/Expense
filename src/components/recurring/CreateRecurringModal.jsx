import { useState } from 'react';
import { useRecurring } from '../../context/RecurringContext';
import { useAccounts } from '../../context/AccountContext';
import { useCategories } from '../../context/CategoryContext';
import { useWorkspace } from '../../context/WorkspaceContext';
import MoneyInput from '../ui/MoneyInput';

export default function CreateRecurringModal({ isOpen, onClose }) {
  const { createRecurringProfile } = useRecurring();
  const { accounts } = useAccounts();
  const { expenseCategories, incomeCategories } = useCategories();
  const { currentWorkspace } = useWorkspace();

  const baseCurrency = currentWorkspace?.base_currency || 'USD';

  const [title, setTitle] = useState('');
  const [type, setType] = useState('expense');
  const [frequency, setFrequency] = useState('monthly');
  const [interval, setInterval] = useState(1);
  const [amount, setAmount] = useState('');
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [nextDueDate, setNextDueDate] = useState(new Date().toISOString().split('T')[0]);
  const [accountId, setAccountId] = useState(accounts[0]?.id || '');
  const [categoryId, setCategoryId] = useState('');
  const [autoPost, setAutoPost] = useState(false);
  const [reminderDays, setReminderDays] = useState(3);
  const [notes, setNotes] = useState('');

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  if (!isOpen) return null;

  const categories = type === 'income' ? incomeCategories : expenseCategories;
  const effectiveCategoryId = categoryId || categories[0]?.id || '';

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');

    if (!title.trim()) {
      setErrorMsg('Please specify a title for the recurring bill.');
      return;
    }

    if (!amount || parseFloat(amount) <= 0) {
      setErrorMsg('Please enter a valid amount.');
      return;
    }

    setLoading(true);
    try {
      const { error } = await createRecurringProfile({
        title: title.trim(),
        type,
        frequency,
        interval: Number(interval),
        startDate,
        nextDueDate,
        amount,
        currency: baseCurrency,
        accountId: accountId || accounts[0]?.id || null,
        categoryId: effectiveCategoryId || null,
        autoPost,
        reminderDaysBefore: Number(reminderDays),
        notes: notes.trim() || null,
      });

      if (error) {
        setErrorMsg(error.message || 'Failed to create recurring profile.');
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
        style={{ maxWidth: '640px', maxHeight: '90vh', overflowY: 'auto' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <div>
            <h2 className="modal-title">🔁 New Recurring Profile</h2>
            <p className="modal-subtitle">
              Schedule recurring expenses, subscriptions, bills, and income retainers.
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

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
          <div>
            <label className="input-label" htmlFor="rec-title">
              Bill / Subscription Title *
            </label>
            <input
              id="rec-title"
              type="text"
              className="input-field"
              placeholder="e.g. Netflix Premium, House Rent, AWS Cloud"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div>
              <label className="input-label">Type</label>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button
                  type="button"
                  className={`acc-filter-btn ${type === 'expense' ? 'active' : ''}`}
                  onClick={() => setType('expense')}
                  style={{ flex: 1 }}
                >
                  📉 Expense
                </button>
                <button
                  type="button"
                  className={`acc-filter-btn ${type === 'income' ? 'active' : ''}`}
                  onClick={() => setType('income')}
                  style={{ flex: 1 }}
                >
                  📈 Income
                </button>
              </div>
            </div>

            <div>
              <label className="input-label" htmlFor="rec-freq">
                Frequency
              </label>
              <select
                id="rec-freq"
                className="input-field"
                value={frequency}
                onChange={(e) => setFrequency(e.target.value)}
              >
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="biweekly">Bi-weekly (Every 2 weeks)</option>
                <option value="monthly">Monthly</option>
                <option value="quarterly">Quarterly (Every 3 months)</option>
                <option value="yearly">Yearly / Annual</option>
              </select>
            </div>
          </div>

          <div>
            <MoneyInput
              id="rec-amount"
              label="Recurring Amount *"
              value={amount}
              onChange={setAmount}
              currencyCode={baseCurrency}
              placeholder="0.00"
              required
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div>
              <label className="input-label" htmlFor="rec-start-date">
                Start Date
              </label>
              <input
                id="rec-start-date"
                type="date"
                className="input-field"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                required
              />
            </div>

            <div>
              <label className="input-label" htmlFor="rec-next-due">
                Next Due Date *
              </label>
              <input
                id="rec-next-due"
                type="date"
                className="input-field"
                value={nextDueDate}
                onChange={(e) => setNextDueDate(e.target.value)}
                required
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div>
              <label className="input-label" htmlFor="rec-account">
                Financial Account
              </label>
              <select
                id="rec-account"
                className="input-field"
                value={accountId || accounts[0]?.id || ''}
                onChange={(e) => setAccountId(e.target.value)}
              >
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name} ({a.currency})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="input-label" htmlFor="rec-category">
                Category
              </label>
              <select
                id="rec-category"
                className="input-field"
                value={effectiveCategoryId}
                onChange={(e) => setCategoryId(e.target.value)}
              >
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.icon || '🏷️'} {c.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div
            style={{
              padding: '0.85rem 1rem',
              borderRadius: '8px',
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(255,255,255,0.06)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <div>
              <strong style={{ fontSize: '0.9rem', color: '#f8fafc' }}>
                Auto-Book to Ledger
              </strong>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted, #94a3b8)', margin: 0 }}>
                Automatically record transaction on due date via backend scheduler.
              </p>
            </div>
            <input
              type="checkbox"
              checked={autoPost}
              onChange={(e) => setAutoPost(e.target.checked)}
              style={{ width: '18px', height: '18px', accentColor: '#6366f1', cursor: 'pointer' }}
            />
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
              {loading ? 'Creating...' : '🔁 Create Recurring Profile'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
