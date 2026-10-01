#!/usr/bin/env node
// SessionStart hook helper for agent-governance-mcp.
// Emits Claude Code's `additionalContext` JSON on stdout with the constitution,
// skill (workspace override or server default) and current handoff state, but
// only when the workspace looks managed (.current/, tasks.md or TODO.md);
// otherwise it exits silently with no output, so unrelated projects stay clean.
// Env: AGC_SERVER_ROOT (alias: TEAMWORK_SERVER_ROOT, SDD_SERVER_ROOT) points at
// another checkout; CLAUDE_PROJECT_DIR is the workspace (set by Claude Code).

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

// Compose-not-strip (ticket A9): the constitution is assembled from the ordered
// fragment manifest in dist/prompts/constitution-manifest.js, the one source
// shared with prompts/build.ts and scripts/measure-context-cost.mjs (DR-4).
// Design-tagged fragments are always included; lite also collapses \n{3,}
// blank runs so its output stays byte-identical. Fail-loud: if the import
// fails, return "" so the "hook misconfigured" hint fires below, never a
// partial bundle. Background: see specs/e260c-bin-scripts.md.
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

// Host-capability skill composition (ticket D6): the skill text comes from the
// fragment registry in dist/prompts/skill-manifest.js, like the constitution.
// The hook is Claude-Code-only, so with no "host" in .current/.config.json it
// defaults to the full profile { taskTool: true }; an explicit host still
// overrides. Unsplit skills and a whole-file .current/ override pass through
// as-is. Fail-loud: on import failure return "", same as composeConstitution.
async function composeSkillText(skillFile) {
  try {
    const mod = await import(
      pathToFileURL(path.join(SERVER_ROOT, "dist", "prompts", "skill-manifest.js")).href
    );
    let host;
    try {
      const cfg = JSON.parse(
        readSafe(path.join(workspace, ".current", ".config.json")) || "{}"
      );
      if (cfg && typeof cfg.host === "string" && cfg.host) host = cfg.host;
    } catch {
      // Malformed/absent config: fall through to the structural CC default.
    }
    const caps = host ? mod.hostCapabilitiesFor(host) : { taskTool: true };
    return mod.composeSkill(skillFile, caps, loadContent, (f) =>
      fs.existsSync(path.join(workspace, ".current", f))
    );
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
const rawSkill = await composeSkillText(skillVariant);

// The lane handoff path (E123 F1 L3) comes from the compiled lane-layout seam
// (dist/tools/lane-paths.js), never a restated filename; path.resolve pins an
// ABSOLUTE workspace (L-SCHEMA-NEW-9). Fail-loud: if the import fails (dist/
// missing during a partial install), return null so the "hook misconfigured"
// hint fires below — never fall back to a hard-coded flat path.
async function resolveHandoffPath() {
  try {
    const mod = await import(
      pathToFileURL(path.join(SERVER_ROOT, "dist", "tools", "lane-paths.js")).href
    );
    return mod.resolveCurrentLanePaths(path.resolve(workspace)).handoffPath;
  } catch {
    return null;
  }
}
const handoffPath = await resolveHandoffPath();

// State renders inside a labelled fence it cannot structurally escape (E137,
// Option B + J2-NEW-1), never as the raw handoff.md file: parsed by the
// READ-ONLY dist/tools/handoff-parse.js parseHandoff, rendered by the same
// renderHandoffStateBlock buildPromptForRole uses, so both sites emit
// byte-identical state blocks. Fail-loud: if either import fails, return null
// so the "hook misconfigured" hint fires below; never fall back to a raw read.
// Parser behaviour: see specs/e260c-bin-scripts.md.
async function loadStateRenderer() {
  try {
    const parseMod = await import(
      pathToFileURL(path.join(SERVER_ROOT, "dist", "tools", "handoff-parse.js")).href
    );
    const buildMod = await import(
      pathToFileURL(path.join(SERVER_ROOT, "dist", "prompts", "build.js")).href
    );
    return {
      parseHandoff: parseMod.parseHandoff,
      renderHandoffStateBlock: buildMod.renderHandoffStateBlock,
      renderStateLookupFailedBlock: buildMod.renderStateLookupFailedBlock,
      describeMissingHandoff: buildMod.describeMissingHandoff,
    };
  } catch {
    return null;
  }
}
const stateRenderer = await loadStateRenderer();

if (!constitution || !rawSkill || !handoffPath || !stateRenderer) {
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

// Three outcomes, mirroring buildPromptForRole's footer: parsed state -> the
// shared state block; a throw (HANDOFF_LAYOUT_CONFLICT, refuse-loud schema
// version, malformed frontmatter) -> the shared lookup-failed block, whose
// error text is itself fenced and which never renders note text on its own;
// no file at either path -> a message naming BOTH the lane and flat paths.
function renderStateBlock() {
  let state;
  try {
    state = stateRenderer.parseHandoff(workspace);
  } catch (e) {
    return stateRenderer.renderStateLookupFailedBlock(
      handoffPath,
      e instanceof Error ? e : new Error(String(e))
    );
  }
  if (state) return stateRenderer.renderHandoffStateBlock(state);
  return `## 📍 Current Project State\n\n${stateRenderer.describeMissingHandoff(workspace)}. Call \`tw_get_state\` to initialize.`;
}
const stateBlock = renderStateBlock();

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

// Constitution dedup marker (C11 L2): record that the FULL constitution was just
// emitted, so a /teamwork* prompt fetch within 120s can use the S03 sentinel
// instead of a second copy (read by index.ts hookMarkerFresh). Written ONLY on
// this full-body emit. Fail-safe: if the write fails (no .current/, permissions),
// there is no marker and the server re-emits the full constitution.
try {
  fs.writeFileSync(
    path.join(workspace, ".current", ".agc-hook-marker.json"),
    JSON.stringify({ ts: Date.now(), pid: process.pid })
  );
} catch {
  // Silent: dedup is best-effort; the fail-safe path is double emission.
}
