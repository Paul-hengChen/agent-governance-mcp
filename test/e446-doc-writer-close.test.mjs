// Coded by @qa-engineer
// Tests for spec: specs/e446-doc-writer-close.md (AC1-AC8). doc-writer runs after the judge's
// (code-reviewer, PASS); from that tuple the server accepts no further write under the judge's
// agent_id and rejects agent_id "doc-writer", so its SOP must close WITHOUT a state write: the record
// of what it changed is its commit and its final reply. These tests pin the new SOP close (raw file and
// both served render paths), the server rejections the new SOP text claims, and the tools/role.ts
// comment that describes the close.
// Resident-hygiene: the base text of content/skill-doc-writer.md is frozen below as a literal (no git
// lookup, no fixed base sha), so a later edit to any other line of the SOP shows up red here.

import { test } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const { switchRole } = await import(path.join(ROOT, "dist", "tools", "role.js"));
const { buildPromptForRole } = await import(path.join(ROOT, "dist", "prompts", "build.js"));
const { validateTransition } = await import(path.join(ROOT, "dist", "tools", "transitions.js"));
const { ALL_GATE_CODES } = await import(path.join(ROOT, "dist", "gates", "registry.js"));

const read = (...p) => fs.readFileSync(path.join(ROOT, ...p), "utf-8");
const SOP_FILE = ["content", "skill-doc-writer.md"];
const rawText = () => read(...SOP_FILE);
const rawLines = () => rawText().replace(/\n$/, "").split("\n");

// Served text, path 1: tw_switch_role's `sop` field.
const servedSwitchRole = () => JSON.parse(switchRole("doc-writer", ROOT)).sop;
// Served text, path 2: the MCP prompt path. The bundle also carries the constitution and the live
// handoff state (both legitimately mention tw_update_state / pending_notes), so only the doc-writer
// skill slice is checked: from its H1 to the model hint the builder appends after the skill.
function servedPromptSkill() {
  const text = buildPromptForRole("skill-doc-writer.md", "probe", ROOT, false).messages[0].content.text;
  const start = text.indexOf("# Skill: doc-writer");
  assert.ok(start >= 0, "buildPromptForRole output carries the doc-writer skill");
  const end = text.indexOf("\n\nRecommended model for this role:", start);
  assert.ok(end > start, "buildPromptForRole output carries the model hint after the skill");
  return text.slice(start, end);
}
const allTexts = () => [
  ["raw content/skill-doc-writer.md", rawText()],
  ["switchRole(doc-writer).sop", servedSwitchRole()],
  ["buildPromptForRole(skill-doc-writer.md) skill slice", servedPromptSkill()],
];
const linesOf = (t) => t.replace(/\n$/, "").split("\n");
const count = (hay, needle) => hay.split(needle).length - 1;

// Copy / Strings of the spec, frozen verbatim (authored-here, human Q3 (a)).
const C_DW1 =
  "- **Side-channel constraint**: doc-writer is NOT in `ALLOWED_TRANSITIONS` and never calls `tw_update_state`. It runs after `(code-reviewer, PASS)`, and from that tuple the server accepts no further write under the judge's `agent_id`; `agent_id=\"doc-writer\"` is rejected too, because it never appears in the transition matrix. Record what you changed in your commit and your final reply (Output rule); the state stays at the judge's PASS for the next role.";
const C_DW2 =
  "   - `CHANGELOG.md`: confirm the release entry the release-engineer authored (or will author) covers every AC. Flag gaps in your final reply, above its Output rule line; do NOT silently amend an existing entry the release-engineer signed.";
const C_DW3 =
  "6. Commit the doc updates with a message naming the shipped feature, then reply with the Output rule line naming every file you changed (no change: no commit, and `<files>` is `none`). Do NOT call `tw_update_state`: the state stays at `(code-reviewer, PASS)`.";
const C_RT1 = [
  "  // Post-chain roles. doc-writer is intentionally absent from tools/transitions.ts",
  "  // AgentName + ALLOWED_TRANSITIONS: it runs after code-reviewer:PASS, never calls",
  "  // tw_update_state, and records its doc updates in its commit and final reply",
  "  // (skill-doc-writer.md \"Side-channel constraint\" clause). release-engineer is in",
  "  // AgentName and opens on the code-reviewer:PASS -> release-engineer:In_Progress",
  "  // edge there (the chain's judge).",
];

