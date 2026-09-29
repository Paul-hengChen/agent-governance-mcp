// Coded by @qa-engineer
// T-E177B-06 — tests for scripts/mailbox-watch.mjs (specs/e177b-lane-status-tooling.md,
// AC14-AC20).
//
// Spec-to-Test map:
//   AC14 (correct `--- msg` counting; armed line; no spurious fire on empty)
//        -> "AC14: ..."
//   AC15 (single-file exits 0 naming new count; multi-file names the file)
//        -> "AC15: ..." (x2)
//   AC16 (re-arm baseline = LAST-READ count, never a fresh re-sample at expiry;
//        a message landing in the expiry-to-rearm gap must still fire)
//        -> "AC16: ..."
//   AC17 (second concurrent watch on the SAME file refuses to start)
//        -> "AC17: ..." (real cross-process)
//   AC18 (--send auto-stamps time/re/hop/seq per §5)
//        -> "AC18: ..." (x4: seq, time, re, hop — incl. a real handoff read)
//   AC19 (multi-file watches all named files; single-file exits on first)
//        -> "AC19: ..."
//   AC20 (multi-file expiring line carries EACH file's own last-read baseline
//        in `key=N,...` form; default deadline < Monitor's 30-min cap;
//        --deadline adjusts it)
//        -> "AC20: ..." (x2)
//
// WHY two different timing strategies:
//   - AC16/AC20 need to observe the EXACT instant a message arrives relative
//     to the deadline check (before vs. after) — real timers can't guarantee
//     that ordering deterministically, so those tests inject a fully fake
//     clock (`now`/`sleep` overridden in the `io` object main() already
//     accepts) that advances only when the code under test awaits it, and
//     appends the "gap" message from inside that fake `sleep`.
//   - AC15/AC19 test genuine mid-watch detection while the watch is actually
//     polling, so they use REAL timers with fractional `--interval`/
//     `--deadline` values (per the dispatch brief) to stay fast without
//     losing the "detected while running" property.
//   - AC17 spawns two REAL, separate OS processes (never in-process calls):
//     the refusal is a cross-process guarantee (a sidecar lock file), and a
//     real second process is the only way to prove a second, independent
//     mailbox-watch invocation is refused rather than merely a second
//     in-process call sharing this test's own module state.

import { test } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

import {
  DEFAULT_DEADLINE_MINUTES,
  DEFAULT_INTERVAL_SECONDS,
  EXIT_NEW_MESSAGE,
  EXIT_EXPIRED,
  EXIT_REFUSED,
  EXIT_USAGE,
  MESSAGE_TYPES,
  countMessages,
  parseMessageHeaders,
  nextSeq,
  formatUtcSecond,
  laneKeyForFile,
  assignKeys,
  parseBaselineArg,
  formatRearmCommand,
  normalizeRe,
  buildMessageBlock,
  parseMailboxArgs,
  watchLockPath,
  main,
} from "../scripts/mailbox-watch.mjs";
import { writeHandoffState } from "../dist/tools/handoff.js";
import { resetSession } from "../dist/guards/session.js";
import { HOP_CAP_EXPORTED } from "../dist/tools/transitions.js";

const __filename = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(__filename), "..");
const MAILBOX_SCRIPT = path.join(ROOT, "scripts", "mailbox-watch.mjs");

// ---------------------------------------------------------------------------
// Fixture helpers
// ---------------------------------------------------------------------------

function mkTmpDir(t, prefix) {
  const dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), prefix)));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  return dir;
}

/** A mailbox file at `<tmp>/<laneDirName>/<filename>` — laneKeyForFile keys
 *  off the parent directory's basename, so this is how tests control it. */
function mkMailboxFile(t, laneDirName, filename = "to-integrator.md") {
  const root = mkTmpDir(t, "e177b-mbx-");
  const dir = path.join(root, laneDirName);
  fs.mkdirSync(dir, { recursive: true });
  return path.join(dir, filename);
}

