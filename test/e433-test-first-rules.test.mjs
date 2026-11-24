// Coded by @qa-engineer
// Tests for specs/e433-test-first-rules.md AC1-AC10, AC12 (non-golden parts), AC13 (E433).
// WHY: after E432 the server accepts both chains, but every served rule still described the old one
// (qa judges and writes PASS). E433 switches the served text to the test-first chain (qa-engineer writes
// the scenario tests, sr-engineer builds, code-reviewer judges and writes PASS) and removes the old-chain
// text in the same change. These tests pin the contract: the five composed prompts carry one chain and
// no old-judge phrase, each SOP says what the spec requires, and nothing the ticket promised to leave
// alone moved. Each title starts with its AC id: `--test-name-pattern "AC<n>:"` runs one AC.
// Base-relative checks (AC9, AC12, AC13) read a CLOSED historical range (both ends fixed shas, the lane's
// own content diff) into memory at capture time through `git archive` / `git diff`, never `git show`, and
// skip loudly when a sha is unreachable (e.g. after a squash merge); they never re-read a temp dir later.
// E435 (one chain, old path removed): the `chain_path` marker, `qa_round` and the qa judge leave the served
// text and the server, so the live checks below pin the marker-free wording (specs/e435-remove-old-path-
// architecture.md *Copy*) and the live registry of 33; the closed-range parts (AC9, AC12, AC13) still pin E433's
// own historical range unchanged. Re-pinned titles carry `(E435)`.

import { test, after } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), "utf-8");
const content = (f) => read(path.join("content", f));
const count = (hay, needle) => hay.split(needle).length - 1;

const { buildPromptForRole } = await import(path.join(ROOT, "dist", "prompts", "build.js"));
const { setActiveStorage, FileHandoffStorage } = await import(path.join(ROOT, "dist", "tools", "storage.js"));
const { GATE_REGISTRY } = await import(path.join(ROOT, "dist", "gates", "registry.js"));
const { UPDATE_STATE_GATE_PIPELINE } = await import(path.join(ROOT, "dist", "tools", "handoff-orchestrator.js"));
const { PROMPT_REGISTRY } = await import(path.join(ROOT, "dist", "tools", "registry.js"));
const { PROMPT_TEMPLATE_3B } = await import(path.join(ROOT, "dist", "tools", "fanout-manifest.js"));

// ------------------------------------------------------------------ Copy / Strings (spec, verbatim)

const COPY = {
  chainMain: "researcher (optional) → design-auditor (optional) → pm → architect (if complex) → qa-engineer → sr-engineer → code-reviewer",
  chainDocs: "researcher? → design-auditor? → pm → architect? → qa-engineer → sr-engineer → code-reviewer → PASS",
  forbidden: [
    "sr-engineer ↔ code-reviewer → qa-engineer",
    'require `agent_id="qa-engineer"`',
    "qa-engineer-exclusive",
    "ONLY qa-engineer flips the final",
    "(qa-engineer, PASS)",
    "`qa_round` cap",
    "`(code-reviewer, In_Progress) → (qa-engineer, In_Progress)`",
    // E435: the marker, the qa round counter and the removed ledger code are gone from every served text.
    "chain_path",
    "qa_round",
    "QA_ROUND_EXCEEDED",
    "REVIEWER_COMPLETED_TASKS_REJECTED",
  ],
  noTicketTracker: "No ticket file for <tracker id> — start the `spec-workshop` prompt first.",
  scopeLine: "你只負責這張票走到裁判（code-reviewer）PASS；波次層級的核取項屬於整合者。",
  descQa: "QA role. Write each ticket scenario as a test before the build; no verdict.",
  descCodeReviewer: "Code review role — the chain's judge: reviews tests and implementation, writes PASS.",
  tplQaDesc: "Test author — writes each ticket scenario as a test before sr-engineer builds; never judges.",
  tplCrDesc: "Adversarial judge — reviews the tests and the diff against the ticket scenarios, writes PASS.",
  hintExpectedRed:
    "qa_reports/expected-red_<feature>.txt is declared but no ## Expected-Red Diff section was found in any " +
    "qa_reports/review_<id>.md for the PASS'd ids (covers: files count). Run the Expected-Red Diff step " +
    "(skill-code-reviewer) — diff the actual suite reds against the manifest and record the disposition before PASS.",
  // E433's two-judge release wording; E435 removes it (absence pinned in AC10).
  oldReleaseGate: "`(code-reviewer, PASS)` on a feature marked `chain_path: test-first`, `(qa-engineer, PASS)` on an unmarked one",
  // E435 architecture Copy (T-42), verbatim.
  releaseCd63:
    "- [ ] One `docs/*` pull request, merged to `main`, carries both the release gate feature's PASS state write from its judge (`.current/_primary/handoff.md`), `(code-reviewer, PASS)`, and the release's CHANGELOG entry under `## [Unreleased]`.",
  releaseCd69:
    "After a successful release, `main`'s handoff is no longer the judge's `(code-reviewer, PASS)` and `## [Unreleased]` is empty, so dispatching again by mistake stops at once (`PRECONDITION_NOT_PASS` or `CHANGELOG_ENTRY_MISSING`) instead of releasing twice.",
  releaseCd95:
    "`.current/_primary/handoff.md` on `main` is not the judge's `(code-reviewer, PASS)`, has no usable `active_feature`, or cannot be parsed; the detail names the tuple",
  // E435 architecture Copy (T-36 / T-32), verbatim.
  const06Line7: "- `status=PASS` and `tw_complete_task` require the chain's judge, `agent_id=\"code-reviewer\"`.",
  qaLine13Tail: "Because you never write FAIL, no qa round is counted; the loops",
  qaLine31: "A `TRANSITION_REJECTED` on the claim: stop and report it with the rejection's hint.",
  archHandoff: "(`architect → sr-engineer` is not an edge)",
  readmeQaRow: "| qa-engineer      | high   | `opus`            | Writes every scenario test first; sr-engineer cannot edit them.      |",
  readmeCrRow: "| code-reviewer    | high   | `opus`            | Detail sensitivity; the chain's judge — reviews tests and code, writes PASS. |",
};

