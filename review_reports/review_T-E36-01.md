# Review — T-E36-01

covers: T-E36-01

## Summary
- E36 zero-behavior-change refactor, Option-A (thin adapter, NON-breaking; positional overload retained, removal still v4.0.0-deferred).
- (a) `tools/handoff.ts` (was 1,276 lines) split into `handoff-types.ts` (types), `handoff-parse.ts` (parse/migrate/read), `handoff-write.ts` (WriteHandoffStateOptions + writeHandoffState); `handoff.ts` is now a 33-line barrel re-export. `handleGetState` moved into `handoff-orchestrator.ts`; `registry.ts` import rewired.
- (b) Single real impl `writeHandoffStateCore(opts)` in handoff-write.ts; positional overload → thin arg-packing adapter, mirrored in `storage.ts` (FileHandoffStorage) and `storage-sqlite.ts` (SqliteHandoffStorage via private `writeStateCore`).
- Verified against the pre-E36 (`HEAD:tools/handoff.ts`) source, not the sr-engineer summary. `npm run build` clean, `npx tsc --noEmit` clean, `npm test` 1618/1618 PASS (0 fail) — exact baseline.
- Verdict: APPROVED.

## Correctness
No findings.

- **Positional→options parity (highest-risk class) — verified 3× independently:**
  - `handoff-write.ts:586-599` — positional args pack into WriteHandoffStateOptions in the exact old order/names: workspacePath, activeFeature, status, completedTasks ?? [], pendingNotes ?? [], blockingReason, lastAgent, qaRound, prdPath, reviewRound, visualRound, hopCount. No swap (qaRound/reviewRound/visualRound distinct and correctly positioned), no drop, no rename vs the old positional signature (`HEAD:tools/handoff.ts:831-844`).
  - `storage.ts:127-149` — FileHandoffStorage packs the same 11 positionals (no hopCount in its signature, matching the pre-E36 forward which also stopped at visualRound); order/names correct.
  - `storage-sqlite.ts` dispatcher + `writeStateCore` — positional path packs the same 11; hopCount/scopeDecision/scopeDecisionWhy deliberately left unpacked on the positional path, matching the old positional branch which left them undefined. writeStateCore reads each field from `opts.*` by correct name.
- **Core body verbatim:** diff of old body (`ensureDir`→return, HEAD lines 943-1261) against new `writeHandoffStateCore` (lines 213-531) shows only three non-behavioral deltas: removed `as string[]` casts on completedTasks/pendingNotes (core narrows them via `?? []` first — identical value) and one comment path update (`readHandoffState` → `tools/handoff-parse.ts`). All gate/preserve/normalise/timestamp logic identical.
- **WriteHandoffStateOptions interface** field set byte-identical (26 fields, same names/types/order).
- **handleGetState** moved verbatim (body + preceding "No guard" comment) from HEAD line 1272 into `handoff-orchestrator.ts:89`.
- **SQLite writeStateCore** persistence logic below the destructuring header is untouched (diff context resumes at unchanged `fetchLastUpdated`). DR-5 file-mode-only fields still not destructured — matches pre-E36.
- Test `AC-10: positional writeHandoffState with 8 args … defaults round counters to 0` (#1604) directly exercises the positional path and passes.

## Quality
No findings. New module headers accurately document the split and the deliberate cycle. Comment cross-references updated to new file paths (e.g. LEASE_TTL_MIN note now cites `handoff-parse.ts`). Barrel carries a deprecation note kept in sync with the real declaration site.

## Architecture
No findings. Split maps cleanly to the four responsibilities (types / parse / write / tool-handler). Barrel preserves the public import surface: every symbol old `handoff.ts` exported (ExternalRefState, ExternalRef, ResumeOfTarget, ReviewVerdict, DispatchMode, HandoffState, parseHandoff, readHandoffState, writeHandoffState + both overloads, WriteHandoffStateOptions) is re-exported. Sole non-re-exported old export is `handleGetState`, which correctly relocated to the orchestrator; its only importer (`registry.ts`) was rewired, and no test imports it from `./handoff`. Both writeState/writeHandoffState overload pairs remain declared everywhere (handoff-write.ts, storage.ts, storage-sqlite.ts) — no overload removed, no public signature changed.

## Security
No findings. No new trust boundary, no new input parsing, no secrets. Atomic tmp+rename publish, file lock, and freshness check all preserved verbatim inside writeHandoffStateCore.

## Performance
No findings. Adapter is a constant-time arg-pack + single delegating call — no extra I/O, no added file read (the single existing-state read is preserved). No algorithmic change vs base.

## handoff-parse ↔ handoff-write cycle
Confirmed call-time only, genuinely safe. `handoff-write.ts:44` imports parseHandoff, called at `:350` inside `writeHandoffStateCore`'s `withFileLock` closure. `handoff-parse.ts:46` imports writeHandoffState, called at `:399` inside `readAndMigrate`'s heal block (indented function body). Neither module reads the other's export at module-init time (no top-level call sites) — ES named-import references resolve lazily at call time, so the cycle cannot produce a temporal-dead-zone / undefined-binding hazard.

## Test integrity
`git diff -- test/` is empty and no untracked files in `test/` — zero test-expectation edits (§2 clean).

## Verdict
APPROVED — verified against the pre-E36 source: zero behavior change, positional→options packing correct at all three sites, public surface byte-complete, both overloads retained, cycle safe, build + 1618/1618 tests green at baseline.
