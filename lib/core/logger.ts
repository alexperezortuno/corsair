export interface LogContext {
    [key: string]: unknown;
}

export interface Logger {
    debug(
        message: string,
        context?: LogContext,
    ): void;

    info(
        message: string,
        context?: LogContext,
    ): void;

    warn(
        message: string,
        context?: LogContext,
    ): void;

    error(
        message: string,
        error?: unknown,
        context?: LogContext,
    ): void;
}

export class ConsoleLogger implements Logger {
    constructor(
        private readonly namespace = 'Corsair',
    ) {
    }

    debug(
        message: string,
        context?: LogContext,
    ): void {
        console.debug(
            this.formatMessage(message),
            context ?? '',
        );
    }

    info(
        message: string,
        context?: LogContext,
    ): void {
        console.info(
            this.formatMessage(message),
            context ?? '',
        );
    }

    warn(
        message: string,
        context?: LogContext,
    ): void {
        console.warn(
            this.formatMessage(message),
            context ?? '',
        );
    }

    error(
        message: string,
        error?: unknown,
        context?: LogContext,
    ): void {
        console.error(
            this.formatMessage(message),
            {
                error: this.serializeError(error),
                ...context,
            },
        );
    }

    private formatMessage(message: string): string {
        return `[${this.namespace}] ${message}`;
    }

    private serializeError(
        error: unknown,
    ): unknown {
        if (error instanceof Error) {
            return {
                name: error.name,
                message: error.message,
                stack: error.stack,
                cause: error.cause,
            };
        }

        return error;
    }
}