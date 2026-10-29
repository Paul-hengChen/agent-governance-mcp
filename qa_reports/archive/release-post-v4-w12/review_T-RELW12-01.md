# QA review — release-post-v4-w12 (v4.15.0 evidence-only release gate)

covers: T-RELW12-01, T-RELW12-02, T-RELW12-03, T-RELW12-04, T-RELW12-05

Verified on committed `main` @ `2b409c5` (equal to origin/main), local Node v22.22.3, against CURRENT version 4.14.0. Working tree carried only the expected uncommitted bookkeeping (`.current/_primary/{dispatch.jsonl,handoff.md,tasks.md}`, `specs/release-post-v4-w12.md`, this report). No code, test, package, CHANGELOG, CLAUDE.md or stamp edits. Phase 0.5 skipped (no expected-red manifest declared for this feature). Phase 1.5 skipped (no Visual Baselines declared). Phase 3 skipped (evidence-only gate; dispatch brief: no test file may be created or edited).

## AC Execution Log

### AC1 (T-RELW12-01)
- commits since v4.14.0 -> 78; changed paths -> 118; dist paths -> 28 (all as expected). PASS
- first-parent merges: exactly `2b409c5` #50, `f5485a7` #49, `b8aaf7d` #48, `5bc512b` #47. PASS
- non-.current paths per lane merge: 3b09c59=32, eb7e146=21, 2223697=26, 7b06d46=15. PASS
- bookkeeping merges: #47 = the three `.current/_primary/*` files; #48 = `specs/fanout-post-v4-w11.md`; #49 = `specs/fanout-post-v4-w12.md`. `.current/history` = 16. PASS
- untouched-set diff -> empty. PASS
- module-class diff -> exactly 21 lines (2 content, 8 dist module globs, 8 .ts, 3 scripts). PASS

### AC2 (T-RELW12-01)
- Review reports: e152 round 1 CHANGES_REQUESTED, round 2 APPROVED (covers four ids); e158 Round 1 APPROVED (covers T-E158-01, T-E158-02, T-E369-01); e366 Round 1 APPROVED (covers T-E366-01, T-E161-02, T-E184-01); e367 Round 1 APPROVED, no covers. PASS
- QA files: 17, each `pass=1 fail=0`, covers lines as specified. PASS
- Lane handoffs: all four `status: "PASS"`, `last_agent: "qa-engineer"`. PASS
- Ledgers x/void: e152 7/0, e158 6/0, e161 8/0, e367 3/3. PASS
- Backlog: 11 DONE rows name the correct merge; E368 VOID superseded by E379; E373-E382 present, none DONE/VOID. PASS
- Ancestry: no NOT line; second parents c1e9950, 5e1f0b0, d40c77a, 13a75be, d794fce, 6f040e1, 4017a3e, 8662494. PASS

### AC3 (T-RELW12-02)
- `node scripts/test-lock.mjs -- npm test` on Node v22.22.3 -> exit 0; tests 3798, pass 3796, fail 0, cancelled 0, skipped 2, duration 310.6 s. No red, so no rerun needed (no E224/E370/E378 recurrence data). PASS

### AC4 (T-RELW12-02)
- `npm run build && git status --porcelain dist/` -> empty. PASS
- check-version -> `OK (4.14.0)` exit 0. PASS
- check:bookkeeping -> `OK (426 ticket row(s), 214 queue row(s), 324 decision row(s) checked)` exit 0. PASS
- check:md-tables -> `OK (666 file(s) scanned, 0 malformed tables)`. PASS

### AC5 (T-RELW12-02)
- package.json / package-lock.json / dependency-advisories diff since v4.14.0 -> empty. PASS
- `npm audit --audit-level=high` exit 0; 7 vulnerabilities (1 low, 6 moderate), no HIGH/CRITICAL. PASS
- zod@4.6.7, body-parser@2.4.0, no invalid/UNMET/extraneous. PASS

### AC6 (T-RELW12-02)
- `agc check — OK (4.14.0) — all adapters current` exit 0; check-transitions-sync OK (21 keys) exit 0. PASS

### AC7 (T-RELW12-02) — Node 20 verdict rests on CI
- HEAD = 2b409c5c3609782abe88638282458f89ad2b199f. First eleven runs: conclusion success, `test (20)=success`, `test (22)=success`, head shas 2b409c5, 8662494, 8662494, 7b06d46, 13a75be, d794fce, 6f040e1, 4017a3e, 5bc512b, b8aaf7d, f5485a7 as listed. Twelfth (40844508566): `1faf645 feat/e161... failure test (22)=success test (20)=failure` (exception 3, superseded). PASS

