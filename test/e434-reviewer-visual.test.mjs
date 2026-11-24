// Coded by @qa-engineer
// Scenario tests for specs/e434-reviewer-visual.md (AC1-AC11, AC13; AC12 is the compose-golden and budget
// re-capture, proved by test/compose-equivalence.test.mjs and test/context-budget.test.mjs).
// Invariant: on the test-first chain the visual verdict belongs to the judge. The visual sub-skill is
// `reviewer-visual`, loaded by code-reviewer only when the design declares `## Visual Baselines`; capture and
// pixel difference are executable checks qa-engineer writes and sr-engineer passes; reviewer-visual reads
// images only for a surface over its threshold, records an accepted difference in `## Allowed Differences`
// with no human stop, and its rejections are ordinary code-reviewer rejections counted in `review_round`.
// The retired visual loop (`visual_round` cap, `visual_split` threshold, `visual_fail:`,
// `VISUAL_ROUND_EXCEEDED`) leaves the served text; server behaviour, gates, counters and schemas do not move.
// Each title starts with its AC id: `--test-name-pattern "AC<n>:"` runs one AC.
// Base values (registry digest D21, base hint texts, file blob digests, the base code-reviewer SOP blob) are
// frozen in this file at write time from base e5ccda0; nothing is re-read from a temp dir later and nothing
// uses `git show`. LANE_END_SHA (below) turns the live-tree digest checks into a closed historical range once
// the lane's last content commit exists (T-E434-08), so the checks stop reading the growing live tree.

import { test, after } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";

import { forceSeedStamp, forceSeedStampIfExists } from "./e148-seed-stamp.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), "utf-8");
const exists = (rel) => fs.existsSync(path.join(ROOT, rel));
const content = (f) => read(path.join("content", f));
const count = (hay, needle) => hay.split(needle).length - 1;
const sha256 = (s) => createHash("sha256").update(s).digest("hex");

const imp = (rel) => import(pathToFileURL(path.join(ROOT, rel)).href);
const { buildPromptForRole } = await imp("dist/prompts/build.js");
const { setActiveStorage, FileHandoffStorage } = await imp("dist/tools/storage.js");
const { GATE_REGISTRY } = await imp("dist/gates/registry.js");
const { UPDATE_STATE_GATE_PIPELINE } = await imp("dist/tools/handoff-orchestrator.js");
const { TOOL_REGISTRY } = await imp("dist/tools/registry.js");
const { CURRENT_VERSIONS } = await imp("dist/schema/versions.js");
const { writeHandoffState } = await imp("dist/tools/handoff.js");
const { markStateRead, resetSession } = await imp("dist/guards/session.js");

const RV = "content/skill-reviewer-visual.md";
const RV_TPL = "templates/claude-code-agents/reviewer-visual.md";

// ------------------------------------------------------------------ Copy / Strings (spec, verbatim)

const COPY = {
  rvTitle: "# Skill: reviewer-visual",
  tplName: "name: reviewer-visual",
  tplModel: "model: opus",
  tplDesc:
    "description: code-reviewer's visual sub-dispatch — the judge context for the visual verdict on a design-armed feature with Visual Baselines; reads images only over threshold.",
  tplWatermark:
    "CRITICAL: End every reply with `— @reviewer-visual (<the model tier you were actually invoked with>)` per Constitution §1 (watermark).",
  crVisualStep:
    "6a. **Visual verdict**: WHEN `design/<feature>.md` declares `## Visual Baselines` → DO read the workspace's `.current/skill-reviewer-visual.md` when it has one, else `<agc install>/content/skill-reviewer-visual.md`, and follow it on the visual checks' output from step 6; it writes `qa_reports/visual_<task-id>.md` and reads an image only for a surface over its threshold → ELSE do not read it.",
  coord05Dispatch:
    "When dispatching `reviewer-visual` (subagent-dispatch tool or `tw_switch_role`) — picked over `code-reviewer` for the judge hop when the feature is design-armed and `design/<feature>.md` has `## Visual Baselines` — the brief MAY",
  qaVisualLabel: "**Visual checks**",
  const11Head: "**Visual verdict is reviewer-visual-owned.**",
  const11Measure: "**Measure first, judge over threshold.**",
  const09Body:
    "- **Visual rejections are review rounds**: a `reviewer-visual` rejection is a code-reviewer `CHANGES_REQUESTED` (`status=FAIL`) and counts once in `review_round`, like any other code-reviewer rejection; there is no separate visual counter, cap or split threshold. A pixel difference that shrinks on every try is progress, not the same failure; at the `fix_try` cap of tries that do not shrink it, sr-engineer stops fixing that surface and hands it to the judge — a baseline comparison never stops a ticket.",
  srProgress:
    "A pixel difference that shrinks on every try is progress, not the same failure; only tries that do not shrink it count toward the `fix_try` cap. At that cap, stop fixing that surface and hand off with it named in your hand-off note; `reviewer-visual` judges it (Constitution §3.1).",
  limitsExample: '(e.g. "the `review_round` cap")',
  rationalePixel:
    "The same philosophy applies to pixel iteration: a difference that shrinks on every try is progress; tries that stop shrinking it run into the `fix_try` cap.",
  hintVisualEvidence: "Run the visual verdict (skill-reviewer-visual) and write the visual report before PASS.",
  mappingVround: "//   VISUAL_ROUND_EXCEEDED           (none)",
  registryFieldComment:
    "Every entry is true except VISUAL_ROUND_EXCEEDED, which only the old path still emits (no served rule quotes it since E434).",
  readmeRvRow:
    "| reviewer-visual  | high   | `opus`            | code-reviewer's visual sub-skill; reads images only over threshold.  |",
  configOverrideRow: ".current/skill-reviewer-visual.md",
  configMigration:
    "**Renamed visual sub-skill**: `skill-qa-visual.md` is now `skill-reviewer-visual.md`, loaded by code-reviewer. After upgrading, a `.current/skill-qa-visual.md` override is no longer read (rename it to `.current/skill-reviewer-visual.md`), and a template copied by hand to `~/.claude/agents/qa-visual.md` stays behind (delete it and copy `templates/claude-code-agents/reviewer-visual.md`).",
};

// ------------------------------------------------------------------ frozen base values (e5ccda0, captured at write time)

// Base hintStatic texts of the two hints the spec derives by substitution (hint.assertions_required,
// hint.report_incomplete): "every other byte unchanged".
const BASE_HINT_ASSERTIONS_REQUIRED =
  "The design-auditor MUST emit it (skill-design-auditor §Artifact Schema) and PM copy it into the spec; qa-visual marks each row pass/fail. Add the section before retrying PASS.";
