// Coded by @qa-engineer
// Tests for specs/e453-served-text-v5.md AC1-AC3, AC5-AC12, AC16-AC27 (tickets E453, E454, E456, E458).
// WHY: the v5 chain (qa-engineer writes the tests, sr-engineer builds, code-reviewer judges) shipped
// with served rule text, tool descriptions and docs that still describe the old chain or disagree with
// the server: a rejection step that starts with a call that always fails, a resume check that STOPs a
// resumed review, a migration guide that leaves `agc check` failing, Limits rows that misstate the caps
// and their scope. These tests pin the rewritten text (spec `## Copy / Strings`, verbatim) and, where a
// doc makes a claim about the server, run the server or the CLI to show the claim holds.
// Each title starts with its AC id: `--test-name-pattern "AC<n>:"` runs one AC. Text checks normalise
// runs of whitespace to one space (docs wrap paragraphs). Base values are frozen literals in this file,
// never read through git.

import { test, after } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (...p) => fs.readFileSync(path.join(ROOT, ...p), "utf-8");
const imp = (...p) => import(pathToFileURL(path.join(ROOT, ...p)).href);

const { validateTransition, REVIEW_ROUND_CAP_EXPORTED } = await imp("dist", "tools", "transitions.js");
const { TOOL_REGISTRY } = await imp("dist", "tools", "registry.js");

// Served text always loses the origin markers (stripOriginTags runs in every mode), so checks read
// content with them removed.
const stripOrigin = (t) => t.replace(/<!-- origin:start -->[\s\S]*?<!-- origin:end -->/g, "");
const served = (f) => stripOrigin(read("content", f));
const norm = (s) => s.replace(/\s+/g, " ");
const has = (hay, needle) => norm(hay).includes(norm(needle));
const lines = (t) => t.split("\n");
const lineStarting = (t, prefix) => {
  const hits = lines(t).filter((l) => l.startsWith(prefix));
  assert.equal(hits.length, 1, `exactly one line starts with: ${prefix}`);
  return hits[0];
};
const cells = (row) => row.split("|").slice(1, -1).map((c) => c.trim());
// Markdown section: from its heading line to the next `## ` heading (exclusive).
const section = (t, heading) => {
  const ls = lines(t);
  const at = ls.findIndex((l) => l.startsWith(heading));
  assert.ok(at >= 0, `section heading present: ${heading}`);
  const end = ls.findIndex((l, i) => i > at && l.startsWith("## "));
  return ls.slice(at + 1, end < 0 ? ls.length : end).join("\n");
};
const CONTENT_FILES = () => fs.readdirSync(path.join(ROOT, "content")).filter((f) => f.endsWith(".md")).sort();

// ------------------------------------------------------------------ Copy / Strings (spec, verbatim)

