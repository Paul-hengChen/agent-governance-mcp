covers: T-RELCD-01, T-RELCD-02, T-RELCD-03, T-RELCD-04, T-RELCD-05, T-RELCD-06

# QA review: release-cd-v4.19.0 (evidence-only release gate, v4.19.0)

Verified on `main` `69a077d` (equal to `origin/main`), against the current version 4.18.0. Spec: `specs/release-cd-v4.19.0.md`. Local Node v22.22.3. No code, test, dist, CLAUDE.md, CHANGELOG or backlog edits; no release branch, no non-dry-run phase, no workflow dispatch, no RELEASE_TOKEN use.

Phase 0.5: skipped (no expected-red manifest declared for this feature).
Phase 1.5: skipped (no Visual Baselines declared). Copy/Visual gates: N/A (spec declares none).
Phase 3: skipped (evidence-only gate; dispatcher resolved no test file is warranted).

## AC Execution Log

### AC1 (T-RELCD-01) PASS
- `git log --oneline v4.18.0..HEAD | wc -l` -> 33.
- `git diff --shortstat v4.18.0..HEAD` -> `37 files changed, 3391 insertions(+), 65 deletions(-)`.
- first-parent merges -> `69a077d` #73, `18ffbc0` #72, `f0caa45` #71, `07bc3a5` #70 (exactly).
- `git log --merges 18ffbc0..3864347` -> only `75e5070 18ffbc0 fdc8e59`.
- `all=30 lane=27`.
- per-bookkeeping-merge paths and `75e5070..3864347` paths match the expected lists.
- Untouched-set diff (dist tools gates schema prompts bin guards transport lib templates index.ts package*.json tsconfig .config.json README CHANGELOG CLAUDE AGENTS .antigravityrules ci.yml absorbed scripts docs/install etc.) -> empty.
- Area counts: content 1, test 6, templates 0, tools 0, scripts 1, dist 0, specs 3, docs 3, .github 1.
- Full 37-path list read and classified: 27 lane + 3 lane history + 7 bookkeeping; no path outside the classes.

### AC2 (T-RELCD-01) PASS
- Lane handoff: `active_feature "e405-release-cd"`, `status "PASS"`, `last_agent "qa-engineer"`, `hop_count 5`, `qa_rounds_total 0`, `review_rounds_total 0`.
- Lane ledger `x=12 void=0 open=0`.
- 12 `qa_reports/review_T-E405-*.md`: each `last=PASS fail=0`.
- `review_T-E405-01.md`: `covers: T-E405-01..12`, `suite-result: 4003/4005 passed` count 1.
- `review_reports/review_T-E405-02.md`: `covers: T-E405-02..07`, one `## Round 1 — APPROVED`, `- Verdict: APPROVED`.
- expected-red file: 5 `test/` entries. `ls qa_reports/archive | grep -c e405` -> 0 (not archived).
- Backlog E405 1, E401 1 pre-mark rows; queue rows 214 and 217 carry `✅ DONE`.
- Ancestry: no `NOT` line; `^1`/`^2` pairs all as expected (`3d9f354/5f0b69a`, `07bc3a5/e697755`, `f0caa45/7210fb4`, `18ffbc0/fdc8e59`, `18ffbc0/3864347`); `same-tree=0`.

### AC3 (T-RELCD-02) PASS
- `gh run view` 41795016362: `CI fdc8e59 feat/e405-release-cd push success test (20)=success,test (22)=success`.
- 41795759236: `CI 3864347 integ/e405 push success test (20)=success,test (22)=success`.
- 41796623490: `CI 69a077d main push success test (20)=success,test (22)=success`.
- `gh run list --commit HEAD` -> `41796623490 CI success`.
- Local: `node scripts/test-lock.mjs -- node --test test/e405-release-docs.test.mjs test/e405-release-runner.test.mjs test/e405-release-workflow.test.mjs test/e394-release-script.test.mjs test/e394-release-sop.test.mjs test/release-staging.test.mjs` -> exit 0; tests 218, pass 218, fail 0, cancelled 0, skipped 0 (about 162 s). The full suite was not rerun locally; its verdict rests on the three CI runs.

