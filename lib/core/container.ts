import {DependencyAlreadyRegisteredError, DependencyNotFoundError,} from './errors';

import type {Factory, ServiceContainer, ServiceToken,} from './types';

type RegistrationScope =
    | 'value'
    | 'singleton'
    | 'transient';

interface Registration<T> {
    scope: RegistrationScope;
    factory?: Factory<T>;
    instance?: T;
    initialized: boolean;
}

export class Container implements ServiceContainer {
    private readonly registrations =
        new Map<ServiceToken<unknown>, Registration<unknown>>();

    registerValue<T>(
        token: ServiceToken<T>,
        value: T,
    ): void {
        this.ensureTokenIsAvailable(token);

        this.registrations.set(token, {
            scope: 'value',
            instance: value,
            initialized: true,
        });
    }

    registerSingleton<T>(
        token: ServiceToken<T>,
        factory: Factory<T>,
    ): void {
        this.ensureTokenIsAvailable(token);

        this.registrations.set(token, {
            scope: 'singleton',
            factory,
            initialized: false,
        });
    }

    registerTransient<T>(
        token: ServiceToken<T>,
        factory: Factory<T>,
    ): void {
        this.ensureTokenIsAvailable(token);

        this.registrations.set(token, {
            scope: 'transient',
            factory,
            initialized: false,
        });
    }

    resolve<T>(token: ServiceToken<T>): T {
        const registration = this.registrations.get(token);

        if (!registration) {
            throw new DependencyNotFoundError(token);
        }

        if (registration.scope === 'value') {
            return registration.instance as T;
        }

        if (!registration.factory) {
            throw new DependencyNotFoundError(token);
        }

        if (registration.scope === 'transient') {
            return registration.factory(this) as T;
        }

        if (!registration.initialized) {
            registration.instance = registration.factory(this);
            registration.initialized = true;
        }

        return registration.instance as T;
    }

    has<T>(token: ServiceToken<T>): boolean {
        return this.registrations.has(token);
    }

    private ensureTokenIsAvailable<T>(
        token: ServiceToken<T>,
    ): void {
        if (this.registrations.has(token)) {
            throw new DependencyAlreadyRegisteredError(token);
        }
    }
}