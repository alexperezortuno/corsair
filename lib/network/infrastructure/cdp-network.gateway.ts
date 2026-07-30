import type {DebuggerService,} from '@/lib/debugger/application/debugger.service';

import type {DebuggerProtocolEvent,} from '@/lib/debugger/domain/debugger.types';

import type {NetworkCaptureHandler, NetworkGateway, NetworkGatewayUnsubscribe,} from '../domain/network.gateway';

import type {
    CapturedNetworkExchange,
    CapturedNetworkRequest,
    CapturedNetworkResponse,
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
                'El evento Fetch.requestPaused no contiene request',
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
            `El campo CDP ${fieldName} es obligatorio`,
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