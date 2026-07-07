# QA Review — drift-baseline-exemption (C4-01..C4-05, C4-07)

Covering report for the QA round. `review_C4-02.md` … `review_C4-07.md` are pointer stubs to this file (per-id evidence-check requirement; backlog C3).

QA context: in-context fallback (subagent dispatch hit session limit); this context did not author the implementation (sr-engineer subagent, fable) nor the code review (code-reviewer subagent, opus).

## Phase 1 — Review

- Implementation read against `specs/drift-baseline-exemption.md`. Code-reviewer round-1 APPROVED (`review_reports/review_C4-01.md`) covered correctness/architecture/security; no additional correctness findings from QA.
- **Copy Audit Gate**: spec Copy/Strings = N/A (no new user-facing strings; drift detail templates unchanged — verified `tools/drift.ts` message literals are byte-identical to pre-feature, exercised by AC-3 byte-identity test). PASS.
- **Visual Audit Gate**: spec Visual Tokens / Widgets = N/A (no visual surface). PASS.
- **Phase 1.5**: skipped (no `design/drift-baseline-exemption.md`, no Visual Baselines declared).

## Phase 3 — Tests (C4-05)

New file `test/drift-baseline.test.mjs` (pre-authorized by the approved cut), 10 tests, modeled on `test/drift-archived-tasks.test.mjs` (dist-driven synthetic tmpfs workspaces; live MCP tool deliberately not used — running server holds pre-rebuild dist).

Spec-to-test map:

| AC | test(s) |
|----|---------|
| AC-1 | baselined `[x]` id → no vibe line, absent from `tasksCompleted` |
| AC-2 | non-baselined id fires alongside a baselined one; stays in `tasksCompleted` |
| AC-3 | config-without-key, `driftBaselineIds: []`, and no-config-file all byte-identical to pre-feature output (`deepEqual` on `details`) |
| AC-4 | `## Active`/`## Completed` + baseline: archived filter and baseline filter apply independently, no interaction |
| AC-5 | handoff-ahead line for a baselined id emitted verbatim (unfiltered-set invariant, drift.ts:256-267); FAIL-status incomplete-tasks line unaffected |
| AC-6 | `CURRENT_VERSIONS.config === 1`; pre-feature config loads unmigrated, on-disk file untouched; non-string entries filtered (taskPaths precedent) |
| AC-7 | shared with AC-3 no-config-file case + `loadConfig(ws)` returns `{}` (SQLite/HTTP-mode analog) |
| AC-8 | verified live (below), not unit-testable (repo-state-dependent) |
| AC-9 | manual doc inspection (below) |

Coverage note: line-coverage tooling not configured in this repo (`node --test` without c8); the 10 tests exercise every new/changed branch in `tools/config.ts` (present/absent/empty/malformed field) and `tools/drift.ts` (baseline hit/miss on each drift direction). Security smoke: malformed config entries (numbers, null) covered by the AC-6 filter test; boundary case empty-array covered by AC-3.

## Phase 4 — Run

- `npm run build` — clean.
- `npm audit --audit-level=high` — exit 0 (1 low-severity esbuild advisory, below threshold).
- `npm test` — **868/868 pass** (858 pre-existing + 10 new), headless, zero interaction. Known `handoff-write-arg-guard` stdio flake did not occur this run.
- **AC-8 live check**: `detectDrift()` against freshly built dist in this workspace → `"No drift detected. Handoff and tasks are synchronized."` with the 144-id backfill in `.current/.config.json` (144, not the spec's 135 — C1-*/C2-* ids completed after the PM snapshot; count verified 0 dupes by reviewer). NOTE: the live `tw_detect_drift` MCP tool still reports the old 144-row noise because the running server process holds pre-rebuild dist in memory — clears on next server restart; not a defect.
- **AC-9**: `content/skill-release-engineer.md` — allowlist entry scoped to the `driftBaselineIds` field only; SOP step 9 (post-release baseline append, dedup, create-if-absent) present; renumbering leaves no broken refs.

## Verdict

**PASS** — C4-01..C4-05 complete; C4-07 (backlog mark-done) verified: `docs/backlog.md` index row + §C4 DONE section present (coordinator-authored). C4-06 (version bump + CHANGELOG) intentionally left open — release-engineer owns bump+CHANGELOG at release time (reviewer-verified repo convention; avoids double-bump).
## 2026-07-07T10:34:50.401Z — PASS — by qa-engineer

PASS. 10 new tests in test/drift-baseline.test.mjs map every AC (AC-1..AC-7); 868/868 suite green, build clean, audit exit 0. AC-8 verified live against fresh dist: No drift detected with 144-id backfill. AC-9 skill-release-engineer allowlist+SOP verified. Copy/Visual gates N/A per spec. Full evidence: qa_reports/review_C4-01.md.

