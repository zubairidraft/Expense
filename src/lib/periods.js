import { toLocalISODate } from './dates';

const clampDay = (year, monthIndex, day) => {
  const last = new Date(year, monthIndex + 1, 0).getDate();
  return new Date(year, monthIndex, Math.min(day, last));
};

/**
 * Current budget/report period for a given period type.
 * Monthly periods respect the workspace month_start_day (e.g. salary cycle 25th -> 24th).
 * Returns ISO dates { start, end } (inclusive) in the user's local calendar.
 */
export function getPeriodRange(period = 'monthly', { monthStartDay = 1, today = new Date(), startDate, endDate } = {}) {
  const msd = Math.min(Math.max(Number(monthStartDay) || 1, 1), 28);
  const y = today.getFullYear();
  const m = today.getMonth();

  if (period === 'custom' && startDate) {
    return { start: startDate, end: endDate || toLocalISODate(today) };
  }

  if (period === 'weekly') {
    const day = (today.getDay() + 6) % 7; // Monday = 0
    const start = new Date(y, m, today.getDate() - day);
    const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 6);
    return { start: toLocalISODate(start), end: toLocalISODate(end) };
  }

  if (period === 'yearly' || period === 'annual') {
    return { start: `${y}-01-01`, end: `${y}-12-31` };
  }

  if (period === 'quarterly') {
    const qStart = Math.floor(m / 3) * 3;
    const start = new Date(y, qStart, 1);
    const end = new Date(y, qStart + 3, 0);
    return { start: toLocalISODate(start), end: toLocalISODate(end) };
  }

  // monthly (default) with month_start_day
  let start = clampDay(y, m, msd);
  if (today < start) start = clampDay(y, m - 1, msd);
  const nextStart = clampDay(start.getFullYear(), start.getMonth() + 1, msd);
  const end = new Date(nextStart.getFullYear(), nextStart.getMonth(), nextStart.getDate() - 1);
  return { start: toLocalISODate(start), end: toLocalISODate(end) };
}
