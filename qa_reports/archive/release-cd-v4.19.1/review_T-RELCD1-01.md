covers: T-RELCD1-01, T-RELCD1-02, T-RELCD1-03, T-RELCD1-04, T-RELCD1-05, T-RELCD1-06

# QA review: release-cd-v4.19.1 (evidence-only release gate, v4.19.1)

Verified on `main` `def4ca0` (equal to `origin/main`), against the current version 4.19.0. Spec: `specs/release-cd-v4.19.1.md`. Local Node v22.22.3. No code, test, dist, CLAUDE.md, CHANGELOG or backlog edits; no release branch, no non-dry-run phase, no workflow dispatch, no secret read.

Phase 0.5: skipped (no expected-red manifest declared for this feature).
Phase 1.5: skipped (no Visual Baselines declared). Copy/Visual gates: N/A (spec declares none).
Phase 3: skipped (evidence-only gate; dispatch brief: no test file written or modified).

## AC Execution Log

### AC1 (T-RELCD1-01) PASS
- `git log --oneline v4.19.0..HEAD | wc -l` -> 30.
- `git diff --shortstat v4.19.0..HEAD` -> `38 files changed, 1470 insertions(+), 202 deletions(-)`.
- first-parent merges -> `def4ca0` #78, `1000517` #77, `4343909` #76 (exactly).
- `git log --merges 1000517..fab75ec` -> only `b8dc2ea 7ab9758 e192cd8` and `7ab9758 1000517 adf6983`.
- `7ab9758 all=18 lane=13`; `b8dc2ea all=14 lane=11`.
- Bookkeeping merge paths: `4343909` -> the two `.current/_primary/*` files; `1000517` -> `docs/backlog.md`, `docs/v4.0.0-new-tickets.md`, `specs/fanout-prompt-audit-w4.md`.
- `b8dc2ea..fab75ec` -> the eight `.current/history/2026-11/{e395,e403}/*`, `docs/backlog.md`, `docs/v4.0.0-new-tickets.md`, `specs/fanout-prompt-audit-w4.md`, `tasks.md`.
- Untouched-set diff (dist tools gates schema prompts bin scripts guards transport lib .github adapters const-* skill-release-engineer context-budget index.ts package*.json tsconfig .config.json README CHANGELOG AGENTS .antigravityrules CONTRIBUTING and four docs) -> empty. `*.ts` changed: 0.
- Area counts: content 5, test 11, templates 1, tools 0, scripts 0, dist 0, specs 3, docs 2, .github 0.
- Full 38-path list read and classified: e403 lane 13 + e395 lane 11 + lane history 8 + bookkeeping 6 = 38; no path outside the classes.

### AC2 (T-RELCD1-01) PASS
- e403 lane handoff: `e403-lean-dispatch-alias`, `PASS`, `qa-engineer`, `hop_count 4`, `qa_rounds_total 0`, `review_rounds_total 0`; ledger `x=8 void=0 open=0`.
- e395 lane handoff: `e395-claude-md-template-tail`, `PASS`, `qa-engineer`, `hop_count 4`, `qa_rounds_total 0`, `review_rounds_total 0`; ledger `x=7 void=0 open=0`.
- `qa_reports/review_T-E403-01.md`: `last=PASS fail=0`, covers the 8 expected ids, `suite-result: 4012/4014 passed`.
- `qa_reports/review_T-E395-04.md`: `last=PASS fail=0`, covers the 7 expected ids, `suite-result: 4014/4016 passed`.
- `review_reports/review_T-E403-01.md` (covers 5 ids) and `review_reports/review_T-E395-01.md` (covers 3 ids): one `## Round 1 — APPROVED`, `- Verdict: APPROVED`.
- expected-red files for e395/e403: 0 (data); `qa_reports/archive` entries for e395/e403: 0 (not archived).
- Backlog E395, E403, E404, E407: 1 pre-mark row each. Queue rows 210, 219, 220, 222 carry `✅ DONE`; 223 (E408) is open.
- Ancestry: no `NOT` line; `4343909 ^1=a227516 ^2=c41b993`, `1000517 ^1=4343909 ^2=bd42fca`, `7ab9758 ^1=1000517 ^2=adf6983`, `b8dc2ea ^1=7ab9758 ^2=e192cd8`, `def4ca0 ^1=1000517 ^2=fab75ec`; `same-tree=0`.

### AC3 (T-RELCD1-02) PASS
- `gh run view` (all `test (20)=success,test (22)=success`):
  - 41812846155: `CI adf6983 feat/e403-lean-dispatch-alias push success`
  - 41811234457: `CI e192cd8 feat/e395-claude-md-template-tail push success`
  - 41813339823: `CI b8dc2ea integ/prompt-audit-w4 push success`
  - 41813840329: `CI fab75ec integ/prompt-audit-w4 push success`
  - 41814133160: `CI fab75ec integ/prompt-audit-w4 pull_request success`
  - 41814449012: `CI def4ca0 main push success`
