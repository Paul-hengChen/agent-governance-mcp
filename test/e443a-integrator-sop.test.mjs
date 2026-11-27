// Coded by @qa-engineer
// Tests (T-E443A-01) for specs/e443a-manifest-waves.md A1-8: the integrator SOP text for the wave columns and the
// wave-table comparison (content/skill-integrator.md, Stage 1 step 6 and the Stage 2 exception line).
// WHY: the SOP is the only place an integrator learns to fill `波次` / `相依` from the approved wave table and that a
// passing `fanout.mjs waves` comparison — and only a passing one — lets Stage 2 dispatch without the human stop.
// The file ships to every adopter, so the added text may name no repo-only path, no bare ticket id and no new
// backtick-quoted error code; other tests pin the file's line numbers, so both strings sit on existing lines.
// Section-scoped content assertions against the spec's verbatim Copy blocks; no sha, no fixed line number.

import { test } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SOP = fs.readFileSync(path.join(ROOT, "content", "skill-integrator.md"), "utf8");
const count = (text, needle) => text.split(needle).length - 1;

// Copy / Strings, verbatim (each block is exactly one line).
const SOP_STAGE1_WAVES =
  "**Wave and dependency columns**: when the tickets come with an approved wave table (`| wave | ticket | depends on |`), add the optional `波次` column to the Lanes table, right after `相依`, and fill both columns from that table. `波次` is the lane's wave, a positive integer; a lane holding tickets of several waves takes the latest of them. `相依` is `無` or the comma-separated names of the lanes whose tickets this lane's tickets depend on, each in the same or an earlier wave; a dependency between two tickets of one lane is kept by listing the depended-on ticket first in the `票` cell. Notes go in `範圍切線`, never in `相依`: while the `波次` column is present, `validate` refuses any other `相依` value.";
const SOP_STAGE2_WAVES =
  "**Wave table approved in `spec-workshop`** — a stated exception to Constitution §3.1's rule that only a directly witnessed approval counts. When the manifest was built from a committed `spec-workshop` wave table and carries the `波次` column, run `node <agc install>/scripts/fanout.mjs waves <manifest> <wave-table file>`. It compares the manifest with the approved wave table and the lanes' ticket files, and passes only when the manifest holds exactly the approved tickets, each in one lane; keeps every approved dependency (it may add dependencies: a later wave, an extra `相依` entry, or two tickets in one lane with the depended-on one listed first); and every owned path of a lane is inside its tickets' allowed paths. On a pass (exit 0), Stage 2 does not halt: write two Decisions rows, `人類` (`出處` = the wave-table file and its commit sha) and `整合者`, whose `內容` is the reason line the command printed, starting `自動：只改順序或分組 — `; list that `整合者` row in your final report next to the batch summary. On a failure (non-zero exit), on a manifest without the `波次` column, or with any open choice, halt here as above and name each condition the command reported.";

// The Stage 2 line's text before the exception (unchanged), and the exception text this ticket replaces.
const STAGE2_PREFIX =
  "Present the manifest as tables and **name every re-assignment and split**. Without the human's explicit yes in this session, do not enter stage 3. At this stage the human names every lane whose cut they still want to see in that lane's session (architect-hop lanes are the expected case); write `human` in the Lanes table's optional `approval` column for exactly those lanes, only on the human's instruction. Any other lane, in a workspace with `cutApprovalAutoTier.manifest: true`, may auto-approve its cut under Constitution §3.1 once your cut pre-review has closed. When Stage 0 ran, present the cut file with the manifest; one approval covers both. ";
const OLD_STAGE2_EXCEPTION =
  "**Wave table approved in `spec-workshop`** — a stated exception to Constitution §3.1's rule that only a directly witnessed approval counts: when the manifest was converted from a committed `spec-workshop` wave table and the conversion changes none of the approved tickets, their grouping or their order, and leaves no open choice, Stage 2 does not halt. Write two Decisions rows: `人類` (`出處` = the wave-table file and its commit sha) and `整合者` (the conversion changed nothing). Any change to the approved tickets, their grouping or their order, or any open choice, halts here as above.";
