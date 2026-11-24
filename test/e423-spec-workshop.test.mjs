// Coded by @qa-engineer
// Tests for specs/e423-spec-workshop.md (ticket E423): the prompt-only `spec-workshop` role, the integrator
// Stage 2 wave-table exception, coordinator prototype-export detection, design mode `prototype` with the
// dual-source rule, and the server arming on a declared-but-unrecognised design mode. One group per AC
// (AC1-AC4, AC6-AC17; AC5 is test/skill-frontmatter.test.mjs). Anchors are the spec's Copy / Strings rows,
// quoted verbatim. Resident-test hygiene: stable structure of growable files only, no fixed base sha.

import { test, after } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (...p) => fs.readFileSync(path.join(ROOT, ...p), "utf-8");

const { PROMPT_REGISTRY, TOOL_REGISTRY } = await import(path.join(ROOT, "dist", "tools", "registry.js"));
const { buildPromptForRole, stripRationale, stripOriginTags } = await import(path.join(ROOT, "dist", "prompts", "build.js"));
const { composeSkill, hostCapabilitiesFor } = await import(path.join(ROOT, "dist", "prompts", "skill-manifest.js"));
const { parseSkillFile } = await import(path.join(ROOT, "dist", "tools", "skill-frontmatter.js"));
const { checkSourceCredibility, hasDesignModeRequiringVisual } = await import(path.join(ROOT, "dist", "gates", "visual.js"));
const { writeHandoffState } = await import(path.join(ROOT, "dist", "tools", "handoff.js"));
const { markStateRead, resetSession } = await import(path.join(ROOT, "dist", "guards", "session.js"));
const { setActiveStorage, FileHandoffStorage } = await import(path.join(ROOT, "dist", "tools", "storage.js"));
const { handleUpdateState } = await import(path.join(ROOT, "dist", "tools", "handoff-orchestrator.js"));
const { forceSeedStamp } = await import("./e148-seed-stamp.mjs");

const SOP = read("content", "skill-spec-workshop.md");
const COORD1 = read("content", "coord-01-core-head.md");
const DA = read("content", "skill-design-auditor.md");
const INTEG = read("content", "skill-integrator.md");

const made = [];
after(() => {
  for (const d of made) fs.rmSync(d, { recursive: true, force: true });
});
function mkWs(prefix = "e423-") {
  const ws = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  made.push(ws);
  fs.mkdirSync(path.join(ws, ".current"), { recursive: true });
  return ws;
}

const DESCRIPTION =
  "Spec workshop — turn specs, design sources, issue-tracker items or an idea into dated rulings, ticket files and a wave table, in rounds with the human. Human-started; writes no handoff state.";
const NO_HANDOFF =
  "**Never call `tw_update_state`, `tw_add_task`, `tw_complete_task`, `tw_rollback_task`, `tw_void_task` or `tw_sync`**, and never write any `.current/` file; `tw_get_state` and `tw_detect_drift` are allowed for reading.";

// ---------------------------------------------------------------------------
// A. Prompt registration
// ---------------------------------------------------------------------------

test("AC1: PROMPT_REGISTRY has 13 entries, spec-workshop last, the first 12 untouched in order", () => {
  // WHY: the thirteenth prompt must be an append — a reorder would change every adopter's prompt list.
  assert.equal(PROMPT_REGISTRY.length, 13);
  assert.deepEqual(
    PROMPT_REGISTRY.slice(0, 12).map((e) => e.name),
    ["sr-engineer", "researcher", "pm", "qa-engineer", "teamwork", "teamwork-lite", "architect", "design-auditor", "code-reviewer", "doc-writer", "release-engineer", "integrator"],
  );
  assert.deepEqual(PROMPT_REGISTRY[12], {
    name: "spec-workshop",
    description: DESCRIPTION,
    skillFile: "skill-spec-workshop.md",
    arguments: PROMPT_REGISTRY[0].arguments,
  });
  assert.deepEqual(PROMPT_REGISTRY[12].arguments.map((a) => a.name), ["workspace_path"]);
});

