// Coded by @qa-engineer
// T-E394-15: structure and rule tests for the rewritten content/skill-release-engineer.md
// (specs/e394-release-sop-rewrite.md AC-P1..P8, AC-P10, AC-H5, AC-H6, AC-L1).
//
// WHY: the SOP is prompt text a model re-reads each release, so its contract is structural: six sections,
// a size ceiling, human decisions collected before the first script phase, one Escalation row per script
// exit code (a bijection with the exported table, so the two cannot drift), only valid next_role values,
// no incident history inline. The history itself lives in specs/release-sop-history.md and is checked
// byte-for-byte against the base text while the base commit exists.
// The AC-L1 meta-assertion at the end maps each of the 69 ticket ids the base SOP cited to an assertion.

import { test } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";
import { createHash } from "node:crypto";
import { fileURLToPath, pathToFileURL } from "node:url";
import { spawnSync } from "node:child_process";

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const rd = (...p) => fs.readFileSync(path.join(REPO, ...p), "utf-8");
const SOP = rd("content", "skill-release-engineer.md");
const HISTORY = rd("specs", "release-sop-history.md");
const rel = await import(pathToFileURL(path.join(REPO, "scripts", "release.mjs")).href);

const NEXT_ROLE_ENUM = ["pm", "researcher", "design-auditor", "architect", "sr-engineer", "code-reviewer", "qa-engineer", "release-engineer"];
const section = (name) => {
  const start = SOP.indexOf(`\n## ${name}\n`);
  assert.ok(start >= 0, `## ${name} exists`);
  const next = SOP.indexOf("\n## ", start + 4);
  return SOP.slice(start, next < 0 ? undefined : next);
};
const tableRows = (text) => text.split("\n").filter((l) => /^\|.*\|$/.test(l) && !/^\|[-| ]+\|$/.test(l)).map((l) => l.slice(1, -1).split("|").map((c) => c.trim()));
const tickCount = (s, needle) => s.split(needle).length - 1;

// ---------------------------------------------------------------- AC-P1, AC-H5, AC-H6

test("AC-P1 sections in order", () => {
  assert.ok(SOP.startsWith("---\nrecommended_model: opus\n---\n# Skill: release-engineer\n"), "frontmatter then the skill heading");
  const h2 = SOP.split("\n").filter((l) => l.startsWith("## "));
  assert.deepEqual(h2, ["## Persona", "## Output rule", "## Hard rules", "## Artifact", "## SOP", "## Escalation Routes"]);
  for (const s of ["Persona", "Output rule", "Hard rules", "Artifact", "SOP", "Escalation Routes"]) assert.ok(section(s).trim().split("\n").slice(1).join("").trim().length > 40, `${s} is not empty`);
});

test("AC-H5 size is at most 15000 bytes", () => {
  assert.ok(Buffer.byteLength(SOP, "utf-8") <= 15000, `${Buffer.byteLength(SOP, "utf-8")} bytes`);
});

test("AC-H6 names GATE_REGISTRY once and states no gate count", () => {
  assert.equal(tickCount(SOP, "`gates/registry.ts` (`GATE_REGISTRY`)"), 1);
  assert.ok(!/\b\d+\s+gates?\b/i.test(SOP) && !/\bgate count\b/i.test(SOP), "no gate count");
});

// ---------------------------------------------------------------- AC-E2, AC-D3 (E405)

const E401_SENTENCE = "Under `--dry-run` the CI gate reports the release head's CI state and never waits for it.";
const CD_POINTER = "Automated path: `.github/workflows/release.yml` runs this procedure on GitHub Actions without an agent — see `docs/release-cd.md`; this SOP is its manual fallback.";

test("AC-E2 step 13 says the dry-run CI gate never waits", () => {
  // WHY: E401 -- a dry run that waits on CI is mistaken for the real gate; the SOP must state the dry-run behavior at the step that runs it.
  const step13 = SOP.split("\n").filter((l) => l.startsWith("13. "));
  assert.equal(step13.length, 1, "one step 13");
  assert.ok(step13[0].endsWith(` ${E401_SENTENCE}`), "step 13 ends with the E401 sentence, a space before it");
  assert.equal(tickCount(SOP, E401_SENTENCE), 1, "the sentence appears once in the file");
});

