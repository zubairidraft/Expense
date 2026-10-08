import { formatMoney } from '../../lib/formatters';

export default function MoneyDisplay({
  amount,
  currencyCode = 'USD',
  numberFormat = 'intl',
  type, // 'income' | 'expense' | 'neutral'
  showSign = false,
  className = '',
}) {
  const formatted = formatMoney(amount, currencyCode, numberFormat);

  let sign = '';
  if (showSign) {
    if (type === 'income') sign = '+';
    else if (type === 'expense') sign = '-';
  }

  const typeClass = type ? `type-${type}` : '';

  return (
    <span className={`money-display ${typeClass} ${className}`}>
      {sign}
      {formatted}
    </span>
  );
}
