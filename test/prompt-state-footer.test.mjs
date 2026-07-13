// Coded by @qa-engineer
// Tests for specs/c6-c11-prompt-state-injection.md (C6 fail-loud footer +
// C11 constitution dedup) and specs/c6-c11-prompt-state-injection-architecture.md
// (S01a/S01b/S02/S03 contracts, L1/L2 dedup, DR-6/DR-7).
//
// Spec-to-Test map:
//   AC-1 (genuine fresh, S01b)               -> t-s01b-*
//   AC-2 (wrong-path visible, never bare S01) -> t-s01a-*
//   AC-3 (parse/migration errors, S02)        -> t-s02-*
//   AC-4 (workspace-resolution consistency)   -> t-e2e-*  (env threading,
//                                                arg priority, cwd fallback,
//                                                all proven through the REAL
//                                                index.ts handler, not just
//                                                buildPromptForRole, since
//                                                resolveWorkspacePath lives
//                                                in index.ts)
//   AC-5 (this file)                          -> entire file
//   AC-6 (stale prd_path guard, C6-03/DR-7)   -> t-prd-*
//   AC-7/AC-8 (single delivery, L1+L2 dedup)  -> t-e2e-dedup, t-l2-*
//   DR-5 (S03 recovery clause non-silent)     -> t-e2e-dedup, t-purity-omit
//   DR-6 (buildPromptForRole purity)          -> t-purity-*
//   task item 2 (normal handoff unchanged)    -> t-normal-handoff
//
// index.ts's `resolveWorkspacePath`, the L1 in-memory Set, and `hookMarkerFresh`
// are NOT exported for direct import — index.ts runs a top-level IIFE that
// connects a stdio transport at module-load time, so importing dist/index.js
// in-process would hijack this test runner's own stdin/stdout. Every AC-4/L1/L2
// assertion below therefore spawns the REAL compiled server and talks
// JSON-RPC over stdio, mirroring the only other suite that needs the live
// handler (test/teamwork-lite.test.mjs AC3b). buildPromptForRole-level
// assertions (S01a/S01b/S02/purity) call the pure function directly — no
// server needed, since the footer decision tree and the omit branch both
// live in prompts/build.ts.

import { test } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(__filename), "..");

const { buildPromptForRole, resolvePrdPath } = await import(path.join(ROOT, "dist", "prompts", "build.js"));
const { setActiveStorage, FileHandoffStorage } = await import(path.join(ROOT, "dist", "tools", "storage.js"));

setActiveStorage(new FileHandoffStorage());

const HANDOFF_REL = path.join(".current", "handoff.md");
const S03_HEADLINE = "constitution already in context via hook — omitted";
const S03_RECOVERY = "(If you do NOT see the governance constitution earlier in this session, " +
  "it was not actually delivered: call tw_switch_role to load the role SOP " +
  "and treat the constitution as required — do not proceed ungoverned.)";

// --- fixture helpers ---------------------------------------------------

