// Coded by @qa-engineer
// Tests for specs/e462-stale-comments-wording.md (tickets E462 (1)-(7) and E461 (3)): stale old-chain comments,
// the resume_of normalisation, the judge-report directory in the completion-evidence message, the new judge
// report heading, the unknown design mode reported as written with its `no-design` hint, the design-mode
// mutation guards, the spec-workshop step 4 / step 5 wording and the migration guide sentences.
// Every test title starts with its AC id and a space (`AC1 ...`), so `--test-name-pattern "^AC<n> "` selects
// exactly that AC. Strings are the spec's Copy / Strings rows, verbatim.
// AC1's transpileModule invariance half is judge-run (base text via history), never a resident test: this
// file reads HEAD text only. Base text the ACs keep is frozen below as string literals (no history read).
// Re-pin notice: FROZEN_* constants are the cut-base text of lines this ticket must not move (the HOP_CAP
// neighbour comments, the errorCode -> doc-file mapping comment, the spec-workshop SOP outside steps 4/5,
// the migration guide paragraphs). A later ticket that edits those lines on purpose re-pins them here.

import { test, after } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (...p) => fs.readFileSync(path.join(ROOT, ...p), "utf-8");
const imp = (...p) => import(path.join(ROOT, ...p));

const { hasDesignModeRequiringVisual, checkSourceCredibility } = await imp("dist", "gates", "visual.js");
const { writeHandoffState } = await imp("dist", "tools", "handoff.js");
const { markStateRead, resetSession } = await imp("dist", "guards", "session.js");
const { setActiveStorage, FileHandoffStorage } = await imp("dist", "tools", "storage.js");
const { handleUpdateState } = await imp("dist", "tools", "handoff-orchestrator.js");
const { resolveCurrentLanePaths } = await imp("dist", "tools", "lane-paths.js");
const { resolveJudgeReport } = await imp("dist", "tools", "evidence-file.js");
const { recordReviewInFile, hasPassEvidenceInFile } = await imp("dist", "gates", "qa-review.js");
const { hasEvidenceAnywhere } = await imp("dist", "tools", "evidence-lookup.js");
const { checkLaneEvidence } = await imp("dist", "tools", "lane-status.js");
const { EVIDENCE_SCHEMA_CURRENT } = await imp("dist", "gates", "evidence-schema.js");
const { GATE_REGISTRY, gate } = await imp("dist", "gates", "registry.js");
const { forceSeedStamp } = await import("./e148-seed-stamp.mjs");

// ---------------------------------------------------------------------------
// Copy / Strings (spec table), verbatim
// ---------------------------------------------------------------------------

const COPY = {
  evidenceCovers: (dir) => `(or an existing report in ${dir} covering the id via a covers: line). `,
  reportHeading: (id) => `# Review — ${id}`,
  unknownModeNote: (mode) => `"${mode}" is not a known design mode; write ` + "`no-design`" + ` if there is no design source. `,
  swReopen: "When an answer shows an earlier ruling should change, reopen that question in the next batch.",
  swDone:
    "the work is ready to cut when every scenario has one verification, every device-or-person scenario is marked, every conflict between sources has a ruling, and no " +
    "`needs prototype`" +
    " question is open.",
  migMidline:
    "- A judge report whose verdict heading an older server appended mid-line (the report had no trailing newline) is no longer read as a verdict: drift and lane-status stop crediting those ids until the heading starts its own line.",
  migReviewEvidence: "So is the PASS-time review-evidence check (" + "`MISSING_REVIEW_EVIDENCE`" + ").",
  // e453 row mig.sqlite_checks (unchanged by this ticket), quoted from test/e453-served-text-v5.test.mjs.
  migSqliteChecks:
    "Two build-entry checks run in file mode only: `CUT_APPROVAL_REQUIRED` and `EXTERNAL_REFS_UNRESOLVED` (`SCOPE_DECISION_REQUIRED` and `SOURCE_CREDIBILITY_UNVERIFIED` run in every mode). The expected-red manifest check on the qa-engineer → sr-engineer hand-off (`REPRO_MANIFEST_MISSING`) is file mode only too.",
};

// Text the ticket replaces (from the cut base), used for "gone" checks and to rebuild the expected lines.
const OLD = {
  reopen: "When an answer shows an earlier ruling should change, reopen that question in the next batch; its new ruling names the one it replaces.",
  done: "the work is ready to cut when every scenario has one verification, every device-or-person scenario is marked, and every conflict between sources has a ruling.",
  ruling: "Write each ruling to the record the moment it is made, with its date; a ruling that replaces an earlier one names the one it replaces.",
  evidenceCovers: "(or an existing qa_reports/ report covering the id via a covers: line). ",
  reportHeadingPrefix: "# QA review — ",
  resumeTernary: 'parsed.resume_of === "code-reviewer" ? "code-reviewer" : undefined',
};

// ---------------------------------------------------------------------------
// Frozen cut-base text (base 83ca8c0), generated once from the base tree and pasted here.
// ---------------------------------------------------------------------------

// tools/transitions.ts line 158 (the MIGRATION_HINT string line).
const FROZEN_TR_MIGRATION_HINT_LINE = "  \" If this feature started on the pre-v5 chain, docs/migration-v5.md says how to finish or restart it.\";";

// tools/transitions.ts lines 393-396 (the visual-round cap comment next to the HOP_CAP block).
const FROZEN_TR_VISUAL_CAP_COMMENT = [
  "// v3.14.0 — visual_round caps at 6 (5 failed pixel iterations then lock to",
  "// pm) — symmetric to REVIEW_ROUND_CAP=4 (4 fails, then only pm). Constitution",
  "// §3.1 documents the user-visible \"5 rounds\" framing; cap=6 reflects the",
  "// off-by-one between \"rounds completed\" and \"next write index\"."
];

