# e264-tools-comment-accuracy

## Problem Statement
After the E260 comment trim, four comments under `tools/` are padded or stale: `tools/lane-paths.ts` says "(resolveCurrentLane too)" without naming the fs helpers it means; `tools/merge-invariants.ts` cites `tasks-file.ts:216/703` line numbers that were already wrong; `tools/telemetry.ts` says token usage lives in `.current/usage.jsonl` although it is per-lane; `tools/lane-migrate.ts` names `readHandoffState` as the example caller of the lock-acquiring `migrateFlatToLane` wrapper, but `readHandoffState` is synchronous and reaches the lock-free core via `migrateOwnWorkspaceIfFlat` in `tools/handoff-parse.ts`. The fix must be comment-only, keep the grep-pinned token counts that `test/lane-paths.test.mjs` and `test/lane-migrate.test.mjs` allow-list, and refresh the four files' committed `dist/tools/**` outputs.

## User Stories
- As a maintainer reading `tools/`, I want comments that point at names and paths that exist, so that I am not misled by stale line numbers or a wrong caller.
- As a release integrator, I want the change provably behaviour-neutral, so that it merges without re-verifying runtime.

## Acceptance Criteria
- **AC1** — Given `tools/lane-paths.ts`, when its header is read, then the line `(resolveCurrentLane too)` is replaced by a comment naming the three read-only fs helpers (`hasHistoryLedger`, `resolveCurrentLane`, `enumerateLaneSidecarSources`; verify by grepping `fs.` use in the file).
  proof: `grep -n "resolveCurrentLane too" tools/lane-paths.ts; echo "exit=$?"` prints `exit=1`.
- **AC2** — Given `tools/merge-invariants.ts`, when the R-2 comment is read, then `tasks-file.ts:216/703` is replaced by function names (`parseTasks`, `addTaskInFile` in `tools/tasks-file.ts`) with no line numbers.
  proof: `grep -nE "tasks-file\.ts:[0-9]" tools/merge-invariants.ts; echo "exit=$?"` prints `exit=1`.
- **AC3** — Given `tools/telemetry.ts`, when the header is read, then the usage sidecar is described as the per-lane `.current/<lane>/usage.jsonl` (consistent with `resolveCurrentLanePaths(...).usagePath` in `tools/usage-accounting.ts`).
  proof: `grep -n "current/usage.jsonl" tools/telemetry.ts; echo "exit=$?"` prints `exit=1`.
- **AC4** — Given `tools/lane-migrate.ts`, when the `migrateFlatToLane` wrapper doc is read, then `readHandoffState` is no longer its example caller; the doc says the synchronous read path calls the lock-free core directly (via `migrateOwnWorkspaceIfFlat` in `tools/handoff-parse.ts`). The `hasFlatLaneFiles` doc is accurate (`readHandoffState` does reach it via `migrateOwnWorkspaceIfFlat`) and stays byte-unchanged (integrator pre-review: out of scope, "no other comments"). The new text must not add `migrateFlatToLaneLocked`, `migrateFlatToLane(` or `migrateLaneToFlat(` occurrences.
  proof: `sed -n '/Public, lock-acquiring wrapper/,/^export async function migrateFlatToLane/p' tools/lane-migrate.ts | grep -c "readHandoffState"` prints `0`.
- **AC5** — Given the four edited files, when per-file occurrence counts of `lane-paths`, `resolveLanePaths`, `resolveCurrentLane`, `migrateFlatToLaneLocked`, `migrateFlatToLane(`, `migrateLaneToFlat(` across `tools/*` are compared against base f1e6eb1, then every count is identical.
  proof: `node .current/e264/check-invariance.mjs f1e6eb1` exits 0 (prints no `PIN` line).
- **AC6** — Given each changed `tools/*.ts`, when transpiled with TypeScript `transpileModule` (`removeComments: true`) at base and at HEAD, then output is byte-identical; the script has a self-test proving it rejects a code edit and accepts a comment edit.
  proof: `node .current/e264/check-invariance.mjs --self-test` prints `self-test OK`; `node .current/e264/check-invariance.mjs f1e6eb1` exits 0 and refuses a vacuous (zero changed file) pass.
- **AC7** — Given `npm run build`, when `dist/tools/**` is regenerated, then only the `.js`, `.d.ts` and `.map` of `lane-paths`, `lane-migrate`, `merge-invariants` and `telemetry` change, and they are committed.
  proof: `git diff --name-only f1e6eb1 HEAD` lists only owned files (the four `tools/*.ts`, their `dist/tools/**` outputs, `specs/e264-*`, `qa_reports/*E264*`, `review_reports/*E264*`, `.current/e264/**`).
- **AC8** — Given the final HEAD after commit with a clean tree, when the full suite runs, then it is green.
  proof: `git status --porcelain` is empty, then `node scripts/test-lock.mjs -- npm test` exits 0 with all tests passing.
- **AC9** — Given spec, evidence and proof scripts, when grepped for local-path literals, then none appear.
  proof: `grep -rnE "/Use[r]s/|/hom[e]/" specs/e264-*.md .current/e264 qa_reports/*E264* review_reports/*E264*; echo "exit=$?"` prints `exit=1`.

## Copy / Strings
| string id | exact text (quote verbatim) | source |
|---|---|---|
| N/A | — | no user-facing strings; code comments only (wording authored-here during implementation, constrained by AC1-AC4) |

## Visual Tokens
| token id | property | value (quote verbatim) | source |
|---|---|---|---|
| N/A | — | — | feature has no visual literals |

## Visual Widgets
| widget id | description | source-node |
|---|---|---|
| N/A | — | feature has no non-primitive widgets |

## Out of Scope
- Any code change; any comment not named in AC1-AC4; string literals, error messages, filenames.
- `test/**` (no change expected), other `tools/**` and `dist/**`, `docs/**`, `specs/fanout-*.md`, `CHANGELOG.md`, `package.json`.
- Backlog done-marking and release bookkeeping (release-engineer / integrator).

## Dependencies / Prerequisites
E260 shipped (v4.4.1). Base f1e6eb1. Lane `e264`, branch `feat/e264-tools-comment-accuracy`. Precedent for the proof script: `.current/e260b/check-invariance.mjs` at commit 82cf48a (reuse its transpile + per-file grep-token count logic; base arg is f1e6eb1). Resource Audit: no external references. Visual Structural Assertions omitted: no `design/<feature>.md`, mode = no-design. Note for integrator: the fan-out row's "`hasFlatLaneFiles` doc names `readHandoffState` as a wrapper caller" maps to the `migrateFlatToLane` wrapper doc a few lines below (the `hasFlatLaneFiles` text itself is accurate); AC4 covers the wrapper doc only; the `hasFlatLaneFiles` doc is unchanged.
