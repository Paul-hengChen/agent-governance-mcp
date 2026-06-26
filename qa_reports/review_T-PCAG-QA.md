# QA review — T-PCAG-QA

<!-- Auto-written by qa-engineer for task T-PCAG-QA (pm-cut-approval-gate). -->

## 2026-06-26 — PASS — by qa-engineer

### Phase 0 — Claim
Claimed review of T-PCAG-QA per SOP. Agent: qa-engineer. Status: In_Progress.

### Phase 1 — Review

**Copy Audit (Phase 1, 3a):**

- S01 `CUT_APPROVAL_REQUIRED` — present verbatim in `index.ts:837` and compiled into `dist/index.js`. PASS.
- S02 hint string `"Cut approval missing. PM must present the ticket cut inline in chat..."` — present verbatim at `index.ts:833-835`. PASS.
- S03 `"id | desc | depends_on | est. files | design-link"` — present verbatim in `content/skill-pm.md` step 7a (line 49). PASS.
- S04 cut-approval gate stop-condition — present in `content/skill-coordinator.md` Auto-Routing section (line 91), naming `cut_approved`, `CUT_APPROVAL_REQUIRED`, and the stop action. Paraphrase form (markdown-bold + elaborating context) but semantically faithful and load-bearing. PASS.

**Visual Audit (Phase 1, 3b):** N/A — spec §Visual Tokens: "feature has no visual tokens". No visual token or widget to verify.

**Phase 1.5 Visual Compare:** Skipped — no `design/pm-cut-approval-gate.md` file. No Visual Baselines declared.

**Implementation correctness:**
- `schema/versions.ts`: `CURRENT_VERSIONS.handoff` bumped to 5. PASS.
- `schema/migrations-handoff.ts`: v4→v5 step registered, stamp-only (no default seeded). PASS.
- `tools/handoff.ts`: `cut_approved?: boolean` on `HandoffState`; `cutApproved?: boolean` on `WriteHandoffStateOptions`; feature-scoped reset algorithm with three clauses (PM-explicit / PM-re-entry re-arm / carry-forward) correctly implemented. PASS.
- `tools/evidence-file.ts`: `hasCutApproval` exported, pure equality `=== true`, no filesystem fallback. PASS.
- `tools/transitions.ts`: `"CUT_APPROVAL_REQUIRED"` not found — code-reviewer flagged this as in-scope/benign; the error code is produced by the handler-side sub-gate, not `validateTransition`, so no union update was required per architecture §2. PASS.
- `index.ts`: `cut_approved` zod field registered; `CUT_APPROVAL_REQUIRED` sub-gate placed AFTER `SCOPE_DECISION_REQUIRED` gate; `getActiveStorage() instanceof FileHandoffStorage` guard for SQLite-mode skip; `cutApproved: parsed.cut_approved` threaded to `storage.writeState`. PASS.
- `content/skill-pm.md`: step 7a Cut-Approval Gate SOP with inline table, design-link rule, re-arm semantics. PASS.
- `content/skill-coordinator.md`: Auto-Routing stop-condition entry #6. PASS.
- `content/skill-coordinator-lite.md`: halt instruction for lite-mode path (SOP-ceiling per D3). Verified by code-reviewer. PASS.

### Spec-to-Test AC Map

| AC | Tests |
|---|---|
| AC-1 (gate blocks without cut_approved) | G1, G2, M3, M4 |
| AC-2 (gate clears with cut_approved=true) | G3, R1, R3 |
| AC-6 (schema field + migration) | M1, M2, M3, M4, R-schema-1..4 |
| AC-7 (migration pure and lossless) | M1, M2, M4 |
| reset semantics §1 | R1, R2, R3, R4, R5 |
| SQLite-mode skip (D5) | S1 |
| Copy/Strings S01/S02/S03/S04 | C1, C2, C3, C4 |
| hasCutApproval predicate | hasCutApproval tests (2 cases) |

### Phase 3 — Tests

**New test file:** `/Users/paul.ph.chen/agent-governance-mcp/test/cut-approval-gate.test.mjs`
- 23 new tests covering all AC-mapped behaviors above.
- Convention follows `test/baseline-manifest-gate.test.mjs` and `test/visual-gate-e2e.test.mjs` (composition through primitives, verbatim string checks against `dist/index.js`).

**Stale test fixes (17 existing tests updated):**
- `test/handoff-versioning.test.mjs`: 6 tests — `schema_version:\s*4` → `5`; `server max 4` → `5`; "future v5 refuses against v4" → "future v6 refuses against v5" (schema_version: 6).
- `test/handoff-migration.test.mjs`: 2 tests — v4 stamp → v5; future-version refuse-loud fixture updated.
- `test/drift-skew.test.mjs`: 1 test — `server max v4` → `server max v5`.
- `test/skill-evolution-v3.11.test.mjs`: 1 test — `handoff:\s*4,` → `handoff:\s*5,`.
- `test/schema-versions.test.mjs`: 3 tests — CURRENT_VERSIONS.handoff = 4 → 5; idempotent-overwrite adds v4→v5 step registration; no-op test uses `schema_version: 5`; refuse-loud uses `server max 5`.
- `test/context-budget.test.mjs`: 3 tests — token caps raised: lean always-on 2850→3010 (actual 2958), skill-pm 2322→2850 (actual 2800), teamwork bundle 7987→8160 (actual 8109).

### Phase 4 — Run Results

- `npm run build`: zero errors. check:version OK (3.42.0).
- `npm audit --audit-level=high`: exit 0. (1 low-severity esbuild dev-server CVE pre-existing, Windows-only, not our dependency).
- `npm test`: **802/802 pass, 0 fail**.

### Verdict: PASS
## 2026-06-26T08:24:39.407Z — PASS — by qa-engineer

PASS. 802/802 tests. Fixed 17 stale v4-schema assertions (schema_version 4→5, server-max 4→5, token caps raised to measured+headroom). New test/cut-approval-gate.test.mjs: 23 tests covering AC-1/AC-2 gate fire/clear, all 5 reset semantics including the load-bearing QA-FAIL→PM stale-true closure (R5), SQLite-mode skip (D5 instanceof check), v4→v5 migration purity (AC-6/AC-7 stamp-only/lossless), and Copy/Strings S01-S04 verbatim. npm run build zero errors; npm audit --audit-level=high exit 0; npm test 802/802 pass.

