// Coded by @qa-engineer
// Tests (T-E178B-04) for `lane-status --watch` (tools/lane-status.ts runLaneWatch + helpers, scripts/lane-status.mjs routing), per specs/e178b-lane-watch-tooling.md decisions (a)-(f), (j), AC1-AC9
// and the watch half of the cut pre-review check, AC15 (AC10-AC14 are in test/e178b-cut-prereview.test.mjs; AC20 is recorded in qa_reports/review_T-E178B-04.md). The contract is never losing an event: every
// watched-field transition prints exactly one line, a lane that breaks or leaves is said, not dropped, and a transition between two watches fires after the re-arm, whose command carries the fingerprints this watch last read (decision (d)).
// runLaneWatch is driven in-process with an injected lane provider, handoff reader and fake-clock io; only AC7's no-git proof and AC9's end-to-end run use real subprocesses. Case names carry the AC.
// Rationale: specs/e260f-comment-rationale.md (test/e178b-lane-watch.test.mjs).

import { test } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { createHash } from "node:crypto";
import { execFileSync, spawn, spawnSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";

import {
  runLaneWatch,
  runLaneStatusCli,
  formatWatchState,
  watchFingerprint,
  WATCH_DEFAULT_DEADLINE_MINUTES,
  WATCH_DEFAULT_INTERVAL_SECONDS,
  WATCH_EXIT_ERROR,
  WATCH_EXIT_EXPIRED,
  WATCH_EXIT_USAGE,
  WATCH_FINGERPRINT_LENGTH,
  WATCH_STATE_KEYS,
  LANE_STATUS_USAGE,
} from "../dist/tools/lane-status.js";
import * as mailboxWatch from "../scripts/mailbox-watch.mjs";
import { writeHandoffState } from "../dist/tools/handoff.js";
import { resetSession } from "../dist/guards/session.js";

const __filename = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(__filename), "..");
const SCRIPT = path.join(ROOT, "scripts", "lane-status.mjs");
const DIST_LANE_STATUS = path.join(ROOT, "dist", "tools", "lane-status.js");

// ---------------------------------------------------------------------------
// In-process harness
// ---------------------------------------------------------------------------

/** A handoff as parseHandoff returns it (only the fields the watch reads + noise). */
function handoff(feature, over = {}) {
  return {
    active_feature: feature,
    status: "In_Progress",
    last_agent: "pm",
    next_role: "sr-engineer",
    hop_count: 1,
    review_round: 0,
    qa_round: 0,
    last_updated: "2026-09-27T00:00:00.000Z",
    pending_notes: [],
    completed_tasks: [],
    ...over,
  };
}

/** The decision (c) state line for a handoff, spelled out independently of the tool. */
function stateLine(h, prereview) {
  const v = (x) => (x === null || x === undefined || String(x).trim() === "" ? "-" : String(x).trim().replace(/\s+/g, "_"));
  const parts = [
    `feature=${v(h.active_feature)}`,
    `status=${v(h.status)}`,
    `last_agent=${v(h.last_agent)}`,
    `next_role=${v(h.next_role)}`,
    `hop=${v(h.hop_count)}`,
    `review_round=${v(h.review_round)}`,
    `qa_round=${v(h.qa_round)}`,
  ];
  if (prereview !== undefined) parts.push(`cut_prereview=${prereview}`);
  return parts.join(" ");
}

const fp = (line) => createHash("sha256").update(line, "utf8").digest("hex").slice(0, 12);

/**
 * World model: `lanes` maps a lane key (worktree basename) to
 * { ws, handoff | Error | null, info?: partial LaneInfo override }.
 * `present` is the ordered list of keys the provider returns this tick.
 */
function mkWorld(entries, base = "/fake/agm-lanes") {
  const lanes = new Map();
  for (const [key, h] of entries) lanes.set(key, { ws: path.join(base, key), handoff: h });
  return { lanes, present: [...lanes.keys()], providerThrows: false, providerCalls: 0, readerCalls: 0 };
}

function providerFor(world) {
  return () => {
    world.providerCalls++;
    if (world.providerThrows) throw new Error("git worktree list exploded\nsecond line");
    return {
      source: "lane-registry",
      degraded: false,
      lanes: world.present.map((k) => {
        const l = world.lanes.get(k);
        return {
          workspacePath: l.ws,
          branch: `feat/${k}`,
          activeFeature: null,
          status: null,
          hopCount: null,
          lastAgent: null,
          lastUpdated: null,
          readable: true,
          ...(l.info ?? {}),
        };
      }),
    };
  };
}

function readerFor(world) {
  return (ws) => {
    world.readerCalls++;
    for (const l of world.lanes.values()) {
      if (l.ws !== ws) continue;
      if (l.handoff instanceof Error) throw l.handoff;
      return l.handoff;
    }
    return null;
  };
}

