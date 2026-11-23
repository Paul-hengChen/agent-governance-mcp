# Pending tickets — lane e433

```pending-ticket
lane_local_id: E433-NEW-1
title: doc-writer SOP's closing state write is rejected by the server after a PASS
priority: P3
depends_on: none
source: code-reviewer, E433 review round 1 (recommendation 4, review_reports/review_T-E433-01.md)
body: |
  The doc-writer SOP runs after the chain's judge has written PASS and tells doc-writer to
  finish with tw_update_state(status=In_Progress, agent_id=<upstream caller>, ...), i.e.
  (code-reviewer, PASS) -> (code-reviewer, In_Progress) on the new chain, or
  (qa-engineer, PASS) -> (qa-engineer, In_Progress) on the old one. The transition table
  allows neither edge, so a doc-writer following its SOP gets TRANSITION_REJECTED and its
  doc update is never recorded. The defect predates E433 (E433 only changed the role name
  in content/skill-doc-writer.md). Fix: give doc-writer a closing write the server accepts
  (for example, no state write at all, or a same-tuple PASS amendment if the server allows
  it), and pin it with a test.
```

## Applied
