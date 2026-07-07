// Coded by @sr-engineer
// Compose-not-strip (ticket A9): the single ordered manifest of constitution
// fragment files + the inclusion predicate. This is the SINGLE SOURCE OF TRUTH
// for "which governance text ships on which dispatch" — imported by
// prompts/build.ts, bin/agent-governance-context.mjs (dynamic import of the
// compiled dist/prompts/constitution-manifest.js), and
// scripts/measure-context-cost.mjs. It replaces the old DR-3 "keep the
// stripChainOnly regex copies in sync" contract with a structural one: one
// shared list, no duplicated regexes (see
// specs/compose-not-strip-overlays-architecture.md, DR-4).
//
// Each fragment is a VERBATIM byte-slice of the retired monolith
// content/constitution.md (DR-1, Option R): the <!-- chain-only:* --> /
// <!-- design-only:* --> structural markers are retained INSIDE the fragments
// as inert boundary text — composition selects fragments by tag and never
// parses markers, so a malformed marker can no longer change shipped
// governance text (spec AC11). Invariant: concatenating every fragment in
// manifest order reproduces the old monolith byte-for-byte (golden baseline:
// test/fixtures/compose-golden/constitution-monolith.txt).
//
// Origin (<!-- origin:* -->) and rationale (<!-- rationale:* -->) spans stay
// wherever they physically fall inside fragments; they are handled by the
// stripOriginTags / stripRationale text-transform passes run over the
// assembled result (prompts/build.ts pipeline: compose → stripOriginTags
// always → stripRationale unless fullDetail).
// Ordered — index order IS document order. Concatenation of every entry === the
// retired content/constitution.md monolith.
export const CONSTITUTION_SEGMENTS = [
    { file: "const-01-core-head.md", tag: "core" },
    { file: "const-02-design-mvp.md", tag: "design" },
    { file: "const-03-core-surgical.md", tag: "core" },
    { file: "const-04-design-surgical.md", tag: "design" },
    { file: "const-05-core-standards.md", tag: "core" },
    { file: "const-06-chain-31-head.md", tag: "chain" },
    { file: "const-07-design-chain-gates.md", tag: "chain-design" },
    { file: "const-08-chain-31-mid.md", tag: "chain" },
    { file: "const-09-design-chain-vround.md", tag: "chain-design" },
    { file: "const-10-chain-31-tail.md", tag: "chain" },
    { file: "const-11-design-chain-32.md", tag: "chain-design" },
    { file: "const-12-chain-r10-s4.md", tag: "chain" },
    { file: "const-13-design-chain-s4.md", tag: "chain-design" },
    { file: "const-14-chain-end.md", tag: "chain" },
    { file: "const-15-core-tail.md", tag: "core" },
];
// Inclusion predicate. `chain` = full (non-lite) dispatch
// (skillFile !== LITE_SKILL_FILE); `design` = feature is design-armed
// (the existing hasDesignModeRequiringVisual(...).required probe — the SAME
// arm signal the server-side PASS gates use, so the visual governance text
// ships exactly when those gates can fire).
export function includeSegment(tag, opts) {
    switch (tag) {
        case "core":
            return true;
        case "design":
            return opts.design;
        case "chain":
            return opts.chain;
        case "chain-design":
            return opts.chain && opts.design;
    }
}
//# sourceMappingURL=constitution-manifest.js.map