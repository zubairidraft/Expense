import { useState, useEffect, useMemo } from 'react';
import { useAccounts } from '../../context/AccountContext';
import { useTransactions } from '../../context/TransactionContext';
import { useWorkspace } from '../../context/WorkspaceContext';
import { useCurrency } from '../../context/CurrencyContext';
import MoneyDisplay from '../ui/MoneyDisplay';
import MoneyInput from '../ui/MoneyInput';
import Icon from '../ui/Icon';
import { todayISO } from '../../lib/dates';
import { dec, toNum } from '../../lib/money';

export default function TransferModal({
  isOpen,
  onClose,
  defaultFromAccountId,
  defaultToAccountId,
  editTransaction = null,
}) {
  const { accounts } = useAccounts();
  const { addTransaction, editTransferTransaction } = useTransactions();
  const { currentWorkspace } = useWorkspace();
  const { convert, getEstimatedRate } = useCurrency() || {};

  const baseCurrency = currentWorkspace?.base_currency || 'USD';

  // State
  const [fromAccountId, setFromAccountId] = useState('');
  const [toAccountId, setToAccountId] = useState('');
  const [amount, setAmount] = useState('');
  const [receivedAmount, setReceivedAmount] = useState('');
  const [feeAmount, setFeeAmount] = useState('');
  const [date, setDate] = useState(todayISO());
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successToast, setSuccessToast] = useState('');

  // Find user's cash, bank, and card accounts for smart shortcut presets
  const cashAccounts = useMemo(() => accounts.filter((a) => a.type === 'cash'), [accounts]);
  const bankAccounts = useMemo(() => accounts.filter((a) => a.type === 'bank' || a.type === 'checking' || a.type === 'savings'), [accounts]);
  const cardAccounts = useMemo(() => accounts.filter((a) => a.type === 'credit_card' || a.nature === 'liability'), [accounts]);

  // Initialize or populate for edit
  useEffect(() => {
    if (!isOpen) return;

    setErrorMsg('');
    setSuccessToast('');

    if (editTransaction && editTransaction.type === 'transfer') {
      const outLine = editTransaction.lines?.find((l) => l.direction === 'out' && !l.isFee);
      const inLine = editTransaction.lines?.find((l) => l.direction === 'in');
      const feeLine = editTransaction.lines?.find((l) => l.isFee || (l.direction === 'out' && l.account_id === outLine?.account_id && l !== outLine));

      const srcId = outLine?.account_id || outLine?.accountId || accounts[0]?.id || '';
      const destId = inLine?.account_id || inLine?.accountId || accounts[1]?.id || accounts[0]?.id || '';

      setFromAccountId(srcId);
      setToAccountId(destId);
      setAmount(outLine?.amount ? String(outLine.amount) : '');
      setReceivedAmount(inLine?.amount ? String(inLine.amount) : '');
      setFeeAmount(feeLine?.amount ? String(feeLine.amount) : '');
      setDate(editTransaction.date || todayISO());
      setNotes(editTransaction.notes || '');
      return;
    }

    // Default initialization
    const initialFrom = defaultFromAccountId || (accounts.length > 0 ? accounts[0].id : '');
    const initialTo = defaultToAccountId || (accounts.length > 1 ? accounts.find((a) => a.id !== initialFrom)?.id || accounts[1].id : accounts[0]?.id || '');

    setFromAccountId(initialFrom);
    setToAccountId(initialTo);
    setAmount('');
    setReceivedAmount('');
    setFeeAmount('');
    setDate(todayISO());
    setNotes('');
  }, [isOpen, defaultFromAccountId, defaultToAccountId, editTransaction, accounts]);

  if (!isOpen) return null;

  const fromAcc = accounts.find((a) => a.id === fromAccountId) || accounts[0];
  const toAcc = accounts.find((a) => a.id === toAccountId) || (accounts.length > 1 ? accounts[1] : accounts[0]);

  const isCrossCurrency = Boolean(fromAcc && toAcc && fromAcc.currency !== toAcc.currency);
  const fxRate = isCrossCurrency && getEstimatedRate ? getEstimatedRate(fromAcc.currency, toAcc.currency) : 1;

  // Auto-fill estimated received amount on source amount change if not manually typed
  const handleAmountChange = (val) => {
    setAmount(val);
    if (isCrossCurrency && convert && val && parseFloat(val) > 0) {
      const estimated = convert(val, fromAcc.currency, toAcc.currency);
      setReceivedAmount(estimated);
    }
  };

  // Swap From and To accounts
  const handleSwapAccounts = () => {
    if (!fromAcc || !toAcc) return;
    const oldFrom = fromAccountId;
    const oldTo = toAccountId;
    setFromAccountId(oldTo);
    setToAccountId(oldFrom);

    // If cross-currency and amount was entered, recalculate estimated received
    if (amount && parseFloat(amount) > 0 && isCrossCurrency && convert) {
      const newEstimated = convert(amount, toAcc.currency, fromAcc.currency);
      setReceivedAmount(newEstimated);
    }
  };

  // Preset Shortcuts: Cash -> Bank, Bank -> Cash, Pay Credit Card
  const applyPresetShortcut = (presetType) => {
    if (presetType === 'cash_to_bank') {
      const cash = cashAccounts[0] || accounts.find((a) => a.type === 'cash');
      const bank = bankAccounts[0] || accounts.find((a) => a.type === 'bank' || a.id !== cash?.id);
      if (cash) setFromAccountId(cash.id);
      if (bank && bank.id !== cash?.id) setToAccountId(bank.id);
      setNotes('Cash deposit into bank');
    } else if (presetType === 'bank_to_cash') {
      const bank = bankAccounts[0] || accounts.find((a) => a.type === 'bank');
      const cash = cashAccounts[0] || accounts.find((a) => a.type === 'cash' || a.id !== bank?.id);
      if (bank) setFromAccountId(bank.id);
      if (cash && cash.id !== bank?.id) setToAccountId(cash.id);
      setNotes('ATM Cash withdrawal');
    } else if (presetType === 'pay_card') {
      const bank = bankAccounts[0] || accounts.find((a) => a.nature === 'asset');
      const card = cardAccounts[0] || accounts.find((a) => a.type === 'credit_card' || a.nature === 'liability');
      if (bank) setFromAccountId(bank.id);
      if (card && card.id !== bank?.id) setToAccountId(card.id);
      setNotes('Credit card bill settlement');
    }
  };

  // Context-aware transfer type classification
  const isCreditCardPayment = Boolean(fromAcc?.nature === 'asset' && (toAcc?.nature === 'liability' || toAcc?.type === 'credit_card'));
  const isCashAdvance = Boolean((fromAcc?.nature === 'liability' || fromAcc?.type === 'credit_card') && toAcc?.nature === 'asset');

  // Preview calculations
  const numAmount = parseFloat(amount || '0');
  const numFee = parseFloat(feeAmount || '0');
  const numReceived = isCrossCurrency ? parseFloat(receivedAmount || '0') : numAmount;

  const fromCurrentBal = parseFloat(fromAcc?.balance || '0');
  const toCurrentBal = parseFloat(toAcc?.balance || '0');

  // Projected balances
  // For Asset: out decreases balance. For Liability: out increases debt.
  const fromProjected = fromAcc?.nature === 'liability'
    ? fromCurrentBal + numAmount + numFee
    : fromCurrentBal - numAmount - numFee;

  // For Asset: in increases balance. For Liability: in decreases debt.
  const toProjected = toAcc?.nature === 'liability'
    ? toCurrentBal - numReceived
    : toCurrentBal + numReceived;

  // Warning check: Source overdraft
  const isOverdrawnWarning = fromAcc?.nature === 'asset' && (numAmount + numFee) > fromCurrentBal && numAmount > 0;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');

    if (!fromAcc || !toAcc) {
      setErrorMsg('Please select valid accounts for the transfer.');
      return;
    }

    if (fromAcc.id === toAcc.id) {
      setErrorMsg('Source and Destination accounts must be different.');
      return;
    }

    if (!amount || parseFloat(amount) <= 0) {
      setErrorMsg('Please enter a valid transfer amount greater than 0.');
      return;
    }

    if (isCrossCurrency && (!receivedAmount || parseFloat(receivedAmount) <= 0)) {
      setErrorMsg(`Please specify the amount received in ${toAcc.currency}.`);
      return;
    }

    if (fromAcc.is_shared && fromAcc.can_post === false) {
      setErrorMsg(`Source account "${fromAcc.name}" is shared as read-only. Cannot post transfer.`);
      return;
    }

    if (toAcc.is_shared && toAcc.can_post === false) {
      setErrorMsg(`Destination account "${toAcc.name}" is shared as read-only. Cannot post transfer.`);
      return;
    }

    setLoading(true);

    try {
      const effectiveDestAmount = isCrossCurrency ? receivedAmount : amount;
      const transferLines = [
        {
          accountId: fromAcc.id,
          categoryId: null,
          direction: 'out',
          amount: String(amount),
          currency: fromAcc.currency || baseCurrency,
          description: isCreditCardPayment
            ? `Card payment to ${toAcc.name}`
            : `Transfer to ${toAcc.name}`,
        },
        {
          accountId: toAcc.id,
          categoryId: null,
          direction: 'in',
          amount: String(effectiveDestAmount),
          currency: toAcc.currency || baseCurrency,
          description: isCashAdvance
            ? `Cash advance from ${fromAcc.name}`
            : `Transfer from ${fromAcc.name}`,
        },
      ];

      // Add fee line if present
      if (feeAmount && parseFloat(feeAmount) > 0) {
        transferLines.push({
          accountId: fromAcc.id,
          categoryId: null,
          direction: 'out',
          amount: String(feeAmount),
          currency: fromAcc.currency || baseCurrency,
          isFee: true,
          description: 'Transfer fee / bank charge',
        });
      }

      const defaultPayee = isCreditCardPayment
        ? `Card Payment: ${toAcc.name}`
        : isCashAdvance
        ? `Advance: ${fromAcc.name}`
        : `${fromAcc.name} ➔ ${toAcc.name}`;

      const payload = {
        type: 'transfer',
        date,
        status: 'cleared',
        payeeName: notes.trim() || defaultPayee,
        notes: notes.trim() || (isCrossCurrency ? `FX rate: 1 ${fromAcc.currency} ≈ ${(parseFloat(effectiveDestAmount) / parseFloat(amount)).toFixed(4)} ${toAcc.currency}` : ''),
        lines: transferLines,
      };

      let res;
      if (editTransaction?.id && editTransferTransaction) {
        res = await editTransferTransaction(editTransaction.id, payload);
      } else {
        res = await addTransaction(payload);
      }

      if (res?.error) {
        setErrorMsg(res.error.message || 'Failed to save transfer');
        setLoading(false);
        return;
      }

      setSuccessToast(editTransaction ? '✓ Transfer updated successfully' : '✓ Transfer completed in <2s');
      setTimeout(() => {
        onClose();
      }, 550);
    } catch (err) {
      console.error('[TransferModal] Error:', err);
      setErrorMsg(err.message || 'Failed to process transfer.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-content glass-card transfer-dialog"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: '580px' }}
      >
        {/* Header */}
        <div className="modal-header">
          <div className="modal-title-group">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  padding: '0.2rem 0.55rem',
                  borderRadius: '999px',
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  background: isCreditCardPayment
                    ? 'rgba(var(--md-primary-rgb), 0.15)'
                    : isCashAdvance
                    ? 'rgba(var(--md-warning-rgb, 234, 179, 8), 0.15)'
                    : 'rgba(var(--md-secondary-rgb, 100, 116, 139), 0.15)',
                  color: isCreditCardPayment
                    ? 'var(--md-primary)'
                    : isCashAdvance
                    ? '#b45309'
                    : 'var(--text-primary)',
                }}
              >
                {isCreditCardPayment ? '💳 Card Bill Payment' : isCashAdvance ? '💵 Cash Advance' : '⇄ Internal Transfer'}
              </span>
              {editTransaction && (
                <span style={{ fontSize: '0.72rem', padding: '0.15rem 0.45rem', borderRadius: '4px', background: 'var(--md-secondary-container)', color: 'var(--md-on-secondary-container)' }}>
                  Editing #{editTransaction.id.slice(-6)}
                </span>
              )}
            </div>
            <h2 className="modal-title" style={{ fontSize: '1.25rem' }}>
              {isCreditCardPayment ? 'Pay Credit Card Bill' : isCashAdvance ? 'Cash Advance from Card' : 'Transfer Funds Between Accounts'}
            </h2>
            <p className="modal-subtitle">
              {isCreditCardPayment
                ? 'Deducts funds from your bank to pay down your credit card balance.'
                : isCashAdvance
                ? 'Withdraws funds from your credit line into your cash/bank vault.'
                : 'Move funds across your accounts without affecting your overall net worth or expenses.'}
            </p>
          </div>
          <button className="modal-close-btn" onClick={onClose} aria-label="Close transfer modal">
            ✕
          </button>
        </div>

        {/* Success Banner */}
        {successToast && (
          <div className="quick-add-success-banner" style={{ margin: '0.5rem 0 1rem' }}>
            <span>{successToast}</span>
          </div>
        )}

        {/* Error Banner */}
        {errorMsg && (
          <div className="auth-alert error" style={{ margin: '0.5rem 0 1rem' }}>
            <span>⚠️</span> {errorMsg}
          </div>
        )}

        {/* Quick Shortcut Chips */}
        <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginBottom: '1.25rem' }}>
          <span style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-secondary)', alignSelf: 'center', marginRight: '0.25rem' }}>
            Quick:
          </span>
          <button
            type="button"
            className="preset-chip"
            onClick={() => applyPresetShortcut('cash_to_bank')}
            title="Transfer from Physical Cash to Bank Account"
          >
            Cash ➔ Bank 🏧
          </button>
          <button
            type="button"
            className="preset-chip"
            onClick={() => applyPresetShortcut('bank_to_cash')}
            title="Withdraw cash from Bank Account"
          >
            Bank ➔ Cash 💵
          </button>
          {cardAccounts.length > 0 && (
            <button
              type="button"
              className="preset-chip"
              onClick={() => applyPresetShortcut('pay_card')}
              title="Pay credit card balance from checking account"
            >
              Pay Credit Card 💳
            </button>
          )}
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.15rem' }}>
          {/* Two Interactive Account Cards with Swap Button */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center', gap: '0.75rem' }}>
            {/* Source Card */}
            <div
              style={{
                padding: '0.85rem 1rem',
                borderRadius: '14px',
                background: 'var(--bg-main, rgba(0,0,0,0.08))',
                border: '1px solid rgba(var(--md-primary-rgb), 0.25)',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.4rem',
              }}
            >
              <span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                From (Source)
              </span>
              <select
                className="select-field"
                value={fromAccountId}
                onChange={(e) => setFromAccountId(e.target.value)}
                style={{ fontSize: '0.88rem', fontWeight: 600, padding: '0.4rem 0.5rem' }}
                required
              >
                {accounts.map((acc) => (
                  <option key={acc.id} value={acc.id}>
                    {acc.icon || '💳'} {acc.name}
                  </option>
                ))}
              </select>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.75rem', marginTop: '0.2rem', color: 'var(--text-secondary)' }}>
                <span>Balance:</span>
                <strong style={{ color: 'var(--text-primary)' }}>
                  <MoneyDisplay amount={fromAcc?.balance || 0} currencyCode={fromAcc?.currency || baseCurrency} />
                </strong>
              </div>
            </div>

            {/* Reverse Swap Button */}
            <button
              type="button"
              onClick={handleSwapAccounts}
              title="Swap From and To accounts"
              aria-label="Swap accounts"
              style={{
                width: '38px',
                height: '38px',
                borderRadius: '50%',
                background: 'var(--md-surface-container-highest)',
                border: '1px solid var(--border-subtle, rgba(var(--md-on-surface-rgb), 0.15))',
                color: 'var(--md-primary)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: 'var(--md-elev-1)',
                transition: 'all 0.2s ease',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.transform = 'rotate(180deg) scale(1.1)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.transform = 'rotate(0deg) scale(1)'; }}
            >
              <Icon name="swap_horiz" size={20} />
            </button>

            {/* Destination Card */}
            <div
              style={{
                padding: '0.85rem 1rem',
                borderRadius: '14px',
                background: 'var(--bg-main, rgba(0,0,0,0.08))',
                border: '1px solid rgba(var(--md-primary-rgb), 0.25)',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.4rem',
              }}
            >
              <span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                To (Destination)
              </span>
              <select
                className="select-field"
                value={toAccountId}
                onChange={(e) => setToAccountId(e.target.value)}
                style={{ fontSize: '0.88rem', fontWeight: 600, padding: '0.4rem 0.5rem' }}
                required
              >
                {accounts.map((acc) => (
                  <option key={acc.id} value={acc.id}>
                    {acc.icon || '💳'} {acc.name}
                  </option>
                ))}
              </select>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.75rem', marginTop: '0.2rem', color: 'var(--text-secondary)' }}>
                <span>Balance:</span>
                <strong style={{ color: 'var(--text-primary)' }}>
                  <MoneyDisplay amount={toAcc?.balance || 0} currencyCode={toAcc?.currency || baseCurrency} />
                </strong>
              </div>
            </div>
          </div>

          {/* Amount Inputs */}
          <div style={{ display: 'grid', gridTemplateColumns: isCrossCurrency ? '1fr 1fr' : '1fr', gap: '0.85rem' }}>
            <div>
              <label className="form-label" htmlFor="transfer-source-amount">
                Transfer Amount ({fromAcc?.currency || baseCurrency}) *
              </label>
              <MoneyInput
                id="transfer-source-amount"
                value={amount}
                onChange={handleAmountChange}
                currencyCode={fromAcc?.currency || baseCurrency}
                placeholder="0.00"
                required
              />
            </div>

            {isCrossCurrency && (
              <div>
                <label className="form-label" htmlFor="transfer-dest-amount">
                  Amount Received ({toAcc?.currency || baseCurrency}) *
                </label>
                <MoneyInput
                  id="transfer-dest-amount"
                  value={receivedAmount}
                  onChange={setReceivedAmount}
                  currencyCode={toAcc?.currency || baseCurrency}
                  placeholder="0.00"
                  required
                />
                <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', display: 'block', marginTop: '0.25rem' }}>
                  Rate: 1 {fromAcc.currency} ≈ {Number(fxRate).toFixed(3)} {toAcc.currency}
                </span>
              </div>
            )}
          </div>

          {/* Overdraft Warning Banner (Non-blocking) */}
          {isOverdrawnWarning && (
            <div
              style={{
                padding: '0.65rem 0.85rem',
                borderRadius: '8px',
                background: 'rgba(234, 179, 8, 0.12)',
                border: '1px solid rgba(234, 179, 8, 0.3)',
                color: '#b45309',
                fontSize: '0.8rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
              }}
            >
              <span>⚠️</span>
              <span>
                <strong>Overdraft Notice:</strong> Amount ({amount} {fromAcc.currency}) exceeds available balance ({fromAcc.balance} {fromAcc.currency}). Account will have a negative balance.
              </span>
            </div>
          )}

          {/* Optional Fields: Fee, Date, Note */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.85rem' }}>
            <div>
              <label className="form-label" htmlFor="transfer-fee-amount">
                Bank / Transfer Fee (Optional)
              </label>
              <MoneyInput
                id="transfer-fee-amount"
                value={feeAmount}
                onChange={setFeeAmount}
                currencyCode={fromAcc?.currency || baseCurrency}
                placeholder="0.00"
              />
              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                Deducted from {fromAcc?.name}
              </span>
            </div>

            <div>
              <label className="form-label" htmlFor="transfer-date">
                Date
              </label>
              <input
                id="transfer-date"
                type="date"
                className="input-field"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
              />
            </div>
          </div>

          <div>
            <label className="form-label" htmlFor="transfer-notes">
              Notes / Reference (Optional)
            </label>
            <input
              id="transfer-notes"
              type="text"
              className="input-field"
              placeholder={isCreditCardPayment ? 'e.g. October bill settlement' : 'e.g. Internal funds balancing, ATM slip #291'}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          {/* Live Outcome Preview Box */}
          {numAmount > 0 && (
            <div
              style={{
                padding: '0.85rem 1rem',
                borderRadius: '12px',
                background: 'rgba(var(--md-primary-rgb), 0.05)',
                border: '1px solid rgba(var(--md-primary-rgb), 0.2)',
                fontSize: '0.8rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.4rem',
              }}
            >
              <span style={{ fontWeight: 700, color: 'var(--md-primary)', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Preview Result
              </span>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>{fromAcc?.name}:</span>
                <span>
                  <strong>{fromCurrentBal.toFixed(2)}</strong> ➔ <strong style={{ color: fromProjected < 0 ? 'var(--md-error)' : 'var(--text-primary)' }}>{fromProjected.toFixed(2)}</strong> {fromAcc?.currency}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>{toAcc?.name}:</span>
                <span>
                  <strong>{toCurrentBal.toFixed(2)}</strong> ➔ <strong>{toProjected.toFixed(2)}</strong> {toAcc?.currency}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '0.35rem', borderTop: '1px solid rgba(var(--md-on-surface-rgb), 0.08)', color: 'var(--text-secondary)', fontSize: '0.75rem' }}>
                <span>Net Worth Impact:</span>
                <span style={{ fontWeight: 600, color: numFee > 0 ? 'var(--md-error)' : 'var(--text-secondary)' }}>
                  {numFee > 0 ? `-${numFee.toFixed(2)} ${fromAcc?.currency} (fee only)` : '0.00 (neutral)'}
                </span>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="modal-actions" style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
            <button
              type="button"
              className="btn-secondary"
              onClick={onClose}
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="submit-btn primary-glow"
              disabled={loading}
              style={{ width: 'auto', minWidth: '150px' }}
            >
              {loading ? 'Processing...' : editTransaction ? 'Update Transfer' : 'Confirm Transfer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