/**
 * Run the watch to completion on a fake clock. `onSleep(n, world, nowMs)`
 * runs after the n-th sleep (1-based), BEFORE the watch decides expiry or
 * reads the next tick — i.e. it is "what changed on disk meanwhile".
 */
async function runWatch(argv, world, { onSleep } = {}) {
  const out = [];
  const err = [];
  let now = 1_000_000;
  let sleeps = 0;
  const code = await runLaneWatch(argv, {
    laneListProvider: providerFor(world),
    handoffReader: readerFor(world),
    io: {
      out: (l) => out.push(l),
      err: (l) => err.push(l),
      now: () => now,
      sleep: async (ms) => {
        now += ms;
        sleeps++;
        if (onSleep) await onSleep(sleeps, world, now);
      },
    },
  });
  return { code, out, err, sleeps };
}

// ---------------------------------------------------------------------------
// AC1 — a baseline is printed when the watch starts
// ---------------------------------------------------------------------------

test("AC1 baseline on start", async () => {
  const a = handoff("e901-alpha");
  const b = handoff("e902-beta", { next_role: undefined, status: "Blocked", hop_count: 4, review_round: 2 });
  const world = mkWorld([["alpha", a], ["beta", b]]);
  const r = await runWatch(["--watch", "--deadline", "1"], world);

  assert.equal(r.out[0], "armed: watching 2 lane(s) — interval 30s, deadline 1 min");
  // Exactly one baseline line per lane, in lane-list order, state in the
  // decision (c) key order; an absent value is `-`.
  assert.equal(r.out[1], `[alpha] baseline: ${stateLine(a)}`);
  assert.equal(r.out[2], `[beta] baseline: ${stateLine(b)}`);
  assert.match(r.out[2], /next_role=- /);
  assert.equal(r.out.filter((l) => l.includes("baseline:")).length, 2);
  assert.deepEqual(
    r.out[1].split(": ")[1].split(" ").map((kv) => kv.split("=")[0]),
    [...WATCH_STATE_KEYS],
    "state keys in the fixed decision (c) order",
  );
  assert.equal(r.code, WATCH_EXIT_EXPIRED);

  // Defaults: interval 30 s, deadline 29 min (decision (f)).
  const d = await runWatch(["--watch"], mkWorld([["alpha", a]]));
  assert.equal(d.out[0], "armed: watching 1 lane(s) — interval 30s, deadline 29 min");
  assert.equal(d.sleeps, 29 * 2, "29 min / 30 s ticks, then expiry");
});

// ---------------------------------------------------------------------------
// AC2 — one line per watched-field transition; changes to other fields stay silent
// ---------------------------------------------------------------------------

test("AC2 transition line", async () => {
  const world = mkWorld([["alpha", handoff("e901-alpha")], ["beta", handoff("e902-beta")]]);
  const r = await runWatch(["--watch", "--deadline", "2"], world, {
    onSleep(n, w) {
      const alpha = w.lanes.get("alpha");
      // Tick 1: two keys move (written in reverse key order on purpose).
      if (n === 1) alpha.handoff = { ...alpha.handoff, last_agent: "qa-engineer", status: "PASS" };
      // Tick 2: feature + hop move — Δ must list them in KEY order.
      if (n === 2) alpha.handoff = { ...alpha.handoff, hop_count: 2, active_feature: "e903-gamma" };
      // Tick 3: nothing moves.
    },
  });
  const changed = r.out.filter((l) => l.includes(" changed: "));
  const s1 = handoff("e901-alpha", { last_agent: "qa-engineer", status: "PASS" });
  const s2 = { ...s1, hop_count: 2, active_feature: "e903-gamma" };
  assert.deepEqual(changed, [
    `[alpha] changed: ${stateLine(s1)} — Δ status,last_agent`,
    `[alpha] changed: ${stateLine(s2)} — Δ feature,hop`,
  ]);
  assert.equal(r.out.filter((l) => l.startsWith("[beta]")).length, 1, "beta: baseline only");
  assert.equal(r.code, WATCH_EXIT_EXPIRED);
});

