import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';
import { useWorkspace } from './WorkspaceContext';
import { useTransactions } from './TransactionContext';
import { computeNextDueDate, generateCashFlowProjection } from '@universal-expense/core';
import { todayISO } from '../lib/dates';

const RecurringContext = createContext(null);

const DEFAULT_GUEST_RECURRING = [
  {
    id: 'rec-1',
    workspace_id: 'guest-space',
    title: 'Cloud VPS & Supabase Host',
    type: 'expense',
    frequency: 'monthly',
    interval: 1,
    start_date: '2026-10-01',
    next_due_date: '2026-11-01',
    amount: '45.00',
    currency: 'USD',
    auto_post: true,
    active: true,
    reminder_days_before: 3,
    notes: 'Monthly infrastructure payment',
  },
  {
    id: 'rec-2',
    workspace_id: 'guest-space',
    title: 'Office Internet Fiber',
    type: 'expense',
    frequency: 'monthly',
    interval: 1,
    start_date: '2026-10-05',
    next_due_date: '2026-10-25',
    amount: '75.00',
    currency: 'USD',
    auto_post: false,
    active: true,
    reminder_days_before: 5,
    notes: 'Broadband connection',
  },
  {
    id: 'rec-3',
    workspace_id: 'guest-space',
    title: 'Client Retainer Payment',
    type: 'income',
    frequency: 'monthly',
    interval: 1,
    start_date: '2026-10-01',
    next_due_date: '2026-11-01',
    amount: '3500.00',
    currency: 'USD',
    auto_post: false,
    active: true,
    reminder_days_before: 2,
    notes: 'Monthly design & engineering retainer',
  },
];

