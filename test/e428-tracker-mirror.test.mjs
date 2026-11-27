// Coded by @qa-engineer
// Tests for specs/e428-tracker-mirror.md AC1-AC12 (ticket E428): an opt-in, one-way issue-tracker mirror
// written as SOP and format text only. Each title starts with its AC id. C_* constants are the spec's Copy /
// Strings blocks verbatim; text is checked on the raw source AND on the served text of the two composed roles
// (spec-workshop, teamwork coordinator). Base text: each touched file's pre-edit sha256 is frozen below and
// the base is rebuilt by removing the Copy, so "nothing else changed" is exact without a history read.
// AC13 (full suite, goldens, caps) has no dedicated test here: see qa_reports/tests_e428-tracker-mirror.md.
// Amended after review round 1 (finding F1, T-E428-06): C-IN1 also counts an item the ticket file's `source`
// field lists (private repository), and C-TF1 bullet 2 names which source item a child item goes under.

import { test, after } from "node:test";
import assert from "node:assert/strict";
import * as crypto from "node:crypto";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), "utf-8");
const { buildPromptForRole } = await import(path.join(ROOT, "dist", "prompts", "build.js"));
const { setActiveStorage, FileHandoffStorage } = await import(path.join(ROOT, "dist", "tools", "storage.js"));

const SW_FILE = "content/skill-spec-workshop.md";
const IN_FILE = "content/skill-integrator.md";
const CO_FILE = "content/coord-01-core-head.md";
const TF_FILE = "docs/ticket-format.md";

const made = [];
after(() => {
  for (const d of made) fs.rmSync(d, { recursive: true, force: true });
});

// ---------------------------------------------------------------------------
// Copy / Strings (spec blocks, verbatim)
// ---------------------------------------------------------------------------

const C_SW1 =
  "`source` = `<item number> rev <revision>`, the number only, never a link, and empty in a public repository, where the tracker map holds the item instead (*Tracker mirror*).";

// C-SW2 paragraph, one sentence per constant (joined with one space it is the spec's one-line paragraph).
const SW2 = {
  request: "Only when the human asks for it in this session; without that request write nothing to any tracker (reading the items the human names stays allowed).",
  create: "After the approval row is written, use the host's own tracker tools to create one item for each ticket file that has none, holding the ticket's id, title and file path and saying the file is the record.",
  imported: "A ticket cut from a tracker item gets no new item: its source item stands for it, and one child item under that source item per ticket file is created only when the human asks.",
  one: "A ticket file never gets a second created item; the items it was cut from do not count.",
  record: "Record each created item in the tracker map, by number, never a link: `agc-tracker-map.md` in the directory `git rev-parse --git-common-dir` prints, never tracked.",
  writeBack: "Its `write-back` switch, which lets the integrator update source items, stays `off` unless the human turns it on.",
  format: "Format: `<agc install>/docs/ticket-format.md`, *Tracker mirror*.",
};
const C_SW2 = ["## Tracker mirror", "", Object.values(SW2).join(" ")].join("\n");

const IN_INTRO =
  "Only a ticket with a tracker item gets tracker writes: an item its ticket file's `source` field lists, or a row in the tracker map — `agc-tracker-map.md` in the directory `git rev-parse --git-common-dir` prints, never tracked (format: `<agc install>/docs/ticket-format.md`, *Tracker mirror*). No item, no write. Use the host's own tracker tools (update an item's state, add a comment):";
const IN_B = [
  "- **`mirror` or `child` row** — update that item as the ticket moves: in progress at dispatch; at a stop, the stopped state and the reason after `stopped — `; the pull request's number once it is open; done at merge.",
  "- **Source item** (one the ticket file's `source` field lists, or a `source` row) — the same updates to each, only when the map's `write-back` line reads `on`, whether or not the map has a row for the ticket. It is off by default; only the human turns it on.",
  "- **A stop's question** (the ticket's `## Open question`) is never posted, whatever the item: draft it in your report; the human decides whether to post it.",
  "- **One way only** — never copy tracker content into a ticket file. Where an item and its ticket file differ, the file wins; report the difference.",
];
const C_IN1 = ["## Tracker items", "", IN_INTRO, "", ...IN_B].join("\n");
// The pre-amendment C-IN1 wording (approved cut, shipped at review round 1): it must be gone.
const OLD_IN = {
  intro: "Only a ticket with a row in the tracker map gets tracker writes",
  noWrite: "No row, no write.",
  source: "- **`source` row** — the same updates, only when the map's `write-back` line reads `on`.",
  stop: "is never posted, whatever the row:",
};

const CO = [
  "A tracker number that has a ticket file (the file's `source` field lists it, or the tracker map does: `agc-tracker-map.md` in the directory `git rev-parse --git-common-dir` prints) → work from the ticket file; where the item's content differs from it, keep to the file and report the difference to the human.",
  "For a ticket cut from a tracker item, compare the item's current revision with the recorded one at work start and again before each code-reviewer dispatch; report a change, never copy it into the ticket file.",
  "Only read the tracker; never write to it.",
];
const C_CO1 = CO.join(" ");

