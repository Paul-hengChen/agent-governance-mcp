// Coded by @qa-engineer
// E447 (T-E447-01): with "knowledge": "local" the lane branch carries no fan-out manifest, so the
// Manifest tier reads the lane's seeded copy; `fanout.mjs check --cut` run in the lane accepts it only
// while it is byte-identical to the primary checkout's copy (else MANIFEST_CHANGED, exit 1), and
// `agc feature reseed <path>...` is the one sanctioned way to refresh a seeded copy (refused for a
// file the lane changed). Spec: specs/e447-local-knowledge-files.md AC9 (Fix 5, D9, O2 (a)), Copy /
// Strings e447.cut-manifest-changed, e447.reseed-*. Scratch git repos under os.tmpdir(); "mode on" is
// built by hand (config keys + exclude rules). The manifest is a frozen in-test fixture.

import { test, after } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import * as crypto from "node:crypto";
import { execFileSync, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const PROJECT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const AGC_INIT = path.join(PROJECT_ROOT, "bin", "agc-init.mjs");
const FANOUT = path.join(PROJECT_ROOT, "scripts", "fanout.mjs");

const TMP_DIRS = [];
function mkTmp(prefix) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  TMP_DIRS.push(dir);
  return dir;
}
after(() => {
  for (const d of TMP_DIRS) fs.rmSync(d, { recursive: true, force: true });
});

const git = (cwd, args) => execFileSync("git", args, { cwd, encoding: "utf-8" });
const agc = (cwd, args) => spawnSync(process.execPath, [AGC_INIT, ...args], { cwd, encoding: "utf-8" });
const writeFile = (abs, content) => {
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, content);
};
const read = (abs) => fs.readFileSync(abs);
const sha = (buf) => "sha256:" + crypto.createHash("sha256").update(buf).digest("hex");

const MODE_ON_EXCLUDE = [
  "/.current/", "/tasks.md", "/qa_reports/", "/review_reports/",
  "/specs/", "/design/", "/research/", "/docs/tickets/", "/docs/backlog.md",
];
const MODE_ON_CONFIG = JSON.stringify({ schema_version: 2, artifacts: "local", knowledge: "local" }, null, 2) + "\n";

const MANIFEST_REL = "specs/fanout-x.md";
const SPEC_REL = "specs/e9-spec.md";
// Frozen manifest: lane e9 owns src/**, no approval column, one 人類 Decisions row -> check --cut exit 0.
const MANIFEST = [
  "# Fan-out: e447 test wave",
  "base: abc1234    integration branch: integ/test-wave",
  "mailbox: ../lanes/_mailbox",
  "",
  "## Lanes",
  "| lane | 票 | branch | worktree | 擁有 | 禁止 | 範圍切線 | 相依 |",
  "|---|---|---|---|---|---|---|---|",
  "| e9 | E9 | feat/e9-x | ../lanes/e9 | `src/**`、`.current/e9/**` | 共同禁止的全部項目 | 做：E9。　不做：其他。 | 無 |",
  "",
  "## Decisions",
  "| 日期 | 裁決者 | 內容 | 出處 |",
  "|---|---|---|---|",
  "| 2026-11-20 | 人類 | 核准本清單 | 整合者 session |",
  "",
].join("\n");
// A later 人類 row: the integrator's mid-wave amendment made in the primary checkout.
const AMENDED = MANIFEST + "| 2026-11-25 | 人類 | 追加一列 | 整合者 session |\n";
const SPEC = [
  "# e9 spec",
  "",
  "## Cut",
  "",
  "| id | desc | depends_on | est. files | touches | design-link |",
  "|---|---|---|---|---|---|",
  "| T-E9-01 | x | none | 1 | `src/a.ts` | — |",
  "",
].join("\n");

const CHANGED_LINE = "FAIL  MANIFEST_CHANGED: manifest changed since lane start — re-seed";

