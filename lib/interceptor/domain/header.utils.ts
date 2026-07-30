import type {HeaderModification,} from '@/lib/rules/domain/rule.types';

import type {HttpHeaders,} from './interception.types';

export function cloneHeaders(
    headers: HttpHeaders,
): HttpHeaders {
    return {
        ...headers,
    };
}

export function findHeaderName(
    headers: HttpHeaders,
    searchedName: string,
): string | undefined {
    const normalizedName = searchedName.toLowerCase();

    return Object.keys(headers).find(
        (headerName) =>
            headerName.toLowerCase() === normalizedName,
    );
}

export function getHeader(
    headers: HttpHeaders,
    name: string,
): string | undefined {
    const existingName = findHeaderName(headers, name);

    if (!existingName) {
        return undefined;
    }

    return headers[existingName];
}

export function setHeader(
    headers: HttpHeaders,
    name: string,
    value: string,
): HttpHeaders {
    const result = cloneHeaders(headers);
    const existingName = findHeaderName(result, name);

    if (existingName && existingName !== name) {
        delete result[existingName];
    }

    result[name] = value;

    return result;
}

export function appendHeader(
    headers: HttpHeaders,
    name: string,
    value: string,
): HttpHeaders {
    const existingValue = getHeader(headers, name);

    if (!existingValue) {
        return setHeader(headers, name, value);
    }

    return setHeader(
        headers,
        name,
        `${existingValue}, ${value}`,
    );
}

export function removeHeader(
    headers: HttpHeaders,
    name: string,
): HttpHeaders {
    const result = cloneHeaders(headers);
    const existingName = findHeaderName(result, name);

    if (existingName) {
        delete result[existingName];
    }

    return result;
}

export function applyHeaderModifications(
    headers: HttpHeaders,
    modifications: HeaderModification[],
): HttpHeaders {
    return modifications.reduce(
        (currentHeaders, modification) => {
            switch (modification.operation) {
                case 'set':
                    return setHeader(
                        currentHeaders,
                        modification.name,
                        modification.value ?? '',
                    );

                case 'append':
                    return appendHeader(
                        currentHeaders,
                        modification.name,
                        modification.value ?? '',
                    );

                case 'remove':
                    return removeHeader(
                        currentHeaders,
                        modification.name,
                    );
            }
        },
        cloneHeaders(headers),
    );
}