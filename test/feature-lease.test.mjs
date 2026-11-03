// Coded by @qa-engineer
// Tests for the feature lease: while one feature is fresh and unfinished, a write that starts a
// DIFFERENT feature is rejected with FEATURE_LEASE_HELD instead of overwriting its state. The lease
// is a pure predicate over active_feature/status/last_updated, so file and SQLite mode behave alike.
// LEASE_TTL_MIN = 30, and a Blocked incumbent still holds the lease.
// Spec: specs/e1-feature-scoped-state-design.md; code: gates/feature-lease.ts.

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
import { forceSeedStamp, freshNonSuspectStamp, nonSuspectStampAt } from "./e148-seed-stamp.mjs";
import { resolveCurrentLanePaths } from "../dist/tools/lane-paths.js";

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
  const p = resolveCurrentLanePaths(ws).handoffPath;
  const raw = fs.readFileSync(p, "utf-8");
  // nonSuspectStampAt gives the same real seconds as a plain now()-based
  // backdate but always forces ms !== 0, so the backdated stamp can never
  // look hand-authored to HAND_AUTHORED_STAMP_RE. (E148)
  const stamp = nonSuspectStampAt(-minutesAgo * 60_000);
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
  // Replace the seed's wall-clock last_updated with a stamp that cannot look
  // hand-authored, but keep it FRESH (unlike test/e148-seed-stamp.mjs's
  // default SAFE_SEED_STAMP, a fixed 2026-01-01 date). Many tests here (FM1/FM2,
  // the lease-override AC1/AC2/AC5 series) need the seeded incumbent to be
  // fresh relative to Date.now() so FEATURE_LEASE_HELD actually holds; a fixed
  // past stamp would let the lease expire and silently break them. (E148)
  forceSeedStamp(ws, freshNonSuspectStamp());
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
// Skill-text pinning: the release SOP and the coordinator's escalation row
// must keep describing the lease, so an edit to the prose cannot silently
// drop it. Same grep-based style as the other skill-text pins. (T-E1-02, T-E1-03)
// ============================================================================

function readContentFile(f) {
  return fs.readFileSync(path.join(ROOT, "content", f), "utf-8");
}

// E394 re-pin helpers: the release SOP was rewritten (mechanics moved into scripts/release.mjs,
// incident narratives moved verbatim into specs/release-sop-history.md). Rules stay pinned in the
// SOP; narratives are pinned in the history file.
function readReleaseHistory() {
  return fs.readFileSync(path.join(ROOT, "specs", "release-sop-history.md"), "utf-8");
}
function releaseSopStep(skill, n) {
  const m = skill.match(new RegExp(`^${n}\\. .*$`, "m"));
  assert.ok(m, `must locate numbered SOP step ${n}`);
  return m[0];
}

test("S1 [E394 re-pin AC-P3/AC-P6]: the release SOP re-baselines off a freshly fetched main (fetch, portable ff-only pull, version derived at HEAD + bump) and the history keeps the E1 rule text (T-E1-02)", () => {
  const skill = readContentFile("skill-release-engineer.md");
  const step5 = releaseSopStep(skill, 5);
  assert.ok(step5.includes("git fetch origin"), "step 5 must instruct git fetch origin before any version bump");
  assert.ok(
    step5.includes("git -c pull.rebase=false pull --ff-only"),
    "step 5 must move local main only by the portable fast-forward pull",
  );
  assert.ok(
    /derive `X\.Y\.Z` from the version at HEAD/.test(step5),
    "step 5 must derive the target version from the version at HEAD (not the PASS-time baseline)",
  );
  assert.ok(skill.indexOf("\n5. ") < skill.indexOf("\n7. "), "re-baseline (5) must precede the bumps (7)");
  const hist = readReleaseHistory();
  assert.ok(hist.includes("Re-baseline off HEAD"), "history must keep the named E1 step");
  assert.ok(
    hist.includes("NOT from the baseline this session read at PASS time"),
    "history must keep the explicit rejection of the stale PASS-time baseline",
  );
});

