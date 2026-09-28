// Coded by @sr-engineer
// Shared handoff.md types (E36 — e36-handoff-split-overload-adapter).
// Extracted from tools/handoff.ts so the parse module (tools/handoff-parse.ts)
// and the write module (tools/handoff-write.ts) can both depend on the same
// HandoffState / protocol-field types WITHOUT importing each other's types —
// only the two runtime functions (parseHandoff / writeHandoffState) cross the
// parse↔write boundary (the pre-existing heal-write / existing-state-preserve
// circular call, unchanged by this split; see tools/handoff-parse.ts and
// tools/handoff-write.ts top-of-file notes). tools/handoff.ts re-exports every
// type below verbatim so no importer of the pre-split barrel churns.
export {};
//# sourceMappingURL=handoff-types.js.map