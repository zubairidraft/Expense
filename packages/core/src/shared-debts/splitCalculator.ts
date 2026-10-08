import Decimal from 'decimal.js';
import type { SimplifiedDebtSettlement, InstallmentFrequency } from '../types/index.js';

export interface ParticipantSplitResult {
  contactId: string;
  shareAmount: string;
  sharePercentage?: number;
  sharesCount?: number;
}

/**
 * Calculates equal splits among participants, distributing fractional pennies
 * so that the sum of splits matches the total amount exactly.
 */
export function calculateEqualSplit(
  totalAmount: string | number,
  participantIds: string[],
  minorUnits: number = 2
): ParticipantSplitResult[] {
  if (!participantIds.length) {
    throw new Error('At least one participant is required for split');
  }

  const total = new Decimal(totalAmount);
  if (total.isNegative()) {
    throw new Error('Total amount cannot be negative');
  }

  const count = participantIds.length;
  const baseShare = total.dividedBy(count).toDecimalPlaces(minorUnits, Decimal.ROUND_DOWN);
  const totalBase = baseShare.times(count);
  const remainder = total.minus(totalBase);
  const unitStep = new Decimal(10).pow(-minorUnits);
  const unitsToDistribute = Math.round(remainder.dividedBy(unitStep).toNumber());

  return participantIds.map((id, index) => {
    let share = baseShare;
    if (index < unitsToDistribute) {
      share = share.plus(unitStep);
    }
    return {
      contactId: id,
      shareAmount: share.toFixed(minorUnits),
    };
  });
}

/**
 * Calculates percentage-based splits among participants with penny adjustment to ensure zero loss.
 */
export function calculatePercentSplit(
  totalAmount: string | number,
  splits: Array<{ contactId: string; percentage: number }>,
  minorUnits: number = 2
): ParticipantSplitResult[] {
  if (!splits.length) {
    throw new Error('At least one participant split is required');
  }

  const totalPct = splits.reduce((sum, s) => sum + s.percentage, 0);
  if (Math.abs(totalPct - 100) > 0.01) {
    throw new Error(`Percentages must sum to 100 (got ${totalPct})`);
  }

  const total = new Decimal(totalAmount);
  let allocatedSum = new Decimal(0);
  const results: ParticipantSplitResult[] = [];

  splits.forEach((s, idx) => {
    if (idx === splits.length - 1) {
      // Last participant absorbs any rounding difference to ensure sum === total
      const lastAmount = total.minus(allocatedSum);
      results.push({
        contactId: s.contactId,
        shareAmount: lastAmount.toFixed(minorUnits),
        sharePercentage: s.percentage,
      });
    } else {
      const amount = total.times(s.percentage).dividedBy(100).toDecimalPlaces(minorUnits, Decimal.ROUND_HALF_UP);
      allocatedSum = allocatedSum.plus(amount);
      results.push({
        contactId: s.contactId,
        shareAmount: amount.toFixed(minorUnits),
        sharePercentage: s.percentage,
      });
    }
  });

  return results;
}

/**
 * Calculates shares/parts based splits (e.g., 2 shares for Bob, 1 share for Alice).
 */
export function calculateSharesSplit(
  totalAmount: string | number,
  splits: Array<{ contactId: string; shares: number }>,
  minorUnits: number = 2
): ParticipantSplitResult[] {
  if (!splits.length) {
    throw new Error('At least one participant split is required');
  }

  const totalShares = splits.reduce((sum, s) => sum + s.shares, 0);
  if (totalShares <= 0) {
    throw new Error('Total shares must be greater than zero');
  }

  const total = new Decimal(totalAmount);
  let allocatedSum = new Decimal(0);
  const results: ParticipantSplitResult[] = [];

  splits.forEach((s, idx) => {
    if (idx === splits.length - 1) {
      const lastAmount = total.minus(allocatedSum);
      results.push({
        contactId: s.contactId,
        shareAmount: lastAmount.toFixed(minorUnits),
        sharesCount: s.shares,
      });
    } else {
      const amount = total.times(s.shares).dividedBy(totalShares).toDecimalPlaces(minorUnits, Decimal.ROUND_HALF_UP);
      allocatedSum = allocatedSum.plus(amount);
      results.push({
        contactId: s.contactId,
        shareAmount: amount.toFixed(minorUnits),
        sharesCount: s.shares,
      });
    }
  });

  return results;
}

/**
 * Validates exact split amounts against total.
 */
