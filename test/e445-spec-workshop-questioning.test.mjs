// Coded by @qa-engineer
// Re-pin notice: AC1 and AC10 freeze the base SOP text outside steps 2-5 below (BASE_SOP); a later edit of this SOP (e.g. tracker mirroring) must re-pin those constants.
// Tests for specs/e445-spec-workshop-questioning.md (ticket E445): eight questioning rules folded into steps 2-5
// of content/skill-spec-workshop.md, with step headings, step count, the short form and every other section
// unchanged. One test per AC1-AC10 (AC10 is split into its unchanged-sections half and its added-lines half so
// the unchanged half is visibly green on the base). AC11 is test/context-budget.test.mjs AC21; AC12 is the
// hygiene run. Anchors are the spec's Copy / Strings rows, quoted verbatim.
// Base text: the SOP at the cut's base commit, frozen below as string literals (no history read; Node 20 + 22).

import { test, after } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const { buildPromptForRole, stripRationale, stripOriginTags } = await import(path.join(ROOT, "dist", "prompts", "build.js"));
const { setActiveStorage, FileHandoffStorage } = await import(path.join(ROOT, "dist", "tools", "storage.js"));
const { ALL_GATE_CODES } = await import(path.join(ROOT, "dist", "gates", "registry.js"));

const SOP = fs.readFileSync(path.join(ROOT, "content", "skill-spec-workshop.md"), "utf-8");

// The SOP as it stood before this ticket, byte for byte (one array entry per line; the trailing "" is the final newline).
const BASE_SOP = [
  "---",
  "recommended_model: opus",
  "---",
  "# Skill: spec-workshop",
  "",
  "## Purpose",
  "",
  "Turn a spec, a design source, issue-tracker items or a bare idea into rulings the human makes in this session, recorded as they are made, then into ticket files and one wave table the human approves once. The human starts this role by invoking its prompt. It is prompt-only: not a routing-chain role, no `agent_id`, no feature lease, and it hands nothing to the chain itself — the human or the integrator takes the approved tickets from here.",
  "",
  "## Steps",
  "",
  "1. **Entry check** — this role fits:",
  "   - a spec or design source to break down into tickets;",
  "   - an idea that needs several rounds of questions before it can be cut;",
  "   - an issue-tracker item that has no ticket file, whatever its size.",
  "",
  "   One run may take several item numbers. Work only on the items the human names; never pull items from the tracker yourself. One item may become several tickets, and several items may become one. Work that fits one or two files and is not a tracker item goes to the ordinary coordinator intake: say so and stop.",
  "2. **Check what exists first** — before the first question, read the current code and docs and tell the human what already exists that bears on the request. With no source document, the code and docs are the source.",
  "3. **Delegate bulk reading** — send design extraction and codebase surveys to subagents; keep their summaries, not the raw dumps.",
  "4. **Ask in batches, record as you go** — at most 4 questions per batch, each with your recommendation and a worked example (a named case, step by step, what breaks under each option). Address every question to the operator in this session; a tracker item's author is not here. Write each ruling to the record the moment it is made, with its date; a ruling that replaces an earlier one names the one it replaces.",
  "5. **Done condition** — the work is ready to cut when every scenario has one verification, every device-or-person scenario is marked, and every conflict between sources has a ruling. Verification is one of: automated test, command, device-or-person; a ticket with any device-or-person scenario sets `needs device or person: yes`. Each divergence between a Figma file and a prototype is a conflict.",
  "6. **End without filing** — a run may end with `not doing` or `not ready to cut` and file nothing. For `not ready to cut`, list the open questions in the record.",
  "",
  "## Short form",
  "",
  "For a small, clear tracker item: read it, check the code, write its scenarios and their verifications, ask for one confirmation, then write the ticket file. The short form writes no wave table. Anything unclear, or an item that needs a split, goes back to the full steps.",
  "",
  "## Outputs",
  "",
  "- **Discussion record** — the formal output; tickets carry only its conclusions. Default path `docs/discussions/<YYYY-MM-DD>-<topic>.md` unless the human names another. It holds a `## Rulings` table `| # | date | question | ruling | replaces |`, the wave table and the approval table.",
  "- **Ticket files** — written only by this role, in the ticket format: `<agc install>/docs/ticket-format.md` and `<agc install>/templates/ticket.md` (`<agc install>` = agc's install directory, not the workspace). They go in the ticket directory (`ticketDir` in `.current/.config.json`, default `docs/tickets/`). One ticket file maps to at most one tracker item; `source` = `<item number> rev <revision>`, the number only, never a link, and empty in a public repository. Describe internal URLs, codenames and people by class, never by name. When the project keeps a backlog, add one index line per ticket.",
  "- **Wave table** — `| wave | ticket | depends on |`, one row per ticket.",
  "- **Approval table** — `| date | decided by | content | source |`; the human's approval is a row with `decided by` = `human`, written only after the human approves in this session.",
  "- After the approval row is written, commit the record and the ticket files together per the repository's commit rules (branch and pull request where the main branch is protected), so the commit can be cited.",
  "",
  "## Governance state",
  "",
  "**Never call `tw_update_state`, `tw_add_task`, `tw_complete_task`, `tw_rollback_task`, `tw_void_task` or `tw_sync`**, and never write any `.current/` file; `tw_get_state` and `tw_detect_drift` are allowed for reading.",
  "",
  "This role is never dispatched as a subagent: a subagent has no channel for rounds of dialogue with the human.",
  "",
].join("\n");

