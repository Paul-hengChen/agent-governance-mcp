// Coded by @qa-engineer
// E291 (T-E291-03): `agc feature start` links the node_modules locations listed in the primary
// checkout's .current/.config.json `nodeModulesLinks`, and behaves exactly as before without the key.
// Spec: specs/e291-start-link-locations.md (AC-E291-1..13, D1-D6). Every fixture repo is built in
// os.tmpdir() at runtime. The pre-E291 root-only strings are pinned below as frozen literals, so the
// key-absent cases prove byte identity without diffing against any fixed revision.

import { test, after } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { execFileSync, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import { parseNodeModulesLinks, loadConfig, getConfigError } from "../dist/tools/config.js";
import { CURRENT_VERSIONS } from "../dist/schema/versions.js";

const PROJECT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const AGC_INIT = path.join(PROJECT_ROOT, "bin", "agc-init.mjs");

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
const gitStatus = (cwd, args) => spawnSync("git", args, { cwd, encoding: "utf-8" }).status;
const runAgc = (cwd, args, agcPath = AGC_INIT) =>
  spawnSync(process.execPath, [agcPath, "feature", ...args], { cwd, encoding: "utf-8" });
const writeFile = (abs, content) => {
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, content);
};
const isLink = (p) => {
  try {
    return fs.lstatSync(p).isSymbolicLink();
  } catch {
    return false;
  }
};
const exists = (p) => {
  try {
    fs.lstatSync(p);
    return true;
  } catch {
    return false;
  }
};

// Frozen pre-E291 root-only strings (<P> = primary repo root, <L> = lane path). Pinned literally so
// a template change that drifts the root rendering by one byte fails here.
const STATIC_ADDED = "agc feature start — added .env, /node_modules, /.current/**/base-sha to the shared info/exclude";
const ROOT_LINKED = "agc feature start — linked node_modules -> <P>/node_modules";
const ROOT_SHARED =
  "agc feature start — warning: node_modules is shared with the primary checkout (symlink) — never run " +
  "`npm ci` / `npm install` inside the lane (`npm ci` deletes the directory first, which would delete " +
  "primary's real node_modules through the link); for an independent install, `rm node_modules` (removes " +
  "only the link) and then run `npm ci` in the lane";
const ROOT_MISSING =
  "agc feature start — warning: the primary checkout has no node_modules (<P>/node_modules) — run " +
  "`npm install` in the primary checkout first; the lane was created without a node_modules link";
const created = (ticket) => `agc feature start — created branch feat/${ticket}-x (from main) and worktree <L>`;

// Copy / Strings rows rendered for a non-root location.
const subLinked = (loc) => `agc feature start — linked ${loc}/node_modules -> <P>/${loc}/node_modules`;
const subShared = (loc) =>
  `agc feature start — warning: ${loc}/node_modules is shared with the primary checkout (symlink) — never ` +
  `run \`npm ci\` / \`npm install\` inside the lane's ${loc}/ (\`npm ci\` deletes the directory first, which ` +
  `would delete primary's real ${loc}/node_modules through the link); for an independent install, ` +
  `\`rm ${loc}/node_modules\` (removes only the link) and then run \`npm ci\` in the lane's ${loc}/`;
const subMissing = (loc) =>
  `agc feature start — warning: the primary checkout has no ${loc}/node_modules (<P>/${loc}/node_modules) — ` +
  `run \`npm install\` in the primary checkout's ${loc}/ first; the lane was created without a ` +
  `${loc}/node_modules link`;
const laneDirMissing = (loc) =>
  `agc feature start — warning: ${loc}/ is not a directory in the lane checkout — no ${loc}/node_modules link created`;
const laneExists = (rel) =>
  `agc feature start — warning: <L>/${rel} already exists after checkout (tracked in this repo?) — left as checked out, not linked`;
