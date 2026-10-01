# Pending tickets — lane e260h

```pending-ticket
lane_local_id: E260H-NEW-1
title: test/subagent-templates.test.mjs still maps the teamwork template to the retired content/skill-coordinator.md
priority: P3
depends_on: [E260]
source: code-reviewer, e260h review (review_reports/review_T-E260H-11.md, optional follow-up)
body: |
  The comments near the top of test/subagent-templates.test.mjs and the expected-reference
  table (the `teamwork` entry and its regex) name content/skill-coordinator.md, which was
  retired when the coordinator SOP split into content/coord-NN-*.md fragments (T-D6-04).
  The comment wording is carried over unchanged from base, and the table is code, so the
  comment-only E260 lane cannot fix it. Decide what the teamwork template should be
  checked against today, then fix the table and its comments together (qa-engineer owns test/).
```

```pending-ticket
lane_local_id: E260H-NEW-2
title: Comment accuracy fixes in e260h test files left after the E260 trim (pixel-gate-attestation header names the wrong dist file; qa-flow rationale has no pointer)
priority: P3
depends_on: [E260]
source: qa-engineer verifier, e260h T-E260H-26 (qa_reports/verify_E260H_T-E260H-26.md, findings F1, F2)
body: |
  Comment-only, non-blocking at QA. F1, stale at base: the header of
  test/pixel-gate-attestation.test.mjs says the verbatim error-string tests (E) read
  dist/index.js; they read dist/tools/handoff-orchestrator.js and dist/gates/registry.js,
  as the file's own later comment says. The trim carried the wrong location over.
  F2: specs/e260h-comment-rationale.md has a test/qa-flow.test.mjs section holding two
  points no other spec records, but nothing in test/qa-flow.test.mjs points to it; add a
  one-line pointer. Both edits are in test/, so qa-engineer authors them.
```

## Applied
