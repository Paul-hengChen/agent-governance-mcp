covers: T-RELCD4-01, T-RELCD4-02, T-RELCD4-03, T-RELCD4-04, T-RELCD4-05, T-RELCD4-06

# QA review — release-cd-v4.19.4 (T-RELCD4-01..06)

Evidence-only release gate for v4.19.4 PATCH (tickets E415, E416). Verified on `main` @ 57f3196 (= origin/main), against v4.19.3 (tag object bc135a2, commit 00d18f7). QA tier: sonnet. No file created or edited besides this review; no commit, push, branch, CHANGELOG edit, ticket filed, or non-dry-run release phase.

Phase 0.5: skipped (no expected-red manifest declared for `release-cd-v4.19.4`; the two lane manifests belong to e415/e416 and are checked as data in AC2).
Phase 1.5: skipped (no Visual Baselines declared). Spec Copy / Strings and Visual Tokens: n/a (evidence-only gate).
Phase 3: skipped (no test file expected or created; task touches no files).

## AC Execution Log

### AC1 (T-RELCD4-01) — PASS
- `git log --oneline v4.19.3..HEAD | wc -l` = 35; `--no-merges` = 28; `git diff --shortstat` = `27 files changed, 572 insertions(+), 21 deletions(-)`.
- First-parent merges exactly: `57f3196 720e1ea 3156d7d` #99, `720e1ea 9bdadae baf159e` #98, `9bdadae 2f88f14 9a8daf5` #97, `2f88f14 7b5b0a9 4480b2c` #96, `7b5b0a9 00d18f7 ff58be4` #95. Other merges exactly `d0087df 720e1ea 6185fca` and `4efc6a7 2f88f14 9b8a61a`.
- Lane merges: `4efc6a7 all=11 lane=8`, `d0087df all=14 lane=11`; shared paths = `content/coord-03-core-fallback.md`, `test/fixtures/compose-golden/skill-coordinator-monolith.txt`; `union=17`.
- Bookkeeping merges: 7b5b0a9 -> `.current/_primary/{handoff.md,metrics.jsonl}`; 2f88f14 and 720e1ea -> `docs/backlog.md`. Lane-close deltas (4efc6a7..9a8daf5, d0087df..3156d7d) = three `.current/history/2026-11/<lane>/*` + `docs/backlog.md` + `tasks.md` each.
- Untouched-set diff count = 0. `content/` diff = coord-03, skill-code-reviewer, skill-integrator only. Per-class counts `8 1 3 2 7 3 0 1 0 2 0 0 0 0 0 0` (matches expected). The 27 paths enumerate exactly into the five classes (6+9+2+6+4); no stray path.

### AC2 (T-RELCD4-01) — PASS
- e415 handoff: `e415-coord03-release-wording`, PASS, qa-engineer, hop 8, qa_rounds 0, review_rounds 0; ledger x=4 void=0 open=0. e416: `e416-ticket-filing-bar`, PASS, qa-engineer, hop 6, 0, 1; x=2 void=0 open=0.
- Five QA review files each `secs=1 last=PASS fail=0`; suite-result 4051/4053 on the three e415 files, 4059/4061 on the two e416 files; covers lines only on E415-02 (T-E415-01, 02), E415-04 (T-E415-03, 04), E416-01 (T-E416-01, 02).
- Code-review files: E415-01 `## Round 1 — APPROVED`; E415-03 no `## Round` heading, Verdict starts `APPROVED` (format difference, data); E416-01 Round 1 CHANGES_REQUESTED then Round 2 APPROVED.
- Expected-red manifests: `2 2` and `1 1` (all `t-golden-byte-identity`); archived lane evidence 0; `specs/e41[56]-*` 0.
- Backlog rows E415/E416 each: DONE `integ/e41x` 2026-11-06 prefix =1, `not yet released` =1; `docs/v4.0.0-new-tickets.md` E415/E416 hits = 0.
- Ancestry: no `NOT` line; `e416tree=0`, `e415tree=0`.