const invalidEntry = (entry) =>
  `agc feature start — warning: .current/.config.json nodeModulesLinks entry ${JSON.stringify(entry)} is not a ` +
  `repo-relative directory path (no absolute path, no empty, "." or ".." segment, no backslash, wildcard or ` +
  `control character) — skipped`;
const NOT_ARRAY =
  "agc feature start — warning: .current/.config.json nodeModulesLinks is not an array — ignored, linking the root node_modules only";

// Primary fixture. `config`: raw text for <repo>/.current/.config.json (undefined = no file).
// `tracked`: files committed on main. `rootNm` / `subNm`: primary-only installs (untracked).
function makeRepo({ config, tracked = {}, rootNm = false, subNm = [], links = {} } = {}) {
  const r = mkTmp("e291-primary-");
  git(r, ["init", "-q", "-b", "main"]);
  git(r, ["config", "user.email", "qa@example.com"]);
  git(r, ["config", "user.name", "QA Sentinel"]);
  git(r, ["config", "commit.gpgsign", "false"]);
  writeFile(path.join(r, "README.md"), "x\n");
  for (const [rel, body] of Object.entries(tracked)) writeFile(path.join(r, rel), body);
  for (const [rel, target] of Object.entries(links)) {
    fs.mkdirSync(path.dirname(path.join(r, rel)), { recursive: true });
    fs.symlinkSync(target, path.join(r, rel));
  }
  git(r, ["add", "-A"]);
  git(r, ["commit", "-qm", "init"]);
  if (rootNm) writeFile(path.join(r, "node_modules", "dep", "index.js"), "root dep\n");
  for (const loc of subNm) writeFile(path.join(r, loc, "node_modules", "dep", "index.js"), `${loc} dep\n`);
  if (config !== undefined) writeFile(path.join(r, ".current", ".config.json"), config);
  return r;
}

// Starts lane <ticket>-x and returns its output with absolute paths normalized to <P> / <L>.
function start(repo, ticket = "e9", agcPath = AGC_INIT) {
  const lane = path.join(mkTmp("e291-lane-"), "lane");
  const res = runAgc(repo, ["start", `${ticket}-x`, "--path", lane], agcPath);
  const P = fs.realpathSync(repo);
  const norm = (s) => s.split(P).join("<P>").split(lane).join("<L>");
  const lines = (s) => norm(s).split("\n").filter((l) => l.length > 0);
  return { res, lane, out: lines(res.stdout), err: lines(res.stderr), P };
}

const excludeRules = (repo) =>
  fs
    .readFileSync(path.join(repo, ".git", "info", "exclude"), "utf-8")
    .split("\n")
    .filter((l) => l.length > 0 && !l.startsWith("#"));
const nmLines = (lines) => lines.filter((l) => /node_modules/.test(l) && !l.includes("to the shared info/exclude"));

const WEB_TRACKED = { "web/index.js": "web\n" };
const cfg = (value) => JSON.stringify({ schema_version: 2, nodeModulesLinks: value });

// ============================================================================
// AC-E291-1 — key absent: byte-identical to the pre-E291 root-only behavior
// ============================================================================

const KEY_ABSENT_VARIANTS = [
  ["no config file", undefined],
  ["config without the key", JSON.stringify({ schema_version: 2 })],
  ["unparseable config", "{ not json"],
  ["config root is an array", "[]"],
  ["config root is null", "null"],
];

