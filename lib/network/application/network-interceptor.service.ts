import type {EventBus, Unsubscribe,} from '@/lib/core/event-bus';
import {createEvent,} from '@/lib/core/event-bus';

import type {DebuggerProtocolEventPayload,} from '@/lib/debugger/domain/debugger.events';
import {DEBUGGER_EVENTS,} from '@/lib/debugger/domain/debugger.events';

import {NETWORK_EVENTS,} from '../domain/network.events';

import type {Logger,} from '@/lib/core/logger';

import type {
    InterceptionService,
} from '@/lib/interceptor/application/interception.service';

import type {
    InterceptionTransaction,
    ResponseDecision,
} from '@/lib/interceptor/domain/interception.types';

import type {
    ResourceType,
} from '@/lib/rules/domain/rule.types';

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

        private readonly interceptionService:
        InterceptionService,

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
            'Network interception enabled',
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
            'Network interception disabled',
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
            'Local network state cleared',
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

        let pausedRequestHandled = false;

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

            pausedRequestHandled =
                await this.applyRulesToResponse(
                    exchange,
                );
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
                'Unable to process network event',
                error,
                {
                    method: event.method,
                    target: event.target,
                },
            );
        } finally {
            if (!pausedRequestHandled) {
                await this.continueIfPaused(
                    event,
                    exchange?.interceptionId,
                );
            }
        }
    }

    private async applyRulesToResponse(
        exchange: CapturedNetworkExchange,
    ): Promise<boolean> {
        if (exchange.stage !== 'response') {
            return false;
        }

        const responseBody =
            await this.gateway.readResponseBody(
                exchange.tabId,
                exchange.interceptionId,
            );

        const transaction =
            this.createTransaction(
                exchange,
                responseBody.body,
            );

        const result =
            await this.interceptionService.intercept(
                transaction,
            );

        if (!result.response) {
            return false;
        }

        if (result.response.delayMs > 0) {
            await wait(result.response.delayMs);
        }

        if (result.response.abort) {
            await this.gateway.failPausedRequest(
                exchange.tabId,
                exchange.interceptionId,
            );

            this.logger.info(
                'Response aborted by rule',
                {
                    tabId: exchange.tabId,
                    url: exchange.url,
                    matchedRules:
                        result.matchedRules.length,
                },
            );

            broadcastNetworkLog({
                type: 'responseAborted',
                url: exchange.url,
                statusCode: exchange.statusCode,
                matchedRules: result.matchedRules.length,
            });

            return true;
        }

        if (
            !hasMeaningfulResponseChange(
                exchange,
                responseBody.body,
                result.response,
            )
        ) {
            return false;
        }

        const decision =
            toFulfillDecision(
                exchange,
                responseBody.body,
                result.response,
            );

        await this.gateway.fulfillPausedResponse(
            exchange.tabId,
            exchange.interceptionId,
            decision,
        );

        this.logger.info(
            'Response modified by rule',
            {
                tabId: exchange.tabId,
                url: exchange.url,
                statusCode:
                    decision.statusCode,
                matchedRules:
                    result.matchedRules.length,
            },
        );

        broadcastNetworkLog({
            type: 'responseModified',
            url: exchange.url,
            statusCode: decision.statusCode,
            matchedRules: result.matchedRules.length,
        });

        return true;
    }

    private createTransaction(
        exchange: Extract<
            CapturedNetworkExchange,
            {
                stage: 'response';
            }
        >,
        responseBody?: string,
    ): InterceptionTransaction {
        const now = new Date().toISOString();

        return {
            id: exchange.networkId ?? exchange.interceptionId,

            request: {
                id: exchange.networkId ?? exchange.interceptionId,
                tabId: exchange.tabId,
                url: exchange.url,
                method: exchange.method,
                resourceType:
                    toResourceType(
                        exchange.resourceType,
                    ),
                headers: {
                    ...exchange.requestHeaders,
                },
                timestamp: now,
            },

            response: {
                requestId:
                    exchange.networkId ?? exchange.interceptionId,
                url: exchange.url,
                statusCode: exchange.statusCode,
                statusText: exchange.statusText,
                headers: {
                    ...exchange.responseHeaders,
                },
                body: responseBody,
                timestamp: now,
            },

            matchedRuleIds: [],
            startedAt: now,
        };
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
                'Request captured',
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
            'Response captured',
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
                'Unable to continue paused request',
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
                'Unable to continue request',
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

function wait(
    delayMs: number,
): Promise<void> {
    return new Promise((resolve) => {
        setTimeout(resolve, delayMs);
    });
}

function toResourceType(
    value?: string,
): ResourceType | undefined {
    if (!value) {
        return undefined;
    }

    const normalizedValue =
        value.toLowerCase();

    const map: Record<string, ResourceType> = {
        document: 'Document',
        stylesheet: 'Stylesheet',
        image: 'Image',
        media: 'Media',
        font: 'Font',
        script: 'Script',
        xhr: 'XHR',
        fetch: 'Fetch',
        websocket: 'WebSocket',
        other: 'Other',
    };

    return map[normalizedValue] ?? 'Other';
}

function hasMeaningfulResponseChange(
    exchange: Extract<
        CapturedNetworkExchange,
        {
            stage: 'response';
        }
    >,
    currentBody: string | undefined,
    response: ResponseDecision,
): boolean {
    if (response.statusCode !== exchange.statusCode) {
        return true;
    }

    if ((response.statusText ?? '') !== (exchange.statusText ?? '')) {
        return true;
    }

    if (
        normalizeHeaders(response.headers) !==
        normalizeHeaders(exchange.responseHeaders)
    ) {
        return true;
    }

    return (response.body ?? '') !== (currentBody ?? '');
}

function normalizeHeaders(
    headers: Record<string, string>,
): string {
    return Object.entries(headers)
        .map(([name, value]) => [
            name.toLowerCase(),
            value,
        ] as const)
        .sort((a, b) =>
            a[0].localeCompare(b[0]),
        )
        .map(([name, value]) => `${name}:${value}`)
        .join('|');
}

function toFulfillDecision(
    exchange: Extract<
        CapturedNetworkExchange,
        {
            stage: 'response';
        }
    >,
    currentBody: string | undefined,
    response: ResponseDecision,
): {
    statusCode: number;
    statusText?: string;
    headers: Record<string, string>;
    body?: string;
} {
    const body = response.body ?? currentBody;
    const bodyChanged = body !== currentBody;

    const headers = {
        ...response.headers,
    };

    if (bodyChanged) {
        removeHeaderByName(
            headers,
            'content-length',
        );

        removeHeaderByName(
            headers,
            'content-encoding',
        );
    }

    return {
        statusCode: response.statusCode,
        statusText:
            response.statusText ?? exchange.statusText,
        headers,
        body,
    };
}

function removeHeaderByName(
    headers: Record<string, string>,
    name: string,
): void {
    const match = Object.keys(headers).find(
        (candidate) =>
            candidate.toLowerCase() === name,
    );

    if (match) {
        delete headers[match];
    }
}

function broadcastNetworkLog(
    payload: {
        type: string;
        url: string;
        statusCode: number;
        matchedRules: number;
    },
): void {
    try {
        void chrome.runtime.sendMessage({
            type: 'network.log',
            payload,
        });
    } catch {
        // Sidepanel may not be open; ignore.
    }
}
