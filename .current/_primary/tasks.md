<!-- schema_version: 2 -->
# Tasks: qa-flow-enforcement
<!-- feature_id: qa-flow-enforcement | created_at: 2026-05-18 | created_by: @pm | supersedes: qa-gate-enforcement -->

## Active
_(No active tasks — ready for the next feature.)_
- [x] T-RELV4W6-01 [P0] qa-engineer: Evidence-only release-gate verification for release-v4-wave6 (no new code). Verify on main (HEAD a9521cf) the committed evidence for four features merged since v3.118.0: (1) e125a-lane-local-ledgers (merge 1ef767a) — qa_reports/review_T-E125A-06.md, qa_reports/review_T-E125A-07.md, review_reports/review_T-E125A-05.md; (2) e125b-lane-close-writeback (merge 9ca1f9b) — qa_reports/review_T-E125B-04.md, review_reports/review_T-E125B-01.md; (3) e125c-index-compaction (E125c+E195, merge ed7432f) — qa_reports/review_T-E125C-06.md, review_reports/review_T-E125C-04.md; (4) e126-merge-invariants (E126+E198(a), merge dae3566) — qa_reports/review_T-E126-05.md (Round 2 PASS), review_reports/review_T-E126-01.md (Round 1+2 APPROVED). Each lane's final PASS handoff is at .current/history/2026-09/<lane>/handoff.md (e125a, e125b, e125c, e126) — confirm status PASS. Then run full `npm test` on main (expect 2648/2648) and `npm run build` clean. If all evidence verified and both commands pass, tw_update_state(agent_id="qa-engineer", status="PASS", next_role="release-engineer"). | depends_on: none (note: Evidence-only release gate PASS — see qa_reports/review_T-RELV4W6-01.md)
- [x] T-REL4-01 [P0] qa-engineer: verify AC1-AC4 (10-lane evidence + PASS/APPROVED verdicts, full npm test green, npm run build zero dist diff, execution-plan §9 checklist state) on committed main tree per specs/release-v4.0.0.md — evidence-only, no code changes | depends_on: none (note: QA PASS round 2 — full detail qa_reports/review_T-REL4-01.md)
- [x] T-REL4-02 [P2] doc-writer: update docs/schema-versions.md — tasks Location row, add Tasks version history table, describe v2 index shape + _primary forward migration + git-ignored-lane exception (E125a gaps, see specs/release-v4.0.0.md Out of Scope) | depends_on: T-REL4-01 (note: PASS — all 5 gap-list items covered in docs/schema-versions.md, stamp-version discrepancy adjudicated in doc's favor (v2, not spec's stale "v1"); see qa_reports/archive/release-v4.0.0/review_T-REL4-02.md)
- [x] T-REL4-03 [P0] sr-engineer: fix CI red per AC5 — in `.github/workflows/ci.yml`, add `fetch-depth: 0` to the `actions/checkout@v4` step (the checkout step only; no other line, and no `test/` file, changes) so the CI runner has full history for the SHA-diffing tests | depends_on: none (note: AC5 verified PASS — see qa_reports/review_T-REL4-05.md)
- [x] T-REL4-04 [P0] code-reviewer: adversarial review of T-REL4-03's diff against AC5 — confirm the change is exactly the one-line `fetch-depth: 0` addition, nothing else in `ci.yml` moved, and no `test/` file was touched | depends_on: T-REL4-03 (note: code-reviewer APPROVED (review_reports/review_T-REL4-03.md) — completed alongside per SOP)
- [x] T-REL4-05 [P0] qa-engineer: re-verify AC5 — full local suite green (`npm test` exit 0) AND the GitHub Actions CI run for the T-REL4-03 fix commit concludes `success` on every matrix job (`gh run list --workflow ci.yml --branch main` / `gh run view`); PASS restores the (qa-engineer, PASS) precondition so release-engineer can re-enter at step 1 | depends_on: T-REL4-04 (note: AC5 re-verified PASS — see qa_reports/review_T-REL4-05.md)
- [x] T-REL41-01 [P0] qa-engineer: verify AC1 evidence table (E243 T-E243-03/04, E248 T-E248-01/02 — qa PASS + code-review APPROVED, closed lane handoffs) + AC4 follow-up-regression checks (schema-versions.md E125a narrative, ci.yml fetch-depth:0, v4.0.0-execution-plan.md §9 final item) on committed main tree — evidence-only, no code changes | depends_on: none (note: PASS — AC1 evidence table + AC4 follow-up regression checks verified independently. See qa_reports/review_T-REL41-01.md.)
- [x] T-REL41-02 [P0] qa-engineer: verify AC2 (npm test exit 0, zero failures) + AC3 (npm run build, git status --porcelain dist/ empty) | depends_on: none (note: PASS — AC2 npm test (2923/2926 pass, 0 fail, 3 skip, exit 0) + AC3 clean build (dist/ no diff). See qa_reports/review_T-REL41-01.md.)
- [x] T-REL42-01 [P0] qa-engineer: verify AC1 evidence table + AC4 follow-up-regression checks on the committed main tree (evidence-only gate, no code changes) | depends_on: none (note: AC1 + AC4 verified PASS — see qa_reports/review_T-REL42-01.md)
- [x] T-REL42-02 [P0] qa-engineer: verify AC2 (full suite green) + AC3 (clean build, no dist/ diff) | depends_on: none (note: AC2 (npm test 2955/2958 pass, 0 fail, 3 skip) + AC3 (clean build, zero dist/ diff) verified PASS)

