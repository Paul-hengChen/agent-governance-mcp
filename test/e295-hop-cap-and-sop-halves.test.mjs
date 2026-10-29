// Coded by @qa-engineer: pins for specs/e295-hop-cap-and-sop-halves.md AC1-AC12 (T-E295-01/02, T-E298-01, T-E300-01, T-E301-01).
// Each case encodes the spec's proof pattern. Content assertions are grep-style on the shipped files;
// AC2 drives the compiled validateTransition. The AC12 check-bookkeeping moved-root cases live in
// test/e299-check-bookkeeping.test.mjs (CITE-ROOT-ARCHIVED / CITE-AMBIGUOUS / CITE-ROOT-DEAD / CITE-ROOT-TOLERATED).
// Creation of this file was pre-authorized in the E295 qa dispatch brief (Test-file placement).

import { test } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const rd = (rel) => fs.readFileSync(path.join(ROOT, rel), "utf-8");
const count = (text, needle) => text.split(needle).length - 1;
const { HOP_CAP_EXPORTED } = await import(path.join(ROOT, "dist", "tools", "transitions.js"));
const { validateTransition } = await import(path.join(ROOT, "dist", "tools", "transitions.js"));

const CONST01 = rd("content/const-01-core-head.md");
const COORD02 = rd("content/coord-02-host-dispatch.md");
const COORD03 = rd("content/coord-03-core-fallback.md");
const INTEGRATOR = rd("content/skill-integrator.md");
const RELEASE = rd("content/skill-release-engineer.md");
const LANE = rd("docs/lane-protocol.md");
const REGISTRY = rd("gates/registry.ts");

test("AC1: const-01 Limits row and HOP_CAP are both 14 (feature-scoped reset rationale intact)", () => {
  assert.equal(count(CONST01, "| `hop` cap | 14 |"), 1);
  assert.equal(HOP_CAP_EXPORTED, 14);
  assert.match(rd("tools/transitions.ts"), /HOP_CAP\s*=\s*14/);
});

test("AC2: (pm, In_Progress) landing at the cap is accepted from code-reviewer/qa-engineer In_Progress; other role edges stay HOP_CAP_EXCEEDED", () => {
  const b = { prev_qa_round: 0, prev_review_round: 0, prev_visual_round: 0, prev_hop_count: 14, feature_changed: false };
  const to = (agent, status, nAgent, nStatus, extra = {}) =>
    validateTransition({ ...b, ...extra, prev: { agent, status }, next: { agent: nAgent, status: nStatus } });
  assert.equal(to("code-reviewer", "In_Progress", "pm", "In_Progress"), null);
  assert.equal(to("qa-engineer", "In_Progress", "pm", "In_Progress"), null);
  assert.equal(to("code-reviewer", "In_Progress", "qa-engineer", "In_Progress")?.error, "HOP_CAP_EXCEEDED");
  assert.equal(to("sr-engineer", "In_Progress", "sr-engineer", "In_Progress"), null, "self-loop still skips the gate");
  assert.equal(to("code-reviewer", "In_Progress", "qa-engineer", "In_Progress", { feature_changed: true }), null, "feature change still bypasses");
});

