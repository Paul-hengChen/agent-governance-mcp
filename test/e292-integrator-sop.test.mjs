// Coded by @qa-engineer
// Tests (T-E292-04) for specs/e292-sister-repos.md AC-E292-9: the integrator SOP's six new copy literals
// (two-layer lane-rules wording from the E290 knock-on, and the sister-repo wording) each occur exactly once, inside
// the section the spec's copy table names, and the replaced wordings are gone. WHY: the SOP is the only place an
// integrator learns that shared lane rules live in two layers and that `sisterRepos` / `## 外部依賴` exist; a literal
// in the wrong section or a stale old sentence left beside the new one gives a contradictory instruction.
// Section-scoped content assertions only: no line numbers, no sha, no assertion on real specs/fanout-*.md.

import { test } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SOP = fs.readFileSync(path.join(ROOT, "content", "skill-integrator.md"), "utf-8");
const count = (text, needle) => text.split(needle).length - 1;

/** Lines from the heading up to the next `## ` heading (a `###` stays inside). */
function h2(heading) {
  const out = [];
  let on = false;
  for (const l of SOP.split("\n")) {
    if (!on && l.startsWith(heading)) { on = true; out.push(l); continue; }
    if (on && l.startsWith("## ")) break;
    if (on) out.push(l);
  }
  assert.ok(out.length > 0, `heading not found: ${heading}`);
  return out;
}
const lineStarting = (lines, prefix) => {
  const hits = lines.filter((l) => l.startsWith(prefix));
  assert.equal(hits.length, 1, `exactly one line starts ${prefix}`);
  return hits[0];
};

// Copy literals, verbatim from the spec's Copy / Strings table (outer code span removed).
const COPY = {
  premises:
    "for every instruction the prompt and the lane rules it points at give (agc's generic `docs/lane-protocol.md`, plus the repo addendum named by `laneProtocolAddendum` in `.current/.config.json` when that key is set), confirm by command against the repo's current state",
  renderLayers:
    "Shared rules live in two layers only — agc's generic `docs/lane-protocol.md` and, when `laneProtocolAddendum` is set in `.current/.config.json`, the repo addendum it names (`render` points the lane at both); the prompt carries lane-specific fields only.",
  stage4Layers:
    "Message format, lane-side rules and the report format: `docs/lane-protocol.md` §5 and §6 — the only copy; a repo's own lane rules live in the addendum named by `laneProtocolAddendum`.",
  statusSister:
    "When `.current/.config.json` declares `sisterRepos`, also read each sister repo, read-only: `node scripts/lane-status.mjs --repo <path>` for its in-flight lanes and their branches, and `git -C <path> rev-parse --short <branch>` for each branch's sha (`<path>` resolved against primary).",
  takeoverSister:
    "When `sisterRepos` is declared, also read each sister repo as in *Status* before acting; step 2 already compared every sha in the manifest's `## 外部依賴` section.",
  stage1Ext:
    "When the wave depends on work in a repo declared in `sisterRepos`, add the optional `## 外部依賴` table (`repo | 票 | branch | sha | 協定出處`, `repo` = the `sisterRepos` name): `validate` checks its format, and `handoff --check` compares each recorded sha with that branch now.",
};

test("AC-E292-9 every new copy literal occurs exactly once in the whole file", () => {
  for (const [id, text] of Object.entries(COPY)) assert.equal(count(SOP, text), 1, `${id} occurs exactly once`);
});

test("AC-E292-9 sop.premises sits in Stage 3 check 1, the rest of the line unchanged", () => {
  const line = lineStarting(h2("## Stage 3"), "1. **Premises**");
  assert.ok(line.includes(COPY.premises));
  assert.ok(line.includes(' — "X is untracked" → `git ls-files X`; "use tool Y" → it exists at the dispatch base; every owned / forbidden path exists or is marked new.'));
  assert.ok(line.startsWith("1. **Premises** (the §8b standing check applied to the prompt itself): "));
});

test("AC-E292-9 sop.render-layers sits in Stage 3 Render", () => {
  const line = lineStarting(h2("## Stage 3"), "**Render**");
  assert.ok(line.includes(COPY.renderLayers));
  assert.ok(line.includes("the single copy inside that tool (`PROMPT_TEMPLATE_3B`)"));
});

test("AC-E292-9 sop.stage4-layers is the first paragraph of Stage 4 and the `Send with` sentence follows", () => {
  const body = h2("## Stage 4").slice(1);
  const first = body.find((l) => l.trim() !== "");
  assert.ok(first.startsWith(COPY.stage4Layers + " Send with `node scripts/mailbox-watch.mjs <to-lane.md> --send"), first);
  assert.ok(first.includes("the only copy"), "keeps `the only copy` (e178a file check)");
});

test("AC-E292-9 sop.status-sister sits in Status, right after its first sentence", () => {
  const status = h2("## Status (any time)").join("\n");
  assert.equal(count(status, COPY.statusSister), 1);
  const at = status.indexOf(COPY.statusSister);
  assert.ok(status.slice(0, at).includes("Read-only: `node scripts/lane-status.mjs`"));
  assert.ok(status.slice(at + COPY.statusSister.length).startsWith(" **Check before answering; never infer progress from the conversation.**"));
});

test("AC-E292-9 sop.takeover-sister is appended to Take-over step 4", () => {
  const line = lineStarting(h2("## Take-over"), "4. Only on exit 0");
  assert.ok(line.endsWith(COPY.takeoverSister), "step 4 ends with the copy");
  assert.ok(line.includes("re-arm the mailbox watch from the handoff's `watch baseline` line"));
});

test("AC-E292-9 sop.stage1-ext is appended to Stage 1 step 6", () => {
  const line = lineStarting(h2("## Stage 1"), "6. **Write the manifest**");
  assert.ok(line.endsWith(COPY.stage1Ext), "step 6 ends with the copy");
});

test("AC-E292-9 the replaced wordings occur zero times", () => {
  assert.equal(count(SOP, "the prompt and `docs/lane-protocol.md` give"), 0);
  assert.equal(count(SOP, "Shared rules live only in `docs/lane-protocol.md`;"), 0);
  assert.equal(count(SOP, "`docs/lane-protocol.md` §5 and §6 — the only copy. "), 0, "old Stage 4 sentence (period right after 'copy')");
});

test("AC-E292-9 e178a AC10 is re-pinned to the new Stage 4 copy and the old sentence is gone from it", () => {
  const e178a = fs.readFileSync(path.join(ROOT, "test", "e178a-integrator-role.test.mjs"), "utf-8");
  assert.ok(e178a.includes(COPY.stage4Layers), "e178a pins sop.stage4-layers");
  assert.ok(!e178a.includes("`docs/lane-protocol.md` §5 and §6 — the only copy. Send with"), "old sentence not pinned any more");
});

test("AC-E292-9 the new wording names only the shipped key, never a file of the sister lane", () => {
  // WHY: manifest D8 / G13 — no dependency on e290's addendum file contents.
  for (const text of Object.values(COPY)) assert.ok(!text.includes("lane-protocol-addendum"));
});
