import { describe, it, expect } from 'vitest';
import {
  calculateAssetBalance,
  calculateLiabilityBalance,
  calculateNetWorth,
  validateTransfer,
  convertCurrency,
  subtractMoney,
  addMoney,
  roundMoney,
} from '../src/index.js';

describe('Comprehensive Transfer Scenarios & Ledger Integrity', () => {
  it('Scenario 1: Cash ➔ Bank (ATM deposit) preserves total net worth', () => {
    const cashOpening = '500.00';
    const bankOpening = '2000.00';
    const transferAmount = '150.00';

    // Before transfer
    const initialNetWorth = calculateNetWorth([cashOpening, bankOpening], []);
    expect(initialNetWorth).toBe('2500.00');

    // Transfer lines: Cash out, Bank in
    const cashLines = [{ direction: 'out' as const, amount: transferAmount }];
    const bankLines = [{ direction: 'in' as const, amount: transferAmount }];

    const newCashBalance = calculateAssetBalance(cashOpening, cashLines);
    const newBankBalance = calculateAssetBalance(bankOpening, bankLines);

    expect(newCashBalance).toBe('350.00');
    expect(newBankBalance).toBe('2150.00');

    // After transfer: Net worth must remain exactly 2500.00
    const finalNetWorth = calculateNetWorth([newCashBalance, newBankBalance], []);
    expect(finalNetWorth).toBe('2500.00');
  });

  it('Scenario 2: Bank ➔ Cash (ATM withdrawal) preserves total net worth', () => {
    const bankOpening = '3500.00';
    const cashOpening = '200.00';
    const withdrawalAmount = '300.00';

    const bankLines = [{ direction: 'out' as const, amount: withdrawalAmount }];
    const cashLines = [{ direction: 'in' as const, amount: withdrawalAmount }];

    const newBankBalance = calculateAssetBalance(bankOpening, bankLines);
    const newCashBalance = calculateAssetBalance(cashOpening, cashLines);

    expect(newBankBalance).toBe('3200.00');
    expect(newCashBalance).toBe('500.00');

    expect(calculateNetWorth([newBankBalance, newCashBalance], [])).toBe('3700.00');
  });

  it('Scenario 3: Transfer with fee (Source loses amount + fee; Net worth decreases ONLY by fee)', () => {
    const sourceOpening = '1000.00';
    const destOpening = '500.00';
    const transferAmount = '100.00';
    const feeAmount = '5.00';

    // Initial Net Worth = 1500.00
    const initialNetWorth = calculateNetWorth([sourceOpening, destOpening], []);
    expect(initialNetWorth).toBe('1500.00');

    // Source has 2 out lines: principal and fee
    const sourceLines = [
      { direction: 'out' as const, amount: transferAmount },
      { direction: 'out' as const, amount: feeAmount },
    ];
    // Destination has 1 in line: principal only
    const destLines = [{ direction: 'in' as const, amount: transferAmount }];

    const newSourceBal = calculateAssetBalance(sourceOpening, sourceLines);
    const newDestBal = calculateAssetBalance(destOpening, destLines);

    expect(newSourceBal).toBe('895.00'); // 1000 - 105 = 895
    expect(newDestBal).toBe('600.00');   // 500 + 100 = 600

    const finalNetWorth = calculateNetWorth([newSourceBal, newDestBal], []);
    expect(finalNetWorth).toBe('1495.00');

    // Net worth change is strictly -5.00 (the fee)
    expect(roundMoney(subtractMoney(initialNetWorth, finalNetWorth), 2)).toBe('5.00');
  });

  it('Scenario 4: Cross-Currency Transfer (USD ➔ PKR at estimated rate)', () => {
    const usdOpening = '1000.00';
    const pkrOpening = '50000.00';
    const transferUSD = '100.00';
    const fxRate = '278.50';

    // Converted destination amount
    const receivedPKR = convertCurrency(transferUSD, 'USD', 'PKR', fxRate, 2);
    expect(receivedPKR).toBe('27850.00');

    const usdLines = [{ direction: 'out' as const, amount: transferUSD }];
    const pkrLines = [{ direction: 'in' as const, amount: receivedPKR }];

    const newUsdBal = calculateAssetBalance(usdOpening, usdLines);
    const newPkrBal = calculateAssetBalance(pkrOpening, pkrLines);

    expect(newUsdBal).toBe('900.00');
    expect(newPkrBal).toBe('77850.00');
  });

  it('Scenario 5: Credit Card Bill Payment (Bank ➔ Card liability reduction)', () => {
    const bankOpening = '5000.00';
    const cardOwedOpening = '800.00'; // liability
    const paymentAmount = '500.00';

    // Initial Net Worth = 5000 - 800 = 4200.00
    expect(calculateNetWorth([bankOpening], [cardOwedOpening])).toBe('4200.00');

    // Bank pays (out), Card receives payment (in decreases debt)
    const bankLines = [{ direction: 'out' as const, amount: paymentAmount }];
    const cardLines = [{ direction: 'in' as const, amount: paymentAmount }];

    const newBankBal = calculateAssetBalance(bankOpening, bankLines);
    const newCardOwed = calculateLiabilityBalance(cardOwedOpening, cardLines);

    expect(newBankBal).toBe('4500.00');
    expect(newCardOwed).toBe('300.00'); // 800 - 500 = 300 debt remaining

    // Net worth = 4500 - 300 = 4200.00 (remains unchanged)
    expect(calculateNetWorth([newBankBal], [newCardOwed])).toBe('4200.00');
  });

  it('Scenario 6: Credit Card Cash Advance (Card ➔ Cash withdrawal)', () => {
    const cashOpening = '100.00';
    const cardOwedOpening = '200.00';
    const advanceAmount = '150.00';

    // Initial Net Worth = 100 - 200 = -100.00
    expect(calculateNetWorth([cashOpening], [cardOwedOpening])).toBe('-100.00');

    // Card borrows (out increases debt), Cash receives (in)
    const cardLines = [{ direction: 'out' as const, amount: advanceAmount }];
    const cashLines = [{ direction: 'in' as const, amount: advanceAmount }];

    const newCashBal = calculateAssetBalance(cashOpening, cashLines);
    const newCardOwed = calculateLiabilityBalance(cardOwedOpening, cardLines);

    expect(newCashBal).toBe('250.00');
    expect(newCardOwed).toBe('350.00'); // 200 + 150 = 350 debt

    // Net worth = 250 - 350 = -100.00 (remains unchanged)
    expect(calculateNetWorth([newCashBal], [newCardOwed])).toBe('-100.00');
  });

  it('Scenario 7: Atomic Edit & Reversal (Old transfer replaced with revised amounts)', () => {
    const acc1Opening = '1000.00';
    const acc2Opening = '500.00';

    // Original Transfer: $200 from Acc1 to Acc2
    const originalAcc1Lines = [{ direction: 'out' as const, amount: '200.00' }];
    const originalAcc2Lines = [{ direction: 'in' as const, amount: '200.00' }];

    expect(calculateAssetBalance(acc1Opening, originalAcc1Lines)).toBe('800.00');
    expect(calculateAssetBalance(acc2Opening, originalAcc2Lines)).toBe('700.00');

    // Edited Transfer: Changed to $350 (Simulates soft-deleting old lines and inserting new)
    const revisedAcc1Lines = [{ direction: 'out' as const, amount: '350.00' }];
    const revisedAcc2Lines = [{ direction: 'in' as const, amount: '350.00' }];

    expect(calculateAssetBalance(acc1Opening, revisedAcc1Lines)).toBe('650.00');
    expect(calculateAssetBalance(acc2Opening, revisedAcc2Lines)).toBe('850.00');

    expect(calculateNetWorth(['650.00', '850.00'], [])).toBe('1500.00');
  });

  it('Validates transfer constraints', () => {
    const sourceId = 'acc-source';
    const destId = 'acc-dest';

    // Rejects if source and destination are the exact same account
    const invalidSame = validateTransfer(sourceId, sourceId, [
      { accountId: sourceId, direction: 'out', amount: '50.00', currency: 'USD' },
      { accountId: sourceId, direction: 'in', amount: '50.00', currency: 'USD' },
    ]);
    expect(invalidSame.valid).toBe(false);

    // Rejects missing destination line
    const missingDest = validateTransfer(sourceId, destId, [
      { accountId: sourceId, direction: 'out', amount: '50.00', currency: 'USD' },
    ]);
    expect(missingDest.valid).toBe(false);

    // Rejects missing source line
    const missingSource = validateTransfer(sourceId, destId, [
      { accountId: destId, direction: 'in', amount: '50.00', currency: 'USD' },
    ]);
    expect(missingSource.valid).toBe(false);
  });
});
