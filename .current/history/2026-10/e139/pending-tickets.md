# Pending tickets (lane e139)

## Applied

```pending-ticket
lane_local_id: E139-NEW-1
title: Quote NON_REVIEWER_VERDICT_REJECTED in constitution prose and flip it to documentedInProse true
priority: P3
depends_on: [E139]
source: lane e139 PM cut (2026-10-28)
body: |
  E139 ships the new authorship code with documentedInProse: false and a "(none)" mapping row,
  so the lane does not touch content/** and the shared generated artifacts (compose goldens,
  context-budget). The rejection envelope is self-explaining, but no role SOP or constitution
  sentence names the code. Candidate site: the review_verdict sentence in
  content/const-08-chain-31-mid.md (Section 3.1) or content/const-05-core-standards.md (Escalation
  call format), in a wave that owns the shared generated artifacts; re-pin goldens and the
  context budget in the same cut.
```

```pending-ticket
lane_local_id: E236-NEW-1
title: In SQLite mode a rejected qa PASS/FAIL write still leaves its reports row
priority: P3
depends_on: [E236]
source: lane e139 PM cut (2026-10-28)
body: |
  E236 rolls back the file-mode evidence append when a write is rejected. In SQLite/HTTP mode
  QA_REVIEW_RECORD calls storage.recordReview, which inserts a reports row before the later
  PASS gates run; a rejection leaves that row behind, the same record-integrity defect E236
  fixed for files. The fix lives in tools/storage-sqlite.ts (e.g. record inside a transaction
  committed only after writeState, or an undo handle), which the e139 lane may not touch.
```

```pending-ticket
lane_local_id: E136-NEW-1
title: lane-status reads the task id back from review_<stem>.md without decoding the E136 encoding
priority: P3
depends_on: [E136]
source: lane e139 PM cut (2026-10-28)
body: |
  tools/lane-status.ts passEvidenceIdsIn derives the id from the filename with
  REVIEW_FILE_RE (/^review_(.+)\.md$/). After E136 the stem is encodeEvidenceId(id): identical
  for canonical ids (T-<TICKET>-NN), but for a non-canonical id (lower case, underscore, other
  characters) lane-status sees the encoded stem and cannot match it to the ledger id, so such a
  task would read as lacking PASS evidence. Add a decodeEvidenceId next to encodeEvidenceId in
  tools/evidence-file.ts and use it in lane-status (not editable by lane e139).
```

```pending-ticket
lane_local_id: E136-NEW-2
title: The active_feature path sanitisers are the same lossy projection E136 removed for task ids
priority: P4
depends_on: [E136]
source: lane e139 PM cut (2026-10-28)
body: |
  specFilePath (gates/ac-execution.ts), expectedRedManifestPath (gates/expected-red.ts) and
  designFilePath (gates/visual.ts) map active_feature through replace(/[^A-Za-z0-9._-]/g, "_")
  plus a ".." collapse, so two feature names differing only in case or in sanitised characters
  resolve to one spec/design/manifest file. Feature names are human-chosen slugs, so the
  exposure is lower than for task ids; out of the e139 scope (task-id evidence paths only).
```
