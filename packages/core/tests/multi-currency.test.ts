import { describe, it, expect } from 'vitest';
import {
  convertCurrency,
  invertRate,
  calculateTriangularRate,
  getEstimatedRate,
} from '../src/currency/currencyConverter.js';

describe('Multi-Currency Conversion Services', () => {
  it('converts currencies using forward rate with banker rounding', () => {
    // 100 USD at 278.50 PKR = 27,850.00 PKR
    const pkr = convertCurrency('100.00', 'USD', 'PKR', '278.50', 2);
    expect(pkr).toBe('27850.00');

    // Same currency conversion returns original amount
    const usd = convertCurrency('150.25', 'USD', 'USD', '1.0');
    expect(usd).toBe('150.25');
  });

  it('calculates reciprocal inverse rates accurately', () => {
    // USD/AED = 3.6725 -> AED/USD = 1 / 3.6725 = 0.2722940776
    const inv = invertRate('3.6725', 10);
    expect(inv).toBe('0.2722940776');
  });

  it('calculates cross triangular rates accurately', () => {
    // EUR -> USD (1.08) and USD -> PKR (278.50)
    // EUR -> PKR = 1.08 * 278.50 = 300.78
    const cross = calculateTriangularRate('1.08', '278.50', 2);
    expect(cross).toBe('300.78');
  });

  it('resolves fallback estimated rates between currency pairs', () => {
    const rateUsdToPkr = getEstimatedRate('USD', 'PKR');
    expect(parseFloat(rateUsdToPkr)).toBeCloseTo(278.5, 1);

    const rateSame = getEstimatedRate('EUR', 'EUR');
    expect(rateSame).toBe('1.0000000000');
  });

  it('throws an error on non-positive exchange rates', () => {
    expect(() => convertCurrency('100', 'USD', 'PKR', '0')).toThrow(/Exchange rate must be strictly positive/);
    expect(() => convertCurrency('100', 'USD', 'PKR', '-1.5')).toThrow(/Exchange rate must be strictly positive/);
  });
});
