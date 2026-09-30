# QA verification — T-E233D-01

covers: T-E233D-01, T-E233D-02, T-E233D-03, T-E233D-04, T-E233D-05, T-E233D-06, T-E233D-07, T-E233D-08, T-E233D-09, T-E233D-10, T-E233D-11, T-E233D-12, T-E233D-13

Verifier: qa-engineer C (fresh context, not the author). Diff under test: 6c61864..7634459 on feat/e233d-test-comments-b (comment-only rewrite of 48 owned test files). Inputs checked, not trusted: `qa_reports/author_E233D.md`, `review_reports/review_T-E233D-01.md`.

## Phases
- Phase 0.5: skipped (no expected-red manifest declared).
- Phase 1: comment-only change; correctness of wording was judged by code-reviewer (APPROVED). No copy strings, no visual tokens (spec tables are N/A); AC4 and AC1 show no string literal changed.
- Phase 1.5: skipped (no Visual Baselines declared).
- Phase 3: skipped (dispatch brief: verifier writes no `test/` file; the change adds no behaviour to test). AC-to-proof map is the AC Execution Log below.

## AC Execution Log
All scripts are my own, written fresh this hop and kept outside the repo; they run from the lane root and load the repo's own `typescript`.

- AC1 — `check-invariance.mjs` (spec body verbatim; also lists non-.mjs files changed under `test/`). Output: `non-mjs changed in test/: []`, `invariance OK: 48 files`. Exit 0. PASS.
- AC2 — `check-bare-ids.mjs`. Walks the TS AST of each of the 50 owned files, collects leading and trailing comment ranges, joins adjacent line comments into blocks, and matches ids case-insensitively including suffixed shapes (`[ecdr]\d+[a-z0-9]*(-seg)*`, so `e178a`, `e123b9`, `E233B-NEW-1`, and `T-…` with segments) plus parenthesised lower-case slugs. Strips ids, slugs, `docs/backlog.md row …` phrases and punctuation; fails below 3 words. Output at HEAD: `id-bearing blocks: 364`, `bare-id OK`. Exit 0. Negative control on a 6c61864 export: 402 blocks, 5 offenders (for example `e235b-relative-worktree.test.mjs:201` and `:220`, bare `R5`/`R6` banners), exit 1 — the detector fires. PASS.
- AC3 — `check-xrefs.mjs`. For each changed owned file, scans every other tracked file (dist excluded) for lines naming it and takes tokens `[A-Z][A-Z0-9-]*\d[\w()-]*` after the name; fails if a token is in the base file but not at HEAD. Output: `tokens checked: 5206`, `xrefs OK`. Exit 0. PASS.
- AC4 — spec grep verbatim: `git diff -U0 6c61864 -- test | grep -E '^[+-][^+-]' | grep -vE '^[+-]\s*(//|/\*|\*|$)'`. Output: exactly 3 changed code lines, each changing only its trailing comment:
  - `test/e213-shipped-ignored-shape.test.mjs:488` (worktree cleanup call; now `(e180 AC5)` as trailing pointer).
  - `test/e38-next-role-lookahead.test.mjs:324` (`dispatch_pins` line; `shrink warning (E28)`).
  - `test/e38-next-role-lookahead.test.mjs:325` (`next_role: "design-auditor"` line; `lookahead warning (E38)`).
  All three are listed in the author's report. Confirmed: both non-e213 lines are in `e38-next-role-lookahead`, not `e28-shrink-warning` as the code review's AC4 row says (a mis-attribution in the review text only; the line mentioning E28 is 324). With AC1 green, code before each `//` is unchanged. PASS.
- AC5 — spec name filter verbatim over `git diff --name-only 6c61864`: prints nothing. Untracked files at verification time were only this lane's E233D reports. `git diff --name-only 6c61864 -- test/render-structure.test.mjs test/fixtures test/context-budget.test.mjs`: prints nothing. PASS.
- AC6 — `node scripts/test-lock.mjs -- npm test` on a clean committed tree. Results recorded in the handoff state (qa_review) with the final HEAD sha, so this file does not need re-committing after the last run. Baseline to match (author report, at 6c61864): 2958 tests / 2955 pass / 0 fail / 3 skipped.
- AC7 — `check-hygiene.mjs`. Builds the macOS and Linux home-directory pattern by string concatenation and scans the 1756 added lines of `git diff 6c61864 -- test` for it and for `http(s)://`. Output: `hygiene OK`. Exit 0. Jargon spot check: remaining `tw_*` names in added lines are `tw_gate_stats`, `tw_update_state`, `tw_get_state` — real tools the tests exercise, which the spec allows. PASS (wording is the reviewer's judgment, APPROVED).
## 2026-09-30T03:08:24.213Z — PASS — by qa-engineer

Fresh verifier (qa C). All proof: lines re-run with own scripts (check-invariance.mjs, check-bare-ids.mjs, check-xrefs.mjs, check-hygiene.mjs): AC1 invariance OK 48 files; AC2 bare-id OK (364 id blocks, case-insensitive incl. suffixed shapes; negative control on base flags 5); AC3 xrefs OK (5206 tokens); AC4 exactly 3 trailing-comment-only lines (e213-shipped-ignored-shape:488, e38-next-role-lookahead:324-325 — the review's "e28" attribution is really e38); AC5 scope exact; AC7 no home path / URL. AC6: full suite via test-lock on clean tree at 41d4cc1 = 2958/2955/0/3, matching baseline (a first run showed 1 timing flake in untouched test/e132-lane-registry.test.mjs gap-6, green 3/3 in isolation and in the rerun). Final-HEAD suite run follows the commit of this state write. Details: qa_reports/review_T-E233D-01.md.

