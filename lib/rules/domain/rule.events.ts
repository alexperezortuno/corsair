import type {InterceptionRule, RuleId,} from './rule.types';

export const RULE_EVENTS = {
    created: 'rules.created',
    updated: 'rules.updated',
    deleted: 'rules.deleted',
    toggled: 'rules.toggled',
} as const;

export interface RuleCreatedPayload {
    rule: InterceptionRule;
}

export interface RuleUpdatedPayload {
    rule: InterceptionRule;
}

export interface RuleDeletedPayload {
    ruleId: RuleId;
}

export interface RuleToggledPayload {
    ruleId: RuleId;
    enabled: boolean;
}