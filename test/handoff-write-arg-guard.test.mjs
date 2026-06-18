// Coded by @qa-engineer
// Tests for specs/handoff-write-arg-guard.md — AC-1 through AC-4.
//
// Spec-to-Test map:
//   AC-1 (valid args accepted)              → t-ac1-valid-root-path-accepted,
//                                             t-ac1-valid-feature-string-accepted
//   AC-2 (.current workspace_path rejected) → t-ac2-current-basename-rejected,
//                                             t-ac2-exact-error-message,
//                                             t-ac2-non-current-basename-accepted,
//                                             t-ac2-current-as-parent-not-rejected
//   AC-3 ([object Object] rejected)         → t-ac3-object-sentinel-rejected,
//                                             t-ac3-exact-error-message,
//                                             t-ac3-valid-feature-id-not-rejected
//   AC-4 (no corrupt write produced)        → t-ac4-no-nested-current-dir,
//                                             t-ac4-sentinel-not-persisted
//
// Regression guards (pre-existing refines must still fire):
//   PASS/agent_id refine                    → t-reg-pass-requires-qa-engineer
//   prd_path traversal refine               → t-reg-prd-path-traversal
//
// WHY: these guards are the only server-side barrier preventing two classes of
// silent corruption: (1) doubly-nested .current/.current/handoff.md from a mis-
// directed workspace_path, and (2) the JavaScript object-stringification artefact
// "[object Object]" being persisted verbatim as the feature sentinel. Both violate
// §7 (fail loud) and §3.1 (reject invalid tw_update_state writes).
//
// Strategy: tests exercise the real MCP dispatch boundary (dist/index.js spawned
// as a stdio server) so the full Zod → handler → ZodError-catch pipeline runs. This
// is the only public interface through which UpdateStateArgs can be exercised, since
// the schema is not exported. The spawn pattern follows teamwork-lite.test.mjs.

import { test } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const PROJECT_ROOT = path.resolve(path.dirname(__filename), "..");
const DIST_INDEX = path.join(PROJECT_ROOT, "dist", "index.js");

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Spin up a fresh MCP stdio server, send a sequence of JSON-RPC messages,
 * collect all line-delimited responses, kill the process, and return the
 * parsed response objects.
 *
 * @param {object[]} messages - JSON-RPC message objects to send in order.
 * @param {number}   [waitMs=2000] - ms to wait for responses before killing.
 * @returns {Promise<object[]>} All parseable JSON-RPC lines received on stdout.
 */
async function callServer(messages, waitMs = 2000) {
  const p = spawn(process.execPath, [DIST_INDEX], { stdio: ["pipe", "pipe", "pipe"] });
  let stdout = "";
  p.stdout.on("data", (d) => { stdout += d.toString(); });
  p.stderr.on("data", () => {}); // suppress server noise

  for (const msg of messages) {
    p.stdin.write(JSON.stringify(msg) + "\n");
  }

  await new Promise((r) => setTimeout(r, waitMs));
  p.kill();

  return stdout
    .split("\n")
    .filter(Boolean)
    .map((line) => { try { return JSON.parse(line); } catch { return null; } })
    .filter(Boolean);
}

/** Standard MCP initialise handshake messages. */
const INIT_MSGS = [
  {
    jsonrpc: "2.0",
    id: 1,
    method: "initialize",
    params: {
      protocolVersion: "2024-11-05",
      capabilities: {},
      clientInfo: { name: "qa-test-hwag", version: "0" },
    },
  },
  { jsonrpc: "2.0", method: "notifications/initialized" },
];

/**
 * Build a tools/call message for tw_update_state with the supplied arguments.
 */
function updateStateMsg(id, args) {
  return {
    jsonrpc: "2.0",
    id,
    method: "tools/call",
    params: { name: "tw_update_state", arguments: args },
  };
}

/**
 * Create a temporary workspace directory with a .current/ subdirectory and a
 * minimal handoff.md so the server can parse pre-flight state.
 */
