// Coded by @qa-engineer
// Tests for backlog E22 (D5 follow-on / 104447-F0 A3) / T-E22-01: the opt-in
// stale-dispatch watch-file notify emit. tools/stale-notify.ts
// (`notifyStaleDispatch`) is the unit under test; tools/handoff.ts wires it
// into the v10 `stale_dispatch` advisory at `readHandoffState` (tw_get_state)
// time; tools/config.ts surfaces the arming key `staleDispatchNotifyFile`.
//
// The backlog row (docs/backlog.md E22) IS the spec for this ticket — no
// specs/<feature>.md exists. Spec-to-test map against the row's own claims,
// cross-checked against code-reviewer's APPROVED review_reports/review_T-E22-01.md:
//   opt-in / key absent = fully disarmed, byte-identical pre-E22 payload -> I1, I2, U1-U3
//   armed emit on threshold crossing, correct payload + atomic publish     -> U4, U5, I3
//   dedupe: one emit per (dispatched_at, role), cursor lives in watch-file -> U6-U8, I4
//   fresh emit on re-arm (new dispatched_at) / hand-deleted watch-file     -> U7, U9, I5
//   never-throws on the pre-flight read path (corrupt/future config,      -> U10-U15,
//     unwritable dir, dir-as-target, corrupt prior watch-file)               I7, I8, I9
//   file-mode only, no new handoff state / no schema bump                 -> I1 (schema
//                                                                             pin), S1
//   code-reviewer's flagged vector: corrupt/future-schema config + stale  -> I7, I8,
//     dispatch — INDEPENDENTLY VERIFIED to NOT behave as review_T-E22-01.md    I7b/I8b
//     claims (see the I7-I9 block header comment below for the full
//     writeup): the read throws before notify.error is ever reached. A
//     non-blocking correctness finding, escalated, not a T-E22-01 FAIL.
//     Common disarmed path (valid config, key absent) unperturbed          -> I2
//
// Fail-direction under test throughout: fail LOUD, never SILENT and never
// THROWN. A broken config or an unwritable watch-file must surface inside
// `stale_dispatch.notify.error`, never crash the mandatory tw_get_state
// pre-flight read, and never be swallowed into a false "disarmed" null.

import { test } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

import { notifyStaleDispatch } from "../dist/tools/stale-notify.js";
import { readHandoffState } from "../dist/tools/handoff.js";
import { resetSession } from "../dist/guards/session.js";
import { CURRENT_VERSIONS } from "../dist/schema/versions.js";

// ---- helpers ---------------------------------------------------------------

function mkWorkspace(prefix = "e22-") {
  const ws = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  fs.mkdirSync(path.join(ws, ".current"), { recursive: true });
  return ws;
}

function writeConfig(ws, body) {
  const p = path.join(ws, ".current", ".config.json");
  fs.writeFileSync(p, typeof body === "string" ? body : JSON.stringify(body), "utf-8");
  return p;
}

function watchPath(ws, rel = ".current/stale-dispatch.notify") {
  return path.join(ws, rel);
}

function readWatch(ws, rel) {
  return JSON.parse(fs.readFileSync(watchPath(ws, rel), "utf-8"));
}

function isoMinutesAgo(n) {
  return new Date(Date.now() - n * 60000).toISOString();
}

function writeRawHandoff(ws, { staleStamp, nextRole = "sr-engineer", schemaVersion = CURRENT_VERSIONS.handoff }) {
  fs.writeFileSync(
    path.join(ws, ".current", "handoff.md"),
    `---
schema_version: ${schemaVersion}
active_feature: "e22-fixture-feat"
status: "In_Progress"
last_updated: "${staleStamp}"
last_agent: "coordinator"
qa_round: 0
review_round: 0
visual_round: 0
next_role: "${nextRole}"
dispatched_at: "${staleStamp}"
---
## Completed
- (none)

## Pending & Handoff Notes
- coordinator: dispatching ${nextRole} now
`,
    "utf-8",
  );
}

function advisory({ role = "sr-engineer", dispatched_at = isoMinutesAgo(16), elapsed_minutes = 16 } = {}) {
  return {
    role,
    dispatched_at,
    elapsed_minutes,
    threshold_minutes: 15,
    message: `stale in-flight dispatch: ${role}, no state write for >15 min`,
  };
}

