# Review — T-E139-01 (lane e139: E139, E236, E136, E154)

covers: T-E154-01, T-E136-01, T-E136-02, T-E139-01, T-E236-01

## Round 1 — APPROVED — by code-reviewer

Scope: the lane's own commits dd55449 (T-E154-01), 71dbdfc (T-E136-01), 4cfee36 (T-E136-02), 1658a62 (T-E139-01), 8995ecb (T-E236-01), reviewed as `git diff 3a53bf8 8995ecb`. The origin/main merge 8ff8666 (E364 dependency bump) is out of scope. Judged against `specs/e139-evidence-verdict-integrity.md` (no architecture spec; the cut has no architect hop). Reviewer model is opus, the same tier as sr-engineer, so same-model bias is possible; it was offset by running independent end-to-end probes against `dist/` rather than relying on reading alone.

## Summary
- E154: `parseCoversIds` now unions every `covers:` line (line 1 verbatim, later lines add only new ids) via an internal global regex copy; the exported `COVERS_LINE_RE` is untouched.
- E136: one injective encoder `encodeEvidenceId` in `tools/evidence-file.ts`, used at all six task-id path sites; `active_feature` sanitisers untouched; no legacy fallback.
- E139: new registry entry `NON_REVIEWER_VERDICT_REJECTED` (35 entries) emitted as a second, file-mode-only branch of the existing `REVIEW_VERDICT_STATUS_MISMATCH` step; the code-reviewer branch is byte-identical.
- E236: `recordReviewInFileUndoable` plus a ctx-keyed WeakMap undo in the orchestrator, run on pipeline rejection and on a throw from the pipeline or `writeState`, discarded on success.
- Build zero errors, `dist/` byte-identical after a fresh `npm run build`, `npm audit --audit-level=high` exit 0, file boundary clean. Verdict: APPROVED (no required findings).

## AC Completeness
Source-side ACs are judged here; the proof tests named by each AC are qa-owned (T-E154-02, T-E136-03, T-E139-02, T-E236-02, T-E139-03) and do not exist yet. Each AC below was checked by reading the diff and, where marked "probe", by a scratch run against `dist/`.