- `gh run list --commit HEAD` -> `41814449012 CI success`.
- Local, under the test lock: `node scripts/test-lock.mjs -- node --test` over the 13 named files (ten changed + compose-equivalence, context-budget, subagent-templates) -> `tests 288, pass 288, fail 0`, exit 0. The full suite was not rerun locally; its verdict rests on the CI runs above.

### AC4 (T-RELCD1-02) PASS
- `git diff --quiet v4.19.0 HEAD -- dist` -> `dist-diff=0`.
- `check:version — OK (4.19.0)` (dist/index.js and package-lock parity OK; advisory note that HEAD is past the tag).
- `check:bookkeeping — OK (452 ticket row(s), 240 queue row(s), 405 decision row(s) checked)`, `bk=0`.
- `check:md-tables — OK (717 file(s) scanned, 0 malformed tables)`, `md=0`.
- `agc check — OK (4.19.0) — all adapters current`, `agc=0` (hygiene advisory: skipped 40 home-path hit(s) with a placeholder username; recorded, not a finding).
- `check:transitions-sync — OK (21 keys, exact match)`.
- `package.json`, `package-lock.json` unchanged since `v4.19.0` (`deps=0`).
- `npm audit --audit-level=high` -> `audit=0`; 7 vulnerabilities (1 low, 6 moderate), no HIGH/CRITICAL.
- `npm ls zod body-parser` -> zod 4.6.7 deduped, body-parser 2.4.0; no invalid/UNMET/extraneous; exit 0.

### AC5 (T-RELCD1-03) PASS
- Registries via `dist/`: `35 18 13 12 {"handoff":15,"tasks":2,"sqlite":2,"config":2}`.
- `npm run -s build && node scripts/capture-constitution-golden.mjs`: `cap=0`; `git status --porcelain` after is identical to before the build (only the four coordinator-owned entries: three `.current/_primary/*` modifications and the untracked spec); no `dist/` or golden path appears, so both are byte-identical to HEAD.
- 12 goldens; the only golden changed since `v4.19.0`: `5 13 skill-coordinator-monolith.txt`.
- `test/context-budget.test.mjs`: `budget=0`; cap-literal grep count 4 (>= 2).
- numstat: CLAUDE.md `16/5`; content `1/1`, `4/12`, `1/1`, `1/1`, `1/1`; template `2/12`; tests e166 `7/16`, e336 `1/1`, e392 `4/4`, e395 `86/0`, e403 `52/0`, e404 `70/0`, e407 `77/0`, e96 `2/2`, feature-lease `21/47`, golden `5/13`, release-staging `15/73` — all as specified.
- Bytes now / v4.19.0: coord-03 23066/23053, coord-05 1572/2043, lite 3900/4013, integrator 41254/41523, qa-engineer 18398/18398.
- CLAUDE.md count-literal grep (`test files|35 entries|35 gate definitions`) -> 0; the 11 Layout rows `row=1` each; `ls tools/comment-*.ts` 10, the other ten files 10.
- Template 13 lines (23 at v4.19.0); `git diff --name-only v4.19.0..HEAD -- templates` -> only `release-engineer.md`.
- `ls test/*.test.mjs | wc -l` 233 (229 at v4.19.0).

### AC6 (T-RELCD1-04) PASS
- Prompt probe through `dist/`: `true false true false` (coordinator), `true false` (qa-engineer), `true false true true` (lite / integrator) — exactly as expected.
- Citations resolve: `Sequential-context assumption + reconcile` in `const-12-chain-r10-s4.md` count 1; `*\`tw_complete_task\` ownership*` in `const-05-core-standards.md` count 1; `## Limits` heading (line 7) and the `hop` cap row (line 17, "lite mode exempt") in `const-01-core-head.md`; `Integrator-only grant` in `const-15-core-tail.md` count 1.
- `prompts/constitution-manifest.ts` lists `const-12-chain-r10-s4.md` with `tag: "chain"`.

### AC7 (T-RELCD1-04) PASS
- Template frontmatter: `name: release-engineer`, `model: opus`, description unchanged. Body is four non-empty lines starting `CRITICAL: End every reply`, `This subagent runs`, `Before the version bump`, `CRITICAL: If this session has no MCP`; the load-line ending sentence and the re-baseline line each match once.
- `content/skill-release-engineer.md`: `sop=0` (unchanged), 14690 bytes; `driftBaselineIds` 1, `pull --ff-only` 2, `RELAY REQUIRED` 2, `⛔` 2.
- 12 template files; `bin/agc-init.mjs` has the `readdirSync` on `templates/claude-code-agents`.

