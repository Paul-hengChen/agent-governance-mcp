// Coded by @qa-engineer
// Tests for specs/e235a-relative-prd-path.md AC1-AC4. In file mode `prd_path` is stored
// relative to the workspace, because the absolute form leaks the OS account name into
// committed handoff history (Constitution §6), and is resolved back to absolute in memory
// at read time; an out-of-bounds value is dropped as if absent and never echoed (AC4,
// architecture DR-2/DR-3). Unit-level against dist/ helpers and parse/write entry points.
// Rationale: specs/e260f-comment-rationale.md (test/e235a-relative-prd-path.test.mjs).

import { test } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

import { parseHandoff, writeHandoffState } from "../dist/tools/handoff.js";
import {
  isInsideWorkspace,
  relativizePrdPath,
  resolveStoredPrdPath,
} from "../dist/tools/handoff-parse.js";
import { resetSession } from "../dist/guards/session.js";
import { resolveCurrentLanePaths } from "../dist/tools/lane-paths.js";

function mkWorkspace(prefix = "e235a-") {
  const ws = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  fs.mkdirSync(path.join(ws, ".current"), { recursive: true });
  return ws;
}

// Read side: the real lane-scoped path if it exists (e.g. after a
// writeHandoffState call has run), else the flat legacy path — same
// existsSync-gated fallback readAndMigrate itself uses.
function handoffPath(ws) {
  const lanePath = resolveCurrentLanePaths(ws).handoffPath;
  return fs.existsSync(lanePath) ? lanePath : path.join(ws, ".current", "handoff.md");
}

function readRawHandoff(ws) {
  return fs.readFileSync(handoffPath(ws), "utf-8");
}

// Write side for hand-built raw fixtures: the flat legacy `.current/handoff.md`
// path (no lane directory has been created yet in a brand-new temp workspace).
// readAndMigrate falls back to this exact path when the lane-scoped path
// doesn't exist yet — same convention test/handoff-migration.test.mjs uses.
function writeRaw(ws, content) {
  fs.writeFileSync(path.join(ws, ".current", "handoff.md"), content, "utf-8");
}

// Minimal v15 (CURRENT_VERSIONS.handoff) raw fixture builder — schema_version
// already at CURRENT so readAndMigrate applies zero migrations (no heal
// write, no unrelated field-default noise), mirroring the v3/v5 legacy
// fixtures in test/handoff-migration.test.mjs but pinned at the current
// version so this file's assertions are about prd_path alone.
function rawFixture({ prdPathLine }) {
  return `---
schema_version: 15
active_feature: "e235a-fixture-feat"
status: "In_Progress"
last_updated: "2026-09-28T00:00:00.000Z"
last_agent: "pm"
qa_round: 0
review_round: 0
visual_round: 0
hop_count: 0
${prdPathLine}
---
## ✅ Completed
- 無

## ⚠️ Pending & Handoff Notes
- next_role: sr-engineer
`;
}

// ---------- AC1 — write-time relativize ----------

