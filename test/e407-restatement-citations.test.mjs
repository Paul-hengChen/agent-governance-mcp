// Coded by @qa-engineer
// E407: four skill sites cite a constitution rule by name instead of restating it. Each test pins the
// site's exact text (what the spec's Copy/Strings table promises) and that the cited rule actually
// exists in every composition that loads the site, so a citation can never dangle.
import { test } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const { composeConstitution } = await import(path.join(ROOT, "dist", "prompts", "build.js"));
const read = (f) => fs.readFileSync(path.join(ROOT, "content", f), "utf-8");
const count = (h, n) => h.split(n).length - 1;
const section = (text, heading) => {
  const i = text.indexOf(heading);
  assert.notEqual(i, -1, `${heading} present`);
  const rest = text.slice(i + heading.length);
  const m = rest.search(/\n## /);
  return rest.slice(0, m === -1 ? undefined : m);
};

const CHAIN = [{ chain: true, design: true }, { chain: true, design: false }];
const LITE = [{ chain: false, design: true }, { chain: false, design: false }];
const ALL = [...CHAIN, ...LITE];
const label = (o) => `chain=${o.chain} design=${o.design}`;

test("AC4: coord-05 Drift Reconcile body is the cited one-paragraph form", () => {
  const text = read("coord-05-core-visual-drift.md");
  const heading = "## Drift Reconcile after out-of-band execution";
  // The heading carries a provenance tag line (not body text); drop it before comparing.
  const body = section(text, heading).replace(/^\s*<!-- origin:start -->.*?<!-- origin:end -->\n/s, "");
  assert.equal(
    body.trim(),
    "Coordinator trigger for Constitution §3 *Sequential-context assumption + reconcile* (R10): you\n" +
      "dispatched background/parallel subagents, OR executed a role inline (subagent unavailable). In those\n" +
      "cases run that reconcile before any PASS or hand-back; never hand-edit `tasks.md` checkboxes to paper\n" +
      "over drift.",
  );
  assert.ok(!/^\d+\. /m.test(body), "no numbered list");
  for (const w of ["handoff-ahead", "vibe drift", "tw_sync"]) assert.ok(!body.includes(w), `no restated mechanism: ${w}`);
});

test("AC4: the cited reconcile rule exists once in every chain composition (coord-05 loads only there)", () => {
  for (const o of CHAIN) assert.equal(count(composeConstitution(o), "Sequential-context assumption + reconcile"), 1, label(o));
});

test("AC5: lite Hop cap-exempt bullet is the cited form and Limits / §5 resolve in lite compositions", () => {
  const lines = read("skill-coordinator-lite.md").split("\n");
  assert.ok(
    lines.includes("- **Hop cap-exempt** — per Constitution Limits / §5 (lite issues no role-transition write, so `hop_count` never moves)."),
  );
  for (const o of LITE) {
    const c = composeConstitution(o);
    assert.ok(c.includes("Limits"), `Limits in ${label(o)}`);
    assert.ok(c.includes("## 5. Anti-Loop Circuit Breaker"), `§5 in ${label(o)}`);
  }
});

test("AC6: qa ownership bullet is first in Hard rules and the cited bullet exists in every composition", () => {
  const hard = section(read("skill-qa-engineer.md"), "## Hard rules");
  const first = hard.split("\n").find((l) => l.startsWith("- "));
  assert.equal(first, "- **You own `tw_complete_task` and `tw_rollback_task`** (Constitution §3 *`tw_complete_task` ownership*).");
  for (const o of ALL) assert.ok(composeConstitution(o).includes("**`tw_complete_task` ownership**"), label(o));
});

test("AC7: integrator Permissions first data row cites §6, and §6 still enumerates the grant", () => {
  const perms = section(read("skill-integrator.md"), "## Permissions");
  const rows = perms.split("\n").filter((l) => l.startsWith("|"));
  assert.equal(rows[0], "| can | cannot |");
  assert.equal(
    rows[2],
    "| Constitution §6: the base list plus the integrator-only grant (enumerated there, not here), and pushing the integration branch | Pushing `main` directly (protected: it moves only by pull request merge) and every git verb Constitution §6 forbids |",
  );
  assert.ok(rows.length >= 7, "rows 2-5 remain");
  assert.ok(read("const-15-core-tail.md").includes("gh pr merge --auto --merge"), "§6 enumerates the grant the row now points to");
});
