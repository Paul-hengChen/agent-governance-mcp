covers: T-RELCD2-01, T-RELCD2-02, T-RELCD2-03, T-RELCD2-04, T-RELCD2-05, T-RELCD2-06

# QA review — release-cd-v4.19.2 (evidence-only release gate)

Judge: qa-engineer (sonnet), Task-spawned. Tree: `main` @ `8157cd3898da977d367abaec9ad6fa4ea3c57944`, equal to `origin/main`. Previous release `v4.19.1` (tag object `dc01de6`, commit `fceabf1`). Node v22.22.3. No source, test or spec edit; this file is the only artifact written.

Phase 0.5: skipped (no expected-red manifest declared). Phase 1 / 3a / 3b / 1.5: not applicable (no Copy / Visual Tokens / Visual Baselines; the spec declares none). Phase 3: skipped, evidence-only gate (dispatch brief: authors no tests).

## AC Execution Log

### AC1 — range classification (PASS)
- `git log --oneline v4.19.1..HEAD | wc -l` -> `19`
- `git diff --shortstat v4.19.1..HEAD` -> `27 files changed, 744 insertions(+), 33 deletions(-)`
- `git diff --name-only v4.19.1..HEAD` -> 27 paths: `.current/_primary/{dispatch.jsonl,handoff.md,metrics.jsonl}`, `.current/history/2026-11/e408/{dispatch.jsonl,handoff.md,pending-tickets.md,tasks.md,telemetry.jsonl}`, `content/coord-{03-core-fallback,05-core-visual-drift,07-core-sop}.md`, `dist/tools/role.js`, `dist/tools/role.js.map`, `docs/backlog.md`, `docs/v4.0.0-new-tickets.md`, `qa_reports/review_T-E408-0{1,2,3,4}.md`, `review_reports/review_T-E408-01.md`, `specs/e408-core-task-alias-tail.md`, `specs/fanout-prompt-audit-w5.md`, `tasks.md`, `templates/claude-code-agents/lite.md`, `test/e408-core-task-alias-tail.test.mjs`, `test/fixtures/compose-golden/skill-coordinator-monolith.txt`, `tools/role.ts`. All inside the 15 + 5 + 7 classes; no stray path.
- first-parent merges -> `8157cd3 c337d5b 052e54e #84`, `c337d5b e1b9a11 4f2b67a #83`, `e1b9a11 fceabf1 1493117 #82` (exactly three).
- `git log --merges --format='%h %p' c337d5b..052e54e` -> only `f30a713 c337d5b 6ac6a80`.
- `f30a713 all=20 lane=15`.
- PR #82 / #83 diffs -> the three `.current/_primary/*` files; then `docs/backlog.md`, `docs/v4.0.0-new-tickets.md`, `specs/fanout-prompt-audit-w5.md`.
- `git diff --name-only f30a713 052e54e` -> the nine expected paths (five `.current/history/2026-11/e408/*`, backlog, new-tickets, fanout spec, `tasks.md`).
- untouched-set probe (gates schema prompts bin scripts guards transport lib .github, const-*, lite skill, release-engineer skill, context-budget test, index.ts, package*.json, tsconfig*, .config.json, README/CHANGELOG/CLAUDE/AGENTS/.antigravityrules/CONTRIBUTING, release-cd/install/dependency-advisories/lane-protocol docs) -> empty.
- `.ts`/dist probe -> exactly `dist/tools/role.js`, `dist/tools/role.js.map`, `tools/role.ts`.
- class counts in order `.current content dist docs qa_reports review_reports specs tasks.md templates test tools scripts .github prompts gates` -> `8 3 2 2 4 1 2 1 1 2 1 0 0 0 0` (matches).
Verdict: PASS.

### AC2 — lane evidence on main (PASS)
- lane handoff -> `active_feature: "e408-core-task-alias-tail"`, `status: "PASS"`, `last_agent: "qa-engineer"`, `hop_count: 4`, `qa_rounds_total: 0`, `review_rounds_total: 0`; ledger `x=4 void=0 open=0`.
- `qa_reports/review_T-E408-0{1,2,3,4}.md` -> `last=PASS fail=0` four times; `covers: T-E408-01, T-E408-02, T-E408-03, T-E408-04` on 01 only; `suite-result: 4030/4032 passed (...)` on all four.
- `review_reports/review_T-E408-01.md` -> line 3 `covers: T-E408-01, T-E408-02, T-E408-03`, no `## Round`, line 57 `## Verdict`, next line begins `APPROVED —`.
- expected-red e408 count `0`; `qa_reports/archive` e408 count `0` (recorded as data).
- backlog E408 DONE-pre-mark count `1`; E409 DONE count `0`; queue `| 223 | **E408** ✅ DONE...`, `| 224 | **E409** | P3 | ...` (no DONE).
- ancestry: no `NOT` line; `e1b9a11 ^1=fceabf1 ^2=1493117`, `c337d5b ^1=e1b9a11 ^2=4f2b67a`, `f30a713 ^1=c337d5b ^2=6ac6a80`, `8157cd3 ^1=c337d5b ^2=052e54e`; `same-tree=0`.
Verdict: PASS.

