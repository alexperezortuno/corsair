export type NetworkInterceptionStage =
    | 'request'
    | 'response';

export interface NetworkHeaderEntry {
    name: string;
    value: string;
}

export interface CapturedNetworkRequest {
    interceptionId: string;
    networkId?: string;

    tabId: number;
    frameId?: string;

    url: string;
    method: string;

    headers: Record<string, string>;
    postData?: string;

    resourceType?: string;
    stage: 'request';

    capturedAt: string;
}

export interface CapturedNetworkResponse {
    interceptionId: string;
    networkId?: string;

    tabId: number;
    frameId?: string;

    url: string;
    method: string;

    requestHeaders: Record<string, string>;

    statusCode: number;
    statusText?: string;

    responseHeaders: Record<string, string>;

    resourceType?: string;
    stage: 'response';

    capturedAt: string;
}

export type CapturedNetworkExchange =
    | CapturedNetworkRequest
    | CapturedNetworkResponse;

export interface NetworkInterceptorSession {
    tabId: number;
    enabledAt: string;
}