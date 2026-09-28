export type SkillSegmentTag = "core" | "host:claude-code";
export interface SkillSegment {
    readonly file: string;
    readonly tag: SkillSegmentTag;
}
export declare const SKILL_SEGMENTS: Readonly<Record<string, readonly SkillSegment[]>>;
export interface HostCapabilities {
    readonly taskTool: boolean;
}
export declare function hostCapabilitiesFor(host: string | undefined): HostCapabilities;
export declare function includeSkillSegment(tag: SkillSegmentTag, caps: HostCapabilities): boolean;
export declare function composeSkill(skillFile: string, caps: HostCapabilities, load: (file: string) => string, hasOverride?: (file: string) => boolean): string;
//# sourceMappingURL=skill-manifest.d.ts.map