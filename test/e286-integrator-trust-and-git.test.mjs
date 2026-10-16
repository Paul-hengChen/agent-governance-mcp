// Coded by @qa-engineer
// Tests (T-E286-03) for specs/e286-integrator-trust-and-git.md AC1-AC9: the integrator SOP's mid-wave base fix
// (five ordered conditions, stop rule, decision-rights row, merge-tree read-only ruling), the O10 lane-session
// approval test, the O4 deciders sentence, the O5 own-manifest watch, and the lane-side pause rule in
// docs/lane-protocol.md section 7 (with the E282 merge-base scope sentence).
// Assertions are section-scoped content pins: a section runs from its heading line to the next heading of any
// level (the spec's own sec() helper). No line numbers, no historical sha, no real specs/fanout-*.md content.
// AC4 / AC10 (base-sha diff, owned-test pass) are verified as evidence, not resident assertions.

import { test } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), "utf8");
const SOP = read("content/skill-integrator.md");
const LANE = read("docs/lane-protocol.md");

/** Mirror of the spec's sec(): heading line through the line before the next heading of any level. */
function sec(heading, text) {
  const lines = text.split("\n");
  const start = lines.findIndex((l) => l.startsWith(heading));
  assert.ok(start >= 0, `heading not found: ${heading}`);
  const out = [lines[start]];
  for (let i = start + 1; i < lines.length; i++) {
    if (/^#{2,}/.test(lines[i])) break;
    out.push(lines[i]);
  }
  return out.join("\n");
}
const lineIdx = (text, prefix) => text.split("\n").findIndex((l) => l.startsWith(prefix));
const need = (s, needles, label) => {
  for (const n of needles) assert.ok(s.includes(n), `${label}: missing ${JSON.stringify(n)}`);
};
const countLines = (s, needle) => s.split("\n").filter((l) => l.includes(needle)).length;

const BASEFIX = sec("### Mid-wave base fix", SOP);

test("AC1: base-fix subsection sits inside Stage 4, before Stage 5, after the bullet list", () => {
  const h = lineIdx(SOP, "### Mid-wave base fix");
  assert.equal(SOP.split("\n").filter((l) => l.startsWith("### Mid-wave base fix")).length, 1);
  assert.ok(h > lineIdx(SOP, "## Stage 4"), "after ## Stage 4");
  assert.ok(h < lineIdx(SOP, "## Stage 5"), "before ## Stage 5");
  assert.ok(h > lineIdx(SOP, "- **Watch**"), "after the Stage 4 bullets");
  assert.ok(h > lineIdx(SOP, "- Cross-lane notices"), "after the last Stage 4 bullet");
});

test("AC1: human owns the vehicle decision; five conditions are an ordered numbered list with their commands", () => {
  need(BASEFIX, [
    "insertion lane", "human's decision", "one lane at a time",
    "merge-base --is-ancestor", "fanout.mjs check", "status --porcelain",
    "git merge-tree --write-tree", "2.38", "merge --abort", "merge --no-ff origin/<target>",
    "merge-invariants.mjs", "npm audit --audit-level=high", "Decisions",
    "git diff --name-only <lane branch>...origin/<target>", "擁有",
  ], "base-fix");
  const lines = BASEFIX.split("\n");
  const pos = [1, 2, 3, 4, 5].map((n) => lines.findIndex((l) => l.startsWith(`${n}. `)));
  assert.ok(pos.every((p) => p >= 0), "conditions 1-5 present as numbered items");
  assert.deepEqual([...pos].sort((a, b) => a - b), pos, "conditions appear in order 1..5");
  const item = (n) => lines[pos[n - 1]];
  assert.match(item(1), /merge-base --is-ancestor/);
  assert.match(item(2), /git diff --name-only/);
  assert.match(item(2), /fanout\.mjs check/);
  assert.match(item(3), /status --porcelain/);
  assert.match(item(3), /acked sha/);
  assert.match(item(4), /merge-tree --write-tree/);
  assert.match(item(4), /2\.38/);
  assert.match(item(4), /merge --abort/);
  assert.match(item(5), /merge --no-ff origin\/<target>/);
  assert.match(item(5), /merge-invariants\.mjs/);
  assert.match(item(5), /npm run build/);
  assert.match(item(5), /npm audit --audit-level=high/);
});

test("AC2: conditions 2 and 4 failing means stop and hand to the human, never merge", () => {
  assert.ok(countLines(BASEFIX, "needs human ruling") >= 1);
  const stop = BASEFIX.split("\n").find((l) => /Condition 2 or 4/.test(l));
  assert.ok(stop, "stop-rule sentence present");
  need(stop, ["stop", "never merge"], "stop rule");
});

test("AC2: Decision rights gains the base-fix row; the pinned rows and header are kept", () => {
  const dr = sec("## Decision rights", SOP);
  assert.equal(countLines(dr, "insertion lane"), 1);
  const row = dr.split("\n").find((l) => l.includes("insertion lane"));
  const cells = row.split("|").map((c) => c.trim()).filter((c, i, a) => i > 0 && i < a.length);
  assert.match(cells[0], /base-fix merge into a lane/);
  assert.match(cells[0], /all five/);
  assert.match(cells[1], /opening an insertion lane/);
  assert.match(cells[1], /condition 2 or 4 failing/);
  need(dr, [
    "| integrator decides alone | always the human |",
    "| accepting a mechanical out-of-bounds edit | cut approval |",
    "| post-milestone queue placement of a new ticket | policy rulings |",
    "| folding a finding into an existing row | whether a new ticket enters the current milestone |",
    "| sending a lane back | relaxing a definition of done |",
    "| | any git operation outside this role's §6 grant |",
  ], "decision rights");
});

test("AC3: Git operations names the base-fix merge and rules merge-tree read-only under section 6", () => {
  const g = sec("## Git operations", SOP);
  assert.ok(g.includes("Mid-wave base fix"));
  assert.ok(g.includes("merge --no-ff origin/<target>"));
  assert.ok(countLines(g, "merge-tree --write-tree") >= 1);
  assert.ok(g.split("\n").some((l) => /merge-tree --write-tree.*read-only|read-only.*merge-tree --write-tree/.test(l)));
  need(g, ["unreferenced objects", "no grant entry"], "git operations");
});

test("AC5: lane-protocol section 7 is the last section and carries the pause / ack / resume rule", () => {
  const h = "## 7. 中途修 base（整合者把目標分支 merge 進 lane）";
  const heads = LANE.split("\n").filter((l) => /^## /.test(l));
  assert.equal(heads[heads.length - 1], h, "section 7 is the last ## section");
  assert.equal(LANE.split("\n").filter((l) => l.startsWith(h)).length, 1);
  const s7 = sec("## 7. 中途修 base", LANE);
  need(s7, [
    "type: proposal", "base-fix", "type: ack", "HEAD sha", "type: close", "git stash",
    "status --porcelain", "rev-parse HEAD", "tw_*", "§5 規則 3", "§5 規則 6", "30 分鐘",
    "§3", "dist/",
  ], "lane section 7");
  assert.match(s7, /不開新的/);
  assert.match(s7, /不自己 merge/);
  assert.match(s7, /不改檔、不 commit/);
});

test("AC6: section 7 carries the E282 merge-base scope sentence", () => {
  const s7 = sec("## 7. 中途修 base", LANE);
  need(s7, ["merge-base", "...HEAD", "註解 proof", "每一行改動都是註解", "不對固定的派工 base sha 算"], "E282");
});

test("AC7: lane-session approval is recorded without re-asking only under the three-part test", () => {
  const s4 = SOP.slice(SOP.indexOf("## Stage 4"), SOP.indexOf("### Mid-wave base fix"));
  need(s4, ["lane session", "affects that lane alone", "commit sha"], "stage 4");
  const bullet = s4.split("\n").find((l) => l.includes("A human approval given in a lane session"));
  assert.ok(bullet, "O10 sub-bullet present");
  assert.match(bullet, /^ {2}- /, "it is a sub-bullet of the cut pre-review bullet");
  need(bullet, [
    "(a) it affects that lane alone", "(b) it is written in the cut the human approved",
    "(c) it is visible on the lane branch", "`裁決者` `人類`", "`出處`",
    "ask in this session", "The mailbox still never carries approval", "void",
  ], "O10");
  // Written-back-then-approved-in-lane is NOT re-asked: (a)-(c) apply again after the write-back.
  assert.match(bullet, /write it into its spec for the human to approve in the lane, after which \(a\)–\(c\) apply/);
  // The pinned sentence is unchanged.
  assert.ok(SOP.includes("The human approves each lane **once**, typed in that lane's own session. The mailbox never carries approval."));
});

test("AC8: the Decisions 裁決者 sentence names the two values and the 內容 escape", () => {
  const dr = sec("## Decision rights", SOP);
  const line = dr.split("\n").find((l) => l.includes("fanout.mjs validate"));
  assert.ok(line, "deciders sentence present");
  need(line, ["`裁決者`", "`人類`", "`整合者`", "`內容`", "never who executed"], "deciders");
  assert.ok(dr.indexOf(line) > dr.lastIndexOf("\n|"), "sentence is below the table");
});

test("AC9: mailbox watch names own-manifest lanes explicitly; other manifests via lane-status", () => {
  assert.equal(countLines(SOP, "_mailbox/*/"), 0, "no mailbox glob anywhere");
  const s3 = SOP.slice(SOP.indexOf("## Stage 3"), SOP.indexOf("## Stage 4"));
  const check3 = s3.split("\n").find((l) => l.startsWith("3. **Mailbox ready**"));
  assert.ok(check3, "Stage 3 check 3 present");
  need(check3, ["mailbox-watch.mjs", "to-integrator.md", "own manifest", "never a glob"], "stage 3 check 3");
  const s4 = SOP.slice(SOP.indexOf("## Stage 4"), SOP.indexOf("### Mid-wave base fix"));
  const watch = s4.split("\n").find((l) => l.startsWith("- **Watch**"));
  need(watch, [
    "own manifest", "no session id is recorded", "another manifest",
    "lane-status.mjs --lanes <lane>", "lane-status.mjs --watch --lanes",
  ], "watch bullet");
});
