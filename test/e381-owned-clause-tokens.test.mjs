// Coded by @qa-engineer
// Tests (T-E381-04) for specs/e381-fanout-and-ledger-fixes.md AC-E381-1..3, 5, 6 (D-E381): the fan-in ownership
// check grants only the paths an 擁有 cell lists. A backticked glob inside a parenthesis, or inside a prose-led list
// item, is explanation and not a grant (ownedPathTokens); concrete paths, label/新檔-led globs and globs followed by a
// parenthesised qualifier stay owned. 禁止 and Cut `touches` tokenization is unchanged. AC-E381-4 is a review-time
// check on the real wave manifest and is deliberately not asserted here. Fixtures are in-test cells/manifests and
// throwaway git repos under os.tmpdir(); nothing reads the real specs/fanout-*.md and nothing diffs a fixed sha.

import { test, after } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { execFileSync, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import { parseManifest, pathTokens, ownedPathTokens } from "../dist/tools/fanout-manifest.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const FANOUT = path.join(ROOT, "scripts", "fanout.mjs");
const TMP = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "e381-owned-")));
after(() => fs.rmSync(TMP, { recursive: true, force: true }));

// --- fixtures -------------------------------------------------------------------------------------------------

const manifestWith = (owned, forbidden = "`docs/**`") =>
  [
    "# Fan-out: fixture",
    "base: abc1234    integration branch: integ/fx",
    "mailbox: ../lanes/_mailbox",
    "",
    "## Lanes",
    "| lane | 票 | branch | worktree | 擁有 | 禁止 | 範圍切線 | 相依 |",
    "|---|---|---|---|---|---|---|---|",
    `| a | E1 | feat/a | ../lanes/a | ${owned} | ${forbidden} | 做：x。　不做：y | 無 |`,
    "",
    "## Dispatch pins",
    "- a：`sr-engineer=opus`。",
    "",
    "## Decisions",
    "| 日期 | 裁決者 | 內容 | 出處 |",
    "|---|---|---|---|",
    "| 2026-10-13 | 人類 | 開波 | s |",
    "",
  ].join("\n");

const laneTokens = (owned) => parseManifest(manifestWith(owned)).dispatchable.find((l) => l.lane === "a").ownedTokens;

// --- AC-E381-1 ------------------------------------------------------------------------------------------------

test("AC-E381-1 a prose-led glob clause (zh) is not owned; the real owned items are", () => {
  // WHY: "其他跑 `scripts/**` 的 `test/**`" explains a restriction; reading `test/**` as a grant let any test file pass.
  const cell = "`scripts/**`、其他跑 `scripts/**` 的 `test/**`（只限被本 lane 改變的行為斷言）、`test/e9-x.test.mjs`";
  assert.deepEqual(laneTokens(cell), ["scripts/**", "test/e9-x.test.mjs"]);
  assert.deepEqual(ownedPathTokens(cell), ["scripts/**", "test/e9-x.test.mjs"]);
});

test("AC-E381-1 the English prose form drops the clause globs", () => {
  assert.deepEqual(ownedPathTokens("`scripts/**`, other `test/**` that run `scripts/**`"), ["scripts/**"]);
});

test("AC-E381-1 a '上列檔案對應的 `dist/**`' item after another owned item grants nothing", () => {
  assert.deepEqual(ownedPathTokens("`tools/a.ts`、上列檔案對應的 `dist/**`"), ["tools/a.ts"]);
});

// --- AC-E381-2 ------------------------------------------------------------------------------------------------

test("AC-E381-2 a parenthesised exclusion is not a grant, full-width and ASCII parentheses", () => {
  // WHY: "`specs/**`（`specs/fanout-*.md` 除外）" used to grant the very file it excludes.
  assert.deepEqual(ownedPathTokens("`specs/**`（`specs/fanout-*.md` 除外）"), ["specs/**"]);
  assert.deepEqual(ownedPathTokens("`specs/**` (except `specs/fanout-*.md`)"), ["specs/**"]);
  assert.deepEqual(laneTokens("`specs/**`（`specs/fanout-*.md` 除外）"), ["specs/**"]);
});

