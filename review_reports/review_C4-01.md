# Review — C4-01..C4-04 (feature: drift-baseline-exemption)

Covering report for tickets C4-01, C4-02, C4-03, C4-04. Pointer stubs:
`review_C4-02.md`, `review_C4-03.md`, `review_C4-04.md`.

## Round 1 — APPROVED — by code-reviewer

## Summary

- **Scope**: `driftBaselineIds?: string[]` config field (C4-01, `tools/config.ts`),
  drift.ts Set-based baseline exclusion (C4-02, `tools/drift.ts`), 144-id one-time
  backfill (C4-03, `.current/.config.json`), release-engineer allowlist + SOP step 9
  (C4-04, `content/skill-release-engineer.md`), plus rebuilt `dist/`.
- **Headline verdict**: APPROVED. All four tickets meet their ACs; the load-bearing
  filtered-vs-unfiltered distinction (AC-5) is implemented exactly as the contract
  requires.
- Freshly-built `dist` reports **"No drift detected"** in this workspace → AC-8 met.
- No schema bump, no `any`, no new user-facing strings — matches spec Out-of-Scope.
- Out of review scope (verified untouched by this diff): C4-05 tests (qa-owned),
  C4-06 version bump (deferred, see Verdict), C4-07 backlog (coordinator post-PASS).

## Correctness

- **`tools/drift.ts:245`** — `baselineIds` built from `loadConfig(...).driftBaselineIds ?? []`.
  Correct nullish fallback; empty set when field/file absent.
- **`tools/drift.ts:266-273` (AC-1/AC-2)** — vibe-coding loop iterates the *unfiltered*
  `completedTasks` and skips only ids in `baselineIds` via `continue`. Baselined ids are
  suppressed (AC-1); non-baselined completed ids not in handoff still push a drift line
  (AC-2). Correct.
- **`tools/drift.ts:256-264` (AC-5, load-bearing)** — the handoff-ahead check
  (`Handoff says X completed, but task list shows incomplete`) iterates `handoffTaskIds`
  and tests against the **unfiltered** `completedTasks` (line 261). `idVocab` (line 251)
  is likewise unfiltered. So a baselined id recorded in handoff and marked `[x]` in tasks
  is found in `completedTasks` → no false "incomplete" misfire. The baseline is applied
  ONLY at the vibe-coding loop (267) and the report output (290). Exactly the spec's
  requirement — verified line-by-line.
- **`tools/drift.ts:275-281` (AC-5)** — FAIL/Blocked-with-incomplete branch uses
  `incompleteTasks`, entirely untouched by baseline. Correct.
- **`tools/drift.ts:290` (AC-1)** — `tasksCompleted` report field filters out baselined
  ids. This is the second (and only other) place the baseline applies. Correct.
- **`tools/drift.ts:227-231` (AC-4)** — `activeScopeTasks` (post archived-section filter)
  feeds `partitionTasks`, whose output feeds the baseline check. The two filters compose
  independently and in the right order (archive first, then baseline over active scope).
  No double-counting, no interaction bug.
- **`tools/config.ts:97-101` (AC-3/AC-6)** — extraction mirrors the `taskPaths` precedent
  exactly: `Array.isArray` guard, `filter((p): p is string => ...)`, non-empty guard
  before assignment. Absent field → `result.driftBaselineIds` unset → `?? []` → empty set
  → byte-identical prior behavior. No `schema_version` bump; `CURRENT_VERSIONS.config`
  stays 1 (verified: config keys are exactly `schema_version` + `driftBaselineIds`).
- **`tools/config.ts:48-51` (AC-7)** — missing `.config.json` returns `{}` before any
  parse. In SQLite/HTTP mode where the file is typically absent, `loadConfig` no-ops
  gracefully — no crash, no filtering. Note (non-blocking): drift.ts obtains tasks via
  `getActiveStorage().listTasks()` (storage-abstracted, SQLite-safe), while `loadConfig`
  always reads the filesystem; if a `.config.json` *does* exist on disk in SQLite mode the
  baseline would apply, which is benign and consistent with intent. AC-7 (no crash when
  absent) is satisfied.
- **Backfill (C4-03)** — 144 ids, **zero dupes**, all strings, schema_version 1, valid
  JSON. Spot-checked against `tasks.md`: `T470`, `C1-10`, `C2-07`, `T-CNSO-10` all present
  as `[x]` completed. 144 vs the spec's 135 snapshot is the documented delta (C1-10 + C2-*
  completions since the PM snapshot) — a superset of genuinely-completed ids, not
  fabricated. Live fresh-dist `tw_detect_drift` = clean (AC-8).

## Quality

- Comments at `drift.ts:233-244` and `config.ts:95-96` accurately cite the ACs and the
  taskPaths precedent — no drift between comment and code.
- `tools/config.ts:7` header sample updated to document the new field; trailing comma on
  the `taskPaths` sample line is valid.
- No dead code, no duplication, naming consistent with surrounding conventions.

## Architecture

- No architecture spec present for this feature (small two-module change); the spec's
  Mechanism Decision is the design constraint. Implementation matches it: config-not-handoff
  storage (token-frugal, Set-membership only), release-engineer as sole sanctioned writer,
  file-mode scope, no new tool surface, no schema bump. Consistent with the archived-section
  filter precedent (v3.23.1) it extends.

## Security

- Baseline ids are used solely for `Set` membership; they never feed a `RegExp`
  (`idPatterns` are built from `idVocab` = task ids, escaped via `escapeRegExp`). No
  injection vector. No secrets, no unvalidated external input. `driftBaselineIds` entries
  are string-filtered before use.

## Performance

- Baseline lookup is O(1) `Set.has` inside the existing O(completed) loop; the report
  filter is one O(completed) pass. No new I/O (`loadConfig` is process-memoized via
  `configCache`). No algorithmic regression vs base.

## Verdict

**APPROVED** — All ACs for C4-01..C4-04 met; the filtered/unfiltered split (AC-5) is
correct, backfill is clean, dist is in sync (rebuild idempotent), full suite 858/858.
Process note (non-blocking): **C4-06 version bump is correctly deferred** — repo precedent
(C1 `645ddaf`, C2 `ecac938` both feat commits with no bump; empty `[Unreleased]`;
check-version.mjs flags HEAD past tag v3.45.0 as expected) shows bump + CHANGELOG are
batched into a `chore(release):` commit owned by release-engineer (SOP step 3). Bumping in
C4-06 now would double-bump; the sr deferral is the right call.
