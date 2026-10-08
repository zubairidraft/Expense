import { describe, it, expect } from 'vitest';
import {
  calculateEqualSplit,
  calculatePercentSplit,
  calculateSharesSplit,
  validateExactSplit,
  simplifyDebts,
  generateInstallmentSchedule,
} from '../src/shared-debts/splitCalculator.js';

describe('Shared Expenses & Split Calculators', () => {
  it('calculates equal splits with exact penny conservation for odd amounts', () => {
    const participants = ['user-1', 'user-2', 'user-3'];
    const splits = calculateEqualSplit('100.00', participants, 2);

    expect(splits).toHaveLength(3);
    expect(splits[0].shareAmount).toBe('33.34');
    expect(splits[1].shareAmount).toBe('33.33');
    expect(splits[2].shareAmount).toBe('33.33');

    // Strict mathematical check: sum must be exactly 100.00
    const sum = splits.reduce((acc, s) => acc + parseFloat(s.shareAmount), 0);
    expect(sum).toBeCloseTo(100.0, 4);
  });

  it('calculates equal splits cleanly when divisible', () => {
    const participants = ['user-1', 'user-2', 'user-3', 'user-4'];
    const splits = calculateEqualSplit('100.00', participants, 2);

    expect(splits).toHaveLength(4);
    splits.forEach((s) => {
      expect(s.shareAmount).toBe('25.00');
    });
  });

  it('calculates percent splits and preserves total amount', () => {
    const splitsConfig = [
      { contactId: 'alice', percentage: 50 },
      { contactId: 'bob', percentage: 30 },
      { contactId: 'charlie', percentage: 20 },
    ];
    const splits = calculatePercentSplit('250.00', splitsConfig, 2);

    expect(splits[0].shareAmount).toBe('125.00');
    expect(splits[1].shareAmount).toBe('75.00');
    expect(splits[2].shareAmount).toBe('50.00');

    const sum = splits.reduce((acc, s) => acc + parseFloat(s.shareAmount), 0);
    expect(sum).toBe(250.0);
  });

  it('rejects percentage splits that do not sum to 100', () => {
    const invalidConfig = [
      { contactId: 'alice', percentage: 50 },
      { contactId: 'bob', percentage: 40 },
    ];
    expect(() => calculatePercentSplit('100.00', invalidConfig)).toThrow(/Percentages must sum to 100/);
  });

  it('calculates weighted shares splits with remainder correction', () => {
    const sharesConfig = [
      { contactId: 'alice', shares: 2 },
      { contactId: 'bob', shares: 1 },
    ];
    const splits = calculateSharesSplit('100.00', sharesConfig, 2);

    expect(splits[0].shareAmount).toBe('66.67');
    expect(splits[1].shareAmount).toBe('33.33');

    const sum = splits.reduce((acc, s) => acc + parseFloat(s.shareAmount), 0);
    expect(sum).toBe(100.0);
  });

  it('validates exact split matches or mismatches', () => {
    const validSplits = [
      { contactId: 'alice', amount: '60.00' },
      { contactId: 'bob', amount: '40.00' },
    ];
    expect(validateExactSplit('100.00', validSplits).isValid).toBe(true);

    const invalidSplits = [
      { contactId: 'alice', amount: '60.00' },
      { contactId: 'bob', amount: '35.00' },
    ];
    const check = validateExactSplit('100.00', invalidSplits);
    expect(check.isValid).toBe(false);
    expect(check.difference).toBe('5.00');
  });
});

describe('Debt Simplification Algorithm (Splitwise-grade)', () => {
  it('simplifies linear chain: A owes B $20 and B owes C $20 -> A owes C $20', () => {
    // Net balances:
    // A: -20 (debtor)
    // B: 0 (settled)
    // C: +20 (creditor)
    const netBalances = {
      userA: '-20.00',
      userB: '0.00',
      userC: '20.00',
    };

    const settlements = simplifyDebts(netBalances);
    expect(settlements).toHaveLength(1);
    expect(settlements[0]).toEqual({
      fromContactId: 'userA',
      toContactId: 'userC',
      amount: '20.00',
    });
  });

  it('eliminates circular debts completely', () => {
    // A owes B $50, B owes C $50, C owes A $50 -> net balance of each is 0
    const netBalances = {
      userA: '0.00',
      userB: '0.00',
      userC: '0.00',
    };

    const settlements = simplifyDebts(netBalances);
    expect(settlements).toHaveLength(0);
  });

  it('minimizes complex multi-party debts into minimal transactions', () => {
    // Alice is owed +100
    // Bob owes -60
    // Charlie owes -40
    const netBalances = {
      alice: '100.00',
      bob: '-60.00',
      charlie: '-40.00',
    };

    const settlements = simplifyDebts(netBalances);
    expect(settlements).toHaveLength(2);
    // Bob pays Alice 60, Charlie pays Alice 40
    expect(settlements.find((s) => s.fromContactId === 'bob' && s.toContactId === 'alice')?.amount).toBe('60.00');
    expect(settlements.find((s) => s.fromContactId === 'charlie' && s.toContactId === 'alice')?.amount).toBe('40.00');
  });
});

describe('Installment Schedule Generator (EMI/BNPL)', () => {
  it('generates 12 clean monthly installments', () => {
    const schedules = generateInstallmentSchedule('1200.00', 12, 'monthly', '2026-10-01', '0.00');
    expect(schedules).toHaveLength(12);
    expect(schedules[0].amount).toBe('100.00');
    expect(schedules[0].dueDate).toBe('2026-10-01');
    expect(schedules[11].amount).toBe('100.00');

    const sum = schedules.reduce((acc, s) => acc + parseFloat(s.amount), 0);
    expect(sum).toBe(1200.0);
  });

  it('adjusts last installment for interest and rounding remainder', () => {
    // $100 principal + $10 fee = $110 / 3 = 36.66 base * 3 = 109.98 -> last installment 36.68
    const schedules = generateInstallmentSchedule('100.00', 3, 'weekly', '2026-10-01', '10.00');
    expect(schedules).toHaveLength(3);
    expect(schedules[0].amount).toBe('36.66');
    expect(schedules[1].amount).toBe('36.66');
    expect(schedules[2].amount).toBe('36.68');

    const sum = schedules.reduce((acc, s) => acc + parseFloat(s.amount), 0);
    expect(sum).toBeCloseTo(110.0, 2);
  });
});
