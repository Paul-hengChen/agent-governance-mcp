# QA Review: T478 + T479 + T480
**Feature**: backlog-batch-v3.24.0  
**QA Agent**: qa-engineer (sonnet)  
**Date**: 2026-06-02  
**Status**: PASS

---

## Scope

| Task | Description | Owner |
|------|-------------|-------|
| T478 | transport/ HTTP staging (code-reviewer APPROVED; review_reports/review_T478.md) | sr-engineer |
| T479 | test/release-staging.test.mjs — add transport/ to FEATURE_DIRS, remove from EXCLUDED_DIRS | qa-engineer |
| T480 | test/subagent-templates.test.mjs — escape all regex metacharacters in version check | qa-engineer |

---

## Phase 1 — Review

### T478 (pre-approved by code-reviewer)
Code-reviewer approved T478 via review_reports/review_T478.md. QA scope confirmed: no correctness/architecture issues surfaced that code-reviewer missed. T478 adds `transport/http.ts` as HTTP transport layer for SQLite/multi-session mode and is reflected in the SOP (`content/skill-release-engineer.md` already enumerates `transport/` in git add step).

### T479 — release-staging.test.mjs
**Changes made**:
- `/Users/paul.ph.chen/agent-governance-mcp/test/release-staging.test.mjs`
  - Added `"transport/"` to `FEATURE_DIRS` array (alongside lib/, tools/, schema/, guards/, prompts/, bin/, scripts/, content/, templates/, specs/, test/, qa_reports/, review_reports/).
  - Removed `"transport"` from `EXCLUDED_DIRS` Set.

**Rationale**: `transport/` contains `http.ts` (a .ts source file). Before this fix, AC-B5.5 excluded it from the scan — making it invisible to the release staging guard. With `transport/` in `FEATURE_DIRS` and out of `EXCLUDED_DIRS`, the gatekeeper test now correctly detects transport/ as a source directory that must be staged in releases. The SOP (`skill-release-engineer.md`) already enumerates `transport/` at line 45, so AC1 passes without a content change.

### T480 — subagent-templates.test.mjs
**Change made**:
- `/Users/paul.ph.chen/agent-governance-mcp/test/subagent-templates.test.mjs`
  - Version regex escape: `expectedVersion.replace(/\./g, "\\.")` → `expectedVersion.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")`.

**Rationale**: The previous escape only handled `.` (dot). Semver pre-release strings (e.g. `1.0.0-alpha+001`, `3.24.0-rc.1`) include `-`, `+`, and `(` which are regex metacharacters. The standard `escapeRegExp` idiom escapes the full metacharacter set. Semantics are unchanged: still verifies `package.json version === index.ts Server() literal`.

---

## Spec-to-Test Map (backlog-batch-v3.24.0)

| AC | Test | File | Result |
|----|------|------|--------|
| AC-B5.5 (repo-scan guard sees transport/) | ok 279 - AC-B5.5: every repo source directory appears in FEATURE_DIRS or metadata list | test/release-staging.test.mjs | PASS |
| B3 (dynamic version, pkg==index.ts) | ok 360 - AC8: package.json + index.ts versions match | test/subagent-templates.test.mjs | PASS |

---

## Phase 3 — Test Run Results

```
npm test
# tests 499
# pass  499
# fail  0
# skipped 0
```

Additional checks:
- `npm run build` — ZERO errors (tsc clean)
- `node scripts/check-version.mjs` — OK (3.23.1)
- `npm audit --audit-level=high` — 0 vulnerabilities

---

## Phase 1.5 — Visual Audit Gate
Skipped: no `design/<feature>.md` with Visual Baselines for this feature (backend/test-infra changes only).

## Copy Audit Gate
Skipped: no user-facing strings introduced in T478/T479/T480.

---

## Decision

**PASS** — all 499 tests green, zero build errors, zero audit findings. T478 transport/ staging confirmed working by AC-B5.5 gatekeeper. T479/T480 test fixes are correct and minimal. Version not bumped (T481 version bump 3.23.1→3.24.0 deferred to release-engineer).

---

## Pending

- T481: version bump 3.23.1 → 3.24.0 + CHANGELOG [3.24.0] entry — owned by release-engineer.
