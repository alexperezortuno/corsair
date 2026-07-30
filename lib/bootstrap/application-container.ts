import {Container} from '@/lib/core/container';

import type {EventBus,} from '@/lib/core/event-bus';
import {InMemoryEventBus,} from '@/lib/core/event-bus';

import type {Logger,} from '@/lib/core/logger';
import {ConsoleLogger,} from '@/lib/core/logger';

import {TOKENS,} from '@/lib/core/tokens';

import {RuleService,} from '@/lib/rules/application/rule.service';

import {ChromeRuleRepository,} from '@/lib/rules/infrastructure/chrome-rule.repository';

import type {RuleRepository,} from '@/lib/rules/domain/rule.repository';

let applicationContainer: Container | null = null;

export function createApplicationContainer(): Container {
    const container = new Container();

    container.registerSingleton<Logger>(
        TOKENS.logger,
        () => new ConsoleLogger('Corsair'),
    );

    container.registerSingleton<EventBus>(
        TOKENS.eventBus,
        () => new InMemoryEventBus(),
    );

    container.registerSingleton<RuleRepository>(
        TOKENS.ruleRepository,
        () => new ChromeRuleRepository(),
    );

    container.registerSingleton<RuleService>(
        TOKENS.ruleService,
        (currentContainer) => {
            const repository =
                currentContainer.resolve<RuleRepository>(
                    TOKENS.ruleRepository,
                );

            const eventBus =
                currentContainer.resolve<EventBus>(
                    TOKENS.eventBus,
                );

            const logger =
                currentContainer.resolve<Logger>(
                    TOKENS.logger,
                );

            return new RuleService(
                repository,
                eventBus,
                logger,
            );
        },
    );

    return container;
}

export function getApplicationContainer(): Container {
    if (!applicationContainer) {
        applicationContainer =
            createApplicationContainer();
    }

    return applicationContainer;
}