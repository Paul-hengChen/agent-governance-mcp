// Coded by @qa-engineer
// Tests for backlog E5 (docs/backlog.md:1016-1047) / T-E5-01/02/03:
// (a) coordinator Backlog Intake Loop (coord-03-core-fallback.md), (b) tiered
// cut-approval — Constitution §3.1 Cut-Approval Auto-Tier (const-08-chain-31-mid.md)
// + tools/config.ts `cutApprovalAutoTier` threshold key, (c) Cheapest-Compliant-Path
// Intake step 4a (coord-07-core-sop.md).
//
// State-integrity note (qa-engineer disclosure): the handoff's completed_tasks
// ledger for T-E5-01/02/03 was pre-filled by an out-of-band write impersonating
// qa-engineer BEFORE this suite ran (tw_detect_drift confirmed tasks.md
// checkboxes were still unchecked at claim time). This file, plus the
// independently re-measured context-budget ratchets in
// test/context-budget.test.mjs and the golden-fixture re-baselines in
// test/compose-equivalence.test.mjs / test/skill-manifest.test.mjs, is what
// actually establishes T-E5-01/02/03 as verified — not the prior write.
//
// Config-side spec-to-test map (tools/config.ts CutApprovalAutoTier, mirrors
// the T-B9-03 tokenBudgetPerFeature precedent in test/token-budget-config.test.mjs):
//   absent key -> disabled                          -> t-absent-key, t-absent-file
//   present {} -> conservative defaults              -> t-empty-object-defaults
//   non-object/array/null/primitive -> treated as absent (non-fatal) ->
//     t-string-value, t-number-value, t-null-value, t-array-value
//   maxFiles: fractional positive -> floored (not defaulted) -> t-maxfiles-fractional
//   maxFiles: negative/zero/non-finite/non-number -> falls back to default ->
//     t-maxfiles-negative, t-maxfiles-zero, t-maxfiles-infinity, t-maxfiles-string
//   maxPriority: valid ^P\d+$ -> surfaced verbatim -> t-maxpriority-valid
//   maxPriority: malformed pattern -> falls back to default -> t-maxpriority-no-p,
//     t-maxpriority-trailing-space, t-maxpriority-non-digit
//   allowSchemaChange/allowDesignArmed: strict === true only -> t-booleans-strict-true,
//     t-booleans-truthy-non-true-stays-false
//   CUT_APPROVAL_AUTO_TIER_DEFAULTS export shape -> t-defaults-export-shape
//   byte-identical regression for workspaces without the key -> t-existing-fields-untouched
//
// Content-pin spec-to-test map (mirrors the E16 charter-pinning convention,
// test/e16-judge-dispatch-charter.test.mjs): pure grep/string-containment
// assertions against the shipped content files.
//   const-08 auto-tier bullet: trust rule + same-write recording + HALT-over-
//     threshold language -> t-const08-trust-rule, t-const08-same-write-recording,
//     t-const08-halt-over-threshold, t-const08-advisory-not-enforced
//   coord-03 Backlog Intake Loop present + never-auto-hop-to-release-engineer bound
//     -> t-coord03-intake-loop-present, t-coord03-never-auto-hop-release
//   coord-07 SOP step 4a present + §2/§3.2 hard-floor sentence
//     -> t-coord07-step4a-present, t-coord07-hard-floor

import { test } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(__filename), "..");

import { loadConfig, CUT_APPROVAL_AUTO_TIER_DEFAULTS } from "../dist/tools/config.js";

function mkWorkspace() {
  const ws = fs.mkdtempSync(path.join(os.tmpdir(), "twcfg-autotier-"));
  fs.mkdirSync(path.join(ws, ".current"), { recursive: true });
  return ws;
}

function configPathOf(ws) {
  return path.join(ws, ".current", ".config.json");
}

// Writes raw (already-serialized) JSON text so callers can embed literals
// (e.g. numeric overflow) that JSON.stringify would not reproduce verbatim.
function writeRawConfig(ws, jsonText) {
  fs.writeFileSync(configPathOf(ws), jsonText);
}

function writeConfig(ws, body) {
  writeRawConfig(ws, JSON.stringify(body));
}

// ===========================================================================
// tools/config.ts — CutApprovalAutoTier parse
// ===========================================================================

// ---------- absent key / absent file -> disabled ----------

