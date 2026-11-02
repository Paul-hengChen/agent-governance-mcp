# QA review — release-prompt-audit-w1 (v4.16.1 evidence-only release gate)

covers: T-RELPA1-01, T-RELPA1-02, T-RELPA1-03, T-RELPA1-04, T-RELPA1-05

Verified on committed `main` @ `8a79731` (PR #60 merge), local Node v22.22.3, against CURRENT version 4.16.0. Working tree carried only expected uncommitted bookkeeping (`.current/_primary/{dispatch.jsonl,handoff.md,tasks.md}`, `specs/release-prompt-audit-w1.md`, this report) plus the untracked, out-of-release `docs/agc-ticket-draft-wc32.md` (left alone). No code, test, package, CHANGELOG, CLAUDE.md or stamp edits. Phase 0.5 skipped (no expected-red manifest for this feature). Phase 1.5 skipped (no Visual Baselines). Phase 3 skipped (evidence-only gate; dispatch brief: no test file created or edited). Known drift T-REL4-02 ignored per standing instruction; no tw_sync.

## AC Execution Log

### AC1 (T-RELPA1-01)
- commits since v4.16.0 -> 24; changed paths -> 47. PASS
- first-parent merges: exactly `8a79731` #60, `664e147` #59, `d519a45` #58, `673bab9` #57. PASS
- `git diff --name-only 34bd318^1 34bd318 | grep -v '^\.current/'` -> 34. PASS
- merge file sets: 673bab9 = the three `.current/_primary/*`; d519a45 = `docs/backlog.md`, `docs/prompt-audit-2026-11-02.md`; 664e147 = `specs/fanout-e391-prompt-audit.md`. 34bd318..e6007b1 = five `.current/history/2026-11/e391/*`, `docs/backlog.md`, `docs/v4.0.0-new-tickets.md`, `specs/fanout-e391-prompt-audit.md`, `tasks.md`. PASS
- untouched-set diff -> empty. content -> 9. test -> 14. `docs/agc-ticket-draft-wc32.md` tracked=1 (untracked). Full 47-path list matches the two classes (34 e391 + 13 bookkeeping). PASS

### AC2 (T-RELPA1-01)
- e391 lane handoff: `active_feature "e391-prompt-audit-stale-facts"`, `status "PASS"`, `last_agent "qa-engineer"`, `hop_count 4`. Ledger `x=7 void=1 open=0`; void = `T-E391-03 [P1]`. PASS
- `qa_reports/review_T-E391-0{1,2,4,5,6,7,8}.md` (7 files), each `pass=1 fail=0`; `review_T-E391-01.md` covers `T-E391-01, 02, 04, 05, 06, 07, 08`. PASS
- `review_reports/review_T-E391-01.md`: `covers: T-E391-01, T-E391-02, T-E391-08, T-E391-04`, `## Round 1 — APPROVED`. `qa_reports/expected-red_e391-prompt-audit-stale-facts.txt` exists. PASS
- Backlog E391 DONE naming `34bd318` (count 1); E392–E396 each `0 1` (present, none DONE/VOID). Queue: only `#206` carries DONE; #207–#211 are E393, E392, E394, E395, E396 open. PASS
- Ancestry: no NOT line; second parents 21ba57d, aa4626f, f6f2bfc, 5b27a16, e6007b1; `34bd318^1` = 664e147. PASS

### AC3 (T-RELPA1-02)
- `node scripts/test-lock.mjs -- npm test`, Node v22.22.3 -> exit 0; tests 3853, pass 3851, fail 0, skipped 2 (equals the lane's 3851/3853). First run green: no rerun, no flake-family recurrence data. PASS

### AC4 (T-RELPA1-02)
- `npm run build` exit 0; `git status --porcelain dist/` empty. PASS
- `node scripts/check-version.mjs` -> `OK (4.16.0)` exit 0 (advisory note: HEAD past tag, expected). PASS
- `npm run check:bookkeeping` -> `OK (440 ticket row(s), 228 queue row(s), 348 decision row(s) checked)`, exit 0. `npm run check:md-tables` -> `OK (683 file(s) scanned, 0 malformed tables)`, exit 0. PASS

### AC5 (T-RELPA1-02)
- `git diff --stat v4.16.0..HEAD -- package.json package-lock.json docs/dependency-advisories.md` -> empty. PASS
- `npm audit --audit-level=high` exit 0; `7 vulnerabilities (1 low, 6 moderate)`; no HIGH/CRITICAL. PASS
- `npm ls`: `zod@4.6.7`, `body-parser@2.4.0`; no invalid/UNMET/extraneous. PASS

### AC6 (T-RELPA1-02)
- `node bin/agc-init.mjs check` -> `agc check — OK (4.16.0) — all adapters current`, exit 0. CLAUDE.md diff touching stamp/adapter/Execution Profile lines -> 0. `check-transitions-sync` -> OK (21 keys), exit 0. PASS

### AC7 (T-RELPA1-02)
- HEAD = `8a79731957b0…`. Eight runs, all `success`, each `test (20)=success test (22)=success`: 41399853156 (8a79731 main push), 41398315097 (e6007b1 push), 41398711856 (e6007b1 pull_request), 41397788105 (34bd318), 41397320316 (5b27a16), 41013668505 (673bab9), 41385127955 (d519a45), 41386385368 (664e147). PASS

### AC8 (T-RELPA1-03)
- (a) no diff in scripts/fanout tools (0); 31 `specs/fanout-*.md`; only `fanout-wave5.1.md` and `fanout-wave6.md` non-zero (exit 2, `DECISIONS_SECTION_ABSENT` + `PINS_SECTION_ABSENT`); e391 manifest `fanout: ok — 1 dispatchable lane(s), 0 provisional, 11 decision(s)`, exit 0. PASS
- (b) owners exit 1; `fanout owners: 47 path(s), 34 hit(s), 1 dispatchable lane(s)`; `34 (e391:`; multi-lane hits 0; the 13 non-HIT paths are exactly the 13 bookkeeping paths. PASS
- (c) handoff --closing exit 0; `## 接手步驟` with `### 核對 primary`, `### 已結案`, `### 待人類決定`, `### 進行中的背景工作`. PASS
- (d) handoff --check: `5 fact(s) checked, 2 differ, 2 moved`, exit 1. MOVED: target branch, worktree. DIFF: `git status` (this feature's own uncommitted `tasks.md`, `specs/release-prompt-audit-w1.md`, plus the untracked draft) and `lane-status` (new active_feature) — both only the permitted causes. PASS
- (e) usage lines = 5; no-subcommand exit 2. `git status --porcelain` unchanged across runs; no stack traces. PASS
- (f) 23 fanout/lane tests: tests 251, pass 251, fail 0. PASS

### AC9 (T-RELPA1-03)
- Probe -> `35 18 13 12 {"handoff":15,"tasks":2,"sqlite":2,"config":2}`. `const HOP_CAP = 14;` at tools/transitions.ts:326. `git diff --stat v4.16.0..HEAD -- tools gates schema bin scripts dist` -> empty. `agc --help` diff vs v4.16.0 -> `help-same`. PASS
- pipeline-order / error-code / qa-flow / hop-count / dispatch-pins / gate-hardening tests: tests 256, pass 256, fail 0. PASS

### AC10 (T-RELPA1-04)
- SOP probe output exactly: `old design-auditor old-literal=1 fix_try-cap=0 read-cap=0`; `old qa-engineer install-form=0 bare=4`; `new design-auditor old-literal=0 fix_try-cap=1 read-cap=1`; `new qa-engineer install-form=4 bare=0`. PASS
- Limits table: `| \`fix_try\` cap | 2 |` (line 17), `| \`read\` cap | 3 |` (line 18); `const-01-core-head.md` diff since v4.16.0 empty. PASS
- `grep -c 'agc install>\` = agc' content/skill-qa-engineer.md` -> 1. skill-qa-visual refs to `<agc install>/content/skill-qa-engineer.md`: v4.16.0 = 0, HEAD = 2. PASS
- qa-visual-skill-split, e391-prompt-audit-stale-facts, skill-frontmatter: tests 35, pass 35, fail 0. PASS

### AC11 (T-RELPA1-04)
- v4.16.0 CLAUDE.md contains the 3 old literals (count 3); HEAD 0. PASS
- New text present at lines 163 (`suite-result:` pointer), 184 and 187 (git bullet), 198 (hook size, unescaped pipe). PASS
- Layout rows present: lines 88 `tools/lane-paths.ts`, 89 `tools/lane-status.ts`, 90 `tools/fanout-*.ts`, 103 `lib/render-boundary.ts`. numstat `12 5`. PASS
- (e) Baseline for release-engineer, not a finding: `grep -n -E '[0-9]+ test files|...'` returns exactly the two `221 test files` lines (126 Layout `test/` row, 158 Testing section). `git ls-tree` top-level `test/*.test.mjs`: HEAD 222, v4.16.0 221. Stale by 1; human ruling (a): release-engineer corrects at release time. PASS (recorded)

### AC12 (T-RELPA1-05)
- (a) content numstat exactly: 2/2 const-08, 1/1 const-15, 5/5 constitution-rationale, 2/2 skill-coordinator-lite, 2/2 skill-design-auditor, 1/1 skill-doc-writer, 4/4 skill-qa-engineer, 2/2 skill-qa-visual, 1/1 skill-release-engineer. PASS
- (b) 11 goldens: six files at 3/3 (build-full x4, constitution-monolith, hook-full) + five at 1/1 (build-lite x4, hook-lite) = 23/23. Added-line classes: `6 Cut-Approval Gate`, `6 Manifest tier`, `11 Stop conditions: \`skill-coordinator\` §Escalation Routes`; no other. PASS
- (c) compose-equivalence `1 1`, non-comment changed lines 0; qa-visual-skill-split `1 1`, the one `+` line is the AC-3 regex containing `(?:<agc install>\/)?content\/skill-qa-visual`; e391 test new `147 0`; no other test file changed (test diff total 14 = 11 goldens + 3). PASS
- (d) context-budget.test.mjs unchanged (AC1 untouched-set) and green: 54/54. Data point from `scripts/measure-context-cost.mjs`: lean bundle 5722 ~tok vs cap 5723 (1 token headroom, as at the lane); remaining caps (stripped / teamwork / non-design) are asserted green by the test, exact measured values not re-extracted. PASS
- (e) composition / golden / budget / content-pinning tests (12 files): tests 198, pass 198, fail 0. PASS

### AC13 (T-RELPA1-03)
- `v4.16.0^{commit}` = `62bf4d523e375d4d48e4c9ca22c55ef9f489503f`; is-ancestor exit 0; `## [4.16.0]` at CHANGELOG.md:19; `schema/` and `dist/schema/` diff empty. PASS
- CLAUDE.md counts baseline (each correct today): 35 entries (l50) / 35 gate definitions (l91); thirteen `tw_*` tools (l43); 18-step (l48, l62); 12 registered role prompts (l7) / Twelve prompts (l33); 15 ordered fragments (l5); 7 fragments (l117); other 11 role SOPs (l119); 12 model-pinned (l121); ~300 lines (l24, l59). Filesystem: const 15, coord 7, skill 12, templates/claude-code-agents 12; `index.ts` 311 lines (near 300). PASS
- v4.16.0 lane/governance tests (17 files): tests 313, pass 311, fail 0, skipped 2 (the loud history-dependent e130 skips). Second group (8 files incl. e234-hygiene-scan, agc-adapters): tests 185, pass 185, fail 0. PASS

## Verdict
All of AC1–AC13 hold on `8a79731`. No findings. Baseline noted for release-engineer: CLAUDE.md `221 test files` x2 vs 222 tracked (ruling (a)). Worktree status after all runs: only the expected bookkeeping/untracked files; `dist/` clean after rebuild.
## 2026-11-02T07:08:38.048Z — PASS — by qa-engineer

suite-result: 3851/3853 passed (server-recorded from qa_suite_result; command: node scripts/test-lock.mjs -- npm test)

All of AC1-AC13 hold on main 8a79731 (Node 22.22.3, current version 4.16.0). Full suite 3851/3853 (2 skipped, same as lane), build clean with dist zero diff, check-version/bookkeeping/md-tables/agc check/transitions-sync green, npm audit high exit 0 (1 low, 6 moderate), eight CI runs success on Node 20+22, 47-path diff classified 34 e391 + 13 bookkeeping with untouched set empty, text-only claim holds (registries 35/18/13/12, schema versions, HOP_CAP 14, agc --help identical), AC10 old-vs-new probe matched exactly, AC11 literals old-vs-new confirmed, AC12 numstat and golden string classes exact. Baseline for release-engineer: CLAUDE.md '221 test files' x2 (lines 126, 158) vs 222 tracked at HEAD; per human ruling (a) release-engineer corrects at release time. Evidence: qa_reports/review_T-RELPA1-01.md (covers all five).

