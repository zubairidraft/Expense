import {
  RecurringProfile,
  RecurringFrequency,
  CashFlowProjectedOccurrence,
  CashFlowProjectionSummary,
} from '../types/index.js';
import Decimal from 'decimal.js';

/**
 * Computes next due date given current due date and frequency interval.
 */
export function computeNextDueDate(
  currentDateStr: string,
  frequency: RecurringFrequency,
  interval = 1,
  anchorDay?: number
): string {
  const date = new Date(currentDateStr + 'T00:00:00Z');
  const step = Math.max(1, Math.floor(interval || 1));

  // Month-based schedules clamp to the last day of shorter months
  // ("monthly on the 31st" -> Feb 28/29 -> Mar 31), never overflow into the next month.
  const addMonths = (months: number) => {
    const day = anchorDay && anchorDay > 0 ? anchorDay : date.getUTCDate();
    const y = date.getUTCFullYear();
    const m = date.getUTCMonth() + months;
    const lastDay = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
    return new Date(Date.UTC(y, m, Math.min(day, lastDay)));
  };

  let next: Date;
  switch (frequency) {
    case 'daily':
      next = new Date(date.getTime());
      next.setUTCDate(next.getUTCDate() + step);
      break;
    case 'weekly':
      next = new Date(date.getTime());
      next.setUTCDate(next.getUTCDate() + 7 * step);
      break;
    case 'biweekly':
      next = new Date(date.getTime());
      next.setUTCDate(next.getUTCDate() + 14 * step);
      break;
    case 'monthly':
      next = addMonths(step);
      break;
    case 'quarterly':
      next = addMonths(3 * step);
      break;
    case 'yearly':
      next = addMonths(12 * step);
      break;
    default:
      next = addMonths(step);
  }

  return next.toISOString().split('T')[0];
}

/**
 * Generates an authoritative cash flow projection for 30, 60, or 90 days.
 * Banker's financial precision using Decimal.js.
 */
export function generateCashFlowProjection(
  profiles: RecurringProfile[],
  startingBalanceStr: string,
  daysAhead: 30 | 60 | 90 = 30
): CashFlowProjectionSummary {
  const startBal = new Decimal(startingBalanceStr || '0');
  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];

  const targetDate = new Date(now.getTime() + daysAhead * 24 * 60 * 60 * 1000);
  const horizonDateStr = targetDate.toISOString().split('T')[0];

  const occurrences: CashFlowProjectedOccurrence[] = [];

  for (const p of profiles) {
    if (!p.active) continue;

    let cursorDate = p.nextDueDate;
    const profileEndDate = p.endDate || null;

    // Advance cursor if in the past
    while (cursorDate < todayStr) {
      cursorDate = computeNextDueDate(cursorDate, p.frequency, p.interval);
    }

    // Accumulate occurrences within horizon
    while (cursorDate <= horizonDateStr) {
      if (profileEndDate && cursorDate > profileEndDate) break;

      occurrences.push({
        profileId: p.id,
        title: p.title,
        type: p.type,
        date: cursorDate,
        amount: new Decimal(p.amount).toFixed(2),
        currency: p.currency,
        accountId: p.accountId || null,
      });

      cursorDate = computeNextDueDate(cursorDate, p.frequency, p.interval);
    }
  }

  // Sort occurrences chronologically
  occurrences.sort((a, b) => a.date.localeCompare(b.date));

  let runningBal = new Decimal(startBal);
  let totalInflow = new Decimal(0);
  let totalOutflow = new Decimal(0);
  let lowestBal = new Decimal(startBal);

  for (const occ of occurrences) {
    const occAmt = new Decimal(occ.amount);
    if (occ.type === 'income') {
      runningBal = runningBal.plus(occAmt);
      totalInflow = totalInflow.plus(occAmt);
    } else if (occ.type === 'expense') {
      runningBal = runningBal.minus(occAmt);
      totalOutflow = totalOutflow.plus(occAmt);
    }

    if (runningBal.lessThan(lowestBal)) {
      lowestBal = runningBal;
    }
  }

  const hasLowBalanceWarning = lowestBal.lessThan(0);

  return {
    daysAhead,
    startingBalance: startBal.toFixed(2),
    projectedInflow: totalInflow.toFixed(2),
    projectedOutflow: totalOutflow.toFixed(2),
    projectedEndingBalance: runningBal.toFixed(2),
    occurrences,
    hasLowBalanceWarning,
    lowestProjectedBalance: lowestBal.toFixed(2),
  };
}
