// Coded by @qa-engineer
// In the default `lane-status --watch` set (no --lanes), a --baseline key naming no lane in the current list is a lane that CLOSED since the last watch: it is reported `[<lane>] gone`, not a usage error.
// Spec: specs/e223-watch-rearm-gone.md decisions (a)-(g), AC1-AC4. AC5 lives in test/e178b-lane-watch.test.mjs "AC5 re-arm round trip"; AC6 (build plus full suite on a clean tree) is a one-time check. (E223, T-E223-01, T-E223-02)
// Contract: the printed re-arm command keeps working after a lane closes, the close is said exactly once, never carried forward, and under --lanes an unknown key stays exit 64. Harness: in-process runLaneWatch with injected lane provider, handoff reader and fake clock, as in test/e178b-lane-watch.test.mjs.
// Rationale: specs/e260f-comment-rationale.md (test/e223-watch-rearm-gone.test.mjs).

import { test } from "node:test";
import assert from "node:assert/strict";
import * as path from "node:path";
import { createHash } from "node:crypto";

import {
  runLaneWatch,
  parseWatchBaseline,
  WATCH_EXIT_EXPIRED,
  WATCH_EXIT_USAGE,
} from "../dist/tools/lane-status.js";

// ---------------------------------------------------------------------------
// In-process harness (mirrors test/e178b-lane-watch.test.mjs)
// ---------------------------------------------------------------------------

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

/** The per-lane state line the watch prints, spelled out independently of the tool so a format change is caught (e178b decision (c)). */
function stateLine(h) {
  const v = (x) => (x === null || x === undefined || String(x).trim() === "" ? "-" : String(x).trim().replace(/\s+/g, "_"));
  return [
    `feature=${v(h.active_feature)}`,
    `status=${v(h.status)}`,
    `last_agent=${v(h.last_agent)}`,
    `next_role=${v(h.next_role)}`,
    `hop=${v(h.hop_count)}`,
    `review_round=${v(h.review_round)}`,
    `qa_round=${v(h.qa_round)}`,
  ].join(" ");
}

const fp = (line) => createHash("sha256").update(line, "utf8").digest("hex").slice(0, 12);
/** Any well-formed fingerprint (value irrelevant for a gone key). */
const FP = fp("closed lane, state no longer readable");

function mkWorld(entries, base = "/fake/agm-lanes") {
  const lanes = new Map();
  for (const [key, h] of entries) lanes.set(key, { ws: path.join(base, key), handoff: h });
  return { lanes, present: [...lanes.keys()] };
}

function providerFor(world) {
  return () => ({
    source: "lane-registry",
    degraded: false,
    lanes: world.present.map((k) => ({
      workspacePath: world.lanes.get(k).ws,
      branch: `feat/${k}`,
      activeFeature: null,
      status: null,
      hopCount: null,
      lastAgent: null,
      lastUpdated: null,
      readable: true,
    })),
  });
}

function readerFor(world) {
  return (ws) => {
    for (const l of world.lanes.values()) if (l.ws === ws) return l.handoff;
    return null;
  };
}

async function runWatch(argv, world) {
  const out = [];
  const err = [];
  let now = 1_000_000;
  const code = await runLaneWatch(argv, {
    laneListProvider: providerFor(world),
    handoffReader: readerFor(world),
    io: {
      out: (l) => out.push(l),
      err: (l) => err.push(l),
      now: () => now,
      sleep: async (ms) => {
        now += ms;
      },
    },
  });
  return { code, out, err };
}

/** The --baseline value of a printed re-arm command, or null when it has none. */
const baselineOf = (cmd) => {
  const m = / --baseline (\S+)$/.exec(cmd);
  return m ? m[1] : null;
};

// ---------------------------------------------------------------------------
// AC1 gone key on start in the default set
// ---------------------------------------------------------------------------

