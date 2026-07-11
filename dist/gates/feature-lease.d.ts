export interface FeatureLeaseFields {
    active_feature: string;
    status: string;
    last_updated: string;
    last_agent?: string;
    next_role?: string;
}
export declare function isFeatureLeaseHeld(prevState: FeatureLeaseFields | null | undefined, incomingFeature: string, nowMs: number, ttlMin: number): boolean;
//# sourceMappingURL=feature-lease.d.ts.map