function appendMsg(file, overrides = {}) {
  const block = buildMessageBlock({
    seq: 1,
    from: "lane1",
    type: "report",
    re: "to-lane#1",
    time: "2026-01-01T00:00:00Z",
    hop: "1/10",
    body: "hello",
    ...overrides,
  });
  fs.appendFileSync(file, block);
}

/** Collects io.out/io.err calls into arrays instead of the real stdio. */
function collectIo(extra = {}) {
  const outLines = [];
  const errLines = [];
  return {
    outLines,
    errLines,
    io: {
      out: (l) => outLines.push(l),
      err: (l) => errLines.push(l),
      ...extra,
    },
  };
}

async function waitFor(predicate, { timeoutMs = 3000, intervalMs = 10 } = {}) {
  const start = Date.now();
  for (;;) {
    if (predicate()) return true;
    if (Date.now() - start > timeoutMs) throw new Error("waitFor: timed out");
    await new Promise((r) => setTimeout(r, intervalMs));
  }
}

/** Spawn the real script as a child process; resolves once it exits. */
function spawnMailbox(args, opts = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [MAILBOX_SCRIPT, ...args], { cwd: ROOT, ...opts });
    let stdout = "";
    let stderr = "";
    child.stdout?.on("data", (d) => (stdout += d));
    child.stderr?.on("data", (d) => (stderr += d));
    child.on("error", reject);
    child.on("exit", (code, signal) => resolve({ code, signal, stdout, stderr }));
    if (opts.onSpawn) opts.onSpawn(child);
  });
}

// ---------------------------------------------------------------------------
// AC14 — correct counting; the exact armed line; no spurious fire when empty
// ---------------------------------------------------------------------------

test("AC14: an empty mailbox prints the exact armed line and never fires spuriously", { timeout: 20000 }, async (t) => {
  const file = mkMailboxFile(t, "e177b-ac14");
  fs.writeFileSync(file, "");
  const { outLines, io } = collectIo();
  // A short real deadline so the watch terminates instead of running forever
  // (nothing ever changes this file in this test).
  const code = await main([file, "--baseline", "0", "--deadline", "0.002", "--interval", "0.02"], io);
  assert.equal(code, EXIT_EXPIRED);
  assert.equal(outLines[0], "armed: baseline 0, current 0");
  assert.ok(!outLines.some((l) => l.startsWith("new message:")), "must never fire on an empty file");
});

test("AC14 (unit): countMessages is exactly one integer per `--- msg` line, immune to the Wave 5.1 `grep -c` shape (never '0\\n0')", { timeout: 20000 }, () => {
  assert.equal(countMessages(""), 0);
  assert.equal(countMessages("no messages here\njust text\n"), 0);
  assert.equal(countMessages("--- msg\nseq: 1\n---\nbody\n--- msg\nseq: 2\n---\nbody\n"), 2);
  // A line that merely CONTAINS "--- msg" as a substring, not as the whole
  // marker, must not count (boundary input).
  assert.equal(countMessages("this has --- msg embedded mid-line\n"), 0);
});

// ---------------------------------------------------------------------------
// AC15 / AC19 — mid-watch detection: single-file exits naming the count;
// multi-file names which file changed and keeps watching the rest.
// ---------------------------------------------------------------------------

test("AC15: single-file mode detects a message appended mid-watch within one poll interval and exits 0 naming the new count", { timeout: 20000 }, async (t) => {
  const file = mkMailboxFile(t, "e177b-ac15");
  fs.writeFileSync(file, "");
  const { outLines, io } = collectIo();
  // A short real deadline (not the 5-minute-unsafe value this test used to
  // carry): if message detection somehow fails, this must expire in ~9s
  // instead of hanging the whole in-process test for 5 real minutes — the
  // node:test `timeout` above is the hard backstop either way.
  const watchPromise = main([file, "--baseline", "0", "--interval", "0.05", "--deadline", "0.15"], io);
  setTimeout(() => appendMsg(file), 120);
  const code = await watchPromise;
  assert.equal(code, EXIT_NEW_MESSAGE);
  assert.ok(outLines.some((l) => l.startsWith("new message: count 1 (baseline 0)")), `expected a new-message line, got: ${JSON.stringify(outLines)}`);
});

