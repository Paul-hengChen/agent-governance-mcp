// Coded by @qa-engineer
// Scenario tests for specs/e430-mailbox-and-verify-rule.md AC5–AC6 (T-E449-01).
// WHY: §7 gains one rule — a claim about how a tool or process behaves is backed by what was read or
// run. It must reach every dispatch mode and both hook outputs exactly once, at one fixed place, with
// no other §7 line moved; its wording ships to adopters, so no repo path, ticket id or numeric limit.
// BASE_SEC7_* are the frozen pre-edit §7 lines (rationale kept / stripped). No fixed sha.

import { test } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const { buildPromptForRole } = await import(path.join(ROOT, "dist", "prompts", "build.js"));
const { setActiveStorage, FileHandoffStorage } = await import(path.join(ROOT, "dist", "tools", "storage.js"));
const { CONSTITUTION_SEGMENTS } = await import(path.join(ROOT, "dist", "prompts", "constitution-manifest.js"));

const C_E449 = "- **Verify before asserting**: A claim about how a tool, command, script or process behaves — or a command written into a plan or done definition — is backed by the file you read or the command you ran. Otherwise label it unverified; never infer it from a role name or a nearby rule.";
const SEC7_HEAD = "## 7. Cognitive Discipline";
const BASE_SEC7_BEFORE = [
  "- **Think first**: State assumptions before coding. If ambiguous, ask. Push back when a simpler approach exists.",
  "- **Goal-driven**: Define success criteria before execution. Loop until verified.",
  "- **Surface conflicts**: When patterns contradict, pick one (more recent / more tested), explain why, flag the other. Don't blend.",
  "- **Read before write**: Before adding code, read exports, callers, shared utilities. \"Looks orthogonal\" is not safe.",
  "- **Fail loud**: \"Completed\" is wrong if anything was skipped. \"Tests pass\" is wrong if any were skipped. Default to surfacing uncertainty.",
];
const BASE_EXTREF_FULL = "- **External-reference policy**: A spec referencing external artifacts<!-- rationale:start --> (URLs, design files, ticket IDs, mockups, \"see XYZ\")<!-- rationale:end --> is presumed **incomplete** until each reference is (a) fetched, (b) indexed via `tw_index_prd` / equivalent, or (c) user-confirmed ignorable. The audit is ledger-backed: PM records each reference as an `external_refs` handoff entry (state `fetched` / `indexed` / `user-confirmed-ignorable` / `unresolved`); `tw_update_state` rejects the PM→build hop (`EXTERNAL_REFS_UNRESOLVED`) while any entry is `unresolved`. PM owns the initial audit (skill-pm §Resource Audit Gate); architect surfaces leftover refs in `Deferred Resources`.";
const BASE_EXTREF_LEAN = "- **External-reference policy**: A spec referencing external artifacts is presumed **incomplete** until each reference is (a) fetched, (b) indexed via `tw_index_prd` / equivalent, or (c) user-confirmed ignorable. The audit is ledger-backed: PM records each reference as an `external_refs` handoff entry (state `fetched` / `indexed` / `user-confirmed-ignorable` / `unresolved`); `tw_update_state` rejects the PM→build hop (`EXTERNAL_REFS_UNRESOLVED`) while any entry is `unresolved`. PM owns the initial audit (skill-pm §Resource Audit Gate); architect surfaces leftover refs in `Deferred Resources`.";
const expectedSec7 = (extref) => [SEC7_HEAD, "", ...BASE_SEC7_BEFORE, C_E449, extref, ""];

// Workspace shape mirrors test/compose-equivalence.test.mjs, so each mode composes as its golden does.
const FEATURE = "e449-compose-feat";
async function makeWorkspace({ design }) {
  const ws = fs.mkdtempSync(path.join(os.tmpdir(), "e449-compose-"));
  setActiveStorage(new FileHandoffStorage());
  await new FileHandoffStorage().writeState(ws, FEATURE, "In_Progress", [], []);
  if (design) {
    fs.mkdirSync(path.join(ws, "design"), { recursive: true });
    fs.writeFileSync(path.join(ws, "design", `${FEATURE}.md`), `# Design\n\n## Mode\n\nfigma\n`);
  }
  return ws;
}

