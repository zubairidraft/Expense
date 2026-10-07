import Decimal from 'decimal.js';
import { addMoney, subtractMoney, roundMoney, toDecimal, getCurrencyMinorUnits } from '../money/index.js';
import type { LineDirection, AccountNature } from '../types/index.js';

export interface LedgerLineInput {
  accountId: string;
  direction: LineDirection;
  amount: string; // Positive numeric string
  currency: string;
}

/**
 * Calculates the balance for an Asset account:
 * Asset balance = opening_balance + Σ(lines in) − Σ(lines out)
 */
export function calculateAssetBalance(
  openingBalance: string,
  lines: Array<{ direction: LineDirection; amount: string }>,
  minorUnits: number = 2
): string {
  let total = toDecimal(openingBalance);

  for (const line of lines) {
    const amt = toDecimal(line.amount);
    if (amt.isNegative()) {
      throw new Error(`Ledger line amount must always be positive; got ${line.amount}`);
    }
    if (line.direction === 'in') {
      total = total.plus(amt);
    } else if (line.direction === 'out') {
      total = total.minus(amt);
    }
  }

  return roundMoney(total, minorUnits);
}

/**
 * Calculates the balance for a Liability account (credit card, loan, BNPL):
 * Balance means amount owed.
 * Spending on card (outward purchase charge) increases amount owed.
 * Payments/repayments (in-payment transfer) reduce amount owed.
 * Liability balance = opening_balance + Σ(charges) − Σ(payments/refunds)
 */
export function calculateLiabilityBalance(
  openingBalance: string,
  lines: Array<{ direction: LineDirection; amount: string }>,
  minorUnits: number = 2
): string {
  let owed = toDecimal(openingBalance);

  for (const line of lines) {
    const amt = toDecimal(line.amount);
    if (amt.isNegative()) {
      throw new Error(`Ledger line amount must always be positive; got ${line.amount}`);
    }
    // For a liability account:
    // 'out' represents charging/spending (increases liability owed)
    // 'in' represents payment received towards liability (decreases liability owed)
    if (line.direction === 'out') {
      owed = owed.plus(amt);
    } else if (line.direction === 'in') {
      owed = owed.minus(amt);
    }
  }

  return roundMoney(owed, minorUnits);
}

/**
 * Calculates account balance based on its nature (asset vs liability)
 */
export function calculateAccountBalance(
  nature: AccountNature,
  openingBalance: string,
  lines: Array<{ direction: LineDirection; amount: string }>,
  minorUnits: number = 2
): string {
  if (nature === 'asset') {
    return calculateAssetBalance(openingBalance, lines, minorUnits);
  } else {
    return calculateLiabilityBalance(openingBalance, lines, minorUnits);
  }
}

/**
 * Calculates Net Worth:
 * Net worth = Σ asset balances (in base currency) − Σ liability balances (in base currency)
 */
export function calculateNetWorth(
  assetBalancesInBase: string[],
  liabilityBalancesInBase: string[],
  minorUnits: number = 2
): string {
  let totalAssets = new Decimal(0);
  for (const bal of assetBalancesInBase) {
    totalAssets = totalAssets.plus(toDecimal(bal));
  }

  let totalLiabilities = new Decimal(0);
  for (const bal of liabilityBalancesInBase) {
    totalLiabilities = totalLiabilities.plus(toDecimal(bal));
  }

  const netWorth = totalAssets.minus(totalLiabilities);
  return roundMoney(netWorth, minorUnits);
}

/**
 * Validates a Transfer transaction:
 * - A transfer has an 'out' line on source and an 'in' line on destination.
 * - Source account ≠ Destination account.
 * - Optional 3rd line: transfer fee booked as an expense (category: Bank Fees).
 */
export function validateTransfer(
  sourceAccountId: string,
  destAccountId: string,
  lines: LedgerLineInput[]
): { valid: boolean; reason?: string } {
  if (sourceAccountId === destAccountId) {
    return { valid: false, reason: 'Source and destination accounts must be different' };
  }

  const sourceLine = lines.find((l) => l.accountId === sourceAccountId && l.direction === 'out');
  const destLine = lines.find((l) => l.accountId === destAccountId && l.direction === 'in');

  if (!sourceLine) {
    return { valid: false, reason: 'Missing out line on source account' };
  }

  if (!destLine) {
    return { valid: false, reason: 'Missing in line on destination account' };
  }

  // Any remaining line must be a transfer fee line
  const otherLines = lines.filter((l) => l !== sourceLine && l !== destLine);
  for (const extra of otherLines) {
    if (extra.direction !== 'out') {
      return { valid: false, reason: 'Additional transfer line (fee) must have direction out' };
    }
  }

  return { valid: true };
}

/**
 * Validates a Split transaction:
 * Sum of split line amounts must equal the transaction header total.
 */
export function validateSplit(
  headerTotal: string,
  lineAmounts: string[],
  minorUnits: number = 2
): { valid: boolean; difference: string } {
  let sum = new Decimal(0);
  for (const amt of lineAmounts) {
    sum = sum.plus(toDecimal(amt));
  }

  const expected = toDecimal(headerTotal);
  const diff = sum.minus(expected);

  const roundedDiff = roundMoney(diff, minorUnits);
  const isZero = new Decimal(roundedDiff).isZero();

  return {
    valid: isZero,
    difference: roundedDiff,
  };
}
