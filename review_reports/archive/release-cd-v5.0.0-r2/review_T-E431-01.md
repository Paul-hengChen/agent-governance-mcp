# Review — T-E431-01

covers: T-E431-01, T-E431-02, T-E431-03, T-E431-04, T-E431-05, T-E431-06

## Round 1 — CHANGES_REQUESTED — by code-reviewer

Reviewer model: opus (sr-engineer also ran on opus, so the same blind spots are possible; the old-path checks below were run as behaviour diffs against a fresh build of base `0efc203`, not read from the code).

## Summary
- Diff `0efc203...HEAD`: persisted `chain_path` marker and `sr_return_count` (handoff schema 15→16, file mode only), the test-first overlay applied inside `validateTransition`, `SR_RETURN_CAP_EXCEEDED` (registry 34→35), judge identity per marker (`judgeFor` / `requireJudge`), the four build-entry checks armed on marked pm→qa, docs.
- Scope is clean: no `content/**`, `prompts/**`, `tools/storage*.ts`, `schema/migrations-sqlite.ts`, `gates/pipeline.ts`, `index.ts`, `README.md` or `test/**` change; `PROMPT_REGISTRY` untouched; `dist/` equals a fresh `tsc` build of HEAD (`diff -rq -x '*.map'` empty).
- Old-path invariance mostly holds by measurement: `validateTransition` deep-equal to base on 342,144 unmarked requests apart from the 40 sanctioned AC9 hint suffixes; `computeNewRound` identical for every next other than `code-reviewer:PASS`; `ALLOWED_TRANSITIONS` identical; caps 14/4/4/6, new cap 2. A replay of an unmarked old chain through the tool boundary (zod + handler, 31 calls, incl. qa FAIL loop, Amend-Resume, verdict mismatch, both completed-tasks codes, `tw_complete_task`, PASS) differs from base in exactly two rows: the sanctioned OQ3 delta, and the unsanctioned delta in finding 1.
- Verdict: CHANGES_REQUESTED, on one required finding (known item 2).

## AC Completeness
AC1 — implemented — tools/transitions.ts:372-376 (opens), tools/handoff-orchestrator.ts:285-286; smoke run: pm→qa(entry, marker)→sr accepted, `chain_path: "test-first"` persisted after each
AC2 — implemented — tools/transitions.ts:388-390 (closes); grid: marked pm→sr and architect→sr rejected `TRANSITION_REJECTED` with the closed-edge suffix
AC3 — implemented — tools/registry.ts:463-469 (refine admits code-reviewer), tools/handoff-orchestrator.ts:1313-1320, :636-639; smoke run: marked cr PASS with `review_verdict: APPROVED`, `completed_tasks: []` after cr `tw_complete_task` accepted, `last_agent: code-reviewer`, `status: PASS`
AC4 — implemented — tools/handoff-orchestrator.ts:1404-1409 + tools/transitions.ts:187-202; smoke run returns msg.pass_judge, no state written
AC5 — implemented — no qa→cr edge on either path; smoke run: crFAIL→qa accepted, qa→cr rejected, qa→sr→cr accepted
AC6 — implemented — tools/transitions.ts:604-625; smoke run: returns 1 and 2 persist `sr_return_count` 1, 2 with `review_round` unchanged, return 3 rejected with `allowed: [pm:In_Progress]`, sr→cr at count 2 accepted
AC7 — implemented — closed reset edge (tools/transitions.ts:387) + unchanged FAIL increment; `REVIEW_ROUND_EXCEEDED` collapse unchanged
AC8 — implemented — tools/handoff-orchestrator.ts:404-408 and the three sibling predicates; smoke run: marked entry without cut rejected `CUT_APPROVAL_REQUIRED`; unmarked `resume_of` hand-back exempt (base replay identical)
AC9 — implemented — tools/transitions.ts:698-704 (hint suffix), sanctioned delta confirmed on 40 grid points only
AC10 — implemented — tools/transitions.ts:514-533 (`TRANSITION_REJECTED`), tools/handoff-write.ts:426-430 (same-feature carry, dropped on feature change); zod enum has no clearing value
AC11 — implemented — tools/transitions.ts:378-383; smoke run: `code-reviewer:PASS` → release-engineer accepted; unmarked cr PASS rejected as base
AC12 — partial — unmarked outcomes identical except finding 1 (see Correctness)
AC13 — implemented — repro gate untouched; marked sr→cr still runs `REPRO_MANIFEST_MISSING`; cr PASS opened by the overlay
AC14 — implemented — tools/tasks.ts:73-80; smoke run: marked qa rejected with msg.complete_task_judge, cr completes; unmarked as base (replay rows c1, c2, c3 identical)
AC15 — implemented — tools/handoff-orchestrator.ts:701-724 (marked branch), :636-639 (verdict), :1509-1513 (ledger removal via `judgeFor`)
AC16 — implemented — schema/versions.ts:8, schema/migrations-handoff.ts:199-209 (stamp-only), tools/handoff-parse.ts:704-708 (heal passes `srReturnCount`); sqlite stays 2
AC17 — implemented — gates/registry.ts:189-205 (entry, `(none)` row, `TRANSITION_GATE_CODES` 7); pipeline steps unchanged (only `codes` grows); tools/transitions.ts:438-447 hop-cap comment rewritten
AC18 — implemented — orchestrator passes neither marker field outside file mode (:285-286), `readPersistedChainPath` returns undefined for non-file storage, `SqliteHandoffStorage.writeState` reads neither option
AC19 — implemented — CONTRIBUTING.md:53,64; docs/architecture.md:77,101-102,114 (box widths 68 like neighbours); specs/qa-flow-enforcement-architecture.md new overlay section; CLAUDE.md 250 lines, only line 78 changed
AC20 — implemented (sr-side) — manifest at qa_reports/expected-red_e431-test-first-server-path.txt lists 69 entries; sampled 5 (e150 AC20, e151 AC11, e26 R2, e295 AC11, visual-evidence-gate AC-4), each a real locatable test; full-suite run is qa scope

