// Coded by @qa-engineer
// Tests for spec: specs/e258a-comment-rule.md (lane e258a, T-E258A-02).
//
// Spec-to-Test map:
//   AC1 (bullet placement)        -> t-ac1-placement
//   AC2 (five clauses)            -> t-ac2-what-why, t-ac2-function-body, t-ac2-rationale-home,
//                                    t-ac2-doc-comment-shape, t-ac2-heading-pasted-spec
//   AC3 (every compose mode)      -> t-ac3-compose-modes
//   AC4 (no jargon / ticket id)   -> t-ac4-no-jargon
//   AC5 (reviewer check, bytes)   -> t-ac5-reviewer-prefix-bytes, t-ac5-reviewer-check-text
//   Boundary / security smoke     -> t-boundary-single-bullet, t-boundary-no-control-chars
//
// WHY: the rule is prose, so a regression is silent — someone trims a clause, reorders the
// section, or retypes the scan prefix with a hyphen, and nothing fails. The scan lane emits
// the same prefix string byte-for-byte; a one-byte mismatch would make the reviewer check
// silently stop matching. Each assertion encodes the contract, not the current wording.

import { test } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const { composeConstitution } = await import(path.join(ROOT, "dist", "prompts", "build.js"));

const TAIL = fs.readFileSync(path.join(ROOT, "content", "const-15-core-tail.md"), "utf-8");
const REVIEWER = fs.readFileSync(path.join(ROOT, "content", "skill-code-reviewer.md"), "utf-8");

const LEAD = "- **Comment discipline**:";

// The bullet = from its lead line up to the next blank line (bullets here are one paragraph).
function bulletOf(text) {
  const i = text.indexOf(LEAD);
  assert.notEqual(i, -1, "Comment discipline bullet missing");
  const rest = text.slice(i);
  const end = rest.search(/\n\s*\n/);
  return end === -1 ? rest : rest.slice(0, end);
}
const BULLET = bulletOf(TAIL);
const FLAT = BULLET.replace(/\s+/g, " ");

test("AC1: bullet sits immediately after Generic citation and before the section 7 heading", () => {
  const lines = TAIL.split("\n");
  const bulletLines = lines
    .map((l, idx) => ({ l, n: idx }))
    .filter(({ l }) => l.startsWith("- **"));
  const gi = bulletLines.findIndex(({ l }) => l.startsWith("- **Generic citation**"));
  assert.ok(gi >= 0, "Generic citation bullet must exist");
  assert.ok(bulletLines[gi + 1].l.startsWith(LEAD), "new bullet must be the very next bullet after Generic citation");
  assert.equal(TAIL.split(LEAD).length - 1, 1, "exactly one Comment discipline bullet");
  const bulletStart = bulletLines[gi + 1].n;
  const h7 = lines.findIndex((l) => l.startsWith("## 7."));
  assert.ok(h7 > bulletStart, "section 7 heading must follow the bullet");
  assert.ok(
    bulletLines.every(({ n }) => n <= bulletStart || n > h7),
    "no other bullet may sit between the new bullet and the section 7 heading",
  );
});

test("AC2 clause 1: comments say WHAT and WHY, never HOW", () => {
  assert.match(FLAT, /WHAT and WHY, never HOW/);
});

test("AC2 clause 2: no comments inside a function body; short warning at the function head", () => {
  assert.match(FLAT, /Avoid comments inside a function body/);
  assert.match(FLAT, /short warning about something non-obvious/);
  assert.match(FLAT, /at the head of the function/);
});

test("AC2 clause 3: long rationale lives in a tracked spec/design file or commit message, one-line pointer", () => {
  assert.match(FLAT, /Long rationale lives in a tracked spec\/design file or the commit message/);
  assert.match(FLAT, /at most a one-line pointer/);
});

test("AC2 clause 4: doc comment opens with a one-sentence summary of at most 80 columns, then caller needs only", () => {
  assert.match(FLAT, /Doc comments open with a one-sentence summary of at most 80 columns/);
  for (const w of ["params", "return", "constraints", "pitfalls"]) {
    assert.ok(FLAT.includes(w), `caller-needs list must mention ${w}`);
  }
});

