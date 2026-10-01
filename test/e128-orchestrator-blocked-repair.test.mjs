// Coded by @qa-engineer
// Orchestrator end-to-end regression guard (E128): a same-agent Blocked->Blocked repair
// write must land through the real 18-step pipeline, not just pass validateTransition.
// Drives handleUpdateState from dist/ against a scratch workspace, replaying the 2026-09-15
// release incident. After the repair: fields persist, status stays Blocked, hop_count and
// next_role are untouched, and the feature lease is not released.
// Rationale: specs/e260f-comment-rationale.md (test/e128-orchestrator-blocked-repair.test.mjs).

import { test } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

import { writeHandoffState, parseHandoff } from "../dist/tools/handoff.js";
import { resetSession, markStateRead } from "../dist/guards/session.js";
import { setActiveStorage, FileHandoffStorage } from "../dist/tools/storage.js";
import { handleUpdateState } from "../dist/tools/handoff-orchestrator.js";
import { forceSeedStamp } from "./e148-seed-stamp.mjs";

function mkWs(prefix = "e128orc-") {
  const ws = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  fs.mkdirSync(path.join(ws, ".current"), { recursive: true });
  return ws;
}

// Seeds a cut-approved pm:In_Progress state directly via the library writer
// (bypassing the orchestrator, same pattern as feature-lease.test.mjs's
// seedFileState / repro-first-gate.test.mjs's seedSrEngineerBugfixState) —
// only the edges under test are driven through the real handleUpdateState
// pipeline. No design/<feature>.md exists in this workspace, so the
// arm-gated SCOPE_DECISION_REQUIRED gate never fires and cut_approved alone
// clears CUT_APPROVAL_REQUIRED for the sr-engineer build-entry hop below.
async function seedCutApprovedPm(ws, feature) {
  resetSession(ws);
  markStateRead(ws);
  await writeHandoffState({
    workspacePath: ws,
    activeFeature: feature,
    status: "In_Progress",
    completedTasks: [],
    pendingNotes: ["pm: cutting the ticket"],
    lastAgent: "pm",
    cutApproved: true,
  });
  // Force the seed's last_updated off the wall clock (see test/e148-seed-stamp.mjs). The
  // hop chain below reads off each accepted write's own server stamp with no re-read
  // between hops (the incident's no-re-read shape, deliberately not re-seeded), so each hop
  // keeps the usual ~1/60000 residual collision chance.
  forceSeedStamp(ws);
}

