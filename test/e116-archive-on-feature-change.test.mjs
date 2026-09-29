// Coded by @qa-engineer
// Tests for specs/e116-archive-on-feature-change.md AC1-AC5, executed against
// the REAL writeHandoffState (tools/handoff-write.ts's writeHandoffStateCore,
// via its dist/ compiled output) — per the human's explicit bar for this
// ticket: verify by EXECUTION, not by reading the diff. AC6/AC7 are
// inspection-only proofs (git diff --stat) and are recorded in
// qa_reports/review_T-E116-04.md, not here.
//
// Calling convention: writeHandoffState() is called DIRECTLY (not through
// TOOL_REGISTRY/tw_update_state), the same convention
// test/e114-cut-approval-inheritance.test.mjs uses for its AC5/F1 multi-write
// scenarios — the archive mechanism lives entirely inside
// writeHandoffStateCore, and a direct call exercises the exact same function
// production code goes through while staying free of ALLOWED_TRANSITIONS
// gate-chain friction across the multiple sequential writes each scenario
// below needs. resetSession()/markStateRead(ws) before each write mirror the
// sibling file's pre-flight/freshness-guard convention exactly.
//
// Spec-to-Test map:
//   AC1 (verbatim byte-copy of the outgoing ledger)        -> AC1
//   AC2 (live handoff.md still resets on feature change —
//        the central tension: same six fields carry
//        forward on a same-feature write, drop on a
//        feature-change write)                             -> AC2
//   AC3 (no archive on a same-feature write)                -> AC3
//   AC4 (no archive on the first-ever write)                -> AC4
//   AC5 (filename sanitization: charset AND the .slice(0,200)
//        length clamp — including the C1 regression's exact
//        233-char wedge threshold, the 500-char schema max,
//        an unconditional-clamp check beyond the schema max,
//        and the replace-before-slice ordering with
//        multi-byte input)                                 -> AC5
//   bonus (fail-closed: an uncaught copy failure aborts the
//          whole write, leaves the live ledger untouched,
//          leaks no lock and no tmp file — Constitution's
//          rule that a failed copy never loses ledger data (E150), verified
//          empirically per the dispatch brief)              -> bonus

import { test } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import * as yaml from "js-yaml";
import { fileURLToPath } from "node:url";

import { parseHandoff, writeHandoffState } from "../dist/tools/handoff.js";
import { resetSession, markStateRead } from "../dist/guards/session.js";
import { resolveCurrentLanePaths, resolveLaneLockPath, resolveCurrentLane } from "../dist/tools/lane-paths.js";

const __filename = fileURLToPath(import.meta.url);
const PROJECT_ROOT = path.resolve(path.dirname(__filename), "..");

// ---- helpers ---------------------------------------------------------------

function mkWs(prefix = "e116-") {
  const ws = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  fs.mkdirSync(path.join(ws, ".current"), { recursive: true });
  return ws;
}

// e123b9 J2 (spec AC1/AC9): the live handoff.md is lane-scoped now (these
// fixture workspaces carry no `.git`, so `_primary`). archiveDir below is
// UNCHANGED (spec AC6, Decision 3: stays workspace-wide, comment-only diff).
function handoffPath(ws) {
  return resolveCurrentLanePaths(ws).handoffPath;
}

function archiveDir(ws) {
  return path.join(ws, ".current", "archive");
}

function archiveFiles(ws) {
  const dir = archiveDir(ws);
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir);
}

// Mirrors tools/handoff-parse.ts's own frontmatter-extraction regex exactly
// (readAndMigrate: /^---\r?\n([\s\S]*?)\r?\n---/ + yaml.load) so the archive
// file — which is never routed through parseHandoff (that only ever reads
// the fixed .current/handoff.md path) — is parsed the identical way
// production code parses the live file.
function parseFrontmatter(content) {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  assert.ok(match, "archive file must have YAML frontmatter delimited by ---");
  return yaml.load(match[1]);
}