test("T-E5-02 config: config file exists with other fields but no cutApprovalAutoTier key -> field absent (disabled)", () => {
  const ws = mkWorkspace();
  writeConfig(ws, { taskPaths: ["tasks.md"] });
  const cfg = loadConfig(ws);
  assert.equal(
    cfg.cutApprovalAutoTier,
    undefined,
    "auto-tier must be disabled (field absent) when the key is simply not present",
  );
});

test("T-E5-02 config: .current/.config.json does not exist at all -> field absent (disabled)", () => {
  const ws = mkWorkspace();
  const cfg = loadConfig(ws);
  assert.equal(cfg.cutApprovalAutoTier, undefined, "auto-tier disabled when the config file doesn't exist");
  assert.deepEqual(cfg, {}, "no-file workspace still returns the empty WorkspaceConfig shape");
});

// ---------- present {} -> conservative defaults ----------

test("T-E5-02 config: present-but-empty {} object arms the tier with conservative defaults", () => {
  const ws = mkWorkspace();
  writeConfig(ws, { cutApprovalAutoTier: {} });
  const cfg = loadConfig(ws);
  assert.deepEqual(
    cfg.cutApprovalAutoTier,
    { maxFiles: 2, maxPriority: "P3", allowSchemaChange: false, allowDesignArmed: false },
    "presence of the key (even {}) arms the tier; every omitted field must take its conservative default",
  );
});

// ---------- non-object / array / null / primitive -> treated as absent ----------

test("T-E5-02 config: a string value for cutApprovalAutoTier is treated as absent (tier disabled), no crash", () => {
  const ws = mkWorkspace();
  writeConfig(ws, { cutApprovalAutoTier: "enabled" });
  const cfg = loadConfig(ws);
  assert.equal(cfg.cutApprovalAutoTier, undefined);
});

test("T-E5-02 config: a number value for cutApprovalAutoTier is treated as absent (tier disabled), no crash", () => {
  const ws = mkWorkspace();
  writeConfig(ws, { cutApprovalAutoTier: 1 });
  const cfg = loadConfig(ws);
  assert.equal(cfg.cutApprovalAutoTier, undefined);
});

test("T-E5-02 config: null for cutApprovalAutoTier is treated as absent (tier disabled), no crash", () => {
  const ws = mkWorkspace();
  writeConfig(ws, { cutApprovalAutoTier: null });
  const cfg = loadConfig(ws);
  assert.equal(cfg.cutApprovalAutoTier, undefined);
});

test("T-E5-02 config: an array for cutApprovalAutoTier is treated as absent (tier disabled) — typeof 'object' alone is not enough", () => {
  const ws = mkWorkspace();
  writeConfig(ws, { cutApprovalAutoTier: [1, 2, 3] });
  const cfg = loadConfig(ws);
  assert.equal(
    cfg.cutApprovalAutoTier,
    undefined,
    "Array.isArray guard must reject arrays even though typeof [] === 'object'",
  );
});

// ---------- maxFiles: fractional positive -> floored, not defaulted ----------

test("T-E5-02 config AC boundary: fractional positive maxFiles is floored (Math.floor), NOT filtered to the default", () => {
  const ws = mkWorkspace();
  writeConfig(ws, { cutApprovalAutoTier: { maxFiles: 3.9 } });
  const cfg = loadConfig(ws);
  assert.equal(
    cfg.cutApprovalAutoTier.maxFiles,
    3,
    "a fractional-but-positive maxFiles must be floored to an integer, not silently replaced by the maxFiles=2 default — " +
      "3 !== 2 makes this test fail loudly if a future refactor starts defaulting instead of flooring",
  );
});

// ---------- maxFiles: negative / zero / non-finite / non-number -> default ----------

test("T-E5-02 config AC4-equivalent: negative maxFiles falls back to the conservative default (2), non-fatal", () => {
  const ws = mkWorkspace();
  writeConfig(ws, { cutApprovalAutoTier: { maxFiles: -5 } });
  const cfg = loadConfig(ws);
  assert.equal(cfg.cutApprovalAutoTier.maxFiles, 2);
});

test("T-E5-02 config AC4-equivalent: zero maxFiles falls back to the default (must be > 0, not just >= 0)", () => {
  const ws = mkWorkspace();
  writeConfig(ws, { cutApprovalAutoTier: { maxFiles: 0 } });
  const cfg = loadConfig(ws);
  assert.equal(cfg.cutApprovalAutoTier.maxFiles, 2);
});

