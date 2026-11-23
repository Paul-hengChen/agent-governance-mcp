# Judge report — T-E445-01 (feature e445-spec-workshop-questioning, test-first chain)

covers: T-E445-01, T-E445-02, T-E445-03, T-E445-04

## Round 1 — by code-reviewer

Full suite at HEAD bd95fa7 (tree clean apart from this hop's `.current/e445/` writes and the uncommitted review report): `node scripts/test-lock.mjs -- npm test`, Node 22, run alone under the lock → `# tests 4536`, `# pass 4534`, `# fail 0`, `# cancelled 0`, `# skipped 2`, exit 0, 719 s. The 2 skips are the pre-existing e130 history-dependent checks (`ok 839`, `ok 849`, commit 121ddc8 not resolvable), same as base. The prebuild left `dist/` unchanged (`git status --porcelain` lists no `dist/` path).

## Expected-Red Diff

Manifest `qa_reports/expected-red_e445-spec-workshop-questioning.txt`: 10 entries (9 scenario reds in `test/e445-spec-workshop-questioning.test.mjs` from T-E445-01, 1 planned AC21 red in `test/context-budget.test.mjs` from T-E445-02); its last note states no red remains. Actual reds in the suite: 0.

- e445 AC2, AC3, AC4, AC5, AC6, AC7, AC8, AC9, AC10 (added lines): scenario tests, now green — built (T-E445-02).
- context-budget `AC21 (spec-workshop) … ≤ 1092 cap`: snapshot red, now green under its new title `… ≤ 1415 cap` — re-measured by qa in T-E445-03 per R3 (b); judge re-measured 1415 independently.
- Actual reds not on the manifest: none.

Result: clean — every manifest entry green, zero off-manifest reds.

## AC Execution Log

- AC1 — `node --test --test-name-pattern="^AC1" test/e445-spec-workshop-questioning.test.mjs` and `node --test --test-name-pattern="^AC6" test/e423-spec-workshop.test.mjs` — pass (both files also green in the 85-test run below).
- AC2 — `--test-name-pattern="^AC2"` e445 — pass.
- AC3 — `--test-name-pattern="^AC3"` e445 — pass.
- AC4 — `--test-name-pattern="^AC4"` e445 — pass.
- AC5 — `--test-name-pattern="^AC5"` e445 and `^AC9` e423 — pass.
- AC6 — `--test-name-pattern="^AC6"` e445 — pass.
- AC7 — `--test-name-pattern="^AC7"` e445 — pass.
- AC8 — `--test-name-pattern="^AC8"` e445 — pass.
- AC9 — `--test-name-pattern="^AC9"` e445 and `^AC10` e423 — pass.
- AC10 — `--test-name-pattern="^AC10"` e445 (both halves) and `^AC11` e423 — pass.
- AC1–AC10 combined run: `node --test test/e445-spec-workshop-questioning.test.mjs test/e423-spec-workshop.test.mjs test/context-budget.test.mjs` → 85 tests, 85 pass, 0 fail, exit 0.
- AC11 — `--test-name-pattern="AC21"` test/context-budget.test.mjs — pass; judge measurement `ceil(len(stripRationale(stripOriginTags(body)))/4)`: HEAD 1415, base 1092 (+323) = cap; `git diff b3ac374 -- test/context-budget.test.mjs` touches only the AC21 block (title, one comment line, assertion).
- AC12 — full suite above exit 0 (4534/4536, 0 fail); `git diff --stat b3ac374 -- test/fixtures/compose-golden/ dist/ CLAUDE.md test/e423-spec-workshop.test.mjs` → empty; `wc -l CLAUDE.md` → 250; `node bin/agc-init.mjs check` → exit 0 (`OK (4.23.0)`, 2 advisory comment warnings dispositioned in `review_reports/review_T-E445-01.md` Quality); `npm audit --audit-level=high` → exit 0; `node scripts/fanout.mjs check --cut specs/fanout-v5-w6.md e445 specs/e445-spec-workshop-questioning.md` → 0 out of bounds, exit 0.
- Extra judge checks: frozen `BASE_SOP` literal compared with `git show b3ac374:content/skill-spec-workshop.md` → byte-identical (4398 chars). 13 mutation negative controls on a scratch copy outside the worktree each turned at least one e445 test red; identity copy all green (listed in the review report Correctness).
## 2026-11-23T13:51:32.513Z — PASS — by code-reviewer

suite-result: 4534/4536 passed (server-recorded from qa_suite_result; command: node scripts/test-lock.mjs -- npm test)

code-reviewer PASS (APPROVED) for e445-spec-workshop-questioning, T-E445-01..04 (covers: line in review_reports/review_T-E445-01.md and qa_reports/review_T-E445-01.md). Full suite at bd95fa7: 4536 tests, 4534 pass, 0 fail, 2 skipped (pre-existing e130 history skips), exit 0; dist unchanged after prebuild. AC1-AC12 all pass (AC Execution Log). Expected-Red Diff clean: 10 manifest entries all green (9 built, AC21 re-measured per R3 (b)), zero off-manifest reds. Ticket points (1)-(8) each present at the named step with the intended meaning; all 11 Copy / Strings rows verbatim and in the spec's step-4 order. Frozen BASE_SOP literal byte-identical to the base file; AC21 independently re-measured 1415 (base 1092, +323). 13 mutation negative controls on a scratch copy all turned tests red. Scope: fanout check --cut 0 out of bounds; e423 test, goldens, dist, CLAUDE.md untouched; CLAUDE.md 250 lines; agc check exit 0 (2 comment advisories kept with reasons); npm audit --audit-level=high exit 0. Optional (non-blocking): e445 test header comment block is 8 lines vs the 7-line advisory. review_report: review_reports/review_T-E445-01.md