async function write(ws, opts) {
  resetSession();
  markStateRead(ws);
  return writeHandoffState({ workspacePath: ws, completedTasks: [], pendingNotes: [], ...opts });
}

// ============================================================================
// AC1 — archive captures the outgoing ledger verbatim on feature change
// ============================================================================

test("AC1: archive captures the outgoing ledger verbatim on feature change", async () => {
  const ws = mkWs();

  await write(ws, {
    activeFeature: "e116-old",
    status: "In_Progress",
    lastAgent: "sr-engineer",
    completedTasks: ["T-1", "T-2"],
    pendingNotes: ["note-a", "note-b"],
    hopCount: 5,
    qaRound: 2,
    reviewRound: 1,
    visualRound: 3,
  });

  // Capture the exact pre-overwrite bytes AND parsed values BEFORE the
  // feature-changing write — this is the ground truth AC1 must match.
  const preBytes = fs.readFileSync(handoffPath(ws));
  const preState = parseHandoff(ws);
  assert.equal(preState.active_feature, "e116-old", "sanity: pre-write state is on the old feature");
  assert.equal(preState.hop_count, 5, "sanity: hop_count was set to 5 before the feature change");

  await write(ws, {
    activeFeature: "e116-new",
    status: "In_Progress",
    lastAgent: "pm",
  });

  const files = archiveFiles(ws);
  assert.equal(files.length, 1, "exactly one archive file must be created on the feature-change write");
  const archiveFileName = files[0];
  assert.match(
    archiveFileName,
    /^e116-old\.\d+\.\d+\.md$/,
    "archive filename must be <sanitized-active-feature>.<pid>.<epochMillis>.md",
  );

  const archivePath = path.join(archiveDir(ws), archiveFileName);
  const archiveBytes = fs.readFileSync(archivePath);
  assert.deepEqual(
    archiveBytes,
    preBytes,
    "AC1 is a VERBATIM BYTE COPY — not a field-by-field reconstruction. Assert on bytes, not just parsed fields.",
  );

  // And, redundantly but per the AC's own text, confirm the parsed values
  // of the archived copy match the pre-overwrite ledger exactly.
  // completed_tasks/pending_notes live in markdown body sections (## Completed
  // / ## Pending & Handoff Notes), not YAML frontmatter — mirror parseHandoff's
  // own body-section extraction rather than yaml.load-ing the whole file.
  const archivedText = archiveBytes.toString("utf-8");
  const archived = parseFrontmatter(archivedText);
  assert.equal(archived.active_feature, "e116-old");
  assert.equal(archived.hop_count, 5);
  assert.equal(archived.qa_round, 2);
  assert.equal(archived.review_round, 1);
  assert.equal(archived.visual_round, 3);
  assert.equal(archived.last_updated, preState.last_updated, "archived last_updated must match the pre-overwrite value exactly");
  assert.deepEqual(preState.completed_tasks, ["T-1", "T-2"], "sanity: parseHandoff confirms the pre-write completed_tasks");
  assert.deepEqual(preState.pending_notes, ["note-a", "note-b"], "sanity: parseHandoff confirms the pre-write pending_notes");
  assert.match(archivedText, /##[^\n]*Completed[^\n]*\n- \[x\] T-1\n- \[x\] T-2/, "archived body's Completed section must list T-1 and T-2 verbatim");
  assert.match(archivedText, /##[^\n]*Pending & Handoff Notes[^\n]*\n- note-a\n- note-b/, "archived body's Pending & Handoff Notes section must list both notes verbatim");
});

// ============================================================================
// AC2 — live handoff.md still resets on feature change (the central tension):
// the six feature-scoped fields carry forward on a SAME-feature write, but
// drop on a feature-CHANGE write. A future edit that "improves" E116 by
// preserving state across a feature change must fail this test.
// ============================================================================

test("AC2: live handoff still resets on feature change — six feature-scoped fields carry forward same-feature, drop on feature change", async () => {
  const ws = mkWs();

  // Write 1: establish a full ledger, including all six feature-scoped
  // fields, on feature "e116-tension". lastAgent is deliberately NOT "pm" —
  // cut_approved has its OWN independent PM-re-entry re-arm rule, and using
  // "pm" here would confound the feature-scoped-drop assertion below with
  // that unrelated rule.
  await write(ws, {
    activeFeature: "e116-tension",
    status: "In_Progress",
    lastAgent: "sr-engineer",
    cutApproved: true,
    externalRefs: [{ ref: "https://example.com/spec", state: "fetched" }],
    dispatchPins: { "sr-engineer": "fable" },
    dispatchMode: "bugfix",
    evidenceSchema: 2,
    cutApprovedSource: "inherited:parent-x",
    hopCount: 5,
    qaRound: 2,
    reviewRound: 1,
    visualRound: 3,
  });

  // Write 2: SAME feature, omit all six fields entirely. This is the
  // contrast baseline — carry-forward-if-omitted is the existing, unchanged
  // behavior E116 must not touch.
  await write(ws, {
    activeFeature: "e116-tension",
    status: "In_Progress",
    lastAgent: "sr-engineer",
  });
  const sameFeatureState = parseHandoff(ws);
  assert.equal(sameFeatureState.cut_approved, true, "same-feature write must carry cut_approved forward when omitted");
  assert.deepEqual(sameFeatureState.external_refs, [{ ref: "https://example.com/spec", state: "fetched" }], "same-feature write must carry external_refs forward when omitted");
  assert.deepEqual(sameFeatureState.dispatch_pins, { "sr-engineer": "fable" }, "same-feature write must carry dispatch_pins forward when omitted");
  assert.equal(sameFeatureState.dispatch_mode, "bugfix", "same-feature write must carry dispatch_mode forward when omitted");
  assert.equal(sameFeatureState.evidence_schema, 2, "same-feature write must carry evidence_schema forward when omitted");
  assert.equal(sameFeatureState.cut_approved_source, "inherited:parent-x", "same-feature write must carry cut_approved_source forward when omitted");
  // hop_count/qa_round/review_round/visual_round are NOT preserved-if-omitted
  // (they always normalize to 0 on any write that omits them, feature change
  // or not) — sanity-checked here so the archive-fires assertion below is
  // read as being about the ARCHIVE, not about this unrelated always-reset
  // behavior.
  assert.equal(sameFeatureState.hop_count, 0);
  assert.equal(sameFeatureState.qa_round, 0);
  assert.equal(sameFeatureState.review_round, 0);
  assert.equal(sameFeatureState.visual_round, 0);

  // Write 3: re-arm the six fields (same feature, still), THEN change
  // active_feature on write 4 and confirm they drop live — this is AC2's
  // actual claim.
  await write(ws, {
    activeFeature: "e116-tension",
    status: "In_Progress",
    lastAgent: "sr-engineer",
    cutApproved: true,
    externalRefs: [{ ref: "https://example.com/spec", state: "fetched" }],
    dispatchPins: { "sr-engineer": "fable" },
    dispatchMode: "bugfix",
    evidenceSchema: 2,
    cutApprovedSource: "inherited:parent-x",
    hopCount: 5,
    qaRound: 2,
    reviewRound: 1,
    visualRound: 3,
  });

  await write(ws, {
    activeFeature: "e116-tension-v2", // active_feature CHANGES here
    status: "In_Progress",
    lastAgent: "sr-engineer",
    // all six fields, and all four counters, omitted
  });

  const liveState = parseHandoff(ws);
  assert.equal(liveState.active_feature, "e116-tension-v2");
  assert.equal(liveState.hop_count, 0, "hop_count must reset to 0 on feature change");
  assert.equal(liveState.qa_round, 0, "qa_round must reset to 0 on feature change");
  assert.equal(liveState.review_round, 0, "review_round must reset to 0 on feature change");
  assert.equal(liveState.visual_round, 0, "visual_round must reset to 0 on feature change");
  assert.equal(liveState.cut_approved, undefined, "cut_approved must DROP on feature change — the archive is additive, it must not weaken this reset");
  assert.equal(liveState.external_refs, undefined, "external_refs must DROP on feature change");
  assert.equal(liveState.dispatch_pins, undefined, "dispatch_pins must DROP on feature change");
  assert.equal(liveState.dispatch_mode, undefined, "dispatch_mode must DROP on feature change");
  assert.equal(liveState.evidence_schema, undefined, "evidence_schema must DROP on feature change");
  assert.equal(liveState.cut_approved_source, undefined, "cut_approved_source must DROP on feature change");

  // And the archive fired for write 4 (not for the earlier same-feature
  // writes) — proving the two mechanisms (archive, reset) are coordinated,
  // not accidentally aliased.
  const files = archiveFiles(ws);
  assert.equal(files.length, 1, "exactly one archive file across the whole scenario — only the feature-change write (write 4) fires it");
  assert.match(files[0], /^e116-tension\.\d+\.\d+\.md$/);
});

// ============================================================================
// AC3 — no archive on a same-feature write
// ============================================================================

test("AC3: no archive on a same-feature write", async () => {
  const ws = mkWs();
  await write(ws, { activeFeature: "e116-ac3", status: "In_Progress", lastAgent: "pm" });
  await write(ws, { activeFeature: "e116-ac3", status: "In_Progress", lastAgent: "sr-engineer", pendingNotes: ["implementing"] });
  await write(ws, { activeFeature: "e116-ac3", status: "In_Progress", lastAgent: "code-reviewer", pendingNotes: ["reviewing"] });

  assert.deepEqual(archiveFiles(ws), [], "a mechanism that fires only on active_feature change must create nothing under .current/archive/ across three same-feature hops");
});

// ============================================================================
// AC4 — no archive on the first-ever write (no pre-existing handoff.md)
// ============================================================================

test("AC4: no archive on the first-ever write to a fresh workspace", async () => {
  const ws = mkWs();
  assert.ok(!fs.existsSync(handoffPath(ws)), "sanity: no pre-existing handoff.md");

  await write(ws, { activeFeature: "e116-ac4-fresh", status: "In_Progress", lastAgent: "pm" });

  assert.ok(fs.existsSync(handoffPath(ws)), "the first-ever write must still succeed and create handoff.md");
  assert.deepEqual(archiveFiles(ws), [], "the null-existing path must not fire the archive — nothing to archive");
  const state = parseHandoff(ws);
  assert.equal(state.active_feature, "e116-ac4-fresh");
});

// ============================================================================
// AC5 — filename sanitization: charset containment AND the length clamp,
// including the C1 regression's exact wedge threshold.
// ============================================================================

test("AC5-1: a '/'-and-'..'-bearing active_feature sanitizes to a plain filename that cannot escape .current/archive/", async () => {
  const ws = mkWs();
  const hostile = "../../etc/passwd";
  await write(ws, { activeFeature: hostile, status: "In_Progress", lastAgent: "pm" });
  await write(ws, { activeFeature: "e116-ac5-safe-landing", status: "In_Progress", lastAgent: "sr-engineer" });

  const files = archiveFiles(ws);
  assert.equal(files.length, 1);
  const [fileName] = files;
  assert.ok(!fileName.includes("/"), "sanitized filename must contain no path separator");
  const resolved = path.resolve(archiveDir(ws), fileName);
  assert.ok(
    resolved.startsWith(archiveDir(ws) + path.sep),
    "the resolved archive path must stay strictly inside .current/archive/ — no path traversal",
  );
  // Every char outside [A-Za-z0-9._-] must have become "-".
  const stem = fileName.replace(/\.\d+\.\d+\.md$/, "");
  assert.match(stem, /^[A-Za-z0-9._-]+$/, "sanitized stem must contain only the allowed charset");
});

test("AC5-2: the C1 regression wedge threshold (233 ASCII chars) no longer throws ENAMETOOLONG", async () => {
  const ws = mkWs();
  const wedge = "a".repeat(233); // the exact length review_T-E116-03.md Round 1 found wedged the workspace
  await write(ws, { activeFeature: wedge, status: "In_Progress", lastAgent: "pm" });
  await assert.doesNotReject(
    write(ws, { activeFeature: "e116-ac5-past-wedge", status: "In_Progress", lastAgent: "sr-engineer" }),
    "a 233-char active_feature must no longer throw ENAMETOOLONG on the feature-change write (C1, fixed by .slice(0, 200))",
  );
  const files = archiveFiles(ws);
  assert.equal(files.length, 1);
  const stem = files[0].replace(/\.\d+\.\d+\.md$/, "");
  assert.ok(stem.length <= 200, "clamped stem must never exceed 200 chars even for the exact wedge-threshold input");
});

test("AC5-3: the registry's z.string().max(500) schema-maximum active_feature does not throw either", async () => {
  const ws = mkWs();
  const schemaMax = "b".repeat(500); // z.string().min(1).max(500) in tools/registry.ts
  await write(ws, { activeFeature: schemaMax, status: "In_Progress", lastAgent: "pm" });
  await assert.doesNotReject(
    write(ws, { activeFeature: "e116-ac5-past-schema-max", status: "In_Progress", lastAgent: "sr-engineer" }),
  );
  const files = archiveFiles(ws);
  const stem = files[0].replace(/\.\d+\.\d+\.md$/, "");
  assert.equal(stem.length, 200, "a 500-char input (well past the wedge threshold) must clamp to exactly 200 chars");
});

test("AC5-4: the clamp is UNCONDITIONAL — a 10000-char active_feature (beyond even the zod cap, reachable by any caller that bypasses tools/registry.ts) still does not throw", async () => {
  // writeHandoffState is called directly here (bypassing the zod boundary
  // entirely), the same way tools/handoff-parse.ts's migration heal-write
  // calls it — proving the .slice(0, 200) clamp does not depend on the
  // z.string().max(500) cap and protects every internal caller, not just
  // tw_update_state's client-facing surface.
  const ws = mkWs();
  const huge = "c".repeat(10000);
  await write(ws, { activeFeature: huge, status: "In_Progress", lastAgent: "pm" });
  await assert.doesNotReject(
    write(ws, { activeFeature: "e116-ac5-past-huge", status: "In_Progress", lastAgent: "sr-engineer" }),
  );
  const files = archiveFiles(ws);
  const stem = files[0].replace(/\.\d+\.\d+\.md$/, "");
  assert.equal(stem.length, 200, "the clamp must apply even to input far beyond any client-facing schema cap");
});

test("AC5-5: replace-before-slice ordering — multi-byte input (astral emoji, 3-byte CJK) yields a pure-ASCII, byte-safe stem", async () => {
  // The regex /[^A-Za-z0-9._-]/g (no /u flag) matches per UTF-16 code unit,
  // so it replaces EACH surrogate half of an astral emoji independently, and
  // every 3-byte CJK code point, with a single ASCII "-" — BEFORE .slice(0,
  // 200) ever runs. This guarantees the sliced stem is pure single-byte
  // ASCII, so NAME_MAX (which counts bytes) and the 200-code-unit slice
  // (which counts UTF-16 code units) agree. If a future edit reorders this
  // to slice-then-replace, a string engineered so a surrogate pair straddles
  // the 200-code-unit boundary risks leaving a malformed/unpaired surrogate
  // in the byte-encoded filename — this test pins the CURRENT, correct
  // ordering's guarantee: the stem is provably pure ASCII (byteLength ===
  // char length) at every clamp boundary.
  const ws = mkWs();
  // 190 allowed ASCII chars + 5 astral emoji (10 UTF-16 code units, straddling
  // the 200-unit boundary at position 190-199) + 3-byte CJK padding well past
  // the clamp, plus a leading disallowed "/" to also confirm charset removal
  // co-exists correctly with the multi-byte handling.
  const asciiPad = "d".repeat(190);
  const emoji = "\u{1F600}".repeat(5); // 5 x 😀, 10 UTF-16 code units total
  const cjkTail = "中文".repeat(50); // "中文" x 50, well past the clamp
  const mixed = "/" + asciiPad + emoji + cjkTail;

  await write(ws, { activeFeature: mixed, status: "In_Progress", lastAgent: "pm" });
  await assert.doesNotReject(
    write(ws, { activeFeature: "e116-ac5-past-multibyte", status: "In_Progress", lastAgent: "sr-engineer" }),
  );
  const files = archiveFiles(ws);
  assert.equal(files.length, 1);
  const stem = files[0].replace(/\.\d+\.\d+\.md$/, "");

  assert.equal(stem.length, 200, "the clamp is measured in code units post-replace, and the input is well past 200 — stem must be exactly 200");
  assert.match(stem, /^[A-Za-z0-9._-]+$/, "every code unit outside the allowed charset (each surrogate half, each CJK code point) must have become a single ASCII '-' BEFORE slicing");
  assert.equal(
    Buffer.byteLength(stem, "utf-8"),
    stem.length,
    "post-sanitization the stem must be pure single-byte ASCII — byte length must equal code-unit length, proving no multi-byte or lone-surrogate code unit survived into the filename",
  );
});

// ============================================================================
// bonus — fail-closed semantics: an uncaught copy failure aborts the whole
// write, leaves the live ledger untouched, leaks no lock and no tmp file.
// Deliberate, per the dispatch brief: DO NOT change this behavior.
// ============================================================================

test("bonus: an archive-copy failure (ENOTDIR) aborts the whole write, leaves the live handoff.md byte-identical, and leaks no lock/tmp file", async () => {
  const ws = mkWs();
  await write(ws, { activeFeature: "e116-failclosed-old", status: "In_Progress", lastAgent: "pm", pendingNotes: ["pre-failure state"] });

  const preBytes = fs.readFileSync(handoffPath(ws));

  // Force fs.copyFileSync to fail: make .current/archive a REGULAR FILE, so
  // mkdirSync(archiveDir, {recursive:true}) throws ENOTDIR before the copy
  // is ever attempted — the same technique review_T-E116-03.md Round 2 used.
  fs.writeFileSync(archiveDir(ws), "not a directory");

  await assert.rejects(
    write(ws, { activeFeature: "e116-failclosed-new", status: "In_Progress", lastAgent: "sr-engineer" }),
    "a copy-path failure must reject the whole write, not swallow it",
  );

  // Live ledger must be untouched — byte-identical to before the failed attempt.
  const postBytes = fs.readFileSync(handoffPath(ws));
  assert.deepEqual(postBytes, preBytes, "a failed write must leave the live handoff.md completely untouched (fail-closed, no partial overwrite)");

  // No lock file left behind (guards/file-lock.ts releases in a finally
  // block regardless of a thrown error). e123b9 J2 (spec AC5): the lock is
  // per-lane now, at .current/<lane>/.handoff.lock, not workspace-wide.
  assert.ok(
    !fs.existsSync(resolveLaneLockPath(ws, resolveCurrentLane(ws))),
    "the lock file must be released even though the write threw",
  );

  // No leaked .tmp file from the (never-reached) tmp-write+rename publish
  // step. e123b9 J2 (spec AC1): handoff.md's tmp-write+rename now happens
  // inside the lane dir, not the workspace-root .current/.
  const leftovers = fs.readdirSync(path.dirname(handoffPath(ws))).filter((f) => f.endsWith(".tmp"));
  assert.deepEqual(leftovers, [], "no tmp file must be left behind — the failure happens before the tmp-write+rename publish step ever runs");
});