test("AC1 gone key on start in the default set", async () => {
  const a = handoff("e901-alpha");
  const b = handoff("e902-beta");
  const world = mkWorld([["alpha", a], ["beta", b]]);
  // alpha is known (fingerprint matches), zeta names no listed lane: its
  // worktree was removed after the previous watch printed this command.
  const r = await runWatch(["--watch", "--deadline", "1", "--baseline", `alpha=${fp(stateLine(a))},zeta=${FP}`], world);

  assert.notEqual(r.code, WATCH_EXIT_USAGE, `must not be a usage error:\n${r.err.join("\n")}`);
  assert.equal(r.code, WATCH_EXIT_EXPIRED);
  assert.deepEqual(r.err, [], "no usage/error message for a closed lane");
  // armed: N counts only the lanes in the current list (decision (d)).
  assert.equal(r.out[0], "armed: watching 2 lane(s) — interval 30s, deadline 1 min");
  // Watched-lane block unchanged and first (decision (c)); gone line last.
  assert.deepEqual(r.out.slice(1, 4), [
    `[alpha] baseline: ${stateLine(a)}`,
    `[beta] baseline: ${stateLine(b)}`,
    "[zeta] gone",
  ]);
  assert.equal(r.out.filter((l) => l === "[zeta] gone").length, 1, "reported exactly once");
  assert.equal(r.out[4], "expiring — re-arm", "[zeta] gone is the last start line");
});

// ---------------------------------------------------------------------------
// AC2 gone ordering
// ---------------------------------------------------------------------------

test("AC2 gone ordering", async () => {
  const a = handoff("e901-alpha");
  const b = handoff("e902-beta");
  const world = mkWorld([["alpha", a], ["beta", b]]);
  // Gone keys interleaved with known ones and deliberately NOT sorted, so the
  // assertion distinguishes "--baseline order" from alphabetical/list order.
  const moved = handoff("e902-beta", { status: "PASS" });
  const value = [`zeta=${FP}`, `beta=${fp(stateLine(b))}`, `omega=${FP}`, `alpha=${fp(stateLine(a))}`, `kappa=${FP}`].join(",");
  world.lanes.get("beta").handoff = moved; // beta moved between watches
  const r = await runWatch(["--watch", "--deadline", "1", "--baseline", value], world);

  assert.equal(r.code, WATCH_EXIT_EXPIRED, r.err.join("\n"));
  assert.equal(r.out[0], "armed: watching 2 lane(s) — interval 30s, deadline 1 min");
  assert.deepEqual(r.out.slice(1, 6), [
    // watched lanes first, in lane-list order, with their normal start kinds
    `[alpha] baseline: ${stateLine(a)}`,
    `[beta] changed since last watch: ${stateLine(moved)}`,
    // then one gone line per gone key, in --baseline order
    "[zeta] gone",
    "[omega] gone",
    "[kappa] gone",
  ]);
  for (const k of ["zeta", "omega", "kappa"]) {
    assert.equal(r.out.filter((l) => l === `[${k}] gone`).length, 1, `${k} printed exactly once`);
  }
  assert.equal(r.out.filter((l) => l.endsWith(" gone")).length, 3, "no watched lane reported gone");
});

// ---------------------------------------------------------------------------
// AC3 gone keys are not carried
// ---------------------------------------------------------------------------

test("AC3 gone keys are not carried", async () => {
  const a = handoff("e901-alpha");
  const world = mkWorld([["alpha", a]]);
  const first = await runWatch(["--watch", "--deadline", "1", "--baseline", `alpha=${fp(stateLine(a))},zeta=${FP}`], world);
  assert.equal(first.code, WATCH_EXIT_EXPIRED, "reaches its deadline -> exit 3");
  const cmd = first.out.at(-1);
  assert.equal(cmd, `node scripts/lane-status.mjs --watch --deadline 1 --baseline alpha=${fp(stateLine(a))}`);
  assert.doesNotMatch(cmd, /zeta/, "gone key dropped from the re-arm --baseline (decision (e))");

  // Fed back in with the world unchanged: the closed lane is NOT re-reported,
  // and nothing reads as changed.
  const again = await runWatch(["--watch", "--deadline", "1", "--baseline", baselineOf(cmd)], world);
  assert.equal(again.code, WATCH_EXIT_EXPIRED, again.err.join("\n"));
  assert.equal(again.out.filter((l) => l.includes("gone")).length, 0, again.out.join("\n"));
  assert.equal(again.out.filter((l) => l.includes("changed since last watch")).length, 0, again.out.join("\n"));
  assert.equal(again.out.at(-1), cmd, "an unchanged world re-arms with the same (valid) command");

  // All-gone baseline + empty lane list: not "empty" (decision (b)) — the
  // watch starts, says every closed lane, and re-arms WITHOUT --baseline
  // (an empty --baseline would itself be a usage error).
  const empty = mkWorld([]);
  const allGone = await runWatch(["--watch", "--deadline", "1", "--baseline", `alpha=${FP},zeta=${FP}`], empty);
  assert.equal(allGone.code, WATCH_EXIT_EXPIRED, allGone.err.join("\n"));
  assert.deepEqual(allGone.out.slice(0, 3), [
    "armed: watching 0 lane(s) — interval 30s, deadline 1 min",
    "[alpha] gone",
    "[zeta] gone",
  ]);
  assert.equal(allGone.out.at(-1), "node scripts/lane-status.mjs --watch --deadline 1");
  assert.equal(baselineOf(allGone.out.at(-1)), null, "no --baseline flag at all");
  // ...and that re-arm command is itself runnable with zero gone lines.
  const next = await runWatch(["--watch", "--deadline", "1"], empty);
  assert.equal(next.code, WATCH_EXIT_EXPIRED);
  assert.equal(next.out.filter((l) => l.includes("gone")).length, 0);
});

