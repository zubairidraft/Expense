import { describe, it, expect } from 'vitest';
import { ProfileUpdateSchema } from '../src/schemas';

describe('Profile Schemas', () => {
  it('validates a valid profile update', () => {
    const valid = {
      fullName: 'Alice Walker',
      defaultCurrency: 'PKR',
      locale: 'en-PK',
      numberFormat: 'lakh',
      theme: 'dark',
    };

    const parsed = ProfileUpdateSchema.parse(valid);
    expect(parsed.fullName).toBe('Alice Walker');
    expect(parsed.numberFormat).toBe('lakh');
    expect(parsed.defaultCurrency).toBe('PKR');
  });

  it('rejects invalid currency format or empty names', () => {
    expect(() =>
      ProfileUpdateSchema.parse({
        fullName: '   ',
      })
    ).toThrow();

    expect(() =>
      ProfileUpdateSchema.parse({
        defaultCurrency: 'USDD',
      })
    ).toThrow();

    expect(() =>
      ProfileUpdateSchema.parse({
        numberFormat: 'invalid-format',
      })
    ).toThrow();
  });

  it('allows optional fields to be omitted', () => {
    const parsed = ProfileUpdateSchema.parse({
      theme: 'light',
    });
    expect(parsed.theme).toBe('light');
    expect(parsed.fullName).toBeUndefined();
  });
});
