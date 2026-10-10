import { useState, useEffect } from 'react';
import { useAccounts } from '../../context/AccountContext';
import { useCategories } from '../../context/CategoryContext';
import { useTransactions } from '../../context/TransactionContext';
import { useWorkspace } from '../../context/WorkspaceContext';
import { useCurrency } from '../../context/CurrencyContext';
import MoneyInput from '../ui/MoneyInput';
import { todayISO } from '../../lib/dates';

export default function CreateTransactionModal({ isOpen, onClose, initialDraft = null }) {
  const { accounts } = useAccounts();
  const { categories, merchants, tags, expenseCategories, incomeCategories } = useCategories();
  const { addTransaction } = useTransactions();
  const { currentWorkspace } = useWorkspace();
  const { convert } = useCurrency() || {};

  const baseCurrency = currentWorkspace?.base_currency || 'USD';

  // Form State
  const [type, setType] = useState('expense'); // 'expense' | 'income' | 'transfer' | 'refund'
  const [date, setDate] = useState(todayISO());
  const [payeeName, setPayeeName] = useState('');
  const [selectedMerchantId, setSelectedMerchantId] = useState('');
  const [notes, setNotes] = useState('');
  const [status, setStatus] = useState('cleared');

  // Single-line Mode State (Expense / Income / Refund)
  const [accountId, setAccountId] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');

  // Transfer Mode State
  const [fromAccountId, setFromAccountId] = useState('');
  const [toAccountId, setToAccountId] = useState('');
  const [transferAmount, setTransferAmount] = useState('');
  const [feeAmount, setFeeAmount] = useState('');
  const [receivedAmount, setReceivedAmount] = useState(''); // cross-currency destination amount

  // Split Mode State
  const [isSplit, setIsSplit] = useState(false);
  const [splitLines, setSplitLines] = useState([
    { categoryId: '', amount: '', description: '' },
    { categoryId: '', amount: '', description: '' },
  ]);

  // Selected Tags
  const [selectedTagIds, setSelectedTagIds] = useState([]);

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (initialDraft && isOpen) {
      if (initialDraft.type) setType(initialDraft.type);
      if (initialDraft.date) setDate(initialDraft.date);
      const draftPayee = initialDraft.merchantName || initialDraft.payeeName || initialDraft.title;
      if (draftPayee) setPayeeName(draftPayee);
      const draftAmount = initialDraft.totalAmount || initialDraft.amount;
      if (draftAmount) setAmount(String(draftAmount));
      if (initialDraft.accountId) setAccountId(initialDraft.accountId);
      if (initialDraft.notes) setNotes(initialDraft.notes);
    }
  }, [initialDraft, isOpen]);

  if (!isOpen) return null;

  // Defaults if state empty
  const defaultAccount = accounts[0]?.id || '';
  const effectiveAccountId = accountId || defaultAccount;
  const targetCategoryList = type === 'income' ? incomeCategories : expenseCategories;
  const effectiveCategoryId = categoryId || targetCategoryList[0]?.id || '';

  // Transfer accounts exactly as shown in the selects
  const transferSrc = accounts.find((a) => a.id === (fromAccountId || accounts[0]?.id));
  const transferDest = accounts.find((a) => a.id === (toAccountId || accounts[1]?.id || accounts[0]?.id));
  const isCrossCurrency = Boolean(transferSrc && transferDest && transferSrc.currency !== transferDest.currency);
  const suggestedReceived =
    isCrossCurrency && transferAmount && convert
      ? convert(transferAmount, transferSrc.currency, transferDest.currency)
      : '';

  const handleMerchantChange = (mId) => {
    setSelectedMerchantId(mId);
    const found = merchants.find((m) => m.id === mId);
    if (found) {
      setPayeeName(found.name);
      if (found.default_category_id) {
        setCategoryId(found.default_category_id);
      }
    }
  };

  const handleAddSplitLine = () => {
    setSplitLines((prev) => [...prev, { categoryId: '', amount: '', description: '' }]);
  };

  const handleRemoveSplitLine = (index) => {
    if (splitLines.length <= 2) return;
    setSplitLines((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleUpdateSplitLine = (index, field, val) => {
    setSplitLines((prev) =>
      prev.map((line, idx) => (idx === index ? { ...line, [field]: val } : line))
    );
  };

  const toggleTag = (tagId) => {
    setSelectedTagIds((prev) =>
      prev.includes(tagId) ? prev.filter((id) => id !== tagId) : [...prev, tagId]
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');

    try {
      let linesToBook = [];

      if (type === 'transfer') {
        const srcAcc = transferSrc;
        const destAcc = transferDest;

        if (!srcAcc || !destAcc || srcAcc.id === destAcc.id) {
          throw new Error('Please select distinct source and destination accounts for the transfer');
        }

        if (!transferAmount || parseFloat(transferAmount) <= 0) {
          throw new Error('Valid transfer amount required');
        }

        // Out line from source
        linesToBook.push({
          accountId: srcAcc.id,
          categoryId: null,
          direction: 'out',
          amount: transferAmount,
          currency: srcAcc.currency || baseCurrency,
          description: `Transfer to ${destAcc.name}`,
        });

        // In line to destination (cross-currency: each side keeps its own currency)
        const destAmount = isCrossCurrency ? receivedAmount : transferAmount;
        if (!destAmount || parseFloat(destAmount) <= 0) {
          throw new Error(`Enter the amount received in ${destAcc.currency}`);
        }
        linesToBook.push({
          accountId: destAcc.id,
          categoryId: null,
          direction: 'in',
          amount: destAmount,
          currency: destAcc.currency || baseCurrency,
          description: `Transfer from ${srcAcc.name}`,
        });

        // Optional transfer fee
        if (feeAmount && parseFloat(feeAmount) > 0) {
          linesToBook.push({
            accountId: srcAcc.id,
            categoryId: null,
            direction: 'out',
            amount: feeAmount,
            currency: srcAcc.currency || baseCurrency,
            isFee: true,
            description: 'Transfer fee / bank charge',
          });
        }
      } else if (isSplit) {
        // Split transaction
        const targetAcc = accounts.find((a) => a.id === effectiveAccountId) || accounts[0];
        if (!targetAcc) throw new Error('Account selection required');

        for (const s of splitLines) {
          if (!s.amount || parseFloat(s.amount) <= 0) {
            throw new Error('All split items must have an amount greater than zero');
          }
          linesToBook.push({
            accountId: targetAcc.id,
            categoryId: s.categoryId || effectiveCategoryId,
            direction: type === 'income' || type === 'refund' ? 'in' : 'out',
            amount: s.amount,
            currency: targetAcc.currency || baseCurrency,
            description: s.description || description,
          });
        }
      } else {
        // Standard single-line transaction
        const targetAcc = accounts.find((a) => a.id === effectiveAccountId) || accounts[0];
        if (!targetAcc) throw new Error('Account selection required');
        if (!amount || parseFloat(amount) <= 0) throw new Error('Valid amount required');

        linesToBook.push({
          accountId: targetAcc.id,
          categoryId: effectiveCategoryId,
          direction: type === 'income' || type === 'refund' ? 'in' : 'out',
          amount: amount,
          currency: targetAcc.currency || baseCurrency,
          description: description,
        });
      }

      const res = await addTransaction({
        type,
        date,
        status,
        merchantId: selectedMerchantId || null,
        payeeName: payeeName.trim() || (type === 'transfer' ? 'Account Transfer' : 'Unlabeled Payee'),
        notes: notes.trim(),
        lines: linesToBook,
        tagIds: selectedTagIds,
      });

      if (res.error) {
        throw res.error;
      }

      // Reset and close
      setAmount('');
      setPayeeName('');
      setNotes('');
      setTransferAmount('');
      setFeeAmount('');
      setReceivedAmount('');
      onClose();
    } catch (err) {
      console.error('[CreateTransactionModal] Error:', err);
      setErrorMsg(err.message || 'Failed to book transaction');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-content glass-card modal-large" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title-group">
            <h2 className="modal-title">Book Ledger Transaction</h2>
            <p className="modal-subtitle">
              Authoritative double-entry booking with multi-currency & split line allocations
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
          {/* Transaction Type Selector */}
          <div className="form-group">
            <label>Transaction Type</label>
            <div className="type-selector">
              <button
                type="button"
                className={`type-btn expense ${type === 'expense' ? 'active' : ''}`}
                onClick={() => setType('expense')}
              >
                📉 Expense
              </button>
              <button
                type="button"
                className={`type-btn income ${type === 'income' ? 'active' : ''}`}
                onClick={() => setType('income')}
              >
                📈 Income
              </button>
              <button
                type="button"
                className={`type-btn transfer ${type === 'transfer' ? 'active' : ''}`}
                onClick={() => setType('transfer')}
              >
                🔁 Transfer
              </button>
              <button
                type="button"
                className={`type-btn refund ${type === 'refund' ? 'active' : ''}`}
                onClick={() => setType('refund')}
              >
                ↩️ Refund
              </button>
            </div>
          </div>

          {/* Date & Status */}
          <div className="form-row-2">
            <div className="form-group">
              <label htmlFor="tx-date">Date</label>
              <input
                id="tx-date"
                type="date"
                required
                className="input-field"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label htmlFor="tx-status">Clearance Status</label>
              <select
                id="tx-status"
                className="select-field"
                value={status}
                onChange={(e) => setStatus(e.target.value)}
              >
                <option value="cleared">✓ Cleared</option>
                <option value="pending">⏳ Pending Clearance</option>
                <option value="reconciled">🔒 Reconciled</option>
              </select>
            </div>
          </div>

          {/* Payee / Merchant Section (if not transfer) */}
          {type !== 'transfer' && (
            <div className="form-row-2">
              <div className="form-group">
                <label htmlFor="tx-payee">Payee / Title</label>
                <input
                  id="tx-payee"
                  type="text"
                  required
                  placeholder="e.g. Carrefour, Apple Cloud, Freelance Client"
                  className="input-field"
                  value={payeeName}
                  onChange={(e) => setPayeeName(e.target.value)}
                />
              </div>

              {merchants.length > 0 && (
                <div className="form-group">
                  <label htmlFor="tx-merchant">Link Recognized Merchant</label>
                  <select
                    id="tx-merchant"
                    className="select-field"
                    value={selectedMerchantId}
                    onChange={(e) => handleMerchantChange(e.target.value)}
                  >
                    <option value="">None / Custom Payee</option>
                    {merchants.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          )}

          {/* TRANSFER MODE */}
          {type === 'transfer' ? (
            <div className="transfer-box glass-card">
              <div className="form-row-2">
                <div className="form-group">
                  <label htmlFor="tr-source">From Account (Source)</label>
                  <select
                    id="tr-source"
                    className="select-field"
                    value={fromAccountId || accounts[0]?.id || ''}
                    onChange={(e) => setFromAccountId(e.target.value)}
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
                </div>

                <div className="form-group">
                  <label htmlFor="tr-dest">To Account (Destination)</label>
                  <select
                    id="tr-dest"
                    className="select-field"
                    value={toAccountId || accounts[1]?.id || accounts[0]?.id || ''}
                    onChange={(e) => setToAccountId(e.target.value)}
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
                </div>
              </div>

              <div className="form-row-2">
                <div className="form-group">
                  <MoneyInput
                    id="tr-amount"
                    label="Amount Sent"
                    value={transferAmount}
                    onChange={setTransferAmount}
                    currencyCode={transferSrc?.currency || baseCurrency}
                    placeholder="0.00"
                    required
                  />
                </div>

                {isCrossCurrency && (
                  <div className="form-group">
                    <MoneyInput
                      id="tr-received"
                      label={`Amount Received (${transferDest.currency})`}
                      value={receivedAmount}
                      onChange={setReceivedAmount}
                      currencyCode={transferDest.currency}
                      placeholder={suggestedReceived || '0.00'}
                      required
                    />
                    {suggestedReceived && !receivedAmount && (
                      <button
                        type="button"
                        className="btn-link"
                        style={{ fontSize: '0.75rem', marginTop: '0.25rem' }}
                        onClick={() => setReceivedAmount(String(suggestedReceived))}
                      >
                        Use estimated {suggestedReceived} {transferDest.currency}
                      </button>
                    )}
                  </div>
                )}

                <div className="form-group">
                  <MoneyInput
                    id="tr-fee"
                    label="Bank / Wire Fee (Optional)"
                    value={feeAmount}
                    onChange={setFeeAmount}
                    currencyCode={transferSrc?.currency || baseCurrency}
                    placeholder="0.00"
                  />
                </div>
              </div>
            </div>
          ) : (
            /* EXPENSE / INCOME / REFUND MODE */
            <>
              <div className="form-row-2">
                <div className="form-group">
                  <label htmlFor="tx-account">Source / Target Account</label>
                  <select
                    id="tx-account"
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
                </div>

                {!isSplit && (
                  <div className="form-group">
                    <label htmlFor="tx-cat">Category</label>
                    <select
                      id="tx-cat"
                      className="select-field"
                      value={effectiveCategoryId}
                      onChange={(e) => setCategoryId(e.target.value)}
                    >
                      {targetCategoryList.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.icon} {c.name} {c.is_essential ? '(Need)' : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              {/* Single Line vs Split Line */}
              {!isSplit ? (
                <div className="form-group">
                  <MoneyInput
                    id="tx-main-amount"
                    label="Amount"
                    value={amount}
                    onChange={setAmount}
                    currencyCode={baseCurrency}
                    placeholder="0.00"
                    required
                  />
                </div>
              ) : (
                <div className="split-lines-section">
                  <div className="split-lines-header">
                    <span className="split-title">Split Line Allocations</span>
                    <button
                      type="button"
                      className="btn-add-line"
                      onClick={handleAddSplitLine}
                    >
                      ➕ Add Split Item
                    </button>
                  </div>

                  {splitLines.map((line, idx) => (
                    <div key={idx} className="split-line-row">
                      <select
                        className="select-field"
                        value={line.categoryId || effectiveCategoryId}
                        onChange={(e) => handleUpdateSplitLine(idx, 'categoryId', e.target.value)}
                      >
                        {targetCategoryList.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.icon} {c.name}
                          </option>
                        ))}
                      </select>

                      <input
                        type="number"
                        step="0.01"
                        placeholder="Amount"
                        className="input-field split-amt-input"
                        value={line.amount}
                        onChange={(e) => handleUpdateSplitLine(idx, 'amount', e.target.value)}
                        required
                      />

                      <input
                        type="text"
                        placeholder="Line description"
                        className="input-field split-desc-input"
                        value={line.description}
                        onChange={(e) => handleUpdateSplitLine(idx, 'description', e.target.value)}
                      />

                      {splitLines.length > 2 && (
                        <button
                          type="button"
                          className="tx-delete-btn"
                          onClick={() => handleRemoveSplitLine(idx)}
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Split Toggle */}
              <div style={{ margin: '0.25rem 0 1rem' }}>
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={isSplit}
                    onChange={(e) => setIsSplit(e.target.checked)}
                  />
                  <span>Split this transaction across multiple categories</span>
                </label>
              </div>
            </>
          )}

          {/* Tags Cloud Selector */}
          {tags.length > 0 && (
            <div className="form-group">
              <label>Attach Tags</label>
              <div className="tags-cloud-select">
                {tags.map((tag) => {
                  const isSelected = selectedTagIds.includes(tag.id);
                  return (
                    <button
                      type="button"
                      key={tag.id}
                      className={`tag-select-chip ${isSelected ? 'selected' : ''}`}
                      style={{
                        borderColor: isSelected ? tag.color : 'transparent',
                        backgroundColor: isSelected ? `${tag.color}22` : 'rgba(var(--md-on-surface-rgb), 0.05)',
                      }}
                      onClick={() => toggleTag(tag.id)}
                    >
                      <span className="tag-dot" style={{ backgroundColor: tag.color }} />
                      <span>{tag.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Notes */}
          <div className="form-group">
            <label htmlFor="tx-notes">Remarks / Notes</label>
            <textarea
              id="tx-notes"
              rows="2"
              className="input-field"
              placeholder="e.g. Invoice #204, lunch with design client, reimbursable"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
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
              {loading ? 'Booking Transaction...' : 'Book Transaction'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
