import { Decimal } from 'decimal.js';

export interface SpendingVelocityInput {
  daysElapsed: number;
  daysInMonth: number;
  currentSpent: number | string;
  budgetLimit?: number | string;
}

export interface SpendingVelocityResult {
  dailyBurnRate: string;
  projectedMonthEnd: string;
  remainingDays: number;
  projectedOverspend: string | null;
  safeDailyRemainingBudget: string | null;
  isOnTrack: boolean;
  burnRatePercentageOfBudget: string | null;
}

export function calculateSpendingVelocity(input: SpendingVelocityInput): SpendingVelocityResult {
  const daysElapsed = Math.max(1, input.daysElapsed);
  const daysInMonth = Math.max(daysElapsed, input.daysInMonth);
  const currentSpent = new Decimal(input.currentSpent || 0);
  const remainingDays = Math.max(0, daysInMonth - daysElapsed);

  // Daily burn rate = currentSpent / daysElapsed
  const dailyBurnRate = currentSpent.div(daysElapsed);
  const projectedMonthEnd = dailyBurnRate.times(daysInMonth);

  let projectedOverspend: string | null = null;
  let safeDailyRemainingBudget: string | null = null;
  let isOnTrack = true;
  let burnRatePercentageOfBudget: string | null = null;

  if (input.budgetLimit !== undefined && input.budgetLimit !== null) {
    const budgetLimit = new Decimal(input.budgetLimit);
    if (budgetLimit.gt(0)) {
      burnRatePercentageOfBudget = projectedMonthEnd.div(budgetLimit).times(100).toFixed(1);
      if (projectedMonthEnd.gt(budgetLimit)) {
        projectedOverspend = projectedMonthEnd.minus(budgetLimit).toFixed(2);
        isOnTrack = false;
      } else {
        projectedOverspend = '0.00';
        isOnTrack = true;
      }

      if (remainingDays > 0) {
        const remainingBudget = Decimal.max(0, budgetLimit.minus(currentSpent));
        safeDailyRemainingBudget = remainingBudget.div(remainingDays).toFixed(2);
      } else {
        safeDailyRemainingBudget = '0.00';
      }
    }
  }

  return {
    dailyBurnRate: dailyBurnRate.toFixed(2),
    projectedMonthEnd: projectedMonthEnd.toFixed(2),
    remainingDays,
    projectedOverspend,
    safeDailyRemainingBudget,
    isOnTrack,
    burnRatePercentageOfBudget,
  };
}

export interface RecurringScheduleItem {
  id: string;
  title: string;
  amount: number | string;
  type: 'income' | 'expense';
  dayOfMonth?: number; // 1-31
  frequencyDays?: number; // e.g. 30 for monthly, 14 for biweekly
}

export interface CashFlowDayPoint {
  date: string;
  dayIndex: number;
  projectedBalance: string;
  netDayChange: string;
  events: string[];
}

export interface CashFlowForecastResult {
  projectedCurve: CashFlowDayPoint[];
  startingBalance: string;
  endingBalance: string;
  minimumBalance: string;
  minimumBalanceDate: string;
  riskLevel: 'healthy' | 'warning' | 'critical';
}

export function projectCashFlowForecast(
  startingBalance: number | string,
  recurringItems: RecurringScheduleItem[],
  daysHorizon = 90,
  startDateStr?: string
): CashFlowForecastResult {
  const startDate = startDateStr ? new Date(startDateStr) : new Date();
  let runningBalance = new Decimal(startingBalance || 0);

  let minBalance = new Decimal(runningBalance);
  let minBalanceDate = startDate.toISOString().split('T')[0];

  const curve: CashFlowDayPoint[] = [];

  for (let i = 0; i <= daysHorizon; i++) {
    const currentDate = new Date(startDate);
    currentDate.setDate(currentDate.getDate() + i);
    const dateStr = currentDate.toISOString().split('T')[0];
    const dayOfMonth = currentDate.getDate();

    let dayNetChange = new Decimal(0);
    const dayEvents: string[] = [];

    for (const item of recurringItems) {
      let isTriggerDay = false;
      if (item.dayOfMonth !== undefined) {
        if (item.dayOfMonth === dayOfMonth) {
          isTriggerDay = true;
        }
      } else if (item.frequencyDays && item.frequencyDays > 0) {
        if (i > 0 && i % item.frequencyDays === 0) {
          isTriggerDay = true;
        }
      }

      if (isTriggerDay) {
        const itemAmt = new Decimal(item.amount || 0);
        if (item.type === 'income') {
          dayNetChange = dayNetChange.plus(itemAmt);
          dayEvents.push(`+${itemAmt.toFixed(2)} (${item.title})`);
        } else {
          dayNetChange = dayNetChange.minus(itemAmt);
          dayEvents.push(`-${itemAmt.toFixed(2)} (${item.title})`);
        }
      }
    }

    runningBalance = runningBalance.plus(dayNetChange);

    if (runningBalance.lt(minBalance)) {
      minBalance = new Decimal(runningBalance);
      minBalanceDate = dateStr;
    }

    // Record milestone points (every 5 days, or on days with events, or at horizon end)
    if (i === 0 || i === daysHorizon || dayEvents.length > 0 || i % 7 === 0) {
      curve.push({
        date: dateStr,
        dayIndex: i,
        projectedBalance: runningBalance.toFixed(2),
        netDayChange: dayNetChange.toFixed(2),
        events: dayEvents,
      });
    }
  }

  let riskLevel: 'healthy' | 'warning' | 'critical' = 'healthy';
  if (minBalance.lt(0)) {
    riskLevel = 'critical';
  } else if (minBalance.lt(new Decimal(startingBalance || 0).times(0.2))) {
    riskLevel = 'warning';
  }

  const endingBalance = runningBalance.toFixed(2);

  return {
    projectedCurve: curve,
    startingBalance: new Decimal(startingBalance || 0).toFixed(2),
    endingBalance,
    minimumBalance: minBalance.toFixed(2),
    minimumBalanceDate: minBalanceDate,
    riskLevel,
  };
}
