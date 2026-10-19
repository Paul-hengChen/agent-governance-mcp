// Coded by @qa-engineer
// Tests (T-E292-01) for specs/e292-sister-repos.md AC-E292-1..3: the `sisterRepos` config key. The integrator reads
// each sister repo through this declaration and `handoff --check` resolves manifest rows through it, so the loader
// must keep every valid entry byte-verbatim in list order, drop every invalid one silently (a bad entry must never
// break unrelated tools by failing the config), and never hand an absolute or `~` path to its consumers. The key is
// additive-optional, so the config schema version must not move. Fixtures are temp workspaces under os.tmpdir();
// nothing reads this repo's own .current/.config.json.

import { test, after } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

import { loadConfig, getConfigError, parseSisterRepos } from "../dist/tools/config.js";
import { CURRENT_VERSIONS } from "../dist/schema/versions.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), "e292-cfg-"));
after(() => fs.rmSync(TMP, { recursive: true, force: true }));

let n = 0;
/** A fresh workspace (fresh path => no mtime-cache reuse) whose config holds `body`. */
function ws(body) {
  const dir = path.join(TMP, `w${n++}`);
  fs.mkdirSync(path.join(dir, ".current"), { recursive: true });
  fs.writeFileSync(path.join(dir, ".current", ".config.json"), typeof body === "string" ? body : JSON.stringify(body));
  return dir;
}
const load = (sisterRepos) => {
  const dir = ws({ schema_version: 2, sisterRepos });
  const cfg = loadConfig(dir);
  assert.equal(getConfigError(dir), null, "a bad entry is a non-fatal filter, never a config error");
  return cfg.sisterRepos;
};
const good = (over = {}) => ({ name: "receiver", path: "../receiver", owns: "the device protocol", ...over });

test("AC-E292-1 valid entries kept in list order, verbatim, optional fields only when valid", () => {
  // WHY: order is the declared order the SOP reads; strings go to commands/prompts as typed.
  const r = load([
    good({ backlog: "docs/backlog.md", contracts: ["README.md", "docs/a b/ç 檔.md"] }),
    good({ name: "z.1_-", path: "./x/../y ", owns: " owns ç " }),
    good({ name: "mid", backlog: "", contracts: [] }),
  ]);
  assert.deepEqual(r, [
    { name: "receiver", path: "../receiver", owns: "the device protocol", backlog: "docs/backlog.md", contracts: ["README.md", "docs/a b/ç 檔.md"] },
    { name: "z.1_-", path: "./x/../y ", owns: " owns ç " },
    { name: "mid", path: "../receiver", owns: "the device protocol" },
  ]);
  assert.ok(!("backlog" in r[2]) && !("contracts" in r[2]), "empty backlog / empty contracts are left out, not kept empty");
});

test("AC-E292-1 contracts drops non-strings and empty strings; all-invalid contracts is omitted", () => {
  assert.deepEqual(load([good({ contracts: ["a.md", "", 5, null, ["x"], "b.md"] })])[0].contracts, ["a.md", "b.md"]);
  assert.ok(!("contracts" in load([good({ contracts: ["", 1] })])[0]));
  assert.ok(!("contracts" in load([good({ contracts: "README.md" })])[0]), "a non-array contracts is dropped");
  assert.ok(!("backlog" in load([good({ backlog: 7 })])[0]));
});

test("AC-E292-1 each invalid shape drops only its entry", () => {
  const keep = good({ name: "keep" });
  const bad = [
    null, 5, "str", [], [good()],
    good({ name: undefined }), good({ name: 3 }), good({ name: "" }), good({ name: "a b" }), good({ name: "a/b" }),
    good({ name: "é" }), good({ name: "." }), good({ name: ".." }),
    good({ path: undefined }), good({ path: "" }), good({ path: 4 }),
    good({ path: "/abs/x" }), good({ path: "\\\\srv\\share" }), good({ path: "\\rooted" }), good({ path: "C:\\x" }),
    good({ path: "C:x" }), good({ path: "c:/x" }), good({ path: "~" }), good({ path: "~/x" }), good({ path: "~user/x" }),
    good({ owns: undefined }), good({ owns: "" }), good({ owns: 1 }),
  ];
  for (const b of bad) {
    assert.deepEqual(load([b, keep]), [keep], `dropped: ${JSON.stringify(b)}`);
  }
  // a name such as ..foo / .hidden is valid
  assert.equal(load([good({ name: "..foo" }), good({ name: ".x" })]).length, 2);
});

test("AC-E292-1 duplicate name: the first wins", () => {
  const r = load([good({ owns: "first" }), good({ owns: "second", path: "../other" }), good({ name: "b" })]);
  assert.deepEqual(r.map((e) => [e.name, e.owns]), [["receiver", "first"], ["b", "the device protocol"]]);
});

test("AC-E292-1 key absent, not an array, or no valid entry: field absent, config healthy", () => {
  for (const v of [undefined, null, "x", 5, {}, { name: "a", path: "p", owns: "o" }, [], [null, { name: "." }]]) {
    const dir = ws(v === undefined ? { schema_version: 2 } : { schema_version: 2, sisterRepos: v });
    const cfg = loadConfig(dir);
    assert.ok(!("sisterRepos" in cfg), `absent for ${JSON.stringify(v)}`);
    assert.equal(getConfigError(dir), null);
  }
});

test("AC-E292-1 parseSisterRepos is pure and never throws on junk", () => {
  for (const v of [undefined, null, 0, "x", {}, [undefined], [[]], [{ name: {} }]]) assert.doesNotThrow(() => parseSisterRepos(v));
  assert.equal(parseSisterRepos("x"), null);
});

test("AC-E292-2 config schema version stays 2 and a v2 config with the key is not rewritten", () => {
  // WHY: human ruling 2026-10-19 — additive-optional, no bump, no migration heal-write.
  assert.equal(CURRENT_VERSIONS.config, 2);
  const dir = ws({ schema_version: 2, sisterRepos: [good()] });
  const file = path.join(dir, ".current", ".config.json");
  const before = fs.readFileSync(file, "utf8");
  loadConfig(dir);
  assert.equal(fs.readFileSync(file, "utf8"), before);
});

// --- AC-E292-3: docs/config.md section -----------------------------------------------------------------------

const DOC = fs.readFileSync(path.join(ROOT, "docs", "config.md"), "utf8");
const HEADING = "### `sisterRepos` — sister repos the integrator reads (optional)";

test("AC-E292-3 docs/config.md has one sisterRepos section after laneProtocolAddendum, before the next ---", () => {
  const lines = DOC.split("\n");
  const at = lines.map((l, i) => (l === HEADING ? i : -1)).filter((i) => i >= 0);
  assert.equal(at.length, 1, "heading occurs exactly once");
  const addendum = lines.findIndex((l) => l.startsWith("### `laneProtocolAddendum`"));
  assert.ok(addendum >= 0 && addendum < at[0]);
  const end = lines.findIndex((l, i) => i > at[0] && l === "---");
  assert.ok(end > at[0]);
  assert.ok(!lines.slice(addendum + 1, at[0]).includes("---"), "section follows the addendum section directly");
  const section = lines.slice(at[0], end).join("\n");
  for (const needle of ["name", "path", "owns", "backlog", "contracts", "lane-status.mjs --repo", "handoff --check", "外部依賴", "schema_version"]) {
    assert.ok(section.includes(needle), `section mentions ${needle}`);
  }
});
