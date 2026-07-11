# QA Review — e2-bugfix-repro-gate

covers: T-E2-06

Reviewer: qa-engineer
Tasks under review: T-E2-05 (tests), T-E2-06 (full verification + PASS)

## Phase 0 — Claim

Claimed review of T-E2-05, T-E2-06 (`tw_update_state(agent_id="qa-engineer", status=In_Progress)`).

## Expected-Red Diff

Manifest declared: `qa_reports/expected-red_e2-bugfix-repro-gate.txt` (42 entries, Groups A–D per sr-engineer's annotations).

- Ran the full suite BEFORE any re-baseline edit: **1193 pass / 42 fail**.
- Collected the actual set of failing tests (`node --test test/*.test.mjs 2>&1 | grep '^not ok'`) — exactly 42 entries.
- Diffed the actual-red set against the manifest: **every one of the 42 actual reds matches a manifest entry 1:1** (Group A: 35 handoff v10→v11 version-pin tests; Group B: 3 gate-registry-count/doc-map/free-text-closure tests; Group C: 1 `gates-expected-red.test.mjs` I5b indexOf-heuristic test; Group D: 3 skill-text token/byte-cap tests). **Zero unexplained reds** (comm-style set difference is empty).
- This is a **feature-mode** ticket (no `dispatch_mode` on this handoff) — the Phase 0.5 disposition here is advisory per the standard (non-bugfix) branch; it happens to be clean regardless (0 extras, 0 missing).
- Disposition: `Phase 0.5: clean (42/42 manifest entries confirmed red, 0 unexplained reds)`.
- Re-baselined each of the 42 per its group's stated reason (see commit diff): version-literal pins bumped 10→11 (and forward-compat "future" probes bumped 11→12) across `test/cut-approval-gate.test.mjs`, `test/dispatch-pins.test.mjs`, `test/drift-skew.test.mjs`, `test/handoff-migration.test.mjs`, `test/handoff-versioning.test.mjs`, `test/schema-versions.test.mjs`, `test/skill-evolution-v3.11.test.mjs`, `test/stale-dispatch-detection.test.mjs`; gate-count/doc-map/FREE_TEXT_ALLOWLIST updated in `test/error-code-contract.test.mjs` (25→26, `REPRO_MANIFEST_MISSING:triggerEdge` allowlisted with reason); `test/gates-expected-red.test.mjs` I5b rewritten to disambiguate the two now-existing `hasExpectedRedManifest(parsed.workspace_path...)` call sites (compound-if repro-first gate vs. single-line-if PASS-path gate) instead of a single unconditional `lastIndexOf`; token/byte caps raised in `test/context-budget.test.mjs` (skill-pm 3473→3775, skill-sr-engineer 2469→2642) and `test/qa-visual-skill-split.test.mjs` (qa-engineer.md 12200→12950), each re-measured independently (not trusted from sr-engineer's notes) against the built `dist/` output.
- Post-re-baseline full run: **1235 pass / 0 fail** (1193 + 42 re-baselined green).

## Phase 1 — Review (sanity, code-reviewer already APPROVED T-E2-01/02/03 zero-findings)

Read the full diff (`git diff HEAD -- gates/registry.ts tools/handoff-orchestrator.ts tools/handoff.ts tools/registry.ts schema/versions.ts schema/migrations-handoff.ts content/skill-pm.md content/skill-sr-engineer.md content/skill-qa-engineer.md docs/schema-versions.md`) independently against `specs/e2-bugfix-repro-gate-architecture.md`. Confirmed:

- `dispatch_mode` field, schema v10→v11 stamp-only migration, zod enum boundary, and `writeHandoffState` feature-scoped carry-forward (option (1)/(2)/(3) algorithm) all match the architecture's pinned Data Structures / Interface Contracts sections verbatim.
- `REPRO_MANIFEST_MISSING` gate block in `tools/handoff-orchestrator.ts` matches the architecture's pinned Interface Contracts code block verbatim (arm condition, trigger edge, `FileHandoffStorage` guard, placement after external-refs / before review-verdict-mismatch, no `tools/transitions.ts` change per DR-5).
- No production findings — concur with code-reviewer's T-E2-04 verdict (`review_reports/review_T-E2-04.md`).

## Copy / Visual Audit Gates (3a/3b)

Spec's Copy/Strings and Visual Tokens/Widgets sections are all `N/A` (governance/server mechanism only, no user-facing surface). Both gates are no-ops for this feature — logged, no action taken.

## Phase 1.5 — Visual Compare

No `design/e2-bugfix-repro-gate.md` exists (non-design feature, architecture confirms). `Phase 1.5: skipped (no Visual Baselines declared)`.

## Phase 3 — Tests (new coverage, T-E2-05)

New file `test/repro-first-gate.test.mjs` (16 tests) plus edits to 10 existing files to re-baseline Phase 0.5's 42 expected reds (see above).

### AC → Test map

