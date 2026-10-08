import { useState, useMemo } from 'react';
import { useTransactions } from '../../context/TransactionContext';
import { useWorkspace } from '../../context/WorkspaceContext';
import { generateFinancialStatement, generateTaxSummary } from '@universal-expense/core';
import MoneyDisplay from '../ui/MoneyDisplay';

export default function ReportsView() {
  const { transactions } = useTransactions();
  const { currentWorkspace } = useWorkspace();
  const currency = currentWorkspace?.base_currency || 'USD';

  // Date range presets
  const [preset, setPreset] = useState('this_month');
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = String(now.getMonth() + 1).padStart(2, '0');

  const defaultDates = useMemo(() => {
    const startOfMonth = `${currentYear}-${currentMonth}-01`;
    const lastDayOfMonth = new Date(currentYear, now.getMonth() + 1, 0).getDate();
    const endOfMonth = `${currentYear}-${currentMonth}-${String(lastDayOfMonth).padStart(2, '0')}`;
    return { start: startOfMonth, end: endOfMonth };
  }, [currentYear, currentMonth]);

  const [startDate, setStartDate] = useState(defaultDates.start);
  const [endDate, setEndDate] = useState(defaultDates.end);
  const [reportType, setReportType] = useState('financial'); // 'financial' | 'tax'

  const handlePresetChange = (newPreset) => {
    setPreset(newPreset);
    const today = new Date();
    if (newPreset === 'this_month') {
      setStartDate(defaultDates.start);
      setEndDate(defaultDates.end);
    } else if (newPreset === 'last_month') {
      const prevMonthDate = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      const prevYear = prevMonthDate.getFullYear();
      const prevMonth = String(prevMonthDate.getMonth() + 1).padStart(2, '0');
      const lastDay = new Date(prevYear, prevMonthDate.getMonth() + 1, 0).getDate();
      setStartDate(`${prevYear}-${prevMonth}-01`);
      setEndDate(`${prevYear}-${prevMonth}-${String(lastDay).padStart(2, '0')}`);
    } else if (newPreset === 'ytd') {
      setStartDate(`${today.getFullYear()}-01-01`);
      setEndDate(today.toISOString().split('T')[0]);
    }
  };

  const reportTransactions = useMemo(() => {
    return transactions.map((t) => ({
      id: t.id,
      type: t.type,
      date: t.date || '',
      payeeName: t.payee_name || t.title || 'Transaction',
      category: t.lines?.[0]?.category?.name || t.category || 'General',
      amount: parseFloat(t.amount || t.lines?.[0]?.amount || 0),
      isBillable: t.lines?.[0]?.billable || false,
      isReimbursable: t.lines?.[0]?.reimbursable || false,
      taxAmount: t.lines?.[0]?.tax_amount ? parseFloat(t.lines[0].tax_amount) : undefined,
    }));
  }, [transactions]);

  const statement = useMemo(() => {
    return generateFinancialStatement(reportTransactions, startDate, endDate);
  }, [reportTransactions, startDate, endDate]);

  const taxSummary = useMemo(() => {
    return generateTaxSummary(
      reportTransactions.filter((t) => t.date >= startDate && t.date <= endDate)
    );
  }, [reportTransactions, startDate, endDate]);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="reports-view-container" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Header & Controls */}
      <div className="no-print" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: '700', color: 'var(--text-primary)', margin: 0 }}>
            Financial Reports & Tax Statements
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', margin: '0.25rem 0 0 0' }}>
            Generate executive P&L statements, VAT schedules, and print-ready accounting reports.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button
            className={`btn-secondary ${reportType === 'financial' ? 'btn-primary' : ''}`}
            onClick={() => setReportType('financial')}
          >
            📋 Financial Statement
          </button>
          <button
            className={`btn-secondary ${reportType === 'tax' ? 'btn-primary' : ''}`}
            onClick={() => setReportType('tax')}
          >
            🏛️ Tax & VAT Summary
          </button>
          <button
            className="btn-secondary"
            onClick={handlePrint}
            style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}
          >
            <span>🖨️</span>
            <span>Print / PDF</span>
          </button>
        </div>
      </div>

      {/* Date Filter Toolbar */}
      <div className="card no-print" style={{ padding: '1rem', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '1rem' }}>
        <div style={{ display: 'flex', gap: '0.4rem' }}>
          <button
            className={`btn-secondary ${preset === 'this_month' ? 'active' : ''}`}
            style={{ padding: '0.35rem 0.65rem', fontSize: '0.82rem' }}
            onClick={() => handlePresetChange('this_month')}
          >
            This Month
          </button>
          <button
            className={`btn-secondary ${preset === 'last_month' ? 'active' : ''}`}
            style={{ padding: '0.35rem 0.65rem', fontSize: '0.82rem' }}
            onClick={() => handlePresetChange('last_month')}
          >
            Last Month
          </button>
          <button
            className={`btn-secondary ${preset === 'ytd' ? 'active' : ''}`}
            style={{ padding: '0.35rem 0.65rem', fontSize: '0.82rem' }}
            onClick={() => handlePresetChange('ytd')}
          >
            YTD
          </button>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginLeft: 'auto' }}>
          <label style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>From:</label>
          <input
            type="date"
            className="input-field"
            value={startDate}
            onChange={(e) => {
              setStartDate(e.target.value);
              setPreset('custom');
            }}
            style={{ padding: '0.35rem 0.6rem', fontSize: '0.85rem' }}
          />
          <label style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>To:</label>
          <input
            type="date"
            className="input-field"
            value={endDate}
            onChange={(e) => {
              setEndDate(e.target.value);
              setPreset('custom');
            }}
            style={{ padding: '0.35rem 0.6rem', fontSize: '0.85rem' }}
          />
        </div>
      </div>

      {/* Print-ready Report Sheet */}
      <div
        className="card report-sheet"
        style={{
          padding: '2rem',
          background: 'var(--card-bg, #181924)',
          border: '1px solid var(--border-color)',
        }}
      >
        {/* Sheet Letterhead */}
        <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '2px solid var(--border-color)', paddingBottom: '1.25rem', marginBottom: '1.5rem' }}>
          <div>
            <h1 style={{ fontSize: '1.4rem', fontWeight: '800', margin: 0, color: 'var(--text-primary)' }}>
              {currentWorkspace?.name || 'Personal'} Financial Report
            </h1>
            <p style={{ margin: '0.35rem 0 0 0', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              Period: {startDate} through {endDate} • Base Currency: {currency}
            </p>
          </div>
          <div style={{ textAlign: 'right' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Generated on</span>
            <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.85rem', fontWeight: '600' }}>
              {new Date().toLocaleDateString()}
            </p>
          </div>
        </div>

        {reportType === 'financial' ? (
          <div>
            {/* P&L Executive Summary Metrics */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
              <div style={{ padding: '1rem', borderRadius: '8px', background: 'rgba(16, 185, 129, 0.08)', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
                <span style={{ fontSize: '0.75rem', color: '#10b981', textTransform: 'uppercase', fontWeight: '700' }}>Total Inflows</span>
                <p style={{ fontSize: '1.35rem', fontWeight: '800', margin: '0.25rem 0 0 0', color: '#10b981' }}>
                  +{statement.totalIncome} {currency}
                </p>
              </div>

              <div style={{ padding: '1rem', borderRadius: '8px', background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
                <span style={{ fontSize: '0.75rem', color: '#ef4444', textTransform: 'uppercase', fontWeight: '700' }}>Total Outflows</span>
                <p style={{ fontSize: '1.35rem', fontWeight: '800', margin: '0.25rem 0 0 0', color: '#ef4444' }}>
                  -{statement.totalExpense} {currency}
                </p>
              </div>

              <div style={{ padding: '1rem', borderRadius: '8px', background: 'rgba(99, 102, 241, 0.08)', border: '1px solid rgba(99, 102, 241, 0.2)' }}>
                <span style={{ fontSize: '0.75rem', color: '#818cf8', textTransform: 'uppercase', fontWeight: '700' }}>Net Surplus</span>
                <p style={{ fontSize: '1.35rem', fontWeight: '800', margin: '0.25rem 0 0 0', color: Number(statement.netIncome) >= 0 ? '#818cf8' : '#ef4444' }}>
                  {Number(statement.netIncome) >= 0 ? '+' : ''}{statement.netIncome} {currency}
                </p>
              </div>

              <div style={{ padding: '1rem', borderRadius: '8px', background: 'rgba(255, 255, 255, 0.04)', border: '1px solid var(--border-color)' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: '700' }}>Savings Rate</span>
                <p style={{ fontSize: '1.35rem', fontWeight: '800', margin: '0.25rem 0 0 0' }}>
                  {statement.savingsRatePercent}%
                </p>
              </div>
            </div>

            {/* Category Expense Rankings */}
            <h3 style={{ fontSize: '1.1rem', fontWeight: '700', marginBottom: '0.75rem', color: 'var(--text-primary)' }}>
              Expense Breakdown by Category
            </h3>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem', marginBottom: '2rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}>
                  <th style={{ padding: '0.65rem' }}>Category</th>
                  <th style={{ padding: '0.65rem' }}>Amount ({currency})</th>
                  <th style={{ padding: '0.65rem' }}>Share of Total Spending</th>
                </tr>
              </thead>
              <tbody>
                {statement.categoryBreakdown.map((row, idx) => (
                  <tr key={idx} style={{ borderBottom: '1px solid var(--border-color)' }}>
                    <td style={{ padding: '0.65rem', fontWeight: '500' }}>{row.category}</td>
                    <td style={{ padding: '0.65rem' }}>{row.totalAmount}</td>
                    <td style={{ padding: '0.65rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <div style={{ width: '80px', height: '6px', background: 'rgba(255,255,255,0.1)', borderRadius: '3px', overflow: 'hidden' }}>
                          <div style={{ width: `${row.percentageOfExpense}%`, height: '100%', background: '#6366f1' }} />
                        </div>
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{row.percentageOfExpense}%</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Top 5 Largest Expenditures */}
            <h3 style={{ fontSize: '1.1rem', fontWeight: '700', marginBottom: '0.75rem', color: 'var(--text-primary)' }}>
              Top 5 Largest Transactions
            </h3>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}>
                  <th style={{ padding: '0.6rem' }}>Payee / Description</th>
                  <th style={{ padding: '0.6rem' }}>Category</th>
                  <th style={{ padding: '0.6rem' }}>Date</th>
                  <th style={{ padding: '0.6rem' }}>Amount</th>
                </tr>
              </thead>
              <tbody>
                {statement.largestExpenses.map((e) => (
                  <tr key={e.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                    <td style={{ padding: '0.6rem', fontWeight: '500' }}>{e.payeeName}</td>
                    <td style={{ padding: '0.6rem', color: 'var(--text-secondary)' }}>{e.category}</td>
                    <td style={{ padding: '0.6rem', color: 'var(--text-secondary)' }}>{e.date}</td>
                    <td style={{ padding: '0.6rem', fontWeight: '700', color: '#ef4444' }}>
                      -{e.amount} {currency}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          /* Tax & VAT Statement */
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
              <div style={{ padding: '1rem', borderRadius: '8px', background: 'rgba(255, 255, 255, 0.03)', border: '1px solid var(--border-color)' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Taxable Sales / Inflows</span>
                <p style={{ fontSize: '1.25rem', fontWeight: '700', margin: '0.25rem 0 0 0' }}>
                  {taxSummary.totalTaxableSales} {currency}
                </p>
                <span style={{ fontSize: '0.8rem', color: '#10b981' }}>Output VAT: +{taxSummary.outputVatCollected}</span>
              </div>

              <div style={{ padding: '1rem', borderRadius: '8px', background: 'rgba(255, 255, 255, 0.03)', border: '1px solid var(--border-color)' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Taxable Purchases</span>
                <p style={{ fontSize: '1.25rem', fontWeight: '700', margin: '0.25rem 0 0 0' }}>
                  {taxSummary.totalTaxablePurchases} {currency}
                </p>
                <span style={{ fontSize: '0.8rem', color: '#ef4444' }}>Input VAT: -{taxSummary.inputVatPaid}</span>
              </div>

              <div style={{ padding: '1rem', borderRadius: '8px', background: 'rgba(99, 102, 241, 0.08)', border: '1px solid rgba(99, 102, 241, 0.2)' }}>
                <span style={{ fontSize: '0.75rem', color: '#818cf8', textTransform: 'uppercase', fontWeight: '700' }}>
                  Net VAT {taxSummary.status === 'payable' ? 'Payable' : 'Refund Claim'}
                </span>
                <p style={{ fontSize: '1.35rem', fontWeight: '800', margin: '0.25rem 0 0 0', color: taxSummary.status === 'payable' ? '#ef4444' : '#10b981' }}>
                  {taxSummary.netVatPayable} {currency}
                </p>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Status: {taxSummary.status.toUpperCase()}</span>
              </div>
            </div>

            <h3 style={{ fontSize: '1.1rem', fontWeight: '700', marginBottom: '0.75rem', color: 'var(--text-primary)' }}>
              Client Billables & Reimbursables
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
              <div style={{ padding: '1rem', borderRadius: '8px', background: 'rgba(255, 255, 255, 0.03)', border: '1px solid var(--border-color)' }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Billable Client Expenses</span>
                <p style={{ fontSize: '1.2rem', fontWeight: '700', margin: '0.2rem 0 0 0' }}>
                  {taxSummary.billableClientExpenses} {currency}
                </p>
              </div>
              <div style={{ padding: '1rem', borderRadius: '8px', background: 'rgba(255, 255, 255, 0.03)', border: '1px solid var(--border-color)' }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Reimbursable Expenses</span>
                <p style={{ fontSize: '1.2rem', fontWeight: '700', margin: '0.2rem 0 0 0' }}>
                  {taxSummary.reimbursableExpenses} {currency}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
