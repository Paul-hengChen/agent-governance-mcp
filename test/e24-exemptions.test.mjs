// Coded by @qa-engineer
// Tests for backlog E24 (104447-F0 C2) / T-E24-01/02/03: the declarative
// build-gate exemption manifest `.current/exemptions.json` — the ONLY
// sanctioned exemption channel for the Constitution §2 ZERO-errors gate.
// T-E24-01 is the never-throw loader (tools/exemptions.ts); T-E24-02 is the
// read-time surface on both tw_get_state envelope branches
// (tools/handoff.ts); T-E24-03 is the const-05 §2 "Build-gate exemptions"
// bullet + golden/monolith regeneration (content-only, pinned by prose grep
// here — token-budget consequences are re-baselined separately in
// test/context-budget.test.mjs).
//
// Fail-direction under test throughout: never-silently-exempt. A malformed
// manifest or entry must ALWAYS collapse toward "not exempted" (zero
// exemptions + loud errors, or that one entry dropped), never toward
// granting an exemption nobody validated.
//
// Spec-to-test map (backlog E24 row + code-reviewer's APPROVED
// review_reports/review_T-E24-01.md, which independently confirmed the
// never-throw guarantee and both envelope return paths):
//   loader: absent file                     -> L1
//   loader: valid manifest                  -> L2
//   loader: mixed-validity (valid + invalid) -> L3
//   loader: bad JSON                        -> L4
//   loader: non-object root (array/string/number/null) -> L5
//   loader: future/unsupported schema_version -> L6
//   loader: non-array `exemptions` field    -> L7
//   loader: unreadable file (permissions)   -> L8
//   loader: count === valid-entries-only    -> L9 (+ L3 exercises it too)
//   tw_get_state envelope: exists:false branch surfaces exemptions -> G1
//   tw_get_state envelope: exists:true branch surfaces exemptions  -> G2
//   tw_get_state envelope: key absent entirely when no manifest    -> G3
//   const-05 §2 prose pin (Build-gate exemptions bullet)           -> P1-P5

import { test } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

import { EXEMPTIONS_SCHEMA_VERSION, loadExemptions } from "../dist/tools/exemptions.js";
import { readHandoffState, writeHandoffState } from "../dist/tools/handoff.js";
import { FileHandoffStorage, setActiveStorage } from "../dist/tools/storage.js";
import { resetSession, markStateRead } from "../dist/guards/session.js";

const __filename = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(__filename), "..");

function mkWorkspace(prefix = "e24-") {
  const ws = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  fs.mkdirSync(path.join(ws, ".current"), { recursive: true });
  return ws;
}

function manifestPath(ws) {
  return path.join(ws, ".current", "exemptions.json");
}

function writeManifest(ws, body) {
  fs.writeFileSync(manifestPath(ws), body, "utf-8");
}

// ============================================================================
// L1-L9 — loader matrix (tools/exemptions.ts, T-E24-01)
// ============================================================================

test("L1: absent .current/exemptions.json -> null (zero exemptions, no signal — the normal case)", () => {
  const ws = mkWorkspace();
  assert.equal(loadExemptions(ws), null, "no manifest file must yield null, not an empty-but-present view");
});

test("L2: a fully valid manifest surfaces every entry, count matches, errors empty", () => {
  const ws = mkWorkspace();
  writeManifest(
    ws,
    JSON.stringify({
      schema_version: 1,
      exemptions: [
        { path: "test/legacy-harness.test.ts", reason: "33 known tsc errors pending rewrite", expires_when: "harness migrated to vitest" },
        { path: "vendor/generated/", reason: "third-party generated code", expires_when: "vendor upgrade ships own types" },
      ],
    }),
  );
  const view = loadExemptions(ws);
  assert.equal(view.count, 2);
  assert.equal(view.entries.length, 2);
  assert.deepEqual(view.errors, []);
  assert.equal(view.entries[0].path, "test/legacy-harness.test.ts");
  assert.equal(view.entries[0].reason, "33 known tsc errors pending rewrite");
  assert.equal(view.entries[0].expires_when, "harness migrated to vitest");
});

