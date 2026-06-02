# QA Report — v3.23.1 Final Release Payload

**Date:** 2026-06-02
**QA agent:** qa-engineer (sonnet)
**Scope:** T470 (drift fix, B3) + B4 (Node version pin) — combined PATCH release
**Node env:** v22.22.3 (matches .nvmrc=22)

---

## Phase 0 — Environment Gate

| Check | Result |
|---|---|
| `node -v` | v22.22.3 — v22.x confirmed |
| `.nvmrc` content | `22` |
| `package.json engines.node` | `>=20` (Option Y, no upper bound) |

---

## Phase 1 — Payload Verification

### Version triple consistency (3.23.1)
- `package.json version` = `3.23.1`
- `index.ts Server()` literal = confirmed by `scripts/check-version.mjs` OK
- `test/subagent-templates.test.mjs` pin: 4 sites updated from 3.23.0 → 3.23.1 (lines 368–380)

### drift.ts (T470 / B3 fix)
Key change: `usesActiveCompletedConvention` guard + `isArchivedSection()` filter.
- `isArchivedSection()` normalises via `.trim().toLowerCase()` — handles `## completed`, `##  Completed  `, `## COMPLETED` per AC-6.
- Active scope filter is backward-compat gated: only activates when the file uses Active/Completed convention (AC-3, AC-4 preserved).
- `## Completed` tasks are excluded from both `completedTasks` and `incompleteTasks` returned arrays (AC-5).

### CHANGELOG [3.23.1]
- Present, dated 2026-06-02.
- Covers both B3 (drift) and B4 (Node pin) with rationale for Option Y (no upper bound on `engines.node`).

### docs/backlog.md
- B4 row correctly marked `done (v3.23.1, Option Y)`.
- Prior non-blocking nit (rejected `>=20 <23` mention) was resolved — shipped text matches Option Y.

---

## Phase 3 — Test Results

```
npm test  (prebuild → tsc → node --test test/*.test.mjs)

# tests  498
# pass   498
# fail     0
# cancelled 0
# skipped   0
# duration_ms 8355
```

**Build:** ZERO tsc errors.
**check:version:** OK (3.23.1) — git tag reminder noted, non-blocking.
**npm audit --audit-level=high:** 0 vulnerabilities.

---

## Phase 4 — Drift Smoke Tests (rebuilt dist/tools/drift.js)

### Test 1: `## Completed` archived tasks excluded from drift

Fixture: `tasks.md` with `## Active` (T999 incomplete) and `## Completed` (T470, T460 checked).
Handoff: `completed_tasks: []`.

| Assertion | Result |
|---|---|
| `driftDetected` | `false` |
| T470 absent from `tasksCompleted` | PASS |
| T460 absent from `tasksCompleted` | PASS |
| T999 present in `tasksIncomplete` | PASS |
| detail = "No drift detected..." | PASS |

### Test 2: Active `[x]` task absent from handoff → drift surfaced

Fixture: `## Active` T999 checked; `## Completed` T470. Handoff: `completed_tasks: []`.

| Assertion | Result |
|---|---|
| `driftDetected` | `true` |
| T999 named in drift details | PASS |
| drift message = "vibe-coding drift" pattern | PASS |

Both smoke tests: **ALL PASS**

---

## AC Mapping (specs/drift-archived-task-exclusion.md)

| AC | Test coverage |
|---|---|
| AC-1: Completed section tasks don't fire drift | Test 1 |
| AC-2: Active [x] not in handoff still fires drift | Test 2 |
| AC-3: Legacy flat files (no Active/Completed) unchanged | `usesActiveCompletedConvention` guard (code review verified) |
| AC-4: Unknown sections treated as active | `isArchivedSection()` exact-match-only logic |
| AC-5: tasksCompleted/tasksIncomplete reflect active scope | Test 1 assertions |
| AC-6: Case-insensitive section matching | `trim().toLowerCase()` in `isArchivedSection()` |
| B4: .nvmrc=22 | Verified in Phase 0 |
| B4: engines.node >=20 | Verified in Phase 0 |

---

## Verdict

**PASS — v3.23.1 ready for release.**

All 498 tests pass on Node 22. Build clean. Zero vulnerabilities. Drift exclusion fix behaviorally confirmed via smoke tests. Version triple consistent. CHANGELOG complete. B4 payload correct (Option Y).
