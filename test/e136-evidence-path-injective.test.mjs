// Coded by @qa-engineer
// Pins for specs/e139-evidence-verdict-integrity.md E136 (AC-E136-1..5, AC-E136-7).
// Invariant: the evidence filename stem is an injective, case-fold-safe, path-safe encoding of the
// task id, so one task's evidence can never satisfy another task's gate. AC-E136-6 (path traversal)
// is proven by the re-pinned test in test/qa-flow.test.mjs. No assertion reads the real qa_reports/.

import { test } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

import { encodeEvidenceId } from "../dist/tools/evidence-file.js";
import { qaEvidencePath, hasEvidenceInFile, recordReviewInFile } from "../dist/gates/qa-review.js";
import { recordCodeReviewInFile, hasCodeReviewEvidenceInFile } from "../dist/gates/code-review.js";
import { hasAcExecutionLogDisposition, specFilePath } from "../dist/gates/ac-execution.js";
import { hasExpectedRedDisposition, expectedRedManifestPath } from "../dist/gates/expected-red.js";
import { visualEvidencePath, hasVisualEvidenceInFile } from "../dist/gates/visual.js";
import { hasEvidenceAnywhere } from "../dist/tools/evidence-lookup.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function mkWorkspace(prefix = "e136-") {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

// Test-local inverse of the documented table: "__HHHH" -> unit, "_X" -> lower-case x, else literal.
function decode(stem) {
  let out = "";
  for (let i = 0; i < stem.length; ) {
    if (stem[i] !== "_") { out += stem[i]; i += 1; continue; }
    if (stem[i + 1] === "_") {
      out += String.fromCharCode(parseInt(stem.slice(i + 2, i + 6), 16));
      i += 6;
    } else {
      out += stem[i + 1].toLowerCase();
      i += 2;
    }
  }
  return out;
}

test("AC-E136-1: encodeEvidenceId implements the documented table and examples exactly", () => {
  assert.equal(encodeEvidenceId("T-E139-01"), "T-E139-01");
  assert.equal(encodeEvidenceId("t-e139-01"), "_T-_E139-01");
  assert.equal(encodeEvidenceId("T-A_1"), "T-A__005F1");
  assert.equal(encodeEvidenceId("T-A/1"), "T-A__002F1");
  assert.equal(encodeEvidenceId("../escape"), "..__002F_E_S_C_A_P_E");
  assert.equal(encodeEvidenceId("a"), "_A");
  assert.equal(encodeEvidenceId(" "), "__0020");
  assert.equal(encodeEvidenceId("\\"), "__005C");
  assert.equal(encodeEvidenceId(":"), "__003A");
  assert.equal(encodeEvidenceId("\u0000"), "__0000");
  assert.equal(encodeEvidenceId("é"), "__00E9");
  assert.equal(encodeEvidenceId("\uD800"), "__D800");
  // UTF-16 code units, not code points: an astral char is two lone-surrogate tokens
  assert.equal(encodeEvidenceId("\u{1F600}"), "__D83D__DE00");
  assert.equal(encodeEvidenceId(""), "");
});

const CANONICAL = ["T-E139-01", "T-REL4-02", "T-E178A-06", "T-QRSA-SQL-OTHER-1", "T01", "X1", "A10-ARCH", "T-1.2"];
const legacy = (id) => id.replace(/[^A-Za-z0-9._-]/g, "_");