for (const [label, config] of KEY_ABSENT_VARIANTS) {
  test(`AC-E291-1: ${label}, primary root node_modules present -> base root-only link, base strings`, () => {
    const repo = makeRepo({ config, rootNm: true, tracked: WEB_TRACKED, subNm: ["web"] });
    const { res, lane, out, err, P } = start(repo);
    assert.equal(res.status, 0, res.stderr);
    assert.deepEqual(out, [created("e9"), STATIC_ADDED, ROOT_LINKED, ROOT_SHARED, "lane: e9"]);
    assert.deepEqual(err, []);
    assert.ok(isLink(path.join(lane, "node_modules")));
    assert.equal(fs.realpathSync(path.join(lane, "node_modules")), path.join(P, "node_modules"));
    assert.ok(!exists(path.join(lane, "web", "node_modules")), "a subdir is never linked without the key");
    assert.deepEqual(excludeRules(repo), [".env", "/node_modules", "/.current/**/base-sha"]);
  });

  test(`AC-E291-1: ${label}, no primary root node_modules -> base primary-missing warning, no link`, () => {
    const repo = makeRepo({ config });
    const { res, lane, out, err } = start(repo);
    assert.equal(res.status, 0, res.stderr);
    assert.deepEqual(out, [created("e9"), STATIC_ADDED, "lane: e9"]);
    assert.deepEqual(err, [ROOT_MISSING]);
    assert.ok(!exists(path.join(lane, "node_modules")));
    assert.deepEqual(excludeRules(repo), [".env", "/node_modules", "/.current/**/base-sha"]);
  });
}

// D4: with the key absent, start must not load dist/tools/config.js at all. A sandbox install whose
// config.js throws on import proves it; the key-present run in the same sandbox shows the load is
// real, happens before `git worktree add`, and creates nothing when it fails.
test("AC-E291-1/D4: key absent never loads dist/tools/config.js; key present with a broken config.js creates nothing", () => {
  const inst = mkTmp("e291-install-");
  writeFile(path.join(inst, "bin", "agc-init.mjs"), fs.readFileSync(AGC_INIT));
  writeFile(path.join(inst, "package.json"), fs.readFileSync(path.join(PROJECT_ROOT, "package.json")));
  writeFile(
    path.join(inst, "dist", "tools", "lane-paths.js"),
    fs.readFileSync(path.join(PROJECT_ROOT, "dist", "tools", "lane-paths.js"))
  );
  writeFile(path.join(inst, "dist", "tools", "config.js"), 'throw new Error("config.js must not be loaded");\n');
  const sandboxAgc = path.join(inst, "bin", "agc-init.mjs");

  const absent = makeRepo({ config: JSON.stringify({ schema_version: 2 }), rootNm: true });
  const a = start(absent, "e9", sandboxAgc);
  assert.equal(a.res.status, 0, a.res.stderr);
  assert.deepEqual(a.out, [created("e9"), STATIC_ADDED, ROOT_LINKED, ROOT_SHARED, "lane: e9"]);
  assert.deepEqual(a.err, []);

  const present = makeRepo({ config: cfg(["web"]), rootNm: true, tracked: WEB_TRACKED });
  const p = start(present, "e9", sandboxAgc);
  assert.notEqual(p.res.status, 0);
  assert.match(p.res.stderr, /cannot load dist\/tools\/config\.js/);
  assert.ok(!exists(p.lane), "no worktree created");
  assert.notEqual(gitStatus(present, ["show-ref", "--verify", "--quiet", "refs/heads/feat/e9-x"]), 0, "no branch created");
});

// ============================================================================
// AC-E291-2 / AC-E291-3 — subdir-only and root+subdir
// ============================================================================

test("AC-E291-2: [\"web\"] links only web/node_modules, no root link, no root primary-missing warning", () => {
  const repo = makeRepo({ config: cfg(["web"]), tracked: WEB_TRACKED, subNm: ["web"] });
  const { res, lane, out, err, P } = start(repo);
  assert.equal(res.status, 0, res.stderr);
  const webNm = path.join(lane, "web", "node_modules");
  assert.ok(isLink(webNm), "lane web/node_modules is a symlink");
  assert.equal(fs.realpathSync(webNm), path.join(P, "web", "node_modules"));
  assert.ok(!exists(path.join(lane, "node_modules")), "no root link: the list replaces the root default");
  assert.deepEqual(nmLines(out), [subLinked("web"), subShared("web")]);
  assert.deepEqual(err, [], "no root primary-missing warning");
  assert.equal(fs.readFileSync(path.join(webNm, "dep", "index.js"), "utf-8"), "web dep\n");
});

