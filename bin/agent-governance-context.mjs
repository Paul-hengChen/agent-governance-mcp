#!/usr/bin/env node
// SessionStart hook helper for agent-governance-mcp.
//
// Reads the constitution + skill (workspace override or server default) and
// the current handoff state, then emits Claude Code's `additionalContext`
// JSON on stdout so the session boots with everything the agent needs to
// follow the rules.
//
// Behavior:
// - If the workspace looks agent-governance-managed (has .current/, tasks.md, or
//   TODO.md), inject the full context block.
// - Otherwise, exit silently with no output — unrelated projects stay clean.
//
// Env overrides:
//   AGC_SERVER_ROOT (alias: TEAMWORK_SERVER_ROOT, SDD_SERVER_ROOT) — point at a different
//     agent-governance-mcp checkout.
//   CLAUDE_PROJECT_DIR — workspace path (set by Claude Code).

import * as fs from "fs";
import * as path from "path";

const __dirname = path.dirname(new URL(import.meta.url).pathname);
const SERVER_ROOT =
  process.env.AGC_SERVER_ROOT ||
  process.env.TEAMWORK_SERVER_ROOT ||
  process.env.SDD_SERVER_ROOT ||
  path.resolve(__dirname, "..");
const workspace = process.env.CLAUDE_PROJECT_DIR || process.cwd();

// A workspace opts in by having any of these markers. Methodology-agnostic.
const markers = [
  path.join(workspace, ".current"),
  path.join(workspace, "tasks.md"),
  path.join(workspace, "TODO.md"),
];
const isManagedWorkspace = markers.some((p) => fs.existsSync(p));
if (!isManagedWorkspace) {
  // Silent no-op: not an agent-governance-managed workspace.
  process.exit(0);
}

function readSafe(p) {
  try {
    return fs.readFileSync(p, "utf-8");
  } catch {
    return "";
  }
}

// Workspace override > server default.
function loadContent(filename) {
  const override = path.join(workspace, ".current", filename);
  if (fs.existsSync(override)) return readSafe(override);
  return readSafe(path.join(SERVER_ROOT, "content", filename));
}

const constitution = loadContent("constitution.md");
const skill = loadContent("skill-coordinator.md");

if (!constitution || !skill) {
  // Server repo missing or moved — surface a hint instead of injecting nothing.
  const hint = `## ⚠️ agent-governance-context hook misconfigured
Could not load constitution/skill from ${SERVER_ROOT}.
Set AGC_SERVER_ROOT in your Claude Code settings env, or update the
path in ~/.claude/settings.json's SessionStart hook.`;
  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: "SessionStart",
        additionalContext: hint,
      },
    })
  );
  process.exit(0);
}

const handoffPath = path.join(workspace, ".current", "handoff.md");
const stateBlock = fs.existsSync(handoffPath)
  ? `## 📍 Current Project State (auto-injected at session start)\n\n\`\`\`yaml\n${readSafe(handoffPath)}\n\`\`\``
  : `## 📍 Current Project State\n\nNo handoff state found in this workspace. Call \`tw_get_state\` to initialize.`;

const body = [
  "# 🛡️ Teamwork Auto-Context (SessionStart hook)",
  "",
  "The following constitution and SOP are now in effect for this session.",
  "You are currently in Coordinator mode. You can execute simple tasks, or advise the user to switch roles via `/pm`, `/architect`, `/researcher`, `/sr-engineer`, or `/qa-engineer`.",
  "Call `tw_get_state` before any state-modifying tool.",
  "",
  "---",
  constitution,
  "---",
  skill,
  "---",
  stateBlock,
].join("\n");

process.stdout.write(
  JSON.stringify({
    hookSpecificOutput: {
      hookEventName: "SessionStart",
      additionalContext: body,
    },
  })
);