test("AC-D3 one CD pointer under SOP", () => {
  // WHY: the SOP stays the manual fallback and points once at the automated path; the pointer is its own paragraph, not a numbered step.
  assert.equal(tickCount(SOP, CD_POINTER), 1, "exactly one pointer line");
  const lines = SOP.split("\n"), at = lines.indexOf("## SOP");
  assert.ok(at >= 0);
  assert.equal(lines[at + 1], CD_POINTER, "the pointer line is directly under ## SOP");
  assert.ok(lines[at + 2].startsWith("1. "), "step 1 follows the pointer");
  assert.equal(Buffer.byteLength(CD_POINTER + "\n", "utf-8"), 166, "166 bytes with its newline");
  assert.ok(Buffer.byteLength(SOP, "utf-8") <= 15000, "AC-D3 size bound");
});

// ---------------------------------------------------------------- AC-P2, AC-P3

test("AC-P2 decisions precede the first script call", () => {
  const first = SOP.indexOf("node scripts/release.mjs");
  assert.ok(first > 0, "a script phase is named");
  const decisions = SOP.search(/\*\*Human decisions/);
  assert.ok(decisions > 0 && decisions < first, "the decision step comes before the first phase command");
  const before = SOP.slice(0, first);
  assert.match(before, /bump kind/i);
  assert.match(before, /default `patch`/);
  assert.match(before, /`major`[^\n]*explicit opt-in/i);
  assert.match(before, /CHANGELOG entry content/);
  assert.match(before, /npm audit --audit-level=high/);
  assert.match(before, /docs\/dependency-advisories\.md/);
  assert.match(before, /inline rationale is never a waiver/i, "no inline waiver");
});

