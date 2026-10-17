import { useState, useMemo, useEffect } from 'react';
import { useWorkspace } from '../../context/WorkspaceContext';
import { useAccounts } from '../../context/AccountContext';
import { useSharedDebts } from '../../context/SharedDebtsContext';
import {
  calculateZakat,
  computeNisabValue,
  NISAB_STANDARDS,
} from '@universal-expense/core';
import MoneyDisplay from '../ui/MoneyDisplay';

export default function ZakatCalculatorModal({ isOpen, onClose }) {
  const { currentWorkspace } = useWorkspace();
  const { accounts } = useAccounts();
  const { debts } = useSharedDebts();
  const currency = currentWorkspace?.base_currency || 'USD';

  // Benchmark metal prices per gram by currency
  const DEFAULT_PRICES = {
    USD: { silver: 1.15, gold: 86.50 },
    PKR: { silver: 310, gold: 23500 },
    AED: { silver: 4.20, gold: 318 },
    SAR: { silver: 4.30, gold: 325 },
    EUR: { silver: 1.05, gold: 79.50 },
    GBP: { silver: 0.88, gold: 67.00 },
  };

  const defaultPrice = DEFAULT_PRICES[currency] || DEFAULT_PRICES.USD;

  const [metalStandard, setMetalStandard] = useState('silver'); // 'silver' | 'gold'
  const [metalPricePerGram, setMetalPricePerGram] = useState(defaultPrice.silver);

  // Asset inputs
  const [cashInHand, setCashInHand] = useState('0');
  const [bankBalances, setBankBalances] = useState('0');
  const [goldValue, setGoldValue] = useState('0');
  const [silverValue, setSilverValue] = useState('0');
  const [investmentsAndCrypto, setInvestmentsAndCrypto] = useState('0');
  const [businessInventory, setBusinessInventory] = useState('0');
  const [loanReceivables, setLoanReceivables] = useState('0');

  // Liabilities inputs
  const [immediateDebtsDue, setImmediateDebtsDue] = useState('0');
  const [dueBillsAndExpenses, setDueBillsAndExpenses] = useState('0');

  // Prefill bank balances and debts from app state when modal opens
  useEffect(() => {
    if (isOpen) {
      // Calculate bank balances from liquid asset accounts
      const liquidTotal = accounts
        .filter((a) => a.nature === 'asset' && !a.archived_at)
        .reduce((sum, a) => sum + parseFloat(a.balance || a.opening_balance || 0), 0);
      setBankBalances(Math.max(0, liquidTotal).toFixed(2));

      // Calculate debts owed (borrowed udhaar money)
      const debtsOwed = debts
        .filter((d) => d.direction === 'borrowed' && d.status !== 'settled')
        .reduce((sum, d) => sum + parseFloat(d.remaining_amount || d.amount || 0), 0);
      setImmediateDebtsDue(Math.max(0, debtsOwed).toFixed(2));

      // Set default metal price for standard
      const p = metalStandard === 'silver' ? defaultPrice.silver : defaultPrice.gold;
      setMetalPricePerGram(p);
    }
  }, [isOpen, accounts, debts, metalStandard, defaultPrice.silver, defaultPrice.gold]);

  // Update metal price when standard changes
  const handleStandardChange = (std) => {
    setMetalStandard(std);
    setMetalPricePerGram(std === 'silver' ? defaultPrice.silver : defaultPrice.gold);
  };

  // Compute Nisab Threshold
  const nisabThreshold = useMemo(() => {
    return computeNisabValue(metalPricePerGram, metalStandard);
  }, [metalPricePerGram, metalStandard]);

  // Calculate Zakat
  const zakatResult = useMemo(() => {
    return calculateZakat({
      assets: {
        cashInHand,
        bankBalances,
        goldValue,
        silverValue,
        investmentsAndCrypto,
        businessInventory,
        loanReceivables,
      },
      liabilities: {
        immediateDebtsDue,
        dueBillsAndExpenses,
      },
      nisabThreshold,
      currency,
    });
  }, [
    cashInHand,
    bankBalances,
    goldValue,
    silverValue,
    investmentsAndCrypto,
    businessInventory,
    loanReceivables,
    immediateDebtsDue,
    dueBillsAndExpenses,
    nisabThreshold,
    currency,
  ]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && onClose) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-content" style={{ maxWidth: '640px', maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ fontSize: '1.5rem' }}>🌙</span>
            <h2 style={{ fontSize: '1.25rem', fontWeight: '700', margin: 0, color: 'var(--text-primary)' }}>
              Zakat Calculator (2.5%)
            </h2>
          </div>
          <button className="btn-secondary" onClick={onClose} style={{ padding: '0.3rem 0.6rem' }}>
            ✕
          </button>
        </div>

        {/* Nisab Benchmark Settings */}
        <div className="card" style={{ padding: '1rem', marginBottom: '1.25rem', background: 'rgba(var(--md-primary-rgb), 0.05)', border: '1px solid rgba(var(--md-primary-rgb), 0.2)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '0.75rem' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: '600', color: 'var(--text-primary)' }}>
              Nisab Threshold Standard:
            </span>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <label style={{ fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '0.3rem', cursor: 'pointer' }}>
                <input
                  type="radio"
                  name="nisab_std"
                  checked={metalStandard === 'silver'}
                  onChange={() => handleStandardChange('silver')}
                />
                Silver ({NISAB_STANDARDS.SILVER_GRAMS.toString()}g)
              </label>
              <label style={{ fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '0.3rem', cursor: 'pointer' }}>
                <input
                  type="radio"
                  name="nisab_std"
                  checked={metalStandard === 'gold'}
                  onChange={() => handleStandardChange('gold')}
                />
                Gold ({NISAB_STANDARDS.GOLD_GRAMS.toString()}g)
              </label>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: '160px' }}>
              <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                {metalStandard === 'silver' ? 'Silver' : 'Gold'} Price per Gram ({currency}):
              </label>
              <input
                type="number"
                step="any"
                className="input-field"
                value={metalPricePerGram}
                onChange={(e) => setMetalPricePerGram(parseFloat(e.target.value) || 0)}
                style={{ padding: '0.35rem 0.6rem', marginTop: '0.2rem' }}
              />
            </div>
            <div style={{ padding: '0.5rem 0.75rem', borderRadius: '6px', background: 'rgba(var(--md-on-surface-rgb), 0.05)', textAlign: 'right' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Nisab Required:</span>
              <p style={{ margin: 0, fontWeight: '700', fontSize: '1rem', color: 'var(--text-primary)' }}>
                {nisabThreshold} {currency}
              </p>
            </div>
          </div>
        </div>

        {/* Assets Section */}
        <h4 style={{ fontSize: '0.9rem', fontWeight: '700', textTransform: 'uppercase', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
          1. Zakatable Assets
        </h4>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '0.75rem', marginBottom: '1.25rem' }}>
          <div>
            <label style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>Cash in Hand:</label>
            <input
              type="number"
              className="input-field"
              value={cashInHand}
              onChange={(e) => setCashInHand(e.target.value)}
              placeholder="0.00"
            />
          </div>
          <div>
            <label style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>Bank Balances (Auto-filled):</label>
            <input
              type="number"
              className="input-field"
              value={bankBalances}
              onChange={(e) => setBankBalances(e.target.value)}
              placeholder="0.00"
            />
          </div>
          <div>
            <label style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>Gold Jewelry / Bullion Value:</label>
            <input
              type="number"
              className="input-field"
              value={goldValue}
              onChange={(e) => setGoldValue(e.target.value)}
              placeholder="0.00"
            />
          </div>
          <div>
            <label style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>Silver Jewelry / Bullion Value:</label>
            <input
              type="number"
              className="input-field"
              value={silverValue}
              onChange={(e) => setSilverValue(e.target.value)}
              placeholder="0.00"
            />
          </div>
          <div>
            <label style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>Shares, Crypto & Liquid Investments:</label>
            <input
              type="number"
              className="input-field"
              value={investmentsAndCrypto}
              onChange={(e) => setInvestmentsAndCrypto(e.target.value)}
              placeholder="0.00"
            />
          </div>
          <div>
            <label style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>Business Inventory for Sale:</label>
            <input
              type="number"
              className="input-field"
              value={businessInventory}
              onChange={(e) => setBusinessInventory(e.target.value)}
              placeholder="0.00"
            />
          </div>
          <div>
            <label style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>Lent Funds (Expected Loan Recoveries):</label>
            <input
              type="number"
              className="input-field"
              value={loanReceivables}
              onChange={(e) => setLoanReceivables(e.target.value)}
              placeholder="0.00"
            />
          </div>
        </div>

        {/* Liabilities Section */}
        <h4 style={{ fontSize: '0.9rem', fontWeight: '700', textTransform: 'uppercase', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
          2. Deductible Immediate Liabilities
        </h4>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '0.75rem', marginBottom: '1.5rem' }}>
          <div>
            <label style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>Immediate Debts Due (Loans Owed to Others):</label>
            <input
              type="number"
              className="input-field"
              value={immediateDebtsDue}
              onChange={(e) => setImmediateDebtsDue(e.target.value)}
              placeholder="0.00"
            />
          </div>
          <div>
            <label style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>Due Rent, Utilities & Bills:</label>
            <input
              type="number"
              className="input-field"
              value={dueBillsAndExpenses}
              onChange={(e) => setDueBillsAndExpenses(e.target.value)}
              placeholder="0.00"
            />
          </div>
        </div>

        {/* Calculation Result Summary Card */}
        <div
          style={{
            padding: '1.25rem',
            borderRadius: '10px',
            background: zakatResult.isNisabExceeded ? 'rgba(var(--md-success-rgb), 0.08)' : 'rgba(var(--md-on-surface-rgb), 0.03)',
            border: `1px solid ${zakatResult.isNisabExceeded ? 'rgba(var(--md-success-rgb), 0.3)' : 'var(--border-color)'}`,
            marginBottom: '1rem',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Net Zakatable Wealth:</span>
            <span style={{ fontSize: '1.1rem', fontWeight: '700' }}>
              {zakatResult.netZakatableWealth} {currency}
            </span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Nisab Threshold Status:</span>
            <span
              style={{
                fontSize: '0.8rem',
                padding: '0.2rem 0.5rem',
                borderRadius: '4px',
                fontWeight: '700',
                background: zakatResult.isNisabExceeded ? 'var(--md-success)' : 'rgba(var(--md-on-surface-rgb), 0.1)',
                color: 'var(--md-on-primary)',
              }}
            >
              {zakatResult.isNisabExceeded ? '✅ Nisab Exceeded (Eligible)' : '⚪ Below Nisab (No Zakat Due)'}
            </span>
          </div>

          <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '0.75rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '1rem', fontWeight: '700', color: 'var(--text-primary)' }}>
              Zakat Payable (2.5%):
            </span>
            <span style={{ fontSize: '1.5rem', fontWeight: '900', color: zakatResult.isNisabExceeded ? 'var(--md-success)' : 'var(--text-secondary)' }}>
              {zakatResult.zakatPayable} {currency}
            </span>
          </div>
        </div>

        {/* Footer Actions */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
          <button className="btn-secondary" onClick={onClose}>
            Close
          </button>
          <button
            className="btn-primary"
            onClick={() => {
              navigator.clipboard?.writeText(
                `Zakat Calculation (${currency}): Net Wealth = ${zakatResult.netZakatableWealth}, Nisab = ${zakatResult.nisabThreshold}, Zakat Payable (2.5%) = ${zakatResult.zakatPayable}`
              );
              alert('Zakat calculation summary copied to clipboard!');
            }}
          >
            📋 Copy Summary
          </button>
        </div>
      </div>
    </div>
  );
}