const COPY = {
  "cr.step1": "1. `tw_get_state` → `tw_detect_drift`. Confirm the previous tuple is `(sr-engineer, In_Progress)`, a pm write whose `resume_of` names you, `(code-reviewer, Blocked)`, or your own `(code-reviewer, In_Progress)` claim or checkpoint (a resumed review: re-read the inputs and continue from the step its note names). If not, STOP — coordinator routed wrong.",
  "cr.reject_head": "- **Rejection rows**: `tw_update_state(status=FAIL, agent_id=\"code-reviewer\", review_verdict=\"CHANGES_REQUESTED\", review_task_ids=[<ids>], qa_review=\"<findings>\", qa_suite_result, blocking_reason=\"<one line>\")` with `next_role` by cause and no `completed_tasks`;",
  "cr.reject_rollback": "A task is marked `[x]` only after PASS, so a rejected id normally has nothing to roll back; only for a rejected id the task list already shows `[x]`, run `tw_rollback_task(<task-id>, <reason>)` first.",
  "rv.row_widget": "Implementation defect: `tw_update_state(status=FAIL, agent_id=\"code-reviewer\", review_verdict=\"CHANGES_REQUESTED\", review_task_ids=[<task-id>], qa_review=<missing widgets>, next_role=\"sr-engineer\")`. STOP.",
  "rv.row_drift": "Implementation defect: `tw_update_state(status=FAIL, agent_id=\"code-reviewer\", review_verdict=\"CHANGES_REQUESTED\", review_task_ids=[<task-id>], qa_review=<diff>, next_role=\"sr-engineer\")`. STOP.",
  "rv.row_check": "Check defect: `tw_update_state(status=FAIL, agent_id=\"code-reviewer\", review_verdict=\"CHANGES_REQUESTED\", review_task_ids=[<task-id>], qa_review=<check + defect>, next_role=\"qa-engineer\")`. STOP.",
  "limits.review_round.value": "4",
  "limits.review_round.meaning": "After the 4th code-reviewer CHANGES_REQUESTED, only pm may take the feature.",
  "limits.sr_return.meaning": "Max sr-engineer returns to qa-engineer between two `(pm, In_Progress)` writes; past it only that return is rejected. File mode only: SQLite/HTTP mode counts no returns.",
  "limits.hop.meaning": "Max auto-routing role transitions per feature; only an `active_feature` change resets the count (lite mode exempt).",
  "c15.hop": "- **Auto-routing hop cap**: per feature, across `/teamwork` sessions, role transitions are capped at the `hop` cap. Stop conditions: `skill-coordinator` §Escalation Routes. Lite mode is exempt (no auto-routing).",
  "c06.sr_return": "- Each code-reviewer rejection counts once in `review_round`, whichever role it routes to; each `(sr-engineer, In_Progress) → (qa-engineer, In_Progress)` return counts toward the `sr_return` cap, past which that return is rejected until the next `(pm, In_Progress)` write resets the count (file mode only).",
  "c12.sr_return": "Each sr-engineer return to qa-engineer counts toward the `sr_return` cap, past which that return is rejected until pm re-enters (file mode only); a scenario that cannot be built stops to pm (Blocked), never to qa-engineer.",
  "sr.read_count": "DO first read `sr_return_count` from `tw_get_state` (absent means 0; SQLite/HTTP mode never counts returns, so there the cap is not enforced) and compare it with the `sr_return` cap",
  "sr.cap_tail": "The server checks the cap on qa-engineer's claim of the return edge, not on your write: past it, that claim is rejected with `SR_RETURN_CAP_EXCEEDED` until a `(pm, In_Progress)` write resets the count.",
  "sr.repro_escape": "escalate `status=Blocked` to pm per *Escalation Routes: scenario cannot be built* (the Blocked edge is never gated)",
  "tr.comment394": "// pm) — symmetric to REVIEW_ROUND_CAP=4 (4 fails, then only pm). Constitution",
  "arch.review_round_cap": "4 (after the 4th FAIL only pm)",
  "arch.autoroute": "Auto-routing in full mode: after each role's handoff, the coordinator dispatches the role named in the `next_role` field (a subagent, or `tw_switch_role(<next_role>)` as the fallback). It yields to the human on `Blocked`, on `PASS`, when the `next_role` field is absent, and when `hop_count` reaches the `hop` cap (14 per feature). Opt-out via `AGC_AUTO_ROUTE=0`.",
  "config.caveat_skill": "e.g. removing the PASS-evidence step from `skill-code-reviewer.md` does NOT lift the gate — the server still rejects a code-reviewer PASS that carries no `qa_review` when no `qa_reports/review_<id>.md` exists.",
  "mig.schema": "- **Handoff schema 15 → 17** (v4.23.0 writes 15), migrated lazily on first read: `qa_round` and `qa_rounds_total` (and a pre-release `chain_path`) are dropped, and the new `sr_return_count` counter starts absent (read as 0). A `chain_path` sent by an old client is ignored. Nothing else in the handoff changes.",
  "mig.mixed_servers": "- **Upgrade every server that shares a workspace.** Once a v5 server has written a file-mode `handoff.md` at schema 17, an older server (v4.23.0 reads up to 15) refuses it as written by a newer server. Restart every MCP client on v5 before the first write.",
  "mig.sr_return": "- The `sr_return` cap (2 sr-engineer → qa-engineer returns) applies to every file-mode feature. The count resets on every `pm:In_Progress` write, and the cap closes only that return edge: sr-engineer can still hand to code-reviewer or stop to pm.",
  "mig.row_sr_ip": ["`sr-engineer:In_Progress`", "Continue to code-reviewer."],
  "mig.row_sr_blocked": ["`sr-engineer:Blocked`", "Write `sr-engineer:In_Progress` first, then continue to code-reviewer (`sr-engineer:Blocked → code-reviewer:In_Progress` is rejected)."],
  "mig.restamp": "Run `agc init` (or `agc check` to see what is stale). It updates the agc block, and its `agc-version` stamp, in `CLAUDE.md` only. An existing `AGENTS.md` or `.antigravityrules` is left as it is (`agc init` prints `Skipped (already exists)`): bump the `agc-version:` line in each by hand to the installed version, or delete the file and re-run `agc init`. Deleting and re-running writes a fresh copy from the template, so any local edits in that file are lost. Then run `agc check`; it must exit 0.",
  "mig.sqlite_checks": "Two build-entry checks run in file mode only: `CUT_APPROVAL_REQUIRED` and `EXTERNAL_REFS_UNRESOLVED` (`SCOPE_DECISION_REQUIRED` and `SOURCE_CREDIBILITY_UNVERIFIED` run in every mode). The expected-red manifest check on the qa-engineer → sr-engineer hand-off (`REPRO_MANIFEST_MISSING`) is file mode only too.",
  "coord01.row_impl": "`sr-engineer`, reached through a pm-stamped opening write and `qa-engineer` (*Cheapest-Compliant-Path Intake* mini-chain)",
  "coord01.row_review": "`code-reviewer`, after `sr-engineer` or alone through the single-role judge dispatch (Constitution §3.1)",
  "coord01.row_test": "`qa-engineer`, reached through a pm-stamped opening write (*Cheapest-Compliant-Path Intake* mini-chain)",
  "integ.builder": "- **a builder** — no feature code, no tests (§2 *Test ownership*: test files belong to qa-engineer, apart from that rule's two narrow carve-outs).",
  "coord05.dispatch": "When dispatching `reviewer-visual` (subagent-dispatch tool only; `tw_switch_role` has no `reviewer-visual` role, so that fallback switches to `code-reviewer`, whose SOP loads the visual rules) — picked over",
  "coord05.void": "  authored accept-policy is void: the judge ignores it, and no server check detects it (no prose inspection).",
  "reg.cut_approved": "to clear the CUT_APPROVAL_REQUIRED gate before routing to architect/qa-engineer.",
  "reg.external_refs": "blocks the pm:In_Progress → {architect,qa-engineer}:In_Progress build-entry hop (EXTERNAL_REFS_UNRESOLVED).",
  "reg.dispatch_mode": "and code-reviewer's Expected-Red Diff becomes load-bearing for PASS (every manifest entry green, no red off the manifest).",
  "lp.hop_b": "(b) 剩餘工作有界、且由最後一次 code-reviewer 的 verdict 點名；",
  "lp.report_tasks": "- tasks: <每個 task id → code-reviewer verdict + 證據檔路徑>",
  "c05.builder_judge": "- **Builder ≠ judge (role-collapse guard)**: the actor that built or edited a change MUST NOT author its code-review verdict (visual verdict included) or its PASS. With no independent judge context available, the work stops at `status=Blocked` (\"awaiting an independent judge\") — never a builder-signed verdict.",
  "coord03.row39_note": "\"awaiting an independent judge\" — the builder of a surface MUST NOT author its visual verdict or PASS (builder ≠ judge, §3)",
  "rat.builder_judge": "§3, generalized to every code-review verdict and every PASS, because the same collapse",
  "da.edge": "blocks the `pm:In_Progress → {architect,qa-engineer}:In_Progress` transition",
};

// ------------------------------------------------------------------ frozen base values (commit 70d34c6)

// Check-only sites (spec D6): correct once the Limits row says 4, so they must not move.
const BASE_C08_LINE10 = "- After the `review_round` cap of code-reviewer FAILs is exhausted, only `(pm, In_Progress)` is accepted.";
const BASE_C12_LINE17 =
  "qa-engineer writes one test per ticket scenario, sr-engineer builds to those tests, and code-reviewer, the chain's judge, reviews both and writes PASS. Each code-reviewer rejection (`(code-reviewer, FAIL)`) counts once in `review_round`, whichever role it routes to; past the `review_round` cap only pm may take the feature.";