test("L2b: absent schema_version defaults to the birth version (1) — a manifest need not declare it", () => {
  const ws = mkWorkspace();
  writeManifest(
    ws,
    JSON.stringify({ exemptions: [{ path: "a", reason: "b", expires_when: "c" }] }),
  );
  const view = loadExemptions(ws);
  assert.equal(view.count, 1, "absent schema_version must NOT void the manifest — it defaults to the supported birth version");
  assert.deepEqual(view.errors, []);
});

test("L3: mixed-validity manifest — valid entries survive, invalid entries are dropped (NOT exempted) with a loud per-entry error each", () => {
  const ws = mkWorkspace();
  writeManifest(
    ws,
    JSON.stringify({
      schema_version: 1,
      exemptions: [
        { path: "good/one.ts", reason: "ok", expires_when: "never" }, // valid
        { path: "missing-reason.ts", expires_when: "soon" }, // missing `reason`
        { path: "", reason: "empty path", expires_when: "soon" }, // empty-string path (fails trim().length>0)
        "not-an-object", // non-object candidate
        { path: "good/two.ts", reason: "ok too", expires_when: "later" }, // valid
      ],
    }),
  );
  const view = loadExemptions(ws);
  assert.equal(view.count, 2, "only the two structurally-valid entries count — partial validity fails toward enforcement, never toward exemption");
  assert.deepEqual(
    view.entries.map((e) => e.path).sort(),
    ["good/one.ts", "good/two.ts"],
  );
  assert.equal(view.errors.length, 3, "each of the three malformed candidates gets its own loud error, none silently swallowed");
  assert.ok(view.errors.some((e) => e.includes("exemptions[1]") && e.includes("reason")), `missing-field error must name the field and index; got ${JSON.stringify(view.errors)}`);
  assert.ok(view.errors.some((e) => e.includes("exemptions[2]")), "empty-string path must be treated as missing (not a truthy value)");
  assert.ok(view.errors.some((e) => e.includes("exemptions[3]") && e.includes("not an object")), "a non-object candidate must be flagged as such");
});

test("L4: bad JSON -> zero exemptions + loud parse error, never throws", () => {
  const ws = mkWorkspace();
  writeManifest(ws, "{ this is not valid json ");
  const view = loadExemptions(ws);
  assert.equal(view.count, 0);
  assert.deepEqual(view.entries, []);
  assert.equal(view.errors.length, 1);
  assert.ok(view.errors[0].includes("Failed to parse"), view.errors[0]);
});

test("L5: non-object root (array / string / number / null JSON) voids the whole manifest loudly", () => {
  const ws = mkWorkspace();
  for (const badRoot of ['[]', '"just a string"', "42", "null"]) {
    writeManifest(ws, badRoot);
    const view = loadExemptions(ws);
    assert.equal(view.count, 0, `root ${badRoot} must yield zero exemptions`);
    assert.equal(view.errors.length, 1, `root ${badRoot} must produce exactly one loud error`);
    assert.ok(view.errors[0].includes("manifest root must be a JSON object"), `unexpected error for root ${badRoot}: ${view.errors[0]}`);
  }
});

test("L6: unsupported/future schema_version voids the whole manifest loudly (refuse-loud, never guess at an unknown shape)", () => {
  const ws = mkWorkspace();
  assert.equal(EXEMPTIONS_SCHEMA_VERSION, 1, "sanity: this loader supports v1 only");
  for (const futureVersion of [2, 999, "1"]) {
    writeManifest(
      ws,
      JSON.stringify({ schema_version: futureVersion, exemptions: [{ path: "a", reason: "b", expires_when: "c" }] }),
    );
    const view = loadExemptions(ws);
    assert.equal(view.count, 0, `schema_version ${JSON.stringify(futureVersion)} must void the manifest — including the STRING "1" which is not the numeric 1`);
    assert.ok(view.errors[0].includes("unsupported schema_version"), view.errors[0]);
  }
});

