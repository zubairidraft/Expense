import { z } from 'zod';

/**
 * Strict regex for numeric money strings:
 * Optional minus sign, digits, optional dot with up to 4 decimal places.
 * Disallows scientific notation (1e5) and NaN.
 */
export const MoneyStringSchema = z
  .string()
  .regex(/^-?\d+(\.\d{1,4})?$/, {
    message: 'Amount must be an exact numeric string with up to 4 decimal places (no floats/scientific notation)',
  });

export const PositiveMoneyStringSchema = z
  .string()
  .regex(/^\d+(\.\d{1,4})?$/, {
    message: 'Amount must be a positive numeric string with up to 4 decimal places',
  })
  .refine((val) => Number(val) > 0, {
    message: 'Amount must be greater than zero',
  });

export const FxRateStringSchema = z
  .string()
  .regex(/^\d+(\.\d{1,10})?$/, {
    message: 'FX Rate must be a positive numeric string with up to 10 decimal places',
  })
  .refine((val) => Number(val) > 0, {
    message: 'FX Rate must be greater than zero',
  });

export const DateStringSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'Date must follow YYYY-MM-DD format',
  });

export const WorkspaceCreateSchema = z.object({
  name: z.string().min(1, 'Workspace name is required').max(100),
  type: z.enum(['personal', 'household', 'business', 'custom']),
  baseCurrency: z.string().length(3).toUpperCase(),
  timezone: z.string().default('UTC'),
  monthStartDay: z.number().int().min(1).max(31).default(1),
  budgetingStyle: z.enum(['limit_based', 'envelope']).default('limit_based'),
});

export const AccountCreateSchema = z.object({
  name: z.string().min(1, 'Account name is required').max(100),
  type: z.enum([
    'bank',
    'cash',
    'card',
    'savings',
    'wallet',
    'e_wallet',
    'investment',
    'loan',
    'bnpl',
    'custom',
  ]),
  nature: z.enum(['asset', 'liability']),
  currency: z.string().length(3).toUpperCase(),
  openingBalance: MoneyStringSchema.default('0.00'),
  openingDate: DateStringSchema,
  creditLimit: MoneyStringSchema.optional(),
  visibility: z.enum(['shared', 'private']).default('shared'),
  ownerMemberId: z.string().uuid().optional(),
});

export const TransactionLineCreateSchema = z.object({
  accountId: z.string().uuid('Valid account UUID required'),
  categoryId: z.string().uuid().nullable().optional(),
  direction: z.enum(['in', 'out']),
  amount: PositiveMoneyStringSchema,
  currency: z.string().length(3).toUpperCase(),
  fxRate: FxRateStringSchema.default('1.0000000000'),
  baseAmount: PositiveMoneyStringSchema.optional(),
  projectId: z.string().uuid().nullable().optional(),
  costCenterId: z.string().uuid().nullable().optional(),
  memberId: z.string().uuid().nullable().optional(),
  billable: z.boolean().default(false),
  reimbursable: z.boolean().default(false),
  taxAmount: MoneyStringSchema.optional(),
});

export const TransactionCreateSchema = z.object({
  workspaceId: z.string().uuid('Valid workspace UUID required'),
  type: z.enum([
    'expense',
    'income',
    'transfer',
    'refund',
    'adjustment',
    'debt',
    'settlement',
    'opening',
  ]),
  date: DateStringSchema,
  status: z.enum(['pending', 'cleared', 'reconciled']).default('cleared'),
  merchantId: z.string().uuid().nullable().optional(),
  payeeContactId: z.string().uuid().nullable().optional(),
  notes: z.string().max(1000).nullable().optional(),
  idempotencyKey: z.string().min(16, 'Idempotency key must be at least 16 characters'),
  version: z.number().int().nonnegative().default(1),
  source: z.enum(['manual', 'recurring', 'import', 'sms', 'ai', 'ocr']).default('manual'),
  lines: z.array(TransactionLineCreateSchema).min(1, 'Transaction must contain at least one line'),
});

