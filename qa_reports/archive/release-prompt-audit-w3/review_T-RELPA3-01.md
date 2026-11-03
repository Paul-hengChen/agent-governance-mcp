covers: T-RELPA3-01, T-RELPA3-02, T-RELPA3-03, T-RELPA3-04, T-RELPA3-05, T-RELPA3-06

# QA review — release-prompt-audit-w3 (evidence-only gate for v4.18.0)

Verified against the CURRENT version 4.17.0 at `main` = `origin/main` = `463f81a`. Node 22 local; Node 20 verdict is the CI record (AC7). Role: qa-engineer (sonnet), Task-dispatched. No code, test, content, template or CLAUDE.md edit was made; no test file created.

- Phase 0.5: skipped (no expected-red manifest declared for this feature)
- Phase 1 / 3a / 3b: Copy and Visual Tokens H2 are N/A in the spec (evidence-only feature); no user-facing strings or literals introduced.
- Phase 1.5: skipped (no Visual Baselines declared)
- Phase 3: skipped (evidence-only; dispatch brief: no new or edited test files authorized)

## Ruling observations (recorded where the AC observes the fact)
- Ruling 1 (a): `CLAUDE.md` lines 126 and 158 say `223 test files`; actual top-level `test/*.test.mjs` = 226 (223 at v4.17.0). AC14 baseline recorded as observed; release-engineer corrects the count inside the release commit.
- Ruling 2 (A): `docs/agc-ticket-draft-wc32.md` is now ignored via the local `.git/info/exclude`. AC15 (a) observed the post-ruling state (below). The file was not touched, staged, moved or deleted, and `.git/info/exclude` was not edited by QA.

## AC Execution Log

