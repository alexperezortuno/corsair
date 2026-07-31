import {createApplicationContainer,} from '@/lib/bootstrap/application-container';

import {TOKENS,} from '@/lib/core/tokens';

import {DebuggerService,} from '@/lib/debugger/application/debugger.service';

import {ChromeDebuggerGateway,} from '@/lib/debugger/infrastructure/chrome-debugger.gateway';

import type {
    DebuggerAttachResult,
    DebuggerDetachResult,
    DebuggerRuntimeMessage,
    DebuggerStatusResult,
    RuntimeFailure,
    RuntimeResponse,
} from '@/lib/debugger/runtime/debugger.messages';
import {DEBUGGER_MESSAGE_TYPES, isDebuggerRuntimeMessage,} from '@/lib/debugger/runtime/debugger.messages';

import type {Logger,} from '@/lib/core/logger';

import {
    NetworkInterceptorService,
} from '@/lib/network/application/network-interceptor.service';

import {
    NETWORK_EVENTS,
} from '@/lib/network/domain/network.events';

import type {
    EventBus,
} from '@/lib/core/event-bus';

import {
    DEBUGGER_EVENTS,
} from '@/lib/debugger/domain/debugger.events';

import type {
    DebuggerDetachedPayload,
} from '@/lib/debugger/domain/debugger.events';

export default defineBackground(() => {
    const container =
        createApplicationContainer({
            debuggerGatewayFactory: () =>
                new ChromeDebuggerGateway(),

            enableNetworkInterceptor: true,
        });

    const debuggerService =
        container.resolve<DebuggerService>(
            TOKENS.debuggerService,
        );

    const logger =
        container.resolve<Logger>(
            TOKENS.logger,
        );

    const networkInterceptorService =
        container.resolve<
            NetworkInterceptorService
        >(
            TOKENS.networkInterceptorService,
        );

    const eventBus =
        container.resolve<EventBus>(
            TOKENS.eventBus,
        );

    eventBus.subscribe(
        NETWORK_EVENTS.requestCaptured,
        (event) => {
            logger.debug(
                'Request captured event',
                {
                    event,
                },
            );
        },
    );

    eventBus.subscribe(
        NETWORK_EVENTS.responseCaptured,
        (event) => {
            logger.debug(
                'Response captured event',
                {
                    event,
                },
            );
        },
    );

    eventBus.subscribe<
        DebuggerDetachedPayload
    >(
        DEBUGGER_EVENTS.detached,
        ({ payload }) => {
            const target =
                payload.event.target;

            if (
                target.type !== 'tab' ||
                target.tabId === undefined
            ) {
                return;
            }

            networkInterceptorService.forgetTab(
                target.tabId,
            );
        },
    );

    logger.info(
        'Background service worker started',
    );

    chrome.runtime.onInstalled.addListener(() => {
        logger.info(
            'Extension installed or updated',
        );
    });

    chrome.action.onClicked.addListener(
        async (tab) => {
            if (!tab.id) {
                logger.warn(
                    'No valid tab found',
                );

                return;
            }

            try {
                await chrome.sidePanel.open({
                    tabId: tab.id,
                });
            } catch (error) {
                logger.error(
                    'Unable to open side panel',
                    error,
                    {
                        tabId: tab.id,
                    },
                );
            }
        },
    );

    chrome.runtime.onMessage.addListener(
        (
            message: unknown,
            sender,
            sendResponse,
        ) => {
            if (!isDebuggerRuntimeMessage(message)) {
                return false;
            }

            void handleDebuggerMessage(
                message,
                debuggerService,
                networkInterceptorService,
                logger,
                sender,
            ).then(sendResponse);

            return true;
        },
    );

    eventBus.subscribe(
        NETWORK_EVENTS.requestCaptured,
        (event) => {
            logger.debug(
                'Request captured event',
                {
                    event,
                },
            );
        },
    );

    eventBus.subscribe(
        NETWORK_EVENTS.responseCaptured,
        (event) => {
            logger.debug(
                'Response captured event',
                {
                    event,
                },
            );
        },
    );
});

async function handleDebuggerMessage(
    message: DebuggerRuntimeMessage,
    debuggerService: DebuggerService,
    networkInterceptorService:
    NetworkInterceptorService,
    logger: Logger,
    sender: chrome.runtime.MessageSender,
): Promise<RuntimeResponse<unknown>> {
    try {
        const tabId = message.payload.tabId;

        logger.debug(
            'Debugger command received',
            {
                type: message.type,
                tabId,
                senderTabId: sender.tab?.id,
            },
        );

        switch (message.type) {
            case DEBUGGER_MESSAGE_TYPES.attach: {
                logger.info(
                    'Attaching debugger to tab',
                    { tabId },
                );

                const session =
                    await debuggerService.attachToTab(
                        tabId,
                    );

                logger.info(
                    'Debugger attached, enabling network interception',
                    { tabId },
                );

                await networkInterceptorService
                    .enableForTab(tabId);

                logger.info(
                    'Network interception enabled',
                    { tabId },
                );

                const data: DebuggerAttachResult = {
                    session,
                };

                return success(data);
            }

            case DEBUGGER_MESSAGE_TYPES.detach: {
                if (
                    networkInterceptorService
                        .isEnabledForTab(tabId)
                ) {
                    await networkInterceptorService
                        .disableForTab(tabId);
                }

                await debuggerService.detachFromTab(
                    tabId,
                );

                const data: DebuggerDetachResult = {
                    detached: true,
                };

                return success(data);
            }

            case DEBUGGER_MESSAGE_TYPES.status: {
                const attached =
                    await debuggerService.isAttachedToTab(
                        tabId,
                    );

                const data: DebuggerStatusResult = {
                    attached,
                };

                return success(data);
            }
        }
    } catch (cause) {
        const error = normalizeError(cause);

            logger.error(
                'Debugger command failed',
                error,
                {
                    messageType: message.type,
                    tabId: message.payload.tabId,
                },
            );

        const failure: RuntimeFailure = {
            success: false,
            error: {
                name: error.name,
                message: error.message,
            },
        };

        return failure;
    }
}

function success<T>(
    data: T,
): RuntimeResponse<T> {
    return {
        success: true,
        data,
    };
}

function normalizeError(
    cause: unknown,
): Error {
    if (cause instanceof Error) {
        return cause;
    }

    return new Error(String(cause));
}