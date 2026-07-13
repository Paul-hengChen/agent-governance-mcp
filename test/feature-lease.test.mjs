// Coded by @qa-engineer
// Tests for specs/e1-feature-scoped-state-design.md (T-E1-05).
//
// The E1 feature lease converts the D5/D9/D10 "second feature silently
// clobbers the workspace slot" incident class into a loud, governed rejection
// (FEATURE_LEASE_HELD). It is derive-only (a-min): a pure predicate over the
// three oldest, universal handoff fields (active_feature/status/last_updated)
// — no schema bump, uniform in file AND SQLite storage mode. See
// gates/feature-lease.ts and tools/handoff-orchestrator.ts's gate block.
//
// Ratified calibrations (PM, 2026-07-12 — see spec "Open Questions —
// resolved"): LEASE_TTL_MIN = 30; Blocked counts as lease-held = YES.
//
// Spec-to-Test map:
//   isFeatureLeaseHeld same-feature short-circuit    -> P1
//   isFeatureLeaseHeld PASS releases the lease        -> P2
//   isFeatureLeaseHeld Blocked counts as held          -> P3
//   isFeatureLeaseHeld strict-< TTL boundary           -> P4a/P4b/P4c
//   isFeatureLeaseHeld NaN/corrupt last_updated        -> P5a/P5b
//   isFeatureLeaseHeld null/undefined prevState        -> P6
//   Orchestrator gate — file mode                      -> FM1..FM5
//   Orchestrator gate — SQLite mode                     -> SQ1..SQ3
//   Skill-text pinning (T-E1-02/T-E1-03 prose)          -> S1..S5

import { test } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(__filename), "..");

import { isFeatureLeaseHeld } from "../dist/gates/feature-lease.js";
import { writeHandoffState, parseHandoff, readHandoffState } from "../dist/tools/handoff.js";
import { resetSession, markStateRead } from "../dist/guards/session.js";
import { setActiveStorage, FileHandoffStorage } from "../dist/tools/storage.js";
import { handleUpdateState } from "../dist/tools/handoff-orchestrator.js";
import { TOOL_REGISTRY } from "../dist/tools/registry.js";

let SqliteHandoffStorage;
try {
  const mod = await import("../dist/tools/storage-sqlite.js");
  SqliteHandoffStorage = mod.SqliteHandoffStorage;
} catch {
  // eslint-disable-next-line no-console
  console.log("[skip] better-sqlite3 not installed — SQLite-mode feature-lease tests skipped");
}

const LEASE_TTL_MIN = 30;

// ============================================================================
// isFeatureLeaseHeld — pure predicate unit tests
// ============================================================================

test("P1: same-feature write never gates, regardless of status/age (feature_changed=false short-circuit)", () => {
  // WHY: the lease exists to stop a DIFFERENT feature from clobbering the
  // slot. A feature continuing to write to itself — the overwhelmingly common
  // case, every ordinary In_Progress hop — must never be blocked, even when
  // ancient (last_updated far outside the TTL) or non-terminal.
  const prev = { active_feature: "feat-x", status: "In_Progress", last_updated: new Date(0).toISOString() };
  assert.equal(isFeatureLeaseHeld(prev, "feat-x", Date.now(), LEASE_TTL_MIN), false);
});

test("P2: incumbent at status=PASS releases the lease (terminal), even seconds old", () => {
  // WHY: PASS is the ONLY status the predicate treats as terminal (spec
  // Decision: status ∉ { "PASS" }). A brand-new PASS must not block the next
  // feature — that would defeat the entire point of a release-time handoff.
  const prev = { active_feature: "feat-x", status: "PASS", last_updated: new Date().toISOString() };
  assert.equal(isFeatureLeaseHeld(prev, "feat-y", Date.now(), LEASE_TTL_MIN), false);
});

test("P3: incumbent at status=Blocked counts as lease-held (PM-ratified, not a fallthrough)", () => {
  // WHY: the ratified Open Question explicitly calls out Blocked as still
  // "the workspace's owner awaiting human recovery, not free to be
  // clobbered" — this is the one status a naive implementer might mistake
  // for "not actively building, so probably safe to preempt."
  const prev = { active_feature: "feat-x", status: "Blocked", last_updated: new Date().toISOString() };
  assert.equal(isFeatureLeaseHeld(prev, "feat-y", Date.now(), LEASE_TTL_MIN), true);
});

test("P3b: incumbent at status=FAIL also counts as held (non-terminal, same as Blocked/In_Progress)", () => {
  const prev = { active_feature: "feat-x", status: "FAIL", last_updated: new Date().toISOString() };
  assert.equal(isFeatureLeaseHeld(prev, "feat-y", Date.now(), LEASE_TTL_MIN), true);
});

test("P4a: just UNDER the TTL boundary (29m59s old) — lease still held", () => {
  const now = Date.now();
  const last_updated = new Date(now - (LEASE_TTL_MIN * 60_000 - 1_000)).toISOString();
  const prev = { active_feature: "feat-x", status: "In_Progress", last_updated };
  assert.equal(isFeatureLeaseHeld(prev, "feat-y", now, LEASE_TTL_MIN), true);
});

test("P4b: EXACTLY at the TTL boundary (age === ttlMin*60000ms) — lease released (strict <)", () => {
  // WHY: the spec's clause is `(now - last_updated) < ttlMin*60000` — strict
  // less-than. At exactly the boundary, age === threshold, and `age < threshold`
  // is false, so the lease must be released, not held. This is the load-bearing
  // off-by-one the ratified formula pins.
  const now = Date.now();
  const last_updated = new Date(now - LEASE_TTL_MIN * 60_000).toISOString();
  const prev = { active_feature: "feat-x", status: "In_Progress", last_updated };
  assert.equal(isFeatureLeaseHeld(prev, "feat-y", now, LEASE_TTL_MIN), false);
});

test("P4c: just OVER the TTL boundary (30m01s old) — lease released", () => {
  const now = Date.now();
  const last_updated = new Date(now - (LEASE_TTL_MIN * 60_000 + 1_000)).toISOString();
  const prev = { active_feature: "feat-x", status: "In_Progress", last_updated };
  assert.equal(isFeatureLeaseHeld(prev, "feat-y", now, LEASE_TTL_MIN), false);
});

test("P5a: unparseable last_updated (Date.parse -> NaN) fails open — lease NOT held", () => {
  // WHY: a corrupt/hand-edited last_updated cannot prove freshness. The
  // predicate's only defensible posture is fail-open (never falsely block the
  // workspace on unreadable data) — mirrors the file-lock's own stale
  // self-heal posture.
  const prev = { active_feature: "feat-x", status: "In_Progress", last_updated: "not-a-real-date" };
  assert.equal(isFeatureLeaseHeld(prev, "feat-y", Date.now(), LEASE_TTL_MIN), false);
});

test("P5b: empty-string last_updated also fails open (NaN via Date.parse)", () => {
  const prev = { active_feature: "feat-x", status: "In_Progress", last_updated: "" };
  assert.equal(isFeatureLeaseHeld(prev, "feat-y", Date.now(), LEASE_TTL_MIN), false);
});

test("P6: null/undefined prevState never gates (fresh workspace — no incumbent, no lease)", () => {
  assert.equal(isFeatureLeaseHeld(null, "feat-y", Date.now(), LEASE_TTL_MIN), false);
  assert.equal(isFeatureLeaseHeld(undefined, "feat-y", Date.now(), LEASE_TTL_MIN), false);
});

// ============================================================================
// Orchestrator FEATURE_LEASE_HELD gate — FILE storage mode
// ============================================================================

function mkWs(prefix = "flease-") {
  const ws = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  fs.mkdirSync(path.join(ws, ".current"), { recursive: true });
  return ws;
}

