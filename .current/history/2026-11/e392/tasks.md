<!-- schema_version: 2 -->
# Tasks

## Active

- [x] T-E392-01 [P0] sr-engineer: ROLE_SKILL_MAP += "coordinator": "skill-coordinator.md"; add "coordinator" to tw_switch_role zod enum + inputSchema enum (tools/registry.ts); npm run build; commit only dist/tools/role.* + dist/tools/registry.* (spec AC1-AC6) | depends_on: none
- [x] T-E392-02 [P0] sr-engineer: templates/claude-code-agents/teamwork.md line 9 -> spec string teamwork.load (tw_switch_role("coordinator"); content/skill-coordinator.md kept as logical name) (spec AC7) | depends_on: T-E392-01
- [x] T-E392-03 [P1] sr-engineer: delete release-engineer template lines 24-25 (haiku example suffix; waits on ruling R1) + coord-04 line 5 haiku list -> spec string coord04.haiku (spec AC8, AC9) | depends_on: none
- [x] T-E392-04 [P1] sr-engineer: insert spec string coord02.alias into coord-02 line 1; set templates/agent-adapters/claude.md line 12 and CLAUDE.md line 233 to spec string adapter.dispatch in the same commit (spec AC12, AC13) | depends_on: none
- [x] T-E392-05 [P0] qa-engineer: test/subagent-templates.test.mjs - E280 tighten FILE_PATH_DELEGATES.teamwork to the new sentence + refresh stale comment; drop release-engineer from HAIKU_ROLES (waits on R1) (spec AC7, AC10) | depends_on: T-E392-02, T-E392-03
- [x] T-E392-06 [P0] qa-engineer: new test/e392-subagent-templates.test.mjs for spec AC1-AC5, AC7-AC9, AC12; refresh the two stale comments in test/skill-manifest.test.mjs (lines 36, 320-322) | depends_on: T-E392-01, T-E392-02, T-E392-03, T-E392-04
- [x] T-E392-07 [P0] qa-engineer: recapture 12 compose goldens (only skill-coordinator-monolith.txt may differ, hunks explained); record teamwork budget before/after (expected 21479 -> 21515, cap 21715); final node scripts/test-lock.mjs -- npm test on last HEAD (spec AC14-AC16) | depends_on: T-E392-05, T-E392-06
- [x] T-E392-08 [P0] qa-engineer: R1 option A (integrator 2026-11-03) - delete ONLY the two release-engineer '(haiku)' Example-suffix assertion blocks in test/feature-lease.test.mjs (base lines 1533-1540 in E9A-S5, 1680-1687 in E17-S4); no other line of that file (spec AC11) | depends_on: T-E392-03
