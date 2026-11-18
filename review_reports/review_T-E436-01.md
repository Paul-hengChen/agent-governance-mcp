# Review — T-E436-01

covers: T-E436-01, T-E436-02, T-E441-01

## Round 1 — APPROVED — by code-reviewer

## Summary
- Diff `41c301e..50b50ba` on the owned set: `CLAUDE.md` (6/6), `templates/claude-code-agents/release-engineer.md` (2/2), `tools/registry.ts` (33/14, description strings only), and rebuilt `dist/tools/registry.{js,js.map,d.ts.map}`. The other changed paths are lane state, the spec and the expected-red manifest.
- E436: five `CLAUDE.md` sites now name `.current/_primary/handoff.md` (lines 13, 220) or `.current/<lane>/handoff.md` (lines 44, 64, 195). On the template, line 9 is reworded and line 13 uses the lane path. Line 7, line 11, `CRITICAL:` and `NEVER` are byte-identical.
- E441: six tool descriptions are rewritten as contracts. I checked every claim against the handlers in file mode and in SQLite mode. None is false or claims more than the code does. Three gaps where a description leaves something out are listed below as non-blocking findings.
- Same-model note: sr-engineer and code-reviewer both ran on opus this round. A different model might have different blind spots, so a QA pass on another tier is worthwhile.
- Verdict: APPROVED.

## AC Completeness
AC1 — implemented — `CLAUDE.md:13,44,64,195,220-221`. Grep for `.current/handoff.md` returns nothing. The `agc-version: 4.21.0` line (237) matches base. Numstat is `6 6`.
AC2 — implemented — `templates/claude-code-agents/release-engineer.md:9,13`. The file is 13 lines with one trailing newline. Lines 7 and 11 are unchanged. Line 13 differs only in the path span.
AC3 — implemented — `tools/registry.ts:651-656,673-677,862-866,940-944,969-974,998-1003`. Built `dist` lengths are 407/460/318/377/489/441 (spec values). Registry order is identical to base (13 names compared). Every hunk touches `description:` lines only.
AC4 — implemented — claim-by-claim check under Correctness. No claim goes beyond the code. The non-blocking gaps are R1, O1 and O2.
AC5 — implemented — `grep -rn enforcePreFlight index.ts tools guards gates lib transport bin scripts schema prompts` finds exactly six call sites: `tools/handoff-orchestrator.ts:1292` and `tools/tasks.ts:71,81,89,95` (update_state, complete, rollback, void, add), plus `tools/sync.ts:97`. That set equals the `tw_get_state` list. `index.ts` and `transport/` have none.
AC6 — implemented — none of the six built strings contains `specs/`, `MANDATORY`, `(E<digit>`, `uniform not-found`, `structurally reusable`, `.current`, `agc`, `Constitution` or an absolute path.
AC7 — implemented — `git diff --stat 41c301e..HEAD` shows no change under `content/`, `test/`, `guards/`, `gates/`, `docs/` or other templates or `tools/` files. Under `dist/`, only the three registry artifacts changed. A fresh `npm run build` left `dist/` clean.
AC8 — not judged here. This is QA scope after the T-E436-03 and T-E441-02 re-pins. The three owned test files run 91 tests: 86 pass and 5 fail. The 5 failures are exactly the manifest's 5 entries.

## Correctness
Claims verified against code:
- **tw_get_state**
  - `{exists:true,...state}` / `{exists:false,message}`: `tools/handoff-parse.ts:649-656`, `tools/storage-sqlite.ts:491-506`.
  - Advisory keys: `config_error`, `exemptions` and `lane_registry` in file mode; `completed_tasks_truncated` in SQLite; `dispatch_pins_advisory` in both (`tools/handoff-orchestrator.ts:66-103`).
  - File-mode parse throw: `tools/handoff-parse.ts:415-423`. Throw on a newer schema: `runMigrations` at `:428`.
  - Guard keyed by the raw `workspacePath` string in the in-process `activeSessions` Map (`guards/session.ts:22,32-59,98-109`). The guard is set only by `readHandoffState` / `SqliteHandoffStorage.readState`, and only `handleGetState` calls those (`tools/handoff-orchestrator.ts:68`). "Same workspace_path in this server process" is therefore accurate.
- **tw_update_state**
  - Success shape: `tools/handoff-write.ts:629` and `tools/storage-sqlite.ts:649`. `warnings`: `tools/handoff-orchestrator.ts:1702-1714`.
  - Pipeline rejections return `⛔ <CODE>` + an envelope/hint (`:234,273,338,368,407,451,496,545,594,659-661,900`).
  - `⛔ BLOCKED`: `:1292`. `⛔ STATE DRIFT`: `guards/session.ts:81-96,116-134`.
- **tw_get_next_task**
  - Shapes match `tools/tasks-file.ts:236-275` and `tools/storage-sqlite.ts:669-689`.
  - Voided rows are invisible: the `- [-]` marker in file mode, a DELETE in SQLite (`tools/storage-sqlite.ts:338-340`).
- **tw_rollback_task**
  - Shapes and errors: `tools/tasks-file.ts:392-453` and `tools/storage-sqlite.ts:715-735`.
  - The line-break check runs in file mode only, as the description says.
  - Writes go to the tasks file or the `tasks` table only; nothing touches handoff state.