export type WorkspaceCreateInput = z.infer<typeof WorkspaceCreateSchema>;
export type AccountCreateInput = z.infer<typeof AccountCreateSchema>;
export type TransactionLineCreateInput = z.infer<typeof TransactionLineCreateSchema>;
export type TransactionCreateInput = z.infer<typeof TransactionCreateSchema>;

export const ProfileUpdateSchema = z.object({
  fullName: z.string().trim().min(1, 'Name cannot be empty').max(100).optional(),
  avatarUrl: z.string().url('Avatar must be a valid URL').or(z.literal('')).nullable().optional(),
  defaultCurrency: z.string().length(3, 'Currency code must be 3 letters').toUpperCase().optional(),
  locale: z.string().min(2).max(20).optional(),
  numberFormat: z.enum(['intl', 'lakh']).optional(),
  dateFormat: z.string().min(4).max(30).optional(),
  theme: z.enum(['dark', 'light', 'system']).optional(),
});

export type ProfileUpdateInput = z.infer<typeof ProfileUpdateSchema>;

export const WorkspaceUpdateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  type: z.enum(['personal', 'household', 'business', 'custom']).optional(),
  baseCurrency: z.string().length(3).toUpperCase().optional(),
  timezone: z.string().optional(),
  monthStartDay: z.number().int().min(1).max(31).optional(),
  budgetingStyle: z.enum(['limit_based', 'envelope']).optional(),
  archivedAt: z.string().nullable().optional(),
});

export const WorkspaceMemberInviteSchema = z.object({
  email: z.string().email('Valid email address required'),
  role: z.enum(['owner', 'admin', 'manager', 'member', 'viewer']).default('member'),
});

export type WorkspaceUpdateInput = z.infer<typeof WorkspaceUpdateSchema>;
export type WorkspaceMemberInviteInput = z.infer<typeof WorkspaceMemberInviteSchema>;

export const AccountUpdateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  type: z.enum([
    'bank',
    'cash',
    'card',
    'savings',
    'wallet',
    'e_wallet',
    'investment',
    'loan',
    'bnpl',
    'custom',
  ]).optional(),
  nature: z.enum(['asset', 'liability']).optional(),
  currency: z.string().length(3).toUpperCase().optional(),
  openingBalance: MoneyStringSchema.optional(),
  openingDate: DateStringSchema.optional(),
  creditLimit: MoneyStringSchema.nullable().optional(),
  visibility: z.enum(['shared', 'private']).optional(),
  ownerMemberId: z.string().uuid().nullable().optional(),
  icon: z.string().optional(),
  color: z.string().optional(),
  archivedAt: z.string().nullable().optional(),
});

export type AccountUpdateInput = z.infer<typeof AccountUpdateSchema>;

export const CategoryCreateSchema = z.object({
  name: z.string().min(1, 'Category name required').max(100),
  kind: z.enum(['income', 'expense']),
  isEssential: z.boolean().default(false),
  icon: z.string().default('📦'),
  color: z.string().default('#6366f1'),
  parentId: z.string().uuid().nullable().optional(),
});

export const CategoryUpdateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  kind: z.enum(['income', 'expense']).optional(),
  isEssential: z.boolean().optional(),
  icon: z.string().optional(),
  color: z.string().optional(),
  parentId: z.string().uuid().nullable().optional(),
  archivedAt: z.string().nullable().optional(),
});

export const TagCreateSchema = z.object({
  name: z.string().trim().min(1, 'Tag name required').max(50),
  color: z.string().default('#8b5cf6'),
});

export const MerchantCreateSchema = z.object({
  name: z.string().trim().min(1, 'Merchant name required').max(100),
  aliases: z.array(z.string()).default([]),
  defaultCategoryId: z.string().uuid().nullable().optional(),
  logoUrl: z.string().url().nullable().optional(),
});

export const RuleConditionSchema = z.object({
  field: z.enum(['payee_name', 'notes', 'amount', 'type']),
  operator: z.enum(['contains', 'equals', 'starts_with', 'ends_with', 'greater_than', 'less_than']),
  value: z.string(),
});

export const RuleActionSchema = z.object({
  type: z.enum(['set_category', 'set_account', 'add_tag', 'mark_cleared']),
  value: z.string(),
});

