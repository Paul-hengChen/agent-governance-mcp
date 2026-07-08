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

// Compose-not-strip (ticket A9): the constitution is assembled additively from
// the ordered fragment manifest (single source of truth, shared with
// prompts/build.ts and scripts/measure-context-cost.mjs via the compiled
// dist/prompts/constitution-manifest.js). This replaces the old duplicated
// stripChainOnly regex + monolithic content/constitution.md read — the DR-3
// "keep the regex in sync" contract is now structural (one imported manifest),
// see specs/compose-not-strip-overlays-architecture.md DR-4. The hook ALWAYS
// includes the design-tagged fragments (it never stripped design-only text);
// lite additionally applies the \n{3,} blank-run collapse the old
// stripChainOnly performed, so lite output stays byte-identical.
// Fail-loud: if the manifest import fails (dist/ missing during a partial
// install), return "" so the existing "hook misconfigured" hint fires below —
// never silently ship a partial bundle.
async function composeConstitution(wantChain) {
  try {
    const mod = await import(
      pathToFileURL(path.join(SERVER_ROOT, "dist", "prompts", "constitution-manifest.js")).href
    );
    const text = mod.CONSTITUTION_SEGMENTS
      .filter((s) => mod.includeSegment(s.tag, { chain: wantChain, design: true }))
      .map((s) => loadContent(s.file))
      .join("");
    return wantChain ? text : text.replace(/\n{3,}/g, "\n\n");
  } catch {
    return "";
  }
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
// Lite bootstrap (the default) is server-read-only with no chain → the chain
// fragments are excluded. Full coordinator composes the complete constitution.
const constitution = await composeConstitution(skillVariant === "skill-coordinator.md");
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

// C11 L2 dedup marker: record that the FULL constitution was just emitted so
// a /teamwork* prompt fetch within the next 120s can substitute the S03
// sentinel instead of a second full copy (read by index.ts hookMarkerFresh).
// Written ONLY on this successful full-body emit — never on the
// misconfigured-hint branch above. Fail-safe by construction: if the write
// fails (e.g. no .current/ dir in a tasks.md/TODO.md-only workspace, or a
// permissions error), there is simply no marker and the server re-emits the
// full constitution — a marker write failure must never break the hook.
try {
  fs.writeFileSync(
    path.join(workspace, ".current", ".agc-hook-marker.json"),
    JSON.stringify({ ts: Date.now(), pid: process.pid })
  );
} catch {
  // Silent: dedup is best-effort; the fail-safe path is double emission.
}
