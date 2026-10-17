// Coded by @qa-engineer
// Tests (T-E296-05) for specs/e296-manifest-tier-cut-approval.md AC1-AC12, AC14, AC15: the cut-approval
// manifest tier (content literals, config key), the optional 9th `approval` Lanes column, and the
// `check --cut` runner with its whitelist grammar. Each AC is pinned by its spec `proof:` pattern.
// Fixtures are spec files written to os.tmpdir(). The manifest under test is MANIFEST_TEXT below: a frozen,
// in-test copy of the wave-3 manifest (lane e296's 擁有 / 禁止 cells verbatim, a fixed Decisions table), NOT
// the committed specs/fanout-post-v4-w3.md — that file is a living document integrators keep appending to
// (Decisions rows, close-out sections, lane bookkeeping), so asserting on its content made AC11 rot (T-E296-08).
// The committed manifests are read only where the AC is about them as files: AC9's validate sweep.
// Nothing here writes into the repo and no test runs git or diffs against a fixed base sha (E323).
// The goldens, ceilings and re-pins (AC13, AC14 re-pins) live in their own existing test files.

import { test } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), "utf8");
const FANOUT = path.join(ROOT, "scripts", "fanout.mjs");
const OWN_SPEC = path.join("specs", "e296-manifest-tier-cut-approval.md");
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), "e296-qa-"));
let seq = 0;

/** grep -c: number of lines containing `needle` (string) or matching `re`. */
const grepC = (text, needle) =>
  text.split("\n").filter((l) => (needle instanceof RegExp ? needle.test(l) : l.includes(needle))).length;
/** awk '/start/,/end/' — first range, end line included. */
function awkRange(text, start, end) {
  const out = [];
  let on = false;
  for (const l of text.split("\n")) {
    if (!on && start.test(l)) on = true;
    if (on) {
      out.push(l);
      if (end.test(l) && out.length > 1) break;
    }
  }
  return out.join("\n");
}

function cli(args) {
  const r = spawnSync(process.execPath, [FANOUT, ...args], { cwd: ROOT, encoding: "utf8" });
  return { status: r.status, stdout: r.stdout, stderr: r.stderr };
}
function tmpFile(name, text) {
  const p = path.join(TMP, `${seq++}-${name}`);
  fs.writeFileSync(p, text);
  return p;
}
/**
 * Frozen wave-3 manifest (8-column Lanes table, two lanes). Lane e296's 擁有 / 禁止 cells are copied verbatim
 * from specs/fanout-post-v4-w3.md as it stood at wave close (they drive every containment case below);
 * 範圍切線 and the whole e308 row are shortened, since no assertion reads them. The Decisions table is fixed
 * by design: 3 人類 rows whose latest date (2026-10-15) is neither the last row nor the table-wide maximum —
 * the later 整合者 row (2026-10-16) must not count — so the fact line pins count AND max-of-人類-dates.
 */