const MAP_EXAMPLE = ["write-back: off", "", "| ticket | item | kind | revision |", "|---|---|---|---|", "| E900 | 1234 | source | 7 |", "| E899 | 1240 | mirror | — |"];
const C_TF1 = [
  "## Tracker mirror",
  "",
  "The ticket file is the record. A team that also wants its tickets on an issue tracker may ask for a one-way",
  "mirror; nothing is mirrored unless a person asks for it.",
  "",
  "- Direction is fixed, repository to tracker. Content edited on the tracker is never read back into a ticket",
  "  file; when an item and its ticket file differ, the file wins and the difference is reported to a person.",
  "- A ticket file gets at most one tracker item created for it: a mirror item, or, for a ticket cut from",
  "  items, one child item under one of them, chosen by the person who asks for it. The items a ticket was",
  "  cut from (its `source`) are not counted, and a ticket cut from an item gets no mirror item.",
  "- A ticket file holds tracker item numbers only in its `source` field, never a link; in a public repository",
  "  it holds none. Every other number, and in a public repository the source items too, goes in the tracker map.",
  "- Before work starts and again before acceptance, a source item's current revision is compared with the",
  "  recorded one; a change is reported to a person, never copied into the ticket file.",
  "- Writing to a source item (its state, stop reason and pull-request number) is off unless the tracker map",
  "  turns it on. A stop's open question is never posted by a tool: it is drafted for a person to post or not.",
  "- Without a mirror request nothing is written to a tracker. Reading an item and comparing its revision stay",
  "  allowed.",
  "",
  "### Tracker map",
  "",
  "The tracker map is a local file named `agc-tracker-map.md`, directly in the directory that",
  "`git rev-parse --git-common-dir` prints. That directory is git's own storage, so git never tracks the file",
  "and no ignore rule is needed, and every linked worktree of the repository reads the same file. It does not",
  "travel with a clone. Never keep it in the working tree. For example:",
  "",
  "```",
  ...MAP_EXAMPLE,
  "```",
  "",
  "- `write-back` is `on` or `off`. A missing file, a missing line or any other value means `off`; only a",
  "  person turns it on.",
  "- Each table row pairs one ticket id with one tracker item number, never a link. `kind` is `source` (an",
  "  item the ticket was cut from), `mirror` (the item created for the ticket) or `child` (the item created",
  "  for the ticket under its source item). `revision` is a source item's revision when the ticket was written,",
  "  and `—` for the other kinds.",
  "- A ticket has at most one `mirror` or `child` row.",
].join("\n");

// A Markdown list item with its two-space continuation lines, in order.
function bulletsOf(block) {
  const out = [];
  for (const l of block.split("\n")) {
    if (l.startsWith("- ")) out.push(l);
    else if (l.startsWith("  ") && out.length) out[out.length - 1] += "\n" + l;
  }
  return out;
}
const TF_B = bulletsOf(C_TF1.slice(0, C_TF1.indexOf("### Tracker map"))); // the six format bullets
const TF_MAP_B = bulletsOf(C_TF1.slice(C_TF1.indexOf("### Tracker map"))); // the three map bullets
const MAP_ONE_ROW = "- A ticket has at most one `mirror` or `child` row.";
const OLD_TF_CHILD = "one child item under that item when a person asks"; // pre-amendment C-TF1 bullet 2

// ---------------------------------------------------------------------------
// Frozen base text (pre-edit anchors the Copy must sit next to, byte for byte)
// ---------------------------------------------------------------------------

const OLD_SW_SENTENCE =
  "One ticket file maps to at most one tracker item; `source` = `<item number> rev <revision>`, the number only, never a link, and empty in a public repository.";
const BASE_SW_TICKET_FILES =
  "- **Ticket files** — written only by this role, in the ticket format: `<agc install>/docs/ticket-format.md` and `<agc install>/templates/ticket.md` (`<agc install>` = agc's install directory, not the workspace). They go in the ticket directory (`ticketDir` in `.current/.config.json`, default `docs/tickets/`). One ticket file maps to at most one tracker item; `source` = `<item number> rev <revision>`, the number only, never a link, and empty in a public repository. Describe internal URLs, codenames and people by class, never by name. When the project keeps a backlog, add one index line per ticket.";
const BASE_SW_OUTPUTS_LAST =
  "- After the approval row is written, commit the record and the ticket files together per the repository's commit rules (branch and pull request where the main branch is protected), so the commit can be cited.";
const BASE_IN_OWN_COMMITS =
  "**Your own commits** (bookkeeping, plans, backlog, docs) ride the open wave's `integ/<feature>` branch or, when no wave is open, a `docs/<date>-<slug>` branch landed by pull request the same way (steps 3–6 above) — never local `main`. They are verified the same way — CI on the pushed branch (the repo's CI check on `<HEAD>` after the push), the local full suite only under the *CI fallback* (5a) — the same bar as a lane. \"Docs only\" is not an exemption. A local full suite for them — under the *CI fallback* or as a pre-push run — MUST run inside the 5a verifier, never in your own context.";
const BASE_CO_NO_TICKET =
  "A tracker number (an issue or work-item id) with no ticket file → reply only with \"No ticket file for <tracker id> — start the `spec-workshop` prompt first.\" and stop (no chain); never write the ticket's scenarios yourself.";
const BASE_TF_SOURCE_ROW =
  "| `source` | no | Leave it out or empty, unless the ticket was cut from an issue-tracker item. Then it is a list of `<item number> rev <revision>` entries, for example `[1234 rev 7]`: the tracker's item number and the item's revision when the ticket was written. Write the number only, never a link. Leave it empty in a public repository. |";
