// Coded by @qa-engineer
// Tests (T-E443A-01) for specs/e443a-manifest-waves.md A1-4..A1-7: `node scripts/fanout.mjs waves <manifest>
// <wave-table> [--primary <path>]` compares a wave manifest with the approved spec-workshop wave table and the
// tickets' files. WHY: the integrator may skip the Stage 2 human stop only when the manifest provably changes
// nothing the human approved — same tickets, every approved dependency kept, every owned path inside the tickets'
// allowed paths. A false pass dispatches unapproved work without a human; a false fail only costs a stop. So each
// broken condition must name itself, and a pass must print the exact reason line the Decisions row records.
// Exit codes: 0 = all three conditions hold, 1 = a broken condition, 2 = usage / parse / input error.
// Fixtures: test/fixtures/e443a/manifest-compare.md, wave-table.md and tickets-waves/*.md, copied into a temporary
// primary (docs/tickets/) under os.tmpdir() and passed with --primary; no tracked fixture is rewritten.

import { test, after } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const FANOUT = path.join(ROOT, "scripts", "fanout.mjs");
const FIX = path.join(ROOT, "test", "fixtures", "e443a");
const COMPARE = fs.readFileSync(path.join(FIX, "manifest-compare.md"), "utf8");
const WAVE_TABLE = path.join(FIX, "wave-table.md");

const TMP = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "e443a-waves-")));
after(() => fs.rmSync(TMP, { recursive: true, force: true }));
let seq = 0;
const tmpFile = (name, text) => {
  const p = path.join(TMP, `${seq++}-${name}`);
  fs.writeFileSync(p, text);
  return p;
};

/** A temporary primary whose ticket directory holds the wave fixtures' ticket files, minus `omit` (file names). */
function primary({ omit = [], ticketDir = "docs/tickets", config } = {}) {
  const dir = path.join(TMP, `primary-${seq++}`);
  const tickets = path.join(dir, ticketDir);
  fs.mkdirSync(tickets, { recursive: true });
  for (const f of fs.readdirSync(path.join(FIX, "tickets-waves"))) {
    if (!omit.includes(f)) fs.copyFileSync(path.join(FIX, "tickets-waves", f), path.join(tickets, f));
  }
  if (config !== undefined) {
    fs.mkdirSync(path.join(dir, ".current"), { recursive: true });
    fs.writeFileSync(path.join(dir, ".current", ".config.json"), JSON.stringify({ schema_version: 2, ...config }));
  }
  return dir;
}

function waves(manifestText, { table = WAVE_TABLE, prim = primary() } = {}) {
  const r = spawnSync(process.execPath, [FANOUT, "waves", tmpFile("manifest.md", manifestText), table, "--primary", prim], {
    cwd: ROOT,
    encoding: "utf8",
  });
  return { status: r.status, stdout: r.stdout, stderr: r.stderr };
}
const outLines = (r) => r.stdout.split("\n").filter((l) => l !== "");
const failLines = (r) => outLines(r).filter((l) => l.startsWith("FAIL  "));
const errLines = (r) => r.stderr.split("\n").filter((l) => l.startsWith("fanout: error:"));

// Copy / Strings: WAVES_REASON_LINE, WAVES_OK_LINE, WAVES_FAIL_SUMMARY.
const REASON = (n, d) =>
  `自動：只改順序或分組 — 票組與核准的波次表相同（${n} 張票），核准的 ${d} 條相依都保留，每條 lane 的擁有檔都在其票的允許路徑內`;
const OK = (n, m, d) => `fanout waves: ok — ${n} ticket(s) in ${m} lane(s), ${d} approved dependency(ies) kept`;
const SUMMARY = (k) => `fanout waves: ${k} broken condition(s) — halt for human approval`;

/** Exit 0, the ok line, and the reason line as the very last stdout line. */
function assertPass(r, n, m, d, label) {
  assert.equal(r.status, 0, `${label}: ${r.stdout}${r.stderr}`);
  assert.ok(r.stdout.endsWith("\n"), `${label}: stdout ends with a newline`);
  const lines = outLines(r);
  assert.equal(lines.at(-1), REASON(n, d), `${label}: last stdout line is the reason line`);
  assert.equal(lines.filter((l) => l === OK(n, m, d)).length, 1, `${label}: the ok line`);
  assert.deepEqual(failLines(r), [], `${label}: no FAIL line`);
}