test("AC-E381-2 a glob nested two parentheses deep is dropped", () => {
  assert.deepEqual(ownedPathTokens("`specs/**`（外層（內層 `x/**` 說明）仍是說明）"), ["specs/**"]);
  assert.deepEqual(ownedPathTokens("`specs/**` (outer (inner `x/**` note) still note)"), ["specs/**"]);
});

// --- AC-E381-3 ------------------------------------------------------------------------------------------------

test("AC-E381-3 a glob followed by a parenthesised qualifier stays owned", () => {
  assert.deepEqual(
    ownedPathTokens("`test/fixtures/compose-golden/**`（coordinator monolith 那一檔除外；只在動憲法時）"),
    ["test/fixtures/compose-golden/**"],
  );
});

test("AC-E381-3 a role label then 新檔 keeps both globs (declared-new-file idiom), full-width and ASCII colon", () => {
  assert.deepEqual(
    ownedPathTokens("qa：新檔 `test/e9-*.test.mjs` 與 `test/fixtures/e9/**`（建立已預先授權）"),
    ["test/e9-*.test.mjs", "test/fixtures/e9/**"],
  );
  assert.deepEqual(ownedPathTokens("qa:新檔 `test/e9-*.test.mjs`"), ["test/e9-*.test.mjs"]);
});

test("AC-E381-3 concrete paths are tokenized as before: 新檔 item, an item with its dist twin, a parenthesised concrete path", () => {
  assert.deepEqual(ownedPathTokens("新檔 `tools/x.ts`"), ["tools/x.ts"]);
  assert.deepEqual(ownedPathTokens("`tools/a.ts` 與其 `dist/tools/a.*`"), ["tools/a.ts", "dist/tools/a.*"]);
  assert.deepEqual(ownedPathTokens("`scripts/fanout.mjs`（同 `feature-rollup.mjs` 模式）"), [
    "scripts/fanout.mjs",
    "feature-rollup.mjs",
  ]);
});

test("AC-E381-3 (reviewer note) 'qa : `t/**`' with a space before the colon is prose, so its glob is dropped", () => {
  // WHY: the label rule allows no whitespace before the colon; pinning it keeps the label allowance from widening.
  assert.deepEqual(ownedPathTokens("`a.ts`、qa : `t/**`"), ["a.ts"]);
});

// --- AC-E381-6 ------------------------------------------------------------------------------------------------

test("AC-E381-6 禁止 tokens keep the old reading (prose and parenthesised globs included); pathTokens is unchanged", () => {
  const forbidden = "`gates/**`（含 `gates/registry.ts` 的 `hintStatic`）、其他 `test/**`";
  const m = parseManifest(manifestWith("`tools/a.ts`", forbidden));
  assert.deepEqual(m.dispatchable[0].forbiddenTokens, ["gates/**", "gates/registry.ts", "test/**"]);
  // pathTokens keeps every path-shaped span, including the ones ownedPathTokens drops.
  assert.deepEqual(pathTokens("`specs/**`（`specs/fanout-*.md` 除外）"), ["specs/**", "specs/fanout-*.md"]);
  assert.deepEqual(pathTokens("其他跑 `scripts/**` 的 `test/**`"), ["scripts/**", "test/**"]);
});

test("boundary: empty and span-free cells yield no tokens, and never throw", () => {
  for (const cell of ["", "   ", "只有文字，沒有 span", "（未閉合 `x/**`", "`未閉合 x/**"]) {
    assert.ok(Array.isArray(ownedPathTokens(cell)), JSON.stringify(cell));
  }
  assert.deepEqual(ownedPathTokens(""), []);
});

// --- AC-E381-5 ------------------------------------------------------------------------------------------------

