import { describe, it, expect } from 'vitest';
import {
  calculateCategoryStats,
  detectSpendingAnomalies,
} from '../src/analytics/anomalyDetector.js';
import {
  calculateSpendingVelocity,
  projectCashFlowForecast,
} from '../src/analytics/velocityAndForecast.js';
import {
  generateFinancialStatement,
  generateTaxSummary,
} from '../src/reports/reportGenerators.js';

describe('Spending Anomaly Detection', () => {
  const transactions = [
    { id: '1', payeeName: 'Coffee Shop', category: 'Dining', amount: 15, date: '2026-10-01' },
    { id: '2', payeeName: 'Lunch Deli', category: 'Dining', amount: 25, date: '2026-10-02' },
    { id: '3', payeeName: 'Dinner Bistro', category: 'Dining', amount: 20, date: '2026-10-03' },
    { id: '4', payeeName: 'Luxury Steakhouse', category: 'Dining', amount: 180, date: '2026-10-04' },
    { id: '5', payeeName: 'Subway', category: 'Dining', amount: 18, date: '2026-10-05' },
  ];

  it('calculates historical mean and standard deviation accurately', () => {
    const historical = transactions.slice(0, 3); // 15, 25, 20 -> mean = 20
    const stats = calculateCategoryStats(historical);
    expect(stats['Dining']).toBeDefined();
    expect(stats['Dining'].mean).toBe('20.0000');
    expect(Number(stats['Dining'].standardDeviation)).toBeGreaterThan(0);
  });

  it('flags spending anomalies exceeding multiplier threshold', () => {
    const historical = [
      { id: '1', payeeName: 'Coffee', category: 'Dining', amount: 20, date: '2026-10-01' },
      { id: '2', payeeName: 'Lunch', category: 'Dining', amount: 20, date: '2026-10-02' },
    ];
    const stats = calculateCategoryStats(historical);

    const testTxs = [
      { id: 'normal', payeeName: 'Sandwich', category: 'Dining', amount: 25, date: '2026-10-05' },
      { id: 'spiky', payeeName: 'Fancy Gala', category: 'Dining', amount: 200, date: '2026-10-06' },
    ];

    const anomalies = detectSpendingAnomalies(testTxs, stats, {
      minDeviationMultiplier: 3.0,
      minAmountThreshold: 50,
    });

    expect(anomalies).toHaveLength(1);
    expect(anomalies[0].transactionId).toBe('spiky');
    expect(anomalies[0].deviationMultiplier).toBe('10.0');
    expect(anomalies[0].severity).toBe('high');
  });
});

describe('Spending Velocity & Burn Rate', () => {
  it('calculates daily burn rate and month-end projection on track', () => {
    const result = calculateSpendingVelocity({
      daysElapsed: 10,
      daysInMonth: 30,
      currentSpent: 500,
      budgetLimit: 2000,
    });

    // 500 / 10 = 50 daily; 50 * 30 = 1500 projected
    expect(result.dailyBurnRate).toBe('50.00');
    expect(result.projectedMonthEnd).toBe('1500.00');
    expect(result.remainingDays).toBe(20);
    expect(result.isOnTrack).toBe(true);
    expect(result.projectedOverspend).toBe('0.00');
    // Safe daily remaining = (2000 - 500) / 20 = 75
    expect(result.safeDailyRemainingBudget).toBe('75.00');
  });

  it('detects overspending risk when burn rate exceeds budget limit', () => {
    const result = calculateSpendingVelocity({
      daysElapsed: 10,
      daysInMonth: 30,
      currentSpent: 1200,
      budgetLimit: 2000,
    });

    // 1200 / 10 = 120 daily; 120 * 30 = 3600 projected
    expect(result.dailyBurnRate).toBe('120.00');
    expect(result.projectedMonthEnd).toBe('3600.00');
    expect(result.isOnTrack).toBe(false);
    expect(result.projectedOverspend).toBe('1600.00');
  });
});

describe('Cash Flow Forecasting', () => {
  it('simulates daily projection curve with recurring bills and income', () => {
    const recurring = [
      { id: 'sal', title: 'Salary', amount: 3000, type: 'income' as const, dayOfMonth: 1 },
      { id: 'rent', title: 'Rent', amount: 1200, type: 'expense' as const, dayOfMonth: 5 },
      { id: 'sub', title: 'Netflix', amount: 20, type: 'expense' as const, dayOfMonth: 15 },
    ];

    const forecast = projectCashFlowForecast(1000, recurring, 30, '2026-10-01');

    expect(forecast.startingBalance).toBe('1000.00');
    expect(forecast.projectedCurve.length).toBeGreaterThan(0);
    expect(forecast.riskLevel).toBe('healthy');
    expect(Number(forecast.endingBalance)).toBeGreaterThan(1000);
  });

  it('flags critical risk when recurring bills drop balance below zero', () => {
    const recurring = [
      { id: 'big-bill', title: 'Annual Tax Bill', amount: 5000, type: 'expense' as const, dayOfMonth: 2 },
    ];

    const forecast = projectCashFlowForecast(500, recurring, 10, '2026-10-01');
    expect(forecast.riskLevel).toBe('critical');
    expect(Number(forecast.minimumBalance)).toBeLessThan(0);
  });
});

describe('Financial Statements & Tax Reporting', () => {
  const sampleTransactions = [
    { id: 't1', type: 'income', date: '2026-10-02', amount: 4000, payeeName: 'Client Retainer', taxAmount: 600 },
    { id: 't2', type: 'expense', date: '2026-10-03', amount: 1200, payeeName: 'Office Rent', category: 'Office', isBillable: false, taxAmount: 180 },
    { id: 't3', type: 'expense', date: '2026-10-05', amount: 300, payeeName: 'Client Travel', category: 'Travel', isBillable: true, isReimbursable: true, taxAmount: 45 },
    { id: 't4', type: 'expense', date: '2026-10-10', amount: 500, payeeName: 'Software Licenses', category: 'Software', taxAmount: 75 },
  ];

  it('generates accurate P&L financial statement', () => {
    const statement = generateFinancialStatement(sampleTransactions, '2026-10-01', '2026-10-31');

    expect(statement.totalIncome).toBe('4000.00');
    // Expenses: 1200 + 300 + 500 = 2000
    expect(statement.totalExpense).toBe('2000.00');
    expect(statement.netIncome).toBe('2000.00');
    expect(statement.savingsRatePercent).toBe('50.00');
    expect(statement.categoryBreakdown).toHaveLength(3);
    expect(statement.largestExpenses[0].payeeName).toBe('Office Rent');
  });

  it('generates VAT/Tax summary with net payable balance', () => {
    const taxSummary = generateTaxSummary(sampleTransactions);

    expect(taxSummary.totalTaxableSales).toBe('4000.00');
    expect(taxSummary.outputVatCollected).toBe('600.00');
    // Input VAT: 180 + 45 + 75 = 300
    expect(taxSummary.inputVatPaid).toBe('300.00');
    // Net VAT = 600 - 300 = 300 payable
    expect(taxSummary.netVatPayable).toBe('300.00');
    expect(taxSummary.status).toBe('payable');
    expect(taxSummary.billableClientExpenses).toBe('300.00');
    expect(taxSummary.reimbursableExpenses).toBe('300.00');
  });
});
