import type {
    DebuggerAttachResult,
    DebuggerDetachResult,
    DebuggerRuntimeMessage,
    DebuggerStatusResult,
    RuntimeResponse,
} from './debugger.messages';
import {DEBUGGER_MESSAGE_TYPES,} from './debugger.messages';

import type {DebuggerSession,} from '../domain/debugger.types';

export class DebuggerRuntimeClient {
    async attachToTab(
        tabId: number,
    ): Promise<DebuggerSession> {
        const response =
            await this.send<DebuggerAttachResult>({
                type: DEBUGGER_MESSAGE_TYPES.attach,
                payload: {
                    tabId,
                },
            });

        return response.session;
    }

    async detachFromTab(
        tabId: number,
    ): Promise<void> {
        await this.send<DebuggerDetachResult>({
            type: DEBUGGER_MESSAGE_TYPES.detach,
            payload: {
                tabId,
            },
        });
    }

    async isAttachedToTab(
        tabId: number,
    ): Promise<boolean> {
        const response =
            await this.send<DebuggerStatusResult>({
                type: DEBUGGER_MESSAGE_TYPES.status,
                payload: {
                    tabId,
                },
            });

        return response.attached;
    }

    private async send<TResult>(
        message: DebuggerRuntimeMessage,
    ): Promise<TResult> {
        const response =
            await chrome.runtime.sendMessage<
                DebuggerRuntimeMessage,
                RuntimeResponse<TResult>
            >(message);

        if (!response) {
            throw new Error(
                'El background no respondió',
            );
        }

        if (!response.success) {
            throw new Error(
                response.error.message,
            );
        }

        return response.data;
    }
}