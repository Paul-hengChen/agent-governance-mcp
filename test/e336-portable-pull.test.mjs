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
  // E394 re-pin (AC-P6): the rewritten SOP keeps two prose sites (Git Hard rule, step 5); the other
  // former sites (8c, 13a, 3a-adjacent recovery) now run inside scripts/release.mjs, pinned below.
  ["skill-release-engineer.md", 2],
];

for (const [file, n] of SITES) {
  test(`AC-E336-1: ${file} has 0 plain and ${n} portable pull command sites`, () => {
    // The plain literal is not a substring of the portable form, so 0 plain proves no site was missed.
    assert.equal(count(read(file), PLAIN), 0, `${file} must not name the plain command form`);
    assert.equal(count(read(file), PORTABLE), n, `${file} must name the portable form ${n} time(s)`);
  });
}

test("AC-E336-1 [E394 re-pin AC-S3]: scripts/release.mjs pulls main only through the portable array-argv form (every pull site carries -c pull.rebase=false)", () => {
  const script = fs.readFileSync(path.join(ROOT, "scripts", "release.mjs"), "utf-8");
  const PORTABLE_ARGV = '["-c", "pull.rebase=false", "pull", "--ff-only"]';
  const BARE_PULL = '"pull", "--ff-only"';
  assert.equal(count(script, PORTABLE_ARGV), 1, "the script must name the portable pull argv exactly once (pullMain)");
  // Every executed pull site is the portable one: no bare pull argv anywhere else.
  assert.equal(count(script, BARE_PULL), count(script, PORTABLE_ARGV), "no pull argv may omit the -c pull.rebase=false override");
  // The only plain spelling is the failure-message label in pullMain (a message, not a command site).
  assert.equal(count(script, `failedAt(ctx, "${PLAIN}", pull, step)`), count(script, PLAIN), "the plain form may appear only as pullMain's failure label");
  // The runner allow-list entry names the same override and restricts the pull to main.
  assert.ok(
    script.includes('"-c pull.rebase=false pull --ff-only, on main only"'),
    "the verb allow-list must describe the pull as the portable form, main only",
  );
});

test("AC-E336-1: the two bare grant-name mentions in the integrator SOP stay as grant names", () => {
  const text = read("skill-integrator.md");
  assert.ok(sec(text, "## Permissions").includes("Constitution §6"), "Permissions row cites the §6 grant instead of enumerating it");
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
