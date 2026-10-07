/**
 * Universal Expense Tracker Core Types
 * Pure TypeScript definitions, framework-free
 */

export type WorkspaceType = 'personal' | 'household' | 'business' | 'custom';

export type WorkspaceRole = 'owner' | 'admin' | 'manager' | 'member' | 'viewer';

export type Resource =
  | 'workspace'
  | 'workspace_members'
  | 'accounts'
  | 'transactions'
  | 'categories'
  | 'budgets'
  | 'goals'
  | 'recurring_series'
  | 'contacts'
  | 'shared_expenses'
  | 'debts'
  | 'installment_plans'
  | 'rules'
  | 'attachments'
  | 'reports'
  | 'audit_logs';

export type Action =
  | 'create'
  | 'read'
  | 'update'
  | 'delete'
  | 'manage_members'
  | 'invite'
  | 'reconcile'
  | 'export'
  | 'manage_billing';

export type AccountNature = 'asset' | 'liability';

export type AccountType =
  | 'bank'
  | 'cash'
  | 'card'
  | 'savings'
  | 'wallet'
  | 'e_wallet'
  | 'investment'
  | 'loan'
  | 'bnpl'
  | 'custom';

export type AccountVisibility = 'shared' | 'private';

export type TransactionType =
  | 'expense'
  | 'income'
  | 'transfer'
  | 'refund'
  | 'adjustment'
  | 'debt'
  | 'settlement'
  | 'opening';

export type TransactionStatus = 'pending' | 'cleared' | 'reconciled';

export type TransactionSource =
  | 'manual'
  | 'recurring'
  | 'import'
  | 'sms'
  | 'ai'
  | 'ocr';

export type LineDirection = 'in' | 'out';

export interface CurrencyInfo {
  code: string;
  minorUnits: number;
  symbol: string;
  name: string;
  active: boolean;
}

export interface TransactionLine {
  id?: string;
  transactionId?: string;
  accountId: string;
  categoryId?: string | null;
  direction: LineDirection;
  amount: string; // Stored as numeric string, never float
  currency: string;
  fxRate?: string; // numeric string e.g. "1.0000000000"
  baseAmount?: string;
  projectId?: string | null;
  costCenterId?: string | null;
  memberId?: string | null;
  billable?: boolean;
  reimbursable?: boolean;
  taxAmount?: string;
}

export interface TransactionHeader {
  id?: string;
  workspaceId: string;
  type: TransactionType;
  date: string; // YYYY-MM-DD DATE in workspace timezone
  status: TransactionStatus;
  merchantId?: string | null;
  payeeContactId?: string | null;
  notes?: string | null;
  idempotencyKey: string;
  version: number;
  source: TransactionSource;
  lines: TransactionLine[];
}
