# Review — T-E123B8-04

covers: T-E123B8-01, T-E123B8-02, T-E123B8-03, T-E123B8-04

## Round 1 — PASS — by qa-engineer

## Phase 0.5 — Expected-Red Diff

Skipped (no expected-red manifest declared): no `qa_reports/expected-red_e123b8-flip-prep.txt` exists in this workspace, and handoff state carries no `dispatch_mode` (feature mode, not bugfix). AC10 additionally requires "no expected-red exemptions" — confirmed none exist.

## Phase 1 — Review

Read the full diff (`git diff -- tools index.ts`) against `specs/e123b8-flip-prep.md` AC1–AC10 and Out of Scope. code-reviewer's `review_reports/review_T-E123B8-01.md` (covers T-E123B8-01/02) already APPROVED AC1–AC8 with concrete line citations; I independently re-verified the load-bearing ones by reading the diffs directly rather than trusting the citation alone:

- **AC1**: `tools/dispatch-log.ts` `dispatchLogPath()` now returns `resolveCurrentLanePaths(path.resolve(workspacePath)).dispatchLogPath`. Confirmed no `".current"` string literal remains anywhere in the file (`grep -n '"\.current"' tools/dispatch-log.ts` → 0 matches, exit 1).
- **AC2**: `normalizeWorkspacePath` (index.ts) expands bare `~` and `~/x` to `os.homedir()`-rooted paths, then always runs `path.resolve`. Confirmed end-to-end via 4 new e2e spawns (see Phase 3.5).
- **AC3**: exactly one `.handoff.lock` literal remains under `tools/` (`tools/lane-paths.ts:82`, the `HANDOFF_LOCK_FILENAME` export itself); `tools/handoff-write.ts` and `tools/lane-migrate.ts` both import it. Verified by reading the import lines directly.
- **AC4**: `tools/handoff-write.ts` — `ensureDir(getHandoffPath(workspacePath))` runs before `withFileLock`; `getHandoffPath` is called again **inside** the callback (before `verifyFreshness`). Read directly at the call site.
- **AC5**: `tools/lane-migrate.ts` — `isTolerableDebris` accepts only `HANDOFF_LOCK_FILENAME` or a `<LANE_FILES filename>.<pid>.<ms>.tmp` shape, AND requires `isFile()` (a same-named directory is refused, not silently treated as debris). Debris is unlinked only after the moves succeed. Verified with 4 new fixture tests (2 tolerate-and-remove, 1 refuse-other, 1 refuse-directory-shaped-debris).
- **AC6**: `TICKET_ID_RE` narrowed from `\d+[a-z0-9]*` to `\d[a-z0-9]*` (removes the second quantifier that could claim the same digit run as the first). Verified the existing 12-case `resolveLaneName` table is unchanged (all still pass) and added a bounded-timeout adversarial-shape test.
- **AC7**: comment-only; read directly, matches spec.
- **AC8**: `index.ts:121` and `tools/role.ts:60` each carry a one-line "workspace-wide, not a lane file" comment, worded to avoid the substring `resolveCurrentLane` (J1-NEW-3's own fix) — confirmed via `grep -n "resolveCurrentLane" index.ts tools/role.ts` → 0 matches in both.
- **AC9**: `tools/dispatch-log.ts` now contains the substring `resolveCurrentLanePaths`, which the existing raw `grep -rn resolveCurrentLane` in CALLERS3 also matches (it's a substring of `resolveCurrentLanePaths`) — this was sr's one reported red (`npm test` 2317/2318). Fixed by adding `tools/dispatch-log.ts` to `SANCTIONED_RESOLVE_CURRENT_LANE_CALLERS` in `test/lane-paths.test.mjs` (CALLERS2 already listed it from F0, so no change needed there). Re-ran the full suite after the fix: 2331/2331 green (see Phase 4).
- **Out of Scope**: confirmed no resolver-flip, no migration-wiring, no per-lane-lock, no `metricsPath()` change, no flat-assuming test rewrites touched.

No correctness, security, or architecture findings of my own beyond what code-reviewer already surfaced. The four sr-logged NEW-TICKETS findings (J1-NEW-1..4: archiveDir's own direct `.current/archive` join, `laneFile()` losing its production caller, the CALLERS grep substring hazard, and POSIX-only `~` expansion) are all correctly scoped to J2/backlog — none of them contradicts AC1–AC10 as written, and J1-NEW-3 is the one I directly resolved via AC9 (not a new finding, sr had already logged it for QA to act on). No new out-of-scope findings to add.

3a. **Copy Audit Gate**: N/A — `specs/e123b8-flip-prep.md` has no *Copy / Strings* H2 (backend-only ticket, no user-facing strings). Skipped.

3b. **Visual Audit Gate**: N/A — no *Visual Tokens* H2 in the spec. Skipped.

## Phase 1.5 — Visual Compare

Skipped (no Visual Baselines declared): no `design/e123b8-flip-prep.md` exists.

## Phase 2 — Discussion

No issues found in Phase 1. Proceeding directly to Phase 3.

## Phase 3 — Tests

Test-file placement per dispatch brief: `test/lane-paths.test.mjs` (AC1, AC6, AC9), `test/lane-migrate.test.mjs` (AC5); AC2 extended `test/prompt-state-footer.test.mjs` (it already covers `resolveWorkspacePath` cleanly via the existing e2e spawn pattern — no new file needed).

### AC → Test map

| AC | Test(s) | File |
|---|---|---|
| AC1 | `AC1-DL1`, `AC1-DL2`, `AC1-DL3`, `AC1-DL4` | `test/lane-paths.test.mjs` |
| AC2 | `AC2/tilde-bare`, `AC2/tilde-subdir`, `AC2/relative`, `AC2/absolute` | `test/prompt-state-footer.test.mjs` |
| AC3 | pre-existing (code-reviewer's read confirms the single-literal invariant; no dedicated new test needed — it's a static grep-able fact code-reviewer already checked and this diff doesn't touch again) | — |
| AC4 | full suite green (AC's own proof) + code-reviewer's line-level check | `review_reports/review_T-E123B8-01.md` |
| AC5 | `AC5-DEBRIS1`, `AC5-DEBRIS2`, `AC5-DEBRIS3`, `AC5-DEBRIS4` (bonus: directory-shaped debris) | `test/lane-migrate.test.mjs` |
| AC6 | pre-existing `RN:` table (12 cases, unchanged) + new `AC6-PERF` | `test/lane-paths.test.mjs` |
| AC7 | comment-only, verified by reading | — |
| AC8 | verified by `grep -n "resolveCurrentLane" index.ts tools/role.ts` → 0 matches (see Phase 1) | — |
| AC9 | `CALLERS3` allow-list updated with `tools/dispatch-log.ts` | `test/lane-paths.test.mjs` |
| AC10 | `npm run build`, full `npm test`, `npm audit --audit-level=high` | Phase 4 below |

### Coverage Gate

All new/modified test code is itself the coverage instrument (fixture-driven unit + e2e tests over the modified functions: `dispatchLogPath`, `normalizeWorkspacePath`, `isTolerableDebris`/`migrateLaneToFlat`, `TICKET_ID_RE`/`resolveLaneName`, the CALLERS3 allow-list). Every modified production line in the 6 sr-owned files is exercised by at least one assertion above or by the pre-existing suite (tooling can't produce a line-coverage percentage in this repo's harness, so this is a manual per-line walk-through, noted per SOP 6c).

### Security Smoke Tests

- Boundary inputs: AC6-PERF exercises a 10,000-character digit run (oversized/adversarial input) against `resolveLaneName`. AC1-DL3 exercises a relative (non-absolute) path. `AC5-DEBRIS4` exercises a directory masquerading as an expected filename (a classic "confuse a name-based allow-list with a different node type" boundary). Existing `RN-type-guard` / `CL-type-guard` / `RP4` tests (unchanged) already cover null/non-string/empty inputs across every touched function.
- Auth/permission: N/A — none of AC1–AC9 touch an access-control surface (file-lock naming, path resolution, and a debris-tolerance allow-list are not permission boundaries).

## Phase 3.5 — AC Execution Log

The spec annotates AC1, AC2, AC4, AC5, and AC6 with `proof:` lines. Each was executed below, BEFORE this PASS.

- **AC1** (proof: "unit assertion that the path equals the flat path, plus grep finding no direct `.current` join in the file"):
  - `node --test test/lane-paths.test.mjs` → `AC1-DL1`..`AC1-DL4` all `ok` (see full run below).
  - `grep -n '"\.current"' tools/dispatch-log.ts` → exit 1 (no matches). PASS.
- **AC2** (proof: "table test covering `~`, `~/x`, a relative path, and an absolute path"):
  - `node --test test/prompt-state-footer.test.mjs` → `AC2/tilde-bare`, `AC2/tilde-subdir`, `AC2/relative`, `AC2/absolute` all `ok`. PASS.
- **AC4** (proof: "the full suite stays green; a code-reviewer check that `getHandoffPath` is called inside the callback"):
  - Full suite (below): 2331/2331 green.
  - code-reviewer's check: `review_reports/review_T-E123B8-01.md` AC4 section, citing `tools/handoff-write.ts:269-277`; I independently re-read the same lines and confirmed `getHandoffPath` is called both before `ensureDir` and again inside the `withFileLock` callback. PASS.
- **AC5** (proof: "fixture tests for each of the three cases"):
  - `node --test test/lane-migrate.test.mjs` → `AC5-DEBRIS1` (lock file, tolerated+removed), `AC5-DEBRIS2` (stale atomic tmp, tolerated+removed), `AC5-DEBRIS3` (other non-LANE_FILES entry, still refused) all `ok`. PASS.
- **AC6** (proof: "the existing tables, plus a timing-free check that a 10k-digit input returns promptly"):
  - Existing `RN:` table (12 cases) unchanged and green.
  - `AC6-PERF` (bounded at `{ timeout: 5000 }`, no measured-duration assertion): `ok`, actual `duration_ms` in the run below is well under 1ms. PASS.

No proof could not be run; no missing fixtures.

## Phase 4 — Run

- **Build**: `npm run build` — clean (`tsc` zero errors; `check:version` and `check:transitions-sync` both OK).
- **Targeted runs** (all green, output captured):
  - `test/lane-paths.test.mjs`: 50/50 pass (includes AC1-DL1..4, AC6-PERF, CALLERS2, CALLERS3-fixed).
  - `test/lane-migrate.test.mjs`: 18/18 pass (includes AC5-DEBRIS1..4).
  - `test/prompt-state-footer.test.mjs`: 24/24 pass (includes AC2/tilde-bare, AC2/tilde-subdir, AC2/relative, AC2/absolute).
- **Full suite**: `npm test` → `# tests 2331`, `# pass 2331`, `# fail 0`, `# cancelled 0`, `# skipped 0`, `# todo 0`. **No expected-red exemptions anywhere in the run** (AC10's own requirement). This resolves sr's one reported red (`test/lane-paths.test.mjs` CALLERS3, from `tools/dispatch-log.ts` being a new `resolveCurrentLane`-substring caller) via the CALLERS3 allow-list fix (AC9) — 2318 (sr's baseline) + 13 new tests (4 AC1 + 1 AC6-PERF + 4 AC5-DEBRIS + 4 AC2) = 2331, all green.
- **`npm audit --audit-level=high`**: exit 0. 6 vulnerabilities reported, all moderate/low (none high/critical) — the `--audit-level=high` gate does not fire on them.

**PASS.** AC1–AC10 all satisfied; no source defects found; no exemptions used.
## 2026-09-23T09:55:12.192Z — PASS — by qa-engineer

PASS. AC1-AC10 all verified (specs/e123b8-flip-prep.md). AC9 fix: added tools/dispatch-log.ts to test/lane-paths.test.mjs CALLERS3 allow-list (dispatch-log.ts now calls resolveCurrentLanePaths, whose name is a substring match for the raw resolveCurrentLane grep). New tests: AC1 (dispatchLogPath byte-identical + no-direct-.current-join grep, test/lane-paths.test.mjs), AC2 (~ / ~/x / relative / absolute e2e table via test/prompt-state-footer.test.mjs spawning the real server), AC5 (3 debris fixtures + 1 bonus, test/lane-migrate.test.mjs), AC6 (10k-digit bounded-timeout promptness check, test/lane-paths.test.mjs). npm run build clean; full suite 2331/2331 green, 0 skipped, no expected-red exemptions; npm audit --audit-level=high exit 0 (6 moderate/low findings, none high). No source defects found. Full detail in qa_reports/review_T-E123B8-04.md.