// gates/registry.ts lines 75-108 (the errorCode -> doc-file mapping comment).
const FROZEN_REG_MAPPING_COMMENT = [
  "// errorCode → doc-file mapping, read by test/error-code-contract.test.mjs (specs/c12-registry-field-consumers.md AC2); rows: grep -l '`<CODE>`' content/*.md",
  "//   AGENT_ID_REQUIRED               skill-qa-engineer.md",
  "//   TRANSITION_REJECTED             coord-02-host-dispatch.md, skill-qa-engineer.md",
  "//   REVIEW_ROUND_EXCEEDED           skill-code-reviewer.md",
  "//   VISUAL_ROUND_EXCEEDED           (none)",
  "//   HOP_CAP_EXCEEDED                coord-01-core-head.md, coord-03-core-fallback.md",
  "//   SR_RETURN_CAP_EXCEEDED          skill-qa-engineer.md, skill-sr-engineer.md",
  "//   SCOPE_DECISION_REQUIRED         const-08-chain-31-mid.md, constitution-rationale.md, skill-pm.md",
  "//   CUT_APPROVAL_REQUIRED           const-08-chain-31-mid.md, coord-03-core-fallback.md, skill-coordinator-lite.md",
  "//   EXTERNAL_REFS_UNRESOLVED        const-15-core-tail.md, coord-03-core-fallback.md, skill-pm.md",
  "//   SOURCE_CREDIBILITY_UNVERIFIED   coord-03-core-fallback.md, skill-design-auditor.md, skill-pm.md",
  "//   FEATURE_LEASE_HELD              const-08-chain-31-mid.md, coord-03-core-fallback.md, skill-release-engineer.md",
  "//   LEASE_OVERRIDE_AUDIT_MISSING    const-08-chain-31-mid.md",
  "//   MISSING_EVIDENCE                skill-code-reviewer.md",
  "//   QA_COMPLETION_EVIDENCE_MISSING  const-08-chain-31-mid.md, skill-code-reviewer.md",
  "//   MISSING_REVIEW_EVIDENCE         skill-code-reviewer.md",
  "//   EXPECTED_RED_DIFF_MISSING       skill-code-reviewer.md",
  "//   REPRO_MANIFEST_MISSING          skill-qa-engineer.md, skill-sr-engineer.md",
  "//   VISUAL_BASELINES_REQUIRED       const-07-design-chain-gates.md, const-13-design-chain-s4.md, constitution-rationale.md, skill-design-auditor.md",
  "//   VISUAL_EVIDENCE_MISSING         const-07-design-chain-gates.md, skill-reviewer-visual.md",
  "//   VISUAL_WIDGETS_UNVERIFIED       skill-reviewer-visual.md",
  "//   VISUAL_ASSERTIONS_REQUIRED      const-07-design-chain-gates.md, const-13-design-chain-s4.md, constitution-rationale.md",
  "//   VISUAL_REPORT_INCOMPLETE        const-07-design-chain-gates.md, const-13-design-chain-s4.md, constitution-rationale.md, skill-reviewer-visual.md",
  "//   VISUAL_PROVENANCE_MISSING       skill-reviewer-visual.md",
  "//   BASELINE_MANIFEST_MISSING       const-07-design-chain-gates.md, skill-design-auditor.md, skill-reviewer-visual.md",
  "//   BASELINE_PROVENANCE_INCOMPLETE  const-07-design-chain-gates.md, skill-design-auditor.md, skill-reviewer-visual.md",
  "//   PIXEL_GATE_ATTESTATION_MISSING  skill-reviewer-visual.md",
  "//   REVIEW_VERDICT_STATUS_MISMATCH  const-05-core-standards.md, const-08-chain-31-mid.md, skill-code-reviewer.md",
  "//   NON_JUDGE_COMPLETED_TASKS_REJECTED  const-08-chain-31-mid.md",
  "//   NON_REVIEWER_VERDICT_REJECTED   const-08-chain-31-mid.md",
  "//   QA_REVIEW_TARGET_REQUIRED       skill-code-reviewer.md",
  "//   AC_EXECUTION_LOG_MISSING        skill-code-reviewer.md",
  "//   PASS_TASKS_INCOMPLETE           skill-code-reviewer.md",
  "//   DISPATCH_PIN_TIER_REJECTED      coord-02-host-dispatch.md"
];

// The files this ticket touches, and every line among them that names chain_path at base.
const FROZEN_TOUCHED_FILES = [
  "tools/transitions.ts",
  "tools/registry.ts",
  "tools/handoff-types.ts",
  "tools/handoff-orchestrator.ts",
  "schema/migrations-handoff.ts",
  "gates/expected-red.ts",
  "gates/registry.ts",
  "gates/qa-review.ts",
  "gates/visual.ts",
  "content/skill-spec-workshop.md",
  "docs/migration-v5.md"
];
const FROZEN_CHAIN_PATH_LINES = [
  "schema/migrations-handoff.ts: // v15 -> v16: add optional chain_path marker and sr_return_count counter",
  "schema/migrations-handoff.ts: // (E431). Additive STAMP-ONLY, seeds nothing: absence of chain_path === the old",
  "schema/migrations-handoff.ts:     const { chain_path: _c, qa_round: _q, qa_rounds_total: _t, ...rest } = input;",
  "docs/migration-v5.md:   read: `qa_round` and `qa_rounds_total` (and a pre-release `chain_path`) are",
  "docs/migration-v5.md:   `chain_path` sent by an old client is ignored. Nothing else in the handoff"
];