// The Builder ≠ judge bullet exactly as at base (frozen in-test fixture; unchanged by E433, AC2 (c)).
const BUILDER_NE_JUDGE =
  "- **Builder ≠ judge (role-collapse guard)**: the actor that built or edited a change MUST NOT author its code-review verdict, its qa verdict (visual verdict included), or its PASS. With no independent judge context available, the work stops at `status=Blocked` (\"awaiting independent QA\") — never a builder-signed verdict.";

// ------------------------------------------------------------------ composed prompts (non-design, as served)

const tmpDirs = [];
after(() => {
  for (const d of tmpDirs) {
    try { fs.rmSync(d, { recursive: true, force: true }); } catch { /* best effort */ }
  }
});

const FEATURE = "e433-fixture-feature";
const WS = fs.mkdtempSync(path.join(os.tmpdir(), "e433-ws-"));
tmpDirs.push(WS);
setActiveStorage(new FileHandoffStorage());
await new FileHandoffStorage().writeState(WS, FEATURE, "In_Progress", [], []);
assert.ok(!fs.existsSync(path.join(WS, "design")), "fixture workspace is non-design");

// The five roles: stripOriginTags + stripRationale are applied by buildPromptForRole (fullDetail=false).
const FIVE = {
  "qa-engineer": "skill-qa-engineer.md",
  "sr-engineer": "skill-sr-engineer.md",
  "code-reviewer": "skill-code-reviewer.md",
  pm: "skill-pm.md",
  teamwork: "skill-coordinator.md",
};
const BUNDLE = {};
for (const [role, skill] of Object.entries(FIVE)) {
  BUNDLE[role] = buildPromptForRole(skill, role, WS).messages[0].content.text;
}

// ------------------------------------------------------------------ closed-range base capture

const BASE_SHA = "96708e6c5c0347a94297f225057464eeeb2c13eb"; // E432 merge, the lane's base
const END_SHA = "ac5a692388dfa4a3cd8690150e94b5ac4cebeb56"; // last E433 content commit (T-E433-12)

function git(args) {
  return spawnSync("git", args, { cwd: ROOT, encoding: "utf-8", maxBuffer: 64 * 1024 * 1024 });
}
let rangeSkipReason = null;
for (const sha of [BASE_SHA, END_SHA]) {
  const r = git(["rev-parse", "--verify", `${sha}^{commit}`]);
  if (r.status !== 0) rangeSkipReason = `commit ${sha} is not reachable in this clone (shallow or squash-merged)`;
}
if (rangeSkipReason) console.warn(`[WARN] e433: closed-range checks skipped loudly: ${rangeSkipReason}`);

// File text at a fixed sha, captured into memory now (git archive piped through tar, no temp dir kept).
function textAt(sha, rel) {
  const a = spawnSync("git", ["archive", "--format=tar", sha, rel], { cwd: ROOT, maxBuffer: 64 * 1024 * 1024 });
  if (a.status !== 0) throw new Error(`git archive ${sha} ${rel} failed: ${String(a.stderr)}`);
  const x = spawnSync("tar", ["-xO"], { input: a.stdout, maxBuffer: 64 * 1024 * 1024 });
  if (x.status !== 0) throw new Error(`tar extract of ${rel} failed: ${String(x.stderr)}`);
  return x.stdout.toString("utf-8");
}
function changedBetween(...paths) {
  const r = git(["diff", "--name-only", BASE_SHA, END_SHA, "--", ...paths]);
  assert.equal(r.status, 0, r.stderr);
  return r.stdout.split("\n").filter(Boolean);
}
async function registryFrom(text) {
  const mod = await import(`data:text/javascript;base64,${Buffer.from(text, "utf-8").toString("base64")}`);
  return mod.GATE_REGISTRY;
}
const BASE_REGISTRY_TEXT = rangeSkipReason ? null : textAt(BASE_SHA, "dist/gates/registry.js");
const END_REGISTRY_TEXT = rangeSkipReason ? null : textAt(END_SHA, "dist/gates/registry.js");
const BASE_LP = rangeSkipReason ? null : textAt(BASE_SHA, "docs/lane-protocol.md");
const BASE_LPA = rangeSkipReason ? null : textAt(BASE_SHA, "docs/lane-protocol-addendum.md");
const END_LP = rangeSkipReason ? null : textAt(END_SHA, "docs/lane-protocol.md");
const END_LPA = rangeSkipReason ? null : textAt(END_SHA, "docs/lane-protocol-addendum.md");

// ------------------------------------------------------------------ AC1

