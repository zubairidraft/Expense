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

const AnalyticsContext = createContext(null);

export function AnalyticsProvider({ children }) {
  const { currentWorkspace } = useWorkspace();
  const { transactions } = useTransactions();
  const { accounts } = useAccounts();
  const { recurringProfiles } = useRecurring();
  const { budgets } = useBudgets();

  const [loading, setLoading] = useState(false);
  const [dbNetWorth, setDbNetWorth] = useState(null);
  const [dbCashFlow, setDbCashFlow] = useState([]);
  const [dbCategorySpending, setDbCategorySpending] = useState([]);
  const [forecastHorizon, setForecastHorizon] = useState(90);

  // Fetch Supabase views if available
  const fetchAnalyticsViews = useCallback(async () => {
    if (!currentWorkspace?.id) return;
    setLoading(true);
    try {
      // 1. Net worth snapshot
      const { data: nwData } = await supabase
        .from('v_net_worth_snapshot')
        .select('*')
        .eq('workspace_id', currentWorkspace.id)
        .maybeSingle();

      if (nwData) {
        setDbNetWorth(nwData);
      }

      // 2. Monthly cash flow
      const { data: cfData } = await supabase
        .from('v_cash_flow_monthly')
        .select('*')
        .eq('workspace_id', currentWorkspace.id)
        .order('month_date', { ascending: false })
        .limit(12);

      if (cfData) {
        setDbCashFlow(cfData);
      }

      // 3. Monthly spending by category
      const { data: scData } = await supabase
        .from('v_monthly_spending_by_category')
        .select('*')
        .eq('workspace_id', currentWorkspace.id)
        .order('month_date', { ascending: false });

      if (scData) {
        setDbCategorySpending(scData);
      }
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
      .reduce((acc, a) => acc + (parseFloat(a.balance || a.opening_balance || 0)), 0);
    const liabilities = accounts
      .filter((a) => a.nature === 'liability')
      .reduce((acc, a) => acc + (parseFloat(a.balance || a.opening_balance || 0)), 0);

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

    const currentMonthPrefix = now.toISOString().slice(0, 7); // YYYY-MM
    const currentMonthExpenses = transactions
      .filter((t) => t.type === 'expense' && (t.date || '').startsWith(currentMonthPrefix))
      .reduce((sum, t) => sum + parseFloat(t.amount || (t.lines?.[0]?.amount) || 0), 0);

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

    const formattedTxs = transactions.map((t) => ({
      id: t.id,
      payeeName: t.payee_name || t.title || 'Expense',
      category: t.lines?.[0]?.category?.name || t.category || 'General',
      amount: parseFloat(t.amount || t.lines?.[0]?.amount || 0),
      date: t.date || new Date().toISOString().split('T')[0],
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
      .filter((r) => r.is_active !== false)
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

  return (
    <AnalyticsContext.Provider
      value={{
        loading,
        netWorth: clientNetWorth,
        cashFlowHistory: dbCashFlow,
        categorySpending: dbCategorySpending,
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
