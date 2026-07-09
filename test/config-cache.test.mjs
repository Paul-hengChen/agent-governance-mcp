// Coded by @qa-engineer
// T-C5C18-07: tools/config.ts configCache mtime-based invalidation (v3.58.0, C18).
// Spec: specs/c5-c18-watermark-configcache.md — AC-4, AC-5.
//
// Spec-to-Test map:
//   AC-4 (same-process content+mtime bump becomes visible, no restart) ->
//     t-ac4-content-mtime-bump, t-ac4-driftbaselineids-append, t-ac4-fast-path
//   AC-5 (absent -> create -> delete -> recreate transitions, no crash,
//         no stale positive/negative caching) ->
//     t-ac5-full-transition-cycle, t-ac5-repeated-absent-reads,
//     t-ac5-existence-flip-beats-mtime-equality
//
// WHY: prior to C18, configCache was set-once/read-many with no invalidation
// path — a post-release driftBaselineIds append (content/skill-release-
// engineer.md SOP step 10) was invisible to tw_detect_drift until the server
// process restarted. These tests pin the "re-stat every call, compare
// existence+mtime" contract so a future "optimize away the stat call"
// refactor cannot silently reintroduce the stale-forever cache.
//
// Unlike test/config-versioning.test.mjs (which uses a FRESH workspace per
// test because it only cares about single-call read/migrate behavior), these
// tests reuse ONE workspace across MULTIPLE loadConfig calls within a test —
// that's the only way to exercise the cache's hit/miss decision at all.
// fs.utimesSync is used to pin exact mtimes (verified round-trip-exact on
// this filesystem) so assertions don't depend on wall-clock timing gaps.

import { test } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

import { loadConfig } from "../dist/tools/config.js";
import { CURRENT_VERSIONS } from "../dist/schema/versions.js";

function mkWorkspace() {
  const ws = fs.mkdtempSync(path.join(os.tmpdir(), "twcfgcache-"));
  fs.mkdirSync(path.join(ws, ".current"), { recursive: true });
  return ws;
}

function configPathOf(ws) {
  return path.join(ws, ".current", ".config.json");
}

// Writes the config body (always stamped at CURRENT schema_version, so
// loadConfig's migrate-on-read heal-write path never fires — a heal-write
// rewrites the file via a fresh fs.writeFileSync+renameSync, which would
// stomp the mtime we're about to pin below and confound these tests with an
// unrelated code path) and pins the file's mtime to an exact millisecond
// value, so cache-hit/miss decisions are deterministic rather than dependent
// on filesystem timestamp resolution or wall-clock gaps.
function writeConfig(ws, body, mtimeMs) {
  const p = configPathOf(ws);
  fs.writeFileSync(p, JSON.stringify({ schema_version: CURRENT_VERSIONS.config, ...body }));
  if (mtimeMs !== undefined) {
    const t = mtimeMs / 1000;
    fs.utimesSync(p, t, t);
  }
  return p;
}

// ---------- AC-4: in-process mtime-driven reload ----------

test("T-C5C18-07 AC-4: content change + mtime bump is visible without restart", () => {
  const ws = mkWorkspace();
  writeConfig(ws, { taskPaths: ["a.md"] }, 1_700_000_000_000);
  const first = loadConfig(ws);
  assert.deepEqual(first.taskPaths, ["a.md"]);

  // Mutate content AND bump mtime forward — simulates a release-engineer
  // driftBaselineIds append landing on disk mid-process (the exact C18
  // symptom: the append must not require a server restart to be seen).
  writeConfig(ws, { taskPaths: ["b.md"] }, 1_700_000_010_000);
  const second = loadConfig(ws);
  assert.deepEqual(
    second.taskPaths,
    ["b.md"],
    "second call must see the new on-disk content, not the cached first-call value",
  );
});