const made = [];
after(() => {
  for (const d of made) fs.rmSync(d, { recursive: true, force: true });
});

const DESCRIPTION =
  "Spec workshop — turn specs, design sources, issue-tracker items or an idea into dated rulings, ticket files and a wave table, in rounds with the human. Human-started; writes no handoff state.";

// Composed prompt, built once (the way test/e423-spec-workshop.test.mjs builds its bundle).
const SW_BUNDLE = (() => {
  const ws = fs.mkdtempSync(path.join(os.tmpdir(), "e445-bundle-"));
  made.push(ws);
  fs.mkdirSync(path.join(ws, ".current"), { recursive: true });
  setActiveStorage(new FileHandoffStorage());
  return buildPromptForRole("skill-spec-workshop.md", DESCRIPTION, ws).messages[0].content.text;
})();

// ---------------------------------------------------------------------------
// Copy / Strings (spec table), verbatim
// ---------------------------------------------------------------------------

const S = {
  lookup:
    "Keep this survey short; send any deeper fact lookup to a subagent that runs while you ask, and hold back only the questions that depend on its answer.",
  facts:
    "Never ask the human a fact the code, docs or tools can answer; look it up. Your recommendation is not a ruling until the human answers it.",
  batch_cap: "at most 4 questions per batch.",
  batch_ready:
    "A question goes in a batch only when every decision it depends on already has a ruling, and no question in a batch depends on another in the same batch.",
  format:
    "Write each question as `Q<n> — <title>: <question>`, then your recommendation on its own line, then a worked example on its own line (a named case, step by step, what breaks under each option).",
  yes: 'Word each question so that "yes" accepts your recommendation; when it cannot be worded so, say so in the question.',
  by_number: "The human may answer by number.",
  reopen:
    "When an answer shows an earlier ruling should change, reopen that question in the next batch; its new ruling names the one it replaces.",
  prototype:
    "A question about how something looks or feels is marked `needs prototype` in the record, and its ruling waits until the human has seen one; this role does not build the prototype.",
  prototype_end: "A `needs prototype` question still open when the run ends makes the run end `not ready to cut`.",
  pushback:
    "Before asking for approval, if the human accepted every recommendation unchanged, say so once and ask them to confirm the rulings are theirs; a confirmation continues, and a changed answer is never required.",
};

