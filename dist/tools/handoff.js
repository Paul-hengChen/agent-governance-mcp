export { parseHandoff, readHandoffState } from "./handoff-parse.js";
// Deprecation note (kept in sync with the real declaration site,
// tools/handoff-write.ts, which carries the full JSDoc + both overload
// signatures): @deprecated v3.15.0: the legacy 11-positional
// writeHandoffState signature is retained for backwards-compat only; prefer
// the options-object overload (`writeHandoffState({ workspacePath,
// activeFeature, status, ... })`). Planned removal in v4.0.0.
export { writeHandoffState } from "./handoff-write.js";
//# sourceMappingURL=handoff.js.map