export function RecurringProvider({ children }) {
  const { user } = useAuth();
  const { currentWorkspace } = useWorkspace();
  const { balance, addTransaction } = useTransactions();

  const [recurringProfiles, setRecurringProfiles] = useState(DEFAULT_GUEST_RECURRING);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchRecurring = useCallback(async () => {
    if (!currentWorkspace?.id || !user || currentWorkspace.id === 'guest-space') {
      setRecurringProfiles(DEFAULT_GUEST_RECURRING);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const { data, error: fErr } = await supabase
        .from('recurring_profiles')
        .select('*')
        .eq('workspace_id', currentWorkspace.id)
        .order('next_due_date', { ascending: true });

      if (fErr) throw fErr;
      setRecurringProfiles(data || []);
    } catch (err) {
      console.warn('[RecurringContext] Fetch error:', err.message);
      setError(err.message);
      setRecurringProfiles([]);
    } finally {
      setLoading(false);
    }
  }, [currentWorkspace?.id, user]);

  useEffect(() => {
    fetchRecurring();
  }, [fetchRecurring]);

  // Create recurring profile
  const createRecurringProfile = async ({
    title,
    type = 'expense',
    frequency = 'monthly',
    interval = 1,
    startDate,
    endDate = null,
    nextDueDate,
    amount,
    currency,
    accountId = null,
    categoryId = null,
    autoPost = false,
    active = true,
    reminderDaysBefore = 3,
    notes = '',
  }) => {
    const isGuest = !user || currentWorkspace?.id === 'guest-space';
    const workspaceId = currentWorkspace?.id || 'guest-space';
    const curr = currency || currentWorkspace?.base_currency || 'USD';

    if (isGuest) {
      const newRec = {
        id: `rec-${Date.now()}`,
        workspace_id: workspaceId,
        title,
        type,
        frequency,
        interval: Number(interval),
        start_date: startDate || todayISO(),
        end_date: endDate,
        next_due_date: nextDueDate || startDate || todayISO(),
        amount: String(amount),
        currency: curr,
        account_id: accountId,
        category_id: categoryId,
        auto_post: autoPost,
        active,
        reminder_days_before: Number(reminderDaysBefore),
        notes,
      };
      setRecurringProfiles((prev) => [...prev, newRec]);
      return { data: newRec, error: null };
    }

    try {
      setError(null);
      const { data, error: insErr } = await supabase
        .from('recurring_profiles')
        .insert({
          workspace_id: workspaceId,
          title,
          type,
          frequency,
          interval: Number(interval),
          start_date: startDate,
          end_date: endDate,
          next_due_date: nextDueDate,
          amount: String(amount),
          currency: curr,
          account_id: accountId,
          category_id: categoryId,
          auto_post: autoPost,
          active,
          reminder_days_before: Number(reminderDaysBefore),
          notes,
        })
        .select()
        .single();

      if (insErr) throw insErr;
      await fetchRecurring();
      return { data, error: null };
    } catch (err) {
      setError(err.message);
      return { data: null, error: err };
    }
  };

  // Update profile
  const updateRecurringProfile = async (id, updates) => {
    const isGuest = !user || currentWorkspace?.id === 'guest-space';
    if (isGuest) {
      setRecurringProfiles((prev) =>
        prev.map((r) => (r.id === id ? { ...r, ...updates } : r))
      );
      return { error: null };
    }

    try {
      const { error: updErr } = await supabase
        .from('recurring_profiles')
        .update(updates)
        .eq('id', id);

      if (updErr) throw updErr;
      await fetchRecurring();
      return { error: null };
    } catch (err) {
      setError(err.message);
      return { error: err };
    }
  };

  // Delete profile
  const deleteRecurringProfile = async (id) => {
    const isGuest = !user || currentWorkspace?.id === 'guest-space';
    if (isGuest) {
      setRecurringProfiles((prev) => prev.filter((r) => r.id !== id));
      return { error: null };
    }

    try {
      const { error: delErr } = await supabase
        .from('recurring_profiles')
        .delete()
        .eq('id', id);

      if (delErr) throw delErr;
      await fetchRecurring();
      return { error: null };
    } catch (err) {
      setError(err.message);
      return { error: err };
    }
  };

  // Mark occurrence as paid / advance due date
  // Mark occurrence as paid / advance due date and book deduction
  const markAsPaid = async (profileId, selectedAccountId = null, paymentDate = null) => {
    const profile = recurringProfiles.find((r) => r.id === profileId);
    if (!profile) return { error: new Error('Profile not found') };

    const nextDue = computeNextDueDate(
      profile.next_due_date || profile.nextDueDate,
      profile.frequency,
      profile.interval || 1,
      profile.start_date ? Number(profile.start_date.slice(8, 10)) : undefined
    );

    const dueDate = profile.next_due_date || profile.nextDueDate;
    const targetAccountId = selectedAccountId || profile.account_id || profile.accountId;
    if (!targetAccountId) {
      return { error: new Error('Please choose the account this bill is paid from') };
    }

    // Book the occurrence. The idempotency key is per profile + due date, so a
    // double-click or retry can never post the same bill twice.
    const isIncome = profile.type === 'income';
    const lineAmt = String(profile.amount);
    const res = await addTransaction({
      type: isIncome ? 'income' : 'expense',
      date: paymentDate || todayISO(),
      payeeName: profile.title,
      notes: `Recurring payment for ${profile.title}`,
      status: 'cleared',
      source: 'recurring',
      idempotencyKey: `recurring-${profile.id}-${dueDate}`,
      lines: [
        {
          accountId: targetAccountId,
          categoryId: profile.category_id || profile.categoryId || null,
          direction: isIncome ? 'in' : 'out',
          amount: lineAmt,
          description: `Recurring payment for ${profile.title}`,
        },
      ],
    });
    if (res?.error) {
      return { error: res.error };
    }

    return await updateRecurringProfile(profileId, {
      next_due_date: nextDue,
    });
  };

  // Cash flow projection helper
  const getCashFlowProjection = (daysAhead = 30) => {
    const mapped = recurringProfiles.map((r) => ({
      id: r.id,
      workspaceId: r.workspace_id,
      title: r.title,
      type: r.type,
      frequency: r.frequency,
      interval: r.interval || 1,
      startDate: r.start_date,
      endDate: r.end_date,
      nextDueDate: r.next_due_date || r.nextDueDate,
      amount: String(r.amount),
      currency: r.currency || 'USD',
      accountId: r.account_id || r.accountId,
      categoryId: r.category_id || r.categoryId,
      autoPost: Boolean(r.auto_post),
      active: Boolean(r.active),
      reminderDaysBefore: r.reminder_days_before || 3,
    }));

    return generateCashFlowProjection(mapped, String(balance || '0'), daysAhead);
  };

  return (
    <RecurringContext.Provider
      value={{
        recurringProfiles,
        loading,
        error,
        createRecurringProfile,
        updateRecurringProfile,
        deleteRecurringProfile,
        markAsPaid,
        getCashFlowProjection,
        refreshRecurring: fetchRecurring,
      }}
    >
      {children}
    </RecurringContext.Provider>
  );
}

export function useRecurring() {
  const ctx = useContext(RecurringContext);
  if (!ctx) {
    throw new Error('useRecurring must be used within a RecurringProvider');
  }
  return ctx;
}
