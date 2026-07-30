import type {
    DebuggerDetachHandler,
    DebuggerEventHandler,
    DebuggerGateway,
    DebuggerUnsubscribe,
} from '../domain/debugger.gateway';

import type {
    DebuggerCommandParams,
    DebuggerCommandResult,
    DebuggerSession,
    DebuggerTarget,
} from '../domain/debugger.types';

export class InMemoryDebuggerGateway
    implements DebuggerGateway {
    private readonly sessions =
        new Map<string, DebuggerSession>();

    private readonly eventHandlers =
        new Set<DebuggerEventHandler>();

    private readonly detachHandlers =
        new Set<DebuggerDetachHandler>();

    async attach(
        target: DebuggerTarget,
        protocolVersion = '1.3',
    ): Promise<DebuggerSession> {
        const session: DebuggerSession = {
            target,
            protocolVersion,
            attachedAt: new Date().toISOString(),
        };

        this.sessions.set(
            targetToKey(target),
            session,
        );

        return session;
    }

    async detach(
        target: DebuggerTarget,
    ): Promise<void> {
        this.sessions.delete(
            targetToKey(target),
        );

        const event = {
            target,
            reason: 'manual',
            occurredAt: new Date().toISOString(),
        };

        await Promise.all(
            [...this.detachHandlers].map(
                async (handler) => {
                    await handler(event);
                },
            ),
        );
    }

    async isAttached(
        target: DebuggerTarget,
    ): Promise<boolean> {
        return this.sessions.has(
            targetToKey(target),
        );
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
                'Debugger is not attached to target',
            );
        }

        return {
            target,
            method,
            params,
        } as unknown as TResult;
    }

    onEvent(
        handler: DebuggerEventHandler,
    ): DebuggerUnsubscribe {
        this.eventHandlers.add(handler);

        return () => {
            this.eventHandlers.delete(handler);
        };
    }

    onDetach(
        handler: DebuggerDetachHandler,
    ): DebuggerUnsubscribe {
        this.detachHandlers.add(handler);

        return () => {
            this.detachHandlers.delete(handler);
        };
    }
}

function targetToKey(
    target: DebuggerTarget,
): string {
    if (target.type === 'tab') {
        return `tab:${target.tabId ?? 'unknown'}`;
    }

    return `extension:${
        target.extensionId ?? 'unknown'
    }`;
}