test("AC-E136-2: canonical ids encode to themselves and every site yields the pre-change path", () => {
  const ws = mkWorkspace();
  for (const id of CANONICAL) {
    assert.equal(encodeEvidenceId(id), id, id);
    assert.equal(legacy(id), id, "sanity: the old sanitiser was also the identity here");
    assert.equal(qaEvidencePath(ws, id), path.join(ws, "qa_reports", `review_${id}.md`));
    assert.equal(visualEvidencePath(ws, id), path.join(ws, "qa_reports", `visual_${id}.md`));
  }
  // code-review, ac-execution, expected-red, visual and evidence-lookup sites: observe by writing at the legacy path.
  fs.mkdirSync(path.join(ws, "qa_reports"), { recursive: true });
  fs.mkdirSync(path.join(ws, "review_reports"), { recursive: true });
  for (const id of CANONICAL) {
    fs.writeFileSync(path.join(ws, "review_reports", `review_${id}.md`), "x\n");
    fs.writeFileSync(path.join(ws, "qa_reports", `review_${id}.md`), "## Expected-Red Diff\nx\n## AC Execution Log\nx\n");
    fs.writeFileSync(path.join(ws, "qa_reports", `visual_${id}.md`), "x\n");
  }
  assert.deepEqual(hasCodeReviewEvidenceInFile(ws, CANONICAL).missing, []);
  assert.deepEqual(hasEvidenceInFile(ws, CANONICAL).missing, []);
  assert.equal(hasExpectedRedDisposition(ws, CANONICAL).present, true);
  assert.equal(hasAcExecutionLogDisposition(ws, CANONICAL).present, true);
  assert.deepEqual(hasVisualEvidenceInFile(ws, CANONICAL).missing, []);
  assert.equal(hasEvidenceAnywhere(ws, CANONICAL).size, CANONICAL.length);
});

test("AC-E136-3: injective, case-fold-safe, and invertible over a generated corpus", () => {
  const alphabet = ["a", "A", "_", "-", "/", " ", "é", "\uD800"];
  const ids = [""];
  let frontier = [""];
  for (let len = 1; len <= 3; len++) {
    const next = [];
    for (const p of frontier) for (const c of alphabet) next.push(p + c);
    ids.push(...next);
    frontier = next;
  }
  ids.push("T-X-01", "t-x-01", "T-A/1", "T-A_1", "T-A 1", "T-A:1");
  const unique = [...new Set(ids)];
  const seen = new Map();
  for (const id of unique) {
    const enc = encodeEvidenceId(id);
    assert.match(enc, /^[A-Z0-9._-]*$/, `output alphabet for ${JSON.stringify(id)}`);
    assert.equal(decode(enc), id, `round-trip for ${JSON.stringify(id)}`);
    const folded = enc.toLowerCase();
    assert.ok(!seen.has(folded), `collision (after case fold): ${JSON.stringify(id)} vs ${JSON.stringify(seen.get(folded))}`);
    seen.set(folded, id);
  }
  assert.ok(unique.length > 500, "corpus is non-trivial");
});

