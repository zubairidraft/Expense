import { describe, it, expect } from 'vitest';
import {
  calculateZakat,
  computeNisabValue,
} from '../src/regional/zakatCalculator.js';
import {
  formatSouthAsian,
  formatAmountWithSystem,
} from '../src/regional/numberFormatters.js';

describe('Zakat Calculator & Nisab Thresholds', () => {
  it('computes correct Nisab threshold using silver and gold rates', () => {
    // Silver: 612.36 grams * $1.20/gram = $734.832 -> 734.83
    const silverNisab = computeNisabValue('1.20', 'silver');
    expect(silverNisab).toBe('734.83');

    // Gold: 87.48 grams * $85.00/gram = $7435.80
    const goldNisab = computeNisabValue('85.00', 'gold');
    expect(goldNisab).toBe('7435.80');
  });

  it('calculates zero Zakat when net wealth is below Nisab', () => {
    const result = calculateZakat({
      assets: {
        cashInHand: 500,
        bankBalances: 100,
      },
      liabilities: {
        immediateDebtsDue: 200,
      },
      nisabThreshold: 1000,
    });

    expect(result.netZakatableWealth).toBe('400.00');
    expect(result.isNisabExceeded).toBe(false);
    expect(result.zakatPayable).toBe('0.00');
  });

  it('calculates exact 2.5% Zakat on net wealth exceeding Nisab with penny precision', () => {
    // Assets: 10,000 cash + 20,000 bank + 5,000 gold + 5,000 crypto = 40,000
    // Liabilities: 2,000 debts + 500 bills = 2,500
    // Net wealth: 37,500
    // Zakat at 2.5%: 37,500 * 0.025 = 937.50
    const result = calculateZakat({
      assets: {
        cashInHand: '10000.00',
        bankBalances: '20000.00',
        goldValue: '5000.00',
        investmentsAndCrypto: '5000.00',
      },
      liabilities: {
        immediateDebtsDue: '2000.00',
        dueBillsAndExpenses: '500.00',
      },
      nisabThreshold: '1000.00',
    });

    expect(result.totalAssets).toBe('40000.00');
    expect(result.totalLiabilities).toBe('2500.00');
    expect(result.netZakatableWealth).toBe('37500.00');
    expect(result.isNisabExceeded).toBe(true);
    expect(result.zakatPayable).toBe('937.50');
    expect(result.breakdown.cashInHand).toBe('10000.00');
  });
});

describe('South Asian Number Formatter (Lakh & Crore)', () => {
  it('formats standard South Asian numbers with correct comma grouping', () => {
    // 1 Lakh = 1,00,000.00
    expect(formatSouthAsian(100000)).toBe('1,00,000.00');
    // 10 Lakh = 10,00,000.00
    expect(formatSouthAsian(1000000)).toBe('10,00,000.00');
    // 1 Crore = 1,00,00,000.00
    expect(formatSouthAsian(10000000)).toBe('1,00,00,000.00');
    // 12 Crore 34 Lakh 56 Thousand 789.50
    expect(formatSouthAsian(123456789.5)).toBe('12,34,56,789.50');
  });

  it('handles negative amounts and custom decimals', () => {
    expect(formatSouthAsian(-250000)).toBe('-2,50,000.00');
    expect(formatSouthAsian(150000.758, { decimals: 0 })).toBe('1,50,001');
  });

  it('switches seamlessly between International and South Asian formats', () => {
    const amount = 1250000;
    expect(formatAmountWithSystem(amount, 'intl')).toBe('1,250,000.00');
    expect(formatAmountWithSystem(amount, 'south_asian')).toBe('12,50,000.00');
  });
});
