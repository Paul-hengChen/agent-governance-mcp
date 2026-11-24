export interface FeatureMetricRecord {
    ts: string;
    feature: string;
    tickets: number;
    review_rounds: number;
    visual_rounds: number;
    hops: number;
    one_pass: boolean;
    released_version: string | null;
}
export declare function deriveTicketCode(feature: string): string;
export declare function emitFeatureMetrics(args: {
    workspacePath: string;
    feature: string;
    reviewRoundsTotal: number;
    visualRoundsTotal: number;
    hops: number;
}): void;
//# sourceMappingURL=metrics.d.ts.map