const BASE_CR_REVIEW_ROUND_SENTENCE =
  "Each rejection counts once in `review_round`, whichever role it routes to; after the `review_round` cap of FAILs only `(pm, In_Progress)` is accepted (else `REVIEW_ROUND_EXCEEDED`).";

// The 33 GateErrorCode names (gates/registry.ts `GateErrorCode` union at base).
const BASE_GATE_CODES = [
  "AGENT_ID_REQUIRED", "TRANSITION_REJECTED", "REVIEW_ROUND_EXCEEDED", "VISUAL_ROUND_EXCEEDED", "HOP_CAP_EXCEEDED",
  "SR_RETURN_CAP_EXCEEDED", "SCOPE_DECISION_REQUIRED", "CUT_APPROVAL_REQUIRED", "EXTERNAL_REFS_UNRESOLVED",
  "SOURCE_CREDIBILITY_UNVERIFIED", "FEATURE_LEASE_HELD", "LEASE_OVERRIDE_AUDIT_MISSING", "MISSING_EVIDENCE",
  "QA_COMPLETION_EVIDENCE_MISSING", "MISSING_REVIEW_EVIDENCE", "EXPECTED_RED_DIFF_MISSING", "REPRO_MANIFEST_MISSING",
  "VISUAL_BASELINES_REQUIRED", "VISUAL_EVIDENCE_MISSING", "VISUAL_WIDGETS_UNVERIFIED", "VISUAL_ASSERTIONS_REQUIRED",
  "VISUAL_REPORT_INCOMPLETE", "VISUAL_PROVENANCE_MISSING", "BASELINE_MANIFEST_MISSING", "BASELINE_PROVENANCE_INCOMPLETE",
  "PIXEL_GATE_ATTESTATION_MISSING", "REVIEW_VERDICT_STATUS_MISMATCH", "NON_JUDGE_COMPLETED_TASKS_REJECTED",
  "NON_REVIEWER_VERDICT_REJECTED", "QA_REVIEW_TARGET_REQUIRED", "AC_EXECUTION_LOG_MISSING", "PASS_TASKS_INCOMPLETE",
  "DISPATCH_PIN_TIER_REJECTED",
];

// The 37 content/*.md files at base; files not listed in BASE_CODE_SETS quote no gate code in backticks.
const BASE_CONTENT_FILES = [
  "const-01-core-head.md", "const-02-design-mvp.md", "const-03-core-surgical.md", "const-04-design-surgical.md",
  "const-05-core-standards.md", "const-06-chain-31-head.md", "const-07-design-chain-gates.md", "const-08-chain-31-mid.md",
  "const-09-design-chain-vround.md", "const-10-chain-31-tail.md", "const-11-design-chain-32.md", "const-12-chain-r10-s4.md",
  "const-13-design-chain-s4.md", "const-14-chain-end.md", "const-15-core-tail.md", "constitution-rationale.md",
  "coord-01-core-head.md", "coord-02-host-dispatch.md", "coord-03-core-fallback.md", "coord-04-host-watermark.md",
  "coord-05-core-visual-drift.md", "coord-06-host-token.md", "coord-07-core-sop.md", "partial-step1-preflight.md",
  "skill-architect.md", "skill-code-reviewer.md", "skill-coordinator-lite.md", "skill-design-auditor.md",
  "skill-doc-writer.md", "skill-integrator.md", "skill-pm.md", "skill-qa-engineer.md", "skill-release-engineer.md",
  "skill-researcher.md", "skill-reviewer-visual.md", "skill-spec-workshop.md", "skill-sr-engineer.md",
];

const BASE_CODE_SETS = {
  "const-05-core-standards.md": ["REVIEW_VERDICT_STATUS_MISMATCH"],
  "const-07-design-chain-gates.md": ["BASELINE_MANIFEST_MISSING", "BASELINE_PROVENANCE_INCOMPLETE", "VISUAL_ASSERTIONS_REQUIRED", "VISUAL_BASELINES_REQUIRED", "VISUAL_EVIDENCE_MISSING", "VISUAL_REPORT_INCOMPLETE"],
  "const-08-chain-31-mid.md": ["CUT_APPROVAL_REQUIRED", "FEATURE_LEASE_HELD", "LEASE_OVERRIDE_AUDIT_MISSING", "NON_JUDGE_COMPLETED_TASKS_REJECTED", "NON_REVIEWER_VERDICT_REJECTED", "QA_COMPLETION_EVIDENCE_MISSING", "REVIEW_VERDICT_STATUS_MISMATCH", "SCOPE_DECISION_REQUIRED"],
  "const-13-design-chain-s4.md": ["VISUAL_ASSERTIONS_REQUIRED", "VISUAL_BASELINES_REQUIRED", "VISUAL_REPORT_INCOMPLETE"],
  "const-15-core-tail.md": ["EXTERNAL_REFS_UNRESOLVED"],
  "constitution-rationale.md": ["SCOPE_DECISION_REQUIRED", "VISUAL_ASSERTIONS_REQUIRED", "VISUAL_BASELINES_REQUIRED", "VISUAL_REPORT_INCOMPLETE"],
  "coord-01-core-head.md": ["HOP_CAP_EXCEEDED"],
  "coord-02-host-dispatch.md": ["DISPATCH_PIN_TIER_REJECTED", "TRANSITION_REJECTED"],
  "coord-03-core-fallback.md": ["CUT_APPROVAL_REQUIRED", "EXTERNAL_REFS_UNRESOLVED", "FEATURE_LEASE_HELD", "HOP_CAP_EXCEEDED", "SOURCE_CREDIBILITY_UNVERIFIED"],
  "skill-code-reviewer.md": ["AC_EXECUTION_LOG_MISSING", "EXPECTED_RED_DIFF_MISSING", "MISSING_EVIDENCE", "MISSING_REVIEW_EVIDENCE", "PASS_TASKS_INCOMPLETE", "QA_COMPLETION_EVIDENCE_MISSING", "QA_REVIEW_TARGET_REQUIRED", "REVIEW_ROUND_EXCEEDED", "REVIEW_VERDICT_STATUS_MISMATCH"],
  "skill-coordinator-lite.md": ["CUT_APPROVAL_REQUIRED"],
  "skill-design-auditor.md": ["BASELINE_MANIFEST_MISSING", "BASELINE_PROVENANCE_INCOMPLETE", "SOURCE_CREDIBILITY_UNVERIFIED", "VISUAL_BASELINES_REQUIRED"],
  "skill-pm.md": ["EXTERNAL_REFS_UNRESOLVED", "SCOPE_DECISION_REQUIRED", "SOURCE_CREDIBILITY_UNVERIFIED"],
  "skill-qa-engineer.md": ["AGENT_ID_REQUIRED", "REPRO_MANIFEST_MISSING", "SR_RETURN_CAP_EXCEEDED", "TRANSITION_REJECTED"],
  "skill-release-engineer.md": ["FEATURE_LEASE_HELD"],
  "skill-reviewer-visual.md": ["BASELINE_MANIFEST_MISSING", "BASELINE_PROVENANCE_INCOMPLETE", "PIXEL_GATE_ATTESTATION_MISSING", "VISUAL_EVIDENCE_MISSING", "VISUAL_PROVENANCE_MISSING", "VISUAL_REPORT_INCOMPLETE", "VISUAL_WIDGETS_UNVERIFIED"],
  "skill-sr-engineer.md": ["REPRO_MANIFEST_MISSING", "SR_RETURN_CAP_EXCEEDED"],
};

