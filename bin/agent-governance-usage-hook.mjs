#!/usr/bin/env node
// PostToolUse hook (matcher: Task) for agent-governance-mcp — D2 durable
// token-usage accounting.
//
// Reads the PostToolUse JSON payload from stdin (tool_name, tool_input,
// tool_response, cwd) and appends one UsageRecord to the workspace's
// current-lane .current/<lane>/usage.jsonl via
// dist/tools/usage-accounting.js (the SessionStart hook's dist/-import
// pattern).
//
// Opt-in (AC-9): a record is written ONLY when ALL of the following hold —
//   - tool_name === "Task"
//   - <workspace>/.current/ exists
//   - .current/.config.json sets tokenBudgetPerFeature to a positive finite
//     number (absent file / absent key / invalid value → silent no-op, no
//     file, no accounting)
//
// Best-effort throughout (D3's emitGateTelemetry discipline): any failure is
// swallowed, the hook ALWAYS exits 0 and never blocks or alters the Task
// result.
//
// Env overrides:
//   AGC_SERVER_ROOT (alias: TEAMWORK_SERVER_ROOT, SDD_SERVER_ROOT) — point at
//     a different agent-governance-mcp checkout.
//   CLAUDE_PROJECT_DIR — workspace fallback when the payload carries no cwd.

import * as fs from "fs";
import * as path from "path";
import { pathToFileURL } from "url";

const __dirname = path.dirname(new URL(import.meta.url).pathname);
const SERVER_ROOT =
  process.env.AGC_SERVER_ROOT ||
  process.env.TEAMWORK_SERVER_ROOT ||
  process.env.SDD_SERVER_ROOT ||
  path.resolve(__dirname, "..");

// The four canonical usage.* fields (mirrors tools/usage-accounting.ts).
const USAGE_KEYS = [
  "input_tokens",
  "output_tokens",
  "cache_read_input_tokens",
  "cache_creation_input_tokens",
];

function readStdin() {
  return new Promise((resolve) => {
    let data = "";
    process.stdin.setEncoding("utf-8");
    process.stdin.on("data", (chunk) => (data += chunk));
    process.stdin.on("end", () => resolve(data));
    process.stdin.on("error", () => resolve(""));
  });
}

// Missing/non-numeric fields default to 0 (spec: hook contract).
function normalizeUsage(raw) {
  const usage = {};
  for (const key of USAGE_KEYS) {
    const value = raw && typeof raw === "object" ? raw[key] : undefined;
    usage[key] = typeof value === "number" && Number.isFinite(value) ? value : 0;
  }
  return usage;
}

// Primary source: tool_response.usage. Fallback: the newest agent-*.jsonl
// entry carrying a usage object (the same source B9 reads today). All-zeros
// when neither yields numbers.
function extractUsage(payload, workspace) {
  const direct = payload.tool_response && payload.tool_response.usage;
  if (direct && typeof direct === "object") return normalizeUsage(direct);
  try {
    const newest = fs
      .readdirSync(workspace)
      .filter((f) => /^agent-.*\.jsonl$/.test(f))
      .map((f) => {
        const p = path.join(workspace, f);
        return { p, mtimeMs: fs.statSync(p).mtimeMs };
      })
      .sort((a, b) => b.mtimeMs - a.mtimeMs)[0];
    if (newest) {
      const lines = fs.readFileSync(newest.p, "utf-8").split("\n");
      for (let i = lines.length - 1; i >= 0; i--) {
        const trimmed = lines[i].trim();
        if (!trimmed) continue;
        try {
          const entry = JSON.parse(trimmed);
          if (entry && typeof entry === "object" && entry.usage && typeof entry.usage === "object") {
            return normalizeUsage(entry.usage);
          }
        } catch {
          // keep scanning older lines
        }
      }
    }
  } catch {
    // fall through to all-zeros
  }
  return normalizeUsage(undefined);
}

// active_feature from the handoff.md YAML frontmatter (read-only peek — the
// hook must not take the file lock or the full parser dependency).
// `handoffPath` comes from the lane-layout seam (see main), never a restated
// filename (E123 F1 L3).
function readActiveFeature(handoffPath) {
  try {
    const raw = fs.readFileSync(handoffPath, "utf-8");
    const m = raw.match(/^active_feature:\s*"?([^"\r\n]*?)"?\s*$/m);
    return m && m[1] ? m[1] : null;
  } catch {
    return null;
  }
}

async function main() {
  const raw = await readStdin();
  if (!raw) return;
  let payload;
  try {
    payload = JSON.parse(raw);
  } catch {
    return;
  }
  if (!payload || typeof payload !== "object") return;
  if (payload.tool_name !== "Task") return;

  const workspace =
    (typeof payload.cwd === "string" && payload.cwd) ||
    process.env.CLAUDE_PROJECT_DIR ||
    process.cwd();
  const currentDir = path.join(workspace, ".current");
  if (!fs.existsSync(currentDir)) return;

  // Opt-in gate (AC-9): positive finite tokenBudgetPerFeature required.
  // Raw read + parse (not tools/config.js): loadConfig heals schema_version
  // on read (a write) — the wrong posture for a best-effort observer hook
  // that must never write config or exit non-zero. (loadConfig no longer
  // throws on malformed JSON, E31, but the heal-on-read objection stands.)
  let budget;
  try {
    const config = JSON.parse(fs.readFileSync(path.join(currentDir, ".config.json"), "utf-8"));
    budget = config && typeof config === "object" ? config.tokenBudgetPerFeature : undefined;
  } catch {
    return; // absent/unreadable/malformed config → brake disabled → no-op
  }
  if (typeof budget !== "number" || !Number.isFinite(budget) || budget <= 0) return;

  // Resolve the lane handoff path via the compiled lane-layout seam
  // (dist/tools/lane-paths.js, E123 F1 L3); path.resolve pins an ABSOLUTE
  // workspace (L-SCHEMA-NEW-9). Import failure (dist/ missing) → no record,
  // exit 0.
  // Lane-then-flat fallback (E123c, J2-NEW-3), read-only (the readAndMigrate
  // AC13 posture) — an unmigrated workspace still holds only the flat
  // handoff.md, and must not record feature: null.
  let handoffPath;
  try {
    const lanePaths = await import(
      pathToFileURL(path.join(SERVER_ROOT, "dist", "tools", "lane-paths.js")).href
    );
    const abs = path.resolve(workspace);
    const laneHandoff = lanePaths.resolveCurrentLanePaths(abs).handoffPath;
    handoffPath = fs.existsSync(laneHandoff)
      ? laneHandoff
      : lanePaths.resolveFlatLanePaths(abs).handoffPath;
  } catch {
    return;
  }

  const record = {
    ts: new Date().toISOString(),
    feature: readActiveFeature(handoffPath),
    dispatch:
      payload.tool_input && typeof payload.tool_input.subagent_type === "string"
        ? payload.tool_input.subagent_type
        : null,
    usage: extractUsage(payload, workspace),
  };

  const mod = await import(
    pathToFileURL(path.join(SERVER_ROOT, "dist", "tools", "usage-accounting.js")).href
  );
  mod.appendUsageRecord(workspace, record);
}

// ALWAYS exit 0 — success and failure alike (hook contract).
main().then(
  () => process.exit(0),
  () => process.exit(0)
);