test("AC2 non-watched field silent", async () => {
  const world = mkWorld([["alpha", handoff("e901-alpha")]]);
  const r = await runWatch(["--watch", "--deadline", "2"], world, {
    onSleep(n, w) {
      const alpha = w.lanes.get("alpha");
      alpha.handoff = {
        ...alpha.handoff,
        last_updated: new Date(Date.UTC(2026, 8, 27, 0, n)).toISOString(),
        pending_notes: [`note ${n}`],
        completed_tasks: Array.from({ length: n }, (_, i) => `T-${i}`),
        dispatched_at: `x${n}`,
      };
    },
  });
  assert.deepEqual(r.out.slice(0, 2), [
    "armed: watching 1 lane(s) — interval 30s, deadline 2 min",
    `[alpha] baseline: ${stateLine(handoff("e901-alpha"))}`,
  ]);
  assert.equal(r.out.filter((l) => l.startsWith("[alpha]")).length, 1, `only the baseline:\n${r.out.join("\n")}`);
  assert.ok(r.sleeps >= 3, "several ticks actually ran");
});

// ---------------------------------------------------------------------------
// AC3 — a lane that breaks or leaves is reported, not silently dropped
// ---------------------------------------------------------------------------

test("AC3 degrade honestly", async () => {
  const world = mkWorld([
    ["alpha", handoff("e901-alpha")],
    ["beta", handoff("e902-beta")],
    ["gamma", handoff("e903-gamma")],
  ]);
  world.lanes.set("delta", { ws: "/fake/agm-lanes/delta", handoff: handoff("e904-delta") });
  const r = await runWatch(["--watch", "--deadline", "4"], world, {
    onSleep(n, w) {
      if (n === 1) w.lanes.get("alpha").handoff = new Error("bad yaml at line 3\n  context line");
      if (n === 2) {
        w.present = ["alpha", "gamma", "delta"]; // beta gone, delta appears
        w.lanes.get("gamma").handoff = null; // handoff file vanished
      }
      if (n === 3) w.providerThrows = true; // whole list unavailable one tick
      if (n === 4) {
        w.providerThrows = false;
        w.lanes.get("alpha").handoff = handoff("e901-alpha", { status: "PASS" }); // recovers
        w.lanes.get("delta").info = { readable: false, error: "frontmatter unparseable\nmore" };
      }
      if (n === 5) w.lanes.get("gamma").handoff = handoff("e903-gamma", { active_feature: "" });
    },
  });

  const events = r.out.filter((l) => !l.includes("baseline:") && !l.startsWith("armed:"));
  assert.deepEqual(events.slice(0, -2), [
    "[alpha] changed: unreadable (handoff unparseable: bad yaml at line 3)",
    "[beta] gone",
    "[gamma] changed: unreadable (handoff not found)",
    "[delta] appeared: " + stateLine(handoff("e904-delta")),
    // tick 3: provider threw -> no line on stdout, nothing reported gone.
    `[alpha] changed: ${stateLine(handoff("e901-alpha", { status: "PASS" }))}`,
    "[delta] changed: unreadable (frontmatter unparseable)",
    "[gamma] changed: unreadable (handoff has no active_feature (missing or unparseable frontmatter))",
  ]);
  assert.ok(
    r.err.some((l) => /^lane-status: lane list unavailable this tick: lane list provider threw: git worktree list exploded \(keeping last states\)$/.test(l)),
    r.err.join("\n"),
  );
  assert.equal(events.at(-2), "expiring — re-arm");
  assert.equal(r.code, WATCH_EXIT_EXPIRED, "kept running to the deadline, never threw");

  // A list that is unavailable from the very first read is a runtime error (exit 1).
  const dead = mkWorld([["alpha", handoff("e901-alpha")]]);
  dead.providerThrows = true;
  const d = await runWatch(["--watch"], dead);
  assert.equal(d.code, WATCH_EXIT_ERROR);
  assert.match(d.err[0], /^lane-status: cannot start watch — lane list unavailable: /);
  assert.deepEqual(d.out, []);
});

test("AC3 degrade honestly: degraded-empty list and duplicate basenames", async () => {
  // A degraded provider result with zero lanes (git failed) is "list
  // unavailable", never "every lane gone".
  const world = mkWorld([["alpha", handoff("e901-alpha")]]);
  let degradedNow = false;
  const base = providerFor(world);
  const provider = (repo) => (degradedNow ? { source: "local-fallback", degraded: true, degradedReason: "git worktree list failed\nx", lanes: [] } : base(repo));
  const out = [];
  const err = [];
  let now = 0;
  let n = 0;
  const code = await runLaneWatch(["--watch", "--deadline", "1"], {
    laneListProvider: provider,
    handoffReader: readerFor(world),
    io: { out: (l) => out.push(l), err: (l) => err.push(l), now: () => now, sleep: async (ms) => { now += ms; degradedNow = ++n === 1; } },
  });
  assert.equal(code, WATCH_EXIT_EXPIRED);
  assert.equal(out.filter((l) => l.endsWith(" gone")).length, 0, out.join("\n"));
  assert.deepEqual(err, ["lane-status: lane list unavailable this tick: git worktree list failed (keeping last states)"]);

  // Two worktrees with the same basename: reported once on stderr, the first
  // is watched, never merged or overwritten.
  const dup = mkWorld([["alpha", handoff("e901-alpha")]]);
  dup.lanes.set("alpha-2", { ws: "/other/root/alpha", handoff: handoff("e999-other") });
  dup.present.push("alpha-2");
  const r = await runWatch(["--watch", "--deadline", "2"], dup);
  assert.equal(r.out[0], "armed: watching 1 lane(s) — interval 30s, deadline 2 min");
  assert.equal(r.out[1], `[alpha] baseline: ${stateLine(handoff("e901-alpha"))}`);
  assert.equal(r.err.filter((l) => l.startsWith('lane-status: duplicate lane key "alpha"')).length, 1, r.err.join("\n"));
});

