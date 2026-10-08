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
  interval = 1
): string {
  const date = new Date(currentDateStr + 'T00:00:00Z');

  switch (frequency) {
    case 'daily':
      date.setUTCDate(date.getUTCDate() + interval);
      break;
    case 'weekly':
      date.setUTCDate(date.getUTCDate() + 7 * interval);
      break;
    case 'biweekly':
      date.setUTCDate(date.getUTCDate() + 14 * interval);
      break;
    case 'monthly':
      date.setUTCMonth(date.getUTCMonth() + interval);
      break;
    case 'quarterly':
      date.setUTCMonth(date.getUTCMonth() + 3 * interval);
      break;
    case 'yearly':
      date.setUTCFullYear(date.getUTCFullYear() + interval);
      break;
  }

  return date.toISOString().split('T')[0];
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
