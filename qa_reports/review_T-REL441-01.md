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