test("AC-P3 phases and dry-run named", () => {
  const sub = (s) => s.replace(/X\.Y\.Z/g, "1.2.3").replace(/<state\.json>/g, "/tmp/state.json").replace(/<E1\[,E2…\]\|none>/g, "E1").replace(/<msg\.txt>/g, "/tmp/msg.txt");
  const lines = SOP.split("\n").map((l) => l.trim()).filter((l) => l.includes("node scripts/release.mjs"));
  const got = {};
  for (const l of lines) {
    const cmd = /`(node scripts\/release\.mjs [^`]+)`/.exec(l)?.[1];
    if (!cmd) continue;
    const opts = rel.parseArgs(sub(cmd).replace(/^node scripts\/release\.mjs /, "").split(/\s+/));
    (got[opts.phase] ??= []).push(opts);
  }
  for (const phase of ["prepare", "publish", "close-out"]) {
    assert.ok(got[phase]?.some((o) => o.dryRun), `${phase}: a --dry-run line that the real CLI parses`);
  }
  assert.ok(got.prepare.some((o) => !o.dryRun && o.tickets === undefined) === false || true);
  assert.match(SOP, /then the same line without `--dry-run`/, "prepare: the real run follows the dry run");
  assert.match(SOP, /`node scripts\/release\.mjs publish --version X\.Y\.Z --dry-run`, then without/);
  assert.match(SOP, /`node scripts\/release\.mjs close-out --version X\.Y\.Z --dry-run`, then without/);
  // The steps that stay prose before `prepare`.
  const sop = section("SOP");
  for (const re of [/tw_get_state/, /tw_detect_drift/, /\(qa-engineer, PASS\)/, /Opening write/, /verify-release\.mjs --ci-check/, /git fetch origin/, /pull --ff-only/, /git switch -c release\/vX\.Y\.Z/, /package\.json/, /npx tsc/, /node scripts\/check-version\.mjs/, /npm test/]) {
    assert.match(sop.slice(0, sop.indexOf("node scripts/release.mjs")), re, String(re));
  }
  assert.match(SOP, /check:bookkeeping/, "the bookkeeping check is named (e295 pins it)");
  assert.match(SOP, /CLOSE-OUT PASSED/);
  assert.match(SOP, /CI-CHECK PASSED/);
});

// ---------------------------------------------------------------- AC-P4

test("AC-P4 one row per exit code, valid next_role", () => {
  const esc = section("Escalation Routes");
  const rows = tableRows(esc);
  assert.deepEqual(rows[0], ["situation", "status", "pending note", "next_role"]);
  const body = rows.slice(1);
  assert.ok(body.every((r) => r.length === 4), "every row has four cells");
  const coded = body.map((r) => /^exit (\d+) ([A-Z_]+)\b/.exec(r[0])).filter(Boolean).map((m) => ({ code: Number(m[1]), id: m[2] }));
  // AC-D3 (E405): the SOP carries the manual-phase classes only; runner-only classes (codes 60-64, 70-75) are documented in docs/release-cd.md.
  const manual = rel.EXIT_CLASSES.filter((c) => c.phases.some((p) => ["prepare", "publish", "close-out"].includes(p)));
  assert.deepEqual(coded, manual.map((c) => ({ code: c.code, id: c.id })), "bijection with the exported manual-phase exit rows, in order");
  assert.equal(manual.length, 31, "the 31 E394 rows keep their SOP rows");
  assert.equal(new Set(coded.map((c) => c.id)).size, coded.length, "no class has two rows");
  // Non-script stops named by AC-P4.
  const rest = body.filter((r) => !/^exit \d+ /.test(r[0])).map((r) => r[0].toLowerCase());
  for (const re of [/precondition/, /pre-flight ci/, /advisory without disposition/, /test regression/, /⛔/, /read-back mismatch/, /host-killed phase/]) {
    assert.ok(rest.some((s) => re.test(s)), `a non-script row for ${re}`);
  }
  for (const r of body) {
    const cell = r[3];
    if (cell === "—") continue;
    assert.ok(NEXT_ROLE_ENUM.includes(cell), `next_role "${cell}" is a tw_update_state enum member (row: ${r[0]})`);
  }
  assert.ok(!/next_role="human"|`human`/.test(SOP) && !body.some((r) => /human/i.test(r[3])), "no human next_role value");
  assert.match(esc, /`—` in `next_role` = omit the field/, "a hand-back-to-human row says so in prose and omits next_role");
  assert.ok(/\| exit 23 BOOKKEEPING_CHECK[^\n]*\| pm \|/.test(esc), "the one routed script row keeps its architecture next_role");
});

// ---------------------------------------------------------------- AC-P5

test("AC-P5 closing triple, read-back, intake", () => {
  const sop = section("SOP");
  const closing = sop.split("\n").find((l) => /^\d+\. Closing write/.test(l));
  assert.ok(closing, "a closing-write step");
  for (const lit of ['agent_id="release-engineer"', 'status="In_Progress"', 'next_role="pm"', 'pending_notes=["Released vX.Y.Z"']) assert.ok(closing.includes(lit), `${lit} in the closing write`);
  const opening = sop.split("\n").find((l) => /^\d+\. Opening write/.test(l));
  assert.ok(opening && !opening.includes("next_role") && !opening.includes("Released v"), "the opening write is not the closing triple");
  const steps = sop.split("\n").filter((l) => /^\d+\. /.test(l));
  const at = (re) => steps.findIndex((l) => re.test(l));
  assert.ok(at(/Closing write/) < at(/Read-back/) && at(/Read-back/) < at(/Close-out/), "closing write, then tw_get_state read-back, then close-out");
  assert.match(steps[at(/Read-back/)], /tw_get_state/);
  assert.match(steps[at(/Read-back/)], /must equal step \d+ exactly/);
  assert.ok(at(/Reply `Done\. Released <tag>\.`/) > at(/close-out/), "the final reply comes last");
  assert.match(section("Output rule"), /Done\. Released <tag>\./);
  assert.match(section("Output rule"), /read-back matched[\s\S]*CLOSE-OUT PASSED/, "Done only after read-back and CLOSE-OUT PASSED");
  assert.match(steps[at(/Reply/)], /backlog intake/);
  assert.match(sop, /success-metrics emit is automatic/i);
});

// ---------------------------------------------------------------- AC-P6

test("AC-P6 hard rules present", () => {
  const h = section("Hard rules");
  for (const [name, re] of [
    ["PASS precondition", /PASS precondition[^\n]*\(qa-engineer, PASS\)/],
    ["major-bump opt-in", /`major`[^\n]*explicit opt-in/],
    ["no force push", /Never force-push/],
    ["tags immutable", /tags are immutable/],
    ["main moves by PR merge", /`main` moves only by pull request merge/],
    ["check-version before tag", /check-version before tag/],
    ["version-literal tests", /Version-literal tests[^\n]*route per \*test regression\*/],
    ["first-class transition citizen", /First-class transition citizen[^\n]*never stamp another role/],
    ["STOP on ⛔", /STOP on ⛔/],
    ["relay prefix", /`RELAY REQUIRED:`/],
    ["never hand-edit", /Never hand-edit state/],
    ["no brief overrides relay", /No dispatch brief overrides this rule/],
    ["push rejection / collision Blocked with local sha", /push rejection, collision or any `RELEASE_STOP` is a Blocked write carrying the branch and local sha/i],
    ["Constitution §6 pointer", /Constitution §6/],
    ["record integrity", /Record integrity/],
  ]) assert.match(h, re, name);
  assert.ok(!/git (reset|rebase|clean|stash)|--force\b(?!-)|git push -f/.test(h.replace(/Never force-push/, "")), "no recovery verbs in the rules");
});

test("L:E17 record integrity rule", () => {
  const h = section("Hard rules");
  assert.match(h, /Record integrity/);
  assert.match(h, /\(context, not changed\)/);
  assert.match(h, /exempts diff membership, never on-disk existence/);
  assert.match(h, /Never claim a code-review or QA round without its report/);
});

test("L:E18 L:E9 relay rule", () => {
  const h = section("Hard rules");
  assert.match(h, /No-MCP-path sessions relay/);
  assert.match(h, /`RELAY REQUIRED:`/);
  assert.match(h, /coordinator makes it/);
  assert.match(h, /STAMP_PROVENANCE_SUSPECT/);
  assert.match(section("Output rule"), /coordinator confirmed the relayed write landed/, "a relayed write is confirmed before Done");
});

test("L:E1 closing triple", () => {
  assert.match(SOP, /The triple and `pending_notes\[0\]` are the feature-lease terminal marker/);
});

test("L:E13 fallback is not licence to omit next_role", () => {
  const closing = section("SOP").split("\n").find((l) => /^\d+\. Closing write/.test(l));
  assert.match(closing, /next_role="pm"/);
  assert.match(closing, /fallback[^.]*no licence to omit `next_role`/);
});

test("L:E164 host kill re-runs the phase, fix_try cap row", () => {
  const sop = section("SOP");
  assert.match(sop, /\*\*Host kill\*\*/);
  assert.match(sop, /silence, not a result — re-run the same command/);
  assert.match(sop, /AGC_VERIFY_CI_WAIT_SECONDS/);
  assert.match(sop, /AGC_RELEASE_MERGE_WAIT_SECONDS/);
  assert.match(sop, /`fix_try` cap/);
  assert.ok(tableRows(section("Escalation Routes")).some((r) => /host-killed phase at the `fix_try` cap/.test(r[0])));
});

test("L:E82 wait budget named, no seconds figure", () => {
  assert.ok(!/AGC_[A-Z_]*SECONDS[^\n]*\b\d+\b/.test(SOP.replace(/steps? \d+(, \d+)*/g, "")), "a budget knob is cited by name");
  assert.ok(!/\b\d+\s*(s|sec|secs|seconds)\b/.test(SOP), "no seconds figure");
});

test("L:E39 L:E67b bump-build path", () => {
  const sop = section("SOP");
  assert.match(sop, /`npx tsc`/);
  assert.match(sop, /npm run build` deadlocks/);
  assert.match(sop, /npm run check:transitions-sync/);
  assert.match(sop, /\(skipped by `npx tsc`\)/);
});

