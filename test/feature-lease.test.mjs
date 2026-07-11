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