function makeModeOnRepo({ config = MODE_ON_CONFIG } = {}) {
  const r = mkTmp("e447-cut-primary-");
  git(r, ["init", "-q", "-b", "main"]);
  git(r, ["config", "user.email", "qa@example.com"]);
  git(r, ["config", "user.name", "QA Sentinel"]);
  git(r, ["config", "commit.gpgsign", "false"]);
  writeFile(path.join(r, "README.md"), "x\n");
  fs.appendFileSync(path.join(r, ".git", "info", "exclude"), MODE_ON_EXCLUDE.join("\n") + "\n");
  git(r, ["add", "-A"]);
  git(r, ["commit", "-qm", "init"]);
  writeFile(path.join(r, ".current", ".config.json"), config);
  writeFile(path.join(r, MANIFEST_REL), MANIFEST);
  writeFile(path.join(r, SPEC_REL), SPEC);
  return r;
}
function startOk(repo, { seeded = true } = {}) {
  const lane = path.join(mkTmp("e447-cut-lane-"), "lane");
  const res = agc(repo, ["feature", "start", "e9-x", "--path", lane]);
  assert.equal(res.status, 0, res.stdout + res.stderr);
  if (seeded) assert.ok(fs.existsSync(path.join(lane, MANIFEST_REL)), "precondition: start seeded the manifest");
  return { lane, seedPath: path.join(lane, ".current", "e9", "knowledge-seed.json") };
}
const readSeed = (p) => JSON.parse(fs.readFileSync(p, "utf-8"));

// check --cut run in the lane, operands repo-relative (the lane-protocol call form).
const cutInLane = (lane) =>
  spawnSync(process.execPath, [FANOUT, "check", "--cut", MANIFEST_REL, "e9", SPEC_REL], { cwd: lane, encoding: "utf-8" });

// "What it is today for that cut": the same manifest + spec bytes checked outside any git repo.
function exitToday(manifestText) {
  const d = mkTmp("e447-cut-today-");
  writeFile(path.join(d, "m.md"), manifestText);
  writeFile(path.join(d, "s.md"), SPEC);
  const r = spawnSync(process.execPath, [FANOUT, "check", "--cut", "m.md", "e9", "s.md"], { cwd: d, encoding: "utf-8" });
  assert.ok(!(r.stdout + r.stderr).includes("MANIFEST_CHANGED"), "fixture sanity: no comparison outside a lane");
  return r.status;
}

// ============================================================================
// AC9 (acceptance e, Fix 5, O2 (a))
// ============================================================================

test("AC9 match: in the lane, the seeded manifest equal to the primary's -> no MANIFEST_CHANGED, exit as today", () => {
  const repo = makeModeOnRepo();
  const { lane } = startOk(repo);
  assert.ok(read(path.join(lane, MANIFEST_REL)).equals(read(path.join(repo, MANIFEST_REL))), "seeded copy");
  const today = exitToday(MANIFEST);
  assert.equal(today, 0, "fixture sanity: the frozen cut is in bounds");
  const r = cutInLane(lane);
  assert.ok(!(r.stdout + r.stderr).includes("MANIFEST_CHANGED"), r.stdout + r.stderr);
  assert.equal(r.status, today, r.stdout + r.stderr);
});

test("AC9 changed: the primary's manifest changed after start -> MANIFEST_CHANGED report line, exit 1", () => {
  const repo = makeModeOnRepo();
  const { lane } = startOk(repo);
  writeFile(path.join(repo, MANIFEST_REL), AMENDED);
  const r = cutInLane(lane);
  assert.equal(r.status, 1, r.stdout + r.stderr);
  assert.ok((r.stdout + r.stderr).split("\n").includes(CHANGED_LINE), r.stdout + r.stderr);
  // A missing primary copy counts as changed (D9).
  fs.rmSync(path.join(repo, MANIFEST_REL));
  const gone = cutInLane(lane);
  assert.equal(gone.status, 1, gone.stdout + gone.stderr);
  assert.ok((gone.stdout + gone.stderr).split("\n").includes(CHANGED_LINE));
});