test("T-E5-02 config AC4-equivalent: numeric-literal overflow (Infinity via valid JSON) falls back to the default", () => {
  const ws = mkWorkspace();
  writeRawConfig(ws, '{"cutApprovalAutoTier": {"maxFiles": 1e400}}');
  const cfg = loadConfig(ws);
  assert.equal(cfg.cutApprovalAutoTier.maxFiles, 2);
});

test("T-E5-02 config AC4-equivalent: a string maxFiles ('5') falls back to the default — no coercion", () => {
  const ws = mkWorkspace();
  writeConfig(ws, { cutApprovalAutoTier: { maxFiles: "5" } });
  const cfg = loadConfig(ws);
  assert.equal(cfg.cutApprovalAutoTier.maxFiles, 2);
});

// ---------- maxPriority: valid vs malformed pattern ----------

test("T-E5-02 config: a valid ^P\\d+$ maxPriority is surfaced verbatim (positive control)", () => {
  const ws = mkWorkspace();
  writeConfig(ws, { cutApprovalAutoTier: { maxPriority: "P1" } });
  const cfg = loadConfig(ws);
  assert.equal(cfg.cutApprovalAutoTier.maxPriority, "P1", "a genuinely valid priority string must pass through unmodified");
});

test("T-E5-02 config: maxPriority missing the 'P' prefix falls back to the default", () => {
  const ws = mkWorkspace();
  writeConfig(ws, { cutApprovalAutoTier: { maxPriority: "3" } });
  const cfg = loadConfig(ws);
  assert.equal(cfg.cutApprovalAutoTier.maxPriority, "P3");
});

test("T-E5-02 config: maxPriority with trailing whitespace ('P3 ') falls back to the default — pattern is anchored", () => {
  const ws = mkWorkspace();
  writeConfig(ws, { cutApprovalAutoTier: { maxPriority: "P3 " } });
  const cfg = loadConfig(ws);
  assert.equal(cfg.cutApprovalAutoTier.maxPriority, "P3");
});

test("T-E5-02 config: non-digit maxPriority ('PX') falls back to the default", () => {
  const ws = mkWorkspace();
  writeConfig(ws, { cutApprovalAutoTier: { maxPriority: "PX" } });
  const cfg = loadConfig(ws);
  assert.equal(cfg.cutApprovalAutoTier.maxPriority, "P3");
});

// ---------- allowSchemaChange / allowDesignArmed: strict === true ----------

test("T-E5-02 config: allowSchemaChange/allowDesignArmed accept only the literal boolean true", () => {
  const ws = mkWorkspace();
  writeConfig(ws, { cutApprovalAutoTier: { allowSchemaChange: true, allowDesignArmed: true } });
  const cfg = loadConfig(ws);
  assert.equal(cfg.cutApprovalAutoTier.allowSchemaChange, true);
  assert.equal(cfg.cutApprovalAutoTier.allowDesignArmed, true);
});

test("T-E5-02 config: truthy-but-not-true values ('true' string, 1, {}) for allowSchemaChange/allowDesignArmed stay false — no coercion", () => {
  const ws = mkWorkspace();
  writeConfig(ws, { cutApprovalAutoTier: { allowSchemaChange: "true", allowDesignArmed: 1 } });
  const cfg = loadConfig(ws);
  assert.equal(
    cfg.cutApprovalAutoTier.allowSchemaChange,
    false,
    "a truthy non-boolean must NOT arm schema-change auto-approval — this is the safety-critical direction (fail closed)",
  );
  assert.equal(
    cfg.cutApprovalAutoTier.allowDesignArmed,
    false,
    "a truthy non-boolean must NOT arm design-armed auto-approval — this is the safety-critical direction (fail closed)",
  );
});

// ---------- CUT_APPROVAL_AUTO_TIER_DEFAULTS export shape ----------

test("T-E5-02 config: CUT_APPROVAL_AUTO_TIER_DEFAULTS export has the exact conservative shape documented in docs/config.md", () => {
  assert.deepEqual(
    CUT_APPROVAL_AUTO_TIER_DEFAULTS,
    { maxFiles: 2, maxPriority: "P3", allowSchemaChange: false, allowDesignArmed: false },
    "the exported defaults constant is the single source of truth loadConfig falls back to per-field; " +
      "it must match docs/config.md's documented table exactly",
  );
});

