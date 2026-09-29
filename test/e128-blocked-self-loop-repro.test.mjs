// Coded by @sr-engineer
// Minimal bugfix-mode repro for the rejected self-correcting Blocked->Blocked
// write (backlog E128, docs/backlog.md ~line 250) / skill-sr-engineer step 3b repro-first carve-out. NOT full coverage —
// that is qa-engineer's job (T-QA-E128-01). This file exists only to prove
// RED against the un-fixed tools/transitions.ts before the fix landed, per
// qa_reports/expected-red_e128-blocked-self-loop.txt.
//
// Literal incident case (2026-09-15, E111 release): release-engineer's
// tw_update_state malformed its own payload while status=Blocked; the
// correcting same-agent, same-status write was rejected with
// TRANSITION_REJECTED — "No edge release-engineer:Blocked ->
// release-engineer:Blocked" — because validateTransition's step-3 self-loop
// fast path only recognizes In_Progress->In_Progress, and the static
// ALLOWED_TRANSITIONS table has no release-engineer:Blocked ->
// release-engineer:Blocked edge either.
//
// This test asserts the DESIRED post-fix behavior (the self-correcting write
// is accepted) so it is RED against today's un-fixed code (validateTransition
// currently returns a TRANSITION_REJECTED envelope here, not null) and turns
// GREEN once the step-3 fast path grows the named Blocked->Blocked pair.

import { test } from "node:test";
import assert from "node:assert/strict";

import { validateTransition } from "../dist/tools/transitions.js";

test("E128 repro: release-engineer:Blocked -> release-engineer:Blocked is accepted (the incident case, fixed)", () => {
  const result = validateTransition({
    prev: { agent: "release-engineer", status: "Blocked" },
    next: { agent: "release-engineer", status: "Blocked" },
    prev_qa_round: 0,
  });
  assert.equal(
    result,
    null,
    `expected acceptance (null), got rejection: ${JSON.stringify(result)}`,
  );
});