function spawnAndAwait(messages, targetId, waitMs = 30000) {
  return new Promise((resolve) => {
    const p = spawn("node", [path.join(ROOT, "dist", "index.js")], { stdio: ["pipe", "pipe", "pipe"] });
    let stdout = "";
    let settled = false;
    const finish = (msg) => {
      if (settled) return;
      settled = true;
      clearTimeout(ceiling);
      p.kill();
      resolve(msg ?? null);
    };
    p.stdout.on("data", (d) => {
      stdout += d.toString();
      for (const line of stdout.split("\n")) {
        if (!line.trim()) continue;
        try {
          const msg = JSON.parse(line);
          if (msg && msg.id === targetId) { finish(msg); return; }
        } catch {
          // partial line: reprocessed on the next data event
        }
      }
    });
    p.stderr.on("data", () => {});
    p.on("close", () => finish(null));
    for (const m of messages) p.stdin.write(JSON.stringify(m) + "\n");
    const ceiling = setTimeout(() => finish(null), waitMs);
  });
}
const INIT = { jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2024-11-05", capabilities: {}, clientInfo: { name: "qa-test", version: "0" } } };

test("AC2: stdio prompts/list names spec-workshop with its description; prompts/get returns constitution + SOP body", async () => {
  const list = await spawnAndAwait([INIT, { jsonrpc: "2.0", method: "notifications/initialized" }, { jsonrpc: "2.0", id: 2, method: "prompts/list" }], 2);
  assert.ok(list, "received prompts/list response");
  const entry = list.result.prompts.find((x) => x.name === "spec-workshop");
  assert.ok(entry, "spec-workshop listed");
  assert.equal(entry.description, DESCRIPTION);

  const ws = mkWs("e423-ac2-");
  const get = await spawnAndAwait(
    [INIT, { jsonrpc: "2.0", method: "notifications/initialized" }, { jsonrpc: "2.0", id: 2, method: "prompts/get", params: { name: "spec-workshop", arguments: { workspace_path: ws } } }],
    2,
  );
  assert.ok(get && get.result, `expected result, got: ${JSON.stringify(get).slice(0, 200)}`);
  assert.equal(get.result.messages.length, 1, "one message");
  const text = get.result.messages[0].content.text;
  assert.match(text, /^# Constitution$/m, "constitution loaded");
  assert.ok(text.includes("# Skill: spec-workshop"), "SOP body loaded");
});

test("AC3: tw_switch_role rejects role spec-workshop; role.ts and transitions.ts never mention it", async () => {
  // WHY: spec-workshop is prompt-only; admitting it as a routing role would put a human-dialogue role in the chain.
  const entry = TOOL_REGISTRY.find((t) => t.name === "tw_switch_role");
  assert.ok(entry, "tw_switch_role registered");
  const ws = mkWs("e423-ac3-");
  assert.ok(!entry.inputSchema.properties.role.enum.includes("spec-workshop"), "advertised JSON Schema enum excludes it");
  const rejects = async (role) => {
    try {
      const r = await entry.run({ workspace_path: ws, role });
      return r.isError === true;
    } catch {
      return true;
    }
  };
  assert.equal(await rejects("spec-workshop"), true, "the zod boundary rejects role spec-workshop");
  assert.equal(await rejects("pm"), false, "control: a real role is accepted");
  assert.ok(!/spec-workshop/.test(read("tools", "role.ts")), "tools/role.ts must not mention spec-workshop");
  assert.ok(!/spec-workshop/.test(read("tools", "transitions.ts")), "tools/transitions.ts must not mention spec-workshop");
});

test("AC4: prompts/spec-workshop.ts is a thin buildPromptForRole wrapper; no subagent template exists", () => {
  const ts = read("prompts", "spec-workshop.ts");
  assert.match(ts, /export function buildSpecWorkshopPrompt/);
  assert.match(ts, /buildPromptForRole\(\s*\n?\s*"skill-spec-workshop\.md"/);
  assert.equal(fs.existsSync(path.join(ROOT, "templates", "claude-code-agents", "spec-workshop.md")), false);
});

// ---------------------------------------------------------------------------
// B. The SOP
// ---------------------------------------------------------------------------

const SW_BUNDLE = (() => {
  const ws = mkWs("e423-bundle-");
  setActiveStorage(new FileHandoffStorage());
  return buildPromptForRole("skill-spec-workshop.md", DESCRIPTION, ws).messages[0].content.text;
})();

test("AC6: composed prompt carries all seven SOP step units (six steps + the short form)", () => {
  // WHY: a dropped step silently changes the role's contract; counts steps INCLUDING the short form.
  const anchors = [
    "# Skill: spec-workshop",
    "## Steps",
    "1. **Entry check**",
    "2. **Check what exists first**",
    "3. **Delegate bulk reading**",
    "4. **Ask in batches, record as you go**",
    "5. **Done condition**",
    "6. **End without filing**",
    "## Short form",
  ];
  for (const a of anchors) assert.ok(SW_BUNDLE.includes(a), `composed prompt missing: ${a}`);
  const stepsSection = SOP.slice(SOP.indexOf("## Steps"), SOP.indexOf("## Short form"));
  assert.equal((stepsSection.match(/^\d\. \*\*/gm) || []).length, 6, "exactly six numbered steps under ## Steps");
  assert.ok(SW_BUNDLE.includes("The short form writes no wave table."));
});

test("AC7: SOP carries the no-handoff prohibition verbatim, no call instruction, and the not-subagent line", () => {
  assert.ok(SOP.includes(NO_HANDOFF), "sop.no-handoff verbatim");
  const names = ["tw_update_state", "tw_add_task", "tw_complete_task", "tw_rollback_task", "tw_void_task", "tw_sync"];
  const mentioning = SOP.split("\n").filter((l) => names.some((n) => l.includes(n)));
  assert.deepEqual(mentioning, [NO_HANDOFF], "every mention of a write tool is inside the prohibition line");
  assert.ok(SOP.includes("This role is never dispatched as a subagent: a subagent has no channel for rounds of dialogue with the human."));
});

test("AC8: entry condition — three entry kinds, several items, named items only, split/merge, small work to coordinator", () => {
  const step1 = SOP.slice(SOP.indexOf("1. **Entry check**"), SOP.indexOf("2. **Check what exists first**"));
  assert.ok(step1.includes("a spec or design source to break down"));
  assert.ok(step1.includes("an idea that needs several rounds"));
  assert.ok(step1.includes("an issue-tracker item that has no ticket file, whatever its size"));
  assert.ok(step1.includes("One run may take several item numbers."));
  assert.ok(step1.includes("Work only on the items the human names; never pull items from the tracker yourself."));
  assert.ok(step1.includes("One item may become several tickets, and several items may become one."));
  assert.ok(step1.includes("Work that fits one or two files and is not a tracker item goes to the ordinary coordinator intake"));
});

test("AC9: outputs — rulings table, dated/replacing rulings, ticket format, wave table, approval row, short form no wave", () => {
  const out = SOP.slice(SOP.indexOf("## Outputs"), SOP.indexOf("## Governance state"));
  assert.ok(out.includes("## Rulings"));
  assert.ok(out.includes("| # | date | question | ruling | replaces |"));
  assert.ok(out.includes("<agc install>/docs/ticket-format.md") && out.includes("<agc install>/templates/ticket.md"));
  assert.ok(out.includes("(`<agc install>` = agc's install directory, not the workspace)"));
  assert.ok(out.includes("written only by this role"));
  assert.ok(out.includes("`source` = `<item number> rev <revision>`"));
  assert.ok(out.includes("empty in a public repository"));
  assert.ok(out.includes("| wave | ticket | depends on |"));
  assert.ok(out.includes("| date | decided by | content | source |"));
  assert.ok(out.includes("`decided by` = `human`"));
  assert.ok(/Write each ruling to the record the moment it is made, with its date; a ruling that replaces an earlier one names the one it replaces/.test(SOP));
  assert.ok(SOP.includes("The short form writes no wave table."));
});

test("AC10: done condition (one verification, device-or-person flag, conflict rulings) and the no-filing ends", () => {
  assert.ok(SOP.includes("every scenario has one verification, every device-or-person scenario is marked, and every conflict between sources has a ruling"));
  assert.ok(SOP.includes("automated test, command, device-or-person"));
  assert.ok(SOP.includes("`needs device or person: yes`"));
  assert.ok(SOP.includes("Each divergence between a Figma file and a prototype is a conflict."));
  assert.ok(SOP.includes("`not doing`") && SOP.includes("`not ready to cut`"));
  assert.ok(/list the open questions/.test(SOP));
  assert.ok(/file nothing/.test(SOP));
});

// The text an agent receives: rationale and origin spans removed. Added text carries no rationale, but the
// pre-existing design-auditor line that now also carries `prototype` cites a repo path INSIDE a rationale fence.
const dispatchView = (t) => stripRationale(stripOriginTags(t));
const REPO_ONLY = [
  /(?<![\w<>/-])specs\/(?!<)/,
  /(?<![\w<>/-])research\//,
  /docs\/discussion-/,
  /docs\/backlog\.md/,
  /(?<!<agc install>\/)(?<![\w/-])(?:tools|gates)\/[\w-]+\.ts/,
  /(?<!<agc install>\/)(?<![\w/-])scripts\/[\w-]+\.mjs/,
  /(?<!<agc install>\/)docs\/ticket-format\.md/,
  /(?<!<agc install>\/)templates\/ticket\.md/,
  /\bE\d{3}\b/,
];
function addedLines(text, needles) {
  return dispatchView(text).split("\n").filter((l) => needles.some((n) => l.includes(n)));
}

test("AC11: spec-workshop SOP and the added text in coord-01 / design-auditor / integrator cite no repo-only path or ticket id", () => {
  // WHY: content/** ships to every adopter; a path or id that exists only in this repo is a dead lead.
  const scopes = [
    ["skill-spec-workshop.md", dispatchView(SOP).split("\n")],
    ["coord-01-core-head.md", addedLines(COORD1, ["prototype", "spec-workshop", "ticket file"])],
    ["skill-design-auditor.md", addedLines(DA, ["prototype", "Dual source", "dual-source"])],
    ["skill-integrator.md", addedLines(INTEG, ["spec-workshop"])],
  ];
  for (const [file, lines] of scopes) {
    assert.ok(lines.length > 0, `${file}: found no added lines to scan (anchor drift)`);
    for (const l of lines) for (const re of REPO_ONLY) assert.ok(!re.test(l), `${file}: ${re} matched: ${l.slice(0, 120)}`);
  }
  assert.ok(SOP.includes("`<agc install>/docs/ticket-format.md`") && SOP.includes("`<agc install>/templates/ticket.md`"));
});

// ---------------------------------------------------------------------------
// C. Integrator Stage 2 exception
// ---------------------------------------------------------------------------

test("AC12: integrator Stage 2 carries the wave-table exception with both Decisions rows and the halt rule", () => {
  const para = INTEG.split("\n").filter((l) => l.includes("**Wave table approved in `spec-workshop`**"));
  assert.equal(para.length, 1, "exception sits on exactly one line");
  const l = para[0];
  assert.ok(l.includes("**Wave table approved in `spec-workshop`** — a stated exception to Constitution §3.1's rule that only a directly witnessed approval counts:"));
  assert.ok(l.includes("converted from a committed `spec-workshop` wave table"));
  assert.ok(l.includes("changes none of the approved tickets, their grouping or their order, and leaves no open choice, Stage 2 does not halt"));
  assert.ok(l.includes("`人類`") && l.includes("the wave-table file and its commit sha"));
  assert.ok(l.includes("`整合者`") && l.includes("the conversion changed nothing"));
  assert.ok(l.includes("Any change to the approved tickets, their grouping or their order, or any open choice, halts here as above."));
  // pre-existing Stage 2 sentences remain on the same line
  assert.ok(l.includes("Without the human's explicit yes in this session, do not enter stage 3."));
  assert.ok(l.includes("When Stage 0 ran, present the cut file with the manifest; one approval covers both."));
  // the SOP never mentions a later relaxation
  assert.ok(!/E443|relax/i.test(l));
});

// ---------------------------------------------------------------------------
// D. Coordinator design-source detection
// ---------------------------------------------------------------------------

test("AC13: composed coordinator SOP matches local prototype exports; no ticket file -> hint only; ticket file -> design-auditor", () => {
  const composed = composeSkill("skill-coordinator.md", hostCapabilitiesFor("claude-code"), (f) => read("content", f));
  const sec = composed.slice(composed.indexOf("## Design-source detection"), composed.indexOf("## Auto-Routing"));
  assert.ok(sec.length > 0, "Design-source detection section found");
  const bullet = "- Local prototype exports: a local directory or `.html` page exported from a design tool as a prototype (a single-screen prototype page or a runnable demo app), or local files the prose calls a `prototype`, `原型` or `プロトタイプ` of the design.";
  assert.ok(sec.includes(bullet), "coord.match-prototype");
  // the new bullet joins the existing match list, before the "If ≥ 1 hit" paragraph; the existing bullets remain
  const iBullet = sec.indexOf(bullet);
  const iHit = sec.indexOf("If ≥ 1 hit → route to `design-auditor` *before* PM.");
  assert.ok(iHit > iBullet, "existing 'If ≥ 1 hit' paragraph follows the match list");
  for (const old of ["- Host patterns: `figma.com`", "- File extensions referenced as design:", "- Keywords (any language): `mockup`"]) {
    assert.ok(sec.indexOf(old) !== -1 && sec.indexOf(old) < iBullet, `existing bullet kept ahead of the new one: ${old}`);
  }
  assert.ok(sec.includes("reply only with \"No ticket file for this design prototype — start the `spec-workshop` prompt first.\" and stop (no chain)"));
  assert.ok(sec.includes("With a ticket file → route to `design-auditor` as above."));
  assert.ok(sec.includes("A ticket file is a Markdown file in the ticket format, by default under `docs/tickets/` (`ticketDir` in `.current/.config.json`)."));
});

// ---------------------------------------------------------------------------
// E. design-auditor mode `prototype`
// ---------------------------------------------------------------------------

test("AC14: design-auditor names prototype in the mode list, detection row, 2a/2b/3, dual-source rule and escalation row", () => {
  assert.ok(DA.includes("- **Mode** — one of `figma`, `sketch`, `xd`, `penpot`, `pdf`, `image`, `paper`, `prototype`, `no-design`. One line."));
  assert.ok(DA.includes("| local prototype export (a single-screen prototype page or a runnable demo app exported from a design tool) | `prototype` |"));
  const lines = DA.split("\n");
  const step2a = lines.find((l) => l.startsWith("2a. **Volume Gate"));
  const step2b = lines.slice(lines.findIndex((l) => l.startsWith("2b. "))).slice(0, 8).join("\n");
  assert.ok(step2a.includes("`image`/`pdf`/`paper`/`no-design` skip this gate (human-confirmed values, no bulk fetch)."), "2a existing sentence byte-identical");
  assert.ok(step2a.includes("`prototype` runs this gate only when the design tool's remote project is readable (count its screens from project metadata); a local-only export skips it."));
  assert.ok(step2b.includes("`image`/`pdf`/`paper`/`no-design` modes skip this gate (human-confirmed sources)."), "2b existing sentence byte-identical");
  assert.ok(step2b.includes("`prototype` skips this gate: every prototype page is a full screen."));
  assert.ok(DA.includes("- `prototype`: open the exported page or run the demo app locally; capture each state as a screenshot for *Visual Baselines*; record each state's behaviour (transitions, inputs) from the prototype's own logic."));
  assert.ok(DA.includes("**Dual source (`prototype` + Figma)**: declare mode `prototype` and list both in `## Source`. Figma fixes which states exist; the prototype fixes how each state behaves. Every divergence is a ruling item: before a ticket file exists it is ruled in `spec-workshop`; after, STOP per *Escalation Routes: dual-source divergence*. A divergence already ruled in the ticket's discussion record is not raised again."));
  assert.ok(DA.includes("| dual-source divergence (mode `prototype` with Figma) | Blocked | `design-auditor: dual-source divergence — <n> item(s) between Figma and the prototype need a human ruling` | pm |"));
});

test("AC14 (D5): in a dual-source design the Figma rows still run step 2b (the credibility classification)", () => {
  // WHY: the server's credibility check keys on the declared mode and is dormant for `prototype`, so the SOP is the
  // only thing keeping a wrong-node-type Figma row from slipping through in a dual-source design.
  assert.ok(DA.includes("In a dual-source design (`prototype` + Figma), the Figma rows still run this gate."));
});

// ---------------------------------------------------------------------------
// F. Server mode parsing (gates/visual.ts)
// ---------------------------------------------------------------------------

const BAD_ROW = [
  "| medium | pointer | fetched | status | credibility | reason |",
  "|--------|---------|---------|--------|-------------|--------|",
  "| figma | 12:345 | yes | audited | component-variant | — |",
].join("\n");
function dws(modeBlock) {
  const dir = mkWs("e423-mode-");
  fs.mkdirSync(path.join(dir, "design"), { recursive: true });
  fs.writeFileSync(path.join(dir, "design", "feat.md"), `# design/feat\n\n${modeBlock}\n\n## Source\n\n${BAD_ROW}\n`, "utf-8");
  return dir;
}
function both(modeBlock) {
  const dir = dws(modeBlock);
  const c = checkSourceCredibility(dir, "feat");
  const a = hasDesignModeRequiringVisual(dir, "feat");
  assert.equal(c.mode, a.mode, "the two entry points disagree on the mode");
  return { mode: c.mode, ok: c.ok, required: a.required };
}

test("AC15: `mode: prototype` (inline, bullet, H2) is a known mode that arms the checks but not the Figma-only credibility check", () => {
  // WHY: prototype is not FETCH_BASED (every prototype page is a full screen), so the audited figma row lacking
  // full-page-composite must not fail it.
  for (const block of ["mode: prototype", "- **Mode** — `prototype`", "## Mode\n\nprototype"]) {
    const r = both(block);
    assert.equal(r.mode, "prototype", block);
    assert.equal(r.required, true, block);
    assert.equal(r.ok, true, `${block}: credibility must stay dormant`);
  }
  // control: the same bad row DOES fail for a fetch-based mode
  assert.equal(both("mode: figma").ok, false, "control: figma still arms the credibility check");
});

test("AC16: an unrecognised declared mode is returned, arms the checks, never arms the Figma-only check", () => {
  for (const [block, token] of [
    ["mode: mockup", "mockup"],
    ["- **Mode** — code (not from Figma)", "code"],
    ["## Mode\n\nfreehand", "freehand"],
  ]) {
    const r = both(block);
    assert.equal(r.mode, token, block);
    assert.equal(r.required, true, block);
    assert.equal(r.ok, true, `${block}: E384 protection — credibility stays unarmed`);
  }
});

test("AC16 (security smoke): a 100 000-character token is cut to 40 characters plus an ellipsis and does not throw", () => {
  const r = both(`mode: ${"y".repeat(100_000)}`);
  assert.equal(r.mode, `${"y".repeat(40)}…`);
  assert.equal(r.mode.length, 41);
  assert.equal(r.required, true);
  // boundary: exactly 40 is returned whole, 41 is cut
  assert.equal(both(`mode: ${"z".repeat(40)}`).mode, "z".repeat(40));
  assert.equal(both(`mode: ${"z".repeat(41)}`).mode, `${"z".repeat(40)}…`);
  // special characters in the prose after the token do not leak into the value
  assert.equal(both("mode: mockup <script>alert(1)</script>").mode, "mockup");
});

test("AC18 (regression guard): a known mode on a later candidate beats an unknown earlier one; null cases stay null", () => {
  assert.equal(both("## Mode\n\nfigma\n\n- mode: dark").mode, "figma");
  assert.equal(both("mode: <figma> (see board)").mode, "figma");
  assert.equal(both("mode: —").mode, null);
  const none = hasDesignModeRequiringVisual(mkWs("e423-none-"), "feat");
  assert.deepEqual({ mode: none.mode, required: none.required }, { mode: null, required: false });
  assert.deepEqual(
    (({ mode, required }) => ({ mode, required }))(hasDesignModeRequiringVisual(dws("# nothing declared here"), "")),
    { mode: null, required: false },
    "empty feature",
  );
});

// AC17 — end to end through the real orchestrator.
test("AC17: judge PASS on a feature whose design declares `mode: mockup` with no Visual Baselines -> VISUAL_BASELINES_REQUIRED naming mode=mockup", async () => {
  // WHY: before E423 this design file left the visual checks silently unarmed (adopter report); the PASS-time
  // gate must now reject it and name the unrecognised value so the operator can fix the file.
  const ws = mkWs("e423-e2e-");
  const feature = "e423-mockup";
  fs.mkdirSync(path.join(ws, "design"), { recursive: true });
  fs.writeFileSync(path.join(ws, "design", `${feature}.md`), `# design\n\nmode: mockup\n`);
  setActiveStorage(new FileHandoffStorage());
  resetSession(ws);
  markStateRead(ws);
  await writeHandoffState({
    workspacePath: ws,
    activeFeature: feature,
    status: "In_Progress",
    completedTasks: [],
    pendingNotes: ["code-reviewer: claiming review"],
    // E435: code-reviewer is the only PASS writer; a qa-engineer PASS stops at the judge guard
    // before the visual gate, so the seed is code-reviewer:In_Progress.
    lastAgent: "code-reviewer",
  });
  forceSeedStamp(ws);
  resetSession(ws);
  markStateRead(ws);
  const r = await handleUpdateState({
    workspace_path: ws,
    active_feature: feature,
    status: "PASS",
    agent_id: "code-reviewer",
    completed_tasks: ["T-E423-X"],
    review_task_ids: ["T-E423-X"],
    pending_notes: ["code-reviewer: PASS"],
    qa_review: "Looks good.",
  });
  const text = r.content?.[0]?.text ?? "";
  assert.ok(r.isError, `must be rejected; got: ${text}`);
  assert.match(text, /VISUAL_BASELINES_REQUIRED/);
  assert.match(text, /mode=mockup/);
});