const MANIFEST_TEXT = [
  "# Fan-out: post-v4 佇列第 3 波（frozen test copy）",
  "base: db542da    integration branch: integ/post-v4-w3",
  "mailbox: ../agent-governance-mcp-lanes/_mailbox",
  "",
  "## Lanes",
  "| lane | 票 | branch | worktree | 擁有 | 禁止 | 範圍切線 | 相依 |",
  "|---|---|---|---|---|---|---|---|",
  "| e296 | E296、E309 | feat/e296-manifest-tier-cut-approval | ../agent-governance-mcp-lanes/e296 | " +
    "`content/const-08-chain-31-mid.md`、`content/coord-03-core-fallback.md`、`content/skill-pm.md`、`content/skill-integrator.md`、" +
    "`content/constitution-rationale.md`（只在需要搬理由時）、`docs/lane-protocol.md`、`docs/config.md`、" +
    "`tools/config.ts` 與其 `dist/tools/config.*`、`tools/fanout-manifest.ts` 與其 `dist/tools/fanout-manifest.*`、`scripts/fanout.mjs`、" +
    "`test/fixtures/compose-golden/**`、`test/context-budget.test.mjs`、`test/e5-intake-tiering.test.mjs`、`test/cut-approval-gate.test.mjs`、" +
    "`test/e177a-manifest.test.mjs`、`test/e177a-check-cli.test.mjs`、`test/e178b-fanout-unmatched.test.mjs`、`test/e235b-relative-worktree.test.mjs`、" +
    "`test/e248-relative-mailbox-header.test.mjs`、`test/e178a-integrator-role.test.mjs`、`test/e295-hop-cap-and-sop-halves.test.mjs`、" +
    "`test/render-structure.test.mjs`、`test/e297-main-protected-sop.test.mjs`（只限 `:104` integrator `recommended_model` re-pin）、" +
    "`test/config-cache.test.mjs`、`test/config-versioning.test.mjs`、`test/e31-config-nonfatal.test.mjs`、" +
    "`test/agc-adapters.test.mjs`（只在 adapter 文字提到 auto-tier 時）、`test/p0-onboarding-lite-default.test.mjs`（同上）、" +
    "`test/e296-*.test.mjs`、`specs/e296-*`、`qa_reports/*E296*`、`qa_reports/*E309*`、`review_reports/*E296*`、`review_reports/*E309*`、`.current/e296/**`" +
    " | " +
    "其他 `content/**`、其他 `tools/**`（特別是 `tools/registry.ts`、`tools/handoff-parse.ts`、`tools/handoff-orchestrator.ts`、" +
    "`tools/skill-frontmatter.ts`、`tools/telemetry.ts`）、`gates/**`、其他 `scripts/**`、其他 `test/**`（特別是 `test/dispatch-pins.test.mjs`、" +
    "`test/error-code-contract.test.mjs`、`test/telemetry.test.mjs`）、其他 `dist/**`、其他 `specs/**`、其他 `docs/**`、共同禁止的全部項目" +
    " | 做：E296 + E309（frozen copy，範圍切線節錄）。　不做：其他 lane 的檔案。 | 無 |",
  "| e308 | E308、E303 | feat/e308-tier-enum-and-zod-telemetry | ../agent-governance-mcp-lanes/e308 | " +
    "`tools/registry.ts` 與其 `dist/tools/registry.*`、`.current/e308/**` | `content/**`（全部）、共同禁止的全部項目 | " +
    "做：E308 + E303（frozen copy，節錄）。　不做：`content/**`。 | 無 |",
  "",
  "## Dispatch pins",
  "- e296：`sr-engineer=opus`。",
  "- e308：`sr-engineer=opus`。",
  "",
  "## Decisions",
  "| 日期 | 裁決者 | 內容 | 出處 |",
  "|---|---|---|---|",
  "| 2026-10-13 | 人類 | 開波 | 整合者 session |",
  "| 2026-10-15 | 人類 | 核准本清單 | 整合者 session |",
  "| 2026-10-16 | 整合者 | 晚於所有人類列的整合者列（不得算入 latest） | 本檔 |",
  "| 2026-10-14 | 人類 | 晚於最新日期出現的較早人類列（latest 取最大值，不取最後一列） | lane e296 session |",
  "",
].join("\n");
const MANIFEST = tmpFile("w3-frozen.md", MANIFEST_TEXT);

/** Run `check --cut` on spec text against a manifest (default: the frozen wave-3 copy, lane e296). */
function runCut(specText, { manifest = MANIFEST, lane = "e296" } = {}) {
  return cli(["check", "--cut", manifest, lane, tmpFile("spec.md", specText)]);
}
const firstErr = (r) => r.stderr.split("\n")[0];
const errLines = (r) => r.stderr.split("\n").filter((l) => l.startsWith("fanout: error:"));
const outLines = (r) => r.stdout.split("\n").filter((l) => l.startsWith("OUT "));

const BT = "`";
const q = (s) => BT + s + BT;
const HDR = "| id | desc | depends_on | est. files | touches | design-link |";
const SEP = "|---|---|---|---|---|---|";
const row = (id, touches) => `| ${id} | x | none | 1 | ${touches} | — |`;
const R2 = row("T-X-02", q("tools/registry.ts"));
const mk = (rows, { pre = "", post = "", sep = SEP, hdr = HDR } = {}) =>
  `# x\n\n## Cut\n\n${pre}${hdr}\n${sep}\n${rows.join("\n")}\n${post}`;
const oneRow = (touches) => mk([row("T-X-01", touches)]);
const C = q("tools/config.ts");

// ---------------------------------------------------------------------------
// AC1-AC6, AC14 — content literals (the spec proofs, as in-process greps)
// ---------------------------------------------------------------------------

const AUDIT = "cut-approved: manifest-tier (<manifest path>, Decisions <date>)";

test("AC1: const-08 §3.1 auto-tier bullet carries the manifest tier, audit line and the existing arming key", () => {
  // WHY: the audit line is the only trace of a writer-attested approval; it must be exactly one grep-able literal.
  const t = read("content/const-08-chain-31-mid.md");
  assert.equal(grepC(t, AUDIT), 1);
  assert.ok(grepC(t, "cutApprovalAutoTier") >= 2);
  for (const lit of ["check --cut", "`approval`", "人類", "close", "cutApprovalAutoTier.manifest"]) {
    assert.ok(t.includes(lit), `const-08 must name ${lit}`);
  }
});

test("AC2: coord-03 auto-tier writer action carries the manifest-tier writer action", () => {
  const t = read("content/coord-03-core-fallback.md");
  assert.equal(grepC(t, AUDIT), 1);
  assert.ok(grepC(t, "check --cut") >= 1);
  assert.ok(t.includes("manifest-tier: no option choice, no needs-human-ruling item"));
});

