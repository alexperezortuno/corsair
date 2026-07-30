import type {DebuggerProtocolEvent,} from '@/lib/debugger/domain/debugger.types';

import type {CapturedNetworkExchange, NetworkInterceptorSession,} from './network.types';

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

    parseProtocolEvent(
        event: DebuggerProtocolEvent,
    ): CapturedNetworkExchange | null;
}