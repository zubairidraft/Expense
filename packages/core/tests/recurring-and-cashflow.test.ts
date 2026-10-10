import { describe, it, expect } from 'vitest';
import {
  computeNextDueDate,
  generateCashFlowProjection,
  RecurringProfileCreateSchema,
  RecurringProfile,
} from '../src/index.js';

describe('Phase 11: Recurring Profiles & Cash Flow Projection', () => {
  it('correctly calculates next due dates for various recurrence frequencies', () => {
    expect(computeNextDueDate('2026-10-01', 'daily', 1)).toBe('2026-10-02');
    expect(computeNextDueDate('2026-10-01', 'weekly', 1)).toBe('2026-10-08');
    expect(computeNextDueDate('2026-10-01', 'biweekly', 1)).toBe('2026-10-15');
    expect(computeNextDueDate('2026-10-01', 'monthly', 1)).toBe('2026-11-01');
    expect(computeNextDueDate('2026-10-01', 'quarterly', 1)).toBe('2027-01-01');
    expect(computeNextDueDate('2026-10-01', 'yearly', 1)).toBe('2027-10-01');
  });

  it('clamps month-end schedules instead of overflowing into the next month', () => {
    expect(computeNextDueDate('2027-01-31', 'monthly', 1)).toBe('2027-02-28');
    expect(computeNextDueDate('2028-01-31', 'monthly', 1)).toBe('2028-02-29');
    // anchor day keeps the 31st after a short month
    expect(computeNextDueDate('2027-02-28', 'monthly', 1, 31)).toBe('2027-03-31');
    expect(computeNextDueDate('2026-08-31', 'quarterly', 1)).toBe('2026-11-30');
    expect(computeNextDueDate('2028-02-29', 'yearly', 1)).toBe('2029-02-28');
  });

  it('generates a 30-day cash flow projection with inflows and outflows', () => {
    const today = new Date().toISOString().split('T')[0];
    const profiles: RecurringProfile[] = [
      {
        id: 'rec-1',
        workspaceId: '123e4567-e89b-12d3-a456-426614174000',
        title: 'Monthly Salary',
        type: 'income',
        frequency: 'monthly',
        interval: 1,
        startDate: today,
        nextDueDate: today,
        amount: '5000.00',
        currency: 'USD',
        autoPost: true,
        active: true,
        reminderDaysBefore: 3,
      },
      {
        id: 'rec-2',
        workspaceId: '123e4567-e89b-12d3-a456-426614174000',
        title: 'Apartment Rent',
        type: 'expense',
        frequency: 'monthly',
        interval: 1,
        startDate: today,
        nextDueDate: today,
        amount: '1800.00',
        currency: 'USD',
        autoPost: false,
        active: true,
        reminderDaysBefore: 5,
      },
    ];

    const projection = generateCashFlowProjection(profiles, '1000.00', 30);

    expect(projection.startingBalance).toBe('1000.00');
    expect(projection.projectedInflow).toBe('5000.00');
    expect(projection.projectedOutflow).toBe('1800.00');
    expect(projection.projectedEndingBalance).toBe('4200.00');
    expect(projection.hasLowBalanceWarning).toBe(false);
  });

  it('triggers low-balance warning when projected outflows exceed starting balance', () => {
    const today = new Date().toISOString().split('T')[0];
    const profiles: RecurringProfile[] = [
      {
        id: 'rec-3',
        workspaceId: '123e4567-e89b-12d3-a456-426614174000',
        title: 'Heavy Loan Installment',
        type: 'expense',
        frequency: 'monthly',
        interval: 1,
        startDate: today,
        nextDueDate: today,
        amount: '3500.00',
        currency: 'USD',
        autoPost: false,
        active: true,
        reminderDaysBefore: 3,
      },
    ];

    // Starting with only $500, bill is $3500 -> dips into -$3000
    const projection = generateCashFlowProjection(profiles, '500.00', 30);

    expect(projection.hasLowBalanceWarning).toBe(true);
    expect(parseFloat(projection.lowestProjectedBalance)).toBeLessThan(0);
  });

  it('validates recurring profile schema with Zod', () => {
    const validData = {
      workspaceId: '123e4567-e89b-12d3-a456-426614174000',
      title: 'Netflix Subscription',
      type: 'expense',
      frequency: 'monthly',
      startDate: '2026-10-01',
      nextDueDate: '2026-11-01',
      amount: '19.99',
      currency: 'USD',
      autoPost: false,
      active: true,
      reminderDaysBefore: 2,
    };

    const res = RecurringProfileCreateSchema.safeParse(validData);
    expect(res.success).toBe(true);
  });
});
