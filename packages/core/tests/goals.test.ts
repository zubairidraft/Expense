import { describe, it, expect } from 'vitest';
import {
  calculateGoalProgress,
  GoalCreateSchema,
  Goal,
} from '../src/index.js';

describe('Phase 13: Financial Goals & Savings Targets', () => {
  it('calculates progress percentage and remaining target amount', () => {
    const goal: Goal = {
      id: 'g-1',
      workspaceId: '123e4567-e89b-12d3-a456-426614174000',
      name: 'Emergency Fund (6 Months)',
      targetAmount: '12000.00',
      currentAmount: '4800.00',
      currency: 'USD',
      type: 'emergency_fund',
      icon: '🛡️',
      color: '#10b981',
      status: 'in_progress',
    };

    const res = calculateGoalProgress(goal);

    expect(res.targetAmount).toBe('12000.00');
    expect(res.currentAmount).toBe('4800.00');
    expect(res.remainingAmount).toBe('7200.00');
    expect(res.percentage).toBe(40);
    expect(res.isCompleted).toBe(false);
  });

  it('marks goal as completed when current amount meets or exceeds target', () => {
    const goal: Goal = {
      id: 'g-2',
      workspaceId: '123e4567-e89b-12d3-a456-426614174000',
      name: 'New MacBook Pro M3',
      targetAmount: '2500.00',
      currentAmount: '2500.00',
      currency: 'USD',
      type: 'purchase',
      icon: '💻',
      color: '#6366f1',
      status: 'in_progress',
    };

    const res = calculateGoalProgress(goal);

    expect(res.remainingAmount).toBe('0.00');
    expect(res.percentage).toBe(100);
    expect(res.isCompleted).toBe(true);
  });

  it('calculates required monthly contribution if target date is set', () => {
    const nextYear = new Date();
    nextYear.setMonth(nextYear.getMonth() + 10);
    const targetDateStr = nextYear.toISOString().split('T')[0];

    const goal: Goal = {
      id: 'g-3',
      workspaceId: '123e4567-e89b-12d3-a456-426614174000',
      name: 'Hajj / Umrah Pilgrimage',
      targetAmount: '5000.00',
      currentAmount: '2000.00', // $3000 remaining over ~10 months -> ~$300/mo
      currency: 'USD',
      targetDate: targetDateStr,
      type: 'savings',
      icon: '🕋',
      color: '#14b8a6',
      status: 'in_progress',
    };

    const res = calculateGoalProgress(goal);

    expect(res.monthlyContributionNeeded).toBeDefined();
    expect(parseFloat(res.monthlyContributionNeeded!)).toBeGreaterThan(250);
    expect(parseFloat(res.monthlyContributionNeeded!)).toBeLessThan(350);
  });

  it('validates goal create payload with Zod', () => {
    const valid = {
      workspaceId: '123e4567-e89b-12d3-a456-426614174000',
      name: 'Down Payment on Apartment',
      targetAmount: '50000.00',
      currentAmount: '15000.00',
      currency: 'USD',
      targetDate: '2028-12-31',
      type: 'savings',
      icon: '🏠',
      color: '#f59e0b',
      status: 'in_progress',
    };

    const parsed = GoalCreateSchema.safeParse(valid);
    expect(parsed.success).toBe(true);
  });
});
