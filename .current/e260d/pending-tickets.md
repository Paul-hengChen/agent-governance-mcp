# Pending tickets — lane e260d

```pending-ticket
lane_local_id: E260D-NEW-1
title: Move the errorCode-to-doc-file mapping out of a comment in gates/registry.ts so its 42-line block can shrink
priority: P3
depends_on: [E260]
source: pm, lane e260d cut (2026-10-01)
body: |
  test/error-code-contract.test.mjs (parseDocFileMappingComment, the "doc-file mapping (c12)" test)
  reads a 33-row table from a comment above GATE_REGISTRY in gates/registry.ts and asserts all 33 rows.
  specs/fanout-e260.md lists no comment pin for lane e260d, and the test belongs to wave-2 lane e260g,
  so E260 keeps the table as the one sanctioned block over 20 lines (spec decision D1).
  Proposal: carry the doc files as data (for example a docFiles field on each GATE_REGISTRY entry) and
  have the test read the data, after which the comment shrinks to a one-line pointer. This changes code
  and a test, so it is outside the comment-only E260.
```

```pending-ticket
lane_local_id: E260D-NEW-2
title: Correct the coordinator fragment file names in the d6 architecture spec (skill-coord-NN-*.md vs shipped content/coord-NN-*.md)
priority: P3
depends_on: [E260]
source: sr-engineer, lane e260d T-E260D-06 finding, filed in T-E260D-07 (2026-10-01)
body: |
  specs/d6-host-capability-compose-axis-architecture.md names the coordinator SOP fragments
  `content/skill-coord-NN-*.md` (its file list near line 150 and the suggested naming near line 299),
  but the shipped fragments are `content/coord-01-core-head.md` .. `content/coord-07-core-sop.md`, as
  registered in SKILL_SEGMENTS in prompts/skill-manifest.ts. The `skill-` prefix is reserved for whole
  skill files that carry frontmatter (the skill-frontmatter guard globs content/skill-*.md and requires
  recommended_model), so the shipped names are correct and the spec is stale. Fix: update the spec text
  to the shipped names (or add an amendment note). Docs only; lane e260d did not edit the spec because
  it is outside the comment-only E260 scope.
```

## Applied