test("AC3: d2 specs end with the E295 amendment section (the base body is pinned by git history, not a fixture read, per the E77 meta-test)", () => {
  for (const f of ["specs/d2-server-brake-accounting.md", "specs/d2-server-brake-accounting-architecture.md"]) {
    assert.equal(count(rd(f), "\n## Amendment (2026-10-15, E295)") + (rd(f).startsWith("## Amendment (2026-10-15, E295)") ? 1 : 0), 1, f);
  }
  // The amendment is appended at the END (E267 shape): it is the last H2 and nothing but its own text follows.
  for (const f of ["specs/d2-server-brake-accounting.md", "specs/d2-server-brake-accounting-architecture.md"]) {
    const h2s = [...rd(f).matchAll(/^## .*$/gm)].map((m) => m[0]);
    assert.equal(h2s[h2s.length - 1], "## Amendment (2026-10-15, E295)", `${f}: the amendment must be the last H2`);
  }
});

test("AC4: coord-03 HOP_CAP_EXCEEDED row names the same-lane continuation conditions", () => {
  const rows = COORD03.split("\n").filter((l) => l.includes("HOP_CAP_EXCEEDED") && l.includes("-r<n>-fix"));
  assert.equal(rows.length, 1, "exactly one table row carries HOP_CAP_EXCEEDED and the -r<n>-fix continuation");
  const row = rows[0];
  assert.ok(row.startsWith("|"), "still a table row");
  assert.ok(row.includes("`HOP_CAP_EXCEEDED`"), "backtick-quoted (error-code-contract mapping)");
  assert.ok(row.includes("lease-override: hop-cap continuation of <feature>"));
  assert.match(row, /one continuation|once per feature/i);
  assert.ok(row.includes("lease_override: true"));
  assert.match(row, /human/);
});

test("AC5: lane-protocol carries the hop rule, 7/14 example, and keeps the no-push line", () => {
  assert.equal(count(LANE, "例如 7/14"), 1);
  assert.equal(count(LANE, "7/10"), 0);
  assert.ok(count(LANE, "-r<n>-fix") >= 1);
  assert.equal(count(LANE, "不要 push、不要 merge、不要發版、不要刪 worktree"), 1);
});

test("AC6: integrator 5a lane layer pushes then reads CI; test-lock stays for the fallback", () => {
  const line = INTEGRATOR.split("\n").filter((l) => l.includes("git push -u origin <branch>"));
  assert.ok(line.some((l) => l.includes("the repo's CI check on `<reported sha>`")));
  assert.ok(count(INTEGRATOR, "test-lock.mjs") >= 1);
});

test("AC7: integration layer and Stage 6 use push + --ci-check; `cannot reach `main`` kept", () => {
  assert.ok(count(INTEGRATOR, "the repo's CI check on") >= 3);
  assert.equal(count(INTEGRATOR, "cannot reach `main`"), 1);
});

test("AC8: verifier brief returns CI run id + verdict, never suite output; porcelain after a local build; five constraints kept", () => {
  assert.ok(INTEGRATOR.split("\n").some((l) => l.includes("run id") && l.includes("never suite output")));
  assert.ok(INTEGRATOR.includes("`status --porcelain` taken **after** a local run of the repo's build command (the addendum names it)"));
  for (const c of ["(1) **read-only**", "(2) **the report is a claim**", "(3) **serial runs**", "(4) **never a lane's session**", "(5) **not code-reviewer / qa-engineer**"]) {
    assert.ok(INTEGRATOR.includes(c), c);
  }
});

test("AC9: CI fallback Decisions row wording and the E238/E254/E278 flake rule", () => {
  assert.ok(count(INTEGRATOR, "CI was not consulted") >= 1);
  assert.ok(INTEGRATOR.split("\n").some((l) => l.includes("E238") && l.includes("E254") && l.includes("E278")));
  assert.ok(INTEGRATOR.includes("gh run rerun --failed <run id>"));
});

test("AC10: 5c names the repo's bookkeeping check exactly once (sop.5c-3); the addendum names npm run check:bookkeeping (add.5-bookkeeping)", () => {
  const i = INTEGRATOR.indexOf("### 5c.");
  const j = INTEGRATOR.indexOf("## Stage 6", i);
  assert.ok(i >= 0 && j > i);
  assert.equal(count(INTEGRATOR.slice(i, j), "run the repo's bookkeeping check when the addendum names one, and require exit 0"), 1);
  // E226/E349: the SOP is generic; the repo-specific command now lives in the addendum, once.
  assert.equal(count(rd("docs/lane-protocol-addendum.md"), "npm run check:bookkeeping"), 1);
});

test("AC11: coord-02 names the four tiers, the code and the advisory; registry row flipped to documentedInProse true", () => {
  assert.ok(count(COORD02, "DISPATCH_PIN_TIER_REJECTED") >= 1);
  for (const t of ["`opus`", "`sonnet`", "`haiku`", "`fable`", "`dispatch_pins_advisory`"]) assert.ok(COORD02.includes(t), t);
  assert.equal(count(REGISTRY, "(none)"), 0);
  assert.equal(count(REGISTRY, "DISPATCH_PIN_TIER_REJECTED      coord-02-host-dispatch.md"), 1);
});

test("AC12: Evidence-Citation Convention says write-time path; release 7a names check:bookkeeping; the checker exits 0 on this tree", () => {
  assert.equal(count(COORD03, "as it exists at write time"), 1);
  assert.ok(count(RELEASE, "check:bookkeeping") >= 1);
  execFileSync(process.execPath, [path.join(ROOT, "scripts", "check-bookkeeping.mjs")], { cwd: ROOT, stdio: "ignore" });
});
