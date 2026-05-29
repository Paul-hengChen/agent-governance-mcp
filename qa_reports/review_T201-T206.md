# QA review — T201 + T202 + T203 + T204 + T205 + T206 (v3.14.1 patch)

## Round 1 — PASS — by qa-engineer

### Phase 0 — Claimed

State advanced from (code-reviewer, In_Progress) APPROVED → (qa-engineer, In_Progress).

### Phase 1 — Review

- **Copy Audit Gate**: spec lists exactly 2 strings, both `authored-here`:
  - `err.sanitiser_double_dot_rejected`: explicitly `(none — internal behaviour change)`. No-op. ✓
  - `changelog.3.14.1.heading`: covered by T207 release wiring. ✓
- **Visual Audit Gate**: N/A — patch release with no UI surfaces; spec explicitly marks Visual Tokens + Visual Widgets as N/A.
- **Phase 1.5**: `design/bug-fixes-v3.14.1.md` does NOT exist (feature has no UI). Phase 1.5 skipped per v3.14.0 absent-branch contract.

### Phase 3 — Tests

**Test File Discovery**: relevant test surface exists; created 2 new files + extended 1 existing.

**Spec-to-Test Map**:

| AC | Test |
|---|---|
| AC-1 (xenova reachability research) | `research/xenova-reachability.md` produced by researcher (T200) — REACHABLE verdict, T203 mitigation locked |
| AC-2 (mitigation if REACHABLE) | T203 `embedding_model` allowlist landed — verified by code-reviewer review_T201-T203.md |
| AC-3 (`..` literal collapse) | `test/visual-evidence-gate.test.mjs` v3.14.1 AC-3 — 4 tests covering leading/middle/triple-dot collapse + single-dot survival |
| AC-4 (Round 6 cap-cross predicate) | `test/visual-gate-e2e.test.mjs` AC-6 — 3 tests: normal cap-cross, external-bump cap-cross, no-fire-when-past-cap |
| AC-5 (`VISUAL_EVIDENCE_MISSING` composition) | `test/visual-gate-e2e.test.mjs` AC-5 — 3 tests: missing-all, partial, absent-design |
| AC-6 (Round 6 sentinel injection) | `test/visual-gate-e2e.test.mjs` AC-6 — covered by AC-4 tests |
| AC-7 (visual_round persistence) | `test/visual-gate-e2e.test.mjs` AC-7 — 2 tests: writeState→read, read-write cycle |
| AC-8 (SQLite visual_round) | `test/visual-round-sqlite.test.mjs` — 4 tests gated on `better-sqlite3` availability |
| AC-9 (read-error silent-swallow) | `test/visual-evidence-gate.test.mjs` v3.14.1 AC-9 — invalid UTF-8 read does not throw |
| AC-10 (`VISUAL_ROUND_EXCEEDED` composition) | `test/visual-gate-e2e.test.mjs` AC-10 — 3 tests: rejection structure, PM reset accepted, computeNewRound reset |

**Coverage**: +18 new tests across 3 files. No regression: 353/353 (v3.14.0 baseline) → 371/371 (v3.14.1).

**Security Smoke Tests**:
- Boundary: empty active_feature (existing AC-5 test in visual-evidence-gate.test.mjs covers this).
- Special characters: `..feat`, `f..oo`, `...`, `feat.v2` — all asserted.
- Invalid encoding: bad UTF-8 in design file — does not throw.
- Auth: N/A (no access control on these gates).

### Phase 4 — Run

- `npm run build` — zero TS errors. ✓
- `npm test` — 371/371 passing. ✓
- `npm audit --audit-level=high` — same 5 vulns as v3.14.0 (1 mod + 3 high + 1 critical, all `@xenova/transformers` transitive). The CRITICAL chain remains in the dep graph BUT the exploit path is now mitigated by T203 allowlist. CHANGELOG entry will document this honestly (downgrade waiver framing from "not reachable" to "reachable but path closed").
- CI runnability: headless, zero human interaction.

### Verdict — PASS

T201-T206 all PASS. T207 (release wiring) remains — sr-engineer scope.

Note for sr-engineer/PM: the code-reviewer flagged in their review_T201-T203.md that `qa_round` Round 4 and `review_round` Round 4 sentinels at `index.ts:747-752` carry the same `===` pattern that T202 fixed for `visual_round`. Not blocking v3.14.1 (path-to-trigger is migration-only); track as v3.14.2 follow-up symmetric fix.

— @qa-engineer
