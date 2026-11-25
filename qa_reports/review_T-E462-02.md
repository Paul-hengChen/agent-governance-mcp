# QA review — T-E462-02

<!-- Auto-appended by tw_update_state(qa_review=...). -->

## 2026-11-25T11:01:11.728Z — PASS — by code-reviewer

suite-result: 4695/4697 passed (server-recorded from qa_suite_result; command: node scripts/test-lock.mjs -- npm test)

APPROVED (round 1). AC1-AC8 all pass: AC1 transpileModule(removeComments, ESNext) invariance SAME for all six comment-only files vs 83ca8c0, kept lines intact, no chain_path in changed lines; AC2 direct no-zod resume_of behaviour unchanged (absent hint, not persisted, code-reviewer persisted); AC3 judge-report dir in message, new reports start '# Review — <id>', old-heading reports still credited, EVIDENCE_SCHEMA_CURRENT 3; AC4 unknown mode reported as written with the no-design note, arming unchanged, gates 33 / pipeline 17; AC5 both E461 (3) mutations re-run on this build (prototype removed from KNOWN_MODES -> AC5 tests 1-2 red; last-unknown-wins -> tests 3-4 red; green on restore); AC6/AC7 only the named sentences changed, no error code gained/lost, guide only gained text. Expected-red: all 22 manifest entries green, 0 reds off manifest. Scope: fanout check 44 files 0 out of bounds; dist equals npm run build. npm audit high exit 0. Non-blocking: recommended — gates/expected-red.ts header re-wrap 7->8 lines adds one advisory comment long-block warning; optional — stale wording left at tools/handoff-orchestrator.ts:737-739 and gates/visual.ts:862 (outside spec lines); 40-char cut may split a surrogate pair. Review report: review_reports/review_T-E462-01.md (covers all nine ids).