### AC4 (T-RELCD-02) PASS
- `git diff --quiet v4.18.0 HEAD -- dist` -> 0; `npx tsc` exit 0 and `git status --porcelain -- dist` empty.
- `check:version — OK (4.18.0)` (dist/index.js and package-lock parity OK; advisory note that HEAD is past the tag).
- `check:bookkeeping` OK (450 ticket, 238 queue, 386 decision rows), bk=0. `check:md-tables` OK (708 files, 0 malformed), md=0.
- `agc check — OK (4.18.0) — all adapters current`, agc=0. Advisory (not a failure, exit 0): hygiene hit `specs/release-cd-v4.19.0.md:48 home-path`. It is the literal path pattern inside the spec's own AC6 grep proof; the spec is the coordinator's, so it is reported, not edited.
- `check-transitions-sync` OK (21 keys). package.json / package-lock.json unchanged (deps=0).
- `npm audit --audit-level=high` exit 0; 7 vulnerabilities (1 low, 6 moderate), no HIGH/CRITICAL.
- `npm ls zod body-parser`: zod@4.6.7 deduped, body-parser@2.4.0; no invalid, UNMET or extraneous.

### AC5 (T-RELCD-03) PASS
- Registries via dist: `35 18 13 12 {"handoff":15,"tasks":2,"sqlite":2,"config":2}`.
- numstat: release.yml 170/0, CONTRIBUTING 1/0, skill-release-engineer 2/1, release.mjs 485/30, e394-release-script 34/11, e394-release-sop 28/1, e405-release-docs 108/0, e405-release-runner 865/0, e405-release-workflow 243/0, release-staging 2/2. Only those rows.
- CONTRIBUTING added line names `docs/release-cd.md`; SOP gained the `Automated path:` line and step 13 was replaced.
- SOP bytes 14690 (v4.18.0: 14434). release.yml 170 lines.
- Top-level test files 229 (v4.18.0: 226).
- Baseline: `CLAUDE.md` lines 126 and 158 state `226 test files` while HEAD has 229 (needs-human-ruling item; the coordinator fixes it, not QA).

### AC6 (T-RELCD-04) PASS
- js-yaml parse: `Release ["workflow_dispatch"] ["bump","tickets","dry_run"] choice ["patch","minor","major"] patch true boolean true`; permissions `{"contents":"read","issues":"write"}`; concurrency `{"group":"release","cancel-in-progress":false}`; one job `release`, timeout 120, 13 steps.
- Steps: Require main, Work directory, actions/checkout@v4, Use Node.js 22, Install dependencies, Build, `Start (dry run)` if `inputs.dry_run`, Start / Prepare / Publish / Record / Close out each if `!inputs.dry_run`, `File failure issue` if `failure() && !inputs.dry_run`.
- Secrets: `7 secrets.RELEASE_TOKEN` only; `github.token` 1; leak grep for local paths and token prefixes in release.yml and docs/release-cd.md -> `leak=1` (none).

### AC7 (T-RELCD-04) PASS
- `--help` exit 0, five phase usage lines in order start, prepare, publish, record, close-out.
- `EXIT_CLASSES` 42; `RUNNER_PHASES ["start","record"]`; runner-only codes 60-64 and 70-75 (11); prepare/publish/close-out classes 31; `deriveVersion("4.18.0","minor")` = 4.19.0.
- `commitMessage` first line: `chore(release): v4.19.0 — release-cd-v4.19.0 (E405, E401)`.
- `docs/release-cd.md` runner-only table: the same 11 code/class pairs. SOP Escalation rows: 31.
- `never waits for it`: 1 in the SOP, 1 in `docs/release-cd.md`.
- `docs/release-cd.md` names RELEASE_TOKEN with Contents RW, Pull requests RW, Actions R, Metadata R, and has `## Before you trigger`.