export const RuleCreateSchema = z.object({
  name: z.string().trim().min(1, 'Rule name required').max(100),
  priority: z.number().int().default(100),
  active: z.boolean().default(true),
  conditions: z.array(RuleConditionSchema).min(1, 'At least one condition required'),
  actions: z.array(RuleActionSchema).min(1, 'At least one action required'),
});

export const RuleUpdateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  priority: z.number().int().optional(),
  active: z.boolean().optional(),
  conditions: z.array(RuleConditionSchema).optional(),
  actions: z.array(RuleActionSchema).optional(),
});

export const ReconciliationCreateSchema = z.object({
  accountId: z.string().uuid(),
  statementDate: DateStringSchema,
  statementBalance: MoneyStringSchema,
  clearedBalance: MoneyStringSchema,
  transactionIds: z.array(z.string().uuid()).default([]),
});

export type CategoryCreateInput = z.infer<typeof CategoryCreateSchema>;
export type CategoryUpdateInput = z.infer<typeof CategoryUpdateSchema>;
export type TagCreateInput = z.infer<typeof TagCreateSchema>;
export type MerchantCreateInput = z.infer<typeof MerchantCreateSchema>;
export type RuleCreateInput = z.infer<typeof RuleCreateSchema>;
export type RuleUpdateInput = z.infer<typeof RuleUpdateSchema>;
export type ReconciliationCreateInput = z.infer<typeof ReconciliationCreateSchema>;

export const OcrExtractedDataSchema = z.object({
  merchantName: z.string().nullable().optional(),
  totalAmount: MoneyStringSchema.nullable().optional(),
  taxAmount: MoneyStringSchema.nullable().optional(),
  currency: z.string().length(3).toUpperCase().nullable().optional(),
  date: DateStringSchema.nullable().optional(),
  lineItems: z.array(z.object({
    description: z.string(),
    amount: MoneyStringSchema,
  })).optional(),
  confidence: z.number().min(0).max(1).optional(),
});

export const AttachmentCreateSchema = z.object({
  workspaceId: z.string().uuid(),
  transactionId: z.string().uuid().nullable().optional(),
  filePath: z.string().min(1),
  fileName: z.string().min(1),
  fileSize: z.number().int().positive(),
  mimeType: z.string().min(1),
  ocrStatus: z.enum(['pending', 'processing', 'completed', 'failed', 'none']).default('pending'),
  ocrRawText: z.string().nullable().optional(),
  ocrExtractedData: OcrExtractedDataSchema.optional(),
});

export type OcrExtractedDataInput = z.infer<typeof OcrExtractedDataSchema>;
export type AttachmentCreateInput = z.infer<typeof AttachmentCreateSchema>;

export const RecurringFrequencySchema = z.enum([
  'daily',
  'weekly',
  'biweekly',
  'monthly',
  'quarterly',
  'yearly',
]);

export const RecurringProfileCreateSchema = z.object({
  workspaceId: z.string().uuid(),
  title: z.string().trim().min(1, 'Title is required').max(100),
  type: z.enum(['expense', 'income', 'transfer']),
  frequency: RecurringFrequencySchema,
  interval: z.number().int().min(1).default(1),
  startDate: DateStringSchema,
  endDate: DateStringSchema.nullable().optional(),
  nextDueDate: DateStringSchema,
  amount: MoneyStringSchema,
  currency: z.string().length(3).toUpperCase().default('USD'),
  accountId: z.string().uuid().nullable().optional(),
  categoryId: z.string().uuid().nullable().optional(),
  autoPost: z.boolean().default(false),
  active: z.boolean().default(true),
  reminderDaysBefore: z.number().int().min(0).max(30).default(3),
  notes: z.string().nullable().optional(),
});