const BASE_TF_WHERE = [
  "## Where ticket files are listed",
  "",
  "The project's backlog stays the index of all work. A backlog entry for a ticket that has a ticket file points",
  "at it by the ticket file's path relative to the repository root. Older backlog entries without a ticket file",
  "are not converted.",
].join("\n");
const BASE_TF_H2 = ["## Field block", "## Scenarios", "## Where ticket files are listed", "## Named tests checked in CI", "## Batch summary", "## Example ticket", "## Context", "## Scenarios", "## Added during build", "## Checking with this repository's tooling"];

// sha256 of each file at the cut base, and how to take the Copy back out of the current text.
const count = (hay, needle) => hay.split(needle).length - 1;
function removeInsert(text, block, label) {
  assert.equal(count(text, "\n\n" + block), 1, `${label}: the Copy block must occur exactly once, after one blank line`);
  return text.replace("\n\n" + block, () => "");
}
function swapBack(text, now, was, label) {
  assert.equal(count(text, now), 1, `${label}: the Copy sentence must occur exactly once`);
  return text.replace(now, () => was);
}
const BASE = {
  [SW_FILE]: { sha: "e8f7ee8c360cc9686e850a1b3c8f3debbe12512a87aee5e836c6d6174f8e08b9", revert: (t) => swapBack(removeInsert(t, C_SW2, "C-SW2"), C_SW1, OLD_SW_SENTENCE, "C-SW1") },
  // Re-pinned by E443a (specs/e443a-manifest-waves.md): the base now includes that ticket's two integrator
  // strings (Stage 1 step 6, Stage 2 exception); was bebdd0e874912302b06f2ae81812aa924b1089f21a3a1b0767e2b078f6f58d06.
  // Re-pinned by E443b (specs/e443b-lane-launcher.md): the base now includes that ticket's four edited integrator
  // lines (Work overview, Lifecycle, Stage 3 Render, Stage 6 step 7); was 81ea9cf3dbc3c706285b8e54105d0745aa81eae56f3a69ba2407eb0c205ff840.
  [IN_FILE]: { sha: "908fa6a0938ed5bb4eb38ea4b74285b1a5306a996f6d1e450be05f199a5d917f", revert: (t) => removeInsert(t, C_IN1, "C-IN1") },
  [CO_FILE]: { sha: "ad94413ccc8443ac135e29c19455df534139c94e31fc181cbe3d5ba65a745511", revert: (t) => removeInsert(t, C_CO1, "C-CO1") },
  [TF_FILE]: { sha: "2321639c08c98cd5023d6f16bb51396a74c5d1d28200e8f37be12121a3f04407", revert: (t) => removeInsert(t, C_TF1, "C-TF1") },
};
const sha256 = (t) => crypto.createHash("sha256").update(t, "utf8").digest("hex");

// Rebuilds the base from the current file; equal hash = the Copy is the file's only change.
function baseOf(rel) {
  const base = BASE[rel].revert(read(rel));
  assert.equal(sha256(base), BASE[rel].sha, `${rel}: with the Copy taken out the file must equal the cut base byte for byte (another line changed)`);
  return base;
}

// ---------------------------------------------------------------------------
// Served text (the composed prompts an agent receives)
// ---------------------------------------------------------------------------

function served(skillFile, description) {
  const ws = fs.mkdtempSync(path.join(os.tmpdir(), "e428-bundle-"));
  made.push(ws);
  fs.mkdirSync(path.join(ws, ".current"), { recursive: true });
  setActiveStorage(new FileHandoffStorage());
  return buildPromptForRole(skillFile, description, ws).messages[0].content.text;
}
const SW_DESCRIPTION =
  "Spec workshop — turn specs, design sources, issue-tracker items or an idea into dated rulings, ticket files and a wave table, in rounds with the human. Human-started; writes no handoff state.";
const servedSW = () => served("skill-spec-workshop.md", SW_DESCRIPTION);
const servedCoord = () => served("skill-coordinator.md", "Agent Governance Coordinator. Route tasks or execute them.");
const servedIntegrator = () =>
  served("skill-integrator.md", "Integrator — plan parallel lanes, pre-review cuts, verify lane reports, merge, tear down. Cross-lane; writes no handoff state.");

const linesOf = (t) => t.split("\n");
// The text of the `## <heading>` section (heading line included) up to the next `## ` heading.
function h2Section(text, heading) {
  const ls = linesOf(text);
  const i = ls.findIndex((l) => l === heading);
  assert.ok(i >= 0, `heading ${heading} present`);
  let j = i + 1;
  while (j < ls.length && !ls[j].startsWith("## ")) j++;
  return ls.slice(i, j).join("\n");
}

// Parses a tracker map: one `write-back:` line, one table, the spec's header, known kinds, no link.
function assertMapShape(text) {
  const ls = linesOf(text).filter((l) => l.trim() !== "");
  const wb = ls.filter((l) => /^write-back:/.test(l));
  assert.deepEqual(wb, ["write-back: off"], "exactly one `write-back: off` line");
  const firstRow = ls.findIndex((l) => l.startsWith("|"));
  const rows = ls.slice(firstRow);
  assert.ok(rows.every((l) => l.startsWith("|")), "one table, nothing after it");
  assert.equal(rows[0], "| ticket | item | kind | revision |", "table header");
  assert.match(rows[1], /^\|(-{3,}\|){4}$/, "separator row");
  assert.ok(rows.length > 2, "the example has data rows");
  for (const r of rows.slice(2)) {
    const cells = r.split("|").slice(1, -1).map((c) => c.trim());
    assert.equal(cells.length, 4, `four cells: ${r}`);
    assert.ok(["source", "mirror", "child"].includes(cells[2]), `kind is source/mirror/child: ${r}`);
    assert.match(cells[1], /^\d+$/, `item is a bare number: ${r}`);
    for (const c of cells) assert.ok(!/:\/\/|\]\(|www\.|\bhttps?\b/i.test(c), `no link in a cell: ${r}`);
  }
}