function git(cwd, ...args) {
  return execFileSync("git", ["-c", "user.name=qa", "-c", "user.email=qa@example.invalid", "-c", "commit.gpgsign=false", ...args], {
    cwd,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    timeout: 30_000,
  }).trim();
}
const cli = (args) => {
  const r = spawnSync(process.execPath, [FANOUT, ...args], { cwd: ROOT, encoding: "utf8" });
  return { status: r.status, stdout: r.stdout, stderr: r.stderr };
};

const OWNED_CLAUSE = "`scripts/**`、其他跑 `scripts/**` 的 `test/**`（只限被本 lane 改變的行為斷言）、`test/e9-x.test.mjs`";

function makeLaneRepo() {
  const repo = fs.mkdtempSync(path.join(TMP, "repo-"));
  git(repo, "init", "-q", "-b", "main");
  fs.writeFileSync(path.join(repo, "README.md"), "x\n");
  git(repo, "add", "-A");
  git(repo, "commit", "-q", "-m", "base");
  git(repo, "checkout", "-q", "-b", "feat/a");
  for (const f of ["scripts/a.mjs", "test/e9-x.test.mjs", "test/other.test.mjs"]) {
    fs.mkdirSync(path.dirname(path.join(repo, f)), { recursive: true });
    fs.writeFileSync(path.join(repo, f), "x\n");
  }
  git(repo, "add", "-A");
  git(repo, "commit", "-q", "-m", "lane");
  const manifest = path.join(repo, "m.md");
  fs.writeFileSync(manifest, manifestWith(OWNED_CLAUSE));
  return { repo, manifest };
}

test("AC-E381-5 check: the clause glob no longer admits test/other.test.mjs; exactly one OUT line, exit 1", () => {
  // WHY: the machine check is what stops an out-of-scope test edit; it must follow the narrowed ownedTokens.
  const { repo, manifest } = makeLaneRepo();
  const r = cli(["check", manifest, "a", "--base", "main", "--repo", repo]);
  assert.equal(r.status, 1, r.stdout + r.stderr);
  const outs = r.stdout.split("\n").filter((l) => l.startsWith("OUT "));
  assert.equal(outs.length, 1, r.stdout);
  assert.match(outs[0], /^OUT {2}test\/other\.test\.mjs/);
});

test("AC-E381-5 check --cut: a touches entry for test/other.test.mjs is out of bounds, one OUT line, exit 1", () => {
  const { manifest } = makeLaneRepo();
  const spec = path.join(TMP, "cut-spec.md");
  fs.writeFileSync(
    spec,
    [
      "# x",
      "",
      "## Cut",
      "",
      "| id | desc | depends_on | est. files | touches | design-link |",
      "|---|---|---|---|---|---|",
      "| T-X-01 | x | none | 1 | `test/other.test.mjs` | — |",
      "",
    ].join("\n"),
  );
  const r = cli(["check", "--cut", manifest, "a", spec]);
  assert.equal(r.status, 1, r.stdout + r.stderr);
  const outs = r.stdout.split("\n").filter((l) => l.startsWith("OUT "));
  assert.equal(outs.length, 1, r.stdout);
  assert.ok(outs[0].includes("test/other.test.mjs"), outs[0]);
});

test("AC-E381-5 control: touches naming the concrete owned test file stays in bounds (exit 0)", () => {
  const { manifest } = makeLaneRepo();
  const spec = path.join(TMP, "cut-spec-ok.md");
  fs.writeFileSync(
    spec,
    [
      "# x",
      "",
      "## Cut",
      "",
      "| id | desc | depends_on | est. files | touches | design-link |",
      "|---|---|---|---|---|---|",
      "| T-X-01 | x | none | 1 | `test/e9-x.test.mjs` | — |",
      "",
    ].join("\n"),
  );
  const r = cli(["check", "--cut", manifest, "a", spec]);
  assert.equal(r.status, 0, r.stdout + r.stderr);
});
