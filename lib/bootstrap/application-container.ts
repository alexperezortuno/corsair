import {Container} from '@/lib/core/container';

import type {EventBus,} from '@/lib/core/event-bus';
import {InMemoryEventBus,} from '@/lib/core/event-bus';

import type {Logger,} from '@/lib/core/logger';
import {ConsoleLogger,} from '@/lib/core/logger';

import {TOKENS,} from '@/lib/core/tokens';

import {RuleService,} from '@/lib/rules/application/rule.service';

import {ChromeRuleRepository,} from '@/lib/rules/infrastructure/chrome-rule.repository';

import type {RuleRepository,} from '@/lib/rules/domain/rule.repository';

import {InterceptionPipeline,} from '@/lib/interceptor/application/interception-pipeline';

import {RequestRuleStage,} from '@/lib/interceptor/stages/request-rule.stage';

import {ResponseRuleStage,} from '@/lib/interceptor/stages/response-rule.stage';

import {DebuggerService,} from '@/lib/debugger/application/debugger.service';

import {InMemoryDebuggerGateway,} from '@/lib/debugger/infrastructure/in-memory-debugger.gateway';

import {InterceptionService,} from '@/lib/interceptor/application/interception.service';

import type {DebuggerGateway,} from '@/lib/debugger/domain/debugger.gateway';

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

    container.registerSingleton<InterceptionPipeline>(
        TOKENS.interceptionPipeline,
        (currentContainer) => {
            const logger =
                currentContainer.resolve<Logger>(
                    TOKENS.logger,
                );

            return new InterceptionPipeline(
                [
                    new RequestRuleStage(),
                ],
                [
                    new ResponseRuleStage(),
                ],
                logger,
            );
        },
    );

    container.registerSingleton<InterceptionService>(
        TOKENS.interceptionService,
        (currentContainer) => {
            const ruleService =
                currentContainer.resolve<RuleService>(
                    TOKENS.ruleService,
                );

            const pipeline =
                currentContainer.resolve<InterceptionPipeline>(
                    TOKENS.interceptionPipeline,
                );

            const eventBus =
                currentContainer.resolve<EventBus>(
                    TOKENS.eventBus,
                );

            const logger =
                currentContainer.resolve<Logger>(
                    TOKENS.logger,
                );

            return new InterceptionService(
                ruleService,
                pipeline,
                eventBus,
                logger,
            );
        },
    );

    container.registerSingleton<DebuggerGateway>(
        TOKENS.debuggerGateway,
        () => new InMemoryDebuggerGateway(),
    );

    container.registerSingleton<DebuggerService>(
        TOKENS.debuggerService,
        (currentContainer) => {
            const gateway =
                currentContainer.resolve<DebuggerGateway>(
                    TOKENS.debuggerGateway,
                );

            const eventBus =
                currentContainer.resolve<EventBus>(
                    TOKENS.eventBus,
                );

            const logger =
                currentContainer.resolve<Logger>(
                    TOKENS.logger,
                );

            const service = new DebuggerService(
                gateway,
                eventBus,
                logger,
            );

            service.initialize();

            return service;
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