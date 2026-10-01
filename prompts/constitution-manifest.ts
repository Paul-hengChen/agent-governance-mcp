// Coded by @sr-engineer
// Ordered constitution fragment manifest plus its inclusion predicate: the one
// place that decides which governance text ships on which dispatch (read by
// prompts/build.ts, the SessionStart hook via dist/, and the measure script).
// Fragments are verbatim slices of the retired single-file constitution; their
// structural markers stay inside as inert text and are never parsed.
// Rationale: specs/compose-not-strip-overlays-architecture.md.

export type SegmentTag = "core" | "design" | "chain" | "chain-design";

export interface ConstitutionSegment {
  readonly file: string; // basename in content/ (honors .current/ override via loadContent)
  readonly tag: SegmentTag;
}

// Ordered: index order is document order, and concatenating every entry
// reproduces the retired single-file constitution.
export const CONSTITUTION_SEGMENTS: readonly ConstitutionSegment[] = [
  { file: "const-01-core-head.md",          tag: "core" },
  { file: "const-02-design-mvp.md",         tag: "design" },
  { file: "const-03-core-surgical.md",      tag: "core" },
  { file: "const-04-design-surgical.md",    tag: "design" },
  { file: "const-05-core-standards.md",     tag: "core" },
  { file: "const-06-chain-31-head.md",      tag: "chain" },
  { file: "const-07-design-chain-gates.md", tag: "chain-design" },
  { file: "const-08-chain-31-mid.md",       tag: "chain" },
  { file: "const-09-design-chain-vround.md", tag: "chain-design" },
  { file: "const-10-chain-31-tail.md",      tag: "chain" },
  { file: "const-11-design-chain-32.md",    tag: "chain-design" },
  { file: "const-12-chain-r10-s4.md",       tag: "chain" },
  { file: "const-13-design-chain-s4.md",    tag: "chain-design" },
  { file: "const-14-chain-end.md",          tag: "chain" },
  { file: "const-15-core-tail.md",          tag: "core" },
];

// Inclusion predicate. `chain` = full (non-lite) dispatch
// (skillFile !== LITE_SKILL_FILE); `design` = feature is design-armed
// (the existing hasDesignModeRequiringVisual(...).required probe — the SAME
// arm signal the server-side PASS gates use, so the visual governance text
// ships exactly when those gates can fire).
export function includeSegment(
  tag: SegmentTag,
  opts: { chain: boolean; design: boolean },
): boolean {
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
