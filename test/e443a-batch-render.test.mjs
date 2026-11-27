// Coded by @qa-engineer
// Tests (T-E443A-01) for specs/e443a-manifest-waves.md A1-9..A1-11: `fanout.mjs render <manifest> <lane> --batch`.
// WHY: a lane started in batch has no human at its keyboard, so its prompt must (a) end with the stop-the-ticket
// rule instead of "wait for me to type", (b) take its one-line summary and reading list from the lane's ticket
// files — the single prompt source, nothing typed by hand — and (c) start by confirming the session already sits
// in the right worktree and branch, instead of telling it to create one. The batch prompt is derived from the one
// dispatch template, so apart from the two replaced lines it must equal the hand-started prompt byte for byte.
// A1-12 (hand-started render byte-identical) is verified by the existing render tests and goldens staying green
// unmodified plus a git diff against the lane's dispatch base: a command scenario listed in
// qa_reports/tests_e443a-manifest-waves.md, not a resident test (no test diffs against a fixed sha).
// Fixtures: test/fixtures/e443a/manifest-batch.md and tickets-batch/** copied into a temporary primary under
// os.tmpdir() (docs/tickets/, including a ReadMe.md and a subdirectory file the lookup must skip).

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
const MANIFEST = path.join(FIX, "manifest-batch.md");

const TMP = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "e443a-batch-")));
after(() => fs.rmSync(TMP, { recursive: true, force: true }));
const MAILBOX = path.join(TMP, "mailbox");
let seq = 0;

// Copy / Strings (verbatim blocks) and the two hand-started template texts they replace.
const BATCH_FIRST_STEP_LINE =
  "worktree 已建好，這個 session 就開在裡面；先用兩次各自獨立的 Bash 呼叫跑 `pwd` 與 `git branch --show-current`，確認前者是 <worktree>、後者是 <branch>，不符就停下來回報。";
const BATCH_CLOSING_LINE = "需要人類裁定的事一律停票：照 lane 規則的「批次 lane」把問題寫進票檔的 `## Open question`、回報整合者，不等打字核准。";
const HAND_FIRST_STEP_LINE =
  "`feature start` 建好 worktree 之後，呼叫 `EnterWorktree`（path = <worktree>）把這個 session 切進去；這個工具不能用時，每個 Bash 指令照舊自帶 `cd <worktree> &&`。";
const HAND_CLOSING = "需要我核准的事，等我在這裡親手打字。";

// What the lane's ticket files say (tickets-batch/first-ticket.md, second-ticket.md).
const SUMMARY = "First batch title；Second batch title";
const READING = ["docs/tickets/first-ticket.md的 ## Scenarios（X1-1、X1-2）", "docs/tickets/second-ticket.md的 ## Scenarios（X2-1、X2-9）"];

function copyDir(from, to) {
  fs.mkdirSync(to, { recursive: true });
  for (const e of fs.readdirSync(from, { withFileTypes: true })) {
    if (e.isDirectory()) copyDir(path.join(from, e.name), path.join(to, e.name));
    else fs.copyFileSync(path.join(from, e.name), path.join(to, e.name));
  }
}

/** A temporary primary: docs/tickets/ = tickets-batch/**, plus `files` (rel → text) and an optional config. */
function primary({ files = {}, config } = {}) {
  const dir = path.join(TMP, `primary-${seq++}`);
  copyDir(path.join(FIX, "tickets-batch"), path.join(dir, "docs", "tickets"));
  for (const [rel, text] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
    fs.writeFileSync(path.join(dir, rel), text);
  }
  if (config !== undefined) {
    fs.mkdirSync(path.join(dir, ".current"), { recursive: true });
    fs.writeFileSync(path.join(dir, ".current", ".config.json"), JSON.stringify({ schema_version: 2, ...config }));
  }
  return dir;
}

function cli(args) {
  const r = spawnSync(process.execPath, [FANOUT, ...args], { cwd: ROOT, encoding: "utf8" });
  return { status: r.status, stdout: r.stdout, stderr: r.stderr };
}
const batch = (lane, prim, extra = []) => cli(["render", MANIFEST, lane, "--batch", "--primary", prim, "--mailbox-root", MAILBOX, ...extra]);
const hand = (lane, prim) =>
  cli(["render", MANIFEST, lane, "--summary", SUMMARY, ...READING.flatMap((r) => ["--reading", r]), "--primary", prim, "--mailbox-root", MAILBOX]);
const errLines = (r) => r.stderr.split("\n").filter((l) => l.startsWith("fanout: error:"));

