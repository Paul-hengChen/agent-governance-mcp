# QA review — T442

<!-- Auto-appended by tw_update_state(qa_review=...). -->

## 2026-06-01T11:12:15.305Z — PASS — by qa-engineer

PASS. AC1: CRITICAL: is first non-blank body line in all 12 templates (name+tier substituted verbatim). AC2: haiku example reply suffix present with blank line preceding it in lite/doc-writer/release-engineer; non-haiku templates clean. AC3: new tests added to test/subagent-templates.test.mjs covering AC1 first-body-line contract and AC2 haiku example block + scope guard. AC4: version pin test rewritten 3.21.1→3.21.2. AC5: package.json + index.ts both at 3.21.2 (confirmed). AC6: @lite dispatched 3/3 with short prompts (hi, 2+2, list colors) — all replies end with `— @lite (haiku)`. 464/464 tests green. Report: qa_reports/review_T440-T442.md."

