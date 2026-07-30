import type {DebuggerService,} from '@/lib/debugger/application/debugger.service';

import type {DebuggerProtocolEvent,} from '@/lib/debugger/domain/debugger.types';

import type {NetworkCaptureHandler, NetworkGateway, NetworkGatewayUnsubscribe,} from '../domain/network.gateway';

import type {
    CapturedNetworkExchange,
    CapturedNetworkRequest,
    CapturedNetworkResponse,
    CapturedResponseBody,
    FulfillResponseDecision,
    NetworkHeaderEntry,
    NetworkInterceptorSession,
} from '../domain/network.types';

interface CdpRequestData {
    url?: unknown;
    method?: unknown;
    headers?: unknown;
    postData?: unknown;
}

interface CdpRequestPausedParams {
    requestId?: unknown;
    networkId?: unknown;
    frameId?: unknown;

    request?: CdpRequestData;

    resourceType?: unknown;

    responseStatusCode?: unknown;
    responseStatusText?: unknown;
    responseHeaders?: unknown;
}

export class CdpNetworkGateway
    implements NetworkGateway {

    constructor(
        private readonly debuggerService:
        DebuggerService,
    ) {
    }

    async enable(
        tabId: number,
    ): Promise<NetworkInterceptorSession> {
        await this.debuggerService.sendCommand(
            tabId,
            'Network.enable',
        );

        await this.debuggerService.sendCommand(
            tabId,
            'Fetch.enable',
            {
                patterns: [
                    {
                        urlPattern: '*',
                        requestStage: 'Request',
                    },
                    {
                        urlPattern: '*',
                        requestStage: 'Response',
                    },
                ],
            },
        );

        return {
            tabId,
            enabledAt: new Date().toISOString(),
        };
    }

    async disable(
        tabId: number,
    ): Promise<void> {
        await this.debuggerService.sendCommand(
            tabId,
            'Fetch.disable',
        );

        await this.debuggerService.sendCommand(
            tabId,
            'Network.disable',
        );
    }

    async continuePausedRequest(
        tabId: number,
        interceptionId: string,
    ): Promise<void> {
        await this.debuggerService.sendCommand(
            tabId,
            'Fetch.continueRequest',
            {
                requestId: interceptionId,
            },
        );
    }

    async failPausedRequest(
        tabId: number,
        interceptionId: string,
    ): Promise<void> {
        await this.debuggerService.sendCommand(
            tabId,
            'Fetch.failRequest',
            {
                requestId: interceptionId,
                errorReason: 'Aborted',
            },
        );
    }

    async readResponseBody(
        tabId: number,
        interceptionId: string,
    ): Promise<CapturedResponseBody> {
        const result =
            await this.debuggerService.sendCommand(
                tabId,
                'Fetch.getResponseBody',
                {
                    requestId: interceptionId,
                },
            );

        const body =
            typeof result.body === 'string'
                ? result.body
                : undefined;

        if (!body) {
            return {
                body: undefined,
            };
        }

        if (result.base64Encoded === true) {
            return {
                body: decodeBase64(body),
            };
        }

        return {
            body,
        };
    }

    async fulfillPausedResponse(
        tabId: number,
        interceptionId: string,
        decision: FulfillResponseDecision,
    ): Promise<void> {
        const payload: Record<string, unknown> = {
            requestId: interceptionId,
            responseCode: decision.statusCode,
            responsePhrase: decision.statusText,
            responseHeaders: Object.entries(
                decision.headers,
            ).map(([name, value]) => ({
                name,
                value,
            })),
        };

        if (decision.body !== undefined) {
            payload.body = encodeBase64(decision.body);
        }

        await this.debuggerService.sendCommand(
            tabId,
            'Fetch.fulfillRequest',
            payload,
        );
    }

    parseProtocolEvent(
        event: DebuggerProtocolEvent,
    ): CapturedNetworkExchange | null {
        if (event.method !== 'Fetch.requestPaused') {
            return null;
        }

        if (
            event.target.type !== 'tab' ||
            event.target.tabId === undefined
        ) {
            return null;
        }

        const params =
            event.params as CdpRequestPausedParams;

        const interceptionId =
            readRequiredString(
                params.requestId,
                'requestId',
            );

        const request = params.request;

        if (!request) {
            throw new Error(
                'Fetch.requestPaused event is missing request',
            );
        }

        const url =
            readRequiredString(
                request.url,
                'request.url',
            );

        const method =
            readRequiredString(
                request.method,
                'request.method',
            );

        const common = {
            interceptionId,

            networkId:
                readOptionalString(params.networkId),

            tabId: event.target.tabId,

            frameId:
                readOptionalString(params.frameId),

            url,
            method,

            requestHeaders:
                parseHeaderObject(request.headers),

            resourceType:
                readOptionalString(
                    params.resourceType,
                ),

            capturedAt:
                new Date().toISOString(),
        };

        const statusCode =
            readOptionalNumber(
                params.responseStatusCode,
            );

        if (statusCode !== undefined) {
            const response:
                CapturedNetworkResponse = {
                interceptionId:
                common.interceptionId,

                networkId:
                common.networkId,

                tabId:
                common.tabId,

                frameId:
                common.frameId,

                url:
                common.url,

                method:
                common.method,

                requestHeaders:
                common.requestHeaders,

                statusCode,

                statusText:
                    readOptionalString(
                        params.responseStatusText,
                    ),

                responseHeaders:
                    parseHeaderEntries(
                        params.responseHeaders,
                    ),

                resourceType:
                common.resourceType,

                stage: 'response',

                capturedAt:
                common.capturedAt,
            };

            return response;
        }

        const capturedRequest:
            CapturedNetworkRequest = {
            interceptionId:
            common.interceptionId,

            networkId:
            common.networkId,

            tabId:
            common.tabId,

            frameId:
            common.frameId,

            url:
            common.url,

            method:
            common.method,

            headers:
            common.requestHeaders,

            postData:
                readOptionalString(
                    request.postData,
                ),

            resourceType:
            common.resourceType,

            stage: 'request',

            capturedAt:
            common.capturedAt,
        };

        return capturedRequest;
    }
}