export function validateExactSplit(
  totalAmount: string | number,
  splits: Array<{ contactId: string; amount: string | number }>,
  minorUnits: number = 2
): { isValid: boolean; difference: string } {
  const total = new Decimal(totalAmount);
  const sum = splits.reduce((acc, s) => acc.plus(new Decimal(s.amount || 0)), new Decimal(0));
  const diff = total.minus(sum);

  return {
    isValid: diff.abs().lessThanOrEqualTo(new Decimal(10).pow(-minorUnits).dividedBy(2)),
    difference: diff.toFixed(minorUnits),
  };
}

/**
 * Simplifies a network of peer debts into the minimum number of settle-up transactions.
 * Positive balance = creditor (owed money).
 * Negative balance = debtor (owes money).
 */
export function simplifyDebts(
  netBalances: Record<string, string | number>,
  minorUnits: number = 2
): SimplifiedDebtSettlement[] {
  const threshold = new Decimal(10).pow(-minorUnits);

  // Group into creditors and debtors
  const creditors: Array<{ contactId: string; amount: Decimal }> = [];
  const debtors: Array<{ contactId: string; amount: Decimal }> = [];

  for (const [contactId, val] of Object.entries(netBalances)) {
    const bal = new Decimal(val || 0);
    if (bal.greaterThan(threshold)) {
      creditors.push({ contactId, amount: bal });
    } else if (bal.lessThan(threshold.negated())) {
      debtors.push({ contactId, amount: bal.negated() }); // store positive owed
    }
  }

  // Sort descending by amount
  creditors.sort((a, b) => b.amount.minus(a.amount).toNumber());
  debtors.sort((a, b) => b.amount.minus(a.amount).toNumber());

  const settlements: SimplifiedDebtSettlement[] = [];
  let cIdx = 0;
  let dIdx = 0;

  while (cIdx < creditors.length && dIdx < debtors.length) {
    const creditor = creditors[cIdx];
    const debtor = debtors[dIdx];

    const settled = Decimal.min(creditor.amount, debtor.amount);
    settlements.push({
      fromContactId: debtor.contactId,
      toContactId: creditor.contactId,
      amount: settled.toFixed(minorUnits),
    });

    creditor.amount = creditor.amount.minus(settled);
    debtor.amount = debtor.amount.minus(settled);

    if (creditor.amount.lessThan(threshold)) {
      cIdx++;
    }
    if (debtor.amount.lessThan(threshold)) {
      dIdx++;
    }
  }

  return settlements;
}

/**
 * Generates an installment repayment schedule (EMI/BNPL).
 */
export function generateInstallmentSchedule(
  principal: string | number,
  totalInstallments: number,
  frequency: InstallmentFrequency,
  startDate: string,
  interestOrFee: string | number = 0,
  minorUnits: number = 2
): Array<{ installmentNumber: number; dueDate: string; amount: string }> {
  if (totalInstallments <= 0) {
    throw new Error('Total installments must be greater than zero');
  }

  const total = new Decimal(principal).plus(new Decimal(interestOrFee || 0));
  const baseInstallment = total.dividedBy(totalInstallments).toDecimalPlaces(minorUnits, Decimal.ROUND_DOWN);
  const totalBase = baseInstallment.times(totalInstallments);
  const remainder = total.minus(totalBase);

  const schedules: Array<{ installmentNumber: number; dueDate: string; amount: string }> = [];
  const baseDate = new Date(startDate);

  for (let i = 1; i <= totalInstallments; i++) {
    const dueDate = new Date(baseDate);
    if (frequency === 'weekly') {
      dueDate.setDate(baseDate.getDate() + (i - 1) * 7);
    } else if (frequency === 'biweekly') {
      dueDate.setDate(baseDate.getDate() + (i - 1) * 14);
    } else if (frequency === 'monthly') {
      dueDate.setMonth(baseDate.getMonth() + (i - 1));
    } else if (frequency === 'quarterly') {
      dueDate.setMonth(baseDate.getMonth() + (i - 1) * 3);
    }

    const isoDate = dueDate.toISOString().split('T')[0];
    let installmentAmt = baseInstallment;
    // Add remainder to last installment so total is strictly preserved
    if (i === totalInstallments) {
      installmentAmt = installmentAmt.plus(remainder);
    }

    schedules.push({
      installmentNumber: i,
      dueDate: isoDate,
      amount: installmentAmt.toFixed(minorUnits),
    });
  }

  return schedules;
}