test("AC-E291-2: a nested location (packages/ui) is linked the same way", () => {
  const repo = makeRepo({ config: cfg(["packages/ui"]), tracked: { "packages/ui/x.js": "x\n" }, subNm: ["packages/ui"] });
  const { res, lane, out, err, P } = start(repo);
  assert.equal(res.status, 0, res.stderr);
  const nm = path.join(lane, "packages", "ui", "node_modules");
  assert.equal(fs.realpathSync(nm), path.join(P, "packages", "ui", "node_modules"));
  assert.deepEqual(nmLines(out), [subLinked("packages/ui"), subShared("packages/ui")]);
  assert.deepEqual(err, []);
  assert.ok(excludeRules(repo).includes("/packages/ui/node_modules"));
});

test("AC-E291-3: [\".\", \"web\"] links both; root lines are the base strings and come before the web/ lines", () => {
  const repo = makeRepo({ config: cfg([".", "web"]), tracked: WEB_TRACKED, rootNm: true, subNm: ["web"] });
  const { res, lane, out, err, P } = start(repo);
  assert.equal(res.status, 0, res.stderr);
  assert.equal(fs.realpathSync(path.join(lane, "node_modules")), path.join(P, "node_modules"));
  assert.equal(fs.realpathSync(path.join(lane, "web", "node_modules")), path.join(P, "web", "node_modules"));
  assert.deepEqual(nmLines(out), [ROOT_LINKED, ROOT_SHARED, subLinked("web"), subShared("web")]);
  assert.deepEqual(err, []);
});

test("AC-E291-3: list order decides print order ([\"web\", \".\"] prints web/ first)", () => {
  const repo = makeRepo({ config: cfg(["web", "."]), tracked: WEB_TRACKED, rootNm: true, subNm: ["web"] });
  const { res, out } = start(repo);
  assert.equal(res.status, 0, res.stderr);
  assert.deepEqual(nmLines(out), [subLinked("web"), subShared("web"), ROOT_LINKED, ROOT_SHARED]);
});

// ============================================================================
// AC-E291-4 — exclude rules
// ============================================================================

test("AC-E291-4: /web/node_modules is added after the static rules, exactly once across two starts; lane status clean", () => {
  const repo = makeRepo({ config: cfg(["web"]), tracked: WEB_TRACKED, subNm: ["web"] });
  const first = start(repo, "e9");
  assert.equal(first.res.status, 0, first.res.stderr);
  assert.ok(
    first.out.includes(
      "agc feature start — added .env, /node_modules, /.current/**/base-sha, /web/node_modules to the shared info/exclude"
    ),
    first.out.join("\n")
  );
  assert.equal(git(first.lane, ["status", "--porcelain"]), "", "the web/node_modules link never shows in git status");

  const second = start(repo, "e8");
  assert.equal(second.res.status, 0, second.res.stderr);
  assert.ok(!second.out.some((l) => l.includes("to the shared info/exclude")), "nothing new to add");
  assert.equal(git(second.lane, ["status", "--porcelain"]), "");
  assert.deepEqual(excludeRules(repo), [".env", "/node_modules", "/.current/**/base-sha", "/web/node_modules"]);
});

// ============================================================================
// AC-E291-5 / 6 / 7 — per-location warnings (D6)
// ============================================================================

test("AC-E291-5: [\"web\"] with no primary web/node_modules -> exit 0, lane created, no link, e291.primary-missing", () => {
  const repo = makeRepo({ config: cfg(["web"]), tracked: WEB_TRACKED, rootNm: true });
  const { res, lane, out, err } = start(repo);
  assert.equal(res.status, 0, res.stderr);
  assert.ok(fs.existsSync(path.join(lane, "web", "index.js")), "lane created");
  assert.ok(!exists(path.join(lane, "web", "node_modules")));
  assert.ok(!exists(path.join(lane, "node_modules")));
  assert.deepEqual(err, [subMissing("web")]);
  assert.deepEqual(nmLines(out), []);
});

