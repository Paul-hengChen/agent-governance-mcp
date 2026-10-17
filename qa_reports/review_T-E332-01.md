# QA review — T-E332-01

<!-- Auto-appended by tw_update_state(qa_review=...). -->

## 2026-10-17T13:23:10.749Z — FAIL — by qa-engineer

QA round 1 FAIL (report: qa_reports/review_T-E284-01.md, covers all six ids). Implementation verified against every AC; the only defect is a spec text line. Expected-Red Diff: clean (2/2 manifest entries red before re-pin, 0 unexplained). Tests: new e284 (13 cases, AC-E284-1..12), e331 (3), e332 (4); e283 rewritten in-process (17 cases, 5 CLI spawns); e296 AC12 + e322 AC-E322-9 re-pinned to the 5-line usage. Negative controls: e331/e332 fail on the base build; 9 of 10 dist mutants of fanout-handoff killed (1 equivalent). AC-E332-3 sweep: 23 manifests, 0 differ (only wave5.1/wave6 exit 2 with DECISIONS/PINS_SECTION_ABSENT). AC-HC-1 render: 65 lanes, 0 byte diffs. AC-HC-2: lane-status.ts / mailbox-watch.mjs / dist lane-status untouched; HANDOFF_SECTION/SUBITEMS unchanged. T-E333 timing: before 30.47/39.79/36.23 s, after 3.11/2.63/2.66 s. Full suite on 8179ec4: 3342/3345, 1 fail = e234 AC16 hygiene. Two hits were in QA's e332 fixture (fixed in 2b414ee); one remains at specs/e284-fanout-handoff-command.md:239 (D-1). Fix: write that home-dir segment as a placeholder name. Then round 2 re-runs the full suite.

