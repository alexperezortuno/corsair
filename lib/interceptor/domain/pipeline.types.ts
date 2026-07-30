import type {Logger,} from '@/lib/core/logger';

import type {InterceptionRule,} from '@/lib/rules/domain/rule.types';

import type {InterceptionTransaction, RequestDecision, ResponseDecision,} from './interception.types';

export interface RequestPipelineContext {
    transaction: InterceptionTransaction;
    rule: InterceptionRule;
    decision: RequestDecision;
    logger: Logger;
}

export interface ResponsePipelineContext {
    transaction: InterceptionTransaction;
    rule: InterceptionRule;
    decision: ResponseDecision;
    logger: Logger;
}

export interface RequestPipelineStage {
    readonly name: string;

    execute(
        context: RequestPipelineContext,
    ): Promise<RequestDecision>;
}

export interface ResponsePipelineStage {
    readonly name: string;

    execute(
        context: ResponsePipelineContext,
    ): Promise<ResponseDecision>;
}