test("E128-ORC: sr-engineer self-repairs a malformed Blocked record through the real 18-step pipeline WITHOUT releasing the feature lease", async () => {
  setActiveStorage(new FileHandoffStorage());
  const ws = mkWs("e128orc-repair-");
  const feature = "e128orc-incident";
  await seedCutApprovedPm(ws, feature);

  // Hop 1: pm -> sr-engineer (real build-entry hop, driven through the
  // orchestrator so hop_count actually ticks to 1 via the real pipeline, not
  // a seeded value).
  resetSession(ws);
  markStateRead(ws);
  const entry = await handleUpdateState({
    workspace_path: ws,
    active_feature: feature,
    status: "In_Progress",
    agent_id: "sr-engineer",
    completed_tasks: [],
    pending_notes: ["sr-engineer: starting the fix"],
  });
  assert.ok(!entry.isError, `pm -> sr-engineer build-entry hop must succeed: ${entry.content?.[0]?.text}`);
  assert.equal(parseHandoff(ws).hop_count, 1, "the build-entry hop must tick hop_count to 1");

  // Hop 2: sr-engineer halts with a malformed payload — the incident's own
  // shape (an argument tag leaked, so pending_notes landed empty and its
  // content was absorbed into blocking_reason as literal markup).
  const halt = await handleUpdateState({
    workspace_path: ws,
    active_feature: feature,
    status: "Blocked",
    agent_id: "sr-engineer",
    completed_tasks: [],
    blocking_reason: 'MALFORMED <parameter name="pending_notes">leaked',
    pending_notes: [],
  });
  assert.ok(!halt.isError, `the initial (malformed) Blocked write must itself succeed — it is a real halt: ${halt.content?.[0]?.text}`);
  const afterHalt = parseHandoff(ws);
  assert.equal(afterHalt.status, "Blocked");
  assert.equal(afterHalt.hop_count, 1, "a same-agent status change (In_Progress -> Blocked) is not a role transition and must not tick hop_count");

  // Hop 3 (THE FIX UNDER TEST): sr-engineer repairs its OWN Blocked record —
  // same agent, same status. Before the fix this was TRANSITION_REJECTED (no edge
  // sr-engineer:Blocked -> sr-engineer:Blocked existed); now the step-3
  // fast path admits it (E128).
  const repair = await handleUpdateState({
    workspace_path: ws,
    active_feature: feature,
    status: "Blocked",
    agent_id: "sr-engineer",
    completed_tasks: [],
    blocking_reason: "REPAIRED: awaiting human on tagged unpushed release",
    pending_notes: ["sr-engineer: corrected the malformed payload, still blocked on the human release decision"],
  });
  assert.ok(
    !repair.isError,
    `the same-agent Blocked->Blocked repair write must be ACCEPTED by the real pipeline: ${repair.content?.[0]?.text}`,
  );

  const afterRepair = parseHandoff(ws);
  // 1 + 2: corrected fields persist, status is not misstated.
  assert.equal(afterRepair.status, "Blocked", "status must stay Blocked — the repair must never misstate progress as In_Progress");
  assert.equal(
    afterRepair.blocking_reason,
    "REPAIRED: awaiting human on tagged unpushed release",
    "the corrected blocking_reason must persist to disk",
  );
  assert.deepEqual(
    afterRepair.pending_notes,
    ["sr-engineer: corrected the malformed payload, still blocked on the human release decision"],
    "the corrected notes must persist to disk, replacing the malformed content",
  );
  assert.equal(afterRepair.last_agent, "sr-engineer", "last_agent must still be sr-engineer after its own self-loop");
  // 3: hop_count is untouched by the repair self-loop.
  assert.equal(afterRepair.hop_count, 1, "hop_count must NOT move across the Blocked->Blocked repair (self-loops are not counted role transitions, DR-9)");
  // 4: no next_role terminal marker was recorded by the repair write itself.
  assert.equal(afterRepair.next_role, undefined, "the repair write must record no next_role terminal marker");

  // 5 (THE PROPERTY THE BACKLOG ROW ACTUALLY ASKS FOR): the feature lease
  // must still be held — proven by driving a DIFFERENT feature's pm entry
  // through the real FEATURE_LEASE gate, mirroring feature-lease.test.mjs
  // FM2 ("Blocked incumbent also rejects a cross-feature write").
  const intruder = await handleUpdateState({
    workspace_path: ws,
    active_feature: "e128orc-a-different-feature",
    status: "In_Progress",
    agent_id: "pm",
    completed_tasks: [],
    pending_notes: ["pm: attempting to start an unrelated feature while the incident feature is still Blocked"],
    cut_approved: true,
  });
  assert.ok(
    intruder.isError,
    "a different feature's pm entry must be REJECTED — the repair must not have released the lease",
  );
  assert.match(intruder.content[0].text, /FEATURE_LEASE_HELD/, "the rejection must be the feature-lease gate specifically, not some other gate");

  // And the incumbent must be untouched by the rejected intruding write —
  // the workspace slot still belongs to the repaired, still-Blocked feature.
  const final = parseHandoff(ws);
  assert.equal(final.active_feature, feature, "the incident feature must remain active_feature — no clobber from the rejected intruder");
  assert.equal(final.status, "Blocked", "the incident feature must remain Blocked, still awaiting the human release decision");
});

test("E128-ORC-2 (negative control): before the repair, the SAME malformed record has no self-correcting edge other than the one E128 adds — a status-misstating edge is what the incident actually hit", () => {
  // Pins the negative shape of the incident, so a reader sees both halves:
  // sr-engineer:Blocked historically reached only In_Progress/pm/design-auditor, never
  // itself (the pipeline test above shows the fix). Imports from the pure module; dist/
  // path convention.
  return import("../dist/tools/transitions.js").then(({ ALLOWED_TRANSITIONS }) => {
    const row = ALLOWED_TRANSITIONS.get("sr-engineer:Blocked") ?? [];
    const hasStaticSelfLoop = row.some((c) => c.agent === "sr-engineer" && c.status === "Blocked");
    assert.equal(
      hasStaticSelfLoop,
      false,
      "the static ALLOWED table must NOT carry a sr-engineer:Blocked -> sr-engineer:Blocked row — the repair edge is deliberately the step-3 fast path only, per the E128 cut's shape (a), not a table edit",
    );
  });
});
