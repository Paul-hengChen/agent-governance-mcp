// Coded by @qa-engineer
// E172 (lane e359, specs/e359-server-core-fixes.md AC-E172-1..3). Invariant: a Windows-form "~\x"
// workspace path expands to the home directory on win32 only; on POSIX "\" is a legal filename
// character so it stays literal. The platform is injected, so no case depends on the host OS.
// Tails are single-segment so the host's path flavour cannot change the expected value.
// AC-E172-4 (wiring) is proven by the spawned AC2 tests in test/prompt-state-footer.test.mjs.

import { test } from "node:test";
import assert from "node:assert/strict";
import * as os from "node:os";
import * as path from "node:path";

import { normalizeWorkspacePath } from "../dist/prompts/build.js";

const home = os.homedir();

test("AC-E172-1: win32 expands the ~\\sub form to the home directory", () => {
  assert.equal(normalizeWorkspacePath("~\\sub", "win32"), path.resolve(path.join(home, "sub")));
});

for (const platform of ["linux", "darwin"]) {
  test(`AC-E172-2: ${platform} does not expand ~\\sub (backslash is a literal filename char)`, () => {
    assert.equal(normalizeWorkspacePath("~\\sub", platform), path.resolve("~\\sub"));
  });
}

for (const platform of ["win32", "linux", "darwin"]) {
  test(`AC-E172-3: ${platform} keeps the existing forms unchanged`, () => {
    assert.equal(normalizeWorkspacePath("~", platform), home, "bare ~");
    assert.equal(normalizeWorkspacePath("~/sub", platform), path.resolve(path.join(home, "sub")), "~/sub");
    assert.equal(
      normalizeWorkspacePath("~user/x", platform),
      path.resolve("~user/x"),
      "~user forms are not expanded",
    );
    const abs = path.resolve(os.tmpdir(), "e172-abs");
    assert.equal(normalizeWorkspacePath(abs, platform), abs, "an absolute normalized path comes back unchanged");
  });
}

test("AC-E172: default platform argument is process.platform", () => {
  assert.equal(normalizeWorkspacePath("~\\sub"), normalizeWorkspacePath("~\\sub", process.platform));
});

test("AC-E172 boundary: empty string resolves to cwd and an oversized path does not throw", () => {
  assert.equal(normalizeWorkspacePath("", "win32"), path.resolve(""));
  const long = "~\\" + "a".repeat(10000);
  assert.equal(typeof normalizeWorkspacePath(long, "win32"), "string");
});