// ---------------------------------------------------------------------------
// AC1 — spec-workshop creates mirror items on request
// ---------------------------------------------------------------------------

test("AC1: spec-workshop has `## Tracker mirror` (C-SW2) directly after the unchanged last Outputs bullet and before `## Governance state`; served text carries it", () => {
  // WHY: the mirror is created only after approval, with the host's tools, one item per ticket, and recorded by
  // number in an untracked map; placing it as its own section keeps the Outputs list and every frozen pin intact.
  const sop = read(SW_FILE);
  assert.equal(count(sop, BASE_SW_OUTPUTS_LAST + "\n\n" + C_SW2 + "\n\n## Governance state\n"), 1, "C-SW2 sits between the unchanged last Outputs bullet and ## Governance state, one blank line each side");
  assert.equal(count(sop, "## Tracker mirror"), 1, "one Tracker mirror section");
  assert.equal(h2Section(sop, "## Tracker mirror"), C_SW2 + "\n", "section body is exactly C-SW2");
  assert.ok(C_SW2.includes(SW2.create) && C_SW2.includes(SW2.record), "sanity: create + record sentences are in the block");
  baseOf(SW_FILE);
  const text = servedSW();
  assert.ok(text.includes(C_SW2), "served spec-workshop prompt carries C-SW2 verbatim");
});

// ---------------------------------------------------------------------------
// AC2 — imported tickets: no second item, child only on request
// ---------------------------------------------------------------------------

test("AC2: imported tickets get no new item, a child item only on request, at most one created item (C-SW2, C-TF1 bullet 2, map rule)", () => {
  // WHY: a ticket cut from a tracker item already has a public face there; a second item would split the discussion.
  const sop = read(SW_FILE);
  assert.ok(sop.includes(`${SW2.imported} ${SW2.one}`), "C-SW2 imported-ticket and one-created-item sentences, in order");
  const doc = read(TF_FILE);
  assert.ok(TF_B[1].startsWith("- A ticket file gets at most one tracker item created for it:"), "sanity: bullet 2 is the first-level rule");
  assert.ok(doc.includes(TF_B[1]), "ticket format carries C-TF1 bullet 2");
  assert.ok(TF_B[1].includes("for a ticket cut from\n  items, one child item under one of them, chosen by the person who asks for it."), "sanity: amended bullet 2 covers several source items");
  assert.ok(!doc.includes(OLD_TF_CHILD), "the pre-amendment `one child item under that item` wording is gone (a `source` may list several items)");
  assert.equal(TF_MAP_B[2], MAP_ONE_ROW, "sanity: the map rule is the last map bullet");
  assert.equal(count(doc, MAP_ONE_ROW), 1, "the map rule `A ticket has at most one `mirror` or `child` row.` is present once");
  const text = servedSW();
  assert.ok(text.includes(`${SW2.imported} ${SW2.one}`), "served spec-workshop carries the imported-ticket sentences");
});

// ---------------------------------------------------------------------------
// AC3 — no request, no write; reading stays allowed
// ---------------------------------------------------------------------------

test("AC3: without a mirror request nothing is written — C-SW2 opens with the request condition, C-TF1 bullet 6, C-IN1 `No item, no write.`, C-CO1 ends read-only", () => {
  // WHY: the tracker is shared with people outside the chain; a default write would publish without consent.
  const sop = read(SW_FILE);
  assert.ok(h2Section(sop, "## Tracker mirror").startsWith("## Tracker mirror\n\n" + SW2.request + " "), "C-SW2 opens with the request condition and its reading carve-out");
  assert.ok(TF_B[5].startsWith("- Without a mirror request nothing is written to a tracker. "), "sanity: bullet 6");
  assert.ok(read(TF_FILE).includes(TF_B[5]), "ticket format carries C-TF1 bullet 6");
  const integ = read(IN_FILE);
  assert.ok(IN_INTRO.includes(" No item, no write. "), "sanity: amended intro");
  assert.ok(integ.includes(IN_INTRO), "integrator C-IN1 intro says `No item, no write.`");
  assert.ok(!integ.includes(OLD_IN.noWrite), "the pre-amendment `No row, no write.` is gone");
  const coord = read(CO_FILE);
  assert.ok(C_CO1.endsWith("Only read the tracker; never write to it."), "sanity: C-CO1 ending");
  assert.ok(coord.includes(C_CO1), "coord-01 carries C-CO1");
  assert.ok(servedSW().includes(SW2.request), "served spec-workshop carries the request condition");
  assert.ok(servedCoord().includes(C_CO1), "served teamwork coordinator carries C-CO1 with its read-only ending");
});

// ---------------------------------------------------------------------------
// AC4 — ticket files hold numbers only in `source`, none in a public repository
// ---------------------------------------------------------------------------