// Sentences of the bundle that assign (or describe who may do) PASS, tw_complete_task or completed_tasks growth.
function judgeAssignmentSentences(text) {
  return text
    .split(/(?<=[.;!?])\s+|\n+/)
    .filter((s) => /status=PASS|`tw_complete_task`|completed_tasks/.test(s))
    .filter((s) => /flips|require|grows|ownership|only the|your PASS|PASS row|PASS and|Then `tw_complete_task\(/.test(s));
}

for (const role of Object.keys(FIVE)) {
  test(`AC1 (E435): composed ${role} prompt carries chain.main, no forbidden old-judge or marker string, and every PASS / tw_complete_task / completed_tasks sentence names code-reviewer`, () => {
    const text = BUNDLE[role];
    assert.ok(text.includes(COPY.chainMain), `${role}: chain.main line present`);
    for (const f of COPY.forbidden) assert.ok(!text.includes(f), `${role}: forbidden string present: ${f}`);
    const sentences = judgeAssignmentSentences(text);
    assert.ok(sentences.length > 0, `${role}: the judge-assignment sentences were found`);
    for (const s of sentences) {
      assert.ok(!/agent_id="qa-engineer"/.test(s), `${role}: qa-engineer named as PASS / completion identity: ${s.slice(0, 160)}`);
      assert.ok(
        !/\bqa-engineer\b[^.;\n]{0,40}\b(flips|owns|grows|may write|writes `status=PASS`)\b/.test(s),
        `${role}: qa-engineer assigned judge duties: ${s.slice(0, 160)}`,
      );
    }
    // Positive: the judge is named where PASS is assigned, and the ownership bullet names code-reviewer.
    assert.ok(
      text.includes("`status=PASS` and `tw_complete_task` require the chain's judge, `agent_id=\"code-reviewer\"`"),
      `${role}: const-06 PASS identity sentence`,
    );
    assert.ok(
      text.includes("**`tw_complete_task` ownership**: ONLY the chain's judge, code-reviewer, flips the final `[x]`"),
      `${role}: const-05 ownership bullet`,
    );
  });
}

// ------------------------------------------------------------------ AC2

test("AC2 (E435): constitution fragments — judge clause (a), test ownership (b), builder ≠ judge unchanged (c), Limits (d), ownership + disclosure (e), build gate (f), state update (g)", () => {
  const c06 = content("const-06-chain-31-head.md");
  const c05 = content("const-05-core-standards.md");
  const c01 = content("const-01-core-head.md");

  // (a) E435: the judge clause is unconditional — const-06 line 7 is the Copy text, no marker anywhere.
  assert.equal(c06.split("\n")[6], COPY.const06Line7, "(a) const-06 line 7 names the judge, agent_id code-reviewer, no marker condition");
  assert.ok(!c06.includes("chain_path"), "(a) const-06 no longer names the chain_path marker");

  // (b)
  const ownership = c05.split("\n").find((l) => l.startsWith("- **Test ownership**"));
  assert.ok(ownership, "(b) Test ownership bullet exists");
  assert.ok(ownership.includes("ONLY qa-engineer writes test files"), "(b) keeps 'ONLY qa-engineer writes test files'");
  assert.ok(ownership.includes("mechanical import/require-path retargets"), "(b) keeps the import-path carve-out");
  assert.ok(
    ownership.includes("bug tickets: when qa-engineer recorded no new test, sr-engineer writes the reproduction test, and sr-engineer may add lower-level tests of its own"),
    "(b) adds the bug-ticket exception",
  );
  assert.ok(ownership.includes("sr-engineer never edits a test qa-engineer wrote"), "(b) sr never edits a qa-written test");

  // (c) frozen base bullet, exactly once
  assert.equal(count(c05, BUILDER_NE_JUDGE), 1, "(c) Builder ≠ judge bullet byte-identical to base");

  // (d)
  assert.ok(!c01.split("\n").some((l) => /^\| `qa_round`/.test(l)), "(d) no qa_round Limits row");
  const row = c01.split("\n").find((l) => l.startsWith("| `sr_return` cap"));
  assert.ok(row, "(d) sr_return cap row exists");
  const cells = row.split("|").map((c) => c.trim()).filter(Boolean);
  assert.equal(cells[1], "2", "(d) sr_return value 2");
  assert.ok(cells[2].includes("sr-engineer returns of one feature to qa-engineer before routing locks to pm"), "(d) sr_return meaning");

  // (e)
  const ownerLine = c05.split("\n").find((l) => l.startsWith("- **`tw_complete_task` ownership**"));
  assert.ok(ownerLine.includes("code-reviewer"), "(e) tw_complete_task ownership names code-reviewer");
  const cond = c05.split("\n").find((l) => l.startsWith("- **Conditional test writing**"));
  assert.ok(
    cond.includes("disclose the decision in BOTH `pending_notes` and the qa test report (`qa_reports/tests_<feature>.md`), never in `qa_review`"),
    "(e) Conditional test writing (c) discloses in pending_notes and the qa test report, not qa_review",
  );

  // (f)
  const gate = c05.split("\n").find((l) => l.startsWith("- **Build gate**"));
  assert.ok(gate.includes("on the qa-engineer → sr-engineer hand-off only, compile errors are allowed solely in test files listed in `qa_reports/expected-red_<feature>.txt`, each entry with its reason"), "(f) R1 = (a)");
  assert.ok(gate.includes("An sr-engineer return of a test to qa-engineer"), "(f) D19 return clause");
  assert.ok(gate.includes("may carry back only those listed errors and adds none"), "(f) D19 carries back only listed errors, adds none");
  assert.ok(gate.includes("Every other hand-off, sr-engineer → code-reviewer included, stays at zero"), "(f) every other hand-off stays at zero");
  // (f) D21: the allowance covers sr's stop to pm as well; sr -> code-reviewer stays zero
  assert.ok(
    gate.includes("or its stop to pm (`sr_return` cap reached, or a scenario cannot be built), may carry back only those listed errors and adds none"),
    "(f) D21 allowance covers sr-engineer's stop to pm (both cases)",
  );
  assert.ok(
    gate.indexOf("Every other hand-off, sr-engineer → code-reviewer included, stays at zero") > gate.indexOf("stop to pm"),
    "(f) D21 sr-engineer → code-reviewer is named as zero after the allowance, not inside it",
  );

  // (g) D21: State update — a role the server accepts no write from stops and reports; a writable role takes over
  const upd = c05.split("\n").find((l) => l.startsWith("- **State update**"));
  assert.ok(upd, "(g) State update bullet exists");
  assert.ok(
    upd.includes("When the server accepts no write from the acting role, that role stops and reports instead, and a role that can write takes over."),
    "(g) State update carries the D21 sentence verbatim",
  );
  assert.ok(upd.includes("On crash/failure, still call it with the failure summary in `pending_notes`."), "(g) existing crash/failure sentence kept");
});

