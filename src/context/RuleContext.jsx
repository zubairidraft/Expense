import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';
import { useWorkspace } from './WorkspaceContext';
import { useTransactions } from './TransactionContext';
import { useAccounts } from './AccountContext';
import { evaluateRules } from '@universal-expense/core';

const RuleContext = createContext(null);

const DEFAULT_GUEST_RULES = [
  {
    id: 'rule-1',
    workspace_id: 'guest-space',
    name: 'Carrefour & Supermarket -> Groceries',
    priority: 10,
    active: true,
    conditions: [
      { field: 'payee_name', operator: 'contains', value: 'Carrefour' },
    ],
    actions: [
      { type: 'set_category', value: 'cat-groceries' },
      { type: 'mark_cleared', value: 'true' },
    ],
  },
  {
    id: 'rule-2',
    workspace_id: 'guest-space',
    name: 'AWS & Cloud Hosting -> Software Tools',
    priority: 20,
    active: true,
    conditions: [
      { field: 'payee_name', operator: 'contains', value: 'Amazon' },
    ],
    actions: [
      { type: 'set_category', value: 'cat-software' },
      { type: 'add_tag', value: 'tag-1' },
    ],
  },
  {
    id: 'rule-3',
    workspace_id: 'guest-space',
    name: 'Uber & Taxi -> Transport',
    priority: 30,
    active: true,
    conditions: [
      { field: 'payee_name', operator: 'contains', value: 'Uber' },
    ],
    actions: [
      { type: 'set_category', value: 'cat-transport' },
    ],
  },
];

export function RuleProvider({ children }) {
  const { user } = useAuth();
  const { currentWorkspace } = useWorkspace();
  const { refreshTransactions } = useTransactions();
  const { refreshAccounts } = useAccounts();

  const [rules, setRules] = useState(DEFAULT_GUEST_RULES);
  const [reconciliations, setReconciliations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchRules = useCallback(async () => {
    if (!currentWorkspace?.id || !user || currentWorkspace.id === 'guest-space') {
      setRules(DEFAULT_GUEST_RULES);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const { data, error: rErr } = await supabase
        .from('rules')
        .select('*')
        .eq('workspace_id', currentWorkspace.id)
        .order('priority', { ascending: true });

      if (rErr) throw rErr;

      setRules(data || []);

      // Fetch past reconciliations
      const { data: recData } = await supabase
        .from('reconciliations')
        .select('*')
        .eq('workspace_id', currentWorkspace.id)
        .order('statement_date', { ascending: false });

      setReconciliations(recData || []);
    } catch (err) {
      console.warn('[RuleContext] Error fetching rules:', err.message);
      setError(err.message);
      setRules([]);
      setReconciliations([]);
    } finally {
      setLoading(false);
    }
  }, [currentWorkspace?.id, user]);

  useEffect(() => {
    fetchRules();
  }, [fetchRules]);

  // Create auto-categorization rule
  const createRule = async ({
    name,
    priority = 100,
    active = true,
    conditions = [],
    actions = [],
  }) => {
    if (!user || currentWorkspace?.id === 'guest-space') {
      const newRule = {
        id: `rule-${Date.now()}`,
        workspace_id: currentWorkspace?.id || 'guest-space',
        name,
        priority: Number(priority),
        active,
        conditions,
        actions,
      };
      setRules((prev) => [...prev, newRule]);
      return { data: newRule, error: null };
    }

    try {
      setError(null);
      const { data, error: insertErr } = await supabase
        .from('rules')
        .insert({
          workspace_id: currentWorkspace.id,
          name,
          priority: Number(priority),
          active,
          conditions,
          actions,
        })
        .select()
        .single();

      if (insertErr) throw insertErr;
      await fetchRules();
      return { data, error: null };
    } catch (err) {
      setError(err.message);
      return { data: null, error: err };
    }
  };

  // Toggle or update rule
  const updateRule = async (ruleId, updates) => {
    if (!user || currentWorkspace?.id === 'guest-space') {
      setRules((prev) =>
        prev.map((r) => (r.id === ruleId ? { ...r, ...updates } : r))
      );
      return { error: null };
    }

    try {
      const { error: updErr } = await supabase
        .from('rules')
        .update(updates)
        .eq('id', ruleId);

      if (updErr) throw updErr;
      await fetchRules();
      return { error: null };
    } catch (err) {
      setError(err.message);
      return { error: err };
    }
  };

  // Delete rule
  const deleteRule = async (ruleId) => {
    if (!user || currentWorkspace?.id === 'guest-space') {
      setRules((prev) => prev.filter((r) => r.id !== ruleId));
      return { error: null };
    }

    try {
      const { error: delErr } = await supabase
        .from('rules')
        .delete()
        .eq('id', ruleId);

      if (delErr) throw delErr;
      await fetchRules();
      return { error: null };
    } catch (err) {
      setError(err.message);
      return { error: err };
    }
  };

  // Complete a bank statement reconciliation
  const completeReconciliation = async ({
    accountId,
    statementDate,
    statementBalance,
    clearedBalance,
    transactionIds,
  }) => {
    if (!user || currentWorkspace?.id === 'guest-space') {
      const recRecord = {
        id: `rec-${Date.now()}`,
        workspace_id: currentWorkspace?.id || 'guest-space',
        account_id: accountId,
        statement_date: statementDate,
        statement_balance: String(statementBalance),
        cleared_balance: String(clearedBalance),
        difference: '0.00',
        status: 'completed',
        reconciled_transaction_ids: transactionIds,
        created_at: new Date().toISOString(),
      };
      setReconciliations((prev) => [recRecord, ...prev]);
      return { data: recRecord, error: null };
    }

    try {
      setError(null);
      const { data: recId, error: rpcErr } = await supabase.rpc(
        'complete_statement_reconciliation',
        {
          p_workspace_id: currentWorkspace.id,
          p_account_id: accountId,
          p_statement_date: statementDate,
          p_statement_balance: statementBalance,
          p_cleared_balance: clearedBalance,
          p_transaction_ids: transactionIds,
        }
      );

      if (rpcErr) throw rpcErr;

      await fetchRules();
      if (refreshTransactions) await refreshTransactions();
      if (refreshAccounts) await refreshAccounts();

      return { data: recId, error: null };
    } catch (err) {
      console.error('[RuleContext] Reconciliation error:', err);
      setError(err.message);
      return { data: null, error: err };
    }
  };

  // Run rules against a candidate transaction
  const applyRulesToCandidate = (candidateTx) => {
    return evaluateRules(rules, candidateTx);
  };

  return (
    <RuleContext.Provider
      value={{
        rules,
        reconciliations,
        loading,
        error,
        createRule,
        updateRule,
        deleteRule,
        completeReconciliation,
        applyRulesToCandidate,
        refreshRules: fetchRules,
      }}
    >
      {children}
    </RuleContext.Provider>
  );
}

export function useRules() {
  const ctx = useContext(RuleContext);
  if (!ctx) {
    throw new Error('useRules must be used within a RuleProvider');
  }
  return ctx;
}
