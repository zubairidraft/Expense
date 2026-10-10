import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';
import { useWorkspace } from './WorkspaceContext';
import { calculateGoalProgress, addMoney, roundMoney } from '@universal-expense/core';

const GoalContext = createContext(null);

const DEFAULT_GUEST_GOALS = [
  {
    id: 'g-1',
    workspace_id: 'guest-space',
    name: 'Emergency Reserve Fund (6 Months)',
    target_amount: '15000.00',
    current_amount: '7500.00',
    currency: 'USD',
    target_date: '2027-06-30',
    type: 'emergency_fund',
    icon: '🛡️',
    color: '#10b981',
    status: 'in_progress',
  },
  {
    id: 'g-2',
    workspace_id: 'guest-space',
    name: 'New Workstation Setup (M4 Max)',
    target_amount: '3800.00',
    current_amount: '2200.00',
    currency: 'USD',
    target_date: '2026-12-31',
    type: 'purchase',
    icon: '💻',
    color: '#6366f1',
    status: 'in_progress',
  },
  {
    id: 'g-3',
    workspace_id: 'guest-space',
    name: 'Hajj & Umrah Pilgrimage',
    target_amount: '6000.00',
    current_amount: '3600.00',
    currency: 'USD',
    target_date: '2027-05-15',
    type: 'savings',
    icon: '🕋',
    color: '#14b8a6',
    status: 'in_progress',
  },
];