- AC-E139-1 — implemented — tools/handoff-orchestrator.ts:627-659; envelope text matches Copy/Strings e139.envelope exactly; probe: sr-engineer, pm, architect, release-engineer self-loops with `review_verdict=APPROVED` rejected with the exact prefix, handoff byte-unchanged.
- AC-E139-2 — implemented — tools/handoff-orchestrator.ts:641-646 (prevTuple code-reviewer:In_Progress, nextTuple qa-engineer:In_Progress, APPROVED); probe: APPROVED row with evidenced `review_task_ids` accepted.
- AC-E139-3 — implemented — probe: qa self-loop APPROVED, qa CHANGES_REQUESTED on the code-reviewer:In_Progress -> qa-engineer:In_Progress edge, and qa PASS carrying a verdict are all rejected with the new code.
- AC-E139-4 — implemented — the new branch requires `agent_id !== "code-reviewer"` (tools/handoff-orchestrator.ts:639); probe: code-reviewer FAIL/CHANGES_REQUESTED accepted, code-reviewer FAIL/APPROVED still REVIEW_VERDICT_STATUS_MISMATCH.
- AC-E139-5 — implemented — branch guarded by `parsed.review_verdict &&` (tools/handoff-orchestrator.ts:637); probe: sr-engineer write without verdict accepted.
- AC-E139-6 — implemented — branch guarded by `ctx.storage instanceof FileHandoffStorage` (tools/handoff-orchestrator.ts:636).
- AC-E139-7 — implemented (source half) — gates/registry.ts:41 (union), :110 (`(none)` mapping row), :584-606 (entry after NON_QA_COMPLETED_TASKS_REJECTED, producer orchestrator, envelope plain-text, documentedInProse false, all four Copy/Strings field values byte-match), tools/handoff-orchestrator.ts:601 (step codes). Telemetry inherits through `handleUpdateState`'s `extractGateCodeFromText`. The count re-pins are T-E139-03 (qa).
- AC-E139-8 — implemented — step 10 precedes QA_REVIEW_RECORD; probe: qa PASS with `qa_review` + forged verdict rejected and `qa_reports/` never created.
- AC-E139-9 — implemented — no `content/**`, `test/fixtures/compose-golden/**` or `test/context-budget.test.mjs` change vs merge-base e5f325d.
- AC-E236-1 — implemented — probe: existing `qa_reports/review_T-Y.md` bytes preserved after a later-step rejection (QA_COMPLETION_EVIDENCE_MISSING representative; EXPECTED_RED_DIFF_MISSING runs through the same undo path in `handleUpdateStateCore`).
- AC-E236-2 — implemented — created file unlinked when size equals post-append size (gates/qa-review.ts:74-77); probe confirmed.
- AC-E236-3 — implemented — probe: no `qa_reports/` after a QA_COMPLETION_EVIDENCE_MISSING rejection (gates/qa-review.ts:86-91).
- AC-E236-4 — implemented — the undo runs for every pipeline rejection (tools/handoff-orchestrator.ts:1301-1304), so every step after QA_REVIEW_RECORD is covered by construction.
- AC-E236-5 — implemented — `writeStateKeepingEvidence` (tools/handoff-orchestrator.ts:151-162); probe: STATE DRIFT thrown with the same message, `qa_reports/` absent afterwards.
- AC-E236-6 — implemented — record stays at step 12, appended bytes identical to the pre-change format (header + `## <ISO> — PASS — by qa-engineer` + trimmed notes); probe: same-write-evidence PASS accepted and file present.
- AC-E236-7 — implemented — size check plus tail-bytes `equals` (gates/qa-review.ts:72-82); probe: both a later append and a same-size tail tamper leave the file untouched; undo does not throw.
- AC-E236-8 — implemented — `recordReviewInFile` keeps its signature and delegates (gates/qa-review.ts:30-38); suite result below.
- AC-E136-1 — implemented — tools/evidence-file.ts:24-38; probe: all five spec examples map as stated; `é`, `\uD800`, NUL and `:` map to `__00E9`, `__D800`, `__0000`, `__003A`.
- AC-E136-2 — implemented — identity on `[A-Z0-9.-]*` by construction (first branch).
- AC-E136-3 — implemented — probe: the full length<=3 corpus over the eight spec characters (585 strings) has no collision after `.toLowerCase()` and every output is in `[A-Z0-9._-]*`. The decode itself is a qa test.
- AC-E136-4 — implemented — gates/qa-review.ts:19, gates/code-review.ts:17, gates/ac-execution.ts:56, gates/expected-red.ts:36, gates/visual.ts:32, tools/evidence-lookup.ts:17; no `taskId.replace(` remains in the six files (the remaining `.replace(` calls are the `activeFeature` sanitisers).
- AC-E136-5 — implemented — `t-x-01` encodes to `_T-_X-01`, a distinct stem from `T-X-01` on any case-insensitive filesystem.
- AC-E136-6 — implemented (source half) — probe: `../escape` encodes to `..__002F_E_S_C_A_P_E`; the test re-pin is T-E139-03.
- AC-E136-7 — implemented — `specFilePath`, `expectedRedManifestPath`, `designFilePath` not in the diff.
- AC-E154-1 — implemented — tools/evidence-file.ts:70-88; probe `["A","B","C"]`.
- AC-E154-2 — implemented — `ids.includes(t)` de-dup for later lines only; probe `["A","B","C"]`.
- AC-E154-3 — implemented — first line returned as-is; probe `covers: A, A` -> `["A","A"]`.
- AC-E154-4 — implemented — `buildCoverageIndex` calls `parseCoversIds`, so both gates inherit the union with no edit.
- AC-E154-5 — implemented — `COVERS_LINE_RE` source and `im` flags unchanged; probe: `discovers:` and mid-sentence `covers:` on later lines ignored, a later bulleted `**covers:**` line counted.
- AC-E154-6 — implemented — `tools/lane-status.ts` and `test/e177b-lane-status.test.mjs` not in the diff; suite result below.
- AC-L1 — implemented — `schema/**` untouched.
- AC-L2 — implemented — no line removed inside any existing `GateDefinition` object. Removed registry lines are only the catalog-count comment, the tool-boundary `code 34` comment and the `documentedInProse` interface comment (integrator-ruled; confirmed comment-only below).
- AC-L3 — implemented — every changed path is in the cut's touches cells, `.current/e139/` or the spec.
- AC-L4 — implemented — `npm run build` on HEAD leaves `dist/` clean (`git status --porcelain` shows only `.current/e139/` from this hop's state writes).
- AC-L5 — partial — `node scripts/test-lock.mjs -- npm test` on HEAD 447e5f1: 3691 tests, 3672 pass, 17 fail, 2 skipped. 16 of the 17 are the planned T-E139-03 re-pins. 1 is NOT on the planned list (see the cut-gap finding under Correctness). Neither kind is a defect in the sr diff.

## Correctness
No required findings against the sr diff.

- Full-suite failures, classified (17):
  - Planned re-pins, `test/e26-gate-stats.test.mjs` (6): R1, R2, U1, D1, D2 (line 343), T3b (line 656). All are `35 !== 34` count pins.
  - Planned re-pins, `test/e308-single-source-tier-enum.test.mjs` (2): E303-AC12, E303-AC11a (integrator-ruled, R1 widened).
  - Planned re-pin, `test/e35-pipeline-order.test.mjs` (1): t-order-exact (step `codes`).
  - Planned re-pins, `test/error-code-contract.test.mjs` (4): AC-1/AC-5 count, doc-file mapping (c12), AC3 (c12) allowlist row, E308/AC3 count.
  - Planned re-pins, `test/qa-flow.test.mjs` (3): path-traversal, T-C9-10/AC-2, T-C9-10/AC-5.
  - **Unplanned (1): `test/e295-hop-cap-and-sop-halves.test.mjs:112` "AC11: coord-02 names the four tiers…", `assert.equal(count(REGISTRY, "(none)"), 0)` → actual 1.** This is caused by the spec-mandated `//   NON_REVIEWER_VERDICT_REJECTED   (none)` mapping row (Copy/Strings `e139.mapping`). It is the same assertion class as E303-AC11a. It is missing from the spec's hit table, from T-E139-03's touches and from the integrator's R1 grant.
- **recommended (escalation, not an sr fix) — cut gap, blocks AC-L5 until ruled.** The sr diff is correct to spec, and sr may not touch `test/**`, so CHANGES_REQUESTED to sr would not help. The coordinator/integrator needs to widen the R1-style grant so qa may change `test/e295-hop-cap-and-sop-halves.test.mjs` AC11 line 112 only (`"(none)"` count 0 → 1, exact `===`), plus its title text if needed, nothing else. The alternative is a spec amendment that drops the `(none)` row, which would conflict with AC-E139-7 and with E303-AC11a's ruled re-pin. Without one of these, qa cannot reach AC-L5 green.

- E139 predicate matches the spec exactly: `FileHandoffStorage && review_verdict && agent_id && agent_id !== "code-reviewer" && !(prevTuple code-reviewer:In_Progress && nextTuple qa-engineer:In_Progress && APPROVED)` (tools/handoff-orchestrator.ts:635-647). `prevTuple`/`nextTuple` are the server-built tuples from `handleUpdateStateCore` (tools/handoff-orchestrator.ts:1264-1271). The code-reviewer branch, including `const { parsed } = ctx;`, is unchanged; only `codes` and the appended branch differ.
- E236 undo wiring: `runUpdateStatePipeline` passes `ctx` through by reference (gates/pipeline.ts:54-65), so the WeakMap key matches. The undo runs on rejection and on a pipeline throw (tools/handoff-orchestrator.ts:1294-1305) and on a `writeState` throw (`writeStateKeepingEvidence`), and is deleted on success. The code between the pipeline and `writeState` (`computeNewRound`, sentinel strings) is pure and cannot throw in practice, so no gap there. Arguments to `writeState` are built inside the closure, so a throw while building them is also covered.
- E236 undo safety: per-path snapshot before any append, de-duplicated by path, so a repeated id restores to the true pre-size. A file another writer created between the snapshot and the append is skipped by the size check, so it is never unlinked. A file this write did not append to (`appended.length === 0`) is skipped. Probe: a part-way failure (third target is a directory) unlinks the created file, truncates the existing one back, and rethrows.
- E136 encoder: single-unit `ch` comparisons are correct for UTF-16 units; `charCodeAt` is at most 0xFFFF, so `padStart(4, "0")` always yields exactly 4 hex digits.
- E154: the `gim` copy cannot loop on an empty match (every match contains the literal `covers`), and `^` with `m` re-anchors after each newline.
- Expected-red sampling (SOP 4a): the diff touches no test file, and the integrator ruled that the planned re-pin reds need no expected-red manifest. The one unplanned red is the cut-gap finding above, not an intentional red. Not armed.
- optional — gates/qa-review.ts:138: if a single `appendFileSync` writes part of its bytes and then throws (for example ENOSPC), that file's record is not updated, the size check fails, and the partial bytes stay in place; a created directory holding that file is then not removed either. The spec's "part-way" clause is met for the multi-file case. Closing the single-file case would mean `truncateSync(preSize)` (or unlink) on the throwing path without the size guard. This is low-probability and fail-safe in direction (it never destroys another writer's bytes), so it does not block.

## Quality
- Naming and layout follow the surrounding modules. `recordReviewInFileUndoable` is declared above `hasEvidenceInFile` as required (gates/qa-review.ts:101 vs :150), and the `fs.existsSync(evidencePath(workspacePath, id))` and `fs.existsSync(codeReviewPath(workspacePath, id))` source pins are intact.
- `documentedInProse` interface comment rewrite (gates/registry.ts:68-74): confirmed comment-only. Every removed/added line in that hunk is a `//` line; the `readonly documentedInProse: boolean;` declaration is unchanged. Accepted per the integrator ruling.
- Comment discipline (Constitution §6): the new comments state WHAT/WHY (authorship half vs consistency half, why a WeakMap, why the undo checks tail bytes). Ticket ids appear only next to an explanation (catalog comment) or inside spec-mandated copy (`hintStatic` "See docs/backlog.md E139."). No absolute paths, no bare-ticket explanations.
- optional — tools/evidence-lookup.ts:16: `sanitizeTaskId` is now a one-line passthrough whose name no longer describes what it does. Kept on purpose (the spec keeps function names for source pins), so no action is needed.
- optional — gates/qa-review.ts:22-24: the `qaEvidencePath` comment still says "the same sanitised path"; "encoded" would now be more exact. This line is not in the diff.
- optional — gates/qa-review.ts:115 and :133: `evidencePath` is computed twice per id (snapshot loop and append loop). Negligible cost; it could reuse the snapshot map.

## Architecture
No architecture spec exists for this feature (the cut has no architect hop). The implementation follows the spec's design decisions: one step with two codes (no new pipeline position, still 18 steps), a WeakMap because `gates/pipeline.ts` owns the readonly context type, `tools/evidence-file.ts` as the encoder's home (import-free of `gates/`), and SQLite paths unchanged (`storage.recordReview` still called in non-file mode; `tools/storage*.ts` untouched).

## Security
No findings. The encoder's output alphabet `[A-Z0-9._-]` has no separator, NUL or drive colon, so a hostile task id cannot leave `qa_reports/` or `review_reports/` (probe: `../escape` stays inside `qa_reports/`). The E139 exception keys only on server-derived `prevTuple`, never on a client field. The undo never deletes or truncates a file whose bytes it cannot prove it wrote.

## Performance
No regression. `parseCoversIds` is O(lines × ids) with `includes` de-dup, on small review files. The undo snapshot is one `stat` per distinct path, and the undo read is one `readFileSync` per touched pre-existing file, only on the rejection path. `encodeEvidenceId` is linear in the id length.

## Verdict
APPROVED — all five sr tasks implement their spec design decisions and source-side ACs exactly, with no required findings. 16 of the 17 suite reds are planned T-E139-03 re-pins. The 17th (`test/e295-hop-cap-and-sop-halves.test.mjs` AC11 `(none)` count) is a cut gap that needs an integrator ruling before qa can reach AC-L5, not an sr change.
