export interface ApplicationErrorOptions {
    code: string;
    message: string;
    cause?: unknown;
    metadata?: Record<string, unknown>;
}

export class ApplicationError extends Error {
    readonly code: string;
    readonly metadata: Record<string, unknown>;
    override readonly cause?: unknown;

    constructor(options: ApplicationErrorOptions) {
        super(options.message);

        this.name = 'ApplicationError';
        this.code = options.code;
        this.cause = options.cause;
        this.metadata = options.metadata ?? {};

        Object.setPrototypeOf(this, new.target.prototype);
    }
}

export class DependencyNotFoundError extends ApplicationError {
    constructor(token: unknown) {
        super({
            code: 'CORE_DEPENDENCY_NOT_FOUND',
            message: `Dependency not found: ${String(token)}`,
            metadata: {
                token: String(token),
            },
        });

        this.name = 'DependencyNotFoundError';
    }
}

export class DependencyAlreadyRegisteredError
    extends ApplicationError {
    constructor(token: unknown) {
        super({
            code: 'CORE_DEPENDENCY_ALREADY_REGISTERED',
            message: `Dependency already registered: ${String(token)}`,
            metadata: {
                token: String(token),
            },
        });

        this.name = 'DependencyAlreadyRegisteredError';
    }
}

export class RuleValidationError extends ApplicationError {
    constructor(
        message: string,
        metadata?: Record<string, unknown>,
    ) {
        super({
            code: 'RULE_VALIDATION_ERROR',
            message,
            metadata,
        });

        this.name = 'RuleValidationError';
    }
}