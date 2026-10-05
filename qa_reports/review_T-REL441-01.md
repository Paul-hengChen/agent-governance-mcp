# QA review T-REL441-01 (release-v4.4.1, AC1 + AC2)

Evidence-only gate on committed main, HEAD 0ec1504, base tag v4.4.0 (71d3af0). Phase 0.5/1.5/3.5: skipped (no expected-red manifest, no Visual Baselines, no proof-annotated Phase 3.5 run beyond the commands below). Phase 3: skipped (dispatch brief: no test files).

## AC1 diff scope
| check | command | result |
|---|---|---|
| protected files | `git diff --name-only v4.4.0..HEAD -- package.json tsconfig.json .github` and `-- 'tsconfig*'` | empty |
| non-bookkeeping paths | `git diff --name-only v4.4.0..HEAD`, grouped by top dir | tools 36, gates 14, scripts 14, prompts 5, bin 3, lib 3, schema 2, index.ts 1, test 142 (none under test/fixtures), specs 20 (all e260* / fanout-e260 / release-v4.4.1), dist 8 |
| bookkeeping | same list | docs/backlog.md, docs/v4.0.0-new-tickets.md, tasks.md, .current 2, qa_reports 84, review_reports 18 |
| anything else | grep -v of all allowed prefixes | only index.ts, specs/*, tasks.md (all allowed) |
| commits | `git log --oneline v4.4.0..HEAD` | 258 commits; paths above account for all changes |
Verdict AC1: PASS.

## AC2 per-lane evidence
| lane | code-review (review_reports) | qa record (qa_reports) | closed handoff status / last_agent |
|---|---|---|---|
| e260a | A-01 APPROVED | review_T-E260A-01 Verdict: PASS | PASS / qa-engineer |
| e260b | B-01, B-10 APPROVED | B-01 PASS (3043/3040/0/3), B-10 PASS | PASS / qa-engineer |
| e260c | C-01 APPROVED | C-01 PASS for all nine tasks | PASS / qa-engineer |
| e260d | D-01 APPROVED | D-01 PASS for D-01..07 | PASS / qa-engineer |
| e260e | E-12 APPROVED (latest) | E-12 PASS (fresh verifier) | PASS / qa-engineer |
| e260f | F-22 Round 2 APPROVED | F-23 Verdict: PASS (also qa_E260F_author.md) | PASS / qa-engineer |
| e260g | G-09..16 carry Round 2 CHANGES_REQUESTED, each pointing to G-17 for resolution; G-17 APPROVED (latest) | G-17 PASS (r3-fix), G-09 qa file | PASS / qa-engineer (e260g-r3-fix) |
| e260h | H-11 APPROVED | H-26 PASS (AC1-AC11), H-11 PASS, author/verify files | PASS / qa-engineer |
| e260i | I-11 round 2 APPROVED | I-12 PASS (AC1-AC13), I-11/I-13 PASS | PASS / qa-engineer (e260i-r3-fix) |
Handoff proof: `grep -E '^(status|last_agent):' .current/history/2026-10/e260{a..i}/handoff.md` shows status "PASS" and last_agent "qa-engineer" for all nine. Known quirk (not a failure): the e260g qa file with nine task ids in its name exists and is left for release-engineer's archive step.
Verdict AC2: PASS.
## 2026-10-05T06:08:05.097Z — PASS — by qa-engineer

AC1-AC6 all PASS on HEAD 0ec1504 (evidence commit 17cf37a). AC1 diff scope = E260 comment trim + bookkeeping, package.json/tsconfig/.github untouched. AC2 nine lanes e260a-e260i code-review APPROVED (latest verdict), qa PASS, closed handoffs PASS/qa-engineer. AC3 full suite under test lock: 3043 tests, 3040 pass, 0 fail, 3 skipped, exit 0 (no flake rerun needed). AC4 build clean, dist porcelain empty, check-version OK. AC5 removeComments transpile identical for 8 sampled files (216/216 changed ts/mjs files), context-budget non-comment lines unchanged, fixtures/content diff empty. AC6 E246/e178a/E259/e258b tests 86 pass 0 fail 1 skipped; tag v4.4.0 = 71d3af0, CHANGELOG [4.4.0] intact. Evidence: qa_reports/review_T-REL441-01..03.md.


## AC Execution Log
covers: T-REL441-01, T-REL441-02, T-REL441-03 (one log for the round; proofs run on HEAD 0ec1504)

| AC | command | raw output / exit | verdict |
|---|---|---|---|
| AC1 | `git diff --name-only v4.4.0..HEAD -- package.json tsconfig.json .github` and `-- 'tsconfig*'` | empty output; path groups per the AC1 table above | pass |
| AC2 | `grep -E '^(status|last_agent):' .current/history/2026-10/e260{a..i}/handoff.md`; verdict greps on review_reports and qa_reports | all nine: status "PASS", last_agent "qa-engineer"; code-review APPROVED and qa PASS per the AC2 table | pass |
| AC3 | `node scripts/test-lock.mjs -- npm test` | exit 0; tests 3043, pass 3040, fail 0, cancelled 0, skipped 3 | pass |
| AC4 | `npm run build && git status --porcelain dist/`; `node scripts/check-version.mjs` | build exit 0; porcelain empty; check-version exit 0 (OK 4.4.0) | pass |
| AC5 | removeComments `transpileModule` of v4.4.0 vs HEAD; `git diff -U0 v4.4.0..HEAD -- test/context-budget.test.mjs`; `git diff --name-only v4.4.0..HEAD -- test/fixtures content` | 8/8 sampled identical (216/216 changed ts/mjs files identical); only comment lines changed in context-budget; fixtures/content diff empty | pass |
| AC6 | `node --test` on e246, e178a, e259 brace/hash/limits, e258b; `git tag -l v4.4.0`; `git rev-parse v4.4.0^{commit}`; `grep -n '\[4.4.0\]' CHANGELOG.md` | tests 87, pass 86, fail 0, skipped 1; tag v4.4.0; 71d3af020270e5f26dddb9222924b26e1564f7e6; CHANGELOG line 19 | pass |
## 2026-10-05T06:08:16.815Z — PASS — by qa-engineer

AC1-AC6 all PASS on HEAD 0ec1504 (evidence commit 17cf37a). AC1 diff scope = E260 comment trim + bookkeeping, package.json/tsconfig/.github untouched. AC2 nine lanes e260a-e260i code-review APPROVED (latest verdict), qa PASS, closed handoffs PASS/qa-engineer. AC3 full suite under test lock: 3043 tests, 3040 pass, 0 fail, 3 skipped, exit 0. AC4 build clean, dist porcelain empty, check-version OK. AC5 removeComments transpile identical (8 sampled, 216/216 changed files), context-budget non-comment lines unchanged, fixtures/content diff empty. AC6 E246/e178a/E259/e258b 86 pass 0 fail 1 skipped; tag v4.4.0 = 71d3af0, CHANGELOG [4.4.0] intact. Evidence: qa_reports/review_T-REL441-01..03.md (AC Execution Log in -01).