const BASE_HINT_REPORT_INCOMPLETE =
  "qa_reports/visual_<id>.md must contain Canonical State Verification, Structural Assertions, Region Diff (per-surface pass/accepted), Allowed Differences, and a Verdict that normalizes to exactly PASS — every row cleared (skill-qa-visual §Report schema; headings may carry prefixes/suffixes but must contain the canonical names, evidence schema v2). Resolve the failed/unverified rows — do NOT pre-accept them (visual verdict is qa-visual-owned, Constitution §3.2).";

// D21: sha256 of JSON(GATE_REGISTRY entries, keys sorted) with the four moving fields removed
// (VISUAL_EVIDENCE_MISSING / VISUAL_ASSERTIONS_REQUIRED / VISUAL_REPORT_INCOMPLETE hintStatic,
// VISUAL_ROUND_EXCEEDED documentedInProse).
const BASE_REGISTRY_DIGEST = "56c8a3e8e5c701c3c929f6e0b2f2785fb13b8e317358139bbdeafc6125d5a564";
const MOVING_FIELDS = {
  VISUAL_EVIDENCE_MISSING: ["hintStatic"],
  VISUAL_ASSERTIONS_REQUIRED: ["hintStatic"],
  VISUAL_REPORT_INCOMPLETE: ["hintStatic"],
  VISUAL_ROUND_EXCEEDED: ["documentedInProse"],
};
function registryDigest(registry) {
  const canon = registry.map((g) => {
    const o = { ...g };
    for (const k of MOVING_FIELDS[g.errorCode] ?? []) delete o[k];
    return Object.fromEntries(Object.keys(o).sort().map((k) => [k, o[k]]));
  });
  return sha256(JSON.stringify(canon));
}

// Mapping rows that named skill-qa-visual.md at base (they must name skill-reviewer-visual.md now).
const BASE_QA_VISUAL_MAPPED = [
  "VISUAL_EVIDENCE_MISSING",
  "VISUAL_WIDGETS_UNVERIFIED",
  "VISUAL_REPORT_INCOMPLETE",
  "VISUAL_PROVENANCE_MISSING",
  "BASELINE_MANIFEST_MISSING",
  "BASELINE_PROVENANCE_INCOMPLETE",
  "PIXEL_GATE_ATTESTATION_MISSING",
];

// Git blob id of content/skill-code-reviewer.md at base: the file with step 6a removed must hash to it (AC2).
const BASE_CR_BLOB = "7c5e519ccc564409c201bf597e09132a06e6b35e";
// sha256 over sorted "<path> <blob id>" lines (AC13): tools/transitions.ts, CLAUDE.md, schema/**, prompts/**.
const BASE_FROZEN_BLOBS = "0a83b30c911a555f2c8ec928c3abbd8566481343bddc7fb1c90271b984620150";
const FROZEN_PATHS = ["tools/transitions.ts", "CLAUDE.md", "schema", "prompts"];
// Same digest over dist/** minus the four groups the ticket may rebuild (360 files at base).
const BASE_DIST_OTHER_BLOBS = "67ebb84f3381e4790c733a272386c66113098837cc56915740251e640aecb242";
const DIST_ALLOWED = /^dist\/(gates\/registry|gates\/visual|tools\/evidence-file|tools\/handoff-orchestrator)\./;
const BASE_CURRENT_VERSIONS = { handoff: 16, tasks: 2, sqlite: 2, config: 2 };
// E435 (specs/e435-remove-old-path.md) later removed two ledger gates (35 -> 33) and bumped handoff 16 -> 17.
// E434 moved neither; the live pins carry E435's values, and E434's own "unchanged" half is the closed
// LANE_END_SHA range below, which still reads E434's end commit.
const E435_CURRENT_VERSIONS = { ...BASE_CURRENT_VERSIONS, handoff: 17 };

// null while the lane builds: the digest checks read the live tree. T-E434-08 sets it to the lane's last
// content commit, after which they read that fixed commit (closed range) and skip loudly if it is unreachable.
const LANE_END_SHA = "11073f3d67fb5c2d62af4f0e5cd2000016a495d1"; // T-E434-08: sr-engineer's last source commit (T-E434-07)

// ------------------------------------------------------------------ git helpers (no `git show`)

function git(args, input) {
  return spawnSync("git", args, { cwd: ROOT, encoding: "utf-8", input, maxBuffer: 64 * 1024 * 1024 });
}
function endShaSkipReason() {
  if (!LANE_END_SHA) return null;
  const r = git(["rev-parse", "--verify", `${LANE_END_SHA}^{commit}`]);
  return r.status === 0 ? null : `lane end commit ${LANE_END_SHA} is not reachable in this clone (shallow or squash-merged)`;
}
function walk(rel) {
  const abs = path.join(ROOT, rel);
  if (fs.statSync(abs).isFile()) return [rel];
  return fs.readdirSync(abs).sort().flatMap((f) => walk(path.join(rel, f)));
}
// [path, blob id] pairs for the given paths: at LANE_END_SHA via ls-tree, else the live files via hash-object.
function blobs(paths) {
  if (LANE_END_SHA) {
    const r = git(["ls-tree", "-r", LANE_END_SHA, "--", ...paths]);
    assert.equal(r.status, 0, r.stderr);
    return r.stdout.split("\n").filter(Boolean).map((l) => {
      const [meta, p] = l.split("\t");
      return [p, meta.split(" ")[2]];
    });
  }
  const files = paths.flatMap(walk);
  const r = git(["hash-object", "--stdin-paths"], `${files.join("\n")}\n`);
  assert.equal(r.status, 0, r.stderr);
  const ids = r.stdout.split("\n").filter(Boolean);
  assert.equal(ids.length, files.length, "one blob id per file");
  return files.map((f, i) => [f, ids[i]]);
}
const blobDigest = (pairs) => sha256(pairs.map(([p, b]) => `${p} ${b}`).sort().join("\n"));
// File text at LANE_END_SHA (git archive piped through tar, in memory) or live.
function textAtEnd(rel) {
  if (!LANE_END_SHA) return read(rel);
  const a = spawnSync("git", ["archive", "--format=tar", LANE_END_SHA, rel], { cwd: ROOT, maxBuffer: 64 * 1024 * 1024 });
  assert.equal(a.status, 0, String(a.stderr));
  const x = spawnSync("tar", ["-xO"], { input: a.stdout, maxBuffer: 64 * 1024 * 1024 });
  assert.equal(x.status, 0, String(x.stderr));
  return x.stdout.toString("utf-8");
}
async function registryFrom(jsText) {
  const mod = await import(`data:text/javascript;base64,${Buffer.from(jsText, "utf-8").toString("base64")}`);
  return mod.GATE_REGISTRY;
}
const hashObject = (text) => {
  const r = git(["hash-object", "--stdin"], text);
  assert.equal(r.status, 0, r.stderr);
  return r.stdout.trim();
};