/** Exit 1, exactly the given FAIL lines, and the halt summary as the last stdout line. */
function assertFail(r, fails, label) {
  assert.equal(r.status, 1, `${label}: ${r.stdout}${r.stderr}`);
  assert.deepEqual(failLines(r), fails.map((f) => `FAIL  ${f}`), label);
  assert.equal(outLines(r).at(-1), SUMMARY(1), `${label}: halt summary is the last line`);
  assert.ok(!r.stdout.includes("自動：只改順序或分組"), `${label}: no reason line on a failure`);
}

// --- manifest text helpers -------------------------------------------------------------------------------------

const cellsOf = (row) => row.split("|").slice(1, -1).map((c) => c.trim());
const rowOf = (cells) => `| ${cells.join(" | ")} |`;
const HEADER = ["lane", "票", "branch", "worktree", "擁有", "禁止", "範圍切線", "相依", "波次"];

/** manifest-compare.md with lane `lane`'s `column` cell replaced. */
function setCell(text, lane, column, value) {
  const lines = text.split("\n");
  const i = lines.findIndex((l) => l.startsWith(`| ${lane} |`));
  assert.ok(i >= 0, `fixture has lane ${lane}`);
  const cells = cellsOf(lines[i]);
  cells[HEADER.indexOf(column)] = value;
  lines[i] = rowOf(cells);
  return lines.join("\n");
}

/** A shape-3 wave manifest with exactly these lanes (`{ lane, tickets, owned, deps, wave }`). */
function manifestWith(lanes) {
  const rows = lanes.map((l) =>
    rowOf([l.lane, l.tickets, `feat/${l.lane}-fixture`, `../lanes/${l.lane}`, l.owned, "`src/zz-forbidden.ts`", "做：x　不做：y", l.deps, String(l.wave)]),
  );
  return [
    "# Fan-out: e443a wave-compare fixture (in-test)",
    "base: abc1234    integration branch: integ/e443a-fixture",
    "mailbox: ../lanes/_mailbox",
    "",
    "## Lanes",
    rowOf(HEADER),
    `|${"---|".repeat(HEADER.length)}`,
    ...rows,
    "",
    "## Dispatch pins",
    `- ${lanes.map((l) => l.lane).join("、")}：無 pin。`,
    "",
    "## Decisions",
    "| 日期 | 裁決者 | 內容 | 出處 |",
    "|---|---|---|---|",
    "| 2026-11-27 | 人類 | fixture approval | test fixture |",
    "",
  ].join("\n");
}
const LANE_B = { lane: "lb", tickets: "TB", owned: "`src/b.ts`", deps: "無", wave: 1 };
const sameLane = (tickets, extraOwned = "") =>
  manifestWith([
    { lane: "lac", tickets, owned: "`src/a.ts`、`src/c.ts`" + extraOwned, deps: "無", wave: 2 },
    LANE_B,
  ]);

// ---------------------------------------------------------------------------------------------------------------
// A1-4 — a manifest that only reorders or groups approved work passes
// ---------------------------------------------------------------------------------------------------------------

test("A1-4: a manifest that serialises or groups the approved tickets passes with the reason line last", async (t) => {
  // WHY: serialising parallel tickets or grouping dependent ones in one lane only adds order; it never drops an
  // approved dependency, so it must not stop the human — and the reason line is what the Decisions row records.
  await t.test("B serialised after A through 相依 (lb 相依 = la)", () => {
    assertPass(waves(COMPARE), 3, 3, 1, "相依 serialisation");
  });
  await t.test("B serialised by a later 波次 instead", () => {
    const text = setCell(setCell(COMPARE, "lb", "相依", "無"), "lb", "波次", "2");
    assertPass(waves(text), 3, 3, 1, "later wave");
  });
  await t.test("C reaches A's lane in two 相依 steps (lc → lb → la)", () => {
    assertPass(waves(setCell(COMPARE, "lc", "相依", "lb")), 3, 3, 1, "two-step reach");
  });
  await t.test("A and C in one lane with A listed first", () => {
    assertPass(waves(sameLane("TA、TC")), 3, 2, 1, "same lane, A first");
  });
});

// ---------------------------------------------------------------------------------------------------------------
// A1-5 — a dropped approved dependency fails
// ---------------------------------------------------------------------------------------------------------------

