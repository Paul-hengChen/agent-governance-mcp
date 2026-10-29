<!-- pending-tickets for lane e161 (E179). New blocks go ABOVE ## Applied. -->

## Applied

```pending-ticket
lane_local_id: E161-NEW-1
title: gate the structured qa suite result (qa_suite_result) — passed < total on PASS, required on PASS, non-qa authorship
priority: P2
depends_on: [E161]
source: pm, e161 lane cut (specs/e161-qa-claim-and-state-reads.md, D-E161)
body: |
  E161 (lane e161) adds an optional qa_suite_result {passed, total, command?} argument to
  tw_update_state. On a qa-engineer PASS/FAIL write that records evidence, the server writes it as a
  fixed suite-result: line at the top of the evidence section (file mode) or reports.notes (SQLite).
  It is recorded only, with no rejection. Three follow-ups need new GATE_REGISTRY entries, which
  lane e152 owns this wave, so e161 could not add them:
  (1) a qa PASS whose qa_suite_result has passed < total: reject it, or require an explicit
  disposition (compare the expected-red manifest);
  (2) require qa_suite_result on a qa PASS once the qa SOP tells qa to fill it (pairs with the
  D1-A SOP ticket the integrator files at wave close; landing this gate before the SOP would break
  every qa PASS);
  (3) a non-qa write carrying qa_suite_result is silently ignored today; an authorship rejection
  would mirror NON_REVIEWER_VERDICT_REJECTED.
  A later step could also compare the recorded figure against a machine run (the verify-release
  precedent, E9).
```

```pending-ticket
lane_local_id: E184-NEW-1
title: the role-prompt / SessionStart state block still renders the previous hop's dispatch_mechanism_tier
priority: P3
depends_on: [E184]
source: pm, e161 lane cut (specs/e161-qa-claim-and-state-reads.md, D-E184)
body: |
  E184 (lane e161) drops dispatch_mechanism_tier from the tw_get_state envelope (handleGetState).
  The other read view is prompts/build.ts renderHandoffStateBlock, which the role prompts and the
  opt-in SessionStart hook (bin/agent-governance-context.mjs) use. It renders the full parsed
  handoff, so the tier is still shown there to the role that is about to write. prompts/** and
  bin/** were forbidden to lane e161. Suggested fix: omit the same key in renderHandoffStateBlock
  (or in sanitizeForRender's caller). Expect compose-golden fixtures that carry live state to be
  re-pinned.
```

```pending-ticket
lane_local_id: E366-NEW-1
title: SQLite-mode duplicate review_task_ids hit the reports primary key and throw a raw error; file mode de-duplicates
priority: P4
depends_on: [E366]
source: architect, e161 lane (specs/e161-qa-claim-and-state-reads-architecture.md, OQ-6); integrator asked the lane to file it
body: |
  Existing behavior, not changed by lane e161: a qa PASS/FAIL write whose review_task_ids repeats an
  id records evidence once per id. In file mode the repeat is de-duplicated; in SQLite/HTTP mode the
  second insert collides with the reports table's primary key and the raw database error surfaces
  to the caller. Suggested fix: de-duplicate the target ids before recording in both modes (or
  reject duplicates with a clear message), with a qa test for the SQLite path.
```

```pending-ticket
lane_local_id: E161-NEW-2
title: e177b-mailbox-watch "AC19/AC15 multi-file mode names WHICH file changed" races a fixed wall-clock budget and went red under CI Node 20 load
priority: P3
depends_on: none
source: integrator CI read of lane e161 at 1faf645 (GitHub Actions run 40844508566, job test (20)); lane e161 reproduction attempt
body: |
  CI run 40844508566 on lane e161's HEAD 1faf645: the Node 22 job was green, the Node 20 job failed
  exactly one of 3767 tests, test/e177b-mailbox-watch.test.mjs "AC19/AC15: multi-file mode names
  WHICH file changed and keeps watching the others until the deadline", with
  "expected a changed line naming e204" — the watcher reached its deadline before it observed the
  append. The test starts a real-clock watch with --deadline 0.006 (about 360 ms) and
  --interval 0.05, and appends the message from a setTimeout at 100 ms, so a loaded runner that
  delays the timer or a poll past the deadline turns it red. Same class as E224 and the load-sensitive
  list (E238, E254, E278), but this test is not on that list, so a CI rerun cannot clear it.
  Unrelated to lane e161: the lane changes nothing under scripts/, dist/tools/handoff-parse.js,
  dist/tools/transitions.js or this test file, and on 1faf645 the file passed 5/5 runs under Node 20
  and 5/5 under Node 22 locally (22/22 each).
  Suggested fix: drive the watcher with an injected clock/sleep (as AC16 in the same file already
  does) or append before arming and assert on the first poll, instead of racing a sub-second real
  deadline; or add it to the load-sensitive list with a recorded rationale.
```