// Base sentences the ticket keeps verbatim.
const B = {
  step2: "before the first question, read the current code and docs and tell the human what already exists that bears on the request. With no source document, the code and docs are the source.",
  step3: "send design extraction and codebase surveys to subagents; keep their summaries, not the raw dumps.",
  cap: "at most 4 questions per batch",
  example: "(a named case, step by step, what breaks under each option)",
  operator: "Address every question to the operator in this session; a tracker item's author is not here.",
  ruling: "Write each ruling to the record the moment it is made, with its date; a ruling that replaces an earlier one names the one it replaces.",
  done: "the work is ready to cut when every scenario has one verification, every device-or-person scenario is marked, and every conflict between sources has a ruling.",
  verification:
    "Verification is one of: automated test, command, device-or-person; a ticket with any device-or-person scenario sets `needs device or person: yes`.",
  figma: "Each divergence between a Figma file and a prototype is a conflict.",
};

const HEADINGS = [
  "1. **Entry check**",
  "2. **Check what exists first**",
  "3. **Delegate bulk reading**",
  "4. **Ask in batches, record as you go**",
  "5. **Done condition**",
  "6. **End without filing**",
];

// Text from `start` up to (not including) `end`; asserts both anchors exist so a drift fails loudly.
function between(text, start, end, label) {
  const i = text.indexOf(start);
  assert.ok(i !== -1, `${label}: start anchor missing: ${start}`);
  const j = end === null ? text.length : text.indexOf(end, i + start.length);
  assert.ok(j !== -1, `${label}: end anchor missing: ${end}`);
  return text.slice(i, j);
}
const step = (text, n) => between(text, HEADINGS[n - 1], n < 6 ? HEADINGS[n] : "## Short form", `step ${n}`);

// Asserts each needle is present in `text` and appears in the given order.
function assertOrder(text, needles, label) {
  let last = -1;
  for (const n of needles) {
    const i = text.indexOf(n);
    assert.ok(i !== -1, `${label}: missing: ${n}`);
    assert.ok(i > last, `${label}: out of order: ${n}`);
    last = i;
  }
}

// ---------------------------------------------------------------------------
// AC1 — headings, step count, short form
// ---------------------------------------------------------------------------

test("AC1: six step headings in the composed prompt, exactly six numbered steps, short form byte-identical to base", () => {
  // WHY: the rules fold INTO the existing steps; a new or renamed step changes the role's contract for every adopter.
  for (const h of HEADINGS) assert.ok(SW_BUNDLE.includes(h), `composed prompt missing heading: ${h}`);
  const stepsSpan = between(SOP, "## Steps", "## Short form", "steps span");
  assert.equal((stepsSpan.match(/^\d\. \*\*/gm) || []).length, 6, "exactly six numbered steps under ## Steps");
  assert.equal(
    between(SOP, "## Short form", "## Outputs", "short form"),
    between(BASE_SOP, "## Short form", "## Outputs", "base short form"),
    "## Short form section is byte-identical to the base text",
  );
});

// ---------------------------------------------------------------------------
// AC2-AC6 — step 4
// ---------------------------------------------------------------------------

test("AC2: step 4 keeps the 4-question cap and admits only askable, mutually independent questions to a batch", () => {
  // WHY: a question whose premise is another open question in the same batch gets answered before its premise is ruled.
  const s4 = step(SOP, 4);
  assert.ok(s4.includes(B.cap), "cap kept: at most 4 questions per batch");
  assert.ok(s4.startsWith(`${HEADINGS[3]} — ${S.batch_cap} `), "sw.batch_cap opens step 4 after the heading dash and ends its sentence");
  assertOrder(s4, [S.batch_cap, S.batch_ready], "step 4");
});

test("AC3: step 4 sets the `Q<n> — <title>: <question>` format, recommendation and example on own lines, answer by number", () => {
  // WHY: a fixed, numbered format lets the human answer a whole batch by number instead of quoting questions back.
  const s4 = step(SOP, 4);
  assert.ok(s4.includes(S.format), "sw.format verbatim");
  assert.ok(s4.includes(B.example), "worked-example definition kept verbatim");
  assert.ok(s4.includes(S.by_number), "sw.by_number verbatim");
  assert.ok(!s4.includes("each with your recommendation and a worked example"), "the base clause sw.format replaces is gone");
  assertOrder(s4, [S.batch_ready, S.format, S.by_number], "step 4");
});