test("A1-5: a manifest that drops the approved dependency C→A exits 1 with DEPENDENCY_DROPPED", async (t) => {
  // WHY: dropping an approved dependency lets C start before A is merged — exactly what the human approved against.
  await t.test("C's lane does not reach A's lane through 相依", () => {
    assertFail(
      waves(setCell(COMPARE, "lc", "相依", "無")),
      ["DEPENDENCY_DROPPED: TC depends on TA (wave table), but lane lc does not reach lane la through 相依"],
      "different lanes",
    );
  });
  await t.test("C's lane reaches only an unrelated lane (lc → lb, lb independent of la)", () => {
    const text = setCell(setCell(COMPARE, "lb", "相依", "無"), "lc", "相依", "lb");
    assertFail(waves(text), ["DEPENDENCY_DROPPED: TC depends on TA (wave table), but lane lc does not reach lane la through 相依"], "unrelated reach");
  });
  await t.test("same lane, C listed before A", () => {
    assertFail(
      waves(sameLane("TC、TA")),
      ["DEPENDENCY_DROPPED: TC depends on TA (wave table), but both are in lane lac and TA is not listed before TC in its 票 cell"],
      "same lane reversed",
    );
  });
});

// ---------------------------------------------------------------------------------------------------------------
// A1-6 — a changed ticket set fails
// ---------------------------------------------------------------------------------------------------------------

test("A1-6: a manifest that adds, removes or double-lists a ticket exits 1 naming it", async (t) => {
  // WHY: the human approved a ticket set; work outside it, approved work left out, or one ticket in two lanes
  // (two sessions building the same thing) are not reordering and must halt.
  await t.test("ticket TD added", () => {
    assertFail(waves(setCell(COMPARE, "lb", "票", "TB、TD")), ["TICKET_ADDED: ticket TD is in lane lb's 票 cell but not in the wave table"], "added");
  });
  await t.test("ticket TB removed", () => {
    const text = manifestWith([
      { lane: "la", tickets: "TA", owned: "`src/a.ts`", deps: "無", wave: 1 },
      { lane: "lc", tickets: "TC", owned: "`src/c.ts`", deps: "la", wave: 2 },
    ]);
    assertFail(waves(text), ["TICKET_REMOVED: ticket TB is in the wave table but in no lane's 票 cell"], "removed");
  });
  await t.test("ticket TA listed in two lanes", () => {
    assertFail(
      waves(setCell(COMPARE, "lb", "票", "TB、TA")),
      ["TICKET_IN_TWO_LANES: ticket TA is listed more than once across 票 cells (lanes la, lb)"],
      "two lanes",
    );
  });
});

// ---------------------------------------------------------------------------------------------------------------
// A1-7 — owned paths outside the tickets' allowed paths fail; a missing ticket file is an input error
// ---------------------------------------------------------------------------------------------------------------

test("A1-7: an owned path outside the lane's allowed paths exits 1; bookkeeping never fails; a missing ticket file exits 2", async (t) => {
  // WHY: the allowed paths are the file boundary the human approved per ticket; a lane that owns more could write
  // outside it unreviewed. Glob-in-glob containment is never inferred, so a different glob is outside by rule.
  await t.test("a literal path outside the allowed paths", () => {
    const text = setCell(COMPARE, "lb", "擁有", "`src/b.ts`、`src/other.ts`");
    assertFail(waves(text), ["OWNED_OUTSIDE_ALLOWED: lane lb: 擁有 token src/other.ts is not inside the allowed paths of TB"], "literal");
  });
  await t.test("a glob token that is not byte-identical to an allowed glob", () => {
    const text = setCell(COMPARE, "la", "擁有", "`src/a.ts`、`src/a/*.ts`");
    assertFail(waves(text), ["OWNED_OUTSIDE_ALLOWED: lane la: 擁有 token src/a/*.ts is not inside the allowed paths of TA"], "glob");
  });
  await t.test("a lane of two tickets names both in the message", () => {
    assertFail(
      waves(sameLane("TA、TC", "、`src/zz.ts`")),
      ["OWNED_OUTSIDE_ALLOWED: lane lac: 擁有 token src/zz.ts is not inside the allowed paths of TA、TC"],
      "two tickets",
    );
  });
  await t.test("bookkeeping tokens, a literal inside an allowed glob and a byte-identical glob never fail", () => {
    // manifest-compare.md's 擁有 cells hold `.current/la/**`, `qa_reports/`, `tasks.md`, `review_reports/`,
    // `specs/lc-*.md`, `src/a/x.ts` (inside `src/a/**`) and `src/a/**` / `test/c-*.test.mjs` (byte-identical).
    for (const token of [".current/la/**", "qa_reports/", "tasks.md", "review_reports/", "specs/lc-*.md", "src/a/x.ts", "src/a/**", "test/c-*.test.mjs"]) {
      assert.ok(COMPARE.includes("`" + token + "`"), `fixture owns ${token}`);
    }
    assertPass(waves(COMPARE), 3, 3, 1, "bookkeeping");
  });
  await t.test("a wave-table ticket with no ticket file exits 2 with TICKET_FILE_ABSENT naming it", () => {
    const r = waves(COMPARE, { prim: primary({ omit: ["tb.md"] }) });
    assert.equal(r.status, 2, r.stdout + r.stderr);
    assert.deepEqual(errLines(r), ["fanout: error: TICKET_FILE_ABSENT: ticket TB: no ticket file under docs/tickets has id TB"]);
    assert.ok(!r.stderr.includes(TMP), "the ticket directory is shown relative to primary, never absolute");
  });
});

