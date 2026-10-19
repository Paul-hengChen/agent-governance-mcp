// Coded by @qa-engineer
// Tests (T-E289-01) for specs/e289-render-addendum.md AC-E289-1..3: the `laneProtocolAddendum` config key.
// `render` points a lane at a repo's own lane-rules addendum, so the loader must hand the path through
// byte-verbatim and treat every other shape as "unset" without ever failing the config (a bad value must not
// break unrelated tools); the key is additive-optional, so the config schema version must not move; and the
// docs section is the only place an adopter learns the render error codes. Fixtures are temp workspaces under
// os.tmpdir(); nothing reads this repo's own .current/.config.json.

import { test, after } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

import { loadConfig, getConfigError } from "../dist/tools/config.js";
import { CURRENT_VERSIONS } from "../dist/schema/versions.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), "e289-cfg-"));
after(() => fs.rmSync(TMP, { recursive: true, force: true }));

let n = 0;
/** A fresh workspace (fresh path => no mtime-cache reuse) whose config holds `body`. */
function ws(body) {
  const dir = path.join(TMP, `w${n++}`);
  fs.mkdirSync(path.join(dir, ".current"), { recursive: true });
  fs.writeFileSync(path.join(dir, ".current", ".config.json"), typeof body === "string" ? body : JSON.stringify(body));
  return dir;
}

test("AC-E289-1 a non-empty string is surfaced byte-verbatim", () => {
  // WHY: render writes the value into the prompt as typed; any normalization here would desync it.
  for (const v of ["docs/lane-protocol-addendum.md", "a b/ç 檔.md", "./x/../y.md", "docs//x.md "]) {
    const dir = ws({ schema_version: 2, laneProtocolAddendum: v });
    assert.equal(loadConfig(dir).laneProtocolAddendum, v);
    assert.equal(getConfigError(dir), null);
  }
});

test("AC-E289-1 absent, empty and non-string values are treated as unset, never as an error", () => {
  // WHY: non-fatal filter convention (staleDispatchNotifyFile) — a malformed optional key must not break the config.
  const cases = [
    { schema_version: 2 },
    { schema_version: 2, laneProtocolAddendum: "" },
    { schema_version: 2, laneProtocolAddendum: 5 },
    { schema_version: 2, laneProtocolAddendum: ["docs/x.md"] },
    { schema_version: 2, laneProtocolAddendum: { path: "docs/x.md" } },
    { schema_version: 2, laneProtocolAddendum: null },
    { schema_version: 2, laneProtocolAddendum: true },
  ];
  for (const body of cases) {
    const dir = ws(body);
    const cfg = loadConfig(dir);
    assert.equal("laneProtocolAddendum" in cfg, false, JSON.stringify(body));
    assert.equal(getConfigError(dir), null, JSON.stringify(body));
  }
});

test("AC-E289-2 the config schema version is unchanged by the additive key", () => {
  // WHY: G1 — an additive-optional key must not force a migration on every adopter.
  assert.equal(CURRENT_VERSIONS.config, 2);
});

test("AC-E289-3 docs/config.md has exactly one laneProtocolAddendum section naming the codes", () => {
  const text = fs.readFileSync(path.join(ROOT, "docs", "config.md"), "utf8");
  const heading = "### `laneProtocolAddendum` — repo lane-protocol addendum for `fanout.mjs render` (optional)";
  const lines = text.split("\n");
  const starts = lines.flatMap((l, i) => (l.startsWith("### `laneProtocolAddendum`") ? [i] : []));
  assert.equal(starts.length, 1, "exactly one section");
  assert.equal(lines[starts[0]], heading);
  let end = lines.length;
  for (let i = starts[0] + 1; i < lines.length; i++) {
    if (/^#{1,3} /.test(lines[i]) || lines[i] === "---") {
      end = i;
      break;
    }
  }
  const section = lines.slice(starts[0], end).join("\n");
  for (const needle of ["ADDENDUM_INVALID", "ADDENDUM_ABSENT", "LANE_PROTOCOL_ABSENT", "CONFIG_UNREADABLE", "docs/lane-protocol.md"]) {
    assert.ok(section.includes(needle), `section must mention ${needle}`);
  }
  assert.match(section, /schema_version/);
});
