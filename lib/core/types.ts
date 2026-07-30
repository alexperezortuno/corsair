export type Constructor<T> =
    new (...args: never[]) => T;

export type ServiceToken<T> =
    | symbol
    | string
    | Constructor<T>;

export interface ServiceContainer {
    registerValue<T>(
        token: ServiceToken<T>,
        value: T,
    ): void;

    registerSingleton<T>(
        token: ServiceToken<T>,
        factory: Factory<T>,
    ): void;

    registerTransient<T>(
        token: ServiceToken<T>,
        factory: Factory<T>,
    ): void;

    resolve<T>(token: ServiceToken<T>): T;

    has<T>(token: ServiceToken<T>): boolean;
}

export type Factory<T> = (
    container: ServiceContainer,
) => T;