// TOOL_REGISTRY shape at base: names, input-schema property keys, and every enum (nested path).
const DISPATCH_TIERS = ["opus", "sonnet", "haiku", "fable"];
const BASE_TOOL_SHAPE = [
  { name: "tw_get_state", keys: ["workspace_path"] },
  {
    name: "tw_update_state",
    keys: ["workspace_path", "active_feature", "status", "completed_tasks", "pending_notes", "blocking_reason", "agent_id", "qa_review", "qa_suite_result", "review_task_ids", "prd_path", "scope_decision", "scope_decision_why", "cut_approved", "external_refs", "next_role", "resume_of", "review_verdict", "dispatch_pins", "dispatch_mode", "cut_approved_source", "dispatch_mechanism", "dispatch_mechanism_tier", "lease_override"],
    enums: {
      status: ["In_Progress", "PASS", "FAIL", "Blocked"],
      scope_decision: ["single-feature"],
      "external_refs[].state": ["fetched", "indexed", "user-confirmed-ignorable", "unresolved"],
      next_role: ["pm", "researcher", "design-auditor", "architect", "sr-engineer", "code-reviewer", "qa-engineer", "release-engineer"],
      resume_of: ["code-reviewer"],
      review_verdict: ["APPROVED", "CHANGES_REQUESTED"],
      "dispatch_pins.pm": DISPATCH_TIERS,
      "dispatch_pins.researcher": DISPATCH_TIERS,
      "dispatch_pins.design-auditor": DISPATCH_TIERS,
      "dispatch_pins.architect": DISPATCH_TIERS,
      "dispatch_pins.sr-engineer": DISPATCH_TIERS,
      "dispatch_pins.code-reviewer": DISPATCH_TIERS,
      "dispatch_pins.qa-engineer": DISPATCH_TIERS,
      "dispatch_pins.release-engineer": DISPATCH_TIERS,
      dispatch_mode: ["feature", "bugfix"],
      dispatch_mechanism: ["task", "switch_role", "inline"],
    },
  },
  { name: "tw_get_next_task", keys: ["workspace_path"] },
  { name: "tw_complete_task", keys: ["workspace_path", "task_id", "note", "agent_id"] },
  { name: "tw_add_task", keys: ["workspace_path", "task_id", "description", "section"] },
  { name: "tw_rollback_task", keys: ["workspace_path", "task_id", "reason"] },
  { name: "tw_void_task", keys: ["workspace_path", "task_id", "reason"] },
  { name: "tw_detect_drift", keys: ["workspace_path"] },
  { name: "tw_sync", keys: ["workspace_path"] },
  { name: "tw_switch_role", keys: ["workspace_path", "role"], enums: { role: ["pm", "researcher", "design-auditor", "sr-engineer", "code-reviewer", "qa-engineer", "architect", "doc-writer", "release-engineer", "coordinator"] } },
  { name: "tw_index_prd", keys: ["workspace_path", "prd_path", "embedding_model"] },
  { name: "tw_clear_prd_chunks", keys: ["workspace_path"] },
  { name: "tw_gate_stats", keys: ["workspace_path"] },
];

const tmpDirs = [];
after(() => {
  for (const d of tmpDirs) {
    try { fs.rmSync(d, { recursive: true, force: true }); } catch { /* best effort */ }
  }
});

// ================================================================== E453 — code-reviewer rejection and resume

test("AC1: code-reviewer Rejection rows bullet starts with the FAIL write and rolls back only an id the task list already shows [x]", () => {
  // WHY: a task is marked [x] only after PASS, so an unconditional tw_rollback_task as the first action of a
  // rejection fails on every not-yet-passed id; the rollback must be limited to ids that really are [x].
  const cr = served("skill-code-reviewer.md");
  const bullet = lineStarting(cr, "- **Rejection rows**:");
  assert.ok(bullet.startsWith(COPY["cr.reject_head"]), "the bullet opens with cr.reject_head (the FAIL write first)");
  assert.ok(!bullet.includes("`tw_rollback_task(<task-id>, <reason>)` per rejected id"), "no unconditional per-id rollback");
  assert.ok(bullet.includes(COPY["cr.reject_rollback"]), "cr.reject_rollback present");
  const target = bullet.indexOf("`QA_REVIEW_TARGET_REQUIRED`");
  const rollback = bullet.indexOf(COPY["cr.reject_rollback"]);
  const counts = bullet.indexOf("Each rejection counts once");
  assert.ok(target >= 0 && target < rollback, "cr.reject_rollback follows the QA_REVIEW_TARGET_REQUIRED sentence");
  assert.ok(counts > rollback, "cr.reject_rollback precedes 'Each rejection counts once'");
  for (const code of ["`QA_REVIEW_TARGET_REQUIRED`", "`REVIEW_ROUND_EXCEEDED`"]) {
    assert.ok(bullet.includes(code), `the bullet keeps ${code}`);
  }
});