// Base text of content/skill-doc-writer.md (36 lines), frozen before this feature. Only lines 15,
// 32 and 36 (1-based) may differ from it; they are replaced whole by C-DW1, C-DW2, C-DW3.
const BASE = [
  "---",
  "recommended_model: haiku",
  "---",
  "# Skill: doc-writer",
  "",
  "## Persona",
  "Staff-level technical writer. Keeps `README.md`, `CHANGELOG.md`, and in-tree docs in sync with the code after a feature ships. Reads code and the PASS summary of code-reviewer, the chain's judge, never the implementation chatter; rewrites prose around the code's facts without re-deriving them.",
  "",
  "## Output rule",
  "Final reply: `Done. Doc updates in <files>.`",
  "",
  "## Hard rules",
  "- **No API / spec changes**: do not edit `specs/`, `content/skill-*.md`, `content/const-*.md`, `content/coord-*.md`, `package.json`, `index.ts`, or any source file under `tools/` / `prompts/` / `schema/` / `guards/`. Doc-writer documents what shipped — it does not re-decide what ships.",
  "- **Fact-preservation**: every claim the docs make MUST be traceable to a source the doc-writer can cite (a code symbol, a CHANGELOG entry the chain's judge signed off on, a `specs/<feature>.md` AC). If a fact has no source in the workspace, STOP and surface it — do not invent.",
  "- **Side-channel constraint**: doc-writer is NOT in `ALLOWED_TRANSITIONS`. When calling `tw_update_state`, set `agent_id` to the upstream caller's identifier (typically `code-reviewer`, the chain's judge, after PASS) — NOT `\"doc-writer\"`. The server will reject `agent_id=\"doc-writer\"` because it never appears in the transition matrix.",
  "",
  "## Artifact",
  "Doc-writer is allowed to write to:",
  "- `README.md`",
  "- `CHANGELOG.md`",
  "- `docs/**/*.md`",
  "- Any other in-tree `*.md` EXCEPT files under `specs/`, `content/`, `qa_reports/`, `review_reports/`, `research/`.",
  "",
  "Doc-writer MUST NOT create new top-level `*.md` files unless explicitly requested.",
  "",
  "## SOP",
  "",
  "1. `tw_get_state` → `tw_detect_drift`. Confirm the prior tuple is `(code-reviewer, PASS)` (or the workspace owner's variant). If not, STOP — doc-writer fires only after PASS.",
  "2. Read the PASS handoff's `completed_tasks` + `qa_review` summary. Identify which task IDs shipped this cycle.",
  "3. For each shipped task: open `specs/<feature>.md` AC entries and the relevant source files; grep `README.md` + `CHANGELOG.md` for stale references (old version numbers, removed flags, renamed paths, deprecated examples).",
  "4. Write the doc updates:",
  "   - `CHANGELOG.md`: confirm the release entry the release-engineer authored (or will author) covers every AC. Flag gaps in `pending_notes`; do NOT silently amend an existing entry the release-engineer signed.",
  "   - `README.md`: bump install pins if the version changed; correct any prose that drifted from code. (There is no release-notes subsection in this file — README.md carries zero `####` headings; the CHANGELOG entry is the release-notes record.)",
  "   - `docs/**`: update reference material that names code symbols or paths.",
  "5. Re-build is NOT required (doc-writer touches only Markdown). If `dist/` has stale doc strings embedded, surface it — do not rebuild.",
  "6. `tw_update_state(status=In_Progress, agent_id=\"<upstream-caller>\", next_role=\"<caller>\", pending_notes=[\"doc-writer: updated <file-list>\"])`.",
];
const CHANGED = new Map([[15, C_DW1], [32, C_DW2], [36, C_DW3]]); // 1-based line -> new text

