# QA review — T-E243-03

<!-- Auto-appended by tw_update_state(qa_review=...). -->

## 2026-09-28T09:40:00.000Z — PASS — by qa-engineer

Completion evidence for T-E243-03 (sr-engineer: widen the shared unsafe-segment predicate +
rewrite the two runtime messages + the `docs/install.md` sentence + the AC14 display-escaping
helper). Recorded by hand because the qa-engineer:PASS state written for T-E243-04 earlier this
round is terminal (`tools/transitions.ts` excludes `qa-engineer:PASS -> qa-engineer:PASS` by
design, E86) — no further `tw_update_state` write is legally available to this role in this
workspace this round, so this task's completion is recorded via its own evidence file plus
`tw_complete_task` directly (the tool's own evidence path, independent of the `ALLOWED_TRANSITIONS`
state machine — `gates/registry.ts`'s `QA_COMPLETION_EVIDENCE_MISSING` comment: "tw_complete_task is
untouched (own evidence path)").

**Verdict basis** — two independent sources, both already on record before this note:

1. **Code review**: `review_reports/review_T-E243-03.md`, round 1, **APPROVED** by code-reviewer.
   Every AC in T-E243-03's scope (AC1-AC11, AC14, plus the AC6/AC7/AC13 code-level confirmations)
   was checked black-box against the diff `9a07f6b..HEAD` (code commit `b1e1b5c`) — see that file for
   the full per-AC breakdown. One optional, non-blocking finding (a stale comment at
   `bin/agc-init.mjs:1129-1130`).
2. **This round's own T-E243-04 test suite** (`qa_reports/review_T-E243-04.md`) independently
   exercises the same implementation black-box, AC by AC:
   - AC1 -> `test/e239-init-subdir-exclude.test.mjs` "AC15: backslash subdir name refuses local
     mode cleanly" — pass.
   - AC2 -> "AC16: CR/LF subdir name refuses local mode cleanly" — pass.
   - AC3 -> "AC17: other C0/DEL subdir name refuses local mode cleanly" — pass.
   - AC4 -> existing "AC8"/"AC9" cases (wildcard regression guard) — pass.
   - AC5 -> "AC18: backslash/control-character subdir name is fine under explicit repo mode" —
     pass.
   - AC6 -> "AC19: agc check advises rather than mis-tests on a backslash/control-character path"
     — pass.
   - AC7 -> `test/e108-eject.test.mjs` "AC7 (E243): eject skips the exclude-line plan entry cleanly
     on a wildcard or backslash workspace, same shape for both" — pass.
   - AC8 -> architectural grep (`GITIGNORE_UNSAFE_SEGMENT_RE` — one definition, one use site, no
     second character-class test at any of the three callers).
   - AC9/AC10/AC11 -> grep pair against `bin/agc-init.mjs` and `docs/install.md` (old four-character
     enumeration gone from all three surfaces; new copy present verbatim).
   - AC13 -> every new/modified test case in this round carries a `process.platform === "win32"`
     loud-skip guard, confirming the claim is exercised (skipped, not silently ignored) on that
     platform.
   - AC14 -> "AC20: message printed for a CR/LF/ESC segment contains no raw control byte" — pass,
     both the `init` refusal and the `agc check` advisory.

Repro-first red against base `3663b3a` (`qa_reports/review_T-E243-04.md`'s own section) confirms
the defect T-E243-03 fixes actually existed beforehand.

Full suite after T-E243-04's commits: 2914/2917 pass, 0 fail, 3 pre-existing unrelated skips
(`qa_reports/review_T-E243-04.md`, Phase 4).

**Verdict: PASS.** Marking T-E243-03 complete in the task ledger via `tw_complete_task`.