## Correctness

1. **required — unsanctioned old-path delta (known item 2, AC12).** tools/handoff-orchestrator.ts:1399-1409. The general PASS guard moved from before `storage.parse` (base) to after the gate context is built. For an unmarked write that bypasses zod (an in-process caller of `handleUpdateState`), a non-judge PASS against an unreadable handoff now throws the parse error instead of returning base's text. Measured against the base build with a direct `handleUpdateState({ status: "PASS", agent_id: "sr-engineer" })` after corrupting `handoff.md`:
   - base: returns `⛔ BLOCKED: tw_update_state(status=PASS) is reserved for qa-engineer. Called by "sr-engineer". ...` (no `isError`, nothing written)
   - head: throws `Failed to parse handoff.md frontmatter: ...`
   The same applies to any other `storage.parse` throw (a handoff written by a newer server, a layout conflict, a SQLite read error). AC12 allows only two old-path text changes (the AC9 hint and the OQ3 delta), and the blueprint's own decision record says "Every unmarked outcome keeps text, isError and ordering vs BLOCKED". The input is narrow (zod-bypassing callers only) but the contract is explicit and the fix is small. Suggested fix: put the guard back at its base position (after the `completed_tasks` normalisation, before `storage.parse`) and pick the judge with the read-only peek you already use for the code-reviewer half: `requireJudge(parsed.agent_id, "tw_update_state(status=PASS)", readPersistedChainPath(parsed.workspace_path, parsed.active_feature))`. The peek returns undefined for a missing, unreadable or other-feature handoff and under SQLite, so the unmarked branch is base's `requireQaEngineer` text byte for byte, and AC4 still holds (a marked qa-engineer PASS reads `test-first` and is rejected). The post-context guard can then go. The only input on which the peek and `resolvedChainPath` disagree is a pm PASS carrying `chain_path` on an unmarked feature, which the matrix rejects anyway and which has no base equivalent. Acceptance: the corrupted-handoff case above returns base's text; AC4 unchanged.

No other correctness findings. Checked and found right: the marker set-point rule and the illegal-set rejection (unreachable with `next_chain_path` undefined); immutability (one-value enum, write-layer carry, no PM re-arm, dropped on feature change because the orchestrator passes `prev_chain_path: undefined` and the write layer compares `active_feature`); `SR_RETURN_CAP_EXCEEDED` fires only on the third sr→qa return of a marked same-feature write, after the round and hop caps; `computeSrReturnCount` resets on `pm:In_Progress` and feature change; `review_round` resets on `code-reviewer:PASS` (new branch placed after the FAIL increment, unreachable unmarked); every code-reviewer FAIL counts on a marked feature because the only resetting hand-off (cr:In_Progress→qa) is closed; the next_role lookahead passes the post-write marker and counter; the code-reviewer PASS peek is read-only (`parseHandoff`, not `readHandoffState`, so no heal-write before pre-flight).

## Quality