// ---------- byte-identical regression for workspaces without the key ----------

test("T-E5-02 config: existing config fields are untouched when cutApprovalAutoTier is absent (no key manufactured out of thin air)", () => {
  const ws = mkWorkspace();
  writeConfig(ws, {
    taskPattern: "^- \\[([ x])\\] (\\S+)\\s+(.+)$",
    taskPaths: ["a.md", "b.md"],
  });
  const cfg = loadConfig(ws);
  assert.equal(cfg.taskPattern, "^- \\[([ x])\\] (\\S+)\\s+(.+)$");
  assert.deepEqual(cfg.taskPaths, ["a.md", "b.md"]);
  assert.equal(cfg.cutApprovalAutoTier, undefined);
  assert.deepEqual(
    Object.keys(cfg).sort(),
    ["taskPattern", "taskPaths"].sort(),
    "typed view must carry exactly the pre-feature key set — no stray cutApprovalAutoTier key even as undefined",
  );
});

// ===========================================================================
// Content pins — const-08 / coord-03 / coord-07 (mirrors the E16
// charter-pinning convention, test/e16-judge-dispatch-charter.test.mjs)
// ===========================================================================

function readContentFile(f) {
  return fs.readFileSync(path.join(ROOT, "content", f), "utf-8");
}

const CONST08 = readContentFile("const-08-chain-31-mid.md");
const COORD03 = readContentFile("coord-03-core-fallback.md");
const COORD07 = readContentFile("coord-07-core-sop.md");

// ---------------------------------------------------------------------------
// const-08: Cut-Approval Auto-Tier bullet — trust rule, same-write recording
// obligation, HALT-over-threshold language, advisory-not-enforced framing.
// ---------------------------------------------------------------------------

test("T-E5-02 content: const-08 carries the Cut-Approval Auto-Tier bullet naming the Cut-Approval Gate trust rule", () => {
  assert.match(
    CONST08,
    /\*\*Cut-Approval Auto-Tier/,
    "the new bullet must exist and be named Cut-Approval Auto-Tier",
  );
  assert.match(
    CONST08,
    /the sanctioned writer \(same witness\/trust rule as the Cut-Approval Gate above\)/,
    "auto-tier must explicitly inherit the SAME sanctioned-writer trust rule as the pre-existing Cut-Approval Gate — " +
      "it must not invent a separate, weaker trust boundary",
  );
});

test("T-E5-02 content: const-08 Cut-Approval Auto-Tier requires recording the tier in the SAME write", () => {
  assert.match(
    CONST08,
    /MUST record the tier in the SAME write/,
    "the auto-approval write must be self-documenting — the tier classification must land in the identical write, not a follow-up",
  );
  assert.match(
    CONST08,
    /`cut-approved: auto-tier`/,
    "the recorded pending_notes convention must use the exact literal 'cut-approved: auto-tier' token",
  );
});

test("T-E5-02 content: const-08 Cut-Approval Auto-Tier states anything over-threshold/design-armed/unclassifiable HALTs exactly as today", () => {
  assert.match(
    CONST08,
    /Anything over-threshold, design-armed, or unclassifiable HALTs exactly as today/,
    "the bullet must explicitly foreclose auto-approval outside the threshold — the HALT default must be stated, not merely implied",
  );
});

test("T-E5-02 content: const-08 Cut-Approval Auto-Tier is opt-in (key absent = disabled) and advisory (not server-enforced)", () => {
  assert.match(
    CONST08,
    /key absent = auto-tier disabled, every cut HALTs exactly as today/,
    "absence of the config key must disable the tier entirely — no default-on behavior",
  );
  assert.match(
    CONST08,
    /Advisory, not server-enforced: the server parses and surfaces the config key but neither checks the threshold nor distinguishes an auto-tier write/,
    "the mechanism must be explicit that the server does not gate on this — coordinator/PM apply it, matching cut_approved's own trust model",
  );
});