// ---------------------------------------------------------------------------
// AC4 — deadline expiry (exit 3) prints the re-arm command
// ---------------------------------------------------------------------------

test("AC4 expiry and re-arm command", async (t) => {
  const tmp = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "e178b-ac4-")));
  t.after(() => fs.rmSync(tmp, { recursive: true, force: true }));
  const mbox = path.join(tmp, "mailbox");
  const repo = path.join(tmp, "repo");
  fs.mkdirSync(mbox);
  fs.mkdirSync(repo);

  const a0 = handoff("e901-alpha");
  const a1 = { ...a0, status: "PASS" };
  const world = mkWorld([["alpha", a0], ["beta", handoff("e902-beta")]]);
  let readsAtLastTick = -1;
  const r = await runWatch(
    ["--watch", "--lanes", "alpha,beta", "--interval", "45", "--deadline", "2", "--mailbox-root", mbox, "--repo", repo],
    world,
    {
      onSleep(n, w, now) {
        if (n === 1) w.lanes.get("alpha").handoff = a1; // read at tick 1 (45 s)
        if (n === 3) {
          // The sleep that reaches the deadline (120 s). A change landing now
          // must NOT be read: the re-arm carries what this watch last READ,
          // so the next watch reports it as `changed since last watch`.
          readsAtLastTick = w.readerCalls;
          w.lanes.get("alpha").handoff = { ...a1, status: "Blocked" };
        }
      },
    },
  );
  assert.equal(r.code, WATCH_EXIT_EXPIRED);
  assert.equal(r.sleeps, 3, "45 s, 90 s, then the 30 s remainder to the deadline");
  assert.equal(world.readerCalls, readsAtLastTick, "no fresh read at expiry");
  assert.equal(r.out.at(-2), "expiring — re-arm");
  // No spec in the fake worktrees -> cut_prereview=n/a (mailbox root given).
  const alphaLine = stateLine(a1, "n/a");
  const betaLine = stateLine(handoff("e902-beta"), "n/a");
  assert.equal(
    r.out.at(-1),
    `node scripts/lane-status.mjs --watch --lanes alpha,beta --interval 45 --deadline 2 --mailbox-root ${mbox} --repo ${repo} --baseline alpha=${fp(alphaLine)},beta=${fp(betaLine)}`,
  );

  // Default interval/deadline are not carried; nor are absent optional flags.
  const d = await runWatch(["--watch", "--interval", "30", "--deadline", "29"], mkWorld([["alpha", a0]]));
  assert.equal(d.out.at(-1), `node scripts/lane-status.mjs --watch --baseline alpha=${fp(stateLine(a0))}`);

  // A path needing shell quoting is quoted, so the printed command is runnable.
  const q = await runWatch(["--watch", "--deadline", "1", "--repo", "/tmp/with space"], mkWorld([["alpha", a0]]));
  assert.match(q.out.at(-1), / --repo '\/tmp\/with space' --baseline /);
});

// ---------------------------------------------------------------------------
// AC5 — the re-arm command round-trips the last-read fingerprints
// ---------------------------------------------------------------------------

