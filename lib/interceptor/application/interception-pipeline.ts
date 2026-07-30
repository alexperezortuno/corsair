import {matchesRule,} from '@/lib/rules/domain/rule.matcher';

import type {Logger,} from '@/lib/core/logger';

import type {InterceptionRule,} from '@/lib/rules/domain/rule.types';

import type {
    InterceptionResult,
    InterceptionTransaction,
    RequestDecision,
    ResponseDecision,
} from '../domain/interception.types';

import type {RequestPipelineStage, ResponsePipelineStage,} from '../domain/pipeline.types';

export class InterceptionPipeline {
    constructor(
        private readonly requestStages:
        RequestPipelineStage[],
        private readonly responseStages:
        ResponsePipelineStage[],
        private readonly logger: Logger,
    ) {
    }

    async execute(
        transaction: InterceptionTransaction,
        rules: InterceptionRule[],
    ): Promise<InterceptionResult> {
        const applicableRules = this.findApplicableRules(
            transaction,
            rules,
        );

        let requestDecision =
            this.createInitialRequestDecision(transaction);

        let responseDecision =
            this.createInitialResponseDecision(transaction);

        let stoppedByRuleId: string | undefined;

        for (const rule of applicableRules) {
            requestDecision =
                await this.executeRequestStages(
                    transaction,
                    rule,
                    requestDecision,
                );

            if (responseDecision) {
                responseDecision =
                    await this.executeResponseStages(
                        transaction,
                        rule,
                        responseDecision,
                    );
            }

            if (rule.stopProcessing) {
                stoppedByRuleId = rule.id;
                break;
            }
        }

        const matchedRules = stoppedByRuleId
            ? this.rulesUntilStop(
                applicableRules,
                stoppedByRuleId,
            )
            : applicableRules;

        this.logger.info(
            'Pipeline de interceptación ejecutado',
            {
                transactionId: transaction.id,
                matchingRules: matchedRules.length,
                stoppedByRuleId,
            },
        );

        return {
            transactionId: transaction.id,
            request: requestDecision,
            response: responseDecision,
            matchedRules,
            stoppedByRuleId,
            processedAt: new Date().toISOString(),
        };
    }

    private findApplicableRules(
        transaction: InterceptionTransaction,
        rules: InterceptionRule[],
    ): InterceptionRule[] {
        return [...rules]
            .filter((rule) =>
                matchesRule(
                    {
                        url: transaction.request.url,
                        method: transaction.request.method,
                        resourceType:
                        transaction.request.resourceType,
                    },
                    rule,
                ),
            )
            .sort(
                (firstRule, secondRule) =>
                    secondRule.priority -
                    firstRule.priority,
            );
    }

    private createInitialRequestDecision(
        transaction: InterceptionTransaction,
    ): RequestDecision {
        return {
            url: transaction.request.url,
            method: transaction.request.method,
            headers: {
                ...transaction.request.headers,
            },
            body: transaction.request.body,
            block: false,
        };
    }

    private createInitialResponseDecision(
        transaction: InterceptionTransaction,
    ): ResponseDecision | undefined {
        const response = transaction.response;

        if (!response) {
            return undefined;
        }

        return {
            statusCode: response.statusCode,
            statusText: response.statusText,
            headers: {
                ...response.headers,
            },
            body: response.body,
            abort: false,
            delayMs: 0,
        };
    }

    private async executeRequestStages(
        transaction: InterceptionTransaction,
        rule: InterceptionRule,
        initialDecision: RequestDecision,
    ): Promise<RequestDecision> {
        let decision = initialDecision;

        for (const stage of this.requestStages) {
            decision = await stage.execute({
                transaction,
                rule,
                decision,
                logger: this.logger,
            });
        }

        return decision;
    }

    private async executeResponseStages(
        transaction: InterceptionTransaction,
        rule: InterceptionRule,
        initialDecision: ResponseDecision,
    ): Promise<ResponseDecision> {
        let decision = initialDecision;

        for (const stage of this.responseStages) {
            decision = await stage.execute({
                transaction,
                rule,
                decision,
                logger: this.logger,
            });
        }

        return decision;
    }

    private rulesUntilStop(
        rules: InterceptionRule[],
        stoppedByRuleId: string,
    ): InterceptionRule[] {
        const stopIndex = rules.findIndex(
            (rule) => rule.id === stoppedByRuleId,
        );

        if (stopIndex === -1) {
            return rules;
        }

        return rules.slice(0, stopIndex + 1);
    }
}