// content/skill-spec-workshop.md at base, one entry per line (the trailing "" is the final newline).
// E428 re-pin: the tracker-mirror ticket edits this SOP outside steps 4/5 on purpose (C-SW1 in the Ticket
// files bullet, the `## Tracker mirror` section C-SW2 after Outputs); FROZEN_SW_SOP holds those two edits.
const FROZEN_SW_SOP = [
  "---",
  "recommended_model: opus",
  "---",
  "# Skill: spec-workshop",
  "",
  "## Purpose",
  "",
  "Turn a spec, a design source, issue-tracker items or a bare idea into rulings the human makes in this session, recorded as they are made, then into ticket files and one wave table the human approves once. The human starts this role by invoking its prompt. It is prompt-only: not a routing-chain role, no `agent_id`, no feature lease, and it hands nothing to the chain itself — the human or the integrator takes the approved tickets from here.",
  "",
  "## Steps",
  "",
  "1. **Entry check** — this role fits:",
  "   - a spec or design source to break down into tickets;",
  "   - an idea that needs several rounds of questions before it can be cut;",
  "   - an issue-tracker item that has no ticket file, whatever its size.",
  "",
  "   One run may take several item numbers. Work only on the items the human names; never pull items from the tracker yourself. One item may become several tickets, and several items may become one. Work that fits one or two files and is not a tracker item goes to the ordinary coordinator intake: say so and stop.",
  "2. **Check what exists first** — before the first question, read the current code and docs and tell the human what already exists that bears on the request. With no source document, the code and docs are the source. Keep this survey short; send any deeper fact lookup to a subagent that runs while you ask, and hold back only the questions that depend on its answer.",
  "3. **Delegate bulk reading** — send design extraction and codebase surveys to subagents; keep their summaries, not the raw dumps. Never ask the human a fact the code, docs or tools can answer; look it up. Your recommendation is not a ruling until the human answers it.",
  "4. **Ask in batches, record as you go** — at most 4 questions per batch. A question goes in a batch only when every decision it depends on already has a ruling, and no question in a batch depends on another in the same batch. Write each question as `Q<n> — <title>: <question>`, then your recommendation on its own line, then a worked example on its own line (a named case, step by step, what breaks under each option). Word each question so that \"yes\" accepts your recommendation; when it cannot be worded so, say so in the question. The human may answer by number. Address every question to the operator in this session; a tracker item's author is not here. Write each ruling to the record the moment it is made, with its date; a ruling that replaces an earlier one names the one it replaces. When an answer shows an earlier ruling should change, reopen that question in the next batch; its new ruling names the one it replaces. A question about how something looks or feels is marked `needs prototype` in the record, and its ruling waits until the human has seen one; this role does not build the prototype. A `needs prototype` question still open when the run ends makes the run end `not ready to cut`.",
  "5. **Done condition** — the work is ready to cut when every scenario has one verification, every device-or-person scenario is marked, and every conflict between sources has a ruling. Verification is one of: automated test, command, device-or-person; a ticket with any device-or-person scenario sets `needs device or person: yes`. Each divergence between a Figma file and a prototype is a conflict. Before asking for approval, if the human accepted every recommendation unchanged, say so once and ask them to confirm the rulings are theirs; a confirmation continues, and a changed answer is never required.",
  "6. **End without filing** — a run may end with `not doing` or `not ready to cut` and file nothing. For `not ready to cut`, list the open questions in the record.",
  "",
  "## Short form",
  "",
  "For a small, clear tracker item: read it, check the code, write its scenarios and their verifications, ask for one confirmation, then write the ticket file. The short form writes no wave table. Anything unclear, or an item that needs a split, goes back to the full steps.",
  "",
  "## Outputs",
  "",
  "- **Discussion record** — the formal output; tickets carry only its conclusions. Default path `docs/discussions/<YYYY-MM-DD>-<topic>.md` unless the human names another. It holds a `## Rulings` table `| # | date | question | ruling | replaces |`, the wave table and the approval table.",
  "- **Ticket files** — written only by this role, in the ticket format: `<agc install>/docs/ticket-format.md` and `<agc install>/templates/ticket.md` (`<agc install>` = agc's install directory, not the workspace). They go in the ticket directory (`ticketDir` in `.current/.config.json`, default `docs/tickets/`). `source` = `<item number> rev <revision>`, the number only, never a link, and empty in a public repository, where the tracker map holds the item instead (*Tracker mirror*). Describe internal URLs, codenames and people by class, never by name. When the project keeps a backlog, add one index line per ticket.",
  "- **Wave table** — `| wave | ticket | depends on |`, one row per ticket.",
  "- **Approval table** — `| date | decided by | content | source |`; the human's approval is a row with `decided by` = `human`, written only after the human approves in this session.",
  "- After the approval row is written, commit the record and the ticket files together per the repository's commit rules (branch and pull request where the main branch is protected), so the commit can be cited.",
  "",
  "## Tracker mirror",
  "",
  "Only when the human asks for it in this session; without that request write nothing to any tracker (reading the items the human names stays allowed). After the approval row is written, use the host's own tracker tools to create one item for each ticket file that has none, holding the ticket's id, title and file path and saying the file is the record. A ticket cut from a tracker item gets no new item: its source item stands for it, and one child item under that source item per ticket file is created only when the human asks. A ticket file never gets a second created item; the items it was cut from do not count. Record each created item in the tracker map, by number, never a link: `agc-tracker-map.md` in the directory `git rev-parse --git-common-dir` prints, never tracked. Its `write-back` switch, which lets the integrator update source items, stays `off` unless the human turns it on. Format: `<agc install>/docs/ticket-format.md`, *Tracker mirror*.",
  "",
  "## Governance state",
  "",
  "**Never call `tw_update_state`, `tw_add_task`, `tw_complete_task`, `tw_rollback_task`, `tw_void_task` or `tw_sync`**, and never write any `.current/` file; `tw_get_state` and `tw_detect_drift` are allowed for reading.",
  "",
  "This role is never dispatched as a subagent: a subagent has no channel for rounds of dialogue with the human.",
  ""
];

