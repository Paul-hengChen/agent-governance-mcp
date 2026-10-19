// Coded by @qa-engineer: pins for specs/e226-integrator-sop-portable.md AC-E226-1..5 (T-E226-04).
// WHY: the integrator SOP is called in any workspace, so every agc tool call must be written against the
// agc install (`node <agc install>/scripts/<tool>.mjs`), never a repo-relative path, and every CI verdict
// must read "the repo's CI check" (verify-release.mjs finds its root from its own location and would check
// agc's own repo in an adopter). Content assertions only; no real specs/fanout-*.md and no fixed base sha.
// Creation of this file was pre-authorized in the E226 qa dispatch brief (Test-file placement).

import { test } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SOP = fs.readFileSync(path.join(ROOT, "content", "skill-integrator.md"), "utf-8");
const count = (text, needle) => text.split(needle).length - 1;
const lines = SOP.split("\n");
const line = (prefix) => {
  const hits = lines.filter((l) => l.startsWith(prefix));
  assert.equal(hits.length, 1, `exactly one line starts with ${JSON.stringify(prefix)}`);
  return hits[0];
};
const between = (startMarker, endMarker) => {
  const i = SOP.indexOf(startMarker);
  assert.ok(i >= 0, `missing ${startMarker}`);
  const j = SOP.indexOf(endMarker, i + startMarker.length);
  assert.ok(j > i, `missing ${endMarker} after ${startMarker}`);
  return SOP.slice(i, j);
};

const TOOL_CALLS =
  "**Tool calls**: agc's tools are written `node <agc install>/scripts/<tool>.mjs`, where `<agc install>` is the directory agc is installed in — agc's generic `docs/lane-protocol.md` is there too; `agc …` is `node <agc install>/bin/agc-init.mjs …` when `agc` is not on PATH. When `.current/.config.json` sets `laneProtocolAddendum`, the addendum it names gives the repo's own call forms, its shared generated artifacts, and its build, CI-check and bookkeeping-check commands; without one, use the generic forms. **The repo's CI check** on a sha must prove that the CI run for that sha is green; record its run id. Without an addendum command, read that sha's run with `gh` directly: `gh run list --commit <sha>`, then `gh run view <run id>`.";
const STAGE6_FINISH =
  "`agc feature finish <lane> --shipped --base integ/<feature>` (`agc` not on PATH: *Tool calls*).";
const EVIDENCE_CMD =
  "`git show <branch>:<evidence path>` — verdict line and task id match; under `artifacts: \"local\"` the evidence paths are excluded from the branch, so read `<worktree>/<evidence path>` instead";
const FINDINGS_CMD =
  "`git show <branch>:.current/<lane>/pending-tickets.md`; no block below `## Applied`; root `NEW-TICKETS.md` untouched; under `artifacts: \"local\"` read `<worktree>/.current/<lane>/pending-tickets.md` instead — it is never committed, so finish numbers none of it: hand-file each finding from the copy finish leaves under primary's `.current/history/<YYYY-MM>/<lane>/` (Stage 6 step 1)";

test("AC-E226-1: no repo-relative `node scripts/`; each called tool appears in the <agc install> form", () => {
  assert.equal(count(SOP, "node scripts/"), 0);
  for (const tool of ["fanout", "mailbox-watch", "lane-status", "merge-invariants", "test-lock"]) {
    assert.ok(count(SOP, `node <agc install>/scripts/${tool}.mjs`) >= 1, `${tool} in the install form`);
  }
});

test("AC-E226-2: exactly one Tool calls paragraph, verbatim, between the Invocation paragraph and the Governance state heading", () => {
  assert.equal(count(SOP, "**Tool calls**"), 1);
  const paras = SOP.split("\n\n");
  const inv = paras.findIndex((p) => p.startsWith("Invocation: the `integrator` MCP prompt."));
  assert.ok(inv >= 0, "Invocation paragraph present");
  assert.equal(paras[inv + 1], TOOL_CALLS, "Tool calls paragraph directly after Invocation, verbatim (sop.tool-calls)");
  assert.ok(paras[inv + 2].startsWith("## Governance state (D11)"), "Governance state heading directly after");
  // the facts the paragraph must carry, named so a future edit that drops one fails with a reason
  for (const f of ["node <agc install>/bin/agc-init.mjs", "laneProtocolAddendum", "use the generic forms", "gh run list --commit <sha>", "gh run view <run id>", "record its run id"]) {
    assert.ok(paras[inv + 1].includes(f), f);
  }
});

