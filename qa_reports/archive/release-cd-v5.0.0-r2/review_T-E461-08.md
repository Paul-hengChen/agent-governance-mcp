# QA review — T-E461-08

<!-- Auto-appended by tw_update_state(qa_review=...). -->

## 2026-11-25T10:43:35.857Z — PASS — by code-reviewer

suite-result: 4674/4676 passed (server-recorded from qa_suite_result; command: node scripts/test-lock.mjs -- npm test)

APPROVED. Judge re-ran every named mutation in a throwaway copy: M1a (5/5 AC1 red), M1b, M1c (AC3 red), M1d (AC4 red), M2a/M2b/M2c/M2d/M4 (e461 AC4/AC5/AC6/AC7/AC8 red), M5 (e435 AC4 red), M6a, M6b (e419 full-report / boundary red), M7a (ReadMe.md test red), M7b (rounding test red; also reds an existing e422 test) and M7b' (only the rounding test red, old e422 file 53/53 green, so AC14 proven), M9a (smoke qa PASS line [FAIL], exit 1); old base tests stayed green under M1a-M1d, M5, M6a, M6b, M7a, M7b', M9a. AC15: CLAUDE.md +1 line in a full-history clone, branch AC12 pass, old AC12 red. AC10: sqlite module throwing on import, exit 0 with both SKIP lines carrying the reason. AC16/AC18: smoke 12/12, exit 0. Scope inside the e461 owned set; no source/content/dist/docs change; no e462 source-text read; no git show / SHA pins in added lines. Full suite 4674/4676 (2 base skips), 0 fail. Expected-red manifest zero entries, zero actual reds. Recommended: R1 NEGATED bare no/not can mask a clause (spec-accepted limit); R2 M7b not a pure base survivor, M7b' shows the gap. Optional: O1 e419 earlyReturns strings hard-coded; O2 zod issue-count coupling.

