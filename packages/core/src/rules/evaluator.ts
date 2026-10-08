import { Rule, RuleCondition } from '../types';

export interface CandidateTransaction {
  type: string;
  payeeName?: string;
  notes?: string;
  amount?: string | number;
  categoryId?: string | null;
  accountId?: string;
  status?: string;
  tagIds?: string[];
}

export interface RuleEvaluationResult {
  modified: CandidateTransaction;
  appliedRuleIds: string[];
}

function matchesCondition(candidate: CandidateTransaction, condition: RuleCondition): boolean {
  let targetVal = '';
  if (condition.field === 'payee_name') {
    targetVal = candidate.payeeName || '';
  } else if (condition.field === 'notes') {
    targetVal = candidate.notes || '';
  } else if (condition.field === 'type') {
    targetVal = candidate.type || '';
  } else if (condition.field === 'amount') {
    targetVal = String(candidate.amount || '0');
  }

  const needle = condition.value.trim().toLowerCase();
  const haystack = targetVal.trim().toLowerCase();

  switch (condition.operator) {
    case 'contains':
      return haystack.includes(needle);
    case 'equals':
      return haystack === needle;
    case 'starts_with':
      return haystack.startsWith(needle);
    case 'ends_with':
      return haystack.endsWith(needle);
    case 'greater_than': {
      const numHay = parseFloat(haystack);
      const numNeedle = parseFloat(needle);
      return !isNaN(numHay) && !isNaN(numNeedle) && numHay > numNeedle;
    }
    case 'less_than': {
      const numHay = parseFloat(haystack);
      const numNeedle = parseFloat(needle);
      return !isNaN(numHay) && !isNaN(numNeedle) && numHay < numNeedle;
    }
    default:
      return false;
  }
}

export function evaluateRules(
  rules: Rule[],
  candidate: CandidateTransaction
): RuleEvaluationResult {
  const result: CandidateTransaction = {
    ...candidate,
    tagIds: [...(candidate.tagIds || [])],
  };
  const appliedRuleIds: string[] = [];

  // Sort rules by priority ascending (1 is highest priority)
  const activeSortedRules = [...rules]
    .filter((r) => r.active)
    .sort((a, b) => a.priority - b.priority);

  for (const rule of activeSortedRules) {
    if (!rule.conditions || rule.conditions.length === 0) continue;

    const allConditionsMatch = rule.conditions.every((cond) =>
      matchesCondition(result, cond)
    );

    if (allConditionsMatch) {
      appliedRuleIds.push(rule.id);

      for (const action of rule.actions || []) {
        if (action.type === 'set_category') {
          result.categoryId = action.value;
        } else if (action.type === 'set_account') {
          result.accountId = action.value;
        } else if (action.type === 'add_tag') {
          if (!result.tagIds?.includes(action.value)) {
            result.tagIds = [...(result.tagIds || []), action.value];
          }
        } else if (action.type === 'mark_cleared') {
          result.status = 'cleared';
        }
      }
    }
  }

  return {
    modified: result,
    appliedRuleIds,
  };
}