function backdateLastUpdated(ws, minutesAgo) {
  const p = path.join(ws, ".current", "handoff.md");
  const raw = fs.readFileSync(p, "utf-8");
  const stamp = new Date(Date.now() - minutesAgo * 60_000).toISOString();
  fs.writeFileSync(p, raw.replace(/^last_updated:\s*"[^"]*"$/m, `last_updated: "${stamp}"`), "utf-8");
}

async function seedFileState(ws, feature, agent, status) {
  resetSession(ws);
  markStateRead(ws);
  await writeHandoffState({
    workspacePath: ws,
    activeFeature: feature,
    status,
    completedTasks: [],
    pendingNotes: ["seed"],
    lastAgent: agent,
  });
}

test("FM1: a write for a NEW active_feature is REJECTED with FEATURE_LEASE_HELD while the incumbent is fresh + non-terminal (file mode)", async () => {
  setActiveStorage(new FileHandoffStorage());
  const ws = mkWs("flease-fm1-");
  await seedFileState(ws, "flease-a", "sr-engineer", "In_Progress");
  resetSession(ws);
  markStateRead(ws);

  const result = await handleUpdateState({
    workspace_path: ws,
    active_feature: "flease-b",
    status: "In_Progress",
    agent_id: "pm",
    completed_tasks: [],
    pending_notes: ["PM starting a new feature"],
    cut_approved: true,
  });
  assert.ok(result.isError, "cross-feature write must be rejected while the incumbent lease is live");
  assert.match(result.content[0].text, /FEATURE_LEASE_HELD/);
  // The incumbent must be untouched — no clobber.
  const state = parseHandoff(ws);
  assert.equal(state.active_feature, "flease-a", "the incumbent feature must remain active_feature after the rejected write");
});

test("FM2: Blocked incumbent also rejects a cross-feature write (Blocked counts as held, file mode)", async () => {
  setActiveStorage(new FileHandoffStorage());
  const ws = mkWs("flease-fm2-");
  await seedFileState(ws, "flease-a", "sr-engineer", "Blocked");
  resetSession(ws);
  markStateRead(ws);

  const result = await handleUpdateState({
    workspace_path: ws,
    active_feature: "flease-b",
    status: "In_Progress",
    agent_id: "pm",
    completed_tasks: [],
    pending_notes: ["PM starting a new feature"],
    cut_approved: true,
  });
  assert.ok(result.isError, "Blocked incumbent must still hold the lease");
  assert.match(result.content[0].text, /FEATURE_LEASE_HELD/);
});

test("FM3: a PASS incumbent (terminal) does NOT block the next feature (file mode)", async () => {
  setActiveStorage(new FileHandoffStorage());
  const ws = mkWs("flease-fm3-");
  await seedFileState(ws, "flease-a", "qa-engineer", "PASS");
  resetSession(ws);
  markStateRead(ws);

  const result = await handleUpdateState({
    workspace_path: ws,
    active_feature: "flease-b",
    status: "In_Progress",
    agent_id: "pm",
    completed_tasks: [],
    pending_notes: ["PM starting a new feature after prior PASS"],
    cut_approved: true,
  });
  assert.ok(!result.isError, `terminal PASS incumbent must release the lease: ${result.content?.[0]?.text}`);
  assert.equal(parseHandoff(ws).active_feature, "flease-b");
});

test("FM4: a stale incumbent (last_updated older than LEASE_TTL_MIN) does NOT block the next feature (TTL auto-expiry, file mode)", async () => {
  setActiveStorage(new FileHandoffStorage());
  const ws = mkWs("flease-fm4-");
  await seedFileState(ws, "flease-a", "sr-engineer", "In_Progress");
  backdateLastUpdated(ws, LEASE_TTL_MIN + 1);
  resetSession(ws);
  markStateRead(ws);

  const result = await handleUpdateState({
    workspace_path: ws,
    active_feature: "flease-b",
    status: "In_Progress",
    agent_id: "pm",
    completed_tasks: [],
    pending_notes: ["PM starting a new feature after incumbent went stale"],
    cut_approved: true,
  });
  assert.ok(!result.isError, `a stale (TTL-expired) incumbent must release the lease: ${result.content?.[0]?.text}`);
  assert.equal(parseHandoff(ws).active_feature, "flease-b");
});

test("FM5: a same-feature write is NEVER gated by the lease, even while In_Progress and fresh (file mode)", async () => {
  setActiveStorage(new FileHandoffStorage());
  const ws = mkWs("flease-fm5-");
  await seedFileState(ws, "flease-a", "sr-engineer", "In_Progress");
  resetSession(ws);
  markStateRead(ws);

  const result = await handleUpdateState({
    workspace_path: ws,
    active_feature: "flease-a",
    status: "In_Progress",
    agent_id: "pm",
    completed_tasks: [],
    pending_notes: ["same-feature bounce"],
    cut_approved: true,
  });
  assert.ok(!result.isError, `same-feature write must never trip the lease gate: ${result.content?.[0]?.text}`);
});

// ============================================================================
// Orchestrator FEATURE_LEASE_HELD gate — SQLite storage mode
// ============================================================================

const sqliteDescribe = (name, fn) =>
  SqliteHandoffStorage ? fn() : test(name + " (skipped — no better-sqlite3)", () => {});

function mkSqliteWorkspace(prefix = "flease-sql-") {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  const dbPath = path.join(dir, "agc.db");
  return { dir, dbPath };
}

sqliteDescribe("SQLite mode: FEATURE_LEASE_HELD gate matrix", () => {
  test("SQ1: a write for a NEW active_feature is REJECTED with FEATURE_LEASE_HELD while the incumbent is fresh + non-terminal (SQLite mode)", async () => {
    const { dir, dbPath } = mkSqliteWorkspace("flease-sq1-");
    try {
      const storage = new SqliteHandoffStorage(dbPath);
      setActiveStorage(storage);
      await storage.writeState({
        workspacePath: dir,
        activeFeature: "flease-sql-a",
        status: "In_Progress",
        completedTasks: [],
        pendingNotes: ["seed"],
        lastAgent: "sr-engineer",
      });
      resetSession(dir);
      storage.readState(dir);

      const result = await handleUpdateState({
        workspace_path: dir,
        active_feature: "flease-sql-b",
        status: "In_Progress",
        agent_id: "pm",
        completed_tasks: [],
        pending_notes: ["PM starting a new feature"],
        cut_approved: true,
      });
      assert.ok(result.isError, "cross-feature write must be rejected while the incumbent lease is live (SQLite mode)");
      assert.match(result.content[0].text, /FEATURE_LEASE_HELD/);
      assert.equal(storage.parse(dir).active_feature, "flease-sql-a", "incumbent must remain active_feature after rejection");
    } finally {
      setActiveStorage(new FileHandoffStorage());
      try { fs.rmSync(dir, { recursive: true, force: true }); } catch {}
    }
  });

  test("SQ2: a PASS incumbent (terminal) does NOT block the next feature (SQLite mode)", async () => {
    const { dir, dbPath } = mkSqliteWorkspace("flease-sq2-");
    try {
      const storage = new SqliteHandoffStorage(dbPath);
      setActiveStorage(storage);
      await storage.writeState({
        workspacePath: dir,
        activeFeature: "flease-sql-a",
        status: "PASS",
        completedTasks: ["T-1"],
        pendingNotes: ["shipped"],
        lastAgent: "qa-engineer",
      });
      resetSession(dir);
      storage.readState(dir);

      const result = await handleUpdateState({
        workspace_path: dir,
        active_feature: "flease-sql-b",
        status: "In_Progress",
        agent_id: "pm",
        completed_tasks: [],
        pending_notes: ["PM starting a new feature after prior PASS"],
        cut_approved: true,
      });
      assert.ok(!result.isError, `terminal PASS incumbent must release the lease (SQLite mode): ${result.content?.[0]?.text}`);
      assert.equal(storage.parse(dir).active_feature, "flease-sql-b");
    } finally {
      setActiveStorage(new FileHandoffStorage());
      try { fs.rmSync(dir, { recursive: true, force: true }); } catch {}
    }
  });

  test("SQ3: Blocked incumbent also rejects a cross-feature write (Blocked counts as held, SQLite mode)", async () => {
    const { dir, dbPath } = mkSqliteWorkspace("flease-sq3-");
    try {
      const storage = new SqliteHandoffStorage(dbPath);
      setActiveStorage(storage);
      await storage.writeState({
        workspacePath: dir,
        activeFeature: "flease-sql-a",
        status: "Blocked",
        completedTasks: [],
        pendingNotes: ["blocked, awaiting human"],
        lastAgent: "sr-engineer",
      });
      resetSession(dir);
      storage.readState(dir);

      const result = await handleUpdateState({
        workspace_path: dir,
        active_feature: "flease-sql-b",
        status: "In_Progress",
        agent_id: "pm",
        completed_tasks: [],
        pending_notes: ["PM starting a new feature"],
        cut_approved: true,
      });
      assert.ok(result.isError, "Blocked incumbent must still hold the lease (SQLite mode)");
      assert.match(result.content[0].text, /FEATURE_LEASE_HELD/);
    } finally {
      setActiveStorage(new FileHandoffStorage());
      try { fs.rmSync(dir, { recursive: true, force: true }); } catch {}
    }
  });
});

// ============================================================================
// Skill-text pinning (T-E1-02 release-SOP re-baseline + T-E1-03 coordinator
// escalation row / gate note), mirroring the T-D10-03/C13-06 pinning convention.
// ============================================================================

function readContentFile(f) {
  return fs.readFileSync(path.join(ROOT, "content", f), "utf-8");
}

test("S1: content/skill-release-engineer.md carries the 'Re-baseline off HEAD' SOP step (T-E1-02)", () => {
  const skill = readContentFile("skill-release-engineer.md");
  assert.match(skill, /\*\*Re-baseline off HEAD\*\*/, "must carry the named SOP step heading");
  assert.ok(skill.includes("git fetch origin"), "must instruct git fetch origin before any version bump");
  assert.ok(skill.includes("origin/<branch>"), "must reference re-deriving the version from origin/<branch> HEAD");
  assert.ok(
    skill.includes("NOT from the baseline this session read at PASS time"),
    "must explicitly reject the stale-baseline-from-PASS-time source",
  );
});

test("S2: skill-release-engineer.md re-baseline step names FEATURE_LEASE_HELD as the in-checkout serializer", () => {
  const skill = readContentFile("skill-release-engineer.md");
  assert.ok(
    skill.includes("`FEATURE_LEASE_HELD` gate already serializes features"),
    "must cite the FEATURE_LEASE_HELD gate as already serializing in-checkout releases",
  );
});

test("S3: skill-release-engineer.md's re-baseline step is also the documented D10 Blocked-recovery FIRST step", () => {
  const skill = readContentFile("skill-release-engineer.md");
  assert.ok(
    skill.includes("documented FIRST recovery step when a prior release attempt sits `Blocked` on a non-fast-forward push"),
    "the re-baseline step must double as the D10 Blocked-recovery entry point",
  );
});

test("S4: templates/claude-code-agents/release-engineer.md mirrors the re-baseline hint (<=2 sentences, C13 pattern)", () => {
  const template = fs.readFileSync(
    path.join(ROOT, "templates", "claude-code-agents", "release-engineer.md"),
    "utf-8",
  );
  assert.ok(template.includes("git fetch origin"), "template hint must mention git fetch origin");
  assert.ok(template.includes("origin/<branch>"), "template hint must mention origin/<branch> HEAD");
  assert.ok(
    template.includes("SOP step 3a"),
    "template hint must point back at the full SOP step (3a) for details",
  );
  const sentenceCount = (template.match(/[.!?](?:\s|$)/g) || []).length;
  // The hint itself is <=2 sentences; the file has other content, so we only
  // assert the specific hint block's sentence count, not the whole file.
  const hintLine = template.split("\n").find((l) => l.includes("git fetch origin"));
  assert.ok(hintLine, "must locate the re-baseline hint line");
  const hintSentences = (hintLine.match(/[.!?](?:\s|$)/g) || []).length;
  assert.ok(hintSentences <= 2, `re-baseline hint must be <=2 sentences (C13 pattern), found ${hintSentences}`);
});

test("S5: content/coord-03-core-fallback.md carries the Feature-Scope Gate note (T-E1-03)", () => {
  const coord = readContentFile("coord-03-core-fallback.md");
  assert.match(coord, /\*\*Feature-Scope Gate\*\* \(E1\)/, "must carry the Feature-Scope Gate note heading");
  assert.ok(coord.includes("`FEATURE_LEASE_HELD`"), "must backtick-quote the error code");
  assert.ok(coord.includes("30-min TTL"), "must document the 30-min TTL");
  assert.ok(
    coord.includes("separate git worktree"),
    "must offer the separate-git-worktree escape hatch",
  );
});

test("S6: content/coord-03-core-fallback.md carries the FEATURE_LEASE_HELD Escalation Routes row (T-E1-03)", () => {
  const coord = readContentFile("coord-03-core-fallback.md");
  assert.match(coord, /\*\*Feature-lease gate\*\*/, "must carry the Escalation Routes row label");
  assert.ok(
    /\| \*\*Feature-lease gate\*\*.*FEATURE_LEASE_HELD.*\| human \|/.test(coord),
    "the Escalation Routes row must route to human",
  );
});

// ============================================================================
// E1A amendment (post-release lease terminal-marker + negative-age guard)
// -- specs/e1-feature-scoped-state-design.md, "## Amendment (2026-07-12)"
// AC-E1A-1..7. gates/feature-lease.ts:70-94.
//
// Spec-to-Test map (E1A):
//   AC-E1A-1 (closing write releases the lease)         -> E1A-1
//   AC-E1A-2 (opening write still holds)                 -> E1A-2
//   AC-E1A-3 (Blocked / escalation next_role still holds) -> E1A-3a, E1A-3b, E1A-3c, E1A-3d
//   AC-E1A-4 (future-dated last_updated -> not held)      -> E1A-4a, E1A-4b
//   AC-E1A-5 (NaN/empty-string regression guard)          -> E1A-5a, E1A-5b
//   AC-E1A-6 (SQLite-mode no-op safety)                   -> E1A-6
//   AC-E1A-7 (skill-text pin, step 12)                    -> S7
// ============================================================================

test("E1A-1: release-engineer's CLOSING-write signal (last_agent=release-engineer, status=In_Progress, next_role=pm) releases the lease for a DIFFERENT feature (AC-E1A-1)", () => {
  // WHY: this is the root fix — pre-amendment, this exact post-release state
  // stayed lease-held for up to LEASE_TTL_MIN minutes even though the feature
  // had genuinely shipped (v3.72.0 incident). The closing write is the ONLY
  // state that carries this triple, so recognizing it lets the NEXT feature
  // start immediately instead of waiting out a TTL cooldown after every release.
  const prev = {
    active_feature: "feat-x",
    status: "In_Progress",
    last_updated: new Date().toISOString(),
    last_agent: "release-engineer",
    next_role: "pm",
  };
  assert.equal(isFeatureLeaseHeld(prev, "feat-y", Date.now(), LEASE_TTL_MIN), false);
});

test("E1A-2: release-engineer's OPENING write (no next_role set) still HOLDS the lease (AC-E1A-2)", () => {
  // WHY: the opening write (SOP step 2) never sets next_role. If the terminal
  // clause fired here too, the lease would release WHILE release mechanics
  // (git commit/tag/push) are still in flight — reopening exactly the
  // D5/D9/D10 race the lease exists to prevent.
  const prev = {
    active_feature: "feat-x",
    status: "In_Progress",
    last_updated: new Date().toISOString(),
    last_agent: "release-engineer",
    // next_role intentionally absent (key not present at all).
  };
  assert.equal(isFeatureLeaseHeld(prev, "feat-y", Date.now(), LEASE_TTL_MIN), true);
});

test("E1A-3a: a pm-authored write with next_role=pm but last_agent!=release-engineer still HOLDS (AC-E1A-3 / last_agent conjunct)", () => {
  // WHY: other roles legitimately hand back to pm with next_role="pm" (e.g.
  // code-reviewer's CHANGES_REQUESTED routing, or an ordinary pm self-loop).
  // Only release-engineer's OWN closing write may be mistaken for "shipped" —
  // the last_agent conjunct is what excludes every other role's pm-handback.
  const prev = {
    active_feature: "feat-x",
    status: "In_Progress",
    last_updated: new Date().toISOString(),
    last_agent: "pm",
    next_role: "pm",
  };
  assert.equal(isFeatureLeaseHeld(prev, "feat-y", Date.now(), LEASE_TTL_MIN), true);
});

test("E1A-3b: release-engineer at status=Blocked (even with next_role=pm) still HOLDS — Blocked-counts-as-held is not overridden by the terminal marker (AC-E1A-3)", () => {
  // WHY: the terminal clause requires status==="In_Progress" explicitly, so a
  // Blocked release-engineer state (interrupted/failed release awaiting human
  // recovery) can never satisfy it, regardless of next_role. This keeps the
  // already-ratified "Blocked counts as held" decision intact.
  const prev = {
    active_feature: "feat-x",
    status: "Blocked",
    last_updated: new Date().toISOString(),
    last_agent: "release-engineer",
    next_role: "pm",
  };
  assert.equal(isFeatureLeaseHeld(prev, "feat-y", Date.now(), LEASE_TTL_MIN), true);
});

test("E1A-3c: release-engineer escalation with next_role=qa-engineer still HOLDS (AC-E1A-3)", () => {
  // WHY: release-engineer's escalation writes (Escalation Routes table, e.g.
  // npm test regression) route next_role="qa-engineer", never "pm" — an
  // interrupted release must not release the lease early.
  const prev = {
    active_feature: "feat-x",
    status: "In_Progress",
    last_updated: new Date().toISOString(),
    last_agent: "release-engineer",
    next_role: "qa-engineer",
  };
  assert.equal(isFeatureLeaseHeld(prev, "feat-y", Date.now(), LEASE_TTL_MIN), true);
});

test("E1A-3d: release-engineer with next_role explicitly undefined still HOLDS (AC-E1A-3 / no-next_role variant)", () => {
  // WHY: distinct from E1A-2's "key never set" shape — this pins that an
  // explicit `next_role: undefined` (as opposed to the key being entirely
  // absent from the object) is likewise never `=== "pm"` and therefore never
  // satisfies the terminal clause. Both shapes must behave identically.
  const prev = {
    active_feature: "feat-x",
    status: "In_Progress",
    last_updated: new Date().toISOString(),
    last_agent: "release-engineer",
    next_role: undefined,
  };
  assert.equal(isFeatureLeaseHeld(prev, "feat-y", Date.now(), LEASE_TTL_MIN), true);
});

test("E1A-4a: future-dated last_updated (negative age) is NOT lease-held, regardless of ttlMin (AC-E1A-4)", () => {
  // WHY: the incident this item fixes — a last_updated ~6.2h in the future
  // (clock skew / hand-edited state) made `ageMs < ttlMin*60000` trivially
  // true forever (any negative number is less than any positive threshold),
  // turning the ratified 30-min TTL into a de-facto multi-hour cooldown. A
  // future-dated stamp cannot prove a trustworthy elapsed time, so it must
  // fail open (not held) — mirrors the NaN posture, no skew-grace window.
  const now = Date.now();
  const last_updated = new Date(now + 6.2 * 60 * 60 * 1000).toISOString(); // ~6.2h in the future
  const prev = { active_feature: "feat-x", status: "In_Progress", last_updated };
  assert.equal(isFeatureLeaseHeld(prev, "feat-y", now, LEASE_TTL_MIN), false);
  // Regardless of ttlMin (even an enormous TTL cannot rescue a negative age).
  assert.equal(isFeatureLeaseHeld(prev, "feat-y", now, 10_000), false);
});

test("E1A-4b: ageMs === 0 boundary (last_updated exactly \"now\") still HOLDS — zero is non-negative and fresh (AC-E1A-4 boundary)", () => {
  // WHY: pins that the negative-age fix is a STRICT `ageMs >= 0` guard, not an
  // accidental `> 0` that would also reject a legitimately-fresh same-instant
  // write. Zero age is the freshest possible state and must remain held.
  const now = Date.now();
  const prev = { active_feature: "feat-x", status: "In_Progress", last_updated: new Date(now).toISOString() };
  assert.equal(isFeatureLeaseHeld(prev, "feat-y", now, LEASE_TTL_MIN), true);
});

test("E1A-5a: unparseable last_updated (NaN) posture is UNCHANGED by the negative-age fix — still not held (AC-E1A-5 regression guard)", () => {
  // WHY: the negative-age fix (`ageMs >= 0 && ageMs < ttl`) must not
  // accidentally flip the pre-existing NaN behavior. `NaN >= 0` is `false`,
  // identical in effect to the pre-amendment `NaN < ttl` also being `false` —
  // same outcome, different (now more explicit) code path.
  const prev = { active_feature: "feat-x", status: "In_Progress", last_updated: "not-a-real-date" };
  assert.equal(isFeatureLeaseHeld(prev, "feat-y", Date.now(), LEASE_TTL_MIN), false);
});

test("E1A-5b: empty-string last_updated posture is UNCHANGED by the negative-age fix — still not held (AC-E1A-5 regression guard)", () => {
  const prev = { active_feature: "feat-x", status: "In_Progress", last_updated: "" };
  assert.equal(isFeatureLeaseHeld(prev, "feat-y", Date.now(), LEASE_TTL_MIN), false);
});

test("E1A-6: a SQLite-shaped prevState (no next_role field at all) can NEVER satisfy the terminal clause, even with last_agent=release-engineer + status=In_Progress (AC-E1A-6)", () => {
  // WHY: SqliteHandoffStorage never persists next_role, so any prevState read
  // back from the SQLite row structurally lacks the field — `undefined`,
  // never `"pm"`. This proves the SQLite no-op is a structural guarantee (the
  // field literally cannot be present with the right value), not merely an
  // untested coincidence. SQLite-mode behavior for this state is therefore
  // byte-for-byte unchanged from pre-amendment: still TTL-bounded post-release.
  const prevSqliteShaped = {
    active_feature: "feat-x",
    status: "In_Progress",
    last_updated: new Date().toISOString(),
    last_agent: "release-engineer",
    // no `next_role` key present -- mirrors the actual SQLite row shape.
  };
  assert.ok(!("next_role" in prevSqliteShaped), "sanity: fixture must not carry a next_role key");
  assert.equal(isFeatureLeaseHeld(prevSqliteShaped, "feat-y", Date.now(), LEASE_TTL_MIN), true);

  // And it remains TTL-bounded exactly like pre-amendment behavior: stale ->
  // released; fresh -> held.
  const staleSqliteShaped = {
    ...prevSqliteShaped,
    last_updated: new Date(Date.now() - (LEASE_TTL_MIN + 1) * 60_000).toISOString(),
  };
  assert.equal(isFeatureLeaseHeld(staleSqliteShaped, "feat-y", Date.now(), LEASE_TTL_MIN), false);
});

test("S7: content/skill-release-engineer.md SOP step 12 pins agent_id=\"release-engineer\" on the closing write and no longer instructs agent_id=\"pm\" there (AC-E1A-7)", () => {
  const skill = readContentFile("skill-release-engineer.md");
  const step12Match = skill.match(/^12\.\s+\*\*Closing write\*\*.*$/m);
  assert.ok(step12Match, "must locate the numbered step-12 Closing write line");
  const step12Line = step12Match[0];

  // The corrected closing-write call must open with agent_id="release-engineer".
  assert.ok(
    step12Line.includes('tw_update_state(agent_id="release-engineer"'),
    "step 12's tw_update_state call must open with agent_id=\"release-engineer\" (self-loop)",
  );
  assert.ok(
    step12Line.includes('next_role="pm"'),
    "step 12's tw_update_state call must still carry next_role=\"pm\" as the routing/terminal signal",
  );

  // The OLD, incorrect instruction (agent_id="pm" as part of the actual call)
  // must be gone. The corrected prose still discusses the forbidden case in
  // running text (e.g. "an agent_id=\"pm\" write would..."), so this assertion
  // targets the specific old CALL shape, not every occurrence of the substring.
  assert.ok(
    !skill.includes('tw_update_state(status=In_Progress, agent_id="pm", next_role="pm"'),
    "the old closing-write call instructing agent_id=\"pm\" must no longer be present verbatim",
  );

  // Explicit "NEVER agent_id=\"pm\"" guard language should accompany the fix.
  assert.ok(
    /NEVER\s+`?"pm"`?/.test(step12Line) || step12Line.includes('— NEVER `"pm"`'),
    "step 12 must explicitly call out that agent_id must NEVER be \"pm\" on the closing write",
  );
});

// ============================================================================
// S8 (e8-success-telemetry, T-E8-05/T-E8-07): step 11b's informational
// success-metrics note pins alongside the still-byte-intact E1A step-12
// contract — the two must coexist, not clobber one another. Extends the S7
// pinning convention above rather than duplicating a new test file.
// ============================================================================

test("S8: content/skill-release-engineer.md carries step 11b — the success-metrics emit note is automatic/best-effort and names .current/metrics.jsonl", () => {
  const skill = readContentFile("skill-release-engineer.md");
  const step11bMatch = skill.match(/^11b\.\s+\*\*Success-metrics emit is automatic\*\*.*$/m);
  assert.ok(step11bMatch, "must locate the numbered step-11b success-metrics line");
  const step11bLine = step11bMatch[0];

  assert.ok(
    /automatic/i.test(step11bLine),
    "step 11b must describe the emit as automatic (no manual action required)",
  );
  assert.ok(
    /best-effort/i.test(step11bLine),
    "step 11b must describe the emit as best-effort (never a release blocker)",
  );
  assert.ok(
    step11bLine.includes(".current/metrics.jsonl"),
    "step 11b must name the exact sidecar path .current/metrics.jsonl",
  );
  assert.ok(
    /do not.*(hand-author|edit)/i.test(step11bLine),
    "step 11b must instruct release-engineer NOT to hand-author or edit metrics records",
  );
  assert.ok(
    /never.*(block|alter)/i.test(step11bLine) || /does not.*(block|alter)/i.test(step11bLine),
    "step 11b must state the emit never blocks or alters the closing write's result",
  );
});

// ============================================================================
// E13 (e13-terminal-marker-advisory) — terminal-marker resilience to the
// heal-drop class. Repro-first (bugfix mode, spec AC7): E13-R1 below was
// authored BEFORE the gates/feature-lease.ts predicate change and verified RED
// against the unmodified predicate (recorded in
// qa_reports/expected-red_e13-terminal-marker-advisory.txt); it turns green
// with the T-E13-02 fix.
//
// Spec-to-Test map (E13, sr-engineer repro slice — qa-engineer extends per
// T-E13-06):
//   AC2 (second occurrence: heal drops next_role,
//        pending_notes preserved -> lease released)   -> E13-R1
//   AC1 (first occurrence: next_role never set at write
//        time, closing pending_notes present -> released) -> E13-AC1
//   AC3 (opening write explicit regression assertion)   -> E13-AC3
//   AC4 (SQLite-mode orchestrator path: closing-signature
//        pending_notes never passed in -> TTL-bounded
//        only, unchanged)                                -> E13-AC4a, E13-AC4b
//   AC5 (Blocked status + closing-signature pending_notes:
//        the disjunct cannot bypass the status conjunct)  -> E13-AC5
//   AC6 (skill-text pin — resilience note, steps 12-13)    -> E13-AC6
// ============================================================================

test("E13-R1: heal-drop class — closing write carried the full terminal triple, then a heal-style re-persist preserved pending_notes verbatim but dropped the transient next_role; the lease must be RELEASED (spec AC2, second occurrence)", async () => {
  // WHY: the v3.77.0 close-out incident. The closing write was CORRECT when
  // written (full E1A triple, confirmed by read-back). Later, an unrelated
  // read triggered readHandoffState's fire-and-forget migration heal-write
  // (tools/handoff.ts ~506-544), which re-passes pendingNotes verbatim
  // (~line 523) but — per next_role's documented TRANSIENT semantics (AC-3) —
  // never carries next_role forward. The pre-E13 terminal marker keyed on
  // next_role === "pm" surviving indefinitely, so the post-heal state wrongly
  // re-armed a dead lease and stalled the next feature's PM start for the
  // ~30-min TTL. The durable closing signature (pending_notes[0] =~
  // /^Released v/) survives the heal; the marker must accept it.
  setActiveStorage(new FileHandoffStorage());
  const ws = mkWs("flease-e13r1-");
  resetSession(ws);
  markStateRead(ws);

  // Step 1 — release-engineer's closing write, full E1A terminal triple +
  // closing-signature pending_notes (skill-release-engineer SOP step 12).
  await writeHandoffState({
    workspacePath: ws,
    activeFeature: "feat-x",
    status: "In_Progress",
    completedTasks: [],
    pendingNotes: ["Released v3.77.0", "tag: 2f759c3"],
    lastAgent: "release-engineer",
    nextRole: "pm",
  });
  const atWrite = parseHandoff(ws);
  assert.equal(atWrite.next_role, "pm", "sanity: the closing write carried the full terminal triple");
  assert.equal(
    isFeatureLeaseHeld(atWrite, "feat-y", Date.now(), LEASE_TTL_MIN),
    false,
    "sanity: the pre-heal closing state is already terminal under the existing marker",
  );

  // Step 2 — heal-style re-persist, mirroring readHandoffState's migration
  // heal-write field-for-field (tools/handoff.ts ~518-544): pendingNotes
  // re-passed verbatim, nextRole OMITTED — dropped by design (transient, AC-3;
  // positional-overload comment ~757-759: "an omitting write — including the
  // migration-heal write in readHandoffState — simply drops them").
  await writeHandoffState({
    workspacePath: ws,
    activeFeature: atWrite.active_feature,
    status: atWrite.status,
    completedTasks: atWrite.completed_tasks,
    pendingNotes: atWrite.pending_notes,
    lastAgent: atWrite.last_agent,
    // nextRole intentionally omitted — the heal write never carries it forward.
  });
  const postHeal = parseHandoff(ws);
  assert.equal(postHeal.next_role, undefined, "sanity: the heal-style re-persist dropped the transient next_role");
  assert.equal(postHeal.last_agent, "release-engineer", "sanity: last_agent preserved by the heal-style re-persist");
  assert.equal(postHeal.pending_notes[0], "Released v3.77.0", "sanity: pending_notes preserved verbatim by the heal-style re-persist");

  // THE BUG (red pre-fix): the feature genuinely shipped, but the post-heal
  // state no longer matches the exact triple, so the pre-E13 predicate
  // reports the lease HELD and the next feature stalls out the TTL window.
  assert.equal(
    isFeatureLeaseHeld(postHeal, "feat-y", Date.now(), LEASE_TTL_MIN),
    false,
    "post-heal closing state must release the lease — the durable pending_notes closing signature must satisfy the terminal marker (E13)",
  );
});

test("E13-AC1: first-occurrence class — next_role never set on the closing write ITSELF (no heal involved), closing-signature pending_notes present — lease released (spec AC1)", () => {
  // WHY: distinct from E13-R1 (AC2), which needs a two-step heal-drop to
  // reach the shape. AC1 is the v3.75.0 incident: release-engineer's closing
  // write omitted next_role from the start (coordinator briefed it to, per
  // the spec Problem Statement) — there is no prior "full triple" write and
  // no heal step. The durable pending_notes signature alone must be enough.
  const prev = {
    active_feature: "feat-x",
    status: "In_Progress",
    last_updated: new Date().toISOString(),
    last_agent: "release-engineer",
    pending_notes: ["Released v3.75.0", "tag: abc1234"],
    // next_role intentionally never set — key absent, mirroring the actual
    // v3.75.0 closing write shape (not a derived/healed state).
  };
  assert.ok(!("next_role" in prev), "sanity: fixture must not carry a next_role key at all");
  assert.equal(
    isFeatureLeaseHeld(prev, "feat-y", Date.now(), LEASE_TTL_MIN),
    false,
    "a closing write that never set next_role must still release the lease via the durable pending_notes signature (AC1)",
  );
});

test("E13-AC3: opening write regression assertion — pending_notes carries the OPENING signature (not /^Released v/), so the new disjunct never fires and the lease stays held (spec AC3)", () => {
  // WHY: E1A-2 already pins "opening write holds" pre-E13. This test targets
  // the E13 addition specifically: prove the new pending_notes disjunct does
  // NOT accidentally widen to match the opening write's own notes ("release-
  // engineer: starting release for <feature>"), which never begins with
  // "Released v". Without this explicit case, a future edit to the regex
  // (e.g. loosening the anchor) could silently reopen the D9/D10 race and no
  // AC3 test would catch it directly at the pending_notes level.
  const prev = {
    active_feature: "feat-x",
    status: "In_Progress",
    last_updated: new Date().toISOString(),
    last_agent: "release-engineer",
    pending_notes: ["release-engineer: starting release for feat-x"],
    // next_role intentionally absent, exactly as the opening write leaves it.
  };
  assert.equal(
    isFeatureLeaseHeld(prev, "feat-y", Date.now(), LEASE_TTL_MIN),
    true,
    "the opening write's pending_notes must never satisfy the closing-signature disjunct — in-flight release stays lease-held (AC3)",
  );
});

test("E13-AC5: Blocked status WITH closing-signature pending_notes still HOLDS — the pending_notes disjunct cannot bypass the status==='In_Progress' conjunct (spec AC5)", () => {
  // WHY: E1A-3b already pins Blocked+next_role="pm" still holds. This test
  // targets the E13 addition specifically: even in the (contrived, but
  // worth pinning) case where pending_notes ALSO carries the closing
  // signature, an interrupted/failed release sitting Blocked must not be
  // mistaken for "shipped" — the status conjunct is evaluated with AND, not
  // overridden by either disjunct branch. This is the defense-in-depth case
  // the spec's AC5 escalation clause is meant to cover for the new disjunct.
  const prev = {
    active_feature: "feat-x",
    status: "Blocked",
    last_updated: new Date().toISOString(),
    last_agent: "release-engineer",
    pending_notes: ["Released v3.77.0", "tag: 2f759c3"],
  };
  assert.equal(
    isFeatureLeaseHeld(prev, "feat-y", Date.now(), LEASE_TTL_MIN),
    true,
    "Blocked status must still gate the lease held regardless of pending_notes content — the disjunct is inside the status==='In_Progress' AND, not a bypass (AC5)",
  );
});

test("E13-AC6: content/skill-release-engineer.md carries the E13 terminal-marker resilience note near steps 12-13 (spec AC6)", () => {
  const skill = readContentFile("skill-release-engineer.md");
  const noteMatch = skill.match(/^\*\*Terminal-marker resilience note \(E13.*$/m);
  assert.ok(noteMatch, "must locate the E13 terminal-marker resilience note heading");
  // Find the note's paragraph (from the heading line to the next blank line
  // or next H2, whichever comes first) so assertions aren't order-sensitive
  // to unrelated surrounding prose.
  const noteStart = skill.indexOf(noteMatch[0]);
  const noteEnd = skill.indexOf("\n\n", noteStart);
  const noteBlock = noteEnd === -1 ? skill.slice(noteStart) : skill.slice(noteStart, noteEnd);

  // (a) the exact triple remains PRIMARY, still verified by step 13's read-back.
  assert.ok(
    /exact triple.*remains the PRIMARY closing-write contract/.test(noteBlock),
    "note must state the exact triple remains the PRIMARY closing-write contract",
  );
  assert.ok(
    /step 13.*read-back still verifies it verbatim/.test(noteBlock),
    "note must state step 13's read-back still verifies the exact triple verbatim",
  );
  // (b) the relaxed marker is a documented safety net, not license to omit next_role.
  assert.ok(
    noteBlock.includes("gates/feature-lease.ts"),
    "note must name the file where the relaxed marker lives",
  );
  assert.ok(
    /safety net/.test(noteBlock),
    "note must characterize the relaxed marker as a safety net",
  );
  assert.ok(
    /NOT license to omit `?next_role`?/.test(noteBlock),
    "note must explicitly state this is NOT license to omit next_role",
  );
});

// ============================================================================
// E13-AC4: SQLite-mode orchestrator path — the call site passes
// `pending_notes: undefined` for non-FileHandoffStorage, so the closing-
// signature disjunct can never fire in SQLite mode even when the persisted
// row's pending_notes would otherwise match it. Lease behavior stays
// byte-for-byte TTL-bounded, unchanged from pre-E13 (spec AC4).
// ============================================================================

sqliteDescribe("SQLite mode: E13 closing-signature pending_notes are inert (AC4)", () => {
  test("E13-AC4a: SQLite mode — a FRESH release-engineer closing-signature state (no next_role, pending_notes matching /^Released v/) still HOLDS the lease for a different feature (AC4)", async () => {
    const { dir, dbPath } = mkSqliteWorkspace("flease-e13ac4a-");
    try {
      const storage = new SqliteHandoffStorage(dbPath);
      setActiveStorage(storage);
      await storage.writeState({
        workspacePath: dir,
        activeFeature: "flease-sql-a",
        status: "In_Progress",
        completedTasks: [],
        pendingNotes: ["Released v3.77.0", "tag: 2f759c3"],
        lastAgent: "release-engineer",
        // nextRole intentionally omitted — SqliteHandoffStorage never
        // persists next_role regardless, but omitting it here matches the
        // AC1/AC2 incident shape faithfully.
      });
      resetSession(dir);
      storage.readState(dir);

      const result = await handleUpdateState({
        workspace_path: dir,
        active_feature: "flease-sql-b",
        status: "In_Progress",
        agent_id: "pm",
        completed_tasks: [],
        pending_notes: ["PM starting a new feature"],
        cut_approved: true,
      });
      assert.ok(
        result.isError,
        "a fresh SQLite-mode closing-signature state must still hold the lease — the orchestrator call site passes pending_notes: undefined for non-file storage, so the disjunct can never fire (AC4)",
      );
      assert.match(result.content[0].text, /FEATURE_LEASE_HELD/);
      assert.equal(storage.parse(dir).active_feature, "flease-sql-a", "incumbent must remain active_feature after rejection");
    } finally {
      setActiveStorage(new FileHandoffStorage());
      try { fs.rmSync(dir, { recursive: true, force: true }); } catch {}
    }
  });

  test("E13-AC4b: SQLite mode — the SAME closing-signature state, once STALE (past LEASE_TTL_MIN), releases the lease via ordinary TTL auto-expiry (not the E13 disjunct) — unchanged from pre-E13 behavior (AC4)", async () => {
    const { dir, dbPath } = mkSqliteWorkspace("flease-e13ac4b-");
    try {
      const storage = new SqliteHandoffStorage(dbPath);
      setActiveStorage(storage);
      await storage.writeState({
        workspacePath: dir,
        activeFeature: "flease-sql-a",
        status: "In_Progress",
        completedTasks: [],
        pendingNotes: ["Released v3.77.0", "tag: 2f759c3"],
        lastAgent: "release-engineer",
      });
      // Backdate the SQLite-persisted last_updated column directly (test
      // setup only — bypasses writeState, which always stamps `now`). Mirrors
      // the file-mode backdateLastUpdated() helper's intent for the SQLite
      // row shape; `storage.db` is a plain runtime property (TS `private` is
      // compile-time only), so this is a same-process direct-row poke, not a
      // new public API.
      const backdated = new Date(Date.now() - (LEASE_TTL_MIN + 1) * 60_000).toISOString();
      storage.db
        .prepare("UPDATE handoff_state SET last_updated = ? WHERE workspace_path = ?")
        .run(backdated, dir);
      resetSession(dir);
      storage.readState(dir);

      const preState = storage.parse(dir);
      assert.equal(preState.last_updated, backdated, "sanity: direct row poke backdated last_updated as intended");

      const result = await handleUpdateState({
        workspace_path: dir,
        active_feature: "flease-sql-b",
        status: "In_Progress",
        agent_id: "pm",
        completed_tasks: [],
        pending_notes: ["PM starting a new feature after incumbent went stale"],
        cut_approved: true,
      });
      assert.ok(
        !result.isError,
        `a stale SQLite-mode incumbent must release the lease via ordinary TTL expiry, unchanged from pre-E13: ${result.content?.[0]?.text}`,
      );
      assert.equal(storage.parse(dir).active_feature, "flease-sql-b");
    } finally {
      setActiveStorage(new FileHandoffStorage());
      try { fs.rmSync(dir, { recursive: true, force: true }); } catch {}
    }
  });
});

test("S8b: step 11b sits between step 11 and step 12 (ordering) and the E1A step-12 contract text remains byte-intact alongside it (regression guard vs S7)", () => {
  const skill = readContentFile("skill-release-engineer.md");
  const step11bIdx = skill.search(/^11b\.\s+\*\*Success-metrics emit is automatic\*\*/m);
  const step12Idx = skill.search(/^12\.\s+\*\*Closing write\*\*/m);
  assert.ok(step11bIdx >= 0, "step 11b must be present");
  assert.ok(step12Idx >= 0, "step 12 must still be present");
  assert.ok(step11bIdx < step12Idx, "step 11b must be ordered before step 12 (numbered-list convention: 11, 11a, 11b, 12)");

  // The exact S7-pinned step-12 substrings must still be present verbatim —
  // step 11b's insertion must not have perturbed step 12's text at all.
  const step12Match = skill.match(/^12\.\s+\*\*Closing write\*\*.*$/m);
  assert.ok(step12Match, "step 12 line must still be locatable");
  assert.ok(step12Match[0].includes('tw_update_state(agent_id="release-engineer"'), "step 12's corrected call shape must remain byte-intact");
  assert.ok(step12Match[0].includes('next_role="pm"'), "step 12's next_role=\"pm\" routing signal must remain byte-intact");
});

// ============================================================================
// E10 (e10-lease-override) — two additive, orthogonal mechanisms on top of the
// E1/E1A/E13 lease predicate above: `lease_override` (human-attested bypass of
// FEATURE_LEASE_HELD, any edge) and `bookkeeping_write` (non-substantive-write
// timestamp preservation, same-feature only). Both file-mode only, both
// transient/write-scoped (never persisted, never carried forward — spec AC3).
// specs/e10-lease-override.md AC1-AC9; architecture DR-1: NO schema bump,
// neither field is ever emitted to or read back from frontmatter.
// §2 test-ownership: qa-engineer-owned (T-E10-08) — sr-engineer authored no
// tests here (gates/lease-override.ts, tools/handoff-orchestrator.ts,
// tools/handoff.ts changes only).
//
// Spec-to-Test map (E10):
//   AC1 (audited lease_override bypasses FEATURE_LEASE_HELD)   -> E10-AC1
//   AC2 (unaudited override rejected, no silent fallthrough)    -> E10-AC2a, E10-AC2b
//   AC3 (lease_override transient, never carried forward)       -> E10-AC3
//   AC4 (migration heal-write preserves pre-heal last_updated)  -> "AC4 (e10): ..."
//        (exact name from qa_reports/expected-red_e10-lease-override.txt —
//        the authored red->green repro test, T-E10-01 reassigned to qa per §2)
//   AC5 (bookkeeping_write preserves last_updated same-feature;
//        sibling write without the flag still stamps fresh now())  -> E10-AC5a, E10-AC5b
//   AC6 (bookkeeping_write + different active_feature hard-rejected;
//        fresh-workspace inert, not rejected)                   -> E10-AC6a, E10-AC6b
//   AC8 (const-08 two new §3.1 bullets pinned)                  -> E10-AC8a, E10-AC8b
//   AC9 (SQLite mode: both fields inert)                        -> E10-AC9a, E10-AC9b
// ============================================================================

test("E10-AC1: an audited lease_override (pending_notes[0] matching /^lease-override:/) bypasses FEATURE_LEASE_HELD for THIS write only (file mode, spec AC1)", async () => {
  setActiveStorage(new FileHandoffStorage());
  const ws = mkWs("flease-e10ac1-");
  await seedFileState(ws, "flease-a", "sr-engineer", "In_Progress");
  resetSession(ws);
  markStateRead(ws);

  const result = await handleUpdateState({
    workspace_path: ws,
    active_feature: "flease-b",
    status: "In_Progress",
    agent_id: "pm",
    completed_tasks: [],
    pending_notes: ["lease-override: incumbent shipped in a prior session, human confirmed dead"],
    cut_approved: true,
    lease_override: true,
  });
  assert.ok(!result.isError, `an audited lease_override must bypass FEATURE_LEASE_HELD: ${result.content?.[0]?.text}`);
  assert.equal(parseHandoff(ws).active_feature, "flease-b", "the bypassed write must actually claim the new feature's slot");
});

test("E10-AC2a: lease_override:true with EMPTY pending_notes is rejected LEASE_OVERRIDE_AUDIT_MISSING — never silently accepted, never silently downgraded to the plain FEATURE_LEASE_HELD envelope (spec AC2)", async () => {
  setActiveStorage(new FileHandoffStorage());
  const ws = mkWs("flease-e10ac2a-");
  await seedFileState(ws, "flease-a", "sr-engineer", "In_Progress");
  resetSession(ws);
  markStateRead(ws);

  const result = await handleUpdateState({
    workspace_path: ws,
    active_feature: "flease-b",
    status: "In_Progress",
    agent_id: "pm",
    completed_tasks: [],
    pending_notes: [],
    cut_approved: true,
    lease_override: true,
  });
  assert.ok(result.isError, "an unaudited lease_override must be rejected");
  assert.match(result.content[0].text, /LEASE_OVERRIDE_AUDIT_MISSING/, "must reject with its own distinct error code");
  assert.doesNotMatch(
    result.content[0].text,
    /⛔ FEATURE_LEASE_HELD/,
    "must NOT silently fall through to the plain FEATURE_LEASE_HELD envelope — LEASE_OVERRIDE_AUDIT_MISSING is a distinct code, not a relabeling",
  );
  assert.equal(parseHandoff(ws).active_feature, "flease-a", "the incumbent must remain untouched after the rejected write");
});

test("E10-AC2b: lease_override:true with a MISMATCHED pending_notes[0] (does not match /^lease-override:/) is likewise rejected LEASE_OVERRIDE_AUDIT_MISSING (spec AC2)", async () => {
  setActiveStorage(new FileHandoffStorage());
  const ws = mkWs("flease-e10ac2b-");
  await seedFileState(ws, "flease-a", "sr-engineer", "In_Progress");
  resetSession(ws);
  markStateRead(ws);

  const result = await handleUpdateState({
    workspace_path: ws,
    active_feature: "flease-b",
    status: "In_Progress",
    agent_id: "pm",
    completed_tasks: [],
    pending_notes: ["PM starting a new feature, no audit line"],
    cut_approved: true,
    lease_override: true,
  });
  assert.ok(result.isError, "a mismatched-note lease_override must be rejected");
  assert.match(result.content[0].text, /LEASE_OVERRIDE_AUDIT_MISSING/);
  assert.equal(parseHandoff(ws).active_feature, "flease-a");
});

test("E10-AC3: lease_override is transient — write N's bypass does NOT leak forward to write N+1, which is evaluated by the normal FEATURE_LEASE_HELD predicate against the freshly-stamped new incumbent (spec AC3)", async () => {
  setActiveStorage(new FileHandoffStorage());
  const ws = mkWs("flease-e10ac3-");
  await seedFileState(ws, "flease-a", "sr-engineer", "In_Progress");
  resetSession(ws);
  markStateRead(ws);

  // Write N: audited override claims flease-b, bypassing the flease-a lease.
  const writeN = await handleUpdateState({
    workspace_path: ws,
    active_feature: "flease-b",
    status: "In_Progress",
    agent_id: "pm",
    completed_tasks: [],
    pending_notes: ["lease-override: flease-a abandoned, human confirmed"],
    cut_approved: true,
    lease_override: true,
  });
  assert.ok(!writeN.isError, `write N (audited override) must succeed: ${writeN.content?.[0]?.text}`);
  assert.equal(parseHandoff(ws).active_feature, "flease-b");

  // Write N+1: a DIFFERENT feature, omitting lease_override entirely. flease-b
  // is now the incumbent, freshly stamped by write N (In_Progress, seconds
  // old) — the normal FEATURE_LEASE_HELD predicate must hold it; there is no
  // residual bypass carried forward from write N's attestation.
  resetSession(ws);
  markStateRead(ws);
  const writeNPlus1 = await handleUpdateState({
    workspace_path: ws,
    active_feature: "flease-c",
    status: "In_Progress",
    agent_id: "pm",
    completed_tasks: [],
    pending_notes: ["PM starting yet another feature, no override"],
    cut_approved: true,
  });
  assert.ok(writeNPlus1.isError, "write N+1 must be evaluated normally — no residual lease_override bypass");
  assert.match(writeNPlus1.content[0].text, /FEATURE_LEASE_HELD/);
  assert.equal(parseHandoff(ws).active_feature, "flease-b", "flease-b must remain the incumbent after the correctly-rejected write");
});

// --- AC4 repro (T-E10-01, red->green; see qa_reports/expected-red_e10-lease-override.txt) ---
//
// Exact test name specified by sr-engineer's manifest (§2 reassignment: qa-
// engineer authors this, since only qa may write test files). Red-proof
// method (recorded in Phase 0.5 disposition below): the assertion fails
// against pre-E10 code, verified by temporarily removing `bookkeepingWrite:
// true` from the heal call site in tools/handoff.ts's readHandoffState (or
// `git stash` the E10 diff) and observing last_updated stamped to now();
// green against the landed fix.
test("AC4 (e10): migration heal-write preserves pre-heal last_updated verbatim", async () => {
  setActiveStorage(new FileHandoffStorage());
  const ws = mkWs("flease-e10ac4-");
  const ORIGINAL_LAST_UPDATED = "2026-05-01T00:00:00.000Z";
  // v0-shaped handoff.md — no schema_version key at all (peekVersion collapses
  // absence to VERSION_WHEN_ABSENT=0), so the read below trips the full
  // v0->CURRENT migration chain and fires readHandoffState's fire-and-forget
  // heal-write.
  const v0Content = `---
active_feature: "flease-e10ac4-legacy"
status: "In_Progress"
last_updated: "${ORIGINAL_LAST_UPDATED}"
last_agent: "pm"
---
# Handoff State

## Completed
- (none)

## Pending & Handoff Notes
- (none)

---
> System Note: Auto-generated by agent-governance-mcp. Do NOT edit manually.
`;
  fs.writeFileSync(path.join(ws, ".current", "handoff.md"), v0Content, "utf-8");
  assert.ok(!/schema_version/.test(v0Content), "sanity: fixture must be v0-shaped (no schema_version key)");
  resetSession(ws);

  // The read triggers runMigrations (v0 -> CURRENT), which fires the
  // fire-and-forget heal-write in readHandoffState. Await one macrotask so
  // the (internally-async, fire-and-forget) heal write settles on disk
  // before we assert.
  readHandoffState(ws);
  await new Promise((resolve) => setImmediate(resolve));

  const healed = parseHandoff(ws);
  assert.equal(
    healed.last_updated,
    ORIGINAL_LAST_UPDATED,
    "the migration heal-write must preserve the pre-heal last_updated verbatim, not stamp now() (AC4)",
  );

  // Practical consequence: a SUBSEQUENT different-feature write must be
  // evaluated against the ORIGINAL (~2 months stale) age, not a
  // heal-refreshed fresh one — TTL auto-expiry releases the lease immediately.
  const result = await handleUpdateState({
    workspace_path: ws,
    active_feature: "flease-e10ac4-next",
    status: "In_Progress",
    agent_id: "pm",
    completed_tasks: [],
    pending_notes: ["PM starting a new feature after the legacy incumbent's lease healed stale"],
    cut_approved: true,
  });
  assert.ok(
    !result.isError,
    `a different-feature write must be accepted against the ORIGINAL stale age, not a heal-refreshed fresh one: ${result.content?.[0]?.text}`,
  );
  assert.equal(parseHandoff(ws).active_feature, "flease-e10ac4-next");
});

test("E10-AC5a: bookkeeping_write:true on a SAME-feature write preserves the existing on-disk last_updated verbatim (spec AC5)", async () => {
  setActiveStorage(new FileHandoffStorage());
  const ws = mkWs("flease-e10ac5a-");
  await seedFileState(ws, "flease-a", "pm", "In_Progress");
  const preWrite = parseHandoff(ws);
  const originalLastUpdated = preWrite.last_updated;
  resetSession(ws);
  markStateRead(ws);

  // A tiny real-clock delay so a fresh stamp would be measurably different
  // from the preserved one if the preserve branch failed to take effect.
  await new Promise((resolve) => setTimeout(resolve, 5));

  const result = await handleUpdateState({
    workspace_path: ws,
    active_feature: "flease-a",
    status: "In_Progress",
    agent_id: "pm",
    completed_tasks: [],
    pending_notes: ["PM crash/failure-record write — no forward progress"],
    bookkeeping_write: true,
  });
  assert.ok(!result.isError, `a same-feature bookkeeping_write must be accepted: ${result.content?.[0]?.text}`);
  assert.equal(
    parseHandoff(ws).last_updated,
    originalLastUpdated,
    "bookkeeping_write:true must preserve last_updated verbatim, not stamp now() (AC5)",
  );
});

test("E10-AC5b: an IDENTICAL same-feature write WITHOUT bookkeeping_write stamps a fresh now() as today (regression guard on the unflagged default, spec AC5)", async () => {
  setActiveStorage(new FileHandoffStorage());
  const ws = mkWs("flease-e10ac5b-");
  await seedFileState(ws, "flease-a", "pm", "In_Progress");
  const preWrite = parseHandoff(ws);
  const originalLastUpdated = preWrite.last_updated;
  resetSession(ws);
  markStateRead(ws);

  await new Promise((resolve) => setTimeout(resolve, 5));

  const result = await handleUpdateState({
    workspace_path: ws,
    active_feature: "flease-a",
    status: "In_Progress",
    agent_id: "pm",
    completed_tasks: [],
    pending_notes: ["PM ordinary same-feature progress, no bookkeeping flag"],
  });
  assert.ok(!result.isError, `an ordinary same-feature write must be accepted: ${result.content?.[0]?.text}`);
  assert.notEqual(
    parseHandoff(ws).last_updated,
    originalLastUpdated,
    "an unflagged write must still refresh last_updated to now() — the default behavior is unchanged (AC5 regression guard)",
  );
});

test("E10-AC6a: bookkeeping_write:true whose active_feature DIFFERS from the incumbent's is rejected BOOKKEEPING_WRITE_INVALID_FEATURE_CHANGE, never silently accepted or downgraded (spec AC6)", async () => {
  setActiveStorage(new FileHandoffStorage());
  const ws = mkWs("flease-e10ac6a-");
  await seedFileState(ws, "flease-a", "pm", "In_Progress");
  // Backdate past the TTL so FEATURE_LEASE_HELD (which runs FIRST in the
  // frozen check order) releases the lease and does not intercept this write
  // — isolating the AC6 gate, which fires immediately after the lease block
  // regardless of whether the lease itself was held.
  backdateLastUpdated(ws, LEASE_TTL_MIN + 1);
  resetSession(ws);
  markStateRead(ws);

  const result = await handleUpdateState({
    workspace_path: ws,
    active_feature: "flease-b",
    status: "In_Progress",
    agent_id: "pm",
    completed_tasks: [],
    pending_notes: ["mislabeled bookkeeping write on a feature change — must be rejected"],
    cut_approved: true,
    bookkeeping_write: true,
  });
  assert.ok(result.isError, "a different-feature bookkeeping_write must be rejected");
  assert.match(result.content[0].text, /BOOKKEEPING_WRITE_INVALID_FEATURE_CHANGE/);
  assert.equal(parseHandoff(ws).active_feature, "flease-a", "the incumbent must remain untouched after the rejected write");
});

test("E10-AC6b: bookkeeping_write:true on a FRESH workspace (no prevState) is INERT, not rejected — the AC6 gate is guarded by prevState (spec AC6 / architecture DR-4)", async () => {
  setActiveStorage(new FileHandoffStorage());
  const ws = mkWs("flease-e10ac6b-");
  resetSession(ws);
  markStateRead(ws);

  const result = await handleUpdateState({
    workspace_path: ws,
    active_feature: "flease-fresh",
    status: "In_Progress",
    agent_id: "pm",
    completed_tasks: [],
    pending_notes: ["first write in a brand-new workspace, mislabeled bookkeeping"],
    cut_approved: true,
    bookkeeping_write: true,
  });
  assert.ok(!result.isError, `a fresh workspace must never reject on bookkeeping_write (no prevState to feature-change against): ${result.content?.[0]?.text}`);
  assert.equal(parseHandoff(ws).active_feature, "flease-fresh");
});

// --- AC9 (SQLite mode: both fields inert) ---

sqliteDescribe("SQLite mode: E10 lease_override / bookkeeping_write are both inert (AC9)", () => {
  test("E10-AC9a: SQLite mode — lease_override:true (even correctly audited) has NO effect; the plain FEATURE_LEASE_HELD rejection stands unchanged (spec AC9)", async () => {
    const { dir, dbPath } = mkSqliteWorkspace("flease-e10ac9a-");
    try {
      const storage = new SqliteHandoffStorage(dbPath);
      setActiveStorage(storage);
      await storage.writeState({
        workspacePath: dir,
        activeFeature: "flease-sql-a",
        status: "In_Progress",
        completedTasks: [],
        pendingNotes: ["seed"],
        lastAgent: "sr-engineer",
      });
      resetSession(dir);
      storage.readState(dir);

      const result = await handleUpdateState({
        workspace_path: dir,
        active_feature: "flease-sql-b",
        status: "In_Progress",
        agent_id: "pm",
        completed_tasks: [],
        pending_notes: ["lease-override: SQLite mode, should still be rejected"],
        cut_approved: true,
        lease_override: true,
      });
      assert.ok(
        result.isError,
        "SQLite mode must ignore lease_override entirely — the plain FEATURE_LEASE_HELD rejection stands unchanged (AC9)",
      );
      assert.match(result.content[0].text, /FEATURE_LEASE_HELD/);
      assert.doesNotMatch(result.content[0].text, /LEASE_OVERRIDE_AUDIT_MISSING/);
      assert.equal(storage.parse(dir).active_feature, "flease-sql-a");
    } finally {
      setActiveStorage(new FileHandoffStorage());
      try { fs.rmSync(dir, { recursive: true, force: true }); } catch {}
    }
  });

  test("E10-AC9b: SQLite mode — bookkeeping_write:true on a same-feature write has NO timestamp effect; last_updated still stamps fresh now() unchanged (spec AC9)", async () => {
    const { dir, dbPath } = mkSqliteWorkspace("flease-e10ac9b-");
    try {
      const storage = new SqliteHandoffStorage(dbPath);
      setActiveStorage(storage);
      await storage.writeState({
        workspacePath: dir,
        activeFeature: "flease-sql-a",
        status: "In_Progress",
        completedTasks: [],
        pendingNotes: ["seed"],
        lastAgent: "pm",
      });
      const originalLastUpdated = storage.parse(dir).last_updated;
      resetSession(dir);
      storage.readState(dir);

      await new Promise((resolve) => setTimeout(resolve, 5));

      const result = await handleUpdateState({
        workspace_path: dir,
        active_feature: "flease-sql-a",
        status: "In_Progress",
        agent_id: "pm",
        completed_tasks: [],
        pending_notes: ["bookkeeping write attempt, SQLite mode"],
        bookkeeping_write: true,
      });
      assert.ok(!result.isError, `SQLite same-feature write must be accepted: ${result.content?.[0]?.text}`);
      assert.notEqual(
        storage.parse(dir).last_updated,
        originalLastUpdated,
        "SQLite mode must ignore bookkeeping_write — last_updated still stamps fresh now() (AC9, byte-for-byte unchanged behavior)",
      );
    } finally {
      setActiveStorage(new FileHandoffStorage());
      try { fs.rmSync(dir, { recursive: true, force: true }); } catch {}
    }
  });
});

// --- AC8 (const-08 §3.1 bullets pinning) ---
//
// Convention: mirrors E13's AC6 skill-text pinning test (S/AC-numbered tests
// above, e.g. E13-AC6) and E1/E1A's S1-S8 series — grep-based, targets the
// exact heading/bold-label + load-bearing substrings rather than the full
// prose (prose wording is free-text, not pinned verbatim beyond the load-
// bearing clauses spec AC8 calls out).

test("E10-AC8a: content/const-08-chain-31-mid.md carries the Lease-Override bullet — sanctioned-writer rule, any-edge scope, stricter audit requirement, transient/write-scoped, file-mode only (spec AC8a)", () => {
  const const08 = readContentFile("const-08-chain-31-mid.md");
  assert.ok(const08.includes("**Lease-Override"), "must carry the Lease-Override bullet heading");
  assert.ok(const08.includes("`FEATURE_LEASE_HELD`"), "must backtick-quote the gate it bypasses");
  assert.ok(const08.includes("`lease_override: true`"), "must backtick-quote the field");
  assert.ok(
    const08.includes("Sanctioned writer") && const08.includes("coordinator-attested"),
    "must document the sanctioned-writer / coordinator-attested trust rule (Cut-Approval Gate structural template, spec AC8a)",
  );
  assert.ok(const08.includes("any edge"), "must state the any-edge scope (differs from cut-approval's build-entry pin)");
  assert.ok(
    const08.includes("`pending_notes[0]`") && const08.includes("/^lease-override:/"),
    "must document the stricter audit-note-format requirement",
  );
  assert.ok(const08.includes("`LEASE_OVERRIDE_AUDIT_MISSING`"), "must backtick-quote the audit-gate error code");
  assert.ok(const08.includes("transient"), "must state the transient/write-scoped lifetime");
  assert.ok(const08.includes("gates/feature-lease.ts"), "must cross-reference the predicate's E1/E1A/E13 header lineage rather than restating it");
});

test("E10-AC8b: content/const-08-chain-31-mid.md carries the Bookkeeping-Write bullet — timestamp-preservation semantics, same-active_feature restriction, migration heal-write hard-wired equivalent (spec AC8b)", () => {
  const const08 = readContentFile("const-08-chain-31-mid.md");
  assert.ok(const08.includes("**Bookkeeping-Write"), "must carry the Bookkeeping-Write bullet heading");
  assert.ok(const08.includes("`bookkeeping_write: true`"), "must backtick-quote the field");
  assert.ok(
    const08.includes("last_updated") && const08.includes("now()"),
    "must document the timestamp-preservation semantics (preserve existing last_updated instead of stamping now())",
  );
  assert.ok(
    const08.includes("active_feature") && const08.includes("`BOOKKEEPING_WRITE_INVALID_FEATURE_CHANGE`"),
    "must document the same-active_feature restriction and its rejection code",
  );
  assert.ok(
    const08.includes("readHandoffState") && /hard-wired/.test(const08),
    "must document the readHandoffState migration heal-write as this mechanism's hard-wired unconditional equivalent",
  );
});

// ============================================================================
// E9A (e9a-stamp-integrity, T-E9A-05): no-MCP-path relay Hard rule + amended
// Output rule pinning. Mirrors the S1-S7 / T-E7-05 skill-text pinning
// convention above — grep-based, targets the load-bearing phrases the
// forensics converged on (never hand-edit / RELAY REQUIRED: prefix /
// exact-literal-payload requirement) rather than the full prose.
// ============================================================================

test("E9A-S1: content/skill-release-engineer.md carries the CRITICAL no-MCP-path relay Hard rule, never hand-edit", () => {
  const skill = readContentFile("skill-release-engineer.md");
  const ruleMatch = skill.match(/^-\s+\*\*CRITICAL — No-MCP-path sessions MUST relay, never hand-edit\*\*.*$/m);
  assert.ok(ruleMatch, "must locate the CRITICAL no-MCP-path relay Hard rule bullet, byte-identifiable heading");
  const ruleLine = ruleMatch[0];

  assert.ok(
    ruleLine.includes("no MCP tool-invocation path at all"),
    "must state the triggering condition: no MCP tool-invocation path at all",
  );
  assert.ok(
    /NEVER hand-edit/.test(ruleLine),
    "must state the load-bearing NEVER hand-edit prohibition",
  );
  assert.ok(
    ruleLine.includes(".current/handoff.md") && ruleLine.includes("tasks.md"),
    "must name both files the rule forbids hand-editing",
  );
});

test("E9A-S2: the CRITICAL relay Hard rule requires the exact literal tw_update_state call, verbatim values, RELAY REQUIRED: prefix", () => {
  const skill = readContentFile("skill-release-engineer.md");
  const ruleMatch = skill.match(/^-\s+\*\*CRITICAL — No-MCP-path sessions MUST relay, never hand-edit\*\*.*$/m);
  assert.ok(ruleMatch, "must locate the CRITICAL no-MCP-path relay Hard rule bullet");
  const ruleLine = ruleMatch[0];

  assert.ok(
    ruleLine.includes("**exact literal `tw_update_state` call**"),
    "must require the exact literal tw_update_state call (bold, load-bearing exact-literal-payload requirement)",
  );
  assert.ok(
    ruleLine.includes("every argument, verbatim values"),
    "must require every argument / verbatim values — not a paraphrase",
  );
  assert.ok(
    ruleLine.includes("`RELAY REQUIRED:` prefix"),
    "must mark the payload with the exact RELAY REQUIRED: prefix",
  );
  assert.ok(
    ruleLine.includes("step 2's opening write") && ruleLine.includes("step 12's closing write"),
    "must name both writes (opening/closing) a no-MCP-path session cannot make directly",
  );
});

test("E9A-S3: the amended Output rule gates 'Done. Released <tag>.' on a confirmed write, never speculative from an unverified relay", () => {
  const skill = readContentFile("skill-release-engineer.md");
  const outputSection = skill.match(/^## Output rule\n(.+)$/m);
  assert.ok(outputSection, "must locate the ## Output rule section");
  const outputLine = outputSection[1];

  assert.ok(
    outputLine.includes("emitted ONLY after a confirmed state write"),
    "must gate the Done. Released <tag>. line on a confirmed state write",
  );
  assert.ok(
    outputLine.includes("own SOP step-13 read-back confirms the closing write it made directly") ||
      /step-13 read-back confirms/.test(outputLine),
    "must name the own-read-back confirmation path (a)",
  );
  assert.ok(
    /coordinator confirms back that a relayed .RELAY REQUIRED:. closing write landed/.test(outputLine),
    "must name the coordinator-relay-confirmation path (b), tied to the RELAY REQUIRED: payload",
  );
  assert.ok(
    /NEVER assert `Done\. Released <tag>\.` speculatively/.test(outputLine),
    "must explicitly forbid speculative assertion from a session that could not verify the write",
  );
  assert.ok(
    outputLine.includes("does NOT claim Released"),
    "must state that a no-MCP-path session ending on a RELAY REQUIRED: payload does not claim Released",
  );
});

test("E9A-S4: templates/claude-code-agents/release-engineer.md carries the matching no-MCP-path relay paragraph (dispatch-context copy)", () => {
  const tpl = fs.readFileSync(
    path.join(ROOT, "templates", "claude-code-agents", "release-engineer.md"),
    "utf-8",
  );
  assert.ok(
    /CRITICAL: If this session has no MCP tool-invocation path at all/.test(tpl),
    "template must carry the CRITICAL no-MCP-path paragraph, byte-identifiable opening",
  );
  assert.ok(
    /NEVER hand-edit `\.current\/handoff\.md` or `tasks\.md` to simulate a `tw_update_state` write/.test(tpl),
    "template paragraph must carry the never-hand-edit-to-simulate clause verbatim",
  );
  assert.ok(
    tpl.includes("marked with a `RELAY REQUIRED:` prefix"),
    "template paragraph must carry the RELAY REQUIRED: prefix instruction",
  );
  assert.ok(
    tpl.includes("exact literal `tw_update_state` call — every argument, verbatim values"),
    "template paragraph must carry the exact-literal-payload requirement verbatim",
  );
  assert.ok(
    /Emit `Done\. Released <tag>\.` only after a confirmed write/.test(tpl),
    "template paragraph must carry the amended Output-rule gate on a confirmed write",
  );
});

test("E9A-S5 (regression guard): the pre-existing pinned template blocks survive alongside the new E9A paragraph", () => {
  const tpl = fs.readFileSync(
    path.join(ROOT, "templates", "claude-code-agents", "release-engineer.md"),
    "utf-8",
  );
  // v3.21.2 AC1: CRITICAL watermark reminder is still the first non-blank body line.
  const body = tpl.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, "");
  const firstNonBlank = body.split(/\r?\n/).find((l) => l.trim().length > 0);
  assert.equal(
    firstNonBlank,
    "CRITICAL: End every reply with `— @release-engineer (<the model tier you were actually invoked with>)` per Constitution §1 (watermark).",
    "watermark reminder must remain the first non-blank body line, unshifted by the new E9A paragraph",
  );
  // Pre-existing D10 push-rejection CRITICAL paragraph, still present verbatim.
  assert.ok(
    tpl.includes(
      "CRITICAL: On any non-fast-forward push rejection or concurrent-release collision, STOP",
    ),
    "pre-existing D10 push-rejection CRITICAL paragraph must still be present",
  );
  // v3.21.2 AC2: haiku example-reply-suffix block still present and still
  // preceded by a blank line.
  const exampleLine = "Example reply suffix: … — @release-engineer (haiku)";
  assert.ok(tpl.includes(exampleLine), "haiku example reply suffix block must still be present");
  const lines = tpl.split(/\r?\n/);
  const exampleIdx = lines.findIndex((l) => l === exampleLine);
  assert.ok(exampleIdx > 0, "example line must not be the first line");
  assert.equal(lines[exampleIdx - 1].trim(), "", "line before the example suffix must be blank");
});

// ============================================================================
// E17 (e17-release-record-integrity, T-E17-04): record-integrity Hard rule
// pinning. Mirrors the E9A-S1..S5 convention immediately above (same two
// target files: content/skill-release-engineer.md's Hard rules block +
// templates/claude-code-agents/release-engineer.md) — grep-based, targets
// the four load-bearing phrases the backlog E17 row named rather than the
// full prose: (i) git-diff-stat-derived file lists, (ii)
// exists-on-disk-at-write-time, (iii) never-from-memory-of-the-dispatch-brief,
// (iv) no-fabricated-review/QA rounds.
// ============================================================================

test("E17-S1: content/skill-release-engineer.md carries the CRITICAL record-integrity Hard rule bullet", () => {
  const skill = readContentFile("skill-release-engineer.md");
  const ruleMatch = skill.match(
    /^-\s+\*\*CRITICAL — Record integrity: describe the diff, not the brief\*\*.*$/m,
  );
  assert.ok(ruleMatch, "must locate the CRITICAL record-integrity Hard rule bullet, byte-identifiable heading");
  const ruleLine = ruleMatch[0];

  assert.ok(
    ruleLine.includes("MUST appear in the `git diff --stat` of the commit being described"),
    "(i) must pin the git-diff-stat-derived file lists requirement",
  );
  assert.ok(
    ruleLine.includes("every referenced report/spec path MUST exist on disk at write time"),
    "(ii) must pin the exists-on-disk-at-write-time requirement",
  );
  assert.ok(
    ruleLine.includes("NEVER from memory of the dispatch brief"),
    "(iii) must pin the never-from-memory-of-the-dispatch-brief prohibition",
  );
  assert.ok(
    ruleLine.includes("NEVER claim a code-review or QA round that has no on-disk report"),
    "(iv) must pin the no-fabricated-review/QA-rounds prohibition",
  );
  assert.ok(
    ruleLine.includes("(E17)"),
    "rule must carry the (E17) tag matching the surrounding Hard-rules block convention",
  );
});

test("E17-S2: the record-integrity Hard rule's incident-reason tail names the v3.83.0 fabrication and its a484a4d correction", () => {
  const skill = readContentFile("skill-release-engineer.md");
  const ruleMatch = skill.match(
    /^-\s+\*\*CRITICAL — Record integrity: describe the diff, not the brief\*\*.*$/m,
  );
  assert.ok(ruleMatch, "must locate the CRITICAL record-integrity Hard rule bullet");
  const ruleLine = ruleMatch[0];

  assert.ok(
    ruleLine.includes("Reason (E17 forensics)"),
    "must carry a Reason tail tagged E17 forensics, matching the D10/E9A precedent structure",
  );
  assert.ok(
    /v3\.83\.0 release commit message, CHANGELOG entry, and release notes all described a `tools\/handoff-orchestrator\.ts` change that does not exist/.test(ruleLine),
    "reason tail must name the v3.83.0 fabricated file-path incident",
  );
  assert.ok(
    ruleLine.includes("cited nonexistent spec/report paths"),
    "reason tail must name the nonexistent-path incident",
  );
  assert.ok(
    ruleLine.includes("claimed a fabricated code-review round for E15"),
    "reason tail must name the fabricated-round incident",
  );
  assert.ok(
    ruleLine.includes("corrected post-release in commit a484a4d"),
    "reason tail must name the a484a4d correction commit",
  );
});

test("E17-S3: templates/claude-code-agents/release-engineer.md carries the matching record-integrity CRITICAL paragraph", () => {
  const tpl = fs.readFileSync(
    path.join(ROOT, "templates", "claude-code-agents", "release-engineer.md"),
    "utf-8",
  );
  assert.ok(
    /CRITICAL: Record integrity — describe the diff, not the brief\./.test(tpl),
    "template must carry the CRITICAL record-integrity paragraph, byte-identifiable opening",
  );
  assert.ok(
    tpl.includes("MUST appear in the `git diff --stat` of the commit being described"),
    "(i) template paragraph must carry the git-diff-stat-derived file lists requirement",
  );
  assert.ok(
    tpl.includes("every referenced report/spec path MUST exist on disk at write time"),
    "(ii) template paragraph must carry the exists-on-disk-at-write-time requirement",
  );
  assert.ok(
    /never from memory of the dispatch brief/.test(tpl),
    "(iii) template paragraph must carry the never-from-memory-of-the-dispatch-brief prohibition",
  );
  assert.ok(
    /Never claim a code-review or QA round that has no on-disk report/.test(tpl),
    "(iv) template paragraph must carry the no-fabricated-review/QA-rounds prohibition",
  );
});

test("E17-S4 (regression guard): the pre-existing pinned template blocks and skill Hard rules survive alongside the new E17 paragraph", () => {
  const tpl = fs.readFileSync(
    path.join(ROOT, "templates", "claude-code-agents", "release-engineer.md"),
    "utf-8",
  );
  // v3.21.2 AC1: CRITICAL watermark reminder is still the first non-blank body line.
  const body = tpl.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, "");
  const firstNonBlank = body.split(/\r?\n/).find((l) => l.trim().length > 0);
  assert.equal(
    firstNonBlank,
    "CRITICAL: End every reply with `— @release-engineer (<the model tier you were actually invoked with>)` per Constitution §1 (watermark).",
    "watermark reminder must remain the first non-blank body line, unshifted by the new E17 paragraph",
  );
  // Pre-existing D10 push-rejection CRITICAL paragraph, still present verbatim.
  assert.ok(
    tpl.includes(
      "CRITICAL: On any non-fast-forward push rejection or concurrent-release collision, STOP",
    ),
    "pre-existing D10 push-rejection CRITICAL paragraph must still be present",
  );
  // Pre-existing E9A no-MCP-path relay paragraph, still present verbatim.
  assert.ok(
    /CRITICAL: If this session has no MCP tool-invocation path at all/.test(tpl),
    "pre-existing E9A no-MCP-path relay CRITICAL paragraph must still be present",
  );
  // Pre-existing driftBaselineIds paragraph, still present — the new E17
  // paragraph sits between the RELAY-REQUIRED (E9A) and driftBaselineIds
  // paragraphs per the backlog E17 row, and must not have displaced either.
  assert.ok(
    tpl.includes("append this release's shipped task IDs to `driftBaselineIds`"),
    "pre-existing driftBaselineIds paragraph must still be present",
  );
  // v3.21.2 AC2: haiku example-reply-suffix block still present and still
  // preceded by a blank line.
  const exampleLine = "Example reply suffix: … — @release-engineer (haiku)";
  assert.ok(tpl.includes(exampleLine), "haiku example reply suffix block must still be present");
  const lines = tpl.split(/\r?\n/);
  const exampleIdx = lines.findIndex((l) => l === exampleLine);
  assert.ok(exampleIdx > 0, "example line must not be the first line");
  assert.equal(lines[exampleIdx - 1].trim(), "", "line before the example suffix must be blank");

  // Skill-side regression: pre-existing D10 + E9A Hard rules and SOP step 8
  // HEREDOC commit-message prose are byte-unchanged by the new E17 bullet.
  const skill = readContentFile("skill-release-engineer.md");
  assert.ok(
    skill.includes(
      "**CRITICAL — STOP on push rejection / concurrent-release collision** (D10)",
    ),
    "pre-existing D10 Hard rule bullet must still be present, unmodified",
  );
  assert.ok(
    skill.includes(
      "**CRITICAL — No-MCP-path sessions MUST relay, never hand-edit** (E9A)",
    ),
    "pre-existing E9A Hard rule bullet must still be present, unmodified",
  );
  assert.ok(
    skill.includes('ALWAYS pass commit messages via `git commit -m "$(cat <<\'EOF\' ... EOF)"`'),
    "pre-existing HEREDOC commit-message Hard rule must still be present, unmodified",
  );
});
