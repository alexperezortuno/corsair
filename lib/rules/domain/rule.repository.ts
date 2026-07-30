import type {InterceptionRule, RuleId,} from './rule.types';

export interface RuleRepository {
    findAll(): Promise<InterceptionRule[]>;

    findById(id: RuleId): Promise<InterceptionRule | null>;

    save(rule: InterceptionRule): Promise<void>;

    saveAll(rules: InterceptionRule[]): Promise<void>;

    delete(id: RuleId): Promise<void>;

    clear(): Promise<void>;
}