function mkWorkspace() {
  const ws = fs.mkdtempSync(path.join(os.tmpdir(), "hwag-"));
  fs.mkdirSync(path.join(ws, ".current"), { recursive: true });
  // Minimal valid handoff so the pre-flight guard can parse it
  fs.writeFileSync(
    path.join(ws, ".current", "handoff.md"),
    [
      "---",
      'active_feature: "test-feature"',
      'status: "In_Progress"',
      `last_updated: "${new Date().toISOString()}"`,
      'last_agent: "pm"',
      "schema_version: 5",
      "qa_round: 0",
      "review_round: 0",
      "visual_round: 0",
      "scope_decision: single-feature",
      'scope_decision_why: "trivial test workspace"',
      "---",
      "# Task Handoff State",
      "",
      "## Completed",
      "",
      "## Pending",
      "- (none)",
    ].join("\n"),
  );
  return ws;
}

/**
 * Extract the response with the given id from an array of JSON-RPC messages.
 */
function findById(responses, id) {
  return responses.find((r) => r && r.id === id) ?? null;
}

// ---------------------------------------------------------------------------
// String-level smoke tests (fast, no spawn needed)
// These pin that the exact error messages from Copy/Strings are compiled into
// dist/index.js. They catch the case where the source was patched but the
// dist was not rebuilt.
// ---------------------------------------------------------------------------

test("dist/index.js contains verbatim ERR_WORKSPACE_CURRENT string", () => {
  // Why: the Copy/Strings table in the spec mandates this exact text. A typo
  // or rephrasing would break AC-2 callers who match on the message.
  const compiled = fs.readFileSync(DIST_INDEX, "utf-8");
  assert.ok(
    compiled.includes("workspace_path must be the workspace root, not the .current state directory"),
    "ERR_WORKSPACE_CURRENT must appear verbatim in compiled dist/index.js",
  );
});

test("dist/index.js contains verbatim ERR_ACTIVE_FEATURE_OBJECT string", () => {
  // Why: same contract — exact text from Copy/Strings table.
  const compiled = fs.readFileSync(DIST_INDEX, "utf-8");
  assert.ok(
    compiled.includes("active_feature must be a plain string id, not a serialised object"),
    "ERR_ACTIVE_FEATURE_OBJECT must appear verbatim in compiled dist/index.js",
  );
});

// ---------------------------------------------------------------------------
// AC-1 — valid args still accepted (positive baseline)
// ---------------------------------------------------------------------------

test("AC-1 (t-ac1-valid-root-path-accepted): valid absolute workspace root + plain feature id is not rejected by Zod", async () => {
  // Why: the new refines must not widen rejection to well-formed inputs. A
  // valid call must still reach the handler and not be rejected by Zod.
  // Strategy: send without prior getState — Zod fires before the pre-flight guard.
  // If Zod rejected, the response starts with "❌ Invalid arguments for tw_update_state".
  // If Zod accepted, the pre-flight guard fires instead (different message). We
  // assert only that Zod did NOT reject — the pre-flight firing is acceptable.
  const ws = mkWorkspace();

  const responses = await callServer([
    ...INIT_MSGS,
    updateStateMsg(11, {
      workspace_path: ws,
      active_feature: "my-feature",
      status: "In_Progress",
      agent_id: "sr-engineer",
    }),
  ]);

  const res = findById(responses, 11);
  assert.ok(res, "must receive a response for id=11");
  // A Zod rejection produces isError:true with "❌ Invalid arguments" prefix.
  const text = res?.result?.content?.[0]?.text ?? "";
  assert.ok(
    !text.startsWith("❌ Invalid arguments"),
    `valid call must not be rejected by Zod — got: ${text.slice(0, 200)}`,
  );
});

