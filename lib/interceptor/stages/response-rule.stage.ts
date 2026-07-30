import {applyHeaderModifications,} from '../domain/header.utils';

import type {BodyModification,} from '@/lib/rules/domain/rule.types';

import type {ResponseDecision,} from '../domain/interception.types';

import type {ResponsePipelineContext, ResponsePipelineStage,} from '../domain/pipeline.types';

export class ResponseRuleStage
    implements ResponsePipelineStage {
    readonly name = 'response-rule-stage';

    async execute(
        context: ResponsePipelineContext,
    ): Promise<ResponseDecision> {
        const {rule, decision, logger} = context;
        const modification = rule.response;

        if (!modification.enabled) {
            return decision;
        }

        let result: ResponseDecision = {
            ...decision,

            headers: applyHeaderModifications(
                decision.headers,
                modification.headers,
            ),

            statusCode:
                modification.statusCode ??
                decision.statusCode,

            statusText:
                modification.statusText ??
                decision.statusText,

            abort:
                decision.abort ||
                modification.abort,

            delayMs:
                decision.delayMs +
                Math.max(0, modification.delayMs ?? 0),
        };

        if (modification.body) {
            result = {
                ...result,
                body: applyBodyModification(
                    result.body,
                    modification.body,
                ),
            };
        }

        logger.debug('Response modification applied', {
            ruleId: rule.id,
            stage: this.name,
            statusCode: result.statusCode,
            abort: result.abort,
            delayMs: result.delayMs,
        });

        return result;
    }
}

function applyBodyModification(
    currentBody: string | undefined,
    modification: BodyModification,
): string | undefined {
    const body = currentBody ?? '';

    switch (modification.mode) {
        case 'none':
            return currentBody;

        case 'static':
            return modification.staticValue ?? '';

        case 'full-replacement':
            return modification.replacement ?? '';

        case 'text-replace':
            if (!modification.search) {
                return body;
            }

            return body.replaceAll(
                modification.search,
                modification.replacement ?? '',
            );

        case 'regex-replace':
            if (!modification.search) {
                return body;
            }

            return body.replace(
                new RegExp(modification.search, 'g'),
                modification.replacement ?? '',
            );
    }
}