// ------------------------------------------------------------------ AC3

test("AC3 (E435): skill-qa-engineer.md alone makes qa the test author (scenarios, public interface, open interface details, manifest, no verdict, return loops, bug ticket)", () => {
  const qa = content("skill-qa-engineer.md");
  const must = [
    "one test per ticket scenario, written against the public interface only",
    "commands, tool calls, file formats",
    "Never test internal functions or private modules",
    "the existing interfaces the scenarios touch",
    "the project's test conventions",
    "When `specs/<feature>-architecture.md` has `## Interface Contracts`, follow them exactly",
    "decide it yourself",
    "## Open Interface Details",
    "(command name, parameter, exit code, output format)",
    "## Red Reasons",
    "`qa_reports/expected-red_<feature>.txt`",
    "`qa_reports/no-new-test_<feature>.txt`",
    "**Do not read the ticket's implementation**",
    "You never write `status=PASS` or `status=FAIL`, never pass `completed_tasks`",
    "never call `tw_complete_task` or `tw_rollback_task`",
    "then hand to sr-engineer (step 7), never straight back to code-reviewer",
    "the automatable scenarios are the reproduction — write them as red tests",
  ];
  for (const s of must) assert.ok(qa.includes(s), `qa SOP must contain: ${s}`);
  assert.ok(qa.includes("for the batch summary"), "open interface details are for the batch summary");
  assert.ok(!qa.includes("Phase 1.5"), "no Phase 1.5");
  assert.ok(!qa.includes("skill-qa-visual"), "no skill-qa-visual");
  assert.ok(!qa.includes("recommended_model: sonnet"), "no recommended_model: sonnet");
  assert.ok(qa.startsWith("---\nrecommended_model: opus\n---\n"), "frontmatter is recommended_model: opus");
  // E435: no qa round, no marker — line 13 tail and the claim's rejection sentence are the Copy texts.
  assert.ok(qa.includes(COPY.qaLine13Tail), "line 13 tail: no qa round is counted");
  assert.ok(qa.includes(COPY.qaLine31), "claim rejection sentence carries no marker diagnosis");
  for (const s of ["qa_round", "QA_ROUND_EXCEEDED", "chain_path"]) assert.ok(!qa.includes(s), `qa SOP no longer names ${s}`);
});

// ------------------------------------------------------------------ AC4

test("AC4: skill-sr-engineer.md builds to pre-written tests, has both return routes with Escalation Routes rows, and no QA Round Reply", () => {
  const sr = content("skill-sr-engineer.md");
  const must = [
    "Implement to the pre-written tests and the ticket scenarios",
    "Never edit a pre-written test (only the Constitution §2 import-path carve-out)",
    "WHEN a test contradicts a scenario or collides with existing code",
    "`sr-engineer:In_Progress → qa-engineer:In_Progress`",
    "with a concrete reason",
    "compare it with the `sr_return` cap",
    "(in hops, not in `review_round`)",
    "that claim is rejected with `SR_RETURN_CAP_EXCEEDED` and only pm may take the feature",
    "WHEN a scenario cannot be built → DO stop per *Escalation Routes: scenario cannot be built* — to pm, never to qa-engineer",
    "Run qa-engineer's fixed tests against the implementation",
    "Only when qa-engineer recorded no new test (`qa_reports/no-new-test_<active_feature>.txt`) do you write the reproduction test",
    "qa-engineer's red scenario test is the reproduction",
  ];
  for (const s of must) assert.ok(sr.includes(s), `sr SOP must contain: ${s}`);
  assert.ok(sr.includes("Rejection Re-Check"), "a qa-routed rejection is re-checked before handing to code-reviewer");
  assert.ok(sr.includes("all pass → pass it through unchanged"), "re-check: fix or pass through");
  assert.ok(sr.includes('next_role="code-reviewer", pending_notes=["sr-engineer: re-checked after code-reviewer Round <N>"]'), "re-check hands to code-reviewer");
  assert.ok(!sr.includes("QA Round Reply"), "QA Round Reply section is gone");
  const routes = sr.slice(sr.indexOf("## Escalation Routes"));
  const row1 = routes.split("\n").find((l) => l.includes("(return route 1)"));
  const row2 = routes.split("\n").find((l) => l.includes("(return route 2)"));
  assert.ok(row1 && /\| qa-engineer \|$/.test(row1.trim()), "return route 1 row routes to qa-engineer");
  assert.ok(row2 && /\| Blocked \|/.test(row2) && /\| pm \|$/.test(row2.trim()), "return route 2 row is Blocked to pm");
  assert.ok(routes.includes("`sr_return` cap reached"), "a row for the cap");
});

