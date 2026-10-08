import { describe, it, expect } from 'vitest';
import {
  WorkspaceCreateSchema,
  WorkspaceUpdateSchema,
  WorkspaceMemberInviteSchema,
} from '../src/schemas';

describe('Workspace Schemas', () => {
  it('validates a valid workspace creation payload', () => {
    const valid = {
      name: 'Family Budget',
      type: 'household',
      baseCurrency: 'AED',
      timezone: 'Asia/Dubai',
      monthStartDay: 1,
      budgetingStyle: 'limit_based',
    };

    const parsed = WorkspaceCreateSchema.parse(valid);
    expect(parsed.name).toBe('Family Budget');
    expect(parsed.type).toBe('household');
    expect(parsed.baseCurrency).toBe('AED');
  });

  it('rejects invalid workspace types or invalid month start day', () => {
    expect(() =>
      WorkspaceCreateSchema.parse({
        name: 'Bad Space',
        type: 'invalid_type',
        baseCurrency: 'USD',
      })
    ).toThrow();

    expect(() =>
      WorkspaceCreateSchema.parse({
        name: 'Bad Day Space',
        type: 'personal',
        baseCurrency: 'USD',
        monthStartDay: 32,
      })
    ).toThrow();
  });

  it('validates partial workspace updates', () => {
    const update = {
      name: 'Renamed Space',
      monthStartDay: 15,
    };

    const parsed = WorkspaceUpdateSchema.parse(update);
    expect(parsed.name).toBe('Renamed Space');
    expect(parsed.monthStartDay).toBe(15);
  });

  it('validates member invitations with roles', () => {
    const invite = {
      email: 'collaborator@example.com',
      role: 'admin',
    };

    const parsed = WorkspaceMemberInviteSchema.parse(invite);
    expect(parsed.email).toBe('collaborator@example.com');
    expect(parsed.role).toBe('admin');

    expect(() =>
      WorkspaceMemberInviteSchema.parse({
        email: 'not-an-email',
        role: 'member',
      })
    ).toThrow();
  });
});
