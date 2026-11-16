covers: T-RELCD6-01, T-RELCD6-02, T-RELCD6-03, T-RELCD6-04, T-RELCD6-05, T-RELCD6-06

# QA review — release-cd-v4.21.0 (T-RELCD6-01..06)

Evidence-only release gate for v4.21.0 MINOR (tickets E417, E418, E421, E429; bump, CHANGELOG content and npm audit disposition human-decided 2026-11-16). Verified on `main` @ ee26a07 (= origin/main, confirmed unmoved since the cut with `git rev-parse` and `git ls-remote`), against v4.20.0 (tag object c30f457, commit 7d05dac). QA tier: sonnet, independent judge. Every number below was re-measured, none copied from the spec's cut-time figures. No file created or edited besides this review; no commit, push, branch, CHANGELOG edit, ticket filed, or non-dry-run release phase. `docs/agc-ticket-draft-wc32.md` untouched, not printed.

Baseline `git status --porcelain` before QA started: ` M .current/_primary/{dispatch.jsonl,handoff.md,tasks.md}` and `?? specs/release-cd-v4.21.0.md` (the draft file is excluded through `.git/info/exclude`). After build + golden capture the status was identical.

Phase 0.5: skipped (no expected-red manifest declared for `release-cd-v4.21.0`; the three ticket manifests belong to the lanes and are checked as data in AC2).
Phase 1.5: skipped (no Visual Baselines declared). Spec Copy / Strings and Visual Tokens: N/A (evidence-only gate).
Phase 3: skipped (no relevant new test: evidence-only gate, tasks touch no files; the tickets' own tests were run as part of the full suite).

## AC Execution Log

### AC1 (T-RELCD6-01) — PASS
- `git log --oneline v4.20.0..HEAD | wc -l` = 56; `--no-merges` = 37; shortstat `78 files changed, 4298 insertions(+), 318 deletions(-)`; name-status `39 A`, `39 M`.
- First-parent merge/parent/head triples: 18 lines, exactly the spec table, `ee26a07 910443f b2d9db0` down to `9c4c300 7d05dac 089f8f0`. The non-table merge probe returned exactly `dabb2ed 4737e84 ba89cc4` (the E417 back-merge).
- Ticket path counts a50a506 8, d01a221 7, 50cf354 27, 2401cdf 14, 910443f 5; `union=57`; `comm -13` left exactly 21 paths: `.current/_primary` 4, lane history 13 (`e417`, `e418`, `e429` 3 each, `e417b` 4), docs 3 (`docs/backlog.md`, `docs/discussion-2026-11-10-gate-retro-and-full-auto.md`, `docs/v4.0.0-new-tickets.md`), `tasks.md` 1. 57 + 21 = 78.
- Untouched-set diff count = 0. `git diff --name-only v4.20.0..HEAD -- tools content` = `tools/merge-invariants.ts`, `content/const-08-chain-31-mid.md`, `content/constitution-rationale.md`, `content/coord-03-core-fallback.md`, `content/coord-04-host-watermark.md`, `content/coord-06-host-token.md` (exact).
- Per-top-level counts `17 1 5 4 5 16 5 3 1 20 1 0 0 0 0 0 0 0 0 0 0 0 0 0` (exact match). dist-to-source: `tools/merge-invariants` and `tools/merge-invariants.ts` only.

### AC2 (T-RELCD6-01) — PASS
- Lane handoffs (feature status last_agent hop qa_rounds review_rounds, x/void/open): e429 `e429-lane-config-copy` PASS qa-engineer 6 0 1, 3/0/0; e418 `e418-gate-retro-prose-trim` PASS qa-engineer 6 0 1, 4/0/0; e417 `e417-merge-invariants-lost-row` PASS qa-engineer 9 0 1, 3/0/0; e417b `e417b-spec-text` PASS qa-engineer 6 0 1, 1/0/0.
- `HEAD:.current/_primary/handoff.md`: `e421-e108-load-sensitive-list`, PASS, qa-engineer, hop_count 4, rounds 0/0; `HEAD:.current/_primary/tasks.md` T-E421-01/02 `[x]` count 2.
- 13 `qa_reports/review_T-*.md` added, each `secs=1 last=PASS fail=0`; suite-result E417 4226/4228 (3 files, covers on `review_T-E417-03.md`), E417B 4226/4228, E418 4190/4192 (4, covers on `review_T-E418-04.md`), E421 4182/4184 (2, covers on `review_T-E421-01.md`), E429 4189/4191 (3).
- 5 `review_reports/review_T-*.md` added, each `last=APPROVED`: E421-01 `Round 1 — APPROVED`; E417-02, E417B-01, E418-01, E429-01 `Round 1 — CHANGES_REQUESTED;Round 2 — APPROVED`.
- Expected-red manifests: e417 6, e418 10, e421 3 entry lines (data); ticket evidence archived: 0.
- Backlog rows E417, E418, E421, E429: one row each, `**DONE` true, `not yet released` true; E417/E418/E429 start `**DONE — merged to \`main\` 2026-11-16`, E421 starts `**DONE — PASS 2026-11-10 on branch \`fix/e421-e108-load-sensitive-list`.
- Ancestry: no `NOT` line for the 18 PR heads, no `TREE` line for any first-parent merge.

### AC3 (T-RELCD6-02) — PASS
- CI: `gh run view` loop returned 41 lines, all `CI … success a1 test (20)=success,test (22)=success`; sha/event column read back matches the spec's list (23 pull-request/push runs on heads, 18 main pushes). `gh run list --commit ee26a07…` = `43835704198 CI success`.
- Full suite on Node 22.22.3: `node scripts/test-lock.mjs -- npm test` → `# tests 4228`, `# pass 4226`, `# fail 0`, `# skipped 2`, exit 0.
- Node 20: `node scripts/test-lock.mjs -- fnm exec --using=20 -- node --test test/e429-lane-config-copy.test.mjs test/e417-merge-invariants-history.test.mjs test/e203-merge-invariants-union.test.mjs` → `# tests 48`, `# pass 48`, `# fail 0`.
- No load-sensitive test red; no isolation rerun needed.

### AC4 (T-RELCD6-02) — PASS
- `check-version`: `dist/index.js parity OK (4.20.0)`, `package-lock.json parity OK (4.20.0)`, `OK (4.20.0)` (expected "HEAD is past tag" note present).
- `check:bookkeeping` `bk=0` (473 ticket row(s), 259 queue row(s), 484 decision row(s); one non-blocking "id ordering not checked: no base commit found" note); `check:md-tables` `md=0` (783 files, 0 malformed tables).
- `agc check — OK (4.20.0) — all adapters current`, `agc=0` (hygiene advisory: skipped 37 home-path hits with a placeholder username, recorded not a finding); three `agc-version: 4.20.0` hits (CLAUDE.md, AGENTS.md, .antigravityrules).
- `check:transitions-sync — OK (21 keys, …)`; `deps=0`; `audit=0`, `7 vulnerabilities (1 low, 6 moderate)`; `npm ls zod body-parser | grep -c invalid|UNMET|extraneous` = 0.

### AC5 (T-RELCD6-03) — PASS
- Registries via `dist/`: `36 19 13 12 {"handoff":15,"tasks":2,"sqlite":2,"config":2}`; `gates=0` (gates and `scripts/release.mjs` unchanged); counts 15 const, 7 coord, 12 templates, 15 `gates/*.ts`.
- `npm run -s build && node scripts/capture-constitution-golden.mjs`: build=0, cap=0, `git status --porcelain` identical to the pre-QA baseline (no new path; `dist/` and the 12 goldens byte-identical).
- 12 goldens; numstat vs v4.20.0: seven files, `8 8` ×6 (`build-full-design-fd`, `build-full-design`, `build-full-nondesign-fd`, `build-full-nondesign`, `constitution-monolith`, `hook-full`) and `19 78` (`skill-coordinator-monolith`); the 5 lite goldens absent from the diff.
- Cap diff: `10598`→`9533`, `21715`→`19225`, `8518`→`7533` (the three assert lines exact); unchanged caps 5731, 4849, 2852 each present twice.
- Budgets measured at HEAD with the test's own composition (`Math.ceil(len/4)`): lean 5731, stripped constitution 9533, non-design 7533, teamwork 19225, skill-pm 4847 (data; zero headroom on the three lowered caps).
- Content bytes now/at v4.20.0: const-08 11920/15881, constitution-rationale 17270/15799, coord-03 21811/23507, coord-04 994/3633, coord-06 1849/3095; lines 12/12, 263/241, 104/104, 5/34, 9/39 (exact).
- Test files: name-status `2 A`, `11 M`; `test/*.test.mjs` 260 now, 258 at v4.20.0.

### AC6 (T-RELCD6-04) — PASS
- `bin/agc-init.mjs`: copy line 1, snapshot clause 1, `COPYFILE_EXCL` 7, `"check-ignore", "-q", "--", ".current/.config.json"` 1, `the lane uses default settings` 1; `docs/lane-protocol.md` snapshot bullet 1.
- E417: `WARN (c) history fallback: ` 1 in `tools/merge-invariants.ts` and 1 in `dist/tools/merge-invariants.js`; spec `*Intended strictness — …*` line 1; S1 test name 1, R2/R3 pins 2; `cli=0` (`scripts/merge-invariants.mjs` unchanged).
- E429, E417 and E203 suites green on Node 22 (full suite) and Node 20 (48/48).

### AC7 (T-RELCD6-04) — PASS
- Served-text probe: `true true true true true false` (constitution design and non-design carry `**Cut-Approval Gate` and `WHEN a write crosses the same build-entry edge`; coordinator carries `WHEN relaying a just-completed` and the new hop-cap sentence; old `**Same-lane continuation** (E295) is the human's only shortcut` absent).
- Error-code presence: HEAD `const 11111100 coord 01100011`; v4.20.0 archive `const 11111100 coord 01100011` (identical, so the trim dropped no code).
- `git diff --name-only v4.20.0..HEAD -- gates tools` = `tools/merge-invariants.ts` only.
- E421: six-test list string 1, `VR-20 (E80)` string 1, `eject=0` (`test/e108-eject.test.mjs` unchanged), `grep -l 'AC19:' content/*.md | wc -l` = 0. The re-pinned prose tests and `test/e349-integrator-repo-facts.test.mjs`, `test/e355-integrator-generic-wording.test.mjs`, `test/error-code-contract.test.mjs` are inside the green 4226/4228 full run.

### AC8 (T-RELCD6-05) — PASS
- (a) `release.mjs start --bump minor --tickets E417,E418,E421,E429 --work-dir <scratch outside repo> --dry-run` (gh authenticated; s1 reached): `RELEASE_STOP PRECONDITION_NOT_PASS: .current/_primary/handoff.md is (qa-engineer, In_Progress), expected (qa-engineer, PASS) — commit the release gate's (qa-engineer, PASS) write to main first`, `exit=60`; `cmp` of before/after `git status --porcelain` + `git branch --list 'release/*'` → `unchanged`; scratch work dir listing empty.
- (b) `17:## [Unreleased]`, `19:## [4.20.0] - 2026-11-10`; `unreleasedEntry` = `null` (expected before the coordinator writes the entry).
- (c) `checkPreMarks` four tickets `[]`; E406 `["E406 row has no \"not yet released\" pre-mark to amend"]`; E419 `["E419 row desc does not start with **DONE"]`.
- (d) `deriveVersion('4.20.0','minor')` 4.21.0, `patch` 4.20.1; commit summary `chore(release): v4.21.0 — release-cd-v4.21.0 (E417, E418, E421, E429)`.
- (e) `git branch --list 'release/v4.21.0'` empty; `git ls-remote --heads origin 'release/v4.21.0'` empty.
- (f) `deriveRangeSpecs` = `["specs/e126-merge-invariants.md","specs/e421-e108-load-sensitive-list.md"]`; `with-spec MULTI-FEATURE pass`, `spec-absent MULTI-FEATURE SPEC_UNCLASSIFIABLE`, `spec-not-in-range MULTI-FEATURE SPEC_REQUIRE`.
- (g) `deriveCodes` = `["E417","E417B","E418","E421","E429"]`; draft file: `ignored=0`, others-listing count 0, `tracked=1`, `present=0` (content not printed).
- (h) The draft CHANGELOG entry (lines of the Dependencies section of the spec, Lead through Notes) through `extractCitations`: 20 citations, 2 context; `checkChangelogCitations` against `v4.20.0..HEAD` plus `specs/release-cd-v4.21.0.md` → `[]`.

### AC9 (T-RELCD6-06) — PASS
- `v4.20.0` → tag object `c30f457db6e3…`, commit `7d05dacf5cb8…`; tagger line is the human (not `github-actions[bot]`; identity not reproduced here); message line is the v4.20.0 summary with the 22 ticket ids; `ancestor`.
- `gh run view 42777973173` conclusion `failure`; issue #111 `Release failed: CI_GATE_FAILED CLOSED`; `19:## [4.20.0] - 2026-11-10`.
- `git diff --quiet v4.20.0 HEAD -- schema .github scripts docs/release-cd.md content/skill-release-engineer.md` → `unchanged=0`.
- `switchRole("release-engineer")` via `dist/`: `true true` (contains `docs/release-cd.md` and `never waits for it`).
- `CLAUDE.md` baseline: `thirteen` (1), `19-step` (2), `12 registered`, `Twelve prompts`, `15 ordered`, `7 fragments`, `12 model-pinned`, `~300 lines` (2); `index.ts` 300 lines.
- v4.20.0 pins (`e247-pass-tasks-incomplete`, `e340-task-list-exception`, `e35-pipeline-order`, `error-code-contract`) and the release tests (`e394-release-sop`, `e394-release-script`, `e405-release-docs`, `e405-release-workflow`, `e405-release-runner`, `release-staging`) are inside the green full run (fail 0).

## Stale expectations / dispositions
None. Every probe matched the spec's expectation; main has not moved since the cut (HEAD = origin/main = ee26a07). The AC8 (a) tuple is `(qa-engineer, In_Progress)`, as the spec predicted after the dispatch write.

## Disclosures
- No relevant new test exists or was written (evidence-only gate, no code change); the tickets' own suites ran in the full suite.
- The AC10 read-back (state read-back, on-disk tuple, post-PASS dry run exit 70) post-dates this file and is reported in the final reply and the server-recorded PASS section below.
- Release risks noted, none blocking: the three lowered budget caps have zero headroom (any future prose addition to those bundles fails `test/context-budget.test.mjs`); 7 npm advisories (1 low, 6 moderate) remain, below the runner's high gate by human decision; v4.20.0's Node 20 `test/e177b-test-lock.test.mjs` `AC12` flake is not on the load-sensitive list and may recur on a runner (re-run the failed job and resume by hand from `publish`, as in the spec's plan).

## Verdict
## 2026-11-16T10:04:51.613Z — PASS — by qa-engineer

suite-result: 4226/4228 passed (server-recorded from qa_suite_result; command: node scripts/test-lock.mjs -- npm test)

AC1-AC9 verified on main @ ee26a07 (= origin/main, unmoved since cut) vs v4.20.0; no finding, no stale expectation. AC1: 56/37 commits, 78 paths (39A/39M), 18 first-parent triples exact + E417 back-merge dabb2ed, ticket counts 8/7/27/14/5 union 57 + 21 remainder, untouched set 0, tools/content diff = merge-invariants.ts + 5 content files, top-level counts exact, dist maps to the one source. AC2: four lane handoffs PASS/qa-engineer with expected counters and ledgers 3/4/3/1 x, E421 committed primary state PASS hop 4, 13 QA files secs=1 last=PASS fail=0, 5 review files last APPROVED, expected-red 6/10/3, four backlog rows DONE + not yet released, ancestry and tree equality hold. AC3: 41 CI runs all success a1 with test (20) and test (22) green, HEAD run 43835704198 success; full suite Node 22 4226/4228, fail 0, skipped 2, exit 0; Node 20 subset 48/48. AC4: check-version OK 4.20.0, bookkeeping 0 (473/259/484), md-tables 0 (783), agc check OK, transitions-sync 21 keys, deps unchanged, audit high exit 0 (1 low 6 moderate), npm ls 0. AC5: 36/19/13/12 and CURRENT_VERSIONS unchanged, gates and release.mjs unchanged, 15/7/12/15, build + golden capture leaves status equal to the pre-QA baseline, 7 goldens changed (8/8 x6, 19/78) and 5 lite unchanged, three cap decreases exact, budgets measured lean 5731 stripped 9533 non-design 7533 teamwork 19225 pm 4847, content bytes/lines exact, 260 test files. AC6/AC7: E429 copy line/guards/snapshot bullet, E417 WARN line in source and dist, S1/R2/R3 pins, served trimmed text true x5 and false for the old sentence, error-code presence const 11111100 coord 01100011 identical to v4.20.0, E421 list present and eject test unchanged. AC8: dry run exit 60 PRECONDITION_NOT_PASS naming (qa-engineer, In_Progress), tree unchanged, [Unreleased] present with entry null, premarks [] and E406/E419 rejected, 4.21.0 and commit summary exact, no release/v4.21.0 local or origin, MULTI-FEATURE verdicts, codes E417/E417B/E418/E421/E429, draft file ignored/untracked/present untouched, CHANGELOG draft citations 20 (2 context) -> []. AC9: tag c30f457/7d05dac ancestor with human tagger, run 42777973173 failure and issue 111 CLOSED, schema/.github/scripts/release docs unchanged, release-engineer SOP loads, CLAUDE.md baselines. No new test (evidence-only gate; disclosed). Evidence: qa_reports/review_T-RELCD6-01.md (covers all six).

