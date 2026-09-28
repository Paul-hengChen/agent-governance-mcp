# QA Review — T-E123A3-08 (e123a-lane-layout-migration)

covers: T-E123A3-01, T-E123A3-02, T-E123A3-03, T-E123A3-04, T-E123A3-05, T-E123A3-06, T-E123A3-07, T-E123A3-08

## Round 1 — by qa-engineer (sonnet, fable pin does not apply to this role)

Scope: verify T-E123A3-01..07 by EXECUTION against `specs/e123a-lane-layout-migration.md` AC1-AC15, per the coordinator's dispatch brief. Upstream: sr-engineer commits `0413c28` (batch 1) + `f00bcc8` (batch 2); code-reviewer APPROVED in `review_reports/review_T-E123A3-07.md` (covers T-E123A3-01..07); coordinator's one-line spec table fix `bcd2bcb` (L-SCHEMA-NEW-5).

## Expected-Red Diff

`qa_reports/expected-red_e123a-lane-layout-migration.txt` exists (feature-scoped manifest, 49 entries: 47 AC12 v14-pin re-baselines + 2 `check-md-tables` real-corpus entries explicitly marked "NOT caused by this diff — pre-existing on the branch base").

- The 2 `check-md-tables.test.mjs` entries (AC7 real corpus, CQ-9) are now GREEN: the coordinator's commit `bcd2bcb` added the missing 4th cell to `specs/e123a-lane-layout-migration.md`'s Visual Tokens `N/A` row (L-SCHEMA-NEW-5). Confirmed by running `node --test test/check-md-tables.test.mjs` — both named tests pass.
- The remaining 47 entries are the AC12 v14-pins. Before any re-baseline edit, I confirmed via a full `npm test` run against the pre-edit tree that the actual red set was exactly these 47 test names (spot-checked against the manifest — 13 files, matching the manifest's file list one-for-one; set diff empty).
- **Disposition**: all 47 are qa-owned re-baselines (Constitution §2 — sr-engineer does not touch `test/`), not regressions. I re-baselined every one (see Phase 3 below) by bumping the pinned "current" version literal from 14 to 15 and, where a test manually re-registers an isolated migration chain (`_clearRegistryForTests()` + `registerMigration` calls), adding the new `14→15` step so the chain reaches the real `CURRENT_VERSIONS.handoff` (15) instead of throwing `MISSING_MIGRATION_STEP`.
- **Zero unexplained reds**: after re-baselining, I ran the full suite (`npm test`) and got 0 failures. No entry on the manifest is now red for a reason other than "already fixed."

**Phase 0.5: clean (49/49 manifest entries confirmed dispositioned — 2 already fixed by `bcd2bcb`, 47 re-baselined by this round — 0 unexplained reds).**

## Phase 1 — Review (spec/copy/visual audit)

- **Copy Audit Gate**: spec's Copy/Strings table says `N/A — feature has no new user-facing strings`. Confirmed: `dispatch_mechanism`/`dispatch_mechanism_tier` are tool-boundary zod diagnostics, not product copy. No drift, no coverage gap.
- **Visual Tokens Gate**: spec's Visual Tokens table says `N/A — feature has no visual literals`. Confirmed: no `design/e123a-lane-layout-migration.md` file exists. No drift, no coverage gap.
- **Visual Widgets**: `N/A — feature has no non-primitive widgets`. Confirmed.
- I independently re-read `tools/lane-paths.ts`, `tools/lane-migrate.ts`, `tools/dispatch-log.ts`, and the diffs to `schema/versions.ts`, `schema/migrations-handoff.ts`, `tools/handoff-types.ts`, `tools/handoff-parse.ts`, `tools/handoff-write.ts`, `tools/registry.ts`, `tools/handoff-orchestrator.ts` (`git diff dea8544..HEAD`). This matches code-reviewer's Round 1 findings in `review_reports/review_T-E123A3-07.md` — no independent correctness concern found; code-reviewer's non-blocking notes (N1/N2, Q1/Q2, the F1-input L-SCHEMA-NEW-7) are architecture/quality-owned, out of QA's FAIL scope per this role's SOP (QA rejects only for failing tests, missing coverage, or test-infra defects).

**Phase 1: PASS** (no drift, no coverage gap — proceed to Phase 1.5).

## Phase 1.5 — Visual Compare

`design/e123a-lane-layout-migration.md` does not exist (no `## Visual Baselines` H2 possible).

**Phase 1.5: skipped (no Visual Baselines declared).**

## Phase 2 — Discussion

No issues found in Phase 1 requiring a round with sr-engineer. Proceeding directly to Phase 3.

## Phase 3 — Tests

### Test File Discovery / placement (per dispatch brief)

- Extended existing `test/handoff-versioning.test.mjs` with an AC1 v14→v15 fixture bump (re-baseline, not a new isolated migration test — the isolated-chain AC1 proof lives in `test/e114-cut-approval-inheritance.test.mjs`, extended below).
- Created `test/dispatch-mechanism.test.mjs`, `test/lane-paths.test.mjs`, `test/dispatch-log.test.mjs`, `test/lane-migrate.test.mjs` (pre-authorized).
- Re-baselined every existing test file pinning handoff v14 as current, per `qa_reports/expected-red_e123a-lane-layout-migration.txt`'s file list: `test/cut-approval-gate.test.mjs`, `test/dispatch-pins.test.mjs`, `test/drift-skew.test.mjs`, `test/e114-cut-approval-inheritance.test.mjs`, `test/e22-stale-notify.test.mjs`, `test/e23-evidence-schema.test.mjs`, `test/handoff-migration.test.mjs`, `test/handoff-versioning.test.mjs`, `test/repro-first-gate.test.mjs`, `test/schema-versions.test.mjs`, `test/skill-evolution-v3.11.test.mjs`, `test/stale-dispatch-detection.test.mjs`, `test/success-metrics.test.mjs`.
- Did NOT touch `test/context-budget.test.mjs`, `test/render-structure.test.mjs`, or `test/fixtures/compose-golden/**` (L-CONTENT-owned) — confirmed clean (0 reds attributable to those files; not in the expected-red manifest either).
- A broad post-edit grep (`grep -rln "schema_version:\s*14\b|CURRENT_VERSIONS\.handoff, *14\b|...|server max 14\b" test/`) found only intermediate `registerMigration({from:13,to:14,...})` step registrations (correct — these are historical steps, not "current" pins) and two harmless non-"current" `schema_version: 14` fixtures in `test/e114-cut-approval-inheritance.test.mjs` (AC4-3 hostile-value test, F2 test) that never assert v14 is CURRENT — left unchanged, matching the 47-entry manifest exactly (no over- or under-reach).

### Spec-to-Test map (AC1-AC15)

| AC | Test(s) |
|---|---|
| AC1 | `test/handoff-versioning.test.mjs` (re-baselined fixture); `test/e114-cut-approval-inheritance.test.mjs` AC1 (isolated real-registry v13-payload climb, now asserts `applied:[14,15]`) |
| AC2 | `test/dispatch-mechanism.test.mjs` RT1, RT1b, RT2 |
| AC3 | `test/dispatch-mechanism.test.mjs` Z1, Z2, Z3 |
| AC4 | `test/lane-paths.test.mjs` RN (9 table-driven cases incl. both spec worked examples), RN-never-primary, RN-type-guard |
| AC5 | `test/lane-paths.test.mjs` RP1-RP4, CALLERS1 (substituted proof, see below), CALLERS2 (discloses the substitution) |
| AC6 | `test/lane-migrate.test.mjs` FL1, FL2, FL3, FL4 |
| AC7 | `test/lane-migrate.test.mjs` CONFLICT1 (+ CONFLICT2, bonus coverage of the documented idempotent-resume posture) |
| AC8 | `test/lane-migrate.test.mjs` REV1, REV2, REV3, REV4 |
| AC9 | `test/lane-migrate.test.mjs` RT1 |
| AC10 | `test/lane-migrate.test.mjs` CALLERS1 |
| AC11 | verified by direct `git ls-files` / `ls` execution (see AC Execution Log) — no dedicated unit test needed, matches spec's own proof shape |
| AC12 | full `npm test` run, exit 0 (see AC Execution Log); the 13-file re-baseline above is the AC12 implementation |
| AC13 | `test/dispatch-log.test.mjs` INT1, INT2, INT3, INT4, THROW1, THROW2 |
| AC14 | `test/dispatch-log.test.mjs` ISO1 |
| AC15 | `test/lane-paths.test.mjs` REG1, REG2, RP3; `test/lane-migrate.test.mjs` COUNT1, COUNT2; `test/dispatch-log.test.mjs` NAME1, NAME2; direct grep execution (see AC Execution Log) |

### Coverage Gate

New/modified production files under test: `tools/lane-paths.ts` (19 new tests, every exported function exercised incl. error paths), `tools/lane-migrate.ts` (14 new tests, every branch: full/partial fixture, conflict/resume, reverse, foreign-entry refusal, lane-arg validation, round trip, caller-count), `tools/dispatch-log.ts` (9 new tests, both append/no-append paths, throw-swallowing, isolation), `tools/handoff-orchestrator.ts`'s new wiring (exercised via `test/dispatch-log.test.mjs`'s `handleUpdateState` integration tests), `tools/handoff-write.ts`/`tools/handoff-parse.ts`/`tools/registry.ts`'s v15 field additions (exercised via `test/dispatch-mechanism.test.mjs` + the 13-file re-baseline's version-chain assertions). Estimate: well over 80% line coverage on every new/modified production file — every exported function has both a happy-path and at least one error/edge-path test; no tooling-measured coverage number available in this repo (noted per SOP step 6c).

