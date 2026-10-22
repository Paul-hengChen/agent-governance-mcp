// Coded by @sr-engineer
// Shared handoff.md types, in their own module so handoff-parse.ts and
// handoff-write.ts share them without importing each other's types; only
// parseHandoff and writeHandoffState cross that boundary. tools/handoff.ts
// re-exports every type here. READ_VIEW_MARKER_PREFIX is this module's only
// runtime export (E135/E138): a dependency-free string constant shared by the
// read view that emits it and the tool boundary that refuses it.
/** Prefix of every synthetic entry the tw_get_state read view may emit
 *  (marker.prefix, U+27E6 … U+27E7). Emitted by tools/handoff-parse.ts,
 *  refused on write-back by tools/registry.ts. The ONLY copy of the literal
 *  in tools/ source. (specs/e135-handoff-notes-ledger.md AC10) */
export const READ_VIEW_MARKER_PREFIX = "⟦agc read-view⟧";
//# sourceMappingURL=handoff-types.js.map