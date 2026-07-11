// Coded by @sr-engineer
// Host-capability compose axis (ticket D6): the per-skill fragment registry +
// inclusion predicate + composer. Mirrors prompts/constitution-manifest.ts's
// data-module style (ordered data + pure functions, NO fs in this module — the
// caller injects the loader), but is keyed PER SKILL FILE in SKILL_SEGMENTS
// rather than being a new tag on ConstitutionSegment: the constitution and the
// skills are different documents with different segment sets and axes, and
// overloading CONSTITUTION_SEGMENTS would break its golden invariant
// ("concatenation === constitution monolith") and its predicate signature
// (specs/d6-host-capability-compose-axis-architecture.md, DR-1).
//
// Three call sites share this module (the same three render paths the
// constitution manifest serves): prompts/build.ts (GetPrompt),
// tools/role.ts switchRole (tw_switch_role), and
// bin/agent-governance-context.mjs (SessionStart hook, via the compiled
// dist/prompts/skill-manifest.js).
//
// Capability derivation: the workspace declares its host via the
// additive-optional `.current/.config.json` "host" field (tools/config.ts);
// hostCapabilitiesFor() is the ONE place the host string maps to capability
// booleans. Default when the signal is absent/unknown is the LEAN profile
// ({ taskTool: false }) — host-tagged prose is excluded (architecture Q2).
// The SessionStart hook is the single structural exception: it is
// Claude-Code-only by construction, so it composes with { taskTool: true }
// when no config host is set (config still overrides even there).
//
// Fragment files are VERBATIM byte-slices of the skill they partition (same
// Option-R discipline as the constitution fragments): composing a split skill
// with { taskTool: true } reproduces the original monolith byte-for-byte
// (golden baseline: test/fixtures/compose-golden/skill-coordinator-monolith.txt).
// Fragment naming: coord-NN-*.md — deliberately NOT the skill-*.md prefix,
// which is reserved for whole, frontmatter-carrying skill files (the
// skill-frontmatter regression guard globs content/skill-*.md and requires
// recommended_model in every match; fragments are headerless byte-slices).
// The tag lives in this registry, not the filename.
// Keyed by skill filename — each split skill owns its ordered fragment list
// (index order IS document order). A skill ABSENT from this map is composed
// as-is (whole file), so only split skills change behavior and unsplit skills
// stay byte-identical on every path (architecture AC6(b)).
//
// T-D6-03 audit outcomes (architecture §Audit Criteria — one line per
// non-coordinator skill, no silent skips):
//   skill-sr-engineer.md  — no CC-only prose found — left untouched.
//   skill-pm.md           — no split; the Cut-Approval Gate's "Task-subagent
//                           dispatch" clause is one branch of a shared
//                           cut_approved-writer rule every host needs — kept
//                           CORE per the tie-break (never lose a shared rule).
//   skill-architect.md    — no CC-only prose found — left untouched
//                           ("subcommand dispatch" at L46 is a code example).
//   skill-researcher.md   — no CC-only prose found — left untouched.
//   skill-qa-engineer.md  — no CC-only prose found — left untouched.
export const SKILL_SEGMENTS = {
    // Partition per the architecture's Coordinator Fragment Partition table
    // (T-D6-02). Ordered — index order IS document order; concatenating ALL
    // seven fragments reproduces the golden monolith byte-for-byte. The
    // frontmatter lives in the first CORE fragment so parseSkillFile still
    // finds it post-compose.
    "skill-coordinator.md": [
        { file: "coord-01-core-head.md", tag: "core" }, // frontmatter + Persona + Routing/Scope gates + Design-source detection + Auto-Routing intro
        { file: "coord-02-host-dispatch.md", tag: "host:claude-code" }, // Subagent Dispatch + Dispatch Brief Template + dispatch_pins overrides
        { file: "coord-03-core-fallback.md", tag: "core" }, // tw_switch_role fallback + stop conditions + Escalation Routes + Crash-Resume
        { file: "coord-04-host-watermark.md", tag: "host:claude-code" }, // Subagent Reply Watermark Validation
        { file: "coord-05-core-visual-drift.md", tag: "core" }, // Visual Verdict Boundary + Drift Reconcile
        { file: "coord-06-host-token.md", tag: "host:claude-code" }, // Subagent Token Observability + Token Budget Brake
        { file: "coord-07-core-sop.md", tag: "core" }, // SOP
    ],
};
// Capability map — the ONE place host-string → capability lives. Extending to
// a new host = one row here (future-proofs the tag name against per-client
// renames). Absent, empty, or unrecognized host ⇒ the lean no-capability
// profile (architecture Q2 default-exclude).
export function hostCapabilitiesFor(host) {
    return { taskTool: host === "claude-code" };
}
// Inclusion predicate — mirrors constitution-manifest.ts includeSegment(). Pure.
export function includeSkillSegment(tag, caps) {
    switch (tag) {
        case "core":
            return true;
        case "host:claude-code":
            return caps.taskTool;
    }
}
// Compose a skill's text for a dispatch. `load` is injected (fs-free module).
// Precedence:
//   (1) whole-file .current/ override → returned verbatim, NO host filtering
//       (an explicit override is authoritative; same semantics the
//       constitution accepted for whole-document overrides);
//   (2) registry fragments filtered by the predicate, concatenated in order
//       (join("") — fragments carry their own newlines, they partition the
//       monolith with no gaps or overlaps);
//   (3) unsplit skill → load the base file as-is (passthrough).
export function composeSkill(skillFile, caps, load, hasOverride) {
    if (hasOverride?.(skillFile))
        return load(skillFile); // precedence 1
    const segments = SKILL_SEGMENTS[skillFile];
    if (!segments)
        return load(skillFile); // precedence 3
    return segments
        .filter((s) => includeSkillSegment(s.tag, caps))
        .map((s) => load(s.file))
        .join(""); // precedence 2
}
//# sourceMappingURL=skill-manifest.js.map