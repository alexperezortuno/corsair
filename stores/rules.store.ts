import {computed, ref,} from 'vue';

import {defineStore,} from 'pinia';

import {getApplicationContainer,} from '@/lib/bootstrap/application-container';

import {TOKENS,} from '@/lib/core/tokens';

import {createDefaultRule,} from '@/lib/rules/domain/rule.factory';

import type {RuleService,} from '@/lib/rules/application/rule.service';

import type {InterceptionRule, RuleId,} from '@/lib/rules/domain/rule.types';

const container = getApplicationContainer();

const service =
    container.resolve<RuleService>(
        TOKENS.ruleService,
    );

export const useRulesStore = defineStore('rules', () => {
    const rules = ref<InterceptionRule[]>([]);
    const selectedRuleId = ref<RuleId | null>(null);
    const loading = ref(false);
    const error = ref<string | null>(null);

    const selectedRule = computed(() => {
        if (!selectedRuleId.value) {
            return null;
        }

        return (
            rules.value.find(
                (rule) => rule.id === selectedRuleId.value,
            ) ?? null
        );
    });

    const activeRulesCount = computed(
        () => rules.value.filter((rule) => rule.enabled).length,
    );

    async function loadRules(): Promise<void> {
        loading.value = true;
        error.value = null;

        try {
            rules.value = await service.getRules();

            if (
                selectedRuleId.value &&
                !rules.value.some(
                    (rule) => rule.id === selectedRuleId.value,
                )
            ) {
                selectedRuleId.value = null;
            }
        } catch (cause) {
            setError(cause);
        } finally {
            loading.value = false;
        }
    }

    async function createRule(): Promise<InterceptionRule> {
        const rule = createDefaultRule();

        await service.saveRule(rule);
        await loadRules();

        selectedRuleId.value = rule.id;

        return rule;
    }

    async function saveRule(
        rule: InterceptionRule,
    ): Promise<void> {
        error.value = null;

        try {
            await service.saveRule(rule);
            await loadRules();

            selectedRuleId.value = rule.id;
        } catch (cause) {
            setError(cause);
            throw cause;
        }
    }

    async function deleteRule(id: RuleId): Promise<void> {
        error.value = null;

        try {
            await service.deleteRule(id);

            if (selectedRuleId.value === id) {
                selectedRuleId.value = null;
            }

            await loadRules();
        } catch (cause) {
            setError(cause);
            throw cause;
        }
    }

    async function toggleRule(
        id: RuleId,
        enabled: boolean,
    ): Promise<void> {
        error.value = null;

        try {
            await service.toggleRule(id, enabled);
            await loadRules();
        } catch (cause) {
            setError(cause);
            throw cause;
        }
    }

    function selectRule(id: RuleId | null): void {
        selectedRuleId.value = id;
    }

    function setError(cause: unknown): void {
        error.value =
            cause instanceof Error
                ? cause.message
                : 'Ha ocurrido un error desconocido';
    }

    return {
        rules,
        selectedRuleId,
        selectedRule,
        activeRulesCount,
        loading,
        error,

        loadRules,
        createRule,
        saveRule,
        deleteRule,
        toggleRule,
        selectRule,
    };
});