test("AC4: step 4 words each question so \"yes\" accepts the recommendation, and says so when it cannot", () => {
  // WHY: "yes" = accept keeps a batch answerable in one short reply; the stated exception stops a silent misread.
  const s4 = step(SOP, 4);
  assert.ok(s4.includes(S.yes), "sw.yes verbatim (straight double quotes around yes)");
  assertOrder(s4, [S.format, S.yes, S.by_number], "step 4");
});

test("AC5: step 4 keeps the dated/replacing ruling sentence and follows it with a separate reopen sentence", () => {
  // WHY: reopening an earlier ruling must leave an audit trail — the new ruling names the one it replaces.
  const s4 = step(SOP, 4);
  assert.ok(s4.includes(B.ruling), "base ruling sentence verbatim");
  assert.ok(s4.includes(`${B.ruling} ${S.reopen}`), "sw.reopen is a separate sentence directly after the ruling sentence");
  assertOrder(s4, [S.by_number, B.operator, B.ruling, S.reopen], "step 4");
});

test("AC6: step 4 marks look-and-feel questions `needs prototype`, defers them, builds none, and ends `not ready to cut` if open", () => {
  // WHY: talk cannot settle how something looks; without the mark the question is rephrased round after round.
  const s4 = step(SOP, 4);
  assert.ok(s4.includes(S.prototype), "sw.prototype verbatim");
  assert.ok(s4.includes(S.prototype_end), "sw.prototype_end verbatim");
  assertOrder(s4, [S.reopen, S.prototype, S.prototype_end], "step 4");
  assert.ok(s4.trimEnd().endsWith(S.prototype_end), "sw.prototype_end is the last sentence of step 4");
});

// ---------------------------------------------------------------------------
// AC7-AC9 — steps 2, 3, 5
// ---------------------------------------------------------------------------

test("AC7: step 2 keeps the survey before the first question, then keeps it short with parallel lookups", () => {
  // WHY: the up-front survey stays; deeper lookups run alongside the questions so only dependent questions wait.
  const s2 = step(SOP, 2);
  assert.ok(s2.includes(B.step2), "step 2 base text verbatim");
  assert.ok(s2.includes(S.lookup), "sw.lookup verbatim");
  assert.ok(s2.indexOf(S.lookup) >= s2.indexOf(B.step2) + B.step2.length, "sw.lookup follows the base text");
});

test("AC8: step 3 keeps delegated bulk reading, then never asks a lookup-able fact and treats a recommendation as no ruling", () => {
  // WHY: the record must hold only decisions the human made, not facts or the agent's own recommendations.
  const s3 = step(SOP, 3);
  assert.ok(s3.includes(B.step3), "step 3 base text verbatim");
  assert.ok(s3.includes(S.facts), "sw.facts verbatim");
  assert.ok(s3.indexOf(S.facts) >= s3.indexOf(B.step3) + B.step3.length, "sw.facts follows the base text");
});

test("AC9: step 5 keeps its three base sentences in order, then the one-time accept-all reminder", () => {
  // WHY: the reminder confirms the rulings are the human's own without changing when the run is done.
  const s5 = step(SOP, 5);
  assertOrder(s5, [B.done, B.verification, B.figma, S.pushback], "step 5");
  assert.ok(s5.trimEnd().endsWith(S.pushback), "sw.pushback is appended at the end of step 5");
});

// ---------------------------------------------------------------------------
// AC10 — nothing outside steps 2-5 moves; added lines carry nothing forbidden
// ---------------------------------------------------------------------------