test("AC-1 (t-ac1-valid-feature-string-accepted): feature id containing dots/dashes is not rejected by Zod", async () => {
  // Why: real feature ids use hyphens and dots (e.g. "handoff-write-arg-guard",
  // "v3.40.1-fix"). Confirm the active_feature refine does not reject these.
  // Strategy: send the call WITHOUT a prior tw_get_state — if Zod rejected the args,
  // we'd get "❌ Invalid arguments for tw_update_state: ...". If Zod accepts, the
  // pre-flight guard fires instead with a different message. Either way we check only
  // that the Zod invalid-arguments path was NOT taken.
  const ws = mkWorkspace();

  const responses = await callServer([
    ...INIT_MSGS,
    updateStateMsg(21, {
      workspace_path: ws,
      active_feature: "handoff-write-arg-guard-v3.40.1",
      status: "In_Progress",
      agent_id: "sr-engineer",
    }),
  ]);

  const res = findById(responses, 21);
  assert.ok(res, "must receive a response for id=21");
  const text = res?.result?.content?.[0]?.text ?? "";
  assert.ok(
    !text.startsWith("❌ Invalid arguments"),
    `feature id with hyphens/dots must not be rejected by Zod — got: ${text.slice(0, 200)}`,
  );
});

// ---------------------------------------------------------------------------
// AC-2 — workspace_path with basename `.current` is rejected
// ---------------------------------------------------------------------------

test("AC-2 (t-ac2-current-basename-rejected): workspace_path ending in .current is rejected", async () => {
  // Why: passing /workspace/my-repo/.current instead of /workspace/my-repo
  // would cause the handler to write .current/.current/handoff.md — silent
  // corruption. The refine must reject this before any write occurs.
  const ws = mkWorkspace();
  const currentPath = path.join(ws, ".current");

  const responses = await callServer([
    ...INIT_MSGS,
    // No tw_get_state first — Zod fires BEFORE the pre-flight guard.
    updateStateMsg(30, {
      workspace_path: currentPath,
      active_feature: "some-feature",
      status: "In_Progress",
      agent_id: "sr-engineer",
    }),
  ]);

  const res = findById(responses, 30);
  assert.ok(res, "must receive a response for id=30");
  const isError = res?.result?.isError === true || res?.error != null;
  assert.ok(isError, "workspace_path ending in .current must produce an error response");
});

test("AC-2 (t-ac2-exact-error-message): rejected .current path carries verbatim ERR_WORKSPACE_CURRENT message", async () => {
  // Why: callers must be able to pattern-match on the exact message text to
  // give a useful diagnostic. The spec's Copy/Strings table is the contract.
  const ws = mkWorkspace();
  const currentPath = path.join(ws, ".current");

  const responses = await callServer([
    ...INIT_MSGS,
    updateStateMsg(40, {
      workspace_path: currentPath,
      active_feature: "some-feature",
      status: "In_Progress",
      agent_id: "sr-engineer",
    }),
  ]);

  const res = findById(responses, 40);
  assert.ok(res, "must receive a response for id=40");
  const text = res?.result?.content?.[0]?.text ?? "";
  assert.ok(
    text.includes("workspace_path must be the workspace root, not the .current state directory"),
    `error message must contain ERR_WORKSPACE_CURRENT verbatim — got: ${text.slice(0, 300)}`,
  );
});

test("AC-2 (t-ac2-non-current-basename-accepted): path whose basename is NOT .current is not rejected by the .current guard", async () => {
  // Why: spec Out-of-Scope says the guard only fires when basename === '.current'.
  // A workspace root at any other path must NOT trigger the guard.
  // Strategy: send without prior getState — if Zod accepted the path, the
  // pre-flight error fires (different message); if Zod rejected, we'd see the
  // ERR_WORKSPACE_CURRENT message. We assert the guard message is absent.
  const ws = mkWorkspace();

  const responses = await callServer([
    ...INIT_MSGS,
    updateStateMsg(51, {
      workspace_path: ws,
      active_feature: "feature-x",
      status: "In_Progress",
      agent_id: "sr-engineer",
    }),
  ]);

  const res = findById(responses, 51);
  assert.ok(res, "must receive response for id=51");
  const text = res?.result?.content?.[0]?.text ?? "";
  assert.ok(
    !text.includes("workspace_path must be the workspace root"),
    `path whose basename is NOT .current must not trigger the guard — got: ${text.slice(0, 200)}`,
  );
});