### Security Smoke Tests

- `test/lane-migrate.test.mjs` REV4 — path traversal / hostile lane-name rejection (`../escape`, `..`, `a/b`, empty string, `.hidden`).
- `test/lane-paths.test.mjs` RN-type-guard — non-string `activeFeature` inputs (`null`, `42`, `{}`, `[]`, `true`) never throw.
- `test/dispatch-mechanism.test.mjs` Z1/Z2 — boundary rejection of an out-of-enum `dispatch_mechanism` and an oversized `dispatch_mechanism_tier`.
- `test/dispatch-log.test.mjs` THROW1/THROW2 — the append path never throws and never masks the real `ToolResult`, even under a forced filesystem failure (EISDIR).

## Phase 3.5 — AC Execution Log

Every AC in `specs/e123a-lane-layout-migration.md` carries a `proof:` annotation. Executed each below, in order, on the current worktree tree (`<lanes-root>/e123a`, HEAD `bcd2bcb`, after my Phase 3 test edits).

- **AC1** — proof: `test/handoff-versioning.test.mjs` v14→v15 fixture, `applied: [15]`, neither new key present post-migration.
  Command: inline smoke script importing the real compiled registry (`dist/schema/migrations-handoff.js` + `dist/schema/versions.js`), feeding a `{schema_version:14, active_feature:"ac1-smoke"}` payload.
  Output: `applied: [15]` / `schema_version: 15` / `has dispatch_mechanism key: false` / `has dispatch_mechanism_tier key: false`.
  Verdict: **PASS** — matches the AC1 text exactly (stamp-only, seeds nothing).