### AC8 (T-RELCD-05) PASS
- (a) `start --bump minor --tickets E405,E401 --work-dir <scratch> --dry-run` (pre-PASS): gh auth OK, on `main` tracking `origin/main`, `RELEASE_STOP PRECONDITION_NOT_PASS: .current/_primary/handoff.md is (qa-engineer, In_Progress), expected (qa-engineer, PASS) — commit the release gate's (qa-engineer, PASS) write to main first`, `exit=60`; `git status --porcelain` plus `git branch --list 'release/*'` before/after `unchanged`; work dir listing empty (no state.md).
- (b) `CHANGELOG.md`: line 17 `## [Unreleased]`, line 19 `## [4.18.0] - 2026-11-03`; `unreleasedEntry` is `null` (the coordinator writes it after PASS).
- (c) `checkPreMarks` -> `[]`.
- (d) no `release/v4.19.0` locally or on origin (both empty).
- (e) `deriveRangeSpecs` -> `["specs/e405-release-cd.md"]`; `with-spec MULTI-FEATURE pass`; `spec-absent MULTI-FEATURE SPEC_UNCLASSIFIABLE`; `spec-not-in-range MULTI-FEATURE SPEC_REQUIRE`. This spec must reach `main` in the coordinator's docs PR.

### AC9 (T-RELCD-06) PASS
- `v4.18.0` tag object `0213297`, commit `3d9f354`, ancestor of HEAD; CHANGELOG line 19 `## [4.18.0] - 2026-11-03`; `schema/` and `dist/schema/` unchanged (schema=0).
- `switchRole("release-engineer")` -> `string true true`; coordinator `string true`.
- `node scripts/test-lock.mjs -- node --test test/e35-pipeline-order.test.mjs test/error-code-contract.test.mjs test/e392-subagent-templates.test.mjs test/e394-release-sop.test.mjs` -> exit 0, tests 73, pass 73, fail 0.
- `index.ts` 311 lines. CLAUDE.md baseline (each correct today): `35 entries` 1, `35 gate definitions` 1, `thirteen` 1, `18-step` 2, `12 registered role prompts` 1, `Twelve prompts` 1, `15 ordered fragments` 1, `7 fragments` 1, `12 model-pinned` 1, `~300 lines` 2. `226 test files` is stale (AC5).

### AC10 (post-PASS read-back)
Recorded in the final reply after the PASS write (post-dates this evidence).

## Unverified
- The workflow's runtime behaviour (PAT checkout, PR merge, tag, watch item O2) is first exercised by the human's dispatch; outside this gate.
- The full suite was not run locally (CI runs cited instead); Node 20 was not run locally (CI test (20) is green).
## 2026-11-04T08:30:38.964Z — PASS — by qa-engineer

suite-result: 218/218 passed (server-recorded from qa_suite_result; command: node scripts/test-lock.mjs -- node --test <six release test files: e405-release-{docs,runner,workflow}, e394-release-{script,sop}, release-staging>)

Evidence-only release gate for v4.19.0 verified on main 69a077d vs 4.18.0; full log in qa_reports/review_T-RELCD-01.md (covers 01..06, includes ## AC Execution Log). AC1 33 commits, 37 files 3391+/65-, 4 first-parent merges, 27+3+7 path classes, untouched set empty. AC2 lane handoff PASS hop 5, ledger 12/0/0, 12 reviews PASS, covers/suite-result 4003/4005, 5 expected-red, pre-marks and queue rows, same-tree 0. AC3 CI runs 41795016362, 41795759236, 41796623490 success on test(20)+test(22); six release test files local 218/218 under test lock. AC4 dist unchanged and tsc-identical, check-version OK 4.18.0, bookkeeping/md-tables/agc/transitions-sync OK, deps unchanged, audit high exit 0 (1 low, 6 moderate). AC5 registries 35/18/13/12, schema versions unchanged, numstat as spec, 229 test files, CLAUDE.md 226 baseline (coordinator fix). AC6 workflow structure, 13 steps, 7 RELEASE_TOKEN refs, no leaks. AC7 5 phases, 42 classes, 11 runner-only matching docs, 31 SOP rows, 4.19.0, commit summary, E401 sentence. AC8 start --dry-run exit 60 PRECONDITION_NOT_PASS naming (qa-engineer, In_Progress), unchanged status, empty work dir; [Unreleased] present with null entry; premarks []; no release/v4.19.0; spec check branches as expected. AC9 v4.18.0 tag/ancestor/changelog, schema unchanged, SOP loads, governance tests 73/73. Advisory: agc check hygiene flags the spec's own path-pattern literal at specs/release-cd-v4.19.0.md:48 (exit 0).

