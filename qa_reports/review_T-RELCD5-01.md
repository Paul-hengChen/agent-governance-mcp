covers: T-RELCD5-01, T-RELCD5-02, T-RELCD5-03, T-RELCD5-04, T-RELCD5-05, T-RELCD5-06

# QA review — release-cd-v4.20.0 (T-RELCD5-01..06)

Evidence-only release gate for v4.20.0 MINOR (22 tickets, human-decided). Verified on `main` @ 45a45fd (= origin/main), against v4.19.4 (tag object 803909c, commit a8a1619). QA tier: sonnet. No file created or edited besides this review; no commit, push, branch, CHANGELOG edit, ticket filed, or non-dry-run release phase. `docs/agc-ticket-draft-wc32.md` untouched, not printed.

Phase 0.5: skipped (no expected-red manifest declared for `release-cd-v4.20.0`; the six lane manifests belong to the lanes and are checked as data in AC2).
Phase 1.5: skipped (no Visual Baselines declared). Spec Copy / Strings and Visual Tokens: n/a (evidence-only gate).
Phase 3: skipped (no test file expected or created; tasks touch no files).

## AC Execution Log

### AC1 (T-RELCD5-01) — PASS
- `git log --oneline v4.19.4..HEAD | wc -l` = 133; `--no-merges` = 117; shortstat `274 files changed, 9689 insertions(+), 863 deletions(-)`; name-status `131 A / 142 M / 1 R`.
- First-parent merges exactly the seven specified (45a45fd, 4b25061, e8e11da, 2425e04, 60a038d, 9a4ef29, 4414abd with the stated parents); the nine lane merges exactly as specified.
- Lane counts 18, 27, 12, 40, 49, 33, 11, 31, 16; `a=145 b=90 ab=0`; remainder 39 paths = `.current/_primary` 2, `.current/history/2026-09/e232` 1, nine lane history dirs 31 (e196 3, e230 4, e238 4, e247 3, e255 3, e262 4, e359 3, e381 3, e406 4), docs 2 (backlog, new-tickets), specs 2 (two fanout manifests), tasks.md 1. Total 145+90+32+2+5 = 274; no stray path.
- Untouched-set diff count = 0; `content/const-*` diff = `content/const-05-core-standards.md` only. Per-top-level counts `34 1 1 1 1 7 50 7 4 1 1 51 4 19 2 25 1 56 8 0 0 0 0 0 0` (exact match). dist-to-source mapping 14 / 14.

### AC2 (T-RELCD5-01) — PASS
- Nine lane handoffs: all `PASS`, `qa-engineer`; feature names and hop/qa_rounds/review_rounds exactly as specified (e247 7/1/0, e196 7/0/1, e406 7/0/1, others as listed); ledgers x/void/open = e230 4/0/0, e381 7/0/0, e238 6/0/0, e255 8/0/0, e247 10/2/0, e262 9/0/0, e196 9/1/0, e359 6/0/0, e406 4/0/0 (63 ticked, 3 voided, 0 open).
- 44 `qa_reports/review_T-*.md` added: every `last=PASS`; `secs=2 fail=1` only on E247-01/07/10/11 (suite-result 4069/4074 first line), the other 40 `secs=1 fail=0`.
- 15 `review_reports/review_T-*.md` added: all end `APPROVED`; two-round files E196-01, E203-01 (CHANGES_REQUESTED then APPROVED), E406-01 (APPROVED task-level then APPROVED confirmation); E381-01/02/03 no `## Round` heading (format difference, data).
- Expected-red manifests: e196 2, e230 2, e247 0, e262 20, e381 1, e406 27 (data); archived lane evidence 0; nine lane specs present in tree.
- 22 backlog rows: each exactly one row, `**DONE — merged to integ/backlog-wave-{a 2026-11-09 | b 2026-11-10}` prefix true, `not yet released` true (bad=0).
- Ancestry: no `NOT` line for the 16 heads; `waveBtree=0`, `waveAtree=0`.

### AC3 (T-RELCD5-02) — PASS
- 20 CI runs: all `CI <sha> <branch> <event> success test (20)=success,test (22)=success` (count of matching lines = 20); `gh run list --commit HEAD` = `42772351362 CI success`.
- Full suite on HEAD: `node scripts/test-lock.mjs -- npm test` exit 0; `# tests 4184`, `# pass 4182`, `# fail 0`, `# cancelled 0`, `# skipped 2`, `# todo 0`, duration ~638 s. No load-sensitive-list red; no rerun needed.