// ---------------------------------------------------------------------------------------------------------------
// Smoke (I2 / I4 input boundaries) — not a scenario of their own; each pins an interface the spec fixes
// ---------------------------------------------------------------------------------------------------------------

test("smoke: waves input errors exit 2 with their codes; ticketDir from primary's config is honoured", async (t) => {
  await t.test("a manifest without the 波次 column is WAVES_COLUMN_ABSENT", () => {
    const eight = fs.readFileSync(path.join(FIX, "manifest-8col.md"), "utf8");
    const line = eight.split("\n").indexOf("## Lanes") + 1;
    const r = waves(eight);
    assert.equal(r.status, 2, r.stdout + r.stderr);
    assert.ok(
      errLines(r).includes(`fanout: error: WAVES_COLUMN_ABSENT: section "## Lanes" (line ${line}) has no 波次 column — waves compares only a manifest whose every Lanes table has it`),
      r.stderr,
    );
  });
  await t.test("wave table: unreadable, absent, duplicate, malformed row", () => {
    const cases = [
      ["unreadable", path.join(TMP, "no-such-table.md"), "WAVE_TABLE_UNREADABLE"],
      ["absent", tmpFile("no-table.md", "# notes\n\n| ruling | text |\n|---|---|\n| R1 | x |\n"), "WAVE_TABLE_ABSENT"],
      [
        "duplicate",
        tmpFile("two-tables.md", "| wave | ticket | depends on |\n|---|---|---|\n| 1 | TA | — |\n\ntext\n\n| wave | ticket | depends on |\n|---|---|---|\n| 1 | TB | — |\n"),
        "WAVE_TABLE_DUPLICATE",
      ],
      ["wave not an integer", tmpFile("bad-wave.md", "| wave | ticket | depends on |\n|---|---|---|\n| one | TA | — |\n"), "WAVE_TABLE_ROW_MALFORMED"],
      ["depends on an unknown ticket", tmpFile("bad-dep.md", "| wave | ticket | depends on |\n|---|---|---|\n| 1 | TA | TQ |\n"), "WAVE_TABLE_ROW_MALFORMED"],
      ["duplicate ticket", tmpFile("dup-ticket.md", "| wave | ticket | depends on |\n|---|---|---|\n| 1 | TA | — |\n| 2 | TA | — |\n"), "WAVE_TABLE_ROW_MALFORMED"],
    ];
    for (const [label, table, code] of cases) {
      const r = waves(COMPARE, { table });
      assert.equal(r.status, 2, `${label}: ${r.stdout}${r.stderr}`);
      assert.ok(errLines(r).some((l) => l.startsWith(`fanout: error: ${code}: `)), `${label}: ${r.stderr}`);
    }
  });
  await t.test("a primary with no ticket directory is TICKET_FILE_ABSENT", () => {
    const empty = path.join(TMP, `empty-primary-${seq++}`);
    fs.mkdirSync(empty);
    const r = waves(COMPARE, { prim: empty });
    assert.equal(r.status, 2);
    assert.ok(errLines(r).includes("fanout: error: TICKET_FILE_ABSENT: ticket TA: no ticket file under docs/tickets has id TA"), r.stderr);
  });
  await t.test("ticketDir in primary's .current/.config.json is where tickets are looked up", () => {
    assertPass(waves(COMPARE, { prim: primary({ ticketDir: "work/tickets", config: { ticketDir: "work/tickets" } }) }), 3, 3, 1, "ticketDir");
  });
  await t.test("wrong operand count is USAGE", () => {
    const r = spawnSync(process.execPath, [FANOUT, "waves", path.join(FIX, "manifest-compare.md")], { cwd: ROOT, encoding: "utf8" });
    assert.equal(r.status, 2);
    assert.match(r.stderr, /^fanout: error: USAGE: /m);
  });
});
