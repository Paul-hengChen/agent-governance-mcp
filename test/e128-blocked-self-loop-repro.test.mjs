// Coded by @sr-engineer
// Minimal bugfix-mode repro for the rejected self-correcting Blocked->Blocked write
// (backlog E128), the repro-first carve-out of skill-sr-engineer step 3b. Not full coverage.
// Asserts the desired behaviour: a same-agent, same-status Blocked write is accepted by
// validateTransition. Red against the un-fixed tools/transitions.ts, whose self-loop fast
// path knew only In_Progress->In_Progress (qa_reports/expected-red_e128-blocked-self-loop.txt).
// Rationale: specs/e260f-comment-rationale.md (test/e128-blocked-self-loop-repro.test.mjs).

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
