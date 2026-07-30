import type {DebuggerProtocolEvent,} from '@/lib/debugger/domain/debugger.types';

import type {
    CapturedNetworkExchange,
    CapturedResponseBody,
    FulfillResponseDecision,
    NetworkInterceptorSession,
} from './network.types';

export type NetworkCaptureHandler = (
    exchange: CapturedNetworkExchange,
) => void | Promise<void>;

export type NetworkGatewayUnsubscribe = () => void;

export interface NetworkGateway {
    enable(
        tabId: number,
    ): Promise<NetworkInterceptorSession>;

    disable(
        tabId: number,
    ): Promise<void>;

    continuePausedRequest(
        tabId: number,
        interceptionId: string,
    ): Promise<void>;

    failPausedRequest(
        tabId: number,
        interceptionId: string,
    ): Promise<void>;

    readResponseBody(
        tabId: number,
        interceptionId: string,
    ): Promise<CapturedResponseBody>;

    fulfillPausedResponse(
        tabId: number,
        interceptionId: string,
        decision: FulfillResponseDecision,
    ): Promise<void>;

    parseProtocolEvent(
        event: DebuggerProtocolEvent,
    ): CapturedNetworkExchange | null;
}
