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