test("AC1: no line of the doc-writer SOP instructs a state write (raw file and both served texts); the only tw_update_state mentions are the two prohibitions", () => {
  // WHY: doc-writer runs after (code-reviewer, PASS), where every state write it could make is
  // rejected by the server, so any instruction to write state strands its close.
  for (const [label, text] of allTexts()) {
    assert.ok(!text.includes("tw_update_state("), `${label}: no tw_update_state( call form`);
    assert.ok(!text.includes("pending_notes"), `${label}: no pending_notes (only a state write carries it)`);
    assert.ok(!text.includes("<upstream-caller>"), `${label}: no <upstream-caller> placeholder`);
    assert.ok(!text.includes("next_role"), `${label}: no next_role`);
    const mentions = linesOf(text).filter((l) => l.includes("tw_update_state"));
    assert.equal(count(text, "tw_update_state"), 2, `${label}: exactly two tw_update_state mentions`);
    assert.equal(mentions.length, 2, `${label}: the two mentions sit on two lines`);
    assert.ok(mentions[0].startsWith("- **Side-channel constraint**:"), `${label}: first mention is the Side-channel constraint line`);
    assert.ok(mentions[0].includes("never calls `tw_update_state`"), `${label}: Side-channel mention is a prohibition`);
    assert.ok(mentions[1].startsWith("6. "), `${label}: second mention is SOP step 6`);
    assert.ok(mentions[1].includes("Do NOT call `tw_update_state`"), `${label}: step-6 mention is a prohibition`);
  }
});

test("AC2: the Side-channel constraint line is exactly C-DW1, keeps the e437 anchor once, cites no tools/transitions.ts, and names the commit and the final reply", () => {
  // WHY: the clause must state only what the server does (no write from the PASS tuple under the judge's
  // agent_id, doc-writer rejected) and say where the record of the change lives instead.
  const lines = rawLines();
  assert.equal(lines[14], C_DW1, "line 15 is C-DW1 byte-for-byte");
  const anchor = "doc-writer is NOT in `ALLOWED_TRANSITIONS`";
  assert.equal(count(rawText(), anchor), 1, "anchor occurs exactly once in the file");
  assert.ok(lines[14].includes(anchor), "anchor sits on the Side-channel line");
  assert.ok(!lines[14].includes("tools/transitions.ts"), "no repo-only tools/transitions.ts citation");
  assert.match(lines[14], /\bcommit\b/, "names the commit as the record");
  assert.match(lines[14], /final reply/, "names the final reply as the record");
  for (const [label, text] of allTexts().slice(1)) {
    assert.ok(linesOf(text).includes(C_DW1), `${label}: C-DW1 served as its own line`);
  }
});

test("AC3: the step-4 CHANGELOG.md bullet is exactly C-DW2 and sends gaps to the final reply, not pending_notes", () => {
  // WHY: pending_notes exists only inside a state write, which doc-writer no longer makes.
  const lines = rawLines();
  const bullets = lines.filter((l) => l.startsWith("   - `CHANGELOG.md`:"));
  assert.equal(bullets.length, 1, "one step-4 CHANGELOG.md bullet");
  assert.equal(lines[31], C_DW2, "line 32 is C-DW2 byte-for-byte");
  assert.ok(lines[31].includes("final reply"), "gaps go to the final reply");
  assert.ok(!lines[31].includes("pending_notes"), "not to pending_notes");
  for (const [label, text] of allTexts().slice(1)) {
    assert.ok(linesOf(text).includes(C_DW2), `${label}: C-DW2 served as its own line`);
  }
});

test("AC4: SOP step 6 is exactly C-DW3 (commit + Output rule line, no state write) and the Output rule line is byte-identical to base", () => {
  // WHY: the close is the commit plus the canonical Output rule line, whose <files> placeholder the new
  // step fills (with `none` when nothing changed) rather than rewording the canonical string.
  const lines = rawLines();
  assert.equal(lines[35], C_DW3, "line 36 is C-DW3 byte-for-byte");
  assert.ok(lines[35].includes("Do NOT call `tw_update_state`"), "step 6 forbids the state write");
  assert.ok(lines[35].includes("`none`"), "no-change case fills <files> with none");
  const outputRule = "Final reply: `Done. Doc updates in <files>.`";
  assert.equal(lines[9], outputRule, "Output rule line unchanged (line 10)");
  assert.equal(lines[9], BASE[9], "Output rule line byte-identical to base");
  for (const [label, text] of allTexts().slice(1)) {
    assert.ok(linesOf(text).includes(C_DW3), `${label}: C-DW3 served as its own line`);
    assert.ok(linesOf(text).includes(outputRule), `${label}: Output rule line served unchanged`);
  }
});