export function GoalProvider({ children }) {
  const { user } = useAuth();
  const { currentWorkspace } = useWorkspace();

  const [goals, setGoals] = useState(DEFAULT_GUEST_GOALS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchGoals = useCallback(async () => {
    if (!currentWorkspace?.id || !user || currentWorkspace.id === 'guest-space') {
      setGoals(DEFAULT_GUEST_GOALS);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const { data, error: gErr } = await supabase
        .from('goals')
        .select('*')
        .eq('workspace_id', currentWorkspace.id)
        .order('created_at', { ascending: false });

      if (gErr) throw gErr;
      setGoals(data || []);
    } catch (err) {
      console.warn('[GoalContext] Fetch error:', err.message);
      setError(err.message);
      setGoals([]);
    } finally {
      setLoading(false);
    }
  }, [currentWorkspace?.id, user]);

  useEffect(() => {
    fetchGoals();
  }, [fetchGoals]);

  // Create Goal
  const createGoal = async ({
    name,
    targetAmount,
    currentAmount = '0.00',
    currency,
    targetDate = null,
    type = 'savings',
    linkedAccountId = null,
    icon = '🎯',
    color = '#6366f1',
  }) => {
    const isGuest = !user || currentWorkspace?.id === 'guest-space';
    const workspaceId = currentWorkspace?.id || 'guest-space';
    const curr = currency || currentWorkspace?.base_currency || 'USD';

    if (isGuest) {
      const newGoal = {
        id: `g-${Date.now()}`,
        workspace_id: workspaceId,
        name,
        target_amount: String(targetAmount),
        current_amount: String(currentAmount),
        currency: curr,
        target_date: targetDate,
        type,
        linked_account_id: linkedAccountId,
        icon,
        color,
        status: 'in_progress',
      };
      setGoals((prev) => [newGoal, ...prev]);
      return { data: newGoal, error: null };
    }

    try {
      setError(null);
      const { data, error: insErr } = await supabase
        .from('goals')
        .insert({
          workspace_id: workspaceId,
          name,
          target_amount: String(targetAmount),
          current_amount: String(currentAmount),
          currency: curr,
          target_date: targetDate,
          type,
          linked_account_id: linkedAccountId,
          icon,
          color,
          status: 'in_progress',
        })
        .select()
        .single();

      if (insErr) throw insErr;
      await fetchGoals();
      return { data, error: null };
    } catch (err) {
      setError(err.message);
      return { data: null, error: err };
    }
  };

  // Update Goal
  const updateGoal = async (id, updates) => {
    const isGuest = !user || currentWorkspace?.id === 'guest-space';
    if (isGuest) {
      setGoals((prev) =>
        prev.map((g) => (g.id === id ? { ...g, ...updates } : g))
      );
      return { error: null };
    }

    try {
      const { error: updErr } = await supabase
        .from('goals')
        .update(updates)
        .eq('id', id);

      if (updErr) throw updErr;
      await fetchGoals();
      return { error: null };
    } catch (err) {
      setError(err.message);
      return { error: err };
    }
  };

  // Delete Goal
  const deleteGoal = async (id) => {
    const isGuest = !user || currentWorkspace?.id === 'guest-space';
    if (isGuest) {
      setGoals((prev) => prev.filter((g) => g.id !== id));
      return { error: null };
    }

    try {
      const { error: delErr } = await supabase
        .from('goals')
        .delete()
        .eq('id', id);

      if (delErr) throw delErr;
      await fetchGoals();
      return { error: null };
    } catch (err) {
      setError(err.message);
      return { error: err };
    }
  };

  // Allocate funds to a goal
  const allocateFunds = async (goalId, allocationAmount, notes = '') => {
    const goal = goals.find((g) => g.id === goalId);
    if (!goal) return { error: new Error('Goal not found') };

    const newCurrent = roundMoney(
      addMoney(goal.current_amount || '0', String(allocationAmount)),
      2
    );

    const isComplete = parseFloat(newCurrent) >= parseFloat(goal.target_amount);

    const isGuest = !user || currentWorkspace?.id === 'guest-space';

    if (isGuest) {
      setGoals((prev) =>
        prev.map((g) =>
          g.id === goalId
            ? {
                ...g,
                current_amount: newCurrent,
                status: isComplete ? 'completed' : g.status,
              }
            : g
        )
      );
      return { error: null };
    }

    try {
      // Record allocation entry
      const { data: alloc, error: allocErr } = await supabase
        .from('goal_allocations')
        .insert({
          goal_id: goalId,
          workspace_id: currentWorkspace.id,
          amount: String(allocationAmount),
          currency: goal.currency,
          notes,
        })
        .select('id')
        .single();
      if (allocErr) throw allocErr;

      // Update goal current amount; roll back the allocation if this fails
      const { error: updErr } = await supabase
        .from('goals')
        .update({
          current_amount: newCurrent,
          status: isComplete ? 'completed' : goal.status,
        })
        .eq('id', goalId);
      if (updErr) {
        await supabase.from('goal_allocations').delete().eq('id', alloc.id);
        throw updErr;
      }

      await fetchGoals();
      return { error: null };
    } catch (err) {
      setError(err.message);
      return { error: err };
    }
  };

  // Progress calculator helper
  const getGoalProgress = (goal) => {
    const coreGoal = {
      id: goal.id,
      workspaceId: goal.workspace_id || goal.workspaceId,
      name: goal.name,
      targetAmount: String(goal.target_amount || goal.targetAmount),
      currentAmount: String(goal.current_amount || goal.currentAmount),
      currency: goal.currency || 'USD',
      targetDate: goal.target_date || goal.targetDate,
      type: goal.type,
      linkedAccountId: goal.linked_account_id || goal.linkedAccountId,
      icon: goal.icon || '🎯',
      color: goal.color || '#6366f1',
      status: goal.status,
    };

    return calculateGoalProgress(coreGoal);
  };

  return (
    <GoalContext.Provider
      value={{
        goals,
        loading,
        error,
        createGoal,
        updateGoal,
        deleteGoal,
        allocateFunds,
        getGoalProgress,
        refreshGoals: fetchGoals,
      }}
    >
      {children}
    </GoalContext.Provider>
  );
}

export function useGoals() {
  const ctx = useContext(GoalContext);
  if (!ctx) {
    throw new Error('useGoals must be used within a GoalProvider');
  }
  return ctx;
}
