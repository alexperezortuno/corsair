import {applyHeaderModifications,} from '../domain/header.utils';

import type {BodyModification,} from '@/lib/rules/domain/rule.types';

import type {RequestDecision,} from '../domain/interception.types';

import type {RequestPipelineContext, RequestPipelineStage,} from '../domain/pipeline.types';

export class RequestRuleStage
    implements RequestPipelineStage {
    readonly name = 'request-rule-stage';

    async execute(
        context: RequestPipelineContext,
    ): Promise<RequestDecision> {
        const {rule, decision, logger} = context;
        const modification = rule.request;

        if (!modification.enabled) {
            return decision;
        }

        let result: RequestDecision = {
            ...decision,
            headers: applyHeaderModifications(
                decision.headers,
                modification.headers,
            ),
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

        if (modification.redirectUrl?.trim()) {
            result = {
                ...result,
                redirectUrl: modification.redirectUrl.trim(),
            };
        }

        if (modification.block) {
            result = {
                ...result,
                block: true,
            };
        }

        logger.debug('Modificación de request aplicada', {
            ruleId: rule.id,
            stage: this.name,
            block: result.block,
            redirectUrl: result.redirectUrl,
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