import { describe, it, expect } from 'vitest';
import {
  roundMoney,
  addMoney,
  subtractMoney,
  multiplyRate,
  toMinorUnits,
  fromMinorUnits,
  formatMoney,
  calculateAssetBalance,
  calculateLiabilityBalance,
  calculateNetWorth,
  validateTransfer,
  validateSplit,
  hasPermission,
  TransactionCreateSchema,
} from '../src/index.js';

describe('Money Arithmetic & Precision', () => {
  it('applies banker (half-even) rounding accurately', () => {
    // In half-even rounding:
    // 2.5 rounds to 2 (even)
    // 3.5 rounds to 4 (even)
    expect(roundMoney('2.5', 0)).toBe('2');
    expect(roundMoney('3.5', 0)).toBe('4');
    expect(roundMoney('2.125', 2)).toBe('2.12'); // 2 is even
    expect(roundMoney('2.135', 2)).toBe('2.14'); // 4 is even
  });

  it('performs exact addition and subtraction without floating point errors', () => {
    // Classic IEEE-754 float failure: 0.1 + 0.2 = 0.30000000000000004
    expect(addMoney('0.1', '0.2')).toBe('0.3');
    expect(subtractMoney('1.00', '0.99')).toBe('0.01');
  });

  it('multiplies FX rates with banker rounding to minor units', () => {
    // 1000 AED at 75.8234 rate = 75823.40 PKR
    const pkr = multiplyRate('1000.00', '75.8234', 2);
    expect(pkr).toBe('75823.40');
  });

  it('converts to and from integer minor units reliably', () => {
    expect(toMinorUnits('12.50', 2)).toBe(1250n);
    expect(toMinorUnits('500', 0)).toBe(500n); // JPY
    expect(toMinorUnits('1.250', 3)).toBe(1250n); // KWD

    expect(fromMinorUnits(1250n, 2)).toBe('12.50');
    expect(fromMinorUnits(500n, 0)).toBe('500');
    expect(fromMinorUnits(1250n, 3)).toBe('1.250');
  });

  it('formats numbers with international and South Asian grouping', () => {
    const amount = '1250000.50';
    expect(formatMoney(amount, { currency: 'USD', style: 'international' })).toBe('1,250,000.50');
    expect(formatMoney(amount, { currency: 'PKR', style: 'south_asian' })).toBe('12,50,000.50');
  });
});

describe('Ledger Formulas (Asset, Liability, Net Worth)', () => {
  it('calculates Asset balance correctly: opening + in - out', () => {
    const opening = '1000.00';
    const lines = [
      { direction: 'in' as const, amount: '500.00' },
      { direction: 'out' as const, amount: '200.00' },
      { direction: 'out' as const, amount: '50.25' },
    ];
    // 1000 + 500 - 200 - 50.25 = 1249.75
    expect(calculateAssetBalance(opening, lines)).toBe('1249.75');
  });

  it('calculates Liability balance correctly: balance = amount owed', () => {
    // Credit card with 200 owed at opening
    // Charge 150 (out), payment 200 (in)
    // Balance owed = 200 + 150 - 200 = 150
    const opening = '200.00';
    const lines = [
      { direction: 'out' as const, amount: '150.00' }, // spending increases owed
      { direction: 'in' as const, amount: '200.00' },  // payment decreases owed
    ];
    expect(calculateLiabilityBalance(opening, lines)).toBe('150.00');
  });

  it('calculates Net Worth: total assets - total liabilities', () => {
    const assets = ['5000.00', '15000.00', '250.00']; // Total 20,250
    const liabilities = ['3000.00', '1200.00']; // Total 4,200
    // Net Worth = 20,250 - 4,200 = 16,050.00
    expect(calculateNetWorth(assets, liabilities)).toBe('16050.00');
  });
});

describe('Ledger Validation Rules (Transfers & Splits)', () => {
  it('validates transfers properly', () => {
    const source = 'acc-bank-1';
    const dest = 'acc-card-2';

    // Valid transfer
    const validLines = [
      { accountId: source, direction: 'out' as const, amount: '500.00', currency: 'USD' },
      { accountId: dest, direction: 'in' as const, amount: '500.00', currency: 'USD' },
    ];
    expect(validateTransfer(source, dest, validLines).valid).toBe(true);

    // Invalid transfer: same account
    expect(validateTransfer(source, source, validLines).valid).toBe(false);

    // Valid transfer with fee line
    const transferWithFee = [
      ...validLines,
      { accountId: source, direction: 'out' as const, amount: '5.00', currency: 'USD' },
    ];
    expect(validateTransfer(source, dest, transferWithFee).valid).toBe(true);
  });

  it('validates splits strictly matching header total', () => {
    const headerTotal = '100.00';
    const validLines = ['60.00', '40.00'];
    expect(validateSplit(headerTotal, validLines).valid).toBe(true);

    const invalidLines = ['60.00', '39.99'];
    const result = validateSplit(headerTotal, invalidLines);
    expect(result.valid).toBe(false);
    expect(result.difference).toBe('-0.01');
  });
});

describe('Permission Matrix', () => {
  it('enforces role access constraints', () => {
    expect(hasPermission('owner', 'workspace', 'delete')).toBe(true);
    expect(hasPermission('admin', 'workspace', 'delete')).toBe(false);
    expect(hasPermission('manager', 'transactions', 'create')).toBe(true);
    expect(hasPermission('viewer', 'transactions', 'create')).toBe(false);
    expect(hasPermission('viewer', 'transactions', 'read')).toBe(true);
  });
});

describe('Zod Validation Schemas', () => {
  it('rejects invalid transaction schemas (e.g. floats or missing idempotency key)', () => {
    const validTx = {
      workspaceId: '123e4567-e89b-12d3-a456-426614174000',
      type: 'expense',
      date: '2026-10-07',
      status: 'cleared',
      idempotencyKey: 'idem-key-random-string-12345678',
      version: 1,
      source: 'manual',
      lines: [
        {
          accountId: '123e4567-e89b-12d3-a456-426614174001',
          direction: 'out',
          amount: '125.50',
          currency: 'USD',
          fxRate: '1.0000000000',
        },
      ],
    };

    expect(TransactionCreateSchema.safeParse(validTx).success).toBe(true);

    // Negative amount rejected
    const invalidNegative = {
      ...validTx,
      lines: [{ ...validTx.lines[0], amount: '-50.00' }],
    };
    expect(TransactionCreateSchema.safeParse(invalidNegative).success).toBe(false);

    // Empty lines rejected
    const invalidNoLines = { ...validTx, lines: [] };
    expect(TransactionCreateSchema.safeParse(invalidNoLines).success).toBe(false);
  });
});
