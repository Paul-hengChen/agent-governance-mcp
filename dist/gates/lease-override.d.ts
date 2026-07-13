export declare const LEASE_OVERRIDE_NOTE_RE: RegExp;
export declare function classifyLeaseOverride(input: {
    lease_override?: boolean;
    pending_notes?: string[];
} | null | undefined): "absent" | "audited" | "unaudited";
//# sourceMappingURL=lease-override.d.ts.map