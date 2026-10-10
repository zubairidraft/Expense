import { useState, useEffect } from 'react';
import { useSharedDebts } from '../../context/SharedDebtsContext';
import { useWorkspace } from '../../context/WorkspaceContext';
import { useAccounts } from '../../context/AccountContext';
import MoneyInput from '../ui/MoneyInput';

export default function CreateDebtModal({ isOpen, onClose, onOpenAddContact }) {
  const { contacts, createDebt } = useSharedDebts();
  const { currentWorkspace } = useWorkspace();
  const { accounts } = useAccounts();

  const [direction, setDirection] = useState('lent'); // 'lent' (they owe me) vs 'borrowed' (I owe them)
  const [contactId, setContactId] = useState(contacts[0]?.id || '');
  const [accountId, setAccountId] = useState(accounts[0]?.id || '');
  const [principal, setPrincipal] = useState('0.00');
  const [dueDate, setDueDate] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (accounts?.length && !accountId) {
      setAccountId(accounts[0].id);
    }
  }, [accounts, accountId]);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!contactId) {
      setError('Please select a contact');
      return;
    }
    if (parseFloat(principal) <= 0) {
      setError('Principal amount must be greater than zero');
      return;
    }

    try {
      setSubmitting(true);
      setError(null);
      await createDebt({
        contactId,
        direction,
        principal,
        // Loan currency follows the funding account (if any) so the ledger line is consistent
        currency: accounts.find((a) => a.id === accountId)?.currency || currentWorkspace?.base_currency || 'USD',
        dueDate: dueDate || null,
        notes: notes.trim() || null,
        accountId: accountId || null,
      });
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to record debt');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '480px' }}>
        <div className="modal-header">
          <div className="modal-title-wrap">
            <span className="modal-icon">{direction === 'lent' ? '🤝' : '📥'}</span>
            <h2 className="modal-title">Record Personal Debt (Udhaar)</h2>
          </div>
          <button className="modal-close-btn" onClick={onClose} aria-label="Close modal">
            ✕
          </button>
        </div>

        {error && <div className="modal-error-banner">{error}</div>}

        <form onSubmit={handleSubmit} className="modal-form">
          {/* Direction Toggle */}
          <div className="form-group">
            <label className="form-label">Debt Type</label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <button
                type="button"
                className={`btn-filter ${direction === 'lent' ? 'active' : ''}`}
                onClick={() => setDirection('lent')}
                style={{
                  padding: '0.6rem',
                  borderRadius: '8px',
                  background: direction === 'lent' ? 'rgba(var(--md-success-rgb), 0.2)' : 'rgba(var(--md-on-surface-rgb), 0.04)',
                  borderColor: direction === 'lent' ? 'var(--md-success)' : 'transparent',
                  color: direction === 'lent' ? 'var(--md-success)' : 'var(--md-on-surface-variant)',
                  fontWeight: 600,
                  fontSize: '0.88rem',
                }}
              >
                💚 I Lent (They owe me)
              </button>
              <button
                type="button"
                className={`btn-filter ${direction === 'borrowed' ? 'active' : ''}`}
                onClick={() => setDirection('borrowed')}
                style={{
                  padding: '0.6rem',
                  borderRadius: '8px',
                  background: direction === 'borrowed' ? 'rgba(var(--md-warning-rgb), 0.2)' : 'rgba(var(--md-on-surface-rgb), 0.04)',
                  borderColor: direction === 'borrowed' ? 'var(--md-warning)' : 'transparent',
                  color: direction === 'borrowed' ? 'var(--md-warning)' : 'var(--md-on-surface-variant)',
                  fontWeight: 600,
                  fontSize: '0.88rem',
                }}
              >
                🧡 I Borrowed (I owe them)
              </button>
            </div>
          </div>

          <div className="form-group">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <label className="form-label" style={{ margin: 0 }}>Contact / Peer *</label>
              {onOpenAddContact && (
                <button
                  type="button"
                  onClick={onOpenAddContact}
                  className="btn-text"
                  style={{ fontSize: '0.78rem', color: 'var(--md-primary)' }}
                >
                  + Add Contact
                </button>
              )}
            </div>
            <select
              className="form-input"
              value={contactId}
              onChange={(e) => setContactId(e.target.value)}
              required
            >
              <option value="">Select a contact...</option>
              {contacts.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} {c.phone ? `(${c.phone})` : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Account Allocation */}
          <div className="form-group">
            <label className="form-label">
              {direction === 'borrowed' ? '📥 Deposit Borrowed Funds Into Account *' : '📤 Disburse Lent Funds From Account *'}
            </label>
            <select
              className="form-input"
              value={accountId}
              onChange={(e) => setAccountId(e.target.value)}
              required
            >
              <option value="">Select account...</option>
              {accounts.map((acc) => (
                <option key={acc.id} value={acc.id}>
                  {acc.icon || '💳'} {acc.name} ({acc.currency})
                </option>
              ))}
            </select>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary, var(--md-on-surface-variant))', marginTop: '0.3rem' }}>
              {direction === 'borrowed'
                ? '💡 Funds will be added directly into this account balance.'
                : '💡 Funds will be deducted directly from this account balance.'}
            </div>
          </div>

          <div className="form-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div className="form-group">
              <label className="form-label">Principal Amount *</label>
              <MoneyInput
                value={principal}
                onChange={setPrincipal}
                currencyCode={currentWorkspace?.base_currency || 'USD'}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Expected Due Date</label>
              <input
                type="date"
                className="form-input"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Reason / Notes (Optional)</label>
            <input
              type="text"
              className="form-input"
              placeholder="e.g. Cash loan, emergency bridge fund, travel Udhaar"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          <div className="modal-actions">
            <button type="button" className="btn-secondary" onClick={onClose} disabled={submitting}>
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={submitting || !contactId}>
              {submitting ? 'Saving...' : 'Record Debt'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
