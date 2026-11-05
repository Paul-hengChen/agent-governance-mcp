<!-- schema_version: 2 -->
# Tasks

## Active

- [x] T-E409-01 [P2] sr-engineer: content/skill-coordinator-lite.md line 16 -> spec Copy/Strings `lite.16` verbatim (tw_update_state / tw_complete_task server-rejected; tw_add_task / tw_rollback_task / tw_void_task / tw_switch_role SOP-forbidden); no other line changes (AC1; spec specs/e409-lite-wording-const-header.md) | depends_on: none
- [x] T-E411-01 [P2] sr-engineer: content/const-01-core-head.md line 1 -> exactly `# Constitution` (string `c01.1`; no version, no HTML comment); lines 2-36 unchanged (AC3) | depends_on: none
- [x] T-E409-02 [P2] qa-engineer: re-pin test/e391-prompt-audit-stale-facts.test.mjs AC-G2-11 (lines 73-77: new lite.16 span count 1, old span 0, `will be rejected` 0, retitle) (AC1); new test/e409-lite-write-tool-facts.test.mjs pinning the handler-gate facts behind lite.16 (AC2) | depends_on: T-E409-01
- [x] T-E411-02 [P2] qa-engineer: run scripts/capture-constitution-golden.mjs, commit only the 11 listed goldens (skill-coordinator-monolith.txt byte-identical, else stop + mail) (AC6); re-pin constitution-deliverable-guard A3 lines 55-72 (AC3, AC4); re-pin e393 line 138, prompt-state-footer lines 421/429/433/463/483 and teamwork-lite lines 100/143 to /^# Constitution$/m or startsWith("# Constitution\n") (AC5) | depends_on: T-E411-01
- [x] T-E409-03 [P2] qa-engineer: lane verification for E409+E411 - re-measure lean/stripped/non-design/teamwork budgets vs spec trial table, no cap edit, test/context-budget.test.mjs untouched (AC7); final `node scripts/test-lock.mjs -- npm test`, npm run build with dist/ clean, npm run check:bookkeeping, npm audit --audit-level=high on last HEAD (AC8); evidence covers all five task ids | depends_on: T-E409-02, T-E411-02