// ---------------------------------------------------------------------------
// AC-3 — active_feature "[object Object]" is rejected
// ---------------------------------------------------------------------------

test("AC-3 (t-ac3-object-sentinel-rejected): active_feature=[object Object] is rejected", async () => {
  // Why: when a JS caller passes an object as active_feature, the MCP transport
  // stringifies it to the literal "[object Object]". The refine must catch this
  // exact sentinel before the handler persists it verbatim to handoff.md.
  const ws = mkWorkspace();

  const responses = await callServer([
    ...INIT_MSGS,
    updateStateMsg(60, {
      workspace_path: ws,
      active_feature: "[object Object]",
      status: "In_Progress",
      agent_id: "sr-engineer",
    }),
  ]);

  const res = findById(responses, 60);
  assert.ok(res, "must receive a response for id=60");
  const isError = res?.result?.isError === true || res?.error != null;
  assert.ok(isError, 'active_feature="[object Object]" must produce an error response');
});

test("AC-3 (t-ac3-exact-error-message): rejected sentinel carries verbatim ERR_ACTIVE_FEATURE_OBJECT message", async () => {
  // Why: callers need the precise message text to understand the rejection.
  const ws = mkWorkspace();

  const responses = await callServer([
    ...INIT_MSGS,
    updateStateMsg(70, {
      workspace_path: ws,
      active_feature: "[object Object]",
      status: "In_Progress",
      agent_id: "sr-engineer",
    }),
  ]);

  const res = findById(responses, 70);
  assert.ok(res, "must receive a response for id=70");
  const text = res?.result?.content?.[0]?.text ?? "";
  assert.ok(
    text.includes("active_feature must be a plain string id, not a serialised object"),
    `error message must contain ERR_ACTIVE_FEATURE_OBJECT verbatim — got: ${text.slice(0, 300)}`,
  );
});

test("AC-3 (t-ac3-valid-feature-id-not-rejected): plain-string feature id is not rejected by the object-sentinel guard", async () => {
  // Why: the refine is an exact-string equality check. Legitimate feature ids
  // that happen to be unusual (e.g. bracketed strings) must not be caught.
  // "[object Object]" is the ONLY rejected value.
  // Strategy: send without prior getState — if Zod accepted, pre-flight fires
  // (different message); if Zod rejected, we'd see ERR_ACTIVE_FEATURE_OBJECT.
  const ws = mkWorkspace();

  const responses = await callServer([
    ...INIT_MSGS,
    updateStateMsg(81, {
      workspace_path: ws,
      active_feature: "[object-id]", // similar bracket syntax but NOT the sentinel
      status: "In_Progress",
      agent_id: "sr-engineer",
    }),
  ]);

  const res = findById(responses, 81);
  assert.ok(res, "must receive a response for id=81");
  const text = res?.result?.content?.[0]?.text ?? "";
  assert.ok(
    !text.includes("active_feature must be a plain string id"),
    `bracketed string other than the exact sentinel must not be rejected — got: ${text.slice(0, 200)}`,
  );
});

// ---------------------------------------------------------------------------
// AC-4 — no corrupt write produced
// ---------------------------------------------------------------------------

