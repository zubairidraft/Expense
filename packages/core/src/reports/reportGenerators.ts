import { Decimal } from 'decimal.js';

export interface ReportTransaction {
  id: string;
  type: string;
  date: string;
  payeeName?: string;
  category?: string;
  amount: number | string;
  currency?: string;
  isBillable?: boolean;
  isReimbursable?: boolean;
  taxAmount?: number | string;
}

export interface FinancialStatementResult {
  startDate: string;
  endDate: string;
  totalIncome: string;
  totalExpense: string;
  netIncome: string;
  savingsRatePercent: string;
  categoryBreakdown: Array<{
    category: string;
    totalAmount: string;
    percentageOfExpense: string;
  }>;
  largestExpenses: Array<{
    id: string;
    payeeName: string;
    amount: string;
    date: string;
    category: string;
  }>;
}

export function generateFinancialStatement(
  transactions: ReportTransaction[],
  startDate: string,
  endDate: string
): FinancialStatementResult {
  const filtered = transactions.filter((t) => t.date >= startDate && t.date <= endDate);

  let totalIncome = new Decimal(0);
  let totalExpense = new Decimal(0);
  const categoryTotals: Record<string, Decimal> = {};
  const expensesList: Array<{ id: string; payeeName: string; amount: Decimal; date: string; category: string }> = [];

  for (const t of filtered) {
    const amt = new Decimal(t.amount || 0);
    if (t.type === 'income') {
      totalIncome = totalIncome.plus(amt);
    } else if (t.type === 'expense') {
      totalExpense = totalExpense.plus(amt);
      const cat = t.category || 'General';
      categoryTotals[cat] = (categoryTotals[cat] || new Decimal(0)).plus(amt);
      expensesList.push({
        id: t.id,
        payeeName: t.payeeName || 'Unknown',
        amount: amt,
        date: t.date,
        category: cat,
      });
    }
  }

  const netIncome = totalIncome.minus(totalExpense);
  const savingsRate = totalIncome.gt(0)
    ? netIncome.div(totalIncome).times(100).toFixed(2)
    : '0.00';

  const categoryBreakdown = Object.entries(categoryTotals)
    .map(([cat, amt]) => ({
      category: cat,
      totalAmount: amt.toFixed(2),
      percentageOfExpense: totalExpense.gt(0)
        ? amt.div(totalExpense).times(100).toFixed(1)
        : '0.0',
    }))
    .sort((a, b) => Number(b.totalAmount) - Number(a.totalAmount));

  const largestExpenses = expensesList
    .sort((a, b) => b.amount.comparedTo(a.amount))
    .slice(0, 5)
    .map((e) => ({
      id: e.id,
      payeeName: e.payeeName,
      amount: e.amount.toFixed(2),
      date: e.date,
      category: e.category,
    }));

  return {
    startDate,
    endDate,
    totalIncome: totalIncome.toFixed(2),
    totalExpense: totalExpense.toFixed(2),
    netIncome: netIncome.toFixed(2),
    savingsRatePercent: savingsRate,
    categoryBreakdown,
    largestExpenses,
  };
}

export interface TaxSummaryResult {
  totalTaxableSales: string;
  outputVatCollected: string;
  totalTaxablePurchases: string;
  inputVatPaid: string;
  netVatPayable: string; // Positive = payable to authority; negative = reclaimable/refund
  status: 'payable' | 'refund' | 'zero';
  billableClientExpenses: string;
  reimbursableExpenses: string;
}

export function generateTaxSummary(
  transactions: ReportTransaction[],
  defaultVatRate = 0.15
): TaxSummaryResult {
  let totalTaxableSales = new Decimal(0);
  let outputVat = new Decimal(0);
  let totalTaxablePurchases = new Decimal(0);
  let inputVat = new Decimal(0);
  let billableTotal = new Decimal(0);
  let reimbursableTotal = new Decimal(0);

  for (const t of transactions) {
    const amt = new Decimal(t.amount || 0);

    if (t.type === 'income') {
      totalTaxableSales = totalTaxableSales.plus(amt);
      if (t.taxAmount) {
        outputVat = outputVat.plus(new Decimal(t.taxAmount));
      }
    } else if (t.type === 'expense') {
      totalTaxablePurchases = totalTaxablePurchases.plus(amt);
      if (t.taxAmount) {
        inputVat = inputVat.plus(new Decimal(t.taxAmount));
      } else if (defaultVatRate > 0) {
        // Approximate standard input vat if not itemized
        // e.g. amount includes VAT
      }

      if (t.isBillable) {
        billableTotal = billableTotal.plus(amt);
      }
      if (t.isReimbursable) {
        reimbursableTotal = reimbursableTotal.plus(amt);
      }
    }
  }

  const netVat = outputVat.minus(inputVat);
  let status: 'payable' | 'refund' | 'zero' = 'zero';
  if (netVat.gt(0)) {
    status = 'payable';
  } else if (netVat.lt(0)) {
    status = 'refund';
  }

  return {
    totalTaxableSales: totalTaxableSales.toFixed(2),
    outputVatCollected: outputVat.toFixed(2),
    totalTaxablePurchases: totalTaxablePurchases.toFixed(2),
    inputVatPaid: inputVat.toFixed(2),
    netVatPayable: netVat.abs().toFixed(2),
    status,
    billableClientExpenses: billableTotal.toFixed(2),
    reimbursableExpenses: reimbursableTotal.toFixed(2),
  };
}