test("AC-E291-6: lane checkout has no web/ -> exit 0, nothing created under the lane's web path, e291.lane-dir-missing", () => {
  const repo = makeRepo({ config: cfg(["web"]), subNm: ["web"] }); // primary has web/node_modules, web/ untracked
  const { res, lane, out, err } = start(repo);
  assert.equal(res.status, 0, res.stderr);
  assert.ok(!exists(path.join(lane, "web")), "the directory is never created");
  assert.deepEqual(err, [laneDirMissing("web")]);
  assert.deepEqual(nmLines(out), []);
});

test("AC-E291-6: web is a tracked symlink in the lane checkout -> nothing created through it, e291.lane-dir-missing", () => {
  const repo = makeRepo({
    config: cfg(["web"]),
    tracked: { "real-web/index.js": "w\n" },
    links: { web: "real-web" },
    subNm: ["real-web"],
  });
  const { res, lane, err } = start(repo);
  assert.equal(res.status, 0, res.stderr);
  assert.ok(isLink(path.join(lane, "web")), "the tracked link is left as checked out");
  assert.ok(!exists(path.join(lane, "real-web", "node_modules")), "no link created through the symlinked segment");
  assert.deepEqual(err, [laneDirMissing("web")]);
});

test("AC-E291-6: a symlinked parent segment (pkgs -> real, location pkgs/ui) is refused the same way", () => {
  const repo = makeRepo({
    config: cfg(["pkgs/ui"]),
    tracked: { "real/ui/index.js": "u\n" },
    links: { pkgs: "real" },
    subNm: ["real/ui"],
  });
  const { res, lane, err } = start(repo);
  assert.equal(res.status, 0, res.stderr);
  assert.ok(!exists(path.join(lane, "real", "ui", "node_modules")));
  assert.deepEqual(err, [laneDirMissing("pkgs/ui")]);
});

test("AC-E291-6: web is a regular file in the lane checkout -> e291.lane-dir-missing, file untouched", () => {
  const repo = makeRepo({ config: cfg(["web"]), tracked: { web: "a file\n" }, subNm: [] });
  const { res, lane, err } = start(repo);
  assert.equal(res.status, 0, res.stderr);
  assert.equal(fs.readFileSync(path.join(lane, "web"), "utf-8"), "a file\n");
  assert.deepEqual(err, [laneDirMissing("web")]);
});

test("AC-E291-7: base branch tracks web/node_modules -> left as checked out, base already-exists warning", () => {
  const repo = makeRepo({
    config: cfg(["web"]),
    tracked: { "web/index.js": "w\n", "web/node_modules/keep.txt": "tracked\n" },
  });
  // A primary-side install next to the tracked file, so D6 step (2) passes and step (3) decides.
  writeFile(path.join(repo, "web", "node_modules", "dep", "index.js"), "web dep\n");
  const { res, lane, out, err } = start(repo);
  assert.equal(res.status, 0, res.stderr);
  const nm = path.join(lane, "web", "node_modules");
  assert.ok(!isLink(nm) && fs.statSync(nm).isDirectory(), "still the checked-out directory");
  assert.equal(fs.readFileSync(path.join(nm, "keep.txt"), "utf-8"), "tracked\n");
  assert.ok(!exists(path.join(nm, "dep")), "nothing from the primary install appears in it");
  assert.deepEqual(err, [laneExists("web/node_modules")]);
  assert.deepEqual(nmLines(out), []);
});

// ============================================================================
// AC-E291-8 / 9 / 10 — validation, non-array, empty list
// ============================================================================

const SPEC_INVALID = ["/abs", "C:/x", "../up", "a/../b", "./web", "", "a//b", "w*b", "a\\b", 42, null];