// ------------------------------------------------------------------ AC5

test("AC5 (E435): skill-code-reviewer.md is the chain's judge (tests vs scenarios, full suite, Expected-Red Diff, AC Execution, audits, PASS and rejection rows, clean-context carve-outs)", () => {
  const cr = content("skill-code-reviewer.md");
  const must = [
    "A missing scenario, a loose assertion (would pass on a wrong result) or a test of internals is a `required` finding and a rejection reason (test defect)",
    "**Run the full suite**",
    "**Expected-Red Diff**",
    "`## Expected-Red Diff`",
    "**Bugfix branch**",
    "load-bearing",
    "**AC Execution**",
    "`## AC Execution Log`",
    "one entry per ticket scenario (per spec AC when there is no ticket file",
    "scenario id, command (or test), raw outcome / exit code, pass/fail",
    "**Copy audit**",
    "**Visual-token audit**",
    "confirm the fix addresses the cause, not only the scenario",
    '`tw_update_state(status=PASS, agent_id="code-reviewer", review_verdict="APPROVED", completed_tasks=[<ids>], qa_review="<summary>", qa_suite_result={passed, total, command})`',
    'Then `tw_complete_task(<task-id>, agent_id="code-reviewer")` per id',
    '`tw_update_state(status=FAIL, agent_id="code-reviewer", review_verdict="CHANGES_REQUESTED", review_task_ids=[<ids>]',
    "`tw_rollback_task(<task-id>, <reason>)`",
    "Each rejection counts once in `review_round`",
    "after the `review_round` cap of FAILs only `(pm, In_Progress)` is accepted",
    "`qa_reports/expected-red_<feature>.txt`, `qa_reports/no-new-test_<feature>.txt`, `qa_reports/tests_<feature>.md`",
    "Do NOT read sr-engineer's `pending_notes` commentary",
  ];
  for (const s of must) assert.ok(cr.includes(s), `code-reviewer SOP must contain: ${s}`);
  const routes = cr.slice(cr.indexOf("## Escalation Routes"));
  const rows = routes.split("\n").filter((l) => l.startsWith("|"));
  const byCause = (needle) => rows.find((l) => l.includes(needle));
  assert.ok(/\| qa-engineer \|$/.test(byCause("test defect").trim()), "test defect routes to qa-engineer");
  assert.ok(/\| sr-engineer \|$/.test(byCause("implementation only").trim()), "implementation only routes to sr-engineer");
  assert.ok(/\| pm \|$/.test(byCause("scenario defect").trim()), "scenario defect routes to pm");
  // No row hands APPROVED to qa-engineer: the PASS row routes to a human, never to qa.
  assert.ok(!/APPROVED[^\n]*\|\s*qa-engineer\s*\|/.test(routes), "no APPROVED → qa-engineer row");
  assert.ok(/\| PASS \| PASS \|[^|]*\| human \|/.test(byCause("| PASS |")), "PASS row ends the chain at the human");
  // E435: the judge needs no marker, so the "The marker" bullet and its removed code are gone.
  assert.ok(!cr.includes("**The marker**"), "no 'The marker' bullet");
  assert.ok(!cr.includes("REVIEWER_COMPLETED_TASKS_REJECTED"), "no REVIEWER_COMPLETED_TASKS_REJECTED");
  assert.ok(!cr.includes("chain_path"), "code-reviewer SOP no longer names chain_path");
});

// ------------------------------------------------------------------ AC6

test("AC6 (E435): pm routes architect or qa-engineer with no marker, bugfix mode, amend path and counters; architect routes to qa-engineer", () => {
  const pm = content("skill-pm.md");
  assert.ok(pm.includes('next_role="architect" or "qa-engineer", pending_notes=[...])'), "step 8 routes architect or qa-engineer, no marker argument");
  assert.ok(!pm.includes("Set the `chain_path"), "no 'Set the chain_path marker' sentence");
  assert.ok(!pm.includes("(with the `chain_path` marker)"), "bugfix write carries no marker clause");
  assert.ok(!pm.includes("chain_path"), "pm SOP no longer names chain_path");
  assert.ok(pm.includes("the default bugfix chain is pm → qa-engineer → sr-engineer → code-reviewer"), "bugfix chain (§15.2 ruling 7)");
  assert.ok(pm.includes("step 8 → architect/qa-engineer"), "Gate Summary build-entry wording names architect/qa-engineer");
  assert.ok(pm.includes("an amendment normally hands back to qa-engineer over the normal entry"), "amend path hands back to qa");
  assert.ok(pm.includes("the build-entry gates and cut approval re-arm"), "gates and cut approval re-armed on the amend path");
  assert.ok(pm.includes('resumes a stranded judge, set the first-class `resume_of` field to `"code-reviewer"`'), "resume_of code-reviewer kept for a stranded judge");
  assert.ok(pm.includes("`review_round` (code-reviewer rejections) and `sr_return` (sr-engineer"), "the two counters are named");

  const arch = content("skill-architect.md");
  assert.ok(arch.includes('next_role="qa-engineer", pending_notes=["Architecture ready"]'), "architect hand-off routes to qa-engineer");
  assert.ok(!arch.includes('next_role="sr-engineer"'), "architect no longer routes to sr-engineer");
  assert.ok(arch.includes(COPY.archHandoff), "architect → sr-engineer is not an edge (no marker condition)");
  assert.ok(!arch.includes("chain_path"), "architect SOP no longer names chain_path");

  const coord = BUNDLE.teamwork;
  assert.ok(coord.includes(COPY.chainMain), "coordinator §4 chain is the one routed");
  assert.ok(coord.includes("| test, write tests, test authoring | `qa-engineer` |"), "intent table: test authoring → qa-engineer");
  assert.ok(coord.includes("| review, code review, judge diff, verify, validate, rollback | `code-reviewer` |"), "intent table: verify / validate / rollback → code-reviewer");
  assert.ok(count(coord, "`next_role` is `architect` or `qa-engineer`") >= 2, "build-entry gate rows read architect or qa-engineer");
  const mini = coord.split("\n").find((l) => l.includes("**(ii) mini-chain**"));
  assert.ok(mini, "mini-chain bullet exists");
  assert.ok(mini.includes('open with a pm-stamped write (`agent_id="pm"`, `status=In_Progress`)'), "mini-chain: pm-stamped opening write");
  assert.ok(mini.includes("then qa-engineer → sr-engineer → code-reviewer"), "mini-chain: then qa → sr → code-reviewer");
  assert.ok(!mini.includes("chain_path"), "mini-chain: no marker clause");
  assert.ok(coord.includes("fresh dispatch of the judge alone (`code-reviewer`)"), "single-role judge dispatch names code-reviewer only");
  assert.ok(!coord.includes("exactly one judge role (`code-reviewer` or `qa-engineer`)"), "no qa-engineer judge dispatch");
  assert.ok(coord.includes(COPY.noTicketTracker), "a tracker number with no ticket file gets msg.no_ticket_tracker");
  assert.ok(coord.includes("never write the ticket's scenarios yourself"), "no scenario is written for a bare tracker id");
});