function tmpLeftovers(ws) {
  return fs.readdirSync(path.join(ws, ".current")).filter((f) => f.endsWith(".tmp"));
}

function isRoot() {
  return typeof process.getuid === "function" && process.getuid() === 0;
}

// ============================================================================
// U1-U3 — disarmed: null return, zero behavior, unit-level
// ============================================================================

test("U1: no .current/.config.json at all -> disarmed, returns null", () => {
  const ws = mkWorkspace();
  const result = notifyStaleDispatch(ws, advisory());
  assert.equal(result, null, "absent config must disarm the notify channel entirely");
  assert.equal(fs.existsSync(watchPath(ws)), false, "no watch-file must be created when disarmed");
});

test("U2: valid config present but staleDispatchNotifyFile key absent -> disarmed, returns null", () => {
  const ws = mkWorkspace();
  writeConfig(ws, { host: "claude-code", taskPaths: ["tasks.md"] });
  const result = notifyStaleDispatch(ws, advisory());
  assert.equal(result, null, "a config lacking the key must disarm exactly like an absent config");
});

test("U3: staleDispatchNotifyFile present but empty string -> treated as absent (config.ts non-fatal filter), disarmed", () => {
  const ws = mkWorkspace();
  writeConfig(ws, { staleDispatchNotifyFile: "" });
  const result = notifyStaleDispatch(ws, advisory());
  assert.equal(result, null, "an empty-string key must be filtered to absent by loadConfig's non-empty-string guard, not treated as an armed empty path");
});

// ============================================================================
// U4-U5 — armed emit: correct payload, atomic publish
// ============================================================================

test("U4: armed + stale -> emits the advisory + workspace + emitted_at to the configured watch-file, atomically", () => {
  const ws = mkWorkspace();
  writeConfig(ws, { staleDispatchNotifyFile: ".current/stale-dispatch.notify" });
  const adv = advisory();
  const result = notifyStaleDispatch(ws, adv);
  assert.equal(result.emitted, true);
  assert.equal(result.path, path.resolve(ws, ".current/stale-dispatch.notify"));
  assert.equal(result.error, undefined, "a successful emit must carry no error");

  const written = readWatch(ws);
  assert.equal(written.role, adv.role);
  assert.equal(written.dispatched_at, adv.dispatched_at);
  assert.equal(written.elapsed_minutes, adv.elapsed_minutes);
  assert.equal(written.threshold_minutes, adv.threshold_minutes);
  assert.equal(written.message, adv.message);
  assert.equal(written.workspace, ws, "payload must record the workspace the advisory belongs to");
  assert.ok(typeof written.emitted_at === "string" && !Number.isNaN(Date.parse(written.emitted_at)), "emitted_at must be a valid ISO timestamp");

  assert.deepEqual(tmpLeftovers(ws), [], "the tmp-then-rename publish must leave no .tmp file behind");
});

test("U5: an absolute configured path is honored as-is (path.resolve, not workspace-join)", () => {
  const ws = mkWorkspace();
  const absTarget = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "e22-abs-")), "notify.json");
  writeConfig(ws, { staleDispatchNotifyFile: absTarget });
  const result = notifyStaleDispatch(ws, advisory());
  assert.equal(result.emitted, true);
  assert.equal(result.path, absTarget, "an absolute path must not be re-rooted under the workspace");
  assert.equal(fs.existsSync(absTarget), true);
});

// ============================================================================
// U6-U9 — dedupe cursor: skip on repeat, re-arm on fresh dispatch/role,
// fresh emit after hand-deletion
// ============================================================================

test("U6: a second call with the SAME (dispatched_at, role) is skipped as a duplicate, file left untouched", () => {
  const ws = mkWorkspace();
  writeConfig(ws, { staleDispatchNotifyFile: ".current/stale-dispatch.notify" });
  const adv = advisory();
  const first = notifyStaleDispatch(ws, adv);
  assert.equal(first.emitted, true);
  const mtimeBefore = fs.statSync(watchPath(ws)).mtimeMs;

  const second = notifyStaleDispatch(ws, adv);
  assert.equal(second.emitted, false);
  assert.equal(second.skipped_duplicate, true, "identical (dispatched_at, role) must be deduped, not re-fired");
  const mtimeAfter = fs.statSync(watchPath(ws)).mtimeMs;
  assert.equal(mtimeAfter, mtimeBefore, "a skipped duplicate must not touch the watch-file at all");
});

