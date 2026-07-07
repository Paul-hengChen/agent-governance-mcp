export type SegmentTag = "core" | "design" | "chain" | "chain-design";
export interface ConstitutionSegment {
    readonly file: string;
    readonly tag: SegmentTag;
}
export declare const CONSTITUTION_SEGMENTS: readonly ConstitutionSegment[];
export declare function includeSegment(tag: SegmentTag, opts: {
    chain: boolean;
    design: boolean;
}): boolean;
//# sourceMappingURL=constitution-manifest.d.ts.map