covers: T-E412-01, T-E412-02, T-E412-03

# QA review — e412-qa-visual-template

Phase 0.5: skipped (no expected-red manifest declared)
Phase 1.5: skipped (no Visual Baselines declared)
Phase 3: new file test/e412-qa-visual-template.test.mjs (creation pre-authorized in dispatch brief).

## Copy Audit (3a)
- tpl.desc: template line 4 matches spec verbatim (checked by sed and by test).
- tpl.body: line 9 matches spec; `On invocation, ...` clause preserved.
- coord05.5: coord-05 line 5 matches spec; `(subagent-dispatch tool or `tw_switch_role`)` kept.
- No unlisted user-facing string introduced. Visual Audit (3b): N/A (no visual tokens).

## AC to test map
- AC1: test/e412-qa-visual-template.test.mjs (frontmatter shape, description wording)
- AC2: same file (CRITICAL line, body wording, tw_switch_role delegation) + test/subagent-templates.test.mjs
- AC3: same file (coord-05 clause + parenthetical) + test/e408-core-task-alias-tail.test.mjs
- AC4: capture-constitution-golden.mjs after build moved only skill-coordinator-monolith.txt (1 insertion, 1 deletion)
- AC5: test/context-budget.test.mjs green (teamwork bundle <= 21715); test file unmodified vs base (empty diff)
- AC6: subagent-templates, e403, e408 green without edits
- AC7: see AC Execution Log

## AC Execution Log
- AC1/AC2/AC3/AC5/AC6: `node --test test/context-budget.test.mjs test/subagent-templates.test.mjs test/e403-lean-dispatch-alias.test.mjs test/e408-core-task-alias-tail.test.mjs test/e412-qa-visual-template.test.mjs` -> 88/88 pass, exit 0.
- AC4: `git status --porcelain test/fixtures` after capture lists only skill-coordinator-monolith.txt; diff stat 1 insertion, 1 deletion.
- AC5: `git diff 6e1a9d4 --stat -- test/context-budget.test.mjs` empty.
- AC7: `git diff --name-only 6e1a9d4` lists only the e412-owned paths plus this lane's .current/e412, review/qa reports and the new test (final results appended in the PASS write).