test("AC4: the Ticket files bullet carries C-SW1 in place of the old one-item sentence; e423 fragments kept; C-TF1 bullet 3; `source` field row byte-identical", () => {
  // WHY: the one-item limit now counts created items only (moved to C-SW2); the recording rule must keep item
  // numbers out of public repositories, and the field definition itself must not move.
  const sop = read(SW_FILE);
  const want = BASE_SW_TICKET_FILES.replace(OLD_SW_SENTENCE, () => C_SW1);
  assert.notEqual(want, BASE_SW_TICKET_FILES, "sanity: the frozen bullet holds the old sentence");
  assert.equal(linesOf(sop).filter((l) => l.startsWith("- **Ticket files** — ")).join("\n"), want, "Ticket files bullet = base bullet with C-SW1 in place of the old sentence");
  assert.ok(!sop.includes(OLD_SW_SENTENCE), "the old sentence is gone");
  assert.ok(!sop.includes("One ticket file maps to at most one tracker item"), "the old one-item clause is gone");
  for (const frag of ["`source` = `<item number> rev <revision>`", "empty in a public repository"]) {
    assert.ok(sop.includes(frag), `e423 fragment kept: ${frag}`);
  }
  const doc = read(TF_FILE);
  assert.ok(TF_B[2].startsWith("- A ticket file holds tracker item numbers only in its `source` field, never a link;"), "sanity: bullet 3");
  assert.ok(doc.includes(TF_B[2]), "ticket format carries C-TF1 bullet 3");
  assert.equal(linesOf(doc).filter((l) => l.startsWith("| `source` |")).join("\n"), BASE_TF_SOURCE_ROW, "`source` field row byte-identical to base");
  assert.ok(servedSW().includes(C_SW1), "served spec-workshop carries C-SW1");
});

// ---------------------------------------------------------------------------
// AC5 — the tracker map: documented placement and a real-git behaviour check
// ---------------------------------------------------------------------------

test("AC5 (format text): `## Tracker mirror` + `### Tracker map` are exactly C-TF1, after the unchanged `## Where ticket files are listed`, before `## Named tests checked in CI`; the map example parses", () => {
  // WHY: the format doc is the adopter's contract; placing it before Named tests keeps the pinned section order
  // (Named tests → Batch summary → Example ticket, tooling last), and the example must be a well-formed map.
  const doc = read(TF_FILE);
  assert.equal(count(doc, BASE_TF_WHERE + "\n\n" + C_TF1 + "\n\n## Named tests checked in CI\n"), 1, "C-TF1 sits between the unchanged Where-listed section and Named tests, one blank line each side");
  const h2 = linesOf(doc).filter((l) => l.startsWith("## "));
  const want = [...BASE_TF_H2];
  want.splice(want.indexOf("## Named tests checked in CI"), 0, "## Tracker mirror");
  assert.deepEqual(h2, want, "H2 order = base order with ## Tracker mirror inserted before Named tests");
  assert.equal(TF_B.length, 6, "sanity: intro + six bullets");
  baseOf(TF_FILE);
  const sec = doc.slice(doc.indexOf("### Tracker map"));
  const fence = sec.match(/\n```\n([\s\S]*?)\n```\n/);
  assert.ok(fence, "the Tracker map section has a fenced example");
  assertMapShape(fence[1]);
});

function git(cwd, ...args) {
  const env = { ...process.env, GIT_CONFIG_GLOBAL: os.devNull, GIT_CONFIG_NOSYSTEM: "1" };
  for (const k of ["GIT_DIR", "GIT_WORK_TREE", "GIT_INDEX_FILE", "GIT_COMMON_DIR", "GIT_OBJECT_DIRECTORY"]) delete env[k];
  return execFileSync("git", ["-c", "user.name=t", "-c", "user.email=t@example.invalid", "-c", "commit.gpgsign=false", ...args], { cwd, env, encoding: "utf-8", stdio: ["ignore", "pipe", "pipe"] });
}

test("AC5 (behaviour): a map written into `git rev-parse --git-common-dir` is untracked with no ignore rule and is the same file from a linked worktree", () => {
  // WHY: lanes run in linked worktrees; the documented location must be shared by every checkout and must
  // never show up in git status, or adopters would need an ignore rule (or would commit item numbers).
  const box = fs.mkdtempSync(path.join(os.tmpdir(), "e428-map-"));
  made.push(box);
  const primary = path.join(box, "primary");
  const lane = path.join(box, "lane");
  fs.mkdirSync(primary);
  git(primary, "init", "-q");
  git(primary, "commit", "-q", "--allow-empty", "-m", "init");
  git(primary, "worktree", "add", "-q", lane, "-b", "lane");

  const mapPath = path.resolve(primary, git(primary, "rev-parse", "--git-common-dir").trim(), "agc-tracker-map.md");
  const map = MAP_EXAMPLE.join("\n") + "\n";
  assertMapShape(map);
  fs.writeFileSync(mapPath, map);

  // Control: the same file in the working tree IS reported, so an empty status below is not vacuous.
  fs.writeFileSync(path.join(primary, "agc-tracker-map.md"), map);
  assert.match(git(primary, "status", "--porcelain", "--ignored"), /agc-tracker-map\.md/, "control: a working-tree copy shows in status");
  fs.rmSync(path.join(primary, "agc-tracker-map.md"));

  for (const [name, dir] of [["primary", primary], ["linked worktree", lane]]) {
    assert.equal(git(dir, "status", "--porcelain", "--ignored"), "", `${name}: status (with --ignored) is empty`);
  }
  const laneMap = path.resolve(lane, git(lane, "rev-parse", "--git-common-dir").trim(), "agc-tracker-map.md");
  assert.equal(fs.realpathSync(laneMap), fs.realpathSync(mapPath), "the linked worktree resolves the same file");
  assert.equal(fs.readFileSync(laneMap, "utf-8"), map, "and reads the same content");
  const exclude = path.join(primary, ".git", "info", "exclude");
  assert.ok(!fs.existsSync(path.join(primary, ".gitignore")), "no .gitignore was needed");
  assert.ok(!fs.existsSync(exclude) || !fs.readFileSync(exclude, "utf-8").includes("agc-tracker-map"), "no info/exclude rule was needed");
});

