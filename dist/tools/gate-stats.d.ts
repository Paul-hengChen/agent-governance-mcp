import { type GateProducer } from "../gates/registry.js";
import type { ToolResult, WorkspaceOnlyInput } from "./registry.js";
export interface GateFireStat {
    error_code: string;
    category: "gate-backed";
    producer: GateProducer;
    fires: number;
    by_feature: Record<string, number>;
    by_agent: Record<string, number>;
    first_ts: string | null;
    last_ts: string | null;
}
export interface UnregisteredFireStat {
    error_code: string;
    category: "unregistered";
    fires: number;
    by_feature: Record<string, number>;
    first_ts: string | null;
    last_ts: string | null;
}
export interface ProseBehavioralRule {
    rule: string;
    category: "prose-behavioral";
    where: string;
    fires: null;
    adjudication: string;
}
export interface FeatureOutcome {
    feature: string;
    released_version: string | null;
    tickets: number;
    qa_rounds: number;
    review_rounds: number;
    visual_rounds: number;
    hops: number;
    one_pass: boolean;
}
export interface GateStatsReport {
    category_boundary: string;
    telemetry: {
        path: string;
        exists: boolean;
        lines_total: number;
        lines_malformed: number;
        total_fires: number;
        first_ts: string | null;
        last_ts: string | null;
    };
    fired: GateFireStat[];
    zero_fire: string[];
    unregistered: UnregisteredFireStat[];
    prose_behavioral: ProseBehavioralRule[];
    metrics: {
        path: string;
        exists: boolean;
        lines_total: number;
        lines_malformed: number;
        duplicates_skipped: number;
        features: number;
        one_pass_count: number;
        one_pass_rate: number | null;
        mean_qa_rounds: number | null;
        mean_review_rounds: number | null;
        mean_visual_rounds: number | null;
        mean_hops: number | null;
        per_feature: FeatureOutcome[];
    };
    caveats: string[];
}
export declare const PROSE_BEHAVIORAL_RULES: readonly ProseBehavioralRule[];
export declare function computeGateStats(workspacePath: string): GateStatsReport;
export declare function handleGateStats(args: WorkspaceOnlyInput): Promise<ToolResult>;
//# sourceMappingURL=gate-stats.d.ts.map