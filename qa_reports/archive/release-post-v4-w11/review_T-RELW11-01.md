# QA review — release-post-v4-w11 (v4.14.0 evidence-only release gate)

covers: T-RELW11-01, T-RELW11-02, T-RELW11-03, T-RELW11-04, T-RELW11-05

Verified on committed `main` @ `3cd4eaf` (equal to origin/main), local Node v22.22.3, against CURRENT version 4.13.0. Working tree carried only expected uncommitted bookkeeping (`.current/_primary/{dispatch.jsonl,handoff.md,tasks.md}`, `specs/release-post-v4-w11.md`, this report). No code, test, package, CHANGELOG or CLAUDE.md edits. Phase 0.5 skipped (no expected-red manifest declared). Phase 1.5 skipped (no Visual Baselines declared). Copy/Visual audit: spec declares N/A for both. Phase 3 skipped (evidence-only gate; dispatch brief: no test files).

## AC Execution Log

### AC1 (T-RELW11-01)
- `git log --oneline v4.13.0..HEAD | wc -l` -> 66 (expect 66). PASS
- `git diff --name-only v4.13.0..HEAD | wc -l` -> 102 (expect 102). PASS
- `git diff --name-only v4.13.0..HEAD -- dist | wc -l` -> 28 (expect 28). PASS
- Untouched-set diff command -> empty output. PASS
- dist/tools/gates/scripts/bin module-class command -> exactly the nine `dist/{gates,tools}/<module>.*` (ac-execution, code-review, expected-red, qa-review, registry, visual; evidence-file, evidence-lookup, handoff-orchestrator), the nine matching `.ts`, `scripts/test-lock.mjs`, `bin/agc-init.mjs`. PASS
- Full path list minus dist and `.current/history/2026-10/{e139,e217,e362,e364}`: every remaining path falls in the e364 / e139 / e362 / e217 / Bookkeeping classes; no path outside the classes. PASS

### AC2 (T-RELW11-01)
- Review reports: e364 APPROVED (`covers: T-E364-01`); e139 Round 1 APPROVED (`covers: T-E154-01, T-E136-01, T-E136-02, T-E139-01, T-E236-01`); e362 Verdict APPROVED; e217 Round 1 APPROVED (`covers: T-E217-01, T-E217-02, T-E215-01`). PASS
- QA files: 11 files, each `pass=1 fail=0`; covers lines match the spec (e364: 2 ids; e139: ten ids; e362: 3 ids; e217: 5 ids). PASS
- Lane closed handoffs: all four read `status: "PASS"`, `last_agent: "qa-engineer"` with the expected active_feature. PASS
- Lane ledgers `x/void`: e364 2/0, e139 10/0, e362 3/0, e217 5/0. PASS
- Backlog rows: E136/E139/E154/E236 DONE naming `aa31d3c`; E224/E362 `6eeae73`; E215/E217 `c13237e`; E364 DONE naming `163c397`; E365-E372 rows present, none DONE. PASS
- Ancestry: no `NOT` line for ac7e25b, 1adb50b, ab8dfbb, 163c397, e5f325d, aa31d3c, 6eeae73, c13237e, b4623b2. Second parents: 8adb9ba, 6de1157, 7cb2bdb, bad8a49, f563a91, b4623b2 (all as expected). PASS

### AC3 (T-RELW11-02)
- `node scripts/test-lock.mjs -- npm test` on Node v22.22.3 -> exit 0. Tally: tests 3751, pass 3749, fail 0, cancelled 0, skipped 2, todo 0 (duration about 302 s). No load-sensitive rerun was needed; no E224-budget recurrence. PASS

### AC4 (T-RELW11-02)
- `npm run build && git status --porcelain dist/` -> empty (dist byte-identical to fresh build). PASS
- `node scripts/check-version.mjs` -> OK (4.13.0), dist/index.js and package-lock parity OK; exit 0. PASS
- `npm run check:bookkeeping` -> OK (416 ticket rows, 204 queue rows, 302 decision rows), exit 0. PASS
- `npm run check:md-tables` -> OK (648 files, 0 malformed), exit 0. PASS

