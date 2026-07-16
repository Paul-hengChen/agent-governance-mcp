# QA review — e-p3-tail-batch (batched)

covers: T-E25-01, T-E27-01, T-E28-01, T-E29-01, T-E30-01, T-RELSOP-01

Feature: `e-p3-tail-batch` (backlog rows E25/E27/E28/E29/E30, docs/backlog.md
~lines 121-126, plus T-RELSOP-01 — content/skill-release-engineer.md bump-build
line). P3 tail batch, single review+QA round per SOP 4a small-batch
composition. Code review: APPROVED (`review_reports/review_T-E25-01.md`,
covers all 6 T-ids) — zero blocking findings, one non-blocking E28 observation
(pinned below as reviewer probe 1).

## ⚠️ Integrity disclosure (recorded per coordinator instruction)

After the legitimate code-reviewer APPROVED write landed, an ILLEGITIMATE
state write hit `.current/handoff.md` with `agent_id=qa-engineer`,
`status=In_Progress`, and `completed_tasks` pre-filled with all 6 T-ids —
zero QA evidence on disk at that point, no qa-engineer had actually run
(E18-class identity-swap replay; filed as backlog E32). Independently
verified ground truth before doing any other work: `tasks.md` checkboxes for
all 6 ids were still `[ ]` (correct — `tw_complete_task` had never run); only
the handoff ledger was polluted. Treated the handoff `completed_tasks` field
as UNTRUSTED throughout this round; did NOT run `tw_sync` (would have
mirrored the phantom ledger onto `tasks.md`). This round's legitimate
`tw_complete_task` calls + this evidence file converge the ledger to truth.

## Expected-Red Diff (Phase 0.5)

Pre-edit `npm test`: **1570/1587 pass, 17 fail**. Diffed the 17 failing test
names against `qa_reports/expected-red_e-p3-tail-batch.txt` — EXACT match, no
more, no fewer:
- 11 `test/compose-equivalence.test.mjs` golden-byte-equality tests (10
  build/hook fixtures + the `cat(15 fragments) === monolith` invariant), all
  broken by the T-E25-01 const-15 §6 git-vocabulary edit (core-tagged,
  ships on every dispatch arm).
- 4 `test/context-budget.test.mjs` token-budget-cap assertions (AC2 lean,
  design-arm floor, teamwork bundle, non-design floor), same root cause.
- 2 `test/stale-dispatch-detection.test.mjs` verbatim-message pins (T4, T4b),
  broken by the T-E29-01 Crash-Resume pointer appended to `stale_dispatch.message`.

Zero unexpected reds. Proceeded to re-baseline per the manifest.

## Phase 1 — Re-baseline (§2, qa-owned; sr-engineer made zero test edits)

- Regenerated all 11 `test/fixtures/compose-golden/*.txt` files: ran
  `npm run build && node scripts/capture-constitution-golden.mjs` for the 10
  build/hook fixtures; hand-regenerated `constitution-monolith.txt` (the
  script only re-captures it from the now-deleted `content/constitution.md`
  monolith) by concatenating the 15 manifest fragments in
  `CONSTITUTION_SEGMENTS` order and overwriting the golden — the AC8 "cat(15)
  === monolith" invariant is defined as this frozen golden, so it's the
  correct regeneration target. Byte delta +239 (const-15's +243-char bullet
  edit, minus normalization). All 11 compose-equivalence tests pass.
- b9 recompute-and-bump on the 4 context-budget caps, following the
  established Phase-2 convention (exact measured value, no extra headroom,
  test title AND assert string both updated to avoid the drift class the e7
  bump fixed): AC2 lean 4485→4544 (+59), design-arm floor 8625→8685 (+60),
  teamwork bundle 16720→16779 (+59), non-design floor 6528→6587 (+59).
  Consistent ~59-60 ~tok growth across all 4 — the same core-tagged const-15
  bullet appears unfenced on every one of these bundles. Saving-margin
  invariants re-verified and hold (design-arm−non-design = 2098 ~tok, still
  ≥2080; raw−stripped = 353 ~tok, still ≥240).
- Re-pinned `test/stale-dispatch-detection.test.mjs` T4 + T4b to the exact
  new verbatim message (read directly from `tools/handoff.ts:680-692`, not
  copied from a test-failure diff): the base Copy/Strings sentence followed
  by the E29 Crash-Resume pointer sentence, concatenated on the SAME
  `message` field (no new advisory key).

Post-re-baseline: all 17 previously-red tests pass; full suite green before
any new coverage was added.

## Phase 2 — New coverage authored

**`test/e28-shrink-warning.test.mjs`** (new file, 11 tests) — E28
wholesale-replace shrink warning (`tools/handoff-orchestrator.ts:1264-1315`),
exercised end-to-end through `TOOL_REGISTRY`'s real `tw_update_state` handler
(zod + gates + orchestrator logic), not just unit-level:
- W1/W2: a same-feature write that shrinks `dispatch_pins`/`external_refs`
  vs on-disk prior state warns, naming the DROPPED entries only (not the
  kept ones). W1b: a single write shrinking both fields produces two
  warnings, one per field.