test("AC-E291-8: each invalid entry warns once, in list order, before any per-location line; web linked once", () => {
  // "missing" is valid but has no lane dir, so it yields a per-location line that must come last.
  const list = ["/abs", "C:/x", "../up", "missing", "a/../b", "./web", "", "a//b", "w*b", "a\\b", 42, null, "web", "web/"];
  const repo = makeRepo({ config: cfg(list), tracked: WEB_TRACKED, subNm: ["web"] });
  const { res, lane, out, err } = start(repo);
  assert.equal(res.status, 0, res.stderr);
  assert.deepEqual(err, [...SPEC_INVALID.map(invalidEntry), laneDirMissing("missing")]);
  assert.deepEqual(nmLines(out), [subLinked("web"), subShared("web")], "web and web/ are one location");
  assert.ok(isLink(path.join(lane, "web", "node_modules")));
  assert.equal(excludeRules(repo).filter((l) => l === "/web/node_modules").length, 1);
});

test("AC-E291-8 (security smoke): control characters, wildcards and newline injection never reach info/exclude", () => {
  const hostile = ["a\nb", "x\u0001y", "del\u007f", "q?", "[br]", "w]", "*", "D:", "/", "..", "."];
  const repo = makeRepo({ config: cfg(hostile), rootNm: true });
  const { res, err } = start(repo);
  assert.equal(res.status, 0, res.stderr);
  // "." is valid (root) and "/" is invalid: every other entry is rejected with one line each.
  const rejected = hostile.filter((e) => e !== ".");
  assert.deepEqual(err, rejected.map(invalidEntry));
  assert.ok(!res.stderr.includes("a\nb"), "the raw newline is JSON-escaped in the warning");
  assert.deepEqual(excludeRules(repo), [".env", "/node_modules", "/.current/**/base-sha"], "no injected rule");
});

test("AC-E291-8 (boundary): an oversized all-invalid list warns per entry and still exits 0 with nothing linked", () => {
  const list = Array.from({ length: 300 }, (_, i) => `../up${i}`);
  const repo = makeRepo({ config: cfg(list), rootNm: true });
  const { res, lane, err, out } = start(repo);
  assert.equal(res.status, 0, res.stderr);
  assert.equal(err.length, 300);
  assert.deepEqual(nmLines(out), [], "an array (even all-invalid) replaces the root default");
  assert.ok(!exists(path.join(lane, "node_modules")));
});

for (const [label, value] of [["a string", "web"], ["null", null], ["an object", {}]]) {
  test(`AC-E291-9: nodeModulesLinks is ${label} -> e291.not-array, rest is the base root-only behavior`, () => {
    const repo = makeRepo({ config: cfg(value), tracked: WEB_TRACKED, rootNm: true, subNm: ["web"] });
    const { res, lane, out, err } = start(repo);
    assert.equal(res.status, 0, res.stderr);
    assert.deepEqual(err, [NOT_ARRAY]);
    assert.deepEqual(out, [created("e9"), STATIC_ADDED, ROOT_LINKED, ROOT_SHARED, "lane: e9"]);
    assert.ok(!exists(path.join(lane, "web", "node_modules")));
    assert.deepEqual(excludeRules(repo), [".env", "/node_modules", "/.current/**/base-sha"]);
  });
}

test("AC-E291-10: [] links nothing, prints no node_modules line, still upserts the static exclude rules", () => {
  const repo = makeRepo({ config: cfg([]), tracked: WEB_TRACKED, rootNm: true, subNm: ["web"] });
  const { res, lane, out, err } = start(repo);
  assert.equal(res.status, 0, res.stderr);
  assert.deepEqual(out, [created("e9"), STATIC_ADDED, "lane: e9"]);
  assert.deepEqual(err, []);
  assert.ok(!exists(path.join(lane, "node_modules")));
  assert.ok(!exists(path.join(lane, "web", "node_modules")));
  assert.deepEqual(excludeRules(repo), [".env", "/node_modules", "/.current/**/base-sha"]);
});