### AC8 (T-RELCD1-05) PASS
- (a) `start --bump patch --tickets E395,E403,E404,E407 --work-dir <scratch> --dry-run` -> `RELEASE_STOP PRECONDITION_NOT_PASS: .current/_primary/handoff.md is (qa-engineer, In_Progress), expected (qa-engineer, PASS) — commit the release gate's (qa-engineer, PASS) write to main first`, `exit=60`; `gh auth status` succeeded (pre-2); before/after `git status --porcelain` + `release/*` branch list `unchanged`; scratch work dir empty.
- (b) `CHANGELOG.md` line 17 `## [Unreleased]` above line 19 `## [4.19.0] - 2026-11-04`; `unreleasedEntry` is `null` (the runner would stop `CHANGELOG_ENTRY_MISSING` until the coordinator writes it; data, not a finding).
- (c) `checkPreMarks` -> `[]`.
- (d) `deriveVersion('4.19.0','patch')` -> `4.19.1`; commit summary line `chore(release): v4.19.1 — release-cd-v4.19.1 (E395, E403, E404, E407)`.
- (e) `release/v4.19.1` absent locally and on origin (both empty).
- (f) Range spec list `["specs/e395-claude-md-template-tail.md","specs/e403-lean-dispatch-alias.md"]`; `with-spec MULTI-FEATURE pass`, `spec-absent MULTI-FEATURE SPEC_UNCLASSIFIABLE`, `spec-not-in-range MULTI-FEATURE SPEC_REQUIRE` (data; the spec must reach `main` in the coordinator's docs PR).

### AC9 (T-RELCD1-06) PASS
- `v4.19.0` tag object `f5f1694…` -> commit `a227516…`; ancestor of HEAD.
- `CHANGELOG.md` line 19 `## [4.19.0] - 2026-11-04`.
- `schema dist/schema .github/workflows/release.yml scripts/release.mjs` unchanged since `v4.19.0` (`unchanged=0`).
- `switchRole("release-engineer")` -> `string true true`.
- Local, under the test lock: `e35-pipeline-order`, `error-code-contract`, `e394-release-sop`, `e405-release-docs`, `e405-release-workflow` -> `tests 79, pass 79, fail 0`.
- CLAUDE.md baseline (not findings), each correct today: `thirteen tw_* tools` (l43), `18-step` (l48, l62), `12 registered role prompts` (l7), `Twelve prompts` (l33), `15 ordered fragments` (l5), `7 fragments` (l128), `12 model-pinned` (l132), `~300 lines` (l24, l59); `index.ts` is 311 lines.

### AC10
Post-PASS read-back (`tw_get_state`, on-disk tuple, post-PASS `start --dry-run` exit 70) is reported in QA's final reply; it post-dates this evidence.

## Verdict
PASS — AC1 through AC9 hold. No findings. Out-of-scope items (E408, E406, optional lane findings, moderate/low advisories) untouched.
## 2026-11-04T10:46:06.615Z — PASS — by qa-engineer

suite-result: 288/288 passed (server-recorded from qa_suite_result; command: node scripts/test-lock.mjs -- node --test (13 AC3 files; CI runs hold full suite))

Release gate v4.19.1 (PATCH; E395, E403, E404, E407) on main def4ca0 against current 4.19.0: AC1-AC9 all hold, no findings. AC1: 30 commits, 38 files (1470+/202-), 3 first-parent merges, classified 13+11+8+6, untouched set empty, 0 .ts. AC2: both lane handoffs PASS hop 4, ledgers 8/7 all [x], QA covers + suite 4012/4014 and 4014/4016, reviews APPROVED round 1, 4 pre-marks, queue 210/219/220/222 DONE, 223 open, ancestry and same-tree OK. AC3: six CI runs success on Node 20+22 (adf6983, e192cd8, b8dc2ea, fab75ec x2, def4ca0); local 13 files under the test lock 288/288. AC4: dist unchanged, check-version OK 4.19.0, bookkeeping bk=0, md-tables md=0, agc check OK 4.19.0, transitions-sync OK, deps unchanged, npm audit high exit 0 (1 low, 6 moderate). AC5: registries 35/18/13/12, schema versions as v4.19.0, build + golden capture leave tree unchanged, one golden differs 5/13, context-budget unchanged, numstat and bytes as specified, 11 Layout rows, 233 test files. AC6: composed coordinator/qa/lite/integrator prompts carry new wording, old gone, four citations resolve. AC7: template 13 lines four-paragraph body, SOP unchanged 14690 bytes. AC8: dry run exit 60 PRECONDITION_NOT_PASS naming (qa-engineer, In_Progress), nothing mutated; [Unreleased] heading present, entry null; premarks []; 4.19.1 and summary line correct; no release/v4.19.1; spec check MULTI-FEATURE pass / SPEC_UNCLASSIFIABLE / SPEC_REQUIRE. AC9: v4.19.0 tag f5f1694 -> a227516 ancestor, schema/release.yml/release.mjs unchanged, release-engineer SOP loads, 79/79 governance+release tests. Evidence: qa_reports/review_T-RELCD1-01.md (covers all six).