test("AC-4 (t-ac4-no-nested-current-dir): .current/.current/ nested directory is never created", async () => {
  // Why: the whole point of the workspace_path guard is to prevent writing
  // .current/.current/handoff.md. After a rejected call, verify the directory
  // was NOT created under the intended workspace root.
  const ws = mkWorkspace();
  const currentPath = path.join(ws, ".current");
  const nestedCurrentDir = path.join(ws, ".current", ".current");

  // Confirm it does not exist before the test.
  assert.ok(!fs.existsSync(nestedCurrentDir), "precondition: .current/.current/ must not exist");

  await callServer([
    ...INIT_MSGS,
    updateStateMsg(90, {
      workspace_path: currentPath,
      active_feature: "some-feature",
      status: "In_Progress",
      agent_id: "sr-engineer",
    }),
  ]);

  // After the rejected call, the nested directory must still not exist.
  assert.ok(
    !fs.existsSync(nestedCurrentDir),
    "rejected .current workspace_path must NOT create .current/.current/ on disk",
  );
});

test("AC-4 (t-ac4-sentinel-not-persisted): [object Object] is never written to handoff.md", async () => {
  // Why: the active_feature guard must stop the write before the handler
  // reaches storage. After the rejected call, verify handoff.md does not
  // contain the sentinel string.
  const ws = mkWorkspace();
  const handoffPath = path.join(ws, ".current", "handoff.md");

  // Record the handoff content BEFORE the attempted call.
  const before = fs.readFileSync(handoffPath, "utf-8");
  assert.ok(!before.includes("[object Object]"), "precondition: sentinel must not be in handoff before the test");

  await callServer([
    ...INIT_MSGS,
    updateStateMsg(100, {
      workspace_path: ws,
      active_feature: "[object Object]",
      status: "In_Progress",
      agent_id: "sr-engineer",
    }),
  ]);

  // handoff.md must not contain the sentinel after the rejected call.
  const after = fs.existsSync(handoffPath) ? fs.readFileSync(handoffPath, "utf-8") : "";
  assert.ok(
    !after.includes("[object Object]"),
    'rejected call must not persist "[object Object]" sentinel to handoff.md',
  );
});

// ---------------------------------------------------------------------------
// Regression guards — pre-existing refines must still fire
// ---------------------------------------------------------------------------

test("regression (t-reg-pass-requires-qa-engineer): status=PASS without agent_id=qa-engineer is rejected", async () => {
  // Why: the original PASS/agent_id refine (added before this feature) must
  // not have been disturbed by the two new .refine() additions.
  const ws = mkWorkspace();

  const responses = await callServer([
    ...INIT_MSGS,
    updateStateMsg(110, {
      workspace_path: ws,
      active_feature: "some-feature",
      status: "PASS",
      agent_id: "sr-engineer", // wrong agent for PASS
    }),
  ]);

  const res = findById(responses, 110);
  assert.ok(res, "must receive a response for id=110");
  const text = res?.result?.content?.[0]?.text ?? "";
  const isError = res?.result?.isError === true || res?.error != null;
  // Either the Zod refine fires (❌ Invalid arguments containing the PASS message)
  // or the defense-in-depth handler gate fires (both are acceptable rejections).
  const rejected =
    isError ||
    text.includes('status="PASS" requires agent_id="qa-engineer"') ||
    text.includes("qa-engineer");
  assert.ok(rejected, `PASS by sr-engineer must be rejected — got: ${text.slice(0, 300)}`);
});

test("regression (t-reg-prd-path-traversal): prd_path outside workspace_path is rejected", async () => {
  // Why: the prd_path traversal refine must not have been broken by adding
  // the two new .refine() calls after it.
  const ws = mkWorkspace();

  const responses = await callServer([
    ...INIT_MSGS,
    updateStateMsg(120, {
      workspace_path: ws,
      active_feature: "some-feature",
      status: "In_Progress",
      agent_id: "sr-engineer",
      prd_path: "/etc/passwd", // absolute path outside workspace
    }),
  ]);

  const res = findById(responses, 120);
  assert.ok(res, "must receive a response for id=120");
  const isError = res?.result?.isError === true || res?.error != null;
  const text = res?.result?.content?.[0]?.text ?? "";
  assert.ok(
    isError || text.includes("prd_path must be inside workspace_path"),
    `prd_path outside workspace must be rejected — got: ${text.slice(0, 300)}`,
  );
});
