# QA review — T-E21-01

<!-- Auto-appended by tw_update_state(qa_review=...). -->

## 2026-07-15T03:52:21.381Z — PASS — by qa-engineer

PASS. Both E20 (long-run-ends-in-turn hard line) and E21 (crash checkpoint via bookkeeping_write) content-only lines verified in skill-qa-engineer.md + skill-sr-engineer.md against the actual backlog rows AND independently against the server's bookkeeping_write implementation (tools/registry.ts zod description + tools/handoff-orchestrator.ts L323-357/L1147-1153: file-mode only, preserves on-disk last_updated verbatim, rejects cross-feature use). Found + fixed one accuracy gap the code-reviewer flagged as non-blocking: neither E21 line caveated file-mode-only — added a short "(file-mode only)" parenthetical to both (cheap, in-round, no sr bounce). Templates re-confirmed as thin pointers, no mirror needed. Re-baselined 2 byte/token budget pins the +bytes legitimately tripped: test/context-budget.test.mjs skill-sr cap 2642->2852 (exact re-measure, no headroom); test/qa-visual-skill-split.test.mjs AC-5 skill-qa-engineer.md cap 14729->15500 (~379-byte headroom). Authored test/e20-e21-crash-resilience.test.mjs (13 new pins: origin tags, ordering, bookkeeping_write=true + agent_id, the file-mode-only caveat, cross-file contract consistency). npm run build clean; npm test run synchronously to completion this turn: 1485/1485 pass (1472 + 13 new), 0 fail. Full detail in qa_reports/review_T-E20-01.md (covers: T-E20-01, T-E21-01).

