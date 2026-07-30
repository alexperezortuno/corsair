import {createApp} from 'vue';
import {createPinia} from 'pinia';

import App from './App.vue';

import {getApplicationContainer,} from '@/lib/bootstrap/application-container';

import {TOKENS,} from '@/lib/core/tokens';

import {RULE_EVENTS,} from '@/lib/rules/domain/rule.events';

import type {EventBus,} from '@/lib/core/event-bus';

import type {Logger,} from '@/lib/core/logger';

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

const app = createApp(App);

app.use(createPinia());

app.mount('#app');