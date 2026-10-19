covers: T-RELW7-01, T-RELW7-02, T-RELW7-03, T-RELW7-04, T-RELW7-05

# QA review: release-post-v4-w7 (v4.10.0 gate), verified against 4.9.0 on main @ 906b161

Phase 0.5: skipped (no expected-red manifest declared). Phase 1.5: skipped (no Visual Baselines declared). Phase 3: skipped (evidence-only gate, no test files written; probes ran under the scratch TMPDIR only). Copy and visual audits: N/A (spec declares none).
Environment: Node v22.22.3; Node 20 verdict rests on CI (AC7).

## AC Execution Log

- **AC1** (T-RELW7-01): 39 commits in v4.9.0..HEAD. Forbidden-path diff: empty. `content/` + `dist/` diff: exactly the four content files and dist/tools/{config,fanout-handoff,fanout-manifest}.* (d.ts/js/maps). Classification filter over all 69 changed paths: 0 unclassified. `owners` attributes every non-bookkeeping path to e285/e289 (AC8e). PASS.
- **AC2** (T-RELW7-01): e285 review: R1 CHANGES_REQUESTED then R2 APPROVED (governs); e289 review APPROVED. QA: review_T-E285-02 covers line names all six ids, one PASS block; e289/e337/e338/e339 files round 1 FAIL then PASS (04:02 PASS governs); review_T-E289-01 covers the five e289 ids. Both lane handoffs `status: "PASS"`, `last_agent: "qa-engineer"`. Ledgers: e285 6x `[x]` 0 open; e289 5x `[x]` 0 open. Backlog E285/E294/E336 DONE with a7af0f3, E289/E337/E338/E339 DONE with 259c7ad; both shas ancestors of HEAD (exit=0). E340-E344 rows present, not DONE; E342/E343 titles match the two entries in e289 pending-tickets.md. PASS.
- **AC3** (T-RELW7-02): `node scripts/test-lock.mjs -- npm test` exit 0. tests 3454, pass 3452, fail 0, skipped 2, duration ~377s. No reds, no reruns needed (e234 hygiene scan green). PASS.
- **AC4** (T-RELW7-02): `npm run build` exit 0, `git status --porcelain dist/` empty; check-version OK (4.9.0, exit 0, past-tag note only); check:bookkeeping exit 0 (388 ticket rows); check:md-tables exit 0 (598 files, 0 malformed). PASS.
- **AC5** (T-RELW7-02): `npm audit --audit-level=high` exit 0 (8 vulnerabilities: 2 low, 6 moderate, 0 high/critical); package.json and package-lock.json diff vs v4.9.0 empty. PASS.
- **AC6** (T-RELW7-02): `agc check` exit 0 at 4.9.0 stamps; check-transitions-sync exit 0 (21 keys exact match). PASS.
- **AC7** (T-RELW7-02): HEAD = 906b1617774909348d901c8ca3e6a3c3761a96c9. Run 39199082520: headSha 906b161, success, test (20) success, test (22) success. Run 39198090267: headSha 259c7ad, success, test (22) success, test (20) success. PASS.
- **AC8** (T-RELW7-03):
  - (a) Validate loop: only wave5.1 and wave6 exit 2, each with exactly DECISIONS_SECTION_ABSENT + PINS_SECTION_ABSENT, no HANDOFF_* code. w7 manifest: `fanout: ok — 2 dispatchable lane(s), 0 provisional, 9 decision(s)` exit 0. Truncated copy: HANDOFF_SECTION_ABSENT, exit=2.
  - (b) usage line count = 5.
  - (c) Key unset render exit 0; line 3 `先完整讀 docs/lane-protocol.md`, line 4 starts `feature start 建好 worktree 之後，呼叫 EnterWorktree` (consecutive). Throwaway primary: `../outside.md` exit 2 ADDENDUM_INVALID, stdout 0 bytes, value not echoed (0 matches in stdout and stderr); `docs/addendum.md` exit 0, reading line names the generic rules path and `docs/addendum.md`. E177a golden diff: 0 removed, 1 added. Throwaway dir removed.
  - (d) `handoff --closing` exit 0 with `## 接手步驟` and the four `###` sub-items. `--check`: exit 1, summary `5 fact(s) checked, 2 differ, 2 moved`; MOVED = target branch and worktree; the two DIFF lines name only `git status` (this feature's uncommitted bookkeeping, the spec, and the untracked allowlist note) and `lane-status` (new active_feature release-post-v4-w7, qa-engineer, hop 2). No stack trace. `git status --porcelain` unchanged across both runs.
  - (e) owners exit 1; HITs: tools/fanout-manifest.ts and tools/config.ts to e289, content/skill-integrator.md and docs/lane-protocol.md to e285; summary `69 path(s), 54 hit(s), 2 dispatchable lane(s)`; 15 non-HIT paths (derived by set difference) are all bookkeeping (.current/**, docs/backlog.md, docs/v4.0.0-new-tickets.md, specs/fanout-post-v4-w7.md, tasks.md). Wrote nothing.
  - (f) AC8 test list all green (combined run below); e283, e332, e177a-manifest, e178a unedited since v4.9.0 (empty diff). PASS.
- **AC9** (T-RELW7-04): CURRENT_VERSIONS = {"handoff":15,"tasks":2,"sqlite":2,"config":2}; schema, dist/schema, docs/schema-versions.md, test/config-versioning.test.mjs diff empty; docs/config.md has exactly 1 `### laneProtocolAddendum` section and its own "schema_version stays 2" statement; loadConfig on this repo returns key undefined (true); AC9 test list green. PASS.
- **AC10** (T-RELW7-05): (a) new form 1/1/6/4 across const-15/coord-03/release-engineer/integrator = 12, old form 0 in all four; built bundles `5 7 false false true true true true`. (b) E336-only diff empty (7 removed lines, each equal to its added line after substitution). (c) four E285 sentences present in built integrator bundle. (d) lane-protocol head (through `## 1.`) and tail (from `## 2.`) byte-identical to v4.9.0. (e) 12 golden files, 24 changed lines, 0 not containing the pull command; budget caps 5717->5723, 10518->10523, 21623->21633, 8420->8426 with comments only; e297 2 removed, 2 added literals. (f) AC10 test list green; e246, e296, e178a unedited. PASS.
- **AC11** (T-RELW7-05): v4.9.0^{commit} = 968a095433af24d4451b22955ed983869595047a, ancestor of HEAD (exit 0); CHANGELOG `[4.9.0]` at line 19; `const HOP_CAP = 14` at tools/transitions.ts:326; GATE_REGISTRY = 34; AC11 test list green. PASS.

Combined targeted test run (union of the AC8/9/10/11 `node --test` lists, 63 files): tests 1026, pass 1024, fail 0, skipped 2.

## Observations (not blocking)
- Untracked docs/existing-test-allowlist-drift-2026-10-19.md was not touched or staged.
- E336 AC golden proof and other items noted in the manifest are carried context, not re-litigated.
- Same-model note: none (qa on sonnet).

## Verdict
PASS for T-RELW7-01..05. All of AC1-AC11 hold. Route to release-engineer for 4.10.0.
## 2026-10-19T05:51:18.763Z — PASS — by qa-engineer

PASS: AC1-AC11 all hold on main @ 906b161 vs 4.9.0 (Node 22). Suite 3454 tests / 3452 pass / 0 fail / 2 skipped under test lock; build dist clean; check-version, bookkeeping, md-tables, audit(high) 0, agc check, transitions-sync green; CI runs 39199082520 and 39198090267 success with test(20)+test(22) success. Fanout probes, config, E336/E285 checks verified. Evidence: qa_reports/review_T-RELW7-01.md (covers T-RELW7-01..05).

