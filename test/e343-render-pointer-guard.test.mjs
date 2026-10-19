// Coded by @qa-engineer
// Tests (T-E343-01) for specs/e292-sister-repos.md AC-E343-1..3: `render` swaps the template's lane-rules pointer
// only through `replaceLanePointer`, which refuses (undefined) unless the pointer occurs exactly once. WHY: with a
// plain string replace, a template whose wording drifted silently dropped the addendum from the prompt and sent a
// lane to work without the repo's rules; the guard makes that a loud, collected render error. The guard applies only
// while a replacement is made (key set); with the key unset nothing is replaced, so nothing is guarded. Fixtures:
// the frozen wave7 manifest copy, temp primaries and temp install roots under os.tmpdir() (the `template` and
// `installRoot` seams); nothing reads this repo's own config.

import { test, after } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

import {
  parseManifest,
  renderPrompt,
  PROMPT_TEMPLATE_3B,
  LANE_PROTOCOL_POINTER,
  replaceLanePointer,
} from "../dist/tools/fanout-manifest.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const MANIFEST_TEXT = fs.readFileSync(path.join(ROOT, "test", "fixtures", "e177a", "fanout-wave7.md"), "utf8");
const TMP = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "e343-guard-")));
after(() => fs.rmSync(TMP, { recursive: true, force: true }));

const count = (hay, needle) => hay.split(needle).length - 1;

test("AC-E343-1 the template holds the pointer exactly once", () => {
  assert.ok(LANE_PROTOCOL_POINTER.length > 0);
  assert.equal(count(PROMPT_TEMPLATE_3B, LANE_PROTOCOL_POINTER), 1);
});

test("AC-E343-2 replaceLanePointer replaces the one occurrence, else returns undefined", () => {
  const R = "<<R>>";
  assert.equal(replaceLanePointer(`a${LANE_PROTOCOL_POINTER}b`, R), `a${R}b`);
  assert.equal(replaceLanePointer(LANE_PROTOCOL_POINTER, R), R);
  assert.equal(replaceLanePointer("a b", R), undefined, "zero occurrences");
  assert.equal(replaceLanePointer(`${LANE_PROTOCOL_POINTER}x${LANE_PROTOCOL_POINTER}`, R), undefined, "two occurrences");
  assert.equal(replaceLanePointer(LANE_PROTOCOL_POINTER.repeat(3), R), undefined, "three occurrences");
  assert.equal(replaceLanePointer("", R), undefined);
  // adjacent / overlapping-prefix: the second search must start inside the first match's span
  assert.equal(replaceLanePointer(LANE_PROTOCOL_POINTER + LANE_PROTOCOL_POINTER, R), undefined);
  // the replacement is inserted literally ($ patterns are not interpreted)
  assert.equal(replaceLanePointer(`x${LANE_PROTOCOL_POINTER}y`, "$&$1"), "x$&$1y");
  // the real template: the result differs from it only by that one span
  const real = replaceLanePointer(PROMPT_TEMPLATE_3B, R);
  assert.equal(real, PROMPT_TEMPLATE_3B.replace(LANE_PROTOCOL_POINTER, () => R));
});

// --- AC-E343-3 ------------------------------------------------------------------------------------------------

let n = 0;
const fresh = (label) => {
  const d = path.join(TMP, `${label}${n++}`);
  fs.mkdirSync(d, { recursive: true });
  return d;
};
function primaryWith(config, files = {}) {
  const dir = fresh("primary");
  if (config !== undefined) {
    fs.mkdirSync(path.join(dir, ".current"), { recursive: true });
    fs.writeFileSync(path.join(dir, ".current", ".config.json"), JSON.stringify({ schema_version: 2, ...config }));
  }
  for (const [rel, body] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
    fs.writeFileSync(path.join(dir, rel), body);
  }
  return dir;
}
function installRoot() {
  const dir = fresh("install");
  fs.mkdirSync(path.join(dir, "docs"));
  fs.writeFileSync(path.join(dir, "docs", "lane-protocol.md"), "# generic rules\n");
  return dir;
}
const manifest = () => parseManifest(MANIFEST_TEXT);
const render = (primary, extra) =>
  renderPrompt(manifest(), "e177a", { summary: "S", reading: ["R1", "R2"], mailboxRoot: "/m", primary, ...extra });
