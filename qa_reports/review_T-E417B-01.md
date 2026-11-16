# QA review — T-E417B-01

<!-- Auto-appended by tw_update_state(qa_review=...). -->

## 2026-11-16T08:49:36.744Z — PASS — by qa-engineer

suite-result: 4226/4228 passed (server-recorded from qa_suite_result; command: npm test)

Phase 0.5: skipped (no expected-red manifest declared). Phase 3.5: skipped (no proof:-annotated ACs; no specs/e417b-spec-text.md).

## AC1 verdict table (run, not read): lane's built dist/tools/merge-invariants.js, scratch git repos in OS temp dir. P2 = compacting side adds A04 then compacts M(4); kept row A03.
| shape | merge count | verdict |
|---|---|---|
| S1 (P1 = base, keep A03 [x]) | M(3) / M(4) | FAIL MISSING A01,A02 (c) / PASS |
| N03 (P1 edits A03 text + adds D01; merge keeps both) | M(3) / M(4) | FAIL A01,A02 / PASS |
| N04 (same, merge keeps A03 under ## Other) | M(3) / M(4) | FAIL A01,A02 / PASS |
| kept row open at base, both sides close it | M(3) / M(4) | FAIL A01,A02 / PASS |
| other side voids kept row (merge keeps [-]) | M(3,1) / M(2,1) / M(4,0) / M(3,0) | PASS / FAIL / FAIL / FAIL (only the count placing it in the voided column passes) |
| other side reopens kept row (merge keeps it open) | M(3) / M(4) / M(2) | PASS / PASS / FAIL (M(2) is the snapshot check, a different rule) |
| kept row left open at merge, other side done | M(4) | FAIL, missing=[] , lost completion A03 only (no MISSING row) |
| (same) | M(3) | FAIL, MISSING A01,A02 plus lost A03 |
| N02 (no post-base row, M(2)) | M(2) | FAIL A01,A02 (pre-E417 rule) |
All verdicts match the spec paragraph (e126 step 7) and the F-1/F-2 round-2 wording.

## AC2 / AC3 / AC4
AC2: all mentions of the seven guards say qa-engineer/qa-owned (e126 AC12 header and guard group, Task->AC table; architecture lines 15 and 155); no remaining sr-engineer claim on them. AC3: step 3/p3 text (e126:243-245) states the git error text when `git version` fails; matches probeHistoryReadable (detail from historyErrorDetail(err,'version')), also verified by review. AC4: git diff 391f581..HEAD is two spec files only; no absolute paths, usernames, URLs or codenames in added lines.

## Named tests
E417 S1, E417 N03, E417 N02, E417 G7 exist with the exact names in test/e417-merge-invariants-history.test.mjs; no test keeps A03 under ## Other, so the spec's 'N04 has no test' is true.

## Test change (pre-authorized)
Comment-only fix near the N03 fixture: 'higher count' -> 'lower count M(3) (P2's M(4) minus the kept row)'. No body/name/assertion change. No new tests added (decision disclosed above).

## Gates
npm run build: clean tree. npm test (Node 22): 4226/4228 pass, 0 fail, 2 skipped. Node 20.20.2: e126, e203, e417 merge-invariants test files 57/57 pass, 0 fail (no sqlite environment failures hit; full Node 20 run not done). agc check exit 0. After the comment edit: e417 history file re-run 21/21 on Node 22.