- **tw_void_task**
  - `alreadyVoided: true` is returned in both modes (`tools/tasks-file.ts:549-562`, `tools/storage-sqlite.ts:740-756`).
  - The refusal message names the fix (`voidRefusalMessage`, `tools/tasks-file.ts:464-488`, shared by both modes).
  - `tw_add_task` refuses a voided id in both modes (`tools/tasks-file.ts:696-710`, `tools/storage-sqlite.ts:795-813`).
  - The two false base claims (the id can be reused; SQLite reports a uniform not-found) are removed.
- **tw_detect_drift**
  - All eight `DriftReport` fields are on every return path (`tools/drift.ts:17-43,313-377,480-490`).
  - The advisories never flip `driftDetected`.
  - A newer schema version is reported as drift (`checkVersionSkew` `:291-306`).
  - The handler returns only the report (`:499-503`).

Findings (none blocking):
- **R1 — recommended** — `tools/registry.ts:654-656` (tw_get_state). "Until it has run for the same workspace_path in this server process, … fail with ⛔ BLOCKED" reads as if the guard never comes back once `tw_get_state` has run. It can come back. `index.ts:208` runs `cleanupStaleSessions(60*60*1000)` every 30 min, and `guards/session.ts:161-167` evicts a workspace's session after one hour with no read or write. The six tools then fail with `⛔ BLOCKED` again until `tw_get_state` runs again. The spec's claim table (row "keyed by workspace_path, per server process") does not mention this. The error text tells the caller what to do, so this is not harmful, but the contract should say it, e.g. "…in this server process (again after an hour idle)…". The description still meets AC4/AC5; this is the one case it leaves out.
- **O1 — optional** — `tools/registry.ts:673-677` (tw_update_state). Not every rejection starts with ⛔:
  - `DISPATCH_PIN_TIER_REJECTED` is a registered gate code but is raised inside zod (`tools/registry.ts:63,288`). It surfaces as `❌ Invalid arguments for tw_update_state: dispatch_pins.<role>: DISPATCH_PIN_TIER_REJECTED: …` (`index.ts:193-197`).
  - `⛔ BLOCKED` and `⛔ STATE DRIFT` are thrown errors. `index.ts:199-200` returns `error.stack`, so that text starts `Error: ⛔ …`.
  - The description says "starting with ⛔" only for the transition/pipeline rejections, so it is not false. A client that tests `startsWith("⛔")` would still miss these.
- **O2 — optional** — `tools/registry.ts:862-866` (tw_get_next_task). `isCheckpoint` is JSON `null`, not `false`, when the next task is the first row (`prevTask && …`, `tools/tasks-file.ts:262-264`, `tools/storage-sqlite.ts:678-680`). The description says only when it is true, so this is not false, just incomplete.
- **O3 — optional** — `tools/registry.ts:1002` (tw_detect_drift). "Repairs nothing" is true for drift. The file-mode read path can still run the lazy tasks layout migration (`migrateForRead`, `tools/tasks-file.ts:154-160`). That migration is a layout heal, not a repair, so this is noted only. "State written by a newer server is reported as drift" is checked against workspace files (`readArtifactVersion`, `tools/drift.ts:234+`). In SQLite mode a newer DB refuses at open, so that path never reaches drift detection.

Expected-red sampling (SOP 4a):
- I checked all 5 manifest entries in `qa_reports/expected-red_e436-stale-paths-tool-contracts.txt`. Each test name is found verbatim in its file (3 in `test/e404-release-engineer-template.test.mjs`, 1 in `test/feature-lease.test.mjs`, 1 in `test/subagent-templates.test.mjs`).
- Running those 3 files reds exactly these 5 tests (`not ok` 1, 2, 3, 68, 90) and nothing else.

## Quality
- No findings. The multi-line description style (4-space key, 6-space continuation, `+` concatenation) matches the existing entries.
- Template line 9's new sentence is accurate. The SOP holds the step 5 re-baseline (`content/skill-release-engineer.md:41`) and the no-MCP relay rule (`:20`), so "repeat only" is true.
- `CLAUDE.md` wording keeps line widths close to the surrounding text.
- No comments added (SOP 4b: nothing to check).

## Architecture
No architecture spec for this feature. String-only change: no schema, zod, handler, error-code or registry-order change (every `tools/registry.ts` hunk touches only `description:` lines; base and HEAD name order are identical). The lane-layout claims in `CLAUDE.md` match `tools/lane-paths.ts:2-5` (flat is legacy and migration-only). `.current/_primary/handoff.md` is tracked and root `tasks.md` exists.

## Security
No findings. No new input path. The shipped description strings contain no absolute paths, repo-only paths, ticket ids or secrets (Constitution §6 hygiene). The template and `CLAUDE.md` add only the lane-path form the shipped SOP already uses.

## Performance
No findings. Static strings only; `tools/list` payload grows by about 1.3 KB (1151 to 2492 chars across six descriptions), as budgeted in the spec.

## Verdict
APPROVED. All six description claims are backed by both storage modes, the E436 path edits are true for the lane layout, and scope is exact. R1 is a recommended follow-up: add the idle-eviction case to the `tw_get_state` contract.