## Compacted History
<!-- compacted: E125c 2026-09-26 — 67 sections, 891 [x] rows, 26 [-] rows summarized below; full rows: git log -i --grep <ticket-id>, or git log -p -- .current/_primary/tasks.md (pre-compaction commit 165b72d is auxiliary and invalidated by a history rewrite, E104) -->
- Active: 428 done, 10 voided
- Completed: 161 done, 0 voided
- visual-fidelity-gate-hardening: 6 done, 0 voided
- agc-cross-agent-adapter-scaffolding: 4 done, 0 voided
- server-scope-decision-gate: 5 done, 0 voided
- design-asset-source-rule: 3 done, 0 voided
- qa-visual-baseline-provenance: 5 done, 0 voided
- retro-sop-hardening: 4 done, 0 voided
- figma-baseline-manifest-gate: 4 done, 0 voided
- handoff-write-arg-guard: 3 done, 0 voided
- registry-pattern: 9 done, 0 voided
- Cut-Approval Coordinator Attestation (C2): 7 done, 0 voided
- drift-baseline-exemption (C4): 7 done, 0 voided
- gate-registry (A10 + A2 folded in): 11 done, 0 voided
- a11-escalation-grammar: 11 done, 0 voided
- c14-dispatch-pins: 12 done, 0 voided
- c16-c10-role-boundary: 10 done, 0 voided
- C12: 6 done, 0 voided
- a12-partials-limits-registry: 9 done, 0 voided
- D1 — prompt arg workspace fallback: 5 done, 0 voided
- D9: 7 done, 0 voided
- d5-server-side-stale-dispatch-detection: 8 done, 0 voided
- E8 — success-side telemetry: 10 done, 0 voided
- E4 — design-source-credibility-gate: 8 done, 0 voided
- E11-E12 — release-integrity batch: 6 done, 0 voided
- E9 — release self-check: 6 done, 0 voided
- E13: 9 done, 0 voided
- E10: 11 done, 0 voided
- E7: 7 done, 0 voided
- E9A: 7 done, 0 voided
- E15: 1 done, 0 voided
- E14+E16 batch: 5 done, 0 voided
- E17: 4 done, 0 voided
- e-p3-tail-batch: 6 done, 0 voided
- e44-e49-release-sop-conditional-checks: 4 done, 0 voided
- e50-release-sop-step7a-hardening: 3 done, 0 voided
- e59-const6-waiver-clause: 3 done, 0 voided
- e39-e58-transition-matrix-sync: 3 done, 0 voided
- e40-nonqa-completed-tasks-write-gate: 3 done, 0 voided
- e64-e65-e55-release-sop-staging: 3 done, 0 voided
- e69-e71-sop-render-fences (E69 + E71, backlog order 8d): 3 done, 0 voided
- e77-hermetic-test-fixture (E77, P1 — CI red): 2 done, 0 voided
- e76-e78-release-integrity (E76 + E78): 4 done, 0 voided
- e75-rationale-fence-relocation (E75, backlog order 8i): 2 done, 0 voided
- e43-test-file-ask-at-dispatch (E43, backlog order 7): 2 done, 0 voided
- e90-golden-capture-completeness (E90, backlog order 13e): 2 done, 0 voided
- e96-dispatch-preference-explicit (E96, backlog order 0b): 2 done, 0 voided
- e74-md-table-integrity (E74, backlog order 8h): 2 done, 0 voided
- E104: 1 done, 0 voided
- e111-lane-worktree-evidence (E111, backlog order 00): 2 done, 0 voided
- e82-e84-release-verify-tooling (E82 + E84, Wave 1 L-RELTOOL; E83 out of scope — see spec Out of Scope): 3 done, 0 voided
- e88-e105-md-table-checker: 3 done, 0 voided
- e141-tag-at-head-bookkeeping-tolerance: 2 done, 0 voided
- e109-workspace-feature-anchoring (E109 + E146 rider, Wave 2 of v4.0.0-execution-plan.md, L-CONTENT lane): 2 done, 0 voided
- e142-release-tooling-wave25 (E142 + E143 + E144 + E147 + E149, Wave 2.5 of v4.0.0-execution-plan.md): 5 done, 0 voided
- e114-cut-approval-inheritance (E114, Wave 3 of v4.0.0-execution-plan.md, lane L-SCHEMA; depends_on E109): 3 done, 0 voided
- e123a-lane-layout-migration (E123 F0 + E99, v4.0.0 Wave 4): 0 done, 7 voided
- e123a-lane-layout-migration (E123 F0 + E99, v4.0.0 Wave 4) — re-cut 2026-09-23: 0 done, 1 voided
- e123a-lane-layout-migration (E123 F0 + E99, v4.0.0 Wave 4) — re-cut 2026-09-23 (T-E123A-01..07 voided, see void reasons): 0 done, 8 voided
- e123a-lane-layout-migration (E123 F0 + E99, v4.0.0 Wave 4) — re-cut #2 2026-09-23 (T-E123A-*/T-E123A2-* voided, see void reasons): 8 done, 0 voided
- e123b0-lane-runtime-resolver (E123 F1 S0, v4.0.0 Wave 4): 3 done, 0 voided
- e123b-callers-retarget (E123 F1 L1–L3 integration): 1 done, 0 voided
- e123b8-flip-prep (E123 F1 J1): 4 done, 0 voided
- e164-e167-content-wave45: 2 done, 0 voided
- e118-reviewer-ac-completeness: 2 done, 0 voided
- e123c-cross-lane-aggregation: 4 done, 0 voided
- e174a-release-lane-paths: 3 done, 0 voided

