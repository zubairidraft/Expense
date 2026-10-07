import Decimal from 'decimal.js';
import type { CurrencyInfo } from '../types/index.js';

// Configure Decimal for financial precision: 28 decimal places, Banker's (half-even) rounding
Decimal.set({
  precision: 28,
  rounding: Decimal.ROUND_HALF_EVEN,
  toExpNeg: -20,
  toExpPos: 20,
});

export const CURRENCY_REGISTRY: Record<string, CurrencyInfo> = {
  PKR: { code: 'PKR', minorUnits: 2, symbol: 'Rs', name: 'Pakistani Rupee', active: true },
  AED: { code: 'AED', minorUnits: 2, symbol: 'AED', name: 'UAE Dirham', active: true },
  USD: { code: 'USD', minorUnits: 2, symbol: '$', name: 'US Dollar', active: true },
  EUR: { code: 'EUR', minorUnits: 2, symbol: '€', name: 'Euro', active: true },
  GBP: { code: 'GBP', minorUnits: 2, symbol: '£', name: 'British Pound', active: true },
  SAR: { code: 'SAR', minorUnits: 2, symbol: 'SR', name: 'Saudi Riyal', active: true },
  INR: { code: 'INR', minorUnits: 2, symbol: '₹', name: 'Indian Rupee', active: true },
  JPY: { code: 'JPY', minorUnits: 0, symbol: '¥', name: 'Japanese Yen', active: true },
  KWD: { code: 'KWD', minorUnits: 3, symbol: 'KD', name: 'Kuwaiti Dinar', active: true },
  BHD: { code: 'BHD', minorUnits: 3, symbol: 'BD', name: 'Bahraini Dinar', active: true },
  OMR: { code: 'OMR', minorUnits: 3, symbol: 'RO', name: 'Omani Rial', active: true },
};

export function getCurrencyMinorUnits(code: string): number {
  return CURRENCY_REGISTRY[code.toUpperCase()]?.minorUnits ?? 2;
}

export function toDecimal(val: string | Decimal): Decimal {
  if (val instanceof Decimal) return val;
  if (typeof val !== 'string' || val.trim() === '') {
    throw new Error(`Invalid money string representation: "${val}"`);
  }
  return new Decimal(val);
}

/**
 * Rounds money using banker's (half-even) rounding to the currency's minor units.
 */
export function roundMoney(amount: string | Decimal, minorUnits: number): string {
  const d = toDecimal(amount);
  return d.toFixed(minorUnits, Decimal.ROUND_HALF_EVEN);
}

/**
 * Adds two money string values with zero floating-point error.
 */
export function addMoney(a: string | Decimal, b: string | Decimal): string {
  return toDecimal(a).plus(toDecimal(b)).toString();
}

/**
 * Subtracts b from a with zero floating-point error.
 */
export function subtractMoney(a: string | Decimal, b: string | Decimal): string {
  return toDecimal(a).minus(toDecimal(b)).toString();
}

/**
 * Multiplies an amount by an FX rate or scalar, rounding with banker's rounding.
 */
export function multiplyRate(amount: string | Decimal, rate: string | Decimal, minorUnits: number): string {
  const result = toDecimal(amount).times(toDecimal(rate));
  return roundMoney(result, minorUnits);
}

/**
 * Converts decimal amount string to integer minor units (e.g. "12.50" with minorUnits=2 -> 1250n)
 */
export function toMinorUnits(amount: string | Decimal, minorUnits: number): bigint {
  const d = toDecimal(amount);
  const factor = new Decimal(10).pow(minorUnits);
  const rounded = d.times(factor).round();
  return BigInt(rounded.toFixed(0));
}

/**
 * Converts integer minor units to decimal amount string (e.g. 1250n with minorUnits=2 -> "12.50")
 */
export function fromMinorUnits(units: bigint, minorUnits: number): string {
  const factor = new Decimal(10).pow(minorUnits);
  const d = new Decimal(units.toString()).dividedBy(factor);
  return d.toFixed(minorUnits);
}

/**
 * Formats money with International (1,250,000.00) or South Asian / Lakh-Crore (12,50,000.00) grouping.
 */
export function formatMoney(
  amount: string | Decimal,
  options: {
    currency?: string;
    style?: 'international' | 'south_asian';
    includeSymbol?: boolean;
  } = {}
): string {
  const currencyCode = (options.currency || 'USD').toUpperCase();
  const minorUnits = getCurrencyMinorUnits(currencyCode);
  const roundedStr = roundMoney(amount, minorUnits);

  const parts = roundedStr.split('.');
  let integerPart = parts[0];
  const decimalPart = parts.length > 1 ? `.${parts[1]}` : (minorUnits > 0 ? '.' + '0'.repeat(minorUnits) : '');
  const isNegative = integerPart.startsWith('-');
  if (isNegative) {
    integerPart = integerPart.slice(1);
  }

  let formattedInt = '';
  if (options.style === 'south_asian') {
    // South Asian grouping: 12,34,567
    if (integerPart.length > 3) {
      const lastThree = integerPart.slice(-3);
      const otherNumbers = integerPart.slice(0, -3);
      formattedInt = otherNumbers.replace(/\B(?=(\d{2})+(?!\d))/g, ',') + ',' + lastThree;
    } else {
      formattedInt = integerPart;
    }
  } else {
    // International grouping: 1,234,567
    formattedInt = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  }

  const sign = isNegative ? '-' : '';
  const formatted = `${sign}${formattedInt}${decimalPart}`;

  if (options.includeSymbol) {
    const symbol = CURRENCY_REGISTRY[currencyCode]?.symbol ?? currencyCode;
    return `${symbol} ${formatted}`;
  }

  return formatted;
}
