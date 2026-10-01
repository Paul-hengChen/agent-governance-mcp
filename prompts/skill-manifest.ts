// Coded by @sr-engineer
// Host-capability compose axis: per-skill fragment registry, inclusion
// predicate and composer (fs-free; callers inject the loader), used by the
// same three render paths as the constitution manifest. Fragments are verbatim
// slices of the skill they split, so composing with { taskTool: true }
// reproduces the original file. An absent or unknown host gets the lean profile.
// Rationale: specs/e260d-comment-rationale.md (prompts/skill-manifest.ts).

export type SkillSegmentTag = "core" | "host:claude-code";

export interface SkillSegment {
  readonly file: string; // basename in content/ (honors .current/ override via the caller's loader)
  readonly tag: SkillSegmentTag;
}

// Keyed by skill filename; each split skill owns its ordered fragment list
// (index order is document order). A skill absent from this map is composed
// whole, so unsplit skills stay byte-identical on every path.
export const SKILL_SEGMENTS: Readonly<
  Record<string, readonly SkillSegment[]>
> = {
  // Partition per the architecture's Coordinator Fragment Partition table
  // (T-D6-02). Ordered — index order IS document order; concatenating ALL
  // seven fragments reproduces the golden monolith byte-for-byte. The
  // frontmatter lives in the first CORE fragment so parseSkillFile still
  // finds it post-compose.
  "skill-coordinator.md": [
    { file: "coord-01-core-head.md",         tag: "core" },              // frontmatter + Persona + Routing/Scope gates + Design-source detection + Auto-Routing intro
    { file: "coord-02-host-dispatch.md",     tag: "host:claude-code" },  // Subagent Dispatch + Dispatch Brief Template + dispatch_pins overrides
    { file: "coord-03-core-fallback.md",     tag: "core" },              // tw_switch_role fallback + stop conditions + Escalation Routes + Crash-Resume
    { file: "coord-04-host-watermark.md",    tag: "host:claude-code" },  // Subagent Reply Watermark Validation
    { file: "coord-05-core-visual-drift.md", tag: "core" },              // Visual Verdict Boundary + Drift Reconcile
    { file: "coord-06-host-token.md",        tag: "host:claude-code" },  // Subagent Token Observability + Token Budget Brake
    { file: "coord-07-core-sop.md",          tag: "core" },              // SOP
  ],
};

export interface HostCapabilities {
  readonly taskTool: boolean; // host can Task(subagent_type=…)-dispatch subagents
}

// Capability map — the ONE place host-string → capability lives. Extending to
// a new host = one row here (future-proofs the tag name against per-client
// renames). Absent, empty, or unrecognized host ⇒ the lean no-capability
// profile (architecture Q2 default-exclude).
export function hostCapabilitiesFor(host: string | undefined): HostCapabilities {
  return { taskTool: host === "claude-code" };
}

// Inclusion predicate — mirrors constitution-manifest.ts includeSegment(). Pure.
export function includeSkillSegment(
  tag: SkillSegmentTag,
  caps: HostCapabilities,
): boolean {
  switch (tag) {
    case "core":
      return true;
    case "host:claude-code":
      return caps.taskTool;
  }
}

// Compose a skill's text for a dispatch. `load` is injected (fs-free module).
// Precedence: (1) a whole-file .current/ override is returned verbatim, with
// no host filtering; (2) registry fragments filtered by the predicate, joined
// with "" (they partition the file with no gaps); (3) an unsplit skill loads
// as-is.
export function composeSkill(
  skillFile: string,
  caps: HostCapabilities,
  load: (file: string) => string,
  hasOverride?: (file: string) => boolean, // optional whole-file override probe
): string {
  if (hasOverride?.(skillFile)) return load(skillFile); // precedence 1
  const segments: readonly SkillSegment[] | undefined = SKILL_SEGMENTS[skillFile];
  if (!segments) return load(skillFile); // precedence 3
  return segments
    .filter((s) => includeSkillSegment(s.tag, caps))
    .map((s) => load(s.file))
    .join(""); // precedence 2
}