function mkTempWorkspace(prefix = "twpsf-") {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

// Managed (has .current/) but no handoff.md yet — S01b territory (AC-1).
function managedEmptyWorkspace() {
  const ws = mkTempWorkspace();
  fs.mkdirSync(path.join(ws, ".current"), { recursive: true });
  return ws;
}

// Unmanaged: no .current/, no tasks.md — S01a territory (AC-2).
function unmanagedWorkspace() {
  return mkTempWorkspace();
}

async function realHandoffWorkspace(feature) {
  const ws = managedEmptyWorkspace();
  const s = new FileHandoffStorage();
  await s.writeState(ws, feature, "In_Progress", [], ["hello"]);
  return ws;
}

function corruptYamlWorkspace() {
  const ws = managedEmptyWorkspace();
  // Unterminated quoted scalar -> js-yaml throws on load (tools/handoff.ts
  // readAndMigrate, ~line 115) -> buildPromptForRole must capture it as
  // stateError, never as "file not found".
  fs.writeFileSync(
    path.join(ws, ".current", "handoff.md"),
    '---\nactive_feature: "unterminated\nstatus: In_Progress\n---\n',
  );
  return ws;
}

function futureSchemaVersionWorkspace() {
  const ws = managedEmptyWorkspace();
  // schema_version newer than CURRENT_VERSIONS.handoff (5) -> runMigrations
  // refuse-loud throws (schema/versions.ts) -> same S02 branch as a YAML error.
  fs.writeFileSync(
    path.join(ws, ".current", "handoff.md"),
    "---\nschema_version: 999\nactive_feature: foo\nstatus: In_Progress\n---\n",
  );
  return ws;
}

function rm(ws) {
  fs.rmSync(ws, { recursive: true, force: true });
}

// ---------------------------------------------------------------------------
// AC-1 / S01b — genuinely fresh managed workspace
// ---------------------------------------------------------------------------

test("AC-1/S01b: genuinely fresh managed workspace names the resolved path + source, never bare 'Fresh project'", () => {
  const ws = managedEmptyWorkspace();
  try {
    const text = buildPromptForRole("skill-coordinator-lite.md", "d", ws, false, "workspace_path arg", false)
      .messages[0].content.text;
    assert.ok(text.includes(path.join(ws, HANDOFF_REL)), "footer must name the exact resolved handoff path");
    assert.ok(text.includes("resolved via workspace_path arg"), "footer must name the resolution source");
    assert.ok(text.includes("genuinely a fresh project"), "S01b must render the genuine-fresh framing");
    assert.ok(!text.includes("resolution suspect"), "a genuinely-managed-but-empty workspace must NOT render S01a");
    assert.ok(
      !/No handoff state found\. Fresh project/.test(text),
      "the old unqualified 'Fresh project' line must be gone",
    );
  } finally {
    rm(ws);
  }
});

test("AC-1: S01b threads all three resolution-source values verbatim", () => {
  const ws = managedEmptyWorkspace();
  try {
    for (const source of ["workspace_path arg", "CLAUDE_PROJECT_DIR env", "cwd fallback"]) {
      const text = buildPromptForRole("skill-coordinator-lite.md", "d", ws, false, source, false)
        .messages[0].content.text;
      assert.ok(text.includes(`resolved via ${source}`), `S01b footer must render source verbatim: ${source}`);
    }
  } finally {
    rm(ws);
  }
});

// ---------------------------------------------------------------------------
// AC-2 / S01a — wrong/unmanaged path is visible, never masked as fresh
// ---------------------------------------------------------------------------

test("AC-2/S01a: unmanaged path renders 'resolution suspect', names path+source, never bare 'Fresh project'", () => {
  const ws = unmanagedWorkspace();
  try {
    const text = buildPromptForRole("skill-coordinator-lite.md", "d", ws, false, "CLAUDE_PROJECT_DIR env", false)
      .messages[0].content.text;
    assert.ok(text.includes("resolution suspect"), "an unmanaged path must render the S01a stronger lead");
    assert.ok(text.includes(ws), "footer must name the resolved (wrong) path — this is what makes a mismatch diffable (AC-2)");
    assert.ok(text.includes("resolved via CLAUDE_PROJECT_DIR env"), "footer must name the resolution source");
    assert.ok(text.includes("not an agent-governance-managed workspace"), "S01a must explain why it's suspect");
    assert.ok(text.includes("verify workspace_path resolution"), "S01a must preserve the verify instruction (DR-3)");
    assert.ok(
      !/(^|[^a-zA-Z])Fresh project([^a-zA-Z]|$)/.test(text),
      "the literal unqualified 'Fresh project' string must never appear (AC-2 Copy/Strings constraint)",
    );
  } finally {
    rm(ws);
  }
});

// ---------------------------------------------------------------------------
// AC-3 / S02 — read/parse errors surface loudly, NEVER as "no state"
// ---------------------------------------------------------------------------

test("AC-3/S02: malformed YAML frontmatter never renders as fresh; footer names path + error text", () => {
  const ws = corruptYamlWorkspace();
  try {
    const text = buildPromptForRole("skill-coordinator-lite.md", "d", ws, false, "workspace_path arg", false)
      .messages[0].content.text;
    assert.ok(text.includes("Lookup Failed"), "S02 headline must render");
    assert.ok(text.includes(path.join(ws, HANDOFF_REL)), "S02 must name the resolved handoff path");
    assert.ok(text.includes("Failed to parse handoff.md frontmatter"), "S02 must include the underlying error text");
    assert.ok(text.includes("NOT a fresh project"), "S02 must explicitly disclaim freshness");
    assert.ok(!text.includes("genuinely a fresh project"), "S02 must never fall through to the S01b fresh framing");
    assert.ok(!text.includes("resolution suspect"), "S02 must never fall through to the S01a framing either");
  } finally {
    rm(ws);
  }
});

test("AC-3/S02: a future schema_version (refuse-loud migration throw) also renders S02, never fresh", () => {
  const ws = futureSchemaVersionWorkspace();
  try {
    const text = buildPromptForRole("skill-coordinator-lite.md", "d", ws, false, "workspace_path arg", false)
      .messages[0].content.text;
    assert.ok(text.includes("Lookup Failed"), "S02 headline must render for a refuse-loud migration throw too");
    assert.ok(text.includes("newer server"), "S02 must surface the schema-versioning refuse-loud error text");
    assert.ok(!text.includes("genuinely a fresh project"), "must never render fresh for a schema-version-too-new error");
  } finally {
    rm(ws);
  }
});

// ---------------------------------------------------------------------------
// Task item 2 — normal handoff -> state JSON block UNCHANGED (C6 must be
// additive-only on the not-found/error branches; the happy path is untouched).
// ---------------------------------------------------------------------------

test("normal handoff: state parses -> JSON state block renders exactly as before C6 (no S01/S02 text)", async () => {
  const ws = await realHandoffWorkspace("normal-handoff-feat");
  try {
    const text = buildPromptForRole("skill-coordinator-lite.md", "d", ws, false, "workspace_path arg", false)
      .messages[0].content.text;
    assert.ok(text.includes("## 📍 Current Project State (Auto-injected)"), "happy-path heading unchanged");
    assert.ok(text.includes('"active_feature": "normal-handoff-feat"'), "real state renders in the JSON block");
    assert.ok(!text.includes("Lookup Failed"), "must not render S02 when state parses fine");
    assert.ok(!text.includes("resolution suspect"), "must not render S01a when state parses fine");
    assert.ok(!text.includes("No handoff.md found"), "must not render S01b when a real handoff.md exists");
  } finally {
    rm(ws);
  }
});

// ---------------------------------------------------------------------------
// DR-6 — buildPromptForRole purity
// ---------------------------------------------------------------------------

test("DR-6: buildPromptForRole is pure — repeated omit=false calls on the same workspace are byte-identical", async () => {
  const ws = await realHandoffWorkspace("purity-feat");
  try {
    const a = buildPromptForRole("skill-sr-engineer.md", "d", ws, false, "workspace_path arg", false).messages[0].content.text;
    const b = buildPromptForRole("skill-sr-engineer.md", "d", ws, false, "workspace_path arg", false).messages[0].content.text;
    const c = buildPromptForRole("skill-sr-engineer.md", "d", ws, false, "workspace_path arg", false).messages[0].content.text;
    assert.equal(a, b, "1st and 2nd omit=false calls must be byte-identical");
    assert.equal(b, c, "2nd and 3rd omit=false calls must be byte-identical — protects the golden-fixture/compose-equivalence loops (DR-6), which call buildPromptForRole many times per process and must never see it develop hidden state");
  } finally {
    rm(ws);
  }
});

test("DR-6: omitConstitution=true changes ONLY the constitution slice — skill body + state footer untouched", async () => {
  const ws = await realHandoffWorkspace("purity-omit-feat");
  try {
    const full = buildPromptForRole("skill-sr-engineer.md", "d", ws, false, "workspace_path arg", false).messages[0].content.text;
    const omitted = buildPromptForRole("skill-sr-engineer.md", "d", ws, false, "workspace_path arg", true).messages[0].content.text;
    // Anchor on the skill's own title heading (stable across omit=true/false —
    // it lives entirely AFTER the constitution slice) rather than re-deriving
    // composeConstitution's output, which would just re-test production logic
    // against itself.
    const anchor = "# Skill: sr-engineer";
    const aIdx = full.indexOf(anchor);
    const bIdx = omitted.indexOf(anchor);
    assert.ok(aIdx > -1 && bIdx > -1, "skill body anchor must be present in both variants");
    assert.equal(
      full.slice(aIdx),
      omitted.slice(bIdx),
      "everything from the skill body onward (skill + model hint + state footer) must be byte-identical regardless of omitConstitution",
    );
    assert.ok(omitted.includes(S03_HEADLINE), "omitted bundle must carry the S03 headline verbatim");
    assert.ok(omitted.includes(S03_RECOVERY), "S03 must carry the DR-5 recovery clause verbatim");
    assert.ok(!full.includes(S03_HEADLINE), "the omit=false bundle must NOT carry the S03 sentinel");
  } finally {
    rm(ws);
  }
});

// ---------------------------------------------------------------------------
// C6-03 / AC-6 — resolvePrdPath's existsSync guard (test-only per DR-7: no
// production change; this regression-locks the guard that already exists).
// ---------------------------------------------------------------------------

function fixtureState(prdPath) {
  return {
    active_feature: "f",
    status: "In_Progress",
    last_updated: "x",
    completed_tasks: [],
    pending_notes: [],
    qa_round: 0,
    review_round: 0,
    visual_round: 0,
    prd_path: prdPath,
  };
}

test("C6-03/AC-6: a stale (nonexistent) state.prd_path degrades to null when no auto-discover file exists — never throws", () => {
  const ws = unmanagedWorkspace(); // no PRD.md / docs/PRD.md / specs/PRD.md either
  try {
    const state = fixtureState("/nonexistent/home-dir-rename/PRD.md");
    assert.doesNotThrow(() => resolvePrdPath(ws, state), "resolvePrdPath must never throw on a stale prd_path");
    assert.equal(
      resolvePrdPath(ws, state),
      null,
      "with no auto-discover fallback present, a stale prd_path must degrade to null — never render the stale path as live",
    );
  } finally {
    rm(ws);
  }
});

test("C6-03/AC-6: a stale state.prd_path degrades to the auto-discovered PRD.md, not the stale path", () => {
  const ws = unmanagedWorkspace();
  fs.writeFileSync(path.join(ws, "PRD.md"), "# Real PRD\n");
  try {
    const state = fixtureState("/nonexistent/home-dir-rename/PRD.md");
    const result = resolvePrdPath(ws, state);
    assert.equal(result, path.join(ws, "PRD.md"), "stale prd_path must degrade to auto-discovery, not the stale absolute path");
    assert.ok(fs.existsSync(result), "whatever resolvePrdPath returns (when non-null) must actually exist on disk");
  } finally {
    rm(ws);
  }
});

test("C6-03/AC-6: null state degrades gracefully to null, never throws", () => {
  const ws = unmanagedWorkspace();
  try {
    assert.doesNotThrow(() => resolvePrdPath(ws, null));
    assert.equal(resolvePrdPath(ws, null), null, "no state and no auto-discover file -> null");
  } finally {
    rm(ws);
  }
});

test("C6-03/AC-6: a LIVE (existing) state.prd_path is still trusted verbatim (contrast case — proves the guard is existsSync-gated, not a blanket ignore)", () => {
  const ws = unmanagedWorkspace();
  const realPrd = path.join(ws, "REAL-PRD.md");
  fs.writeFileSync(realPrd, "# Real\n");
  try {
    const state = fixtureState(realPrd);
    assert.equal(resolvePrdPath(ws, state), realPrd, "an existing prd_path must still be honored verbatim");
  } finally {
    rm(ws);
  }
});

// ---------------------------------------------------------------------------
// AC-4 / AC-7 / AC-8 / DR-5 — end-to-end through the REAL server process.
// resolveWorkspacePath, the L1 in-memory dedup Set, and hookMarkerFresh all
// live in index.ts, which cannot be imported in-process (its top-level IIFE
// connects a stdio transport at import time) — so these spawn the compiled
// server and drive it over JSON-RPC, exactly like test/teamwork-lite.test.mjs
// AC3b already does.
// ---------------------------------------------------------------------------

// Response-driven: resolves as soon as every id-bearing request sent (the
// initialize handshake plus each entry in `requests`) has a matching
// response on stdout, parsed incrementally as data arrives. `waitMs` is a
// generous ceiling — a failure backstop, not the expected runtime — so the
// test resolves fast under normal load and only pays the full wait when the
// server genuinely never replies (cold-start-under-full-suite-concurrency
// was flaking the old fixed-sleep-then-kill version: see docs/backlog.md E15).
function sendPromptRequests(spawnOpts, requests, waitMs = 20000) {
  return new Promise((resolve) => {
    const dist = path.join(ROOT, "dist", "index.js");
    const p = spawn("node", [dist], {
      stdio: ["pipe", "pipe", "pipe"],
      env: { ...process.env, ...(spawnOpts.env || {}) },
      cwd: spawnOpts.cwd,
    });
    let stdout = "";
    let settled = false;
    const expectedIds = new Set([1, ...requests.map((r) => r.id)]);
    const byId = new Map();

    const finish = () => {
      if (settled) return;
      settled = true;
      clearTimeout(ceiling);
      p.kill();
      resolve(byId);
    };

    p.stdout.on("data", (d) => {
      stdout += d.toString();
      for (const line of stdout.split("\n")) {
        if (!line.trim()) continue;
        try {
          const msg = JSON.parse(line);
          if (msg && msg.id != null) byId.set(msg.id, msg);
        } catch {
          // Partial line mid-chunk — full stdout is reprocessed on the next
          // data event, so this line will parse successfully once complete.
        }
      }
      if ([...expectedIds].every((id) => byId.has(id))) finish();
    });
    p.stderr.on("data", () => {}); // suppress server startup banner noise
    p.on("close", finish);

    const send = (msg) => p.stdin.write(JSON.stringify(msg) + "\n");
    send({
      jsonrpc: "2.0", id: 1, method: "initialize",
      params: { protocolVersion: "2024-11-05", capabilities: {}, clientInfo: { name: "qa-test", version: "0" } },
    });
    send({ jsonrpc: "2.0", method: "notifications/initialized" });
    for (const req of requests) {
      send({ jsonrpc: "2.0", id: req.id, method: "prompts/get", params: { name: req.name, arguments: req.arguments ?? {} } });
    }

    const ceiling = setTimeout(finish, waitMs);
  });
}

function textOf(byId, id) {
  const res = byId.get(id);
  assert.ok(res && res.result, `expected a prompts/get result for id ${id}, got: ${JSON.stringify(res)}`);
  return res.result.messages[0].content.text;
}

test("AC-4/AC-7/AC-8/DR-5/e2e: env threading, arg-priority-over-env, L1 same-process dedup, and the S03 recovery clause", async () => {
  const wsEnv = managedEmptyWorkspace();
  const wsArg = managedEmptyWorkspace();
  try {
    const byId = await sendPromptRequests(
      { env: { CLAUDE_PROJECT_DIR: wsEnv } },
      [
        // 1st fetch, resolved via CLAUDE_PROJECT_DIR env (no arg) -> full constitution.
        { id: 2, name: "teamwork", arguments: {} },
        // 2nd fetch, SAME resolved workspace (still no arg -> still wsEnv via
        // env) -> L1 dedup (AC-8: two different /teamwork* prompts in one
        // session) -> S03, not a second full copy.
        { id: 3, name: "teamwork-lite", arguments: {} },
        // 3rd fetch, EXPLICIT arg overriding the env for a DIFFERENT
        // workspace -> proves arg > env priority (DR-1) AND that L1 is keyed
        // per-workspace, not a global flag (a fresh workspace still gets the
        // full constitution even mid-session).
        { id: 4, name: "teamwork", arguments: { workspace_path: wsArg } },
      ],
    );

    const first = textOf(byId, 2);
    assert.match(first, /^# Constitution v/m, "1st fetch (env-resolved) must carry the full constitution");
    assert.ok(first.includes(wsEnv), "footer must name the env-resolved path (AC-4)");
    assert.ok(first.includes("resolved via CLAUDE_PROJECT_DIR env"), "footer must name the CLAUDE_PROJECT_DIR env source (AC-4)");
    assert.ok(!first.includes(S03_HEADLINE), "1st fetch must not be omitted — nothing delivered yet for this workspace");

    const second = textOf(byId, 3);
    assert.ok(second.includes(S03_HEADLINE), "2nd fetch (same workspace, different prompt) must omit via L1 dedup (AC-8)");
    assert.ok(second.includes(S03_RECOVERY), "S03 must carry the DR-5 recovery clause so a false-omission is self-healable, never silent");
    assert.ok(!/^# Constitution v/m.test(second), "2nd fetch must NOT re-emit the full constitution text");
    assert.ok(second.includes(wsEnv), "the footer's resolved-path line is independent of the omit decision — still names the workspace");

    const third = textOf(byId, 4);
    assert.match(third, /^# Constitution v/m, "3rd fetch, a DIFFERENT workspace via explicit arg, must get the FULL constitution (L1 keyed per-workspace, not global)");
    assert.ok(third.includes(wsArg), "footer must name the arg-resolved path, not the env one (DR-1 arg > env priority)");
    assert.ok(third.includes("resolved via workspace_path arg"), "footer must attribute resolution to the explicit arg, not the env still set on the process");
  } finally {
    rm(wsEnv);
    rm(wsArg);
  }
});

test("AC-4/e2e: with no workspace_path arg and no CLAUDE_PROJECT_DIR env, resolution falls back to the server's cwd", async () => {
  const ws = managedEmptyWorkspace();
  try {
    const env = { ...process.env };
    delete env.CLAUDE_PROJECT_DIR;
    const byId = await sendPromptRequests({ env, cwd: ws }, [{ id: 2, name: "teamwork", arguments: {} }]);
    const text = textOf(byId, 2);
    assert.ok(text.includes(ws), "footer must name the cwd-resolved path");
    assert.ok(text.includes("resolved via cwd fallback"), "footer must name the cwd-fallback resolution source");
  } finally {
    rm(ws);
  }
});

test("C11/AC-7 L2: a fresh hook marker (<120s) causes the FIRST fetch in a brand-NEW process to omit the constitution", async () => {
  const ws = managedEmptyWorkspace();
  fs.writeFileSync(path.join(ws, ".current", ".agc-hook-marker.json"), JSON.stringify({ ts: Date.now(), pid: 1 }));
  try {
    const byId = await sendPromptRequests({ env: { CLAUDE_PROJECT_DIR: ws } }, [{ id: 2, name: "teamwork", arguments: {} }]);
    const text = textOf(byId, 2);
    assert.ok(text.includes(S03_HEADLINE), "a fresh L2 marker must omit on the very FIRST fetch in a fresh process — proves L2 independently of L1 (which has nothing recorded yet)");
    assert.ok(!/^# Constitution v/m.test(text), "full constitution heading must not appear");
  } finally {
    rm(ws);
  }
});

test("C11/AC-7 L2 fail-safe: stale (>120s), malformed, and absent markers all degrade to a full emit", async () => {
  const wsStale = managedEmptyWorkspace();
  fs.writeFileSync(path.join(wsStale, ".current", ".agc-hook-marker.json"), JSON.stringify({ ts: Date.now() - 130_000, pid: 1 }));
  const wsMalformed = managedEmptyWorkspace();
  fs.writeFileSync(path.join(wsMalformed, ".current", ".agc-hook-marker.json"), "{not json");
  const wsAbsent = managedEmptyWorkspace(); // no marker file at all
  try {
    const byId = await sendPromptRequests({}, [
      { id: 2, name: "teamwork", arguments: { workspace_path: wsStale } },
      { id: 3, name: "teamwork", arguments: { workspace_path: wsMalformed } },
      { id: 4, name: "teamwork", arguments: { workspace_path: wsAbsent } },
    ]);
    for (const [id, label] of [[2, "stale (>120s)"], [3, "malformed"], [4, "absent"]]) {
      const text = textOf(byId, id);
      assert.match(text, /^# Constitution v/m, `${label} marker must fail-safe to a FULL constitution emit`);
      assert.ok(!text.includes(S03_HEADLINE), `${label} marker must NOT render the S03 sentinel`);
    }
  } finally {
    rm(wsStale);
    rm(wsMalformed);
    rm(wsAbsent);
  }
});

// ---------------------------------------------------------------------------
// D1 — prompt-arg-workspace-fallback (specs/d1-prompt-arg-workspace-fallback.md)
// looksLikePath() gates resolveWorkspacePath()'s arg-acceptance branch so a
// free-text workspace_path arg (Claude Code's slash-command convention stuffs
// any text typed after "/teamwork ..." into this single argument slot) falls
// through to the CLAUDE_PROJECT_DIR/cwd chain instead of being treated as a
// literal (bogus) path. resolveWorkspacePath/looksLikePath live in index.ts,
// which — like the AC-4 block above — cannot be imported in-process (its
// top-level IIFE connects a stdio transport unconditionally at import time,
// with no guard; verified by reading index.ts directly), so every case below
// spawns the real compiled server via sendPromptRequests, exactly like the
// existing AC-4/AC-7/AC-8 e2e tests.
//
// D1 Spec-to-Test map:
//   AC-1 (non-path-shaped arg falls back)        -> t-d1-ac1
//   AC-2 (existing-dir arg unchanged)             -> already covered above (the
//                                                     AC-4/e2e dedup test's 3rd
//                                                     fetch uses a real, existing
//                                                     wsArg via workspace_path arg)
//   AC-3 (path-shaped-but-missing arg unchanged)  -> t-d1-ac3
//   AC-4 (end-to-end repro fixed)                 -> t-d1-ac4
//   AC-5 (absent-arg behavior unchanged)          -> t-d1-ac5 (plus every
//                                                     pre-existing arguments:{}
//                                                     case above, unmodified)
//   AC-6 (existing C6 footer tests still pass)    -> this whole file, unmodified
//                                                     above this section
//   AC-7 (full suite green)                       -> enforced at the npm test
//                                                     level, not a single test
// ---------------------------------------------------------------------------

test("D1/AC-1: non-path-shaped (free-text) arg falls through to the CLAUDE_PROJECT_DIR env chain, never treated as a path", async () => {
  const ws = managedEmptyWorkspace();
  const freeText = "你好，這是一段沒有路徑分隔符號的自由文字，請問現在狀態如何？";
  try {
    const byId = await sendPromptRequests(
      { env: { CLAUDE_PROJECT_DIR: ws } },
      [{ id: 2, name: "teamwork", arguments: { workspace_path: freeText } }],
    );
    const text = textOf(byId, 2);
    assert.ok(
      text.includes("resolved via CLAUDE_PROJECT_DIR env"),
      "a free-text arg must be rejected by looksLikePath() and fall through to the env source, never 'workspace_path arg'",
    );
    assert.ok(
      !text.includes("resolved via workspace_path arg"),
      "source must never be attributed to the rejected free-text arg",
    );
    assert.ok(
      !text.includes(freeText),
      "the rejected free-text arg must not be written or surfaced anywhere in the footer (AC-1)",
    );
    assert.ok(
      !text.includes("resolution suspect"),
      "a real managed workspace reached via the env fallback must render normally, not S01a",
    );
  } finally {
    rm(ws);
  }
});

test("D1/AC-3: path-shaped-but-nonexistent arg stays literal and still renders S01a — regression-locked, byte-identical to pre-D1", async () => {
  const bogusPath = path.join(os.tmpdir(), `twpsf-d1-ac3-nonexistent-${Date.now()}`);
  assert.ok(!fs.existsSync(bogusPath), "fixture precondition: this path must not exist on disk");
  const byId = await sendPromptRequests({}, [{ id: 2, name: "teamwork", arguments: { workspace_path: bogusPath } }]);
  const text = textOf(byId, 2);
  assert.ok(
    text.includes("resolution suspect"),
    "a path-shaped-but-missing arg must still trip the S01a 'resolution suspect' footer (AC-3: no existence check gates this branch)",
  );
  assert.ok(text.includes(bogusPath), "S01a must still name the resolved (bogus) path verbatim, unchanged from pre-D1");
  assert.ok(
    text.includes("resolved via workspace_path arg"),
    "source must stay attributed to the arg itself — path-shaped input gets no env/cwd fallback (AC-3)",
  );
});

test("D1/AC-4: end-to-end repro — a real /teamwork* free-text arg in a real managed workspace renders live state, not S01a", async () => {
  const ws = await realHandoffWorkspace("d1-ac4-repro-feat");
  const freeText = "開始實作 D1，目前狀態是什麼？";
  try {
    const byId = await sendPromptRequests(
      { env: { CLAUDE_PROJECT_DIR: ws } },
      [{ id: 2, name: "teamwork", arguments: { workspace_path: freeText } }],
    );
    const text = textOf(byId, 2);
    assert.ok(
      text.includes("## 📍 Current Project State (Auto-injected)"),
      "AC-4: must render the normal state JSON block for the real workspace",
    );
    assert.ok(
      text.includes('"active_feature": "d1-ac4-repro-feat"'),
      "AC-4: must reflect the REAL workspace's state, not the misrouted free text",
    );
    assert.ok(
      !text.includes("resolution suspect"),
      "AC-4: must NOT render the S01a 'not an agent-governance-managed workspace' claim — this was the exact 2026-07-10 live repro bug this feature fixes",
    );
    assert.ok(!text.includes(freeText), "the discarded free-text arg must not leak anywhere into the footer");
  } finally {
    rm(ws);
  }
});

test("D1/AC-5: absent workspace_path arg is byte-identical to pre-D1 — still resolves via CLAUDE_PROJECT_DIR env untouched", async () => {
  const ws = managedEmptyWorkspace();
  try {
    const byId = await sendPromptRequests(
      { env: { CLAUDE_PROJECT_DIR: ws } },
      [{ id: 2, name: "teamwork", arguments: {} }],
    );
    const text = textOf(byId, 2);
    assert.ok(
      text.includes("resolved via CLAUDE_PROJECT_DIR env"),
      "AC-5: an absent arg must resolve via env exactly as before D1 — the leading typeof-string guard in resolveWorkspacePath is untouched by the looksLikePath gate",
    );
    assert.ok(!text.includes("resolution suspect"), "AC-5: absent arg into a real managed workspace must render normally, not S01a");
  } finally {
    rm(ws);
  }
});
