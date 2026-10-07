import type { WorkspaceRole, Resource, Action } from '../types/index.js';

/**
 * Permission Matrix: role x action x resource
 */
export const PERMISSION_MATRIX: Record<WorkspaceRole, Partial<Record<Resource, Action[]>>> = {
  owner: {
    workspace: ['create', 'read', 'update', 'delete', 'manage_members', 'invite', 'export', 'manage_billing'],
    workspace_members: ['create', 'read', 'update', 'delete', 'manage_members', 'invite'],
    accounts: ['create', 'read', 'update', 'delete', 'reconcile', 'export'],
    transactions: ['create', 'read', 'update', 'delete', 'reconcile', 'export'],
    categories: ['create', 'read', 'update', 'delete'],
    budgets: ['create', 'read', 'update', 'delete'],
    goals: ['create', 'read', 'update', 'delete'],
    recurring_series: ['create', 'read', 'update', 'delete'],
    contacts: ['create', 'read', 'update', 'delete'],
    shared_expenses: ['create', 'read', 'update', 'delete'],
    debts: ['create', 'read', 'update', 'delete'],
    installment_plans: ['create', 'read', 'update', 'delete'],
    rules: ['create', 'read', 'update', 'delete'],
    attachments: ['create', 'read', 'update', 'delete'],
    reports: ['read', 'export'],
    audit_logs: ['read', 'export'],
  },
  admin: {
    workspace: ['read', 'update', 'manage_members', 'invite', 'export'],
    workspace_members: ['read', 'create', 'update', 'delete', 'invite'],
    accounts: ['create', 'read', 'update', 'delete', 'reconcile', 'export'],
    transactions: ['create', 'read', 'update', 'delete', 'reconcile', 'export'],
    categories: ['create', 'read', 'update', 'delete'],
    budgets: ['create', 'read', 'update', 'delete'],
    goals: ['create', 'read', 'update', 'delete'],
    recurring_series: ['create', 'read', 'update', 'delete'],
    contacts: ['create', 'read', 'update', 'delete'],
    shared_expenses: ['create', 'read', 'update', 'delete'],
    debts: ['create', 'read', 'update', 'delete'],
    installment_plans: ['create', 'read', 'update', 'delete'],
    rules: ['create', 'read', 'update', 'delete'],
    attachments: ['create', 'read', 'update', 'delete'],
    reports: ['read', 'export'],
    audit_logs: ['read'],
  },
  manager: {
    workspace: ['read'],
    workspace_members: ['read'],
    accounts: ['read', 'create', 'update', 'reconcile'],
    transactions: ['create', 'read', 'update', 'delete', 'reconcile', 'export'],
    categories: ['read', 'create', 'update'],
    budgets: ['read', 'create', 'update'],
    goals: ['read', 'create', 'update'],
    recurring_series: ['create', 'read', 'update'],
    contacts: ['create', 'read', 'update'],
    shared_expenses: ['create', 'read', 'update'],
    debts: ['create', 'read', 'update'],
    installment_plans: ['create', 'read', 'update'],
    rules: ['read', 'create', 'update'],
    attachments: ['create', 'read', 'update'],
    reports: ['read', 'export'],
    audit_logs: [],
  },
  member: {
    workspace: ['read'],
    workspace_members: ['read'],
    accounts: ['read'], // Note: Private accounts have additional owner_member_id checks
    transactions: ['create', 'read', 'update', 'delete'],
    categories: ['read'],
    budgets: ['read'],
    goals: ['read'],
    recurring_series: ['read', 'create'],
    contacts: ['read', 'create'],
    shared_expenses: ['read', 'create', 'update'],
    debts: ['read', 'create', 'update'],
    installment_plans: ['read'],
    rules: ['read'],
    attachments: ['create', 'read'],
    reports: ['read'],
    audit_logs: [],
  },
  viewer: {
    workspace: ['read'],
    workspace_members: ['read'],
    accounts: ['read'],
    transactions: ['read'],
    categories: ['read'],
    budgets: ['read'],
    goals: ['read'],
    recurring_series: ['read'],
    contacts: ['read'],
    shared_expenses: ['read'],
    debts: ['read'],
    installment_plans: ['read'],
    rules: ['read'],
    attachments: ['read'],
    reports: ['read'],
    audit_logs: [],
  },
};

/**
 * Checks whether a given workspace role has permission to perform an action on a resource.
 */
export function hasPermission(role: WorkspaceRole, resource: Resource, action: Action): boolean {
  const rolePermissions = PERMISSION_MATRIX[role];
  if (!rolePermissions) return false;

  const resourceActions = rolePermissions[resource];
  if (!resourceActions) return false;

  return resourceActions.includes(action);
}
