import { Budget, BudgetUtilization } from '../types/index.js';
import Decimal from 'decimal.js';

/**
 * Calculates real-time budget utilization with rollover support and threshold alerts.
 * Financial banker's precision via Decimal.js.
 */
export function calculateBudgetUtilization(
  budget: Budget,
  actualSpentStr: string
): BudgetUtilization {
  const baseBudget = new Decimal(budget.amount || '0');
  const rollover = budget.rolloverEnabled
    ? new Decimal(budget.rolloverAmount || '0')
    : new Decimal(0);

  const effectiveLimit = baseBudget.plus(rollover);
  const spent = new Decimal(actualSpentStr || '0');
  const remaining = effectiveLimit.minus(spent);

  let percentageUsed = 0;
  if (!effectiveLimit.isZero()) {
    percentageUsed = Math.round(
      spent.dividedBy(effectiveLimit).times(100).toNumber()
    );
  }

  const isWarning = percentageUsed >= budget.alertThreshold && percentageUsed < 100;
  const isExceeded = percentageUsed >= 100;

  return {
    budgetId: budget.id,
    categoryId: budget.categoryId,
    budgetedAmount: baseBudget.toFixed(2),
    effectiveLimit: effectiveLimit.toFixed(2),
    spentAmount: spent.toFixed(2),
    remainingAmount: remaining.toFixed(2),
    percentageUsed,
    isWarning,
    isExceeded,
    currency: budget.currency,
  };
}
