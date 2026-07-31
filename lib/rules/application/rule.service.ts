import {RuleValidationError,} from '@/lib/core/errors';

import type {EventBus,} from '@/lib/core/event-bus';
import {createEvent,} from '@/lib/core/event-bus';

import {RULE_EVENTS,} from '../domain/rule.events';

import type {Logger,} from '@/lib/core/logger';

import type {RuleRepository,} from '../domain/rule.repository';

import type {InterceptionRule, RuleId,} from '../domain/rule.types';

export class RuleService {
    constructor(
        private readonly repository: RuleRepository,
        private readonly eventBus: EventBus,
        private readonly logger: Logger,
    ) {
    }

    async getRules(): Promise<InterceptionRule[]> {
        const rules = await this.repository.findAll();

        return [...rules].sort(
            (a, b) => b.priority - a.priority,
        );
    }

    async getRule(
        id: RuleId,
    ): Promise<InterceptionRule | null> {
        return this.repository.findById(id);
    }

    async saveRule(
        rule: InterceptionRule,
    ): Promise<void> {
        this.validateRule(rule);

        const existingRule =
            await this.repository.findById(rule.id);

        const ruleToSave: InterceptionRule = {
            ...rule,
            updatedAt: new Date().toISOString(),
        };

        await this.repository.save(ruleToSave);

        const eventType = existingRule
            ? RULE_EVENTS.updated
            : RULE_EVENTS.created;

        await this.eventBus.publish(
            createEvent(eventType, {
                rule: ruleToSave,
            }),
        );

        this.logger.info(
            existingRule
                ? 'Rule updated'
                : 'Rule created',
            {
                ruleId: rule.id,
                ruleName: rule.name,
            },
        );
    }

    async deleteRule(id: RuleId): Promise<void> {
        const existingRule =
            await this.repository.findById(id);

        if (!existingRule) {
            return;
        }

        await this.repository.delete(id);

        await this.eventBus.publish(
            createEvent(RULE_EVENTS.deleted, {
                ruleId: id,
            }),
        );

        this.logger.info('Rule deleted', {
            ruleId: id,
            ruleName: existingRule.name,
        });
    }

    async toggleRule(
        id: RuleId,
        enabled: boolean,
    ): Promise<void> {
        const rule = await this.repository.findById(id);

        if (!rule) {
            throw new RuleValidationError(
                `Rule ${id} does not exist`,
                {
                    ruleId: id,
                },
            );
        }

        const updatedRule: InterceptionRule = {
            ...rule,
            enabled,
            updatedAt: new Date().toISOString(),
        };

        await this.repository.save(updatedRule);

        await this.eventBus.publish(
            createEvent(RULE_EVENTS.toggled, {
                ruleId: id,
                enabled,
            }),
        );

        this.logger.info(
            enabled
                ? 'Rule enabled'
                : 'Rule disabled',
            {
                ruleId: id,
            },
        );
    }

    private validateRule(
        rule: InterceptionRule,
    ): void {
        if (!rule.name.trim()) {
            throw new RuleValidationError(
                'Rule name is required',
            );
        }

        if (!Number.isInteger(rule.priority)) {
            throw new RuleValidationError(
                'Priority must be an integer',
                {
                    priority: rule.priority,
                },
            );
        }

        if (rule.priority < 0) {
            throw new RuleValidationError(
                'Priority cannot be negative',
                {
                    priority: rule.priority,
                },
            );
        }

        const conditions = [
            rule.target.url,
            rule.target.domain,
            rule.target.path,
        ];

        for (const condition of conditions) {
            if (
                condition?.type === 'regex' &&
                condition.pattern.trim()
            ) {
                this.validateRegularExpression(
                    condition.pattern,
                );
            }
        }

        const requestBody = rule.request.body;
        const responseBody = rule.response.body;

        if (
            requestBody?.mode === 'regex-replace' &&
            requestBody.search
        ) {
            this.validateRegularExpression(
                requestBody.search,
            );
        }

        if (
            responseBody?.mode === 'regex-replace' &&
            responseBody.search
        ) {
            this.validateRegularExpression(
                responseBody.search,
            );
        }
    }

    private validateRegularExpression(
        pattern: string,
    ): void {
        try {
            new RegExp(pattern);
        } catch (cause) {
            throw new RuleValidationError(
                'Regular expression is not valid',
                {
                    pattern,
                    cause:
                        cause instanceof Error
                            ? cause.message
                            : String(cause),
                },
            );
        }
    }
}