// Coded by @sr-engineer
// Shared handoff.md types. Kept in their own module so the parse module
// (tools/handoff-parse.ts) and the write module (tools/handoff-write.ts) can
// share the HandoffState / protocol-field types WITHOUT importing each
// other's types — only the two runtime functions (parseHandoff /
// writeHandoffState) cross the parse↔write boundary (the heal-write /
// existing-state-preserve circular call; see the top-of-file notes in both
// modules). tools/handoff.ts re-exports every type below verbatim so
// importers of the barrel never change. (E36)
export {};
//# sourceMappingURL=handoff-types.js.map