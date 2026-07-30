import type {EventBus,} from '@/lib/core/event-bus';
import {createEvent,} from '@/lib/core/event-bus';

import {INTERCEPTION_EVENTS,} from '../domain/interception.events';

import type {Logger,} from '@/lib/core/logger';

import type {RuleService,} from '@/lib/rules/application/rule.service';

import type {InterceptionPipeline,} from './interception-pipeline';

import type {InterceptionResult, InterceptionTransaction,} from '../domain/interception.types';

export class InterceptionService {
    constructor(
        private readonly ruleService: RuleService,
        private readonly pipeline: InterceptionPipeline,
        private readonly eventBus: EventBus,
        private readonly logger: Logger,
    ) {
    }

    async intercept(
        transaction: InterceptionTransaction,
    ): Promise<InterceptionResult> {
        await this.eventBus.publish(
            createEvent(
                INTERCEPTION_EVENTS.started,
                {
                    transaction,
                },
            ),
        );

        this.logger.debug(
            'Interception started',
            {
                transactionId: transaction.id,
                requestUrl: transaction.request.url,
                requestMethod: transaction.request.method,
            },
        );

        try {
            const rules =
                await this.ruleService.getRules();

            const result =
                await this.pipeline.execute(
                    transaction,
                    rules,
                );

            await this.eventBus.publish(
                createEvent(
                    INTERCEPTION_EVENTS.completed,
                    {
                        transaction,
                        result,
                    },
                ),
            );

            this.logger.info(
                'Interception completed',
                {
                    transactionId: transaction.id,
                    matchedRules: result.matchedRules.length,
                    blocked: result.request.block,
                    responseAborted:
                        result.response?.abort ?? false,
                },
            );

            return result;
        } catch (cause) {
            const error = normalizeError(cause);

            await this.eventBus.publish(
                createEvent(
                    INTERCEPTION_EVENTS.failed,
                    {
                        transactionId: transaction.id,
                        error: {
                            name: error.name,
                            message: error.message,
                        },
                    },
                ),
            );

            this.logger.error(
                'Interception failed',
                error,
                {
                    transactionId: transaction.id,
                },
            );

            throw error;
        }
    }
}

function normalizeError(cause: unknown): Error {
    if (cause instanceof Error) {
        return cause;
    }

    return new Error(String(cause));
}