async function buildText(skillFile, design, fullDetail) {
  const ws = await makeWorkspace({ design });
  try {
    return buildPromptForRole(skillFile, "e449-check", ws, fullDetail).messages[0].content.text;
  } finally {
    fs.rmSync(ws, { recursive: true, force: true });
  }
}

async function hookText(env) {
  const ws = await makeWorkspace({ design: false });
  try {
    const out = execFileSync("node", [path.join(ROOT, "bin", "agent-governance-context.mjs")], {
      env: { ...process.env, CLAUDE_PROJECT_DIR: ws, AGC_SERVER_ROOT: ROOT, ...env },
      encoding: "utf-8",
    });
    return JSON.parse(out).hookSpecificOutput.additionalContext;
  } finally {
    fs.rmSync(ws, { recursive: true, force: true });
  }
}

const LITE = "skill-coordinator-lite.md";
const CHAIN = "skill-sr-engineer.md";
// [label, producer, rationale kept?] — the 8 build modes, both hook outputs, and the raw fragment concat.
const MODES = [
  ["build lite non-design", () => buildText(LITE, false, false), false],
  ["build lite design", () => buildText(LITE, true, false), false],
  ["build lite non-design fullDetail", () => buildText(LITE, false, true), true],
  ["build lite design fullDetail", () => buildText(LITE, true, true), true],
  ["build chain non-design", () => buildText(CHAIN, false, false), false],
  ["build chain design", () => buildText(CHAIN, true, false), false],
  ["build chain non-design fullDetail", () => buildText(CHAIN, false, true), true],
  ["build chain design fullDetail", () => buildText(CHAIN, true, true), true],
  ["SessionStart hook lite", () => hookText({}), true],
  ["SessionStart hook full", () => hookText({ AGC_DEFAULT_SKILL: "full" }), true],
  ["fragment concatenation", async () => CONSTITUTION_SEGMENTS.map((s) => fs.readFileSync(path.join(ROOT, "content", s.file), "utf-8")).join(""), true],
];

const count = (hay, needle) => hay.split(needle).length - 1;

test("AC5: C-E449 appears exactly once in every composition, under §7 directly after Fail loud and before External-reference policy; other §7 lines unchanged", async () => {
  for (const [label, produce, rationaleKept] of MODES) {
    const text = await produce();
    assert.equal(count(text, SEC7_HEAD), 1, `${label}: exactly one §7 heading`);
    assert.equal(count(text, C_E449), 1, `${label}: C-E449 appears exactly once`);
    const ls = text.split("\n");
    const at = ls.indexOf(SEC7_HEAD);
    const end = ls.findIndex((l, i) => i > at && l.startsWith("## "));
    const sec7 = ls.slice(at, end === -1 ? ls.length : end);
    assert.deepEqual(sec7, expectedSec7(rationaleKept ? BASE_EXTREF_FULL : BASE_EXTREF_LEAN), `${label}: §7 is the base §7 plus C-E449 between Fail loud and External-reference policy`);
  }
});

// e453's served-text REPO_ONLY pattern and the spec's bare-ticket-id pattern.
const REPO_ONLY = /(?<![\w/.<>-])(?:specs|research|tools|gates|test|docs|scripts|prompts|schema|bin|dist|templates|lib)\/[\w.<>*-]*/;
const TICKET = /\bE\d{2,}[a-z]?\b/;

test("AC6: the C-E449 line in the constitution cites no repo-only path, no bare ticket id and no digit", () => {
  const ls = fs.readFileSync(path.join(ROOT, "content", "const-15-core-tail.md"), "utf-8").split("\n");
  const hits = ls.filter((l) => l.startsWith("- **Verify before asserting**"));
  assert.equal(hits.length, 1, "exactly one Verify before asserting line in the §7 fragment");
  const l = hits[0];
  assert.equal(l, C_E449, "the line is C-E449 verbatim");
  assert.doesNotMatch(l, REPO_ONLY, "no repo-only path");
  assert.doesNotMatch(l, TICKET, "no bare ticket id");
  assert.doesNotMatch(l, /\d/, "no digit (no restated numeric limit)");
});
