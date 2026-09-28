export declare const MODEL_TIERS: readonly ["opus", "sonnet", "haiku"];
export type ModelTier = (typeof MODEL_TIERS)[number];
export interface SkillFrontmatter {
    recommended_model?: ModelTier;
}
export interface ParsedSkillFile {
    frontmatter: SkillFrontmatter;
    body: string;
}
export declare function parseSkillFile(text: string): ParsedSkillFile;
//# sourceMappingURL=skill-frontmatter.d.ts.map