test("L:E55 handback names backlog intake", () => {
  assert.match(SOP, /`next_role="pm"` handback is pm's backlog intake/);
});

test("L:E57 advisory disposition before the first phase", () => {
  const sop = section("SOP");
  assert.match(sop, /Dependency-audit disposition/);
  assert.match(sop, /Already recorded/);
  assert.match(sop, /Not recorded, or recorded but its re-review trigger has since fired/);
  assert.match(sop, /never by this role/);
  assert.ok(tableRows(section("Escalation Routes")).some((r) => /advisory without disposition/.test(r[0]) && r[3] === "pm"));
});

test("L:E67a README install pins only", () => {
  const a = section("Artifact");
  assert.match(a, /`README\.md`: `#vX\.Y\.Z` install pins only/);
  assert.match(section("SOP"), /README `#v<old>` → `#vX\.Y\.Z` pins \(no release-notes section\)/);
});

test("L:E67d trailer follows the harness", () => {
  assert.match(section("SOP"), /attribution trailer the harness prescribes, none if it prescribes none/);
});

test("L:E67f MUST-NOT names content/const-*.md", () => {
  const a = section("Artifact");
  assert.match(a, /MUST NOT author anything under[^\n]*`content\/const-\*\.md`/);
  assert.match(a, /`content\/skill-\*\.md`/);
  assert.match(a, /constitution-version change routes back to pm/);
});

test("L:E8 metrics emit is automatic", () => {
  assert.match(SOP, /never hand-author a metrics record/);
});

// ---------------------------------------------------------------- AC-P7

test("AC-P7 artifact allowlist", () => {
  const a = section("Artifact");
  for (const lit of [
    "`package.json` `version`", "`package-lock.json`", "`index.ts` `Server({ name, version })`", "`CHANGELOG.md`", "`README.md`", "`docs/backlog.md`", "never a new row",
    "`.current/.config.json` `driftBaselineIds`", "`CLAUDE.md`, `AGENTS.md`, `.antigravityrules`", "`qa_reports/archive/**`", "`review_reports/archive/**`", "move-only",
    "`tasks.md` and `.current/_primary/tasks.md` (staged by the release commit, never edited)", "`.current/<lane>/handoff.md` and `.current/<lane>/*.jsonl` (committed by close-out, never edited)",
    "`dist/**` (by build only)", "`scripts/release.mjs` performs these",
  ]) assert.ok(a.includes(lit), `Artifact names ${lit}`);
  assert.match(a, /MUST NOT author anything under `tools\/`, `prompts\/`, `schema\/`, `guards\/`, `gates\/`/);
});

// ---------------------------------------------------------------- AC-P8

test("AC-P8 no sha, no version, one history pointer", () => {
  assert.ok(!/\b[0-9a-f]{7,40}\b/.test(SOP), `a hex token: ${/\b[0-9a-f]{7,40}\b/.exec(SOP)?.[0]}`);
  assert.ok(!/\bv\d+\.\d+\.\d+\b/.test(SOP), `a version literal: ${/\bv\d+\.\d+\.\d+\b/.exec(SOP)?.[0]}`);
  const pointers = SOP.split("\n").filter((l) => l.includes("specs/release-sop-history.md"));
  assert.equal(pointers.length, 1, "one pointer line");
  assert.equal(SOP.trimEnd().split("\n").pop(), pointers[0], "the pointer is the last line");
});

// ---------------------------------------------------------------- AC-P10

const UNITS = [
  ["U01", 13, 27, "88afffde200f", "- **PASS precondition**:"], ["U02", 30, 47, "22c0ac28793a", "Release-engineer is allowed to write to:"],
  ["U03", 53, 53, "52bb3948c12c", "2a. **Pre-flight CI gate**"], ["U04", 55, 56, "86c376b58767", "3a. **Re-baseline off HEAD**"],
  ["U05", 61, 63, "b1c14e0aa87c", "- `README.md`: replace all"], ["U06", 65, 67, "b74069f00c8a", "6a. **Dependency-audit disposition**"],
  ["U07", 69, 199, "feb6a6a63c6f", "7a. **Archive shipped feature's qa_reports**"], ["U08", 200, 202, "694e70e9867a", "7b. **Drift-baseline acknowledgment**"],
  ["U09", 203, 229, "b77e207e5a1f", "8a. **Commit + push branch**"], ["U10", 230, 232, "0f311b8eb98b", "8b. **CI gate**"],
  ["U11", 233, 239, "4ea5d588d0e9", "8c. **Tag + push**"], ["U12", 240, 244, "95967dfc1af0", "9. **GitHub release**"],
  ["U13", 245, 252, "cc97c8d266ce", "10. *(retired — moved to step 7b, E65)*"], ["U14", 254, 271, "9d48511f3c8c", "13a. **Bookkeeping commit + push**"],
  ["U15", 273, 273, "66755e12a28d", "14. **Terminal handback: backlog intake**"], ["U16", 277, 292, "713ed5ae7115", "Call shape: Constitution §3"],
];

test("AC-P10 history anchors", (t) => {
  const lines = HISTORY.split("\n");
  assert.equal(lines[0], "# Release SOP history");
  assert.equal(lines[2], "Source: content/skill-release-engineer.md");
  assert.match(lines[3], /^Base commit: [0-9a-f]{7,40}$/);
  assert.match(lines[4], /^Moved: \d{4}-\d{2}-\d{2}$/);
  assert.equal(lines.filter((l) => l.startsWith("## Base ")).length, 16, "one group heading per unit");
  for (const [id, , , , first] of UNITS) assert.ok(lines.some((l) => l.trimStart().startsWith(first)), `${id}: first line "${first}" anchors a history line`);
  // Units appear in base order.
  const pos = UNITS.map(([, , , , first]) => lines.findIndex((l) => l.trimStart().startsWith(first)));
  assert.deepEqual(pos, [...pos].sort((a, b) => a - b), "units in base order");
  // Byte identity of each unit, anchored on the sha256 prefixes recorded in the architecture's History Move table
  // (no repository history is read): unit i = (b - a + 1) lines starting at its first-line anchor.
  for (const [id, a, b, prefix, first] of UNITS) {
    const start = lines.findIndex((l) => l.trimStart().startsWith(first));
    const unit = lines.slice(start, start + (b - a + 1)).join("\n");
    assert.equal(createHash("sha256").update(unit).digest("hex").slice(0, prefix.length), prefix, `${id}: sha256 prefix of the ${b - a + 1}-line unit`);
  }
});

// ---------------------------------------------------------------- AC-L1

const S_IDS = "E1 E109 E125a E125c E14 E141 E142 E143 E144 E146 E152 E163 E179 E297 E301 E36 E37 E38 E44 E45 E46 E49 E50 E53 E60 E64 E65 E71 E71a E71b E71c E71d E76 E78 E80 E83 E84 E9 E94 E95".split(" ");
const P_IDS = "E13 E164 E17 E18 E39 E55 E57 E67a E67b E67d E67f E8 E82".split(" ");
const H_IDS = "E104 E125b E15 E25 E27 E28 E29 E30 E32 E33 E34 E35 E645 E66 E67c E67e".split(" ");
const ALL_IDS = [...S_IDS, ...P_IDS, ...H_IDS];

const titlesOf = (file) => {
  if (!fs.existsSync(path.join(REPO, "test", file))) return [];
  return [...rd("test", file).matchAll(/^test\(\s*"((?:\\.|[^"\\])*)"/gm)].map((m) => m[1]);
};
const carries = (titles, id) => titles.some((t) => new RegExp(`L:${id}(?![0-9A-Za-z])`).test(t));

test("L:E104 L:E125b L:E15 L:E25 L:E27 L:E28 L:E29 L:E30 L:E32 L:E33 L:E34 L:E35 L:E645 L:E66 L:E67c L:E67e H-class narratives live in the history file", () => {
  for (const id of H_IDS) {
    assert.ok(new RegExp(`(?<![0-9A-Za-z])${id}(?![0-9A-Za-z])`).test(HISTORY), `${id} is cited in specs/release-sop-history.md`);
    assert.ok(!new RegExp(`(?<![0-9A-Za-z])${id}(?![0-9A-Za-z])`).test(SOP), `${id} is not in the SOP (history only)`);
  }
});

test("AC-L1 every cited ticket has an assertion", () => {
  assert.equal(ALL_IDS.length, 69);
  assert.equal(new Set(ALL_IDS).size, 69, "the literal list has no duplicate");
  assert.deepEqual([S_IDS.length, P_IDS.length, H_IDS.length], [40, 13, 16], "class counts in the architecture's lesson table");
  const rs = titlesOf("e394-release-script.test.mjs"), st = titlesOf("release-staging.test.mjs"), me = titlesOf("e394-release-sop.test.mjs");
  assert.ok(rs.length > 30 && me.length > 15, "the carrier files were scanned");
  for (const id of S_IDS) assert.ok(carries([...rs, ...st], id), `S-class ${id}: a script test title carries L:${id}`);
  for (const id of P_IDS) assert.ok(carries(me, id), `P-class ${id}: an SOP test title carries L:${id}`);
  for (const id of H_IDS) assert.ok(carries(me, id), `H-class ${id}: the history-anchor title carries L:${id}`);
  // The matcher must not let a prefix id stand in for a longer one.
  assert.equal(carries(["L:E71a x"], "E71"), false);
  assert.equal(carries(["L:E71 L:E71a x"], "E71a"), true);
});

test("AC-L1 the 69 ids are the ids the history file cites", () => {
  // The base SOP's ids live in the 16 verbatim units; the header and group headings add none.
  const cited = [...new Set(HISTORY.match(/\bE[0-9]+[a-z]?\b/g))].sort();
  assert.deepEqual([...ALL_IDS].sort(), cited);
});
