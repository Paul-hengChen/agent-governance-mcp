export interface UsageTotals {
    input_tokens: number;
    output_tokens: number;
    cache_read_input_tokens: number;
    cache_creation_input_tokens: number;
}
export interface UsageRecord {
    ts: string;
    feature: string | null;
    dispatch: string | null;
    usage: UsageTotals;
}
export declare function usagePath(workspacePath: string): string;
export declare function appendUsageRecord(workspacePath: string, record: UsageRecord): void;
export declare function sumUsageForFeature(workspacePath: string, feature: string): number;
//# sourceMappingURL=usage-accounting.d.ts.map