// ------------------------------------------------------------------ AC7

test("AC7: release-engineer / doc-writer / integrator name the judge's PASS; PROMPT_TEMPLATE_3B scope line; PROMPT_REGISTRY descriptions", () => {
  for (const f of ["skill-release-engineer.md", "skill-doc-writer.md", "skill-integrator.md"]) {
    const t = content(f);
    assert.ok(t.includes("(code-reviewer, PASS)"), `${f} names (code-reviewer, PASS)`);
    assert.ok(!t.includes("(qa-engineer, PASS)"), `${f} has no (qa-engineer, PASS)`);
    assert.ok(!t.includes("qa PASS"), `${f} has no 'qa PASS'`);
  }

  // PROMPT_TEMPLATE_3B: scope line, and its unchanged properties.
  const lines = PROMPT_TEMPLATE_3B.split("\n");
  assert.equal(count(PROMPT_TEMPLATE_3B, COPY.scopeLine), 1, "the scope line is tpl.scope_line, once");
  assert.ok(!PROMPT_TEMPLATE_3B.includes("走到 qa PASS"), "old scope line gone");
  assert.equal(count(PROMPT_TEMPLATE_3B, "docs/lane-protocol.md"), 1, "single lane-rules pointer");
  const nonBlank = lines.filter((l) => l.trim() !== "");
  assert.equal(new Set(nonBlank).size, nonBlank.length, "no duplicate line");
  const src = read("tools/fanout-manifest.ts");
  assert.ok(
    src.includes("Integrator dispatch-prompt template — the single canonical copy (E178a).") &&
      src.includes("The bytes are pinned by the E177a render golden — do not edit the wording"),
    "provenance doc comment kept",
  );

  const byName = Object.fromEntries(PROMPT_REGISTRY.map((p) => [p.name, p.description]));
  assert.equal(byName["qa-engineer"], COPY.descQa, "desc.qa");
  assert.equal(byName["code-reviewer"], COPY.descCodeReviewer, "desc.code_reviewer");
});

// ------------------------------------------------------------------ AC8

function frontmatter(text) {
  const m = /^---\n([\s\S]*?)\n---\n/.exec(text);
  assert.ok(m, "frontmatter present");
  return Object.fromEntries(m[1].split("\n").map((l) => [l.slice(0, l.indexOf(":")), l.slice(l.indexOf(":") + 1).trim()]));
}

test("AC8: templates pin qa-engineer opus (tpl.qa_desc), code-reviewer opus (tpl.cr_desc), sr-engineer opus; each model equals its SOP recommended_model", () => {
  const tplDir = path.join("templates", "claude-code-agents");
  const qa = frontmatter(read(path.join(tplDir, "qa-engineer.md")));
  const cr = frontmatter(read(path.join(tplDir, "code-reviewer.md")));
  const sr = frontmatter(read(path.join(tplDir, "sr-engineer.md")));
  assert.equal(qa.model, "opus");
  assert.equal(qa.description, COPY.tplQaDesc);
  assert.equal(cr.model, "opus");
  assert.equal(cr.description, COPY.tplCrDesc);
  assert.equal(sr.model, "opus");
  for (const role of ["qa-engineer", "code-reviewer", "sr-engineer"]) {
    const tpl = frontmatter(read(path.join(tplDir, `${role}.md`)));
    const sop = frontmatter(content(`skill-${role}.md`));
    assert.equal(tpl.model, sop.recommended_model, `${role}: template model equals the SOP's recommended_model`);
  }
});

// ------------------------------------------------------------------ AC9

