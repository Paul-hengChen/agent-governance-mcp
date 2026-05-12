#!/usr/bin/env node
// SessionStart hook helper for sr-engineer mode.
//
// Reads the SDD constitution + skill from the teamwork-mcp-server repo
// and the workspace's current handoff state, then emits Claude Code's
// `additionalContext` JSON on stdout so the session boots with everything
// the agent needs to follow the rules.
//
// Behavior:
// - If the workspace looks SDD-managed (.current/, .specify/, tasks.md, or
//   specs/ exists), inject the full context block.
// - Otherwise, exit silently with no output — unrelated projects stay clean.
//
// Env overrides:
//   SDD_SERVER_ROOT  — point at a different teamwork-mcp-server checkout.
//   CLAUDE_PROJECT_DIR — workspace path (set by Claude Code).

import * as fs from "fs";
import * as path from "path";

const SERVER_ROOT =
  process.env.SDD_SERVER_ROOT || "/Users/paul.ph.chen/teamwork-mcp-server";
const workspace = process.env.CLAUDE_PROJECT_DIR || process.cwd();

const sddMarkers = [
  path.join(workspace, ".current"),
  path.join(workspace, ".specify"),
  path.join(workspace, "specs"),
  path.join(workspace, "tasks.md"),
];
const isSddWorkspace = sddMarkers.some((p) => fs.existsSync(p));
if (!isSddWorkspace) {
  // Silent no-op: not an SDD project.
  process.exit(0);
}

function readSafe(p) {
  try {
    return fs.readFileSync(p, "utf-8");
  } catch {
    return "";
  }
}

const constitution = readSafe(path.join(SERVER_ROOT, "content", "constitution.md"));
const skill = readSafe(path.join(SERVER_ROOT, "content", "skill-sr-engineer.md"));

if (!constitution || !skill) {
  // Server repo missing or moved — surface a hint instead of injecting nothing.
  const hint = `## ⚠️ sr-engineer hook misconfigured
Could not load constitution/skill from ${SERVER_ROOT}.
Set SDD_SERVER_ROOT in your Claude Code settings env, or update the path
in ~/.claude/settings.json's SessionStart hook.`;
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
  : `## 📍 Current Project State\n\nNo handoff state found in this workspace. Call \`sdd_get_state\` to initialize.`;

const body = [
  "# 🛡️ sr-engineer Mode (auto-loaded by SessionStart hook)",
  "",
  "The following constitution and SOP are now in effect for this session.",
  "Call `sdd_get_state` before any state-modifying tool.",
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
