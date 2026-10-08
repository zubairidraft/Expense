import { describe, it, expect } from 'vitest';
import {
  calculateTax,
  calculateProjectFinancials,
  calculateMemberSpendingBreakdown,
} from '../src/business/businessCalculators.js';

describe('Business & Household Domain Logic', () => {
  describe('Tax & VAT Calculations', () => {
    it('calculates exclusive tax correctly', () => {
      // $100 net with 15% VAT = $15 tax, $115 total
      const result = calculateTax('100.00', 15, false, 2);
      expect(result.subtotal).toBe('100.00');
      expect(result.taxAmount).toBe('15.00');
      expect(result.total).toBe('115.00');
    });

    it('calculates inclusive tax correctly without rounding loss', () => {
      // $115 gross with 15% VAT inclusive = $100 subtotal, $15 tax
      const result = calculateTax('115.00', 15, true, 2);
      expect(result.subtotal).toBe('100.00');
      expect(result.taxAmount).toBe('15.00');
      expect(result.total).toBe('115.00');
    });

    it('handles 0% tax gracefully', () => {
      const result = calculateTax('50.00', 0, false, 2);
      expect(result.subtotal).toBe('50.00');
      expect(result.taxAmount).toBe('0.00');
      expect(result.total).toBe('50.00');
    });
  });

  describe('Project Financials & Budget Tracking', () => {
    it('calculates project revenues, billable expenses, margin, and burn percentage', () => {
      const project = {
        id: 'proj-1',
        name: 'Mobile App Redesign',
        code: 'MAR-2026',
        budget: '5000.00',
        currency: 'USD',
        status: 'active' as const,
      };

      const lines = [
        { amount: '4500.00', direction: 'in' as const }, // Revenue
        { amount: '1200.00', direction: 'out' as const, billable: true, taxAmount: '120.00' },
        { amount: '800.00', direction: 'out' as const, reimbursable: true },
        { amount: '500.00', direction: 'out' as const }, // Overhead
      ];

      const summary = calculateProjectFinancials(project, lines, 2);
      expect(summary.totalRevenue).toBe('4500.00');
      expect(summary.totalExpense).toBe('2500.00');
      expect(summary.totalBillableExpense).toBe('1200.00');
      expect(summary.totalReimbursableExpense).toBe('800.00');
      expect(summary.totalTaxAmount).toBe('120.00');
      expect(summary.netProfit).toBe('2000.00');
      // 2500 / 5000 = 50%
      expect(summary.budgetBurnPercent).toBe(50);
    });
  });

  describe('Household Member Spending Breakdown', () => {
    it('summarizes individual contributions and expenses per member', () => {
      const members = [
        { id: 'm1', name: 'Zubair' },
        { id: 'm2', name: 'Sara' },
      ];

      const lines = [
        { memberId: 'm1', amount: '200.00', direction: 'out' as const },
        { memberId: 'm1', amount: '50.00', direction: 'out' as const },
        { memberId: 'm2', amount: '120.00', direction: 'out' as const },
        { memberId: 'm2', amount: '500.00', direction: 'in' as const },
      ];

      const breakdown = calculateMemberSpendingBreakdown(members, lines, 2);
      expect(breakdown).toHaveLength(2);

      const m1 = breakdown.find((b) => b.memberId === 'm1')!;
      expect(m1.totalSpent).toBe('250.00');
      expect(m1.totalIncome).toBe('0.00');
      expect(m1.netContribution).toBe('-250.00');

      const m2 = breakdown.find((b) => b.memberId === 'm2')!;
      expect(m2.totalSpent).toBe('120.00');
      expect(m2.totalIncome).toBe('500.00');
      expect(m2.netContribution).toBe('380.00');
    });
  });
});
