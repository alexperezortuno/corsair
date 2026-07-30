import type {CapturedNetworkRequest, CapturedNetworkResponse, NetworkInterceptorSession,} from './network.types';

export const NETWORK_EVENTS = {
    enabled: 'network.enabled',
    disabled: 'network.disabled',
    requestCaptured: 'network.request-captured',
    responseCaptured: 'network.response-captured',
    captureFailed: 'network.capture-failed',
} as const;

export interface NetworkEnabledPayload {
    session: NetworkInterceptorSession;
}

export interface NetworkDisabledPayload {
    tabId: number;
}

export interface NetworkRequestCapturedPayload {
    request: CapturedNetworkRequest;
}

export interface NetworkResponseCapturedPayload {
    response: CapturedNetworkResponse;
}

export interface NetworkCaptureFailedPayload {
    tabId?: number;
    interceptionId?: string;

    error: {
        name: string;
        message: string;
    };
}