test("U7: a fresh dispatched_at (new dispatch, same role) re-arms the emit", () => {
  const ws = mkWorkspace();
  writeConfig(ws, { staleDispatchNotifyFile: ".current/stale-dispatch.notify" });
  const first = notifyStaleDispatch(ws, advisory({ dispatched_at: isoMinutesAgo(20) }));
  assert.equal(first.emitted, true);

  const secondStamp = isoMinutesAgo(16);
  const second = notifyStaleDispatch(ws, advisory({ dispatched_at: secondStamp }));
  assert.equal(second.emitted, true, "a new dispatched_at stamp must re-arm the notify, not be treated as the same crossing");
  assert.equal(second.skipped_duplicate, undefined);
  const written = readWatch(ws);
  assert.equal(written.dispatched_at, secondStamp, "the watch-file must reflect the newest dispatch, not the stale first one");
});

test("U8: same dispatched_at but a DIFFERENT role also re-arms the emit (dedupe key is the pair, not either field alone)", () => {
  const ws = mkWorkspace();
  writeConfig(ws, { staleDispatchNotifyFile: ".current/stale-dispatch.notify" });
  const stamp = isoMinutesAgo(18);
  const first = notifyStaleDispatch(ws, advisory({ role: "sr-engineer", dispatched_at: stamp }));
  assert.equal(first.emitted, true);

  const second = notifyStaleDispatch(ws, advisory({ role: "qa-engineer", dispatched_at: stamp }));
  assert.equal(second.emitted, true, "a dispatch to a different role at the same timestamp is a distinct crossing");
  const written = readWatch(ws);
  assert.equal(written.role, "qa-engineer");
});

test("U9: hand-deleting the watch-file causes a FRESH emit on the next call for the SAME (dispatched_at, role) — fails toward notification, never silence", () => {
  const ws = mkWorkspace();
  writeConfig(ws, { staleDispatchNotifyFile: ".current/stale-dispatch.notify" });
  const adv = advisory();
  const first = notifyStaleDispatch(ws, adv);
  assert.equal(first.emitted, true);

  fs.unlinkSync(watchPath(ws));
  assert.equal(fs.existsSync(watchPath(ws)), false, "precondition: watch-file hand-deleted");

  const second = notifyStaleDispatch(ws, adv);
  assert.equal(second.emitted, true, "a missing cursor file must re-emit rather than silently stay skipped");
  assert.equal(second.skipped_duplicate, undefined);
  assert.equal(fs.existsSync(watchPath(ws)), true, "the file must be recreated");
});

// ============================================================================
// U10-U15 — never-throws: corrupt/future config, unwritable dir,
// dir-as-target, corrupt prior watch-file
// ============================================================================

test("U10: corrupt (unparsable JSON) .config.json -> never throws, returns a loud error outcome (not disarmed-null, not emitted)", () => {
  const ws = mkWorkspace();
  writeConfig(ws, "{ not valid json at all");
  let result;
  assert.doesNotThrow(() => {
    result = notifyStaleDispatch(ws, advisory());
  }, "a corrupt config must never make the pre-flight read path throw");
  assert.equal(result.emitted, false);
  assert.ok(typeof result.error === "string" && result.error.length > 0, "the failure must be loud, not swallowed to null");
  assert.match(result.error, /\.config\.json/, "the error must name the config file as the cause");
});

test("U11: future-schema .config.json (schema_version above server max) -> never throws, loud error outcome", () => {
  const ws = mkWorkspace();
  writeConfig(ws, { schema_version: CURRENT_VERSIONS.config + 99, staleDispatchNotifyFile: ".current/x" });
  let result;
  assert.doesNotThrow(() => {
    result = notifyStaleDispatch(ws, advisory());
  }, "a from-the-future config must refuse-loud inside notifyStaleDispatch, not propagate a throw");
  assert.equal(result.emitted, false);
  assert.ok(typeof result.error === "string" && result.error.length > 0);
});

test("U12: corrupt PRIOR watch-file content (invalid JSON) is treated as an unreadable cursor -> falls through to a fresh emit, never throws", () => {
  const ws = mkWorkspace();
  writeConfig(ws, { staleDispatchNotifyFile: ".current/stale-dispatch.notify" });
  fs.writeFileSync(watchPath(ws), "not json {{{", "utf-8");
  let result;
  assert.doesNotThrow(() => {
    result = notifyStaleDispatch(ws, advisory());
  });
  assert.equal(result.emitted, true, "an unreadable prior cursor must not block a fresh emit");
  const written = readWatch(ws);
  assert.equal(written.role, "sr-engineer");
});

