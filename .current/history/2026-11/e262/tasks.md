<!-- schema_version: 2 -->
# Tasks

## Active

- [x] T-E262-01 [P1] sr-engineer: E262 — apply spec W1 (content/skill-integrator.md:117) and W2 (docs/lane-protocol.md:101, §5 only) verbatim, in place, no line added/removed (ACs AC-E262-1..3) | depends_on: none
- [x] T-E355-01 [P1] sr-engineer: E355 — apply spec W3-W8 (content/skill-integrator.md:142,151,156x2,164,175, in place; file stays 249 lines per e410) and W9 (five bullets in docs/lane-protocol-addendum.md §5 after the bookkeeping bullet) verbatim (ACs AC-E355-1..5) | depends_on: none
- [x] T-E360-01 [P2] sr-engineer: E360 — apply spec W10: insert review_task_ids=[&lt;task-id&gt;] after qa_review in the five FAIL calls of content/skill-qa-visual.md:88,89,90,91,93 (ACs AC-E360-1..2) | depends_on: none
- [x] T-E340-01 [P1] sr-engineer: E340 — apply spec W11 to content/const-05-core-standards.md:17 verbatim, in place (file stays 23 lines; no repo path in the clause) (AC AC-E340-1) | depends_on: none
- [x] T-E262-02 [P1] qa-engineer: E262 tests — move test/e178a-integrator-role.test.mjs AC10 pin (line 301) to the W1 order; new test/e262-*.test.mjs pinning W1/W2 order, manifest-tier clauses and §5-only placement (ACs AC-E262-1..4) | depends_on: T-E262-01
- [x] T-E355-02 [P1] qa-engineer: E355 tests — move pins e178a AC13 (line 352), e226 AC-E226-4 FINDINGS_CMD, e295 AC9 (flake rule -> addendum list), e349 AC-E349-1 (line 39 + banned list) and AC-E349-2 (§5 now 4+5 bullets); pin W3-W9 and the load-sensitive list (new test/e355-*.test.mjs or inside e349); confirm e108/verify-release untouched vs merge-base (ACs AC-E355-1..6) | depends_on: T-E355-01
- [x] T-E360-02 [P2] qa-engineer: E360 tests — new test/e360-*.test.mjs: every status=FAIL call in content/skill-qa-visual.md carries review_task_ids=[&lt;task-id&gt;] right after qa_review (5 = 5); existing qa-visual tests and the 20700-byte cap green (ACs AC-E360-1..2) | depends_on: T-E360-01
- [x] T-E340-02 [P1] qa-engineer: E340 tests — move test/e130-lane-default.test.mjs AC9 to assert the rule plus exception; npm run build + scripts/capture-constitution-golden.mjs, commit exactly the 11 goldens in the spec (monolith coordinator byte-identical); re-set context-budget caps lean 5723->5731 and non-design 8501->8518 at zero headroom with E340 re-baseline comments (stripped/teamwork untouched); new test/e340-*.test.mjs (ACs AC-E340-1..4) | depends_on: T-E340-01
- [x] T-E262-03 [P1] qa-engineer: lane final — after commit, on a clean tree: node scripts/test-lock.mjs -- npm test on the final HEAD (record qa_suite_result); scope check vs merge-base; golden capture byte-identical; e410/e351/e383 green (AC-L-1, AC-E355-5, AC-E360-2) | depends_on: T-E262-02, T-E355-02, T-E360-02, T-E340-02
