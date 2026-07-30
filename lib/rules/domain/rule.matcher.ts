import type {HttpMethod, InterceptionRule, MatchCondition, ResourceType,} from './rule.types';

export interface RuleMatchContext {
    url: string;
    method: string;
    resourceType?: ResourceType;
}

export function matchesCondition(
    value: string,
    condition?: MatchCondition,
): boolean {
    if (!condition) {
        return true;
    }

    const pattern = condition.pattern.trim();

    if (!pattern) {
        return true;
    }

    switch (condition.type) {
        case 'exact':
            return compareExact(
                value,
                pattern,
                condition.caseSensitive,
            );

        case 'contains':
            return compareContains(
                value,
                pattern,
                condition.caseSensitive,
            );

        case 'wildcard':
            return wildcardToRegExp(
                pattern,
                condition.caseSensitive,
            ).test(value);

        case 'regex':
            return new RegExp(
                pattern,
                condition.caseSensitive ? '' : 'i',
            ).test(value);
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

    const method =
        context.method.toUpperCase() as HttpMethod;

    if (
        rule.target.methods.length > 0 &&
        !rule.target.methods.includes(method)
    ) {
        return false;
    }

    if (!matchesCondition(context.url, rule.target.url)) {
        return false;
    }

    if (
        !matchesCondition(
            parsedUrl.hostname,
            rule.target.domain,
        )
    ) {
        return false;
    }

    if (
        !matchesCondition(
            parsedUrl.pathname,
            rule.target.path,
        )
    ) {
        return false;
    }

    if (
        rule.target.resourceTypes.length > 0 &&
        context.resourceType &&
        !rule.target.resourceTypes.includes(
            context.resourceType,
        )
    ) {
        return false;
    }

    return true;
}

function compareExact(
    value: string,
    pattern: string,
    caseSensitive: boolean,
): boolean {
    if (caseSensitive) {
        return value === pattern;
    }

    return value.toLowerCase() === pattern.toLowerCase();
}

function compareContains(
    value: string,
    pattern: string,
    caseSensitive: boolean,
): boolean {
    if (caseSensitive) {
        return value.includes(pattern);
    }

    return value
        .toLowerCase()
        .includes(pattern.toLowerCase());
}

function wildcardToRegExp(
    pattern: string,
    caseSensitive: boolean,
): RegExp {
    const escapedPattern = pattern
        .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
        .replace(/\*/g, '.*');

    return new RegExp(
        `^${escapedPattern}$`,
        caseSensitive ? '' : 'i',
    );
}