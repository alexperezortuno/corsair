import type {EventBus, Unsubscribe,} from '@/lib/core/event-bus';
import {createEvent,} from '@/lib/core/event-bus';

import type {DebuggerProtocolEventPayload,} from '@/lib/debugger/domain/debugger.events';
import {DEBUGGER_EVENTS,} from '@/lib/debugger/domain/debugger.events';

import {NETWORK_EVENTS,} from '../domain/network.events';

import type {Logger,} from '@/lib/core/logger';

import type {NetworkGateway,} from '../domain/network.gateway';

import type {CapturedNetworkExchange,} from '../domain/network.types';

export class NetworkInterceptorService {
    private readonly enabledTabs =
        new Set<number>();

    private unsubscribeProtocolEvents:
        Unsubscribe | null = null;

    constructor(
        private readonly gateway:
        NetworkGateway,
        private readonly eventBus:
        EventBus,
        private readonly logger:
        Logger,
    ) {
    }

    initialize(): void {
        if (this.unsubscribeProtocolEvents) {
            return;
        }

        this.unsubscribeProtocolEvents =
            this.eventBus.subscribe<
                DebuggerProtocolEventPayload
            >(
                DEBUGGER_EVENTS.protocolEvent,
                async ({payload}) => {
                    await this.handleProtocolEvent(
                        payload.event,
                    );
                },
            );
    }

    async enableForTab(
        tabId: number,
    ): Promise<void> {
        if (this.enabledTabs.has(tabId)) {
            return;
        }

        const session =
            await this.gateway.enable(tabId);

        this.enabledTabs.add(tabId);

        await this.eventBus.publish(
            createEvent(
                NETWORK_EVENTS.enabled,
                {
                    session,
                },
            ),
        );

        this.logger.info(
            'Interceptación de red habilitada',
            {
                tabId,
            },
        );
    }

    async disableForTab(
        tabId: number,
    ): Promise<void> {
        if (!this.enabledTabs.has(tabId)) {
            return;
        }

        try {
            await this.gateway.disable(tabId);
        } finally {
            this.enabledTabs.delete(tabId);
        }

        await this.eventBus.publish(
            createEvent(
                NETWORK_EVENTS.disabled,
                {
                    tabId,
                },
            ),
        );

        this.logger.info(
            'Interceptación de red deshabilitada',
            {
                tabId,
            },
        );
    }

    isEnabledForTab(
        tabId: number,
    ): boolean {
        return this.enabledTabs.has(tabId);
    }

    dispose(): void {
        this.unsubscribeProtocolEvents?.();
        this.unsubscribeProtocolEvents = null;

        this.enabledTabs.clear();
    }

    forgetTab(
        tabId: number,
    ): void {
        this.enabledTabs.delete(tabId);

        this.logger.debug(
            'Estado local de red eliminado',
            {
                tabId,
            },
        );
    }

    private async handleProtocolEvent(
        event: Parameters<
            NetworkGateway['parseProtocolEvent']
        >[0],
    ): Promise<void> {
        let exchange:
            CapturedNetworkExchange | null = null;

        try {
            exchange =
                this.gateway.parseProtocolEvent(
                    event,
                );

            if (!exchange) {
                return;
            }

            if (shouldIgnoreUrl(exchange.url)) {
                return;
            }

            await this.publishCapture(exchange);
        } catch (cause) {
            const error =
                normalizeError(cause);

            await this.eventBus.publish(
                createEvent(
                    NETWORK_EVENTS.captureFailed,
                    {
                        tabId:
                            event.target.type === 'tab'
                                ? event.target.tabId
                                : undefined,

                        error: {
                            name: error.name,
                            message: error.message,
                        },
                    },
                ),
            );

            this.logger.error(
                'No fue posible procesar el evento de red',
                error,
                {
                    method: event.method,
                    target: event.target,
                },
            );
        } finally {
            await this.continueIfPaused(
                event,
                exchange?.interceptionId,
            );
        }
    }

    private async publishCapture(
        exchange: CapturedNetworkExchange,
    ): Promise<void> {
        if (exchange.stage === 'request') {
            await this.eventBus.publish(
                createEvent(
                    NETWORK_EVENTS.requestCaptured,
                    {
                        request: exchange,
                    },
                ),
            );

            this.logger.debug(
                'Request capturado',
                {
                    tabId: exchange.tabId,
                    method: exchange.method,
                    url: exchange.url,
                    resourceType:
                    exchange.resourceType,
                },
            );

            return;
        }

        await this.eventBus.publish(
            createEvent(
                NETWORK_EVENTS.responseCaptured,
                {
                    response: exchange,
                },
            ),
        );

        this.logger.debug(
            'Response capturado',
            {
                tabId: exchange.tabId,
                method: exchange.method,
                url: exchange.url,
                statusCode:
                exchange.statusCode,
            },
        );
    }

    private async continueIfPaused(
        event: Parameters<
            NetworkGateway['parseProtocolEvent']
        >[0],
        knownInterceptionId?: string,
    ): Promise<void> {
        if (
            event.method !==
            'Fetch.requestPaused'
        ) {
            return;
        }

        if (
            event.target.type !== 'tab' ||
            event.target.tabId === undefined
        ) {
            return;
        }

        const interceptionId =
            knownInterceptionId ??
            readRequestId(event.params);

        if (!interceptionId) {
            this.logger.error(
                'No se pudo continuar una solicitud pausada',
                undefined,
                {
                    tabId: event.target.tabId,
                },
            );

            return;
        }

        try {
            await this.gateway
                .continuePausedRequest(
                    event.target.tabId,
                    interceptionId,
                );
        } catch (cause) {
            this.logger.error(
                'No fue posible continuar el request',
                cause,
                {
                    tabId: event.target.tabId,
                    interceptionId,
                },
            );
        }
    }
}

function readRequestId(
    params: Record<string, unknown>,
): string | undefined {
    return typeof params.requestId === 'string'
        ? params.requestId
        : undefined;
}

function normalizeError(
    cause: unknown,
): Error {
    if (cause instanceof Error) {
        return cause;
    }

    return new Error(String(cause));
}

function shouldIgnoreUrl(
    url: string | null,
): boolean {
    if (url === null) {
        return false;
    }

    return (
        url.startsWith('chrome-extension://') ||
        url.startsWith('devtools://') ||
        url.startsWith('chrome://') ||
        url.startsWith('data:') ||
        url.startsWith('blob:')
    );
}