test("S2 [E394 re-pin AC-P10]: the history keeps the note that FEATURE_LEASE_HELD already serializes in-checkout features (re-baseline cause)", () => {
  assert.ok(
    readReleaseHistory().includes("`FEATURE_LEASE_HELD` gate already serializes features"),
    "history must cite the FEATURE_LEASE_HELD gate as already serializing in-checkout releases",
  );
});

test("S3 [E394 re-pin AC-P4/AC-P10]: the re-baseline step is still the Blocked-recovery FIRST step (STALE_BASE row restarts at step 5; history keeps the D10 text)", () => {
  const skill = readContentFile("skill-release-engineer.md");
  assert.ok(
    /exit 11 STALE_BASE — recovery restarts at step 5 on a new branch/.test(skill),
    "the STALE_BASE escalation row must restart recovery at the re-baseline step (5)",
  );
  assert.ok(
    readReleaseHistory().includes("documented FIRST recovery step when a prior release attempt sits `Blocked` on a non-fast-forward push"),
    "history must keep the D10 Blocked-recovery entry-point sentence",
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

// E1A: a release closing write releases the lease, and a future-dated last_updated never holds
// it (a negative age must not count as fresh). Spec: specs/e1-feature-scoped-state-design.md,
// "Amendment (2026-07-12)" (AC-E1A-1..7).

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
  // (git commit/tag/push) are still in flight, letting a second feature take
  // over the workspace mid-release, which is what the lease exists to prevent.
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
  // WHY: distinct from the E1A-2 test's "key never set" shape — this pins that an
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

test("S7 [E394 re-pin AC-P5]: the closing write (SOP step 14) pins agent_id=\"release-engineer\" and never instructs agent_id=\"pm\" there (AC-E1A-7)", () => {
  const skill = readContentFile("skill-release-engineer.md");
  const step12Line = releaseSopStep(skill, 14);
  assert.ok(step12Line.startsWith("14. Closing write:"), "step 14 must be the closing write");

  // The corrected closing-write call must open with agent_id="release-engineer".
  assert.ok(
    step12Line.includes('tw_update_state(agent_id="release-engineer"'),
    "the closing tw_update_state call must open with agent_id=\"release-engineer\" (self-loop)",
  );
  assert.ok(
    step12Line.includes('next_role="pm"'),
    "the closing tw_update_state call must still carry next_role=\"pm\" as the routing/terminal signal",
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
    !/tw_update_state\([^)]*agent_id="pm"/.test(skill),
    "no tw_update_state call in the SOP may stamp agent_id=\"pm\"",
  );
  // The never-stamp-another-role's-id guard lives in the Hard rules (first-class citizen).
  assert.ok(
    /opening and closing writes are `agent_id="release-engineer"`; never stamp another role's id/.test(skill),
    "the Hard rules must state both writes are agent_id=\"release-engineer\", never another role's id",
  );
});

// ============================================================================
// S8: the release SOP's informational success-metrics note (step 11b) must
// sit alongside the unchanged step-12 lease-release contract; adding one
// must not overwrite the other. Same pinning style as S7 above.
// (e8-success-telemetry, T-E8-05/T-E8-07)
// ============================================================================

test("S8 [E394 re-pin AC-P5/AC-P10]: the SOP closing-write step says the success-metrics emit is automatic, never hand-authored, never a release failure; the history keeps the E174a sidecar path and the best-effort/never-blocks text", () => {
  const skill = readContentFile("skill-release-engineer.md");
  const step14Line = releaseSopStep(skill, 14);

  assert.ok(
    /success-metrics emit is automatic/i.test(step14Line),
    "step 14 must describe the success-metrics emit as automatic (no manual action required)",
  );
  assert.ok(
    /never hand-author a metrics record/i.test(step14Line),
    "step 14 must instruct release-engineer NEVER to hand-author metrics records",
  );
  assert.ok(
    /failed emit is not a release failure/i.test(step14Line),
    "step 14 must state a failed emit is not a release failure (never a blocker)",
  );
  // The narrative (sidecar path, best-effort, never blocks/alters the closing write) lives in the history.
  const hist = readReleaseHistory();
  const m = hist.match(/^11b\. \*\*Success-metrics emit is automatic\*\*.*$/m);
  assert.ok(m, "history must keep the verbatim step 11b line");
  assert.ok(m[0].includes(".current/<lane>/metrics.jsonl"), "history must name the lane-scoped sidecar path (E174a)");
  assert.ok(/best-effort/i.test(m[0]), "history must keep the best-effort wording");
  assert.ok(/never blocks or alters the closing write's result/i.test(m[0]), "history must keep the never-blocks/alters wording");
});

// E13: the release-closing marker must survive a later heal-write that drops next_role, so a
// durable closing signature in pending_notes still releases the lease. E13-R1 reproduces the
// original bug and failed against the old predicate. Spec: specs/e13-terminal-marker-advisory.md.

test("E13-R1: heal-drop class — closing write carried the full terminal triple, then a heal-style re-persist preserved pending_notes verbatim but dropped the transient next_role; the lease must be RELEASED (spec AC2, second occurrence)", async () => {
  // WHY: readHandoffState's migration heal-write keeps pending_notes but drops the transient
  // next_role, so a marker relying only on next_role === "pm" would treat a shipped feature's
  // lease as held and stall the next PM start for the TTL. The closing signature
  // (pending_notes[0] =~ /^Released v/) survives the heal, so the marker must accept it.
  setActiveStorage(new FileHandoffStorage());
  const ws = mkWs("flease-e13r1-");
  resetSession(ws);
  markStateRead(ws);

  // Step 1 — release-engineer's closing write, full terminal triple +
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

  // THE BUG this reproduces: the feature genuinely shipped, but the post-heal
  // state no longer matches the exact triple, so a triple-only predicate
  // reports the lease HELD and the next feature stalls out the TTL window.
  assert.equal(
    isFeatureLeaseHeld(postHeal, "feat-y", Date.now(), LEASE_TTL_MIN),
    false,
    "post-heal closing state must release the lease — the durable pending_notes closing signature must satisfy the terminal marker (E13)",
  );
});

test("E13-AC1: first-occurrence class — next_role never set on the closing write ITSELF (no heal involved), closing-signature pending_notes present — lease released (spec AC1)", () => {
  // WHY: distinct from E13-R1 (AC2), which needs a two-step heal-drop to
  // reach the shape. Here release-engineer's closing write omits next_role
  // from the start — there is no prior "full triple" write and no heal step.
  // The durable pending_notes signature alone must be enough.
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
  // WHY: E1A-2 already pins "opening write holds" via next_role. This test
  // pins that the pending_notes signature check does NOT widen to match the
  // opening write's own notes ("release-engineer: starting release for
  // <feature>"), which never begin with "Released v". Without it, loosening
  // the regex anchor could release the lease mid-release and no test would
  // catch it at the pending_notes level.
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
  // covers the pending_notes signature too: even in the (contrived, but
  // worth pinning) case where pending_notes ALSO carries the closing
  // signature, an interrupted/failed release sitting Blocked must not be
  // mistaken for "shipped" — the status check is combined with AND and is
  // never overridden by either signature branch.
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

test("E13-AC6 [E394 re-pin AC-P5/AC-P10]: the SOP closing/read-back steps keep the E13 exact-triple contract and 'no licence to omit next_role'; the history keeps the full terminal-marker resilience note (spec AC6)", () => {
  const skill = readContentFile("skill-release-engineer.md");
  const step14 = releaseSopStep(skill, 14);
  const step15 = releaseSopStep(skill, 15);
  assert.ok(
    step14.includes('tw_update_state(agent_id="release-engineer", status="In_Progress"') && step14.includes('next_role="pm"'),
    "step 14 must write the exact closing triple in full",
  );
  assert.ok(
    /`last_agent`, `status`, `next_role` and `pending_notes` must equal step 14 exactly/.test(step15),
    "step 15's read-back must verify the exact closing write verbatim, next_role included",
  );
  assert.ok(
    /feature-lease terminal marker/.test(step14) && /no licence to omit `next_role`/.test(step14),
    "step 14 must name the terminal marker and state the server fallback is no licence to omit next_role",
  );

  // The full narrative lives in the history file; the original assertions run against it.
  const hist = readReleaseHistory();
  const noteMatch = hist.match(/^\*\*Terminal-marker resilience note \(E13.*$/m);
  assert.ok(noteMatch, "history must keep the E13 terminal-marker resilience note heading");
  const noteBlock = noteMatch[0];

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
// signature branch can never fire in SQLite mode even when the persisted
// row's pending_notes would otherwise match it. In SQLite mode the lease
// is still released only by the TTL (spec AC4).
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

test("S8b [E394 re-pin AC-P5]: the metrics note rides inside the closing-write step (14), before the read-back (15), and the closing call shape stays byte-intact alongside it (regression guard vs S7)", () => {
  const skill = readContentFile("skill-release-engineer.md");
  const step14Idx = skill.search(/^14\. Closing write:/m);
  const step15Idx = skill.search(/^15\. Read-back:/m);
  assert.ok(step14Idx >= 0, "step 14 (closing write) must be present");
  assert.ok(step15Idx >= 0, "step 15 (read-back) must be present");
  assert.ok(step14Idx < step15Idx, "the closing write (14) must precede the read-back (15)");

  const step14Line = releaseSopStep(skill, 14);
  assert.ok(/success-metrics emit is automatic/i.test(step14Line), "the metrics note must sit in step 14 itself, next to the closing call");
  // The exact S7-pinned closing-call substrings must still be present verbatim.
  assert.ok(step14Line.includes('tw_update_state(agent_id="release-engineer"'), "step 14's corrected call shape must remain byte-intact");
  assert.ok(step14Line.includes('next_role="pm"'), "step 14's next_role=\"pm\" routing signal must remain byte-intact");
});

// E10: two independent additions on the lease predicate: `lease_override` (human-attested bypass
// of FEATURE_LEASE_HELD on any edge) and `bookkeeping_write` (a same-feature administrative write
// keeps the existing last_updated). Both are file-mode only, apply to one write and are never
// persisted, so no schema bump. Spec: specs/e10-lease-override.md (AC1-AC9). The test named
// "AC4 (e10): ..." must keep its name: the fix's reproduction list uses it.

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

  // Write N+1: a DIFFERENT feature, omitting lease_override. flease-b is now the fresh incumbent,
  // so the normal FEATURE_LEASE_HELD predicate must hold; no bypass carries forward from write N.
  // Reseed a fresh stamp that cannot look hand-authored (stamp-provenance check) before N+1.
  forceSeedStamp(ws, freshNonSuspectStamp());
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

// --- AC4: the migration heal-write keeps the original last_updated ---
//
// The test name must stay exactly as written: the fix's reproduction list
// names it. The assertion fails if `bookkeepingWrite: true` is removed from
// the heal call site in tools/handoff.ts's readHandoffState, because
// last_updated is then stamped to now(); it passes with the fix in place (T-E10-01).
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

  // The preserved ORIGINAL_LAST_UPDATED ("2026-05-01T00:00:00.000Z") has the
  // hand-authored stamp shape (seconds 00, ms .000) that the
  // STAMP_PROVENANCE_SUSPECT check rejects. That rejection is intended (it is
  // the v0 fixture's own hand-authored stamp, not a heal artifact). Prove the
  // check really fires here BEFORE proving the audited remediation note
  // clears it, so a mis-wired check cannot pass unnoticed.
  // (e18-write-provenance, T-E18-01)
  const suspectResult = await handleUpdateState({
    workspace_path: ws,
    active_feature: "flease-e10ac4-next",
    status: "In_Progress",
    agent_id: "pm",
    completed_tasks: [],
    pending_notes: ["PM starting a new feature after the legacy incumbent's lease healed stale"],
    cut_approved: true,
  });
  assert.ok(
    suspectResult.isError,
    `an unremediated write against a hand-authored-shaped on-disk stamp must be rejected STAMP_PROVENANCE_SUSPECT (E18): ${suspectResult.content?.[0]?.text}`,
  );
  assert.match(suspectResult.content[0].text, /STAMP_PROVENANCE_SUSPECT/, "must reject with the new stamp-provenance code");
  assert.equal(
    parseHandoff(ws).active_feature,
    "flease-e10ac4-legacy",
    "the incumbent must remain untouched after the STAMP_PROVENANCE_SUSPECT rejection",
  );

  // Practical consequence (the AC4 pin): once the write acknowledges the
  // suspect stamp via an audited stamp-remediation note (which only clears
  // the stamp-provenance check — it does not touch the feature-lease
  // predicate itself), the SUBSEQUENT different-feature write must still be
  // evaluated against the ORIGINAL (~2 months stale) age, not a heal-refreshed
  // fresh one — TTL auto-expiry releases the lease immediately.
  const result = await handleUpdateState({
    workspace_path: ws,
    active_feature: "flease-e10ac4-next",
    status: "In_Progress",
    agent_id: "pm",
    completed_tasks: [],
    pending_notes: [
      "stamp-remediation: pre-heal v0 fixture stamp is hand-authored by test construction (not a real out-of-band edit) — verified via this test's own setup, safe to overwrite",
      "PM starting a new feature after the legacy incumbent's lease healed stale",
    ],
    cut_approved: true,
  });
  assert.ok(
    !result.isError,
    `a different-feature write carrying an audited stamp-remediation note must be accepted against the ORIGINAL stale age, not a heal-refreshed fresh one: ${result.content?.[0]?.text}`,
  );
  assert.equal(parseHandoff(ws).active_feature, "flease-e10ac4-next");
  assert.equal(
    parseHandoff(ws).pending_notes[0],
    "stamp-remediation: pre-heal v0 fixture stamp is hand-authored by test construction (not a real out-of-band edit) — verified via this test's own setup, safe to overwrite",
    "the stamp-remediation audit note must persist verbatim in the written handoff (forensic trail)",
  );
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
// Convention: mirrors the skill-text pinning tests above (E13-AC6 and the
// S1-S8 series) — grep-based, targets the
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

// Release-engineer without an MCP connection must never hand-edit the handoff; it relays the
// state write. Pins the Hard rule and the amended Output rule by grep on the load-bearing phrases
// (never hand-edit, RELAY REQUIRED: prefix, exact-literal payload), like S1-S7 above. (E9A)

// E394 re-pin: the relay rule is one condensed Hard-rule bullet in the rewritten SOP (relay for steps 2 and 14,
// never hand-edit, no brief override); its forensics narrative lives in specs/release-sop-history.md.
function relayHardRule() {
  const skill = readContentFile("skill-release-engineer.md");
  const m = skill.match(/^-\s+\*\*No-MCP-path sessions relay\*\*.*$/m);
  assert.ok(m, "must locate the No-MCP-path relay Hard rule bullet");
  return m[0];
}

test("E9A-S1 [E394 re-pin AC-P6]: the SOP carries the no-MCP-path relay Hard rule, never hand-edit state to simulate a write", () => {
  const ruleLine = relayHardRule();
  assert.ok(
    ruleLine.includes("with no `tw_*` tool reachable"),
    "must state the triggering condition: no tw_* tool reachable",
  );
  assert.ok(
    /Never hand-edit state to simulate a write/.test(ruleLine),
    "must state the load-bearing never-hand-edit prohibition",
  );
  assert.ok(
    ruleLine.includes("STAMP_PROVENANCE_SUSPECT"),
    "must name the server-side rejection that backs the prohibition",
  );
  // The named files forbidden to hand-edit are pinned by the STOP-on-⛔ Hard rule.
  const skill = readContentFile("skill-release-engineer.md");
  assert.ok(
    skill.includes("never hand-edit `.current/<lane>/handoff.md` or `tasks.md` to work around one"),
    "the STOP-on-⛔ rule must name both files forbidden to hand-edit (E174a: lane-scoped handoff path)",
  );
  // The incident narrative moved to the history file verbatim.
  const hist = readReleaseHistory();
  assert.ok(hist.includes("no MCP tool-invocation path at all"), "history must keep the E9A triggering-condition narrative");
  assert.ok(hist.includes("NEVER hand-edit `.current/<lane>/handoff.md` or `tasks.md`"), "history must keep the E9A never-hand-edit narrative");
});

test("E9A-S2 [E394 re-pin AC-P6]: the relay Hard rule requires the exact literal tw_update_state call, verbatim values, RELAY REQUIRED: prefix, for both writes", () => {
  const ruleLine = relayHardRule();
  assert.ok(
    ruleLine.includes("the exact literal `tw_update_state` call"),
    "must require the exact literal tw_update_state call",
  );
  assert.ok(
    ruleLine.includes("every argument verbatim"),
    "must require every argument verbatim — not a paraphrase",
  );
  assert.ok(
    ruleLine.includes("after a `RELAY REQUIRED:` prefix"),
    "must mark the payload with the exact RELAY REQUIRED: prefix",
  );
  assert.ok(
    ruleLine.includes("(steps 2 and 14)"),
    "must name both writes (opening step 2 / closing step 14) a no-MCP-path session cannot make directly",
  );
  assert.ok(
    ruleLine.includes("No dispatch brief overrides this rule"),
    "the relay rule must outrank any dispatch brief (E18)",
  );
});

test("E9A-S3 [E394 re-pin AC-P5/AC-P6]: the Output rule gates 'Done. Released <tag>.' on a confirmed write, never speculative from an unverified relay", () => {
  const skill = readContentFile("skill-release-engineer.md");
  const outputSection = skill.match(/^## Output rule\n(.+)$/m);
  assert.ok(outputSection, "must locate the ## Output rule section");
  const outputLine = outputSection[1];

  assert.ok(
    outputLine.includes("`Done. Released <tag>.` — only after BOTH"),
    "must gate the Done. Released <tag>. line on both confirmations",
  );
  assert.ok(
    outputLine.includes("the step 15 read-back matched the closing write"),
    "must name the own-read-back confirmation path (a)",
  );
  assert.ok(
    /in a no-MCP-path session, the coordinator confirmed the relayed write landed/.test(outputLine),
    "must name the coordinator-relay-confirmation path (b)",
  );
  assert.ok(
    /Never claim it speculatively/.test(outputLine),
    "must explicitly forbid speculative assertion",
  );
  assert.ok(
    /ends its reply with that payload and claims nothing/.test(outputLine) && outputLine.includes("`RELAY REQUIRED:`"),
    "a no-MCP-path session ending on a RELAY REQUIRED: payload must claim nothing",
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
  // The pre-existing push-rejection CRITICAL paragraph is still present verbatim. (D10)
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

// Release records must describe only what happened. Pins the record-integrity Hard rule in
// content/skill-release-engineer.md and the release-engineer template by four phrases: file lists
// from git diff --stat, cited files exist, never written from memory of the brief, no invented
// review or QA rounds. (E17, e17-release-record-integrity)

test("E17-S1 [E394 re-pin AC-P6]: the SOP carries the Record-integrity Hard rule (diff-membership, on-disk existence, never from the brief, no fabricated review/QA round)", () => {
  const skill = readContentFile("skill-release-engineer.md");
  const ruleMatch = skill.match(/^-\s+\*\*Record integrity\*\*: describe the diff, not the brief\..*$/m);
  assert.ok(ruleMatch, "must locate the Record integrity Hard rule bullet, byte-identifiable heading");
  const ruleLine = ruleMatch[0];

  assert.ok(
    ruleLine.includes("must be in the release diff (`PREV_TAG..HEAD` plus the stage)"),
    "(i) must pin the diff-derived file lists requirement",
  );
  assert.ok(
    ruleLine.includes("exist on disk"),
    "(ii) must pin the exists-on-disk requirement",
  );
  assert.ok(
    ruleLine.includes("not from memory"),
    "(iii) must pin the never-from-memory prohibition",
  );
  assert.ok(
    ruleLine.includes("Never claim a code-review or QA round without its report under `review_reports/` or `qa_reports/`"),
    "(iv) must pin the no-fabricated-review/QA-rounds prohibition",
  );
  assert.ok(
    ruleLine.includes("`(context, not changed)`") && /exempts diff membership, never on-disk existence/.test(ruleLine),
    "the context-citation exemption (E83) must stay scoped to diff membership only",
  );
});

test("E17-S2 [E394 re-pin AC-P10]: the history keeps the record-integrity incident-reason tail naming the v3.83.0 fabrication and its a484a4d correction", () => {
  const skill = readContentFile("skill-release-engineer.md");
  assert.ok(
    skill.includes("`specs/release-sop-history.md`"),
    "the SOP must point at the history file where the incident narrative now lives",
  );
  const hist = readReleaseHistory();
  const ruleMatch = hist.match(
    /^-\s+\*\*CRITICAL — Record integrity: describe the diff, not the brief\*\*.*$/m,
  );
  assert.ok(ruleMatch, "history must keep the verbatim CRITICAL record-integrity bullet");
  const afterRule = hist.slice(hist.indexOf(ruleMatch[0]) + ruleMatch[0].length);
  const fenceMatch = afterRule.match(/^\r?\n<!-- rationale:start -->([\s\S]*?)<!-- rationale:end -->/);
  assert.ok(fenceMatch, "the E17 forensics tail must stay inside its rationale fence right after the bullet (N10 asymmetry, verbatim move)");
  const fenceBody = fenceMatch[1];

  assert.ok(fenceBody.includes("Reason (E17 forensics)"), "must carry a Reason tail tagged E17 forensics");
  assert.ok(
    /v3\.83\.0 release commit message, CHANGELOG entry, and release notes all described a `tools\/handoff-orchestrator\.ts` change that does not exist/.test(fenceBody),
    "reason tail must name the v3.83.0 fabricated file-path incident",
  );
  assert.ok(fenceBody.includes("cited nonexistent spec/report paths"), "reason tail must name the nonexistent-path incident");
  assert.ok(
    fenceBody.includes("claimed a fabricated code-review round for E15"),
    "reason tail must name the fabricated-round incident",
  );
  assert.ok(fenceBody.includes("corrected post-release in commit a484a4d"), "reason tail must name the a484a4d correction commit");
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

test("E17-S4 (regression guard) [E394 re-pin AC-P6]: the pre-existing pinned template blocks and skill Hard rules survive alongside the new E17 paragraph", () => {
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
  // The pre-existing push-rejection CRITICAL paragraph is still present verbatim. (D10)
  assert.ok(
    tpl.includes(
      "CRITICAL: On any non-fast-forward push rejection or concurrent-release collision, STOP",
    ),
    "pre-existing D10 push-rejection CRITICAL paragraph must still be present",
  );
  // The pre-existing no-MCP-path relay paragraph is still present verbatim. (E9A)
  assert.ok(
    /CRITICAL: If this session has no MCP tool-invocation path at all/.test(tpl),
    "pre-existing E9A no-MCP-path relay CRITICAL paragraph must still be present",
  );
  // Pre-existing driftBaselineIds paragraph, still present — the
  // record-integrity paragraph sits between the RELAY-REQUIRED and
  // driftBaselineIds paragraphs, and must not have displaced either. (E17)
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

  // Skill-side regression [E394 re-pin AC-P6]: the push-rejection, relay and commit-message rules survive the
  // rewrite alongside the record-integrity bullet. (D10, E9A, E17)
  const skill = readContentFile("skill-release-engineer.md");
  assert.ok(
    /Never force-push; tags are immutable/.test(skill) &&
      /A push rejection, collision or any `RELEASE_STOP` is a Blocked write carrying the branch and local sha, never a recovery command/.test(skill),
    "the D10 push-rejection rule (Blocked with branch + sha, never a recovery command) must still be present",
  );
  assert.ok(
    skill.includes("**No-MCP-path sessions relay**"),
    "the E9A relay Hard rule must still be present",
  );
  assert.ok(
    /exit 34 PUSH_REJECTED \| Blocked \| `<stop>` \+ branch, local sha/.test(skill),
    "the PUSH_REJECTED escalation row (Blocked, branch + local sha) must still be present",
  );
  assert.ok(
    /^11\. Commit message file, outside the repository root:/m.test(skill),
    "the commit-message-by-file step (replaces the HEREDOC rule; no shell-quoted multi-line message) must still be present",
  );
  // The verbatim D10 / E9A / HEREDOC rule texts are preserved in the history.
  const hist = readReleaseHistory();
  assert.ok(hist.includes("**CRITICAL — STOP on push rejection / concurrent-release collision** (D10)"), "history must keep the D10 bullet verbatim");
  assert.ok(hist.includes("**CRITICAL — No-MCP-path sessions MUST relay, never hand-edit** (E9A)"), "history must keep the E9A bullet verbatim");
  assert.ok(
    hist.includes('ALWAYS pass commit messages via `git commit -m "$(cat <<\'EOF\' ... EOF)"`'),
    "history must keep the HEREDOC commit-message rule verbatim",
  );
});
