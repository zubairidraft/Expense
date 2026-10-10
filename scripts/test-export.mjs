import assert from 'node:assert';
import {
  escapeCsvField,
  sanitizeForSpreadsheet,
  formatExportDate,
  formatExportNumber,
} from './src/lib/export/formatters.js';
import { buildReportDataset } from './src/lib/export/buildReportDataset.js';
import { generateCsvString } from './src/lib/export/toCsv.js';
import { buildExportFilename } from './src/lib/export/download.js';

console.log('Testing Export Engine...');

// 1. Test Spreadsheet Formula Sanitization (DDE guards)
assert.strictEqual(sanitizeForSpreadsheet('=SUM(A1:A10)'), "'=SUM(A1:A10)");
assert.strictEqual(sanitizeForSpreadsheet('+12345'), "'+12345");
assert.strictEqual(sanitizeForSpreadsheet('-cmd|/C calc'), "'-cmd|/C calc");
assert.strictEqual(sanitizeForSpreadsheet('@mention'), "'@mention");
assert.strictEqual(sanitizeForSpreadsheet('Normal text'), 'Normal text');
console.log('✓ Formula sanitization passed');

// 2. Test CSV RFC 4180 Escaping & Urdu Support
assert.strictEqual(escapeCsvField('Simple'), 'Simple');
assert.strictEqual(escapeCsvField('Text with, comma'), '"Text with, comma"');
assert.strictEqual(escapeCsvField('Quote "test"'), '"Quote ""test"""');
assert.strictEqual(escapeCsvField('کرایہ مکان'), 'کرایہ مکان');
console.log('✓ CSV escaping and Urdu text support passed');

// 3. Test Filename Generator
const filename = buildExportFilename({
  prefix: 'Financial_Report',
  startDate: '2026-03-01',
  endDate: '2026-03-31',
  filterTags: ['Expenses only', 'Office Rent'],
  extension: 'xlsx',
});
assert.strictEqual(filename, 'Financial_Report_2026-03-01_to_2026-03-31_Expenses_only_Office_Rent.xlsx');
console.log('✓ Filename generation passed');

// 4. Test buildReportDataset with Split Lines & Transfers
const mockTransactions = [
  {
    id: 'tx-1',
    date: '2026-03-05',
    type: 'expense',
    status: 'cleared',
    payee_name: 'Metro Market',
    amount: 150,
    currency: 'USD',
    tags: [{ name: 'Groceries' }],
    lines: [
      {
        id: 'line-1',
        amount: 100,
        direction: 'out',
        category: { name: 'Food & Dining' },
        account: { name: 'Chase Checking', currency: 'USD' },
      },
      {
        id: 'line-2',
        amount: 50,
        direction: 'out',
        category: { name: 'Household' },
        account: { name: 'Chase Checking', currency: 'USD' },
      },
    ],
  },
  {
    id: 'tx-2',
    date: '2026-03-10',
    type: 'income',
    status: 'cleared',
    payee_name: 'Client Acme Corp',
    amount: 500,
    currency: 'USD',
    lines: [
      {
        id: 'line-3',
        amount: 500,
        direction: 'in',
        category: { name: 'Consulting' },
        account: { name: 'Business Bank', currency: 'USD' },
      },
    ],
  },
  {
    id: 'tx-3',
    date: '2026-03-15',
    type: 'transfer',
    status: 'cleared',
    payee_name: 'Transfer checking to savings',
    amount: 200,
    currency: 'USD',
    lines: [
      {
        id: 'line-4',
        amount: 200,
        direction: 'out',
        account: { name: 'Chase Checking', currency: 'USD' },
      },
      {
        id: 'line-5',
        amount: 200,
        direction: 'in',
        account: { name: 'High Yield Savings', currency: 'USD' },
      },
    ],
  },
];

const dataset = buildReportDataset(mockTransactions, {
  workspace: { name: 'Test Workspace', base_currency: 'USD' },
  startDate: '2026-03-01',
  endDate: '2026-03-31',
  appliedFilters: {
    type: 'all',
  },
});

assert.strictEqual(dataset.summary.totalExpense, 150);
assert.strictEqual(dataset.summary.totalIncome, 500);
assert.strictEqual(dataset.summary.netCashflow, 350);
assert.strictEqual(dataset.summary.lineCount, 5); // 2 lines from tx-1, 1 from tx-2, 2 from tx-3
assert.strictEqual(dataset.rows.length, 5);
console.log('✓ Dataset normalization & split transaction handling passed');

// 5. Test CSV Generation with UTF-8 BOM
const csvStr = generateCsvString(dataset);
assert.ok(csvStr.startsWith('\uFEFF'), 'CSV must start with UTF-8 BOM for Excel compatibility');
assert.ok(csvStr.includes('Financial Activity & Ledger Report'), 'Metadata header included');
assert.ok(csvStr.includes('Applied Filters'), 'Applied filter summary included');
assert.ok(csvStr.includes('Metro Market'), 'Payee row included');
assert.ok(csvStr.includes('Client Acme Corp'), 'Income row included');
console.log('✓ CSV string generation with BOM & metadata passed');

console.log('ALL EXPORT ENGINE TESTS PASSED SUCCESSFULLY! 🎉');
