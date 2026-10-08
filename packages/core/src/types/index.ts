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

export type NumberFormat = 'intl' | 'lakh';

export type ThemePreference = 'dark' | 'light' | 'system';

export interface UserProfile {
  id: string;
  fullName: string;
  avatarUrl?: string | null;
  defaultCurrency: string;
  locale: string;
  numberFormat: NumberFormat;
  dateFormat: string;
  theme: ThemePreference;
  createdAt?: string;
  updatedAt?: string;
}

export type MemberStatus = 'active' | 'invited' | 'suspended';

export interface Workspace {
  id: string;
  name: string;
  type: WorkspaceType;
  baseCurrency: string;
  ownerId: string;
  timezone: string;
  monthStartDay: number;
  budgetingStyle: 'limit_based' | 'envelope';
  archivedAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface WorkspaceMember {
  id: string;
  workspaceId: string;
  userId: string;
  role: WorkspaceRole;
  status: MemberStatus;
  joinedAt?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface Account {
  id: string;
  workspaceId: string;
  name: string;
  type: AccountType;
  nature: AccountNature;
  currency: string;
  openingBalance: string;
  openingDate: string;
  creditLimit?: string | null;
  visibility: AccountVisibility;
  ownerMemberId?: string | null;
  icon?: string;
  color?: string;
  archivedAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export type CategoryKind = 'income' | 'expense';

export interface Category {
  id: string;
  workspaceId?: string | null;
  parentId?: string | null;
  name: string;
  kind: CategoryKind;
  isEssential: boolean;
  icon: string;
  color: string;
  systemKey?: string | null;
  archivedAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface Tag {
  id: string;
  workspaceId: string;
  name: string;
  color: string;
  createdAt?: string;
}

export interface Merchant {
  id: string;
  workspaceId: string;
  name: string;
  aliases: string[];
  defaultCategoryId?: string | null;
  logoUrl?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export type RuleField = 'payee_name' | 'notes' | 'amount' | 'type';
export type RuleOperator = 'contains' | 'equals' | 'starts_with' | 'ends_with' | 'greater_than' | 'less_than';
export type RuleActionType = 'set_category' | 'set_account' | 'add_tag' | 'mark_cleared';

export interface RuleCondition {
  field: RuleField;
  operator: RuleOperator;
  value: string;
}

export interface RuleAction {
  type: RuleActionType;
  value: string;
}

export interface Rule {
  id: string;
  workspaceId: string;
  name: string;
  priority: number;
  active: boolean;
  conditions: RuleCondition[];
  actions: RuleAction[];
  createdAt?: string;
  updatedAt?: string;
}

export interface StatementReconciliation {
  id: string;
  workspaceId: string;
  accountId: string;
  statementDate: string;
  statementBalance: string;
  clearedBalance: string;
  difference: string;
  status: 'in_progress' | 'completed';
  reconciledTransactionIds: string[];
  reconciledBy?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export type OcrStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'none';

export interface OcrExtractedData {
  merchantName?: string | null;
  totalAmount?: string | null;
  taxAmount?: string | null;
  currency?: string | null;
  date?: string | null;
  lineItems?: Array<{ description: string; amount: string }>;
  confidence?: number;
}

export interface Attachment {
  id: string;
  workspaceId: string;
  transactionId?: string | null;
  filePath: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  ocrStatus: OcrStatus;
  ocrRawText?: string | null;
  ocrExtractedData: OcrExtractedData;
  uploadedBy?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface DraftTransactionFromReceipt {
  type: TransactionType;
  date: string;
  merchantName?: string | null;
  totalAmount: string;
  currency: string;
  taxAmount?: string | null;
  notes?: string | null;
  attachmentId?: string | null;
  status: 'draft';
  confidence: number;
}

export type RecurringFrequency =
  | 'daily'
  | 'weekly'
  | 'biweekly'
  | 'monthly'
  | 'quarterly'
  | 'yearly';

export interface RecurringProfile {
  id: string;
  workspaceId: string;
  title: string;
  type: TransactionType;
  frequency: RecurringFrequency;
  interval: number;
  startDate: string;
  endDate?: string | null;
  nextDueDate: string;
  amount: string;
  currency: string;
  accountId?: string | null;
  categoryId?: string | null;
  autoPost: boolean;
  active: boolean;
  reminderDaysBefore: number;
  notes?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface CashFlowProjectedOccurrence {
  profileId: string;
  title: string;
  type: TransactionType;
  date: string;
  amount: string;
  currency: string;
  accountId?: string | null;
}

export interface CashFlowProjectionSummary {
  daysAhead: number;
  startingBalance: string;
  projectedInflow: string;
  projectedOutflow: string;
  projectedEndingBalance: string;
  occurrences: CashFlowProjectedOccurrence[];
  hasLowBalanceWarning: boolean;
  lowestProjectedBalance: string;
}

export type BudgetPeriod = 'monthly' | 'weekly' | 'quarterly' | 'yearly';

export interface Budget {
  id: string;
  workspaceId: string;
  categoryId: string;
  period: BudgetPeriod;
  amount: string;
  currency: string;
  rolloverEnabled: boolean;
  rolloverAmount: string;
  alertThreshold: number;
  startDate: string;
  endDate?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface BudgetUtilization {
  budgetId: string;
  categoryId: string;
  budgetedAmount: string;
  effectiveLimit: string;
  spentAmount: string;
  remainingAmount: string;
  percentageUsed: number;
  isWarning: boolean;
  isExceeded: boolean;
  currency: string;
}

export type GoalType = 'savings' | 'emergency_fund' | 'debt_payoff' | 'purchase' | 'investment';
export type GoalStatus = 'in_progress' | 'completed' | 'paused';

export interface Goal {
  id: string;
  workspaceId: string;
  name: string;
  targetAmount: string;
  currentAmount: string;
  currency: string;
  targetDate?: string | null;
  type: GoalType;
  linkedAccountId?: string | null;
  icon: string;
  color: string;
  status: GoalStatus;
  createdAt?: string;
  updatedAt?: string;
}

export interface GoalProgressSummary {
  goalId: string;
  targetAmount: string;
  currentAmount: string;
  remainingAmount: string;
  percentage: number;
  isCompleted: boolean;
  monthlyContributionNeeded?: string | null;
}
export type SplitMethod = 'equal' | 'exact' | 'percent' | 'shares';
export type DebtDirection = 'lent' | 'borrowed';
export type DebtStatus = 'active' | 'partially_settled' | 'settled' | 'written_off';
export type InstallmentFrequency = 'weekly' | 'biweekly' | 'monthly' | 'quarterly';
export type InstallmentStatus = 'active' | 'completed' | 'defaulted';
export type ProjectStatus = 'active' | 'on_hold' | 'completed' | 'archived';

export interface Contact {
  id: string;
  workspaceId: string;
  name: string;
  phone?: string | null;
  email?: string | null;
  avatarUrl?: string | null;
  linkedUserId?: string | null;
  notes?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface SharedExpense {
  id: string;
  workspaceId: string;
  transactionId?: string | null;
  title: string;
  totalAmount: string;
  currency: string;
  splitMethod: SplitMethod;
  payerContactId?: string | null;
  notes?: string | null;
  splits?: SharedExpenseSplit[];
  createdAt?: string;
  updatedAt?: string;
}

export interface SharedExpenseSplit {
  id: string;
  sharedExpenseId: string;
  workspaceId: string;
  contactId: string;
  shareAmount: string;
  sharePercentage?: number | null;
  sharesCount?: number | null;
  paidAmount: string;
  settled: boolean;
  createdAt?: string;
}

export interface Debt {
  id: string;
  workspaceId: string;
  contactId: string;
  direction: DebtDirection;
  principal: string;
  remainingAmount: string;
  currency: string;
  dueDate?: string | null;
  status: DebtStatus;
  notes?: string | null;
  contact?: Contact;
  createdAt?: string;
  updatedAt?: string;
}

export interface DebtEvent {
  id: string;
  debtId: string;
  workspaceId: string;
  transactionId?: string | null;
  eventType: 'disburse' | 'repayment' | 'forgive';
  amount: string;
  paymentDate: string;
  notes?: string | null;
  createdAt?: string;
}

export interface InstallmentPlan {
  id: string;
  workspaceId: string;
  name: string;
  liabilityAccountId?: string | null;
  totalAmount: string;
  principalAmount: string;
  interestOrFee: string;
  currency: string;
  totalInstallments: number;
  paidInstallments: number;
  installmentAmount: string;
  frequency: InstallmentFrequency;
  startDate: string;
  nextDueDate?: string | null;
  status: InstallmentStatus;
  notes?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface InstallmentSchedule {
  id: string;
  planId: string;
  installmentNumber: number;
  dueDate: string;
  amount: string;
  paidAmount: string;
  status: 'pending' | 'paid' | 'overdue';
  transactionId?: string | null;
  paidAt?: string | null;
  createdAt?: string;
}

export interface SimplifiedDebtSettlement {
  fromContactId: string;
  toContactId: string;
  amount: string;
}

export interface Project {
  id: string;
  workspaceId: string;
  name: string;
  code?: string | null;
  clientId?: string | null;
  budget?: string | null;
  currency: string;
  status: ProjectStatus;
  startDate?: string | null;
  endDate?: string | null;
  notes?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface CostCenter {
  id: string;
  workspaceId: string;
  name: string;
  code?: string | null;
  description?: string | null;
  active: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface ProjectFinancialSummary {
  projectId: string;
  projectName: string;
  projectCode?: string | null;
  budget?: string | null;
  currency: string;
  status: ProjectStatus;
  totalRevenue: string;
  totalExpense: string;
  totalBillableExpense: string;
  totalReimbursableExpense: string;
  totalTaxAmount: string;
  netProfit: string;
  budgetBurnPercent?: number;
}

export interface TaxCalculationResult {
  subtotal: string;
  taxAmount: string;
  total: string;
  ratePercent: number;
  isInclusive: boolean;
}

