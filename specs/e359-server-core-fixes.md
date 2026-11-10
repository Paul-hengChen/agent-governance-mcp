# e359-server-core-fixes

Lane e359 of fan-out `specs/fanout-backlog-wave-b.md` (wave B). Three small server-core fixes, one lane, no architect hop.
Spec sources: `docs/backlog.md` rows E359, E376 and E172; the manifest's e359 Lanes row, its shared-scope section, its ownership redraw, its pre-dispatch checks for E359, E376 and E172, and Decisions (rulings 1 to 6 are all (a); ruling 1 = (a) binds E359).

## Problem Statement
Three narrow defects in the server core. **E359**: with E150's carry-forward, `handoff.completed_tasks` keeps a task id across same-feature writes until a qa-engineer FAIL write names it in `review_task_ids`. When `tw_rollback_task` runs without that FAIL write (off-SOP), the task-list row is open again but the ledger still holds the id, so `tw_void_task` refuses with "roll it back first (tw_rollback_task)". That advice is wrong for this state, because the row is already rolled back, and the message never names the step that actually clears the ledger. **E376**: E184 removed the previous hop's `dispatch_mechanism_tier` from the `tw_get_state` read view so the next writer self-reports instead of copying it. The other read view, `renderHandoffStateBlock` in `prompts/build.ts`, is used by every role prompt and by the opt-in SessionStart hook. It still renders that key. **E172**: `normalizeWorkspacePath` in `index.ts` expands `~` and `~/x` but not the Windows form `~\x`, so on win32 that path resolves against the server cwd.

## User Stories
- As an agent whose `tw_void_task` is refused after a rollback, I want the refusal to name the step that clears the ledger, so that I can recover without reading server source.
- As the role about to write `tw_update_state`, I want the injected state block to omit the previous hop's `dispatch_mechanism_tier`, so that I report my own tier instead of copying the last one.
- As an adopter on a Windows host, I want a `~\x` workspace path to expand to my home directory, so that the server reads the workspace I meant.

## Acceptance Criteria