### AC3 — CI and local subset (PASS)
- `gh run view` x6 ->
  - `CI 6ac6a80 feat/e408-core-task-alias-tail push success test (20)=success,test (22)=success`
  - `CI f30a713 integ/prompt-audit-w5 push success test (20)=success,test (22)=success`
  - `CI 052e54e integ/prompt-audit-w5 push success test (20)=success,test (22)=success`
  - `CI 052e54e integ/prompt-audit-w5 pull_request success test (20)=success,test (22)=success`
  - `CI c337d5b main push success test (20)=success,test (22)=success`
  - `CI 8157cd3 main push success test (20)=success,test (22)=success`
- `gh run list --commit HEAD` -> `41966153019 CI success`.
- `node scripts/test-lock.mjs -- node --test <14 files>` -> exit 0; `# tests 211`, `# pass 211`, `# fail 0`, `# skipped 0`.
Verdict: PASS.

### AC4 — build, version, bookkeeping, adapters, dependencies (PASS)
- `git diff --name-only v4.19.1 HEAD -- dist` -> `dist/tools/role.js`, `dist/tools/role.js.map` only.
- `node scripts/check-version.mjs` -> `check:version — OK (4.19.1)` (advisory note: HEAD past tag, expected).
- `check:bookkeeping` -> `OK (453 ticket row(s), 241 queue row(s), 416 decision row(s) checked)`, `bk=0` (one non-blocking note: id ordering not checked, no base commit).
- `check:md-tables` -> `OK (723 file(s) scanned, 0 malformed tables)`, `md=0`.
- `node bin/agc-init.mjs check` -> `agc check — OK (4.19.1) — all adapters current`, `agc=0`; hygiene advisory recorded: `skipped 37 home-path hit(s) with a placeholder username` (not a finding).
- `node scripts/check-transitions-sync.mjs` -> `OK (21 keys, exact match ...)`.
- `git diff --quiet v4.19.1 HEAD -- package.json package-lock.json` -> `deps=0`.
- `npm audit --audit-level=high` -> `audit=0`; counts `7 vulnerabilities (1 low, 6 moderate)`; no HIGH/CRITICAL.
- `npm ls zod body-parser | grep -c -E 'invalid|UNMET|extraneous'` -> `0`.
Verdict: PASS.

### AC5 — scope claim (PASS)
- registries -> `35 18 13 12 {"handoff":15,"tasks":2,"sqlite":2,"config":2}`.
- comment-only diffs -> `ts=0`, `js=0`; `dist/tools/role.js` lines `103` and `103`.
- map -> `True 3354 3354 ['mappings']`.
- `qa-engineer:PASS` edge includes `release-engineer:In_Progress` -> `true`; `tools/transitions.ts:16:  | "release-engineer";`; `Side-channel constraint` count in skill-doc-writer `1`; `integrator` count in `tools/role.ts` `0`.
- `npm run -s build` -> `build=0`; `node scripts/capture-constitution-golden.mjs` -> `cap=0`; `git status --porcelain` afterwards identical to before the run (only the pre-existing `.current/_primary/{dispatch.jsonl,handoff.md,tasks.md}` modifications and the untracked spec; no `dist/` or golden change).
- goldens -> `12` files; numstat `6 6 test/fixtures/compose-golden/skill-coordinator-monolith.txt`; bytes `45783` / `45762` at v4.19.1.
- `context-budget.test.mjs` -> `budget=0`, cap-assertion grep count `4` (>= 2). Lane budgets recorded as data: teamwork 21408 ~tok, lean 5682 ~tok (qa_reports/review_T-E408-02.md).
- numstat content/templates/test -> `4 4` coord-03, `1 1` coord-05, `1 1` coord-07, `1 1` lite.md, `106 0` e408 test, `6 6` golden.
- bytes now/v4.19.1: coord-03 `23065/23066`, coord-05 `1590/1572`, coord-07 `2504/2500`; `task=0` three times.
- lite.md lines `11` and `11`; only `templates/claude-code-agents/lite.md` changed under templates.
- test file count `234` vs `233` at v4.19.1.
Verdict: PASS.

### AC6 — composed coordinator prompt through dist (PASS)
- `switchRole("coordinator")` span probe -> `true true true true true true | false false false false`.
Verdict: PASS.

### AC7 — lite template (PASS)
- frontmatter: `name: lite`, `model: haiku`, description unchanged; diff hunk `@@ -9 +9 @@` only.
- line 9 greps -> `1`, `1`, `0` (new Hard-rules wording present, haiku/sonnet sentence present, old `(server rejects lite-mode writes)` absent).
- `git diff --quiet v4.19.1 HEAD -- content/skill-coordinator-lite.md` -> `sop=0`; `recommended_model: sonnet` count `1`; `## Hard rules` count `1`.
- `specs/d8-lite-recommended-model.md`: `Amendment` count `6`, `AC8` count `7`.
- `ls templates/claude-code-agents | wc -l` -> `12`; `bin/agc-init.mjs:3484` reads `templates/claude-code-agents` via `readdirSync`.
Verdict: PASS.

