import type {RuleRepository} from '../domain/rule.repository';

import type {InterceptionRule, RuleId,} from '../domain/rule.types';

const STORAGE_KEY = 'corsair.interceptionRules';

interface RuleStorageSchema {
    [STORAGE_KEY]?: InterceptionRule[];
}

export class ChromeRuleRepository implements RuleRepository {
    async findAll(): Promise<InterceptionRule[]> {
        const result =
            await chrome.storage.local.get(STORAGE_KEY) as RuleStorageSchema;

        const rules = result[STORAGE_KEY];

        if (!Array.isArray(rules)) {
            return [];
        }

        return rules;
    }

    async findById(id: RuleId): Promise<InterceptionRule | null> {
        const rules = await this.findAll();

        return rules.find((rule) => rule.id === id) ?? null;
    }

    async save(rule: InterceptionRule): Promise<void> {
        const rules = await this.findAll();

        const index = rules.findIndex(
            (existingRule) => existingRule.id === rule.id,
        );

        const updatedRule: InterceptionRule = {
            ...rule,
            updatedAt: new Date().toISOString(),
        };

        if (index === -1) {
            rules.push(updatedRule);
        } else {
            rules[index] = updatedRule;
        }

        await this.saveAll(rules);
    }

    async saveAll(rules: InterceptionRule[]): Promise<void> {
        await chrome.storage.local.set({
            [STORAGE_KEY]: rules,
        });
    }

    async delete(id: RuleId): Promise<void> {
        const rules = await this.findAll();

        const remainingRules = rules.filter(
            (rule) => rule.id !== id,
        );

        await this.saveAll(remainingRules);
    }

    async clear(): Promise<void> {
        await chrome.storage.local.remove(STORAGE_KEY);
    }
}