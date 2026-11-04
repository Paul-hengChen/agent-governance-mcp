// Coded by @qa-engineer
// E404 (specs/e395-claude-md-template-tail): templates/claude-code-agents/release-engineer.md is
// shaped like the other 11 templates: watermark, load line, one re-baseline hint, the RELAY
// paragraph. The SOP is the only normative source for everything else.

import { test } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const RAW = fs.readFileSync(path.join(ROOT, "templates", "claude-code-agents", "release-engineer.md"), "utf-8");

const WATERMARK =
  "CRITICAL: End every reply with `— @release-engineer (<the model tier you were actually invoked with>)` per Constitution §1 (watermark).";
const LOAD =
  'This subagent runs the agc release-engineer SOP under a pinned model tier. On invocation, call `tw_get_state` then `tw_switch_role("release-engineer")` and follow the returned SOP exclusively. Its Hard rules and numbered steps are normative there and are not restated here.';
const REBASELINE =
  "Before the version bump, re-baseline per SOP step 5: on `main`, `git fetch origin` then `git -c pull.rebase=false pull --ff-only`, and derive the target version from the version at HEAD, never from the baseline read at PASS time.";
const RELAY =
  "CRITICAL: If this session has no MCP tool-invocation path at all (no `tw_*` tools reachable), NEVER hand-edit `.current/handoff.md` or `tasks.md` to simulate a `tw_update_state` write. Perform every non-MCP release mechanic normally (fetch/bump/build/test/commit/tag/push/`gh release`), and for each state write the SOP calls for that you cannot make yourself (the opening write, the closing write), state the exact literal `tw_update_state` call — every argument, verbatim values — in your reply, marked with a `RELAY REQUIRED:` prefix, so the coordinator can issue it via MCP. Emit `Done. Released <tag>.` only after a confirmed write (your own read-back, or the coordinator's confirmation that a relayed write landed) — never speculatively.";

const lines = RAW.replace(/\n$/, "").split("\n");
const body = lines.slice(5);

test("AC-E404-1: 13 lines, frontmatter then exactly four non-blank body lines in order, no trailing blank", () => {
  assert.ok(RAW.endsWith("\n") && !RAW.endsWith("\n\n"), "one trailing newline, no trailing blank line");
  assert.equal(lines.length, 13);
  assert.equal(lines[0], "---");
  assert.equal(lines[4], "---");
  assert.deepEqual(
    lines.slice(1, 4).map((l) => l.split(":")[0]),
    ["name", "model", "description"],
    "frontmatter keys",
  );
  assert.deepEqual(body.filter((l) => l.trim() !== ""), [WATERMARK, LOAD, REBASELINE, RELAY]);
});

test("AC-E404-3: the load line is the base sentence plus the not-restated sentence", () => {
  assert.equal(RAW.split(LOAD).length - 1, 1);
  assert.ok(RAW.includes('call `tw_get_state` then `tw_switch_role("release-engineer")`'));
});

test("AC-E404-4: the RELAY paragraph is the pinned text and is the last line", () => {
  assert.equal(lines[lines.length - 1], RELAY);
});

test("AC-E404-5: exactly one line names SOP step 5, at most two sentences, with the fetch and ff-only pull forms", () => {
  const hint = lines.filter((l) => l.includes("SOP step 5"));
  assert.equal(hint.length, 1);
  assert.ok(hint[0].includes("git fetch origin"));
  assert.ok(hint[0].includes("`git -c pull.rebase=false pull --ff-only`"));
  assert.ok((hint[0].match(/[.!?](?:\s|$)/g) || []).length <= 2);
});

test("AC-E404-6: no example reply suffix and no (haiku) text", () => {
  assert.ok(!RAW.includes("Example reply suffix:"));
  assert.ok(!RAW.includes("(haiku)"));
});

test("AC-E404-7: no restated SOP content survives in the template", () => {
  // Why: the SOP and scripts/release.mjs own these; a copy here drifts from them.
  const gone = [
    "step 3a", "step 7b", "step 8a", "3a)", "driftBaselineIds", "Staging scope", "Stage explicitly",
    "Pre-commit verify", "ALL uncommitted upstream work", "Record integrity", "git diff --stat",
    "non-fast-forward", "⛔", "git reset", "git rebase", "git checkout --force", "git clean", "origin/<branch>",
  ];
  for (const g of gone) assert.ok(!RAW.includes(g), `template must not contain: ${g}`);
});
