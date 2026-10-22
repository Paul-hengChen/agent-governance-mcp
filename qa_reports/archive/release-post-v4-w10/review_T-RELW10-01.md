covers: T-RELW10-01, T-RELW10-02, T-RELW10-03, T-RELW10-04, T-RELW10-05

# QA review: release-post-v4-w10 (v4.13.0 MINOR release gate)

HEAD f8862b98306e2b841ebcb1c60315cd2703980676, tree at 4.12.0, local Node v22.22.3. Evidence-only: no code, test, version, CHANGELOG or stamp edits. `git status --porcelain` before and after all runs was identical (3 modified `.current/_primary/*` files plus untracked `specs/release-post-v4-w10.md`).

Phase 0.5: skipped (no expected-red manifest declared for this feature).
Phase 1 / 3a / 3b: Copy and Visual tables are N/A in the spec; no user-facing strings or literals introduced.
Phase 1.5: skipped (no Visual Baselines declared).
Phase 3: skipped (evidence-only release gate; dispatch brief says do not create or edit any test file).

## AC Execution Log

### AC1 (T-RELW10-01)
- `git log --oneline v4.12.0..HEAD | wc -l` = 45; `git diff --name-only v4.12.0..HEAD | wc -l` = 81.
- Untouched-set diff (the long pathspec): empty output.
- Code classification: exactly dist/tools/{drift,handoff-orchestrator,handoff-parse,handoff-types,handoff-write,registry}.*, the six matching tools/*.ts, scripts/summarize-metrics.mjs, scripts/test-lock.mjs. `git diff --name-only v4.12.0..HEAD | grep -c dist/tools` = 19.
- Every one of the 81 paths matched one of the four classes (regex complement printed nothing). Verdict PASS.

### AC2 (T-RELW10-01)
- review_reports: T-E181-03 `covers: T-E181-03, T-E138-03, T-E135-03, T-E150-05`, Round 1 APPROVED; T-E183-01 and T-E209-01 Round 1 APPROVED.
- qa_reports: T-E181-04 has the nine-id `covers:` line and one PASS block; T-E135-04, T-E138-04, T-E150-06, T-E209-01, T-E183-01, T-E183-02, T-E182-01 each one PASS block; T-E209-02 `covers: T-E209-01, T-E183-01, T-E209-02, T-E183-02, T-E182-01`, PASS; T-E182-01 has `## E156 cause judgment`.
- Both expected-red manifests exist.
- Lane handoffs: e135-handoff-notes-ledger and e209-test-infra-fixes both status PASS, last_agent qa-engineer.
- Ledger counts 9 / 5 `[x]`, 9 `[-]` (e135): matches.
- Backlog: E135/E138/E150/E181 DONE with cfc3c68; E182/E183/E209 DONE with 88e8da9; E358-E363 rows exist, none DONE.
- All seven shas are ancestors of HEAD; cfc3c68^2 = b9d977a, 88e8da9^2 = c68f00a. Verdict PASS.

### AC3 (T-RELW10-02)
- `node scripts/test-lock.mjs -- npm test`: exit 0; tests 3691, pass 3689, fail 0, cancelled 0, skipped 2. Node v22.22.3. Lock publish path (E209) exercised by the outer wrap. Verdict PASS.

### AC4 (T-RELW10-02)
- `npm run build && git status --porcelain dist/`: build exit 0, empty porcelain.
- `check-version.mjs`: OK (4.12.0), exit 0 (informational note that HEAD is past the tag).
- `check:bookkeeping`: OK (407 ticket, 195 queue, 276 decision rows), exit 0.
- `check:md-tables`: OK (631 files, 0 malformed), exit 0. Verdict PASS.

### AC5 (T-RELW10-02)
- `npm audit --audit-level=high`: exit 0; 8 vulnerabilities (2 low, 6 moderate, 0 high/critical).
- `git diff --stat v4.12.0..HEAD -- package.json package-lock.json`: empty. Verdict PASS.

### AC6 (T-RELW10-02)
- `node bin/agc-init.mjs check`: `OK (4.12.0) - all adapters current`, exit 0.
- `check-transitions-sync.mjs`: OK (21 keys), exit 0. Verdict PASS.

### AC7 (T-RELW10-02)
`gh run view` for the five runs, each conclusion success with `test (20) success` and `test (22) success`:
- 39713971888 head f8862b98 (HEAD)
- 39712293802 head b7a90519
- 39711742858 head 88e8da95
- 39711237967 head b9d977a5
- 39421355881 head c68f00a0
Verdict PASS.

### AC8 (T-RELW10-03)
- (a) validate over every specs/fanout-*.md: only fanout-wave5.1.md and fanout-wave6.md exit 2 with exactly DECISIONS_SECTION_ABSENT + PINS_SECTION_ABSENT; w10 manifest `fanout: ok - 2 dispatchable lane(s), 0 provisional, 14 decision(s)`, exit 0.
- (b) owners --range v4.12.0...HEAD: exit 1; `81 path(s), 58 hit(s), 2 dispatchable lane(s)`; 46 e135, 12 e209; 4 both-lane test lines; the nine HIT lines match (six tools/*.ts to e135; test-lock, summarize-metrics, gate-retro-procedure to e209); 23 non-HIT paths.
- (c) handoff --closing: exit 0; the `## 接手步驟` heading with four `###` sub-items.
- (d) handoff --check: exit 1; `5 fact(s) checked, 2 differ, 2 moved`. MOVED: target branch and worktree. DIFF lines name only `git status` (this feature's uncommitted bookkeeping and spec) and `lane-status` (new active_feature release-post-v4-w10). No stack trace.
- (e) usage: 5 lines, exit 2.
- Porcelain unchanged across these runs.
- (f) the 19 fanout regression test files: 221 tests, 221 pass, 0 fail, 0 skipped. Verdict PASS.

### AC9 (T-RELW10-04)
Input probe (verbatim from the spec, via dist TOOL_REGISTRY, scratch workspace under TMPDIR, removed): `seed accepted`, then 13 lines each `rejected unchanged` with the expected message:
- note LF, CR, U+2028, U+2029: `pending_notes[0] contains a line break`
- note `  [x] t`: `pending_notes[0] starts with "["`
- note blank, `(none)`, `無`: `pending_notes[0] is empty or an empty-section sentinel`
- note with marker mid-prose, `…[truncated]`, legacy `omitted` shape: `pending_notes[0] contains tw_get_state read-view display text`
- ledger LF: `completed_tasks[0] contains a line break`; ledger blank: `completed_tasks[0] is empty or whitespace-only`
- `grep -rn -F '⟦agc read-view⟧' tools/`: exactly `tools/handoff-types.ts:17` (READ_VIEW_MARKER_PREFIX).
- Tests (e181, e135, e92 x2): 195 tests, 195 pass. Verdict PASS.

### AC10 (T-RELW10-04)
Read-view probe output: `view 8 first note-00 markerIdx 1 markers 1`; `kept note-00,⟦agc re,note-07..note-12`; the marker line `6 note(s) omitted here - full text is on disk; see pending_notes_truncated. Do not write this line back.` verbatim; `truncated {"total_chars":5057,"limit":3000,"omitted_notes":6}`; `sliced 0`; `disk 13`; `write-back rejected pending_notes[1] unchanged`.
Tests (e138, token-efficiency, prompt-state-footer): 53 tests, 53 pass. Verdict PASS.

### AC11 (T-RELW10-04)
- Tests (e150, reviewer-completed-tasks-gate, e32-e33, e18): 77 tests, 77 pass, 0 skipped; the AC18 SQLite case ran and passed (not skipped).
- dist `completed_tasks` description equals the E150 string exactly.
- `grep -c 'Tasks completed now'` tools/registry.ts, dist/tools/registry.js: 0, 0. `grep -c 'discarded on conflict'` tools/drift.ts, dist/tools/drift.js: 0, 0.
- `tw_detect_drift` evidence-backed line: `completed_tasks is feature-scoped: it carries forward across same-feature writes and empties on an active_feature change (E150).` (T-REL4-02 advisory is the known one, ignored). Verdict PASS.

### AC12 (T-RELW10-05)
- (a) `grep -c 'fs.linkSync' scripts/test-lock.mjs` = 1; no-arg run exit 64; `git diff --stat` on test/e177b-test-lock.test.mjs empty.
- (b) usage-accounting: default `20000` with `AGC_USAGE_HOOK_TEST_TIMEOUT_MS` override (lines 8-11, 349-350); no 5000 hook timeout (the other matches are 500000 token budgets).
- (c) `summarize-metrics.mjs` no-arg: exit 0, 1 `aggregate - features:` line; missing explicit path: stderr `summarize-metrics: no metrics file at <path>.`, exit 1; script imports `resolveCurrentLanePaths, resolveFlatLanePaths` from `../dist/tools/lane-paths.js`; neither stale phrase found in the doc or script.
- Tests (e209, e177b-test-lock, usage-accounting, e183, success-metrics): 106 tests, 106 pass. Verdict PASS.

### AC13 (T-RELW10-03)
- `v4.12.0^{commit}` = eb29b03d5a84ba8f30dde66341fbdf11231f46ef; ancestor of HEAD (exit 0); `[4.12.0]` at CHANGELOG.md:19; `const HOP_CAP = 14` at tools/transitions.ts:326.
- `34 {"handoff":15,"tasks":2,"sqlite":2,"config":2}`.
- `git diff --stat v4.12.0..HEAD -- tools/storage-sqlite.ts schema/`: empty.
- SOP/template grep for rejected `pending_notes` literals: no output.
- Composition/golden/budget/adapters/v4.12.0 lane tests (13 files): 232 tests, 232 pass.
- Governance-core tests (15 files, includes e234-hygiene-scan): 343 tests, 343 pass. Verdict PASS.

## Findings
None blocking. Informational: `check:version` notes HEAD is past v4.12.0 (expected; release-engineer bumps). Prior-wave scratch dirs under TMPDIR (`w10`, `w10probe-*`) pre-existed and were not mine.
## 2026-10-22T03:32:37.743Z — PASS — by qa-engineer

AC1-AC13 all hold on HEAD f8862b9 at 4.12.0. Full suite under test lock on Node 22.22.3: 3691 tests, 3689 pass, 0 fail, 2 skipped. Build clean and dist byte-identical, check-version/bookkeeping/md-tables/audit(high)/agc check/transitions-sync exit 0, five CI runs success on Node 20 and 22. AC9 13/13 input shapes rejected unchanged through dist, AC10 read view 8 entries with one marker and write-back rejected, AC11 ledger tests and strings verified, AC12 test-lock/hook timeout/summarize-metrics verified, AC13 non-regression green. Evidence in qa_reports/review_T-RELW10-01.md.

