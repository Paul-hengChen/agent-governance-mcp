export type SchemaKind = "handoff" | "tasks" | "sqlite" | "config";
export declare const CURRENT_VERSIONS: Record<SchemaKind, number>;
export declare const VERSION_WHEN_ABSENT = 0;
export interface Migration<TFrom, TTo> {
    readonly kind: SchemaKind;
    readonly from: number;
    readonly to: number;
    up(input: TFrom): TTo;
}
export interface MigrationResult<T> {
    readonly payload: T;
    readonly fromVersion: number;
    readonly toVersion: number;
    readonly applied: number[];
}
export declare function registerMigration<TFrom, TTo>(m: Migration<TFrom, TTo>): void;
export declare function peekVersion(raw: unknown): number;
export declare function runMigrations<T>(kind: SchemaKind, raw: unknown): MigrationResult<T>;
export declare function _clearRegistryForTests(): void;
//# sourceMappingURL=versions.d.ts.map