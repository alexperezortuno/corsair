import type {InterceptionRule, MatchCondition,} from './rule.types';

export function createDefaultMatchCondition(): MatchCondition {
    return {
        type: 'contains',
        pattern: '',
        caseSensitive: false,
    };
}

export function createDefaultRule(): InterceptionRule {
    const now = new Date().toISOString();

    return {
        id: crypto.randomUUID(),
        name: 'Nueva regla',
        description: '',

        enabled: true,
        priority: 0,
        stopProcessing: false,

        target: {
            url: createDefaultMatchCondition(),
            methods: [],
            resourceTypes: ['XHR', 'Fetch'],
        },

        request: {
            enabled: false,
            headers: [],
            block: false,
        },

        response: {
            enabled: true,
            headers: [],
            body: {
                mode: 'none',
            },
            abort: false,
        },

        createdAt: now,
        updatedAt: now,
    };
}