// Coded by @qa-engineer: pins for specs/e226-integrator-sop-portable.md AC-E350-1 (T-E350-02).
// WHY: the manifest-tier `fanout.mjs check --cut` call appears in the PM SOP, Constitution §3.1 and the
// coordinator SOP; all three ship to adopters, so the call is written against the agc install
// (`node <agc install>/scripts/fanout.mjs`), never the repo-relative `node scripts/...` that only
// resolves inside the agc checkout. The e296 literals (`check --cut ...`) must still hold.
// Content assertions only (no real specs/fanout-*.md, no fixed base sha).
// Creation of this file was pre-authorized in the E226 qa dispatch brief (Test-file placement).

import { test } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const rd = (rel) => fs.readFileSync(path.join(ROOT, rel), "utf-8");
const count = (text, needle) => text.split(needle).length - 1;
const PM = rd("content/skill-pm.md");
const CONST08 = rd("content/const-08-chain-31-mid.md");
const COORD03 = rd("content/coord-03-core-fallback.md");

test("AC-E350-1: none of the three fragments carries a repo-relative `node scripts/`", () => {
  for (const [name, text] of [["skill-pm", PM], ["const-08", CONST08], ["coord-03", COORD03]]) {
    assert.equal(count(text, "node scripts/"), 0, `${name} has no node scripts/`);
  }
});

test("AC-E350-1: PM Manifest-Tier row carries pm.manifest-row", () => {
  const row = PM.split("\n").filter((l) => l.startsWith("| **Manifest-Tier Self-Attestation** |"));
  assert.equal(row.length, 1);
  assert.ok(
    row[0].includes(
      "run `node <agc install>/scripts/fanout.mjs check --cut specs/fanout-<id>.md <lane> specs/<feature>.md` (`<agc install>` = agc's install directory; the repo addendum may give its own call form)",
    ),
  );
  // e296 AC1 literal still holds
  assert.ok(row[0].includes("check --cut specs/fanout-<id>.md <lane> specs/<feature>.md"));
});

test("AC-E350-1: const-08 condition 3 carries const08.cond3 (path token only)", () => {
  assert.equal(count(CONST08, "(3) `node <agc install>/scripts/fanout.mjs check --cut <manifest> <lane> <spec>` exits 0"), 1);
  assert.ok(CONST08.includes("check --cut")); // e296 AC2 literal
});

test("AC-E350-1: coord-03 writer action and roll-up obligation carry coord03.writer / coord03.rollup", () => {
  assert.equal(count(COORD03, "`node <agc install>/scripts/fanout.mjs check --cut <manifest> <lane> <spec>` exits 0 on that cut"), 1);
  assert.equal(count(COORD03, "run `node <agc install>/scripts/feature-rollup.mjs <feature>`"), 1);
  assert.ok(COORD03.includes("check --cut")); // e296 AC3 literal
});
