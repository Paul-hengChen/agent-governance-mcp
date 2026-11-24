# Pending tickets — lane e435

```pending-ticket
lane_local_id: E435-NEW-1
title: MISSING_REVIEW_EVIDENCE never fires on the test-first chain, so batched code-review evidence is unchecked
priority: P3
depends_on: [E435]
source: architect, E435 architecture (Findings outside scope 1); integrator OQ pre-review notes it has been dormant since E431
body: |
  The review-evidence check (pipeline step 17) arms only on the code-reviewer In_Progress -> qa-engineer In_Progress
  hand-off. The test-first chain never takes that hand-off, and E435 removes it, so the check never runs: evidence
  under review_reports/ is no longer checked anywhere, while content/skill-code-reviewer.md still cites the code for
  batched covers: reports. Fix: re-arm the check on the code-reviewer PASS write, or remove the gate, its registry
  entry and the content quote together (error-code contract).
```

## Applied
