import { Decimal } from 'decimal.js';

export interface TransactionForAnomaly {
  id: string;
  payeeName?: string;
  category?: string;
  amount: number | string;
  date: string;
}

export interface CategoryHistoricalStats {
  category: string;
  mean: number | string;
  standardDeviation: number | string;
  sampleCount: number;
}

export interface SpendingAnomaly {
  transactionId: string;
  payeeName: string;
  category: string;
  amount: string;
  date: string;
  deviationMultiplier: string;
  severity: 'low' | 'medium' | 'high';
  reason: string;
}

/**
 * Detects spending transactions that deviate significantly from category norms
 * using zero-floating point Decimal.js arithmetic.
 */
export function detectSpendingAnomalies(
  transactions: TransactionForAnomaly[],
  historicalStats: Record<string, CategoryHistoricalStats>,
  options: {
    minDeviationMultiplier?: number;
    minAmountThreshold?: number;
  } = {}
): SpendingAnomaly[] {
  const minMultiplier = new Decimal(options.minDeviationMultiplier ?? 2.0);
  const minAmount = new Decimal(options.minAmountThreshold ?? 50);

  const anomalies: SpendingAnomaly[] = [];

  for (const tx of transactions) {
    const txAmount = new Decimal(tx.amount || 0);
    if (txAmount.lt(minAmount)) continue;

    const cat = tx.category || 'General';
    const stats = historicalStats[cat];

    if (!stats || stats.sampleCount < 2) {
      continue;
    }

    const mean = new Decimal(stats.mean || 0);
    const stdDev = new Decimal(stats.standardDeviation || 0);

    if (mean.lte(0)) continue;

    // Check ratio relative to historical mean
    const multiplier = txAmount.div(mean);

    if (multiplier.gte(minMultiplier)) {
      let severity: 'low' | 'medium' | 'high' = 'low';
      if (multiplier.gte(4.0)) {
        severity = 'high';
      } else if (multiplier.gte(2.5)) {
        severity = 'medium';
      }

      anomalies.push({
        transactionId: tx.id,
        payeeName: tx.payeeName || 'Unknown Payee',
        category: cat,
        amount: txAmount.toFixed(2),
        date: tx.date,
        deviationMultiplier: multiplier.toFixed(1),
        severity,
        reason: `${multiplier.toFixed(1)}x typical average (${mean.toFixed(2)}) for category "${cat}"`,
      });
    }
  }

  return anomalies;
}

/**
 * Computes category statistics (mean and standard deviation) from historical transactions.
 */
export function calculateCategoryStats(
  transactions: TransactionForAnomaly[]
): Record<string, CategoryHistoricalStats> {
  const grouped: Record<string, Decimal[]> = {};

  for (const tx of transactions) {
    const cat = tx.category || 'General';
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push(new Decimal(tx.amount || 0));
  }

  const result: Record<string, CategoryHistoricalStats> = {};

  for (const [cat, amounts] of Object.entries(grouped)) {
    if (amounts.length === 0) continue;

    const count = new Decimal(amounts.length);
    const sum = amounts.reduce((acc, a) => acc.plus(a), new Decimal(0));
    const mean = sum.div(count);

    if (amounts.length === 1) {
      result[cat] = {
        category: cat,
        mean: mean.toFixed(4),
        standardDeviation: '0.0000',
        sampleCount: 1,
      };
      continue;
    }

    // Variance = sum((x - mean)^2) / (count - 1)
    const sumSqDiff = amounts.reduce(
      (acc, a) => acc.plus(a.minus(mean).pow(2)),
      new Decimal(0)
    );
    const variance = sumSqDiff.div(count.minus(1));
    const stdDev = variance.sqrt();

    result[cat] = {
      category: cat,
      mean: mean.toFixed(4),
      standardDeviation: stdDev.toFixed(4),
      sampleCount: amounts.length,
    };
  }

  return result;
}
