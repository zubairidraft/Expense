import { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';
import { useWorkspace } from './WorkspaceContext';
import { useTransactions } from './TransactionContext';
import {
  calculateTax,
  calculateProjectFinancials,
  calculateMemberSpendingBreakdown,
  roundMoney,
} from '@universal-expense/core';

const BusinessContext = createContext(null);

const DEFAULT_GUEST_PROJECTS = [
  {
    id: 'proj-1',
    name: 'Next-Gen Mobile App Overhaul',
    code: 'PRJ-MOB-01',
    client_id: null,
    budget: '7500.00',
    currency: 'USD',
    status: 'active',
    start_date: '2026-09-01',
    end_date: '2026-12-15',
    notes: 'Fixed-bid client project for Fintech mobile experience',
  },
  {
    id: 'proj-2',
    name: 'Brand Identity & Design System',
    code: 'PRJ-DS-02',
    client_id: null,
    budget: '4200.00',
    currency: 'USD',
    status: 'completed',
    start_date: '2026-08-01',
    end_date: '2026-09-30',
    notes: 'Completed multi-platform token design delivery',
  },
];

const DEFAULT_GUEST_COST_CENTERS = [
  {
    id: 'cc-1',
    name: 'Engineering & R&D',
    code: 'CC-ENG',
    description: 'Cloud hosting, SaaS development tools, hardware',
    active: true,
  },
  {
    id: 'cc-2',
    name: 'Marketing & Growth',
    code: 'CC-MKTG',
    description: 'Ad campaigns, sponsorship, visual assets',
    active: true,
  },
  {
    id: 'cc-3',
    name: 'General & Administrative',
    code: 'CC-GNA',
    description: 'Legal, office facilities, subscriptions',
    active: true,
  },
];

export function BusinessProvider({ children }) {
  const { user } = useAuth();
  const { currentWorkspace } = useWorkspace();
  const { transactions } = useTransactions();

  const [projects, setProjects] = useState(DEFAULT_GUEST_PROJECTS);
  const [costCenters, setCostCenters] = useState(DEFAULT_GUEST_COST_CENTERS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchData = useCallback(async () => {
    if (!currentWorkspace?.id || !user || currentWorkspace.id === 'guest-space') {
      setProjects(DEFAULT_GUEST_PROJECTS);
      setCostCenters(DEFAULT_GUEST_COST_CENTERS);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const [projRes, ccRes] = await Promise.all([
        supabase
          .from('projects')
          .select('*, client:contacts(name)')
          .eq('workspace_id', currentWorkspace.id)
          .order('created_at', { ascending: false }),
        supabase
          .from('cost_centers')
          .select('*')
          .eq('workspace_id', currentWorkspace.id)
          .order('name'),
      ]);

      if (projRes.error) throw projRes.error;
      if (ccRes.error) throw ccRes.error;

      setProjects(projRes.data || []);
      setCostCenters(ccRes.data || []);
    } catch (err) {
      console.error('Error fetching business modules data:', err);
      setError(err.message);
      setProjects([]);
      setCostCenters([]);
    } finally {
      setLoading(false);
    }
  }, [currentWorkspace?.id, user]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Derived financial summaries per project
  const projectSummaries = useMemo(() => {
    return projects.map((p) => {
      // Collect lines associated with project
      const lines = [];
      for (const tx of transactions) {
        if (tx.lines) {
          for (const l of tx.lines) {
            if (l.project_id === p.id) {
              lines.push(l);
            }
          }
        }
      }
      return calculateProjectFinancials(p, lines);
    });
  }, [projects, transactions]);

  // Derived member spending attribution for shared workspace
  const memberAttribution = useMemo(() => {
    const dummyMembers = [
      { id: user?.id || 'me', name: user?.email ? user.email.split('@')[0] : 'Workspace Owner' },
      { id: 'm-guest-2', name: 'Partner / Co-admin' },
    ];

    const lines = [];
    for (const tx of transactions) {
      if (tx.lines) {
        for (const l of tx.lines) {
          lines.push(l);
        }
      } else {
        // Fallback for flat tx
        lines.push({
          memberId: user?.id || 'me',
          amount: tx.amount,
          direction: tx.type === 'income' ? 'in' : 'out',
        });
      }
    }

    return calculateMemberSpendingBreakdown(dummyMembers, lines);
  }, [transactions, user]);

  const createProject = async (projectInput) => {
    const { name, code, clientId, budget, currency, status, startDate, endDate, notes } = projectInput;

    if (!currentWorkspace?.id || !user || currentWorkspace.id === 'guest-space') {
      const newProj = {
        id: `proj-${Date.now()}`,
        name,
        code: code || null,
        client_id: clientId || null,
        budget: budget ? roundMoney(budget) : null,
        currency: currency || 'USD',
        status: status || 'active',
        start_date: startDate || null,
        end_date: endDate || null,
        notes: notes || null,
      };
      setProjects((prev) => [newProj, ...prev]);
      return newProj;
    }

    const { data, error } = await supabase
      .from('projects')
      .insert({
        workspace_id: currentWorkspace.id,
        name,
        code: code || null,
        client_id: clientId || null,
        budget: budget ? roundMoney(budget) : null,
        currency: currency || 'USD',
        status: status || 'active',
        start_date: startDate || null,
        end_date: endDate || null,
        notes: notes || null,
      })
      .select('*, client:contacts(name)')
      .single();

    if (error) throw error;
    setProjects((prev) => [data, ...prev]);
    return data;
  };

  const createCostCenter = async (ccInput) => {
    const { name, code, description, active } = ccInput;

    if (!currentWorkspace?.id || !user || currentWorkspace.id === 'guest-space') {
      const newCC = {
        id: `cc-${Date.now()}`,
        name,
        code: code || null,
        description: description || null,
        active: active !== false,
      };
      setCostCenters((prev) => [newCC, ...prev]);
      return newCC;
    }

    const { data, error } = await supabase
      .from('cost_centers')
      .insert({
        workspace_id: currentWorkspace.id,
        name,
        code: code || null,
        description: description || null,
        active: active !== false,
      })
      .select()
      .single();

    if (error) throw error;
    setCostCenters((prev) => [data, ...prev]);
    return data;
  };

  const toggleCostCenter = async (ccId, currentStatus) => {
    const newStatus = !currentStatus;
    if (!currentWorkspace?.id || !user || currentWorkspace.id === 'guest-space') {
      setCostCenters((prev) =>
        prev.map((c) => (c.id === ccId ? { ...c, active: newStatus } : c))
      );
      return;
    }

    const { error } = await supabase
      .from('cost_centers')
      .update({ active: newStatus })
      .eq('id', ccId);
    if (error) throw error;
    fetchData();
  };

  const value = {
    projects,
    costCenters,
    projectSummaries,
    memberAttribution,
    loading,
    error,
    createProject,
    createCostCenter,
    toggleCostCenter,
    calculateTax: (amount, rate, isInclusive) => calculateTax(amount, rate, isInclusive),
    refresh: fetchData,
  };

  return <BusinessContext.Provider value={value}>{children}</BusinessContext.Provider>;
}

export function useBusiness() {
  const context = useContext(BusinessContext);
  if (!context) {
    throw new Error('useBusiness must be used within a BusinessProvider');
  }
  return context;
}
