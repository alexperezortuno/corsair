export interface ApplicationEvent<
    TPayload = unknown,
> {
    type: string;
    payload: TPayload;
    occurredAt: string;
}

export type EventHandler<
    TPayload = unknown,
> = (
    event: ApplicationEvent<TPayload>,
) => void | Promise<void>;

export type Unsubscribe = () => void;

export interface EventBus {
    publish<TPayload>(
        event: ApplicationEvent<TPayload>,
    ): Promise<void>;

    subscribe<TPayload>(
        eventType: string,
        handler: EventHandler<TPayload>,
    ): Unsubscribe;
}

export function createEvent<TPayload>(
    type: string,
    payload: TPayload,
): ApplicationEvent<TPayload> {
    return {
        type,
        payload,
        occurredAt: new Date().toISOString(),
    };
}

export class InMemoryEventBus implements EventBus {
    private readonly handlers =
        new Map<string, Set<EventHandler>>();

    async publish<TPayload>(
        event: ApplicationEvent<TPayload>,
    ): Promise<void> {
        const eventHandlers = this.handlers.get(event.type);

        if (!eventHandlers || eventHandlers.size === 0) {
            return;
        }

        await Promise.all(
            [...eventHandlers].map(async (handler) => {
                await handler(
                    event as ApplicationEvent<unknown>,
                );
            }),
        );
    }

    subscribe<TPayload>(
        eventType: string,
        handler: EventHandler<TPayload>,
    ): Unsubscribe {
        const handlers =
            this.handlers.get(eventType) ??
            new Set<EventHandler>();

        handlers.add(
            handler as EventHandler<unknown>,
        );

        this.handlers.set(eventType, handlers);

        return () => {
            const currentHandlers =
                this.handlers.get(eventType);

            if (!currentHandlers) {
                return;
            }

            currentHandlers.delete(
                handler as EventHandler<unknown>,
            );

            if (currentHandlers.size === 0) {
                this.handlers.delete(eventType);
            }
        };
    }
}