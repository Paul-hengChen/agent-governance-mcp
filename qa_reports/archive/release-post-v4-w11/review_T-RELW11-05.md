# QA review — T-RELW11-05

<!-- Auto-appended by tw_update_state(qa_review=...). -->

## 2026-10-29T03:50:27.852Z — PASS — by qa-engineer

PASS T-RELW11-01..05 on main@3cd4eaf, Node v22.22.3, vs current 4.13.0. AC1 66 commits/102 paths/28 dist, untouched set empty, all paths in lane classes; AC2 11 QA files pass=1 fail=0, 4 lane handoffs PASS, ledgers 2/10/3/5, ancestry+second parents ok; AC3 full suite under test lock exit 0, 3751 tests/3749 pass/0 fail/2 skipped; AC4 dist identical, check-version/bookkeeping/md-tables ok; AC5 audit high exit 0 (7: 1 low 6 moderate), one-line zod floor, 7-entry lockfile delta, sections 8/9 in 14fa252 before 8adb9ba, triggers not fired; AC6 agc check + transitions-sync ok; AC7 ten CI runs success with test(20)+test(22); AC8 fanout validate/owners 102/77/4 (56/8/6/7, 15 multi), handoff closing/check, usage 5 lines exit 2, 199/199 tests; AC9 author-gate probe rejected pm APPROVED/CHANGES_REQUESTED unchanged, 35/orchestrator/false/18, 265/265; AC10 filename probe 7 same + 7 CHANGED enc-ok, 3 distinct files, 183/183; AC11 129/129, covers probe ["A","B","C"] ["A","A"] ["A"] im; AC12 guard linkPublish, exit 64, 201/201; AC13 non-regression groups 232/336/250 pass, counts 35/13/12, test files 210 vs 203. No findings. Evidence: qa_reports/review_T-RELW11-01.md (covers T-RELW11-01..05).

