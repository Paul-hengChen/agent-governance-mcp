// Coded by @sr-engineer
// Governance-text transform passes shared by both skill-render paths:
// prompts/build.ts (buildPromptForRole) and tools/role.ts (switchRole, behind
// tw_switch_role). build.ts re-exports stripRationale and stripOriginTags for
// tests and scripts. bin/agent-governance-context.mjs deliberately does not
// call them (single-copy rule, specs/governance-text-load-architecture.md).
// Rationale: specs/e260d-comment-rationale.md (prompts/text-transforms.ts).
// Remove every <!-- rationale:start --> … <!-- rationale:end --> block (markers
// inclusive) and collapse blank lines left behind. Idempotent; text with no
// markers is returned unchanged (full-detail safety default). Rationale blocks
// carry only "why" prose (war-story / Reason: paragraphs) that onboards humans
// and forms audit trail — never a rule a role acts on — so stripping them for
// chain-role dispatch trims per-dispatch budget without dropping enforcement.
export function stripRationale(text) {
    return text
        .replace(/<!-- rationale:start -->[\s\S]*?<!-- rationale:end -->\n?/g, "")
        .replace(/[ \t]+\n/g, "\n") // trim trailing spaces left by an inline strip
        .replace(/\n{3,}/g, "\n\n");
}
// Remove every <!-- origin:start --> … <!-- origin:end --> span (markers
// inclusive) and clean up whitespace. Idempotent. Origin spans carry only
// maintainer provenance, so this runs at every detail level, before
// stripRationale. Origin fences are inline, so the regex must NOT consume a
// trailing newline (that would join a fenced heading to the line below it).
// Rationale: specs/governance-tag-strip.md.
export function stripOriginTags(text) {
    return text
        .replace(/<!-- origin:start -->[\s\S]*?<!-- origin:end -->/g, "")
        .replace(/[ \t]+\n/g, "\n") // trim trailing spaces left by an inline strip
        .replace(/\n{3,}/g, "\n\n");
}
// The canonical pass order in one place: stripOriginTags always, then
// stripRationale unless fullDetail. Callers pass already-composed text with
// frontmatter parsed off (origin fences live in body prose, never in YAML).
// tw_switch_role passes fullDetail: false: it is a dispatch path, and the
// acting agent is exactly who the markers are hidden from.
export function applyTextTransforms(text, opts) {
    const originClean = stripOriginTags(text);
    return opts.fullDetail ? originClean : stripRationale(originClean);
}
//# sourceMappingURL=text-transforms.js.map