### AC3 (T-RELCD4-02) — PASS
- 14 CI runs listed in the spec: each `CI <sha> <branch> <event> success` with `test (20)=success,test (22)=success`, sha/branch/event exactly as specified. `gh run list --commit HEAD` = `42212705724 CI success`.
- Local 25 test files: `node scripts/test-lock.mjs -- node --test <25 files>` -> exit 0, `# tests 327  # pass 327  # fail 0` (matches cut-time 327/327). (A first 21-file partial run, 295/295, was a subset and is superseded by this run.)

### AC4 (T-RELCD4-02) — PASS
- `git diff --name-only v4.19.3 HEAD -- dist | wc -l` = 0. `check-version` OK (4.19.3) (note: HEAD past tag, expected).
- `check:bookkeeping` bk=0 (460 ticket / 246 queue / 439 decision rows; non-blocking note: id ordering not checked, no base commit). `check:md-tables` md=0 (740 files, 0 malformed).
- `agc check` agc=0 `OK (4.19.3) — all adapters current`; hygiene advisory recorded: `skipped 37 home-path hit(s) with a placeholder username` (not a finding). Three `agc-version: 4.19.3` stamps (CLAUDE.md:237, AGENTS.md:1, .antigravityrules:1).
- `check-transitions-sync` OK (21 keys). `deps=0` (package.json / package-lock.json unchanged). `audit=0`; `7 vulnerabilities (1 low, 6 moderate)` (no HIGH/CRITICAL). `npm ls zod body-parser` bad-token count 0.

