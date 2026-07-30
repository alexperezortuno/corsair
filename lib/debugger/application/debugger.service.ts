import type {EventBus,} from '@/lib/core/event-bus';
import {createEvent,} from '@/lib/core/event-bus';

import {DEBUGGER_EVENTS,} from '../domain/debugger.events';

import type {Logger,} from '@/lib/core/logger';

import type {DebuggerGateway, DebuggerUnsubscribe,} from '../domain/debugger.gateway';

import type {DebuggerSession, DebuggerTarget,} from '../domain/debugger.types';

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
                    'Debugger desconectado',
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

        const existingSession =
            this.sessions.get(targetToKey(target));

        if (existingSession) {
            return existingSession;
        }

        try {
            const session =
                await this.gateway.attach(target);

            this.sessions.set(
                targetToKey(target),
                session,
            );

            await this.eventBus.publish(
                createEvent(
                    DEBUGGER_EVENTS.attached,
                    {
                        session,
                    },
                ),
            );

            this.logger.info(
                'Debugger conectado a pestaña',
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
                'No fue posible conectar el debugger',
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

        const key = targetToKey(target);

        if (!this.sessions.has(key)) {
            return;
        }

        await this.gateway.detach(target);

        this.sessions.delete(key);

        this.logger.info(
            'Debugger desconectado manualmente',
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