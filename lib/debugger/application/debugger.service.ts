import type {EventBus,} from '@/lib/core/event-bus';
import {createEvent,} from '@/lib/core/event-bus';

import {DEBUGGER_EVENTS,} from '../domain/debugger.events';

import type {Logger,} from '@/lib/core/logger';

import type {DebuggerGateway, DebuggerUnsubscribe,} from '../domain/debugger.gateway';

import type {
    DebuggerCommandParams,
    DebuggerCommandResult,
    DebuggerSession,
    DebuggerTarget,
} from '../domain/debugger.types';

export class DebuggerService {
    private readonly sessions =
        new Map<string, DebuggerSession>();

    private unsubscribeProtocolEvents:
        DebuggerUnsubscribe | null = null;

    private unsubscribeDetachEvents:
        DebuggerUnsubscribe | null = null;

    constructor(
        private readonly gateway: DebuggerGateway,
        private readonly eventBus: EventBus,
        private readonly logger: Logger,
    ) {
    }

    initialize(): void {
        if (
            this.unsubscribeProtocolEvents ||
            this.unsubscribeDetachEvents
        ) {
            return;
        }

        this.unsubscribeProtocolEvents =
            this.gateway.onEvent(async (event) => {
                await this.eventBus.publish(
                    createEvent(
                        DEBUGGER_EVENTS.protocolEvent,
                        {
                            event,
                        },
                    ),
                );
            });

        this.unsubscribeDetachEvents =
            this.gateway.onDetach(async (event) => {
                this.sessions.delete(
                    targetToKey(event.target),
                );

                await this.eventBus.publish(
                    createEvent(
                        DEBUGGER_EVENTS.detached,
                        {
                            event,
                        },
                    ),
                );

                this.logger.warn(
                    'Debugger detached',
                    {
                        target: event.target,
                        reason: event.reason,
                    },
                );
            });
    }

    async attachToTab(
        tabId: number,
    ): Promise<DebuggerSession> {
        const target: DebuggerTarget = {
            type: 'tab',
            tabId,
        };

        const key = targetToKey(target);

        const existingSession =
            this.sessions.get(key);

        if (existingSession) {
            return existingSession;
        }

        try {
            this.logger.info(
                'Checking debugger attachment state',
                { tabId },
            );

            const alreadyAttached =
                await this.gateway.isAttached(target);

            this.logger.info(
                'Debugger attachment state',
                {
                    tabId,
                    alreadyAttached,
                },
            );

            const session = alreadyAttached
                ? {
                    target,
                    protocolVersion: '1.3',
                    attachedAt: new Date().toISOString(),
                }
                : await this.attachWithRetry(target);

            this.sessions.set(key, session);

            await this.eventBus.publish(
                createEvent(
                    DEBUGGER_EVENTS.attached,
                    {
                        session,
                    },
                ),
            );

            this.logger.info(
                alreadyAttached
                    ? 'Debugger session resumed'
                    : 'Debugger attached to tab',
                {
                    tabId,
                    protocolVersion:
                    session.protocolVersion,
                },
            );

            return session;
        } catch (cause) {
            const error = normalizeError(cause);

            await this.eventBus.publish(
                createEvent(
                    DEBUGGER_EVENTS.attachFailed,
                    {
                        target,
                        error: {
                            name: error.name,
                            message: error.message,
                        },
                    },
                ),
            );

            this.logger.error(
                'Unable to attach debugger',
                error,
                {
                    tabId,
                },
            );

            throw error;
        }
    }

    async detachFromTab(
        tabId: number,
    ): Promise<void> {
        const target: DebuggerTarget = {
            type: 'tab',
            tabId,
        };

        const attached =
            await this.gateway.isAttached(target);

        if (!attached) {
            this.sessions.delete(
                targetToKey(target),
            );

            return;
        }

        await this.gateway.detach(target);

        this.sessions.delete(
            targetToKey(target),
        );

        this.logger.info(
            'Debugger manually detached',
            {
                tabId,
            },
        );
    }

    async isAttachedToTab(
        tabId: number,
    ): Promise<boolean> {
        return this.gateway.isAttached({
            type: 'tab',
            tabId,
        });
    }