function parseHeaderObject(
    value: unknown,
): Record<string, string> {
    if (
        typeof value !== 'object' ||
        value === null ||
        Array.isArray(value)
    ) {
        return {};
    }

    return Object.entries(value).reduce<
        Record<string, string>
    >(
        (headers, [name, headerValue]) => {
            headers[name] =
                String(headerValue ?? '');

            return headers;
        },
        {},
    );
}

function parseHeaderEntries(
    value: unknown,
): Record<string, string> {
    if (!Array.isArray(value)) {
        return {};
    }

    return value.reduce<
        Record<string, string>
    >(
        (headers, candidate) => {
            if (
                typeof candidate !== 'object' ||
                candidate === null
            ) {
                return headers;
            }

            const entry =
                candidate as Partial<
                    NetworkHeaderEntry
                >;

            if (
                typeof entry.name !== 'string' ||
                typeof entry.value !== 'string'
            ) {
                return headers;
            }

            const existingName =
                Object.keys(headers).find(
                    (name) =>
                        name.toLowerCase() ===
                        entry.name?.toLowerCase(),
                );

            if (existingName) {
                headers[existingName] =
                    `${headers[existingName]}, ${entry.value}`;
            } else {
                headers[entry.name] =
                    entry.value;
            }

            return headers;
        },
        {},
    );
}

function readRequiredString(
    value: unknown,
    fieldName: string,
): string {
    if (
        typeof value !== 'string' ||
        !value
    ) {
        throw new Error(
            `CDP field ${fieldName} is required`,
        );
    }

    return value;
}

function readOptionalString(
    value: unknown,
): string | undefined {
    return typeof value === 'string'
        ? value
        : undefined;
}

function readOptionalNumber(
    value: unknown,
): number | undefined {
    return typeof value === 'number'
        ? value
        : undefined;
}

function encodeBase64(value: string): string {
    const bytes = new TextEncoder().encode(value);

    let binary = '';

    for (const byte of bytes) {
        binary += String.fromCharCode(byte);
    }

    return btoa(binary);
}

function decodeBase64(value: string): string {
    const binary = atob(value);
    const bytes = Uint8Array.from(
        binary,
        (char) => char.charCodeAt(0),
    );

    return new TextDecoder().decode(bytes);
}