// ---------------------------------------------------------------------------
// AC4 --lanes unknown key stays a usage error
// ---------------------------------------------------------------------------

test("AC4 --lanes unknown key stays a usage error", async () => {
  const a = handoff("e901-alpha");
  const b = handoff("e902-beta");
  const world = mkWorld([["alpha", a], ["beta", b]]);
  // Under --lanes an absent named lane is kept in the watched set, so an
  // unknown key cannot mean "closed" — only a typo. Both a pure-typo value
  // and a typo mixed with valid keys must be rejected before any output.
  for (const value of [`zeta=${FP}`, `alpha=${fp(stateLine(a))},zeta=${FP}`, `alhpa=${fp(stateLine(a))}`]) {
    const r = await runWatch(["--watch", "--lanes", "a,b", "--deadline", "1", "--baseline", value], world);
    assert.equal(r.code, WATCH_EXIT_USAGE, `--lanes a,b --baseline ${value}`);
    assert.match(r.err[0], /^lane-status: /, "usage message on stderr");
    assert.deepEqual(r.out, [], "empty stdout — nothing armed");
  }
  // Same with the lanes actually named: a key naming neither is still 64.
  const r = await runWatch(["--watch", "--lanes", "alpha,beta", "--deadline", "1", "--baseline", `zeta=${FP}`], world);
  assert.equal(r.code, WATCH_EXIT_USAGE);
  assert.match(r.err[0], /^lane-status: .*zeta/);
  assert.deepEqual(r.out, []);
  // Control: a correct --lanes baseline is accepted (the rejection is about
  // the unknown key, not about --lanes + --baseline in general).
  const ok = await runWatch(["--watch", "--lanes", "alpha,beta", "--deadline", "1", "--baseline", `alpha=${fp(stateLine(a))}`], world);
  assert.equal(ok.code, WATCH_EXIT_EXPIRED, ok.err.join("\n"));
});

// ---------------------------------------------------------------------------
// Security smoke: boundary inputs at the parser (unit level)
// ---------------------------------------------------------------------------

test("parseWatchBaseline boundary inputs", () => {
  const keys = ["alpha"];
  const gone = { unknownIsGone: true };
  // Undefined -> empty map (no --baseline given); not an error.
  assert.equal(parseWatchBaseline(undefined, keys, gone).size, 0);
  // Gone keys retained in --baseline order, alongside known ones.
  assert.deepEqual([...parseWatchBaseline(`zeta=${FP},alpha=${FP},eta=${FP}`, keys, gone).keys()], ["zeta", "alpha", "eta"]);
  // Validation is unchanged even with unknownIsGone (decision (b)).
  for (const bad of [
    "", // empty string
    ",", // no entries
    `zeta=${FP},zeta=${FP}`, // repeated gone key
    `zeta=${FP.toUpperCase()}`, // uppercase hex
    `zeta=${FP}0`, // wrong length
    "zeta=", // empty fingerprint
    `=${FP}`, // empty key
    `ze ta;rm -rf /=${FP}x`, // special characters + bad fp
    `${"z".repeat(10_000)}=nothex`, // oversized key, bad fp
  ]) {
    assert.throws(() => parseWatchBaseline(bad, keys, gone), `--baseline ${JSON.stringify(bad.slice(0, 40))} must throw`);
  }
  // Without the flag (the --lanes path), an unknown key throws.
  assert.throws(() => parseWatchBaseline(`zeta=${FP}`, keys), /names no watched lane/);
  // Exact match only (decision (f)): case differs -> unknown.
  assert.throws(() => parseWatchBaseline(`Alpha=${FP}`, keys), /names no watched lane/);
  assert.deepEqual([...parseWatchBaseline(`Alpha=${FP}`, keys, gone).keys()], ["Alpha"]);
});