test("AC9 (E435): hints — MISSING_EVIDENCE unchanged, two rewritten hints name steps that exist in skill-code-reviewer.md, 33 live entries (35 in the closed range), only SR_RETURN_CAP_EXCEEDED documentedInProse flipped", async (t) => {
  // E435: two ledger codes and QA_ROUND_EXCEEDED leave, NON_JUDGE_COMPLETED_TASKS_REJECTED joins → 33.
  assert.equal(GATE_REGISTRY.length, 33, "the live registry has 33 entries");
  const live = Object.fromEntries(GATE_REGISTRY.map((g) => [g.errorCode, g]));
  const cr = content("skill-code-reviewer.md");

  // hint.expected_red verbatim; hint.ac_log carries the two substitutions.
  assert.equal(live.EXPECTED_RED_DIFF_MISSING.hintStatic, COPY.hintExpectedRed);
  assert.ok(live.AC_EXECUTION_LOG_MISSING.hintStatic.includes("Run the AC Execution step (skill-code-reviewer)"));
  assert.ok(live.AC_EXECUTION_LOG_MISSING.hintStatic.includes("truthfulness stays with the judge."));
  assert.ok(!live.AC_EXECUTION_LOG_MISSING.hintStatic.includes("Phase 3.5"), "no dangling qa Phase 3.5 pointer");
  assert.ok(!live.AC_EXECUTION_LOG_MISSING.hintStatic.includes("qa-engineer / code-reviewer"), "old truthfulness owner gone");
  // each step the hints name exists by that label in the code-reviewer SOP
  assert.ok(cr.includes("**Expected-Red Diff**"), "Expected-Red Diff step label exists");
  assert.ok(cr.includes("**AC Execution**"), "AC Execution step label exists");

  // The errorCode → doc-file mapping comment matches the backtick-quote sites.
  const src = read("gates/registry.ts");
  const header = src.indexOf("// errorCode → doc-file mapping");
  const endAt = src.indexOf("export const GATE_REGISTRY", header);
  assert.ok(header > 0 && endAt > header, "mapping comment located");
  const rows = src.slice(header, endAt).split("\n").map((l) => /^\/\/   ([A-Z_]+)\s+(.+)$/.exec(l)).filter(Boolean);
  assert.ok(rows.length >= 20, "mapping rows parsed");
  for (const [, code, files] of rows) {
    if (files.trim() === "(none)") continue;
    for (const f of files.split(",").map((x) => x.trim())) {
      assert.ok(content(f).includes(`\`${code}\``), `${code}: ${f} backtick-quotes it`);
    }
  }

  // Closed range: base vs the lane's last content commit.
  if (rangeSkipReason) return t.skip(rangeSkipReason);
  const base = Object.fromEntries((await registryFrom(BASE_REGISTRY_TEXT)).map((g) => [g.errorCode, g]));
  const end = Object.fromEntries((await registryFrom(END_REGISTRY_TEXT)).map((g) => [g.errorCode, g]));
  assert.deepEqual(Object.keys(end), Object.keys(base), "same 35 codes in the same order");
  assert.equal(end.MISSING_EVIDENCE.hintStatic, base.MISSING_EVIDENCE.hintStatic, "MISSING_EVIDENCE hintStatic byte-identical to base");
  const derivedAcLog = base.AC_EXECUTION_LOG_MISSING.hintStatic
    .replace("Run Phase 3.5 (skill-qa-engineer)", "Run the AC Execution step (skill-code-reviewer)")
    .replace("truthfulness stays with qa-engineer / code-reviewer.", "truthfulness stays with the judge.");
  assert.equal(end.AC_EXECUTION_LOG_MISSING.hintStatic, derivedAcLog, "hint.ac_log is the base text with exactly the two substitutions");
  assert.equal(live.AC_EXECUTION_LOG_MISSING.hintStatic, derivedAcLog, "the compiled registry serves hint.ac_log");
  for (const code of Object.keys(base)) {
    const b = { ...base[code] };
    const e = { ...end[code] };
    if (code === "EXPECTED_RED_DIFF_MISSING" || code === "AC_EXECUTION_LOG_MISSING") { delete b.hintStatic; delete e.hintStatic; }
    if (code === "SR_RETURN_CAP_EXCEEDED") {
      assert.equal(base[code].documentedInProse, false, "SR_RETURN_CAP_EXCEEDED was false at base");
      assert.equal(end[code].documentedInProse, true, "SR_RETURN_CAP_EXCEEDED is true now (D16)");
      delete b.documentedInProse; delete e.documentedInProse;
    }
    assert.deepEqual(e, b, `${code}: every other field (incl. armCondition, documentedInProse) byte-identical to base`);
  }
});

// ------------------------------------------------------------------ AC10