// docs/migration-v5.md at base, one entry per paragraph; a list or table paragraph is split into its
// bullets (with their continuation lines) and rows, so a bullet inserted mid-list removes nothing.
const FROZEN_MIG_UNITS = [
  "# Migrating to v5 — one chain, code-reviewer judges",
  "v5 keeps one routing chain and drops the old path where qa-engineer reviewed\nthe build and wrote PASS. This page says what changed, how to finish or restart\na feature that was mid-flight on the old path, and what to refresh in your\nworkspace after upgrading.",
  "## What changed",
  "- **One chain**: `pm → [architect] → qa-engineer → sr-engineer → code-reviewer`.\n  qa-engineer writes the scenario tests first; sr-engineer builds to them;\n  code-reviewer judges, writes `status=PASS` and owns `completed_tasks` /\n  `tw_complete_task`. qa-engineer no longer writes PASS or FAIL.",
  "- **Handoff schema 15 → 17** (v4.23.0 writes 15), migrated lazily on first\n  read: `qa_round` and `qa_rounds_total` (and a pre-release `chain_path`) are\n  dropped, and the new `sr_return_count` counter starts absent (read as 0). A\n  `chain_path` sent by an old client is ignored. Nothing else in the handoff\n  changes.",
  "- **Upgrade every server that shares a workspace.** Once a v5 server has\n  written a file-mode `handoff.md` at schema 17, an older server (v4.23.0 reads\n  up to 15) refuses it as written by a newer server. Restart every MCP client\n  on v5 before the first write.",
  "- `resume_of` accepts only `code-reviewer`.",
  "- The `sr_return` cap (2 sr-engineer → qa-engineer returns) applies to every\n  file-mode feature. The count resets on every `pm:In_Progress` write, and the\n  cap closes only that return edge: sr-engineer can still hand to\n  code-reviewer or stop to pm.",
  "- Error codes: `QA_ROUND_EXCEEDED` is gone (there is no qa round).\n  `REVIEWER_COMPLETED_TASKS_REJECTED` and `NON_QA_COMPLETED_TASKS_REJECTED`\n  are replaced by one code, `NON_JUDGE_COMPLETED_TASKS_REJECTED`: only the\n  judge (code-reviewer) may record `completed_tasks`.",
  "## A feature mid-flight on the old path",
  "Read the handoff's current `(last_agent, status)` and take the matching row.\nThe five old-path steps the server no longer accepts are `pm → sr-engineer`,\n`architect → sr-engineer`, `code-reviewer → qa-engineer`, `qa-engineer:PASS`\nand `qa-engineer:FAIL`; a rejection names the code-reviewer route and points\nhere. A handoff already sitting at `qa-engineer:PASS` or `qa-engineer:FAIL`\ncan still leave it.",
  "| Handoff is at | To finish |",
  "|---|---|",
  "| `pm:In_Progress` | Hand to qa-engineer (or architect). The build-entry gates and cut approval apply to `pm → qa-engineer`. |",
  "| `architect:In_Progress` | Hand to qa-engineer. |",
  "| `sr-engineer:In_Progress` | Continue to code-reviewer. |",
  "| `sr-engineer:Blocked` | Write `sr-engineer:In_Progress` first, then continue to code-reviewer (`sr-engineer:Blocked → code-reviewer:In_Progress` is rejected). |",
  "| `code-reviewer:In_Progress` | code-reviewer writes PASS itself, with `review_verdict: \"APPROVED\"`, `completed_tasks` and `qa_review`. |",
  "| `qa-engineer:In_Progress` (reviewing a build) | Write `qa-engineer:Blocked` → `pm:In_Progress` → `code-reviewer:In_Progress` with `resume_of: \"code-reviewer\"`; or hand to sr-engineer, which needs `qa_reports/expected-red_<feature>.txt` or the no-new-test record. |",
  "| `qa-engineer:FAIL` | sr-engineer fixes, then code-reviewer judges. |",
  "| `qa-engineer:PASS` | The feature is closed. Open the next feature as usual. |",
  "To **restart** instead of finishing: re-enter with `pm:In_Progress`, or start\na new `active_feature` once the feature lease allows it.",
  "A release needs the gate feature closed by `(code-reviewer, PASS)`.",
  "## Re-copy `~/.claude/agents/`",
  "The Claude Code subagent templates changed: the qa-engineer template now runs on opus,\nand `qa-visual.md` is gone (visual judging belongs to\n`reviewer-visual.md`). Re-copy the templates into `~/.claude/agents/` and\ndelete any stale `qa-visual.md` there.",
  "## `.current/skill-qa-visual.md`",
  "No prompt or role loads that file name any more. If you kept local rules in\nit, move them into `.current/skill-reviewer-visual.md`.",
  "## The \"judging in-context\" wording",
  "The Execution Profile sentence in `templates/agent-adapters/claude.md` (and the\n`CLAUDE.md` it stamps) now reads: code-reviewer judging in-context, or\nqa-engineer writing the tests in the builder's context, voids builder != judge.\nBoth roles are still dispatched as subagents, because the judge and the test\nauthor must not share the builder's context.",
  "## Re-stamp `agc-version`",
  "Run `agc init` (or `agc check` to see what is stale). It updates the agc\nblock, and its `agc-version` stamp, in `CLAUDE.md` only. An existing\n`AGENTS.md` or `.antigravityrules` is left as it is (`agc init` prints\n`Skipped (already exists)`): bump the `agc-version:` line in each by hand to\nthe installed version, or delete the file and re-run `agc init`. Deleting and\nre-running writes a fresh copy from the template, so any local edits in that\nfile are lost. Then run `agc check`; it must exit 0.",
  "## SQLite / HTTP mode",
  "Same transition table and same judge. SQLite does not store `sr_return_count`, so in SQLite the sr_return cap is not enforced.\nNo column and no SQLite schema version change.",
  "Two build-entry checks run in file mode only: `CUT_APPROVAL_REQUIRED` and\n`EXTERNAL_REFS_UNRESOLVED` (`SCOPE_DECISION_REQUIRED` and\n`SOURCE_CREDIBILITY_UNVERIFIED` run in every mode). The expected-red manifest\ncheck on the qa-engineer → sr-engineer hand-off (`REPRO_MANIFEST_MISSING`) is\nfile mode only too.",
  "## Telemetry",
  "Old sidecar rows carrying `QA_ROUND_EXCEEDED`,\n`REVIEWER_COMPLETED_TASKS_REJECTED` or `NON_QA_COMPLETED_TASKS_REJECTED` show\nas unregistered codes in `tw_gate_stats`. The `mean_qa_rounds` metric is gone."
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const norm = (s) => s.replace(/\s+/g, " ").trim();
const lines = (t) => t.split("\n");
const text = (r) => r?.content?.[0]?.text ?? "";

const made = [];
after(() => {
  for (const d of made) fs.rmSync(d, { recursive: true, force: true });
});
function mkWs(prefix = "e462-") {
  const ws = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  made.push(ws);
  fs.mkdirSync(path.join(ws, ".current"), { recursive: true });
  return ws;
}
function put(ws, rel, body) {
  const p = path.join(ws, rel);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, body);
  return p;
}

// Seed a file-mode handoff as `agent:status` for `feature`, then mark it read so the next write is fresh.
async function seed(ws, feature, agent, status = "In_Progress", completedTasks = []) {
  setActiveStorage(new FileHandoffStorage());
  resetSession(ws);
  markStateRead(ws);
  await writeHandoffState({
    workspacePath: ws,
    activeFeature: feature,
    status,
    completedTasks,
    pendingNotes: [`${agent}: seeded`],
    lastAgent: agent,
  });
  forceSeedStamp(ws);
  resetSession(ws);
  markStateRead(ws);
}
const handoffText = (ws) => fs.readFileSync(resolveCurrentLanePaths(ws).handoffPath, "utf-8");
const frontmatter = (ws) => {
  const m = /^---\n([\s\S]*?)\n---/.exec(handoffText(ws));
  assert.ok(m, "handoff has a frontmatter block");
  return m[1];
};

// The design-mode readers, both: AC4 asks for the same reported value from each.
function modeOf(designBody) {
  const ws = mkWs("e462-mode-");
  const feature = "e462-mode";
  put(ws, path.join("design", `${feature}.md`), designBody);
  const arm = hasDesignModeRequiringVisual(ws, feature);
  const cred = checkSourceCredibility(ws, feature);
  assert.equal(cred.mode, arm.mode, "checkSourceCredibility reports the same mode as hasDesignModeRequiringVisual");
  return arm;
}

// A judge PASS on `feature` whose design file is `designBody`; returns the rejection text.
async function judgePass(designBody, { feature = "e462-vis", withEvidence = false } = {}) {
  const ws = mkWs("e462-vis-");
  put(ws, path.join("design", `${feature}.md`), designBody);
  if (withEvidence) put(ws, path.join("qa_reports", "visual_T-E462-V.md"), "# visual\n\nVerdict: PASS\n");
  await seed(ws, feature, "code-reviewer");
  const r = await handleUpdateState({
    workspace_path: ws,
    active_feature: feature,
    status: "PASS",
    agent_id: "code-reviewer",
    completed_tasks: ["T-E462-V"],
    review_task_ids: ["T-E462-V"],
    pending_notes: ["code-reviewer: PASS"],
    qa_review: "Looks good.",
  });
  assert.ok(r.isError, `the PASS must be rejected; got: ${text(r)}`);
  return text(r);
}

// ---------------------------------------------------------------------------
// AC1 — stale comments (resident half: phrases gone, kept text kept)
// ---------------------------------------------------------------------------

