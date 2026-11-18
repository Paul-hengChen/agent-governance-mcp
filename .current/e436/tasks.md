<!-- schema_version: 2 -->
# Tasks

## e436-stale-paths-tool-contracts

- [ ] T-E436-01 [sr] CLAUDE.md: apply S1-S5 exact replacements from specs/e436-stale-paths-tool-contracts.md (lines 13, 220-221 -> .current/_primary/handoff.md; 44, 64, 195 -> .current/<lane>/handoff.md); agc-version stamp untouched. AC1. Files: CLAUDE.md
- [ ] T-E436-02 [sr] templates/claude-code-agents/release-engineer.md: line 9 final sentence reworded (D2), line 13 path -> .current/<lane>/handoff.md keeping CRITICAL:/NEVER; line 7 untouched (E442). AC2. Writes qa_reports/expected-red_e436-stale-paths-tool-contracts.txt for the probe reds. Files: the template, the manifest
- [ ] T-E441-01 [sr] tools/registry.ts: replace the description of tw_get_state, tw_update_state, tw_get_next_task, tw_rollback_task, tw_void_task, tw_detect_drift verbatim from the spec (string-only; no schema/zod/handler/order change); npm run build -> dist/tools/registry.*. AC3-AC7. Files: tools/registry.ts, dist/tools/registry.*
- [ ] T-E436-03 [qa] Re-pin the E436 reds in the qa-owned set (spec Test impact list) and add test/e436-*.test.mjs pinning AC1 (CLAUDE.md paths, stamp unchanged) and AC2 (template 13 lines, line 7/11 byte-identical, new line 9, lane path on line 13). Owned only: e9a AC2 in subagent-templates, E9A-S4 in feature-lease
- [ ] T-E441-02 [qa] Add test/e441-*.test.mjs: AC3 (six descriptions equal the spec strings, other entries/schemas/order unchanged), AC5 (tw_get_state blocked list == enforcePreFlight call-site names, derived by scanning tools/), AC6 (no specs/ path, MANDATORY, ticket id, stale void claims); AC4 by review of the claim tables
