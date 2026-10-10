// Decimal-safe money helpers for the web app.
// All arithmetic goes through decimal.js (via @universal-expense/core) so we never
// accumulate binary floating-point errors. Convert to Number only for display/charts.
import { toDecimal } from '@universal-expense/core';

export function dec(value) {
  if (value === null || value === undefined || value === '') return toDecimal('0');
  try {
    return toDecimal(typeof value === 'string' ? value.trim() || '0' : String(value));
  } catch {
    return toDecimal('0');
  }
}

/** Sum a list of money values; returns a Decimal */
export function sumMoney(values) {
  return values.reduce((acc, v) => acc.plus(dec(v)), dec('0'));
}

/** Decimal -> plain number for UI components / charts (display only) */
export function toNum(value) {
  return dec(value).toNumber();
}

/** True for a positive, finite amount string/number */
export function isPositiveAmount(value) {
  try {
    const d = dec(value);
    return d.isFinite() && d.greaterThan(0);
  } catch {
    return false;
  }
}

/** Only these statuses move real balances */
export const POSTED_STATUSES = ['cleared', 'reconciled'];

export function isLiveTransaction(tx) {
  return tx && !tx.deleted_at && tx.status !== 'pending';
}

/**
 * Balance of one account from opening balance + posted ledger lines (account currency).
 * Assets: opening + in - out. Liabilities (amount owed): opening + out - in.
 */
export function computeAccountBalance(account, transactions = []) {
  let bal = dec(account?.opening_balance);
  const isAsset = (account?.nature || 'asset') === 'asset';
  for (const tx of transactions) {
    if (!isLiveTransaction(tx)) continue;
    for (const line of tx.lines || []) {
      const accId = line.account_id || line.accountId;
      if (accId !== account.id) continue;
      const amt = dec(line.amount);
      const isIn = line.direction === 'in';
      bal = isAsset === isIn ? bal.plus(amt) : bal.minus(amt);
    }
  }
  return bal;
}
