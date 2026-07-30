export type RuleId = string;

export type MatchType =
    | 'exact'
    | 'contains'
    | 'wildcard'
    | 'regex';

export type HttpMethod =
    | 'GET'
    | 'POST'
    | 'PUT'
    | 'PATCH'
    | 'DELETE'
    | 'OPTIONS'
    | 'HEAD';

export type ResourceType =
    | 'Document'
    | 'Stylesheet'
    | 'Image'
    | 'Media'
    | 'Font'
    | 'Script'
    | 'XHR'
    | 'Fetch'
    | 'WebSocket'
    | 'Other';

export interface MatchCondition {
    type: MatchType;
    pattern: string;
    caseSensitive: boolean;
}

export interface RuleTarget {
    url?: MatchCondition;
    domain?: MatchCondition;
    path?: MatchCondition;
    methods: HttpMethod[];
    resourceTypes: ResourceType[];
}

export type HeaderOperation =
    | 'set'
    | 'append'
    | 'remove';

export interface HeaderModification {
    operation: HeaderOperation;
    name: string;
    value?: string;
}

export type BodyModificationMode =
    | 'none'
    | 'static'
    | 'text-replace'
    | 'regex-replace'
    | 'full-replacement';

export interface BodyModification {
    mode: BodyModificationMode;
    search?: string;
    replacement?: string;
    staticValue?: string;
    contentType?: string;
}

export interface RequestModification {
    enabled: boolean;
    headers: HeaderModification[];
    body?: BodyModification;
    block: boolean;
    redirectUrl?: string;
}

export interface ResponseModification {
    enabled: boolean;
    statusCode?: number;
    statusText?: string;
    headers: HeaderModification[];
    body?: BodyModification;
    delayMs?: number;
    abort: boolean;
}

export interface InterceptionRule {
    id: RuleId;
    name: string;
    description: string;

    enabled: boolean;
    priority: number;
    stopProcessing: boolean;

    target: RuleTarget;
    request: RequestModification;
    response: ResponseModification;

    createdAt: string;
    updatedAt: string;
}