test("AC5 re-arm round trip", async () => {
  const world = mkWorld([["alpha", handoff("e901-alpha")], ["beta", handoff("e902-beta")]]);
  const first = await runWatch(["--watch", "--deadline", "1"], world);
  const cmd = first.out.at(-1);
  const baseline = / --baseline (\S+)$/.exec(cmd)[1];

  // Fed back with nothing changed: zero `changed since last watch` lines.
  const again = await runWatch(["--watch", "--deadline", "1", "--baseline", baseline], world);
  assert.equal(again.code, WATCH_EXIT_EXPIRED);
  assert.equal(again.out.filter((l) => l.includes("changed since last watch")).length, 0, again.out.join("\n"));
  assert.equal(again.out.filter((l) => l.includes(" baseline: ")).length, 2);
  assert.equal(again.out.at(-1), cmd, "an unchanged world re-arms with the same command");

  // A transition landing BETWEEN the two watches fires on start; a lane not
  // named in --baseline (a new worktree) just prints baseline:.
  const moved = handoff("e901-alpha", { status: "PASS", last_agent: "qa-engineer" });
  world.lanes.get("alpha").handoff = moved;
  world.lanes.set("gamma", { ws: "/fake/agm-lanes/gamma", handoff: handoff("e903-gamma") });
  world.present.push("gamma");
  const gap = await runWatch(["--watch", "--deadline", "1", "--baseline", baseline], world);
  assert.deepEqual(gap.out.slice(1, 4), [
    `[alpha] changed since last watch: ${stateLine(moved)}`,
    `[beta] baseline: ${stateLine(handoff("e902-beta"))}`,
    `[gamma] baseline: ${stateLine(handoff("e903-gamma"))}`,
  ]);

  // An unknown key in the default set is a lane that closed since the last
  // watch (e223 decision (a), superseding this spec's AC5 sentence for the
  // default set): reported `gone` once, never a usage error, so a re-arm
  // command printed before a worktree was removed keeps working.
  const good = fp(stateLine(handoff("e902-beta")));
  const zeta = await runWatch(["--watch", "--deadline", "1", "--baseline", `zeta=${good}`], world);
  assert.equal(zeta.code, WATCH_EXIT_EXPIRED, zeta.err.join("\n"));
  assert.equal(zeta.out.filter((l) => l === "[zeta] gone").length, 1, zeta.out.join("\n"));

  // Usage errors (exit 64): malformed entries, repeated key (known or gone), empty.
  for (const bad of [
    "alpha", // no =
    `=${good}`, // empty key
    "alpha=xyz", // not a fingerprint
    `alpha=${good.toUpperCase()}`, // uppercase hex
    `alpha=${good}0`, // 13 chars
    `alpha=${good},alpha=${good}`, // repeated
    `zeta=${good},zeta=${good}`, // repeated gone key (e223 decision (b))
    ",", // empty
  ]) {
    const r = await runWatch(["--watch", "--deadline", "1", "--baseline", bad], world);
    assert.equal(r.code, WATCH_EXIT_USAGE, `--baseline ${bad}`);
    assert.match(r.err[0], /^lane-status: /, `--baseline ${bad}: usage message`);
    assert.deepEqual(r.out, [], `--baseline ${bad}: nothing armed`);
  }
});

// ---------------------------------------------------------------------------
// AC6 — argument validation rules for the watch flags
// ---------------------------------------------------------------------------

test("AC6 argument rules", async () => {
  const world = mkWorld([["alpha", handoff("e901-alpha")], ["beta", handoff("e902-beta")], ["gamma", handoff("e903-gamma")]]);
  for (const argv of [
    ["--watch", "--rollup", "e901-alpha"],
    ["--watch", "--all"],
    ["--watch", "--json"],
    ["--watch", "--interval", "0"],
    ["--watch", "--interval", "-5"],
    ["--watch", "--interval", "1.5"],
    ["--watch", "--interval", "abc"],
    ["--watch", "--interval"],
    ["--watch", "--deadline", "0"],
    ["--watch", "--deadline", "2x"],
    ["--watch", "--bogus"],
  ]) {
    const r = await runWatch(argv, world);
    assert.equal(r.code, WATCH_EXIT_USAGE, argv.join(" "));
    assert.match(r.err[0], /^lane-status: /, `${argv.join(" ")}: usage message`);
    assert.ok(r.err[0].includes(LANE_STATUS_USAGE), `${argv.join(" ")}: usage text follows`);
    assert.deepEqual(r.out, []);
  }
  // runLaneWatch without --watch, and the sync CLI handed --watch, both refuse (64).
  const noWatch = await runWatch([], world);
  assert.equal(noWatch.code, WATCH_EXIT_USAGE);
  assert.match(noWatch.err[0], /^lane-status: runLaneWatch requires --watch/);
  const syncWatch = runLaneStatusCli(["--watch"], { laneListProvider: providerFor(world), handoffReader: readerFor(world) });
  assert.equal(syncWatch.exitCode, 64);
  assert.match(syncWatch.output, /^lane-status: --watch is served by runLaneWatch/);
  // Watch-only flags without --watch are a usage error on the one-shot path.
  for (const argv of [["--interval", "5"], ["--deadline", "5"], ["--baseline", "a=0123456789ab"]]) {
    const r = runLaneStatusCli(argv, { laneListProvider: providerFor(world), handoffReader: readerFor(world) });
    assert.equal(r.exitCode, 64, argv.join(" "));
    assert.match(r.output, /^lane-status: /);
  }

  // --lanes restricts the watched set (basename, case-insensitive); a name
  // that matches nothing is reported gone ONCE and the watch keeps running;
  // if it later shows up it `appeared:`.
  const r = await runWatch(["--watch", "--deadline", "2", "--lanes", "alpha,GAMMA,nope"], world, {
    onSleep(n, w) {
      w.lanes.get("beta").handoff = handoff("e902-beta", { hop_count: 10 + n }); // unwatched: silent
      if (n === 3) {
        w.lanes.set("nope", { ws: "/fake/agm-lanes/nope", handoff: handoff("e909-nope") });
        w.present.push("nope");
      }
    },
  });
  assert.deepEqual(r.out.slice(0, 4), [
    "armed: watching 3 lane(s) — interval 30s, deadline 2 min",
    `[alpha] baseline: ${stateLine(handoff("e901-alpha"))}`,
    `[GAMMA] baseline: ${stateLine(handoff("e903-gamma"))}`,
    "[nope] gone",
  ]);
  assert.equal(r.out.filter((l) => l === "[nope] gone").length, 1, "gone reported once");
  assert.equal(r.out.filter((l) => l.startsWith("[beta]")).length, 0, "beta is not watched");
  assert.ok(r.out.includes(`[nope] appeared: ${stateLine(handoff("e909-nope"))}`), r.out.join("\n"));
  assert.equal(r.code, WATCH_EXIT_EXPIRED);
});

