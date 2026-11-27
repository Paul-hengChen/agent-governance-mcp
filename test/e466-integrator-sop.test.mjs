// Coded by @qa-engineer
// Test (T-E466-02) for docs/tickets/E466.md S8 (specs/e466-conductor.md, Build contract S8 and Copy / Strings
// integrator.relaunch).
// WHY: under a conductor the integrator is one session per wave, so it must (a) tell the conductor when its wave
// is done, at exactly the moment the repo's `waveDoneAt` names, or the conductor would close it too early or
// never; (b) under `pr-open`, carry the lanes that wait on the earlier wave's pull request itself — its wave is
// not done until they finish; and (c) stop treating "a usage limit resets" as its own launcher moment, because
// the conductor now owns every wake. The rules replace one sentence in place: the integrator SOP keeps its line
// count and every other line (other tests pin rows and the count), and it never calls the conductor script
// itself (it only reads the state file and writes the conductor mailbox).
// Served text: content/skill-integrator.md ships to adopters; the assertions require no bare ticket id and no
// repo-only path. Every title starts with its scenario id.

import { test } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (...p) => fs.readFileSync(path.join(ROOT, ...p), "utf-8");
const count = (hay, needle) => hay.split(needle).length - 1;
const BARE_TICKET_RE = /\bE\d{2,4}[a-z]?\b/;

// Copy / Strings integrator.relaunch, frozen verbatim from the cut into a fixture (one line).
const RELAUNCH = read("test", "fixtures", "e466", "integrator-relaunch.expected.md").replace(/\n$/, "");
// The sentence it replaces (as served before this ticket) and the text around it on the Lane launcher line.
const OLD_SENTENCE = "Re-run it at two moments: after each `波次`'s pull request has merged and local `main` is pulled (Stage 6 step 5), to start the next `波次`; and after a usage limit resets, to wake the paused lanes.";
const BEFORE = "or is paused. ";
const AFTER = " A wave it refuses stays hand-started: render and hand out the prompts as above.";
// FROZEN: content/skill-integrator.md line count at this lane's base (unowned tests pin it and rows within it).
const SOP_LINES = 269;

/** Lines of the `## <name>` section (heading included), up to the next `## ` heading. */
function section(lines, name) {
  const at = lines.findIndex((l) => l.startsWith(`## ${name}`));
  assert.ok(at >= 0, `section ## ${name} present`);
  const end = lines.findIndex((l, i) => i > at && l.startsWith("## "));
  return lines.slice(at, end < 0 ? lines.length : end);
}

test("S8: the integrator SOP reports wave-done to the conductor's mailbox at the waveDoneAt moment, carries pr-open waiting lanes itself, and no longer re-runs the launcher after a usage limit resets", () => {
  const sop = read("content", "skill-integrator.md");
  const lines = sop.split("\n");

  // In place: the Stage 3 Lane launcher text carries integrator.relaunch exactly where the old sentence was.
  assert.equal(count(sop, OLD_SENTENCE), 0, "the two-moments sentence is replaced");
  assert.equal(count(sop, RELAUNCH), 1, "integrator.relaunch occurs exactly once");
  const stage3 = section(lines, "Stage 3");
  const host = stage3.filter((l) => l.includes(RELAUNCH));
  assert.equal(host.length, 1, "integrator.relaunch sits on one Stage 3 line");
  assert.ok(host[0].includes("**Lane launcher**:"), "on the Lane launcher line");
  assert.ok(host[0].includes(BEFORE + RELAUNCH + AFTER), "between the launcher's polling sentence and the refused-wave sentence, one space each side");
  assert.equal(lines.length - (sop.endsWith("\n") ? 1 : 0), SOP_LINES, `the SOP stays ${SOP_LINES} lines (no line added or removed)`);
  assert.ok(!lines.some((l) => /^#{2,3} .*[Cc]onductor/.test(l)), "no new conductor heading");

  // Then 1: wave-done is reported to the conductor's mailbox at the moment waveDoneAt names.
  assert.ok(RELAUNCH.includes("At the moment `waveDoneAt` (`.current/.config.json`) names"), "the moment is the one waveDoneAt names");
  assert.ok(RELAUNCH.includes("the wave's pull request merged (`merged`, the default: after Stage 6 step 6) or opened (`pr-open`: after Stage 6 step 3)"), "merged → after Stage 6 step 6; pr-open → after Stage 6 step 3");
  assert.ok(RELAUNCH.includes("report wave-done to the conductor's mailbox: one `type: report`"), "reports wave-done to the conductor's mailbox");
  assert.ok(RELAUNCH.includes("mailbox-watch.mjs <mailbox>/to-lane.md --send --from integrator --type report --re \"wave-done <n>\""), "sent with mailbox-watch to the conductor mailbox's to-lane.md");
  assert.ok(RELAUNCH.includes("its first item reading `- 做了什麼：wave <n> of <manifest>, pull request #<number>`"), "the machine-read first item");
  assert.ok(RELAUNCH.includes("`agc-conductor.json` in the directory `git rev-parse --git-common-dir` prints exists, its `step` is not `done`"), "conductor detection from the state file");
  assert.ok(RELAUNCH.includes("after *Take-over* passes, run Stage 3 checks 1–3, then start wave `<n>` with the launcher"), "after a take-over: Stage 3 checks 1–3 before the launcher");

  // Then 2: under pr-open, watch the earlier wave's pull request, re-run the launcher when it merges, and the
  // integrator's own wave is not done until the waiting lanes finish.
  assert.ok(RELAUNCH.includes("Under `pr-open`, when your launcher run lists lanes waiting on the earlier wave's pull request, watch that pull request (`gh pr view <number> --json state`); when it merges, run Stage 6 steps 5–6 for it and re-run the launcher"), "pr-open: watch the earlier PR, re-run the launcher on merge");
  assert.ok(RELAUNCH.includes("your own wave is not done until those waiting lanes finish"), "pr-open: own wave not done until the waiting lanes finish");

  // Then 3: "after a usage limit resets" is no longer a launcher moment anywhere in the SOP.
  assert.equal(count(sop, "after a usage limit resets"), 0, "no 'after a usage limit resets' moment");
  assert.ok(!/usage limit resets, to wake the paused lanes/.test(sop), "the usage-limit re-run is gone");

  // The integrator never calls the conductor script.
  assert.equal(count(sop, "scripts/conductor.mjs"), 0, "the integrator SOP never writes node <agc install>/scripts/conductor.mjs");

  // Adopter safety of the served addition.
  assert.ok(!BARE_TICKET_RE.test(RELAUNCH), "no bare ticket id in integrator.relaunch");
});