Working-tree state before and after every probe group: `git status --porcelain` = 3 modified `.current/_primary/{dispatch.jsonl,handoff.md,tasks.md}` + 1 untracked `specs/release-prompt-audit-w3.md` (this feature's own bookkeeping), unchanged.

### AC1 (T-RELPA3-01) PASS
- `git log --oneline v4.17.0..HEAD | wc -l` = 64; `git diff --shortstat v4.17.0..HEAD` = `82 files changed, 6286 insertions(+), 1882 deletions(-)`.
- First-parent merges: `463f81a 89e01c6 e51bf3b` (#68), `89e01c6 2f0f358 d80ff1d` (#67), `2f0f358 5181e75 dda41ef` (#66). Merges in `89e01c6..e51bf3b`: `8519793 0b60c40 6cad3c2`, `9a120cd 657b3d5 f0d1a23`, `657b3d5 89e01c6 62f9db7`. All as expected.
- `657b3d5 all=36 lane=32`, `9a120cd all=40 lane=36`; shared path between lanes = only `test/feature-lease.test.mjs`; fence-fix merge diff = only `.current/e392/pending-tickets.md`; #66 = three `.current/_primary/*` files; #67 = `specs/fanout-e392-e394.md`; `9a120cd..0b60c40` and `8519793..e51bf3b` lists as expected.
- Classification computed: lane paths 67 (union of the two lane merges excluding `.current/`) + bookkeeping 15 = 82; union equals `git diff --name-only v4.17.0..HEAD` exactly; lane and bookkeeping sets are disjoint; no path outside the classes.
- Untouched set (gates schema prompts bin guards transport lib .github index.ts package*.json tsconfig* config, README, CHANGELOG, AGENTS.md, .antigravityrules, CONTRIBUTING, docs/install|config|schema-versions|lane-protocol*|dependency-advisories, transitions.ts, verify-release/check-version/check-bookkeeping scripts) diff = 0 lines.
- Per-area counts: content 3, test 17, templates 3, tools 2, scripts 1, dist 8, specs 5. `git ls-files --error-unmatch docs/agc-ticket-draft-wc32.md` -> `tracked=1` (untracked).

### AC2 (T-RELPA3-01) PASS
- e392 handoff: `e392-subagent-templates`, PASS, qa-engineer, hop_count 4, qa_rounds_total 0; ledger `x=8 void=0 open=0`.
- e394 handoff: `e394-release-sop-rewrite`, PASS, qa-engineer, hop_count 8, qa_rounds_total 1; ledger `x=16 void=0 open=0`.
- 24 `qa_reports/review_T-E39{2,4}-*.md`: every last verdict PASS; only `review_T-E394-02.md` has a FAIL block (line 5 FAIL, line 17 PASS).
- `covers:` lines and `suite-result: 3869/3871` (e392) and `3944/3946` (e394) present once each. `review_reports/review_T-E392-01.md`: covers T-E392-01..04, `- Verdict: APPROVED`; `review_reports/review_T-E394-02.md`: Round 1 (covers T-E394-02..10) and Round 2 (covers T-E394-02), both APPROVED. Both expected-red files exist; the e394 one has 0 entries.
- Backlog: E280, E392, E394 each carry the `DONE — merged to integ/e392-e394 2026-11-03, not yet released` mark (1 each); E395–E405 each 1 row, 0 DONE/VOID. Queue: #101, #208, #209 `✅ DONE`; #214–#220 not DONE.
- Ancestry: no `NOT` line for the nine shas; second parents `5181e75/dda41ef`, `2f0f358/d80ff1d`, `89e01c6/62f9db7`, `657b3d5/f0d1a23`, `0b60c40/6cad3c2`, `89e01c6/e51bf3b`; `463f81a^1` = `657b3d5^1` = `89e01c6`.

### AC3 (T-RELPA3-02) PASS
- `node scripts/test-lock.mjs -- npm test` on Node v22.22.3: exit 0. Tally: tests 3958, pass 3956, fail 0, cancelled 0, skipped 2 (the 2 pre-existing skips). No load-sensitive rerun was needed; the three new tests, hygiene, context-budget and compose-golden tests are all inside this green run. Because every `test/*.test.mjs` ran in it, the targeted `node --test` file lists named under AC8 (f), AC9, AC10 (c), AC11 (e), AC12 (g), AC13 (e) and AC14 were covered by this single full run rather than re-run separately.

### AC4 (T-RELPA3-02) PASS
- `npm run build` exit 0; `git status --porcelain dist/` empty (committed dist byte-identical to a fresh build). `git diff --name-only v4.17.0..HEAD -- dist` = the eight `dist/tools/{registry,role}.{d.ts,d.ts.map,js,js.map}`.
- `node scripts/check-version.mjs`: `check:version — OK (4.17.0)`, exit 0 (advisory note that HEAD is past the tag, expected).
- `check:bookkeeping — OK (449 ticket row(s), 237 queue row(s), 376 decision row(s) checked)`; `check:md-tables — OK (701 file(s) scanned, 0 malformed tables)`.

### AC5 (T-RELPA3-02) PASS
- `git diff --stat v4.17.0..HEAD -- package.json package-lock.json docs/dependency-advisories.md` empty. `npm audit --audit-level=high` exit 0; 7 vulnerabilities (1 low, 6 moderate), no HIGH/CRITICAL. `npm ls`: `zod@4.6.7`, `body-parser@2.4.0`, no invalid/UNMET/extraneous.

### AC6 (T-RELPA3-02) PASS
- `node bin/agc-init.mjs check`: `agc check — OK (4.17.0) — all adapters current`, exit 0. numstat `1 1` for `CLAUDE.md` and `templates/agent-adapters/claude.md`; CLAUDE.md hunk is exactly `@@ -233 +233 @@`, adapter hunk `@@ -12 +12 @@`; `agc-version` changed lines = 0. `check-transitions-sync`: `OK (21 keys, exact match ...)`, exit 0.

### AC7 (T-RELPA3-02) PASS
- `git rev-parse HEAD` = `463f81a…`. All nine runs `success` with `test (20)=success` and `test (22)=success`: `463f81a` main push; `e51bf3b` push and pull_request (integ/e392-e394); `9a120cd` push; `62f9db7`, `6cad3c2` (feat/e392-subagent-templates) and `f0d1a23` (feat/e394-release-sop-rewrite) pushes; `2f0f358` and `89e01c6` main pushes. `gh` authenticated.

### AC8 (T-RELPA3-03) PASS
- (a) fanout files changed since v4.17.0: 0; `specs/fanout-*.md` = 33; validate non-zero only for `fanout-wave5.1.md` and `fanout-wave6.md`, each exit 2 with exactly `DECISIONS_SECTION_ABSENT` + `PINS_SECTION_ABSENT`; `fanout-e392-e394.md`: `fanout: ok — 2 dispatchable lane(s), 0 provisional, 15 decision(s)`, exit 0.
- (b) `owners --range v4.17.0...HEAD`: exit 1, `fanout owners: 82 path(s), 67 hit(s), 2 dispatchable lane(s)`; exactly one multi-lane HIT, `test/feature-lease.test.mjs (e392 … e394)`; the 15 non-HIT paths equal the 15 Bookkeeping paths (set difference empty).
- (c) `handoff --closing` exit 0, `## 接手步驟` with the four `###` items (核對 primary, 已結案, 待人類決定, 進行中的背景工作); the 結案 section has one 例外 bullet (refused first finish of e392, fence fix `6cad3c2`, merge `8519793`).
- (d) `handoff --check`: `5 fact(s) checked, 2 differ, 2 moved`, exit 1. MOVED: target branch, worktree. DIFF lines name only `git status` and `lane-status`, explained by this feature's own uncommitted bookkeeping and the new `active_feature` (the git-status DIFF's handoff side still shows the draft file as untracked because the recorded view predates Ruling 2).
- (e) usage: 5 lines starting `       node scripts/fanout.mjs`, exit 2. `git status --porcelain` unchanged across the run; no stack trace in the output.
- (f) covered by the full-suite green run (AC3).

### AC9 (T-RELPA3-03) PASS
- Registries: `35 18 13 12 {"handoff":15,"tasks":2,"sqlite":2,"config":2}`; `const HOP_CAP = 14` at `tools/transitions.ts:326`.
- `git diff --numstat v4.17.0..HEAD -- tools scripts`: `1104 0 scripts/release.mjs`, `2 2 tools/registry.ts`, `2 0 tools/role.ts`. Changed lines are exactly the two `tw_switch_role` enums gaining `"coordinator"` last, one comment line and `"coordinator": "skill-coordinator.md"`. No diff in transitions/gates/schema/prompts/bin/guards/transport/lib/index.ts (0 lines). `agc --help` identical to v4.17.0's (`help-same`). Routing/gate-order/round-cap/error-code tests are in the green full run.

### AC10 (T-RELPA3-04) PASS
Coordinator probe (bash, old = v4.17.0 dist/content extracted to a scratch dir under the OS temp dir, removed afterwards; no leftovers) printed exactly:
- `old enum-size=9 enum-coordinator=false tool-call=rejected ZodError no-host=throws TypeError claude-code=throws TypeError`
- `old release-engineer model=opus sop-over-15000=true release.mjs=false exit-rows=0 history-pointer=false`
- `new enum-size=10 enum-coordinator=true tool-call=ok no-host=sop(model=sonnet,subagent-dispatch=false) claude-code=sop(model=sonnet,subagent-dispatch=true)`
- `new release-engineer model=opus sop-over-15000=false release.mjs=true exit-rows=31 history-pointer=true`
Template greps: `NOT via tw_switch_role` 1 (v4.17.0) / 0 (HEAD); `tw_switch_role("coordinator")` 1; `model: sonnet`; 12 templates. Pinning tests in the green full run.

### AC11 (T-RELPA3-04) PASS
- coord-02 alias sentence 1 (0 at v4.17.0); hunks `@@ -1 +1 @@` and `@@ -5 +5 @@`. `claude.md:12` and `CLAUDE.md:233` byte-identical (`adapter-same`), the new sentence occurs once in each, `§3 builder != judge` anchor kept.
- `@release-engineer` in coord-04: 0 (1 at v4.17.0); `@lite` and `@doc-writer` remain. Release-engineer template `(haiku)`: 0 (1 at v4.17.0); `RELAY REQUIRED` 1; `model: opus`.
- Golden numstat: only `2 2 …/skill-coordinator-monolith.txt`; `test/context-budget.test.mjs` unchanged. Budget probe printed exactly `old teamwork-bundle=21479 headroom=236` and `new teamwork-bundle=21515 headroom=200` (ceiling 21715).

### AC12 (T-RELPA3-05) PASS
- SOP bytes 14434 (v4.17.0: 98836); probe lines above (31 exit rows, history pointer, release.mjs named, model opus). `exit-table-same` (31 SOP rows equal `EXIT_CLASSES`, code and id). `specs/release-sop-history.md`: `Source: content/skill-release-engineer.md`, `Base commit: 89e01c6`, 16 `## ` sections. `"release"` in package.json: 0; the three absorbed scripts unchanged (AC1 untouched set).
- `--help`: exit 0, four usage lines (prepare, publish, close-out, --help). No phase: exit 2, `RELEASE_STOP USAGE: unknown or missing phase null — expected prepare, publish or close-out`.
- Dry-run probe on `main` (dry-run only; no real phase run; synthetic `--state` JSON under the OS temp dir; no `release/*` branch created): `prepare exit=10` `RELEASE_STOP WRONG_BRANCH: on main at 463f81a…, expected release/v4.18.0`; `publish exit=42` `RELEASE_STOP PR_CANNOT_MERGE: no open or merged pull request for release/v4.18.0`; `close-out exit=50` `RELEASE_STOP CLOSING_WRITE_ABSENT: .current/_primary/handoff.md lacks the closing write: …` and naming `want "Released v4.18.0"` (confirmed on a second dry-run); lane `_primary` count 1; `status-unchanged`; `local-release-branches=0 origin-release-v4.18.0=0`. The probe changed nothing. (QA's own checkpoint write to the handoff happened before the probe; the probe itself left `git status` identical.)
- (g) covered by the green full run.

### AC13 (T-RELPA3-06) PASS
- `git diff --numstat v4.17.0..HEAD -- content test` equals the spec's rows exactly: content `1 1 coord-02`, `1 1 coord-04`, `90 274 skill-release-engineer`; 17 test paths (13 edited, 3 added: `e392-subagent-templates`, `e394-release-script`, `e394-release-sop`, plus the golden `2 2`) with the stated numstats; const-* changes 0; golden only `skill-coordinator-monolith.txt`.
- `ls test/*.test.mjs | wc -l` = 226; v4.17.0 tree = 223.
- (d) Re-pin trace: all 13 edited tests appear in the e394 spec's Test Re-pin Map and in `qa_reports/review_T-E394-01.md` (T1: "13 test files, every one in the Test Re-pin Map / owned set"); `verify-release.test.mjs` per the map re-pinned VR-9/VR-10 only and its test count is 63 at both v4.17.0 and HEAD; `release-staging.test.mjs` net loss is the SOP prose moved to `scripts/release.mjs` (pinned by the new `e394-release-script` test) or `specs/release-sop-history.md`, as the map states. I did not re-derive every removed assertion line by line; I traced at the file/map level and via T-E394-01's evidence and found nothing untraceable.
- (e) composition/golden/budget/content-pinning tests are in the green full run.

### AC14 (T-RELPA3-03) PASS
- `v4.17.0^{commit}` = `5181e75ff41e…`; `merge-base --is-ancestor` exit 0; `## [4.17.0] - 2026-11-03` at CHANGELOG line 19; `schema/` and `dist/schema/` diff 0 lines.
- Builder ≠ judge composition: four lines, each `1 # Constitution v3.41.0`.
- CLAUDE.md count baseline (observed; correct today): `15 ordered fragments`, `12 registered role prompts`, `Twelve prompts`, `thirteen tw_* tools`, `18-step`, `35 entries`, `35 gate definitions`, `7 fragments`, `other 11 role SOPs`, `12 model-pinned`, `~300 lines`. File counts: const 15, coord 7, skill 12, templates 12, `index.ts` 311 lines.
- Stale literal (baseline for release-engineer, not a QA finding; E395 open): `223 test files` at CLAUDE.md lines 126 and 158; actual 226 at HEAD (223 at v4.17.0). Ruling 1 (a): release-engineer fixes it in the release commit.
- Governance-core tests are in the green full run.

### AC15 (T-RELPA3-05) PASS (state recorded; matches the post-ruling alternative in (a))
- (a) `git add -n -- docs/` lists nothing; `git check-ignore -q docs/agc-ticket-draft-wc32.md` -> `ignored=0`; the file is present; `git ls-files --error-unmatch` -> `tracked=1` (still untracked). This is the Ruling 2 (A) state, not the cut-time state. Script-function probe (unchanged by the ruling since it passes synthetic lists): `scope null`, `plan docs/ docs/backlog.md`, `unstaged ["untracked file(s) never staged: docs/agc-ticket-draft-wc32.md"]`. Note for release-engineer: with the exclude in place, real `git add -- docs/` skips the file and the completeness check sees no untracked draft, so `prepare` should not stage it nor stop STAGING_INCOMPLETE; this relies on the local exclude line surviving until `prepare` runs.
- (b) Range spec list: `specs/e392-subagent-templates.md`, `specs/e394-release-sop-rewrite.md`, `specs/release-sop-history.md`; `with-spec MULTI-FEATURE pass`, `without-spec MULTI-FEATURE SPEC_REQUIRE`. `specs/release-prompt-audit-w3.md` must be in the release commit (it is untracked now; `prepare` stages it via `specs/`).
- (c) `close-out` resolves lane `_primary` (AC12 (f)); the `--state` copy and closing write are `.current/_primary/handoff.md`.

## Findings
- No failing AC. No defect found in `scripts/release.mjs` or the content.
- Environment: `gh` authenticated; Node 22.22.3 local.

## Notes for release-engineer (CHANGELOG)
- Upgrade notes per the spec Dependencies list, all verified: `tw_switch_role` accepts `coordinator` (old server rejects it with a validation error, so update the server before re-copying the `teamwork` template); `Task(...)` alias defined in coord-02 and the adapter line; release-engineer leaves the haiku tier; release SOP rewrite 98,836 -> 14,434 bytes with `scripts/release.mjs` (31 exit classes, each with an Escalation Routes row), history moved to `specs/release-sop-history.md`.
- Code changed: two `tools/` files, eight `dist/tools/{role,registry}.*` files, one new script; no gate/schema/error-code/routing/dependency/`prompts/`/`bin/` change; teamwork bundle 21479 -> 21515 ~tok under 21715; 226 top-level test files.
- Release-engineer must fix `CLAUDE.md` `223 test files` (lines 126 and 158) to the count at the release commit (Ruling 1 (a)); the `agc-version` stamp lines for 4.18.0.
- Any CHANGELOG-cited path must be in the release diff or carry `(context, not changed)` (exit 31).
## 2026-11-03T11:08:22.844Z — PASS — by qa-engineer

suite-result: 3956/3958 passed (server-recorded from qa_suite_result; command: node scripts/test-lock.mjs -- npm test)

AC1-AC15 all hold against 4.17.0 at main=origin/main=463f81a. Full suite under test lock, Node 22.22.3: 3958 tests, 3956 pass, 0 fail, 2 skipped (pre-existing), exit 0. 82-path classification exact (67 lane + 15 bookkeeping, untouched set empty); lane evidence and ancestry as specified; fresh build == committed dist (8 dist/tools files changed); check-version 4.17.0, bookkeeping 449/237/376, md-tables 701 OK; audit exit 0 (1 low, 6 moderate); agc check OK; 9 CI runs success on Node 20+22. AC10/AC11 old-vs-new probes printed exactly the expected lines (enum 9->10, coordinator loads in both host settings, release-engineer SOP 14434 bytes with 31 exit rows == EXIT_CLASSES, budget 21479->21515 under 21715); temp dirs cleaned. AC12 dry-run on main: prepare exit 10 WRONG_BRANCH, publish exit 42 PR_CANNOT_MERGE, close-out exit 50 CLOSING_WRITE_ABSENT; status unchanged, no release/* branch local or on origin; no real release.mjs phase run. Human rulings observed: (1a) CLAUDE.md says 223 test files at lines 126 and 158, actual 226 -> release-engineer fixes in the release commit; (2A) draft file now ignored (check-ignore exit 0, git add -n -- docs/ lists nothing, file present and untracked, not touched); AC15 (b) spec check: with-spec pass, without-spec SPEC_REQUIRE, so specs/release-prompt-audit-w3.md must be in the release commit. Report: qa_reports/review_T-RELPA3-01.md (covers all six).