## e145-md-tables-cited-donemark
- [x] T-E145-01 [P3] sr-engineer (pin: fable) — E145. Sole file: `scripts/check-md-tables.mjs`. Teach `findGenuineDoneMark()`'s exclusion to recognise a CITED done-mark (a quoted excerpt of ANOTHER row's mark), so a row that merely QUOTES a done-mark is not mis-flagged as carrying its own buried one. DO NOT weaken, silence, or condition the detection — the advisory is correct; only its remedy is unsafe for the citation case, and applying that remedy would fabricate a done-mark for a row that is not done. Follow the `findCodeSpanRanges()` exclusion precedent (pure range helper + `insideX` predicate, `matchAll` iteration preserved). Do not touch `DONE_MARK_OPEN_RE`, `MARK_STAMP_RE`, `splitRow()`, `headerCellCount`, `backlogDoneMarkColumn()`, the violation path or the exit code. Record the E88-style measurement in the code comment. HARD BOUNDARIES: do NOT touch `test/` (Constitution §2, qa-owned), `content/` (Wave 2 lane), `scripts/verify-release.mjs` (Wave 2.5), or `docs/backlog.md` (E145's own row staying silent post-fix IS the acceptance evidence). | depends_on: none (note: shipped v3.113.0 (43227b3); ledger lost at merge (E150 shape); re-verified 2026-09-25)
- [x] T-E145-02 [P3] qa-engineer (owns every `test/` edit, Constitution §2) — verify T-E145-01 by EXECUTING against synthetic fixtures, not by reading the diff. Extend the existing `test/check-md-tables.test.mjs` (the `mkFixtureRepo` harness; do NOT create a new file, do NOT touch `scripts/check-md-tables.mjs`). The new `findCitationQuoteRanges()` ships with ZERO direct coverage — author the 9 `CQ-*` cases listed in `review_reports/review_T-E145-01.md` §Required follow-through, the load-bearing four being CQ-CITED-MARK-SUPPRESSED, CQ-MULTI-CANDIDATE (a citation-excluded candidate must NOT stop the scan), CQ-GENUINE-OUTSIDE-QUOTE, and CQ-UNPAIRED-OPENER (pins that an unpaired opener still ADVISES — this is what guards the corrected Q1 comment). Also pin CQ-RESIDUAL-SPAN-SWALLOW (C3) and CQ-BOLD-RUN-NOT-AN-OPENER (C4) as RECORDED RESIDUALS so a future hardening flips them deliberately. NO live `docs/backlog.md` line numbers in any assertion — that file changes daily; assert by row/ticket id. Full suite green (baseline 2100/2100), `npm run build` clean, `npm audit --audit-level=high` exit 0 before PASS. Evidence `qa_reports/review_T-E145-02.md` with `covers: T-E145-01, T-E145-02`. Do NOT touch `content/`, `scripts/verify-release.mjs`, or the `test/` seed helper owned by the E148 lane; do NOT done-mark any `docs/backlog.md` row. | depends_on: T-E145-01 (note: shipped v3.113.0 (43227b3); ledger lost at merge (E150 shape); re-verified 2026-09-25)

## e137-render-sanitise
- [x] T-E137-01 [P0] sr-engineer: new lib/render-boundary.ts exporting renderDataBlock({heading, notice?, label, body, lang}) with an adaptive fence of max(3, longest backtick run + 1) backticks and the lang info string kept. In prompts/build.ts, render the state block through it and export renderHandoffStateBlock(state) (sanitizeForRender + STRUCTURAL_MARKER_RE STAY declared in build.ts; STATE_BLOCK_DATA_NOTICE byte-unchanged; the state.envelope label comes after it). S01a/S01b footers name BOTH the lane path and the flat path (footer.bothpaths). Spec AC1-AC3, AC7 (build half), AC11. 2 files, ~120 lines. | depends_on: none
- [x] T-E137-02 [P0] sr-engineer: bin/agent-governance-context.mjs stops the raw readSafe(handoffPath) yaml fence. It imports dist/tools/handoff-parse.js parseHandoff (read-only: lane then flat fallback, never migrates or locks) and dist/prompts/build.js renderHandoffStateBlock. A throw (incl. HANDOFF_LAYOUT_CONFLICT) renders a lookup-failed block with the error and no note text. No state: message names both lane and flat paths. Keep the existing fail-loud misconfigured-hint branch for a missing dist/. Spec AC4-AC7 (hook half). 1 file, ~70 lines. | depends_on: T-E137-01
- [x] T-E137-03 [P1] sr-engineer (SEPARABLE, can be dropped alone per the human ruling): prompts/build.ts appendSpecContext renders the RAG chunks through lib renderDataBlock (lang markdown, heading '## 📄 Spec Context (RAG — top-5 chunks)' kept, spec.envelope label), chunk text byte-for-byte. Spec AC10. 1 file, ~30 lines. | depends_on: T-E137-01
- [-] T-E137-04 [P0] code-reviewer: adversarial review of T-E137-01..03 against specs/e137-render-sanitise.md AC1-AC11. Focus: can the fence be closed from inside (adaptive length, CRLF, a backtick run exactly at the boundary); the E122 regex literal is still in build.ts; the hook never migrates or locks; lane-scope file set respected. | depends_on: T-E137-02, T-E137-03 (drop T-E137-03 from depends_on if it is voided) (voided: Human ruling 2026-09-24: review is a chain hop, not a task row. Its three focus points (fence closable from inside; E122 regex still in build.ts; hook never migrates/locks) go into the code-reviewer dispatch brief.)
- [x] T-E137-05 [P0] qa-engineer: add test/e137-render-sanitise.test.mjs (AC1, AC2, AC4, AC5, AC6, AC7 hook, AC11). Edit test/prompt-state-footer.test.mjs, human-authorized, to assert both paths in S01a/S01b (AC7). RUN and paste output for AC3 (e122 test unmodified), AC8 (context-budget unmodified, plus post-change AC-9 numbers vs 4525/1255/3270), AC9 (compose-golden fixtures unmodified, and compose-equivalence, e90-golden-capture-completeness, skill-manifest, render-structure run green), AC12 (npm test). Final PASS. 2 files, ~250 lines. | depends_on: T-E137-04, T-E137-06 (drop T-E137-06 if T-E137-03 is voided)
- [x] T-E137-06 [P1] qa-engineer (SEPARABLE, dropped together with T-E137-03): add test/e137-rag-render.test.mjs for AC10 (chunks with a triple-backtick line and an imperative sentence are fenced and labelled, adaptive fence, heading kept). test/rag.test.mjs and test/rag-lifecycle.test.mjs pass unmodified. 1 file, ~80 lines. | depends_on: T-E137-04
- [-] T-E137-R1 [P2] release-engineer (post-PASS): E137 done-mark per the spec's 'Done-mark wording' (MUST state the known residue 'a reader persuaded by a note's wording' is deliberately not addressed), plus a pointer on the E122 row and J2-NEW-1 closure. Promote NEW-TICKETS L-RENDER-NEW-1 (owner L-STATE). File the spec's owed prose P1 to L-CONTENT and P2 to doc-writer. | depends_on: T-E137-05 (voided: Human ruling 2026-09-24: out of lane scope (docs/backlog.md + release forbidden to L-RENDER). Done-mark wording, E122 pointer, J2-NEW-1 closure, L-RENDER-NEW-1 promotion and owed prose P1/P2 are carried in the lane report for the integrator.)

