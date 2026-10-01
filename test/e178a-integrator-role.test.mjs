// Coded by @qa-engineer
// Tests for specs/e178a-integrator-role.md (ticket E178a). The integrator is a prompt only, never a tw_switch_role / agent_id role (spec decision D11).
// Content-assertion tests independent of the sr-engineer/code-reviewer claims in review_reports/review_T-E178A-01.md: they read the shipped SOP, the constitution fragment,
// docs/lane-protocol.md, tools/fanout-manifest.ts, CLAUDE.md/AGENTS.md and dist/ registries directly, so a paraphrase that drops an AC's substance fails here. One test per AC, named "AC<n>"
// (an unanchored --test-name-pattern "AC1" also matches AC10..AC17, harmless). AC17's golden/budget re-baseline is proven by the full suite, not re-derived here.
// Rationale: specs/e260f-comment-rationale.md (test/e178a-integrator-role.test.mjs).

import { test } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(__filename), "..");
const BASE_SHA = "3c72a83"; // lane e178a's base per specs/e178a-integrator-role.md

const SOP = fs.readFileSync(path.join(ROOT, "content", "skill-integrator.md"), "utf-8");
const CONST15 = fs.readFileSync(path.join(ROOT, "content", "const-15-core-tail.md"), "utf-8");
const LANE_PROTOCOL = fs.readFileSync(path.join(ROOT, "docs", "lane-protocol.md"), "utf-8");
const FANOUT_MANIFEST_TS = fs.readFileSync(path.join(ROOT, "tools", "fanout-manifest.ts"), "utf-8");
const CLAUDE_MD = fs.readFileSync(path.join(ROOT, "CLAUDE.md"), "utf-8");
const AGENTS_MD = fs.readFileSync(path.join(ROOT, "AGENTS.md"), "utf-8");
const ROLE_TS = fs.readFileSync(path.join(ROOT, "tools", "role.ts"), "utf-8");
const TRANSITIONS_TS = fs.readFileSync(path.join(ROOT, "tools", "transitions.ts"), "utf-8");
const INTEGRATOR_PROMPT_TS = fs.readFileSync(path.join(ROOT, "prompts", "integrator.ts"), "utf-8");

const { PROMPT_REGISTRY } = await import(path.join(ROOT, "dist", "tools", "registry.js"));
const { buildPromptForRole } = await import(path.join(ROOT, "dist", "prompts", "build.js"));
const { MODEL_TIERS } = await import(path.join(ROOT, "dist", "tools", "skill-frontmatter.js"));

function mkWorkspace() {
  const ws = fs.mkdtempSync(path.join(os.tmpdir(), "e178a-integrator-"));
  fs.mkdirSync(path.join(ws, ".current"), { recursive: true });
  return ws;
}

const INTEGRATOR_DESCRIPTION =
  "Integrator — plan parallel lanes, pre-review cuts, verify lane reports, merge, tear down. Cross-lane; writes no handoff state.";

// History-independent scope tests (E229): a permanent test must not assert on a historical commit SHA unless the assertion is about a historical diff
// (docs/lane-protocol.md guard note), and then must guard the lookup and skip loudly (shallow clone, adopter fork, single-commit recreation, E104).
// Mirrors test/e130-lane-default.test.mjs's copy of this helper, duplicated rather than imported so each file's proof stands alone.
function unresolvedSha(...shas) {
  for (const sha of shas) {
    try {
      execFileSync("git", ["rev-parse", "--verify", `${sha}^{commit}`], {
        cwd: ROOT,
        encoding: "utf-8",
        stdio: ["ignore", "pipe", "pipe"],
      });
    } catch {
      return sha;
    }
  }
  return null;
}

function skipIfHistoryAbsent(t, invariant, ...shas) {
  const missing = unresolvedSha(...shas);
  if (missing === null) return false;
  const notice = `HISTORY-DEPENDENT AC SKIPPED: commit ${missing} is not resolvable in this repo's history — skipping check of: ${invariant}`;
  console.warn(notice);
  t.skip(notice);
  return true;
}

// ---------------------------------------------------------------------------