test("AC9 reseed: agc feature reseed copies the primary's manifest, records the new hash, and check --cut passes again", () => {
  const repo = makeModeOnRepo();
  const { lane, seedPath } = startOk(repo);
  writeFile(path.join(repo, MANIFEST_REL), AMENDED);
  assert.equal(cutInLane(lane).status, 1, "fixture sanity: changed before reseed");

  const rs = agc(lane, ["feature", "reseed", MANIFEST_REL]);
  assert.equal(rs.status, 0, rs.stdout + rs.stderr);
  assert.ok(
    rs.stdout.split("\n").includes(`agc feature reseed — re-seeded ${MANIFEST_REL} from the primary checkout`),
    rs.stdout
  );
  assert.equal(fs.readFileSync(path.join(lane, MANIFEST_REL), "utf-8"), AMENDED);
  assert.equal(readSeed(seedPath).files[MANIFEST_REL], sha(Buffer.from(AMENDED)));
  assert.equal(readSeed(seedPath).files[SPEC_REL], sha(Buffer.from(SPEC)), "other entries untouched");

  const r = cutInLane(lane);
  assert.ok(!(r.stdout + r.stderr).includes("MANIFEST_CHANGED"), r.stdout + r.stderr);
  assert.equal(r.status, exitToday(AMENDED), r.stdout + r.stderr);
});

test("AC9 reseed refuses: a file the lane changed -> exit 1, e447.reseed-refuse-changed, lane copy and record unchanged", () => {
  const repo = makeModeOnRepo();
  const { lane, seedPath } = startOk(repo);
  writeFile(path.join(repo, MANIFEST_REL), AMENDED);
  fs.appendFileSync(path.join(lane, MANIFEST_REL), "\nlane-side note\n");
  const laneBefore = read(path.join(lane, MANIFEST_REL));
  const seedBefore = read(seedPath);

  const rs = agc(lane, ["feature", "reseed", MANIFEST_REL]);
  assert.equal(rs.status, 1, rs.stdout + rs.stderr);
  assert.ok(
    rs.stderr.includes(
      `agc feature reseed: ${MANIFEST_REL} was changed in this lane since it was seeded — not re-seeded (nothing changed)`
    ),
    rs.stderr
  );
  assert.ok(read(path.join(lane, MANIFEST_REL)).equals(laneBefore), "lane copy unchanged");
  assert.ok(read(seedPath).equals(seedBefore), "seed record unchanged");
});

// Boundary inputs for the new command (Copy / Strings e447.reseed-not-knowledge, e447.reseed-not-lane):
// a non-knowledge or escaping path is refused before any write; reseed outside a mode-on lane refuses.
test("AC9 reseed boundaries: non-knowledge and escaping paths exit 2; outside a mode-on lane exits 1; nothing written", () => {
  const repo = makeModeOnRepo();
  const { lane, seedPath } = startOk(repo);
  const seedBefore = read(seedPath);
  for (const p of ["README.md", "../outside.md", "specs/../README.md"]) {
    const r = agc(lane, ["feature", "reseed", p]);
    assert.equal(r.status, 2, `${p}: ${r.stdout}${r.stderr}`);
    assert.ok(r.stderr.includes("is not under a knowledge path of this workspace — nothing changed"), `${p}: ${r.stderr}`);
  }
  assert.equal(fs.existsSync(path.join(path.dirname(lane), "outside.md")), false);
  assert.ok(read(seedPath).equals(seedBefore));

  const NOT_LANE =
    'agc feature reseed: run it inside a lane worktree of a workspace whose .current/.config.json sets "knowledge": "local"';
  const inPrimary = agc(repo, ["feature", "reseed", MANIFEST_REL]);
  assert.equal(inPrimary.status, 1, inPrimary.stdout + inPrimary.stderr);
  assert.ok(inPrimary.stderr.includes(NOT_LANE), inPrimary.stderr);

  // A lane of a mode-off workspace ("knowledge" absent) is not a reseed target either.
  const off = makeModeOnRepo({ config: JSON.stringify({ schema_version: 2, artifacts: "local" }) + "\n" });
  const offLane = startOk(off, { seeded: false }).lane;
  const r = agc(offLane, ["feature", "reseed", MANIFEST_REL]);
  assert.equal(r.status, 1, r.stdout + r.stderr);
  assert.ok(r.stderr.includes(NOT_LANE), r.stderr);
});