test("AC-E136-4: each of the six sites derives its stem from encodeEvidenceId, and none keeps a taskId.replace( call", async () => {
  const ws = mkWorkspace();
  const id = "t-x/1"; // non-canonical on purpose: distinguishes the encoder from the old sanitiser
  const enc = encodeEvidenceId(id);
  assert.notEqual(enc, legacy(id));

  assert.equal(qaEvidencePath(ws, id), path.join(ws, "qa_reports", `review_${enc}.md`));
  assert.equal(visualEvidencePath(ws, id), path.join(ws, "qa_reports", `visual_${enc}.md`));

  // code-review site: record then observe the filename actually written
  await recordCodeReviewInFile(ws, [id], "APPROVED", "code-reviewer", "ok");
  assert.deepEqual(fs.readdirSync(path.join(ws, "review_reports")), [`review_${enc}.md`]);
  assert.deepEqual(hasCodeReviewEvidenceInFile(ws, [id]).present, [id]);

  // qa-review record + hasEvidenceAnywhere
  await recordReviewInFile(ws, [id], "PASS", "qa-engineer", "## Expected-Red Diff\nx\n## AC Execution Log\nx\n");
  assert.deepEqual(fs.readdirSync(path.join(ws, "qa_reports")), [`review_${enc}.md`]);
  assert.ok(hasEvidenceAnywhere(ws, [id]).has(id));

  // expected-red and ac-execution lookups read that same file
  assert.equal(hasExpectedRedDisposition(ws, [id]).present, true);
  const ac = hasAcExecutionLogDisposition(ws, [id]);
  assert.equal(ac.present, true);
  assert.deepEqual(ac.checkedPaths, [path.join(ws, "qa_reports", `review_${enc}.md`)]);

  // a missing id names the encoded direct path in checkedPaths
  const miss = hasAcExecutionLogDisposition(ws, ["t-y/2"]);
  assert.deepEqual(miss.checkedPaths, [path.join(ws, "qa_reports", `review_${encodeEvidenceId("t-y/2")}.md`)]);

  // visual lookup
  fs.writeFileSync(visualEvidencePath(ws, id), "x\n");
  assert.deepEqual(hasVisualEvidenceInFile(ws, [id]).missing, []);

  // source pin: none of the six files still derives the stem with taskId.replace(
  for (const f of [
    "gates/qa-review.ts", "gates/code-review.ts", "gates/ac-execution.ts",
    "gates/expected-red.ts", "gates/visual.ts", "tools/evidence-lookup.ts",
  ]) {
    const src = fs.readFileSync(path.join(ROOT, f), "utf-8");
    assert.ok(!/taskId\.replace\(/.test(src), `${f} must not keep a taskId.replace( call`);
    assert.ok(src.includes("encodeEvidenceId"), `${f} must use encodeEvidenceId`);
  }
});

test("AC-E136-5: evidence for T-X-01 never satisfies t-x-01 (the E120 door), QA and code-review sides", () => {
  const ws = mkWorkspace();
  fs.mkdirSync(path.join(ws, "qa_reports"), { recursive: true });
  fs.mkdirSync(path.join(ws, "review_reports"), { recursive: true });
  fs.writeFileSync(path.join(ws, "qa_reports", "review_T-X-01.md"), "# QA\n\nPASS\n");
  fs.writeFileSync(path.join(ws, "review_reports", "review_T-X-01.md"), "# Review\n\nAPPROVED\n");
  assert.deepEqual(hasEvidenceInFile(ws, ["t-x-01"]).missing, ["t-x-01"]);
  assert.deepEqual(hasCodeReviewEvidenceInFile(ws, ["t-x-01"]).missing, ["t-x-01"]);
  assert.equal(hasEvidenceAnywhere(ws, ["t-x-01"]).has("t-x-01"), false);
  // positive control: the exact id is still found
  assert.deepEqual(hasEvidenceInFile(ws, ["T-X-01"]).present, ["T-X-01"]);
  assert.deepEqual(hasCodeReviewEvidenceInFile(ws, ["T-X-01"]).present, ["T-X-01"]);
  // a sanitiser-collision pair: T-A_1 does not borrow T-A/1's file
  fs.writeFileSync(path.join(ws, "qa_reports", `review_${encodeEvidenceId("T-A/1")}.md`), "x\n");
  assert.deepEqual(hasEvidenceInFile(ws, ["T-A_1"]).missing, ["T-A_1"]);
  assert.deepEqual(hasEvidenceInFile(ws, ["T-A/1"]).present, ["T-A/1"]);
});

test("AC-E136-7: the active_feature sanitisers keep the old lossy behaviour (byte-unchanged)", () => {
  const ws = "/w";
  assert.equal(specFilePath(ws, "a/b c"), path.join(ws, "specs", "a_b_c.md"));
  assert.equal(specFilePath(ws, "..feat"), path.join(ws, "specs", "_feat.md"));
  assert.equal(expectedRedManifestPath(ws, "a/b c"), path.join(ws, "qa_reports", "expected-red_a_b_c.txt"));
  assert.equal(expectedRedManifestPath(ws, "lower-Case"), path.join(ws, "qa_reports", "expected-red_lower-Case.txt"));
  // designFilePath is module-private, so pin its source
  const vis = fs.readFileSync(path.join(ROOT, "gates", "visual.ts"), "utf-8");
  assert.ok(vis.includes('.replace(/[^A-Za-z0-9._-]/g, "_")'));
  assert.ok(vis.includes('.replace(/\\.\\.+/g, "_")'));
});
