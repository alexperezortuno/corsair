import type {DebuggerDetachEvent, DebuggerProtocolEvent, DebuggerSession, DebuggerTarget,} from './debugger.types';

export const DEBUGGER_EVENTS = {
    attached: 'debugger.attached',
    detached: 'debugger.detached',
    protocolEvent: 'debugger.protocol-event',
    attachFailed: 'debugger.attach-failed',
} as const;

export interface DebuggerAttachedPayload {
    session: DebuggerSession;
}

export interface DebuggerDetachedPayload {
    event: DebuggerDetachEvent;
}

export interface DebuggerProtocolEventPayload {
    event: DebuggerProtocolEvent;
}

export interface DebuggerAttachFailedPayload {
    target: DebuggerTarget;
    error: {
        name: string;
        message: string;
    };
}