- S1/S2: omitting the field entirely on a same-feature write is silent
  (server carry-forward, not a shrink).
- F1/F2: a feature-change write is silent even though the supplied set is
  smaller than the OTHER feature's prior set (feature-scoped drop is
  legitimate per the existing AC-3/AC-4 dispatch_pins/external_refs
  semantics) — exercised via the documented `lease_override` human
  attestation to legally cross the `FEATURE_LEASE_HELD` per-workspace
  mutual-exclusion gate, which is orthogonal to what's under test here.
- J1/J2 (reviewer probe 2 — no strict-envelope consumer breaks): a shrink
  envelope is EXACTLY the base 3 keys (`success`/`path`/`updated_at`) plus
  the additive `warnings` key, verified via `Object.keys().sort()` equality,
  not mere presence-checking; a non-shrinking write's envelope carries NO
  `warnings` key at all (byte-identical pre-E28 shape). Grepped `test/*.mjs`
  for any strict/exact-key-set assertion on the `tw_update_state` response
  envelope — zero hits; the `agc-adapters` "no stale warnings" pin
  (`test/agc-adapters.test.mjs`) is a DIFFERENT feature (`agc check` /
  AGENTS.md adapter staleness), confirmed unrelated, matching
  code-reviewer's cross-check in `review_reports/review_T-E25-01.md`.
- P1a/P1b (reviewer probe 1 — confirm-and-pin, do NOT fix): a same-cardinality
  entry SWAP on `dispatch_pins` or `external_refs` (e.g. `{sr,release}` →
  `{sr,qa}`, or ref B → ref C at equal count) drops an entry with NO warning
  — shrink detection is `nextSize < prevLength` (strict cardinality), so
  equal-count swaps evade it. Confirmed this IS current behavior and matches
  the spec's literal "shrink"/"fewer entries" wording (in-scope-correct, per
  code-reviewer's non-blocking observation). A fix (entry-identity diff) is
  filed as backlog **E33** — explicitly NOT implemented this round; these
  tests PIN the current contract so a future accidental fix-without-a-ticket
  doesn't silently change it out from under E33's own acceptance criteria.

**`test/e22-stale-notify.test.mjs`** (extended, +2 tests: E29a, E29b) — E29
Crash-Resume pointer, verified against the REAL end-to-end message
construction (distinct from the file's existing unit-level `advisory()`
fixture helper, which fabricates its own pre-E29 message and never exercises
`tools/handoff.ts`'s real message-building code):
- E29a: the pointer (`Crash-Resume: ground-truth before re-dispatch...`)
  reaches BOTH the in-band `tw_get_state` advisory AND the EXTERNAL
  watch-file payload (E22 emit) verbatim, including the
  "skill-coordinator Crash-Resume Protocol" full-protocol name.
- E29b (reviewer probe 3): the longer E29 message does NOT disturb the E22
  `(dispatched_at, role)` dedupe contract — two consecutive `tw_get_state`
  reads on an unchanged stale window still dedupe on the second
  (`notify.skipped_duplicate: true`, watch-file mtime unchanged), proving the
  dedupe key is the tuple, never the message string.

## Reviewer probe 4 — live arm-and-verify (staleDispatchNotifyFile)

Performed the docs/config.md §staleDispatchNotifyFile 5-step verify recipe
live, via the REAL `tw_get_state` MCP tool (not a dist-internal unit call),
against a disposable temp workspace:
1. Armed `.current/.config.json` with `staleDispatchNotifyFile`.
2. Wrote a `handoff.md` with `next_role` stamped 16 min in the past.
3. First `tw_get_state` call: `stale_dispatch.notify.emitted: true`, watch-file
   created with all 8 documented payload keys (`role`, `dispatched_at`,
   `elapsed_minutes`, `threshold_minutes`, `message`, `workspace`, `emitted_at`).
4. Second `tw_get_state` call: `notify.emitted: false`,
   `notify.skipped_duplicate: true`; watch-file mtime confirmed byte-identical
   (via `stat -f %m` before/after) — matches the doc's claim exactly.
5. (Step 5, the `fswatch` example command, is a documentation-only external
   watcher illustration — not independently executable as a test assertion;
   the command shape was read and is consistent with the payload produced.)

Doc-accuracy verdict: `docs/arming.md` §4 and `docs/config.md`
§staleDispatchNotifyFile are BEHAVIORALLY TRUE against the live tool surface
— no doc inaccuracy found, no doc edit needed. One operational observation
(not a doc bug, not blocking): the live MCP server process backing this
session's own tool calls returned the PRE-E29 short message text (no
Crash-Resume pointer) on both live calls, because that long-running server
process's module cache predates this round's `tools/handoff.ts` edit —
expected behavior for a long-lived server process, not a code defect. The
E29 pointer's correctness was independently confirmed via E29a/E29b above,
which import fresh `dist/` output directly.

