// Coded by @qa-engineer
// Tests for spec: specs/e118-reviewer-ac-completeness.md.
// Backlog E118 (P1, re-scoped 2026-09-16 to option (iv)) — code-reviewer gains a
// per-AC completeness obligation (an 8th `## AC Completeness` report section) and
// codified finding tiers (required/recommended/optional), so a diff that is
// correct-but-incomplete is stopped at review, not one round later at QA.
//
// Spec-to-Test map:
//   AC1 (obligation exists)                      -> "AC1 - ..."
//   AC2 (report dimension exists, 8th H2, order)  -> "AC2 - ..."
//   AC3 (tiers codified in the schema)            -> "AC3 - ..."
//   AC4 (SKIP when no spec file)                  -> "AC4 - ..."
//   AC5 (Quality/Architecture/Performance et al.
//        NOT rewritten — byte-identical to BASE)  -> "AC5 - ..."
//   AC6 (example report updated, minimally)        -> "AC6 - ..."
//   AC7 (token discipline)                        -> "AC7 - ..."
//   AC8-AC11 are QA-run, not per-AC unit tests in this file (golden regen,
//   context-budget, full suite, scope-boundary grep — see
//   qa_reports/review_T-E118-01.md ## AC Execution Log).
//
// WHY these assertions (not just "the string exists somewhere"): each test
// pins the *contract* the spec's design decisions (D1-D6) settled — the
// bullet's conditionality on specs/<feature>.md, the exact eight-name order,
// the tier line surviving dispatch stripping, the SKIP literal's byte-exact
// em-dash form, and the seven pre-existing bullets' literal immutability
// (pinned by sha256, so it works in a shallow CI clone per AC5's proof) —
// not merely today's implementation shape.

import { test } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";
import * as crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "..");
const SKILL_PATH = path.join(ROOT, "content", "skill-code-reviewer.md");

const { stripRationale, stripOriginTags } = await import(
  path.join(ROOT, "dist", "prompts", "text-transforms.js")
);

function readSkillFile() {
  return fs.readFileSync(SKILL_PATH, "utf8");
}

// The schema section: from the "## Review Report Schema" heading (inclusive)
// up to the "### Example" heading (exclusive). This is where the eight
// bullets and the tier line live.
function getSchemaSection(text) {
  const start = text.indexOf("## Review Report Schema");
  assert.ok(start !== -1, "## Review Report Schema heading not found");
  const end = text.indexOf("### Example", start);
  assert.ok(end !== -1, "### Example heading not found after schema section");
  return text.slice(start, end);
}

// Ordered list of top-level `- **Name** — ...` bullets within a section.
function getBulletNames(section) {
  const names = [];
  const re = /^- \*\*(.+?)\*\* — /gm;
  let m;
  while ((m = re.exec(section)) !== null) {
    names.push(m[1]);
  }
  return names;
}