2. **recommended** — tools/handoff-orchestrator.ts:219 `let state;` has no annotation, so it is an evolving implicit `any` until assigned. Annotate it (`let state: HandoffState | null;`) to keep Constitution §2 strict typing explicit. (Moot if finding 1's fix changes this function's shape.)
3. **recommended** — `agc check — comments` flags tools/handoff-orchestrator.ts:695 (long-block 8 lines): this diff grew a 6-line block past the 7-line limit with the two-line "On a test-first feature..." note. Fold the note into one line or move it beside the `testFirst` branch. The other warnings touching the diff are kept: transitions.ts:438 (the hop-cap comment is the blueprint's prescribed AC17 text; base was already 8 lines), handoff-orchestrator.ts:1497 (base block was already 11 lines, +1 line naming the judge), gates/registry.ts:78 (the mapping table, +1 row by design), and the file-ratio warnings (pre-existing files, new comments are one per field).
4. **optional** — tools/tasks.ts:75-79: the ternary is redundant; `requireJudge` already delegates to `requireQaEngineer` when the marker is absent. `const gate = requireJudge(parsed.agent_id, "tw_complete_task", readPersistedChainPath(parsed.workspace_path));` is what the blueprint specified and drops the `requireQaEngineer` import.
5. **optional** — specs/qa-flow-enforcement-architecture.md:238 says the marked PASS "is still rejected by `PASS_MISSING_EVIDENCE`"; that is the pipeline step name, the error code a writer sees is `MISSING_EVIDENCE`. Name the code (or say "the `PASS_MISSING_EVIDENCE` step (`MISSING_EVIDENCE`)").

## Architecture
Fits the blueprint: overlay beside an untouched `ALLOWED`, three optional `TransitionRequest` fields, `judgeFor` / `requireJudge`, no new module, no new pipeline step, `UpdateStateGateContext` not extended. Two benign deviations: the build-entry widening uses `isTestFirstEntryTarget` inside each step's existing inline predicate instead of a shared `isBuildEntryEdge` (keeps the pinned gate-body byte shape; boolean identical unmarked), and `tools/tasks.ts` keeps a ternary (finding 4). Finding 1 follows blueprint item 2 literally; the blueprint's own invariant (decision record "Where the PASS identity check goes") and the spec's AC12 both say the old-path text must not change, so the placement, not the design, is what needs fixing. The new `tools/tasks.ts` → `tools/handoff-orchestrator.ts` import creates no runtime cycle (the orchestrator imports `./registry.js` for types only).

## Security
No findings. `chain_path` is a closed one-value enum at the zod boundary and dropped at parse time unless it equals `test-first`; `sr_return_count` is server-computed and parsed defensively (finite, ≥1, floored). The pre-preflight peek is read-only and swallows parse errors. No secrets, no new I/O path outside the workspace's own handoff. Docs and comments contain no personal or machine-specific information.

## Performance
No regression. One extra `parseHandoff` per `tw_complete_task` call and per code-reviewer PASS (both rare, one small file read); `resolveChainPath` is pure and called a handful of times per write; `allowedSuccessors` filters arrays of at most 8 entries.

## Verdict
CHANGES_REQUESTED — one required finding: the moved PASS guard changes an unmarked write's outcome text outside the two deltas AC12 allows; the fix is a placement change in tools/handoff-orchestrator.ts, and everything else (marker, overlay, cap, counters, schema, judge identity, scope, docs) is correct.

## Round 2 — APPROVED — by code-reviewer

covers: T-E431-01, T-E431-02, T-E431-03, T-E431-04, T-E431-05, T-E431-06

Reviewer model: opus. Scope of this round: fix commit `9926eee` (`git diff ce68ec3..9926eee`), checked against the spec and blueprint, plus a full-suite rerun of HEAD. Every check below was rerun against a fresh `npm run build` of HEAD.

## Summary
- `9926eee` touches tools/handoff-orchestrator.ts (guard moved, type annotation, comment), specs/qa-flow-enforcement-architecture.md:238 (one line), dist/ and lane state. Nothing else changed.
- The PASS judge guard is back at its base position, tools/handoff-orchestrator.ts:1328-1341: after the `completed_tasks` normalisation and before `storage.parse`. It now reads the judge from `readPersistedChainPath(ws, active_feature)`. The post-context guard is gone.
- Round-1 findings 1, 2, 3 and 5 are fixed. Finding 4 (optional) was left as is, which is allowed.
- `npm run build` exits 0 and leaves `dist/` byte-identical to the committed tree (no diff after the build).
- Full suite (`node scripts/test-lock.mjs -- npm test`): 4391 tests, 4320 pass, 69 fail, 2 skipped. The 69 failures match `qa_reports/expected-red_e431-test-first-server-path.txt` exactly: 0 unexpected, 0 missing.
- Verdict: APPROVED.

## AC Completeness
AC1-AC11, AC13-AC20 — implemented. Round-1 evidence stands; `9926eee` touches none of them except AC4, rechecked below.
AC4 — implemented — tools/handoff-orchestrator.ts:1332-1341 + tools/transitions.ts:187-202. Direct call on a marked feature: a qa-engineer PASS returns `⛔ BLOCKED: tw_update_state(status=PASS) is reserved for code-reviewer on a test-first feature (chain_path: test-first). Called by "qa-engineer". ...` and the handoff stays byte-identical. A sr-engineer PASS gets the same code-reviewer text. A code-reviewer PASS with `review_verdict: APPROVED` is accepted: `status: "PASS"` is written and `chain_path: "test-first"` is kept.
AC12 — implemented — round-1 finding 1 is fixed. Unmarked sr-engineer PASS with a corrupted `handoff.md` (direct `handleUpdateState`): returns `⛔ BLOCKED: tw_update_state(status=PASS) is reserved for qa-engineer. Called by "sr-engineer". Hand off to qa-engineer and pass agent_id="qa-engineer".`, with no `isError` and no throw. That is base's `requireQaEngineer` text byte for byte. The missing-`agent_id` variant returns base's "unidentified agent" text. With a readable unmarked handoff the result is the same text and the handoff is unchanged. A marked file with a different `active_feature` reads as unmarked and returns the qa-engineer text, which matches the feature-change rule.
OQ3 (AC12 widened, ruling a) — unchanged: an unmarked code-reviewer PASS still throws the refine `ZodError` (`status="PASS" requires agent_id="qa-engineer"`) before pre-flight.

## Correctness
No findings.
- `readPersistedChainPath` (tools/handoff-orchestrator.ts:213-228) cannot throw earlier than base. `getActiveStorage()` does not throw, `storage.parse` is inside try/catch, and a non-file storage returns before any read. So the guard's only new I/O is a read-only peek that fails toward the unmarked (base) branch. Any `storage.parse` throw (corrupt file, newer-server file, SQLite) still happens where base had it, at :1344.
- Peek vs the removed `resolvedChainPath`: the two agree on every PASS write except one. `isChainPathSetPoint` (tools/transitions.ts:405-413) is true for a PASS write only when `next.agent === "pm"`. So the one difference is a pm PASS carrying `chain_path` on an unmarked feature. It now gets the qa-engineer text instead of the code-reviewer text and is still rejected (direct call checked). Base has no equivalent, because base has no `chain_path` field. This is not a regression.
- `resolvedChainPath` (:1413) is still used at :1514, :1595, :1619 and :1705, so removing the guard leaves no dead binding. The comment at :1410-1412 ("picks the feature's judge below") is still accurate.

## Quality
- Finding 2 is fixed: `let state: HandoffState | null;` at :219, with `HandoffState` added to the existing type-only import.
- Finding 3 is fixed: the comment at :701 is one line. `agc check` no longer warns about the code-reviewer block. The only orchestrator warning left is :1501, which round 1 already kept with a reason.
- The new guard comment (:1328-1331, 4 lines) is within the limit and explains why the peek is used.
- Finding 4 (optional, tools/tasks.ts ternary) is unchanged. It is behaviour-neutral and not blocking.
- Finding 5 is fixed: specs/qa-flow-enforcement-architecture.md:238 now names `MISSING_EVIDENCE` (the `PASS_MISSING_EVIDENCE` pipeline step).

## Architecture
The fix now follows the blueprint's decision record ("Every unmarked outcome keeps text, isError and ordering vs BLOCKED"). The identity check sits where base had it, the judge comes from the same read-only peek the code-reviewer pre-check uses (:1315-1323), and the pipeline gained no new step.

## Security
No findings. The peek is read-only, swallows parse errors toward the stricter (base) rule, and reads only the workspace's own handoff.

## Performance
No regression. Every PASS write now does one extra small `parseHandoff` read before pre-processing (code-reviewer PASS writes already did one). PASS writes are rare and the file is small.

## Verdict
APPROVED. The required AC12 finding is fixed with base text and ordering restored, AC4 and OQ3 still hold, the red set equals the manifest exactly, and nothing else in the diff regressed.
