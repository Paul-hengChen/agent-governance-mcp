// Coded by @qa-engineer
// Tests for specs/e285-integrator-session-handoff.md, E336 half (AC-E336-1, AC-E336-3).
// WHY: with `pull.rebase=true` in a user-level git config, a plain `git pull --ff-only` refuses
// to run while `.current/` has uncommitted files, which is the normal state after a release. Every
// SOP command site therefore names the portable form `git -c pull.rebase=false pull --ff-only`,
// and the reason is written exactly once, in the integrator SOP. AC-E336-2 (borrowed files differ
// from the dispatch base only by the substitution) is a review-time diff, not a resident test.

import { test } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (f) => fs.readFileSync(path.join(ROOT, "content", f), "utf-8");

const PLAIN = "git pull --ff-only";
const PORTABLE = "git -c pull.rebase=false pull --ff-only";
const count = (text, needle) => text.split(needle).length - 1;

// Heading line up to the next heading of any level.
function sec(text, heading) {
  const out = [];
  let on = false;
  for (const l of text.split("\n")) {
    if (!on && l.startsWith(heading)) { on = true; out.push(l); continue; }
    if (on && /^##/.test(l)) break;
    if (on) out.push(l);
  }
  assert.ok(out.length > 0, `heading not found: ${heading}`);
  return out.join("\n");
}

const SITES = [
  ["const-15-core-tail.md", 1],
  ["coord-03-core-fallback.md", 1],
  ["skill-integrator.md", 4],
  ["skill-release-engineer.md", 6],
];

for (const [file, n] of SITES) {
  test(`AC-E336-1: ${file} has 0 plain and ${n} portable pull command sites`, () => {
    // The plain literal is not a substring of the portable form, so 0 plain proves no site was missed.
    assert.equal(count(read(file), PLAIN), 0, `${file} must not name the plain command form`);
    assert.equal(count(read(file), PORTABLE), n, `${file} must name the portable form ${n} time(s)`);
  });
}

test("AC-E336-1: the two bare grant-name mentions in the integrator SOP stay as grant names", () => {
  const text = read("skill-integrator.md");
  assert.ok(text.includes("`pull --ff-only` on `main`"), "Permissions row names the granted operation");
  assert.ok(text.includes("followed by `pull --ff-only` (6-5)"), "Git operations names the granted operation");
});

test("AC-E336-3: Git operations in the integrator SOP states why the override exists", () => {
  const git = sec(read("skill-integrator.md"), "## Git operations");
  for (const p of ["pull.rebase", ".current/"]) {
    assert.ok(git.includes(p), `## Git operations must mention: ${p}`);
  }
});

test("AC-E336-3: no reason clause leaks into the three borrowed files (only command-form mentions)", () => {
  for (const f of ["const-15-core-tail.md", "coord-03-core-fallback.md", "skill-release-engineer.md"]) {
    const t = read(f);
    assert.equal(count(t, "pull.rebase"), count(t, PORTABLE), `${f}: every pull.rebase mention is a command site`);
  }
});