const GONE = [
  ["tools/transitions.ts", "{architect,sr-engineer}"],
  ["tools/registry.ts", "{architect,sr-engineer}"],
  ["tools/transitions.ts", "either chain path"],
  ["gates/expected-red.ts", "test-first"],
  ["gates/registry.ts", "test-first"],
  ["schema/migrations-handoff.ts", "test-first"],
  ["gates/expected-red.ts", "Phase 0.5"],
  ["gates/registry.ts", "QA must log"],
  ["gates/registry.ts", "a qa PASS must"],
  ["gates/registry.ts", 'agent_id="qa-engineer" with pre-filled'],
  ["tools/handoff-orchestrator.ts", "sr-engineer declared"],
  ["tools/handoff-orchestrator.ts", "QA's suite-vs-manifest"],
  ["tools/handoff-types.ts", "QA's expected-red check"],
];

test("AC1 no stale old-chain phrase remains in the named source files", () => {
  // WHY: a comment that still describes the retired chain (qa-engineer judging, pm -> sr-engineer build entry,
  // test-first features, two chain paths) sends a maintainer reasoning from a path the server no longer has.
  const hits = GONE.filter(([file, phrase]) => read(file).includes(phrase)).map(([f, p]) => `${f}: ${p}`);
  assert.deepEqual(hits, [], "stale phrases still present");
});

test("AC1 tools/transitions.ts and tools/registry.ts comments name the build-entry edge {architect,qa-engineer}", () => {
  // WHY: qa-engineer is the v5 build entry; the comment that names the edge must name the one the table has.
  for (const file of ["tools/transitions.ts", "tools/registry.ts"]) {
    const commentHits = lines(read(file)).filter((l) => l.trim().startsWith("//") && l.includes("{architect,qa-engineer}"));
    assert.ok(commentHits.length > 0, `${file}: a comment names {architect,qa-engineer}`);
  }
});

test("AC1 kept text: HOP_CAP comment head and phrases, transitions.ts migration hint and visual-cap comment, the errorCode mapping comment", () => {
  // WHY: other tickets' tests read these exact lines (e431 HOP_CAP phrases, e453 AC9, error-code-contract);
  // the comment sweep must not move them.
  const tr = read("tools", "transitions.ts");
  const at = tr.indexOf("const HOP_CAP = 14;");
  assert.ok(at > 0, "HOP_CAP declaration present");
  const head = "// v9 (d2-server-brake-accounting) — const-01 Limits";
  const start = tr.lastIndexOf(head, at);
  assert.ok(start >= 0, "HOP_CAP comment still starts with the v9 head line");
  const comment = tr.slice(start, at).replace(/\n\/\/ ?/g, " ");
  assert.ok(comment.includes("independent brake"), "HOP_CAP comment keeps `independent brake`");
  assert.ok(comment.includes("before or after any round cap"), "HOP_CAP comment keeps `before or after any round cap`");

  const trLines = lines(tr);
  assert.ok(trLines.includes(FROZEN_TR_MIGRATION_HINT_LINE), "transitions.ts MIGRATION_HINT string line byte-identical to base");
  assert.ok(tr.includes(FROZEN_TR_VISUAL_CAP_COMMENT.join("\n")), "transitions.ts visual-round cap comment byte-identical to base");
  assert.ok(
    read("gates", "registry.ts").includes(FROZEN_REG_MAPPING_COMMENT.join("\n")),
    "gates/registry.ts errorCode -> doc-file mapping comment byte-identical to base",
  );
});

test("AC1 no line containing chain_path is added or changed in the ticket's files", () => {
  // WHY: chain_path is a removed pre-release field; only the existing migration lines may keep naming it.
  const got = [];
  for (const file of FROZEN_TOUCHED_FILES) {
    for (const l of lines(read(file))) if (l.includes("chain_path")) got.push(`${file}: ${l}`);
  }
  assert.deepEqual(got.sort(), [...FROZEN_CHAIN_PATH_LINES].sort());
});

// ---------------------------------------------------------------------------
// AC2 — resume_of normalised once
// ---------------------------------------------------------------------------

test("AC2 the two resume_of ternaries are gone and both consumers read parsed.resume_of", () => {
  // WHY: one normalisation at the handler entry keeps the two consumers from drifting apart.
  const src = read("tools", "handoff-orchestrator.ts");
  assert.ok(!src.includes(OLD.resumeTernary), "no `parsed.resume_of === \"code-reviewer\" ? ...` ternary remains");
  assert.match(src, /next_resume_of:\s*parsed\.resume_of\s*[,\n}]/, "validateTransition input reads parsed.resume_of");
  assert.match(src, /resumeOf:\s*parsed\.resume_of\s*[,\n}]/, "handoff write option reads parsed.resume_of");
});

test("AC2 a non-code-reviewer resume_of on pm -> code-reviewer:In_Progress is rejected exactly as an absent one", async () => {
  // WHY: only code-reviewer resumes (v5); a stale or empty value must not open the edge nor change the hint.
  for (const value of ["qa-engineer", "sr-engineer", ""]) {
    const ws = mkWs("e462-ac2a-");
    await seed(ws, "e462-resume", "pm");
    const before = handoffText(ws);
    const r = await handleUpdateState({
      workspace_path: ws,
      active_feature: "e462-resume",
      status: "In_Progress",
      agent_id: "code-reviewer",
      pending_notes: ["code-reviewer: resuming"],
      resume_of: value,
    });
    assert.ok(r.isError, `resume_of ${JSON.stringify(value)} must be rejected; got: ${text(r)}`);
    assert.match(text(r), /TRANSITION_REJECTED/);
    assert.ok(text(r).includes("received resume_of: absent."), `hint ends with absent for ${JSON.stringify(value)}: ${text(r)}`);
    assert.equal(handoffText(ws), before, "a rejected write leaves the handoff untouched");
  }
});

test("AC2 a stale resume_of on an edge legal without it lands and is not persisted", async () => {
  // WHY: the normalised value is undefined, so nothing about the stale value reaches the handoff file.
  const ws = mkWs("e462-ac2b-");
  await seed(ws, "e462-resume", "sr-engineer");
  const r = await handleUpdateState({
    workspace_path: ws,
    active_feature: "e462-resume",
    status: "In_Progress",
    agent_id: "sr-engineer",
    pending_notes: ["sr-engineer: still building"],
    resume_of: "qa-engineer",
  });
  assert.ok(!r.isError, `sr-engineer self-loop must land; got: ${text(r)}`);
  assert.doesNotMatch(frontmatter(ws), /^resume_of:/m, "no resume_of key on disk");
});

test("AC2 resume_of code-reviewer still opens pm -> code-reviewer:In_Progress and is persisted", async () => {
  // WHY: the Amend-Resume edge is unchanged behaviour.
  const ws = mkWs("e462-ac2c-");
  await seed(ws, "e462-resume", "pm");
  const r = await handleUpdateState({
    workspace_path: ws,
    active_feature: "e462-resume",
    status: "In_Progress",
    agent_id: "code-reviewer",
    pending_notes: ["code-reviewer: resuming"],
    resume_of: "code-reviewer",
  });
  assert.ok(!r.isError, `resume must be accepted; got: ${text(r)}`);
  assert.match(frontmatter(ws), /^resume_of:\s*"?code-reviewer"?\s*$/m, "handoff carries resume_of: code-reviewer");
});

