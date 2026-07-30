import type {InterceptionRule, MatchCondition,} from './rule.types';

export interface RuleMatchContext {
    url: string;
    method: string;
    resourceType?: string;
}

export function matchesCondition(
    value: string,
    condition?: MatchCondition,
): boolean {
    if (!condition) {
        return true;
    }

    if (!condition.pattern.trim()) {
        return true;
    }

    const flags = condition.caseSensitive ? '' : 'i';

    switch (condition.type) {
        case 'exact':
            return condition.caseSensitive
                ? value === condition.pattern
                : value.toLowerCase() === condition.pattern.toLowerCase();

        case 'contains':
            return condition.caseSensitive
                ? value.includes(condition.pattern)
                : value
                    .toLowerCase()
                    .includes(condition.pattern.toLowerCase());

        case 'wildcard':
            return wildcardToRegExp(condition.pattern, flags).test(value);

        case 'regex':
            return new RegExp(condition.pattern, flags).test(value);
    }
}

export function matchesRule(
    context: RuleMatchContext,
    rule: InterceptionRule,
): boolean {
    if (!rule.enabled) {
        return false;
    }

    let parsedUrl: URL;

    try {
        parsedUrl = new URL(context.url);
    } catch {
        return false;
    }

    if (
        rule.target.methods.length > 0 &&
        !rule.target.methods.includes(
            context.method.toUpperCase() as never,
        )
    ) {
        return false;
    }

    if (!matchesCondition(context.url, rule.target.url)) {
        return false;
    }

    if (!matchesCondition(parsedUrl.hostname, rule.target.domain)) {
        return false;
    }

    if (!matchesCondition(parsedUrl.pathname, rule.target.path)) {
        return false;
    }

    if (
        rule.target.resourceTypes.length > 0 &&
        context.resourceType &&
        !rule.target.resourceTypes.includes(
            context.resourceType as never,
        )
    ) {
        return false;
    }

    return true;
}

function wildcardToRegExp(
    pattern: string,
    flags: string,
): RegExp {
    const escaped = pattern
        .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
        .replace(/\*/g, '.*');

    return new RegExp(`^${escaped}$`, flags);
}