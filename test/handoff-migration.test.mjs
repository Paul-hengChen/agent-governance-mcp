// Coded by @qa-engineer
// T67 / AC-12(e) — handoff schema v1→v2 migration for the code-reviewer chain.
// Covers (1) review_round default of 0 on legacy fixtures, (2) the AC-9
// stderr warning emission when an in-flight ticket sits at
// sr-engineer:In_Progress at migration time. Imports compiled dist/.

import { test } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

import { parseHandoff } from "../dist/tools/handoff.js";
import { resetSession } from "../dist/guards/session.js";

function mkWorkspace(prefix = "twmig-") {
  const ws = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  fs.mkdirSync(path.join(ws, ".current"), { recursive: true });
  return ws;
}

function writeRaw(ws, content) {
  fs.writeFileSync(path.join(ws, ".current", "handoff.md"), content, "utf-8");
}

// ---------- AC-12(e) part 1: review_round default ----------

test("AC-12(e): v1 handoff (no review_round) migrates to v2 with review_round=0", () => {
  // Why: AC-9 mandates the v1→v2 migration default the new field to 0 for
  // legacy fixtures. parseHandoff is the gateway — it composes the runner
  // and the in-memory state assembly. Without the default, downstream
  // transition logic (cap checks, computeNewRound) would NaN-out.
  const ws = mkWorkspace();
  resetSession();
  writeRaw(
    ws,
    `---
schema_version: 1
active_feature: "legacy-feat"
status: "In_Progress"
last_updated: "2026-05-01T00:00:00.000Z"
last_agent: "pm"
qa_round: 2
---
## ✅ Completed
- 無

## ⚠️ Pending & Handoff Notes
- next_role: sr-engineer
`,
  );

  const state = parseHandoff(ws);
  assert.equal(state.active_feature, "legacy-feat");
  assert.equal(state.qa_round, 2, "qa_round survives migration unchanged");
  assert.equal(state.review_round, 0, "review_round defaults to 0 on v1→v2 migration");
});

test("AC-12(e): pre-versioning handoff (no schema_version at all) migrates v0→v2 with review_round=0", () => {
  // Why: the runner walks the full chain. A truly-legacy file with no
  // schema_version key starts at v0, climbs through v1, lands at v2. Both
  // intermediate defaults (qa_round=0 from v0→v1; review_round=0 from v1→v2)
  // must hold.
  const ws = mkWorkspace();
  resetSession();
  writeRaw(
    ws,
    `---
active_feature: "pre-version"
status: "In_Progress"
last_updated: "2026-05-01T00:00:00.000Z"
last_agent: "pm"
---
## ✅ Completed
- 無

## ⚠️ Pending & Handoff Notes
- next_role: sr-engineer
`,
  );

  const state = parseHandoff(ws);
  assert.equal(state.qa_round, 0);
  assert.equal(state.review_round, 0);
});

test("AC-12(e): v2 handoff with explicit review_round=3 round-trips unchanged", () => {
  // Why: forward-compat regression — a file already at CURRENT must not be
  // mutated by the migration runner, and the field must survive the parse.
  const ws = mkWorkspace();
  resetSession();
  writeRaw(
    ws,
    `---
schema_version: 2
active_feature: "current"
status: "In_Progress"
last_updated: "2026-05-01T00:00:00.000Z"
last_agent: "code-reviewer"
qa_round: 0
review_round: 3
---
## ✅ Completed
- 無

## ⚠️ Pending & Handoff Notes
- next_role: sr-engineer
`,
  );

  const state = parseHandoff(ws);
  assert.equal(state.review_round, 3);
});

// ---------- AC-12(e) part 2: AC-9 stderr migration warning ----------