// ---------------------------------------------------------------------------
// AC7 — each tick reads only the lane list and handoffs (no git)
// ---------------------------------------------------------------------------

test("AC7 tick reads only list + handoff", { timeout: 60000 }, async (t) => {
  // (1) Call accounting: every read is the provider once + the reader once
  // per lane, nothing more.
  const world = mkWorld([["alpha", handoff("e901-alpha")], ["beta", handoff("e902-beta")]]);
  const r = await runWatch(["--watch", "--deadline", "2"], world);
  const reads = 1 + (r.sleeps - 1); // start read + one per non-expiry sleep
  assert.equal(world.providerCalls, reads);
  assert.equal(world.readerCalls, reads * 2);

  // (2) No git subprocess: run a watch in a child whose PATH holds ONLY a
  // fake `git` that logs its argv. A positive control (computeLaneStatus,
  // which DOES run git log/status) proves the trap catches real calls.
  const tmp = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "e178b-ac7-")));
  t.after(() => fs.rmSync(tmp, { recursive: true, force: true }));
  const bin = path.join(tmp, "bin");
  fs.mkdirSync(bin);
  const log = path.join(tmp, "git-calls.log");
  fs.writeFileSync(path.join(bin, "git"), `#!/bin/sh\necho "$@" >> '${log}'\nexit 1\n`, { mode: 0o755 });
  const ws = path.join(tmp, "alpha");
  fs.mkdirSync(path.join(ws, "qa_reports"), { recursive: true });
  const child = (body) => `
    import * as ls from ${JSON.stringify(pathToFileURL(DIST_LANE_STATUS).href)};
    const provider = () => ({ source: "lane-registry", degraded: false, lanes: [{ workspacePath: ${JSON.stringify(ws)}, branch: "feat/alpha", activeFeature: "e901-alpha", status: "In_Progress", hopCount: 1, lastAgent: "pm", lastUpdated: null, readable: true, completedTasks: ["T-E901-01"] }] });
    const reader = () => ({ active_feature: "e901-alpha", status: "In_Progress", last_agent: "pm", hop_count: 1, review_round: 0, qa_round: 0, completed_tasks: ["T-E901-01"] });
    ${body}`;
  const watchBody = `
    let now = 0;
    const code = await ls.runLaneWatch(["--watch", "--deadline", "2", "--repo", ${JSON.stringify(tmp)}], {
      laneListProvider: provider, handoffReader: reader,
      io: { out: () => {}, err: () => {}, now: () => now, sleep: async (ms) => { now += ms; } },
    });
    process.exitCode = code === 3 ? 0 : 1;`;
  const env = { ...process.env, PATH: bin };
  const w = spawnSync(process.execPath, ["--input-type=module", "-e", child(watchBody)], { env, encoding: "utf8", timeout: 30000 });
  assert.equal(w.status, 0, w.stderr);
  assert.equal(fs.existsSync(log), false, `the watch ran git: ${fs.existsSync(log) ? fs.readFileSync(log, "utf8") : ""}`);

  const controlBody = `ls.computeLaneStatus({ repoRoot: ${JSON.stringify(tmp)}, laneListProvider: provider, handoffReader: reader, gitTimeoutMs: 5000 });`;
  const c = spawnSync(process.execPath, ["--input-type=module", "-e", child(controlBody)], { env, encoding: "utf8", timeout: 30000 });
  assert.equal(c.status, 0, c.stderr);
  assert.match(fs.readFileSync(log, "utf8"), /^log /m, "positive control: the one-shot path's git log is caught");

  // (3) Structural: the watch section never reaches the one-shot machinery
  // (git runner, evidence cross-check, computeLaneStatus).
  const src = fs.readFileSync(path.join(ROOT, "tools", "lane-status.ts"), "utf8");
  const watchSection = src.slice(src.indexOf("// Watch mode (E178b"));
  assert.ok(watchSection.length > 1000, "watch section located");
  const code = watchSection.split("\n").filter((l) => !/^\s*(\/\/|\*|\/\*\*)/.test(l)).join("\n");
  for (const forbidden of ["runGit(", "execFileSync(", "checkLaneEvidence(", "computeLaneStatus("]) {
    assert.equal(code.includes(forbidden), false, `watch code calls ${forbidden}`);
  }
});