test("L7: `exemptions` field present but not an array -> zero exemptions + loud error", () => {
  const ws = mkWorkspace();
  for (const badList of ['{"a":1}', '"a string"', "5", "true"]) {
    writeManifest(ws, `{"schema_version":1,"exemptions":${badList}}`);
    const view = loadExemptions(ws);
    assert.equal(view.count, 0, `exemptions=${badList} must yield zero exemptions`);
    assert.ok(view.errors[0].includes('"exemptions" must be an array'), view.errors[0]);
  }
});

test("L8: unreadable file (permissions error, not ENOENT) -> zero exemptions + loud error, never throws", () => {
  const ws = mkWorkspace();
  writeManifest(ws, JSON.stringify({ exemptions: [{ path: "a", reason: "b", expires_when: "c" }] }));
  fs.chmodSync(manifestPath(ws), 0o200); // write-only: readFileSync should fail EACCES (may be bypassed by root)
  let view;
  try {
    assert.doesNotThrow(() => {
      view = loadExemptions(ws);
    }, "loadExemptions must never throw, even on an unreadable manifest");
  } finally {
    fs.chmodSync(manifestPath(ws), 0o644); // restore for cleanup
  }
  // Sandbox-agnostic (root may bypass 0o200): whichever branch actually ran,
  // the result must be internally consistent — either the permission error
  // fired (0 exemptions, loud read-failure error) or root bypassed it and the
  // valid manifest read through cleanly (1 exemption, no errors). Never a
  // throw, never a silently-wrong count.
  assert.ok(view, "loadExemptions must always return a value, never undefined");
  if (view.count === 0) {
    assert.ok(view.errors.some((e) => e.includes("Failed to read")), `expected a read-failure error when count is 0; got ${JSON.stringify(view.errors)}`);
  } else {
    assert.equal(view.count, 1, "if permission enforcement was bypassed (e.g. running as root), the underlying valid manifest must still parse correctly");
    assert.deepEqual(view.errors, []);
  }
});

test("L9: count is exactly the number of VALID entries, not raw JSON array length (the only-grows metric never counts rejected entries)", () => {
  const ws = mkWorkspace();
  writeManifest(
    ws,
    JSON.stringify({
      exemptions: [
        { path: "ok", reason: "ok", expires_when: "ok" },
        { path: "ok2" }, // invalid: missing reason/expires_when
        null, // invalid: not an object
      ],
    }),
  );
  const view = loadExemptions(ws);
  assert.equal(view.count, 1);
  assert.equal(view.count, view.entries.length, "count must always equal entries.length (valid-only), never list.length");
});

// ============================================================================
// G1-G3 — tw_get_state envelope surface (tools/handoff.ts, T-E24-02)
// ============================================================================

test("G1: exists:false envelope branch (no handoff.md yet) STILL surfaces exemptions when a manifest is present", () => {
  const ws = mkWorkspace();
  writeManifest(ws, JSON.stringify({ exemptions: [{ path: "a", reason: "b", expires_when: "c" }] }));
  // No handoff.md written — readHandoffState must take the exists:false branch.
  const raw = readHandoffState(ws);
  const json = JSON.parse(raw);
  assert.equal(json.exists, false, "sanity: this must be the fresh-project branch");
  assert.ok(json.exemptions, "exemptions must be surfaced even before any governance state exists — sanctioned exemptions are never hidden");
  assert.equal(json.exemptions.count, 1);
});