### AC8 (T-RELW12-03)
- fanout tool diff -> exactly `tools/fanout-manifest.ts` + four `dist/tools/fanout-manifest.*`. 29 manifests; only `fanout-wave5.1.md` and `fanout-wave6.md` exit 2 with `DECISIONS_SECTION_ABSENT PINS_SECTION_ABSENT`; w12 `fanout: ok — 4 dispatchable lane(s), 0 provisional, 21 decision(s)`. PASS
- owners --range v4.14.0...HEAD exit 1; `118 path(s), 94 hit(s), 4 dispatchable lane(s)`; e152 42, e158 16, e161 22, e367 14; multi-lane lines 23, non-test among them 0; the 16 source/prose attributions as specified; 24 non-HIT paths = the Bookkeeping set. PASS
- handoff --closing exit 0 with `## 接手步驟` and four `###` sub-items. PASS
- handoff --check: `5 fact(s) checked, 2 differ, 2 moved`, exit 1. DIFF lines name only `git status` and `lane-status` (explained by this feature's uncommitted bookkeeping and new active_feature); MOVED: target branch, worktree. PASS
- usage: 5 lines, exit 2; `git status --porcelain` unchanged across the read-only runs. PASS
- (f) 20 fanout regression files: 225/225 pass. PASS

### AC9 (T-RELW12-04)
- State-read probe output matched the expected sequence line for line (old tier PRESENT / new absent, mechanism task; old schema ABSENT; new schema `object required=["passed","total"] additionalProperties=false`; four malformed rejected unchanged no-evidence; accepted PASS `suite-result: 7/9 passed (server-recorded from qa_suite_result; command: npm test)`, body-follows yes, handoff clean). PASS
- `35 18 {"handoff":15,"tasks":2,"sqlite":2,"config":2}`; `recordReviewUndoable` hits in storage.d.ts and storage-sqlite.js. PASS
- Tests (12 files): 271/271 pass. PASS

### AC10 (T-RELW12-04)
- Scripts probe matched all 12 expected lines (old cb exit 0 x3; new cb exit 2 with the three quoted stderr lines; control with `main` exit 0 both; owners HEAD...HEAD old 0 / new 2 RANGE_EMPTY ...`— an empty range proves nothing about ownership (E158)`; check e152 old 0 / new 2 RANGE_EMPTY with `— nothing was checked; commit the lane`). PASS
- `rangeEmpty: "RANGE_EMPTY"` at dist/tools/fanout-manifest.js:177; verify-release.mjs three hits (lines 261, 273, 282). PASS
- Tests (8 files): 172/172 pass. PASS

### AC11 (T-RELW12-05)
- test-lock CLI no args -> exit 64; `linkPublish(guardPath…)` line 124, `linkPublish(lockPath…)` line 189, one `fs.linkSync` line 212; `## E370 decision` at review_T-E158-01.md:75. PASS
- decodeEvidenceId round-trip `true`, nulls `[null,null,null,null,null]`; lane-status.ts and dist/lane-status.js import and credit `decodeEvidenceId(m[1]) ?? m[1]`; sanitiser diff empty. PASS
- Tests (9 files): 107/107 pass. PASS

### AC12 (T-RELW12-05)
- `NON_REVIEWER_VERDICT_REJECTED` only in const-08 (count 1); `35 orchestrator true 0`; `(none)` map line count 0; `range-derived` 1; four branch markers 4; 已知缺口 names only E196; `specs/abandoned/<lane>/` 1; numstat `2 2`; Shipped names 0/0, Ignored names 2/2. PASS
- Tests (12 files): 276/276 pass. PASS

### AC13 (T-RELW12-03)
- v4.14.0 -> 4d302df5f3d34046fd61a870c5a26d76ddcab6fa, ancestor of HEAD; CHANGELOG `[4.14.0]` at line 19; `const HOP_CAP = 14`; `{"handoff":15,"tasks":2,"sqlite":2,"config":2} 35 13 12`; schema/ and dist/schema/ diff empty. PASS
- Test files: 216 at HEAD, 210 at v4.14.0. CLAUDE.md baseline recorded for release-engineer: `210 test files` at lines 122 and 154 (should be 216) and `1633/1633 at v3.94.0` at line 159 (stale). Other counts correct: 35 entries/definitions, thirteen tools, 18-step, 12 prompts, 15 fragments, 7 coord fragments, other 11 role SOPs (12 skill files), 12 templates, index.ts 311 lines. Baseline, not a finding.
- Tests: v4.14.0 lane batch 246/246, v4.13.0 batch 336/336, governance-core batch 229/229 (includes e234-hygiene-scan). PASS

## Findings
None. Every measured value equals the spec's expected value; no spec-measurement slips, no red tests.

## Verdict
PASS — AC1-AC13 hold at HEAD 2b409c5 (v4.14.0 current). Full suite 3796/3798 passed, 2 skipped, 0 failed, Node v22.22.3.
## 2026-10-29T10:03:26.660Z — PASS — by qa-engineer

suite-result: 3796/3798 passed (server-recorded from qa_suite_result; command: node scripts/test-lock.mjs -- npm test)

PASS: AC1-AC13 of specs/release-post-v4-w12.md hold at HEAD 2b409c5 (current version 4.14.0), Node v22.22.3. Full suite 3796/3798 passed, 2 skipped, 0 failed (no rerun needed). All proofs matched spec values; AC9/AC10 old(v4.14.0) vs new probes executed against built dist and scripts and matched line for line; CI runs (AC7) all success; no findings. Detail in qa_reports/review_T-RELW12-01.md (covers all five ids). CLAUDE.md baseline for release-engineer: 216 test files (CLAUDE.md says 210 twice), stale 1633/1633 at v3.94.0 line.