test("U13: prior watch-file content is valid JSON but not an object (e.g. an array) -> falls through to a fresh emit, never throws", () => {
  const ws = mkWorkspace();
  writeConfig(ws, { staleDispatchNotifyFile: ".current/stale-dispatch.notify" });
  fs.writeFileSync(watchPath(ws), "[1,2,3]", "utf-8");
  let result;
  assert.doesNotThrow(() => {
    result = notifyStaleDispatch(ws, advisory());
  });
  assert.equal(result.emitted, true, "a non-object prior cursor (array) must not be mistaken for a matching dedupe record");
});

test("U14: an unwritable parent directory -> never throws, loud error outcome, emitted false", { skip: isRoot() ? "running as root — permission bits are bypassed" : false }, () => {
  const ws = mkWorkspace();
  const roDir = path.join(ws, "readonly-dir");
  fs.mkdirSync(roDir, { mode: 0o555 });
  writeConfig(ws, { staleDispatchNotifyFile: "readonly-dir/nested/notify.json" });
  try {
    let result;
    assert.doesNotThrow(() => {
      result = notifyStaleDispatch(ws, advisory());
    }, "an unwritable target directory must never throw out of notifyStaleDispatch");
    assert.equal(result.emitted, false);
    assert.ok(typeof result.error === "string" && result.error.length > 0, "the write failure must surface as a loud error");
  } finally {
    fs.chmodSync(roDir, 0o755);
  }
});

test("U15: the configured path is itself an existing directory -> never throws, loud error outcome (rename onto a directory fails)", () => {
  const ws = mkWorkspace();
  const dirTarget = path.join(ws, ".current", "stale-dispatch.notify");
  fs.mkdirSync(dirTarget);
  writeConfig(ws, { staleDispatchNotifyFile: ".current/stale-dispatch.notify" });
  let result;
  assert.doesNotThrow(() => {
    result = notifyStaleDispatch(ws, advisory());
  }, "a directory occupying the target path must never throw — the atomic rename must fail cleanly");
  assert.equal(result.emitted, false);
  assert.ok(typeof result.error === "string" && result.error.length > 0);
  assert.equal(fs.statSync(dirTarget).isDirectory(), true, "the pre-existing directory must be left intact, not partially clobbered");
});

// ============================================================================
// I1-I2 — end-to-end (readHandoffState): disarmed byte-identical envelope
// ============================================================================

test("I1: no .config.json at all + stale dispatch -> stale_dispatch has EXACTLY the 5 pre-E22 fields, no `notify` key", () => {
  const ws = mkWorkspace();
  resetSession();
  writeRawHandoff(ws, { staleStamp: isoMinutesAgo(16) });
  const parsed = JSON.parse(readHandoffState(ws));
  assert.ok(parsed.stale_dispatch, "stale_dispatch must fire for a >15min stamp regardless of E22 config");
  assert.deepEqual(
    Object.keys(parsed.stale_dispatch).sort(),
    ["dispatched_at", "elapsed_minutes", "message", "role", "threshold_minutes"].sort(),
    "disarmed workspaces must get the byte-identical pre-E22 shape — no `notify` key at all",
  );
  assert.equal(parsed.stale_dispatch.notify, undefined);
});

test("I2: a config present WITHOUT the key + stale dispatch -> still byte-identical, common disarmed path unperturbed by E22's existence", () => {
  const ws = mkWorkspace();
  resetSession();
  writeConfig(ws, { host: "claude-code" });
  writeRawHandoff(ws, { staleStamp: isoMinutesAgo(16) });
  const parsed = JSON.parse(readHandoffState(ws));
  assert.ok(parsed.stale_dispatch);
  assert.equal(parsed.stale_dispatch.notify, undefined, "a valid config lacking staleDispatchNotifyFile must not be perturbed by the E22 wiring");
});

// ============================================================================
// I3-I5 — end-to-end: armed emit + dedupe + re-arm through the real
// tw_get_state read path (not calling notifyStaleDispatch directly)
// ============================================================================

