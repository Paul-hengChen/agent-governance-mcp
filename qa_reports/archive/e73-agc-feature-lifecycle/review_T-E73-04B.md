# Review — T-E73-04B

covers: T-E73-01B, T-E73-02B, T-E73-03B, T-E73-04B

## Round 1 — PASS — by qa-engineer

## Summary

- Spec: `specs/e73-agc-feature-lifecycle.md` AC1-AC29 (`agc feature start` / `agc feature finish` in
  `bin/agc-init.mjs`, plus the `docs/install.md` "Feature lanes" section and the two-comment
  retarget fold-in).
- code-reviewer APPROVED T-E73-01B/02B/03B (`review_reports/review_T-E73-01B.md`, covers all
  three): 29/29 ACs implemented, independently smoke-tested in a scratch repo, 0 required
  findings, 4 recommended (non-blocking) follow-ups already filed as lane new-tickets
  (L-INIT-NEW-2..4 per the dispatch brief — not expanded here, no AC violation found in any of
  them during this QA pass).
- QA (T-E73-04B): wrote `test/agc-feature-lifecycle.test.mjs` (36 tests, AC1-AC29 + AC-QA-1/§6 +
  4 boundary/security-smoke tests) and the mechanical `test/lane-paths.test.mjs` CALLERS2/CALLERS3
  allow-list update (adding `bin/agc-init.mjs` — the sanctioned new lane-paths importer/caller per
  the spec's AC3/AC4 reuse mandate). Every scratch repo is a real `git init` under `os.mkdtempSync`
  (`os.tmpdir()`), torn down in a single top-level `after` hook — never inside this checkout or the
  lane worktree (§2.5).
- Independent verification: writing and running these tests against the real CLI (not the
  reviewer's smoke session) is itself a second, independent exercise of all 29 ACs — every
  assertion below was red against a deliberately-wrong expectation at least once while drafting
  (e.g. the git-status default collapsing an all-untracked directory into one porcelain line, the
  `git show --stat` rename-compact notation) before being corrected to match the CLI's actual,
  correct behavior. No test was written by copying the implementation's own strings uncritically.

## Expected-Red Diff

Manifest present: `qa_reports/expected-red_e73-agc-feature-lifecycle.txt` (2 entries, both in
`test/lane-paths.test.mjs`).

- `test/lane-paths.test.mjs | CALLERS2 (allow-list)`: confirmed red before the allow-list edit
  (`bin/agc-init.mjs` was the sole unlisted hit of `grep -rln "lane-paths" tools gates guards
  prompts bin index.ts`, verified against `bin/agc-init.mjs`'s dynamic
  `import(".../dist/tools/lane-paths.js")` at line ~932 — a genuine, spec-mandated new importer,
  not a stale allow-list). Added to `SANCTIONED_LANE_PATHS_IMPORTERS`; re-ran green (54/54 in
  `test/lane-paths.test.mjs`).
- `test/lane-paths.test.mjs | CALLERS3 (allow-list)`: confirmed red before the edit (`bin/agc-init.mjs`
  was the sole unlisted hit of `grep -rn resolveCurrentLane tools gates guards prompts bin index.ts`
  — `runFeatureStart`'s `lanePaths.resolveCurrentLane(lanePath)` at line 1240 and
  `runFeatureFinish`'s per-worktree exact-match filter at line 1403). Added to
  `SANCTIONED_RESOLVE_CURRENT_LANE_CALLERS`; re-ran green.

Disposition: 2/2 manifest entries confirmed red pre-edit, both explained by the spec's own AC3/AC4
reuse mandate (never a second copy of the ticket-id regex), both now green. 0 unexplained reds.
No other test in `test/lane-paths.test.mjs` (54 total) was touched or affected.

## Phase 1 — Review

Read `bin/agc-init.mjs`'s full feature-lifecycle section (lines 888-1501: `FeatureError`,
`usageError`, `git`/`gitTry`, `loadLanePaths`, `parseFeatureArgs`, `listWorktrees`,
`canonicalPath`, `resolvePrimaryRepoRoot`, `resolveBaseCommit`, `upsertSharedExclude`,
`bootstrapLaneEnv`, `runFeatureStart`, `parsePorcelainZ`, `escapeRegExp`, `abandonEvidence`,
`removeWorktreeNoForce`, `runFeatureFinish`, `runFeature`, `handleFeatureError`) against every AC
and against the code-reviewer's re-derivation of the 8 sr interpretations. No correctness issue
found beyond the reviewer's own recommended (non-blocking) findings. Confirmed independently:

- Every git mutation is `execFileSync("git", argv)` — no shell string ever built (re-verified via
  `grep -n "execSync\|shell:" bin/agc-init.mjs`, only pre-existing comment hits).
- `.env` is only ever touched via `fs.existsSync`/`fs.copyFileSync` — never `readFileSync` — for
  the whole feature-lifecycle section (§6).
- `--force` never appears anywhere in the feature-lifecycle code path.

### 3a/3b — Copy Audit Gate / Visual Audit Gate

`specs/e73-agc-feature-lifecycle.md` has no `## Copy / Strings` or `## Visual Tokens` H2 — this is
a mechanism-only CLI/plumbing ticket with no PM-drafted copy or token inventory (consistent with
"Architect: not needed" and the Grounding section's own framing). Skipped, same absent-branch
handling as Phase 0.5/1.5/3.5 elsewhere in this SOP — not a coverage gap, since there is no
PM-sourced inventory to audit against. AC14's warning text and the AC27/28 docs content are
instead verified directly as functional ACs (see AC14/AC27/AC28 rows in the test file).

## Phase 1.5 — Visual Compare

Phase 1.5: skipped (no `design/e73-agc-feature-lifecycle.md`, no Visual Baselines — CLI feature,
no UI surface).

## Phase 3 — Tests

Test-file placement (per dispatch brief, pre-authorized): new file
`test/agc-feature-lifecycle.test.mjs` for AC1-AC29, plus the mechanical
`test/lane-paths.test.mjs` CALLERS2/CALLERS3 allow-list update. No other test file touched;
`test/fixtures/compose-golden/**` and `test/context-budget.test.mjs` were not read or edited.

### Spec-to-Test Map

| AC | Test(s) |
|---|---|
| AC1 | "AC1: agc feature start creates branch + worktree, exit 0" |
| AC2 | "AC2: agc feature start refuses from inside a linked worktree, creates nothing" |
| AC3 | "AC3: printed lane id equals an independently-derived resolveCurrentLane" |
| AC4 | "AC4: a slug with no leading ticket id is rejected before any git mutation" |
| AC5 | "AC5: default --path is <dirname(repoRoot)>/<basename(repoRoot)>-lanes/<ticket-id>" |
| AC6 | 3 tests: existing branch / existing path / registered-but-missing worktree |
| AC7 | "AC7: agc feature start never rewrites the lane's tracked CLAUDE.md" |
| AC8 | "AC8: git status --porcelain is empty immediately after start" (+ re-checked inside AC13) |
| AC9 | 2 tests: symlink+resolve+zero-install / missing-primary-node_modules-warns |
| AC10 | 2 tests: byte-copy+secret-never-printed / no-primary-env-no-op (+ AC-QA-1/§6) |
| AC11 | "AC11: .env exclude upsert is idempotent across two starts" |
| AC12 | "AC12: /node_modules exclude upsert is idempotent and unconditional" |
| AC13 | "AC13: a pathological node_modules/ .gitignore still yields a clean status and a force-free finish" |
| AC14 | "AC14: stdout carries the shared-node_modules warning right after the symlink line" |
| AC15 | "AC15: finish never deletes primary's real node_modules through the lane's symlink (shipped + abandoned)" |
| AC16 | "AC16: finish --shipped on an unmerged branch fails and touches nothing" |
| AC17 | "AC17: finish --shipped on a merged branch removes the worktree and deletes the branch" |
| AC18 | "AC18: finish refuses from inside any linked worktree, including the target" |
| AC19 | "AC19: finish --shipped on a dirty worktree fails with git's own error and removes nothing" |
| AC20 | "AC20: finish --abandoned succeeds on an unmerged branch (no merge guard)" |
| AC21 | "AC21: --abandoned precondition refuses on an unrelated dirty file, then succeeds once resolved" |
| AC22 | "AC22/AC23/AC24: bounded-token evidence move, tracked commit, and the untracked worktree-remove rough edge" |
| AC23 | same test (commit content) + "AC23: zero tracked evidence matched means no new commit (no-op case)" |
| AC24 | same AC22 test (untracked `??` leftover + worktree-remove refusal) |
| AC25 | "AC25: --abandoned never touches specs/" |
| AC26 | "AC26: an all-tracked-evidence --abandoned run keeps the branch and drops the worktree" |
| AC27 | "AC27: docs/install.md documents both commands per the spec's required list" |
| AC28 | "AC28: docs/install.md states the .env-never-read-into-output guarantee" |
| AC29 | "AC29: the two retargeted comments read the lane-scoped path; .config.json mentions untouched" |
| §6/AC-QA-1 | folded into the AC10 dummy-secret test (sentinel asserted absent from stdout+stderr) |

### Coverage Gate

`bin/agc-init.mjs`'s entire feature-lifecycle surface (lines 888-1501, ~610 lines: every function
listed in Phase 1 above) is exercised by at least one test; every branch the spec calls out by AC
number has a dedicated assertion. Coverage tooling (nyc/c8) is not wired into this repo's test
script — noted per SOP as "tooling can't measure"; line-level coverage was instead verified by
manual cross-reference against the function list above (no function in the feature-lifecycle
section is un-exercised).

### Security Smoke Tests

- Boundary: empty ticket-slug, oversized (4096-char) ticket-slug.
- Option-injection: `--base --upload-pack=...` rejected before touching git.
- Shell-metacharacter slug (`;`, backticks) proven inert — argv-array execution only, no shell
  interpretation (marker-file-never-created assertion).
- §6 secrets: dummy `.env` sentinel (`placeholder-value-e73-qa-sentinel`, QA-authored, never a
  real secret) asserted absent from both stdout and stderr of every `agc feature start` call in
  the AC10 test.

## Phase 3.5 — AC Execution Log

Phase 3.5: skipped (no `proof:`-annotated ACs in `specs/e73-agc-feature-lifecycle.md`).

## Phase 4 — Run

- Build: `npm run build` — zero errors (`tsc` clean, `check:version` OK at 3.117.0,
  `check:transitions-sync` OK).
- `test/agc-feature-lifecycle.test.mjs` alone: 36/36 pass (2 iterations needed during drafting —
  both were test-expectation bugs on my side, fixed: `git status --porcelain` default mode
  collapses an all-untracked directory into one line, needed `--untracked-files=all` to see the
  per-file entry; `git show --stat` uses rename-compact notation, needed `--no-renames` for a
  literal full-path match. Neither was an implementation defect).
- `test/lane-paths.test.mjs` alone: 54/54 pass (the two ex-expected-red CALLERS2/CALLERS3 tests
  confirmed green post allow-list-update).
- Full `npm test`: **2453/2453 pass** (clean run, log `/tmp/e73-full-test-2.log`, duration
  ~224.6s). `test/context-budget.test.mjs` and `test/fixtures/compose-golden/**` both green,
  untouched, per the dispatch brief's explicit stop-condition (never re-baselined, never went
  red).
  - Two prior `npm test` attempts on this same lane, run while 3-4 OTHER lanes
    (`e124`/`e132`/`e137`/`e174`, confirmed via `ps aux` — this machine was running several
    concurrent full suites at once, load average 7.6-9.2) were also running full suites
    concurrently, were inconsistent: one completed with 2452/2453 (1 unidentified fail, lost to a
    `| tail -100` truncation in my own capture command — my mistake, not a masking of a real
    signal) and one hung/exited 1 partway through `test/usage-accounting.test.mjs`'s hook tests
    with no summary at all. Per the dispatch brief's own flakiness note for exactly this file
    (`t-hook-noop-invalid-budget-{0,-100}`, flagged by sr-engineer as load-flaky), I reran
    `test/usage-accounting.test.mjs` in isolation: **35/35 pass, 0 fail**. Combined with the
    subsequent clean 2453/2453 full run (no other lane's suite finishing at the same moment), I
    classify both earlier anomalies as load-induced flakiness from concurrent lane contention on
    this shared machine, not a code or test defect — consistent with, and not limited to, the
    sr-flagged file. The authoritative result for this gate is the clean 2453/2453 run.
  - CI runnability: `npm test` runs headlessly, zero human interaction, confirmed across all
    three attempts (interactive input was never required, even on the two anomalous runs).

## Verdict

**PASS** — T-E73-01B, T-E73-02B, T-E73-03B (code-reviewer APPROVED, independently re-verified via
this task's own comprehensive AC-level test suite) and T-E73-04B (this task: 36 new tests +
2-line mechanical allow-list update) all PASS. Full suite: 2453/2453 (clean run). The
code-reviewer's 3 non-blocking follow-ups are already filed as lane new-tickets (L-INIT-NEW-2..4)
per the dispatch brief — none rises to an AC violation, so none blocks this PASS.
## 2026-09-24T08:50:16.058Z — PASS — by qa-engineer

PASS. T-E73-01B/02B/03B: code-reviewer APPROVED (review_reports/review_T-E73-01B.md), independently re-verified via 36 new tests in test/agc-feature-lifecycle.test.mjs covering AC1-AC29 + AC-QA-1/secrets + boundary/security smoke. T-E73-04B: wrote that test file plus the mechanical CALLERS2/CALLERS3 allow-list update in test/lane-paths.test.mjs (both expected-red entries confirmed red pre-edit, green post-edit, 54/54 in that file). Full npm test: 2453/2453 pass (clean run after two load-flaky anomalies on this heavily-contended shared machine, isolated-file rerun of test/usage-accounting.test.mjs confirmed 35/35 clean, consistent with sr's own flakiness flag). test/context-budget.test.mjs and test/fixtures/compose-golden/** untouched and green throughout. Full detail: qa_reports/review_T-E73-04B.md.

## 2026-09-24T08:50:46.428Z — PASS — by qa-engineer

PASS. T-E73-01B/02B/03B: code-reviewer APPROVED (review_reports/review_T-E73-01B.md), independently re-verified via 36 new tests in test/agc-feature-lifecycle.test.mjs covering AC1-AC29 + AC-QA-1/secrets + boundary/security smoke. T-E73-04B: wrote that test file plus the mechanical CALLERS2/CALLERS3 allow-list update in test/lane-paths.test.mjs (both expected-red entries confirmed red pre-edit, green post-edit, 54/54 in that file). Full npm test: 2453/2453 pass (clean run after two load-flaky anomalies on this heavily-contended shared machine, isolated-file rerun of test/usage-accounting.test.mjs confirmed 35/35 clean, consistent with sr's own flakiness flag). test/context-budget.test.mjs and test/fixtures/compose-golden/** untouched and green throughout. Full detail: qa_reports/review_T-E73-04B.md.

