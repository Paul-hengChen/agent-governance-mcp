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
import { writeHandoffState, parseHandoff } from "../dist/tools/handoff.js";
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
