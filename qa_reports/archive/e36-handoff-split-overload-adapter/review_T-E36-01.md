# Review — T-E36-01 (QA)

covers: T-E36-01

## Summary
- E36 zero-behavior-change refactor, Option-A (thin adapter, NON-breaking; positional overload retained).
- code-reviewer APPROVED (review_reports/review_T-E36-01.md): verified against pre-E36 `tools/handoff.ts` source — positional→options packing correct at all 3 sites (handoff-write.ts, storage.ts, storage-sqlite.ts), core body verbatim, public surface byte-complete, both overloads retained, parse↔write cycle call-time-only and safe.
- QA scope here: extend test coverage (§2, QA-owned) to PIN the adapter-parity claim the code-reviewer verified by inspection, so a future arg-order regression is caught mechanically rather than relying on manual re-inspection.

## Phase 0.5 — Expected-Red Diff
Skipped (no `qa_reports/expected-red_e36-handoff-split-overload-adapter.txt` manifest declared — this is a pure refactor, not a bugfix-mode ticket).

## Phase 1 — Review
No new findings beyond code-reviewer's APPROVED verdict. Re-read `tools/handoff-write.ts` (the positional→options dispatcher, lines 566-600) and `tools/storage.ts` (FileHandoffStorage.writeState, lines 102-150) directly to design the pinning tests below against the ACTUAL packing order, not the review report's prose description.

Confirmed independently:
- `writeHandoffState`'s positional overload packs 12 args (workspacePath..hopCount) into `WriteHandoffStateOptions` in-order, no swap/drop/rename.
- `FileHandoffStorage.writeState` maintains its OWN independent positional→options packing (11 args, workspacePath..visualRound, no hopCount) — it does not simply forward raw positional args to the handoff-write.ts adapter, so it is a genuinely separate regression surface and needed its own test (spec instruction: "Add analogous coverage for storage.ts FileHandoffStorage.writeState if not already pinned"). Grepped `test/*.test.mjs` for existing `.writeState(` positional-vs-options parity coverage — none of the ~30 call sites across other test files perform a byte-level parity comparison between the two call shapes; all either use one shape only or exercise unrelated gate behavior. Confirmed NOT already pinned.
- `SqliteHandoffStorage.writeState` (storage-sqlite.ts) has the same dispatcher shape but SQLite mode is out of scope for this file-mode markdown round-trip test (per the ticket's stated file list: handoff.ts split, storage.ts, storage-sqlite.ts — code-reviewer's byte-for-byte source diff already covers the sqlite dispatcher; a SQLite DB round-trip test would duplicate that inspection without adding mechanical regression protection beyond what the file-mode tests already establish for the identical packing pattern).

3a/3b (Copy/Visual Audit Gates): N/A — no `specs/<feature>.md` for this mini-chain refactor ticket (backlog row = spec, per E35 pattern); no user-facing copy or visual tokens touched.

## Phase 1.5 — Visual Compare
Skipped (no `design/<feature>.md`, no Visual Baselines — non-UI refactor).

## Phase 2 — Discussion
No issues found in Phase 1. Proceeded directly to Phase 3.

## Phase 3 — Tests

### Test file discovery
`test/writestate-options-object.test.mjs` (existing, AC-6..AC-10 for the original v3.15.0 dual-API spec) is the natural home for E36's adapter-parity pin — same subject (writeHandoffState dual API), same file. Extended it rather than creating a new file.

### Tests added (2)

1. **`E36: positional writeHandoffState (full 12-arg form, all 3 round counters + blockingReason + prdPath) is byte-identical to the equivalent options-object call`**
   - Calls `writeHandoffState` (from `tools/handoff-write.ts` via the `tools/handoff.ts` barrel) with the FULL legacy positional signature: workspacePath, activeFeature, status, completedTasks, pendingNotes, blockingReason, lastAgent, qaRound=2, prdPath, reviewRound=3, visualRound=4, hopCount=5 — deliberately using distinct, non-zero values for the three round counters (2/3/4) so a transposition between adjacent positional slots would be caught (a bug that leaves all three round counters at their omitted-default of 0 would NOT be caught by distinct values, which is exactly why non-zero/non-equal values were chosen).
   - Runs the equivalent options-object call against a second workspace with named keys.
   - Asserts `readNormalized(wsPositional) === readNormalized(wsOptions)` — a helper that reads the raw `handoff.md` file and blanks only the `last_updated` timestamp (the one field that legitimately differs call-to-call; YAML key ORDER is asserted identical, not just parsed-field equality, because both calls flow through the identical `writeHandoffStateCore` object-construction order when passed the same field set).
   - Belt-and-suspenders follow-up assertions confirm `qa_round=2`, `review_round=3`, `visual_round=4`, `blocking_reason`, and `prd_path` landed correctly (guards against the byte-compare passing because BOTH call sites independently regressed the same way).