// ------------------------------------------------------------------ text helpers

// The paragraphs / table rows / bullets of a markdown text: each line is a unit, and so is each blank-line
// paragraph (wrapped prose spans several lines).
function units(text) {
  const lines = text.split("\n");
  const paras = text.split(/\n\s*\n/);
  return [...lines, ...paras];
}
// Some unit contains every needle (string: case-sensitive substring; RegExp: test).
function someUnit(text, ...needles) {
  return units(text).some((u) => needles.every((n) => (typeof n === "string" ? u.includes(n) : n.test(u))));
}
// Sentences of a composed prompt: hard-wrapped prose is re-joined first (a newline starts a new unit only
// before a list item, table row, heading, numbered step or blank line), then split at sentence punctuation.
const sentences = (text) =>
  text
    .split(/\n(?=\s*(?:[-*|#>]|\d+[a-z]?[.)]\s|\n|$))/)
    .map((u) => u.replace(/\s*\n\s*/g, " "))
    .flatMap((u) => u.split(/(?<=[.;!?])\s+/));
function frontmatter(text) {
  const m = /^---\n([\s\S]*?)\n---\n/.exec(text);
  assert.ok(m, "frontmatter present");
  return Object.fromEntries(m[1].split("\n").map((l) => [l.slice(0, l.indexOf(":")), l.slice(l.indexOf(":") + 1).trim()]));
}
// A sentence that gives the visual verdict or `## Allowed Differences` to qa: names a qa owner, names the
// visual verdict / allowed differences, and does not name the judge (reviewer-visual / code-reviewer).
const QA_OWNER = /\bqa-engineer\b|\bqa chain\b|\bqa-owned\b|\bqa-authored\b|\bqa-exclusive\b|qa-visual/;
const VERDICT_TERM = /visual verdict|Allowed Differences|allowed-diffs|visual PASS|visual report/i;
const JUDGE = /reviewer-visual|code-reviewer/;
const givesVerdictToQa = (s) => QA_OWNER.test(s) && VERDICT_TERM.test(s) && !JUDGE.test(s);

// ------------------------------------------------------------------ composed prompts

const tmpDirs = [];
after(() => {
  for (const d of tmpDirs) {
    try { fs.rmSync(d, { recursive: true, force: true }); } catch { /* best effort */ }
  }
});
function mkWs(prefix) {
  const ws = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  tmpDirs.push(ws);
  fs.mkdirSync(path.join(ws, ".current"), { recursive: true });
  return ws;
}
const put = (ws, rel, body) => {
  fs.mkdirSync(path.dirname(path.join(ws, rel)), { recursive: true });
  fs.writeFileSync(path.join(ws, rel), body);
};

// A design-armed design file: `## Mode` figma, one baseline surface, one structural assertion, one audited
// Source row (single surface: the provenance section is not required).
const designDoc = (feature) => `# design/${feature}

## Mode

figma

## Source

| medium | pointer | fetched? | status | reason |
|---|---|---|---|---|
| figma | node:1:100 | yes | audited | frozen |

## Visual Baselines

| surface id | source node | baseline path | impl path | viewport | route | canonical state | compare region | notes |
|---|---|---|---|---|---|---|---|---|
| settings.language | node:1:100 | design/baselines/language.png | screenshots/language.png | 1920x1080 | /settings/language | selected: English | 0,0,400,300 | threshold 0.5% |

## Visual Structural Assertions

| assertion id | surface | required element/state | source node/token |
|---|---|---|---|
| focus.bar | settings.language | selected row shows the #3C5AAA bar | node:1:101 |
`;

const COMPOSED_ROLES = {
  "code-reviewer": "skill-code-reviewer.md",
  "qa-engineer": "skill-qa-engineer.md",
  "sr-engineer": "skill-sr-engineer.md",
  pm: "skill-pm.md",
  teamwork: "skill-coordinator.md",
};
const PROMPT_FEATURE = "e434-fixture-feature";
setActiveStorage(new FileHandoffStorage());
const NON_DESIGN_WS = mkWs("e434-nd-");
await new FileHandoffStorage().writeState(NON_DESIGN_WS, PROMPT_FEATURE, "In_Progress", [], []);
const DESIGN_WS = mkWs("e434-d-");
put(DESIGN_WS, `design/${PROMPT_FEATURE}.md`, designDoc(PROMPT_FEATURE));
await new FileHandoffStorage().writeState(DESIGN_WS, PROMPT_FEATURE, "In_Progress", [], []);
const composed = (role, ws) => buildPromptForRole(COMPOSED_ROLES[role], role, ws).messages[0].content.text;
// Captured now, in memory: the temp dirs are never re-read by an assertion.
const DESIGN_BUNDLE = Object.fromEntries(Object.keys(COMPOSED_ROLES).map((r) => [r, composed(r, DESIGN_WS)]));
const CR_NON_DESIGN = composed("code-reviewer", NON_DESIGN_WS);

// ------------------------------------------------------------------ server harness (real tool entries)

const UPD = TOOL_REGISTRY.find((e) => e.name === "tw_update_state");
const ADD = TOOL_REGISTRY.find((e) => e.name === "tw_add_task");
const text = (r) => r?.content?.[0]?.text ?? "";
const rejected = (r) => Boolean(r?.isError) || text(r).startsWith("⛔");

async function seed(ws, feature, agent, status, opts = {}) {
  setActiveStorage(new FileHandoffStorage());
  resetSession(ws);
  markStateRead(ws);
  await writeHandoffState({
    workspacePath: ws, activeFeature: feature, status, completedTasks: [], pendingNotes: ["seed"],
    lastAgent: agent, cutApproved: true, ...opts,
  });
  forceSeedStamp(ws);
  resetSession(ws);
  markStateRead(ws);
}
async function upd(ws, args) {
  setActiveStorage(new FileHandoffStorage());
  forceSeedStampIfExists(ws);
  resetSession(ws);
  markStateRead(ws);
  try {
    return await UPD.run({ workspace_path: ws, completed_tasks: [], pending_notes: [], ...args });
  } catch (err) {
    return { isError: true, content: [{ type: "text", text: `⛔ ${err.message}` }] };
  }
}
async function addTask(ws, id) {
  setActiveStorage(new FileHandoffStorage());
  resetSession(ws);
  markStateRead(ws);
  return ADD.run({ workspace_path: ws, task_id: id, description: `task ${id}` });
}
const state = (ws) => new FileHandoffStorage().parse(ws);

const F = "e434-visual-feat";
const w = (agent, status, extra = {}) => ({ active_feature: F, status, agent_id: agent, ...extra });

const JUDGE_REPORT =
  "# QA review — T-1\n\n## Expected-Red Diff\n\nclean (1/1 manifest entries confirmed red, now green — built)\n\n" +
  "## AC Execution Log\n\nAC1: `node --test x` exit 0 pass\n";

// One surface's prose block: the three provenance lines the server checks.
const surfaceBlock = (id, metric) => `### ${id}\n- baseline: sha256:4be91c02a7d3\n- diff-metric: ${metric}\n- pixel_gate_complete: true\n`;
function visualReport({ result, metric, allowed }) {
  return `# Visual report — T-1

## Widget Shape Verification
- [x] language.list — selectable list rendered (within threshold of the baseline)

## Canonical State Verification
- [x] settings.language — capture check reached {selected: English}

## Structural Assertions
| assertion id | surface | required element/state | source node/token | result |
|---|---|---|---|---|
| focus.bar | settings.language | selected row shows the #3C5AAA bar | node:1:101 | pass |

## Region Diff
| surface | result |
|---|---|
| settings.language | ${result} |

${surfaceBlock("settings.language", metric)}
## Allowed Differences
${allowed}

## Verdict — PASS
`;
}

// A design-armed, test-first feature at code-reviewer:In_Progress with a ledger, the red-test manifest, a spec
// with a proof: line, the judge report and (optionally) the visual report.
async function designJudgeWs(prefix, { visual } = {}) {
  const ws = mkWs(prefix);
  await seed(ws, F, "code-reviewer", "In_Progress", { chainPath: "test-first" });
  await addTask(ws, "T-1");
  put(ws, `design/${F}.md`, designDoc(F));
  put(ws, `qa_reports/expected-red_${F}.txt`, "# scenario test\ntest/x.test.mjs | AC1: red\n");
  put(ws, `specs/${F}.md`, "# spec\n\n## Acceptance Criteria\n\n- **AC1** thing\n  proof: `node --test x`\n");
  put(ws, "qa_reports/review_T-1.md", JUDGE_REPORT);
  if (visual !== undefined) put(ws, "qa_reports/visual_T-1.md", visual);
  return ws;
}

// ================================================================== AC1

test("AC1: skill-reviewer-visual.md (opus, rv.title) and templates/reviewer-visual.md replace the qa-visual pair; 12 templates; template model = SOP recommended_model", () => {
  assert.ok(exists(RV), `${RV} exists`);
  assert.ok(!exists("content/skill-qa-visual.md"), "content/skill-qa-visual.md is gone");
  const rv = read(RV);
  assert.equal(frontmatter(rv).recommended_model, "opus", "sub-skill pinned to opus (ruling 17)");
  assert.ok(rv.split("\n").includes(COPY.rvTitle), "title rv.title");

  assert.ok(exists(RV_TPL), `${RV_TPL} exists`);
  assert.ok(!exists("templates/claude-code-agents/qa-visual.md"), "the qa-visual template is gone");
  const tpl = read(RV_TPL).split("\n");
  assert.equal(tpl[0], "---");
  assert.equal(tpl[1], COPY.tplName, "tpl.rv_name");
  assert.equal(tpl[2], COPY.tplModel, "tpl.rv_model");
  assert.equal(tpl[3], COPY.tplDesc, "tpl.rv_desc");
  assert.equal(tpl[4], "---");
  const body = tpl.slice(5).join("\n");
  const firstBodyLine = tpl.slice(5).find((l) => l.trim().length > 0);
  assert.equal(firstBodyLine, COPY.tplWatermark, "tpl.rv_watermark is the first body line");
  assert.ok(body.includes('tw_switch_role("code-reviewer")'), "the template delegates to the code-reviewer SOP");
  assert.ok(!body.includes('tw_switch_role("qa-engineer")'), "no delegation to qa-engineer");
  assert.ok(body.indexOf("tw_get_state") >= 0 && body.indexOf("tw_get_state") < body.indexOf('tw_switch_role("code-reviewer")'),
    "pre-flight tw_get_state comes before the role switch");

  const tplDir = path.join(ROOT, "templates", "claude-code-agents");
  const files = fs.readdirSync(tplDir).filter((f) => f.endsWith(".md"));
  assert.equal(files.length, 12, `still 12 templates: ${files.join(", ")}`);
  assert.equal(frontmatter(read(RV_TPL)).model, frontmatter(rv).recommended_model, "reviewer-visual template model = SOP recommended_model");
});

// ================================================================== AC2

test("AC2: code-reviewer step 6a (cr.visual_step) between steps 6 and 7; qa SOP loads no visual sub-skill and gives no visual verdict; coord-05 picks reviewer-visual; non-design code-reviewer prompt changes only by step 6a", (t) => {
  const cr = content("skill-code-reviewer.md");
  const lines = cr.split("\n");
  const i6 = lines.findIndex((l) => l.startsWith("6. **Run the full suite**"));
  assert.ok(i6 > 0, "step 6 present");
  assert.equal(lines[i6 + 1], COPY.crVisualStep, "step 6a is cr.visual_step, directly after step 6");
  assert.ok(lines[i6 + 2].startsWith("7. **Expected-Red Diff**"), "step 7 directly after step 6a");
  assert.equal(count(cr, COPY.crVisualStep), 1, "step 6a appears once");
  const iOverride = COPY.crVisualStep.indexOf("`.current/skill-reviewer-visual.md`");
  const iInstall = COPY.crVisualStep.indexOf("`<agc install>/content/skill-reviewer-visual.md`");
  assert.ok(iOverride > 0 && iInstall > iOverride, "workspace override named first, install path second (D5)");

  // qa SOP: no instruction to load the visual sub-skill, no visual verdict or report ownership.
  const qa = content("skill-qa-engineer.md");
  for (const l of qa.split("\n")) {
    assert.ok(!(/\b(read|load|lazy-load|follow)\b/i.test(l) && /skill-(reviewer|qa)-visual/.test(l)),
      `qa SOP tells qa-engineer to load the visual sub-skill: ${l.slice(0, 160)}`);
    if (/visual verdict|Allowed Differences|qa_reports\/visual_/i.test(l)) {
      assert.match(l, JUDGE, `qa SOP line on the visual verdict / report must name the judge, not qa: ${l.slice(0, 160)}`);
    }
  }

  // coord-05: the dispatch line picks reviewer-visual over code-reviewer for the judge hop.
  const c05 = content("coord-05-core-visual-drift.md").split("\n");
  const dl = c05.find((l) => l.startsWith("- **No accept-policy injection.**"));
  assert.ok(dl, "coord-05 dispatch line present");
  assert.equal(dl, `- **No accept-policy injection.** ${COPY.coord05Dispatch}`, "coord05.dispatch verbatim");

  // Non-design composed code-reviewer prompt: carries step 6a once (no fence strips it) ...
  assert.equal(count(CR_NON_DESIGN, COPY.crVisualStep), 1, "the composed non-design code-reviewer prompt carries step 6a once");
  // ... and the SOP it composes is the base SOP plus that one line: removing it gives back the base blob.
  const skip = endShaSkipReason();
  if (skip) return t.skip(skip);
  const live = textAtEnd("content/skill-code-reviewer.md");
  const without = live.replace(`${COPY.crVisualStep}\n`, "");
  assert.notEqual(without, live, "step 6a line found in the SOP source");
  assert.equal(hashObject(without), BASE_CR_BLOB, "skill-code-reviewer.md minus step 6a is byte-identical to base");
});

// ================================================================== AC3

test("AC3: no served file or registry text names qa-visual (two historical spec names allowed); const-11 opens with const11.head and carries const11.measure; no design-armed composed prompt gives the visual verdict to qa", () => {
  const offenders = fs.readdirSync(path.join(ROOT, "content")).filter((f) => content(f).includes("qa-visual"));
  assert.deepEqual(offenders, [], "no served file contains qa-visual");
  const reg = read("gates/registry.ts")
    .replaceAll("specs/qa-visual-baseline-provenance.md", "")
    .replaceAll("specs/qa-visual-pixel-gate-attestation.md", "");
  assert.ok(!reg.includes("qa-visual"), "gates/registry.ts names qa-visual only in the two historical spec file names (D19)");
  for (const g of GATE_REGISTRY) {
    const h = g.hintStatic.replaceAll("specs/qa-visual-baseline-provenance.md", "").replaceAll("specs/qa-visual-pixel-gate-attestation.md", "");
    assert.ok(!h.includes("qa-visual"), `${g.errorCode} hint names qa-visual`);
  }

  const c11 = content("const-11-design-chain-32.md");
  const after32 = c11.slice(c11.indexOf("### 3.2"));
  const firstRule = after32.split("\n").slice(1).find((l) => l.trim().length > 0);
  assert.ok(firstRule && firstRule.startsWith(`- ${COPY.const11Head}`), `§3.2 opens with const11.head: ${firstRule}`);
  assert.ok(c11.includes(COPY.const11Measure), "const11.measure present");

  for (const [role, bundle] of Object.entries(DESIGN_BUNDLE)) {
    assert.ok(bundle.includes("### 3.2 Visual Verdict Authority"), `${role}: fixture is design-armed (§3.2 loaded)`);
    assert.ok(!bundle.includes("qa-visual"), `${role}: design-armed composed prompt names qa-visual`);
    const bad = sentences(bundle).filter(givesVerdictToQa);
    assert.deepEqual(bad, [], `${role}: sentence(s) give the visual verdict or ## Allowed Differences to qa-engineer`);
  }
});

// ================================================================== AC4

test("AC4: qa SOP step 4 has a Visual checks sub-step (capture check, diff check, isolation captures, sr passes both); sr's whole-surface loop runs qa-engineer's checks", () => {
  const qa = content("skill-qa-engineer.md");
  const s4 = qa.indexOf("4. **Write the tests**");
  const s5 = qa.indexOf("\n5. **Run**");
  assert.ok(s4 > 0 && s5 > s4, "steps 4 and 5 located");
  const step4 = qa.slice(s4, s5);
  const at = step4.indexOf(COPY.qaVisualLabel);
  assert.ok(at > 0, "step 4 carries the **Visual checks** sub-step (qa.visual_label)");
  assert.equal(count(qa, COPY.qaVisualLabel), 1, "one Visual checks sub-step");
  const vc = step4.slice(at);
  const must = [
    ["arms on the design's baselines", "`## Visual Baselines`"],
    ["per baseline surface", /\bsurface\b/],
    ["capture check", /capture check/i],
    ["drives the surface to the row's canonical state", /canonical state/i],
    ["actual image to an untracked directory", /untracked/i],
    ["outside the baseline directory", /baseline dir/i],
    ["fails when the state is not reached", /not reached/i],
    ["fails when the baseline file is missing", /baseline[^.;]*missing|missing[^.;]*baseline/i],
    ["fails when the dimensions differ", /dimension/i],
    ["diff check", /diff check/i],
    ["over the row's compare region", /compare region/i],
    ["with an installed tool", /install/i],
    ["records the surface id", /surface id/i],
    ["records the metric", /metric/i],
    ["records the threshold", /threshold/i],
    ["records within / over", "`within`"],
    ["records within / over", "`over`"],
    ["at the location the test report names", "`## Visual Checks`"],
    ["fails only when it cannot measure (R1)", /cannot measure/i],
    ["isolation capture per custom widget state", /isolation/i],
    ["sr-engineer passes both before hand-off", /sr-engineer/],
  ];
  for (const [why, needle] of must) {
    assert.ok(typeof needle === "string" ? vc.includes(needle) : needle.test(vc), `Visual checks sub-step: ${why} (${needle})`);
  }
  assert.ok(someUnit(vc, /sr-engineer/, /hand-?off/i), "sr-engineer passes the checks before hand-off");

  const sr = content("skill-sr-engineer.md");
  const loop = sr.split("\n").find((l) => l.includes("**Whole-surface self-converge loop"));
  assert.ok(loop, "the whole-surface self-converge loop is still there");
  assert.match(loop, /capture check/i, "the loop runs qa-engineer's capture check");
  assert.match(loop, /diff check/i, "the loop runs qa-engineer's diff check");
  assert.match(loop, /qa-engineer/, "the checks are qa-engineer's");
  assert.ok(!loop.includes("region-diff over every declared"), "no region diff of its own");
  assert.ok(!/equivalent to [a-z-]*visual Step B/.test(loop), "no 'equivalent to <sub-skill> Step B' own diff");
});

// ================================================================== AC5

test("AC5: skill-reviewer-visual.md is code-reviewer's sub-skill, reads images only over threshold, records accepted differences with no human stop, rejects as CHANGES_REQUESTED in review_round, and keeps the report contract", () => {
  const rv = read(RV);
  const head = rv.slice(rv.indexOf(COPY.rvTitle), rv.indexOf("\n## "));
  assert.match(head, /code-reviewer/, "header: code-reviewer's sub-skill");
  assert.match(head, /sub-skill/i, "header: a sub-skill");
  assert.ok(head.includes("`qa_reports/visual_<task-id>.md`"), "header: writes qa_reports/visual_<task-id>.md");
  assert.match(rv, /agent_id="code-reviewer"|as code-reviewer|code-reviewer's identity/, "writes as code-reviewer");

  assert.ok(someUnit(rv, /diff check/i, /full[- ]suite/i), "takes each surface's metric from the diff check's record of the judge's full-suite run");
  assert.ok(someUnit(rv, /\bwithin\b/, "`pass`", /image/i), "a within-threshold surface is recorded `pass` with no image read");
  assert.ok(someUnit(rv, /Widget Shape/, /Canonical State/, /Structural Assertions/, /check/i),
    "R2 (a): within-threshold Widget Shape / Canonical State / Structural Assertions rows come from the checks");
  assert.ok(someUnit(rv, /\bover\b/, "`baseline path`", "`impl path`"), "only an over-threshold surface has its baseline / impl paths read");
  assert.ok(someUnit(rv, "`accepted`", "## Allowed Differences", /reason/i), "an accepted surface is listed under ## Allowed Differences with its reason");
  assert.ok(someUnit(rv, "## Allowed Differences", /surface id/i, /metric/i, /reason/i), "the entry names surface id, metric and reason");
  assert.match(rv, /no human stop/i, "accepting an over-threshold difference needs no human stop");

  assert.match(rv, /CHANGES_REQUESTED/, "rejections are code-reviewer CHANGES_REQUESTED");
  assert.ok(someUnit(rv, /CHANGES_REQUESTED/, "`review_round`"), "each rejection counts once in review_round");
  assert.ok(someUnit(rv, /sr-engineer/, /widget shape/i, /material drift/i), "implementation defects (widget shape, material drift) route to sr-engineer");
  assert.ok(someUnit(rv, /qa-engineer/, /check defect/i, /(wrong|canonical) state|region/i), "check defects (wrong state / region) route to qa-engineer");
  assert.ok(someUnit(rv, /Blocked/, /\bpm\b/, /design defect/i), "design defects go Blocked to pm");
  assert.ok(someUnit(rv, /design defect|Blocked/, /baseline/i, /manifest/i, /scale/i), "design defect = baseline missing, manifest absent, wrong export scale");
  assert.ok(someUnit(rv, /skill-code-reviewer/, /5c/), "contract-defect pointer names skill-code-reviewer step 5c");

  for (const gone of ["Phase 1.5", "visual_round", "visual_fail:", "VISUAL_ROUND_EXCEEDED", "qa-visual", 'agent_id="qa-engineer"']) {
    assert.ok(!rv.includes(gone), `sub-skill must not contain ${gone}`);
  }

  // The server-checked report contract, unchanged.
  for (const h2 of ["Widget Shape Verification", "Canonical State Verification", "Structural Assertions", "Region Diff", "Allowed Differences", "Verdict"]) {
    assert.ok(rv.includes(`## ${h2}`), `report section ## ${h2}`);
  }
  assert.ok(rv.includes("| surface | result |"), "Region Diff result table");
  assert.ok(rv.includes("`pass` / `accepted` / `fail`"), "result vocabulary");
  for (const label of ["`baseline:`", "`diff-metric:`", "`pixel_gate_complete:`"]) assert.ok(rv.includes(label), `provenance matrix label ${label}`);
  assert.ok(rv.includes("pass (carried forward — git diff confirms source untouched)"), "carry-forward annotation (em dash)");
  assert.ok(rv.includes("B1 tool unavailable — LLM fallback"), "B1 fallback token (em dash)");
  assert.match(rv, /PASS sub-verdict/, "PASS sub-verdict rule");
});

// ================================================================== AC6

test("AC6: design-armed test-first feature, every surface pass with a numeric diff-metric, empty Allowed Differences, Verdict PASS → code-reviewer PASS accepted (no visual code fires)", async () => {
  const ws = await designJudgeWs("e434-ac6-", {
    visual: visualReport({ result: "pass", metric: "odiff: 0.2% (threshold 0.5%, within)", allowed: "None." }),
  });
  const r = await upd(ws, w("code-reviewer", "PASS", { completed_tasks: ["T-1"], review_verdict: "APPROVED" }));
  assert.ok(!rejected(r), `judge PASS must be accepted: ${text(r)}`);
  assert.doesNotMatch(text(r), /VISUAL_|BASELINE_|PIXEL_GATE/, "no visual code fires");
  const s = state(ws);
  assert.equal(s.status, "PASS");
  assert.equal(s.last_agent, "code-reviewer");
});

// ================================================================== AC7

test("AC7: one surface accepted in Region Diff with an Allowed Differences entry (surface id + reason) → code-reviewer PASS accepted; the section keeps surface id and reason", async () => {
  const reason = "sub-pixel text anti-aliasing on the row labels; no structural difference";
  const allowed = `- settings.language — odiff: 0.9% (threshold 0.5%) — ${reason}`;
  const ws = await designJudgeWs("e434-ac7-", {
    visual: visualReport({ result: "accepted", metric: "odiff: 0.9% (threshold 0.5%, over; judged by image read)", allowed }),
  });
  const r = await upd(ws, w("code-reviewer", "PASS", { completed_tasks: ["T-1"], review_verdict: "APPROVED" }));
  assert.ok(!rejected(r), `judge PASS with an accepted surface must be accepted: ${text(r)}`);
  assert.equal(state(ws).status, "PASS");
  const report = fs.readFileSync(path.join(ws, "qa_reports", "visual_T-1.md"), "utf-8");
  const section = report.slice(report.indexOf("## Allowed Differences"), report.indexOf("## Verdict"));
  assert.ok(section.includes("settings.language"), "Allowed Differences names the surface id");
  assert.ok(section.includes(reason), "Allowed Differences carries the reason");
});

// ================================================================== AC8

test("AC8: design-armed test-first feature with Visual Baselines and no visual report → code-reviewer PASS rejected VISUAL_EVIDENCE_MISSING naming qa_reports/visual_<id>.md, hint hint.visual_evidence", async () => {
  const ws = await designJudgeWs("e434-ac8-");
  const r = await upd(ws, w("code-reviewer", "PASS", { completed_tasks: ["T-1"], review_verdict: "APPROVED" }));
  assert.ok(rejected(r), "PASS without the visual report is rejected");
  assert.match(text(r), /VISUAL_EVIDENCE_MISSING/);
  assert.ok(text(r).includes(path.join(ws, "qa_reports", "visual_T-1.md")), `names the expected path: ${text(r)}`);
  assert.ok(text(r).includes(COPY.hintVisualEvidence), `hint is hint.visual_evidence: ${text(r)}`);
  assert.equal(state(ws).status, "In_Progress", "no state written");
});

// ================================================================== AC9

test("AC9: (a) a visual code-reviewer rejection counts in review_round and visual_round does not move; (b) the visual counter / split rule text leaves served content", async () => {
  // (a) server: (code-reviewer, FAIL, CHANGES_REQUESTED) with a visual finding.
  const ws = await designJudgeWs("e434-ac9-");
  await seed(ws, F, "code-reviewer", "In_Progress", { chainPath: "test-first", reviewRound: 0, visualRound: 2 });
  const before = state(ws);
  assert.equal(before.visual_round, 2, "fixture: a non-zero visual_round to watch");
  const r = await upd(ws, w("code-reviewer", "FAIL", {
    review_verdict: "CHANGES_REQUESTED",
    review_task_ids: ["T-1"],
    qa_review: "settings.language over threshold: the #3C5AAA selection bar is missing (widget shape)",
    blocking_reason: "visual: selection bar missing on settings.language",
    next_role: "sr-engineer",
    pending_notes: ["code-reviewer: implementation defect — settings.language selection bar missing (visual)"],
  }));
  assert.ok(!rejected(r), `visual rejection write accepted: ${text(r)}`);
  const s = state(ws);
  assert.equal(s.review_round, (before.review_round ?? 0) + 1, "review_round goes up by one");
  assert.equal(s.visual_round, 2, "visual_round does not move");

  // (b) served text.
  const c01 = content("const-01-core-head.md");
  const rows = c01.split("\n");
  assert.ok(!rows.some((l) => l.startsWith("| `visual_round` cap")), "no visual_round cap row");
  assert.ok(!rows.some((l) => l.startsWith("| `visual_split` threshold")), "no visual_split threshold row");
  const naming = rows.find((l) => l.startsWith("Sole authoritative definition of every named numeric limit."));
  assert.ok(naming && naming.includes(COPY.limitsExample), `Limits naming example reads limits.example: ${naming}`);
  for (const f of fs.readdirSync(path.join(ROOT, "content"))) {
    const c = content(f);
    for (const gone of ["visual_round", "visual_split", "visual_fail:", "VISUAL_ROUND_EXCEEDED"]) {
      assert.ok(!c.includes(gone), `content/${f} still contains ${gone}`);
    }
  }
  assert.equal(
    content("const-09-design-chain-vround.md").replace(/\n$/, ""),
    `<!-- design-only:start -->\n${COPY.const09Body}\n<!-- design-only:end -->`,
    "const-09 is exactly const09.body inside its design-only fence",
  );
  const sr = content("skill-sr-engineer.md");
  assert.ok(sr.includes(COPY.srProgress), "sr SOP carries sr.progress");
  assert.ok(!sr.split("\n").some((l) => l.startsWith("|") && /visual split requested/i.test(l)), "no 'visual split requested' Escalation Routes row");
  assert.ok(content("constitution-rationale.md").includes(COPY.rationalePixel), "rationale carries rationale.pixel");
});

// ================================================================== AC10

test("AC10: GATE_REGISTRY — three visual hints renamed, VISUAL_ROUND_EXCEEDED documentedInProse false with mapping.vround, mapping rows name skill-reviewer-visual.md and match the quote sites, field comment, 33 entries (E435), 17 steps, every other field frozen (D21)", async (t) => {
  const live = Object.fromEntries(GATE_REGISTRY.map((g) => [g.errorCode, g]));
  assert.equal(live.VISUAL_EVIDENCE_MISSING.hintStatic, COPY.hintVisualEvidence, "hint.visual_evidence");
  assert.equal(
    live.VISUAL_ASSERTIONS_REQUIRED.hintStatic,
    BASE_HINT_ASSERTIONS_REQUIRED.replace("qa-visual marks each row pass/fail. ", "reviewer-visual marks each row pass/fail. "),
    "hint.assertions_required = base with exactly the one substitution",
  );
  assert.equal(
    live.VISUAL_REPORT_INCOMPLETE.hintStatic,
    BASE_HINT_REPORT_INCOMPLETE
      .replace("(skill-qa-visual §Report schema;", "(skill-reviewer-visual §Report schema;")
      .replace("(visual verdict is qa-visual-owned, ", "(visual verdict is reviewer-visual-owned, "),
    "hint.report_incomplete = base with exactly the two substitutions",
  );
  assert.equal(live.VISUAL_ROUND_EXCEEDED.documentedInProse, false, "VISUAL_ROUND_EXCEEDED documentedInProse: false (D2 (B))");
  for (const g of GATE_REGISTRY) {
    if (g.errorCode !== "VISUAL_ROUND_EXCEEDED") assert.equal(g.documentedInProse, true, `${g.errorCode} stays documentedInProse: true`);
  }

  const src = read("gates/registry.ts");
  const header = src.indexOf("// errorCode → doc-file mapping");
  const endAt = src.indexOf("export const GATE_REGISTRY", header);
  assert.ok(header > 0 && endAt > header, "mapping comment located");
  const mapLines = src.slice(header, endAt).split("\n");
  assert.equal(mapLines.filter((l) => l === COPY.mappingVround).length, 1, "mapping.vround row present once");
  const rows = new Map(mapLines.map((l) => /^\/\/   ([A-Z_]+)\s+(.+)$/.exec(l)).filter(Boolean).map((m) => [m[1], m[2].trim()]));
  assert.equal(rows.size, 33, "one mapping row per code (E435: 33)");
  assert.equal(rows.get("NON_JUDGE_COMPLETED_TASKS_REJECTED"), "const-08-chain-31-mid.md", "E435: NON_JUDGE row names const-08");
  assert.deepEqual(
    [...rows.keys()].slice([...rows.keys()].indexOf("REVIEW_VERDICT_STATUS_MISMATCH"), [...rows.keys()].indexOf("REVIEW_VERDICT_STATUS_MISMATCH") + 2),
    ["REVIEW_VERDICT_STATUS_MISMATCH", "NON_JUDGE_COMPLETED_TASKS_REJECTED"],
    "E435: the NON_JUDGE row sits directly after REVIEW_VERDICT_STATUS_MISMATCH",
  );
  for (const gone of ["QA_ROUND_EXCEEDED", "REVIEWER_COMPLETED_TASKS_REJECTED", "NON_QA_COMPLETED_TASKS_REJECTED"]) {
    assert.ok(!rows.has(gone), `E435: no mapping row for the removed ${gone}`);
  }
  assert.ok(![...rows.values()].some((v) => v.includes("skill-qa-visual.md")), "no mapping row names skill-qa-visual.md");
  for (const code of BASE_QA_VISUAL_MAPPED) {
    assert.ok(rows.get(code).split(", ").includes("skill-reviewer-visual.md"), `${code} mapping row names skill-reviewer-visual.md`);
  }
  // Each row equals the actual backtick-quote sites in content/*.md ((none) = quoted nowhere).
  const docs = fs.readdirSync(path.join(ROOT, "content")).filter((f) => f.endsWith(".md")).sort();
  for (const [code, files] of rows) {
    const actual = docs.filter((f) => content(f).includes(`\`${code}\``));
    const declared = files === "(none)" ? [] : files.split(",").map((x) => x.trim()).sort();
    assert.deepEqual(declared, actual, `${code}: mapping row matches the quote sites`);
  }

  // The documentedInProse field comment states the fact first.
  const srcLines = src.split("\n");
  const fieldLine = srcLines.findIndex((l) => l.includes("readonly documentedInProse: boolean;"));
  assert.ok(fieldLine > 0, "documentedInProse field located");
  const commentLines = [];
  for (let i = fieldLine - 1; i >= 0 && /^\s*\/\//.test(srcLines[i]); i--) commentLines.unshift(srcLines[i].replace(/^\s*\/\/\s?/, ""));
  const comment = commentLines.join(" ").replace(/\s+/g, " ");
  // E435 re-pin: the old-path clause of COPY.registryFieldComment is gone; the architecture
  // gives the new reason as a quoted fragment, so the claim and the reason are pinned apart.
  const E435_FIELD_CLAIM = "Every entry is true except VISUAL_ROUND_EXCEEDED";
  const E435_FIELD_REASON = "nothing emits it since E435: its counter ticks only on a qa-engineer FAIL; E420 owns the visual family";
  assert.ok(comment.includes(E435_FIELD_CLAIM), `field comment states the claim: ${comment}`);
  assert.ok(comment.includes(E435_FIELD_REASON), `field comment states the E435 reason: ${comment}`);
  assert.ok(!comment.includes("only the old path still emits"), "the old-path reason is gone");
  const firstClaim = comment.indexOf("Every entry is true");
  assert.equal(firstClaim, comment.indexOf(E435_FIELD_CLAIM), "the first 'Every entry is true' claim is the VISUAL_ROUND_EXCEEDED one");

  assert.equal(GATE_REGISTRY.length, 33, "33 entries (E435)");
  assert.equal(UPDATE_STATE_GATE_PIPELINE.length, 17, "17 pipeline steps");

  // D21: every other field of every entry equals base (the compiled registry at LANE_END_SHA once it is set).
  const skip = endShaSkipReason();
  if (skip) return t.skip(skip);
  const reg = LANE_END_SHA ? await registryFrom(textAtEnd("dist/gates/registry.js")) : GATE_REGISTRY;
  assert.equal(registryDigest(reg), BASE_REGISTRY_DIGEST, "every non-moving registry field byte-identical to base (frozen digest)");
});

// ================================================================== AC11

test("AC11: docs/config.md override list + config.migration directly under it; README rv row at the old position, no qa-visual row; eval bundle maps reviewer-visual (offline load)", async () => {
  const cfg = read("docs/config.md");
  const listAt = cfg.indexOf("```\n.current/skill-coordinator.md\n");
  assert.ok(listAt > 0, "per-role override list located");
  const close = cfg.indexOf("\n```\n", listAt + 4);
  const list = cfg.slice(listAt, close);
  assert.ok(list.split("\n").includes(COPY.configOverrideRow), "list names .current/skill-reviewer-visual.md");
  assert.ok(!list.includes(".current/skill-qa-visual.md"), "list no longer names .current/skill-qa-visual.md");
  const afterList = cfg.slice(close + "\n```\n".length).replace(/^\n+/, "");
  assert.ok(afterList.startsWith(COPY.configMigration), `config.migration sits directly under the list: ${afterList.slice(0, 120)}`);

  const readme = read("README.md").split("\n");
  const qaRow = readme.findIndex((l) => l.startsWith("| qa-engineer "));
  assert.ok(qaRow > 0, "README tier table located");
  assert.equal(readme[qaRow + 1], COPY.readmeRvRow, "readme.rv_row at the old qa-visual row's position");
  assert.ok(!readme.some((l) => l.startsWith("|") && l.includes("qa-visual")), "no README table row names qa-visual");

  const bundle = await imp("test/eval/lib/bundle.mjs");
  assert.equal(bundle.skillFileForRole("reviewer-visual"), "skill-reviewer-visual.md", "reviewer-visual → skill-reviewer-visual.md");
  assert.ok(!bundle.KNOWN_ROLES.includes("qa-visual"), "no qa-visual key");
  assert.throws(() => bundle.skillFileForRole("qa-visual"), /unknown role "qa-visual"/);
  const r = spawnSync(process.execPath, ["-e", "import('./test/eval/lib/bundle.mjs').then(m=>console.log(m.KNOWN_ROLES.includes('reviewer-visual')))"], { cwd: ROOT, encoding: "utf-8" });
  assert.equal(r.status, 0, r.stderr);
  assert.equal(r.stdout.trim(), "true", "the AC11 one-liner prints true");
});

// ================================================================== AC13

test("AC13: 33 gates (E435), 17 steps, CURRENT_VERSIONS = E435's (handoff 17); transitions / schema / prompts / CLAUDE.md byte-identical to base; dist outside the four rebuilt groups unchanged; agc check exits 0", (t) => {
  assert.equal(GATE_REGISTRY.length, 33, "E435 removed two ledger gates");
  assert.equal(UPDATE_STATE_GATE_PIPELINE.length, 17);
  assert.deepEqual({ ...CURRENT_VERSIONS }, E435_CURRENT_VERSIONS, "only E435's handoff 16 -> 17 moved since E434's base");
  const agc = spawnSync(process.execPath, [path.join(ROOT, "bin", "agc-init.mjs"), "check"], { cwd: ROOT, encoding: "utf-8" });
  assert.equal(agc.status, 0, `agc check exits 0: ${agc.stdout}${agc.stderr}`);

  const skip = endShaSkipReason();
  if (skip) return t.skip(skip);
  assert.equal(blobDigest(blobs(FROZEN_PATHS)), BASE_FROZEN_BLOBS, "tools/transitions.ts, schema/**, prompts/**, CLAUDE.md byte-identical to base");
  const dist = blobs(["dist"]).filter(([p]) => !DIST_ALLOWED.test(p));
  assert.equal(dist.length, 360, "same dist file set outside the four rebuilt groups");
  assert.equal(blobDigest(dist), BASE_DIST_OTHER_BLOBS, "dist/ changes only in gates/registry.*, gates/visual.*, tools/evidence-file.*, tools/handoff-orchestrator.*");
});
