import { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';
import { useWorkspace } from './WorkspaceContext';
import { useTransactions } from './TransactionContext';
import { calculateBudgetUtilization } from '@universal-expense/core';
import { todayISO } from '../lib/dates';
import { getPeriodRange } from '../lib/periods';
import { sumMoney, isLiveTransaction } from '../lib/money';

const BudgetContext = createContext(null);

const DEFAULT_GUEST_BUDGETS = [
  {
    id: 'b-1',
    workspace_id: 'guest-space',
    category_id: 'cat-groceries',
    category_name: 'Groceries & Household',
    category_icon: '🛒',
    period: 'monthly',
    amount: '600.00',
    currency: 'USD',
    rollover_enabled: true,
    rollover_amount: '50.00',
    alert_threshold: 80,
    start_date: '2026-10-01',
  },
  {
    id: 'b-2',
    workspace_id: 'guest-space',
    category_id: 'cat-software',
    category_name: 'Software & Tools',
    category_icon: '☁️',
    period: 'monthly',
    amount: '300.00',
    currency: 'USD',
    rollover_enabled: false,
    rollover_amount: '0.00',
    alert_threshold: 85,
    start_date: '2026-10-01',
  },
  {
    id: 'b-3',
    workspace_id: 'guest-space',
    category_id: 'cat-dining',
    category_name: 'Dining & Coffee',
    category_icon: '☕',
    period: 'monthly',
    amount: '250.00',
    currency: 'USD',
    rollover_enabled: false,
    rollover_amount: '0.00',
    alert_threshold: 90,
    start_date: '2026-10-01',
  },
];

export function BudgetProvider({ children }) {
  const { user } = useAuth();
  const { currentWorkspace } = useWorkspace();
  const { transactions } = useTransactions();

  const [budgets, setBudgets] = useState(DEFAULT_GUEST_BUDGETS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchBudgets = useCallback(async () => {
    if (!currentWorkspace?.id || !user || currentWorkspace.id === 'guest-space') {
      setBudgets(DEFAULT_GUEST_BUDGETS);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const { data, error: fErr } = await supabase
        .from('budgets')
        .select('*, categories(id, name, icon, color)')
        .eq('workspace_id', currentWorkspace.id);

      if (fErr) throw fErr;
      setBudgets(data || []);
    } catch (err) {
      console.warn('[BudgetContext] Fetch error:', err.message);
      setError(err.message);
      setBudgets([]);
    } finally {
      setLoading(false);
    }
  }, [currentWorkspace?.id, user]);

  useEffect(() => {
    fetchBudgets();
  }, [fetchBudgets]);

  // Spent for one budget = expense outflows in its category within the CURRENT period
  // (respecting workspace month_start_day), minus refunds to that category.
  const computeSpent = useCallback(
    (budget) => {
      const catId = budget.category_id || budget.categoryId;
      const { start, end } = getPeriodRange(budget.period, {
        monthStartDay: currentWorkspace?.month_start_day || 1,
        startDate: budget.start_date,
        endDate: budget.end_date,
      });
      const plus = [];
      const minus = [];
      for (const tx of transactions) {
        if (!isLiveTransaction(tx) || tx.is_foreign) continue;
        const d = tx.date || '';
        if (d < start || d > end) continue;
        if (tx.type !== 'expense' && tx.type !== 'refund') continue;
        for (const line of tx.lines || []) {
          const lineCat = line.category_id || line.categoryId || line.category?.id;
          if (catId && lineCat !== catId) continue;
          const amt = line.base_amount ?? line.amount ?? '0';
          if (tx.type === 'expense' && line.direction === 'out') plus.push(amt);
          if (tx.type === 'refund' && line.direction === 'in') minus.push(amt);
        }
      }
      const spent = sumMoney(plus).minus(sumMoney(minus));
      return { spent: spent.isNegative() ? '0.00' : spent.toFixed(2), start, end };
    },
    [transactions, currentWorkspace?.month_start_day]
  );

  // Create budget
  const createBudget = async ({
    categoryId,
    period = 'monthly',
    amount,
    currency,
    rolloverEnabled = false,
    rolloverAmount = '0.00',
    alertThreshold = 85,
    startDate,
    endDate = null,
  }) => {
    const isGuest = !user || currentWorkspace?.id === 'guest-space';
    const workspaceId = currentWorkspace?.id || 'guest-space';
    const curr = currency || currentWorkspace?.base_currency || 'USD';
    const start = startDate || todayISO();

    if (isGuest) {
      const newBudget = {
        id: `b-${Date.now()}`,
        workspace_id: workspaceId,
        category_id: categoryId,
        period,
        amount: String(amount),
        currency: curr,
        rollover_enabled: rolloverEnabled,
        rollover_amount: String(rolloverAmount),
        alert_threshold: Number(alertThreshold),
        start_date: start,
        end_date: endDate,
      };
      setBudgets((prev) => [...prev, newBudget]);
      return { data: newBudget, error: null };
    }

    try {
      setError(null);
      const { data, error: insErr } = await supabase
        .from('budgets')
        .insert({
          workspace_id: workspaceId,
          category_id: categoryId,
          period,
          amount: String(amount),
          currency: curr,
          rollover_enabled: rolloverEnabled,
          rollover_amount: String(rolloverAmount),
          alert_threshold: Number(alertThreshold),
          start_date: start,
          end_date: endDate,
        })
        .select()
        .single();

      if (insErr) throw insErr;
      await fetchBudgets();
      return { data, error: null };
    } catch (err) {
      setError(err.message);
      return { data: null, error: err };
    }
  };

  // Update budget
  const updateBudget = async (id, updates) => {
    const isGuest = !user || currentWorkspace?.id === 'guest-space';
    if (isGuest) {
      setBudgets((prev) =>
        prev.map((b) => (b.id === id ? { ...b, ...updates } : b))
      );
      return { error: null };
    }

    try {
      const { error: updErr } = await supabase
        .from('budgets')
        .update(updates)
        .eq('id', id);

      if (updErr) throw updErr;
      await fetchBudgets();
      return { error: null };
    } catch (err) {
      setError(err.message);
      return { error: err };
    }
  };

  // Delete budget
  const deleteBudget = async (id) => {
    const isGuest = !user || currentWorkspace?.id === 'guest-space';
    if (isGuest) {
      setBudgets((prev) => prev.filter((b) => b.id !== id));
      return { error: null };
    }

    try {
      const { error: delErr } = await supabase
        .from('budgets')
        .delete()
        .eq('id', id);

      if (delErr) throw delErr;
      await fetchBudgets();
      return { error: null };
    } catch (err) {
      setError(err.message);
      return { error: err };
    }
  };

  // Get live utilization for a budget record
  const getUtilization = (budget) => {
    const catId = budget.category_id || budget.categoryId;
    const { spent, start, end } = computeSpent(budget);

    const coreBudget = {
      id: budget.id,
      workspaceId: budget.workspace_id || budget.workspaceId,
      categoryId: catId,
      period: budget.period,
      amount: String(budget.amount),
      currency: budget.currency || 'USD',
      rolloverEnabled: Boolean(budget.rollover_enabled || budget.rolloverEnabled),
      rolloverAmount: String(budget.rollover_amount || budget.rolloverAmount || '0.00'),
      alertThreshold: Number(budget.alert_threshold || budget.alertThreshold || 85),
      startDate: budget.start_date || budget.startDate,
      endDate: budget.end_date || budget.endDate,
    };

    return { ...calculateBudgetUtilization(coreBudget, spent), periodStart: start, periodEnd: end };
  };

  // Budgets enriched with current-period spend (used by notifications & dashboards)
  const budgetsWithSpent = useMemo(
    () =>
      budgets.map((b) => ({
        ...b,
        name: b.name || b.categories?.name || b.category_name,
        spent: computeSpent(b).spent,
      })),
    [budgets, computeSpent]
  );

  return (
    <BudgetContext.Provider
      value={{
        budgets: budgetsWithSpent,
        loading,
        error,
        createBudget,
        updateBudget,
        deleteBudget,
        getUtilization,
        refreshBudgets: fetchBudgets,
      }}
    >
      {children}
    </BudgetContext.Provider>
  );
}

export function useBudgets() {
  const ctx = useContext(BudgetContext);
  if (!ctx) {
    throw new Error('useBudgets must be used within a BudgetProvider');
  }
  return ctx;
}