test("T-E5-02 content: const-08 Cut-Approval Auto-Tier documents the conservative per-field defaults matching CUT_APPROVAL_AUTO_TIER_DEFAULTS", () => {
  assert.match(
    CONST08,
    /`maxFiles` 2, `maxPriority` P3, `allowSchemaChange` false, `allowDesignArmed` false/,
    "the prose-documented defaults must match the tools/config.ts CUT_APPROVAL_AUTO_TIER_DEFAULTS constant exactly — drift here would " +
      "desync the constitution's promise from the code's behavior",
  );
});

// ---------------------------------------------------------------------------
// coord-03: Backlog Intake Loop — present, and bounded so it never auto-hops
// to release-engineer.
// ---------------------------------------------------------------------------

test("T-E5-01 content: coord-03 carries the Backlog Intake Loop section", () => {
  assert.match(
    COORD03,
    /## Backlog Intake Loop/,
    "the Backlog Intake Loop must exist as its own H2 section in coord-03-core-fallback.md",
  );
  assert.match(
    COORD03,
    /run the \*Backlog Intake Loop\* below for the NEXT ticket/,
    "the PASS stop-condition row must point INTO the new loop at feature close",
  );
});

test("T-E5-01 content: Backlog Intake Loop is explicitly bounded — never auto-hops to release-engineer", () => {
  assert.match(
    COORD03,
    /this loop NEVER auto-hops to release-engineer/,
    "the loop's Bounds paragraph must explicitly foreclose auto-hopping to release-engineer — release stays a deliberate human decision " +
      "(this is the hard floor the E5 backlog row itself calls out: 'the loop never auto-hops to release-engineer')",
  );
  // Belt-and-suspenders: the same bound is also stated at the PASS
  // stop-condition row per skill-qa-engineer's own contract (loop text says
  // "stays terminal for the CURRENT feature").
  assert.match(
    COORD03,
    /PASS stays terminal for the CURRENT feature/,
    "PASS must remain terminal for the current feature even after the loop is consulted",
  );
});

test("T-E5-01 content: Backlog Intake Loop auto-starts ONLY via the §3.1 Cut-Approval Auto-Tier qualification", () => {
  assert.match(
    COORD03,
    /\*\*Auto-start\*\* ONLY when the ticket's cut qualifies for the Constitution §3\.1 Cut-Approval Auto-Tier/,
    "auto-start must be gated on the SAME §3.1 tier mechanism, not a separate/looser threshold invented in the skill layer",
  );
  assert.match(
    COORD03,
    /Otherwise \*\*auto-propose\*\*: surface the ticket \+ its one-line intake classification and wait for the human/,
    "the non-qualifying branch must fall back to surfacing + waiting — never a silent auto-start",
  );
});

// ---------------------------------------------------------------------------
// coord-07: Cheapest-Compliant-Path Intake step 4a — present, and carries the
// §2/§3.2 hard-floor sentence.
// ---------------------------------------------------------------------------

test("T-E5-03 content: coord-07 carries step 4a Cheapest-Compliant-Path Intake, numbered between steps 4 and 5", () => {
  assert.match(
    COORD07,
    /4a\. \*\*Cheapest-Compliant-Path Intake\*\*/,
    "step 4a must exist and be explicitly numbered as a sub-step of step 4 (Feature-Scope Gate), not renumber the whole SOP",
  );
  // Must classify all three phase types the backlog row (fix c) enumerates.
  assert.match(COORD07, /\(i\) coordinator-direct/, "must enumerate the coordinator-direct classification");
  assert.match(COORD07, /\(ii\) mini-chain/, "must enumerate the mini-chain classification");
  assert.match(COORD07, /\(iii\) full chain/, "must enumerate the full-chain classification");
});

test("T-E5-03 content: coord-07 step 4a states the §2/§3.2 hard floor is never bypassed by any classification", () => {
  assert.match(
    COORD07,
    /Hard floor — no classification ever bypasses it: §2 test ownership \(only qa-engineer authors tests\) and §3\.2 builder ≠ judge/,
    "the hard-floor sentence is the load-bearing safety clause of fix (c) — a cheapest-path optimization must never be able to " +
      "route around test ownership or builder/judge separation",
  );
});

test("T-E5-03 content: coord-07 step 4a proposes the cheapest compliant path by default and surfaces the classification in ONE line", () => {
  assert.match(
    COORD07,
    /Propose the cheapest compliant path by default and surface the classification to the human in ONE line/,
    "the default behavior must be to propose (not silently pick) the cheapest path, with a single-line surfaced classification",
  );
});
