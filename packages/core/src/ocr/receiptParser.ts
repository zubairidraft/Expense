import { OcrExtractedData, DraftTransactionFromReceipt } from '../types/index.js';
import Decimal from 'decimal.js';

/**
 * Extracts structured receipt information from raw OCR text.
 */
export function parseRawReceiptText(rawText: string): OcrExtractedData {
  if (!rawText || !rawText.trim()) {
    return {
      merchantName: null,
      totalAmount: null,
      taxAmount: null,
      currency: null,
      date: null,
      confidence: 0,
    };
  }

  const lines = rawText
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);

  let merchantName: string | null = null;
  let totalAmount: string | null = null;
  let taxAmount: string | null = null;
  let currency: string | null = null;
  let date: string | null = null;
  let confidenceScore = 0.5;

  // 1. Merchant Name heuristic: First non-date, non-numeric header line
  for (const line of lines.slice(0, 5)) {
    if (
      !/^\d+$/.test(line) &&
      !line.toLowerCase().includes('receipt') &&
      !line.toLowerCase().includes('invoice') &&
      !line.toLowerCase().includes('welcome') &&
      line.length > 2
    ) {
      merchantName = line.replace(/[^a-zA-Z0-9\s&'-]/g, '').trim();
      if (merchantName) break;
    }
  }

  // 2. Date parsing (YYYY-MM-DD, DD/MM/YYYY, MM/DD/YYYY)
  const isoDateMatch = rawText.match(/\b(20\d\d[-/](0[1-9]|1[0-2])[-/](0[1-9]|[12]\d|3[01]))\b/);
  const slashDateMatch = rawText.match(/\b((0[1-9]|[12]\d|3[01])[-/](0[1-9]|1[0-2])[-/](20\d\d))\b/);

  if (isoDateMatch) {
    date = isoDateMatch[1].replace(/\//g, '-');
    confidenceScore += 0.15;
  } else if (slashDateMatch) {
    const [, , day, month, year] = slashDateMatch;
    date = `${year}-${month}-${day}`;
    confidenceScore += 0.15;
  }

  // 3. Currency detection
  if (/\b(PKR|Rs\.?)\b/i.test(rawText)) currency = 'PKR';
  else if (/\b(USD|\$)\b/i.test(rawText)) currency = 'USD';
  else if (/\b(EUR|€)\b/i.test(rawText)) currency = 'EUR';
  else if (/\b(GBP|£)\b/i.test(rawText)) currency = 'GBP';
  else if (/\b(AED)\b/i.test(rawText)) currency = 'AED';
  else if (/\b(SAR)\b/i.test(rawText)) currency = 'SAR';

  // 4. Total Amount search (scanned from bottom up to find final payable total, excluding subtotal)
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i];
    const lower = line.toLowerCase();
    if (lower.includes('subtotal') || lower.includes('sub-total')) {
      continue;
    }
    if (
      lower.includes('total') ||
      lower.includes('amount due') ||
      lower.includes('grand total') ||
      lower.includes('net pay')
    ) {
      const amtMatch = line.match(/(\d+(?:\.\d{1,2})?)/g);
      if (amtMatch && amtMatch.length > 0) {
        // Last number on total line is usually the total
        const candidate = amtMatch[amtMatch.length - 1];
        try {
          const dec = new Decimal(candidate);
          if (dec.greaterThan(0)) {
            totalAmount = dec.toFixed(2);
            confidenceScore += 0.25;
            break;
          }
        } catch {
          // ignore parsing error
        }
      }
    }
  }

  // 5. Tax amount search
  for (const line of lines) {
    const lower = line.toLowerCase();
    if (lower.includes('tax') || lower.includes('vat') || lower.includes('gst')) {
      const taxMatch = line.match(/(\d+(?:\.\d{1,2})?)/g);
      if (taxMatch && taxMatch.length > 0) {
        const candidate = taxMatch[taxMatch.length - 1];
        try {
          const dec = new Decimal(candidate);
          if (dec.greaterThan(0)) {
            taxAmount = dec.toFixed(2);
            break;
          }
        } catch {
          // ignore
        }
      }
    }
  }

  return {
    merchantName,
    totalAmount,
    taxAmount,
    currency,
    date,
    confidence: Math.min(confidenceScore, 0.99),
  };
}

/**
 * Creates an uncommitted draft transaction from OCR data.
 * Adheres strictly to Rule 14: Never silently write to the ledger without user review.
 */
export function generateDraftFromReceipt(
  ocrData: OcrExtractedData,
  options?: {
    defaultCurrency?: string;
    attachmentId?: string;
  }
): DraftTransactionFromReceipt {
  const currency = ocrData.currency || options?.defaultCurrency || 'USD';
  const totalAmount = ocrData.totalAmount || '0.00';
  const date = ocrData.date || new Date().toISOString().split('T')[0];

  return {
    type: 'expense',
    date,
    merchantName: ocrData.merchantName || 'Receipt Merchant',
    totalAmount,
    currency,
    taxAmount: ocrData.taxAmount || null,
    notes: ocrData.merchantName
      ? `Scanned receipt from ${ocrData.merchantName}`
      : 'Scanned receipt attachment',
    attachmentId: options?.attachmentId || null,
    status: 'draft',
    confidence: ocrData.confidence ?? 0.5,
  };
}
