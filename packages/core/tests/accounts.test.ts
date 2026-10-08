import { describe, it, expect } from 'vitest';
import { AccountCreateSchema, AccountUpdateSchema } from '../src/schemas';

describe('Account Schemas', () => {
  it('validates a valid asset account creation', () => {
    const valid = {
      name: 'Dubai Islamic Bank Checking',
      type: 'bank',
      nature: 'asset',
      currency: 'AED',
      openingBalance: '5000.00',
      openingDate: '2026-10-01',
      visibility: 'shared',
    };

    const parsed = AccountCreateSchema.parse(valid);
    expect(parsed.name).toBe('Dubai Islamic Bank Checking');
    expect(parsed.nature).toBe('asset');
    expect(parsed.type).toBe('bank');
    expect(parsed.openingBalance).toBe('5000.00');
  });

  it('validates a liability account with credit limit', () => {
    const liability = {
      name: 'Standard Chartered Platinum Card',
      type: 'card',
      nature: 'liability',
      currency: 'USD',
      openingBalance: '120.50',
      openingDate: '2026-10-01',
      creditLimit: '10000.00',
      visibility: 'private',
    };

    const parsed = AccountCreateSchema.parse(liability);
    expect(parsed.nature).toBe('liability');
    expect(parsed.creditLimit).toBe('10000.00');
    expect(parsed.visibility).toBe('private');
  });

  it('rejects invalid currency codes or invalid dates', () => {
    expect(() =>
      AccountCreateSchema.parse({
        name: 'Bad Account',
        type: 'bank',
        nature: 'asset',
        currency: 'INVALID',
        openingDate: '2026-10-01',
      })
    ).toThrow();

    expect(() =>
      AccountCreateSchema.parse({
        name: 'Bad Date',
        type: 'bank',
        nature: 'asset',
        currency: 'USD',
        openingDate: '10/01/2026',
      })
    ).toThrow();
  });

  it('validates partial account updates', () => {
    const update = {
      name: 'Emergency Savings Vault',
      openingBalance: '12500.00',
    };

    const parsed = AccountUpdateSchema.parse(update);
    expect(parsed.name).toBe('Emergency Savings Vault');
    expect(parsed.openingBalance).toBe('12500.00');
  });
});