test("I3: armed config + stale dispatch, read via tw_get_state -> stale_dispatch.notify.emitted true, file written with matching content", () => {
  const ws = mkWorkspace();
  resetSession();
  writeConfig(ws, { staleDispatchNotifyFile: ".current/stale-dispatch.notify" });
  const staleStamp = isoMinutesAgo(16);
  writeRawHandoff(ws, { staleStamp, nextRole: "architect" });

  const parsed = JSON.parse(readHandoffState(ws));
  assert.ok(parsed.stale_dispatch.notify, "an armed workspace must carry a notify outcome inside the advisory");
  assert.equal(parsed.stale_dispatch.notify.emitted, true);
  assert.equal(parsed.stale_dispatch.role, "architect");

  const written = readWatch(ws);
  assert.equal(written.role, "architect");
  assert.equal(written.dispatched_at, staleStamp);
});

test("I4: two consecutive tw_get_state reads with no state change -> the second is a deduped skip (watchers fire once per crossing, not per poll)", () => {
  const ws = mkWorkspace();
  resetSession();
  writeConfig(ws, { staleDispatchNotifyFile: ".current/stale-dispatch.notify" });
  const staleStamp = isoMinutesAgo(16);
  writeRawHandoff(ws, { staleStamp });

  const first = JSON.parse(readHandoffState(ws));
  assert.equal(first.stale_dispatch.notify.emitted, true);
  const mtimeBefore = fs.statSync(watchPath(ws)).mtimeMs;

  const second = JSON.parse(readHandoffState(ws));
  assert.equal(second.stale_dispatch.notify.emitted, false);
  assert.equal(second.stale_dispatch.notify.skipped_duplicate, true, "a repeat tw_get_state on the same stale window must not re-fire the watcher");
  assert.equal(fs.statSync(watchPath(ws)).mtimeMs, mtimeBefore);
});

test("I5: a fresh dispatch (new dispatched_at, different next_role) written between reads re-arms the emit", () => {
  const ws = mkWorkspace();
  resetSession();
  writeConfig(ws, { staleDispatchNotifyFile: ".current/stale-dispatch.notify" });
  writeRawHandoff(ws, { staleStamp: isoMinutesAgo(20), nextRole: "sr-engineer" });
  const first = JSON.parse(readHandoffState(ws));
  assert.equal(first.stale_dispatch.notify.emitted, true);

  // Simulate the dispatched role writing back and a NEW dispatch going stale.
  writeRawHandoff(ws, { staleStamp: isoMinutesAgo(16), nextRole: "qa-engineer" });
  const second = JSON.parse(readHandoffState(ws));
  assert.equal(second.stale_dispatch.role, "qa-engineer");
  assert.equal(second.stale_dispatch.notify.emitted, true, "a genuinely new dispatch must re-arm the watch-file emit, not be treated as a duplicate of the old one");
  assert.equal(second.stale_dispatch.notify.skipped_duplicate, undefined);
});

test("I6: armed config but the dispatch is still WITHIN the threshold window -> no stale_dispatch at all, no emit, no watch-file created", () => {
  const ws = mkWorkspace();
  resetSession();
  writeConfig(ws, { staleDispatchNotifyFile: ".current/stale-dispatch.notify" });
  writeRawHandoff(ws, { staleStamp: isoMinutesAgo(5) });
  const parsed = JSON.parse(readHandoffState(ws));
  assert.equal(parsed.stale_dispatch, undefined, "notify must never fire independently of the underlying stale_dispatch advisory");
  assert.equal(fs.existsSync(watchPath(ws)), false);
});

// ============================================================================
// I7-I9 — code-reviewer's flagged vector: corrupt/future-schema config +
// stale dispatch. review_reports/review_T-E22-01.md claims this "will newly
// surface stale_dispatch.notify.error even when E22 was never armed" and
// characterizes it as fail-loud-but-never-throws.
//
// INDEPENDENT VERIFICATION FINDING (see QA review doc for full writeup):
// that claim does not hold. `readHandoffState` calls `markStateRead` ->
// `findTasksFile` -> `resolveTaskPaths` -> `loadConfig` for TASK-PATH
// resolution BEFORE the stale_dispatch/notify computation is ever reached
// (tools/handoff.ts:283 via guards/session.ts). That EARLIER loadConfig call
// throws uncaught on corrupt/future-schema config, so the whole read (and
// the mandatory tw_get_state pre-flight action) throws — it never gets far
// enough to produce a `stale_dispatch.notify.error`. I7/I8 pin the TRUE
// observed behavior (a throw), not the review doc's claim.
//
// Confirmed via a companion diagnostic (not a formal test, verified
// manually in the QA session) that this reproduces on a BARE workspace with
// no handoff.md and no stale dispatch at all — i.e. this is a pre-existing
// gap in the config/task-path subsystem, orthogonal to and unmodified by
// the E22 diff (tools/config.ts's E22 hunk only ADDS the
// staleDispatchNotifyFile field parser; the throwing statements below it
// are untouched — see `git diff HEAD~1 HEAD -- tools/config.ts`). Escalated
// as a non-blocking correctness finding, not a T-E22-01 regression.
// ============================================================================

