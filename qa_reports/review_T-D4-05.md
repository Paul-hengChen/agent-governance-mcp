# QA review — T-D4-05

<!-- Auto-appended by tw_update_state(qa_review=...). -->

## 2026-07-10T13:31:33.561Z — PASS — by qa-engineer

PASS — T-D4-03/05/06. Authored test/eval/lib/assertions.mjs (4 pure checkers: checkWatermark delegates to validateWatermark from dist/lib/watermark-check.js per AC-2; checkTerseCap honors all 4 const-01 §1 exemptions per AC-3; checkEscalationShape validates the canonical 4-key tw_update_state shape per AC-4/const-05 §3; checkBannedPhrases matches the 4 NO-YAPPING phrases per AC-5). test/eval-assertions.test.mjs (17 tests, top-level test/ dir per AC-6 so it matches the test/*.test.mjs glob) exercises every checker against ≥1 compliant + ≥1 violating fixture, including each terse-cap exemption individually. test/eval/scenarios.mjs (T-D4-06) exports 7 scenarios {id,role,tier,task,assertions} covering sr-engineer completion, qa-engineer PASS, pm ambiguity→Blocked escalation, code-reviewer CHANGES_REQUESTED escalation, lite/haiku-tier, researcher, architect — consumes loadBundle/KNOWN_ROLES from bundle.mjs per AC-7/AC-8, fails loud on unknown role. npm run build clean; npm test 1106/1106 pass (1089 baseline + 17 new). Manually smoke-tested scenarios.mjs (not npm run eval — run-eval.mjs is T-D4-07, out of scope this hop): all 7 bundles resolve non-empty, all checkers verified against synthetic replies, fixture workspace confirmed byte-unchanged (git diff --stat empty). Evidence: qa_reports/review_T-D4-06.md.