### AC5 (T-RELCD4-03) — PASS
- dist registries: `35 18 13 12 {"handoff":15,"tasks":2,"sqlite":2,"config":2}`; const 15, coord 7, templates 12; only `content/coord-03-core-fallback.md` differs among const/coord/templates.
- `npm run build && capture-constitution-golden` cap=0; `git status --porcelain` after = identical to before (only the 3 `.current/_primary` runtime files + the untracked spec; no dist/golden change). 12 goldens; numstat `5 3` on `skill-coordinator-monolith.txt` only; `46358/45916 334/332`.
- `test/context-budget.test.mjs` and `subagent-templates.test.mjs` no diff (budget=0); caps 5723, 10598, 21715, 8501, 4849 each present (counts 2,2,1,2,1); test passes (AC3 run).
- Budgets measured at HEAD (data): stripped constitution 10451 ~tok (matches cut); teamwork via my reconstruction 21535 (cut-time figure 21526; delta 9 attributable to my approximate strip of the skill body, well under cap 21715; the real test passes); lean: my ad-hoc constitution-only measure 4702 raw / 4578 stripped (not comparable to the cut's 5665, which includes the lite skill; the budget test covering lean passes).
- numstat: CLAUDE.md 3/0, coord-03 5/3, code-reviewer 1/1, integrator 4/4, lane-protocol 3/1. bytes/lines: coord-03 23507/23065 104/102; code-reviewer 10646/10519 97/97; integrator 41612/41229 248/248; lane-protocol 19489/19107 141/139; CLAUDE.md 17481/17242 250/247. test paths changed 2; top-level tests 239 (238 at v4.19.3).

### AC6 (T-RELCD4-04) — PASS
- Composed-prompt probe: `true true false false false true true true true true true` (exact expectation). `grep -c 'release-cd|`Release` workflow' coord-03` = 0.

### AC7 (T-RELCD4-04) — PASS
- integrator greps `2 1 1 0 0`; lane-protocol `1 1 0`; CLAUDE.md bullet `1`, numstat `3 0 CLAUDE.md`; e416 test references the four sites (10 hits >= 4); `test/e416-filing-bar.test.mjs` passes in the AC3 run.

### AC8 (T-RELCD4-05) — PASS
- (a) dry-run: `RELEASE_STOP PRECONDITION_NOT_PASS: .current/_primary/handoff.md is (qa-engineer, In_Progress), expected (qa-engineer, PASS) …`, `exit=60`, `unchanged` (status + release/* branches identical), work dir empty. `gh auth status` OK.
- (b) `17:## [Unreleased]` above `19:## [4.19.3] - 2026-11-06`; `unreleasedEntry` = `null` (recorded; runner would stop `CHANGELOG_ENTRY_MISSING`, exit 70, until the coordinator writes the entry).
- (c) `checkPreMarks` E415,E416 = `[]`; E413 = `["E413 row has no \"not yet released\" pre-mark to amend"]`.
- (d) `deriveVersion` = 4.19.4; commit line `chore(release): v4.19.4 — release-cd-v4.19.4 (E415, E416)`.
- (e) no local or remote `release/v4.19.4`.
- (f) data: `deriveRangeSpecs` = `[]`; `with-spec REQUIRE pass`, `spec-absent UNCLASSIFIABLE SPEC_UNCLASSIFIABLE`, `spec-not-in-range REQUIRE SPEC_REQUIRE`. The spec file is currently untracked; it must reach main in the coordinator's docs PR before dispatch.

### AC9 (T-RELCD4-06) — PASS
- `v4.19.3` -> bc135a2… ; commit 00d18f7…; tagger `github-actions[bot]`; message `v4.19.3 — release-cd-v4.19.3 (E409, E410, E411, E412, E413)`; `ancestor`. CHANGELOG line 19 present. `schema dist .github scripts docs/release-cd.md` unchanged=0. release-engineer SOP via dist: `true true`.
- Governance-core + release tests: 79 tests, 79 pass, 0 fail.
- CLAUDE.md baseline counts present and correct (thirteen, 18-step, 12 registered / Twelve prompts, 15 ordered, 7 fragments, 12 model-pinned, ~300 lines); `index.ts` = 311 lines.

### AC10 — see the PASS write and the coordinator reply (post-PASS read-back and the exit-70 dry run).

## Observations (listed once, not filed)
- `specs/release-cd-v4.19.4.md` is untracked at QA time; per AC8(f) it must land on main before the runner dispatch.
- `.current/_primary/{dispatch.jsonl,handoff.md,tasks.md}` are modified uncommitted (the coordinator's own routing writes); the coordinator commits them with the PASS.
- Teamwork budget measured 21535 by my reconstruction vs 21526 at cut; both under cap 21715.
## 2026-11-09T03:07:17.161Z — PASS — by qa-engineer

suite-result: 327/327 passed (server-recorded from qa_suite_result; command: node scripts/test-lock.mjs -- node --test <25 AC3 test files>)

AC1-AC9 verified on main @ 57f3196 against v4.19.3; details in qa_reports/review_T-RELCD4-01.md (AC Execution Log). AC1 35/28 commits, 27 files 572+/21-, five PR merges + two lane merges, 27 paths in five classes, untouched set 0. AC2 lane PASS handoffs, ledgers 4/2, five QA reviews PASS, code reviews APPROVED, manifests 2/1, pre-marks, tree equality. AC3 14 CI runs green Node 20+22, local 25 files 327/327. AC4 dist no diff, check-version 4.19.3, bookkeeping/md-tables/agc check/transitions-sync OK, deps unchanged, audit high=0 (1 low, 6 moderate). AC5 registries 35/18/13/12, schema versions unchanged, build+golden byte-identical, only monolith golden changed 5/3, budgets unchanged, 239 test files. AC6/AC7 composed coordinator + code-reviewer + integrator + lane-protocol + CLAUDE.md spans as expected. AC8 dry-run exit 60 PRECONDITION_NOT_PASS, nothing mutated, [Unreleased] present with null entry, pre-marks [] / E413 rejected, 4.19.4 + summary line, no release branch, 8a-3 REQUIRE branch. AC9 v4.19.3 tag/ancestry, unchanged paths, release SOP loads, 79/79.