test("AC2: code-reviewer step 1 accepts sr-engineer In_Progress, the pm resume_of write, its own Blocked, claim and checkpoint, and STOPs otherwise", () => {
  // WHY: a crash-resumed review finds its own (code-reviewer, In_Progress) claim/checkpoint or a Blocked write
  // as the previous tuple; a step 1 that STOPs on those strands every resumed review.
  const cr = served("skill-code-reviewer.md");
  const step1 = lineStarting(cr, "1. `tw_get_state` → `tw_detect_drift`.");
  assert.equal(step1, COPY["cr.step1"], "step 1 is cr.step1 verbatim");
  for (const t of ["`(sr-engineer, In_Progress)`", "`resume_of` names you", "`(code-reviewer, Blocked)`", "`(code-reviewer, In_Progress)` claim or checkpoint"]) {
    assert.ok(step1.includes(t), `step 1 accepts ${t}`);
  }
  assert.ok(step1.includes("If not, STOP — coordinator routed wrong."), "anything else still STOPs");
});

test("AC3: reviewer-visual rejection rows carry no tw_rollback_task; widget, drift and check-defect rows are the FAIL write alone", () => {
  // WHY: the visual sub-skill copied the same always-failing rollback prefix into its STOP actions.
  const rv = served("skill-reviewer-visual.md");
  assert.ok(!rv.includes("tw_rollback_task"), "no tw_rollback_task anywhere in the visual sub-skill");
  const row = (prefix) => cells(lineStarting(rv, prefix));
  const widget = row("| Widget shape miss");
  assert.equal(widget[2], COPY["rv.row_widget"], "widget-shape row STOP action is rv.row_widget");
  assert.equal(widget[1], "`VISUAL_WIDGETS_UNVERIFIED`", "the widget row keeps its error code");
  assert.equal(row("| Material drift")[2], COPY["rv.row_drift"], "material-drift row STOP action is rv.row_drift");
  assert.equal(row("| Check defect")[2], COPY["rv.row_check"], "check-defect row STOP action is rv.row_check");
});

// ================================================================== E454 — migration guide

test("AC5: migration guide re-stamp section is mig.restamp, and following it on a 4.0.0-stamped workspace ends with agc check exit 0", () => {
  // WHY: `agc init` refreshes only the CLAUDE.md block; AGENTS.md and .antigravityrules are skip-if-exists, so a
  // guide that says init re-stamps all three leaves the adopter failing `agc check`. Run the steps for real.
  const installed = JSON.parse(read("package.json")).version;
  const ws = fs.mkdtempSync(path.join(os.tmpdir(), "e453-ac5-"));
  tmpDirs.push(ws);
  const agc = (...args) => spawnSync(process.execPath, [path.join(ROOT, "bin", "agc-init.mjs"), ...args], { cwd: ws, encoding: "utf-8" });
  fs.writeFileSync(path.join(ws, "CLAUDE.md"), "<!-- BEGIN agc-adapter -->\n<!-- agc-version: 4.0.0 -->\nold block\n<!-- END agc-adapter -->\n");
  fs.writeFileSync(path.join(ws, "AGENTS.md"), "# agc-version: 4.0.0\n# a local edit\n");
  fs.writeFileSync(path.join(ws, ".antigravityrules"), "# agc-version: 4.0.0\n# a local edit\n");

  const init = agc("init");
  assert.equal(init.status, 0, `agc init exits 0 (stderr=${init.stderr})`);
  assert.ok(init.stdout.includes("Skipped (already exists): AGENTS.md, .antigravityrules"), `init skips the two files: ${init.stdout}`);
  assert.equal(agc("check").status, 1, "check exits 1 while AGENTS.md / .antigravityrules still carry 4.0.0");
  for (const f of ["AGENTS.md", ".antigravityrules"]) {
    const p = path.join(ws, f);
    fs.writeFileSync(p, fs.readFileSync(p, "utf-8").replace("agc-version: 4.0.0", `agc-version: ${installed}`));
  }
  const check = agc("check");
  assert.equal(check.status, 0, `check exits 0 after the hand bump (stderr=${check.stderr})`);

  const body = norm(section(read("docs", "migration-v5.md"), "## Re-stamp `agc-version`")).trim();
  assert.equal(body, COPY["mig.restamp"], "the Re-stamp section is mig.restamp");
});

test("AC6: migration guide splits the sr-engineer row into In_Progress and Blocked, and validateTransition agrees", () => {
  // WHY: `sr-engineer:Blocked → code-reviewer:In_Progress` is not an edge; a single `sr-engineer:*` row offers it.
  const table = section(read("docs", "migration-v5.md"), "## A feature mid-flight on the old path");
  const rows = lines(table).filter((l) => l.startsWith("|")).map(cells);
  assert.ok(!rows.some((c) => c[0] === "`sr-engineer:*`"), "no `sr-engineer:*` row");
  const ip = rows.find((c) => c[0] === COPY["mig.row_sr_ip"][0]);
  const bl = rows.find((c) => c[0] === COPY["mig.row_sr_blocked"][0]);
  assert.deepEqual(ip, COPY["mig.row_sr_ip"], "sr-engineer:In_Progress row is mig.row_sr_ip");
  assert.deepEqual(bl, COPY["mig.row_sr_blocked"], "sr-engineer:Blocked row is mig.row_sr_blocked");

  const req = (pa, ps, na, ns) => validateTransition({ prev: { agent: pa, status: ps }, next: { agent: na, status: ns }, prev_review_round: 0 });
  assert.notEqual(req("sr-engineer", "Blocked", "code-reviewer", "In_Progress"), null, "sr-engineer:Blocked → code-reviewer:In_Progress is rejected");
  assert.equal(req("sr-engineer", "Blocked", "sr-engineer", "In_Progress"), null, "sr-engineer:Blocked → sr-engineer:In_Progress is accepted");
  assert.equal(req("sr-engineer", "In_Progress", "code-reviewer", "In_Progress"), null, "sr-engineer:In_Progress → code-reviewer:In_Progress is accepted");
});