### AC5 (T-RELW11-02)
- (a) `npm audit --audit-level=high` -> exit 0; 7 vulnerabilities (1 low, 6 moderate: @hono/node-server, esbuild, fast-uri, hono, ip-address, protobufjs, qs), zero HIGH/CRITICAL. PASS
- (b) `package.json` diff is exactly `"zod": "^4.4.3"` -> `"zod": "^4.6.6"`. Overrides grep count 0; `"(zod|body-parser)": "` count 1. Lockfile probe: root `""` (4.13.0 -> 4.13.0, dependencies.zod), `node_modules/body-parser` 2.2.2 -> 2.4.0, `iconv-lite` 0.7.2 -> 0.7.3, `type-is` 2.0.1 -> 2.1.0, `zod` 4.4.3 -> 4.6.7, nested `body-parser/node_modules/content-type` and `type-is/node_modules/content-type` (- -> 2.1.0); `top-level changed: []`. PASS
- (c) `docs/dependency-advisories.md` section 8 (zod, GHSA-mrhx-c7xc-m3w5) and section 9 (body-parser, GHSA-27r3-jxmh-p828) each carry the GHSA id, a Decision and a Re-review trigger. `git log v4.13.0..HEAD -- docs/dependency-advisories.md package.json package-lock.json` -> single line `14fa252`; `14fa252` is an ancestor of `8adb9ba` (exit 0). PASS
- (d) `npm ls zod --all` -> single `zod@4.6.7`, others `deduped`; `npm ls body-parser --all` -> `body-parser@2.4.0`; no `invalid`/`UNMET`/`extraneous`; no nested SDK zod (`No such file or directory`); no source file imports express/body-parser (empty). PASS

### AC6 (T-RELW11-02)
- `node bin/agc-init.mjs check` -> `OK (4.13.0) — all adapters current`, exit 0. PASS
- `node scripts/check-transitions-sync.mjs` -> OK (21 keys, exact match), exit 0. PASS

### AC7 (T-RELW11-02) — Node 20 verdict rests on CI
`git rev-parse HEAD` = `3cd4eaf738d5911a50a5d284e32cfa1340c84c39`. All ten runs `success` with `test (20)=success` and `test (22)=success`:
- 40655807308 3cd4eaf main push
- 40655004382 b4623b2 integ/post-v4-w11 push
- 40655405766 b4623b2 integ/post-v4-w11 pull_request
- 40654088449 c13237e integ/post-v4-w11 push
- 40647241866 6de1157 integ/e364 push
- 40648019344 e5f325d main push
- 40643730940 8adb9ba feat/e364-audit-high-upgrade push
- 40653092971 7cb2bdb feat/e139-evidence-verdict-integrity push
- 40653573982 bad8a49 feat/e362-test-lock-guard push
- 40651826921 f563a91 feat/e217-lane-lifecycle-gaps push
Head shas match the spec's expected list. PASS. Node 20 was not run locally.

### AC8 (T-RELW11-03)
- (a) fanout tool paths unchanged since v4.13.0 (empty). Validate loop: only `specs/fanout-wave5.1.md` and `specs/fanout-wave6.md`, each exit=2 with `DECISIONS_SECTION_ABSENT PINS_SECTION_ABSENT`. w11 manifest: `fanout: ok — 4 dispatchable lane(s), 0 provisional, 26 decision(s)`, exit 0. PASS
- (b) `owners ... --range v4.13.0...HEAD` exit=1; `fanout owners: 102 path(s), 77 hit(s), 4 dispatchable lane(s)`; first-lane counts 56 e139, 8 e217, 6 e362, 7 e364; 15 multi-lane HIT lines; the five attribution HIT lines (bin/agc-init.mjs e217, scripts/test-lock.mjs e362, package.json / package-lock.json / docs/dependency-advisories.md e364); non-HIT remainder = 25 paths (the Bookkeeping set). PASS
- (c) `handoff --closing` exit 0; headings `## 接手步驟` plus four `###` (核對 primary, 已結案, 待人類決定, 進行中的背景工作). PASS
- (d) `handoff --check` -> `5 fact(s) checked, 2 differ, 2 moved`, exit 1. MOVED: target branch, worktree. DIFF: `git status` (the uncommitted bookkeeping: this spec, `.current/_primary/*`) and `lane-status` (new active_feature `release-post-v4-w11`, hop 2, dirty). Both DIFF lines are the ones the spec names as explained by this feature. PASS
- (e) generic usage: 5 lines starting `       node scripts/fanout.mjs`, exit 2. PASS
- Read-only: `git status --porcelain` unchanged across all of these runs; no stack trace. PASS
- (f) 18 fanout regression test files: tests 199, pass 199, fail 0. PASS

