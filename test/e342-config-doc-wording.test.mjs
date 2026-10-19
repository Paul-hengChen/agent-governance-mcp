// Coded by @qa-engineer
// Tests (T-E342-01) for specs/e292-sister-repos.md AC-E342-1: the `laneProtocolAddendum` section of docs/config.md
// states the ADDENDUM_INVALID rule exactly as the code applies it (the FIRST path segment is `..`, so a name such as
// `..foo` is accepted) and tells integrators to run `render` from primary. WHY: the old wording "a path that starts
// with `..`" made adopters avoid a valid name, and the missing advice puts an absolute worktree path into the prompt
// by accident. The rule text is also checked against the real predicate through `render`, so the doc cannot drift
// from the behaviour it describes. Fixtures: temp primaries / install roots under os.tmpdir().

import { test, after } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

import { parseManifest, renderPrompt } from "../dist/tools/fanout-manifest.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DOC = fs.readFileSync(path.join(ROOT, "docs", "config.md"), "utf8");
const TMP = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "e342-doc-")));
after(() => fs.rmSync(TMP, { recursive: true, force: true }));

const ADDENDUM_INVALID =
  "  - `ADDENDUM_INVALID` — the value is absolute, starts with `~`, or normalizes to `.` or to a path whose first segment is `..` (a name such as `..foo` is accepted). The message does not echo the value.";
const RENDER_FROM_PRIMARY =
  "Run `render` from primary: run from a lane worktree's own build output, the agc install is that worktree, so the prompt would name an absolute path into the worktree.";

/** The laneProtocolAddendum section: its heading up to the next `###` / `---` heading. */
function section() {
  const lines = DOC.split("\n");
  const at = lines.findIndex((l) => l.startsWith("### `laneProtocolAddendum`"));
  assert.ok(at >= 0);
  const out = [];
  for (let i = at; i < lines.length; i++) {
    if (i > at && (lines[i].startsWith("### ") || lines[i] === "---")) break;
    out.push(lines[i]);
  }
  return out;
}

test("AC-E342-1 the ADDENDUM_INVALID bullet equals the spec copy, once", () => {
  const hits = section().filter((l) => l.includes("`ADDENDUM_INVALID`"));
  assert.deepEqual(hits, [ADDENDUM_INVALID]);
  assert.equal(DOC.split("a path that starts with `..`").length - 1, 0);
  assert.equal(DOC.split("a path that starts with ..").length - 1, 0);
});

test("AC-E342-1 the Where-the-generic-rules-come-from bullet ends with the run-from-primary copy", () => {
  const hits = section().filter((l) => l.startsWith("- **Where the generic rules come from (key set).**"));
  assert.equal(hits.length, 1);
  assert.ok(hits[0].endsWith(" " + RENDER_FROM_PRIMARY), hits[0].slice(-200));
  assert.equal(DOC.split(RENDER_FROM_PRIMARY).length - 1, 1);
});

test("AC-E342-1 the documented rule matches the code: `..foo` accepted, `../x` and `..` refused", () => {
  const MANIFEST = fs.readFileSync(path.join(ROOT, "test", "fixtures", "e177a", "fanout-wave7.md"), "utf8");
  const install = path.join(TMP, "install");
  fs.mkdirSync(path.join(install, "docs"), { recursive: true });
  fs.writeFileSync(path.join(install, "docs", "lane-protocol.md"), "# generic\n");
  let n = 0;
  const codesFor = (value) => {
    const primary = path.join(TMP, `p${n++}`);
    fs.mkdirSync(path.join(primary, ".current"), { recursive: true });
    fs.mkdirSync(path.join(primary, "..foo-dir"), { recursive: true });
    fs.writeFileSync(path.join(primary, "..foo"), "# addendum\n");
    fs.writeFileSync(path.join(primary, ".current", ".config.json"), JSON.stringify({ schema_version: 2, laneProtocolAddendum: value }));
    const r = renderPrompt(parseManifest(MANIFEST), "e177a", { summary: "S", reading: ["R"], mailboxRoot: "/m", primary, installRoot: install });
    return r.ok ? [] : r.errors.map((e) => e.code);
  };
  assert.deepEqual(codesFor("..foo"), [], "a first segment that merely starts with .. is accepted");
  for (const refused of ["..", "../x.md", "a/../../x.md", "/abs/x.md", "~/x.md", ".", "a/.."]) {
    assert.deepEqual(codesFor(refused), ["ADDENDUM_INVALID"], refused);
  }
});
