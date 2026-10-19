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
