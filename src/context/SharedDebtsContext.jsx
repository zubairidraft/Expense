import { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';
import { useWorkspace } from './WorkspaceContext';
import { useTransactions } from './TransactionContext';
import { useAccounts } from './AccountContext';
import {
  simplifyDebts,
  generateInstallmentSchedule,
  roundMoney,
} from '@universal-expense/core';
import { todayISO } from '../lib/dates';

const SharedDebtsContext = createContext(null);

const DEFAULT_GUEST_CONTACTS = [
  {
    id: 'c-1',
    name: 'Alice Johnson',
    phone: '+1 555-0192',
    email: 'alice@example.com',
    notes: 'Roommate & coworker',
  },
  {
    id: 'c-2',
    name: 'Bob Martinez',
    phone: '+1 555-0284',
    email: 'bob@example.com',
    notes: 'Travel companion',
  },
  {
    id: 'c-3',
    name: 'Charlie Khan',
    phone: '+92 300-1234567',
    email: 'charlie@example.com',
    notes: 'Cousin (Udhaar)',
  },
];

const DEFAULT_GUEST_SHARED_EXPENSES = [
  {
    id: 'se-1',
    title: 'High-speed Fiber Internet & Cloud Router',
    total_amount: '120.00',
    currency: 'USD',
    split_method: 'equal',
    payer_contact_id: null, // Paid by user
    notes: 'Split 3 ways equally with roommates',
    created_at: '2026-10-01',
    splits: [
      { id: 'sp-1', contact_id: 'c-1', share_amount: '40.00', paid_amount: '40.00', settled: true },
      { id: 'sp-2', contact_id: 'c-2', share_amount: '40.00', paid_amount: '0.00', settled: false },
    ],
  },
  {
    id: 'se-2',
    title: 'Weekend Group AirBnB Getaway',
    total_amount: '350.00',
    currency: 'USD',
    split_method: 'shares',
    payer_contact_id: 'c-1', // Paid by Alice
    notes: 'Alice paid front costs; Bob took master bedroom (2 shares)',
    created_at: '2026-10-05',
    splits: [
      { id: 'sp-3', contact_id: 'c-1', share_amount: '87.50', paid_amount: '87.50', settled: true },
      { id: 'sp-4', contact_id: 'c-2', share_amount: '175.00', paid_amount: '0.00', settled: false },
    ],
  },
];

const DEFAULT_GUEST_DEBTS = [
  {
    id: 'd-1',
    contact_id: 'c-3',
    direction: 'lent',
    principal: '500.00',
    remaining_amount: '200.00',
    currency: 'USD',
    due_date: '2026-11-15',
    status: 'partially_settled',
    notes: 'Urgent emergency cash advance (Udhaar)',
    contact: { name: 'Charlie Khan' },
  },
  {
    id: 'd-2',
    contact_id: 'c-2',
    direction: 'borrowed',
    principal: '150.00',
    remaining_amount: '150.00',
    currency: 'USD',
    due_date: '2026-10-25',
    status: 'active',
    notes: 'Borrowed for concert ticket pre-sale',
    contact: { name: 'Bob Martinez' },
  },
];

const DEFAULT_GUEST_INSTALLMENTS = [
  {
    id: 'ip-1',
    name: 'MacBook Pro M4 Max (12-Mo Apple BNPL)',
    total_amount: '2400.00',
    principal_amount: '2400.00',
    interest_or_fee: '0.00',
    currency: 'USD',
    total_installments: 12,
    paid_installments: 3,
    installment_amount: '200.00',
    frequency: 'monthly',
    start_date: '2026-07-01',
    next_due_date: '2026-11-01',
    status: 'active',
    notes: '0% APR promo installment plan',
  },
  {
    id: 'ip-2',
    name: 'Ergonomic Standing Desk & Chair (Tabby / Tamara)',
    total_amount: '600.00',
    principal_amount: '600.00',
    interest_or_fee: '0.00',
    currency: 'USD',
    total_installments: 4,
    paid_installments: 2,
    installment_amount: '150.00',
    frequency: 'monthly',
    start_date: '2026-08-15',
    next_due_date: '2026-10-15',
    status: 'active',
    notes: 'Split into 4 monthly payments',
  },
];

export function SharedDebtsProvider({ children }) {
  const { user } = useAuth();
  const { currentWorkspace } = useWorkspace();
  const { addTransaction, refreshTransactions } = useTransactions() || {};
  const { accounts = [], refreshAccounts } = useAccounts() || {};

  const [contacts, setContacts] = useState(DEFAULT_GUEST_CONTACTS);
  const [sharedExpenses, setSharedExpenses] = useState(DEFAULT_GUEST_SHARED_EXPENSES);
  const [debts, setDebts] = useState(DEFAULT_GUEST_DEBTS);
  const [installmentPlans, setInstallmentPlans] = useState(DEFAULT_GUEST_INSTALLMENTS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchData = useCallback(async () => {
    if (!currentWorkspace?.id || !user || currentWorkspace.id === 'guest-space') {
      setContacts(DEFAULT_GUEST_CONTACTS);
      setSharedExpenses(DEFAULT_GUEST_SHARED_EXPENSES);
      setDebts(DEFAULT_GUEST_DEBTS);
      setInstallmentPlans(DEFAULT_GUEST_INSTALLMENTS);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Fetch contacts
      const { data: contactsData, error: contactsErr } = await supabase
        .from('contacts')
        .select('*')
        .eq('workspace_id', currentWorkspace.id)
        .order('name');
      if (contactsErr) throw contactsErr;

      // Fetch shared expenses with splits
      const { data: sharedData, error: sharedErr } = await supabase
        .from('shared_expenses')
        .select('*, splits:shared_expense_splits(*)')
        .eq('workspace_id', currentWorkspace.id)
        .order('created_at', { ascending: false });
      if (sharedErr) throw sharedErr;

      // Fetch debts with contact info
      const { data: debtsData, error: debtsErr } = await supabase
        .from('debts')
        .select('*, contact:contacts(name, phone, email)')
        .eq('workspace_id', currentWorkspace.id)
        .order('created_at', { ascending: false });
      if (debtsErr) throw debtsErr;

      // Fetch installment plans
      const { data: installData, error: installErr } = await supabase
        .from('installment_plans')
        .select('*')
        .eq('workspace_id', currentWorkspace.id)
        .order('created_at', { ascending: false });
      if (installErr) throw installErr;

      setContacts(contactsData || []);
      setSharedExpenses(sharedData || []);
      setDebts(debtsData || []);
      setInstallmentPlans(installData || []);
    } catch (err) {
      console.error('Error fetching Stage D data:', err);
      setError(err.message);
      setContacts([]);
      setSharedExpenses([]);
      setDebts([]);
      setInstallmentPlans([]);
    } finally {
      setLoading(false);
    }
  }, [currentWorkspace?.id, user]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Derived Settle-Up Simplification Board
  const simplifiedSettlements = useMemo(() => {
    // Build net balance map across all participants
    // Positive = someone owes me/the group; Negative = I/group owe them
    const netBalances = {};

    // 1. Incorporate shared expenses
    for (const exp of sharedExpenses) {
      const payerId = exp.payer_contact_id || 'me';
      const splits = exp.splits || [];

      for (const split of splits) {
        if (split.settled) continue;
        const debtorId = split.contact_id;
        const amount = parseFloat(split.shareAmount || split.share_amount || 0);

        if (debtorId && debtorId !== payerId) {
          // Debtor owes amount -> negative
          netBalances[debtorId] = (netBalances[debtorId] || 0) - amount;
          // Payer is owed amount -> positive
          netBalances[payerId] = (netBalances[payerId] || 0) + amount;
        }
      }
    }

    // 2. Incorporate direct debts
    for (const d of debts) {
      if (d.status === 'settled' || d.status === 'written_off') continue;
      const rem = parseFloat(d.remaining_amount || d.remainingAmount || 0);
      if (rem <= 0) continue;

      if (d.direction === 'lent') {
        // I lent to contact: contact owes 'me'
        netBalances[d.contact_id] = (netBalances[d.contact_id] || 0) - rem;
        netBalances['me'] = (netBalances['me'] || 0) + rem;
      } else {
        // I borrowed from contact: 'me' owes contact
        netBalances['me'] = (netBalances['me'] || 0) - rem;
        netBalances[d.contact_id] = (netBalances[d.contact_id] || 0) + rem;
      }
    }

    const balancesRecord = {};
    for (const [k, v] of Object.entries(netBalances)) {
      balancesRecord[k] = v.toFixed(2);
    }

    return simplifyDebts(balancesRecord);
  }, [sharedExpenses, debts]);

  // Actions
  const createContact = async (contactInput) => {
    if (!currentWorkspace?.id || !user || currentWorkspace.id === 'guest-space') {
      const newContact = {
        id: `c-${Date.now()}`,
        ...contactInput,
      };
      setContacts((prev) => [newContact, ...prev]);
      return newContact;
    }

    const { data, error } = await supabase
      .from('contacts')
      .insert({
        workspace_id: currentWorkspace.id,
        name: contactInput.name,
        phone: contactInput.phone || null,
        email: contactInput.email || null,
        avatar_url: contactInput.avatarUrl || null,
        notes: contactInput.notes || null,
      })
      .select()
      .single();

    if (error) throw error;
    setContacts((prev) => [data, ...prev]);
    return data;
  };

  const createSharedExpense = async (expenseInput) => {
    const { title, totalAmount, currency, splitMethod, payerContactId, notes, splits } = expenseInput;

    if (!currentWorkspace?.id || !user || currentWorkspace.id === 'guest-space') {
      const newExpense = {
        id: `se-${Date.now()}`,
        title,
        total_amount: roundMoney(String(totalAmount ?? '0'), 2),
        currency: currency || 'USD',
        split_method: splitMethod,
        payer_contact_id: payerContactId || null,
        notes: notes || null,
        created_at: new Date().toISOString(),
        splits: splits.map((s, idx) => ({
          id: `sp-${Date.now()}-${idx}`,
          contact_id: s.contactId,
          share_amount: roundMoney(String(s.shareAmount ?? '0'), 2),
          paid_amount: '0.00',
          settled: false,
        })),
      };
      setSharedExpenses((prev) => [newExpense, ...prev]);
      return newExpense;
    }

    const { data: expData, error: expErr } = await supabase
      .from('shared_expenses')
      .insert({
        workspace_id: currentWorkspace.id,
        title,
        total_amount: roundMoney(String(totalAmount ?? '0'), 2),
        currency: currency || 'USD',
        split_method: splitMethod,
        payer_contact_id: payerContactId || null,
        notes: notes || null,
      })
      .select()
      .single();

    if (expErr) throw expErr;

    const splitsToInsert = splits.map((s) => ({
      shared_expense_id: expData.id,
      workspace_id: currentWorkspace.id,
      contact_id: s.contactId,
      share_amount: roundMoney(String(s.shareAmount ?? '0'), 2),
      share_percentage: s.sharePercentage || null,
      shares_count: s.sharesCount || null,
      paid_amount: 0,
      settled: false,
    }));

    const { data: splitRows, error: splitErr } = await supabase
      .from('shared_expense_splits')
      .insert(splitsToInsert)
      .select();

    if (splitErr) throw splitErr;

    const completeExp = { ...expData, splits: splitRows };
    setSharedExpenses((prev) => [completeExp, ...prev]);
    return completeExp;
  };

  const settleExpenseSplit = async (splitId) => {
    if (!currentWorkspace?.id || !user || currentWorkspace.id === 'guest-space') {
      setSharedExpenses((prev) =>
        prev.map((exp) => ({
          ...exp,
          splits: (exp.splits || []).map((s) =>
            s.id === splitId ? { ...s, settled: true, paid_amount: s.share_amount } : s
          ),
        }))
      );
      return;
    }

    const { error } = await supabase
      .from('shared_expense_splits')
      .update({ settled: true })
      .eq('id', splitId);
    if (error) throw error;
    fetchData();
  };

  const createDebt = async (debtInput) => {
    const { contactId, direction, principal, currency, dueDate, notes, accountId } = debtInput;
    const rounded = roundMoney(String(principal ?? '0'), 2);
    const contactObj = contacts.find((c) => c.id === contactId);

    // Cash movement for the loan itself (type 'debt' -> never counted as income/expense)
    let disburseTxId = null;
    if (accountId && addTransaction) {
      const acc = accounts.find((a) => a.id === accountId);
      if (acc && currency && acc.currency !== currency) {
        throw new Error(`Account currency (${acc.currency}) must match the loan currency (${currency})`);
      }
      const isBorrowed = direction === 'borrowed';
      const res = await addTransaction({
        type: 'debt',
        date: todayISO(),
        payeeName: isBorrowed
          ? `Loan received from ${contactObj?.name || 'Contact'}`
          : `Loan given to ${contactObj?.name || 'Contact'}`,
        notes: notes || '',
        status: 'cleared',
        lines: [
          {
            accountId,
            categoryId: null,
            direction: isBorrowed ? 'in' : 'out',
            amount: String(rounded),
            description: isBorrowed ? 'Loan proceeds' : 'Loan disbursement',
          },
        ],
      });
      if (res?.error) throw res.error;
      disburseTxId = typeof res?.data === 'string' ? res.data : null;
    }

    if (!currentWorkspace?.id || !user || currentWorkspace.id === 'guest-space') {
      const newDebt = {
        id: `d-${Date.now()}`,
        contact_id: contactId,
        direction,
        principal: rounded,
        remaining_amount: rounded,
        currency: currency || 'USD',
        due_date: dueDate || null,
        status: 'active',
        notes: notes || null,
        contact: contactObj ? { name: contactObj.name } : { name: 'Contact' },
      };
      setDebts((prev) => [newDebt, ...prev]);
      return newDebt;
    }

    const { data, error } = await supabase
      .from('debts')
      .insert({
        workspace_id: currentWorkspace.id,
        contact_id: contactId,
        direction,
        principal: rounded,
        remaining_amount: rounded,
        currency: currency || 'USD',
        due_date: dueDate || null,
        notes: notes || null,
        status: 'active',
      })
      .select('*, contact:contacts(name, phone, email)')
      .single();

    if (error) throw error;

    // Audit trail: disbursement event linked to the ledger transaction
    await supabase.from('debt_events').insert({
      debt_id: data.id,
      workspace_id: currentWorkspace.id,
      transaction_id: disburseTxId,
      event_type: 'disburse',
      amount: rounded,
      payment_date: todayISO(),
      notes: notes || null,
    });

    setDebts((prev) => [data, ...prev]);
    return data;
  };

  const recordDebtPayment = async ({ debtId, amount, eventType, paymentDate, notes, accountId }) => {
    const targetDebt = debts.find((d) => d.id === debtId);
    if (!targetDebt) throw new Error('Debt not found');
    const payAmt = roundMoney(String(amount ?? '0'), 2);
    if (parseFloat(payAmt) <= 0) throw new Error('Amount must be greater than zero');
    if (parseFloat(payAmt) > parseFloat(targetDebt.remaining_amount || 0)) {
      throw new Error('Payment is more than the remaining balance');
    }

    if (!currentWorkspace?.id || !user || currentWorkspace.id === 'guest-space') {
      if (accountId && (eventType || 'repayment') === 'repayment' && addTransaction) {
        const isRepayingBorrowed = targetDebt.direction === 'borrowed';
        const res = await addTransaction({
          type: 'debt',
          date: paymentDate || todayISO(),
          payeeName: isRepayingBorrowed
            ? `Loan repayment to ${targetDebt.contact?.name || 'Contact'}`
            : `Loan recovery from ${targetDebt.contact?.name || 'Contact'}`,
          notes: notes || '',
          status: 'cleared',
          lines: [
            {
              accountId,
              categoryId: null,
              direction: isRepayingBorrowed ? 'out' : 'in',
              amount: payAmt,
              currency: targetDebt.currency || 'USD',
              description: 'Debt repayment',
            },
          ],
        });
        if (res?.error) throw res.error;
      }
      setDebts((prev) =>
        prev.map((d) => {
          if (d.id !== debtId) return d;
          const newRem = Math.max(0, parseFloat(d.remaining_amount || 0) - parseFloat(payAmt));
          return {
            ...d,
            remaining_amount: newRem.toFixed(2),
            status: newRem === 0 ? (eventType === 'forgive' ? 'written_off' : 'settled') : 'partially_settled',
          };
        })
      );
      return;
    }

    // One atomic server call: ledger line (if account) + debt update + event
    const { data, error } = await supabase.rpc('record_debt_payment', {
      p_debt_id: debtId,
      p_amount: payAmt,
      p_event_type: eventType || 'repayment',
      p_notes: notes || null,
      p_payment_date: paymentDate || todayISO(),
      p_account_id: (eventType || 'repayment') === 'repayment' ? accountId || null : null,
      p_idempotency_key: `debt-${debtId}-${Date.now()}`,
    });

    if (error) throw error;
    await fetchData();
    if (refreshTransactions) refreshTransactions();
    if (refreshAccounts) refreshAccounts();
    return data;
  };

  const createInstallmentPlan = async (planInput) => {
    const { name, principalAmount, interestOrFee, currency, totalInstallments, frequency, startDate, notes } = planInput;
    const total = (parseFloat(principalAmount) + parseFloat(interestOrFee || 0)).toFixed(2);
    const installmentAmt = (parseFloat(total) / totalInstallments).toFixed(2);

    if (!currentWorkspace?.id || !user || currentWorkspace.id === 'guest-space') {
      const newPlan = {
        id: `ip-${Date.now()}`,
        name,
        principal_amount: roundMoney(String(principalAmount ?? '0'), 2),
        interest_or_fee: roundMoney(String(interestOrFee || '0.00'), 2),
        total_amount: total,
        currency: currency || 'USD',
        total_installments: totalInstallments,
        paid_installments: 0,
        installment_amount: installmentAmt,
        frequency: frequency || 'monthly',
        start_date: startDate,
        next_due_date: startDate,
        status: 'active',
        notes: notes || null,
      };
      setInstallmentPlans((prev) => [newPlan, ...prev]);
      return newPlan;
    }

    const { data: planData, error: planErr } = await supabase
      .from('installment_plans')
      .insert({
        workspace_id: currentWorkspace.id,
        name,
        principal_amount: roundMoney(String(principalAmount ?? '0'), 2),
        interest_or_fee: roundMoney(String(interestOrFee || '0.00'), 2),
        total_amount: total,
        currency: currency || 'USD',
        total_installments: totalInstallments,
        paid_installments: 0,
        installment_amount: installmentAmt,
        frequency: frequency || 'monthly',
        start_date: startDate,
        next_due_date: startDate,
        status: 'active',
        notes: notes || null,
      })
      .select()
      .single();

    if (planErr) throw planErr;

    // Generate schedules
    const schedules = generateInstallmentSchedule(
      principalAmount,
      totalInstallments,
      frequency,
      startDate,
      interestOrFee
    );

    const scheduleRows = schedules.map((s) => ({
      plan_id: planData.id,
      installment_number: s.installmentNumber,
      due_date: s.dueDate,
      amount: s.amount,
      paid_amount: 0,
      status: 'pending',
    }));

    const { error: schedInsErr } = await supabase.from('installment_schedules').insert(scheduleRows);
    if (schedInsErr) {
      await supabase.from('installment_plans').delete().eq('id', planData.id);
      throw schedInsErr;
    }

    setInstallmentPlans((prev) => [planData, ...prev]);
    return planData;
  };

  const payInstallment = async (planId, fromAccountId = null) => {
    if (!currentWorkspace?.id || !user || currentWorkspace.id === 'guest-space') {
      setInstallmentPlans((prev) =>
        prev.map((p) => {
          if (p.id === planId) {
            const nextPaid = p.paid_installments + 1;
            return {
              ...p,
              paid_installments: nextPaid,
              status: nextPaid >= p.total_installments ? 'completed' : 'active',
            };
          }
          return p;
        })
      );
      return;
    }

    // Find first pending schedule
    const { data: sched, error: schedErr } = await supabase
      .from('installment_schedules')
      .select('id, amount')
      .eq('plan_id', planId)
      .eq('status', 'pending')
      .order('due_date', { ascending: true })
      .limit(1)
      .single();

    if (schedErr) throw schedErr;

    const { data, error } = await supabase.rpc('pay_installment_schedule', {
      p_schedule_id: sched.id,
      p_amount: sched.amount,
      p_from_account_id: fromAccountId || null,
      p_idempotency_key: `installment-${sched.id}`,
    });

    if (error) throw error;
    await fetchData();
    if (fromAccountId) {
      if (refreshTransactions) refreshTransactions();
      if (refreshAccounts) refreshAccounts();
    }
    return data;
  };

  const value = {
    contacts,
    sharedExpenses,
    debts,
    installmentPlans,
    simplifiedSettlements,
    loading,
    error,
    createContact,
    createSharedExpense,
    settleExpenseSplit,
    createDebt,
    recordDebtPayment,
    createInstallmentPlan,
    payInstallment,
    refresh: fetchData,
  };

  return <SharedDebtsContext.Provider value={value}>{children}</SharedDebtsContext.Provider>;
}

export function useSharedDebts() {
  const context = useContext(SharedDebtsContext);
  if (!context) {
    throw new Error('useSharedDebts must be used within a SharedDebtsProvider');
  }
  return context;
}