// ---------------------------------------------------------------------------
// AC8 — constants shared with the mailbox watch stay identical
// ---------------------------------------------------------------------------

test("AC8 constants parity", () => {
  // tools/ cannot import scripts/*.mjs (tsconfig), so the values are copies —
  // pinned here so the two watches cannot drift apart under the Monitor tool.
  assert.equal(WATCH_DEFAULT_DEADLINE_MINUTES, mailboxWatch.DEFAULT_DEADLINE_MINUTES);
  assert.equal(WATCH_EXIT_EXPIRED, mailboxWatch.EXIT_EXPIRED);
  assert.equal(WATCH_EXIT_ERROR, mailboxWatch.EXIT_ERROR);
  assert.equal(WATCH_EXIT_USAGE, mailboxWatch.EXIT_USAGE);
  assert.equal(WATCH_DEFAULT_INTERVAL_SECONDS, 30, "the prototype's 30 s, deliberately not mailbox-watch's 15 s");
  assert.equal(WATCH_FINGERPRINT_LENGTH, 12);
  // Fingerprint = first 12 hex chars of sha256(state line) (decision (d)).
  const line = formatWatchState({ lane: "x", workspacePath: "/x", readable: true, fields: [["feature", "f"]] });
  assert.equal(line, "feature=f");
  assert.equal(watchFingerprint(line), fp(line));
});

// ---------------------------------------------------------------------------
// AC9 — the real script run end to end with a short deadline
// ---------------------------------------------------------------------------

function git(args, cwd) {
  return execFileSync("git", args, { cwd, encoding: "utf-8", stdio: ["ignore", "pipe", "pipe"], timeout: 15_000 });
}

test("AC9 script end to end", { timeout: 60000 }, async (t) => {
  const primary = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "e178b-ac9-primary-")));
  const wt = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "e178b-ac9-wt-")));
  t.after(() => {
    fs.rmSync(primary, { recursive: true, force: true });
    fs.rmSync(wt, { recursive: true, force: true });
  });
  git(["init", "-q", "-b", "main"], primary);
  git(["config", "user.email", "a@b.c"], primary);
  git(["config", "user.name", "t"], primary);
  fs.writeFileSync(path.join(primary, "README.md"), "x\n");
  git(["add", "-A"], primary);
  git(["commit", "-q", "-m", "init"], primary);
  fs.rmSync(wt, { recursive: true, force: true });
  git(["worktree", "add", "-q", "-b", "feat/e905-ac9", wt], primary);
  fs.mkdirSync(path.join(wt, ".current"), { recursive: true });
  resetSession();
  await writeHandoffState({ workspacePath: wt, activeFeature: "e905-ac9", status: "In_Progress", completedTasks: [], pendingNotes: [], lastAgent: "pm" });

  const proc = spawn(process.execPath, [SCRIPT, "--watch", "--interval", "1", "--repo", primary], {
    cwd: ROOT,
    stdio: ["ignore", "pipe", "pipe"],
  });
  t.after(() => {
    if (proc.exitCode === null) proc.kill("SIGKILL");
  });
  let stdout = "";
  let stderr = "";
  proc.stdout.on("data", (d) => (stdout += d));
  proc.stderr.on("data", (d) => (stderr += d));
  const waitFor = async (pred, what, ms = 20000) => {
    const until = Date.now() + ms;
    while (!pred()) {
      if (Date.now() > until) assert.fail(`timed out waiting for ${what}\nstdout:\n${stdout}\nstderr:\n${stderr}`);
      if (proc.exitCode !== null) assert.fail(`watch exited early (${proc.exitCode}) waiting for ${what}\n${stdout}\n${stderr}`);
      await new Promise((res) => setTimeout(res, 50));
    }
  };

  await waitFor(() => stdout.split("\n").filter((l) => l.includes(" baseline: ")).length >= 2, "armed + 2 baseline lines");
  const lines = stdout.split("\n");
  assert.equal(lines[0], "armed: watching 2 lane(s) — interval 1s, deadline 29 min");
  assert.ok(lines.some((l) => l.startsWith(`[${path.basename(wt)}] baseline: feature=e905-ac9 status=In_Progress last_agent=pm `)), stdout);
  assert.ok(lines.some((l) => l.startsWith(`[${path.basename(primary)}] baseline: `)), "primary checkout is watched too (Open Question 4 default)");

  // Stays alive across ticks and streams a real transition written to disk.
  resetSession();
  await writeHandoffState({ workspacePath: wt, activeFeature: "e905-ac9", status: "Blocked", blockingReason: "ac9 probe", completedTasks: [], pendingNotes: [], lastAgent: "pm" });
  await waitFor(() => stdout.includes(`[${path.basename(wt)}] changed: `), "a changed: line for the worktree");
  assert.match(stdout, new RegExp(`\\[${path.basename(wt)}\\] changed: feature=e905-ac9 status=Blocked .* — Δ status`));
  assert.equal(proc.exitCode, null, "still running: the wrapper awaits the async runner");
  proc.kill("SIGTERM");
  await new Promise((res) => proc.once("exit", res));

  // Usage errors exit 64 through the real script.
  const bad = spawnSync(process.execPath, [SCRIPT, "--watch", "--json"], { cwd: ROOT, encoding: "utf8", timeout: 20000 });
  assert.equal(bad.status, 64);
  assert.match(bad.stderr, /^lane-status: --watch cannot be combined with --rollup, --all or --json/);
});

