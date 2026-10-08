import { Decimal } from 'decimal.js';

/**
 * Formats a number using the South Asian numeral grouping system
 * (groups of two digits after the initial thousand group: e.g. 12,34,567.89)
 */
export function formatSouthAsian(
  amount: number | string,
  options: { decimals?: number; showCurrencySymbol?: string } = {}
): string {
  const dec = new Decimal(amount || 0);
  const decimals = options.decimals ?? 2;
  const isNegative = dec.isNegative();
  const absVal = dec.abs().toFixed(decimals);

  const parts = absVal.split('.');
  let integerPart = parts[0];
  const decimalPart = parts[1] ? `.${parts[1]}` : '';

  // South Asian grouping:
  // Last 3 digits: e.g. "567"
  // Remaining digits grouped in pairs of 2: e.g. "12,34"
  if (integerPart.length > 3) {
    const lastThree = integerPart.substring(integerPart.length - 3);
    const rest = integerPart.substring(0, integerPart.length - 3);
    const pairs = rest.replace(/\B(?=(\d{2})+(?!\d))/g, ',');
    integerPart = `${pairs},${lastThree}`;
  }

  const formatted = `${isNegative ? '-' : ''}${integerPart}${decimalPart}`;
  return options.showCurrencySymbol ? `${options.showCurrencySymbol} ${formatted}` : formatted;
}

/**
 * Universal formatter supporting International (1,234,567.89) vs South Asian (12,34,567.89) systems.
 */
export function formatAmountWithSystem(
  amount: number | string,
  system: 'intl' | 'south_asian' = 'intl',
  decimals = 2
): string {
  if (system === 'south_asian') {
    return formatSouthAsian(amount, { decimals });
  }

  const dec = new Decimal(amount || 0);
  const isNegative = dec.isNegative();
  const absVal = dec.abs().toFixed(decimals);

  const parts = absVal.split('.');
  const integerPart = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const decimalPart = parts[1] ? `.${parts[1]}` : '';

  return `${isNegative ? '-' : ''}${integerPart}${decimalPart}`;
}
