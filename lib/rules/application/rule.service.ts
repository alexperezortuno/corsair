import type {RuleRepository} from '../domain/rule.repository';

import type {InterceptionRule, RuleId,} from '../domain/rule.types';

export class RuleService {
    constructor(
        private readonly repository: RuleRepository,
    ) {
    }

    async getRules(): Promise<InterceptionRule[]> {
        const rules = await this.repository.findAll();

        return [...rules].sort(
            (a, b) => b.priority - a.priority,
        );
    }

    async getRule(
        id: RuleId,
    ): Promise<InterceptionRule | null> {
        return this.repository.findById(id);
    }

    async saveRule(
        rule: InterceptionRule,
    ): Promise<void> {
        this.validateRule(rule);

        await this.repository.save(rule);
    }

    async deleteRule(id: RuleId): Promise<void> {
        await this.repository.delete(id);
    }

    async toggleRule(
        id: RuleId,
        enabled: boolean,
    ): Promise<void> {
        const rule = await this.repository.findById(id);

        if (!rule) {
            throw new Error(`No existe la regla ${id}`);
        }

        await this.repository.save({
            ...rule,
            enabled,
            updatedAt: new Date().toISOString(),
        });
    }

    private validateRule(rule: InterceptionRule): void {
        if (!rule.name.trim()) {
            throw new Error('El nombre de la regla es obligatorio');
        }

        if (rule.priority < 0) {
            throw new Error('La prioridad no puede ser negativa');
        }

        const conditions = [
            rule.target.url,
            rule.target.domain,
            rule.target.path,
        ];

        for (const condition of conditions) {
            if (
                condition?.type === 'regex' &&
                condition.pattern.trim()
            ) {
                this.validateRegularExpression(condition.pattern);
            }
        }

        const requestBody = rule.request.body;
        const responseBody = rule.response.body;

        if (
            requestBody?.mode === 'regex-replace' &&
            requestBody.search
        ) {
            this.validateRegularExpression(requestBody.search);
        }

        if (
            responseBody?.mode === 'regex-replace' &&
            responseBody.search
        ) {
            this.validateRegularExpression(responseBody.search);
        }
    }

    private validateRegularExpression(pattern: string): void {
        try {
            new RegExp(pattern);
        } catch (error) {
            const message =
                error instanceof Error
                    ? error.message
                    : 'Expresión regular inválida';

            throw new Error(message);
        }
    }
}