// ---------------------------------------------------------------------------
// AC6 — integrator keeps mirrored items current
// ---------------------------------------------------------------------------

test("AC6: integrator `## Tracker items` (C-IN1) sits after the Stage 6 *Your own commits* paragraph and before `## Git operations`; nothing else moves", () => {
  // WHY: the updates span stages 3-6, so the section follows Stage 6; inserting it there keeps the line-numbered
  // pins above it and the `### Sessions outside a lane` → `## Stage 5` adjacency in place.
  const integ = read(IN_FILE);
  assert.equal(count(integ, BASE_IN_OWN_COMMITS + "\n\n" + C_IN1 + "\n\n## Git operations\n"), 1, "C-IN1 sits between the unchanged *Your own commits* paragraph and ## Git operations");
  assert.ok(IN_B[0].includes("in progress at dispatch") && IN_B[0].includes("the reason after `stopped — `") && IN_B[0].includes("the pull request's number once it is open") && IN_B[0].includes("done at merge"), "sanity: bullet 1 names all four moments");
  const ls = linesOf(integ);
  const ti = ls.indexOf("## Tracker items");
  const prevH2 = ls.slice(0, ti).filter((l) => l.startsWith("## ")).pop();
  assert.equal(prevH2, "## Stage 6 — `main` and teardown", "the section follows Stage 6");
  const so = ls.indexOf("### Sessions outside a lane");
  assert.ok(so >= 0, "### Sessions outside a lane present");
  assert.equal(ls.slice(so + 1).find((l) => l.startsWith("#")), "## Stage 5 — Verify and integrate", "### Sessions outside a lane is still followed directly by ## Stage 5");
  baseOf(IN_FILE);
});

// ---------------------------------------------------------------------------
// AC7 — a stop's question is drafted, never posted
// ---------------------------------------------------------------------------

test("AC7: a stop shows the stopped state and reason; the open question is drafted, never posted (C-IN1 bullet 3, C-TF1 bullet 5)", () => {
  // WHY: what is said in public is the human's decision; a tool posting the question would speak for them.
  const integ = read(IN_FILE);
  assert.ok(integ.includes(IN_B[2]), "integrator carries C-IN1 bullet 3");
  assert.ok(IN_B[2].includes("is never posted, whatever the item:"), "sanity: bullet 3 covers every item kind (mirror, child, source)");
  assert.ok(!integ.includes(OLD_IN.stop), "the pre-amendment `whatever the row` wording is gone (a source item may have no row)");
  assert.ok(integ.includes(IN_B[0]), "integrator carries C-IN1 bullet 1 (stopped state and reason)");
  const doc = read(TF_FILE);
  assert.ok(TF_B[4].includes("A stop's open question is never posted by a tool: it is drafted for a person to post or not."), "sanity: bullet 5");
  assert.ok(doc.includes(TF_B[4]), "ticket format carries C-TF1 bullet 5");
});

// ---------------------------------------------------------------------------
// AC8 — write-back to source items is off by default, switched in the local map only
// ---------------------------------------------------------------------------

// The AC8 worked example: ticket E900 cut from item 1234. Each rule below is applied only when the given text
// states it verbatim, so the outcome follows the shipped text (old text: no `source`-field item, no write).
const RULE = {
  fieldCounts: "Only a ticket with a tracker item gets tracker writes: an item its ticket file's `source` field lists, or a row in the tracker map",
  onlyOn: "only when the map's `write-back` line reads `on`",
  noRowNeeded: "whether or not the map has a row for the ticket",
  offDefault: "A missing file, a missing line or any other value means `off`",
};
const ticketFile = (source) => ["---", "id: E900", "title: CSV export adds a header row", "status: in progress", `source: ${source}`, "---", "", "## Context", ""].join("\n");
const MAP_HEAD = ["| ticket | item | kind | revision |", "|---|---|---|---|"];
function sourceWrites(integ, fmt, ticket, map) {
  const src = (ticket.match(/^source: *\[(.*)\]$/m)?.[1] ?? "").split(",").map((e) => e.trim().match(/^(\d+) rev \d+$/)?.[1]).filter(Boolean);
  const rows = (map ?? "").split("\n").filter((l) => /^\| *E900 *\|/.test(l)).map((l) => l.split("|").map((c) => c.trim()));
  const srcRows = rows.filter((c) => c[3] === "source").map((c) => c[2]);
  const items = [...new Set([...(integ.includes(RULE.fieldCounts) ? src : []), ...srcRows])];
  if (items.length === 0) return [];
  assert.ok(fmt.includes(RULE.offDefault), "format text: anything but `on` means off");
  const wb = map === null ? undefined : map.match(/^write-back: *(\S*) *$/m)?.[1];
  if (!integ.includes(RULE.onlyOn) || wb !== "on") return [];
  return integ.includes(RULE.noRowNeeded) ? items : items.filter((i) => srcRows.includes(i));
}

