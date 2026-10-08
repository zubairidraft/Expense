import Decimal from 'decimal.js';

export const STATIC_FALLBACK_RATES: Record<string, number> = {
  USD: 1.0,
  PKR: 278.50,
  AED: 3.6725,
  EUR: 0.9250,
  GBP: 0.7850,
  SAR: 3.7500,
  INR: 83.9000,
  CAD: 1.3600,
};

/**
 * Converts money from one currency to another using the provided rate.
 * Uses Decimal.js fixed-point arithmetic with half-even rounding.
 */
export function convertCurrency(
  amount: string | number,
  fromCurrency: string,
  toCurrency: string,
  rate: string | number,
  targetMinorUnits: number = 2
): string {
  if (fromCurrency.toUpperCase() === toCurrency.toUpperCase()) {
    return new Decimal(amount || 0).toFixed(targetMinorUnits);
  }

  const amt = new Decimal(amount || 0);
  const r = new Decimal(rate);

  if (r.isNegative() || r.isZero()) {
    throw new Error('Exchange rate must be strictly positive');
  }

  const converted = amt.times(r).toDecimalPlaces(targetMinorUnits, Decimal.ROUND_HALF_UP);
  return converted.toFixed(targetMinorUnits);
}

/**
 * Computes exact decimal inverse rate (1 / rate) with high precision (default 10 places).
 */
export function invertRate(rate: string | number, precision: number = 10): string {
  const r = new Decimal(rate);
  if (r.isNegative() || r.isZero()) {
    throw new Error('Exchange rate must be strictly positive');
  }
  return new Decimal(1).dividedBy(r).toDecimalPlaces(precision, Decimal.ROUND_HALF_UP).toFixed(precision);
}

/**
 * Calculates a cross rate between A and C given A->B and B->C (Triangular Arbitrage / Cross Rate).
 * rate(A->C) = rate(A->B) * rate(B->C)
 */
export function calculateTriangularRate(
  rateAB: string | number,
  rateBC: string | number,
  precision: number = 10
): string {
  const rab = new Decimal(rateAB);
  const rbc = new Decimal(rateBC);
  return rab.times(rbc).toDecimalPlaces(precision, Decimal.ROUND_HALF_UP).toFixed(precision);
}

/**
 * Returns the estimated conversion rate between two currencies using registered fallback rates.
 */
export function getEstimatedRate(
  fromCurrency: string,
  toCurrency: string,
  customRates: Record<string, number> = STATIC_FALLBACK_RATES
): string {
  const from = fromCurrency.toUpperCase();
  const to = toCurrency.toUpperCase();

  if (from === to) return '1.0000000000';

  const usdToFrom = customRates[from] ?? 1.0;
  const usdToTo = customRates[to] ?? 1.0;

  // Rate From -> To is (USD -> To) / (USD -> From)
  const rate = new Decimal(usdToTo).dividedBy(new Decimal(usdToFrom));
  return rate.toDecimalPlaces(10, Decimal.ROUND_HALF_UP).toFixed(10);
}