### AC9 (T-RELW11-04)
- Author-gate probe: `seed accepted`; `pm APPROVED rejected unchanged ⛔ NON_REVIEWER_VERDICT_REJECTED: review_verdict=APPROVED on an agent_id=pm write.`; `pm CHANGES_REQUESTED rejected unchanged ⛔ NON_REVIEWER_VERDICT_REJECTED: review_verdict=CHANGES_REQUESTED on an agent_id=pm write.`; `control accepted`. PASS
- Registry probe: `35 orchestrator false 18`. PASS
- `grep -rc NON_REVIEWER_VERDICT_REJECTED content | grep -v ':0$'` -> no output. PASS
- 8 listed test files: tests 265, pass 265, fail 0. PASS

### AC10 (T-RELW11-04)
- Filename probe (v4.13.0 dist extracted via git archive vs HEAD dist): seven canonical ids (T-E139-01, T-REL4-02, T-RELW11-01, T01, JIRA-42, A10-ARCH, T-1.2) `same enc-ok`; seven `CHANGED enc-ok` with exactly the spec's mappings: `t-e139-01` -> `review__T-_E139-01.md`, `T-e139-01` -> `review_T-_E139-01.md`, `T-A_1` -> `review_T-A__005F1.md`, `T_A-1` -> `review_T__005FA-1.md`, `T-A/1` -> `review_T-A__002F1.md`, `T-A 1` -> `review_T-A__00201.md`, `T-é-1` -> `review_T-__00E9-1.md`. Old names for `T-A_1`, `T-A/1`, `T-A 1` all collapsed to `review_T-A_1.md`; new: `files review_T-A__00201.md review_T-A__002F1.md review_T-A__005F1.md`. PASS
- `encodeEvidenceId(taskId)` hit once in each of gates/{qa-review,code-review,ac-execution,expected-red,visual}.ts and tools/evidence-lookup.ts. PASS
- Remaining `replace(/[^A-Za-z0-9._-]/g, "_")`: exactly three, in gates/ac-execution.ts, gates/expected-red.ts, gates/visual.ts (activeFeature sanitisers); diff of `activeFeature` lines since v4.13.0 empty. PASS
- Open task rows with non-canonical ids: none. Tracked non-canonical evidence filenames: 18 (information only, matches cut-time count). PASS
- 5 listed test files: tests 183, pass 183, fail 0. PASS

### AC11 (T-RELW11-04)
- 8 listed test files: tests 129, pass 129, fail 0. PASS
- `dist/gates/qa-review.js` exports both `recordReviewInFile` (line 25) and `recordReviewInFileUndoable` (line 79). PASS
- covers probe: `["A","B","C"] ["A","A"] ["A"] im`. PASS
- `git diff --stat v4.13.0..HEAD -- tools/storage.ts tools/storage-sqlite.ts tools/lane-status.ts test/e177b-lane-status.test.mjs` -> empty. PASS

