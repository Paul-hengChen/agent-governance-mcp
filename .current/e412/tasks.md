<!-- schema_version: 2 -->
# Tasks

## Active

- [ ] T-E412-01 [P2] sr-engineer: templates/claude-code-agents/qa-visual.md line 4 -> tpl.desc, line 9 -> tpl.body (specs/e412-qa-visual-template.md Copy/Strings); lines 1-3, 5-8 and the 'On invocation, ...' clause unchanged (AC1, AC2) | depends_on: none
- [ ] T-E412-02 [P2] sr-engineer: content/coord-05-core-visual-drift.md line 5 -> coord05.5 (insert when-to-pick-qa-visual clause); keep '(subagent-dispatch tool or `tw_switch_role`)' and lines 1-4, 6-21 unchanged (AC3) | depends_on: none
- [ ] T-E412-03 [P2] qa-engineer: new test/e412-*.test.mjs pinning AC1-AC3; npm run build && node scripts/capture-constitution-golden.mjs -> only skill-coordinator-monolith.txt moves (one line), commit only that golden (AC4); re-measure teamwork bundle <= 21715, no cap edit (AC5); run subagent-templates / e403-lean-dispatch-alias / e408-core-task-alias-tail, re-pin only if red (AC6); final node scripts/test-lock.mjs -- npm test, dist/ no diff, npm run check:bookkeeping, npm audit --audit-level=high on last HEAD (AC7) | depends_on: T-E412-01, T-E412-02
