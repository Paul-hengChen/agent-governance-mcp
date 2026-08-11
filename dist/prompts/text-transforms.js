// Coded by @sr-engineer
// Governance-text transform passes, shared by BOTH skill-render paths (E51).
//
// Relocated verbatim out of prompts/build.ts, which kept them private to
// buildPromptForRole. That was a single-path fix for a two-path problem:
// tools/role.ts (`switchRole`, behind tw_switch_role) is the SECOND render path
// and the one most subagent dispatch actually goes through, and it applied
// neither pass — so every role SOP delivered that way carried raw
// `<!-- origin:… -->` / `<!-- rationale:… -->` markers the design intends the
// acting agent never to see. Both paths now call applyTextTransforms below.
//
// prompts/build.ts re-exports stripRationale and stripOriginTags unchanged:
// tests and scripts import them from dist/prompts/build.js, and that surface is
// deliberately preserved.
//
// NOT called from bin/agent-governance-context.mjs. That omission is a separate
// standing decision (governance-text-load-architecture DR-2/DR-3 single-copy
// rule), not an oversight this module fixes.
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
// inclusive) and clean up whitespace left behind. Idempotent; text with no
// markers is returned unchanged (safety default). Origin spans carry only
// maintainer provenance — version stamps ("(v3.26.0)"), backlog/finding codes
// ("(R10)", "A1"), retrospective pointers — never a rule any role acts on, so
// stripping them trims per-dispatch budget at EVERY detail level: applied
// unconditionally, FIRST, before the fullDetail-gated stripRationale pass
// (compose-not-strip pipeline: compose → stripOriginTags → stripRationale
// unless fullDetail). Unlike rationale fences, origin fences are INLINE
// (mid-sentence / end-of-heading), so the regex deliberately does NOT consume a
// trailing newline — doing so would join a fenced heading with the line below
// it. Origin fences never straddle a rationale boundary or a fragment seam
// (they may nest inside a rationale span), so the two strippers compose
// order-independently, and its \n{3,} collapse also normalizes any blank-run
// left at a fragment seam.
export function stripOriginTags(text) {
    return text
        .replace(/<!-- origin:start -->[\s\S]*?<!-- origin:end -->/g, "")
        .replace(/[ \t]+\n/g, "\n") // trim trailing spaces left by an inline strip
        .replace(/\n{3,}/g, "\n\n");
}
// The canonical pass order, in ONE place: stripOriginTags always, stripRationale
// unless fullDetail (compose-not-strip pipeline, ticket A9 AC5/AC6/AC7). Callers
// hand in already-composed text — constitution fragments, or a skill BODY with
// frontmatter already parsed off. Never hand in unparsed frontmatter: origin
// fences live in body prose, never in YAML, and this is deliberately downstream
// of parseSkillFile on both render paths.
//
// tw_switch_role has no fullDetail concept and passes fullDetail: false — it is
// a dispatch path, and the acting agent is exactly who the markers are hidden
// from.
export function applyTextTransforms(text, opts) {
    const originClean = stripOriginTags(text);
    return opts.fullDetail ? originClean : stripRationale(originClean);
}
//# sourceMappingURL=text-transforms.js.map