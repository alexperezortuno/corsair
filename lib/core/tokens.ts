import type {EventBus} from './event-bus';
import type {Logger} from './logger';

import type {RuleService} from '@/lib/rules/application/rule.service';
import type {RuleRepository} from '@/lib/rules/domain/rule.repository';
import type {InterceptionPipeline,} from '@/lib/interceptor/application/interception-pipeline';

export const TOKENS = {
    logger: Symbol(
        'corsair.core.logger',
    ) as symbol & {
        readonly __type?: Logger;
    },

    eventBus: Symbol(
        'corsair.core.eventBus',
    ) as symbol & {
        readonly __type?: EventBus;
    },

    ruleRepository: Symbol(
        'corsair.rules.repository',
    ) as symbol & {
        readonly __type?: RuleRepository;
    },

    ruleService: Symbol(
        'corsair.rules.service',
    ) as symbol & {
        readonly __type?: RuleService;
    },

    interceptionPipeline: Symbol(
        'corsair.interceptor.pipeline',
    ) as symbol & {
        readonly __type?: InterceptionPipeline;
    },
} as const;