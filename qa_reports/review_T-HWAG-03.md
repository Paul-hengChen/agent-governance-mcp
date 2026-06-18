# QA Review — T-HWAG-03
## Feature: handoff-write-arg-guard
## Reviewer: qa-engineer
## Date: 2026-06-18

---

## Phase 0 — Claim
State claimed at `(qa-engineer, In_Progress)` before any review work. Pre-flight satisfied.

---

## Phase 1 — Review

### Implementation audit
File: `index.ts`, `UpdateStateArgs` schema (lines 81–138).

Both `.refine()` additions are correct:

1. **AC-2 guard** (line 126–129): `path.basename(d.workspace_path) !== ".current"` — fires only when the last path segment is exactly `.current`. A path whose parent is `.current` (e.g. `/repos/.current-backup/foo`) is unaffected. Error path set to `["workspace_path"]`. Correct.

2. **AC-3 guard** (line 135–138): `d.active_feature !== "[object Object]"` — exact-string equality, not a regex. Cannot match legitimate feature ids accidentally. Error path set to `["active_feature"]`. Correct.

Version bump: `3.40.0 → 3.40.1` confirmed in both `package.json` (line 3) and `index.ts` `Server()` literal (line 230). Correct PATCH increment for a bug-fix-only change.

Pre-existing refines (`PASS/agent_id` at line 108, `prd_path` traversal at line 114) unchanged — verified by source inspection and regression tests.

### Phase 1 Copy Audit Gate

| string id | spec text | implementation | status |
|---|---|---|---|
| ERR_WORKSPACE_CURRENT | `workspace_path must be the workspace root, not the .current state directory` | `index.ts:127` — verbatim | PASS |
| ERR_ACTIVE_FEATURE_OBJECT | `active_feature must be a plain string id, not a serialised object` | `index.ts:136` — verbatim | PASS |

Both strings confirmed in `dist/index.js` (lines 91, 100) — build is not stale.

### Phase 1.5 — Visual Audit Gate
Skipped: `design/handoff-write-arg-guard.md` does not exist. This is a no-design feature per spec §Visual Tokens (N/A) and §Visual Widgets (N/A).

---

## Phase 2 — Discussion
No issues found in Phase 1. Proceeding directly to Phase 3.

---

## Phase 3 — Tests

### Test file
`/Users/paul.ph.chen/agent-governance-mcp/test/handoff-write-arg-guard.test.mjs`

### Strategy
`UpdateStateArgs` is not exported from `dist/index.js`. Tests exercise the MCP stdio server dispatch boundary — spawn `dist/index.js`, send JSON-RPC `tools/call` for `tw_update_state`, inspect the response. This is the only public interface reaching the Zod validation layer, consistent with the `teamwork-lite.test.mjs` and `baseline-manifest-gate.test.mjs` spawn pattern.

Key insight: Zod validation fires BEFORE the pre-flight guard, so tests that only need to verify Zod acceptance/rejection do not need a prior `tw_get_state` call. This makes each test independent (3 messages: init handshake + updateState call) and eliminates timing flakiness from multi-message sequences.

### AC → Test mapping

| AC | Test name | Test number | Status |
|---|---|---|---|
| AC-1 (valid root path accepted) | `t-ac1-valid-root-path-accepted` | 225 | PASS |
| AC-1 (valid feature string) | `t-ac1-valid-feature-string-accepted` | 226 | PASS |
| AC-2 (rejected with error) | `t-ac2-current-basename-rejected` | 227 | PASS |
| AC-2 (exact error message) | `t-ac2-exact-error-message` | 228 | PASS |
| AC-2 (non-.current accepted) | `t-ac2-non-current-basename-accepted` | 229 | PASS |
| AC-3 (sentinel rejected) | `t-ac3-object-sentinel-rejected` | 230 | PASS |
| AC-3 (exact error message) | `t-ac3-exact-error-message` | 231 | PASS |
| AC-3 (non-sentinel accepted) | `t-ac3-valid-feature-id-not-rejected` | 232 | PASS |
| AC-4 (no nested dir created) | `t-ac4-no-nested-current-dir` | 233 | PASS |
| AC-4 (sentinel not persisted) | `t-ac4-sentinel-not-persisted` | 234 | PASS |
| regression PASS/agent_id | `t-reg-pass-requires-qa-engineer` | 235 | PASS |
| regression prd_path traversal | `t-reg-prd-path-traversal` | 236 | PASS |

Additional string-level smoke tests (tests 223–224):
- `dist/index.js contains verbatim ERR_WORKSPACE_CURRENT string` — guards against stale dist
- `dist/index.js contains verbatim ERR_ACTIVE_FEATURE_OBJECT string` — guards against stale dist

### Coverage
15 new tests covering all 4 ACs. The schema is not exported so line-level coverage tooling cannot be applied; coverage is validated by the behavioral boundary tests above.

---

## Phase 4 — Run

### Build
`npm run build` — ZERO TypeScript errors. Version check passes (`3.40.1`).

### Test suite
`npm test` — 727 total subtests.
- **New HWAG tests (15)**: ALL PASS (tests 223–236)
- **AC-9 baseline-manifest-gate tests (2)**: now PASS after correcting stale `3.40.0` → `3.40.1` assertions in `test/baseline-manifest-gate.test.mjs` (lines 619–639). These were the two tests causing suite RED in the prior PASS record.
- **npm audit**: pre-existing highs, no dependency change in this feature — waived per task instructions.

### AC → Test mapping (AC-9 in baseline-manifest-gate.test.mjs)

| Test name | Result (corrected) |
|---|---|
| `AC-9: package.json version field equals 3.40.1` | ok 48 — PASS |
| `AC-9: index.ts Server() literal equals 3.40.1` | ok 49 — PASS |

---

## Non-blocking note (future hardening, out-of-scope for MVP)

The AC-9 version assertions in `test/baseline-manifest-gate.test.mjs` are brittle by design: they hardcode `"3.40.1"` and will break on every future version bump. A more durable approach would assert `package.json version === index.ts Server() literal` (consistency check) rather than checking against a hardcoded string. This would survive every future PATCH/MINOR/MAJOR bump without needing test edits. Flagged for future hardening; NOT changed now.

---

## Verdict

**PASS** — All 4 ACs covered, all 15 new HWAG tests green, 2 previously-stale AC-9 assertions corrected to `3.40.1`, build clean.

## 2026-06-18T02:43:13.126Z — PASS (error-laden, suite RED) — by qa-engineer [SUPERSEDED]

## 2026-06-18 (corrected) — PASS — by qa-engineer

All 4 ACs green. 15 new tests in test/handoff-write-arg-guard.test.mjs cover AC-1 through AC-4 plus 2 regression guards. Surgical fix applied to 2 stale AC-9 assertions in test/baseline-manifest-gate.test.mjs (version string updated from 3.40.0 → 3.40.1). Full suite 727/727 green, zero failures. Build clean (0 TS errors). npm audit highs pre-existing, no dep change, waived.

