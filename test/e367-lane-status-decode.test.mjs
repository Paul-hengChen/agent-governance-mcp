// Coded by @qa-engineer
// Tests (T-E367-02) for decodeEvidenceId (tools/evidence-file.ts) and its use in
// tools/lane-status.ts passEvidenceIdsIn (specs/e367-evidence-and-feature-path-encoding.md,
// AC-E367-1..6). Why: E136 made evidence filenames injective-encoded; lane-status must read
// the id back, otherwise a task with real PASS evidence looks like claimedWithoutEvidence.
// Fixtures are built in temp dirs; nothing here asserts on real qa_reports/ content.

import { test } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

import { encodeEvidenceId, decodeEvidenceId } from "../dist/tools/evidence-file.js";
import { checkLaneEvidence } from "../dist/tools/lane-status.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const PASS_BODY = "## 2026-01-01T00:00:00.000Z — PASS — by qa-engineer\n\nok\n";
const FAIL_BODY = "## 2026-01-01T00:00:00.000Z — FAIL — by qa-engineer\n\nno\n";

function corpus() {
  const base = [
    "T-E900-01", "t-e900-01", "T-E900_02", "T-E900/03", "a b", "x:y", "a\0b",
    "héllo", "日本語", "\ud800", "a😀b", "",
  ];
  const alphabet = ["A", "z", "0", ".", "-", "_", "/", " ", "é", "\ud800"];
  const out = new Set(base);
  const gen = (prefix, depth) => {
    out.add(prefix);
    if (depth === 3) return;
    for (const c of alphabet) gen(prefix + c, depth + 1);
  };
  gen("", 0);
  return [...out];
}

function mkWs(t, prefix) {
  const ws = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  t.after(() => fs.rmSync(ws, { recursive: true, force: true }));
  fs.mkdirSync(path.join(ws, "qa_reports"), { recursive: true });
  return ws;
}

function writeEv(dir, stem, body) {
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, `review_${stem}.md`), body);
}

test("AC-E367-1: decodeEvidenceId(encodeEvidenceId(id)) === id over the corpus", () => {
  const ids = corpus();
  assert.ok(ids.length > 1000, "exhaustive short-string corpus is non-trivial");
  for (const id of ids) {
    assert.equal(decodeEvidenceId(encodeEvidenceId(id)), id, `round-trip failed for ${JSON.stringify(id)}`);
  }
});

test("AC-E367-2: stems the encoder cannot produce decode to null; non-null results re-encode to the stem", () => {
  const bad = ["t01", "_", "_1", "__00", "__005f", "__0041", "__002E", "__002D", "T-E260G-09 T-E260G-10", "b8"];
  for (const s of bad) {
    let r;
    assert.doesNotThrow(() => { r = decodeEvidenceId(s); }, s);
    assert.equal(r, null, `${JSON.stringify(s)} must be non-decodable`);
  }
  const stems = [...corpus().map(encodeEvidenceId), ...bad];
  for (const s of stems) {
    const d = decodeEvidenceId(s);
    if (d !== null) assert.equal(encodeEvidenceId(d), s, `non-null decode must re-encode for ${JSON.stringify(s)}`);
  }
  // Boundary: hostile / oversized input never throws.
  assert.doesNotThrow(() => decodeEvidenceId("_".repeat(100000)));
  assert.doesNotThrow(() => decodeEvidenceId("\0../x"));
  assert.equal(decodeEvidenceId(""), "");
});

test("AC-E367-3: non-canonical PASS evidence is credited at qa_reports/ root and in archive/<feature>/", (t) => {
  const feature = "e900-decode-fixture";
  const ids = ["t-e900-01", "T-E900_02", "T-E900/03"];
  const root = mkWs(t, "e367-root-");
  for (const id of ids) writeEv(path.join(root, "qa_reports"), encodeEvidenceId(id), PASS_BODY);
  const r = checkLaneEvidence(root, feature, ids, "e900");
  assert.deepEqual(r.evidenceIds, [...ids].sort());
  assert.deepEqual(r.claimedWithoutEvidence, []);

  const arch = mkWs(t, "e367-arch-");
  for (const id of ids) writeEv(path.join(arch, "qa_reports", "archive", feature), encodeEvidenceId(id), PASS_BODY);
  const a = checkLaneEvidence(arch, feature, ids, "e900");
  assert.deepEqual(a.evidenceIds, [...ids].sort());
  assert.deepEqual(a.claimedWithoutEvidence, []);
});

test("AC-E367-4: a non-decodable legacy stem falls back to the raw stem and is still credited", (t) => {
  const ws = mkWs(t, "e367-legacy-");
  writeEv(path.join(ws, "qa_reports"), "t-e900-04", PASS_BODY);
  const r = checkLaneEvidence(ws, "e900-decode-fixture", ["t-e900-04"], "e900");
  assert.deepEqual(r.evidenceIds, ["t-e900-04"]);
  assert.deepEqual(r.claimedWithoutEvidence, []);
});

test("AC-E367-5: canonical ids are credited unchanged; a FAIL-only encoded file credits nothing", (t) => {
  const ws = mkWs(t, "e367-canon-");
  const qa = path.join(ws, "qa_reports");
  writeEv(qa, "T-E900-05", PASS_BODY);
  writeEv(qa, encodeEvidenceId("t-e900-06"), FAIL_BODY);
  const r = checkLaneEvidence(ws, "e900-decode-fixture", ["T-E900-05", "t-e900-06"], "e900");
  assert.deepEqual(r.evidenceIds, ["T-E900-05"]);
  assert.deepEqual(r.claimedWithoutEvidence, ["t-e900-06"]);
});

test("AC-E367-6: lane-status.ts imports decodeEvidenceId and never adds a raw stem without trying the decoder", () => {
  const src = fs.readFileSync(path.join(ROOT, "tools", "lane-status.ts"), "utf-8");
  assert.match(src, /import\s*\{[^}]*\bdecodeEvidenceId\b[^}]*\}\s*from\s*"\.\/evidence-file\.js"/);
  assert.match(src, /decodeEvidenceId\(m\[1\]\)\s*\?\?\s*m\[1\]/);
  assert.doesNotMatch(src, /ids\.add\(m\[1\]\)/, "a bare raw stem add would skip the decoder");
});
