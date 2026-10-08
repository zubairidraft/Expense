import { Decimal } from 'decimal.js';

export const NISAB_STANDARDS = {
  GOLD_GRAMS: new Decimal('87.48'), // 7.5 tola
  SILVER_GRAMS: new Decimal('612.36'), // 52.5 tola
  ZAKAT_RATE: new Decimal('0.025'), // 2.5% = 1/40th
};

export interface ZakatableAssets {
  cashInHand?: number | string;
  bankBalances?: number | string;
  goldValue?: number | string;
  silverValue?: number | string;
  investmentsAndCrypto?: number | string;
  businessInventory?: number | string;
  loanReceivables?: number | string; // Udhaar money lent that is expected to be recovered
}

export interface ZakatableLiabilities {
  immediateDebtsDue?: number | string; // Debts owed that must be paid right now
  dueBillsAndExpenses?: number | string; // Due utilities, rent, or supplier bills
}

export interface ZakatCalculationInput {
  assets: ZakatableAssets;
  liabilities: ZakatableLiabilities;
  nisabThreshold: number | string; // E.g. silver value or gold value
  currency?: string;
}

export interface ZakatCalculationResult {
  totalAssets: string;
  totalLiabilities: string;
  netZakatableWealth: string;
  nisabThreshold: string;
  isNisabExceeded: boolean;
  zakatRate: string; // e.g. "2.5%"
  zakatPayable: string;
  breakdown: Record<string, string>;
}

/**
 * Computes Nisab threshold given per-gram prices of precious metals.
 * Silver standard is classically recommended as it benefits more beneficiaries.
 */
export function computeNisabValue(
  pricePerGram: number | string,
  metal: 'silver' | 'gold' = 'silver'
): string {
  const price = new Decimal(pricePerGram || 0);
  const grams = metal === 'gold' ? NISAB_STANDARDS.GOLD_GRAMS : NISAB_STANDARDS.SILVER_GRAMS;
  return price.times(grams).toFixed(2);
}

/**
 * Pure financial Zakat calculator abiding by Islamic jurisprudence.
 * All computations run in Decimal.js precision with zero floating point errors.
 */
export function calculateZakat(input: ZakatCalculationInput): ZakatCalculationResult {
  const cash = new Decimal(input.assets.cashInHand || 0);
  const bank = new Decimal(input.assets.bankBalances || 0);
  const gold = new Decimal(input.assets.goldValue || 0);
  const silver = new Decimal(input.assets.silverValue || 0);
  const invest = new Decimal(input.assets.investmentsAndCrypto || 0);
  const inventory = new Decimal(input.assets.businessInventory || 0);
  const loans = new Decimal(input.assets.loanReceivables || 0);

  const totalAssets = cash
    .plus(bank)
    .plus(gold)
    .plus(silver)
    .plus(invest)
    .plus(inventory)
    .plus(loans);

  const debts = new Decimal(input.liabilities.immediateDebtsDue || 0);
  const bills = new Decimal(input.liabilities.dueBillsAndExpenses || 0);
  const totalLiabilities = debts.plus(bills);

  const netZakatableWealth = Decimal.max(0, totalAssets.minus(totalLiabilities));
  const nisab = new Decimal(input.nisabThreshold || 0);

  const isNisabExceeded = netZakatableWealth.gte(nisab) && nisab.gt(0);

  const zakatPayable = isNisabExceeded
    ? netZakatableWealth.times(NISAB_STANDARDS.ZAKAT_RATE).toFixed(2)
    : '0.00';

  return {
    totalAssets: totalAssets.toFixed(2),
    totalLiabilities: totalLiabilities.toFixed(2),
    netZakatableWealth: netZakatableWealth.toFixed(2),
    nisabThreshold: nisab.toFixed(2),
    isNisabExceeded,
    zakatRate: '2.5%',
    zakatPayable,
    breakdown: {
      cashInHand: cash.toFixed(2),
      bankBalances: bank.toFixed(2),
      goldValue: gold.toFixed(2),
      silverValue: silver.toFixed(2),
      investmentsAndCrypto: invest.toFixed(2),
      businessInventory: inventory.toFixed(2),
      loanReceivables: loans.toFixed(2),
      debtsDue: debts.toFixed(2),
      billsDue: bills.toFixed(2),
    },
  };
}