test("AC19/AC15: multi-file mode names WHICH file changed and keeps watching the others until the deadline", { timeout: 20000 }, async (t) => {
  const fileA = mkMailboxFile(t, "e204");
  const fileB = mkMailboxFile(t, "e180");
  fs.writeFileSync(fileA, "");
  fs.writeFileSync(fileB, "");
  const { outLines, io } = collectIo();
  const watchPromise = main([fileA, fileB, "--baseline", "0", "--interval", "0.05", "--deadline", "0.006"], io);
  setTimeout(() => appendMsg(fileA), 100);
  const code = await watchPromise;
  assert.equal(code, EXIT_EXPIRED, "multi-file mode never exits early — it runs to the deadline");
  assert.ok(outLines.some((l) => l === `changed: e204 count 1 (was 0) — ${fileA}`), `expected a changed line naming e204, got: ${JSON.stringify(outLines)}`);
  assert.ok(!outLines.some((l) => l.includes("changed: e180")), "the untouched file must never report a change");
});

// ---------------------------------------------------------------------------
// AC16 — re-arm baseline is the LAST-READ count, never a fresh re-sample;
// a message landing in the expiry-to-rearm gap must still be detected.
// ---------------------------------------------------------------------------

test("AC16: the printed re-arm baseline is the count last READ (not a fresh re-sample), and a message in the expiry-to-rearm gap is still detected once re-armed", { timeout: 20000 }, async (t) => {
  const file = mkMailboxFile(t, "e177b-ac16");
  fs.writeFileSync(file, "");

  // A fully fake clock: `now()` only ever advances inside `sleep()`, and the
  // "gap" message is appended INSIDE the final sleep that lands exactly at
  // the deadline — i.e. strictly after this watch's last real file read, and
  // strictly before its deadline check on the next loop iteration (which the
  // source runs BEFORE any fresh read). This pins the exact ordering AC16
  // requires, which real timers cannot guarantee deterministically.
  let clock = 0;
  let injected = false;
  const deadlineMinutes = 1; // 60_000ms — the exact interval below lands on it
  const deadlineMs = deadlineMinutes * 60_000;
  const { outLines, io } = collectIo({
    now: () => clock,
    date: () => new Date(clock),
    sleep: async (ms) => {
      clock += ms;
      if (!injected) {
        appendMsg(file); // the gap message "arrives" exactly at expiry time
        injected = true;
      }
    },
  });

  const code = await main([file, "--baseline", "0", "--deadline", String(deadlineMinutes), "--interval", "100000"], io);
  assert.equal(code, EXIT_EXPIRED);
  assert.equal(outLines[outLines.length - 2], "expiring — re-arm");
  const rearmLine = outLines[outLines.length - 1];
  assert.match(
    rearmLine,
    /^re-arm with: node scripts\/mailbox-watch\.mjs \S+ --baseline 0(?:\s|$)/,
    `the printed baseline must be the STALE (pre-gap-message) count, not a fresh re-sample: ${rearmLine}`,
  );

  // Re-arm with the printed baseline (0) against the REAL, now-current file
  // (which already contains the gap message) — the new watch must detect it
  // immediately rather than treating it as already-seen.
  const { io: io2 } = collectIo();
  const code2 = await main([file, "--baseline", "0"], io2);
  assert.equal(code2, EXIT_NEW_MESSAGE, "a message that arrived in the expiry-to-rearm gap must still be detected once re-armed, never swallowed");
});

