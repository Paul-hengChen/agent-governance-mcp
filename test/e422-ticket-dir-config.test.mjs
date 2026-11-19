// Coded by @qa-engineer
// Tests (T-E422-03) for specs/e422-ticket-file-format.md AC9: the `ticketDir` config key. The loader
// surfaces the key only when it holds a usable value (so no existing config consumer sees a new field
// by default), and `resolveTicketDir` applies the default `docs/tickets` otherwise; a bad value is
// dropped silently, never an error, so it cannot break unrelated tools. The docs section is where an
// adopter learns the rule. Fixtures are temp workspaces; each case uses a fresh path (no mtime cache reuse).

import { test, after } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

import { loadConfig, getConfigError, resolveTicketDir, DEFAULT_TICKET_DIR } from "../dist/tools/config.js";
import { CURRENT_VERSIONS } from "../dist/schema/versions.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), "e422-cfg-"));
after(() => fs.rmSync(TMP, { recursive: true, force: true }));

let n = 0;
function ws(body) {
  const dir = path.join(TMP, `w${n++}`);
  fs.mkdirSync(path.join(dir, ".current"), { recursive: true });
  if (body !== undefined) {
    fs.writeFileSync(path.join(dir, ".current", ".config.json"), typeof body === "string" ? body : JSON.stringify(body));
  }
  return dir;
}

test("AC9 the default ticket directory constant is docs/tickets", () => {
  assert.equal(DEFAULT_TICKET_DIR, "docs/tickets");
});

test("AC9 a configured ticketDir is surfaced verbatim by loadConfig and joined under the workspace by resolveTicketDir", () => {
  const dir = ws({ schema_version: 2, ticketDir: "work/tickets" });
  assert.equal(loadConfig(dir).ticketDir, "work/tickets");
  assert.equal(resolveTicketDir(dir), path.join(dir, "work/tickets"));
  assert.equal(getConfigError(dir), null);
});

test("AC9 a ticketDir that merely contains dots in a name, such as ..foo or a/../b, is usable", () => {
  // WHY: only a path whose FIRST normalized segment is .. escapes the workspace.
  for (const v of ["..foo/tickets", "a/../b", "./x"]) {
    const dir = ws({ schema_version: 2, ticketDir: v });
    assert.equal(loadConfig(dir).ticketDir, v, v);
  }
});

test("AC9 with the key absent loadConfig has no ticketDir and resolveTicketDir returns the default", () => {
  // WHY: surfacing the default in loadConfig would add a field to every existing config consumer's result.
  const dir = ws({ schema_version: 2, host: "claude-code" });
  const cfg = loadConfig(dir);
  assert.ok(!("ticketDir" in cfg));
  assert.equal(resolveTicketDir(dir), path.join(dir, "docs/tickets"));
});

test("AC9 with no config file at all the default applies", () => {
  const dir = ws(undefined);
  assert.ok(!("ticketDir" in loadConfig(dir)));
  assert.equal(resolveTicketDir(dir), path.join(dir, "docs/tickets"));
});

test("AC9 absolute, tilde, escaping, empty, drive-prefixed and non-string values are dropped silently", () => {
  const bad = ["/etc/tickets", "~/tickets", "~", "../up", "a/../../up", "..", "", "C:\\tickets", "C:/tickets",
    "\\\\server\\share", 7, true, null, ["docs/tickets"], { a: 1 }];
  for (const v of bad) {
    const dir = ws({ schema_version: 2, ticketDir: v });
    assert.ok(!("ticketDir" in loadConfig(dir)), JSON.stringify(v));
    assert.equal(resolveTicketDir(dir), path.join(dir, "docs/tickets"), JSON.stringify(v));
    assert.equal(getConfigError(dir), null, `${JSON.stringify(v)} must not be an error`);
  }
});

test("AC9 other config keys are untouched by the ticketDir key", () => {
  const dir = ws({ schema_version: 2, host: "claude-code", ticketDir: "t" });
  const cfg = loadConfig(dir);
  assert.equal(cfg.host, "claude-code");
  assert.equal(cfg.ticketDir, "t");
});

test("AC9 the config schema_version stays 2: the key is additive and needs no migration", () => {
  assert.equal(CURRENT_VERSIONS.config, 2);
  const dir = ws({ schema_version: 2, ticketDir: "t" });
  loadConfig(dir);
  const onDisk = JSON.parse(fs.readFileSync(path.join(dir, ".current", ".config.json"), "utf8"));
  assert.equal(onDisk.schema_version, 2);
  assert.deepEqual(Object.keys(onDisk).sort(), ["schema_version", "ticketDir"]);
});

test("AC9 docs/config.md has exactly one ticketDir section stating the default, the usable-value rule, optional and unchanged schema_version", () => {
  const md = fs.readFileSync(path.join(ROOT, "docs", "config.md"), "utf8");
  const heads = md.match(/^### `ticketDir`/gm) ?? [];
  assert.equal(heads.length, 1);
  const start = md.indexOf("### `ticketDir`");
  const rest = md.slice(start + 5);
  const end = rest.search(/^(###? |---)/m);
  const section = rest.slice(0, end < 0 ? undefined : end);
  assert.match(section, /docs\/tickets/);
  assert.match(section, /optional/i);
  assert.match(section, /relative/);
  assert.match(section, /\.\./);
  assert.match(section, /~/);
  assert.match(section, /schema_version/);
  assert.match(section, /stays 2/);
});

test("AC9 package.json carries the check:tickets script line", () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8"));
  assert.equal(pkg.scripts["check:tickets"], "node scripts/check-tickets.mjs");
});
