# Pending tickets — lane e260e

```pending-ticket
lane_local_id: E260E-NEW-1
title: Comment accuracy fixes in e260e test files left after the E260 trim (stale fallback claim, two dead report pointers)
priority: P3
depends_on: [E260]
source: code-reviewer round 2 (review_reports/review_T-E260E-12.md, N1, N2) and fresh qa verifier (qa_reports/review_T-E260E-12.md), lane e260e (2026-10-01)
body: |
  Comment-only, non-blocking at review; all three were already wrong at base bdbffaf and sat outside
  the lines the lane trimmed.
  N1: test/drift-skew.test.mjs (comments near lines 34-39 and 171-172) still says the skew precheck has
  no flat-path fallback; tools/drift.ts falls back from the lane path to the flat path, and the same
  file's AC8 test covers it. Round 1 fixed the same claim at lines 66-69 only.
  N2: specs/e260e-comment-rationale.md (near line 50) cites the e73 expected-red report at its
  pre-archive qa_reports/ root path; it now lives under qa_reports/archive/e73-agc-feature-lifecycle/.
  Verifier: test/agc-adapters.test.mjs line 5 points to a qa_reports review file that does not exist at
  base or HEAD; repoint it or drop the pointer.
  Each fix must stay comment-only (removeComments emit byte-identical).
```

## Applied