// Stage 1 step 6's existing last sentence (the sister-repo copy, test/e292-integrator-sop.test.mjs).
const STAGE1_EXT =
  "When the wave depends on work in a repo declared in `sisterRepos`, add the optional `## 外部依賴` table (`repo | 票 | branch | sha | 協定出處`, `repo` = the `sisterRepos` name): `validate` checks its format, and `handoff --check` compares each recorded sha with that branch now.";

/** Lines from the heading up to the next `## ` heading. */
function h2(heading) {
  const out = [];
  let on = false;
  for (const l of SOP.split("\n")) {
    if (!on && l.startsWith(heading)) {
      on = true;
      continue;
    }
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
/** The file with this ticket's two strings taken back out (the text before this ticket, for these two lines). */
const reverted = () => SOP.replace(" " + SOP_STAGE1_WAVES, () => "").replace(SOP_STAGE2_WAVES, () => OLD_STAGE2_EXCEPTION);
const backtickCodes = (text) => new Set(text.match(/`[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+`/g) ?? []);

test("A1-8: integrator SOP carries SOP_STAGE1_WAVES on Stage 1 step 6 and SOP_STAGE2_WAVES in place of the old Stage 2 exception", () => {
  // Stage 1 step 6 ends with the new copy, one space after the existing sister-repo sentence, on the same line.
  assert.equal(count(SOP, SOP_STAGE1_WAVES), 1, "SOP_STAGE1_WAVES occurs exactly once");
  const step6 = lineStarting(h2("## Stage 1"), "6. **Write the manifest**");
  assert.ok(step6.endsWith(STAGE1_EXT + " " + SOP_STAGE1_WAVES), "step 6 ends with the sister-repo sentence, one space, SOP_STAGE1_WAVES");

  // Stage 2: the earlier sentences unchanged, then SOP_STAGE2_WAVES to the end of the line.
  assert.equal(count(SOP, SOP_STAGE2_WAVES), 1, "SOP_STAGE2_WAVES occurs exactly once");
  const stage2 = lineStarting(h2("## Stage 2"), "Present the manifest as tables");
  assert.equal(stage2, STAGE2_PREFIX + SOP_STAGE2_WAVES);
  assert.equal(count(SOP, "the conversion changed nothing"), 0, "old 整合者 row wording gone");
  assert.equal(count(SOP, "converted from a committed"), 0, "old conversion wording gone");

  // What the rule says: a pass dispatches without a stop and records an 整合者 row; a failure halts.
  assert.ok(SOP_STAGE2_WAVES.includes("On a pass (exit 0), Stage 2 does not halt"));
  assert.ok(SOP_STAGE2_WAVES.includes("`整合者`, whose `內容` is the reason line the command printed, starting `自動：只改順序或分組 — `"));
  assert.ok(SOP_STAGE2_WAVES.includes("On a failure (non-zero exit), on a manifest without the `波次` column, or with any open choice, halt here as above"));

  // Adopter safety: no new backtick-quoted error code; no repo-only path; no bare ticket id.
  assert.deepEqual([...backtickCodes(SOP)].sort(), [...backtickCodes(reverted())].sort(), "the set of backtick-quoted codes is unchanged");
  for (const [id, text] of [["SOP_STAGE1_WAVES", SOP_STAGE1_WAVES], ["SOP_STAGE2_WAVES", SOP_STAGE2_WAVES]]) {
    assert.equal(backtickCodes(text).size, 0, `${id}: no backtick-quoted error code`);
    const noInstall = text.replace(/<agc install>\/[^\s`]+/g, "");
    assert.ok(!noInstall.includes("/"), `${id}: no path outside <agc install>/…`);
    assert.doesNotMatch(text, /\.current\b|\bspecs\b|\bqa_reports\b|\bdist\b|\bdocs\b|\btest\b\//, `${id}: no repo-only location`);
    assert.doesNotMatch(text, /\b[A-Z]{1,4}-?\d{2,}(?:-\d+)?\b/, `${id}: no bare ticket id`);
    assert.ok(!text.includes("\n"), `${id}: a single line`);
  }

  // Line count unchanged: both strings sit on existing lines, so taking them out leaves the same number of lines.
  assert.equal(SOP.split("\n").length, reverted().split("\n").length, "the file's line count is unchanged");
});