// ---------------------------------------------------------------------------
// AC15 — the cut pre-review transition is announced by the watch
// ---------------------------------------------------------------------------

test("AC15 prereview transition", async (t) => {
  const tmp = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "e178b-ac15-")));
  t.after(() => fs.rmSync(tmp, { recursive: true, force: true }));
  const lanesDir = path.join(tmp, "lanes");
  const mbox = path.join(tmp, "mailbox");
  const mkWs = (lane, feature, spec) => {
    const ws = path.join(lanesDir, lane);
    fs.mkdirSync(path.join(ws, "specs"), { recursive: true });
    if (spec) fs.writeFileSync(path.join(ws, "specs", `${feature}.md`), "# cut\n");
    return ws;
  };
  mkWs("cutlane", "e906-cut", true);
  mkWs("nospec", "e907-nospec", false);
  mkWs("nobox", "e908-nobox", true);
  fs.mkdirSync(path.join(mbox, "cutlane"), { recursive: true });
  fs.mkdirSync(path.join(mbox, "nospec"), { recursive: true });
  const toIntegrator = path.join(mbox, "cutlane", "to-integrator.md");
  fs.writeFileSync(toIntegrator, "--- msg\nseq: 1\nfrom: cutlane\ntype: question\nre: cut size?\n---\nq\n");

  const world = mkWorld(
    [["cutlane", handoff("e906-cut")], ["nospec", handoff("e907-nospec")], ["nobox", handoff("e908-nobox")]],
    lanesDir,
  );
  const r = await runWatch(["--watch", "--deadline", "2", "--mailbox-root", mbox], world, {
    onSleep(n) {
      if (n === 1) {
        fs.appendFileSync(toIntegrator, "--- msg\nseq: 2\nfrom: cutlane\ntype: proposal\nre: E906 PM cut pre-review\n---\np\n");
      }
    },
  });
  assert.deepEqual(r.out.slice(1, 4), [
    `[cutlane] baseline: ${stateLine(handoff("e906-cut"), "missing")}`,
    `[nospec] baseline: ${stateLine(handoff("e907-nospec"), "n/a")}`,
    `[nobox] baseline: ${stateLine(handoff("e908-nobox"), "no-mailbox")}`,
  ]);
  const changed = r.out.filter((l) => l.includes(" changed: "));
  assert.deepEqual(changed, [
    `[cutlane] changed: ${stateLine(handoff("e906-cut"), "sent_(to-integrator#2)")} — Δ cut_prereview`,
  ]);
  // The review-round-1 fix: the state line stays single key=value tokens.
  const state = changed[0].split(" changed: ")[1].split(" — Δ")[0];
  for (const tok of state.split(" ")) assert.match(tok, /^[a-z_]+=\S+$/, `token ${tok}`);
  assert.equal(r.code, WATCH_EXIT_EXPIRED);

  // Without --mailbox-root the key is absent (decision (c)/(j)).
  const plain = await runWatch(["--watch", "--deadline", "1"], world);
  assert.doesNotMatch(plain.out.join("\n"), /cut_prereview/);
});