test("AC3: skill-pm has the Cut spec section, the attestation row and both attestation literals", () => {
  const t = read("content/skill-pm.md");
  assert.equal(grepC(t, "manifest-tier: no option choice, no needs-human-ruling item"), 1);
  assert.equal(grepC(t, /^- \*\*Cut\*\*/), 1);
  assert.ok(t.includes("Manifest-Tier Self-Attestation"));
  assert.ok(t.includes("manifest-tier: not eligible — <reason>"));
  assert.ok(t.includes("check --cut specs/fanout-<id>.md <lane> specs/<feature>.md"));
});

test("AC4: lane-protocol §5-2 names check --cut and keeps rule 1 and the §3 no-push line", () => {
  const t = read("docs/lane-protocol.md");
  assert.ok(grepC(t, "check --cut") >= 1);
  assert.equal(grepC(t, "信箱**永遠不傳核准**"), 1);
  assert.equal(grepC(t, "不要 push、不要 merge、不要發版、不要刪 worktree"), 1);
});

test("AC5: skill-integrator Stage 2 names the approval column", () => {
  const t = read("content/skill-integrator.md");
  const stage2 = awkRange(t, /^## Stage 2/, /^## Stage 3/);
  assert.ok(grepC(stage2, "`approval`") >= 1);
  assert.ok(stage2.includes("human"));
});

test("AC6: Stage 6-4 BEHIND remedy is CI-first; the e295-pinned sentence and the old wording behave as specified", () => {
  // WHY: E298's CI-first rule must hold for every layer; test/e295-hop-cap-and-sop-halves.test.mjs (run in the
  // full suite, untouched) pins the 5a / 5c strings that this one-sentence edit must not move.
  const t = read("content/skill-integrator.md");
  const step4 = awkRange(t, /^4\. Wait for the merge/, /^5\. `git switch main`/);
  assert.equal(grepC(step4, "verify-release.mjs --ci-check --sha <HEAD>"), 1);
  assert.equal(grepC(step4, "the full suite, and a push"), 0);
  assert.equal(grepC(t, "cannot reach `main`"), 1);
  const i = (s) => step4.indexOf(s);
  assert.ok(i("merge-invariants.mjs") >= 0 && i("merge-invariants.mjs") < i("verify-release.mjs --ci-check"), "invariants run before the CI check");
  assert.ok(step4.includes("CI fallback"), "the local full suite is only under the CI fallback");
});

test("AC14: integrator role tier is opus with no fable fallback clause", () => {
  const t = read("content/skill-integrator.md");
  assert.equal(t.split("\n")[1], "recommended_model: opus");
  assert.equal(grepC(t, "fable, with opus as the fallback"), 0);
});

// ---------------------------------------------------------------------------
// AC7 / AC8 — config key
// ---------------------------------------------------------------------------

test("AC7: cutApprovalAutoTier.manifest is a strict boolean (true,'true',1,{},absent -> true,false,false,false,false)", async () => {
  // WHY: a truthy-but-not-true value must never arm an approval bypass; fail closed.
  const { loadConfig, CUT_APPROVAL_AUTO_TIER_DEFAULTS } = await import("../dist/tools/config.js");
  const got = [];
  for (const v of [true, "true", 1, {}, undefined]) {
    const ws = fs.mkdtempSync(path.join(TMP, "ws-"));
    fs.mkdirSync(path.join(ws, ".current"));
    fs.writeFileSync(path.join(ws, ".current", ".config.json"), JSON.stringify({ cutApprovalAutoTier: v === undefined ? {} : { manifest: v } }));
    got.push(loadConfig(ws).cutApprovalAutoTier.manifest);
  }
  assert.deepEqual(got, [true, false, false, false, false]);
  assert.equal(CUT_APPROVAL_AUTO_TIER_DEFAULTS.manifest, false);
});

test("AC7: a present key without `manifest` still arms the threshold tier exactly as before", async () => {
  const { loadConfig } = await import("../dist/tools/config.js");
  const ws = fs.mkdtempSync(path.join(TMP, "ws-"));
  fs.mkdirSync(path.join(ws, ".current"));
  fs.writeFileSync(path.join(ws, ".current", ".config.json"), JSON.stringify({ cutApprovalAutoTier: { maxFiles: 5 } }));
  assert.deepEqual(loadConfig(ws).cutApprovalAutoTier, { maxFiles: 5, maxPriority: "P3", allowSchemaChange: false, allowDesignArmed: false, manifest: false });
});

test("AC8: docs/config.md has the manifest field row and the Semantics note", () => {
  const t = read("docs/config.md");
  assert.equal(grepC(t, /^\| `manifest` \| `false` \|/), 1);
  assert.ok(t.includes("maxFiles") && /manifest.*replaces|replaces.*maxFiles/s.test(t));
});

// ---------------------------------------------------------------------------
// AC9 / AC10 / AC12 — approval column, render, usage
// ---------------------------------------------------------------------------

test("AC9: every manifest's validate exit is unchanged from base (only wave5.1 and wave6 exit 2)", () => {
  const bad = fs.readdirSync(path.join(ROOT, "specs")).filter((f) => /^fanout-.*\.md$/.test(f))
    .map((f) => [f, cli(["validate", path.join("specs", f)]).status]).filter(([, s]) => s !== 0);
  assert.deepEqual(bad, [["fanout-wave5.1.md", 2], ["fanout-wave6.md", 2]]);
});

/** The frozen manifest with a 9th `approval` column added to the Lanes table (value `v` on every lane row). */
function nineCol(v, { header = "approval" } = {}) {
  const lines = MANIFEST_TEXT.split("\n");
  const start = lines.findIndex((l) => l.startsWith("## Lanes"));
  for (let i = start + 1; i < lines.length && lines[i].startsWith("|"); i++) {
    const k = i - start;
    lines[i] += k === 1 ? ` ${header} |` : k === 2 ? "---|" : ` ${v} |`;
  }
  return lines.join("\n");
}

test("AC9: a 9-column Lanes table with header `approval` is dispatchable; human / — / empty accepted", () => {
  for (const v of ["human", "—", ""]) {
    const m = tmpFile("m9.md", nineCol(v));
    const r = cli(["validate", m]);
    assert.equal(r.status, 0, `approval=${JSON.stringify(v)}: ${r.stderr}`);
  }
});

test("AC9: an approval value outside {human, —, empty} is APPROVAL_VALUE_UNKNOWN, a wrong 9th header is not dispatchable", async () => {
  const bad = cli(["validate", tmpFile("m9bad.md", nineCol("auto"))]);
  assert.equal(bad.status, 2);
  assert.match(bad.stderr, /APPROVAL_VALUE_UNKNOWN/);
  // a 9-column header whose 9th cell is not exactly `approval` is not dispatchable: the table stays provisional
  const hdrFile = tmpFile("m9hdr.md", nineCol("human", { header: "approvals" }));
  assert.match(cli(["validate", hdrFile]).stdout, /0 dispatchable lane\(s\), 2 provisional/);
  const prov = cli(["render", hdrFile, "e296", "--summary", "x", "--reading", "y"]);
  assert.equal(prov.status, 2);
  assert.match(prov.stderr, /LANE_PROVISIONAL/);
  const { parseManifest } = await import("../dist/tools/fanout-manifest.js");
  const m = parseManifest(nineCol("human"));
  const lane = m.dispatchable.find((l) => l.lane === "e296");
  assert.equal(lane.approval, "human");
  const m8 = parseManifest(MANIFEST_TEXT).dispatchable.find((l) => l.lane === "e296");
  assert.equal(m8.approval, undefined, "an 8-column row has no approval");
});

test("AC9: the 8-column header is still accepted exactly and a short row is still an error", () => {
  assert.equal(cli(["validate", MANIFEST]).status, 0);
  const lines = MANIFEST_TEXT.split("\n");
  const i = lines.findIndex((l) => l.startsWith("| e296 |"));
  lines[i] = lines[i].replace(/\|[^|]*\|\s*$/, "|"); // drop the last cell: 7 cells under an 8-col header
  const r = cli(["validate", tmpFile("short.md", lines.join("\n"))]);
  assert.equal(r.status, 2, r.stdout + r.stderr);
});

test("AC9: LANE_PROVISIONAL says '8- or 9-column'", () => {
  const w7 = path.join("test", "fixtures", "e177a", "fanout-wave7.md");
  const r = cli(["render", w7, "e130", "--summary", "S", "--reading", "R"]);
  assert.equal(r.status, 2);
  assert.match(r.stderr, /LANE_PROVISIONAL: .*8- or 9-column/);
});

test("AC10: render of the frozen 8-column manifest carries the lane's own fields", async () => {
  // E323: replaces the former HEAD-vs-fixed-base-code render comparison, which rotted under legitimate later
  // fanout edits. This asserts stable structure of the render of the frozen in-test manifest instead.
  const { parseManifest } = await import("../dist/tools/fanout-manifest.js");
  const lane = parseManifest(MANIFEST_TEXT).dispatchable.find((l) => l.lane === "e296");
  assert.ok(lane, "frozen manifest has dispatchable lane e296");
  const BASE = "abc1234";
  const r = cli(["render", MANIFEST, "e296", "--summary", "SUMMARY-MARK", "--reading", "READING-MARK", "--base", BASE, "--primary", ROOT, "--mailbox-root", TMP]);
  assert.equal(r.status, 0, r.stderr);
  assert.ok(r.stdout.length > 0, "render produced output");
  for (const [what, v] of [["branch", lane.branch], ["擁有 cell", lane.owned], ["禁止 cell", lane.forbidden], ["--summary", "SUMMARY-MARK"], ["--reading", "READING-MARK"], ["--base", BASE], ["mailbox path", path.join(TMP, "e296")]]) {
    assert.ok(v && r.stdout.includes(v), `render must contain the lane's ${what}: ${JSON.stringify(v)}`);
  }
  // the lane cells legitimately contain `cut-approval` in file names; only a bare header word would be the column
  assert.ok(!/(?<![\w-])approval(?![\w-])/.test(r.stdout), "render must not carry the approval column header");
});

test("AC10: render ignores the approval column (9-column render == 8-column render)", () => {
  const args = ["--summary", "x", "--reading", "y", "--base", "abc1234", "--primary", ROOT, "--mailbox-root", TMP];
  const eight = cli(["render", MANIFEST, "e296", ...args]).stdout;
  assert.ok(eight.length > 0);
  for (const v of ["human", "—"]) {
    assert.equal(cli(["render", tmpFile("m9r.md", nineCol(v)), "e296", ...args]).stdout, eight);
  }
});

test("AC12: usage has the fourth `check --cut` line; the wrapper header lists it; check <manifest> <lane> is unchanged", () => {
  const r = cli([]);
  assert.equal(r.status, 2);
  assert.equal(grepC(r.stderr, "check --cut <manifest> <lane> <spec>"), 1);
  assert.equal(r.stderr.split("\n").filter((l) => l.startsWith("       node scripts/fanout.mjs")).length, 3, "usage keeps its other three lines");
  assert.ok(read("scripts/fanout.mjs").includes("check --cut <manifest> <lane> <spec>"));
  // unchanged: plain check on an unknown lane and on a repo lacking the branch
  const nolane = cli(["check", MANIFEST, "nolane"]);
  assert.equal(nolane.status, 2);
  assert.match(nolane.stderr, /LANE_NOT_FOUND/);
  const emptyRepo = fs.mkdtempSync(path.join(TMP, "repo-"));
  const g = (...a) => spawnSync("git", ["-c", "init.defaultBranch=main", "-c", "user.email=a@b.c", "-c", "user.name=t", ...a], { cwd: emptyRepo });
  g("init", "-q");
  g("commit", "-q", "--allow-empty", "-m", "b");
  const noref = cli(["check", MANIFEST, "e296", "--repo", emptyRepo]);
  assert.equal(noref.status, 2);
  assert.match(noref.stderr, /REF_NOT_FOUND/);
  const bad = cli(["check", "--cut", MANIFEST]);
  assert.equal(bad.status, 2, "--cut with too few operands is a usage error");
  assert.match(bad.stderr, /USAGE/);
});

// ---------------------------------------------------------------------------
// AC11 — check --cut: containment, facts, exit codes
// ---------------------------------------------------------------------------

test("AC11: in-bounds cut exits 0 and prints the approval / human-decisions fact lines", () => {
  const r = runCut(oneRow(C));
  assert.equal(r.status, 0, r.stderr);
  assert.equal(outLines(r).length, 0);
  assert.match(r.stdout, /^approval: —$/m);
  assert.match(r.stdout, /^human-decisions: 3 row\(s\); latest 2026-10-15$/m);
  assert.match(r.stdout, /fanout check --cut: e296 — 1 ticket\(s\), 1 token\(s\), 0 out of bounds/);
});

test("AC11: an out-of-bounds token prints one OUT line with the ticket id and the matching 禁止 token, exit 1", () => {
  const r = runCut(oneRow(q("tools/registry.ts")));
  assert.equal(r.status, 1);
  assert.deepEqual(outLines(r), ["OUT  `tools/registry.ts`  (T-X-01)  (禁止: tools/**)"]);
  assert.equal(r.stderr, "");
});

test("AC11: a glob byte-identical to an 擁有 token is in bounds; every other glob / prefix form is OUT", () => {
  assert.equal(runCut(oneRow(q("test/fixtures/compose-golden/**"))).status, 0);
  for (const g of ["test/**", "tools/*", "tools/", "tools/{config,registry}.ts", "tools/{config}.ts", "{tools/config.ts,tools/registry.ts}", "tools/config.ts,tools/*"]) {
    const r = runCut(oneRow(C + "、" + q(g)));
    assert.equal(r.status, 1, `${g}: ${r.stdout}${r.stderr}`);
    assert.ok(outLines(r).some((l) => l.startsWith(`OUT  ${q(g)}  (T-X-01)`)), g);
  }
});

test("AC11: out-of-set paths (case, dot-dirs, other roots, lane-lookalike bookkeeping) are OUT; lane bookkeeping is in bounds", () => {
  for (const p of ["Tools/config.ts", ".CURRENT/e296/x", ".current/e296x/y.ts", "specs/e296-a/b.md", ".github/workflows/ci.yml", ".registry", "index.ts", "README.md"]) {
    const r = runCut(oneRow(C + "、" + q(p)));
    assert.equal(r.status, 1, `${p}: ${r.stdout}${r.stderr}`);
    assert.ok(outLines(r).some((l) => l.startsWith(`OUT  ${q(p)}  (T-X-01)`)), p);
  }
  for (const p of [".current/e296/.../x", "qa_reports/foo/e296-x.md", "specs/e296-*", "qa_reports/*E296*"]) {
    const r = runCut(oneRow(C + "、" + q(p)));
    assert.equal(r.status, 0, `${p}: ${r.stdout}${r.stderr}`);
  }
});

test("AC11: `—` alone, and 、 / , / whitespace joined pairs, are exit 0; two valid rows with trailing blank lines too", () => {
  assert.equal(runCut(oneRow("—")).status, 0);
  const D = q("docs/config.md");
  for (const sep of ["、", ", ", " "]) assert.equal(runCut(oneRow(C + sep + D)).status, 0, JSON.stringify(sep));
  const two = mk([row("T-X-01", C), row("T-X-02", D)], { post: "\n\n" });
  const r = runCut(two);
  assert.equal(r.status, 0);
  assert.match(r.stdout, /2 ticket\(s\), 2 token\(s\), 0 out of bounds/);
});

test("AC11: approval: human fails with APPROVAL_HUMAN even when every token is in bounds (exit 1)", () => {
  const m = tmpFile("m9h.md", nineCol("human"));
  const r = runCut(oneRow(C), { manifest: m });
  assert.equal(r.status, 1);
  assert.match(r.stdout, /^approval: human$/m);
  assert.match(r.stderr + r.stdout, /APPROVAL_HUMAN/);
  const ok = runCut(oneRow(C), { manifest: tmpFile("m9d.md", nineCol("—")) });
  assert.equal(ok.status, 0);
  assert.match(ok.stdout, /^approval: —$/m);
});

test("AC11: no 人類 Decisions row fails with DECISIONS_HUMAN_ROW_ABSENT (exit 1)", () => {
  const m = tmpFile("mnohuman.md", MANIFEST_TEXT.replace(/\| 人類 \|/g, "| 整合者 |"));
  const r = runCut(oneRow(C), { manifest: m });
  assert.equal(r.status, 1);
  assert.match(r.stderr + r.stdout, /DECISIONS_HUMAN_ROW_ABSENT/);
  assert.match(r.stdout, /^human-decisions: 0 row\(s\); latest —$/m);
});

test("AC11: a manifest-side format error (Decisions header) is exit 2, as for check", () => {
  const m = tmpFile("mbaddec.md", MANIFEST_TEXT.replace("| 日期 | 裁決者 |", "| date | 裁決者 |"));
  const r = runCut(oneRow(C), { manifest: m });
  assert.equal(r.status, 2);
  assert.match(r.stderr, /DECISIONS_HEADER_DIFFERS/);
  assert.equal(cli(["check", "--cut", MANIFEST, "nolane", tmpFile("s.md", oneRow(C))]).status, 2, "unknown lane is exit 2");
});

test("AC11: spec-side format errors are exit 2 with their own code", () => {
  const cases = [
    ["CUT_SECTION_ABSENT", "# x\n\n## Cut Decisions\n\nprose\n"],
    ["CUT_TABLE_ABSENT", "# x\n\n## Cut\n\n"],
    ["CUT_HEADER_DIFFERS", mk([row("T-X-01", C)], { hdr: "| id | desc | depends_on | est. files | touches | link |" })],
    ["CUT_SECTION_DUPLICATE", oneRow(C) + "\n## Cut\n\n" + HDR + "\n" + SEP + "\n" + row("T-X-02", C) + "\n"],
    ["CUT_ROW_MALFORMED", mk(["| T-X-01 | x | none | 1 | " + C + " |"])],
    ["CUT_TOUCHES_EMPTY", oneRow("")],
    ["CUT_TOUCHES_UNQUOTED_PATH", oneRow("tools/config.ts")],
    ["CUT_TOUCHES_MALFORMED_PATH", oneRow(q("Dockerfile"))],
  ];
  for (const [code, text] of cases) {
    const r = runCut(text);
    assert.equal(r.status, 2, `${code}: ${r.stdout}${r.stderr}`);
    assert.ok(firstErr(r).startsWith(`fanout: error: ${code}:`), `${code}: ${firstErr(r)}`);
  }
  const unreadable = cli(["check", "--cut", MANIFEST, "e296", path.join(TMP, "does-not-exist.md")]);
  assert.equal(unreadable.status, 2);
  assert.match(unreadable.stderr, /^fanout: error: SPEC_UNREADABLE: /);
});

test("AC11: check --cut never writes (the spec file and manifest are byte-identical afterwards) and runs no git", () => {
  const p = tmpFile("ro.md", oneRow(C));
  const before = [fs.readFileSync(p, "utf8"), fs.readFileSync(MANIFEST, "utf8")];
  cli(["check", "--cut", MANIFEST, "e296", p]);
  assert.deepEqual([fs.readFileSync(p, "utf8"), fs.readFileSync(MANIFEST, "utf8")], before);
});

// ---------------------------------------------------------------------------
// AC15 — whitelist grammar: every enumerated input, exit code and code
// ---------------------------------------------------------------------------

test("AC15 C4: any text outside backtick spans in touches is exit 2 CUT_TOUCHES_UNQUOTED_PATH", () => {
  // WHY: rounds 1-3 failed open by searching free Markdown for paths; leftover text is refused, never guessed at.
  const after = [
    "tools/registry.ts:12", "'tools/registry.ts'", '"tools/registry.ts"', "*tools/registry.ts*", "**tools/registry.ts**",
    "<code>tools/registry.ts</code>", "<kbd>tools/registry.ts</kbd>", "[tools/registry.ts](x)", "「tools/registry.ts」",
    "tools/registry.ts。", "~tools/registry.ts~", "index.ts", "tools／registry.ts", "tools/registry.ts.", "and tools/registry.ts",
  ];
  for (const x of after) {
    const r = runCut(oneRow(C + " " + x));
    assert.equal(r.status, 2, x);
    assert.ok(firstErr(r).startsWith("fanout: error: CUT_TOUCHES_UNQUOTED_PATH:"), `${x}: ${firstErr(r)}`);
    assert.equal(errLines(r).length, 1, `${x}: one error line`);
  }
  const dash = runCut(oneRow("— " + C));
  assert.equal(dash.status, 2);
  assert.ok(firstErr(dash).startsWith("fanout: error: CUT_TOUCHES_UNQUOTED_PATH:"));
});

test("AC15 C5: any line outside the one table is exit 2 CUT_ROW_MALFORMED naming its line", () => {
  const r1 = row("T-X-01", C);
  const cases = {
    "leading space": mk([r1, " " + R2]),
    "no leading pipe": mk([r1, R2.slice(1)]),
    "blockquote": mk([r1, "> " + R2]),
    "after blank line": mk([r1, "", R2]),
    "second table after prose": mk([r1, "", "More tickets:", "", HDR, SEP, R2]),
    "second table under ### Extra": mk([r1, "", "### Extra", "", HDR, SEP, R2]),
    "prose after valid table": mk([r1], { post: "\nNotes: none.\n" }),
    "prose before valid table": mk([r1], { pre: "Intro prose.\n\n" }),
    "missing separator row": mk([r1], { sep: R2 }),
    "separator with 5 cells": mk([r1], { sep: "|---|---|---|---|---|" }),
    "prose-only section": "# x\n\n## Cut\n\nNothing to cut.\n",
  };
  for (const [name, text] of Object.entries(cases)) {
    const r = runCut(text);
    assert.equal(r.status, 2, name);
    assert.ok(firstErr(r).startsWith("fanout: error: CUT_ROW_MALFORMED:"), `${name}: ${firstErr(r)}`);
    assert.match(firstErr(r), /line \d+/, `${name}: names a line number`);
  }
  const noRows = runCut(mk([]));
  assert.equal(noRows.status, 2);
  assert.ok(firstErr(noRows).startsWith("fanout: error: CUT_TABLE_ABSENT:"), "header + separator, no ticket row");
});

test("AC15 R1: a span that is not a path token is exit 2 CUT_TOUCHES_MALFORMED_PATH", () => {
  for (const span of ["Dockerfile", "LICENSE", ".", "..", "tools∕registry", "tools／registry．ts"]) {
    const r = runCut(oneRow(C + "、" + q(span)));
    assert.equal(r.status, 2, span);
    assert.ok(firstErr(r).startsWith("fanout: error: CUT_TOUCHES_MALFORMED_PATH:"), `${span}: ${firstErr(r)}`);
  }
});

test("AC15 rounds 1-3 regression: malformed spans (:line, #anchor, ./.. segments, joined spans, unicode, control chars) are exit 2", () => {
  const spans = [
    "tools/registry.ts:71", "gates/registry.ts#L10",
    ".current/e296/../../index.ts", "test/fixtures/compose-golden/../../../tools/registry.ts",
    ".current/e296/handoff.md,tools/registry.ts", "review_reports/review_T-E296-01.md,index.ts",
    "test/fixtures/compose-golden/a.json,tools/registry.ts",
    "tools/config.ts;tools/registry.ts", "tools/config.ts tools/registry.ts", "tools/config.ts\\|tools/registry.ts",
    ".current/e296/x/..", ".current/e296/.", "qa_reports/../tools/e296.ts", "specs/e296-x/../../tools/registry.ts",
    "./tools/registry.ts", "-tools/registry.ts", ":tools/registry.ts", "tools\\registry.ts",
    "tools/\tregistry.ts", "tools/​registry.ts", "tools/registry․ts", "tools/ｒegistry.ts",
    // documented behaviour changes
    "./tools/config.ts", "tools//config.ts",
  ];
  for (const span of spans) {
    const r = runCut(oneRow(C + "、" + q(span)));
    assert.equal(r.status, 2, JSON.stringify(span));
    assert.ok(firstErr(r).startsWith("fanout: error: CUT_TOUCHES_MALFORMED_PATH:"), `${JSON.stringify(span)}: ${firstErr(r)}`);
  }
});

test("AC15 edges: empty touches, prose-only cell (UNQUOTED + EMPTY), en dash, unbalanced backtick, full-width comma", () => {
  const empty = runCut(oneRow(""));
  assert.equal(empty.status, 2);
  assert.ok(firstErr(empty).startsWith("fanout: error: CUT_TOUCHES_EMPTY:"));
  for (const cell of ["see desc", "–"]) {
    const r = runCut(oneRow(cell));
    assert.equal(r.status, 2, cell);
    const codes = errLines(r).map((l) => l.split(":")[2].trim());
    assert.deepEqual(codes, ["CUT_TOUCHES_UNQUOTED_PATH", "CUT_TOUCHES_EMPTY"], `${cell}: exactly one UNQUOTED per cell, then EMPTY`);
  }
  for (const cell of [BT + "tools/registry.ts", C + "，" + q("docs/config.md")]) {
    const r = runCut(oneRow(cell));
    assert.equal(r.status, 2, cell);
    assert.ok(firstErr(r).startsWith("fanout: error: CUT_TOUCHES_UNQUOTED_PATH:"), `${cell}: ${firstErr(r)}`);
    assert.equal(errLines(r).filter((l) => l.includes("UNQUOTED")).length, 1, "one UNQUOTED per cell");
  }
});

test("AC15 bare CR: a carriage return not followed by a line feed anywhere in the spec is exit 2 CUT_ROW_MALFORMED; CRLF parses", () => {
  // WHY: Markdown renders a bare CR as a line break, so a CR can split or hide a row the LF-based parser never sees.
  const base = mk([row("T-X-01", C), R2]);
  const lf = base.replace(/\n/g, "\r\n");
  const bare = [
    base.replace("| T-X-02", "\r| T-X-02"),                          // CR inside the table, between rows
    base.replace("## Cut\n\n", "## Cut\r\r"),                             // CR in the heading line
    base.replace("# x\n\n", "# x\r\r"),                                   // CR in the title line
    "\r" + base,                                                      // CR at start of file
    base + "\r",                                                      // trailing CR, LF file
    lf + "\r",                                                        // trailing CR, CRLF file
    lf.replace(/\r\n/g, "\r\r\n"),                                    // \r\r\n endings
    base.replace(C, BT + "tools/\rconfig.ts" + BT),                   // CR inside a backtick span
    base + "\n## Notes\n\nx\ry\n",                                    // CR in a far section
    "# x\n\n## Notes\n\nx\r## Cut\r\r" + HDR + "\r" + SEP + "\r" + R2 + "\n", // forged heading hidden under another section
  ];
  bare.forEach((text, i) => {
    const r = runCut(text);
    assert.equal(r.status, 2, `bare-CR case ${i}`);
    assert.ok(firstErr(r).startsWith("fanout: error: CUT_ROW_MALFORMED:"), `bare-CR case ${i}: ${firstErr(r)}`);
  });
  const crlfOk = runCut(mk([row("T-X-01", C)]).replace(/\n/g, "\r\n"));
  assert.equal(crlfOk.status, 0, crlfOk.stderr);
  const crlfOob = runCut(mk([row("T-X-01", q("tools/registry.ts"))]).replace(/\n/g, "\r\n"));
  assert.equal(crlfOob.status, 1);
  const mixed = runCut(mk([row("T-X-01", C), R2.replace("tools/registry.ts", "docs/config.md")]).replace("\n| T-X-01", "\r\n| T-X-01"));
  assert.equal(mixed.status, 0, "mixed LF / CRLF endings parse");
});

test("AC15 own spec: no exit-2 error, only the known manifest-version gap may be OUT; CRLF copy == LF copy", () => {
  // WHY: the lane's own manifest copy lacked test/e297-main-protected-sop.test.mjs in the e296 owned set (known
  // manifest-version gap), so the own spec is pinned as "no format error and nothing OUT except that token".
  // The frozen MANIFEST_TEXT carries that token, so against it nothing is OUT; the tolerance is kept as written.
  const own = read(OWN_SPEC);
  const r = runCut(own);
  assert.equal(grepC(r.stderr + r.stdout, "fanout: error:"), 0, r.stderr);
  const outs = outLines(r);
  assert.ok(outs.every((l) => l.includes("test/e297-main-protected-sop.test.mjs")), outs.join("\n"));
  assert.equal(r.status, outs.length ? 1 : 0);
  const crlf = runCut(own.replace(/\n/g, "\r\n"));
  assert.equal(crlf.status, r.status);
  assert.equal(crlf.stdout, r.stdout);
  const without = runCut(own.replace("、`test/e297-main-protected-sop.test.mjs`", ""));
  assert.equal(without.status, 0, without.stdout + without.stderr);
});
