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

## Applied