test("AC10 (E435): README / architecture / release-cd — chain.docs, qa opus row and pin sentence, one-judge release gate wording", () => {
  const readme = read("README.md");
  const arch = read("docs/architecture.md");
  const rel = read("docs/release-cd.md");

  assert.ok(readme.includes(`**Routing chain** (full mode): \`${COPY.chainDocs}\``), "README chain line");
  assert.ok(arch.split("\n").some((l) => l.trim() === COPY.chainDocs), "architecture chain line");
  assert.ok(readme.includes(COPY.readmeQaRow), "README qa-engineer tier row says opus (readme.qa_row)");
  assert.ok(readme.includes(COPY.readmeCrRow), "README code-reviewer row names the judge");
  const pin = readme.split("\n").find((l) => l.startsWith("Repeat with `model: sonnet`"));
  assert.ok(pin, "README pin sentence exists");
  assert.ok(pin.startsWith("Repeat with `model: sonnet` for pm / coordinator and `model: haiku` for coordinator-lite / doc-writer / release-engineer."), "readme.pin_line");
  assert.ok(!pin.includes("qa-engineer"), "qa-engineer left the sonnet list");
  assert.ok(!readme.includes("`sonnet` | Writes every scenario"), "no sonnet qa row");

  assert.ok(arch.includes('"review / verify / rollback"              → code-reviewer'), "architecture intent tree (:127)");
  assert.ok(arch.includes("qa(opus)"), "architecture tier line says qa(opus) (:184)");
  assert.ok(!arch.includes("qa(sonnet)"), "no qa(sonnet)");

  // E435: the release gate names one judge, (code-reviewer, PASS); the two-tuple marker wording is gone.
  const relLines = rel.split("\n");
  assert.ok(relLines.includes(COPY.releaseCd63), "release-cd checklist line (63) is the Copy text");
  assert.ok(relLines.includes(COPY.releaseCd69), "release-cd re-dispatch line (69) is the Copy text");
  const row = relLines.find((l) => l.includes("| PRECONDITION_NOT_PASS |"));
  assert.ok(row, "release-cd PRECONDITION_NOT_PASS row exists");
  assert.ok(row.split("|").map((c) => c.trim()).includes(COPY.releaseCd95), "PRECONDITION_NOT_PASS meaning cell (95) is the Copy text");
  assert.ok(!rel.includes(COPY.oldReleaseGate), "no two-judge release wording");
  assert.ok(!rel.includes("chain_path"), "release-cd no longer names chain_path");
  assert.ok(!rel.includes("(qa-engineer, PASS)"), "release-cd no longer names (qa-engineer, PASS)");
});

// ------------------------------------------------------------------ AC12

test("AC12 (E435): counts and hygiene — 33 gates, 17 pipeline steps, untouched server files, CLAUDE.md, dist diff", (t) => {
  // No live `agc check` here (E450): adapter-stamp freshness is release-time state, re-checked by the runner's prepare phase.
  assert.equal(GATE_REGISTRY.length, 33, "GATE_REGISTRY 33 entries (E435)");
  assert.equal(UPDATE_STATE_GATE_PIPELINE.length, 17, "UPDATE_STATE_GATE_PIPELINE 17 steps");
  assert.equal(read("CLAUDE.md").split("\n").length - (read("CLAUDE.md").endsWith("\n") ? 1 : 0), 250, "CLAUDE.md is 250 lines");

  if (rangeSkipReason) return t.skip(rangeSkipReason);
  // Closed range base..last content commit: byte-identical means "not in the diff".
  const untouched = changedBetween(
    "tools/transitions.ts", "tools/handoff-orchestrator.ts", "tools/tasks.ts", "schema", "prompts", "CLAUDE.md",
    "dist/tools/transitions.js", "dist/tools/handoff-orchestrator.js", "dist/tools/tasks.js", "dist/schema", "dist/prompts",
  );
  assert.deepEqual(untouched, [], "transitions / orchestrator / tasks / schema / prompts / CLAUDE.md byte-identical to base");
  const distChanged = changedBetween("dist");
  assert.ok(distChanged.length > 0, "dist diff is not empty (vacuity guard)");
  for (const f of distChanged) {
    assert.ok(
      /^dist\/(tools\/registry|tools\/fanout-manifest|gates\/registry)\./.test(f),
      `dist diff holds only the three owned outputs, found ${f}`,
    );
  }
});

// ------------------------------------------------------------------ AC13

test("AC13: lane-protocol test-ownership lines name the bug-ticket exception; every other line and heading is unchanged", (t) => {
  // Live content checks.
  const lp = read("docs/lane-protocol.md");
  const lpa = read("docs/lane-protocol-addendum.md");
  const l37 = lp.split("\n")[36];
  const l15 = lpa.split("\n")[14];
  for (const [name, line] of [["docs/lane-protocol.md:37", l37], ["docs/lane-protocol-addendum.md:15", l15]]) {
    assert.ok(line.includes("qa-engineer") && line.includes("sr-engineer") && line.includes("重現測試"), `${name} names the reproduction-test exception`);
    assert.ok(line.includes("qa-engineer 沒記下新測試"), `${name}: only when qa-engineer recorded no new test`);
    assert.ok(!line.includes("無例外"), `${name}: no 'no exceptions' wording`);
  }
  assert.ok(!lp.includes("無例外") && !lpa.includes("無例外"), "neither file says 無例外");
  const forbiddenInGeneric = [
    "node bin/agc-init.mjs", "npm run build", "rm node_modules", "dist/", "tasks-index-receipt.json", "check-md-tables",
    "test/e130-lane-default.test.mjs", "NEW-TICKETS.md", "node scripts/fanout.mjs", "註解 proof", "compose-golden",
    "context-budget", "content/**", "test/",
  ];
  for (const s of forbiddenInGeneric) assert.ok(!lp.includes(s), `docs/lane-protocol.md must not contain repo-only string: ${s}`);

  if (rangeSkipReason) return t.skip(rangeSkipReason);
  // Closed range: exactly line 37 / line 15 differ; every `## ` heading is kept.
  for (const [name, base, end, idx] of [
    ["docs/lane-protocol.md", BASE_LP, END_LP, 36],
    ["docs/lane-protocol-addendum.md", BASE_LPA, END_LPA, 14],
  ]) {
    const b = base.split("\n");
    const e = end.split("\n");
    assert.equal(e.length, b.length, `${name}: same line count`);
    const diff = b.map((l, i) => (l === e[i] ? -1 : i)).filter((i) => i >= 0);
    assert.deepEqual(diff, [idx], `${name}: only line ${idx + 1} differs from base`);
    assert.deepEqual(e.filter((l) => l.startsWith("## ")), b.filter((l) => l.startsWith("## ")), `${name}: ## headings unchanged`);
  }
});