test("AC16 (unit): formatRearmCommand's printed --baseline is exactly the given lastRead values, single- and multi-file", { timeout: 20000 }, () => {
  const single = formatRearmCommand([{ file: "/a/to-lane.md", key: "a", lastRead: 3 }]);
  assert.equal(single, "re-arm with: node scripts/mailbox-watch.mjs /a/to-lane.md --baseline 3");
  const multi = formatRearmCommand([
    { file: "/x/e204/to-integrator.md", key: "e204", lastRead: 1 },
    { file: "/x/e180/to-integrator.md", key: "e180", lastRead: 0 },
  ]);
  assert.equal(
    multi,
    "re-arm with: node scripts/mailbox-watch.mjs /x/e204/to-integrator.md /x/e180/to-integrator.md --baseline e204=1,e180=0",
  );
});

// ---------------------------------------------------------------------------
// AC17 — a second concurrent watch on the SAME file refuses to start
// (real, separate OS processes)
// ---------------------------------------------------------------------------

test("AC17: a second, independent mailbox-watch process on the SAME file refuses to start (non-zero exit, clear reason)", { timeout: 20000 }, async (t) => {
  const file = mkMailboxFile(t, "e177b-ac17");
  fs.writeFileSync(file, "");
  const lockPath = watchLockPath(file);

  // A GENEROUS deadline on the first watch (never raced against): we kill it
  // explicitly below, on our own schedule, instead of letting it expire on
  // its own. A short self-expiring deadline here is a suite-load hazard —
  // under full-suite CPU contention, spawning + starting the SECOND process
  // can itself take well over a second, and a first watch that expired (and
  // released its lock) in the meantime would make the second process start
  // a REAL, unbounded watch of its own instead of ever being refused — which
  // is exactly the hang the integrator caught (real timers racing real
  // process-spawn latency under load; E182). The 20s test timeout is
  // this test's own hard backstop regardless.
  let firstChild = null;
  t.after(() => {
    if (firstChild) {
      try {
        firstChild.kill("SIGKILL");
      } catch {
        /* already gone */
      }
    }
  });
  const first = spawnMailbox([file, "--baseline", "0", "--deadline", "10", "--interval", "0.05"], {
    cwd: ROOT,
    onSpawn: (child) => {
      firstChild = child;
    },
  });
  await waitFor(() => fs.existsSync(lockPath));

  // Defensive --deadline on the probe too: IF refusal somehow does not fire
  // (a genuine product bug), this must still terminate promptly rather than
  // hang for its would-be 29-minute default — turning a hang into a fast,
  // loud test failure instead of stalling the whole suite.
  const second = await spawnMailbox([file, "--baseline", "0", "--deadline", "0.05"], { cwd: ROOT });
  assert.equal(
    second.code,
    EXIT_REFUSED,
    `expected refusal (code ${EXIT_REFUSED}); got code=${second.code} stdout=${JSON.stringify(second.stdout)} stderr=${JSON.stringify(second.stderr)}`,
  );
  assert.match(second.stderr, /refusing to start/);
  assert.match(second.stderr, /already being watched by pid \d+/);

  firstChild.kill("SIGTERM"); // handled: releases the lock, exits 143
  await first;
  assert.equal(fs.existsSync(lockPath), false, "the lock must be released once the first watch exits");
});

test("AC17 (unit): watchLockPath is a sidecar dotfile next to the mailbox file, never a separate directory", { timeout: 20000 }, () => {
  const lockPath = watchLockPath("/a/b/to-lane.md");
  assert.equal(lockPath, "/a/b/.to-lane.md.watch-lock");
});

// ---------------------------------------------------------------------------
// AC18 — --send auto-stamps seq/time/re/hop per docs/lane-protocol.md §5
// ---------------------------------------------------------------------------