test("AC7: migration guide SQLite / HTTP section names the file-mode-only checks (mig.sqlite_checks) and not the old/new server mix", () => {
  // WHY: only CUT_APPROVAL_REQUIRED, EXTERNAL_REFS_UNRESOLVED and the manifest check are file-mode only; the
  // mixed-server risk is a file-mode handoff.md risk and does not belong in the SQLite section.
  const sec = section(read("docs", "migration-v5.md"), "## SQLite / HTTP mode");
  assert.ok(has(sec, COPY["mig.sqlite_checks"]), "the section carries mig.sqlite_checks");
  for (const s of ["older server", "v4.23.0", "Upgrade every server", "newer server"]) {
    assert.ok(!has(sec, s), `the SQLite section does not mention the server mix: ${s}`);
  }
});

test("AC8: migration guide What changed has the schema 15 → 17 bullet and the mixed-servers bullet, outside the SQLite section", () => {
  // WHY: v4.23.0 writes schema 15 (not 16), and an older server refuses a schema 17 handoff.md.
  const doc = read("docs", "migration-v5.md");
  const changed = section(doc, "## What changed");
  assert.ok(has(changed, COPY["mig.schema"]), "What changed carries mig.schema");
  assert.ok(!has(doc, "Handoff schema 16 → 17"), "no 16 → 17");
  assert.ok(has(changed, COPY["mig.mixed_servers"]), "What changed carries mig.mixed_servers");
  assert.ok(!has(section(doc, "## SQLite / HTTP mode"), COPY["mig.mixed_servers"]), "mig.mixed_servers is not in the SQLite section");
});

// ================================================================== E456 — limits and their scope

test("AC9: review_round cap row says 4 (equal to the server cap) with limits.review_round.meaning; architecture row and transitions comment agree; check-only sites unchanged", () => {
  // WHY: the server allows 4 code-reviewer FAILs before only pm may write (human ruling 2026-11-25); the table said 3.
  const c01 = served("const-01-core-head.md");
  const row = cells(lineStarting(c01, "| `review_round` cap"));
  assert.equal(row[1], COPY["limits.review_round.value"], "value 4");
  assert.equal(Number(row[1]), REVIEW_ROUND_CAP_EXPORTED, "the Limits value equals REVIEW_ROUND_CAP_EXPORTED");
  assert.equal(row[2], COPY["limits.review_round.meaning"], "meaning is limits.review_round.meaning");
  const arch = cells(lineStarting(read("docs", "architecture.md"), "| `review_round` |"));
  assert.equal(arch[1], COPY["arch.review_round_cap"], "architecture round-counter FAIL cap is arch.review_round_cap");
  assert.ok(lines(read("tools", "transitions.ts")).some((l) => l.trim() === COPY["tr.comment394"]), "transitions.ts comment is tr.comment394");
  // D6 check-only sites
  assert.ok(lines(served("const-08-chain-31-mid.md")).includes(BASE_C08_LINE10), "const-08 cap line unchanged");
  assert.ok(lines(served("const-12-chain-r10-s4.md")).includes(BASE_C12_LINE17), "const-12 review_round line unchanged");
  assert.ok(lineStarting(served("skill-code-reviewer.md"), "- **Rejection rows**:").includes(BASE_CR_REVIEW_ROUND_SENTENCE), "code-reviewer review_round sentence unchanged");
});

test("AC10: hop cap is stated per feature (reset only by an active_feature change) in Limits, const-15 and the architecture auto-routing paragraph", () => {
  // WHY: the server counts hop_count per feature across sessions; "per /teamwork session" tells roles it resets.
  for (const f of CONTENT_FILES()) {
    assert.ok(!has(served(f), "per `/teamwork` session"), `${f} does not say per \`/teamwork\` session`);
  }
  const row = cells(lineStarting(served("const-01-core-head.md"), "| `hop` cap"));
  assert.equal(row[2], COPY["limits.hop.meaning"], "hop row meaning is limits.hop.meaning");
  assert.equal(lineStarting(served("const-15-core-tail.md"), "- **Auto-routing hop cap**"), COPY["c15.hop"], "const-15 hop line is c15.hop");
  const arch = read("docs", "architecture.md");
  assert.ok(has(arch, COPY["arch.autoroute"]), "architecture carries arch.autoroute");
  assert.ok(!has(arch, "hop counter ≥ 10"), "no hop counter ≥ 10");
  assert.ok(!arch.includes("pending_notes.next_role"), "no pending_notes.next_role");
});

test("AC11: sr_return cap is stated as closing only the sr-engineer → qa-engineer return until the next pm In_Progress write, at every site", () => {
  // WHY: past the sr_return cap the server rejects only the return edge; sr-engineer can still hand to code-reviewer
  // or stop to pm, and a (pm, In_Progress) write resets the count. "routing locks to pm" overstates it.
  const c01 = served("const-01-core-head.md");
  const sites = [
    ["const-01 Limits row", cells(lineStarting(c01, "| `sr_return` cap"))[2], COPY["limits.sr_return.meaning"], "equal"],
    ["const-06", served("const-06-chain-31-head.md"), COPY["c06.sr_return"], "line"],
    ["const-12", served("const-12-chain-r10-s4.md"), COPY["c12.sr_return"], "line"],
    ["sr SOP step 4c", served("skill-sr-engineer.md"), COPY["sr.cap_tail"], "line"],
  ];
  for (const [name, text, copy, mode] of sites) {
    let site;
    if (mode === "equal") {
      assert.equal(text, copy, `${name} is the Copy text`);
      site = text;
    } else {
      site = lines(text).find((l) => l.includes(copy));
      assert.ok(site, `${name} carries: ${copy}`);
    }
    assert.ok(!site.includes("routing locks to pm"), `${name}: no 'routing locks to pm'`);
    assert.ok(!/only (pm|`\(pm, In_Progress\)`) may take the feature/.test(site), `${name}: sr_return does not hand the feature to pm only`);
  }
  const mig = read("docs", "migration-v5.md");
  assert.ok(has(mig, COPY["mig.sr_return"]), "migration guide carries mig.sr_return");
  assert.ok(!has(mig, "2 per feature"), "migration guide no longer says 2 per feature");
  for (const f of CONTENT_FILES()) assert.ok(!served(f).includes("routing locks to pm"), `${f}: no 'routing locks to pm'`);
  assert.ok(served("const-12-chain-r10-s4.md").includes("past the `review_round` cap only pm may take the feature"), "const-12 review_round sentence keeps its pm-only wording");
});

