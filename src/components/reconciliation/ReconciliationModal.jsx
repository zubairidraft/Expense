import { useState, useMemo } from 'react';
import { useAccounts } from '../../context/AccountContext';
import { useTransactions } from '../../context/TransactionContext';
import { useRules } from '../../context/RuleContext';
import { useWorkspace } from '../../context/WorkspaceContext';
import MoneyInput from '../ui/MoneyInput';
import MoneyDisplay from '../ui/MoneyDisplay';
import { todayISO } from '../../lib/dates';
import { dec } from '../../lib/money';

export default function ReconciliationModal({ isOpen, onClose }) {
  const { accounts } = useAccounts();
  const { transactions } = useTransactions();
  const { completeReconciliation } = useRules();
  const { currentWorkspace } = useWorkspace();

  const baseCurrency = currentWorkspace?.base_currency || 'USD';

  // Step 1: Account & Target
  const [selectedAccountId, setSelectedAccountId] = useState('');
  const [statementDate, setStatementDate] = useState(
    todayISO()
  );
  const [statementBalance, setStatementBalance] = useState('');

  // Selected matched transactions
  const [selectedTxIds, setSelectedTxIds] = useState([]);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const targetAccount = useMemo(() => {
    return (
      accounts.find((a) => a.id === selectedAccountId) || accounts[0] || null
    );
  }, [accounts, selectedAccountId]);

  // Unreconciled candidate transactions for the selected account
  const candidateTransactions = useMemo(() => {
    if (!targetAccount) return [];
    return transactions.filter((t) => {
      // Must not already be reconciled
      if (t.status === 'reconciled') return false;
      // Must be on or before statement date
      if (t.date > statementDate) return false;
      // Must involve this account
      const involvesAccount = t.lines?.some(
        (l) => l.account_id === targetAccount.id || l.accountId === targetAccount.id
      );
      return involvesAccount;
    });
  }, [transactions, targetAccount, statementDate]);

  // Cleared balance = opening balance + already-reconciled lines + selected lines,
  // in the ACCOUNT's own currency (line.amount, never the base-currency amount).
  const selectedClearedTotal = useMemo(() => {
    if (!targetAccount) return 0;
    const isAsset = (targetAccount.nature || 'asset') === 'asset';
    let bal = dec(targetAccount.opening_balance);

    for (const t of transactions) {
      if (t.deleted_at) continue;
      const counts = t.status === 'reconciled' || selectedTxIds.includes(t.id);
      if (!counts || (t.date || '') > statementDate) continue;
      for (const l of t.lines || []) {
        if ((l.account_id || l.accountId) !== targetAccount.id) continue;
        const amt = dec(l.amount);
        const isIn = l.direction === 'in';
        bal = isAsset === isIn ? bal.plus(amt) : bal.minus(amt);
      }
    }
    return bal.toNumber();
  }, [targetAccount, transactions, selectedTxIds, statementDate]);

  const targetBalNum = parseFloat(statementBalance || '0');
  const difference = targetBalNum - selectedClearedTotal;
  const isBalanced = Math.abs(difference) < 0.001 && statementBalance !== '';

  const handleToggleTx = (txId) => {
    setSelectedTxIds((prev) =>
      prev.includes(txId) ? prev.filter((id) => id !== txId) : [...prev, txId]
    );
  };

  const handleSelectAll = () => {
    if (selectedTxIds.length === candidateTransactions.length) {
      setSelectedTxIds([]);
    } else {
      setSelectedTxIds(candidateTransactions.map((t) => t.id));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!targetAccount) return;
    if (!statementBalance) {
      setErrorMsg('Please enter the statement ending balance.');
      return;
    }

    if (!isBalanced) {
      const confirmProceed = window.confirm(
        `Warning: There is a reconciliation difference of ${difference.toFixed(2)}. Do you still wish to lock these transactions?`
      );
      if (!confirmProceed) return;
    }

    setLoading(true);
    setErrorMsg('');

    const res = await completeReconciliation({
      accountId: targetAccount.id,
      statementDate,
      statementBalance,
      clearedBalance: selectedClearedTotal.toFixed(2),
      transactionIds: selectedTxIds,
    });

    setLoading(false);

    if (res.error) {
      setErrorMsg(res.error.message || 'Failed to complete reconciliation');
    } else {
      setSuccessMsg('✓ Account successfully reconciled and transactions locked!');
      setTimeout(() => {
        setSuccessMsg('');
        setSelectedTxIds([]);
        setStatementBalance('');
        onClose();
      }, 1200);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-content glass-card modal-large" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title-group">
            <h2 className="modal-title">Bank Statement Reconciliation</h2>
            <p className="modal-subtitle">
              Verify ledger integrity against authoritative bank statements and lock cleared records
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

        {successMsg && (
          <div className="quick-add-success-banner" style={{ margin: '1rem 0' }}>
            <span>{successMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="auth-form">
          {/* Account & Target Statement Header */}
          <div className="form-row-2">
            <div className="form-group">
              <label htmlFor="rec-account">Select Financial Account</label>
              <select
                id="rec-account"
                className="select-field"
                value={targetAccount?.id || ''}
                onChange={(e) => {
                  setSelectedAccountId(e.target.value);
                  setSelectedTxIds([]);
                }}
              >
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name} ({a.currency}) · {a.nature}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="rec-date">Statement Ending Date</label>
              <input
                id="rec-date"
                type="date"
                required
                className="input-field"
                value={statementDate}
                onChange={(e) => setStatementDate(e.target.value)}
              />
            </div>
          </div>

          <div className="form-group">
            <MoneyInput
              id="rec-statement-bal"
              label="Statement Ending Balance (from Bank PDF / Paper)"
              value={statementBalance}
              onChange={setStatementBalance}
              currencyCode={targetAccount?.currency || baseCurrency}
              placeholder="0.00"
              required
            />
          </div>

          {/* Real-time Reconciliation Balance Meter */}
          <div className="rec-balance-meter glass-card">
            <div className="meter-col">
              <span className="meter-label">Target Statement Balance</span>
              <span className="meter-val">
                <MoneyDisplay
                  amount={targetBalNum}
                  currencyCode={targetAccount?.currency || baseCurrency}
                />
              </span>
            </div>

            <div className="meter-divider">−</div>

            <div className="meter-col">
              <span className="meter-label">Matched Cleared Total</span>
              <span className="meter-val">
                <MoneyDisplay
                  amount={selectedClearedTotal}
                  currencyCode={targetAccount?.currency || baseCurrency}
                />
              </span>
            </div>

            <div className="meter-divider">=</div>

            <div className={`meter-col diff ${isBalanced ? 'balanced' : 'unbalanced'}`}>
              <span className="meter-label">Reconciliation Difference</span>
              <span className="meter-val-diff">
                <MoneyDisplay
                  amount={difference}
                  currencyCode={targetAccount?.currency || baseCurrency}
                  showSign
                />
              </span>
            </div>
          </div>

          {/* Transactions Checklist */}
          <div className="rec-tx-checklist-section">
            <div className="rec-checklist-header">
              <span className="rec-header-title">
                Unreconciled Transactions ({candidateTransactions.length})
              </span>
              {candidateTransactions.length > 0 && (
                <button
                  type="button"
                  className="btn-select-all"
                  onClick={handleSelectAll}
                >
                  {selectedTxIds.length === candidateTransactions.length
                    ? 'Deselect All'
                    : 'Select All'}
                </button>
              )}
            </div>

            <div className="rec-tx-list">
              {candidateTransactions.length === 0 ? (
                <div className="empty-state" style={{ padding: '1.5rem' }}>
                  <p>No uncleared transactions found on or before {statementDate}.</p>
                </div>
              ) : (
                candidateTransactions.map((tx) => {
                  const isChecked = selectedTxIds.includes(tx.id);
                  const line = tx.lines?.find(
                    (l) => l.account_id === targetAccount?.id || l.accountId === targetAccount?.id
                  );
                  const amt = line ? parseFloat(line.base_amount || line.amount || '0') : 0;

                  return (
                    <label
                      key={tx.id}
                      className={`rec-tx-row ${isChecked ? 'selected' : ''}`}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => handleToggleTx(tx.id)}
                      />
                      <div className="rec-tx-meta">
                        <span className="rec-tx-title">
                          {tx.payee_name || 'Transaction'}
                        </span>
                        <span className="rec-tx-sub">
                          {line?.category?.name || tx.type} · {tx.date}
                        </span>
                      </div>
                      <div className="rec-tx-amt">
                        <MoneyDisplay
                          amount={amt}
                          currencyCode={line?.currency || targetAccount?.currency || baseCurrency}
                          type={line?.direction === 'in' ? 'income' : 'expense'}
                          showSign
                        />
                      </div>
                    </label>
                  );
                })
              )}
            </div>
          </div>

          {/* Modal Actions */}
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
              className={`btn btn-primary ${isBalanced ? 'primary-glow' : ''}`}
              disabled={loading || candidateTransactions.length === 0}
            >
              {loading
                ? 'Locking & Reconciling...'
                : isBalanced
                ? '🔒 Lock & Complete Reconciliation'
                : 'Complete with Difference'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
