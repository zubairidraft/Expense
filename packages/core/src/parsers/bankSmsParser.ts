export interface ParsedBankSms {
  bankName: string;
  amount: string;
  currency: string;
  type: 'expense' | 'income' | 'transfer';
  merchantOrPayee?: string;
  date?: string;
  accountHint?: string;
  rawText: string;
  isConfidenceHigh: boolean;
}

export interface SmsTransactionDraft {
  title: string;
  amount: string;
  currency: string;
  type: 'expense' | 'income' | 'transfer';
  date: string;
  payeeName?: string;
  notes: string;
  source: 'sms';
}

/**
 * Parses transactional SMS messages from Pakistani and UAE banks, e-wallets, and generic bank alerts.
 */
export function parseBankSms(text: string, senderHeader?: string): ParsedBankSms | null {
  if (!text || typeof text !== 'string') return null;

  const trimmed = text.trim();
  const lower = `${senderHeader || ''} ${trimmed}`.toLowerCase();

  let bankName = 'Unknown Bank';
  let currency = 'USD';
  let type: 'expense' | 'income' | 'transfer' = 'expense';
  let amountStr = '';
  let merchant = '';
  let dateStr = '';
  let accountHint = '';
  let isConfidenceHigh = false;

  // 1. Detect Bank Provider from sender header or body text
  if (lower.includes('hbl') || lower.includes('habib bank')) {
    bankName = 'HBL';
    currency = 'PKR';
  } else if (lower.includes('meezan')) {
    bankName = 'Meezan Bank';
    currency = 'PKR';
  } else if (lower.includes('jazzcash') || (lower.includes('tid:') && !lower.includes('easypaisa'))) {
    bankName = 'JazzCash';
    currency = 'PKR';
  } else if (lower.includes('easypaisa') || lower.includes('telenor microfinance')) {
    bankName = 'Easypaisa';
    currency = 'PKR';
  } else if (lower.includes('ubl') || lower.includes('united bank')) {
    bankName = 'UBL';
    currency = 'PKR';
  } else if (lower.includes('emirates nbd') || lower.includes('enbd')) {
    bankName = 'Emirates NBD';
    currency = 'AED';
  } else if (lower.includes('adcb')) {
    bankName = 'ADCB';
    currency = 'AED';
  } else if (lower.includes('fab') || lower.includes('first abu dhabi')) {
    bankName = 'FAB';
    currency = 'AED';
  }

  // Detect Currency from text if specified
  if (/\bpkr\b/i.test(trimmed) || /\brs\.?\b/i.test(trimmed)) {
    currency = 'PKR';
  } else if (/\baed\b/i.test(trimmed)) {
    currency = 'AED';
  } else if (/\busd\b/i.test(trimmed) || /\$/i.test(trimmed)) {
    currency = 'USD';
  } else if (/\beur\b/i.test(trimmed) || /€/i.test(trimmed)) {
    currency = 'EUR';
  } else if (/\bgbp\b/i.test(trimmed) || /£/i.test(trimmed)) {
    currency = 'GBP';
  } else if (/\bsar\b/i.test(trimmed)) {
    currency = 'SAR';
  }

  // Detect Type
  if (lower.includes('credited') || lower.includes('received') || lower.includes('deposited')) {
    type = 'income';
  } else if (lower.includes('transfer to') || lower.includes('sent to') || lower.includes('transferred to')) {
    type = 'transfer';
  } else {
    type = 'expense';
  }

  // 2. Extract Amount
  // Matches "PKR 4,500.00", "Rs. 2,340", "AED 250.00", "Rs 850", "$150.00"
  const amountMatch = trimmed.match(
    /(?:pkr|aed|rs\.?|usd|\$|eur|€|gbp|£|sar)\s*([0-9]{1,3}(?:,[0-9]{3})*(?:\.[0-9]{1,2})?|[0-9]+(?:\.[0-9]{1,2})?)/i
  ) || trimmed.match(/([0-9]{1,3}(?:,[0-9]{3})*(?:\.[0-9]{1,2})?|[0-9]+(?:\.[0-9]{1,2})?)\s*(?:pkr|aed|rs\.?|usd|eur|gbp|sar)/i);

  if (amountMatch) {
    amountStr = amountMatch[1].replace(/,/g, '');
  }

  // Fallback Amount search if prefix wasn't right next to currency
  if (!amountStr) {
    const rawNumMatch = trimmed.match(/\b([0-9]{1,3}(?:,[0-9]{3})*\.[0-9]{2})\b/);
    if (rawNumMatch) {
      amountStr = rawNumMatch[1].replace(/,/g, '');
    }
  }

  // 3. Extract Merchant / Payee
  // Matches "at <MERCHANT> on", "at <MERCHANT>.", "to <PAYEE> on", "to <PAYEE> via"
  const merchantAtMatch = trimmed.match(/\bat\s+([A-Za-z0-9\s&'-]+?)(?=(?:\.|\s+(?:on|via|dated|avail|bal|balance|ref|tid|$)))/i);
  const merchantToMatch = trimmed.match(/\bto\s+([A-Za-z0-9\s&'()-]+?)(?=(?:\.|\s+(?:on|via|dated|fee|bal|balance|ref|tid|$)))/i);

  if (merchantAtMatch && merchantAtMatch[1].trim().length > 1) {
    merchant = merchantAtMatch[1].trim();
  } else if (merchantToMatch && merchantToMatch[1].trim().length > 1) {
    merchant = merchantToMatch[1].trim();
  }

  // 4. Extract Date
  // Matches "08-OCT-2026", "08/10/2026", "2026-10-08", "08-10-2026"
  const dateMatch = trimmed.match(/\b([0-9]{1,2}[-\/](?:[a-z]{3}|[0-9]{1,2})[-\/][0-9]{2,4})\b/i);
  if (dateMatch) {
    dateStr = dateMatch[1];
  } else {
    dateStr = new Date().toISOString().split('T')[0];
  }

  // 5. Extract Account Hint (Card 1234 or Account 0102)
  const acctMatch = trimmed.match(/(?:card|account|a\/c)(?:\s+ending)?\s+([0-9xX*]{4,})/i);
  if (acctMatch) {
    accountHint = acctMatch[1];
  }

  if (amountStr) {
    isConfidenceHigh = Boolean(merchant || bankName !== 'Unknown Bank');
    return {
      bankName,
      amount: parseFloat(amountStr).toFixed(2),
      currency,
      type,
      merchantOrPayee: merchant || undefined,
      date: dateStr,
      accountHint: accountHint || undefined,
      rawText: trimmed,
      isConfidenceHigh,
    };
  }

  return null;
}

/**
 * Converts a parsed bank SMS into an authoritative transaction draft ready for booking.
 */
function localToday(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function generateDraftFromSms(parsed: ParsedBankSms): SmsTransactionDraft {
  const payee = parsed.merchantOrPayee || (parsed.bankName !== 'Unknown Bank' ? parsed.bankName : 'Merchant');
  const title = `${parsed.type === 'income' ? 'Received from' : 'Spent at'} ${payee}`;

  return {
    title,
    amount: parsed.amount,
    currency: parsed.currency,
    type: parsed.type,
    date: localToday(),
    payeeName: parsed.merchantOrPayee,
    notes: `Parsed from ${parsed.bankName} SMS alert${parsed.accountHint ? ` (Acct: ${parsed.accountHint})` : ''}`,
    source: 'sms',
  };
}