const ADDENDUM = "docs/add.md";
const setPrimary = () => primaryWith({ laneProtocolAddendum: ADDENDUM }, { [ADDENDUM]: "# addendum\n" });
const TEMPLATE_NO_POINTER = "no pointer here <票> <lane>\n";
const TEMPLATE_TWO_POINTERS = `${LANE_PROTOCOL_POINTER}\n${LANE_PROTOCOL_POINTER}\n<票>\n`;

test("AC-E343-3 key set + template without the pointer -> one TEMPLATE_POINTER_ABSENT, render fails", () => {
  const r = render(setPrimary(), { installRoot: installRoot(), template: TEMPLATE_NO_POINTER });
  assert.equal(r.ok, false);
  assert.deepEqual(r.errors.map((e) => e.code), ["TEMPLATE_POINTER_ABSENT"]);
  assert.equal(
    r.errors[0].message,
    "the dispatch-prompt template does not hold the lane-rules pointer exactly once, so the two-layer pointer cannot replace it — fix PROMPT_TEMPLATE_3B or LANE_PROTOCOL_POINTER in tools/fanout-manifest.ts",
  );
  assert.equal(r.prompt, undefined);
});

test("AC-E343-3 key set + template with the pointer twice -> TEMPLATE_POINTER_ABSENT too", () => {
  const r = render(setPrimary(), { installRoot: installRoot(), template: TEMPLATE_TWO_POINTERS });
  assert.equal(r.ok, false);
  assert.deepEqual(r.errors.map((e) => e.code), ["TEMPLATE_POINTER_ABSENT"]);
});

test("AC-E343-3 collected together with another missing-source error", () => {
  // WHY: the report must be complete — fixing the mailbox root must not reveal a second, template error.
  const r = renderPrompt(manifest(), "e177a", { summary: "S", reading: ["R1"], primary: setPrimary(), installRoot: installRoot(), template: TEMPLATE_NO_POINTER });
  assert.equal(r.ok, false);
  assert.deepEqual(r.errors.map((e) => e.code).sort(), ["MAILBOX_ROOT_ABSENT", "TEMPLATE_POINTER_ABSENT"]);
});

test("AC-E343-3 key unset + the same seam: render succeeds, template filled, no guard", () => {
  // WHY: nothing is replaced while the key is unset, so a pointer-less template is not an error there.
  for (const template of [TEMPLATE_NO_POINTER, TEMPLATE_TWO_POINTERS]) {
    const r = render(primaryWith(undefined), { template });
    assert.equal(r.ok, true, JSON.stringify(r.errors));
    assert.ok(!r.prompt.includes("<票>") && !r.prompt.includes("<lane>"), "placeholders filled");
    assert.ok(r.prompt.startsWith(template.split("<")[0]));
  }
  const ticket = manifest().dispatchable.find((l) => l.lane === "e177a")?.ticket;
  assert.ok(ticket, "fixture lane has a ticket");
  assert.equal(render(primaryWith(undefined), { template: "T <票> end\n" }).prompt, `T ${ticket} end\n`);
  // key present but unusable config: still the unset path, still no guard
  const broken = primaryWith(undefined);
  fs.mkdirSync(path.join(broken, ".current"));
  fs.writeFileSync(path.join(broken, ".current", ".config.json"), "{ nope");
  assert.equal(render(broken, { template: TEMPLATE_NO_POINTER }).ok, true);
});

test("AC-E343-3 key set + default template (no seam) still renders the two-layer pointer", () => {
  const install = installRoot();
  const r = render(setPrimary(), { installRoot: install });
  assert.equal(r.ok, true, JSON.stringify(r.errors));
  assert.ok(r.prompt.includes(`先完整讀 ${path.join(install, "docs", "lane-protocol.md")}（agc 通用規則，包括信箱與回報格式）和 ${ADDENDUM}（本 repo 的補充規則），再讀`));
  assert.ok(!r.prompt.includes(LANE_PROTOCOL_POINTER));
});

test("AC-E343-3 the CLI never offers the template seam", () => {
  // WHY: the seam is test-only; the CLI flag surface must not grow a way to swap the template.
  const src = fs.readFileSync(path.join(ROOT, "tools", "fanout-manifest.ts"), "utf8");
  assert.ok(!/["']--template["']/.test(src));
});
