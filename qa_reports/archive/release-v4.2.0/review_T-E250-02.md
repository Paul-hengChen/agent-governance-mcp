# QA review — T-E250-02

<!-- Auto-appended by tw_update_state(qa_review=...). -->

## 2026-09-28T15:19:24.429Z — PASS — by qa-engineer

T-E250-01..06 PASS. Authored test/e250-eject-path-escape.test.mjs covering AC1-AC11/AC13/AC14 (AC12 verified by grep against docs/config.md). LF/CR/ESC control-byte coverage across workspace path, subdir prefix, linked-worktree name and $HOME, plus an ordinary-path regression (AC7) and a combined-byte boundary case. AC Execution Log: all 14 declared spec proofs pass. Copy Audit Gate: no drift/gap. Repro-red confirmed against base 8437af1 (11/12 new cases red there; byte-identical restore verified, no tree diff left). Full suite green: 2955/2958 pass, 0 fail, 3 pre-existing skips. Evidence: qa_reports/review_T-E250-06.md.

