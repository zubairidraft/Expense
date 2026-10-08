import { describe, it, expect } from 'vitest';
import { parseBankSms, generateDraftFromSms } from '../src/parsers/bankSmsParser.js';
import { parseCsv, computeDedupeHash, exportTransactionsToCsv } from '../src/parsers/csvParser.js';

describe('Bank SMS Parsing Engine', () => {
  it('parses Pakistani HBL debit card POS transaction SMS', () => {
    const sms = 'HBL Alert: Dear Customer, PKR 4,500.00 spent on your Debit Card 1234 at AL-FATAH STORE on 08-OCT-2026 14:30. Avail Bal: PKR 32,150.00';
    const parsed = parseBankSms(sms);

    expect(parsed).not.toBeNull();
    expect(parsed?.bankName).toBe('HBL');
    expect(parsed?.amount).toBe('4500.00');
    expect(parsed?.currency).toBe('PKR');
    expect(parsed?.type).toBe('expense');
    expect(parsed?.merchantOrPayee).toBe('AL-FATAH STORE');
    expect(parsed?.accountHint).toBe('1234');
    expect(parsed?.isConfidenceHigh).toBe(true);

    const draft = generateDraftFromSms(parsed!);
    expect(draft.title).toBe('Spent at AL-FATAH STORE');
    expect(draft.amount).toBe('4500.00');
    expect(draft.currency).toBe('PKR');
    expect(draft.source).toBe('sms');
  });

  it('parses Pakistani Meezan Bank account debit alert', () => {
    const sms = 'Meezan Bank: Rs. 2,340 has been debited from your Account 0102 on 08/10/2026 for POS purchase at METRO CASH & CARRY. Balance: Rs 55,200';
    const parsed = parseBankSms(sms);

    expect(parsed).not.toBeNull();
    expect(parsed?.bankName).toBe('Meezan Bank');
    expect(parsed?.amount).toBe('2340.00');
    expect(parsed?.currency).toBe('PKR');
    expect(parsed?.type).toBe('expense');
    expect(parsed?.merchantOrPayee).toBe('METRO CASH & CARRY');
  });

  it('parses JazzCash peer transfer SMS alert', () => {
    const sms = 'JazzCash: Rs. 1,500 sent to 03001234567 (Ali Khan) on 08-10-2026. Fee: Rs. 0. Balance: Rs. 4,200. TID: 198273615';
    const parsed = parseBankSms(sms);

    expect(parsed).not.toBeNull();
    expect(parsed?.bankName).toBe('JazzCash');
    expect(parsed?.amount).toBe('1500.00');
    expect(parsed?.currency).toBe('PKR');
    expect(parsed?.type).toBe('transfer');
    expect(parsed?.merchantOrPayee).toBe('03001234567 (Ali Khan)');
  });

  it('parses UAE Emirates NBD credit card purchase SMS', () => {
    const sms = 'Emirates NBD: Purchase of AED 250.00 with Credit Card ending 9876 at CARREFOUR DUBAI on 08/10/2026 16:45. Available limit: AED 14,750.00';
    const parsed = parseBankSms(sms);

    expect(parsed).not.toBeNull();
    expect(parsed?.bankName).toBe('Emirates NBD');
    expect(parsed?.amount).toBe('250.00');
    expect(parsed?.currency).toBe('AED');
    expect(parsed?.type).toBe('expense');
    expect(parsed?.merchantOrPayee).toBe('CARREFOUR DUBAI');
    expect(parsed?.accountHint).toBe('9876');
  });

  it('parses UAE ADCB card alert', () => {
    const sms = 'Your ADCB Card was used for AED 180.50 at SPINNEYS on 08/10/2026. Available limit: AED 9,200.00';
    const parsed = parseBankSms(sms);

    expect(parsed).not.toBeNull();
    expect(parsed?.bankName).toBe('ADCB');
    expect(parsed?.amount).toBe('180.50');
    expect(parsed?.currency).toBe('AED');
    expect(parsed?.merchantOrPayee).toBe('SPINNEYS');
  });

  it('handles empty or non-banking text gracefully', () => {
    expect(parseBankSms('')).toBeNull();
    expect(parseBankSms('Hey what time is our dinner tonight?')).toBeNull();
  });
});

describe('CSV Parser, Deduplication & Export Services', () => {
  it('parses CSV with quoted headers and commas correctly', () => {
    const csv = `Date,Title,Amount,Type\n2026-10-01,"Coffee, Croissant & Juice",12.50,expense\n2026-10-02,Client Retainer,3000.00,income`;
    const { headers, rows } = parseCsv(csv);

    expect(headers).toEqual(['Date', 'Title', 'Amount', 'Type']);
    expect(rows).toHaveLength(2);
    expect(rows[0].Title).toBe('Coffee, Croissant & Juice');
    expect(rows[0].Amount).toBe('12.50');
  });

  it('computes deterministic deduplication hash to prevent duplicate entries', () => {
    const hash1 = computeDedupeHash('2026-10-08', '4500.00', 'AL-FATAH STORE', 'expense');
    const hash2 = computeDedupeHash('2026-10-08', '4500.00', 'al-fatah store', 'expense');
    const hashDifferent = computeDedupeHash('2026-10-08', '4500.01', 'AL-FATAH STORE', 'expense');

    expect(hash1).toBe(hash2); // Case insensitive match
    expect(hash1).not.toBe(hashDifferent);
  });

  it('exports transactions list into clean CSV format', () => {
    const sampleTxs = [
      {
        date: '2026-10-08',
        title: 'Office Stationery',
        payee_name: 'Staples',
        type: 'expense',
        amount: '45.00',
        currency: 'USD',
        notes: 'Printer paper & pens',
        status: 'cleared',
      },
    ];

    const csvOutput = exportTransactionsToCsv(sampleTxs);
    expect(csvOutput).toContain('Date,Title,Payee,Type,Amount,Currency,Notes,Status');
    expect(csvOutput).toContain('2026-10-08,"Office Stationery","Staples",expense,45.00,USD');
  });
});
