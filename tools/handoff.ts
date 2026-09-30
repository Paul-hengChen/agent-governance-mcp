// Coded by @sr-engineer
// Tools: handoff state read/write with format enforcement.
//
// Thin barrel. Parsing, writing, the tw_get_state tool handler, and the
// shared types each live in a dedicated module:
//   - tools/handoff-types.ts    — HandoffState / ExternalRef / protocol-field types
//   - tools/handoff-parse.ts    — readAndMigrate, parseHandoff, readHandoffState
//   - tools/handoff-write.ts    — WriteHandoffStateOptions, writeHandoffState
//   - tools/handoff-orchestrator.ts — handleGetState (moved alongside the
//     sibling handleUpdateState tool handler; registry.ts imports both from
//     there now)
// This file re-exports the public API verbatim so existing importers
// (prompts/build.ts, tools/storage.ts, tools/storage-sqlite.ts, and every
// test/*.test.mjs importing "../dist/tools/handoff.js") resolve unchanged.
// (E36)
export type {
  ExternalRefState,
  ExternalRef,
  ResumeOfTarget,
  ReviewVerdict,
  DispatchMode,
  HandoffState,
} from "./handoff-types.js";
export { parseHandoff, readHandoffState } from "./handoff-parse.js";
// Deprecation note (kept in sync with the real declaration site,
// tools/handoff-write.ts, which carries the full JSDoc + both overload
// signatures): @deprecated v3.15.0: the legacy 11-positional
// writeHandoffState signature is retained for backwards-compat only; prefer
// the options-object overload (`writeHandoffState({ workspacePath,
// activeFeature, status, ... })`). Planned removal in v4.0.0.
export { writeHandoffState, type WriteHandoffStateOptions } from "./handoff-write.js";