### AC8 — runner-path preconditions (PASS)
- (a) dry run: `RELEASE_STOP PRECONDITION_NOT_PASS: .current/_primary/handoff.md is (qa-engineer, In_Progress), expected (qa-engineer, PASS) — commit the release gate's (qa-engineer, PASS) write to main first`, `exit=60`, `unchanged`, empty work-dir listing. `gh auth status` succeeded (pre-2); HEAD `8157cd3...`, upstream `origin/main`.
- (b) `17:## [Unreleased]`, `19:## [4.19.1] - 2026-11-04`; `unreleasedEntry` -> `null` (coordinator writes it after PASS; runner would stop `CHANGELOG_ENTRY_MISSING` until then).
- (c) `premarks []`.
- (d) `deriveVersion` -> `4.19.2`; commit first line `chore(release): v4.19.2 — release-cd-v4.19.2 (E408)`.
- (e) `git branch --list 'release/v4.19.2'` empty; `git ls-remote --heads origin 'release/v4.19.2'` empty.
- (f) data: `["specs/e408-core-task-alias-tail.md"]`; `with-spec MULTI-FEATURE pass`; `spec-absent MULTI-FEATURE SPEC_UNCLASSIFIABLE`; `spec-not-in-range MULTI-FEATURE SPEC_REQUIRE`. Note: `specs/release-cd-v4.19.2.md` is currently untracked; it must reach `main` in the coordinator's docs PR (per spec Dependencies).
Verdict: PASS.

### AC9 — v4.19.1 non-regression (PASS)
- `git rev-parse v4.19.1 'v4.19.1^{commit}'` -> `dc01de643d291709f76197ded0dd1b55012814f9`, `fceabf18a9770d051a8f54de912ed9bf1e736409`; tag message `v4.19.1 — release-cd-v4.19.1 (E395, E403, E404, E407)`; `ancestor`.
- CHANGELOG `19:## [4.19.1] - 2026-11-04`.
- `schema dist/schema .github scripts docs/release-cd.md` unchanged since v4.19.1 -> `unchanged=0`.
- `switchRole("release-engineer")` -> `string true true`.
- `node scripts/test-lock.mjs -- node --test test/e35-pipeline-order.test.mjs test/error-code-contract.test.mjs test/e394-release-sop.test.mjs test/e405-release-docs.test.mjs test/e405-release-workflow.test.mjs` -> exit 0; `# tests 79`, `# pass 79`, `# fail 0`.
- CLAUDE.md baseline (all correct, not findings): `15 ordered fragments` (l5), `12 registered role prompts` (l7), `~300 lines` (l24, l59), `Twelve prompts` (l33), ``thirteen `tw_*` tools`` (l43), `18-step` (l48, l62), `7 fragments` (l128), `12 model-pinned` (l132); `index.ts` is 311 lines.
Verdict: PASS.

### AC10 — read-back
Performed after the PASS write; results are in the QA final reply (they post-date this evidence).

## Findings
None. No HIGH/CRITICAL advisory. No stray path in the range. No red in any local run.
## 2026-11-05T05:57:56.198Z — PASS — by qa-engineer

suite-result: 211/211 passed (server-recorded from qa_suite_result; command: node scripts/test-lock.mjs -- node --test <14 AC3 files>)

AC1-AC9 all hold on main @ 8157cd3 (= origin/main) vs v4.19.1 (dc01de6 -> fceabf1). AC1: 19 commits, 27 files, 744+/33-, classes 15+5+7, untouched set empty, class counts 8 3 2 2 4 1 2 1 1 2 1 0 0 0 0. AC2: lane e408 PASS hop_count 4, ledger 4/0/0, evidence 4030/4032, APPROVED, E408 pre-mark, #223 DONE, E409 open, same-tree=0. AC3: six CI runs success Node 20+22, run 41966153019 on HEAD; local 14-file subset 211/211. AC4: dist diff only role.js(+map), check-version/bookkeeping/md-tables/agc check/transitions-sync OK, deps unchanged, audit=0 (1 low, 6 moderate). AC5: registries 35/18/13/12, comment-only role.ts/role.js, map only mappings differs, build+golden capture leaves tree unchanged, byte/numstat claims match, 234 test files. AC6: six new spans true, four old false. AC7: lite.md line 9 only, facts exist, 12 templates. AC8: dry run exit 60 PRECONDITION_NOT_PASS naming (qa-engineer, In_Progress), unchanged, CHANGELOG [Unreleased] present with null entry, premarks [], 4.19.2, summary line, no release branch, spec-check MULTI-FEATURE pass/SPEC_UNCLASSIFIABLE/SPEC_REQUIRE. AC9: tag ok, unchanged paths, SOP loads, 79/79 release+governance tests, CLAUDE.md baselines correct, index.ts 311 lines. Full raw log under AC Execution Log in qa_reports/review_T-RELCD2-01.md. Note for coordinator: specs/release-cd-v4.19.2.md is untracked and must land in the docs PR; CHANGELOG entry still to be written.