| AC | Test(s) |
|---|---|
| AC1 (default routing pm→sr→code-reviewer→qa, no architect hop) | Chain/skill-text mechanics only, not server-enforced (PM judgment call per spec Out of Scope) — covered by S1 (skill-pm.md guidance text) |
| AC2 (server BLOCKS fix-phase write pre-manifest) | G1 (blocked, no manifest), G2 (unblocked, manifest present) |
| AC3 (strict load-bearing PASS in bugfix mode) | S3 (skill-qa-engineer.md prose pin); machine floor is the existing `EXPECTED_RED_DIFF_MISSING` gate (see `test/gates-expected-red.test.mjs`, unchanged) |
| AC4 (opt back into full chain / feature mode) | D6 (explicit `dispatch_mode="feature"` override), S1 (skill-pm.md opt-back-in text) |
| AC5 (feature-mode chains byte-unchanged) | G3 (gate never fires absent `dispatch_mode`), Phase 0.5 clean diff (0 regressions to existing round caps / `ALLOWED_TRANSITIONS` / C15 advisory path) |
| AC6 (clean rejection, never silent-skip/throw) | G1 (message content, never a throw), G4 (Blocked escape to pm never gated) |
| `dispatch_mode` field mechanics | D1 (emit/round-trip), D2 (absence≠"feature" literal), D3 (carry-forward), D4 (drop on feature change), D5 (no PM re-entry re-arm), D6 (explicit override), Z1 (zod out-of-enum boundary rejection) |
| Migration v10→v11 stamp-only | M1 (hand-written v10 file migrates to v11, no seed, siblings preserved) |
| File-mode only (SQLite ignores `dispatch_mode`) | G5 (SQLite mode never arms the gate; `dispatch_mode` never persisted there) |
| Skill-text pinning (T-E2-03) | S1 (skill-pm.md), S2 (skill-sr-engineer.md, `REPRO_MANIFEST_MISSING` backtick-quote contract), S3 (skill-qa-engineer.md) |

### Coverage Gate

New/modified surface is entirely exercised: `tools/handoff.ts` dispatch_mode parse/emit/carry paths (D1–D6), `tools/registry.ts` zod boundary (Z1), `schema/migrations-handoff.ts` v10→v11 step (M1), `tools/handoff-orchestrator.ts` new gate block (G1–G5), and all three skill-text diffs (S1–S3). Tooling doesn't produce a line-coverage number for this project (no `nyc`/`c8` wired); manual audit confirms every new branch in the diff (arm condition true/false × file-mode/SQLite × manifest present/absent × Blocked-escape) has a dedicated test.

### Security Smoke Tests

- Boundary inputs: Z1 exercises an out-of-enum string (`"hotfix"`) rejected at the zod boundary before any gate/handler logic runs. `dispatch_mode` has no numeric/size boundary (2-value closed enum) and no auth/permission surface (it's a workspace-local classification field, not gated by identity) — N/A beyond the enum-boundary case already covered.

## Phase 4 — Run

- `npx tsc` (project build): zero errors.
- `node --test test/*.test.mjs`: CI-runnable headlessly, zero human interaction.
- Full suite result: **1251 pass / 0 fail** (1235 post-Phase-0.5 + 16 new `repro-first-gate.test.mjs` tests).

See `qa_reports/review_T-E2-06.md` (or the T-E2-06 PASS write) for `npm run build` + `npm audit --audit-level=high` + full `npm test` verification evidence.

## Verdict

PASS-eligible. Proceeding to T-E2-06 full verification.
## 2026-07-11T20:16:54.810Z — PASS — by qa-engineer

e2-bugfix-repro-gate: full verification PASS. Build: npx tsc — zero errors. Audit: npm audit --audit-level=high — exit 0 (1 low-severity esbuild dev-dep finding only, below threshold). Tests: npm test — 1251 pass / 0 fail (0 skipped, 0 todo). Phase 0.5 Expected-Red Diff: ran full suite pre-re-baseline (1193 pass / 42 fail), diffed actual reds against qa_reports/expected-red_e2-bugfix-repro-gate.txt — all 42 matched 1:1 (Group A: 35 handoff v10->v11 version-pin tests across 8 files; Group B: 3 gate-registry-count/doc-map/free-text-allowlist tests in error-code-contract.test.mjs, re-baselined 25->26 + REPRO_MANIFEST_MISSING:triggerEdge allowlisted; Group C: 1 gates-expected-red.test.mjs I5b test, rewritten to disambiguate the two now-existing FileHandoffStorage-guarded hasExpectedRedManifest call sites; Group D: 3 skill-text token/byte-cap tests, independently re-measured against built dist/ and raised: skill-pm 3473->3775 tok, skill-sr-engineer 2469->2642 tok, skill-qa-engineer.md byte cap 12200->12950), zero unexplained reds. New coverage: test/repro-first-gate.test.mjs (16 tests) covering dispatch_mode parse/emit/carry-forward/drop-on-feature-change/no-PM-re-entry-re-arm/AC4-opt-back-in (D1-D6), zod out-of-enum boundary rejection (Z1), v10->v11 stamp-only migration on a hand-written old file (M1), REPRO_MANIFEST_MISSING gate fires/clears/never-fires-in-feature-mode/never-gates-the-Blocked-escape (G1-G4), SQLite-mode never arms (G5), and skill-text pinning for all three T-E2-03 additions (S1-S3). Phase 1 review: independently read the full diff against specs/e2-bugfix-repro-gate-architecture.md — matches verbatim (dispatch_mode field/migration/zod boundary, REPRO_MANIFEST_MISSING gate placement/arm-condition/hint), zero production findings, concur with code-reviewer's T-E2-04 APPROVED verdict. Copy/Visual audit gates: N/A (spec has no user-facing strings/visual tokens), logged no-op. Evidence: qa_reports/review_T-E2-05.md (covers T-E2-06) carries the AC-to-test map, Expected-Red Diff disposition, and Phase 4 run evidence.

