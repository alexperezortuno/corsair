import type {
    DebuggerDetachHandler,
    DebuggerEventHandler,
    DebuggerGateway,
    DebuggerUnsubscribe,
} from '../domain/debugger.gateway';

import type {
    DebuggerCommandParams,
    DebuggerCommandResult,
    DebuggerDetachEvent,
    DebuggerProtocolEvent,
    DebuggerSession,
    DebuggerTarget,
} from '../domain/debugger.types';

const DEFAULT_PROTOCOL_VERSION = '1.3';

export class ChromeDebuggerGateway
    implements DebuggerGateway {
    private readonly eventHandlers =
        new Set<DebuggerEventHandler>();

    private readonly detachHandlers =
        new Set<DebuggerDetachHandler>();

    private listening = false;

    private readonly handleChromeEvent = (
        source: chrome.debugger.Debuggee,
        method: string,
        params?: object,
    ): void => {
        const target = fromChromeTarget(source);

        if (!target) {
            return;
        }

        const event: DebuggerProtocolEvent = {
            target,
            method,
            params: toRecord(params),
            occurredAt: new Date().toISOString(),
        };

        for (const handler of this.eventHandlers) {
            Promise.resolve(handler(event)).catch((error) => {
                console.error(
                    '[Corsair] Error procesando evento CDP',
                    error,
                );
            });
        }
    };

    private readonly handleChromeDetach = (
        source: chrome.debugger.Debuggee,
        reason: string,
    ): void => {
        const target = fromChromeTarget(source);

        if (!target) {
            return;
        }

        const event: DebuggerDetachEvent = {
            target,
            reason,
            occurredAt: new Date().toISOString(),
        };

        for (const handler of this.detachHandlers) {
            Promise.resolve(handler(event)).catch((error) => {
                console.error(
                    '[Corsair] Error procesando desconexión CDP',
                    error,
                );
            });
        }
    };

    async attach(
        target: DebuggerTarget,
        protocolVersion = DEFAULT_PROTOCOL_VERSION,
    ): Promise<DebuggerSession> {
        this.ensureListenersRegistered();

        const chromeTarget = toChromeTarget(target);

        if (await this.isAttached(target)) {
            return {
                target,
                protocolVersion,
                attachedAt: new Date().toISOString(),
            };
        }

        await chrome.debugger.attach(
            chromeTarget,
            protocolVersion,
        );

        return {
            target,
            protocolVersion,
            attachedAt: new Date().toISOString(),
        };
    }

    async detach(
        target: DebuggerTarget,
    ): Promise<void> {
        if (!await this.isAttached(target)) {
            return;
        }

        await chrome.debugger.detach(
            toChromeTarget(target),
        );
    }

    async isAttached(
        target: DebuggerTarget,
    ): Promise<boolean> {
        const targets =
            await chrome.debugger.getTargets();

        return targets.some((candidate) => {
            if (!candidate.attached) {
                return false;
            }

            if (
                target.type === 'tab' &&
                target.tabId !== undefined
            ) {
                return candidate.tabId === target.tabId;
            }

            if (
                target.type === 'extension' &&
                target.extensionId
            ) {
                return (
                    candidate.extensionId ===
                    target.extensionId
                );
            }

            return false;
        });
    }

    async sendCommand<
        TResult extends DebuggerCommandResult,
    >(
        target: DebuggerTarget,
        method: string,
        params: DebuggerCommandParams = {},
    ): Promise<TResult> {
        if (!await this.isAttached(target)) {
            throw new Error(
                `El debugger no está conectado al target ${targetToString(target)}`,
            );
        }

        const result =
            await chrome.debugger.sendCommand(
                toChromeTarget(target),
                method,
                params,
            );

        return toRecord(result) as TResult;
    }

    onEvent(
        handler: DebuggerEventHandler,
    ): DebuggerUnsubscribe {
        this.ensureListenersRegistered();
        this.eventHandlers.add(handler);

        return () => {
            this.eventHandlers.delete(handler);
            this.removeListenersWhenUnused();
        };
    }

    onDetach(
        handler: DebuggerDetachHandler,
    ): DebuggerUnsubscribe {
        this.ensureListenersRegistered();
        this.detachHandlers.add(handler);

        return () => {
            this.detachHandlers.delete(handler);
            this.removeListenersWhenUnused();
        };
    }

    private ensureListenersRegistered(): void {
        if (this.listening) {
            return;
        }

        chrome.debugger.onEvent.addListener(
            this.handleChromeEvent,
        );

        chrome.debugger.onDetach.addListener(
            this.handleChromeDetach,
        );

        this.listening = true;
    }

    private removeListenersWhenUnused(): void {
        if (
            this.eventHandlers.size > 0 ||
            this.detachHandlers.size > 0
        ) {
            return;
        }

        if (!this.listening) {
            return;
        }

        chrome.debugger.onEvent.removeListener(
            this.handleChromeEvent,
        );

        chrome.debugger.onDetach.removeListener(
            this.handleChromeDetach,
        );

        this.listening = false;
    }
}

function toChromeTarget(
    target: DebuggerTarget,
): chrome.debugger.Debuggee {
    if (target.type === 'tab') {
        if (target.tabId === undefined) {
            throw new Error(
                'El target de tipo tab requiere tabId',
            );
        }

        return {
            tabId: target.tabId,
        };
    }

    if (!target.extensionId) {
        throw new Error(
            'El target de tipo extension requiere extensionId',
        );
    }

    return {
        extensionId: target.extensionId,
    };
}

function fromChromeTarget(
    target: chrome.debugger.Debuggee,
): DebuggerTarget | null {
    if (target.tabId !== undefined) {
        return {
            type: 'tab',
            tabId: target.tabId,
        };
    }

    if (target.extensionId) {
        return {
            type: 'extension',
            extensionId: target.extensionId,
        };
    }

    return null;
}

function toRecord(
    value: unknown,
): Record<string, unknown> {
    if (
        typeof value === 'object' &&
        value !== null
    ) {
        return value as Record<string, unknown>;
    }

    return {};
}

function targetToString(
    target: DebuggerTarget,
): string {
    if (target.type === 'tab') {
        return `tab:${target.tabId ?? 'unknown'}`;
    }

    return `extension:${
        target.extensionId ?? 'unknown'
    }`;
}