test("AC1: write stores relative prd_path in frontmatter, not the raw absolute value", async () => {
  const ws = mkWorkspace();
  resetSession();
  parseHandoff(ws);

  const absPrdPath = path.join(ws, "specs", "foo.md");
  await writeHandoffState({
    workspacePath: ws,
    activeFeature: "e235a-ac1",
    status: "In_Progress",
    completedTasks: [],
    pendingNotes: ["next_role: sr-engineer"],
    lastAgent: "pm",
    prdPath: absPrdPath,
  });

  const raw = readRawHandoff(ws);
  assert.match(raw, /prd_path: "specs\/foo\.md"/, "on-disk frontmatter must store the workspace-relative form");
  assert.doesNotMatch(raw, /prd_path: ".*foo\.md.*e235a-/, "on-disk frontmatter must never contain the raw absolute value");

  // Round-trip: tw_get_state-equivalent read resolves it back to the exact
  // absolute path the caller originally supplied (AC2, exercised here as
  // AC1's own round-trip proof).
  const state = parseHandoff(ws);
  assert.equal(state.prd_path, absPrdPath, "read-back must resolve to the original absolute path");
});

// ---------- AC2 — read-time resolve to absolute ----------

test("AC2: read resolves relative prd_path to absolute (workspace_path + the stored value)", () => {
  const ws = mkWorkspace();
  resetSession();
  writeRaw(ws, rawFixture({ prdPathLine: 'prd_path: "specs/rel.md"' }));

  const state = parseHandoff(ws);
  assert.equal(
    state.prd_path,
    path.join(ws, "specs", "rel.md"),
    "a relative stored value must resolve to workspace_path + the stored value",
  );
});

// ---------- AC3 — legacy absolute passthrough ----------

test("AC3: a legacy in-bounds absolute prd_path parses unchanged, verbatim, with no forced rewrite", () => {
  const ws = mkWorkspace();
  resetSession();
  const legacyAbs = path.join(ws, "specs", "legacy.md");
  const rawBefore = rawFixture({ prdPathLine: `prd_path: "${legacyAbs}"` });
  writeRaw(ws, rawBefore);

  const state = parseHandoff(ws);
  assert.equal(state.prd_path, legacyAbs, "legacy absolute value must be returned verbatim, no re-encoding");

  // parseHandoff (unlike readHandoffState) never heals/write-backs on a plain
  // read, and no migration ran (schema_version already CURRENT) — so the
  // on-disk bytes must be untouched. This is the "no forced rewrite" half of
  // AC3, distinct from the value-equality assertion above.
  const rawAfter = readRawHandoff(ws);
  assert.equal(rawAfter, rawBefore, "a read must never rewrite a legacy absolute prd_path on disk");
});

// ---------- AC4 — resolved-path traversal guard ----------

test("AC4: resolved-path traversal guard — a stored relative value that escapes the workspace via '..' resolves to absent", () => {
  const ws = mkWorkspace();
  resetSession();
  writeRaw(ws, rawFixture({ prdPathLine: 'prd_path: "../outside.md"' }));

  const state = parseHandoff(ws);
  assert.equal(state.prd_path, undefined, "a traversal-escaping relative value must be dropped, not resolved");

  // Unit-level pin on the shared helper directly (the read path's own
  // building block), so a future regression is caught at the smallest unit,
  // not only through the full parseHandoff integration above.
  assert.equal(resolveStoredPrdPath(ws, "../outside.md"), undefined);
  assert.equal(isInsideWorkspace(ws, path.resolve(ws, "../outside.md")), false);
});

test("AC4: resolved-path traversal guard — a stored value that resolves to exactly the workspace root itself is out-of-bounds (rel === '')", () => {
  const ws = mkWorkspace();
  resetSession();
  // "." resolves to workspace_path itself — isInsideWorkspace requires a
  // NON-EMPTY relative remainder, so the workspace root is not a valid
  // prd_path (there is no file there, and rel === "" is the documented
  // exclusion in the isInsideWorkspace contract).
  writeRaw(ws, rawFixture({ prdPathLine: 'prd_path: "."' }));

  const state = parseHandoff(ws);
  assert.equal(state.prd_path, undefined, "the workspace root itself must not resolve as a valid prd_path");
  assert.equal(isInsideWorkspace(ws, ws), false, "isInsideWorkspace(ws, ws) must be false (rel === '')");
});

test("AC4: resolved-path traversal guard — an absolute sibling directory that merely string-prefixes the workspace path is rejected", () => {
  const ws = mkWorkspace();
  resetSession();
  // Classic path-traversal false-accept trap: a naive `startsWith(workspacePath)`
  // string check would wrongly ACCEPT "<ws>-sibling/evil.md" because the
  // string "<ws>-sibling" starts with "<ws>". The real guard is
  // path.relative-based (isInsideWorkspace), which must correctly REJECT it.
  const siblingPath = `${ws}-sibling/evil.md`;
  writeRaw(ws, rawFixture({ prdPathLine: `prd_path: "${siblingPath}"` }));

  const state = parseHandoff(ws);
  assert.equal(state.prd_path, undefined, "a string-prefix sibling directory must not be treated as in-workspace");
  assert.equal(isInsideWorkspace(ws, siblingPath), false);
  assert.equal(resolveStoredPrdPath(ws, siblingPath), undefined);

  // The write-side helper must reject the identical shape too — same bound,
  // one source (architecture DR-1/DR-2: isInsideWorkspace is shared).
  assert.equal(relativizePrdPath(ws, siblingPath), undefined);
});

test("AC4: resolved-path traversal guard — a direct (non-zod) writeHandoffState caller with an out-of-bounds prd_path drops the field instead of persisting it", async () => {
  const ws = mkWorkspace();
  resetSession();
  parseHandoff(ws);

  const outOfBoundsPath = `${ws}-sibling/evil.md`;
  await writeHandoffState({
    workspacePath: ws,
    activeFeature: "e235a-ac4-direct-writer",
    status: "In_Progress",
    completedTasks: [],
    pendingNotes: ["next_role: sr-engineer"],
    lastAgent: "pm",
    prdPath: outOfBoundsPath,
  });

  const raw = readRawHandoff(ws);
  assert.doesNotMatch(raw, /prd_path:/, "an out-of-bounds prd_path must be omitted from the write entirely, not persisted");

  const state = parseHandoff(ws);
  assert.equal(state.prd_path, undefined, "the omitted field must read back as absent");
});

test("AC4: resolved-path traversal guard — the out-of-bounds warning never echoes the offending value on stderr", async () => {
  const ws = mkWorkspace();
  resetSession();
  parseHandoff(ws);

  // A distinctive marker substring that MUST NOT appear in the logged
  // message, proving the warning is a constant string, not an interpolation
  // of the caller-supplied path (Constitution §6: never echo a raw path/
  // value that could carry sensitive local info into a log or evidence file).
  const marker = "SHOULD-NEVER-BE-LOGGED-e235a";
  const outOfBoundsPath = path.join(ws + "-sibling", `${marker}.md`);

  const originalConsoleError = console.error;
  const captured = [];
  console.error = (...args) => {
    captured.push(args.join(" "));
  };
  try {
    await writeHandoffState({
      workspacePath: ws,
      activeFeature: "e235a-ac4-no-echo",
      status: "In_Progress",
      completedTasks: [],
      pendingNotes: ["next_role: sr-engineer"],
      lastAgent: "pm",
      prdPath: outOfBoundsPath,
    });
  } finally {
    console.error = originalConsoleError;
  }

  assert.ok(captured.length > 0, "an out-of-bounds prd_path must still warn (fail loud about the drop, per §7)");
  const joined = captured.join("\n");
  assert.doesNotMatch(
    joined,
    new RegExp(marker),
    "the stderr warning must never echo the caller-supplied path value",
  );
  assert.match(
    joined,
    /prd_path resolves outside workspace_path/,
    "the warning must use the constant, value-free message",
  );
});