// Security smoke (reviewer's through-link probe): the root link is created first, so a location under
// node_modules/ is reached through that link and must be refused, never written into primary's install.
test("AC-E291-6 (security smoke): [\".\", \"node_modules/dep\"] never writes into the primary install through the root link", () => {
  const repo = makeRepo({ config: cfg([".", "node_modules/dep"]), rootNm: true });
  const before = fs.readdirSync(path.join(repo, "node_modules", "dep")).sort();
  const { res, err } = start(repo);
  assert.equal(res.status, 0, res.stderr);
  assert.deepEqual(err, [laneDirMissing("node_modules/dep")]);
  assert.deepEqual(fs.readdirSync(path.join(repo, "node_modules", "dep")).sort(), before, "primary install untouched");
});

// ============================================================================
// AC-E291-11 — tools/config.ts parser and loadConfig surface
// ============================================================================

test("AC-E291-11: parseNodeModulesLinks returns the D2 result for the AC-E291-8 list", () => {
  const list = ["/abs", "C:/x", "../up", "a/../b", "./web", "", "a//b", "w*b", "a\\b", 42, null, "web", "web/"];
  assert.deepEqual(parseNodeModulesLinks(list), { links: ["web"], rejected: SPEC_INVALID });
});

test("AC-E291-11: parseNodeModulesLinks normalizes, dedups first-wins in order, and returns null for non-arrays", () => {
  assert.deepEqual(parseNodeModulesLinks([".", "./", "web/", "a/b", "web", "a/b/"]), { links: [".", "web", "a/b"], rejected: [] });
  assert.deepEqual(parseNodeModulesLinks([]), { links: [], rejected: [] });
  assert.deepEqual(parseNodeModulesLinks(["web//"]), { links: [], rejected: ["web//"] }, "only one trailing / is stripped");
  for (const v of ["web", null, undefined, {}, 42, true]) assert.equal(parseNodeModulesLinks(v), null);
  const nested = [["web"], { a: 1 }, true];
  assert.deepEqual(parseNodeModulesLinks(nested), { links: [], rejected: nested });
});

function configWs(value, { omit = false } = {}) {
  const ws = mkTmp("e291-ws-");
  const body = omit ? { schema_version: 2 } : { schema_version: 2, nodeModulesLinks: value };
  writeFile(path.join(ws, ".current", ".config.json"), JSON.stringify(body));
  return ws;
}

test("AC-E291-11: loadConfig surfaces the normalized list only for an array value, never throws, no error", () => {
  const cases = [
    { label: "absent", ws: configWs(undefined, { omit: true }), expect: undefined },
    { label: "string", ws: configWs("web"), expect: undefined },
    { label: "null", ws: configWs(null), expect: undefined },
    { label: "object", ws: configWs({}), expect: undefined },
    { label: "empty array", ws: configWs([]), expect: [] },
    { label: "mixed array", ws: configWs(["web", "web/", "x//", "a/b/", "../up", 7]), expect: ["web", "a/b"] },
    { label: "nested junk", ws: configWs([[1], { a: [] }, null]), expect: [] },
    { label: "oversized", ws: configWs(Array.from({ length: 5000 }, (_, i) => `d${i % 10}`)), expect: Array.from({ length: 10 }, (_, i) => `d${i}`) },
  ];
  for (const c of cases) {
    const cfgPath = path.join(c.ws, ".current", ".config.json");
    const before = fs.readFileSync(cfgPath, "utf-8");
    let conf;
    assert.doesNotThrow(() => {
      conf = loadConfig(c.ws);
    }, c.label);
    if (c.expect === undefined) assert.ok(!("nodeModulesLinks" in conf), `${c.label}: key absent from WorkspaceConfig`);
    else assert.deepEqual(conf.nodeModulesLinks, c.expect, c.label);
    assert.equal(getConfigError(c.ws), null, `${c.label}: well-formed file reports no error`);
    assert.equal(fs.readFileSync(cfgPath, "utf-8"), before, `${c.label}: no migration heal-write (D3)`);
  }
});