// ---------------------------------------------------------------------------
// AC3 — judge-report directory and report heading
// ---------------------------------------------------------------------------

test("AC3 QA_COMPLETION_EVIDENCE_MISSING names the judge report directory from resolveJudgeReport", async () => {
  // WHY: the message must name the directory the server actually reads, so it stays right if that moves.
  const ws = mkWs("e462-ac3a-");
  await seed(ws, "e462-ev", "sr-engineer");
  const r = await handleUpdateState({
    workspace_path: ws,
    active_feature: "e462-ev",
    status: "In_Progress",
    agent_id: "code-reviewer",
    completed_tasks: ["T-E462-E"],
    pending_notes: ["code-reviewer: reviewing"],
  });
  const t = text(r);
  assert.ok(r.isError, `must be rejected; got: ${t}`);
  assert.match(t, /QA_COMPLETION_EVIDENCE_MISSING/);
  const dir = resolveJudgeReport(ws).dir;
  assert.ok(path.isAbsolute(dir), "the judge report dir is absolute");
  assert.ok(t.includes(COPY.evidenceCovers(dir)), `message carries e462.evidence-covers with ${dir}: ${t}`);
  assert.ok(!t.includes("qa_reports/ report covering"), "the hard-coded qa_reports/ wording is gone");
});

test("AC3 a new judge report starts with `# Review — <id>`, then the unchanged auto-append marker and verdict section", async () => {
  // WHY: the evidence file is the judge's record, so its title is not QA's; everything a reader keys on is unchanged.
  for (const [status, extra] of [
    ["PASS", {}],
    ["FAIL", { review_verdict: "CHANGES_REQUESTED", blocking_reason: "AC2 red" }],
  ]) {
    const ws = mkWs("e462-ac3b-");
    const id = `T-E462-${status}`;
    await seed(ws, "e462-head", "code-reviewer");
    put(ws, path.join("review_reports", `review_${id}.md`), "# Code review\n\nVerdict: APPROVED\n");
    const r = await handleUpdateState({
      workspace_path: ws,
      active_feature: "e462-head",
      status,
      agent_id: "code-reviewer",
      completed_tasks: status === "PASS" ? [id] : [],
      review_task_ids: [id],
      pending_notes: [`code-reviewer: ${status}`],
      qa_review: "Notes.",
      ...extra,
    });
    assert.ok(!r.isError, `${status} write must land; got: ${text(r)}`);
    const got = fs.readFileSync(path.join(resolveJudgeReport(ws).dir, `review_${id}.md`), "utf-8");
    const want = new RegExp(
      `^${COPY.reportHeading(id)}\\n\\n<!-- Auto-appended by tw_update_state\\(qa_review=\\.\\.\\.\\)\\. -->\\n\\n` +
        `## \\d{4}-\\d\\d-\\d\\dT\\d\\d:\\d\\d:\\d\\d\\.\\d{3}Z — ${status} — by code-reviewer\\n`,
    );
    assert.match(got, want, `${status}: heading, marker, verdict section`);
    assert.ok(!got.startsWith(OLD.reportHeadingPrefix), `${status}: no new report starts with the old heading`);
  }
  // The public record function writes the same heading.
  const ws = mkWs("e462-ac3b2-");
  await recordReviewInFile(ws, ["T-E462-R"], "PASS", "code-reviewer", "ok");
  const body = fs.readFileSync(path.join(resolveJudgeReport(ws).dir, "review_T-E462-R.md"), "utf-8");
  assert.ok(body.startsWith(`${COPY.reportHeading("T-E462-R")}\n\n`), "recordReviewInFile writes e462.report-heading");
});