Shared definitions for E359. `rowCompleted` is the task-list mirror (file mode: the row's checkbox is `[x]`; SQLite: the `tasks` row has `completed === 1`). `ledgerCompleted` is the existing word-boundary match against `handoff.completed_tasks`, unchanged. The refusal still fires exactly when `rowCompleted || ledgerCompleted`. Only the message text changes, and it is chosen by which of the two holds. The three strings are in Copy / Strings.

- **AC-E359-1** (file mode, ledger only: the E359 state). Given a task-list row `- [ ] T-B …` and a handoff whose `completed_tasks` holds `T-B`, when `voidTask(ws, "T-B", …)` runs, then `error` equals `void.refused.ledger` with `T-B` substituted, the task list and `handoff.md` stay byte-unchanged, and `success` is absent.
  proof: `node --test test/e359-*.test.mjs` (test name starting with `AC-E359-1`).
- **AC-E359-2** (file mode, row and ledger). Given a row `- [x] T-B …` and a ledger holding `T-B`, when the void runs, then `error` equals `void.refused.both` with `T-B` substituted, and nothing on disk changes.
  proof: `node --test test/e359-*.test.mjs` (`AC-E359-2`).
- **AC-E359-3** (file mode, row only). Given a row `- [x] T-B …` and a ledger that does not hold `T-B`, when the void runs, then `error` equals `void.refused.row`, which is byte-identical to today's message.
  proof: `node --test test/e359-*.test.mjs` (`AC-E359-3`).
- **AC-E359-4** (SQLite). Given `SqliteHandoffStorage`, when the three states of AC-E359-1, 2 and 3 are set up (row `completed` 0 or 1, written ledger holding the id or not) and `voidTask` runs, then each `error` equals the same string the file-mode case returns, and the tasks row is not deleted. The test is skipped loudly when `better-sqlite3` cannot load, as `test/e117-void-task.test.mjs` does.
  proof: `node --test test/e359-*.test.mjs` (`AC-E359-4`).
- **AC-E359-5** (the message is actionable). Given the AC-E359-1 state in file mode, when the step the message names is performed (a `qa-engineer` `FAIL` write through the real `tw_update_state` handler carrying `review_task_ids: ["T-B"]`) and `voidTask(ws, "T-B", …)` then runs, then it returns `success: true`.
  proof: `node --test test/e359-*.test.mjs` (`AC-E359-5`).
- **AC-E359-6** (no behaviour change elsewhere). Given this lane's diff, then `rollbackTaskInFile`, `SqliteHandoffStorage.rollbackTask`, `tools/sync.ts` and the refusal predicate itself are unchanged, and the existing suites `test/e117-void-task.test.mjs`, `test/e120-void-recut-refusal.test.mjs`, `test/e121-tasks-file-injection.test.mjs`, `test/tasks.test.mjs` and `test/e125a-lane-local-ledgers.test.mjs` pass unmodified.
  proof: `node --test test/e117-void-task.test.mjs test/e120-void-recut-refusal.test.mjs test/e121-tasks-file-injection.test.mjs test/tasks.test.mjs test/e125a-lane-local-ledgers.test.mjs` exits 0, and `git diff main...HEAD -- tools/sync.ts` is empty.

- **AC-E376-1** (role prompt). Given a lane handoff written with `dispatch_mechanism: "task"` and `dispatch_mechanism_tier: "opus"`, when `buildPromptForRole(...)` renders the state block, then the fenced JSON has no `dispatch_mechanism_tier` key, still has `dispatch_mechanism: "task"`, and every remaining key deep-equals the sanitized parsed state minus that one key, in the same key order.
  proof: `node --test test/e376-*.test.mjs` (`AC-E376-1`).
- **AC-E376-2** (SessionStart hook). Given the same handoff, when `bin/agent-governance-context.mjs` runs with `CLAUDE_PROJECT_DIR` set to the workspace, then its state block also has no `dispatch_mechanism_tier` key and is byte-identical to the `buildPromptForRole` block. Both use the shared `dist/prompts/build.js` renderer, so `bin/**` is not edited.
  proof: `node --test test/e376-*.test.mjs` (`AC-E376-2`).
- **AC-E376-3** (no other render change). Given a state with no `dispatch_mechanism_tier`, when `renderHandoffStateBlock(state)` runs, then the output is byte-identical to today's (`JSON.stringify(sanitizeForRender(state), null, 2)` inside the same boundary). The E137 round-trip test (AC11 in `test/e137-render-sanitise.test.mjs`) passes unmodified.
  proof: `node --test test/e137-render-sanitise.test.mjs test/e122-state-render-injection.test.mjs test/prompt-state-footer.test.mjs` exits 0.
- **AC-E376-4** (record untouched; E184 envelope unchanged). Given the AC-E376-1 handoff, then `handoff.md` still carries `dispatch_mechanism_tier`, `parseHandoff` still returns it, and `test/e184-get-state-omits-tier.test.mjs` passes unmodified.
  proof: `node --test test/e184-get-state-omits-tier.test.mjs test/e376-*.test.mjs` exits 0.
- **AC-E376-5** (goldens stay byte-identical). Given the built change, when the compose goldens are recaptured, then no fixture changes. On the dispatch base the key appears in goldens only as SOP prose in `skill-coordinator-monolith.txt` (lines 92, 121 and 122), not as live state, and a PM capture run on the base confirmed it.
  proof: `npm run build`, then `node scripts/capture-constitution-golden.mjs`, then `git status --porcelain test/fixtures/compose-golden` prints nothing.

- **AC-E172-1** (win32 form expands). Given `normalizeWorkspacePath(p, platform)` exported from `dist/prompts/build.js`, when it is called as `normalizeWorkspacePath("~\\sub", "win32")`, then it returns `path.resolve(path.join(os.homedir(), "sub"))`. The test uses a single-segment tail so the host's `path` flavour cannot change the result.
  proof: `node --test test/e172-*.test.mjs` (`AC-E172-1`).
- **AC-E172-2** (POSIX hosts unchanged). Given `platform` is `"linux"` or `"darwin"`, when it is called with `"~\\sub"`, then it returns `path.resolve("~\\sub")` with no expansion, because `\` is a legal POSIX filename character.
  proof: `node --test test/e172-*.test.mjs` (`AC-E172-2`).
- **AC-E172-3** (existing forms unchanged on every platform). Given each of `"win32"`, `"linux"` and `"darwin"`, then `"~"` returns `os.homedir()`, `"~/sub"` returns `path.resolve(path.join(os.homedir(), "sub"))`, `"~user/x"` is not expanded, and an absolute normalized path comes back unchanged.
  proof: `node --test test/e172-*.test.mjs` (`AC-E172-3`).
- **AC-E172-4** (wiring unchanged). Given the server process, then `resolveWorkspacePath` calls `normalizeWorkspacePath` with no platform argument (default `process.platform`), `index.ts` still exports `normalizeWorkspacePath`, and the spawned AC2 tests in `test/prompt-state-footer.test.mjs` (`AC2/tilde-bare`, `AC2/tilde-subdir`, `AC2/relative`, `AC2/absolute`) pass.
  proof: `node --test test/prompt-state-footer.test.mjs` exits 0.

- **AC-G1** (`dist/` scope). Given `npm run build` on the lane HEAD, then `git status --porcelain dist/` is empty, and `git diff --stat main...HEAD -- dist/` lists only files under `dist/index.*`, `dist/prompts/build.*`, `dist/tools/tasks-file.*` and `dist/tools/storage-sqlite.*`.
  proof: `npm run build`, then `git status --porcelain dist/` and `git diff --stat main...HEAD -- dist/`.
- **AC-G2** (no shared-artifact change). Then `git diff --stat main...HEAD -- content test/fixtures/compose-golden test/context-budget.test.mjs bin gates tools/handoff-parse.ts tools/handoff-write.ts tools/handoff-types.ts tools/handoff-orchestrator.ts tools/handoff.ts` is empty.
  proof: that command prints nothing.
- **AC-G3** (full suite). The full suite passes on the final committed HEAD with a clean working tree.
  proof: `node scripts/test-lock.mjs -- npm test` exits 0.

## Copy / Strings
| string id | exact text (quote verbatim) | source |
|---|---|---|
| void.refused.row | `Task ${taskId} is already completed and cannot be voided — roll it back first (tw_rollback_task) if it needs to be undone.` | authored-here: today's text, kept byte-identical for the row-only case where it is still correct |
| void.refused.ledger | `Task ${taskId} is already completed and cannot be voided — the task list shows it open, but the handoff completed_tasks ledger still records it. Have qa-engineer remove it first with a FAIL write (tw_update_state) carrying review_task_ids=[${taskId}]; then void it.` | authored-here: ruling 1 = (a); names the qa FAIL step and does not send the reader to a rollback that would refuse ("is not completed, cannot rollback") |
| void.refused.both | `Task ${taskId} is already completed and cannot be voided — to undo it, roll it back (tw_rollback_task) and have qa-engineer remove it from the handoff completed_tasks ledger with a FAIL write (tw_update_state) carrying review_task_ids=[${taskId}]; then void it.` | authored-here: ruling 1 = (a); both mirrors hold the id, so both steps are named |

The `review_task_ids=[<id>]` shape matches the qa SOP's FAIL call format. All three strings keep the prefix `Task <id> is already completed and cannot be voided — `, so every existing `/already completed/` pin still matches. They add no SCREAMING_SNAKE token, so `test/error-code-contract.test.mjs` sees no new code. The two storage modes return byte-identical text for the same state. Whether the literal is shared through a helper or duplicated is up to sr, as long as it stays within the owned files.

## Visual Tokens
| token id | property | value (quote verbatim) | source |
|---|---|---|---|
| N/A | — | — | feature has no visual literals |

## Visual Widgets
| widget id | description | source-node |
|---|---|---|
| N/A | — | feature has no non-primitive widgets |

## Out of Scope
- Changing what `tw_rollback_task` or `tw_sync` does: no ledger removal on rollback (ruling 1 = (b), rejected) and no change to sync re-marking.
- Changing the void refusal predicate, adding JSON fields to the refusal, or changing the `alreadyVoided` and not-found branches.
- Changing E184's `tw_get_state` envelope (`withoutDispatchMechanismTier` in `tools/handoff-orchestrator.ts`), or any render field other than `dispatch_mechanism_tier`. `dispatch_mechanism` stays rendered.
- Editing `bin/agent-governance-context.mjs`. It gets the fix through the shared `dist/prompts/build.js` renderer.
- Expanding `~user` forms, and any other change to `looksLikePath` or the `resolveWorkspacePath` fallback chain.
- Any `content/**`, compose-golden or context-budget change, any schema change, and release bookkeeping (version bump, CHANGELOG, `docs/backlog.md` done-marks belong to the integrator and release-engineer).

## Dependencies / Prerequisites
- **Mode**: non-design (no `design/<feature>.md`); Visual Structural Assertions are omitted. **No schema change**: handoff, tasks, SQLite and config versions are untouched. **No content, golden or budget change is expected** (AC-E376-5, AC-G2).
- **Rulings applied, not re-asked**: ruling 1 = (a), message only. The E172 shape is a PM decision this brief delegated (see below). No open option choices and no needs-human-ruling items.
- **E172 shape (PM decision)**: `index.ts` cannot be imported in-process by a test, because its top-level IIFE connects a stdio transport at load (see the `test/prompt-state-footer.test.mjs` AC-4 header comment). A `process.platform` check inside `index.ts` could therefore only be tested by faking the platform in a spawned server, which depends on the host. Decision: move `normalizeWorkspacePath` into `prompts/build.ts`, which is owned, already exports the `WorkspaceSource` type that `index.ts` imports, and is already imported in-process by tests. Its signature becomes `normalizeWorkspacePath(p: string, platform: NodeJS.Platform = process.platform): string`. `index.ts` imports it for `resolveWorkspacePath` and re-exports the name, so its export surface is unchanged. `~\` is recognised only when `platform === "win32"`, and expansion keeps using the host `path` module. On a real win32 host that module is `path.win32`. In tests it is the CI host's, which AC-E172-1 avoids depending on by using a single-segment tail.
- **Line numbers re-verified on the dispatch base (4b25061)**:
  - E359: `tools/tasks-file.ts` refusal at 544-549 (predicate 544, message 547-548; `ledgerCompleted` computed at 540-542). `tools/storage-sqlite.ts` refusal at 765-772 (predicate 765, message 769-770; `ledgerCompleted` at 762-764).
  - E376: `prompts/build.ts` `renderHandoffStateBlock` at 139-148, called at 489. It is also loaded by `bin/agent-governance-context.mjs:164` and called at `:208`.
  - E172: `index.ts` `normalizeWorkspacePath` at 63-68 (doc comment 57-62); `resolveWorkspacePath` at 70-94 calls it at 89.
- **Pins checked (literal and regex forms grepped under `test/`)**:
  - Void refusal text: `test/e117-void-task.test.mjs` lines 116, 222, 253 and 394 match `/already completed/`, which every new string keeps. **No pin moves.** `test/e125a-lane-local-ledgers.test.mjs:573` voids an open row the ledger does not hold (success path), so it is unaffected. Nothing under `content/**` quotes the text. Archived review reports quote the old text as history and are not edited.
  - Rendered state block: `test/e137-render-sanitise.test.mjs` AC11 (lines 444-465) seeds no tier, so it stays green. Its "no deletion" round-trip now has one deliberate exception key, and qa may note that in a comment. `test/e122-state-render-injection.test.mjs` and `test/prompt-state-footer.test.mjs` seed no tier. `test/e184-get-state-omits-tier.test.mjs` pins only `handleGetState`. The other tier mentions (`dispatch-mechanism`, `dispatch-log`, `dispatch-pins`, `handoff-migration`, `cut-approval-gate`, `stale-dispatch-detection`, `repro-first-gate`, `handoff-versioning`, `success-metrics`, `lane-migrate`) are on the record, migration and log paths, not the render. **No pin moves.** Source scans of `prompts/build.ts` (`test/e137-render-sanitise.test.mjs` AC1 fence scan, `test/context-budget.test.mjs:947` import pin) are untouched by the change.
  - `resolveWorkspacePath` and `normalizeWorkspacePath`: no test imports them. The spawned AC2 tests in `test/prompt-state-footer.test.mjs` (from line 593) stay green. The comment at line 593, "(normalizeWorkspacePath, index.ts)", goes stale after the move, and qa updates it in T-E359-06; this is a **comment-only move** in an owned test. Source scans of `index.ts` (`test/error-code-contract.test.mjs`, `test/e23-evidence-schema.test.mjs:568`, `test/e308-single-source-tier-enum.test.mjs:84`, `test/baseline-manifest-gate.test.mjs` AC-9 Server() literal, `test/lane-migrate.test.mjs` caller scan) are unaffected.
- **Golden baseline**: on the dispatch base, `node scripts/capture-constitution-golden.mjs` exited 0 and left `git status --porcelain` empty.
- The test files are new and qa names them under the owned globs `test/e359-*.test.mjs`, `test/e376-*.test.mjs` and `test/e172-*.test.mjs`. Only qa-engineer writes `test/**`.
- External references: none. This spec cites only repo files.

## Cut
| id | desc | depends_on | est. files | touches | design-link |
|---|---|---|---|---|---|
| E359 | void refusal names the qa FAIL step (ledger-only and both-mirrors cases) at the file and SQLite sites; T-E359-01 sr, T-E359-04 qa | none | 9 | `tools/tasks-file.ts`、`tools/storage-sqlite.ts`、`dist/tools/tasks-file.*`、`dist/tools/storage-sqlite.*`、`test/e359-*.test.mjs` | — |
| E376 | renderHandoffStateBlock omits dispatch_mechanism_tier; goldens recaptured byte-identical; T-E359-02 sr, T-E359-05 qa | none | 6 | `prompts/build.ts`、`dist/prompts/build.*`、`test/e376-*.test.mjs` | — |
| E172 | normalizeWorkspacePath moves to prompts/build.ts with an injectable platform and expands `~\` on win32; index.ts re-exports; T-E359-03 sr, T-E359-06 qa | E376 | 11 | `prompts/build.ts`、`index.ts`、`dist/prompts/build.*`、`dist/index.*`、`test/e172-*.test.mjs`、`test/prompt-state-footer.test.mjs` | — |

## Cut file map
| file | change | AC | task |
|---|---|---|---|
| `tools/tasks-file.ts` | `voidTaskInFile` refusal (544-549): choose `void.refused.row`, `.ledger` or `.both` from `task.completed` and `ledgerCompleted`; predicate unchanged | AC-E359-1, 2, 3, 5, 6 | T-E359-01 |
| `tools/storage-sqlite.ts` | `voidTask` refusal (765-772): same three-way choice from `existing.completed === 1` and `ledgerCompleted`; same strings | AC-E359-4, 6 | T-E359-01 |
| `dist/tools/tasks-file.{js,js.map,d.ts,d.ts.map}` | rebuilt by `npm run build` | AC-G1 | T-E359-01 |
| `dist/tools/storage-sqlite.{js,js.map,d.ts,d.ts.map}` | rebuilt by `npm run build` | AC-G1 | T-E359-01 |
| `prompts/build.ts` | `renderHandoffStateBlock` (139-148) drops the top-level `dispatch_mechanism_tier` key before `sanitizeForRender`, other keys and order kept | AC-E376-1..5 | T-E359-02 |
| `prompts/build.ts` | gains `normalizeWorkspacePath(p, platform = process.platform)` (moved from `index.ts`, plus the win32 `~\` branch) and its doc comment | AC-E172-1..4 | T-E359-03 |
| `index.ts` | removes the local `normalizeWorkspacePath` (57-68), imports it from `./prompts/build.js`, re-exports the name; `resolveWorkspacePath` call at 89 unchanged | AC-E172-4 | T-E359-03 |
| `dist/prompts/build.{js,js.map,d.ts,d.ts.map}` | rebuilt | AC-G1 | T-E359-02, T-E359-03 |
| `dist/index.{js,js.map,d.ts,d.ts.map}` | rebuilt | AC-G1 | T-E359-03 |
| `test/e359-*.test.mjs` (new, qa names it) | AC-E359-1..5 cases, SQLite cases skip loudly without `better-sqlite3` | AC-E359-1..5 | T-E359-04 |
| `test/e376-*.test.mjs` (new, qa names it) | AC-E376-1, 2, 4 cases (build, hook, direct renderer; record untouched) | AC-E376-1, 2, 4 | T-E359-05 |
| `test/e172-*.test.mjs` (new, qa names it) | in-process `normalizeWorkspacePath` cases with `platform` injected | AC-E172-1..3 | T-E359-06 |
| `test/prompt-state-footer.test.mjs` | comment-only: line 593 header names `prompts/build.ts` as the home of `normalizeWorkspacePath` | AC-E172-4 | T-E359-06 |
| `test/e117-void-task.test.mjs`, `test/e137-render-sanitise.test.mjs`, `test/e184-get-state-omits-tier.test.mjs` | owned, expected **unchanged** (pins hold); qa may add a comment to e137 AC11 noting the one exception key | AC-E359-6, AC-E376-3, 4 | T-E359-04, T-E359-05 |
| `test/fixtures/compose-golden/**` | **unchanged** (forbidden; capture must be byte-identical) | AC-E376-5 | T-E359-02 |
