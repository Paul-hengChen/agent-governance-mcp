# Pending tickets — lane e231

## Applied

```pending-ticket
lane_local_id: E231-NEW-1
title: No mechanical check catches a new instance of the information-hygiene rule's banned classes once it ships
priority: P3
depends_on: [E231]
source: pm cut, specs/e231-info-hygiene-rule.md Decision §4 (split out per the fine-grained-ticket default)
body: |
  **No mechanical check catches a NEW instance of E231's banned classes once that rule ships** (filed 2026-09-28, split out of E231's cut per the fine-grained-ticket default — same gap E232 describes for the pre-existing leaks, but forward-looking). Add an advisory scan (e.g. an `agc check` pattern-based check) for the classes E231 bans — internal URLs/work-item links, third-party client/project codenames, design-tool file keys, credentials, absolute local paths/usernames — over tracked files, warn-only (false positives are acceptable since it never blocks). Depends on E231 shipping first so the scan's patterns target the rule's finished wording rather than a moving target.
```

```pending-ticket
lane_local_id: E231-NEW-2
title: Committed handoffs and fan-out manifests carry absolute local paths that expose a username
priority: P2
depends_on: [E231]
source: e231 lane cut pre-review with the integrator, 2026-09-28
body: |
  The server writes absolute local paths into machine fields that get committed: a lane handoff's `prd_path` (and any other absolute-path field that persists into `.current/<lane>/handoff.md`, which lanes commit on their branch). The fan-out manifest format has the same problem, because its worktree column requires an absolute worktree path (`specs/fanout-*.md`). Both leak a local username into tracked history, which is the class the information-hygiene rule bans. The rule itself treats a value a tool's input schema requires verbatim as protocol, so the fix belongs in the server and the manifest format, not in role behaviour: for example, store paths relative to the primary checkout or the lanes root, and resolve them at read time. Cover both surfaces in one fix.
```

```pending-ticket
lane_local_id: E231-NEW-3
title: A rejected qa PASS write still appends a PASS section to the evidence file
priority: P2
depends_on: none
source: e231 lane qa hop, 2026-09-28 (coordinator confirmed from the committed evidence files)
body: |
  The handoff write path records the qa_review text into `qa_reports/review_<task>.md` before it runs the expected-red check. When that check rejected the qa write (the report heading did not match the exact anchor), the evidence files had already gained a timestamped PASS section, and one file was created from nothing. The durable record now shows a PASS the server never accepted. Fix: run every rejecting check before any evidence write, or roll the evidence append back when the write is rejected. Pin it with a test that sends a write the expected-red check rejects and asserts the evidence file is unchanged. Example in this lane: `qa_reports/review_T-E231-04.md`, section timestamped 17:08:38Z.
```

```pending-ticket
lane_local_id: E231-NEW-4
title: Tasks completed after a PASS cannot reach the handoff's completed list, which leaves drift that cannot be cleared
priority: P3
depends_on: none
source: e231 lane closeout, 2026-09-28
body: |
  qa's PASS write recorded only the tasks qa built. The builder's two tasks were then closed with the task-completion tool, which updates `tasks.md` but not the handoff's `completed_tasks`. A same-state PASS write to add them is rejected (no PASS to PASS transition), so the drift check keeps reporting "tasks marked done that the handoff doesn't mention" with no sanctioned way to clear it. Two fixes are needed: the qa SOP should say the PASS write lists every task in the feature, not only qa's own; and the task-completion tool (or the sync tool) should reconcile the handoff after a PASS.
```
