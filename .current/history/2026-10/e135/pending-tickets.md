# Pending tickets — lane e135

## Applied

```pending-ticket
lane_local_id: E150-NEW-1
title: tw_void_task keeps refusing, and tw_sync re-marks, an id rolled back without a paired qa FAIL write
priority: P3
depends_on: [E150]
source: e135 architect, specs/e135-handoff-notes-ledger-architecture.md Open Question 1 (human ruled accept + file, 2026-10-21)
body: |
  With E150's carry-forward, handoff.completed_tasks keeps an id across same-feature writes
  until a qa-engineer FAIL write names it in review_task_ids. tw_rollback_task edits only
  tasks.md, so an id rolled back WITHOUT that FAIL write (off-SOP; every qa SOP FAIL row pairs
  the two) stays in the ledger: voidTaskInFile keeps refusing it ("roll it back first"), and
  tw_sync would re-mark it [x]. Before E150 any later omitting write emptied the ledger, so the
  window was short. Fix shapes: the void refusal message names the qa FAIL step, or
  tw_rollback_task removes the id from the handoff ledger (tools/tasks-file.ts, out of the e135
  lane's bounds).
```

```pending-ticket
lane_local_id: E150-NEW-2
title: qa-visual SOP Phase 1.5 FAIL rows omit review_task_ids, so the call is rejected and the E150 ledger shrink never runs
priority: P3
depends_on: [E150]
source: e135 architect, architecture finding F2; integrator pre-review round 2 (to-lane#3)
body: |
  content/skill-qa-visual.md's Phase 1.5 FAIL rows show tw_update_state(status=FAIL, ...,
  qa_review=...) without review_task_ids. The server already rejects that call with
  QA_REVIEW_TARGET_REQUIRED (pre-existing). The qa-engineer Escalation Routes format line (FAIL
  rows carry qa_review plus review_task_ids) governs, and that shape is also the one that removes
  the failed ids from the carried completed_tasks ledger after E150. Align the visual rows with
  it (content/** change, goldens and context budget re-baselined).
```

```pending-ticket
lane_local_id: E150-NEW-3
title: ledger removal on a qa FAIL write reuses tw_sync's whole-word match, so removing T-CR-02 also removes T-CR-02-REV
priority: P3
depends_on: [E150]
source: integrator pre-review round 2 (to-lane#3), note on the e135 architecture
body: |
  The E150 shrink removes ledger entries that match a review_task_ids id with the same \b
  whole-word pattern tw_sync uses. "-" is a word boundary, so removing T-CR-02 also removes a
  hyphen-suffixed id such as T-CR-02-REV. This is consistent with tw_sync's existing matching and
  is left unchanged in the e135 lane. A later fix would tighten both matchers together (e.g. an
  id terminator that excludes "-"), so the ledger and tw_sync never disagree.
```
