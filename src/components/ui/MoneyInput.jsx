import { CURRENCY_REGISTRY } from '../../lib/formatters';

export default function MoneyInput({
  id = 'money-input',
  value,
  onChange,
  currencyCode = 'USD',
  placeholder = '0.00',
  required = false,
  className = '',
  disabled = false,
  label,
  error,
}) {
  const currency = CURRENCY_REGISTRY[currencyCode] || { symbol: currencyCode, minorUnits: 2 };

  const handleChange = (e) => {
    const val = e.target.value;
    // Disallow invalid characters or excessive decimal places
    if (val === '') {
      onChange('');
      return;
    }
    // Allow digits and at most one decimal point up to minorUnits places
    const regex = new RegExp(`^\\d*(\\.\\d{0,${currency.minorUnits}})?$`);
    if (regex.test(val)) {
      onChange(val);
    }
  };

  return (
    <div className={`money-input-wrapper ${className}`}>
      {label && (
        <label htmlFor={id} className="form-label">
          {label}
        </label>
      )}
      <div className={`money-input-box ${error ? 'has-error' : ''}`}>
        <span className="money-currency-prefix" title={currencyCode}>
          {currency.symbol}
        </span>
        <input
          id={id}
          type="text"
          inputMode="decimal"
          value={value}
          onChange={handleChange}
          placeholder={placeholder}
          required={required}
          disabled={disabled}
          className="money-raw-input"
          autoComplete="off"
        />
        <span className="money-currency-suffix">{currencyCode}</span>
      </div>
      {error && <span className="field-error-msg">{error}</span>}
    </div>
  );
}
