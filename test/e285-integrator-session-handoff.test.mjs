// Coded by @qa-engineer
// Tests for specs/e285-integrator-session-handoff.md, E285 half (AC-E285-1 ... AC-E285-7).
// WHY: the integrator SOP needs a session rhythm so a long wave does not live in one ever-growing
// session: the close handoff is always written (it is the take-over source), the final report never
// proposes the next wave, a fresh session can take over via `接手 <manifest>` only when the handoff
// still matches the repo, an idle watch stops after two hours, every local full suite runs in the
// verifier, and the human is advised when the session already holds another role's work.
// Section-scoped content assertions only: no line numbers, no historical sha, and no assertion on the
// content of real `specs/fanout-*.md` files.

import { test } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SOP = fs.readFileSync(path.join(ROOT, "content", "skill-integrator.md"), "utf-8");
const FANOUT = fs.readFileSync(path.join(ROOT, "scripts", "fanout.mjs"), "utf-8");

// Heading line up to the next heading of any level (the spec's `sec`).
function sec(heading) {
  const out = [];
  let on = false;
  for (const l of SOP.split("\n")) {
    if (!on && l.startsWith(heading)) { on = true; out.push(l); continue; }
    if (on && /^##/.test(l)) break;
    if (on) out.push(l);
  }
  assert.ok(out.length > 0, `heading not found: ${heading}`);
  return out.join("\n");
}
function need(heading, ...phrases) {
  const s = sec(heading);
  for (const p of phrases) assert.ok(s.includes(p), `${heading} must mention: ${p}`);
}
const count = (text, needle) => text.split(needle).length - 1;

test("AC-E285-1: Stage 6 writes the close handoff at every wave close, non-overridable", () => {
  need("## Stage 6", "handoff <manifest> --closing", "待人類決定", "not overridable");
  const s = sec("## Stage 6");
  assert.ok(s.indexOf("**Close the manifest**") > -1 && s.indexOf("**Close the manifest**") < s.indexOf("**Write the handoff**"),
    "the handoff sub-bullet comes after the Close the manifest sub-bullet");
});

test("AC-E285-2: final report drops 'next-step recommendation', never proposes the next wave, supports continue", () => {
  assert.equal(count(SOP, "next-step recommendation"), 0);
  need("## Stage 6", "new session", "handoff --check <manifest>", "never proposes the next wave", "continue");
});

test("AC-E285-3: four modes in Invocation, Take-over section placed directly before Status, Work overview row", () => {
  need("## Lifecycle", "`fan-out <feature or wave>` (stages 0–3)", "`fan-in` (stages 4–6)", "`status` (read-only)", "`接手 <manifest>`");
  assert.ok(count(SOP, "`接手 <manifest>`") >= 3, "mode named in Invocation, Work overview row and the section heading");
  need("## Take-over", "## 接手步驟", "Decisions", "handoff --check <manifest>", "MOVED", "DIFF", "watch baseline", "stop");
  const headings = SOP.split("\n").filter((l) => l.startsWith("## "));
  const i = headings.findIndex((h) => h.startsWith("## Take-over"));
  assert.ok(i > -1 && headings[i + 1] === "## Status (any time)", "Take-over is directly before Status (any time)");
  assert.ok(sec("## Work overview").includes("`接手 <manifest>`"), "Work overview has a row for the mode");
});

test("AC-E285-3: Take-over steps appear in order and a mismatch never edits the handoff", () => {
  const s = sec("## Take-over");
  const order = ["Read the manifest's `## 接手步驟`", "handoff --check <manifest>", "list every mismatching fact and stop", "re-arm the mailbox watch"];
  let at = -1;
  for (const p of order) {
    const j = s.indexOf(p);
    assert.ok(j > at, `Take-over step out of order or missing: ${p}`);
    at = j;
  }
  assert.ok(s.includes("never edit the handoff to make it match"));
});

test("AC-E285-4: Stage 4 two-hour idle stop writes the watch-stop handoff and keeps the pinned re-arm sentence", () => {
  need("## Stage 4", "2 hours", "expiring — re-arm", "lane-status.mjs --watch", "handoff <manifest>", "watch baseline", "without needing the human");
  assert.equal(count(SOP, "re-arm from the printed baseline, always"), 1);
});

test("AC-E285-5: every local full suite runs in the verifier; repeated tables shown as differences", () => {
  need("### 5a", "MUST", "pre-push", "never in your own context");
  need("## Output", "differences");
  assert.ok(SOP.trimEnd().endsWith("(no tier: an MCP-prompt invocation is not Task-spawned, Constitution §1)."), "file still ends with the watermark bullet");
  const out = sec("## Output");
  assert.ok(out.indexOf("differences") < out.indexOf("End every reply with the watermark"), "differences bullet sits above the watermark bullet");
});

test("AC-E285-6: Lifecycle advises a new session when the conversation already holds another role's work", () => {
  need("## Lifecycle", "another role's work", "new session", "advisory");
});

test("AC-E285-7: every fanout.mjs handoff mention matches the shipped usage; --closing never with --check", () => {
  const allowed = new Set([
    "fanout.mjs handoff <manifest>",
    "fanout.mjs handoff <manifest> --closing",
    "fanout.mjs handoff --check <manifest>",
  ]);
  const mentions = [...SOP.matchAll(/fanout\.mjs handoff[^`]*/g)].map((m) => m[0].trimEnd());
  assert.ok(mentions.length > 0);
  for (const m of mentions) {
    assert.ok(allowed.has(m), `unexpected handoff command shape: ${m}`);
    assert.ok(!(m.includes("--closing") && m.includes("--check")), `--closing must not appear with --check: ${m}`);
  }
  assert.ok(FANOUT.includes("handoff [--check] <manifest>"), "scripts/fanout.mjs usage still lists the handoff shape");
  assert.ok(FANOUT.includes("--closing"), "scripts/fanout.mjs usage lists --closing");
});

// --- E344 (specs/e292-sister-repos.md AC-E344-1, AC-E344-2) ---------------------------------------------------
// WHY: the idle-stop resume must tell the integrator to simply restart the `lane-status.mjs --watch` (it has no
// baseline in the handoff, so "re-arm from the baseline" cannot apply to it), and the close-handoff timing must
// not claim the manifest is primary's only uncommitted change (false whenever primary holds its usual `.current/`
// working files); the sentence names the bookkeeping edits that must not be uncommitted, and why.

const IDLE_RESUME =
  "Resuming — the human says so in this session, or a `接手 <manifest>` session takes over — re-arms the mailbox watch from that section's `watch baseline` line, never the current count, and simply restarts `node scripts/lane-status.mjs --watch` with the same options (it has no baseline in the handoff).";
const HANDOFF_TIMING =
  "Run it after the last lane's finish while none of the other bookkeeping edits (queue entries, backlog rows and done-marks, the plan document) is uncommitted — before making them, or after committing them: the tool records every uncommitted path except the manifest in its `git status` fact and marks the primary `lane-status` row `dirty`, so a bookkeeping edit left uncommitted then is gone from both facts once the pull request merges, and a later `handoff --check <manifest>` (step 7 continue, *Take-over*) reports both as `DIFF` and stops; a file that stays uncommitted across the merge, such as primary's own `.current/` working files, leaves both facts unchanged.";

test("AC-E344-1: the Two-hour idle stop sub-bullet ends with sop.idle-resume, exactly once inside Stage 4", () => {
  assert.equal(count(sec("## Stage 4"), IDLE_RESUME), 1);
  assert.equal(count(SOP, IDLE_RESUME), 1);
  const bullet = sec("## Stage 4").split("\n").filter((l) => l.includes("**Two-hour idle stop**"));
  assert.equal(bullet.length, 1);
  assert.ok(bullet[0].endsWith(IDLE_RESUME), "the copy is the sub-bullet's last sentence");
  assert.equal(count(SOP, "re-arm from the printed baseline, always"), 1, "the AC-E285-4 pinned sentence is untouched");
});

test("AC-E344-2: the Stage 6 Write-the-handoff sub-bullet holds sop.handoff-timing once; the old claim is gone", () => {
  const bullet = sec("## Stage 6").split("\n").filter((l) => l.includes("**Write the handoff**"));
  assert.equal(bullet.length, 1);
  assert.equal(count(bullet[0], HANDOFF_TIMING), 1);
  assert.equal(count(SOP, HANDOFF_TIMING), 1);
  assert.equal(count(SOP, "primary's only uncommitted change"), 0);
  assert.ok(bullet[0].endsWith("This step is not overridable: it runs even when the human asks to skip it or to go straight to the next wave."));
});
