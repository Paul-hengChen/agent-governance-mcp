// Coded by @sr-engineer
// Thin barrel: re-exports the handoff types (handoff-types.ts), parsing
// (handoff-parse.ts) and writing (handoff-write.ts) verbatim, so importers of
// tools/handoff.ts and dist/tools/handoff.js never change. handleGetState
// lives in handoff-orchestrator.ts beside handleUpdateState.
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
