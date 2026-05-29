// Coded by @sr-engineer
// handoff.md YAML frontmatter migrations. Self-registers on import — call sites
// in tools/handoff.ts pull this module in for the side-effect.

import { CURRENT_VERSIONS, registerMigration } from "./versions.js";

// v0 → v1: pre-versioning handoffs simply lacked the `schema_version` key.
// No field rename, no value coercion — just stamp the version. Future
// migrations (v1→v2 etc.) would live below this one.
registerMigration<Record<string, unknown>, Record<string, unknown>>({
  kind: "handoff",
  from: 0,
  to: 1,
  up: (input) => ({ ...input, schema_version: 1 }),
});

// v1 → v2: add review_round counter for the code-reviewer chain step.
// Pure transform — the stderr warning for in-flight sr-engineer:In_Progress
// tickets is emitted by tools/handoff.ts:readAndMigrate (caller-side I/O)
// after this step runs, so the migration stays pure.
registerMigration<Record<string, unknown>, Record<string, unknown>>({
  kind: "handoff",
  from: 1,
  to: 2,
  up: (input) => ({ ...input, schema_version: 2, review_round: 0 }),
});

// v2 → v3: add visual_round counter for the pixel-fidelity sub-loop
// (Constitution §3.1, v3.14.0). Bumps only when pending_notes contains
// `visual_fail:` and design/<feature>.md declares ## Visual Baselines.
// Pure transform — the round counter is initialised to 0 for in-flight
// tickets, identical to the v1→v2 pattern.
registerMigration<Record<string, unknown>, Record<string, unknown>>({
  kind: "handoff",
  from: 2,
  to: 3,
  up: (input) => ({ ...input, schema_version: 3, visual_round: 0 }),
});

// Compile-time guard: if CURRENT_VERSIONS.handoff is ever bumped without a
// matching registration added above, the runner's missing-step error fires
// at read time. This reference makes the dependency explicit for grep.
void CURRENT_VERSIONS.handoff;
