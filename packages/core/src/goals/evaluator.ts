import { Goal, GoalProgressSummary } from '../types/index.js';
import Decimal from 'decimal.js';

/**
 * Calculates goal progress metrics and required monthly trajectory.
 * Banker's financial precision via Decimal.js.
 */
export function calculateGoalProgress(goal: Goal): GoalProgressSummary {
  const target = new Decimal(goal.targetAmount || '0');
  const current = new Decimal(goal.currentAmount || '0');
  const remaining = target.minus(current);

  const nonNegativeRemaining = remaining.lessThan(0)
    ? new Decimal(0)
    : remaining;

  let percentage = 0;
  if (!target.isZero()) {
    percentage = Math.min(
      100,
      Math.round(current.dividedBy(target).times(100).toNumber())
    );
  }

  const isCompleted = current.greaterThanOrEqualTo(target);

  let monthlyContributionNeeded: string | null = null;

  if (!isCompleted && goal.targetDate && nonNegativeRemaining.greaterThan(0)) {
    const today = new Date();
    const targetDateObj = new Date(goal.targetDate + 'T00:00:00Z');

    const diffMs = targetDateObj.getTime() - today.getTime();
    const diffDays = Math.max(1, Math.round(diffMs / (1000 * 60 * 60 * 24)));
    const monthsRemaining = Math.max(1, Math.round(diffDays / 30.44));

    try {
      const monthly = nonNegativeRemaining.dividedBy(monthsRemaining);
      monthlyContributionNeeded = monthly.toFixed(2);
    } catch {
      monthlyContributionNeeded = null;
    }
  }

  return {
    goalId: goal.id,
    targetAmount: target.toFixed(2),
    currentAmount: current.toFixed(2),
    remainingAmount: nonNegativeRemaining.toFixed(2),
    percentage,
    isCompleted,
    monthlyContributionNeeded,
  };
}
