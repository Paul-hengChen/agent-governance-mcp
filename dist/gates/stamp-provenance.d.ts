export declare const HAND_AUTHORED_STAMP_RE: RegExp;
export declare function isHandAuthoredStamp(lastUpdated: string): boolean;
export declare const STAMP_REMEDIATION_NOTE_RE: RegExp;
export declare function hasStampRemediationAudit(input: {
    pending_notes?: string[];
} | null | undefined): boolean;
//# sourceMappingURL=stamp-provenance.d.ts.map