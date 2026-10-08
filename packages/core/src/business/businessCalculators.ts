import Decimal from 'decimal.js';
import type { TaxCalculationResult, ProjectFinancialSummary, ProjectStatus } from '../types/index.js';

/**
 * Calculates tax/VAT with inclusive and exclusive modes using Decimal.js.
 */
export function calculateTax(
  amount: string | number,
  ratePercent: number,
  isInclusive: boolean = false,
  minorUnits: number = 2
): TaxCalculationResult {
  const amt = new Decimal(amount || 0);
  const rate = new Decimal(ratePercent || 0);

  if (amt.isNegative() || rate.isNegative()) {
    throw new Error('Amount and rate must be non-negative');
  }

  let subtotal: Decimal;
  let taxAmount: Decimal;
  let total: Decimal;

  if (isInclusive) {
    total = amt;
    const factor = new Decimal(1).plus(rate.dividedBy(100));
    subtotal = total.dividedBy(factor).toDecimalPlaces(minorUnits, Decimal.ROUND_HALF_UP);
    taxAmount = total.minus(subtotal);
  } else {
    subtotal = amt;
    taxAmount = subtotal.times(rate).dividedBy(100).toDecimalPlaces(minorUnits, Decimal.ROUND_HALF_UP);
    total = subtotal.plus(taxAmount);
  }

  return {
    subtotal: subtotal.toFixed(minorUnits),
    taxAmount: taxAmount.toFixed(minorUnits),
    total: total.toFixed(minorUnits),
    ratePercent,
    isInclusive,
  };
}

/**
 * Computes project financial performance: revenue, expenses, billable vs reimbursable, margin, and budget burn.
 */
export function calculateProjectFinancials(
  project: { id: string; name: string; code?: string | null; budget?: string | null; currency: string; status: ProjectStatus },
  lines: Array<{
    amount: string | number;
    direction: 'in' | 'out';
    billable?: boolean;
    reimbursable?: boolean;
    taxAmount?: string | number;
  }>,
  minorUnits: number = 2
): ProjectFinancialSummary {
  let totalRevenue = new Decimal(0);
  let totalExpense = new Decimal(0);
  let totalBillable = new Decimal(0);
  let totalReimbursable = new Decimal(0);
  let totalTax = new Decimal(0);

  for (const line of lines) {
    const lineAmt = new Decimal(line.amount || 0);
    const taxAmt = new Decimal(line.taxAmount || 0);
    totalTax = totalTax.plus(taxAmt);

    if (line.direction === 'in') {
      totalRevenue = totalRevenue.plus(lineAmt);
    } else {
      totalExpense = totalExpense.plus(lineAmt);
      if (line.billable) {
        totalBillable = totalBillable.plus(lineAmt);
      }
      if (line.reimbursable) {
        totalReimbursable = totalReimbursable.plus(lineAmt);
      }
    }
  }

  const netProfit = totalRevenue.minus(totalExpense);

  let budgetBurnPercent: number | undefined = undefined;
  if (project.budget && new Decimal(project.budget).greaterThan(0)) {
    const budgetDec = new Decimal(project.budget);
    budgetBurnPercent = Math.round(totalExpense.dividedBy(budgetDec).times(100).toNumber());
  }

  return {
    projectId: project.id,
    projectName: project.name,
    projectCode: project.code,
    budget: project.budget,
    currency: project.currency,
    status: project.status,
    totalRevenue: totalRevenue.toFixed(minorUnits),
    totalExpense: totalExpense.toFixed(minorUnits),
    totalBillableExpense: totalBillable.toFixed(minorUnits),
    totalReimbursableExpense: totalReimbursable.toFixed(minorUnits),
    totalTaxAmount: totalTax.toFixed(minorUnits),
    netProfit: netProfit.toFixed(minorUnits),
    budgetBurnPercent,
  };
}

export interface MemberSpendingBreakdown {
  memberId: string;
  memberName: string;
  totalSpent: string;
  totalIncome: string;
  netContribution: string;
}

/**
 * Summarizes spending and income per member in a shared/household space.
 */
export function calculateMemberSpendingBreakdown(
  members: Array<{ id: string; name: string }>,
  lines: Array<{
    memberId?: string | null;
    amount: string | number;
    direction: 'in' | 'out';
  }>,
  minorUnits: number = 2
): MemberSpendingBreakdown[] {
  const memberMap = new Map<string, { spent: Decimal; income: Decimal; name: string }>();

  for (const m of members) {
    memberMap.set(m.id, { spent: new Decimal(0), income: new Decimal(0), name: m.name });
  }

  for (const line of lines) {
    if (!line.memberId || !memberMap.has(line.memberId)) continue;
    const entry = memberMap.get(line.memberId)!;
    const amt = new Decimal(line.amount || 0);
    if (line.direction === 'in') {
      entry.income = entry.income.plus(amt);
    } else {
      entry.spent = entry.spent.plus(amt);
    }
  }

  return Array.from(memberMap.entries()).map(([memberId, data]) => ({
    memberId,
    memberName: data.name,
    totalSpent: data.spent.toFixed(minorUnits),
    totalIncome: data.income.toFixed(minorUnits),
    netContribution: data.income.minus(data.spent).toFixed(minorUnits),
  }));
}