test("AC12: the sr_return Limits row and sr-engineer step 4c say SQLite/HTTP mode counts no returns", () => {
  // WHY: SQLite never persists sr_return_count, so the cap is not enforced there; served text must not imply it is.
  const row = cells(lineStarting(served("const-01-core-head.md"), "| `sr_return` cap"));
  assert.equal(row[2], COPY["limits.sr_return.meaning"], "sr_return row meaning is limits.sr_return.meaning");
  assert.ok(row[2].includes("SQLite/HTTP mode counts no returns"), "the row names the SQLite/HTTP rule");
  const step4c = lineStarting(served("skill-sr-engineer.md"), "4c. **Return routes**");
  assert.ok(step4c.includes(COPY["sr.read_count"]), "step 4c carries sr.read_count");
});

// ================================================================== E458 — leftover old-chain wording

test("AC16: coordinator routing-table rows for implement / review / test name the pm-stamped entry and the judge dispatch", () => {
  // WHY: on the v5 chain implement and test are reached through a pm-stamped opening write; review is code-reviewer
  // after sr-engineer or alone through the single-role judge dispatch. A bare role cell invites a direct dispatch.
  const c01 = served("coord-01-core-head.md");
  assert.equal(cells(lineStarting(c01, "| implement, fix, refactor, add feature |"))[1], COPY["coord01.row_impl"], "implement row");
  assert.equal(cells(lineStarting(c01, "| review, code review, judge diff, verify, validate, rollback |"))[1], COPY["coord01.row_review"], "review row");
  assert.equal(cells(lineStarting(c01, "| test, write tests, test authoring |"))[1], COPY["coord01.row_test"], "test row");
});

test("AC17: integrator 'a builder' item is integ.builder (both §2 carve-outs by reference)", () => {
  // WHY: "only qa-engineer touches test/" contradicts §2's two carve-outs (import path, bugfix repro).
  const integ = served("skill-integrator.md");
  assert.equal(lineStarting(integ, "- **a builder**"), COPY["integ.builder"], "the item is integ.builder");
  assert.ok(!integ.includes("only qa-engineer touches `test/`"), "old wording gone");
});

test("AC18: coord-05 dispatch parenthetical is coord05.dispatch and the void sentence is coord05.void", () => {
  // WHY: tw_switch_role has no reviewer-visual role, and no server check reads a coordinator brief's prose.
  const c05 = served("coord-05-core-visual-drift.md");
  const dl = lineStarting(c05, "- **No accept-policy injection.**");
  assert.ok(dl.startsWith(`- **No accept-policy injection.** ${COPY["coord05.dispatch"]} \`code-reviewer\` for the judge hop`), "dispatch line opens with coord05.dispatch, rest unchanged");
  assert.ok(!c05.includes("(subagent-dispatch tool or `tw_switch_role`)"), "old parenthetical gone");
  assert.ok(lines(c05).includes(COPY["coord05.void"]), "void line is coord05.void");
  assert.ok(!has(c05, "the server will reject the resulting PASS"), "no server-rejects claim");
});

test("AC19: sr-engineer step 3b infeasible-repro escape routes per Escalation Routes: scenario cannot be built", () => {
  // WHY: there is no "awaiting clarification" route in the sr SOP; the escape must name a row that exists.
  const sr = served("skill-sr-engineer.md");
  const step3b = lineStarting(sr, "3b. **Repro-First (bugfix mode)**");
  assert.ok(step3b.includes(COPY["sr.repro_escape"]), "step 3b carries sr.repro_escape");
  assert.ok(!step3b.includes("*Escalation Routes: awaiting clarification*"), "no awaiting-clarification route");
  const routes = sr.slice(sr.indexOf("## Escalation Routes"));
  assert.ok(routes.includes("scenario cannot be built"), "the named route exists in Escalation Routes");
});

test("AC20: tw_update_state descriptions of cut_approved, external_refs and dispatch_mode name the v5 build entry and the judge; no tw_* description names the old entry or Phase 0.5", () => {
  // WHY: tool descriptions are read by every client; the build entry is pm → {architect, qa-engineer} and the
  // bugfix proof is code-reviewer's Expected-Red Diff, not a qa Phase 0.5.
  const upd = TOOL_REGISTRY.find((t) => t.name === "tw_update_state");
  const props = upd.inputSchema.properties;
  assert.ok(props.cut_approved.description.includes(COPY["reg.cut_approved"]), "cut_approved carries reg.cut_approved");
  assert.ok(props.external_refs.description.includes(COPY["reg.external_refs"]), "external_refs carries reg.external_refs");
  assert.ok(props.dispatch_mode.description.includes(COPY["reg.dispatch_mode"]), "dispatch_mode carries reg.dispatch_mode");
  const descs = [];
  const walk = (o) => {
    if (!o || typeof o !== "object") return;
    for (const [k, v] of Object.entries(o)) {
      if (k === "description" && typeof v === "string") descs.push(v);
      else walk(v);
    }
  };
  for (const t of TOOL_REGISTRY) {
    descs.push(t.description);
    walk(t.inputSchema);
  }
  for (const d of descs) {
    for (const bad of ["architect/sr-engineer", "{architect,sr-engineer}", "Phase 0.5"]) {
      assert.ok(!d.includes(bad), `a tw_* description contains ${bad}: ${d.slice(0, 120)}`);
    }
  }
});

test("AC21: docs/config.md skill-override caveat names the code-reviewer PASS evidence (config.caveat_skill)", () => {
  const cfg = read("docs", "config.md");
  assert.ok(has(cfg, COPY["config.caveat_skill"]), "config carries config.caveat_skill");
  assert.ok(!cfg.includes("evidence-of-PASS"), "no evidence-of-PASS");
});