test("AC-12(e) / AC-9: v1→v2 migration emits stderr warning for in-flight sr-engineer:In_Progress ticket", () => {
  // Why: AC-9 mandates a one-shot operator-visible warning when migrating a
  // ticket that is stranded at sr-engineer:In_Progress — the v3.9.0 matrix
  // makes its next move (direct to qa-engineer) impossible, so the operator
  // must manually re-route to code-reviewer.
  const ws = mkWorkspace();
  resetSession();
  writeRaw(
    ws,
    `---
schema_version: 1
active_feature: "in-flight"
status: "In_Progress"
last_updated: "2026-05-01T00:00:00.000Z"
last_agent: "sr-engineer"
qa_round: 0
---
## ✅ Completed
- 無

## ⚠️ Pending & Handoff Notes
- 無
`,
  );

  // Capture stderr by patching process.stderr.write for the duration of the parse.
  const captured = [];
  const orig = process.stderr.write.bind(process.stderr);
  process.stderr.write = (chunk, ...rest) => {
    captured.push(typeof chunk === "string" ? chunk : chunk.toString("utf-8"));
    return true;
  };
  try {
    parseHandoff(ws);
  } finally {
    process.stderr.write = orig;
  }

  const joined = captured.join("");
  assert.match(
    joined,
    /\[code-reviewer migration\] In-flight ticket detected at sr-engineer:In_Progress/,
    `expected AC-9 verbatim warning prefix in stderr; got: ${joined}`,
  );
  assert.match(
    joined,
    /Manually re-route to code-reviewer or roll back to pm\./,
    `expected AC-9 instruction tail in stderr; got: ${joined}`,
  );
});

test("AC-12(e) / AC-9: v1→v2 migration is silent when in-flight state is NOT sr-engineer:In_Progress", () => {
  // Why: the warning is targeted — false-positives on (pm, In_Progress),
  // (sr-engineer, Blocked), or any FAIL/PASS row would create alert fatigue.
  const ws = mkWorkspace();
  resetSession();
  writeRaw(
    ws,
    `---
schema_version: 1
active_feature: "not-in-flight"
status: "Blocked"
last_updated: "2026-05-01T00:00:00.000Z"
last_agent: "sr-engineer"
qa_round: 0
---
## ✅ Completed
- 無

## ⚠️ Pending & Handoff Notes
- 無
`,
  );

  const captured = [];
  const orig = process.stderr.write.bind(process.stderr);
  process.stderr.write = (chunk, ...rest) => {
    captured.push(typeof chunk === "string" ? chunk : chunk.toString("utf-8"));
    return true;
  };
  try {
    parseHandoff(ws);
  } finally {
    process.stderr.write = orig;
  }

  const joined = captured.join("");
  assert.doesNotMatch(
    joined,
    /\[code-reviewer migration\]/,
    `warning must NOT fire for sr-engineer:Blocked; got: ${joined}`,
  );
});

test("AC-12(e) / AC-9: v2 file (no migration applied) does NOT emit the warning", () => {
  // Why: the warning is gated on migration.applied.includes(2). A file
  // already at v2 runs no migration steps, so even an sr-engineer:In_Progress
  // tuple must not re-fire the warning.
  const ws = mkWorkspace();
  resetSession();
  writeRaw(
    ws,
    `---
schema_version: 2
active_feature: "already-v2"
status: "In_Progress"
last_updated: "2026-05-01T00:00:00.000Z"
last_agent: "sr-engineer"
qa_round: 0
review_round: 0
---
## ✅ Completed
- 無

## ⚠️ Pending & Handoff Notes
- 無
`,
  );

  const captured = [];
  const orig = process.stderr.write.bind(process.stderr);
  process.stderr.write = (chunk, ...rest) => {
    captured.push(typeof chunk === "string" ? chunk : chunk.toString("utf-8"));
    return true;
  };
  try {
    parseHandoff(ws);
  } finally {
    process.stderr.write = orig;
  }

  const joined = captured.join("");
  assert.doesNotMatch(
    joined,
    /\[code-reviewer migration\]/,
    `warning must NOT fire on already-v2 files; got: ${joined}`,
  );
});