    async sendCommand<
        TResult extends DebuggerCommandResult,
    >(
        tabId: number,
        method: string,
        params: DebuggerCommandParams = {},
    ): Promise<TResult> {
        const target: DebuggerTarget = {
            type: 'tab',
            tabId,
        };

        this.logger.debug(
            'Sending CDP command',
            {
                tabId,
                method,
            },
        );

        try {
            return await this.gateway.sendCommand<TResult>(
                target,
                method,
                params,
            );
        } catch (cause) {
            const error = normalizeError(cause);

            if (
                !error.message.includes(
                    'Debugger is not attached',
                )
            ) {
                throw error;
            }

            this.logger.warn(
                'CDP command failed, attempting re-attach',
                {
                    tabId,
                    method,
                    error: error.message,
                },
            );

            return this.sendCommandWithReattach(
                target,
                method,
                params,
            );
        }
    }

    private async sendCommandWithReattach<
        TResult extends DebuggerCommandResult,
    >(
        target: DebuggerTarget,
        method: string,
        params: DebuggerCommandParams,
    ): Promise<TResult> {
        let lastError: Error | null = null;

        for (let attempt = 0; attempt < 3; attempt += 1) {
            try {
                if (await this.gateway.isAttached(target)) {
                    await this.gateway.detach(target);
                    await wait(100);
                }

                await this.gateway.attach(target);
                await wait(100);

                return await this.gateway.sendCommand<TResult>(
                    target,
                    method,
                    params,
                );
            } catch (cause) {
                lastError = normalizeError(cause);

                this.logger.warn(
                    'Re-attach attempt failed',
                    {
                        tabId: target.tabId,
                        method,
                        attempt: attempt + 1,
                        error: lastError.message,
                    },
                );

                if (attempt < 2) {
                    await wait(200);
                }
            }
        }

        throw lastError ?? new Error('Re-attach failed');
    }

    getSessions(): DebuggerSession[] {
        return [...this.sessions.values()];
    }

    dispose(): void {
        this.unsubscribeProtocolEvents?.();
        this.unsubscribeDetachEvents?.();

        this.unsubscribeProtocolEvents = null;
        this.unsubscribeDetachEvents = null;
        this.sessions.clear();
    }

    private async attachWithRetry(
        target: DebuggerTarget,
    ): Promise<DebuggerSession> {
        let lastError: Error | null = null;

        for (let attempt = 0; attempt < 3; attempt += 1) {
            try {
                this.logger.info(
                    'Calling chrome.debugger.attach',
                    {
                        tabId: target.tabId,
                        attempt: attempt + 1,
                    },
                );

                const session =
                    await this.gateway.attach(target);

                this.logger.info(
                    'chrome.debugger.attach succeeded',
                    {
                        tabId: target.tabId,
                    },
                );

                return session;
            } catch (cause) {
                lastError = normalizeError(cause);

                this.logger.error(
                    'chrome.debugger.attach failed',
                    lastError,
                    {
                        tabId: target.tabId,
                        attempt: attempt + 1,
                    },
                );

                if (
                    attempt < 2 &&
                    !lastError.message.includes(
                        'Cannot access a chrome',
                    )
                ) {
                    await wait(150);
                }
            }
        }

        throw lastError ?? new Error('Debugger attach failed');
    }
}

function targetToKey(
    target: DebuggerTarget,
): string {
    switch (target.type) {
        case 'tab':
            return `tab:${target.tabId ?? 'unknown'}`;

        case 'extension':
            return `extension:${
                target.extensionId ?? 'unknown'
            }`;
    }
}

function normalizeError(cause: unknown): Error {
    if (cause instanceof Error) {
        return cause;
    }

    return new Error(String(cause));
}

interface RetryOptions<T> {
    attempts: number;
    delayMs: number;
    shouldRetry: (resultOrError: T | Error) => boolean;
}

async function withRetry<T>(
    task: () => Promise<T>,
    options: RetryOptions<T>,
): Promise<T> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < options.attempts; attempt += 1) {
        try {
            const result = await task();

            if (!options.shouldRetry(result)) {
                return result;
            }

            if (attempt < options.attempts - 1) {
                await wait(options.delayMs);
            }
        } catch (cause) {
            lastError = normalizeError(cause);

            if (
                attempt < options.attempts - 1 &&
                options.shouldRetry(lastError)
            ) {
                await wait(options.delayMs);
            } else {
                throw lastError;
            }
        }
    }

    throw lastError ?? new Error('Retry failed');
}

function wait(delayMs: number): Promise<void> {
    return new Promise((resolve) => {
        setTimeout(resolve, delayMs);
    });
}