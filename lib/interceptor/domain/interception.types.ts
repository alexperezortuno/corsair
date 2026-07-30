import type {InterceptionRule, ResourceType, RuleId,} from '@/lib/rules/domain/rule.types';

export type HttpHeaders = Record<string, string>;

export interface InterceptedRequest {
    id: string;
    tabId?: number;

    url: string;
    method: string;
    resourceType?: ResourceType;

    headers: HttpHeaders;
    body?: string;

    timestamp: string;
}

export interface InterceptedResponse {
    requestId: string;

    url: string;
    statusCode: number;
    statusText?: string;

    headers: HttpHeaders;
    body?: string;

    timestamp: string;
}

export interface InterceptionTransaction {
    id: string;
    request: InterceptedRequest;
    response?: InterceptedResponse;

    matchedRuleIds: RuleId[];
    startedAt: string;
}

export interface RequestDecision {
    url: string;
    method: string;
    headers: HttpHeaders;
    body?: string;

    block: boolean;
    redirectUrl?: string;
}

export interface ResponseDecision {
    statusCode: number;
    statusText?: string;

    headers: HttpHeaders;
    body?: string;

    abort: boolean;
    delayMs: number;
}

export interface InterceptionResult {
    transactionId: string;

    request: RequestDecision;
    response?: ResponseDecision;

    matchedRules: InterceptionRule[];
    stoppedByRuleId?: RuleId;

    processedAt: string;
}