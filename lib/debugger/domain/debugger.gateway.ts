import type {
    DebuggerCommandParams,
    DebuggerCommandResult,
    DebuggerDetachEvent,
    DebuggerProtocolEvent,
    DebuggerSession,
    DebuggerTarget,
} from './debugger.types';

export type DebuggerEventHandler = (
    event: DebuggerProtocolEvent,
) => void | Promise<void>;

export type DebuggerDetachHandler = (
    event: DebuggerDetachEvent,
) => void | Promise<void>;

export type DebuggerUnsubscribe = () => void;

export interface DebuggerGateway {
    attach(
        target: DebuggerTarget,
        protocolVersion?: string,
    ): Promise<DebuggerSession>;

    detach(
        target: DebuggerTarget,
    ): Promise<void>;

    isAttached(
        target: DebuggerTarget,
    ): Promise<boolean>;

    sendCommand<TResult extends DebuggerCommandResult>(
        target: DebuggerTarget,
        method: string,
        params?: DebuggerCommandParams,
    ): Promise<TResult>;

    onEvent(
        handler: DebuggerEventHandler,
    ): DebuggerUnsubscribe;

    onDetach(
        handler: DebuggerDetachHandler,
    ): DebuggerUnsubscribe;
}