/**
 * Formatters and sanitizers for data exports (CSV, Excel, PDF)
 */

/**
 * Guard against CSV/Excel Formula Injection (DDE / CSV Injection).
 * If a cell string starts with =, +, -, @, \t, or \r, prepend an apostrophe (')
 * so spreadsheet applications render it strictly as plain text instead of executing formulas.
 */
export function sanitizeForSpreadsheet(val) {
  if (val === null || val === undefined) return '';
  const str = String(val);
  if (/^[=+\-@\t\r]/.test(str)) {
    return `'${str}`;
  }
  return str;
}

/**
 * Escapes a string to conform with RFC 4180 CSV standard:
 * - Wrap with double quotes if it contains commas, double quotes, or newlines.
 * - Double any inner double quotes (" -> "").
 */
export function escapeCsvField(val, shouldSanitize = true) {
  if (val === null || val === undefined) return '';
  let str = shouldSanitize ? sanitizeForSpreadsheet(val) : String(val);
  
  if (str.includes('"') || str.includes(',') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Formats a numeric value with fixed decimals.
 */
export function formatExportNumber(amount, decimals = 2) {
  const num = parseFloat(amount || 0);
  if (!Number.isFinite(num)) return '0.00';
  return num.toFixed(decimals);
}

/**
 * Formats money with commas and currency code/symbol.
 */
export function formatExportMoney(amount, currency = 'USD') {
  const num = parseFloat(amount || 0);
  if (!Number.isFinite(num)) return `0.00 ${currency}`;
  return `${num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}`;
}

/**
 * Formats ISO date (YYYY-MM-DD) into readable format.
 */
export function formatExportDate(isoDate) {
  if (!isoDate) return '';
  try {
    const [y, m, d] = String(isoDate).split('-');
    if (y && m && d) return `${y}-${m}-${d}`;
  } catch {
    /* fallback */
  }
  return String(isoDate);
}