export const RecurringProfileUpdateSchema = z.object({
  title: z.string().trim().min(1).max(100).optional(),
  type: z.enum(['expense', 'income', 'transfer']).optional(),
  frequency: RecurringFrequencySchema.optional(),
  interval: z.number().int().min(1).optional(),
  startDate: DateStringSchema.optional(),
  endDate: DateStringSchema.nullable().optional(),
  nextDueDate: DateStringSchema.optional(),
  amount: MoneyStringSchema.optional(),
  currency: z.string().length(3).toUpperCase().optional(),
  accountId: z.string().uuid().nullable().optional(),
  categoryId: z.string().uuid().nullable().optional(),
  autoPost: z.boolean().optional(),
  active: z.boolean().optional(),
  reminderDaysBefore: z.number().int().min(0).max(30).optional(),
  notes: z.string().nullable().optional(),
});

export type RecurringProfileCreateInput = z.infer<typeof RecurringProfileCreateSchema>;
export type RecurringProfileUpdateInput = z.infer<typeof RecurringProfileUpdateSchema>;

export const BudgetPeriodSchema = z.enum(['monthly', 'weekly', 'quarterly', 'yearly']);

export const BudgetCreateSchema = z.object({
  workspaceId: z.string().uuid(),
  categoryId: z.string().uuid(),
  period: BudgetPeriodSchema.default('monthly'),
  amount: MoneyStringSchema,
  currency: z.string().length(3).toUpperCase().default('USD'),
  rolloverEnabled: z.boolean().default(false),
  rolloverAmount: MoneyStringSchema.default('0.00'),
  alertThreshold: z.number().int().min(10).max(100).default(85),
  startDate: DateStringSchema,
  endDate: DateStringSchema.nullable().optional(),
});

export const BudgetUpdateSchema = z.object({
  amount: MoneyStringSchema.optional(),
  period: BudgetPeriodSchema.optional(),
  currency: z.string().length(3).toUpperCase().optional(),
  rolloverEnabled: z.boolean().optional(),
  rolloverAmount: MoneyStringSchema.optional(),
  alertThreshold: z.number().int().min(10).max(100).optional(),
  startDate: DateStringSchema.optional(),
  endDate: DateStringSchema.nullable().optional(),
});

export type BudgetCreateInput = z.infer<typeof BudgetCreateSchema>;
export type BudgetUpdateInput = z.infer<typeof BudgetUpdateSchema>;

export const GoalTypeSchema = z.enum([
  'savings',
  'emergency_fund',
  'debt_payoff',
  'purchase',
  'investment',
]);

export const GoalStatusSchema = z.enum(['in_progress', 'completed', 'paused']);

export const GoalCreateSchema = z.object({
  workspaceId: z.string().uuid(),
  name: z.string().trim().min(1, 'Goal name required').max(100),
  targetAmount: MoneyStringSchema,
  currentAmount: MoneyStringSchema.default('0.00'),
  currency: z.string().length(3).toUpperCase().default('USD'),
  targetDate: DateStringSchema.nullable().optional(),
  type: GoalTypeSchema.default('savings'),
  linkedAccountId: z.string().uuid().nullable().optional(),
  icon: z.string().default('🎯'),
  color: z.string().default('#6366f1'),
  status: GoalStatusSchema.default('in_progress'),
});

export const GoalUpdateSchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  targetAmount: MoneyStringSchema.optional(),
  currentAmount: MoneyStringSchema.optional(),
  currency: z.string().length(3).toUpperCase().optional(),
  targetDate: DateStringSchema.nullable().optional(),
  type: GoalTypeSchema.optional(),
  linkedAccountId: z.string().uuid().nullable().optional(),
  icon: z.string().optional(),
  color: z.string().optional(),
  status: GoalStatusSchema.optional(),
});

export const GoalAllocationCreateSchema = z.object({
  goalId: z.string().uuid(),
  workspaceId: z.string().uuid(),
  transactionId: z.string().uuid().nullable().optional(),
  amount: MoneyStringSchema,
  currency: z.string().length(3).toUpperCase().default('USD'),
  notes: z.string().nullable().optional(),
});

export type GoalCreateInput = z.infer<typeof GoalCreateSchema>;
export type GoalUpdateInput = z.infer<typeof GoalUpdateSchema>;
export type GoalAllocationCreateInput = z.infer<typeof GoalAllocationCreateSchema>;





