import {createDefaultRule,} from '@/lib/rules/domain/rule.factory';

import type {InterceptionTransaction,} from '../domain/interception.types';

import type {InterceptionRule,} from '@/lib/rules/domain/rule.types';

export function createPipelineDemoTransaction():
    InterceptionTransaction {
    const now = new Date().toISOString();

    return {
        id: crypto.randomUUID(),

        request: {
            id: crypto.randomUUID(),
            url: 'https://api.example.com/users',
            method: 'GET',
            resourceType: 'Fetch',

            headers: {
                Accept: 'application/json',
            },

            timestamp: now,
        },

        response: {
            requestId: crypto.randomUUID(),
            url: 'https://api.example.com/users',
            statusCode: 200,
            statusText: 'OK',

            headers: {
                'Content-Type': 'application/json',
            },

            body: JSON.stringify({
                users: [],
            }),

            timestamp: now,
        },

        matchedRuleIds: [],
        startedAt: now,
    };
}

export function createPipelineDemoRule():
    InterceptionRule {
    const rule = createDefaultRule();

    return {
        ...rule,

        name: 'Mock de usuarios',
        priority: 100,

        target: {
            ...rule.target,

            url: {
                type: 'contains',
                pattern: 'api.example.com/users',
                caseSensitive: false,
            },

            methods: ['GET'],
            resourceTypes: ['Fetch'],
        },

        request: {
            ...rule.request,
            enabled: true,

            headers: [
                {
                    operation: 'set',
                    name: 'X-Corsair',
                    value: 'enabled',
                },
            ],
        },

        response: {
            ...rule.response,
            enabled: true,
            statusCode: 201,

            headers: [
                {
                    operation: 'set',
                    name: 'X-Corsair-Mock',
                    value: 'true',
                },
            ],

            body: {
                mode: 'full-replacement',
                replacement: JSON.stringify({
                    users: [
                        {
                            id: 1,
                            name: 'Corsair User',
                        },
                    ],
                }),
            },
        },
    };
}