test("T-C5C18-07 AC-4: driftBaselineIds append is visible on the next loadConfig call", () => {
  const ws = mkWorkspace();
  writeConfig(ws, { driftBaselineIds: ["T1"] }, 1_700_000_000_000);
  const first = loadConfig(ws);
  assert.deepEqual(first.driftBaselineIds, ["T1"]);

  writeConfig(ws, { driftBaselineIds: ["T1", "T2"] }, 1_700_000_020_000);
  const second = loadConfig(ws);
  assert.deepEqual(
    second.driftBaselineIds,
    ["T1", "T2"],
    "a post-release driftBaselineIds append must be visible in the same process — this is the C18 bug this feature fixes",
  );
});

test("T-C5C18-07 AC-4 fast path: identical mtime serves the cached value (documented trade-off, not a defect)", () => {
  const ws = mkWorkspace();
  writeConfig(ws, { taskPaths: ["a.md"] }, 1_700_000_000_000);
  const first = loadConfig(ws);
  // Re-read WITHOUT touching the file at all — must hit the cache.
  const second = loadConfig(ws);
  assert.deepEqual(second, first);

  // Rewrite the file with DIFFERENT content but pin the SAME mtime the cache
  // already recorded. The cache keys strictly off mtime equality, so this
  // serves a stale hit — an accepted trade-off per the spec (strictly better
  // than the prior never-invalidate cache; real driftBaselineIds appends have
  // an ample time gap), not a regression.
  writeConfig(ws, { taskPaths: ["z.md"] }, 1_700_000_000_000);
  const third = loadConfig(ws);
  assert.deepEqual(
    third.taskPaths,
    ["a.md"],
    "same recorded mtime must still serve the cached value — accepted trade-off, pinned so it isn't mistaken for a bug later",
  );
});

// ---------- AC-5: existence-transition cases ----------

test("T-C5C18-07 AC-5: absent -> create -> delete -> recreate, no crash, no stale caching", () => {
  const ws = mkWorkspace();
  const p = configPathOf(ws);

  // 1. Absent.
  const absent1 = loadConfig(ws);
  assert.deepEqual(absent1, {}, "missing config returns empty WorkspaceConfig");

  // 2. Create.
  writeConfig(ws, { taskPaths: ["created.md"] }, 1_700_000_000_000);
  const created = loadConfig(ws);
  assert.deepEqual(
    created.taskPaths,
    ["created.md"],
    "creating the file after an absent-cache hit must be visible immediately (null -> number mtime transition)",
  );

  // 3. Delete again.
  fs.rmSync(p);
  const deleted = loadConfig(ws);
  assert.deepEqual(
    deleted,
    {},
    "deleting the file after a present-cache hit must fall back to {} (number -> null mtime transition), not a stale positive",
  );

  // 4. Recreate with different content.
  writeConfig(ws, { taskPaths: ["recreated.md"] }, 1_700_000_050_000);
  const recreated = loadConfig(ws);
  assert.deepEqual(
    recreated.taskPaths,
    ["recreated.md"],
    "recreating after a deleted-cache hit must be visible immediately (null -> number mtime transition again)",
  );
});

test("T-C5C18-07 AC-5: repeated absent reads before creation never crash and stay empty", () => {
  const ws = mkWorkspace();
  assert.deepEqual(loadConfig(ws), {});
  assert.deepEqual(
    loadConfig(ws),
    {},
    "second absent read must also return {} (cached null -> null hit, no crash)",
  );
  assert.deepEqual(loadConfig(ws), {});
});

test("T-C5C18-07 AC-5: existence flip beats mtime equality (delete+recreate at same numeric mtime still refreshes)", () => {
  const ws = mkWorkspace();
  const p = configPathOf(ws);
  const t = 1_700_000_000_000;
  writeConfig(ws, { taskPaths: ["first.md"] }, t);
  loadConfig(ws); // caches { config: { taskPaths: ["first.md"] }, mtimeMs: t }

  fs.rmSync(p);
  loadConfig(ws); // caches { config: {}, mtimeMs: null }

  // Recreate at the exact same mtime the file had before deletion.
  writeConfig(ws, { taskPaths: ["second.md"] }, t);
  const result = loadConfig(ws);
  assert.deepEqual(
    result.taskPaths,
    ["second.md"],
    "existence flip (null -> number) must force a refresh even when the new mtime numerically equals a stale prior value",
  );
});