test("AC8: source items (the ticket file's `source` field or a `source` row) are written only when the map's `write-back` reads `on`, row or no row (private repository); off by default; no config key", () => {
  // WHY: in a private repository a source item lives only in the ticket file's `source` field, so the switch must
  // reach it without a map row (review round 1, F1); yet a source item belongs to whoever filed it, so writing
  // needs a person's explicit opt-in, kept in the untracked local map (human Q3 (B)), not a tracked config key.
  const integ = read(IN_FILE);
  assert.ok(IN_INTRO.startsWith(RULE.fieldCounts + " — "), "sanity: the intro admits an item the `source` field lists");
  assert.ok(IN_B[1].includes(RULE.onlyOn) && IN_B[1].includes(RULE.noRowNeeded), "sanity: bullet 2 needs `on`, not a row");
  assert.ok(TF_MAP_B[0].startsWith("- `write-back` is `on` or `off`. " + RULE.offDefault + ";"), "sanity: map bullet on write-back");
  const doc = read(TF_FILE);

  // Private repository: the item is only in the ticket file; the map holds the switch and no E900 row.
  const one = ticketFile("[1234 rev 7]");
  const two = ticketFile("[1234 rev 7, 1301 rev 3]");
  const otherRow = [...MAP_HEAD, "| E899 | 1240 | mirror | — |"].join("\n");
  const cases = [
    ["write-back: on, no map row", one, "write-back: on\n", ["1234"]],
    ["write-back: on, no map row, two source items", two, "write-back: on\n" + otherRow + "\n", ["1234", "1301"]],
    ["write-back: off", one, "write-back: off\n", []],
    ["write-back line missing", one, otherRow + "\n", []],
    ["write-back: yes (any other value)", one, "write-back: yes\n", []],
    ["no map file", one, null, []],
    // Public repository: `source` empty, the item is in a `source` row.
    ["public: `source` row, write-back: on", ticketFile("").replace("source: ", "source:"), ["write-back: on", "", ...MAP_HEAD, "| E900 | 1234 | source | 7 |"].join("\n"), ["1234"]],
  ];
  for (const [label, text] of [["raw", integ], ["served", servedIntegrator()]]) {
    for (const [name, ticket, map, want] of cases) {
      assert.deepEqual(sourceWrites(text, doc, ticket, map), want, `${label} integrator text, ${name}: writes to ${JSON.stringify(want)}`);
    }
  }

  assert.ok(integ.includes(IN_INTRO), "integrator carries the amended C-IN1 intro");
  assert.ok(integ.includes(IN_B[1]), "integrator carries the amended C-IN1 bullet 2 (Source item)");
  for (const old of [OLD_IN.intro, OLD_IN.source]) assert.ok(!integ.includes(old), `pre-amendment wording gone: ${old}`);
  assert.ok(doc.includes(TF_MAP_B[0]), "ticket format carries the write-back map bullet");
  assert.ok(doc.includes(TF_B[4]), "ticket format carries C-TF1 bullet 5 (writing to a source item is off unless the map turns it on)");
  const sop = read(SW_FILE);
  assert.ok(sop.includes(SW2.writeBack), "spec-workshop carries the C-SW2 switch sentence");
  assert.ok(servedSW().includes(SW2.writeBack), "served spec-workshop carries the switch sentence");
  for (const rel of ["tools/config.ts", "dist/tools/config.js", "docs/config.md"]) {
    assert.doesNotMatch(read(rel), /tracker|write-?back/i, `${rel} defines no tracker / write-back config key`);
  }
});

// ---------------------------------------------------------------------------
// AC9 — a tracker number with a ticket file → work from the file
// ---------------------------------------------------------------------------

test("AC9: coord-01 carries C-CO1 directly after the unchanged no-ticket-file paragraph and before `## Auto-Routing`; served teamwork carries it", () => {
  // WHY: starting by a tracker number must not bypass the ticket of record; the no-ticket-file rule stays as is.
  const coord = read(CO_FILE);
  assert.equal(count(coord, BASE_CO_NO_TICKET), 1, "the no-ticket-file paragraph is byte-identical");
  assert.equal(count(coord, BASE_CO_NO_TICKET + "\n\n" + C_CO1 + "\n\n## Auto-Routing\n"), 1, "C-CO1 is its own paragraph directly after it, then ## Auto-Routing");
  baseOf(CO_FILE);
  const text = servedCoord();
  assert.ok(text.includes(BASE_CO_NO_TICKET), "served teamwork keeps the no-ticket-file paragraph");
  assert.ok(text.includes(C_CO1), "served teamwork carries C-CO1 verbatim");
});

// ---------------------------------------------------------------------------
// AC10 — revision compare at work start and before acceptance
// ---------------------------------------------------------------------------

