import type {DebuggerSession,} from '../domain/debugger.types';

export const DEBUGGER_MESSAGE_TYPES = {
    attach: 'corsair.debugger.attach',
    detach: 'corsair.debugger.detach',
    status: 'corsair.debugger.status',
} as const;

export interface DebuggerAttachMessage {
    type: typeof DEBUGGER_MESSAGE_TYPES.attach;
    payload: {
        tabId: number;
    };
}

export interface DebuggerDetachMessage {
    type: typeof DEBUGGER_MESSAGE_TYPES.detach;
    payload: {
        tabId: number;
    };
}

export interface DebuggerStatusMessage {
    type: typeof DEBUGGER_MESSAGE_TYPES.status;
    payload: {
        tabId: number;
    };
}

export type DebuggerRuntimeMessage =
    | DebuggerAttachMessage
    | DebuggerDetachMessage
    | DebuggerStatusMessage;

export interface DebuggerAttachResult {
    session: DebuggerSession;
}

export interface DebuggerDetachResult {
    detached: boolean;
}

export interface DebuggerStatusResult {
    attached: boolean;
}

export type RuntimeSuccess<T> = {
    success: true;
    data: T;
};

export type RuntimeFailure = {
    success: false;
    error: {
        name: string;
        message: string;
    };
};

export type RuntimeResponse<T> =
    | RuntimeSuccess<T>
    | RuntimeFailure;

export function isDebuggerRuntimeMessage(
    value: unknown,
): value is DebuggerRuntimeMessage {
    if (
        typeof value !== 'object' ||
        value === null
    ) {
        return false;
    }

    const candidate = value as {
        type?: unknown;
        payload?: {
            tabId?: unknown;
        };
    };

    const knownType =
        candidate.type ===
        DEBUGGER_MESSAGE_TYPES.attach ||
        candidate.type ===
        DEBUGGER_MESSAGE_TYPES.detach ||
        candidate.type ===
        DEBUGGER_MESSAGE_TYPES.status;

    return (
        knownType &&
        Number.isInteger(candidate.payload?.tabId) &&
        Number(candidate.payload?.tabId) > 0
    );
}