- **AC2** — proof: `test/dispatch-mechanism.test.mjs` write/read round trip.
  Command: `node --test test/dispatch-mechanism.test.mjs`.
  Output: 6/6 tests pass (RT1, RT1b, RT2, Z1, Z2, Z3).
  Verdict: **PASS**.

- **AC3** — proof: zod-boundary unit test asserting `dispatch_mechanism: "bogus"` throws `ZodError`.
  Command: `node --test test/dispatch-mechanism.test.mjs` (Z1 specifically).
  Output: `ok 4 - Z1: tw_update_state rejects an out-of-enum dispatch_mechanism value at the zod boundary`.
  Verdict: **PASS**.

- **AC4** — proof: `test/lane-paths.test.mjs` table-driven fixture, ≥4 cases including both worked examples.
  Command: `node --test test/lane-paths.test.mjs`.
  Output: 19/19 tests pass, including 9 table-driven `RN:` cases (both `e163-ci-gate-ordering`→`e163` and `e123a-lane-layout-migration`→`e123a` worked examples present).
  Verdict: **PASS**.

- **AC5** — proof (spec literal): unit test asserting output equality across 3+ lane args; `grep -rln "lane-paths" tools/ gates/ guards/ prompts/ bin/ index.ts` names only `tools/lane-paths.ts`.
  Command: `grep -rln "lane-paths" tools/ gates/ guards/ prompts/ bin/ index.ts`.
  Output: `tools/dispatch-log.ts` / `tools/lane-migrate.ts` / `tools/lane-paths.ts` (3 files, not 1).
  **Disclosed substitution**: per the coordinator's dispatch brief and code-reviewer's Round 1 review (`review_reports/review_T-E123A3-07.md`, L-SCHEMA-NEW-6), this literal proof is structurally unpassable — AC5's own text and AC15/T-E123A3-04/05 REQUIRE `tools/dispatch-log.ts` and `tools/lane-migrate.ts` to import from `tools/lane-paths.ts`. I substituted the intent-preserving proof:
  Command: `grep -rn "resolveLanePaths" tools/ gates/ guards/ prompts/ bin/ index.ts`.
  Output: 3 hits, all inside `tools/lane-paths.ts` itself (lines 4, 10, 101 — the module's own comments and its declaration). Zero hits in `tools/dispatch-log.ts` or `tools/lane-migrate.ts` (they use `laneFile`/`LANE_FILES`/`resolveLaneName`, never `resolveLanePaths`).
  Verdict: **PASS** on the intended claim (`resolveLanePaths` has zero production callers). The literal spec proof is a **spec-proof defect**, already filed as `NEW-TICKETS.md` `L-SCHEMA-NEW-6` for the PM to amend AC5's proof line — not re-filed here.

- **AC6** — proof: `test/lane-migrate.test.mjs` full-fixture + handoff-only cases.
  Command: `node --test test/lane-migrate.test.mjs`.
  Output: 14/14 tests pass (FL1-FL4 cover AC6 directly).
  Verdict: **PASS**.

- **AC7** — proof: conflicting-destination fixture throws, neither side's content changes.
  Command: `node --test test/lane-migrate.test.mjs` (CONFLICT1 specifically).
  Output: `ok 5 - CONFLICT1: a pre-existing DIFFERING .current/<lane>/handoff.md throws, and BOTH the source and destination stay byte-unchanged`.
  Verdict: **PASS**.

- **AC8** — proof: reverse case, lane dir removed, flat files restored.
  Command: `node --test test/lane-migrate.test.mjs` (REV1-REV4).
  Output: 4/4 pass.
  Verdict: **PASS**.

- **AC9** — proof: round-trip byte-diff, all 5 files, `schema_version` the sole allowed delta.
  Command: `node --test test/lane-migrate.test.mjs` (RT1 specifically).
  Output: `ok 11 - RT1: migrateFlatToLane then migrateLaneToFlat leaves all 5 files byte-identical to their pre-migration content`.
  Verdict: **PASS**.

- **AC10** — proof: `grep -rn "migrateFlatToLane\|migrateLaneToFlat" --include=*.ts . | grep -v /test/` returns only `tools/lane-migrate.ts`.
  Command: `grep -rn "migrateFlatToLane\|migrateLaneToFlat" --include="*.ts" . | grep -v "/test/" | grep -v "^\./dist/" | grep -v "^dist/"`.
  Output: 6 lines, all `tools/lane-migrate.ts` (its own declarations/comments). The literal spec command as written also matches `dist/tools/lane-migrate.d.ts` (the compiled type-declaration emit necessarily re-exports the symbol names); code-reviewer's Round 1 review confirms this dist echo is expected, not a caller, so I excluded `dist/` from scope to test the intended claim (source tree only).
  Verdict: **PASS**.

- **AC11** — proof: `git ls-files .current/archive/` empty; `ls .current/archive/` unchanged.
  Commands: `git ls-files .current/archive/` → (empty output). `ls .current/archive/` → `e142-release-tooling-wave25.40174.1790046781756.md`, `e163-ci-gate-ordering.35560.1790144491652.md` (2 files, both on disk, both untracked).
  Verdict: **PASS**.

- **AC12** — proof: `npm test` full run, exit 0.
  Command: `npm test` (full suite, from a clean rebuild).
  Output: `# tests 2282` / `# pass 2282` / `# fail 0` / `# cancelled 0`.
  Verdict: **PASS**.

- **AC13** — proof: `test/dispatch-log.test.mjs` +1/+0 line-count assertions, forced-failure-returns-normal-ToolResult assertion.
  Command: `node --test test/dispatch-log.test.mjs`.
  Output: 9/9 tests pass (INT1-INT4, THROW1-THROW2 cover AC13 directly).
  Verdict: **PASS**.

- **AC14** — proof: `test/dispatch-log.test.mjs` metrics/telemetry line-count-unchanged assertion.
  Command: `node --test test/dispatch-log.test.mjs` (ISO1 specifically).
  Output: `ok 9 - ISO1: a dispatch-log append never creates or modifies .current/metrics.jsonl or .current/telemetry.jsonl`.
  Verdict: **PASS**.

- **AC15** — proof: `resolveLanePaths` key count == `LANE_FILES.length`; both runners' moved+skipped count == `LANE_FILES.length`; qa-checkable grep shows every filename hit inside `lane-paths.ts`'s own declaration.
  Command 1: `node --test test/lane-paths.test.mjs test/lane-migrate.test.mjs test/dispatch-log.test.mjs` → REG1/REG2/RP3, COUNT1/COUNT2, NAME1/NAME2 all pass.
  Command 2: `grep -n "handoff\.md\|telemetry\.jsonl\|metrics\.jsonl\|usage\.jsonl\|dispatch\.jsonl" tools/lane-paths.ts tools/lane-migrate.ts tools/dispatch-log.ts`.
  Output: 5 hits, all `tools/lane-paths.ts:32-36` (the `LANE_FILES` array literal). Zero hits in `tools/lane-migrate.ts` or `tools/dispatch-log.ts`.
  Verdict: **PASS**.

## Phase 4 — Run

- **Crash checkpoint**: n/a — this round completed in a single sitting, no crash-resume needed.
- **Build**: `npm run build` → exit 0. `tsc` clean, `check:version` OK (3.116.0), `check:transitions-sync` OK (21 keys, exact match).
- **Full suite**: `npm test` → `# tests 2282, # pass 2282, # fail 0, # cancelled 0, # skipped 0`. Zero regressions against the pre-existing 2185 passing / 49 expected-red baseline (2185 + 49 dispositioned + 51 new tests ≈ 2282, within rounding of the 2 already-fixed check-md-tables entries being counted in the original 2234 total).
- **CI runnability**: `npm test` runs headlessly with zero human interaction (node's built-in test runner, no watch mode, no prompts).
- **`npm audit --audit-level=high`**: exit 0. 6 pre-existing vulnerabilities reported (2 low, 4 moderate: `hono`, `protobufjs`, `qs` — all transitive, all below the `high` threshold, none introduced by this ticket — this ticket added zero new dependencies).

## Verdict

**PASS.** All 15 ACs re-derived by execution (AC Execution Log above). The 49-entry expected-red manifest is fully dispositioned (2 pre-fixed by the coordinator, 47 re-baselined this round, 0 unexplained reds). AC5's literal proof line is a confirmed pre-existing spec-proof defect (`L-SCHEMA-NEW-6`, already filed, not re-filed); its substituted proof (grep on `resolveLanePaths` rather than the module name) is disclosed above and the intended claim — zero production callers — holds. Full suite green (2282/2282), build clean, audit clean at the `high` threshold. Non-blocking reviewer nits (empty-tier acceptance, sidecar append in SQLite mode, the L-SCHEMA-NEW-7 F1 hazards) are out of this ticket's scope per the coordinator's dispatch brief and remain filed for F1/F0-follow-up, not re-litigated here.
## 2026-09-23T06:59:11.033Z — PASS — by qa-engineer

PASS — all 15 ACs re-derived by execution. Expected-red manifest (49 entries) fully dispositioned: 2 check-md-tables entries already fixed by coordinator's bcd2bcb, 47 handoff v14->v15 pins re-baselined across 13 existing test files (Constitution ss2, qa-owned). 4 new test files added: test/dispatch-mechanism.test.mjs (AC2/AC3), test/lane-paths.test.mjs (AC4/AC5/AC15), test/dispatch-log.test.mjs (AC13/AC14/AC15), test/lane-migrate.test.mjs (AC6-AC10/AC15). AC5's literal proof grep is a confirmed pre-existing spec-proof defect (L-SCHEMA-NEW-6, already filed by code-reviewer) -- substituted proof (grep resolveLanePaths, not module name) used and disclosed in qa_reports/review_T-E123A3-08.md; intended claim (zero production callers) holds. Full suite green 2282/2282, npm run build clean, npm audit --audit-level=high exit 0 (6 pre-existing low/moderate transitive vulns, none introduced by this ticket). Full AC Execution Log in qa_reports/review_T-E123A3-08.md.

## 2026-09-23T06:59:30.276Z — PASS — by qa-engineer

PASS — all 15 ACs re-derived by execution. Expected-red manifest (49 entries) fully dispositioned: 2 check-md-tables entries already fixed by coordinator's bcd2bcb, 47 handoff v14->v15 pins re-baselined across 13 existing test files (Constitution ss2, qa-owned). 4 new test files added: test/dispatch-mechanism.test.mjs (AC2/AC3), test/lane-paths.test.mjs (AC4/AC5/AC15), test/dispatch-log.test.mjs (AC13/AC14/AC15), test/lane-migrate.test.mjs (AC6-AC10/AC15). AC5's literal proof grep is a confirmed pre-existing spec-proof defect (L-SCHEMA-NEW-6, already filed by code-reviewer) -- substituted proof (grep resolveLanePaths, not module name) used and disclosed in qa_reports/review_T-E123A3-08.md; intended claim (zero production callers) holds. Full suite green 2282/2282, npm run build clean, npm audit --audit-level=high exit 0 (6 pre-existing low/moderate transitive vulns, none introduced by this ticket). Full AC Execution Log in qa_reports/review_T-E123A3-08.md.

