import { describe, it, expect } from 'vitest';
import {
  RuleCreateSchema,
  ReconciliationCreateSchema,
  evaluateRules,
  Rule,
} from '../src/index.js';

describe('Rules Engine Validation & Evaluation', () => {
  it('validates a well-formed auto-categorization rule', () => {
    const valid = {
      name: 'Careem / Uber Taxi',
      priority: 10,
      active: true,
      conditions: [
        { field: 'payee_name' as const, operator: 'contains' as const, value: 'Uber' },
      ],
      actions: [
        { type: 'set_category' as const, value: 'cat-transport-uuid' },
        { type: 'add_tag' as const, value: 'tag-travel-uuid' },
      ],
    };

    const parsed = RuleCreateSchema.parse(valid);
    expect(parsed.name).toBe('Careem / Uber Taxi');
    expect(parsed.priority).toBe(10);
    expect(parsed.conditions).toHaveLength(1);
    expect(parsed.actions).toHaveLength(2);
  });

  it('rejects rules missing conditions or actions', () => {
    expect(() =>
      RuleCreateSchema.parse({
        name: 'Empty Rule',
        conditions: [],
        actions: [{ type: 'mark_cleared', value: 'true' }],
      })
    ).toThrow();

    expect(() =>
      RuleCreateSchema.parse({
        name: 'No Action Rule',
        conditions: [{ field: 'payee_name', operator: 'contains', value: 'Starbucks' }],
        actions: [],
      })
    ).toThrow();
  });

  it('evaluates rules deterministically and applies category and tag actions', () => {
    const rules: Rule[] = [
      {
        id: 'rule-uber',
        workspaceId: 'ws-1',
        name: 'Uber Transport Rule',
        priority: 10,
        active: true,
        conditions: [
          { field: 'payee_name', operator: 'contains', value: 'Uber' },
        ],
        actions: [
          { type: 'set_category', value: 'cat-transport' },
          { type: 'add_tag', value: 'tag-ride' },
        ],
      },
      {
        id: 'rule-high-value',
        workspaceId: 'ws-1',
        name: 'High Value Flag',
        priority: 50,
        active: true,
        conditions: [
          { field: 'amount', operator: 'greater_than', value: '500' },
        ],
        actions: [
          { type: 'add_tag', value: 'tag-large-expense' },
        ],
      },
      {
        id: 'rule-inactive',
        workspaceId: 'ws-1',
        name: 'Disabled Rule',
        priority: 5,
        active: false,
        conditions: [
          { field: 'payee_name', operator: 'contains', value: 'Uber' },
        ],
        actions: [
          { type: 'set_category', value: 'cat-wrong' },
        ],
      },
    ];

    const candidate = {
      type: 'expense',
      payeeName: 'Uber BV Amsterdam Trip',
      amount: '650.00',
      tagIds: ['tag-existing'],
    };

    const result = evaluateRules(rules, candidate);

    expect(result.appliedRuleIds).toEqual(['rule-uber', 'rule-high-value']);
    expect(result.modified.categoryId).toBe('cat-transport');
    expect(result.modified.tagIds).toContain('tag-ride');
    expect(result.modified.tagIds).toContain('tag-large-expense');
    expect(result.modified.tagIds).toContain('tag-existing');
  });
});

describe('Reconciliation Schemas', () => {
  it('validates a valid statement reconciliation session', () => {
    const valid = {
      accountId: '00000000-0000-0000-0000-000000000001',
      statementDate: '2026-10-31',
      statementBalance: '5420.50',
      clearedBalance: '5420.50',
      transactionIds: [
        '00000000-0000-0000-0000-000000000010',
        '00000000-0000-0000-0000-000000000011',
      ],
    };

    const parsed = ReconciliationCreateSchema.parse(valid);
    expect(parsed.statementBalance).toBe('5420.50');
    expect(parsed.clearedBalance).toBe('5420.50');
    expect(parsed.transactionIds).toHaveLength(2);
  });
});