## Phase 3 — Full regression

- `npm test`: **1600/1600 pass**, 0 fail, 0 cancelled (1587 post-re-baseline
  baseline + 11 new `test/e28-shrink-warning.test.mjs` + 2 new E29a/E29b in
  `test/e22-stale-notify.test.mjs`).
- `npx tsc` (build): zero errors.
- `node scripts/check-version.mjs`: OK, `dist/index.js` parity confirmed
  (3.90.0).

## Verdict

PASS for all 6 ids: T-E25-01, T-E27-01, T-E28-01, T-E29-01, T-E30-01,
T-RELSOP-01. Re-baseline confirmed byte-exact against the manifest before
any edit (Phase 0.5 discipline honored); 17/17 expected reds now pass; 13 new
tests added (11 E28 + 2 E29) covering the batch's only server-code surfaces;
all 4 reviewer probes addressed (probe 1 confirmed-and-pinned as-is per E33,
probe 2 confirmed no strict-envelope consumer exists, probe 3 confirmed
dedupe unbroken, probe 4 live-verified with zero doc inaccuracy found). Full
suite 1600/1600 green, build clean. Handoff `completed_tasks` ledger
pollution (backlog E32) treated as untrusted throughout; ground truth
(`tasks.md` all `[ ]` pre-round) independently re-verified before starting.
## 2026-07-16T09:03:34.544Z — PASS — by qa-engineer

PASS — e-p3-tail-batch (T-E25-01, T-E27-01, T-E28-01, T-E29-01, T-E30-01, T-RELSOP-01).

INTEGRITY DISCLOSURE: prior to this round's real work, an illegitimate handoff write (agent_id=qa-engineer, completed_tasks pre-filled with all 6 ids, zero evidence on disk) landed on top of the legitimate code-reviewer APPROVED write — E18-class identity-swap replay, filed as backlog E32. Independently verified ground truth before touching anything: tasks.md checkboxes were still [ ] for all 6 ids (tw_complete_task had never run); only the handoff ledger was polluted. Did not run tw_sync. This write's completed_tasks/review_task_ids reflect REAL tw_complete_task calls made this round, each backed by qa_reports/review_T-E25-01.md evidence (covers: line names all 6 ids).

Phase 0.5: pre-edit npm test = 1570/1587 pass, 17 fail; diffed exactly against qa_reports/expected-red_e-p3-tail-batch.txt — zero unexpected reds (11 compose-equivalence goldens + 4 context-budget caps + 2 stale-dispatch verbatim pins, all traced to the T-E25-01 const-15 edit and T-E29-01 message edit).

Re-baseline: regenerated 11 test/fixtures/compose-golden/*.txt (incl. hand-regenerating constitution-monolith.txt since the source monolith is deleted); b9-recomputed the 4 context-budget caps (4485->4544, 8625->8685, 16720->16779, 6528->6587, consistent +59-60 ~tok growth, saving-margin invariants re-verified); re-pinned stale-dispatch-detection T4/T4b to the exact new Crash-Resume message read from tools/handoff.ts source.

New coverage: test/e28-shrink-warning.test.mjs (11 new tests) — shrink-warns naming dropped entries, omit/feature-change silent (via documented lease_override bypass), envelope stays additive-JSON-only (reviewer probe 2: grepped test/*.mjs, zero strict-envelope consumers exist), same-count entry swap confirmed-and-PINNED as currently silent per backlog E33 (reviewer probe 1 — NOT fixed this round, only pinned). test/e22-stale-notify.test.mjs +2 tests (E29a/E29b) — Crash-Resume pointer reaches both the in-band advisory and the E22 external watch-file verbatim; (dispatched_at,role) dedupe confirmed unbroken by the longer message (reviewer probe 3).

Reviewer probe 4: live-armed staleDispatchNotifyFile in a disposable temp workspace and called the REAL tw_get_state MCP tool twice — emitted:true + watch-file with all 8 documented keys on the first call, notify.skipped_duplicate:true + unchanged mtime on the second. docs/arming.md and docs/config.md's staleDispatchNotifyFile section are behaviorally true; no doc inaccuracy found, no doc edit made. (Noted, non-blocking: the live server process's own module cache predates this round's source edit, so its own message text lacked the E29 pointer — expected for a long-lived process, not a code defect; E29a/E29b independently confirm correctness against fresh dist/.)

Full suite: 1600/1600 pass, 0 fail (1587 baseline + 11 E28 + 2 E29). npx tsc: 0 errors. node scripts/check-version.mjs: OK, dist parity confirmed (3.90.0). Evidence: qa_reports/review_T-E25-01.md (covers all 6 ids).