test("G2: exists:true envelope branch surfaces exemptions alongside normal handoff state", async () => {
  setActiveStorage(new FileHandoffStorage());
  const ws = mkWorkspace();
  writeManifest(ws, JSON.stringify({ exemptions: [{ path: "a", reason: "b", expires_when: "c" }, { path: "d", reason: "e", expires_when: "f" }] }));
  resetSession(ws);
  markStateRead(ws);
  await writeHandoffState({
    workspacePath: ws,
    activeFeature: "g2-feat",
    status: "In_Progress",
    completedTasks: [],
    pendingNotes: ["seed"],
    lastAgent: "pm",
  });
  const raw = readHandoffState(ws);
  const json = JSON.parse(raw);
  assert.equal(json.exists, true, "sanity: this must be the established-handoff branch");
  assert.equal(json.active_feature, "g2-feat", "sanity: normal handoff fields still present alongside exemptions");
  assert.ok(json.exemptions, "exemptions must be surfaced on the exists:true branch too");
  assert.equal(json.exemptions.count, 2);
});

test("G3: the `exemptions` key is entirely ABSENT from the envelope when no manifest exists (never present-but-empty)", async () => {
  setActiveStorage(new FileHandoffStorage());
  const ws = mkWorkspace();
  // Exercise both envelope branches with no manifest file at all.
  const freshRaw = readHandoffState(ws);
  const freshJson = JSON.parse(freshRaw);
  assert.equal(freshJson.exists, false);
  assert.ok(!("exemptions" in freshJson), "exists:false branch must omit the key entirely, not surface an empty/zero exemptions object");

  resetSession(ws);
  markStateRead(ws);
  await writeHandoffState({
    workspacePath: ws,
    activeFeature: "g3-feat",
    status: "In_Progress",
    completedTasks: [],
    pendingNotes: ["seed"],
    lastAgent: "pm",
  });
  const establishedRaw = readHandoffState(ws);
  const establishedJson = JSON.parse(establishedRaw);
  assert.equal(establishedJson.exists, true);
  assert.ok(!("exemptions" in establishedJson), "exists:true branch must ALSO omit the key entirely when no manifest exists");
});

// ============================================================================
// P1-P5 — const-05-core-standards.md §2 "Build-gate exemptions" bullet
// (content-only pin, T-E24-03; mirrors the T-E16 charter-pinning grep
// convention — token-budget consequences live in test/context-budget.test.mjs)
// ============================================================================

const CONST_05 = fs.readFileSync(path.join(ROOT, "content", "const-05-core-standards.md"), "utf-8");

test("P1: const-05 §2 declares .current/exemptions.json as the ONLY sanctioned exemption channel for the ZERO-errors gate", () => {
  assert.match(CONST_05, /\*\*Build-gate exemptions\*\*/, "the bullet must be present and labeled");
  assert.ok(
    CONST_05.includes("ONLY sanctioned exemption channel for the ZERO-errors gate is the workspace's declarative manifest `.current/exemptions.json`"),
    "the load-bearing 'only sanctioned channel' sentence must be present verbatim",
  );
});

test("P2: const-05 §2 names the three required per-entry fields (path/reason/expires_when)", () => {
  assert.ok(CONST_05.includes("`path` + `reason` + `expires_when`"), "the three-field shape must be pinned verbatim");
});

test("P3: const-05 §2 states a prose-only exemption counts as NOT exempted (the anti-re-litigation rule)", () => {
  assert.ok(
    CONST_05.includes("a prose-only exemption (pending_notes, review prose, chat) counts as NOT exempted"),
    "the prose-does-not-count rule must be pinned verbatim — this is the rule the manifest exists to replace",
  );
});

test("P4: const-05 §2 states a malformed manifest/entry exempts nothing, loudly", () => {
  assert.ok(
    CONST_05.includes("A malformed manifest or entry exempts nothing (errors surface loudly in the envelope)"),
    "the fail-toward-enforcement sentence must be pinned verbatim",
  );
});

test("P5: const-05 §2 states exemptions.count is a monitored only-grows metric requiring human approval to add", () => {
  assert.ok(
    CONST_05.includes("`exemptions.count` is a monitored only-grows metric: adding an entry requires human approval"),
    "the only-grows / human-approval sentence must be pinned verbatim",
  );
});
