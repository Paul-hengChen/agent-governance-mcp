# QA review — T-E84-01

<!-- Auto-appended by tw_update_state(qa_review=...). -->

## 2026-09-16T09:59:00.355Z — PASS — by qa-engineer

PASS. AC1 (E82, 480s default) pinned behaviorally via VR-23 (reads the script's own first poll-progress line, not a grep) — grep proof also independently re-run (n=3 m=0). AC3 (E84 close-out FAILs when HEAD ahead of upstream, skips tag-at-HEAD) pinned via VR-24, confirmed load-bearing by constructing a reversed-range (HEAD..@{u}) mutant in scratchpad and showing it silently PASSes the exact VR-24 fixture shape the shipped script correctly FAILs. AC4 (close-out PASSes on HEAD==upstream, skips Checks 1/3/4/5/6) pinned via VR-25 (absence of each OK: line asserted individually) and VR-26 (invalid package.json still PASSes, proving no version resolution is attempted). AC2/AC5 regression: the pre-existing 32 cases in test/verify-release.test.mjs are byte-unmodified; full file now 36/36 pass. Full repo suite: 1868/1868 pass, 0 fail. npm run build clean. npm run check:md-tables OK (243 files, 0 malformed). npm audit --audit-level=high: exit 0, only moderate/low findings, all pre-existing and unrelated to this diff. QA touched only test/verify-release.test.mjs and qa_reports/review_T-E8284-02.md.