test("I7: corrupt (unparsable) .config.json + stale dispatch -> tw_get_state THROWS (pre-existing gap in task-path config resolution, unrelated to and unmodified by the E22 diff — NOT the graceful notify.error the review doc claims)", () => {
  const ws = mkWorkspace();
  resetSession();
  writeConfig(ws, "{ this is broken json");
  writeRawHandoff(ws, { staleStamp: isoMinutesAgo(16) });

  assert.throws(
    () => readHandoffState(ws),
    /Failed to parse .*\.config\.json/,
    "the actual behavior is an uncaught throw from the pre-existing task-path loadConfig call site, BEFORE stale_dispatch/notify is ever computed — contradicts review_T-E22-01.md's 'surfaces notify.error, never throws' characterization for this vector",
  );
});

test("I8: future-schema .config.json + stale dispatch -> tw_get_state THROWS for the same pre-existing reason as I7 (not a graceful notify.error)", () => {
  const ws = mkWorkspace();
  resetSession();
  writeConfig(ws, { schema_version: CURRENT_VERSIONS.config + 99 });
  writeRawHandoff(ws, { staleStamp: isoMinutesAgo(16) });

  assert.throws(
    () => readHandoffState(ws),
    /config on-disk version \d+ > server max/,
    "a from-the-future config must refuse-loud, but that refusal is an uncaught throw out of tw_get_state, not a contained stale_dispatch.notify.error",
  );
});

test("I7b/I8b — pre-existing-scope pin: the SAME throw reproduces on a bare workspace with NO handoff.md and NO stale dispatch at all, proving this is unrelated to and predates the E22 diff", () => {
  const ws = mkWorkspace();
  resetSession();
  writeConfig(ws, "{ this is broken json");
  // No handoff.md written at all — there is no next_role/dispatched_at, so
  // there is nothing for E22's stale-dispatch wiring to even react to. The
  // throw is entirely a task-path config-resolution artifact.
  assert.throws(
    () => readHandoffState(ws),
    /Failed to parse .*\.config\.json/,
    "a corrupt config breaks tw_get_state even with zero stale-dispatch involvement — this gap predates and is orthogonal to T-E22-01",
  );
});

test("I9: armed config but the watch-file's target path is an existing directory + stale dispatch -> tw_get_state never throws, notify.error surfaces", () => {
  const ws = mkWorkspace();
  resetSession();
  fs.mkdirSync(path.join(ws, ".current", "stale-dispatch.notify"));
  writeConfig(ws, { staleDispatchNotifyFile: ".current/stale-dispatch.notify" });
  writeRawHandoff(ws, { staleStamp: isoMinutesAgo(16) });

  let parsed;
  assert.doesNotThrow(() => {
    parsed = JSON.parse(readHandoffState(ws));
  });
  assert.equal(parsed.exists, true);
  assert.equal(parsed.stale_dispatch.notify.emitted, false);
  assert.ok(typeof parsed.stale_dispatch.notify.error === "string" && parsed.stale_dispatch.notify.error.length > 0);
});

// ============================================================================
// S1 — no new handoff state / no schema bump (backlog row's explicit
// constraint): E22 must not require a schema_version change to plumb.
// ============================================================================

test("S1: sanity — CURRENT_VERSIONS.handoff/config are unchanged by E22 (no schema bump; the dedupe cursor lives entirely in the watch-file, not in handoff state)", () => {
  assert.equal(CURRENT_VERSIONS.handoff, 13, "E22 must not have bumped the handoff schema version");
  assert.equal(CURRENT_VERSIONS.config, 1, "E22 must not have bumped the config schema version");
});
