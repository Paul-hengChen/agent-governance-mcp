// Quick end-to-end smoke for v3.2.0 enforcement.
// Spawns dist/index.js over stdio, probes each new gate, then exits.
// NOT a replacement for the unit suite — this just confirms the wiring.

import { spawn } from "node:child_process";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

const here = path.dirname(new URL(import.meta.url).pathname);
const root = path.resolve(here, "..");
const ws = fs.mkdtempSync(path.join(os.tmpdir(), "twsmoke-"));

const child = spawn("node", [path.join(root, "dist/index.js")], {
  stdio: ["pipe", "pipe", "pipe"],
});

let buf = "";
const pending = new Map();
let nextId = 1;

child.stderr.on("data", (d) => process.stderr.write(`[server] ${d}`));
child.stdout.on("data", (chunk) => {
  buf += chunk.toString();
  let idx;
  while ((idx = buf.indexOf("\n")) >= 0) {
    const line = buf.slice(0, idx);
    buf = buf.slice(idx + 1);
    if (!line.trim()) continue;
    try {
      const msg = JSON.parse(line);
      if (msg.id !== undefined && pending.has(msg.id)) {
        pending.get(msg.id)(msg);
        pending.delete(msg.id);
      }
    } catch {
      // ignore
    }
  }
});

function send(method, params) {
  const id = nextId++;
  const req = { jsonrpc: "2.0", id, method, params };
  child.stdin.write(JSON.stringify(req) + "\n");
  return new Promise((resolve) => pending.set(id, resolve));
}

function callTool(name, args) {
  return send("tools/call", { name, arguments: args });
}

function textOf(resp) {
  return resp?.result?.content?.[0]?.text ?? JSON.stringify(resp);
}

const results = [];
function record(label, passed, detail) {
  results.push({ label, passed, detail });
  const tag = passed ? "PASS" : "FAIL";
  console.log(`[${tag}] ${label}${detail ? ` — ${detail}` : ""}`);
}

async function main() {
  await send("initialize", {
    protocolVersion: "2024-11-05",
    capabilities: {},
    clientInfo: { name: "smoke", version: "1.0" },
  });

  // Pre-flight read
  await callTool("tw_get_state", { workspace_path: ws });

  // Test 1: invalid agent_id name → AGENT_ID_REQUIRED (validateTransition rejects unknown agent)
  let r = await callTool("tw_update_state", {
    workspace_path: ws,
    active_feature: "smoke",
    status: "In_Progress",
    agent_id: "hacker",
  });
  let t = textOf(r);
  record(
    "unknown agent_id rejected with AGENT_ID_REQUIRED",
    t.includes("AGENT_ID_REQUIRED"),
    t.slice(0, 120),
  );

  // Test 2: fresh workspace, sr-engineer claiming start → TRANSITION_REJECTED (must start at pm/researcher)
  r = await callTool("tw_update_state", {
    workspace_path: ws,
    active_feature: "smoke",
    status: "In_Progress",
    agent_id: "sr-engineer",
  });
  t = textOf(r);
  record(
    "fresh→sr-engineer rejected with TRANSITION_REJECTED",
    t.includes("TRANSITION_REJECTED"),
    t.slice(0, 120),
  );

  // Test 3: zod refine — PASS without qa-engineer
  r = await callTool("tw_update_state", {
    workspace_path: ws,
    active_feature: "smoke",
    status: "PASS",
    agent_id: "sr-engineer",
  });
  t = textOf(r);
  record(
    "PASS w/o qa-engineer rejected by zod refine",
    t.includes("Invalid arguments") && t.includes('agent_id="qa-engineer"'),
    t.slice(0, 160),
  );

  // Test 4: legal pm kickoff
  r = await callTool("tw_update_state", {
    workspace_path: ws,
    active_feature: "smoke",
    status: "In_Progress",
    agent_id: "pm",
  });
  t = textOf(r);
  record("pm kickoff accepted", t.includes('"success":true'), t.slice(0, 80));

  // Test 5: pm→architect accepted
  await callTool("tw_get_state", { workspace_path: ws });
  r = await callTool("tw_update_state", {
    workspace_path: ws,
    active_feature: "smoke",
    status: "In_Progress",
    agent_id: "architect",
  });
  t = textOf(r);
  record("pm→architect accepted", t.includes('"success":true'), t.slice(0, 80));

  // Test 6: architect→qa-engineer rejected (must go through sr-engineer)
  await callTool("tw_get_state", { workspace_path: ws });
  r = await callTool("tw_update_state", {
    workspace_path: ws,
    active_feature: "smoke",
    status: "In_Progress",
    agent_id: "qa-engineer",
  });
  t = textOf(r);
  record(
    "architect→qa-engineer rejected (skip sr-engineer)",
    t.includes("TRANSITION_REJECTED"),
    t.slice(0, 120),
  );

  // Test 7: tw_complete_task without agent_id → BLOCKED (handler gate)
  r = await callTool("tw_complete_task", {
    workspace_path: ws,
    task_id: "T01",
  });
  t = textOf(r);
  record(
    "tw_complete_task w/o agent_id blocked",
    t.includes("BLOCKED") && t.includes("qa-engineer"),
    t.slice(0, 140),
  );

  // Test 8: legal full chain to PASS path with missing evidence
  await callTool("tw_get_state", { workspace_path: ws });
  await callTool("tw_update_state", {
    workspace_path: ws,
    active_feature: "smoke",
    status: "In_Progress",
    agent_id: "sr-engineer",
  });
  await callTool("tw_get_state", { workspace_path: ws });
  await callTool("tw_update_state", {
    workspace_path: ws,
    active_feature: "smoke",
    status: "In_Progress",
    agent_id: "qa-engineer",
  });
  await callTool("tw_get_state", { workspace_path: ws });
  r = await callTool("tw_update_state", {
    workspace_path: ws,
    active_feature: "smoke",
    status: "PASS",
    agent_id: "qa-engineer",
    completed_tasks: ["X1"],
  });
  t = textOf(r);
  record(
    "PASS with missing evidence rejected",
    t.includes("MISSING_EVIDENCE") && t.includes("X1"),
    t.slice(0, 160),
  );

  // Test 9: same PASS but supply qa_review → server auto-records evidence and accepts
  await callTool("tw_get_state", { workspace_path: ws });
  r = await callTool("tw_update_state", {
    workspace_path: ws,
    active_feature: "smoke",
    status: "PASS",
    agent_id: "qa-engineer",
    completed_tasks: ["X1"],
    qa_review: "smoke: synthetic PASS",
  });
  t = textOf(r);
  const evidenceFile = path.join(ws, "qa_reports", "review_X1.md");
  record(
    "PASS with qa_review accepted + evidence file written",
    t.includes('"success":true') && fs.existsSync(evidenceFile),
    t.slice(0, 100),
  );

  // Tear down
  child.kill();
  const failed = results.filter((r) => !r.passed);
  console.log(`\n${results.length - failed.length}/${results.length} smoke tests passed.`);
  process.exit(failed.length === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  child.kill();
  process.exit(1);
});
