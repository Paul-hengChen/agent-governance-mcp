# QA review — T-E180-01

<!-- Auto-appended by tw_update_state(qa_review=...). -->

## 2026-09-26T19:29:50.771Z — PASS — by qa-engineer

PASS — T-E180-01..05. Authored test/e180-abandoned-harvest.test.mjs covering specs/e180-abandoned-harvest.md AC1-AC13 (13 new tests, all passing), including the amended AC10 copy-over-never-delete semantics and the AC12 adopter-project .gitignore shape against a flat legacy primary .current/. Copy Audit Gate: all 5 Copy/Strings entries verbatim, no drift, no coverage gap. Visual Audit Gate: N/A (no visual literals). Phase 0.5: skipped (no expected-red manifest). Phase 1.5: skipped (no design file). Phase 3.5 AC Execution Log: node --test test/e180-abandoned-harvest.test.mjs (13/13 pass) and node --test test/agc-feature-finish-history.test.mjs (19/19 pass, existing pointer-parsing tests unchanged) — see qa_reports/review_T-E180-05.md. Full suite post-commit, clean worktree: 2661/2661 pass. No required findings; the one code-review-recommended item (cpSync dereference:true) is already tracked as E180-NEW-2, correctly out of this cut.