test("AC5: every line but 15, 32 and 36 is byte-identical to the frozen base; 36 lines; step 1, headings and the empty error-code set are kept", () => {
  // WHY: the ruling changes the close only; step 1 carries the (code-reviewer, PASS) precondition other
  // suites pin, and the five headings are the SOP shape every role file shares.
  const lines = rawLines();
  assert.equal(BASE.length, 36, "frozen base is 36 lines");
  assert.equal(lines.length, 36, "file has 36 lines");
  for (let i = 0; i < BASE.length; i++) {
    if (CHANGED.has(i + 1)) continue;
    assert.equal(lines[i], BASE[i], `line ${i + 1} byte-identical to base`);
  }
  assert.ok(lines[27].includes("`tw_get_state` → `tw_detect_drift`"), "step 1 keeps the tw_get_state → tw_detect_drift precondition");
  assert.ok(lines[27].includes("(code-reviewer, PASS)"), "step 1 keeps (code-reviewer, PASS)");
  const headings = lines.filter((l) => l.startsWith("## "));
  assert.deepEqual(headings, ["## Persona", "## Output rule", "## Hard rules", "## Artifact", "## SOP"], "five ## headings, in order");
  const quoted = ALL_GATE_CODES.filter((c) => rawText().includes(`\`${c}\``));
  assert.deepEqual(quoted, [], "no backtick-quoted error code in the file");
  // Served texts carry every unchanged non-frontmatter base line as its own line.
  for (const [label, text] of allTexts().slice(1)) {
    const served = new Set(linesOf(text));
    for (let i = 3; i < BASE.length; i++) {
      if (CHANGED.has(i + 1) || BASE[i] === "") continue;
      assert.ok(served.has(BASE[i]), `${label}: unchanged base line ${i + 1} served as its own line`);
    }
  }
});

test("AC6: the old close (code-reviewer, PASS) -> (code-reviewer, *) and agent_id doc-writer are rejected by validateTransition; transitions.ts never names doc-writer", () => {
  // WHY: C-DW1 claims the server accepts no write under the judge's agent_id from the PASS tuple and
  // rejects doc-writer outright; this pins each claim so the SOP text and the server cannot drift apart.
  const prev = { agent: "code-reviewer", status: "PASS" };
  const req = (next) => ({ prev, next, prev_review_round: 0 });
  const EXPECTED_ALLOWED = [
    { new_agent: "pm", new_status: "In_Progress" },
    { new_agent: "researcher", new_status: "In_Progress" },
    { new_agent: "release-engineer", new_status: "In_Progress" },
    { new_agent: "design-auditor", new_status: "In_Progress" },
  ];
  const sortKey = (a) => `${a.new_agent}:${a.new_status}`;
  const old = validateTransition(req({ agent: "code-reviewer", status: "In_Progress" }));
  assert.ok(old, "the old close (code-reviewer, PASS) -> (code-reviewer, In_Progress) is rejected");
  assert.equal(old.error, "TRANSITION_REJECTED");
  assert.deepEqual(
    [...old.allowed].sort((a, b) => sortKey(a).localeCompare(sortKey(b))),
    [...EXPECTED_ALLOWED].sort((a, b) => sortKey(a).localeCompare(sortKey(b))),
    "allowed is exactly pm, researcher, release-engineer, design-auditor (each In_Progress)",
  );
  for (const status of ["PASS", "FAIL", "Blocked"]) {
    const r = validateTransition(req({ agent: "code-reviewer", status }));
    assert.ok(r, `(code-reviewer, PASS) -> (code-reviewer, ${status}) is rejected`);
    assert.equal(r.error, "TRANSITION_REJECTED", `code-reviewer ${status}: TRANSITION_REJECTED`);
  }
  for (const status of ["In_Progress", "PASS", "FAIL", "Blocked"]) {
    const r = validateTransition(req({ agent: "doc-writer", status }));
    assert.ok(r, `agent_id doc-writer (${status}) is rejected`);
    assert.equal(r.error, "AGENT_ID_REQUIRED", `doc-writer ${status}: AGENT_ID_REQUIRED`);
  }
  assert.ok(!read("tools", "transitions.ts").includes("doc-writer"), "tools/transitions.ts does not mention doc-writer");
  assert.ok(!read("dist", "tools", "transitions.js").includes("doc-writer"), "dist/tools/transitions.js does not mention doc-writer");
});

