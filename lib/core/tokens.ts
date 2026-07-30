import type {EventBus} from './event-bus';
import type {Logger} from './logger';

import type {RuleService} from '@/lib/rules/application/rule.service';
import type {RuleRepository} from '@/lib/rules/domain/rule.repository';
import type {InterceptionPipeline,} from '@/lib/interceptor/application/interception-pipeline';
import type {DebuggerService,} from '@/lib/debugger/application/debugger.service';

import type {DebuggerGateway,} from '@/lib/debugger/domain/debugger.gateway';

import type {InterceptionService,} from '@/lib/interceptor/application/interception.service';

import type {
    NetworkInterceptorService,
} from '@/lib/network/application/network-interceptor.service';

import type {
    NetworkGateway,
} from '@/lib/network/domain/network.gateway';

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

    interceptionService: Symbol(
        'corsair.interceptor.service',
    ) as symbol & {
        readonly __type?: InterceptionService;
    },

    debuggerGateway: Symbol(
        'corsair.debugger.gateway',
    ) as symbol & {
        readonly __type?: DebuggerGateway;
    },

    debuggerService: Symbol(
        'corsair.debugger.service',
    ) as symbol & {
        readonly __type?: DebuggerService;
    },

    networkGateway: Symbol(
        'corsair.network.gateway',
    ) as symbol & {
        readonly __type?: NetworkGateway;
    },

    networkInterceptorService: Symbol(
        'corsair.network.interceptor-service',
    ) as symbol & {
        readonly __type?: NetworkInterceptorService;
    },
} as const;