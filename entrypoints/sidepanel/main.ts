import {createApp} from 'vue';
import {createPinia} from 'pinia';

import App from './App.vue';

import {getApplicationContainer,} from '@/lib/bootstrap/application-container';

import {TOKENS,} from '@/lib/core/tokens';

import {RULE_EVENTS,} from '@/lib/rules/domain/rule.events';

import type {EventBus,} from '@/lib/core/event-bus';

import type {Logger,} from '@/lib/core/logger';

import {
    DEBUGGER_EVENTS,
} from '@/lib/debugger/domain/debugger.events';

import {
    INTERCEPTION_EVENTS,
} from '@/lib/interceptor/domain/interception.events';

const container = getApplicationContainer();

const eventBus =
    container.resolve<EventBus>(
        TOKENS.eventBus,
    );

const logger =
    container.resolve<Logger>(
        TOKENS.logger,
    );

eventBus.subscribe(
    RULE_EVENTS.created,
    (event) => {
        logger.debug(
            'Evento rules.created recibido',
            {
                event,
            },
        );
    },
);

eventBus.subscribe(
    RULE_EVENTS.updated,
    (event) => {
        logger.debug(
            'Evento rules.updated recibido',
            {
                event,
            },
        );
    },
);

eventBus.subscribe(
    INTERCEPTION_EVENTS.completed,
    (event) => {
        logger.debug(
            'Interceptación completada recibida',
            {
                event,
            },
        );
    },
);

eventBus.subscribe(
    INTERCEPTION_EVENTS.failed,
    (event) => {
        logger.error(
            'Interceptación fallida recibida',
            undefined,
            {
                event,
            },
        );
    },
);

eventBus.subscribe(
    DEBUGGER_EVENTS.attached,
    (event) => {
        logger.debug(
            'Debugger attached recibido',
            {
                event,
            },
        );
    },
);

eventBus.subscribe(
    DEBUGGER_EVENTS.detached,
    (event) => {
        logger.debug(
            'Debugger detached recibido',
            {
                event,
            },
        );
    },
);

const app = createApp(App);

app.use(createPinia());

app.mount('#app');