import { describe, it, expect } from 'vitest';
import {
  calculateBudgetUtilization,
  BudgetCreateSchema,
  Budget,
} from '../src/index.js';

describe('Phase 12: Budgets & Utilization Engine', () => {
  const sampleBudget: Budget = {
    id: 'b-1',
    workspaceId: '123e4567-e89b-12d3-a456-426614174000',
    categoryId: '223e4567-e89b-12d3-a456-426614174000',
    period: 'monthly',
    amount: '500.00',
    currency: 'USD',
    rolloverEnabled: false,
    rolloverAmount: '0.00',
    alertThreshold: 80,
    startDate: '2026-10-01',
  };

  it('calculates normal budget utilization below threshold', () => {
    const res = calculateBudgetUtilization(sampleBudget, '250.00');

    expect(res.spentAmount).toBe('250.00');
    expect(res.remainingAmount).toBe('250.00');
    expect(res.percentageUsed).toBe(50);
    expect(res.isWarning).toBe(false);
    expect(res.isExceeded).toBe(false);
  });

  it('triggers warning status when spent passes alert threshold (80%)', () => {
    const res = calculateBudgetUtilization(sampleBudget, '420.00');

    expect(res.spentAmount).toBe('420.00');
    expect(res.remainingAmount).toBe('80.00');
    expect(res.percentageUsed).toBe(84);
    expect(res.isWarning).toBe(true);
    expect(res.isExceeded).toBe(false);
  });

  it('triggers exceeded status when spent >= budget limit', () => {
    const res = calculateBudgetUtilization(sampleBudget, '550.00');

    expect(res.spentAmount).toBe('550.00');
    expect(res.remainingAmount).toBe('-50.00');
    expect(res.percentageUsed).toBe(110);
    expect(res.isWarning).toBe(false);
    expect(res.isExceeded).toBe(true);
  });

  it('incorporates rollover amount into effective limit', () => {
    const budgetWithRollover: Budget = {
      ...sampleBudget,
      rolloverEnabled: true,
      rolloverAmount: '100.00', // Effective limit becomes $600.00
    };

    const res = calculateBudgetUtilization(budgetWithRollover, '480.00');

    expect(res.effectiveLimit).toBe('600.00');
    expect(res.remainingAmount).toBe('120.00');
    expect(res.percentageUsed).toBe(80);
    expect(res.isWarning).toBe(true);
    expect(res.isExceeded).toBe(false);
  });

  it('validates budget create payload with Zod', () => {
    const valid = {
      workspaceId: '123e4567-e89b-12d3-a456-426614174000',
      categoryId: '223e4567-e89b-12d3-a456-426614174000',
      period: 'monthly',
      amount: '750.00',
      currency: 'USD',
      rolloverEnabled: true,
      rolloverAmount: '50.00',
      alertThreshold: 85,
      startDate: '2026-10-01',
    };

    const parsed = BudgetCreateSchema.safeParse(valid);
    expect(parsed.success).toBe(true);
  });
});
