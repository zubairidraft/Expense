import { describe, it, expect } from 'vitest';
import {
  CategoryCreateSchema,
  CategoryUpdateSchema,
  TagCreateSchema,
  MerchantCreateSchema,
} from '../src/schemas';

describe('Category Schemas', () => {
  it('validates a valid expense category with essential flag', () => {
    const input = {
      name: 'Groceries & Provisions',
      kind: 'expense',
      isEssential: true,
      icon: '🛒',
      color: '#10b981',
      parentId: null,
    };

    const parsed = CategoryCreateSchema.parse(input);
    expect(parsed.name).toBe('Groceries & Provisions');
    expect(parsed.kind).toBe('expense');
    expect(parsed.isEssential).toBe(true);
    expect(parsed.icon).toBe('🛒');
    expect(parsed.color).toBe('#10b981');
    expect(parsed.parentId).toBeNull();
  });

  it('validates an income category with defaults', () => {
    const input = {
      name: 'Monthly Consulting Retainer',
      kind: 'income',
    };

    const parsed = CategoryCreateSchema.parse(input);
    expect(parsed.name).toBe('Monthly Consulting Retainer');
    expect(parsed.kind).toBe('income');
    expect(parsed.isEssential).toBe(false);
    expect(parsed.icon).toBe('📦');
    expect(parsed.color).toBe('#6366f1');
  });

  it('rejects invalid category kind and empty name', () => {
    expect(() =>
      CategoryCreateSchema.parse({
        name: '',
        kind: 'expense',
      })
    ).toThrow();

    expect(() =>
      CategoryCreateSchema.parse({
        name: 'Investing',
        kind: 'other',
      })
    ).toThrow();
  });

  it('validates partial category updates', () => {
    const update = {
      name: 'Dining & Cafes',
      isEssential: false,
    };
    const parsed = CategoryUpdateSchema.parse(update);
    expect(parsed.name).toBe('Dining & Cafes');
    expect(parsed.isEssential).toBe(false);
  });
});

describe('Tag Schemas', () => {
  it('validates a valid tag', () => {
    const valid = {
      name: 'Dubai Trip 2026',
      color: '#ec4899',
    };
    const parsed = TagCreateSchema.parse(valid);
    expect(parsed.name).toBe('Dubai Trip 2026');
    expect(parsed.color).toBe('#ec4899');
  });

  it('rejects an empty tag name', () => {
    expect(() => TagCreateSchema.parse({ name: '   ' })).toThrow();
  });
});

describe('Merchant Schemas', () => {
  it('validates a merchant with aliases and default category', () => {
    const input = {
      name: 'Carrefour Market',
      aliases: ['Carrefour MOE', 'MAF Carrefour', 'Carrefour Express'],
      defaultCategoryId: '00000000-0000-0000-0000-000000000001',
      logoUrl: 'https://example.com/carrefour.png',
    };
    const parsed = MerchantCreateSchema.parse(input);
    expect(parsed.name).toBe('Carrefour Market');
    expect(parsed.aliases).toHaveLength(3);
    expect(parsed.defaultCategoryId).toBe('00000000-0000-0000-0000-000000000001');
    expect(parsed.logoUrl).toBe('https://example.com/carrefour.png');
  });

  it('rejects invalid logo URL when provided', () => {
    expect(() =>
      MerchantCreateSchema.parse({
        name: 'Amazon AE',
        logoUrl: 'invalid-url',
      })
    ).toThrow();
  });
});