function getBulletLine(section, name) {
  const re = new RegExp("^- \\*\\*" + name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\*\\* — .*$", "m");
  const m = section.match(re);
  return m ? m[0] : null;
}

// The first ```markdown fenced block in the file (the example report).
function getExampleBlock(text) {
  const m = text.match(/```markdown\n([\s\S]*?)\n```/);
  assert.ok(m, "no ```markdown fenced example block found");
  return m[1];
}

const EIGHT_NAMES_IN_ORDER = [
  "Summary",
  "AC Completeness",
  "Correctness",
  "Quality",
  "Architecture",
  "Security",
  "Performance",
  "Verdict",
];

test("AC1 - AC Completeness bullet is conditional on specs/<feature>.md and carries the three-status + evidence + required-finding contract", () => {
  const text = readSkillFile();
  const section = getSchemaSection(text);
  const bullet = getBulletLine(section, "AC Completeness");
  assert.ok(bullet, "AC Completeness schema bullet not found");
  assert.match(bullet, /specs\/<feature>\.md/, "bullet must be conditional on specs/<feature>.md existing");
  assert.match(bullet, /implemented/, "bullet must name the 'implemented' status token");
  assert.match(bullet, /partial/, "bullet must name the 'partial' status token");
  assert.match(bullet, /missing/, "bullet must name the 'missing' status token");
  assert.match(bullet, /file:line/, "bullet must cite file:line-shaped evidence");
  assert.match(bullet, /required/, "a partial/missing AC must be tagged a required finding");
});

test("AC2 - schema declares eight H2 sections in order, with AC Completeness second", () => {
  const text = readSkillFile();
  assert.match(text, /these eight H2 sections in order/, "declaration line must say 'eight'");
  assert.doesNotMatch(text, /these seven H2 sections/, "the old 'seven' declaration must be gone");
  const section = getSchemaSection(text);
  const names = getBulletNames(section);
  assert.deepStrictEqual(names, EIGHT_NAMES_IN_ORDER, "schema bullet order must match Summary, AC Completeness, Correctness, Quality, Architecture, Security, Performance, Verdict exactly");
});

test("AC3 - finding tiers (required/recommended/optional) are codified in the schema itself, outside any rationale fence, and survive dispatch stripping", () => {
  const text = readSkillFile();
  const section = getSchemaSection(text);
  const lines = section.split("\n");
  const tierLine = lines.find(
    (l) => /`required`/.test(l) && /`recommended`/.test(l) && /`optional`/.test(l) && /`APPROVED`/.test(l)
  );
  assert.ok(tierLine, "no single line in the schema section carries required/recommended/optional/APPROVED together");
  assert.doesNotMatch(tierLine, /<!--\s*rationale:start\s*-->/, "tier line must sit outside any rationale fence");
  assert.match(tierLine, /required.*blocks.*APPROVED/, "tier line must state required blocks APPROVED");
  assert.match(tierLine, /recommended.*optional.*(?:do not|neither)/, "tier line must state recommended/optional do not block");

  // Must survive the canonical dispatch-text pipeline: stripOriginTags always,
  // then stripRationale for non-fullDetail contexts (prompts/build.ts order).
  const rendered = stripRationale(stripOriginTags(text));
  assert.ok(rendered.includes(tierLine), "tier line did not survive stripRationale(stripOriginTags(...))");
});

test("AC4 - SKIP branch logs the exact literal and forbids STOP/block/request-changes when no spec file exists", () => {
  const text = readSkillFile();
  const skipLiteral = "AC Completeness: SKIP — no specs/<feature>.md (backlog-row-as-spec mini-chain)";
  assert.ok(text.includes(skipLiteral), "exact SKIP literal (byte-exact em-dash) not found verbatim");
  const section = getSchemaSection(text);
  const bullet = getBulletLine(section, "AC Completeness");
  assert.ok(bullet, "AC Completeness schema bullet not found");
  assert.ok(bullet.includes(skipLiteral), "SKIP literal must live inside the AC Completeness bullet itself (D5/D2 — no new SOP step)");
  assert.match(bullet, /never STOP/, "bullet must explicitly forbid STOP on the absence branch");
});

// Pinned at BASE=11fcd6b (branch point). Recomputed via:
//   git show 11fcd6b:content/skill-code-reviewer.md | grep -E '^- \*\*(Summary|Correctness|Quality|Architecture|Security|Performance|Verdict)\*\*'
// then sha256 of each exact line (no trailing newline). Pinning the hash
// (not the literal text) keeps this test working in a shallow CI clone that
// may not have the 11fcd6b commit object available (AC5's proof).
const BASE_BULLET_SHA256 = {
  "Summary": "2c8587c73313ab7ef025c0b1b8cbad5a040737dc953468e80d594b548d8ed966",
  "Correctness": "8bec771dfebbee73707d5116b38f83bb5a22c304a0e481e6b7fd8733bd9d48c8",
  "Quality": "10dbf7fb2ba1705a1da6ce5c7db129d74ff4be0678cfb965d91e3fcf48b89e89",
  "Architecture": "130482434a0c3533123106ea51f4ceda1d6a28616a494ad2eedc3d9e2cac16d3",
  "Security": "adc3ed573d4b94e5abad62ab9668c0a0f18b50ec97b3f889274eae72623b9068",
  "Performance": "eb4537eded90f420ce54ebecff895a38fcc2ff8a2ff8d628511bd29c95e65fa3",
  "Verdict": "56be5b1ebb6a2619eb7f4588c15f50462a4f72b99af17264586f0d31e3e8a132",
};

test("AC5 - the six pre-existing schema bullets plus Verdict are byte-identical to BASE (11fcd6b), pinned by sha256", () => {
  const text = readSkillFile();
  const section = getSchemaSection(text);
  for (const [name, expectedHash] of Object.entries(BASE_BULLET_SHA256)) {
    const line = getBulletLine(section, name);
    assert.ok(line, `bullet line for ${name} not found in current schema section`);
    const actualHash = crypto.createHash("sha256").update(line, "utf8").digest("hex");
    assert.strictEqual(
      actualHash,
      expectedHash,
      `${name} bullet line changed vs BASE (11fcd6b) — this edit must not touch pre-existing schema bullets (D1/D3, out of scope)`
    );
  }
});

// Pinned literal (BASE=11fcd6b) of the ```markdown fenced example block's
// content (the group ```markdown\n(...)\n``` captures), typed out verbatim
// here rather than fetched via a git-history read at test time — test/ files
// must not read repository history as a fixture (T-E77-02,
// test/render-structure.test.mjs). This is the entire example BEFORE the
// E118 edit added the `## AC Completeness` section.
const BASE_EXAMPLE_BLOCK =
  "# Review — T42\n" +
  "\n" +
  "## Summary\n" +
  "- Adds a `--version` flag to the CLI entry point (2 files, 14 lines).\n" +
  "- Scope matches specs/cli-version-flag.md AC1 exactly — no extras.\n" +
  "- Verdict: APPROVED.\n" +
  "\n" +
  "## Correctness\n" +
  "No findings. `--version` is parsed before subcommand dispatch (src/cli.ts:18); exit code 0 verified.\n" +
  "\n" +
  "## Quality\n" +
  "No findings. Naming and structure match the surrounding code.\n" +
  "\n" +
  "## Architecture\n" +
  "No architecture spec exists for this feature; layering unchanged.\n" +
  "\n" +
  "## Security\n" +
  "No findings. No new input crosses a trust boundary; no secrets introduced.\n" +
  "\n" +
  "## Performance\n" +
  "No findings. One synchronous package.json read at startup; no hot-path change.\n" +
  "\n" +
  "## Verdict\n" +
  "APPROVED — implementation matches AC1 with zero findings in any category.";

test("AC6 - example report gains exactly one AC Completeness section (second, after Summary); the other seven H2 sections stay byte-identical to BASE", () => {
  const text = readSkillFile();
  const example = getExampleBlock(text);
  const baseExample = BASE_EXAMPLE_BLOCK;

  const headings = [...example.matchAll(/^## (.+)$/gm)].map((m) => m[1]);
  assert.deepStrictEqual(
    headings,
    EIGHT_NAMES_IN_ORDER,
    "example must carry exactly eight H2 headings in schema order, AC Completeness second"
  );

  // The AC Completeness section body: one AC1 entry with a file:line citation.
  const acStart = example.indexOf("## AC Completeness");
  const acBodyEnd = example.indexOf("\n## ", acStart + 1);
  const acSection = example.slice(acStart, acBodyEnd === -1 ? undefined : acBodyEnd);
  assert.match(acSection, /AC1 — implemented/, "example AC Completeness section must show an 'AC1 — implemented' row");
  assert.match(acSection, /src\/cli\.ts:18/, "example AC Completeness row must cite a file:line-shaped location");

  // The insertion must be EXACTLY the 3-line block (heading + one row + blank
  // line) spliced directly before "## Correctness", with nothing else in the
  // other seven H2 sections touched (D4: "updated, minimally").
  const correctnessCount = (baseExample.match(/\n## Correctness\n/g) || []).length;
  assert.strictEqual(correctnessCount, 1, "test fixture assumption broken: base example must have exactly one '## Correctness' heading");
  const expectedExample = baseExample.replace(
    "\n## Correctness\n",
    "\n## AC Completeness\nAC1 — implemented — src/cli.ts:18\n\n## Correctness\n"
  );
  assert.strictEqual(
    example,
    expectedExample,
    "example report must equal BASE with exactly the AC Completeness 3-line block inserted before ## Correctness — no other line may change"
  );
});

test("AC7 - token discipline: file grows by at most 1200 bytes over BASE (9525 bytes)", () => {
  const size = fs.statSync(SKILL_PATH).size;
  const BASE_SIZE = 9525;
  const growth = size - BASE_SIZE;
  // eslint-disable-next-line no-console -- AC7 requires the measured number on record.
  console.log(`AC7: measured content/skill-code-reviewer.md size=${size} bytes, growth=${growth} bytes over BASE=${BASE_SIZE}`);
  assert.ok(growth >= 0, `size ${size} is smaller than BASE ${BASE_SIZE} — unexpected shrink`);
  assert.ok(size <= 10725, `size ${size} exceeds the AC7 cap of 10725 (BASE ${BASE_SIZE} + 1200)`);
});
