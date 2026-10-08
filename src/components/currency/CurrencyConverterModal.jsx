import { useState } from 'react';
import { useCurrency } from '../../context/CurrencyContext';

const SUPPORTED_CURRENCIES = ['USD', 'PKR', 'AED', 'EUR', 'GBP', 'SAR', 'INR', 'CAD'];

export default function CurrencyConverterModal({ isOpen, onClose }) {
  const { rates, convert, getEstimatedRate, updateRate } = useCurrency();

  const [amount, setAmount] = useState('100.00');
  const [fromCurrency, setFromCurrency] = useState('USD');
  const [toCurrency, setToCurrency] = useState('PKR');
  const [editingRate, setEditingRate] = useState(false);
  const [customRate, setCustomRate] = useState('');
  const [saving, setSaving] = useState(false);

  if (!isOpen) return null;

  const currentRate = getEstimatedRate(fromCurrency, toCurrency);
  const convertedAmount = convert(amount, fromCurrency, toCurrency);

  const handleSwap = () => {
    setFromCurrency(toCurrency);
    setToCurrency(fromCurrency);
  };

  const handleSaveRate = async () => {
    if (!customRate || parseFloat(customRate) <= 0) return;
    try {
      setSaving(true);
      await updateRate(fromCurrency, toCurrency, customRate);
      setEditingRate(false);
      setCustomRate('');
    } catch (err) {
      alert('Error updating rate: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '480px' }}>
        <div className="modal-header">
          <div className="modal-title-wrap">
            <span className="modal-icon">💱</span>
            <h2 className="modal-title">FX Currency Converter</h2>
          </div>
          <button className="modal-close-btn" onClick={onClose} aria-label="Close modal">
            ✕
          </button>
        </div>

        <div className="modal-form" style={{ marginTop: '1rem' }}>
          <div className="form-group">
            <label className="form-label">Amount</label>
            <input
              type="number"
              step="0.01"
              className="form-input"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="100.00"
              autoFocus
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: '0.75rem', alignItems: 'flex-end', marginBottom: '1rem' }}>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">From</label>
              <select
                className="form-input"
                value={fromCurrency}
                onChange={(e) => setFromCurrency(e.target.value)}
              >
                {SUPPORTED_CURRENCIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            <button
              type="button"
              className="btn-secondary"
              onClick={handleSwap}
              style={{ padding: '0.6rem 0.75rem', marginBottom: '1px' }}
              title="Swap currencies"
            >
              ⇄
            </button>

            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">To</label>
              <select
                className="form-input"
                value={toCurrency}
                onChange={(e) => setToCurrency(e.target.value)}
              >
                {SUPPORTED_CURRENCIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Conversion Result Display */}
          <div
            style={{
              background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.15), rgba(56, 189, 248, 0.1))',
              border: '1px solid rgba(99, 102, 241, 0.25)',
              borderRadius: '12px',
              padding: '1.25rem',
              textAlign: 'center',
              marginBottom: '1rem',
            }}
          >
            <div style={{ fontSize: '0.82rem', color: '#94a3b8' }}>
              {amount} {fromCurrency} =
            </div>
            <div style={{ fontSize: '1.8rem', fontWeight: 700, color: '#f8fafc', margin: '0.25rem 0' }}>
              {convertedAmount} {toCurrency}
            </div>
            <div style={{ fontSize: '0.78rem', color: '#38bdf8' }}>
              1 {fromCurrency} = {parseFloat(currentRate).toFixed(4)} {toCurrency}
            </div>
          </div>

          {/* Rate override / Custom rate */}
          <div style={{ marginBottom: '1.25rem' }}>
            {!editingRate ? (
              <button
                type="button"
                className="btn-text"
                style={{ fontSize: '0.78rem', color: '#6366f1' }}
                onClick={() => {
                  setCustomRate(parseFloat(currentRate).toFixed(4));
                  setEditingRate(true);
                }}
              >
                ✎ Override Exchange Rate
              </button>
            ) : (
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <input
                  type="number"
                  step="0.0001"
                  className="form-input"
                  style={{ width: '140px', padding: '0.3rem 0.5rem', fontSize: '0.85rem' }}
                  value={customRate}
                  onChange={(e) => setCustomRate(e.target.value)}
                  placeholder="New Rate"
                />
                <button
                  type="button"
                  className="btn-primary"
                  style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem' }}
                  onClick={handleSaveRate}
                  disabled={saving}
                >
                  {saving ? 'Saving...' : 'Save Rate'}
                </button>
                <button
                  type="button"
                  className="btn-secondary"
                  style={{ padding: '0.35rem 0.6rem', fontSize: '0.8rem' }}
                  onClick={() => setEditingRate(false)}
                >
                  Cancel
                </button>
              </div>
            )}
          </div>

          {/* Quick Rates Table */}
          <div style={{ borderTop: '1px solid rgba(255, 255, 255, 0.08)', paddingTop: '0.75rem' }}>
            <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              USD Base Benchmark Rates
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.5rem' }}>
              {Object.entries(rates).filter(([c]) => c !== 'USD').map(([code, r]) => (
                <div
                  key={code}
                  style={{
                    background: 'rgba(255, 255, 255, 0.03)',
                    padding: '0.4rem',
                    borderRadius: '6px',
                    textAlign: 'center',
                    border: '1px solid rgba(255, 255, 255, 0.04)',
                  }}
                >
                  <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{code}</div>
                  <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#f8fafc' }}>{parseFloat(r).toFixed(2)}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
