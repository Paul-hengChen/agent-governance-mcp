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
import { pathToFileURL } from "url";

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

// Duplicate of stripChainOnly() in prompts/build.ts (different module system —
// see specs/context-budget-reduction-architecture.md DR-3); keep the regex in
// sync. Removes <!-- chain-only:start --> … <!-- chain-only:end --> blocks so the
// lite SessionStart bootstrap doesn't pay for chain rules it cannot exercise.
function stripChainOnly(text) {
  return text
    .replace(/<!-- chain-only:start -->[\s\S]*?<!-- chain-only:end -->\n?/g, "")
    .replace(/\n{3,}/g, "\n\n");
}

// Tier mapping for the SessionStart banner. Mirrors specs/model-routing.md.
const MODEL_TIER_LABEL = { opus: "high", sonnet: "medium", haiku: "low" };

// Prefer the compiled shared parser (single source of truth). If the dynamic
// import fails (dist/ missing during a partial install) fall back to a
// last-resort regex strip so raw `---` frontmatter never leaks into context.
async function parseSkill(rawText) {
  try {
    const mod = await import(
      pathToFileURL(path.join(SERVER_ROOT, "dist", "tools", "skill-frontmatter.js")).href
    );
    return mod.parseSkillFile(rawText);
  } catch {
    const m = rawText.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
    if (!m) return { frontmatter: {}, body: rawText };
    const fm = {};
    const modelMatch = m[1].match(/^\s*recommended_model\s*:\s*(opus|sonnet|haiku)\s*$/m);
    if (modelMatch) fm.recommended_model = modelMatch[1];
    return { frontmatter: fm, body: rawText.slice(m[0].length) };
  }
}

const skillVariant = process.env.AGC_DEFAULT_SKILL === "full"
  ? "skill-coordinator.md"
  : "skill-coordinator-lite.md";
// Lite bootstrap (the default) is server-read-only with no chain → strip the
// chain-only sections. Full coordinator keeps the complete constitution.
const rawConstitution = loadContent("constitution.md");
const constitution =
  skillVariant === "skill-coordinator-lite.md"
    ? stripChainOnly(rawConstitution)
    : rawConstitution;
const rawSkill = loadContent(skillVariant);

if (!constitution || !rawSkill) {
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

const { frontmatter, body: skill } = await parseSkill(rawSkill);

const handoffPath = path.join(workspace, ".current", "handoff.md");
const stateBlock = fs.existsSync(handoffPath)
  ? `## 📍 Current Project State (auto-injected at session start)\n\n\`\`\`yaml\n${readSafe(handoffPath)}\n\`\`\``
  : `## 📍 Current Project State\n\nNo handoff state found in this workspace. Call \`tw_get_state\` to initialize.`;

const modelHintLine = frontmatter.recommended_model
  ? `Recommended model: ${frontmatter.recommended_model} (tier ${MODEL_TIER_LABEL[frontmatter.recommended_model]})`
  : null;

const headerLines = [
  "# 🛡️ Agent Governance Auto-Context (SessionStart hook)",
  "",
  "The following constitution and SOP are now in effect for this session.",
  skillVariant === "skill-coordinator-lite.md"
    ? "You are in Coordinator-Lite mode (solo-dev direct-execute). For cross-module work or multi-role chain, the user should invoke `/teamwork` (full mode). Set AGC_DEFAULT_SKILL=full to make full mode the default."
    : "You are currently in Coordinator mode. You can execute simple tasks, or advise the user to switch roles via `/pm`, `/architect`, `/researcher`, `/sr-engineer`, or `/qa-engineer`.",
  "Call `tw_get_state` before any state-modifying tool.",
];
if (modelHintLine) headerLines.push(modelHintLine);

const body = [
  ...headerLines,
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