test("AC-E226-3: no `this repo` and no bare bin/agc-init.mjs; Stage 6 step 1 carries sop.stage6-finish", () => {
  assert.equal(count(SOP.toLowerCase(), "this repo"), 0);
  const withoutInstallForm = SOP.split("<agc install>/bin/agc-init.mjs").join("");
  assert.equal(count(withoutInstallForm, "bin/agc-init.mjs"), 0);
  const step1 = line("1. Per lane, on primary, on `integ/<feature>`, one after another:");
  assert.ok(step1.includes(STAGE6_FINISH), "sop.stage6-finish");
  assert.ok(step1.includes("*Tool calls*"));
  assert.equal(count(SOP, STAGE6_FINISH), 1);
});

test("AC-E226-4: 5a evidence and new-findings rows carry the artifacts-local reading and keep `send back`; Stage 6 findings bullet kept", () => {
  const rows = lines.filter((l) => l.startsWith("| evidence |") || l.startsWith("| new findings |"));
  assert.equal(rows.length, 2);
  const [ev, nf] = rows.map((r) => r.split(" | ").map((c) => c.replace(/ \|$/, "")));
  assert.equal(ev[0], "| evidence");
  assert.equal(ev[1], EVIDENCE_CMD, "sop.5a-evidence");
  assert.equal(ev[2], "send back");
  assert.equal(nf[0], "| new findings");
  assert.equal(nf[1], FINDINGS_CMD, "sop.5a-findings");
  assert.equal(nf[2], "send back");
  // The Stage 6 bullet is pinned in full by test/e329 (STAGE6_FINDINGS); here: present once and untouched by the call-form change.
  const bullets = lines.filter((l) => l.includes("**Findings finish did not number**"));
  assert.equal(bullets.length, 1);
  assert.ok(bullets[0].startsWith("   - **Findings finish did not number**: finish lists on stderr each `target_repo` finding"));
  assert.ok(!bullets[0].includes("<agc install>"));
  assert.ok(!bullets[0].includes("artifacts:"));
});

test("AC-E226-5: no verify-release; six CI-verdict sites say the repo's CI check; step 4 order and count; test-claim cell keeps the run id", () => {
  assert.equal(count(SOP, "verify-release"), 0);
  const CI = "the repo's CI check";
  const testClaim = line("| test claim |");
  const verifier = line("- the CI verdict:");
  const step6 = line("6. All merged:");
  const stage6 = SOP.slice(SOP.indexOf("## Stage 6"));
  const s6step2 = stage6.split("\n").find((l) => l.startsWith("2. `git push -u origin integ/<feature>`"));
  const step4 = between("\n4. Wait for the merge", "\n5. `git switch main`");
  const own = line("**Your own commits**");
  for (const [name, text] of [["test claim row", testClaim], ["verifier CI-verdict bullet", verifier], ["5b step 6", step6], ["Stage 6 step 2", s6step2], ["Stage 6 step 4", step4], ["Your own commits", own]]) {
    assert.ok(text && text.includes(CI), `${name} carries ${CI}`);
  }
  assert.ok(testClaim.includes(`${CI} on \`<reported sha>\``));
  assert.ok(verifier.includes(`it runs ${CI} on \`<reported sha>\` and returns the CI run id plus the verdict`));
  assert.ok(step6.startsWith("6. All merged: the repo's build (commit the rebuilt tracked output) → `git push -u origin integ/<feature>` → the repo's CI check on `<HEAD>`."));
  assert.ok(s6step2.includes("then the repo's CI check on the integration branch HEAD"), "sop.ci-6-2");
  assert.equal(count(step4, `${CI} on \`<HEAD>\``), 1);
  assert.ok(step4.indexOf("node <agc install>/scripts/merge-invariants.mjs") >= 0);
  assert.ok(step4.indexOf("node <agc install>/scripts/merge-invariants.mjs") < step4.indexOf(`${CI} on \`<HEAD>\``), "invariants before the CI check");
  assert.ok(own.includes(`${CI} on \`<HEAD>\``));
  const cells = testClaim.split(" | ");
  assert.ok(cells[cells.length - 1].includes("record the run id"), "mismatch cell still records the run id");
});