test("AC-E291-11 / D3: the config schema version is still 2", () => {
  assert.equal(CURRENT_VERSIONS.config, 2);
});

// ============================================================================
// AC-E291-12 — finish after a subdir link
// ============================================================================

for (const flag of ["--shipped", "--abandoned"]) {
  test(`AC-E291-12: finish ${flag} after a ["web"] start removes the worktree without --force; primary web/node_modules untouched`, () => {
    const repo = makeRepo({ config: cfg(["web"]), tracked: WEB_TRACKED, subNm: ["web"] });
    const { res, lane } = start(repo);
    assert.equal(res.status, 0, res.stderr);
    assert.ok(isLink(path.join(lane, "web", "node_modules")));
    if (flag === "--shipped") {
      writeFile(path.join(lane, "f.txt"), "f\n");
      git(lane, ["add", "f.txt"]);
      git(lane, ["commit", "-qm", "lane work"]);
      git(repo, ["merge", "-q", "--no-ff", "-m", "merge lane", "feat/e9-x"]);
    }
    const fin = runAgc(repo, ["finish", "e9", flag]);
    assert.equal(fin.status, 0, fin.stderr);
    assert.ok(!fs.existsSync(lane), "worktree removed by the plain (never --force) remove");
    assert.equal(fs.readFileSync(path.join(repo, "web", "node_modules", "dep", "index.js"), "utf-8"), "web dep\n");
    assert.deepEqual(fs.readdirSync(path.join(repo, "web", "node_modules")), ["dep"]);
  });
}

// ============================================================================
// AC-E291-13 — docs/config.md, plus the usage text (Copy / Strings e291.usage-start)
// ============================================================================

test("AC-E291-13: docs/config.md has a nodeModulesLinks section stating every required point", () => {
  const doc = fs.readFileSync(path.join(PROJECT_ROOT, "docs", "config.md"), "utf-8");
  const start = doc.search(/^###? .*`nodeModulesLinks`/m);
  assert.notEqual(start, -1, "a nodeModulesLinks heading exists");
  const rest = doc.slice(start);
  const bodyStart = rest.indexOf("\n") + 1;
  const next = rest.slice(bodyStart).search(/^(#{1,3} |---$)/m);
  const section = next === -1 ? rest : rest.slice(0, bodyStart + next);
  const required = [
    [/optional/i, "optional"],
    [/array of repo-relative directory paths/i, "array of repo-relative directories"],
    [/`"\."` means the repo root/, "\".\" = root"],
    [/replaces the root default/i, "replaces the root default"],
    [/`\[\]`.*Nothing/s, "[] links nothing"],
    [/backslash/, "D2: no backslash"],
    [/`\*` `\?` `\[` `\]`/, "D2: no wildcards"],
    [/control character/, "D2: no control character"],
    [/Windows drive prefix/, "D2: no drive prefix"],
    [/`\.\/web`/, "D2: ./web invalid"],
    [/skipped with a warning/i, "invalid entries skipped with a warning"],
    [/primary checkout's `<repo root>\/\.current\/\.config\.json`/, "read from the primary checkout config"],
    [/agc feature start/, "read at feature start"],
    [/schema version change/i, "no schema version change"],
    [/`\/<dir>\/node_modules`/, "per-directory exclude rule"],
  ];
  for (const [re, what] of required) assert.match(section, re, `docs/config.md nodeModulesLinks section: ${what}`);
});

test("Copy e291.usage-start: the feature usage names the nodeModulesLinks key", () => {
  const r = spawnSync(process.execPath, [AGC_INIT, "feature"], { encoding: "utf-8" });
  const usage = r.stdout + r.stderr;
  assert.ok(
    usage.includes(
      "          (default <parent>/<repo>-lanes/<ticket-id>), node_modules\n" +
        "          symlinked to primary's (root, or the directories listed in\n" +
        "          .current/.config.json nodeModulesLinks), .env byte-copied.\n"
    ),
    usage
  );
});
