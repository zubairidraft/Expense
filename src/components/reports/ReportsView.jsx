import { useState, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useTransactions } from '../../context/TransactionContext';
import { useWorkspace } from '../../context/WorkspaceContext';
import { useCategories } from '../../context/CategoryContext';
import { useAccounts } from '../../context/AccountContext';
import { generateFinancialStatement, generateTaxSummary } from '@universal-expense/core';
import { toLocalISODate } from '../../lib/dates';
import ExportModal from './ExportModal';

export default function ReportsView() {
  const { user, profile } = useAuth();
  const { transactions } = useTransactions();
  const { currentWorkspace } = useWorkspace();
  const { categories = [], tags = [] } = useCategories() || {};
  const { accounts = [] } = useAccounts() || {};

  const currency = currentWorkspace?.base_currency || 'USD';
  const [exportModalOpen, setExportModalOpen] = useState(false);

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

  // Granular Filter Controls (User Feedback Item 9)
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedTag, setSelectedTag] = useState('all');
  const [selectedAccount, setSelectedAccount] = useState('all');
  const [selectedType, setSelectedType] = useState('all'); // 'all' | 'expense' | 'income'

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
      setEndDate(toLocalISODate(today));
    } else if (newPreset === 'all_time') {
      setStartDate('2020-01-01');
      setEndDate(toLocalISODate(today));
    }
  };

  // Filtered dataset according to date, category, tag, account, and type
  const filteredTransactions = useMemo(() => {
    return transactions.filter((t) => {
      if (t.is_foreign) return false;
      const tDate = t.date || '';
      if (startDate && tDate < startDate) return false;
      if (endDate && tDate > endDate) return false;

      if (selectedType !== 'all' && t.type !== selectedType) return false;

      if (selectedCategory !== 'all') {
        const matchesCat = Array.isArray(t.lines) && t.lines.length > 0
          ? t.lines.some((l) => {
              const cId = l?.categoryId || l?.category_id || l?.category?.id;
              const cName = l?.category?.name || l?.category;
              return cId === selectedCategory || cName === selectedCategory;
            })
          : (t.category === selectedCategory || t.category_id === selectedCategory);
        if (!matchesCat) return false;
      }

      if (selectedAccount !== 'all') {
        const matchesAcc = Array.isArray(t.lines) && t.lines.length > 0
          ? t.lines.some((l) => {
              const aId = l?.accountId || l?.account_id || l?.account?.id;
              return aId === selectedAccount;
            })
          : (t.accountId === selectedAccount || t.account_id === selectedAccount);
        if (!matchesAcc) return false;
      }

      if (selectedTag !== 'all') {
        const tTags = (t.tags || []).map((tg) => tg.tag?.id || tg.tag?.name || tg.id || tg.name || tg);
        if (!tTags.includes(selectedTag)) return false;
      }

      return true;
    });
  }, [transactions, startDate, endDate, selectedType, selectedCategory, selectedAccount, selectedTag]);

  const reportTransactions = useMemo(() => {
    return filteredTransactions.map((t) => ({
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
  }, [filteredTransactions]);

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

  const resetFilters = () => {
    setSelectedCategory('all');
    setSelectedTag('all');
    setSelectedAccount('all');
    setSelectedType('all');
    handlePresetChange('this_month');
  };

  return (
    <div className="reports-view-container" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Header & Controls */}
      <div className="no-print" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 style={{ fontSize: '1.6rem', fontWeight: '700', color: 'var(--text-primary)', margin: 0 }}>
            📋 Financial Reports & Tax Statements
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', margin: '0.25rem 0 0 0' }}>
            Generate executive P&L statements, granular filtered ledgers, and print-ready accounting sheets.
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
            className="submit-btn primary-glow"
            onClick={() => setExportModalOpen(true)}
            title="Export filtered financial report to Excel, PDF, or CSV"
            style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.45rem 0.95rem', fontSize: '0.85rem' }}
          >
            <span>📥</span>
            <span>Export Report</span>
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

      {/* Granular Filters & Date Toolbar */}
      <div className="card no-print" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
          {/* Presets */}
          <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
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
            <button
              className={`btn-secondary ${preset === 'all_time' ? 'active' : ''}`}
              style={{ padding: '0.35rem 0.65rem', fontSize: '0.82rem' }}
              onClick={() => handlePresetChange('all_time')}
            >
              All Time
            </button>
          </div>

          {/* Date Pickers */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
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

        {/* Dimension Filters: Category, Tag, Account, Type */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '0.75rem', paddingTop: '0.75rem', borderTop: '1px solid var(--border-color, rgba(var(--md-on-surface-rgb), 0.08))', alignItems: 'center' }}>
          <div>
            <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.2rem' }}>Category</label>
            <select
              className="select-field"
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              style={{ width: '100%', fontSize: '0.82rem', padding: '0.35rem 0.6rem' }}
            >
              <option value="all">All Categories</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.icon || '🏷️'} {c.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.2rem' }}>Tag</label>
            <select
              className="select-field"
              value={selectedTag}
              onChange={(e) => setSelectedTag(e.target.value)}
              style={{ width: '100%', fontSize: '0.82rem', padding: '0.35rem 0.6rem' }}
            >
              <option value="all">All Tags</option>
              {tags.map((tg) => (
                <option key={tg.id || tg.name} value={tg.id || tg.name}>
                  #{tg.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.2rem' }}>Account</label>
            <select
              className="select-field"
              value={selectedAccount}
              onChange={(e) => setSelectedAccount(e.target.value)}
              style={{ width: '100%', fontSize: '0.82rem', padding: '0.35rem 0.6rem' }}
            >
              <option value="all">All Accounts</option>
              {accounts.map((acc) => (
                <option key={acc.id} value={acc.id}>
                  {acc.icon || '💳'} {acc.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.2rem' }}>Flow Type</label>
            <select
              className="select-field"
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              style={{ width: '100%', fontSize: '0.82rem', padding: '0.35rem 0.6rem' }}
            >
              <option value="all">All Flows (In & Out)</option>
              <option value="expense">Expenses Only</option>
              <option value="income">Incomes Only</option>
              <option value="transfer">Transfers Only</option>
            </select>
          </div>

          <div style={{ alignSelf: 'flex-end' }}>
            <button
              type="button"
              className="btn-secondary"
              onClick={resetFilters}
              style={{ width: '100%', fontSize: '0.82rem', padding: '0.4rem 0.6rem' }}
            >
              ↺ Reset Filters
            </button>
          </div>
        </div>
      </div>

      {/* Print-ready Clean Material Report Sheet */}
      <div
        className="card report-sheet"
        style={{
          padding: '2rem',
          background: 'var(--bg-card, var(--md-on-primary))',
          color: 'var(--text-primary, var(--md-on-surface))',
          border: '1px solid var(--border-color, rgba(var(--md-on-surface-rgb), 0.1))',
          borderRadius: '12px',
        }}
      >
        {/* Sheet Letterhead */}
        <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '2px solid var(--border-color, rgba(var(--md-on-surface-rgb), 0.1))', paddingBottom: '1.25rem', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h1 style={{ fontSize: '1.4rem', fontWeight: '800', margin: 0, color: 'var(--text-primary)' }}>
              {currentWorkspace?.name || 'Personal'} Financial Statement
            </h1>
            <p style={{ margin: '0.35rem 0 0 0', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              Period: {startDate} through {endDate} • Base Currency: {currency} • Transactions: {filteredTransactions.length}
            </p>
          </div>
          <div style={{ textAlign: 'right' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Generated on</span>
            <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.85rem', fontWeight: '600', color: 'var(--text-primary)' }}>
              {new Date().toLocaleDateString()}
            </p>
          </div>
        </div>

        {reportType === 'financial' ? (
          <div>
            {/* P&L Executive Summary Metrics */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
              <div style={{ padding: '1rem', borderRadius: '8px', background: 'rgba(var(--md-success-rgb), 0.08)', border: '1px solid rgba(var(--md-success-rgb), 0.25)' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--md-success)', textTransform: 'uppercase', fontWeight: '700' }}>Total Inflows</span>
                <p style={{ fontSize: '1.35rem', fontWeight: '800', margin: '0.25rem 0 0 0', color: 'var(--md-success)' }}>
                  +{statement.totalIncome} {currency}
                </p>
              </div>

              <div style={{ padding: '1rem', borderRadius: '8px', background: 'rgba(var(--md-error-rgb), 0.08)', border: '1px solid rgba(var(--md-error-rgb), 0.25)' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--md-error)', textTransform: 'uppercase', fontWeight: '700' }}>Total Outflows</span>
                <p style={{ fontSize: '1.35rem', fontWeight: '800', margin: '0.25rem 0 0 0', color: 'var(--md-error)' }}>
                  -{statement.totalExpense} {currency}
                </p>
              </div>

              <div style={{ padding: '1rem', borderRadius: '8px', background: 'rgba(var(--md-primary-rgb), 0.08)', border: '1px solid rgba(var(--md-primary-rgb), 0.25)' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--md-primary)', textTransform: 'uppercase', fontWeight: '700' }}>Net Surplus</span>
                <p style={{ fontSize: '1.35rem', fontWeight: '800', margin: '0.25rem 0 0 0', color: Number(statement.netIncome) >= 0 ? 'var(--md-success)' : 'var(--md-error)' }}>
                  {Number(statement.netIncome) >= 0 ? '+' : ''}{statement.netIncome} {currency}
                </p>
              </div>

              <div style={{ padding: '1rem', borderRadius: '8px', background: 'var(--bg-main, rgba(0, 0, 0, 0.04))', border: '1px solid var(--border-color, rgba(var(--md-on-surface-rgb), 0.1))' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: '700' }}>Savings Rate</span>
                <p style={{ fontSize: '1.35rem', fontWeight: '800', margin: '0.25rem 0 0 0', color: 'var(--text-primary)' }}>
                  {statement.savingsRatePercent}%
                </p>
              </div>
            </div>

            {/* Category Expense Rankings */}
            <h3 style={{ fontSize: '1.1rem', fontWeight: '700', marginBottom: '0.75rem', color: 'var(--text-primary)' }}>
              Expense Breakdown by Category
            </h3>
            <div className="table-responsive">
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem', marginBottom: '1rem' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid var(--border-color, rgba(var(--md-on-surface-rgb), 0.1))', color: 'var(--text-secondary)' }}>
                    <th style={{ padding: '0.65rem' }}>Category</th>
                    <th style={{ padding: '0.65rem' }}>Amount ({currency})</th>
                    <th style={{ padding: '0.65rem' }}>Share of Total Spending</th>
                  </tr>
                </thead>
                <tbody>
                  {statement.categoryBreakdown.length === 0 ? (
                    <tr>
                      <td colSpan="3" style={{ padding: '1rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                        No expenses recorded for selected criteria.
                      </td>
                    </tr>
                  ) : (
                    statement.categoryBreakdown.map((row, idx) => (
                      <tr key={idx} style={{ borderBottom: '1px solid var(--border-color, rgba(var(--md-on-surface-rgb), 0.08))' }}>
                        <td style={{ padding: '0.65rem', fontWeight: '600', color: 'var(--text-primary)' }}>{row.category}</td>
                        <td style={{ padding: '0.65rem', color: 'var(--text-primary)' }}>{row.totalAmount}</td>
                        <td style={{ padding: '0.65rem' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                            <div style={{ width: '100px', height: '6px', background: 'rgba(0,0,0,0.08)', borderRadius: '3px', overflow: 'hidden' }}>
                              <div style={{ width: `${row.percentageOfExpense}%`, height: '100%', background: 'var(--md-primary)' }} />
                            </div>
                            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{row.percentageOfExpense}%</span>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Detailed Filtered Transaction Itemized Records */}
            <div style={{ marginTop: '2rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                <h3 style={{ fontSize: '1.1rem', fontWeight: '700', margin: 0, color: 'var(--text-primary)' }}>
                  Itemized Filtered Records ({filteredTransactions.length})
                </h3>
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid var(--border-color, rgba(var(--md-on-surface-rgb), 0.1))', color: 'var(--text-secondary)' }}>
                      <th style={{ padding: '0.6rem' }}>Date</th>
                      <th style={{ padding: '0.6rem' }}>Payee / Title</th>
                      <th style={{ padding: '0.6rem' }}>Category</th>
                      <th style={{ padding: '0.6rem' }}>Account</th>
                      <th style={{ padding: '0.6rem', textAlign: 'right' }}>Amount ({currency})</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredTransactions.length === 0 ? (
                      <tr>
                        <td colSpan="5" style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                          No transactions match the selected filter parameters.
                        </td>
                      </tr>
                    ) : (
                      filteredTransactions.map((tx) => {
                        const line = tx.lines?.[0];
                        const isIncome = tx.type === 'income';
                        return (
                          <tr key={tx.id} style={{ borderBottom: '1px solid var(--border-color, rgba(var(--md-on-surface-rgb), 0.08))' }}>
                            <td style={{ padding: '0.6rem', color: 'var(--text-secondary)' }}>{tx.date}</td>
                            <td style={{ padding: '0.6rem', fontWeight: '600', color: 'var(--text-primary)' }}>
                              {tx.payee_name || tx.title || 'Transaction'}
                            </td>
                            <td style={{ padding: '0.6rem' }}>
                              <span style={{ fontSize: '0.8rem', padding: '0.2rem 0.5rem', borderRadius: '4px', background: 'rgba(var(--md-primary-rgb), 0.1)', color: 'var(--md-primary)' }}>
                                {line?.category?.name || tx.category || 'General'}
                              </span>
                            </td>
                            <td style={{ padding: '0.6rem', color: 'var(--text-secondary)' }}>
                              {line?.account?.name || 'Account'}
                            </td>
                            <td style={{ padding: '0.6rem', textAlign: 'right', fontWeight: '700', color: isIncome ? 'var(--md-success)' : 'var(--md-error)' }}>
                              {isIncome ? '+' : '-'}{parseFloat(line?.amount || tx.amount || 0).toFixed(2)}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        ) : (
          /* Tax & VAT Statement */
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
              <div style={{ padding: '1rem', borderRadius: '8px', background: 'rgba(var(--md-success-rgb), 0.06)', border: '1px solid rgba(var(--md-success-rgb), 0.2)' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Taxable Sales / Inflows</span>
                <p style={{ fontSize: '1.25rem', fontWeight: '700', margin: '0.25rem 0 0 0', color: 'var(--text-primary)' }}>
                  {taxSummary.totalTaxableSales} {currency}
                </p>
                <span style={{ fontSize: '0.8rem', color: 'var(--md-success)' }}>Output VAT: +{taxSummary.outputVatCollected}</span>
              </div>

              <div style={{ padding: '1rem', borderRadius: '8px', background: 'rgba(var(--md-error-rgb), 0.06)', border: '1px solid rgba(var(--md-error-rgb), 0.2)' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Taxable Purchases</span>
                <p style={{ fontSize: '1.25rem', fontWeight: '700', margin: '0.25rem 0 0 0', color: 'var(--text-primary)' }}>
                  {taxSummary.totalTaxablePurchases} {currency}
                </p>
                <span style={{ fontSize: '0.8rem', color: 'var(--md-error)' }}>Input VAT: -{taxSummary.inputVatPaid}</span>
              </div>

              <div style={{ padding: '1rem', borderRadius: '8px', background: 'rgba(var(--md-primary-rgb), 0.08)', border: '1px solid rgba(var(--md-primary-rgb), 0.25)' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--md-primary)', textTransform: 'uppercase', fontWeight: '700' }}>
                  Net VAT {taxSummary.status === 'payable' ? 'Payable' : 'Refund Claim'}
                </span>
                <p style={{ fontSize: '1.35rem', fontWeight: '800', margin: '0.25rem 0 0 0', color: taxSummary.status === 'payable' ? 'var(--md-error)' : 'var(--md-success)' }}>
                  {taxSummary.netVatPayable} {currency}
                </p>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Status: {taxSummary.status.toUpperCase()}</span>
              </div>
            </div>

            <h3 style={{ fontSize: '1.1rem', fontWeight: '700', marginBottom: '0.75rem', color: 'var(--text-primary)' }}>
              Client Billables & Reimbursables
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
              <div style={{ padding: '1rem', borderRadius: '8px', background: 'var(--bg-main, rgba(0,0,0,0.04))', border: '1px solid var(--border-color, rgba(var(--md-on-surface-rgb), 0.1))' }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Billable Client Expenses</span>
                <p style={{ fontSize: '1.2rem', fontWeight: '700', margin: '0.2rem 0 0 0', color: 'var(--text-primary)' }}>
                  {taxSummary.billableClientExpenses} {currency}
                </p>
              </div>
              <div style={{ padding: '1rem', borderRadius: '8px', background: 'var(--bg-main, rgba(0,0,0,0.04))', border: '1px solid var(--border-color, rgba(var(--md-on-surface-rgb), 0.1))' }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Reimbursable Expenses</span>
                <p style={{ fontSize: '1.2rem', fontWeight: '700', margin: '0.2rem 0 0 0', color: 'var(--text-primary)' }}>
                  {taxSummary.reimbursableExpenses} {currency}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      <ExportModal
        isOpen={exportModalOpen}
        onClose={() => setExportModalOpen(false)}
        transactions={filteredTransactions}
        workspace={currentWorkspace}
        user={user}
        profile={profile}
        startDate={startDate}
        endDate={endDate}
        appliedFilters={{
          category: selectedCategory,
          account: selectedAccount,
          tag: selectedTag,
          type: selectedType,
          preset,
        }}
        categories={categories}
        accounts={accounts}
        tags={tags}
        baseCurrency={currency}
      />
    </div>
  );
}
