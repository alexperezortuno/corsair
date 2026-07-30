export type DebuggerTargetType =
    | 'tab'
    | 'extension';

export interface DebuggerTarget {
    type: DebuggerTargetType;
    tabId?: number;
    extensionId?: string;
}

export interface DebuggerSession {
    target: DebuggerTarget;
    protocolVersion: string;
    attachedAt: string;
}

export type DebuggerCommandParams =
    Record<string, unknown>;

export type DebuggerCommandResult =
    Record<string, unknown>;

export interface DebuggerProtocolEvent {
    target: DebuggerTarget;
    method: string;
    params: Record<string, unknown>;
    occurredAt: string;
}

export interface DebuggerDetachEvent {
    target: DebuggerTarget;
    reason: string;
    occurredAt: string;
}