test("AC3 an old-heading report with a server PASS section still credits the id, and a later append adds no second heading", async () => {
  // WHY: readers key on the verdict heading, never the H1, so reports written before the retitle stay valid.
  const ws = mkWs("e462-ac3c-");
  const id = "T-E462-OLD";
  const feature = "e462-old";
  const oldReport =
    `# QA review — ${id}\n\n<!-- Auto-appended by tw_update_state(qa_review=...). -->\n\n` +
    `## 2026-11-20T10:00:00.000Z — PASS — by code-reviewer\n\nVerified.\n\n`;
  const file = put(ws, path.join("qa_reports", `review_${id}.md`), oldReport);
  assert.deepEqual(hasPassEvidenceInFile(ws, [id]).present, [id], "PASS gate predicate credits it");
  assert.ok(hasEvidenceAnywhere(ws, [id]).has(id), "drift evidence credits it");
  assert.deepEqual(checkLaneEvidence(ws, feature, [id]).evidenceIds, [id], "lane-status credits it");

  // The real PASS gate, on a write that carries no qa_review of its own.
  await seed(ws, feature, "code-reviewer");
  put(ws, path.join("review_reports", `review_${id}.md`), "# Code review\n\nVerdict: APPROVED\n");
  const r = await handleUpdateState({
    workspace_path: ws,
    active_feature: feature,
    status: "PASS",
    agent_id: "code-reviewer",
    completed_tasks: [id],
    review_task_ids: [id],
    pending_notes: ["code-reviewer: PASS"],
  });
  assert.ok(!r.isError, `PASS on the old-heading report must land; got: ${text(r)}`);

  await recordReviewInFile(ws, [id], "FAIL", "code-reviewer", "second round");
  const after = fs.readFileSync(file, "utf-8");
  assert.ok(after.startsWith(oldReport), "the old report text is kept as is");
  assert.equal(lines(after).filter((l) => /^# /.test(l)).length, 1, "still exactly one `# ` heading");
});

test("AC3 EVIDENCE_SCHEMA_CURRENT stays 3", () => {
  // WHY: the H1 is not an evidence heading, so the retitle needs no evidence-schema bump.
  assert.equal(EVIDENCE_SCHEMA_CURRENT, 3);
});

// ---------------------------------------------------------------------------
// AC4 — unknown design mode reported as written, with the `no-design` hint
// ---------------------------------------------------------------------------

test("AC4 an unknown declared mode is reported as written (case kept, not cut at `/`) and arms", () => {
  // WHY: `mode: N/A` reported as `n` hides what the adopter wrote; showing it lets them fix the file in one step.
  // Human ruling 2026-11-25: none / n/a / tbd stay unknown and arm.
  for (const [decl, want] of [
    ["mode: N/A", "N/A"],
    ["mode: n/a", "n/a"],
    ["mode: none", "none"],
    ["mode: TBD", "TBD"],
    ["mode: `N/A`", "N/A"],
    ["mode: tbd.", "tbd"],
  ]) {
    const r = modeOf(`# design\n\n${decl}\n`);
    assert.equal(r.mode, want, `${decl} -> ${want}`);
    assert.equal(r.required, true, `${decl} arms`);
  }
});

test("AC4 only no-design disarms; known modes are still lowercased", () => {
  // WHY: the report change must not move any arming decision or the known-mode spelling.
  for (const [decl, want, required] of [
    ["mode: no-design", "no-design", false],
    ["mode: no-design-yet", "no-design", false],
    ["mode: Figma", "figma", true],
    ["mode: figma-export", "figma", true],
  ]) {
    const r = modeOf(`# design\n\n${decl}\n`);
    assert.equal(r.mode, want, `${decl} -> ${want}`);
    assert.equal(r.required, required, `${decl} required=${required}`);
  }
});

test("AC4 the reported value is the first word only and a very long word is cut to 40 characters plus `…`", () => {
  // WHY: the value is echoed into an error message; markup after the word and unbounded input must not ride along.
  assert.equal(modeOf("mode: mockup <script>alert(1)</script>\n").mode, "mockup");
  for (const [decl, want] of [
    ["mode: Mock*up", "Mock"],
    ['mode: "Draft"', "Draft"],
    ["mode: (Draft)", "Draft"],
    ["mode: [Draft]", "Draft"],
    ["mode: Draft_v1", "Draft"],
    ["mode: Draft'x", "Draft"],
    ["mode: Draft<x>", "Draft"],
    ["mode: Draft;", "Draft"],
    ["mode: Draft:", "Draft"],
    ["mode: Draft,", "Draft"],
  ]) {
    assert.equal(modeOf(`${decl}\n`).mode, want, `${decl} -> ${want}`);
  }
  const huge = "Ab".repeat(50_000);
  const r = modeOf(`mode: ${huge}\n`);
  assert.equal(r.mode, `${huge.slice(0, 40)}\u2026`, "100 000 characters cut to 40 + …, case kept");
  assert.equal(r.required, true);
});

test("AC4 VISUAL_BASELINES_REQUIRED reports mode=N/A and the no-design note before the static hint", async () => {
  // WHY: the rejection shows what the adopter wrote and tells them the one-word fix.
  const t = await judgePass("# design\n\nmode: N/A\n");
  assert.match(t, /VISUAL_BASELINES_REQUIRED/);
  assert.ok(t.includes("(mode=N/A, at "), `reports the raw value: ${t}`);
  assert.ok(
    t.includes(`but ## Visual Baselines is absent. ${COPY.unknownModeNote("N/A")}${gate("VISUAL_BASELINES_REQUIRED").hintStatic}`),
    `e462.unknown-mode-note sits between "is absent. " and the static hint: ${t}`,
  );
});

test("AC4 VISUAL_ASSERTIONS_REQUIRED carries the same note after `Assertions is absent. `", async () => {
  const t = await judgePass("# design\n\nmode: N/A\n\n## Visual Baselines\n\n| surface | file |\n|---|---|\n| home | home.png |\n", {
    withEvidence: true,
  });
  assert.match(t, /VISUAL_ASSERTIONS_REQUIRED/, `reaches the assertions check: ${t}`);
  assert.ok(t.includes("(mode=N/A, at "), `reports the raw value: ${t}`);
  assert.ok(
    t.includes(`Assertions is absent. ${COPY.unknownModeNote("N/A")}${gate("VISUAL_ASSERTIONS_REQUIRED").hintStatic}`),
    `e462.unknown-mode-note follows "Assertions is absent. ": ${t}`,
  );
});

test("AC4 a known mode gets no unknown-mode note in either message", async () => {
  // WHY: the hint is for a value the server does not know; a figma design must read as before.
  const t1 = await judgePass("# design\n\nmode: figma\n");
  assert.match(t1, /VISUAL_BASELINES_REQUIRED/);
  assert.ok(t1.includes("(mode=figma, at "));
  assert.ok(!t1.includes("is not a known design mode"), t1);
  const t2 = await judgePass("# design\n\nmode: figma\n\n## Visual Baselines\n\n| surface | file |\n|---|---|\n| home | home.png |\n", {
    withEvidence: true,
  });
  assert.match(t2, /VISUAL_ASSERTIONS_REQUIRED/, `reaches the assertions check: ${t2}`);
  assert.ok(!t2.includes("is not a known design mode"), t2);
});

test("AC4 gate count stays 33 and the two visual error codes are unchanged", () => {
  // WHY: the ticket changes a reported value and adds a hint; no gate is added, removed or renamed.
  assert.equal(GATE_REGISTRY.length, 33);
  for (const code of ["VISUAL_BASELINES_REQUIRED", "VISUAL_ASSERTIONS_REQUIRED"]) {
    assert.ok(GATE_REGISTRY.some((g) => g.errorCode === code), `${code} registered`);
  }
});

// ---------------------------------------------------------------------------
// AC5 — design-mode mutation guards (E461 (3)), against the AC4 format
// ---------------------------------------------------------------------------

test("AC5 `prototype-v2` resolves to prototype (prototype stays a known mode)", () => {
  // Mutation guard: with prototype dropped from KNOWN_MODES the result becomes `prototype-v2`.
  assert.equal(modeOf("# design\n\nmode: prototype-v2\n").mode, "prototype");
});

test("AC5 an inline `mode: prototype` wins over an H2 `## Mode` of figma (prototype stays a known mode)", () => {
  // Mutation guard: with prototype dropped from KNOWN_MODES the inline value is unknown and the H2 figma wins.
  assert.equal(modeOf("# design\n\nmode: prototype\n\n## Mode\n\nfigma\n").mode, "prototype");
});

test("AC5 the first unknown token wins: inline mockup over an H2 N/A", () => {
  // Mutation guard: if the last unknown token won, the result would be `N/A`.
  assert.equal(modeOf("# design\n\nmode: mockup\n\n## Mode\n\nN/A\n").mode, "mockup");
});

test("AC5 the first unknown token wins: inline N/A over an H2 mockup", () => {
  // Mutation guard: if the last unknown token won, the result would be `mockup`.
  assert.equal(modeOf("# design\n\nmode: N/A\n\n## Mode\n\nmockup\n").mode, "N/A");
});

// ---------------------------------------------------------------------------
// AC6 — spec-workshop SOP
// ---------------------------------------------------------------------------

const SW = () => read("content", "skill-spec-workshop.md");
const stepLine = (sop, n) => {
  const hits = lines(sop).filter((l) => l.startsWith(`${n}. **`));
  assert.equal(hits.length, 1, `exactly one step ${n} line`);
  return hits[0];
};

test("AC6 step 4 keeps the ruling sentence and states the reopen rule once, as sw.reopen", () => {
  // WHY: the supersede clause already sits in the ruling sentence; saying it twice reads as two rules.
  const s4 = stepLine(SW(), 4);
  assert.ok(s4.includes(OLD.ruling), "the dated/replacing ruling sentence is kept");
  assert.ok(s4.includes(`${OLD.ruling} ${COPY.swReopen} `), "sw.reopen follows the ruling sentence directly");
  assert.ok(!s4.includes(OLD.reopen), "the old reopen sentence is gone");
  assert.equal(s4.split("names the one it replaces").length - 1, 1, "`names the one it replaces` occurs once in step 4");
});

test("AC6 step 5's first sentence is sw.done (no open `needs prototype` question)", () => {
  // WHY: step 4 ends a run with an open `needs prototype` question as not ready to cut; step 5 must agree.
  const s5 = stepLine(SW(), 5);
  assert.ok(s5.startsWith(`5. **Done condition** — ${COPY.swDone} `), `step 5 opens with sw.done: ${s5}`);
});

test("AC6 no other line of the SOP changes and no backtick-quoted error code is gained or lost", () => {
  // WHY: content/** ships to every adopter; only the two sentences the ticket names may move.
  const cur = lines(SW());
  const want = FROZEN_SW_SOP.map((l) => {
    if (l.startsWith("4. **")) return l.replace(OLD.reopen, COPY.swReopen);
    if (l.startsWith("5. **")) return l.replace(OLD.done, COPY.swDone);
    return l;
  });
  assert.deepEqual(cur, want);
  const codes = (t) => [...new Set(t.match(/`[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+`/g) ?? [])].sort();
  assert.deepEqual(codes(SW()), codes(FROZEN_SW_SOP.join("\n")));
});

// ---------------------------------------------------------------------------
// AC7 — migration guide
// ---------------------------------------------------------------------------

const MIG = () => read("docs", "migration-v5.md");
const section = (t, heading) => {
  const ls = lines(t);
  const at = ls.findIndex((l) => l === heading);
  assert.ok(at >= 0, `section heading present: ${heading}`);
  const end = ls.findIndex((l, i) => i > at && l.startsWith("## "));
  return ls.slice(at + 1, end < 0 ? ls.length : end);
};
// Bullets of a section: a `- ` line plus its indented continuation lines, whitespace-normalised.
const bullets = (sectionLines) => {
  const out = [];
  for (const l of sectionLines) {
    if (l.startsWith("- ")) out.push(l);
    else if (out.length && /^\s+\S/.test(l)) out[out.length - 1] += ` ${l}`;
    else if (l.trim() === "") out.push(null);
  }
  return out.filter((b) => b !== null).map(norm);
};

test("AC7 `## What changed` has mig.midline as its own bullet", () => {
  // WHY: after the upgrade drift and lane-status stop crediting ids whose verdict heading sits mid-line.
  assert.ok(bullets(section(MIG(), "## What changed")).includes(norm(COPY.migMidline)), "mig.midline is one whole bullet");
  const raw = section(MIG(), "## What changed").filter((l) => l.startsWith("- A judge report whose verdict heading"));
  assert.equal(raw.length, 1, "the bullet starts its own line");
});

test("AC7 `## SQLite / HTTP mode` has mig.sqlite_checks immediately followed by mig.review_evidence, no server mix", () => {
  // WHY: the PASS-time review-evidence check is file-mode only too; adopters on SQLite must know it does not run.
  const sec = norm(section(MIG(), "## SQLite / HTTP mode").join("\n"));
  assert.ok(sec.includes(`${norm(COPY.migSqliteChecks)} ${norm(COPY.migReviewEvidence)}`), `sqlite_checks then review_evidence: ${sec}`);
  for (const s of ["older server", "v4.23.0", "Upgrade every server", "newer server"]) {
    assert.ok(!sec.includes(s), `the SQLite section names no server mix: ${s}`);
  }
});

test("AC7 no paragraph, bullet or row of the base migration guide is removed", () => {
  // WHY: the ticket only adds two sentences; every base paragraph, bullet and row must still be there, word for word.
  const doc = norm(MIG());
  const missing = FROZEN_MIG_UNITS.filter((p) => !doc.includes(norm(p)));
  assert.deepEqual(missing, []);
});

// ---------------------------------------------------------------------------
// AC9 (amendment after the PASS): three more comment-only fixes. Resident half only: the old phrases in
// (a) and (b) are gone and the (b) build-entry comment names qa-engineer. The (c) comment-length scan and
// the transpileModule invariance are judge-run per the spec's AC9 proof, not resident tests.
// ---------------------------------------------------------------------------

// All `//` comment text of a file, markers stripped and whitespace-normalised, so a phrase re-wrapped across
// two comment lines is still found.
const commentText = (t) =>
  norm(
    lines(t)
      .filter((l) => l.trim().startsWith("//"))
      .map((l) => l.trim().replace(/^\/\/+/, ""))
      .join(" "),
  );

// The `//` block that starts at the line containing `marker` and runs to the first non-comment line.
const commentBlockAt = (t, marker) => {
  const ls = lines(t);
  const start = ls.findIndex((l) => l.trim().startsWith("//") && l.includes(marker));
  if (start < 0) return null;
  const out = [];
  for (let i = start; i < ls.length && ls[i].trim().startsWith("//"); i++) out.push(ls[i].trim().replace(/^\/\/+/, ""));
  return norm(out.join(" "));
};

test("AC9 tools/handoff-orchestrator.ts no longer calls the completion-evidence gate a QA gate", () => {
  // WHY: in the v5 chain the judge (code-reviewer) writes completed_tasks and its evidence lives in the judge
  // report; a comment that still says "QA completion-evidence gate" / "per-id QA evidence" sends a maintainer
  // looking for a qa-engineer verdict the chain no longer has.
  const src = read("tools", "handoff-orchestrator.ts");
  const comments = commentText(src);
  for (const phrase of ["QA completion-evidence gate", "per-id QA evidence"]) {
    assert.ok(!src.includes(phrase), `phrase still in the file: ${phrase}`);
    assert.ok(!comments.includes(phrase), `phrase still in the comment text (re-wrapped): ${phrase}`);
  }
});

test("AC9 gates/visual.ts source-credibility comment names the pm to architect or qa-engineer build entry", () => {
  // WHY: the build-entry edge is pm -> {architect, qa-engineer}; a comment naming pm -> sr-engineer describes
  // a hop the transition table no longer has, so a reader would misplace where the gate fires.
  const src = read("gates", "visual.ts");
  const old = "pm to architect or sr-engineer hop";
  assert.ok(!src.includes(old), `old edge still in the file: ${old}`);
  assert.ok(!commentText(src).includes(old), `old edge still in the comment text (re-wrapped): ${old}`);
  const block = commentBlockAt(src, "Source-credibility gate");
  assert.ok(block !== null, "the `Source-credibility gate` comment block exists");
  assert.ok(block.includes("qa-engineer"), `the source-credibility comment names qa-engineer: ${block}`);
});