## e125a-lane-local-ledgers
- [x] T-E125A-01 [P0] sr-engineer: registry + schema per specs/e125a-lane-local-ledgers.md AC1-AC3 — LANE_FILES gains tasks entry (required:false + no-flat-counterpart marker) and LanePaths.tasksPath in tools/lane-paths.ts; tools/lane-migrate.ts E123 runners skip the tasks entry, lane->flat refuses on a lane-held tasks.md (Copy tasks.refuse-lane-to-flat), tasks.md.lock alone is tolerable debris; CURRENT_VERSIONS.tasks 1->2 + stamp-only v1->v2 step in schema/versions.ts + schema/migrations-tasks.ts; npm run build. | depends_on: none
- [x] T-E125A-02 [P0] sr-engineer: new tools/tasks-lane-migrate.ts FORWARD runner per spec D-C/D-D + AC4-AC6 — legacy-file finder (taskPaths/DEFAULT_TASK_PATHS, never a .current/<lane>/ path), _primary copy + root v2 index stamp + notice, feat-lane extract-by-heading-ticket-id with one marker per contiguous run, no-op on v2 root / existing lane file, fixed-order lane-tasks-lock + legacy-lock; npm run build. | depends_on: T-E125A-01
- [x] T-E125A-03 [P1] sr-engineer: REVERSE runners in tools/tasks-lane-migrate.ts per spec D-E + AC7-AC8 — _primary reverse (restore v1 root from lane body, refuse unless root is the untouched v2 index), feat reverse (markers -> runs, extra lane-local sections after last marker, refuse on missing/duplicate/out-of-order marker), byte-identical round trip with no edits; npm run build. | depends_on: T-E125A-02
- [x] T-E125A-04 [P0] sr-engineer: wire tw_* to the lane-local ledger per spec D-F + AC9-AC11 — tools/config.ts findTasksFile -> lane path (legacy finder only for migration/index readers), tools/tasks-file.ts all five entry points + parse trigger the forward migration under lock and never write a legacy path (snapshot refresh so AC11 holds), tools/drift.ts tasks skew lane-then-legacy, tools/metrics.ts ticket count across root + live + history lane ledgers deduped by id; tools/sync.ts/registry.ts strings only if needed; npm run build. | depends_on: T-E125A-02
- [x] T-E125A-05 [P0] code-reviewer: adversarial review of T-E125A-01..04 combined diff against specs/e125a-lane-local-ledgers.md AC1-AC13 — focus: any remaining tw_* write path to a legacy/root task file, migration lock ordering + concurrent first access, reverse refusal completeness (nothing touched on refuse), feat-marker round trip on non-contiguous runs, freshness after lazy migration, E123 runner interaction. | depends_on: T-E125A-03, T-E125A-04
- [x] T-E125A-06 [P0] qa-engineer: new test/e125a-lane-local-ledgers.test.mjs covering AC4-AC11 (fixtures in $TMPDIR only, feat-lane fixtures with a fake .git HEAD on feat/e999-x) + AC1-AC3 additions in test/lane-paths.test.mjs, test/lane-migrate.test.mjs, test/schema-versions.test.mjs. | depends_on: T-E125A-05
- [x] T-E125A-07 [P0] qa-engineer: triage all 35 test files mentioning tasks.md; update the ones asserting root-tasks.md ledger behaviour (spec Dependencies 'Test impact' list) to the lane-local path / v2 sentinel, list each in the QA report; then commit and run the full npm test with zero untracked files (AC12, AC13). goldens/context-budget must stay untouched — red there = stop and report. | depends_on: T-E125A-06
