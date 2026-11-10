# QA review — T-E406-02

<!-- Auto-appended by tw_update_state(qa_review=...). -->

## 2026-11-10T06:34:11.557Z — PASS — by qa-engineer

suite-result: 4129/4131 passed (server-recorded from qa_suite_result; command: node scripts/test-lock.mjs -- npm test)

All four tasks PASS. E406: e394 fixture re-pinned (content/foo.md committed in template, edited in workTree; ALLOW gains add --update; L:E71b spaced path is a tracked change); new E406 cases for AC-E406-1/2/3/4/6/7 and AC-R11 add-shapes; e394 65/65. E203: five cases in test/e203-merge-invariants-union.test.mjs (AC-E203-1/3/4/6/7); R-1 5-vs-4 and all e126 cases unchanged and green. Expected-red manifest: 27/27 entries now green, 0 unexplained reds (see qa_reports/review_T-E406-01.md Expected-Red Diff). Full suite 4129 pass, 0 fail, 2 documented skips. build leaves no dist diff; npm audit high exit 0; check:bookkeeping exit 0; agc check OK. Cherry-pick-shaped false negative is an accepted spec limit, not asserted. Optional: release-staging AC2 comment left as is; E203-NEW-1 pending ticket already records the post-base compaction limit.