2. **`E36: FileHandoffStorage.writeState positional (full 11-arg form, all 3 round counters + blockingReason + prdPath) is byte-identical to the equivalent options-object call`**
   - Same shape, targeting `storage.ts`'s `FileHandoffStorage.writeState` directly (imported from `dist/tools/storage.js`) rather than the barrel's `writeHandoffState` — this exercises storage.ts's OWN positional→options packing logic, a separate code path/regression surface from test 1.
   - Uses distinct round-counter values (6/7/8) and a distinct feature/status/note set (`status: "FAIL"`) to avoid any accidental collision with test 1's fixture data.
   - Same byte-identical + follow-up field assertions.

### Spec-to-AC map
No formal `specs/e36-*.md` exists (backlog row = spec). Coverage maps to the ticket's own acceptance language: "Extend the test to pin the E36 thin-adapter delegation — assert that a positional-form call and the equivalent options-object call produce byte-identical handoff.md output (round-trip), covering the full positional arg list including the three round counters (qaRound/reviewRound/visualRound), blockingReason, and prdPath" — satisfied by test 1 (handoff-write.ts adapter) and test 2 (storage.ts adapter, "analogous coverage... if not already pinned").

### Coverage gate
Both new tests exercise the full width of the positional signature at each site (not a subset) — 80%+ line coverage on the changed adapter-dispatch lines is satisfied structurally (every packed field is asserted, not just a sample).

### Security smoke tests
N/A — no new trust boundary, no new input parsing, no auth/permission surface introduced by this refactor (consistent with code-reviewer's Security finding of "No findings").

## Phase 3.5 — AC Execution Log
Skipped (no `proof:`-annotated ACs — no formal spec file for this refactor ticket).

## Phase 4 — Run
- `npm run build`: clean (tsc, zero errors). `check:version` — dist/index.js parity OK (3.92.1).
- `npm test`: **1620/1620 PASS, 0 fail** (was 1618/1618 pre-E36 per code-reviewer's baseline record; +2 for the two new E36 adapter-parity tests added here). Both new tests (`ok 1606`, `ok 1607` in the run) pass.
- CI runnability: `npm test` ran headlessly, zero human interaction, `node --test test/*.test.mjs` exit clean.

## Verdict
**PASS** — E36 thin-adapter delegation is now mechanically pinned at both adapter sites (handoff-write.ts's `writeHandoffState` positional overload, and storage.ts's independently-packing `FileHandoffStorage.writeState` positional overload). A future arg-order regression (swap, drop, or rename of any of the 11/12 positional fields, including the three round counters) will fail these tests via the byte-identical handoff.md comparison, not just individual field-value checks. Full suite green at 1620/1620.
## 2026-07-20T11:23:53.601Z — PASS — by qa-engineer

E36 zero-behavior-change refactor QA PASS. code-reviewer APPROVED confirmed adapter arg-order parity at all 3 sites by inspection; QA extended test/writestate-options-object.test.mjs with 2 new tests that PIN that parity mechanically: (1) writeHandoffState positional (full 12-arg form incl. qaRound/reviewRound/visualRound/blockingReason/prdPath/hopCount) vs options-object — byte-identical handoff.md (modulo last_updated); (2) FileHandoffStorage.writeState positional (11-arg, its own independent packing) vs options-object — same byte-identical assertion. Both new tests pass. Build clean, npm test 1620/1618+2 PASS, 0 fail. QA evidence: qa_reports/review_T-E36-01.md.

