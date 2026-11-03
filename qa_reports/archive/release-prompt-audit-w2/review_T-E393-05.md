# QA review — T-E393-05

<!-- Auto-appended by tw_update_state(qa_review=...). -->

## 2026-11-02T10:39:39.629Z — PASS — by qa-engineer

suite-result: 3857/3859 passed (server-recorded from qa_suite_result; command: node scripts/test-lock.mjs -- npm test)

PASS. Phase 0.5 clean: 22/22 expected reds confirmed, 0 unexplained. 12 goldens re-captured, every hunk attributed to an E393 site. Pins re-baselined (context-budget, e178a, e391, e5, e96 x3, phase-0-5); new test/e393-builder-judge-core.test.mjs (6 cases). Budget (no ceiling raised): lean 5711/5723, non-design 8476/8501, design-arm 10475/10598, teamwork 21479/21715, skill-sr stripped 2851/2852, skill-qa bytes 18398/18500; design-only saving floor 2080 -> 1999 per human ruling (spec 15be5f3), measured 1999. dist no diff, agc check exit 0, md-tables OK. Full report: qa_reports/review_T-E393-06.md.