test("AC7: the ROLE_SKILL_MAP comment above \"doc-writer\" is exactly the six C-RT1 lines, in tools/role.ts and in the rebuilt dist/tools/role.js", () => {
  // WHY: the source comment is where a maintainer reads why doc-writer is absent from the transition
  // matrix; it must describe the new close (no state write), not callers writing state on its behalf.
  const src = read("tools", "role.ts");
  const block = C_RT1.join("\n");
  assert.equal(count(src, block), 1, "six C-RT1 lines present contiguously, once");
  assert.ok(src.includes(`${block}\n  "doc-writer": "skill-doc-writer.md",`), "C-RT1 sits directly above the doc-writer map entry");
  const srcLines = src.split("\n");
  const entry = srcLines.indexOf('  "doc-writer": "skill-doc-writer.md",');
  assert.ok(entry >= 7, "doc-writer map entry found");
  assert.ok(!/^\s*\/\//.test(srcLines[entry - 7]), "the comment above doc-writer is exactly six lines (no seventh comment line)");
  assert.ok(!src.includes("callers set agent_id"), "old 'callers set agent_id' wording gone");
  assert.ok(!src.includes("on its behalf"), "comment no longer says callers write state on doc-writer's behalf");
  // dist is tsc output (re-indented): compare the comment lines with leading whitespace dropped.
  const distLines = read("dist", "tools", "role.js").split("\n").map((l) => l.trim());
  const want = C_RT1.map((l) => l.trim());
  const at = distLines.indexOf(want[0]);
  assert.ok(at >= 0, "dist/tools/role.js carries the C-RT1 first line");
  assert.deepEqual(distLines.slice(at, at + want.length), want, "dist/tools/role.js carries the six C-RT1 lines contiguously");
  assert.equal(distLines[at + want.length], '"doc-writer": "skill-doc-writer.md",', "dist: C-RT1 sits directly above the doc-writer entry");
});

test("AC8: every line changed in skill-doc-writer.md is shippable text (no URL, repo-only path, bare ticket id, version label, or backtick error code)", () => {
  // WHY: content/** ships to every adopter; a repo-only path or a bare ticket id is a dead lead for the
  // agent reading it, and a quoted error code would move the error-code contract.
  const lines = rawLines();
  const changed = [];
  for (let i = 0; i < Math.max(lines.length, BASE.length); i++) {
    if (lines[i] !== BASE[i]) changed.push(i + 1);
  }
  assert.deepEqual(changed, [15, 32, 36], "the lines that differ from base are exactly 15, 32 and 36");
  for (const n of changed) {
    const l = lines[n - 1];
    assert.equal(l, CHANGED.get(n), `line ${n} is its Copy text`);
    assert.ok(!l.includes("://"), `line ${n}: no URL`);
    assert.doesNotMatch(l, /(?:^|[\s`("'])(?:tools|test|specs|docs|scripts)\//, `line ${n}: no repo-only path`);
    assert.doesNotMatch(l, /\bE\d{2,4}\b/, `line ${n}: no bare ticket id`);
    assert.doesNotMatch(l, /\bv\d+\.\d+/, `line ${n}: no version label`);
    for (const c of ALL_GATE_CODES) assert.ok(!l.includes(`\`${c}\``), `line ${n}: no backtick-quoted ${c}`);
  }
  // Render: each changed line survives both render paths as its own line (no fusion with a neighbour).
  for (const [label, text] of allTexts().slice(1)) {
    const served = linesOf(text);
    for (const n of changed) assert.ok(served.includes(lines[n - 1]), `${label}: changed line ${n} renders as its own line`);
  }
});