/** The resolved worktree, read from the prompt's own fields line (`- branch: … worktree: … lane: …`). */
function worktreeOf(prompt) {
  const m = /^- branch: (\S+) {4}worktree: (.+) {4}lane: (\S+)$/m.exec(prompt);
  assert.ok(m, "the prompt carries the fields line");
  return { branch: m[1], worktree: m[2], lane: m[3] };
}

// ---------------------------------------------------------------------------------------------------------------
// A1-9 — the batch prompt ends with the stop-the-ticket closing line
// ---------------------------------------------------------------------------------------------------------------

test("A1-9: render --batch exits 0 and the prompt ends with BATCH_CLOSING_LINE, never the wait-for-typing sentence", () => {
  // WHY: a batch lane waiting for typed approval would hang with nobody at the keyboard; it must stop the ticket.
  const r = batch("lx", primary());
  assert.equal(r.status, 0, r.stderr);
  assert.ok(r.stdout.endsWith(BATCH_CLOSING_LINE + "\n"), `prompt ends with BATCH_CLOSING_LINE + one newline:\n${r.stdout.slice(-200)}`);
  assert.ok(!r.stdout.endsWith("\n\n"), "exactly one trailing newline");
  assert.ok(!r.stdout.includes(HAND_CLOSING), "the hand-started closing sentence is gone");
  // the flag may stand anywhere after <lane> among the flags
  const mid = cli(["render", MANIFEST, "lx", "--primary", primary(), "--batch", "--mailbox-root", MAILBOX]);
  assert.equal(mid.status, 0, mid.stderr);
  assert.ok(mid.stdout.endsWith(BATCH_CLOSING_LINE + "\n"));
});

// ---------------------------------------------------------------------------------------------------------------
// A1-10 — summary and reading list come from the ticket files
// ---------------------------------------------------------------------------------------------------------------

test("A1-10: render --batch takes the summary and reading list from the lane's ticket files", async (t) => {
  // WHY: one prompt source — a hand-typed --summary / --reading could drift from the approved tickets.
  await t.test("first line holds the titles joined by ；, reading line holds each ticket's scenario ids", () => {
    const r = batch("lx", primary());
    assert.equal(r.status, 0, r.stderr);
    const lines = r.stdout.split("\n");
    assert.equal(lines[0], "開始做 e443a batch-render fixture，你只負責 lx lane 的 TX1、TX2（First batch title；Second batch title）。");
    // file paths are relative to primary with `/`; ids in file order, `## Added during build` ones included;
    // matched by the id field (file names differ), ReadMe.md and the subdirectory file are never read.
    assert.equal(lines[2], `先完整讀 docs/lane-protocol.md（共同規則，包括信箱與回報格式），再讀 ${READING.join(" + ")}。`);
    assert.ok(!r.stdout.includes(TMP + "/docs/tickets"), "ticket file paths are never absolute");
  });
  await t.test("a lane ticket with no ticket file exits 2 with TICKET_FILE_ABSENT naming it", () => {
    const r = batch("ly", primary());
    assert.equal(r.status, 2, r.stdout + r.stderr);
    assert.deepEqual(errLines(r), ["fanout: error: TICKET_FILE_ABSENT: ticket TY: no ticket file under docs/tickets has id TY"]);
    assert.equal(r.stdout, "");
  });
  await t.test("--batch with --summary or --reading is USAGE; --batch twice is USAGE", () => {
    const msg = "fanout: error: USAGE: render --batch takes no --summary or --reading (both come from the lane's ticket files)";
    for (const extra of [["--summary", "x"], ["--reading", "y"]]) {
      const r = batch("lx", primary(), extra);
      assert.equal(r.status, 2, `${extra[0]}: ${r.stdout}${r.stderr}`);
      assert.equal(errLines(r)[0], msg, extra[0]);
    }
    const twice = batch("lx", primary(), ["--batch"]);
    assert.equal(twice.status, 2);
    assert.equal(errLines(twice)[0], "fanout: error: USAGE: flag --batch given more than once");
  });
});

// ---------------------------------------------------------------------------------------------------------------
// A1-11 — the first step confirms the worktree instead of creating it
// ---------------------------------------------------------------------------------------------------------------