test("AC2 clause 5: a ## heading inside a comment marks a pasted spec and is sent back", () => {
  assert.match(FLAT, /`##` heading inside a comment marks a pasted spec and is sent back/);
});

// Modes per constitution-manifest: lite and chain, each design-armed and not. "teamwork"
// uses the chain + design-armed constitution (buildPromptForRole with the coordinator skill).
const MODES = [
  ["lite non-design", { chain: false, design: false }],
  ["lite design-armed", { chain: false, design: true }],
  ["chain non-design", { chain: true, design: false }],
  ["chain design-armed (teamwork)", { chain: true, design: true }],
];
for (const [name, opts] of MODES) {
  test(`AC3: bullet text appears in composed constitution — ${name}`, () => {
    const composed = composeConstitution(opts).replace(/\s+/g, " ");
    assert.ok(composed.includes(FLAT), `${name}: full bullet text must be present verbatim`);
    assert.ok(composed.includes(LEAD), `${name}: lead phrase must be present`);
  });
}

test("AC3: teamwork prompt (buildPromptForRole coordinator) carries the bullet", async () => {
  const { buildPromptForRole } = await import(path.join(ROOT, "dist", "prompts", "build.js"));
  const os = await import("node:os");
  const ws = fs.mkdtempSync(path.join(os.tmpdir(), "e258a-tw-"));
  try {
    const { setActiveStorage, FileHandoffStorage } = await import(path.join(ROOT, "dist", "tools", "storage.js"));
    setActiveStorage(new FileHandoffStorage());
    await new FileHandoffStorage().writeState(ws, "e258a-feat", "In_Progress", [], []);
    const text = buildPromptForRole("skill-coordinator.md", "e258a-check", ws, false).messages[0].content.text;
    assert.ok(text.replace(/\s+/g, " ").includes(FLAT), "teamwork prompt must include the bullet");
  } finally {
    fs.rmSync(ws, { recursive: true, force: true });
  }
});

test("AC4: bullet carries no governance jargon, ticket id or untracked path", () => {
  for (const tok of ["tw_", "gate", "PASS", "E258", "T-E", "qa_reports", ".current", "review_reports"]) {
    assert.ok(!BULLET.includes(tok), `bullet must not contain '${tok}'`);
  }
  assert.ok(!/\bAC\d/.test(BULLET), "bullet must not cite a bare AC id");
});

test("AC5: reviewer prefix string is byte-exact (em dash U+2014, single spaces)", () => {
  const exact = Buffer.from("agc check — comments", "utf-8");
  assert.deepEqual([...exact.subarray(10, 13)], [0xe2, 0x80, 0x94], "em dash bytes");
  assert.ok(Buffer.from(REVIEWER, "utf-8").includes(exact), "reviewer SOP must carry the byte-exact prefix");
  for (const bad of ["agc check - comments", "agc check – comments", "agc check  — comments", "agc check —  comments"]) {
    assert.ok(!REVIEWER.includes(bad), `reviewer SOP must not carry a near-miss variant: ${JSON.stringify(bad)}`);
  }
});

test("AC5: reviewer check applies the bullet to every added comment; warnings kept with reason or trimmed", () => {
  const line = REVIEWER.split("\n").find((l) => l.includes("agc check — comments"));
  assert.ok(line, "reviewer check line must exist");
  assert.match(line, /Comment discipline/);
  assert.match(line, /every comment the diff adds/);
  assert.match(line, /kept with a one-line reason in the review report/);
  assert.match(line, /sent back to be trimmed/);
});

test("boundary: bullet is a single bounded paragraph (<= 6 lines)", () => {
  const n = BULLET.split("\n").length;
  assert.ok(n >= 1 && n <= 6, `bullet has ${n} lines; Copy/Strings target is at most 6`);
});

test("boundary: bullet and reviewer line contain no control or non-printable characters", () => {
  const line = REVIEWER.split("\n").find((l) => l.includes("agc check — comments")) ?? "";
  assert.ok(!/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(BULLET + line));
});