test("AC18: --send auto-stamps seq (last+1), a real UTC time, file-qualified re, and an explicit --hop, appending exactly one block", { timeout: 20000 }, async (t) => {
  const file = mkMailboxFile(t, "e177b-ac18-a", "to-integrator.md");
  fs.writeFileSync(file, "");
  const { outLines, errLines, io } = collectIo();

  const code1 = await main(
    [file, "--send", "--from", "e177b", "--type", "report", "--re", "1", "--body", "first message", "--hop", "2/10"],
    io,
  );
  assert.equal(code1, EXIT_NEW_MESSAGE);
  assert.match(outLines[0], /^sent: to-integrator\.md#1 \(type report, re to-lane#1, hop 2\/10\)$/);

  const code2 = await main(
    [file, "--send", "--from", "e177b", "--type", "ack", "--re", "close", "--body", "second", "--hop", "3/10"],
    io,
  );
  assert.equal(code2, EXIT_NEW_MESSAGE);
  assert.match(outLines[1], /^sent: to-integrator\.md#2 \(type ack, re close, hop 3\/10\)$/);

  const headers = parseMessageHeaders(fs.readFileSync(file, "utf-8"));
  assert.equal(headers.length, 2);
  assert.equal(headers[0].seq, "1");
  assert.equal(headers[1].seq, "2", "seq must auto-increment from the file's own last seq, never reset");
  assert.equal(headers[0].from, "e177b");
  assert.equal(headers[0].re, "to-lane#1", "a bare numeric --re on to-integrator.md resolves to the OTHER file, to-lane, file-qualified");
  assert.ok(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/.test(headers[0].time), `time must be a real UTC ISO-8601-to-the-second stamp: ${headers[0].time}`);
  assert.equal(headers[0].hop, "2/10");
  assert.equal(errLines.length, 0);
});

test("AC18: to-integrator.md may only be sent BY a lane, never by the integrator, and vice versa for to-lane.md", { timeout: 20000 }, async (t) => {
  const fileToIntegrator = mkMailboxFile(t, "e177b-ac18-b", "to-integrator.md");
  fs.writeFileSync(fileToIntegrator, "");
  const { io: io1 } = collectIo();
  const code1 = await main(
    [fileToIntegrator, "--send", "--from", "integrator", "--type", "report", "--re", "1", "--body", "x", "--hop", "1/10"],
    io1,
  );
  assert.equal(code1, EXIT_USAGE, "a direction violation is a usage error, not a runtime error");

  const fileToLane = mkMailboxFile(t, "e177b-ac18-c", "to-lane.md");
  fs.writeFileSync(fileToLane, "");
  const { io: io2 } = collectIo();
  const code2 = await main(
    [fileToLane, "--send", "--from", "e177b", "--type", "report", "--re", "1", "--body", "x", "--hop", "1/10"],
    io2,
  );
  assert.equal(code2, EXIT_USAGE);
});

test("AC18: --send refuses a --body containing a `--- msg` line (would corrupt message counting) and an unknown --type", { timeout: 20000 }, async (t) => {
  const file = mkMailboxFile(t, "e177b-ac18-d", "to-integrator.md");
  fs.writeFileSync(file, "");
  const { io: io1 } = collectIo();
  const bad = await main(
    [file, "--send", "--from", "e177b", "--type", "report", "--re", "1", "--body", "line one\n--- msg\nline two", "--hop", "1/10"],
    io1,
  );
  assert.equal(bad, EXIT_USAGE);
  assert.equal(fs.readFileSync(file, "utf-8"), "", "a rejected send must never partially write");

  const { io: io2 } = collectIo();
  const badType = await main(
    [file, "--send", "--from", "e177b", "--type", "not-a-real-type", "--re", "1", "--body", "x", "--hop", "1/10"],
    io2,
  );
  assert.equal(badType, EXIT_USAGE);
  assert.ok(MESSAGE_TYPES.includes("report"), "sanity: the accepted-type list itself is non-empty");
});

test("AC18: on the lane side, --hop is derived from the real handoff's hop_count and the REAL exported HOP_CAP_EXPORTED when --hop is omitted", { timeout: 20000 }, async (t) => {
  const ws = mkTmpDir(t, "e177b-ac18-ws-");
  fs.mkdirSync(path.join(ws, ".current"), { recursive: true });
  resetSession();
  await writeHandoffState({
    workspacePath: ws,
    activeFeature: "e177b-ac18-hop",
    status: "In_Progress",
    completedTasks: [],
    pendingNotes: [],
    lastAgent: "sr-engineer",
    hopCount: 4,
  });

  const file = mkMailboxFile(t, "e177b-ac18-e", "to-integrator.md");
  fs.writeFileSync(file, "");
  const { outLines, io } = collectIo();
  const code = await main(
    [file, "--send", "--from", "e177b", "--type", "report", "--re", "1", "--body", "x", "--workspace", ws],
    io,
  );
  assert.equal(code, EXIT_NEW_MESSAGE);
  assert.match(outLines[0], new RegExp(`hop 4/${HOP_CAP_EXPORTED}\\)$`));
  const headers = parseMessageHeaders(fs.readFileSync(file, "utf-8"));
  assert.equal(headers[0].hop, `4/${HOP_CAP_EXPORTED}`);
});

test("AC18: the integrator side always stamps hop `—`, never a number", { timeout: 20000 }, async (t) => {
  const file = mkMailboxFile(t, "e177b-ac18-f", "to-lane.md");
  fs.writeFileSync(file, "");
  const { io } = collectIo();
  const code = await main([file, "--send", "--from", "integrator", "--type", "reply", "--re", "1", "--body", "x"], io);
  assert.equal(code, EXIT_NEW_MESSAGE);
  const headers = parseMessageHeaders(fs.readFileSync(file, "utf-8"));
  assert.equal(headers[0].hop, "—");
});

test("AC18 (unit): normalizeRe resolves a bare number to the OTHER file of the pair, file-qualified, and keeps a short topic verbatim", { timeout: 20000 }, () => {
  assert.equal(normalizeRe("3", "to-integrator.md"), "to-lane#3");
  assert.equal(normalizeRe("3", "to-lane.md"), "to-integrator#3");
  assert.equal(normalizeRe("to-lane#5", "to-integrator.md"), "to-lane#5");
  assert.equal(normalizeRe("close", "to-integrator.md"), "close");
  assert.throws(() => normalizeRe("", "to-lane.md"), /requires a value/);
});

test("AC18 (unit): nextSeq is the file's max header seq + 1, and 1 for an empty/absent file", { timeout: 20000 }, () => {
  assert.equal(nextSeq(""), 1);
  assert.equal(nextSeq("--- msg\nseq: 1\n---\nb\n--- msg\nseq: 7\n---\nb\n--- msg\nseq: 3\n---\nb\n"), 8, "must take the MAX seq, not the last block's seq");
});

test("Security/boundary (AC18): --send rejects an empty/whitespace-only --body and a malformed --hop", { timeout: 20000 }, async (t) => {
  const file = mkMailboxFile(t, "e177b-ac18-sec", "to-integrator.md");
  fs.writeFileSync(file, "");
  const { io: io1 } = collectIo();
  const emptyBody = await main([file, "--send", "--from", "e177b", "--type", "report", "--re", "1", "--body", "   ", "--hop", "1/10"], io1);
  assert.equal(emptyBody, EXIT_USAGE);

  const { io: io2 } = collectIo();
  const badHop = await main([file, "--send", "--from", "e177b", "--type", "report", "--re", "1", "--body", "x", "--hop", "not-a-number"], io2);
  assert.equal(badHop, EXIT_USAGE);
});

// ---------------------------------------------------------------------------
// AC20 — multi-file expiring line carries EACH file's own last-read baseline;
// default deadline stays below the Monitor tool's 30-minute cap
// ---------------------------------------------------------------------------

test("AC20: DEFAULT_DEADLINE_MINUTES is fixed below the Monitor tool's 30-minute expiry cap, and is adjustable via --deadline (single- and multi-file share the same flag/default)", { timeout: 20000 }, () => {
  assert.ok(DEFAULT_DEADLINE_MINUTES < 30, `default deadline must announce its own expiry before Monitor's 30-minute cap: got ${DEFAULT_DEADLINE_MINUTES}`);
  assert.equal(DEFAULT_DEADLINE_MINUTES, 29);
  assert.ok(DEFAULT_INTERVAL_SECONDS > 0);
  const parsed = parseMailboxArgs(["/a", "/b", "--deadline", "10"]);
  assert.equal(parsed.deadlineMinutes, 10);
  const defaulted = parseMailboxArgs(["/a"]);
  assert.equal(defaulted.deadlineMinutes, DEFAULT_DEADLINE_MINUTES);
});

test("AC20: a multi-file watch's expiring line carries EACH file's own last-read baseline as `key=N,key2=N2,...`, parseable back exactly", { timeout: 20000 }, async (t) => {
  const fileA = mkMailboxFile(t, "e204b");
  const fileB = mkMailboxFile(t, "e180b");
  fs.writeFileSync(fileA, "");
  appendMsg(fileB); // fileB starts with ONE message already on disk
  appendMsg(fileB);

  let clock = 0;
  const { outLines, io } = collectIo({
    now: () => clock,
    date: () => new Date(clock),
    sleep: async (ms) => {
      clock += ms;
    },
  });
  const code = await main([fileA, fileB, "--baseline", "0", "--deadline", "1", "--interval", "100000"], io);
  assert.equal(code, EXIT_EXPIRED);
  const rearmLine = outLines[outLines.length - 1];
  const match = /--baseline (\S+)/.exec(rearmLine);
  assert.ok(match, `expected a --baseline suffix on the re-arm line: ${rearmLine}`);
  const keys = ["e204b", "e180b"];
  const parsedBack = parseBaselineArg(match[1], keys);
  assert.equal(parsedBack.get("e204b"), 0);
  assert.equal(parsedBack.get("e180b"), 2, "fileB's own pre-existing 2 messages must be its printed last-read baseline");
});

test("AC20 (unit): assignKeys refuses two DIFFERENT files that resolve to the SAME lane key (same parent-dir basename under different roots)", { timeout: 20000 }, (t) => {
  const rootX = mkTmpDir(t, "e177b-keyX-");
  const rootY = mkTmpDir(t, "e177b-keyY-");
  fs.mkdirSync(path.join(rootX, "e204"), { recursive: true });
  fs.mkdirSync(path.join(rootY, "e204"), { recursive: true });
  const fileX = path.join(rootX, "e204", "to-integrator.md");
  const fileY = path.join(rootY, "e204", "to-integrator.md");
  fs.writeFileSync(fileX, "");
  fs.writeFileSync(fileY, "");
  assert.throws(() => assignKeys([fileX, fileY]), /duplicate baseline key "e204"/);
});

test("AC20 (unit): parseBaselineArg — a bare integer arms every watched key at N; per-key form rejects an unknown or repeated key", { timeout: 20000 }, () => {
  const keys = ["e204", "e180"];
  const uniform = parseBaselineArg("5", keys);
  assert.equal(uniform.get("e204"), 5);
  assert.equal(uniform.get("e180"), 5);
  assert.throws(() => parseBaselineArg("e204=1,nope=2", keys), /matches no watched file/);
  assert.throws(() => parseBaselineArg("e204=1,e204=2", keys), /given twice/);
  assert.throws(() => parseBaselineArg("", keys), /empty --baseline/);
});

// ---------------------------------------------------------------------------
// Security / boundary smoke
// ---------------------------------------------------------------------------

test("Security/boundary: laneKeyForFile and formatUtcSecond never throw on boundary inputs", { timeout: 20000 }, () => {
  assert.equal(laneKeyForFile("to-lane.md"), path.basename(path.dirname(path.resolve("to-lane.md"))));
  assert.doesNotThrow(() => formatUtcSecond(new Date(0)));
  assert.equal(formatUtcSecond(new Date("2026-01-01T00:00:00.999Z")), "2026-01-01T00:00:00Z");
});

test("Security/boundary: main() with no mailbox file argument exits with the reserved usage code, never crashing", { timeout: 20000 }, async () => {
  const { io } = collectIo();
  const code = await main([], io);
  assert.equal(code, EXIT_USAGE);
});
