import { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useWorkspace } from './WorkspaceContext';
import { useTransactions } from './TransactionContext';
import { useAccounts } from './AccountContext';
import { useRecurring } from './RecurringContext';
import { useBudgets } from './BudgetContext';
import {
  calculateCategoryStats,
  detectSpendingAnomalies,
  calculateSpendingVelocity,
  projectCashFlowForecast,
} from '@universal-expense/core';
import { todayISO } from '../lib/dates';
import { sumMoney, toNum, isLiveTransaction } from '../lib/money';

// Base-currency total of all lines of a live transaction (handles splits & FX)
const txBaseTotal = (t) =>
  toNum(sumMoney((t.lines || []).map((l) => l.base_amount ?? l.amount ?? '0')));


const AnalyticsContext = createContext(null);

export function AnalyticsProvider({ children }) {
  const { currentWorkspace } = useWorkspace();
  const { transactions: allTransactions } = useTransactions();
  const transactions = useMemo(
    () => allTransactions.filter((t) => isLiveTransaction(t) && !t.is_foreign),
    [allTransactions]
  );
  const { accounts } = useAccounts();
  const { recurringProfiles } = useRecurring();
  const { budgets } = useBudgets();

  const [loading, setLoading] = useState(false);
  const [dbNetWorth, setDbNetWorth] = useState(null);
  const [dbCashFlow, setDbCashFlow] = useState([]);
  const [, setDbCategorySpending] = useState([]);
  const [forecastHorizon, setForecastHorizon] = useState(90);

  // Fetch Supabase views if available
  const fetchAnalyticsViews = useCallback(async () => {
    if (!currentWorkspace?.id || currentWorkspace.id === 'guest-space') {
      setDbNetWorth(null);
      setDbCashFlow([]);
      setDbCategorySpending([]);
      return;
    }
    setLoading(true);
    try {
      // 1. Net worth snapshot
      const { data: nwData } = await supabase
        .from('v_net_worth_snapshot')
        .select('*')
        .eq('workspace_id', currentWorkspace.id)
        .maybeSingle();

      setDbNetWorth(nwData || null);

      // 2. Monthly cash flow
      const { data: cfData } = await supabase
        .from('v_cash_flow_monthly')
        .select('*')
        .eq('workspace_id', currentWorkspace.id)
        .order('month_date', { ascending: false })
        .limit(12);

      setDbCashFlow(cfData ? [...cfData].reverse() : []);

      // 3. Monthly spending by category
      const { data: scData } = await supabase
        .from('v_monthly_spending_by_category')
        .select('*')
        .eq('workspace_id', currentWorkspace.id)
        .order('month_date', { ascending: false });

      setDbCategorySpending(scData || []);
    } catch (err) {
      console.warn('Could not fetch analytics views from DB, using client calculations:', err);
    } finally {
      setLoading(false);
    }
  }, [currentWorkspace?.id]);

  useEffect(() => {
    fetchAnalyticsViews();
  }, [fetchAnalyticsViews, transactions]);

  // Fallback / Real-time client net worth
  const clientNetWorth = useMemo(() => {
    if (dbNetWorth) {
      return {
        totalAssets: parseFloat(dbNetWorth.total_assets || '0'),
        totalLiabilities: parseFloat(dbNetWorth.total_liabilities || '0'),
        netWorth: parseFloat(dbNetWorth.net_worth || '0'),
      };
    }
    const assets = accounts
      .filter((a) => (a.nature || 'asset') === 'asset')
      .reduce((acc, a) => acc + parseFloat(a.base_balance ?? a.balance ?? a.opening_balance ?? 0), 0);
    const liabilities = accounts
      .filter((a) => a.nature === 'liability')
      .reduce((acc, a) => acc + parseFloat(a.base_balance ?? a.balance ?? a.opening_balance ?? 0), 0);

    return {
      totalAssets: assets,
      totalLiabilities: liabilities,
      netWorth: assets - liabilities,
    };
  }, [dbNetWorth, accounts]);

  // Current month spending velocity and burn rate
  const currentVelocity = useMemo(() => {
    const now = new Date();
    const daysElapsed = now.getDate();
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();

    const currentMonthPrefix = todayISO().slice(0, 7); // YYYY-MM (local)
    const currentMonthExpenses = transactions
      .filter((t) => t.type === 'expense' && (t.date || '').startsWith(currentMonthPrefix))
      .reduce((sum, t) => sum + txBaseTotal(t), 0);

    const totalBudgetLimit = budgets.reduce((sum, b) => sum + parseFloat(b.amount || 0), 0);

    return calculateSpendingVelocity({
      daysElapsed,
      daysInMonth,
      currentSpent: currentMonthExpenses,
      budgetLimit: totalBudgetLimit > 0 ? totalBudgetLimit : undefined,
    });
  }, [transactions, budgets]);

  // Spending Anomaly Detection
  const spendingAnomalies = useMemo(() => {
    if (!transactions.length) return [];

    const formattedTxs = transactions.filter((t) => t.type === 'expense').map((t) => ({
      id: t.id,
      payeeName: t.payee_name || t.title || 'Expense',
      category: t.lines?.[0]?.category?.name || t.category || 'General',
      amount: txBaseTotal(t),
      date: t.date || todayISO(),
    }));

    const historicalStats = calculateCategoryStats(formattedTxs);
    return detectSpendingAnomalies(formattedTxs, historicalStats, {
      minDeviationMultiplier: 2.2,
      minAmountThreshold: 30,
    });
  }, [transactions]);

  // Cash flow forecasting over selected horizon
  const cashFlowForecast = useMemo(() => {
    const startingBal = clientNetWorth.totalAssets;
    const recurringItems = recurringProfiles
      .filter((r) => r.active !== false && r.is_active !== false)
      .map((r) => {
        let dayOfMonth = 1;
        if (r.next_due_date) {
          dayOfMonth = new Date(r.next_due_date).getDate();
        }
        return {
          id: r.id,
          title: r.title,
          amount: parseFloat(r.amount || 0),
          type: r.type || 'expense',
          dayOfMonth,
        };
      });

    return projectCashFlowForecast(startingBal, recurringItems, forecastHorizon);
  }, [clientNetWorth.totalAssets, recurringProfiles, forecastHorizon]);

  // Real-time client monthly cash flow fallback
  const clientCashFlow = useMemo(() => {
    if (dbCashFlow && dbCashFlow.length > 0) return dbCashFlow;
    const monthly = {};
    for (const t of transactions) {
      if (t.type !== 'income' && t.type !== 'expense') continue;
      const month = (t.date || '').slice(0, 7);
      if (!month) continue;
      if (!monthly[month]) {
        monthly[month] = { income: 0, expense: 0 };
      }
      const amt = txBaseTotal(t);
      if (t.type === 'income') monthly[month].income += amt;
      else if (t.type === 'expense') monthly[month].expense += amt;
    }

    if (Object.keys(monthly).length === 0) return [];

    const monthsSorted = Object.keys(monthly).sort();
    return monthsSorted.map((m) => {
      const inc = monthly[m].income;
      const exp = monthly[m].expense;
      const net = inc - exp;
      const rate = inc > 0 ? ((net / inc) * 100).toFixed(1) : '0.0';
      return {
        month_date: `${m}-01`,
        total_income: inc.toFixed(2),
        total_expense: exp.toFixed(2),
        net_cash_flow: net.toFixed(2),
        savings_rate_percent: rate,
      };
    });
  }, [dbCashFlow, transactions]);

  // Category spending (all lines, base currency) computed from the RLS-scoped ledger
  const clientCategorySpending = useMemo(() => {
    const catMap = {};
    let totalExp = 0;
    for (const t of transactions) {
      if (t.type !== 'expense') continue;
      for (const l of t.lines || []) {
        if (l.direction !== 'out') continue;
        const catName = l.category?.name || t.category || 'Uncategorized';
        const amt = parseFloat(l.base_amount ?? l.amount ?? 0);
        catMap[catName] = (catMap[catName] || 0) + amt;
        totalExp += amt;
      }
    }
    return Object.entries(catMap)
      .map(([name, amount]) => ({
        category_name: name,
        total_spent: amount.toFixed(2),
        percentage: totalExp > 0 ? ((amount / totalExp) * 100).toFixed(1) : '0.0',
      }))
      .sort((a, b) => parseFloat(b.total_spent) - parseFloat(a.total_spent));
  }, [transactions]);

  return (
    <AnalyticsContext.Provider
      value={{
        loading,
        netWorth: clientNetWorth,
        cashFlowHistory: clientCashFlow,
        categorySpending: clientCategorySpending,
        currentVelocity,
        spendingAnomalies,
        cashFlowForecast,
        forecastHorizon,
        setForecastHorizon,
        refreshAnalytics: fetchAnalyticsViews,
      }}
    >
      {children}
    </AnalyticsContext.Provider>
  );
}

export function useAnalytics() {
  const context = useContext(AnalyticsContext);
  if (!context) {
    throw new Error('useAnalytics must be used within an AnalyticsProvider');
  }
  return context;
}