### AC12 (T-RELW11-05)
- `fs.openSync(guardPath, "wx")` count 0; `linkPublish(guardPath` (line 120) and `linkPublish(lockPath` (line 190) plus one `fs.linkSync(tmp, destPath)` (line 213). PASS
- `node scripts/test-lock.mjs` with no args -> exit 64. PASS
- `git diff --stat` for test/e209-test-lock-publish.test.mjs and scripts/mailbox-watch.mjs -> empty. PASS
- `AGC_E177B_WAIT_MS` count: mailbox-watch test 2, test-lock test 2. PASS
- `agc-init` usage names the `--abandoned` `specs/` copy into `specs/abandoned/<ticket-id>/`; `docs/install.md` "never touched" phrase count 0 and it documents the copy. PASS
- `core.hooksPath` warning present in `bin/agc-init.mjs` (`agc feature start — warning: core.hooksPath "..." is a relative path ...`); diff grep for npm/npx/pnpm/yarn/husky spawn -> empty. PASS
- 10 listed test files: tests 201, pass 201, fail 0. PASS

### AC13 (T-RELW11-03)
- `v4.13.0^{commit}` = `0c479caef7592d222809991de69ef25cd4acb638`; ancestor of HEAD (exit 0); CHANGELOG line 19 `## [4.13.0] - 2026-10-22`; `const HOP_CAP = 14` at tools/transitions.ts:326. PASS
- Registry probe: `{"handoff":15,"tasks":2,"sqlite":2,"config":2} 35 13 12`. PASS
- `test/` top-level `*.test.mjs`: HEAD 210, v4.13.0 203. PASS
- `schema/` diff since v4.13.0 empty; `content/const-*.md` 15, `content/coord-*.md` 7, templates 12. PASS
- Composition/golden/budget group: tests 232, pass 232. v4.13.0 lane group: tests 336, pass 336. Governance-core group: tests 250, pass 250 (includes `test/e234-hygiene-scan.test.mjs`). PASS
- CLAUDE.md count baseline for release-engineer (recorded, not a finding): line 43 `twelve tw_* tools` (registry has 13); line 50 `33 entries` and line 88 `33 gate definitions` (registry has 35); lines 122 and 154 `87 test files` (test/ holds 210 top-level `*.test.mjs`); line 159 version-labelled `1633/1633 at v3.94.0` left as is. Correct counts: 18-step pipeline, 12 prompts, 15 const fragments, 7 coord fragments, 12 templates.

## Findings
None. No FAIL block. No load-sensitive reruns required.

## Verdict
PASS for T-RELW11-01..05 (AC1-AC13 all hold).
## 2026-10-29T03:50:27.852Z — PASS — by qa-engineer

PASS T-RELW11-01..05 on main@3cd4eaf, Node v22.22.3, vs current 4.13.0. AC1 66 commits/102 paths/28 dist, untouched set empty, all paths in lane classes; AC2 11 QA files pass=1 fail=0, 4 lane handoffs PASS, ledgers 2/10/3/5, ancestry+second parents ok; AC3 full suite under test lock exit 0, 3751 tests/3749 pass/0 fail/2 skipped; AC4 dist identical, check-version/bookkeeping/md-tables ok; AC5 audit high exit 0 (7: 1 low 6 moderate), one-line zod floor, 7-entry lockfile delta, sections 8/9 in 14fa252 before 8adb9ba, triggers not fired; AC6 agc check + transitions-sync ok; AC7 ten CI runs success with test(20)+test(22); AC8 fanout validate/owners 102/77/4 (56/8/6/7, 15 multi), handoff closing/check, usage 5 lines exit 2, 199/199 tests; AC9 author-gate probe rejected pm APPROVED/CHANGES_REQUESTED unchanged, 35/orchestrator/false/18, 265/265; AC10 filename probe 7 same + 7 CHANGED enc-ok, 3 distinct files, 183/183; AC11 129/129, covers probe ["A","B","C"] ["A","A"] ["A"] im; AC12 guard linkPublish, exit 64, 201/201; AC13 non-regression groups 232/336/250 pass, counts 35/13/12, test files 210 vs 203. No findings. Evidence: qa_reports/review_T-RELW11-01.md (covers T-RELW11-01..05).