test("AC10: the source item's revision is compared at work start and before each code-reviewer dispatch; a change is reported, never copied (C-CO1 sentence 2, C-TF1 bullet 4)", () => {
  // WHY: a source item edited after the cut may change what acceptance means; the human rules on it before PASS.
  assert.ok(read(CO_FILE).includes(CO[1]), "coord-01 carries C-CO1 sentence 2");
  assert.ok(servedCoord().includes(CO[1]), "served teamwork carries C-CO1 sentence 2");
  assert.ok(TF_B[3].startsWith("- Before work starts and again before acceptance,"), "sanity: bullet 4");
  assert.ok(read(TF_FILE).includes(TF_B[3]), "ticket format carries C-TF1 bullet 4");
});

// ---------------------------------------------------------------------------
// AC11 — the file wins; differences are reported, never read back
// ---------------------------------------------------------------------------

test("AC11: where tracker content differs, the ticket file wins and the difference is reported (C-TF1 bullet 1, C-IN1 bullet 4, C-CO1 sentence 1)", () => {
  // WHY: one-way mirroring keeps one source of truth; reading tracker edits back would make the tracker a second record.
  assert.ok(TF_B[0].startsWith("- Direction is fixed, repository to tracker."), "sanity: bullet 1");
  assert.ok(read(TF_FILE).includes(TF_B[0]), "ticket format carries C-TF1 bullet 1");
  assert.ok(read(IN_FILE).includes(IN_B[3]), "integrator carries C-IN1 bullet 4");
  assert.ok(read(CO_FILE).includes(CO[0]), "coord-01 carries C-CO1 sentence 1");
  assert.ok(servedCoord().includes(CO[0]), "served teamwork carries C-CO1 sentence 1");
});

// ---------------------------------------------------------------------------
// AC12 — added lines are adopter-safe
// ---------------------------------------------------------------------------

// Whole-word, case-insensitive tracker vendor / product names (the spec's list plus a few more).
const VENDORS = ["jira", "azure devops", "azure boards", "ado", "github issues", "github", "gitlab", "bitbucket", "linear", "asana", "trello", "youtrack", "bugzilla", "redmine", "clickup", "monday", "notion", "shortcut", "pivotal tracker", "servicenow"];
const ALLOWED_IDS = new Set(["E900", "E899"]);

// For a line that replaces a base line, only the part between their common prefix and suffix is new text.
function newPart(line, removed) {
  let best = line;
  for (const old of removed) {
    let p = 0;
    while (p < line.length && p < old.length && line[p] === old[p]) p++;
    let s = 0;
    while (s < line.length - p && s < old.length - p && line[line.length - 1 - s] === old[old.length - 1 - s]) s++;
    if (p + s > line.length / 2 && line.length - p - s < best.length) best = line.slice(p, line.length - s);
  }
  return best;
}

test("AC12: every added or changed line in the four files holds no URL, repo-only path, bare ticket id, version label, quoted error code or vendor name", () => {
  // WHY: these files ship to every adopter; a repo path or id is a dead lead, a vendor name ties a generic rule to
  // one product, and tracker actions must be named by capability so any host's own tools fit.
  let scanned = 0;
  for (const rel of [SW_FILE, IN_FILE, CO_FILE, TF_FILE]) {
    const base = linesOf(baseOf(rel));
    const cur = linesOf(read(rel));
    const baseLines = new Set(base);
    const curLines = new Set(cur);
    const removed = base.filter((l) => !curLines.has(l));
    const added = cur.filter((l) => l.trim() !== "" && !baseLines.has(l)).map((l) => newPart(l, removed));
    assert.ok(added.length > 0, `${rel}: the scan sees added lines (or it would pass vacuously)`);
    for (const l of added) {
      scanned++;
      const short = `${rel}: ${l.slice(0, 100)}`;
      assert.ok(!l.includes("://"), `URL in ${short}`);
      const noInstall = l.replace(/<agc install>\/[^\s`),]+/g, "");
      assert.ok(!noInstall.includes("/"), `path outside <agc install>/… in ${short}`);
      for (const f of noInstall.match(/[\w.-]+\.(?:md|mjs|js|ts|json|ya?ml|txt)\b/g) ?? []) {
        assert.equal(f, "agc-tracker-map.md", `file name other than agc-tracker-map.md in ${short}`);
      }
      assert.ok(!/\.current\b|\bspecs\b|\bqa_reports\b|\bdist\b/.test(l), `repo-only location in ${short}`);
      for (const id of l.match(/\b[A-Z]{1,4}-?\d{2,}(?:-\d+)?\b/g) ?? []) assert.ok(ALLOWED_IDS.has(id), `bare ticket id ${id} in ${short}`);
      assert.doesNotMatch(l, /\bv\d+(?:\.\d+)*\b/i, `version label in ${short}`);
      assert.doesNotMatch(l, /`[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+`/, `backtick-quoted error code in ${short}`);
      assert.doesNotMatch(l, /\b[a-z]+_[a-z_]+\b/, `snake_case tool name in ${short} (name tracker actions by capability)`);
      for (const v of VENDORS) assert.doesNotMatch(l, new RegExp(`\\b${v.replace(" ", "\\s+")}\\b`, "i"), `vendor name "${v}" in ${short}`);
    }
  }
  assert.ok(scanned > 20, "sanity: the scan covered the whole Copy");
  // Tracker actions named by capability only.
  assert.ok(SW2.create.includes("use the host's own tracker tools to create one item"), "spec-workshop: create");
  assert.ok(IN_INTRO.endsWith("Use the host's own tracker tools (update an item's state, add a comment):"), "integrator: update an item's state, add a comment");
});