### AC4 (T-RELCD5-02) — PASS
- `check-version` OK (4.19.4) (note: HEAD past tag, expected); dist and package-lock parity OK.
- `check:bookkeeping` bk=0 (461 ticket / 247 queue / 484 decision rows; non-blocking note: id ordering not checked, no base commit). `check:md-tables` md=0 (771 files, 0 malformed).
- `agc check` agc=0 `OK (4.19.4) — all adapters current`; hygiene advisory recorded (skipped 37 home-path hits with a placeholder username), not a finding. Three `agc-version: 4.19.4` stamps (CLAUDE.md:237, AGENTS.md:1, .antigravityrules:1).
- `check-transitions-sync` OK (21 keys). `deps=0`. `audit=0`; `7 vulnerabilities (1 low, 6 moderate)`; `npm ls zod body-parser` bad-token count 0.

### AC5 (T-RELCD5-03) — PASS
- dist: `36 19 13 12 {"handoff":15,"tasks":2,"sqlite":2,"config":2}`; `13 QA_COMPLETION_EVIDENCE_MISSING PASS_MISSING_EVIDENCE orchestrator true`.
- GateErrorCode added: exactly `+  | "PASS_TASKS_INCOMPLETE"`; release.mjs exit-class line diff count 0.
- Counts: const 15, coord 7, templates 12, gates/*.ts 15.
- `npm run build && capture-constitution-golden` cap=0; `git status --porcelain` identical before and after (only the three `.current/_primary` runtime files and the untracked spec; no dist/golden change). 12 goldens; numstat `11 1/1`; monolith unchanged (`monolith=0`).
- context-budget diff exactly the two cap raises (5723 to 5731, 8501 to 8518); caps 5731, 8518, 10598, 21715, 4849, 2852 each present twice; `node --test test/context-budget.test.mjs` 54 pass, 0 fail. Measured lean at HEAD with the test's composition = 5731 (zero headroom, data); non-design cap 8518 is the test's own zero-headroom assertion and passes (data; other budgets not re-measured separately, covered by the passing test).
- content bytes/lines now vs v4.19.4: const-05 6252/5986, constitution-rationale 15799/15788, skill-design-auditor 21090/21082, skill-integrator 42204/41612, skill-pm 21113/21117, skill-qa-engineer 18472/18398, skill-qa-visual 17169/17024; line counts unchanged for all 7.
- test files `19 A`, `26 M`; top-level `test/*.test.mjs` 258 (239 at v4.19.4).

### AC6 (T-RELCD5-04) — PASS
- `switchRole("qa-engineer")` contains both spans: `true true`.
- fanout usage: new string count 1, old `[--base main]` 0; `git 追蹤中的檔不算（E388）` count 1; `test/usage-accounting.test.mjs` unchanged (`usage=0`).
- Product-style prefix: runtime-derived length 4 (value not printed); case-insensitive `git grep` file count 0; old path absent (`old=1`), new path present (`new=0`).
- Named test pins (e247, e396, e35, error-code-contract, e230, e151, cut-approval-gate, qa-flow, e381, e390, e388, e177a): all files exist and passed in the AC3 full-suite run (fail 0).

### AC7 (T-RELCD5-04) — PASS
- const-05 exception sentence present in both compositions: `true true`; 11 goldens contain the span.
- skill-integrator spans `1 1 1 1`, removed spans `0 0 0`; lane-protocol `1 1 0`; addendum `1 1`; qa-visual `review_task_ids=[<task-id>]` 5 (0 at v4.19.4).
- Named test pins (e340, e130, e359, e376, e172, prompt-state-footer, e196, e225, e205, e351, e383, e394-release-script, e203): all files exist and passed in the AC3 full-suite run (fail 0).

### AC8 (T-RELCD5-05) — PASS
- (a) dry run with handoff `(qa-engineer, In_Progress)`: `RELEASE_STOP PRECONDITION_NOT_PASS: .current/_primary/handoff.md is (qa-engineer, In_Progress), expected (qa-engineer, PASS) — …`, `exit=60`, `unchanged`, empty work-dir listing; `gh auth status` succeeded.
- (b) `## [Unreleased]` at line 17 above `## [4.19.4] - 2026-11-09` at line 19; `unreleasedEntry` = `null` (recorded; entry is the coordinator's).
- (c) premarks `[]`; E416 `["E416 row has no \"not yet released\" pre-mark to amend"]`; E353 `["E353 row desc does not start with **DONE"]`.
- (d) `deriveVersion` 4.20.0; commit summary first line `chore(release): v4.20.0 — release-cd-v4.20.0 (E151, E172, E196, E203, E205, E225, E230, E238, E247, E255, E262, E340, E355, E359, E360, E376, E380, E381, E388, E390, E396, E406)` exactly as specified.
- (e) no `release/v4.20.0` locally or on origin.
- (f) `21 9`; with-spec `MULTI-FEATURE pass`; spec-absent `MULTI-FEATURE SPEC_UNCLASSIFIABLE`; spec-not-in-range `MULTI-FEATURE SPEC_REQUIRE` (data, as expected).
- (g) staging verdicts `{"pass":true,"missing":[],"problems":[],"warnings":["docs/stray.md"]}` and `false untracked file(s) never staged: specs/x.md`; draft file `ignored=0`, listed-by-ls-files count 0, `tracked=1`, `present=0`; untouched.

### AC9 (T-RELCD5-06) — PASS
- `v4.19.4` resolves to tag object `803909c…` / commit `a8a1619…`; tagger `github-actions[bot]`; message `v4.19.4 — release-cd-v4.19.4 (E415, E416)`; ancestor of HEAD. CHANGELOG `## [4.19.4] - 2026-11-09` at line 19.
- `schema .github docs/release-cd.md content/skill-release-engineer.md` unchanged (`unchanged=0`); `scripts/` diff = exactly `scripts/fanout.mjs`, `scripts/release.mjs`.
- `switchRole("release-engineer")` contains `docs/release-cd.md` and `never waits for it`: `true true`.
- Release and v4.19.4 pins (e416-filing-bar, e5-intake-tiering, e394-release-sop, e394-release-script, e405-release-docs, e405-release-workflow, e405-release-runner, release-staging): all exist and passed in the AC3 full-suite run.
- CLAUDE.md baseline (data): `thirteen` tools, `19-step` x2, `12 registered`, `Twelve prompts`, `15 ordered`, `7 fragments`, `12 model-pinned`, `~300 lines`; `index.ts` 300 lines; README `19-step|19 steps` = 2, docs/architecture.md = 3; no `18-step`.

## Verdict
AC1–AC9 hold. No finding. PASS.
## 2026-11-10T07:43:20.417Z — PASS — by qa-engineer

suite-result: 4182/4184 passed (server-recorded from qa_suite_result; command: node scripts/test-lock.mjs -- npm test)

AC1-AC9 verified on main @ 45a45fd vs v4.19.4; no finding. AC1: 133/117 commits, 274 paths (131A/142M/1R), 7 first-parent + 9 lane merges exact, a=145 b=90 ab=0, 39 non-lane paths in the three remaining classes, untouched set 0, only const-05 among const-*, 14/14 dist-source. AC2: nine lane handoffs PASS/qa-engineer with expected counters, ledgers 63 x / 3 void / 0 open, 44 QA files last=PASS (4 E247 FAIL->PASS), 15 review files APPROVED, six expected-red counts as specified, 22 backlog rows pre-marked, ancestry and tree equality hold. AC3: 20 CI runs success on Node 20+22, HEAD run 42772351362 success; full suite under test lock 4182/4184, fail 0, skipped 2, exit 0. AC4: check-version OK 4.19.4, bookkeeping 0, md-tables 0, agc check OK, transitions-sync 21 keys, deps unchanged, audit high exit 0 (1 low 6 moderate). AC5: registries 36/19/13/12 with gate at index 13, CURRENT_VERSIONS unchanged, one new GateErrorCode, no exit-class change, 15/7/12/15 counts, build+golden capture leaves tree unchanged, 11 goldens 1/1, caps 5731/8518 only, lean measured 5731, content bytes as specified, 258 test files. AC6/AC7: SOP, const-05, integrator, lane-protocol, addendum, qa-visual spans as specified, prefix grep 0, rename present. AC8: dry run exit 60 PRECONDITION_NOT_PASS, tree unchanged, premarks [] and E416/E353 rejected, 4.20.0 and commit summary exact, no release branch, MULTI-FEATURE verdicts, E406 staging verdicts, draft file ignored/untracked/present untouched. AC9: tag/ancestry/schema/.github/release docs unchanged, scripts diff only fanout+release, release-engineer SOP loads, baselines recorded. Evidence: qa_reports/review_T-RELCD5-01.md (covers all six).