test("AC10 (unchanged sections): frontmatter, Purpose, step 1, step 6, Short form, Outputs, Governance state are byte-identical to base", () => {
  // WHY: the ticket's scope is steps 2-5; any other byte that moves is an unreviewed change shipped to every adopter.
  const sections = [
    ["frontmatter + title", "---", "## Purpose"],
    ["## Purpose", "## Purpose", "## Steps"],
    ["## Steps heading", "## Steps", HEADINGS[0]],
    ["step 1", HEADINGS[0], HEADINGS[1]],
    ["step 6", HEADINGS[5], "## Short form"],
    ["## Short form", "## Short form", "## Outputs"],
    ["## Outputs", "## Outputs", "## Governance state"],
    ["## Governance state", "## Governance state", null],
  ];
  for (const [label, start, end] of sections) {
    assert.equal(between(SOP, start, end, label), between(BASE_SOP, start, end, `base ${label}`), `${label} must be byte-identical to base`);
  }
  // Whole-file residual: with steps 2-5 cut out, the SOP equals the base.
  const residual = (t) => t.slice(0, t.indexOf(HEADINGS[1])) + t.slice(t.indexOf(HEADINGS[5]));
  assert.equal(residual(SOP), residual(BASE_SOP), "everything outside steps 2-5 is byte-identical to base");
});

// The text an agent receives (rationale and origin spans removed).
const dispatchView = (t) => stripRationale(stripOriginTags(t));
// Same patterns as test/e423-spec-workshop.test.mjs AC11 (repo-only paths and ticket ids).
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
const WRITE_TOOLS = ["tw_update_state", "tw_add_task", "tw_complete_task", "tw_rollback_task", "tw_void_task", "tw_sync"];
// Same occurrence-level rule as test/e410-task-alias-content-tail.test.mjs (`Task` as the subagent alias).
const TASK_SKIP_STARTS = ["TaskStop", "Task-Size", "Task ordering", "Task Format", "Task <id>", "Task list", "Tasks in", "Tasks with", "Tasks →"];
function taskAliasCount(line) {
  let n = 0;
  let i = -1;
  while ((i = line.indexOf("Task", i + 1)) !== -1) {
    if (TASK_SKIP_STARTS.some((s) => line.slice(i).startsWith(s))) continue;
    if (line.slice(0, i).endsWith("Completed-")) continue;
    n += 1;
  }
  return n;
}
const NUMBERED = /^\d\. \*\*[^*]+\*\*/;

test("AC10 (added lines): every added or changed line in steps 2-5 carries no new step, write tool, ticket id, repo path, Task alias or gate code", () => {
  // WHY: content/** ships to every adopter — a repo-only path or id is a dead lead, a write-tool name invites a call
  // this role must never make, and a new numbered line would add a step.
  const baseLines = new Set(dispatchView(BASE_SOP).split("\n"));
  const added = dispatchView(SOP).split("\n").filter((l) => !baseLines.has(l));
  // Anchor-drift guard: the scan must actually see the four edited step lines, or it would pass vacuously.
  for (const h of HEADINGS.slice(1, 5)) {
    assert.ok(added.some((l) => l.startsWith(h)), `added-line scan found no changed line for ${h} (steps 2-5 not edited yet, or anchor drift)`);
  }
  const baseHeadings = new Set(HEADINGS);
  const codes = ALL_GATE_CODES.map((c) => `\`${c}\``);
  assert.ok(codes.length > 20, "sanity: gate code list loaded from GATE_REGISTRY");
  for (const l of added) {
    const short = l.slice(0, 120);
    const m = l.match(NUMBERED);
    // A changed step line keeps its own base heading; only a line opening a NEW numbered item is a new step.
    if (/^\d\. \*\*/.test(l)) assert.ok(m && baseHeadings.has(m[0]), `added line opens a new numbered step: ${short}`);
    for (const t of WRITE_TOOLS) assert.ok(!l.includes(t), `added line names write tool ${t}: ${short}`);
    for (const re of REPO_ONLY) assert.ok(!re.test(l), `added line matches repo-only pattern ${re}: ${short}`);
    assert.equal(taskAliasCount(l), 0, `added line uses \`Task\` as the subagent alias: ${short}`);
    for (const c of codes) assert.ok(!l.includes(c), `added line quotes gate code ${c}: ${short}`);
  }
  // The numbered-line count in the dispatch view is unchanged from base (no step added or removed).
  const count = (t) => dispatchView(t).split("\n").filter((l) => /^\d\. \*\*/.test(l)).length;
  assert.equal(count(SOP), count(BASE_SOP), "numbered-step line count unchanged in the dispatch view");
});