test("A1-11: render --batch puts BATCH_FIRST_STEP_LINE after the reading line, drops feature start / EnterWorktree, keeps the two-layer pointer", async (t) => {
  // WHY: the launcher already created the worktree and opened the session in it; re-running `feature start` or
  // switching worktrees would act on the wrong checkout, so the lane only confirms where it is and stops if wrong.
  await t.test("line after the reading line is BATCH_FIRST_STEP_LINE with <worktree> and <branch> filled", () => {
    const r = batch("lx", primary());
    assert.equal(r.status, 0, r.stderr);
    const lines = r.stdout.split("\n");
    const { branch, worktree } = worktreeOf(r.stdout);
    assert.equal(branch, "feat/lx-batch");
    assert.ok(path.isAbsolute(worktree) && !worktree.includes("<"), `worktree resolved: ${worktree}`);
    assert.ok(lines[2].startsWith("先完整讀 "), "line 3 is the reading line");
    assert.equal(lines[3], BATCH_FIRST_STEP_LINE.replace("<worktree>", worktree).replace("<branch>", branch));
    assert.ok(!r.stdout.includes("feature start"), "no `feature start`");
    assert.ok(!r.stdout.includes("EnterWorktree"), "no EnterWorktree");
  });
  await t.test("apart from the two replaced lines, the batch prompt equals the hand-started prompt", () => {
    // WHY: the batch template is derived from the one dispatch template — no second copy that could drift.
    const prim = primary();
    const b = batch("lx", prim);
    const h = hand("lx", prim);
    assert.equal(b.status, 0, b.stderr);
    assert.equal(h.status, 0, h.stderr);
    const { worktree, branch } = worktreeOf(h.stdout);
    const fill = (s) => s.replaceAll("<worktree>", worktree).replaceAll("<branch>", branch);
    const expected = h.stdout.replace(fill(HAND_FIRST_STEP_LINE), () => fill(BATCH_FIRST_STEP_LINE)).replace(HAND_CLOSING, () => BATCH_CLOSING_LINE);
    assert.notEqual(expected, h.stdout, "both source lines were found in the hand-started prompt");
    assert.equal(b.stdout, expected);
  });
  await t.test("with laneProtocolAddendum set in primary, the two-layer pointer still appears", () => {
    const prim = primary({ files: { "docs/addendum.md": "# repo addendum\n" }, config: { laneProtocolAddendum: "docs/addendum.md" } });
    const r = batch("lx", prim);
    assert.equal(r.status, 0, r.stderr);
    const lines = r.stdout.split("\n");
    assert.ok(
      lines[2].endsWith(`docs/lane-protocol.md（agc 通用規則，包括信箱與回報格式）和 docs/addendum.md（本 repo 的補充規則），再讀 ${READING.join(" + ")}。`),
      lines[2],
    );
    assert.ok(!r.stdout.includes("（共同規則，包括信箱與回報格式）"), "the single pointer is replaced");
    assert.equal(lines[3], BATCH_FIRST_STEP_LINE.replace("<worktree>", worktreeOf(r.stdout).worktree).replace("<branch>", "feat/lx-batch"));
    assert.ok(r.stdout.endsWith(BATCH_CLOSING_LINE + "\n"));
  });
});

// ---------------------------------------------------------------------------------------------------------------
// Smoke (I2 / I3 input boundaries) — each pins an error message the spec fixes
// ---------------------------------------------------------------------------------------------------------------

test("smoke: batch render lookup errors — empty 票 cell, duplicate and invalid ticket files, all collected", async (t) => {
  await t.test("a 票 cell naming no ticket id is TICKET_CELL_EMPTY", () => {
    const r = batch("lz", primary());
    assert.equal(r.status, 2, r.stdout + r.stderr);
    assert.ok(errLines(r).includes("fanout: error: TICKET_CELL_EMPTY: lane lz: 票 cell names no ticket"), r.stderr);
  });
  await t.test("a duplicate id and an unparsable file are both reported, paths relative to primary", () => {
    const dup = fs.readFileSync(path.join(FIX, "tickets-batch", "first-ticket.md"), "utf8");
    const invalid = fs.readFileSync(path.join(FIX, "tickets-batch", "second-ticket.md"), "utf8").replace("priority: P2\n", "");
    const prim = primary({ files: { "docs/tickets/dup.md": dup, "docs/tickets/second-ticket.md": invalid } });
    const r = batch("lx", prim);
    assert.equal(r.status, 2, r.stdout + r.stderr);
    const errs = errLines(r);
    assert.ok(
      errs.some((l) =>
        [
          "fanout: error: TICKET_FILE_DUPLICATE: ticket TX1: more than one ticket file under docs/tickets has id TX1 (docs/tickets/dup.md, docs/tickets/first-ticket.md)",
          "fanout: error: TICKET_FILE_DUPLICATE: ticket TX1: more than one ticket file under docs/tickets has id TX1 (docs/tickets/first-ticket.md, docs/tickets/dup.md)",
        ].includes(l),
      ),
      r.stderr,
    );
    assert.ok(
      errs.includes('fanout: error: TICKET_FILE_INVALID: ticket TX2: ticket file docs/tickets/second-ticket.md does not parse: missing field "priority"'),
      r.stderr,
    );
    assert.ok(!r.stderr.includes(TMP), "no absolute path in the errors");
  });
});