test("AC1: content/skill-integrator.md — frontmatter, purpose, work-overview, permission table, you-are-not list, no-tier watermark", () => {
  // (a) frontmatter carries recommended_model: sonnet, a valid MODEL_TIERS entry
  assert.match(SOP, /^---\nrecommended_model: sonnet\n---\n/, "frontmatter must open with recommended_model: sonnet");
  assert.ok(MODEL_TIERS.includes("sonnet"), "sonnet must be a valid MODEL_TIERS entry (tools/skill-frontmatter.ts)");

  // (b) purpose section carries the interim's three human needs, the
  // why-no-existing-role rationale, and the one-sentence summary
  assert.match(SOP, /## Purpose — why this role exists/);
  assert.match(SOP, /Someone owns the close-out\./);
  assert.match(SOP, /Someone owns the fan-out\./);
  assert.match(SOP, /The human is not the mail carrier\./);
  assert.match(SOP, /\*\*Why no existing role can do it\*\*/);
  assert.match(SOP, /\*\*In one sentence\*\*/);

  // (c) work-overview table: stages 1-6 + "any time", human-gated marked
  assert.match(SOP, /## Work overview/);
  for (const stageCell of [
    "1. Fan-out planning",
    "2. 👤 Approval",
    "3. Dispatch",
    "4. Execution",
    "5. Verify and integrate",
    "6. Bookkeeping, main, teardown",
    "| any time |",
  ]) {
    assert.ok(SOP.includes(stageCell), `work-overview table missing stage row: ${stageCell}`);
  }

  // (d) can / cannot permission table
  assert.match(SOP, /## Permissions/);
  assert.match(SOP, /\| can \| cannot \|/);

  // (e) "you are not" list: not a builder, not a judge substitute, not any
  // lane's session (§3.2), not release-engineer
  assert.match(SOP, /\*\*You are not\*\*:/);
  for (const item of ["a builder", "a judge substitute", "any lane's session", "release-engineer"]) {
    assert.ok(SOP.includes(item), `"you are not" list missing: ${item}`);
  }
  assert.ok(SOP.includes("§3.2"), "the any-lane's-session item must cite §3.2 (builder != judge)");

  // (f) ends with the watermark rule, no tier
  const tail = SOP.trimEnd();
  assert.ok(
    tail.endsWith("(no tier: an MCP-prompt invocation is not Task-spawned, Constitution §1)."),
    "SOP must end with the no-tier watermark rule",
  );
  assert.match(SOP, /— @integrator/);
  assert.ok(!/— @integrator \([a-z]+\)/.test(SOP), "watermark must carry NO tier suffix (D11: not Task-spawned)");
});

test("AC2: manual steps replaced by references to shipped mechanisms; no restated dispatch-prompt template", () => {
  for (const cmd of [
    "fanout.mjs render",
    "fanout.mjs check",
    "fanout.mjs validate",
    "lane-status.mjs",
    "mailbox-watch.mjs",
    "test-lock.mjs",
    "merge-invariants.mjs",
    "agc feature finish",
  ]) {
    assert.ok(SOP.includes(cmd), `SOP must reference shipped mechanism by command: ${cmd}`);
  }
  assert.ok(
    !SOP.includes("開始做 <計劃或 feature>"),
    "SOP must not restate the §3b dispatch-prompt template literal (PROMPT_TEMPLATE_3B)",
  );
  assert.ok(
    SOP.includes("docs/lane-protocol.md"),
    "SOP must point to docs/lane-protocol.md for mailbox/report format rather than restate it",
  );
  assert.ok(
    SOP.includes("the only copy") || SOP.includes("the single copy"),
    "SOP must explicitly disclaim keeping a second copy of a shared mechanism",
  );
});

// Fully history-independent replacement for "diff vs base is
// additive-only" — pins the actual first-11 order/content/skillFile directly
// (byte-for-byte from tools/registry.ts as it stands 2026-09-27, 942f994),
// needs no git history at all, and never skips. Strictly stronger than the
// diff-based check it replaces (E229 AC3).
const FROZEN_FIRST_11_PROMPTS = [
  { name: "sr-engineer", description: "Load constitution, skill, state. Run first.", skillFile: "skill-sr-engineer.md" },
  { name: "researcher", description: "Deep research. Load constitution, skill, state.", skillFile: "skill-researcher.md" },
  { name: "pm", description: "PM role. Write specs, break down tasks, sync state.", skillFile: "skill-pm.md" },
  { name: "qa-engineer", description: "QA role. Verify code, write tests, rollback bugs.", skillFile: "skill-qa-engineer.md" },
  { name: "teamwork", description: "Agent Governance Coordinator. Route tasks or execute them.", skillFile: "skill-coordinator.md" },
  {
    name: "teamwork-lite",
    description: "Coordinator (lite). Solo-dev mode: direct execution, no chain, no state writes.",
    skillFile: "skill-coordinator-lite.md",
  },
  { name: "architect", description: "Architect role. Write system design, interface contracts.", skillFile: "skill-architect.md" },
  {
    name: "design-auditor",
    description: "Design audit. Extract Copy / Visual tokens from any design source.",
    skillFile: "skill-design-auditor.md",
  },
  {
    name: "code-reviewer",
    description: "Code review role — clean-context diff judge between sr-engineer and qa-engineer.",
    skillFile: "skill-code-reviewer.md",
  },
  {
    name: "doc-writer",
    description: "Documentation maintainer — keeps README / CHANGELOG / docs in sync after PASS.",
    skillFile: "skill-doc-writer.md",
  },
  {
    name: "release-engineer",
    description: "Release engineer — owns version bumps, CHANGELOG, git tag, and gh release after PASS.",
    skillFile: "skill-release-engineer.md",
  },
];

test("AC3: `integrator` MCP prompt registered as PROMPT_REGISTRY entry 12; prompts/integrator.ts matches the pm.ts pattern", () => {
  assert.equal(PROMPT_REGISTRY.length, 12, "PROMPT_REGISTRY must have exactly 12 entries");
  const last = PROMPT_REGISTRY.at(-1);
  assert.deepEqual(last, {
    name: "integrator",
    description: INTEGRATOR_DESCRIPTION,
    skillFile: "skill-integrator.md",
    arguments: PROMPT_REGISTRY[0].arguments,
  });

  // First 11 entries match the frozen pre-refactor order and content
  // (name/description/skillFile) directly — a strictly stronger,
  // history-independent replacement for "diff vs base is additive-only".
  const actualFirst11 = PROMPT_REGISTRY.slice(0, 11).map((e) => ({
    name: e.name,
    description: e.description,
    skillFile: e.skillFile,
  }));
  assert.deepEqual(actualFirst11, FROZEN_FIRST_11_PROMPTS, "PROMPT_REGISTRY's first 11 entries must match the frozen pre-refactor order and content");
  for (const entry of PROMPT_REGISTRY.slice(0, 11)) {
    assert.deepEqual(entry.arguments, PROMPT_REGISTRY[0].arguments, `entry ${entry.name} must carry the standard workspace_path argument`);
  }

  // prompts/integrator.ts: thin buildPromptForRole("skill-integrator.md", …) wrapper
  assert.match(INTEGRATOR_PROMPT_TS, /export function buildIntegratorPrompt/);
  assert.match(INTEGRATOR_PROMPT_TS, /buildPromptForRole\(\s*\n?\s*"skill-integrator\.md"/);
});

test("AC4: D11 holds — tools/role.ts and tools/transitions.ts contain no mention of `integrator`", () => {
  // D11 ("`integrator` is a prompt only — never a `tw_switch_role` / `agent_id`
  // role") is fully captured by "neither file mentions `integrator`" — the
  // historical byte-identity-to-base check added nothing D11 needs going
  // forward, and is dropped (E229 AC4: fully history-independent, never skips).
  assert.ok(!/integrator/.test(ROLE_TS), "tools/role.ts must not mention integrator");
  assert.ok(!/integrator/.test(TRANSITIONS_TS), "tools/transitions.ts must not mention integrator");

  // SOP states the integrator never calls tw_update_state / writes lane state;
  // read-only tw_get_state/tw_detect_drift/tw_gate_stats + tw_sync on primary allowed
  assert.ok(SOP.includes("**Never call `tw_update_state`**, and never write any lane's `.current/<lane>/`."));
  for (const tool of ["tw_get_state", "tw_detect_drift", "tw_gate_stats", "tw_sync"]) {
    assert.ok(SOP.includes(tool), `SOP must name ${tool} as an allowed read-only/sync tool`);
  }
});

test("AC5: prompt count synced 11 -> 12 in CLAUDE.md; integrator listed; AGENTS.md carries no prompt count", () => {
  const countMatches = (CLAUDE_MD.match(/12 registered role prompts|Twelve prompts are registered/g) || []).length;
  assert.equal(countMatches, 2, "CLAUDE.md must carry both the '12 registered role prompts' and 'Twelve prompts are registered' sentences");
  assert.ok(CLAUDE_MD.includes("`integrator`"), "CLAUDE.md's prompt list must include integrator");
  assert.ok(CLAUDE_MD.includes("the other ten"), "the per-role sentence must read 'the other ten' (was 'the other nine')");
  assert.ok(CLAUDE_MD.includes("the other 11 role SOPs"), "the content/skill-*.md layout line must read 'the other 11 role SOPs' (was 10)");
  assert.ok(!/\b11 registered role prompts\b|\bEleven prompts are registered\b/.test(CLAUDE_MD), "no stale 11/Eleven prompt-count sentence may remain");

  // AGENTS.md carries no prompt count at base (per spec); it stays that way here
  assert.ok(!/\bregistered role prompts\b|\bprompts are registered\b/.test(AGENTS_MD), "AGENTS.md must carry no prompt-count sentence");
});

test("AC6: const-15 §6 — integrator-only git grant; base list + FORBIDDEN entries unchanged", () => {
  // base sanctioned-mutations sentence, and FORBIDDEN list, both untouched in substance
  assert.ok(CONST15.includes("the only sanctioned git mutations are `git add`, `git commit`, `git tag`, fast-forward `git push`, and `git stash` / `git stash pop`"));
  for (const forbidden of [
    "`git reset`",
    "`git rebase`",
    "`git clean`",
    "force-push (`git push --force`)",
    "`git checkout --force`",
    "`git checkout -- <file>`",
  ]) {
    assert.ok(CONST15.includes(forbidden), `base FORBIDDEN list must retain: ${forbidden}`);
  }

  // integrator-only grant: exact clause, all six ops + exclusions, scope statement, SOP pointer
  assert.ok(
    CONST15.includes(
      "**Integrator-only grant**: only the `integrator` role may also run `git merge --no-ff`, `git merge --ff-only`, `git switch -c`, `git switch <existing-branch>` (never `--force` / `--discard-changes`), `git worktree remove` (never `--force`), `git branch -d` (never `-D`) and `git update-ref -d <ref> <expected-sha>` (compare-and-delete), when `skill-integrator` says; every other role stays on the base list.",
    ),
    "const-15 must carry the exact integrator-only grant clause",
  );
});

// Split out — "how many lines were added at ticket time" has no
// current-tree equivalent, so this sub-check stays inherently historical and
// is guarded + loud-skipped (same guard contract as
// test/e130-lane-default.test.mjs) rather than folded into the substance test
// above (E229 AC5).
test("AC6 (historical): const-15 §6 addition stays terse vs base", (t) => {
  if (skipIfHistoryAbsent(t, "const-15 §6 addition added-lines-count (<= 6) vs base " + BASE_SHA, BASE_SHA)) return;
  const addedLines = execFileSync("git", ["diff", BASE_SHA, "--", "content/const-15-core-tail.md"], { cwd: ROOT, encoding: "utf-8" })
    .split("\n")
    .filter((l) => l.startsWith("+") && !l.startsWith("+++"));
  assert.ok(addedLines.length <= 6, `const-15 §6 addition should stay small (≤ ~4 lines budget, some slack for the fetch-clause edit); got ${addedLines.length} added lines`);
});

test("AC7: `git commit --amend` disposition — FORBIDDEN for all roles, names the rule not the incident", () => {
  assert.ok(
    CONST15.includes(
      "`git commit --amend` is FORBIDDEN for all roles: it rewrites a sha that evidence files, mailbox and review reports may already cite — make a follow-up commit instead.",
    ),
    "const-15 must carry the exact commit --amend disposition",
  );
  assert.ok(!/Wave 7\.2/.test(CONST15), "the disposition must name the rule, not the Wave 7.2 incident");
});

test("AC8: tool-internal git ops of `agc feature start`/`finish` are sanctioned via the tool, never hand-typed", () => {
  assert.ok(
    CONST15.includes(
      "**Tool-internal ops** of `agc feature start` / `agc feature finish` (incl. start's rollback and finish's teardown) are sanctioned by invoking the tool in the role `docs/lane-protocol.md` assigns (start: the lane; finish: the integrator) — never typed by hand as a substitute when the tool refuses.",
    ),
    "const-15 must carry the exact tool-internal-ops clause",
  );
});

test("AC9: SOP merge stage — substantive-resolution code-reviewer duty, no-ff-before-APPROVED, qa golden regen, no self-fix", () => {
  assert.ok(SOP.includes("A resolution is *substantive* when any conflict hunk's result is not simply both sides kept verbatim"));
  assert.ok(SOP.includes("a `dist/` or golden regeneration is not substantive"));
  assert.ok(SOP.includes("dispatch `code-reviewer` via Task on that merge commit"));
  assert.ok(SOP.includes("`git show --remerge-diff <merge-sha>`"));
  assert.ok(SOP.includes("`review_reports/review_merge-<short-sha>.md`, committed on the integration branch"));
  assert.ok(SOP.includes("no `tw_update_state` on the integration branch (the E222 precedent)"));
  assert.ok(SOP.includes("**never fast-forward `main` before that verdict is APPROVED.**"));
  assert.ok(SOP.includes("dispatch `qa-engineer` via Task to regenerate and explain every hunk"));
  assert.ok(SOP.includes("**Never fix feature code on the integration branch**"));
});

test("AC10: SOP execution stage — mailbox + cut pre-review formalized", () => {
  assert.ok(SOP.includes("the lane's PM cut comes to the mailbox; you check scope, file bounds and DoD coverage against the manifest and converge"));
  assert.ok(SOP.includes("The human approves each lane **once**, typed in that lane's own session. The mailbox never carries approval."));
  assert.ok(SOP.includes("confirm **every AC has an implementing task, not only a qa task**"));
  assert.ok(SOP.includes("**Architect-hop tickets pre-review twice**"));
  assert.ok(SOP.includes("Both must converge before the lane presents to the human."));
  assert.ok(SOP.includes("**Read `hop:` before asking for changes.**"));
  assert.ok(SOP.includes("batch your requests"));
  assert.ok(SOP.includes("**`close` ends one topic**"));
  assert.ok(SOP.includes("send `type: reopen`"));
  assert.ok(SOP.includes("**3-exchange cap** per topic"));
  assert.ok(SOP.includes("`type: escalate`"));
  assert.ok(SOP.includes('marked **"needs human ruling"**'));
  assert.ok(SOP.includes("re-arm from the printed baseline, always"));
  assert.ok(SOP.includes("lane-status.mjs --watch"));
  assert.ok(SOP.includes("--mailbox-root"));
  // format referenced, not copied
  assert.ok(SOP.includes("Message format, lane-side rules and the report format: `docs/lane-protocol.md` §5 and §6 — the only copy."));
});

test("AC11: docs/lane-protocol.md §5 — wait armed across every human-approval pause; architect second pre-review; Q3 default", () => {
  assert.ok(
    LANE_PROTOCOL.includes("每一次等人類核准的停頓，等待都要保持掛著"),
    "§5 rule 3 must say the wait stays armed across EVERY human-approval pause, not just role hops",
  );
  assert.ok(
    LANE_PROTOCOL.includes("有 architect hop 的票，預審兩次"),
    "§5 must state architect-hop lanes pre-review twice (PM cut, then architect's Open Questions)",
  );
  assert.ok(
    LANE_PROTOCOL.includes("即使 PM 接著只派單一角色的 judge（例如只派 qa）也一樣") &&
      LANE_PROTOCOL.includes("（qa 直派的 mini-chain，不寫 spec）不送 cut"),
    "§5 must state the Q3 default: a single-role qa lane sends a cut iff its PM hop wrote a spec; a no-PM lane sends none",
  );
});

test("AC12: SOP decision-rights table — integrator-alone vs always-the-human, with the recommendation rule", () => {
  assert.ok(SOP.includes("| integrator decides alone | always the human |"));
  assert.ok(SOP.includes("| accepting a mechanical out-of-bounds edit | cut approval |"));
  assert.ok(SOP.includes("| post-milestone queue placement of a new ticket | policy rulings |"));
  assert.ok(SOP.includes("| folding a finding into an existing row | whether a new ticket enters the current milestone |"));
  assert.ok(SOP.includes("| sending a lane back | relaxing a definition of done |"));
  assert.ok(SOP.includes("any git operation outside this role's §6 grant"));
  assert.ok(SOP.includes('On the human\'s column you give only a recommendation, marked **"needs human ruling"**, and the lane presents it.'));
});

test("AC13: SOP verification stage — E192 generic read-only verifier (D10), structured result, five constraints named", () => {
  assert.ok(SOP.includes("you MAY dispatch a fresh-context **generic read-only** subagent (no dedicated template)"));
  // structured result items
  for (const item of [
    "branch sha + the `main..<branch>` commit list",
    "`diff --stat` against the manifest's owned list, out-of-bounds files named (`fanout check`)",
    "each cited evidence file's verdict line + task id",
    "the worktree's `status --porcelain` taken **after** the suite ran",
    "full-suite pass/total, with the full log saved to a scratch file, not returned",
    "the `pending-tickets.md` / `## Applied` / root `NEW-TICKETS.md` check",
  ]) {
    assert.ok(SOP.includes(item), `E192 verifier structured result missing item: ${item}`);
  }
  // five constraints, cited by number with a one-line name each
  for (const constraint of [
    "(1) **read-only**",
    "(2) **the report is a claim**",
    "(3) **serial runs**",
    "(4) **never a lane's session**",
    "(5) **not code-reviewer / qa-engineer**",
  ]) {
    assert.ok(SOP.includes(constraint), `E192 five-constraints list missing: ${constraint}`);
  }
});

test("AC14: docs/lane-protocol.md §3 — ticket-prefixed task ids T-<ticket>-NN, collision rationale", () => {
  assert.ok(
    LANE_PROTOCOL.includes("lane 的 task id 一律是 `T-<ticket>-NN`") &&
      LANE_PROTOCOL.includes("（票號大寫、兩位數序號，例如 `T-E178A-01`）"),
    "§3 must require T-<ticket>-NN task ids (ticket uppercased, two-digit sequence)",
  );
  assert.ok(
    LANE_PROTOCOL.includes("不帶票號的 id 會在 lane 之間撞名、互相覆蓋"),
    "§3 must give the collision reason: evidence file names collide across lanes without the ticket prefix",
  );
});

test("AC15: provenance repointed to skill-integrator.md; PROMPT_TEMPLATE_3B's provenance comment names it, cites the E177a golden, and no longer cites .claude/commands/integrator.md", () => {
  assert.ok(
    LANE_PROTOCOL.slice(0, 400).includes("content/skill-integrator.md"),
    "docs/lane-protocol.md must name content/skill-integrator.md as the integrator's SOP near the top of the file",
  );
  assert.ok(!/commands\/integrator/.test(LANE_PROTOCOL), "docs/lane-protocol.md must no longer cite .claude/commands/integrator.md");
  assert.ok(!/commands\/integrator/.test(FANOUT_MANIFEST_TS), "tools/fanout-manifest.ts must no longer cite .claude/commands/integrator.md");
  assert.ok(FANOUT_MANIFEST_TS.includes("the single canonical copy"), "fanout-manifest.ts comment must state it is the single canonical copy");

  // Current-tree assertion on the doc-comment directly above
  // PROMPT_TEMPLATE_3B (E229 AC6) — replaces the "comment-only diff vs base" check
  // (which needed git history) without adding a second copy of the
  // template's bytes: test/e177a-manifest.test.mjs's "AC6 render e177a" test
  // already pins those bytes against
  // test/fixtures/e177a/render-e177a.golden.txt (single-copy rule, E177a /
  // skill-integrator stage 3) — untouched here.
  const declMarker = "export const PROMPT_TEMPLATE_3B";
  const declIdx = FANOUT_MANIFEST_TS.indexOf(declMarker);
  assert.ok(declIdx >= 0, "must find the PROMPT_TEMPLATE_3B declaration in tools/fanout-manifest.ts");
  const commentStart = FANOUT_MANIFEST_TS.lastIndexOf("/**", declIdx);
  assert.ok(commentStart >= 0, "must find a doc-comment block above the PROMPT_TEMPLATE_3B declaration");
  const commentEnd = FANOUT_MANIFEST_TS.indexOf("*/", commentStart);
  assert.ok(commentEnd > commentStart && commentEnd < declIdx, "the doc-comment block must close before the PROMPT_TEMPLATE_3B declaration");
  const provenanceComment = FANOUT_MANIFEST_TS.slice(commentStart, commentEnd + 2);
  assert.ok(provenanceComment.includes("content/skill-integrator.md"), "the provenance comment must name content/skill-integrator.md");
  assert.ok(provenanceComment.includes("the single canonical copy"), "the provenance comment must state it is the single canonical copy");
  assert.ok(provenanceComment.includes("E177a render golden"), "the provenance comment must cite the E177a render golden as the bytes' pin");
  assert.ok(!provenanceComment.includes(".claude/commands/integrator.md"), "the provenance comment must not cite .claude/commands/integrator.md");
});

test("AC16: interim `.claude/commands/integrator.md` retired; nothing tracked under .claude/", () => {
  assert.ok(
    !fs.existsSync(path.join(ROOT, ".claude", "commands", "integrator.md")),
    ".claude/commands/integrator.md must be deleted",
  );
  let lsFiles = "";
  try {
    lsFiles = execFileSync("git", ["ls-files", ".claude"], { cwd: ROOT, encoding: "utf-8" });
  } catch {
    lsFiles = "";
  }
  assert.equal(lsFiles.trim(), "", "git ls-files .claude must be empty");
});

test("AC17: rendered skill-integrator.md is well-formed (SOP body present, zero glue findings); skill-file count updated to 12", async () => {
  const ws = mkWorkspace();
  let text;
  try {
    const result = buildPromptForRole("skill-integrator.md", INTEGRATOR_DESCRIPTION, ws);
    text = result.messages[0].content.text;
  } finally {
    fs.rmSync(ws, { recursive: true, force: true });
  }
  assert.ok(text.includes("# Skill: integrator"), "rendered prompt must contain the SOP body");
  assert.ok(text.includes("## Purpose — why this role exists"));

  // Zero asymmetric-rationale-span (glue) findings for content/skill-integrator.md.
  // Deliberately duplicated from test/render-structure.test.mjs's own detector
  // (RATIONALE_SPAN_RE / findAsymmetricRationaleSpans) rather than imported —
  // that file has no dist export, and this AC's proof is meant to stand on its
  // own inside this test file. render-structure.test.mjs's broader content/**
  // sweep independently covers the same file and is green in the full suite.
  const RATIONALE_SPAN_RE = /<!-- rationale:start -->[\s\S]*?<!-- rationale:end -->/g;
  const findings = [];
  for (const m of SOP.matchAll(RATIONALE_SPAN_RE)) {
    const startIdx = m.index;
    const endIdx = m.index + m[0].length;
    if (SOP[endIdx] !== "\n") continue; // end not block-triggering -> no fusion risk
    let p = startIdx - 1;
    while (p >= 0 && SOP[p] !== "\n") p--;
    const before = SOP.slice(p + 1, startIdx);
    if (before.trim().length > 0) {
      findings.push({ before: before.slice(-60) });
    }
  }
  assert.deepEqual(findings, [], "content/skill-integrator.md must carry zero asymmetric rationale spans (glue-free)");

  // The skill-file count assertion (11 -> 12) is updated, per Q6's qa-only grant.
  const skillFrontmatterTestSrc = fs.readFileSync(path.join(ROOT, "test", "skill-frontmatter.test.mjs"), "utf-8");
  assert.match(skillFrontmatterTestSrc, /assert\.equal\(files\.length,\s*12,/, "test/skill-frontmatter.test.mjs must assert 12 skill files");
});
