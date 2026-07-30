import type {InterceptionResult, InterceptionTransaction,} from './interception.types';

export const INTERCEPTION_EVENTS = {
    started: 'interception.started',
    completed: 'interception.completed',
    failed: 'interception.failed',
} as const;

export interface InterceptionStartedPayload {
    transaction: InterceptionTransaction;
}

export interface InterceptionCompletedPayload {
    transaction: InterceptionTransaction;
    result: InterceptionResult;
}

export interface InterceptionFailedPayload {
    transactionId: string;
    error: {
        name: string;
        message: string;
    };
}