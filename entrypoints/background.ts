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

export default defineBackground(() => {
    const container =
        createApplicationContainer({
            debuggerGatewayFactory: () =>
                new ChromeDebuggerGateway(),
        });

    const debuggerService =
        container.resolve<DebuggerService>(
            TOKENS.debuggerService,
        );

    const logger =
        container.resolve<Logger>(
            TOKENS.logger,
        );

    logger.info(
        'Background service worker iniciado',
    );

    chrome.runtime.onInstalled.addListener(() => {
        logger.info(
            'Extensión instalada o actualizada',
        );
    });

    chrome.action.onClicked.addListener(
        async (tab) => {
            if (!tab.id) {
                logger.warn(
                    'No se encontró una pestaña válida',
                );

                return;
            }

            try {
                await chrome.sidePanel.open({
                    tabId: tab.id,
                });
            } catch (error) {
                logger.error(
                    'No fue posible abrir el Side Panel',
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
                logger,
                sender,
            ).then(sendResponse);

            return true;
        },
    );
});

async function handleDebuggerMessage(
    message: DebuggerRuntimeMessage,
    debuggerService: DebuggerService,
    logger: Logger,
    sender: chrome.runtime.MessageSender,
): Promise<RuntimeResponse<unknown>> {
    try {
        const tabId = message.payload.tabId;

        logger.debug(
            'Comando de debugger recibido',
            {
                type: message.type,
                tabId,
                senderTabId: sender.tab?.id,
            },
        );

        switch (message.type) {
            case DEBUGGER_MESSAGE_TYPES.attach: {
                const session =
                    await debuggerService.attachToTab(tabId);

                const data: DebuggerAttachResult = {
                    session,
                };

                return success(data);
            }

            case DEBUGGER_MESSAGE_TYPES.detach: {
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
            'Falló el comando de debugger',
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