test("AC22: lane-protocol hop-continuation (b) and the report's tasks line name the code-reviewer verdict only", () => {
  // WHY: qa-engineer writes no verdict on the v5 chain.
  const lp = read("docs", "lane-protocol.md");
  assert.ok(lp.includes(COPY["lp.hop_b"]), "hop continuation (b) is lp.hop_b");
  assert.ok(lines(lp).includes(COPY["lp.report_tasks"]), "report tasks line is lp.report_tasks");
  assert.ok(!lp.includes("code-reviewer／qa-engineer"), "no code-reviewer／qa-engineer");
  assert.ok(!lp.includes("qa verdict"), "no qa verdict");
});

test("AC23: served content names no qa verdict and no awaiting independent QA; Builder ≠ judge bullet, coord-03 row 39 note and rationale line are rewritten", () => {
  // WHY: qa-engineer is not a judge on the v5 chain; the role-collapse guard names the code-review verdict and PASS.
  for (const f of CONTENT_FILES()) {
    const t = served(f);
    assert.ok(!t.includes("qa verdict"), `${f}: no qa verdict`);
    assert.ok(!t.includes("awaiting independent QA"), `${f}: no awaiting independent QA`);
  }
  assert.equal(lineStarting(served("const-05-core-standards.md"), "- **Builder ≠ judge (role-collapse guard)**"), COPY["c05.builder_judge"], "const-05 bullet is c05.builder_judge");
  const row39 = cells(lineStarting(served("coord-03-core-fallback.md"), "| visual work complete but no independent judge context"));
  assert.equal(row39[2], COPY["coord03.row39_note"], "coord-03 row 39 note is coord03.row39_note");
  assert.ok(lines(served("constitution-rationale.md")).includes(COPY["rat.builder_judge"]), "rationale line is rat.builder_judge");
});

test("AC24: design-auditor build-entry edge reads pm:In_Progress → {architect,qa-engineer}:In_Progress; no served file names {architect,sr-engineer}", () => {
  assert.ok(served("skill-design-auditor.md").includes(COPY["da.edge"]), "design-auditor carries da.edge");
  for (const f of CONTENT_FILES()) assert.ok(!served(f).includes("{architect,sr-engineer}"), `${f}: no {architect,sr-engineer}`);
});

// ================================================================== cross-cutting

test("AC25: each content/*.md quotes the same set of GateErrorCode names in backticks as at base", () => {
  // WHY: gates/registry.ts maps each error code to the content files that quote it (checked by the error-code
  // contract tests); a text rewrite must neither add nor drop a quoted code.
  for (const f of BASE_CONTENT_FILES) {
    const p = path.join(ROOT, "content", f);
    if (!fs.existsSync(p)) assert.fail(`content/${f} existed at base and is gone`);
    const t = fs.readFileSync(p, "utf-8");
    const live = BASE_GATE_CODES.filter((c) => t.includes(`\`${c}\``)).sort();
    assert.deepEqual(live, [...(BASE_CODE_SETS[f] ?? [])].sort(), `${f}: backtick-quoted gate codes changed`);
  }
});

test("AC26: the content lines this feature changes cite no repo-only path and no bare ticket id", () => {
  // WHY: content/** ships to every adopter; a path that exists only in the agc repo or a bare `E123` is a dead
  // lead for the agent reading it.
  const SITES = [
    ["skill-code-reviewer.md", "cr.step1"], ["skill-code-reviewer.md", "cr.reject_head"], ["skill-code-reviewer.md", "cr.reject_rollback"],
    ["skill-reviewer-visual.md", "rv.row_widget"], ["skill-reviewer-visual.md", "rv.row_drift"], ["skill-reviewer-visual.md", "rv.row_check"],
    ["const-01-core-head.md", "limits.review_round.meaning"], ["const-01-core-head.md", "limits.sr_return.meaning"], ["const-01-core-head.md", "limits.hop.meaning"],
    ["const-15-core-tail.md", "c15.hop"], ["const-06-chain-31-head.md", "c06.sr_return"], ["const-12-chain-r10-s4.md", "c12.sr_return"],
    ["skill-sr-engineer.md", "sr.read_count"], ["skill-sr-engineer.md", "sr.cap_tail"], ["skill-sr-engineer.md", "sr.repro_escape"],
    ["coord-01-core-head.md", "coord01.row_impl"], ["coord-01-core-head.md", "coord01.row_review"], ["coord-01-core-head.md", "coord01.row_test"],
    ["skill-integrator.md", "integ.builder"], ["coord-05-core-visual-drift.md", "coord05.dispatch"], ["coord-05-core-visual-drift.md", "coord05.void"],
    ["const-05-core-standards.md", "c05.builder_judge"], ["coord-03-core-fallback.md", "coord03.row39_note"],
    ["constitution-rationale.md", "rat.builder_judge"], ["skill-design-auditor.md", "da.edge"],
  ];
  const REPO_ONLY = /(?<![\w/.<>-])(?:specs|research|tools|gates|test|docs|scripts|prompts|schema|bin|dist|templates|lib)\/[\w.<>*-]*/;
  const TICKET = /\bE\d+\b/;
  for (const [f, id] of SITES) {
    const hits = lines(served(f)).filter((l) => l.includes(COPY[id]));
    assert.equal(hits.length, 1, `content/${f}: ${id} lands on exactly one line`);
    const l = hits[0];
    assert.doesNotMatch(l, REPO_ONLY, `content/${f} (${id}): changed line cites a repo-only path`);
    assert.doesNotMatch(l, TICKET, `content/${f} (${id}): changed line cites a bare ticket id`);
  }
});

test("AC27: TOOL_REGISTRY names, input-schema property keys and enums equal base (descriptions are the only registry change)", () => {
  // WHY: the feature rewrites description strings only; a changed name, key or enum is a server behaviour change.
  const shape = TOOL_REGISTRY.map((t) => {
    const props = t.inputSchema.properties ?? {};
    const o = { name: t.name, keys: Object.keys(props) };
    const enums = {};
    const walk = (p, s) => {
      if (!s || typeof s !== "object") return;
      if (Array.isArray(s.enum)) enums[p] = s.enum;
      if (s.properties) for (const [k, v] of Object.entries(s.properties)) walk(`${p}.${k}`, v);
      if (s.items) walk(`${p}[]`, s.items);
    };
    for (const [k, v] of Object.entries(props)) walk(k, v);
    if (Object.keys(enums).length) o.enums = enums;
    return o;
  });
  assert.deepEqual(shape, BASE_TOOL_SHAPE);
});
