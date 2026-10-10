import { useState, useMemo } from 'react';
import { useSharedDebts } from '../../context/SharedDebtsContext';
import { useWorkspace } from '../../context/WorkspaceContext';
import MoneyInput from '../ui/MoneyInput';
import {
  calculateEqualSplit,
  calculatePercentSplit,
  calculateSharesSplit,
  validateExactSplit,
} from '@universal-expense/core';

export default function CreateSharedExpenseModal({ isOpen, onClose, onOpenAddContact }) {
  const { contacts, createSharedExpense } = useSharedDebts();
  const { currentWorkspace } = useWorkspace();

  const [title, setTitle] = useState('');
  const [totalAmount, setTotalAmount] = useState('0.00');
  const [payerContactId, setPayerContactId] = useState(''); // empty = paid by current user ('me')
  const [splitMethod, setSplitMethod] = useState('equal');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  // Selected participant contact IDs
  const [selectedContacts, setSelectedContacts] = useState(contacts.map((c) => c.id));
  // Custom values for exact/percent/shares: { [contactId]: value }
  const [customValues, setCustomValues] = useState({});

  const calculatedSplits = useMemo(() => {
    const total = parseFloat(totalAmount || 0);
    if (total <= 0 || !selectedContacts.length) return [];

    try {
      if (splitMethod === 'equal') {
        return calculateEqualSplit(totalAmount, selectedContacts);
      }

      if (splitMethod === 'percent') {
        const config = selectedContacts.map((id) => ({
          contactId: id,
          percentage: parseFloat(customValues[id] || (100 / selectedContacts.length).toFixed(1)),
        }));
        return calculatePercentSplit(totalAmount, config);
      }

      if (splitMethod === 'shares') {
        const config = selectedContacts.map((id) => ({
          contactId: id,
          shares: parseFloat(customValues[id] || 1),
        }));
        return calculateSharesSplit(totalAmount, config);
      }

      if (splitMethod === 'exact') {
        return selectedContacts.map((id) => ({
          contactId: id,
          shareAmount: parseFloat(customValues[id] || 0).toFixed(2),
        }));
      }
    } catch {
      return [];
    }
    return [];
  }, [totalAmount, selectedContacts, splitMethod, customValues]);

  if (!isOpen) return null;

  const toggleContact = (id) => {
    setSelectedContacts((prev) =>
      prev.includes(id) ? prev.filter((cId) => cId !== id) : [...prev, id]
    );
  };

  const handleCustomValueChange = (contactId, val) => {
    setCustomValues((prev) => ({ ...prev, [contactId]: val }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim()) {
      setError('Expense title is required');
      return;
    }
    if (parseFloat(totalAmount) <= 0) {
      setError('Amount must be greater than zero');
      return;
    }
    if (selectedContacts.length === 0) {
      setError('Please select at least one contact to share this expense with');
      return;
    }

    if (splitMethod === 'exact') {
      const check = validateExactSplit(
        totalAmount,
        calculatedSplits.map((s) => ({ contactId: s.contactId, amount: s.shareAmount }))
      );
      if (!check.isValid) {
        setError(`Exact splits do not match total amount. Discrepancy: ${check.difference}`);
        return;
      }
    }

    try {
      setSubmitting(true);
      setError(null);
      await createSharedExpense({
        title: title.trim(),
        totalAmount,
        currency: currentWorkspace?.base_currency || 'USD',
        splitMethod,
        payerContactId: payerContactId || null,
        notes: notes.trim() || null,
        splits: calculatedSplits,
      });
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to record shared expense');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '620px' }}>
        <div className="modal-header">
          <div className="modal-title-wrap">
            <span className="modal-icon">🤝</span>
            <h2 className="modal-title">Record Shared Expense</h2>
          </div>
          <button className="modal-close-btn" onClick={onClose} aria-label="Close modal">
            ✕
          </button>
        </div>

        {error && <div className="modal-error-banner">{error}</div>}

        <form onSubmit={handleSubmit} className="modal-form">
          <div className="form-group">
            <label className="form-label">Expense Description *</label>
            <input
              type="text"
              className="form-input"
              placeholder="e.g. Dinner at Bistro, Team Lunch, AirBnB"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
          </div>

          <div className="form-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div className="form-group">
              <label className="form-label">Total Amount ({currentWorkspace?.base_currency || 'USD'}) *</label>
              <MoneyInput
                value={totalAmount}
                onChange={setTotalAmount}
                currencyCode={currentWorkspace?.base_currency || 'USD'}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Paid By</label>
              <select
                className="form-input"
                value={payerContactId}
                onChange={(e) => setPayerContactId(e.target.value)}
              >
                <option value="">You (Paid upfront)</option>
                {contacts.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Split Method Tabs */}
          <div className="form-group">
            <label className="form-label">Split Method</label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.5rem' }}>
              {[
                { id: 'equal', label: 'Equal (=)' },
                { id: 'percent', label: 'Percent (%)' },
                { id: 'shares', label: 'Shares (x)' },
                { id: 'exact', label: 'Exact ($)' },
              ].map((m) => (
                <button
                  type="button"
                  key={m.id}
                  className={`btn-filter ${splitMethod === m.id ? 'active' : ''}`}
                  onClick={() => setSplitMethod(m.id)}
                  style={{
                    padding: '0.45rem',
                    borderRadius: '8px',
                    fontSize: '0.82rem',
                    textAlign: 'center',
                    background: splitMethod === m.id ? 'rgba(var(--md-primary-rgb), 0.25)' : 'rgba(var(--md-on-surface-rgb), 0.04)',
                    borderColor: splitMethod === m.id ? 'var(--md-primary)' : 'transparent',
                    color: splitMethod === m.id ? 'var(--md-on-primary)' : 'var(--md-on-surface-variant)',
                  }}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>

          {/* Participants Breakdown */}
          <div className="form-group">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
              <label className="form-label" style={{ margin: 0 }}>
                Participants & Shares ({selectedContacts.length} selected)
              </label>
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

            <div
              style={{
                background: 'rgba(var(--md-surface-rgb), 0.6)',
                border: '1px solid rgba(var(--md-on-surface-rgb), 0.08)',
                borderRadius: '8px',
                padding: '0.75rem',
                maxHeight: '190px',
                overflowY: 'auto',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.5rem',
              }}
            >
              {contacts.length === 0 ? (
                <div style={{ color: 'var(--md-on-surface-variant)', fontSize: '0.85rem', textAlign: 'center', padding: '1rem' }}>
                  No contacts found. Click "+ Add Contact" above to get started.
                </div>
              ) : (
                contacts.map((c) => {
                  const isSelected = selectedContacts.includes(c.id);
                  const splitResult = calculatedSplits.find((s) => s.contactId === c.id);

                  return (
                    <div
                      key={c.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '0.4rem 0.6rem',
                        borderRadius: '6px',
                        background: isSelected ? 'rgba(var(--md-on-surface-rgb), 0.04)' : 'transparent',
                        opacity: isSelected ? 1 : 0.5,
                      }}
                    >
                      <label style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', cursor: 'pointer', margin: 0 }}>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleContact(c.id)}
                        />
                        <span style={{ fontSize: '0.88rem', fontWeight: 500, color: 'var(--md-on-surface)' }}>{c.name}</span>
                      </label>

                      {isSelected && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                          {splitMethod === 'percent' && (
                            <input
                              type="number"
                              className="form-input"
                              style={{ width: '70px', padding: '0.2rem 0.4rem', fontSize: '0.82rem', height: 'auto' }}
                              placeholder="%"
                              value={customValues[c.id] ?? ''}
                              onChange={(e) => handleCustomValueChange(c.id, e.target.value)}
                            />
                          )}
                          {splitMethod === 'shares' && (
                            <input
                              type="number"
                              className="form-input"
                              style={{ width: '60px', padding: '0.2rem 0.4rem', fontSize: '0.82rem', height: 'auto' }}
                              placeholder="parts"
                              value={customValues[c.id] ?? 1}
                              onChange={(e) => handleCustomValueChange(c.id, e.target.value)}
                            />
                          )}
                          {splitMethod === 'exact' && (
                            <input
                              type="number"
                              className="form-input"
                              style={{ width: '85px', padding: '0.2rem 0.4rem', fontSize: '0.82rem', height: 'auto' }}
                              placeholder="$"
                              value={customValues[c.id] ?? ''}
                              onChange={(e) => handleCustomValueChange(c.id, e.target.value)}
                            />
                          )}

                          <span style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--md-success)', minWidth: '60px', textAlign: 'right' }}>
                            ${splitResult?.shareAmount || '0.00'}
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Notes (Optional)</label>
            <input
              type="text"
              className="form-input"
              placeholder="e.g. Receipt verified, paid via card"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          <div className="modal-actions">
            <button type="button" className="btn-secondary" onClick={onClose} disabled={submitting}>
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={submitting || contacts.length === 0}>
              {submitting ? 'Recording...' : 'Book Split Expense'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
