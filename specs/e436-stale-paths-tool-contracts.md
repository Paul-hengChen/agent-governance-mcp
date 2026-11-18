# e436-stale-paths-tool-contracts

Lane e436, one cut, two tickets: E436 (stale handoff paths in `CLAUDE.md` and the release-engineer subagent template) and E441 (six tool descriptions rewritten as contracts). Base `41c301e`. Fan-out plan: `specs/fanout-prompt-audit-fixes.md` (lane row e436, ownership re-split, human ruling 3 = a). Source findings: `docs/prompt-audit-2026-11-18.md` H1, H2, F2, M7; starting hunks in `docs/prompt-audit-2026-11-18.diff` (the line-7 `CRITICAL:` hunk and the `CRITICAL:`/`NEVER` capitals on template line 13 belong to E442, ruled keep, and are NOT applied).

## Problem Statement
1. **E436.** The repo is in lane layout: the primary checkout's state file is `.current/_primary/handoff.md` (tracked), and flat `.current/<file>` is legacy, reached only by the migration runners (`tools/lane-paths.ts` header, lines 2-5). `CLAUDE.md` still says `.current/handoff.md` exists at the root (lines 13, 220) and uses the same flat path as shorthand in three more places (lines 44, 64, 195). `templates/claude-code-agents/release-engineer.md` line 13 forbids hand-editing `.current/handoff.md`, while the SOP it mirrors (`content/skill-release-engineer.md` line 19) names `.current/<lane>/handoff.md`. Template line 9 says the SOP's rules "are not restated here", then lines 11 and 13 restate two of them (F2).
2. **E441.** Tool descriptions ship in every `tools/list` response of every adopter. In `tools/registry.ts`: `tw_get_state` shouts "MANDATORY FIRST ACTION" and its "Other tw_* writes blocked" is vague; `tw_get_next_task`, `tw_detect_drift`, `tw_rollback_task` are one-liners with no return shape or failure case; `tw_update_state` cites a spec path that exists only in this repo; `tw_void_task` carries a ticket id **and two claims the code no longer matches**: (a) "Its id becomes structurally reusable in a re-cut" — `tw_add_task` refuses a voided id in both modes (`tools/tasks-file.ts:696-710`, `tools/storage-sqlite.ts:795-813`); (b) "SQLite/HTTP mode reports both cases as a uniform not-found" — SQLite now returns `alreadyVoided: true` from the tombstone table (`tools/storage-sqlite.ts:740-756`, pinned by `test/e117-void-task.test.mjs` "E120/Q1 (SQLite mode)").

## Sites re-verified at base 41c301e

| # | file:line | current text (verbatim) |
|---|---|---|
| S1 | `CLAUDE.md:13` | ``dogfoods itself (`.current/handoff.md` and `tasks.md` exist at the root), so the`` |
| S2 | `CLAUDE.md:44` | ``   read/write `.current/handoff.md`, `tasks.md`, and (in HTTP/SQLite mode)`` |
| S3 | `CLAUDE.md:64` | `tools/handoff.ts          read/write .current/handoff.md (uses js-yaml)` |
| S4 | `CLAUDE.md:195` | ``  stopped from editing `.current/handoff.md` directly. (But `tw_detect_drift` `` |
| S5 | `CLAUDE.md:220-221` | ``**This repo dogfoods its own server.** `.current/handoff.md` and `tasks.md` `` / `exist at the root, so this is a managed workspace like any other. Agents` |
| S6 | `templates/claude-code-agents/release-engineer.md:9` | `... follow the returned SOP exclusively. Its Hard rules and numbered steps are normative there and are not restated here.` |
| S7 | `templates/claude-code-agents/release-engineer.md:13` | ``CRITICAL: If this session has no MCP tool-invocation path at all (no `tw_*` tools reachable), NEVER hand-edit `.current/handoff.md` or `tasks.md` to simulate a `tw_update_state` write. ...`` |
| S8 | `tools/registry.ts:651` | `tw_get_state` description (one line) |
| S9 | `tools/registry.ts:667-668` | `tw_update_state` description (two lines) |
| S10 | `tools/registry.ts:853` | `tw_get_next_task` description (one line) |
| S11 | `tools/registry.ts:927` | `tw_rollback_task` description (one line) |
| S12 | `tools/registry.ts:951-960` | `tw_void_task` description (nine concatenated strings) |
| S13 | `tools/registry.ts:984` | `tw_detect_drift` description (one line) |

Root `tasks.md` exists (it is the tasks index, header line 2) and `.current/_primary/handoff.md` is tracked, so S1/S5 keep naming `tasks.md`. Line 52 (`` (`handoff.md`, `tasks.md`, the SQLite DB, ``) names the file without a directory and is correct as is. The `agc-version` stamp is not touched.

## Cut decisions (human ruling 3 = a: decided here, presented with the cut)

- **D1 — CLAUDE.md lines 44, 64, 195: change all three to `.current/<lane>/handoff.md`.** Reason: these lines describe what the server reads and writes in any workspace, and since the lane flip that is always `.current/<lane>/handoff.md` (flat is migration-only, `tools/lane-paths.ts:2-5`); the shorthand points an agent at a file that does not exist, which is the defect H1 names. `<lane>` matches the form the SOPs already use (`content/skill-release-engineer.md:19`).
- **D2 — Template line 9: reword, do not leave.** Reason: as written, line 9 contradicts lines 11 and 13 directly below it (F2); naming the two repeats and why the no-MCP one is there keeps the "SOP is normative" sentence true without deleting line 13 (the no-MCP case, where `tw_switch_role` cannot load the SOP). Cost: one qa-owned pin (`test/e404-release-engineer-template.test.mjs` `LOAD`).

## Exact replacements (sr-engineer applies verbatim)

### E436 — `CLAUDE.md` (5 sites, 6 physical lines)
Exact lines (unified-diff form; `-` = base line, `+` = new line; leading spaces after the marker are part of the line):

```diff
@@ S1 line 13
-dogfoods itself (`.current/handoff.md` and `tasks.md` exist at the root), so the
+dogfoods itself (`.current/_primary/handoff.md` and `tasks.md` exist), so the
@@ S2 line 44
-   read/write `.current/handoff.md`, `tasks.md`, and (in HTTP/SQLite mode)
+   read/write `.current/<lane>/handoff.md`, `tasks.md`, and (in HTTP/SQLite mode)
@@ S3 line 64
-tools/handoff.ts          read/write .current/handoff.md (uses js-yaml)
+tools/handoff.ts          read/write .current/<lane>/handoff.md (uses js-yaml)
@@ S4 line 195
-  stopped from editing `.current/handoff.md` directly. (But `tw_detect_drift`
+  stopped from editing `.current/<lane>/handoff.md` directly. (But `tw_detect_drift`
@@ S5 lines 220-221
-**This repo dogfoods its own server.** `.current/handoff.md` and `tasks.md`
-exist at the root, so this is a managed workspace like any other. Agents
+**This repo dogfoods its own server.** `.current/_primary/handoff.md` and
+`tasks.md` exist, so this is a managed workspace like any other. Agents
```

### E436 — `templates/claude-code-agents/release-engineer.md`
- Line 7: unchanged (E442).
- Line 9, replace the final sentence `Its Hard rules and numbered steps are normative there and are not restated here.` with:
  `Its Hard rules and numbered steps are normative there; the two paragraphs below repeat only the step 5 re-baseline and, for a session that cannot load the SOP, the no-MCP relay rule.`
  Full new line 9: ``This subagent runs the agc release-engineer SOP under a pinned model tier. On invocation, call `tw_get_state` then `tw_switch_role("release-engineer")` and follow the returned SOP exclusively. Its Hard rules and numbered steps are normative there; the two paragraphs below repeat only the step 5 re-baseline and, for a session that cannot load the SOP, the no-MCP relay rule.``
- Line 13: replace the one span ``NEVER hand-edit `.current/handoff.md` or `tasks.md` `` with ``NEVER hand-edit `.current/<lane>/handoff.md` or `tasks.md` ``. Everything else on the line byte-identical (`CRITICAL:` and `NEVER` kept). The file stays 13 lines, one trailing newline.

### E441 — `tools/registry.ts` (description strings only)
Each block replaces the `description:` property of the named `defineTool` entry (S8-S13). Indentation: `    description:` (4 spaces) then continuation lines at 6 spaces, matching the existing multi-line entries. No other byte of the entry (name, inputSchema, zodSchema, handler) changes; array order unchanged.

**tw_get_state** (replaces line 651)
```ts
    description:
      "Read the workspace's handoff state: JSON { exists: true, ...state }, or { exists: false, message } " +
      "when no state exists; either may add advisory keys. File mode fails on an unparseable handoff file " +
      "or one a newer server wrote. Until it has run for the same workspace_path in this server process, " +
      "tw_update_state, tw_complete_task, tw_rollback_task, tw_void_task, tw_add_task and tw_sync fail " +
      "with ⛔ BLOCKED.",
```

| claim | code |
|---|---|
| returns `{ exists: true, ...state }` | `tools/handoff-parse.ts:772-779` (file); `tools/storage-sqlite.ts:506` (SQLite) |
| `{ exists: false, message }` when no state exists | `tools/handoff-parse.ts:649-656`; `tools/storage-sqlite.ts:491-496` |
| either may add advisory keys | file: `stale_dispatch`, `exemptions`, `config_error`, `lane_registry`, `*_truncated` (`tools/handoff-parse.ts:649-656,713-728,772-779`); both modes: `dispatch_pins_advisory` (`tools/handoff-orchestrator.ts:66-103`) |
| file mode fails on an unparseable handoff file | `tools/handoff-parse.ts:415-423` (`Failed to parse handoff.md frontmatter`) |
| ... or one a newer server wrote | `tools/handoff-parse.ts:426-429` (`runMigrations` refuse-loud on a future `schema_version`) |
| keyed by workspace_path, per server process | `guards/session.ts:22` (`activeSessions` in-process `Map`), `:32-59` (`markStateRead(workspacePath)`), `:98-100` (`hasReadState`); called from `tools/handoff-parse.ts:618` and `tools/storage-sqlite.ts:488` |
| the six blocked tools, `⛔ BLOCKED` | `guards/session.ts:102-109`; call sites listed under "Guard call sites" below |

**tw_update_state** (replaces lines 667-668; the `description:` key line 666 stays)
```ts
    description:
      "Atomically write the workspace's handoff state at the end of a role step. Returns JSON " +
      "{ success: true, updated_at, ... }, with warnings when an advisory applies. Each write is checked " +
      "against the role-transition matrix (ALLOWED_TRANSITIONS) and the gate pipeline; a rejection writes " +
      "no state and returns text starting with ⛔ and the error code, plus a hint. Also fails with " +
      "⛔ BLOCKED before tw_get_state, or ⛔ STATE DRIFT if the state changed since that read.",
```

| claim | code |
|---|---|
| atomic write | `tools/handoff-write.ts` (lock + `verifyFreshness` :277 + tmp/rename publish); SQLite row write `tools/storage-sqlite.ts:592,649` |
| returns `{ success: true, updated_at, ... }` | `tools/handoff-write.ts:629` (`success, path, updated_at`); `tools/storage-sqlite.ts:649` (`success, storage, updated_at`) |
| `warnings` when an advisory applies | `tools/handoff-orchestrator.ts:1702-1717` |
| checked against ALLOWED_TRANSITIONS and the gate pipeline | `tools/handoff-orchestrator.ts:232-237` (transition step of `UPDATE_STATE_GATE_PIPELINE`); `tools/transitions.ts:352-371` |
| a rejection writes no state | gates return before the write; evidence recorded on the same write is undone (`tools/handoff-orchestrator.ts:152-180`) |
| text starts with ⛔ and the error code, plus a hint | e.g. `tools/handoff-orchestrator.ts:234,273,338,368,628-630,659-661,839-841,876-878,900` (every gate text is `⛔ <CODE>` + JSON envelope with `hint` or + `hintStatic`); PASS-by-non-qa `tools/transitions.ts:148-159` |
| `⛔ BLOCKED` before tw_get_state | `tools/handoff-orchestrator.ts:1292` → `guards/session.ts:102-109` |
| `⛔ STATE DRIFT` if state changed since that read | `guards/session.ts:116-134` (`verifyFreshness`, file; called `tools/handoff-write.ts:277`); `guards/session.ts:81-96` (`verifyExtra`, SQLite; called `tools/storage-sqlite.ts:592`) |

**tw_get_next_task** (replaces line 853)
```ts
    description:
      "Return the first unchecked, non-voided task as JSON { next: { id, description, section, " +
      "completed }, isCheckpoint, progress: { completed, total } }; isCheckpoint is true when the task " +
      "before it is in another section. Returns { allComplete: true, totalTasks } when none is left, " +
      "or { error } when there is no task list.",
```

| claim | code |
|---|---|
| first unchecked task, `next` shape | `tools/tasks-file.ts:257,266-274` + `TaskRecord` `tools/tasks-file.ts:51-56`; `tools/storage-sqlite.ts:669-689` + `listTasks` `:654-667` |
| non-voided | file: `- [-]` rows never parse (`tools/tasks-file.ts:490-497` doc); SQLite: void DELETEs the row (`tools/storage-sqlite.ts:338-340`) |
| `isCheckpoint` true when the previous task is in another section | `tools/tasks-file.ts:262-264`; `tools/storage-sqlite.ts:678-680` (first task → `null`, falsy) |
| `progress: { completed, total }` | `tools/tasks-file.ts:270-273`; `tools/storage-sqlite.ts:684-687` |
| `{ allComplete: true, totalTasks }` | `tools/tasks-file.ts:258-260`; `tools/storage-sqlite.ts:675-677` |
| `{ error }` when there is no task list | `tools/tasks-file.ts:237-239`; `tools/storage-sqlite.ts:671-673` |
| (not claimed: file mode may add `advisory`, `tools/tasks-file.ts:255-256`; no pre-flight guard, `tools/tasks.ts:63-67`) | — |

**tw_rollback_task** (replaces line 927)
```ts
    description:
      "Turn a checked task back to unchecked and record `(reverted: <reason>)` on it. Returns JSON " +
      "{ success: true, taskId, marked: \"reverted\", reason }, or { error } when there is no task list, " +
      "the task is unknown or unchecked, or (file mode) task_id or reason has a line break. Touches the " +
      "task list only, not the handoff state or its completed_tasks. ⛔ BLOCKED before tw_get_state.",
```

| claim | code |
|---|---|
| `[x]` → `[ ]` with `(reverted: <reason>)` | `tools/tasks-file.ts:431-448`; SQLite stores `reverted_reason` (`tools/storage-sqlite.ts:330-333`) and renders it as `(reverted: …)` (`:658-660`) |
| success shape | `tools/tasks-file.ts:453`; `tools/storage-sqlite.ts:732-734` (adds `storage`) |
| `{ error }`: no task list | `tools/tasks-file.ts:410-413,419-422` |
| unknown / unchecked | `tools/tasks-file.ts:424-430`; `tools/storage-sqlite.ts:717-726` |
| (file mode) line break in task_id or reason | `tools/tasks-file.ts:392-407` (SQLite has no such check — hence the qualifier) |
| task list only | `tools/tasks-file.ts:450-451` (writes the tasks file only); `tools/storage-sqlite.ts:330-333` (`UPDATE tasks` only) |
| reason required | zod `RollbackTaskArgs` `tools/registry.ts:544-548` (`reason: z.string().min(1)`) — schema, not restated |
| `⛔ BLOCKED` before tw_get_state | `tools/tasks.ts:81` |

**tw_void_task** (replaces lines 951-960; the `description:` key line 951 stays — the replacement below starts at the first string)
```ts
    description:
      "Void an unchecked task that should never have existed (not one done and then undone). Returns " +
      "JSON { success: true, taskId, marked: \"voided\", reason }, or { error } when the task is checked " +
      "or in the handoff's completed_tasks (the message names the fix), unknown, already voided " +
      "(alreadyVoided: true), or (file mode) task_id or reason has a line break. A voided task drops out " +
      "of tw_get_next_task, tw_detect_drift and tw_sync, and tw_add_task refuses its id. ⛔ BLOCKED " +
      "before tw_get_state.",
```

| claim | code |
|---|---|
| success shape | `tools/tasks-file.ts:617`; `tools/storage-sqlite.ts:780-782` (adds `storage`) |
| checked, or in handoff `completed_tasks`; message names the fix | `tools/tasks-file.ts:566-578` + `voidRefusalMessage` `:464-488`; `tools/storage-sqlite.ts:758-772` |
| unknown | `tools/tasks-file.ts:563`; `tools/storage-sqlite.ts:756` |
| already voided, `alreadyVoided: true` (both modes) | `tools/tasks-file.ts:549-562`; `tools/storage-sqlite.ts:740-756` (E120 tombstone) |
| (file mode) line break | `tools/tasks-file.ts:508-530` |
| drops out of get_next_task / detect_drift / sync | file: `- [-]` marker never parses (`tools/tasks-file.ts:490-497`, post-write check `:592-612`); SQLite: row DELETEd (`tools/storage-sqlite.ts:338-340,357-362`) |
| `tw_add_task` refuses its id | `tools/tasks-file.ts:696-710`; `tools/storage-sqlite.ts:795-813` |
| `⛔ BLOCKED` before tw_get_state | `tools/tasks.ts:89` |

**tw_detect_drift** (replaces line 984)
```ts
    description:
      "Compare the handoff state with the task list. Returns JSON { driftDetected, details, " +
      "handoffLastTask, tasksCompleted, tasksIncomplete, stampAdvisory, fanoutAdvisory, " +
      "evidenceBackedIds }; details has one line per finding, and the advisories are null or a note " +
      "that never sets driftDetected. State written by a newer server is reported as drift. Repairs " +
      "nothing (tw_sync copies handoff completions to the task list). Run it after tw_get_state.",
```

| claim | code |
|---|---|
| the eight fields, every return path, both modes | `DriftReport` `tools/drift.ts:17-43`; returns `:315-325,333-343,347-357,367-377` and the final report; storage-agnostic via `getActiveStorage()` `:328-330` |
| advisories null or a note, never set `driftDetected` | `tools/drift.ts:23-34` |
| newer server → drift | `checkVersionSkew` `tools/drift.ts:291-306`, early return `:313-326` |
| repairs nothing | `handleDetectDrift` `tools/drift.ts:499-503` returns the report only; no guard ("No guard: drift detection is read-only") |
| tw_sync copies handoff completions to the task list | `tools/sync.ts:1-7,95-99` |

### Guard call sites (`enforcePreFlight`, `guards/session.ts:102`, read-only)
| tool | call site |
|---|---|
| `tw_update_state` | `tools/handoff-orchestrator.ts:1292` |
| `tw_complete_task` | `tools/tasks.ts:71` |
| `tw_rollback_task` | `tools/tasks.ts:81` |
| `tw_void_task` | `tools/tasks.ts:89` |
| `tw_add_task` | `tools/tasks.ts:95` |
| `tw_sync` | `tools/sync.ts:97` |

Exhaustive: `grep -rn 'enforcePreFlight(' tools guards gates lib transport index.ts` shows exactly these six calls plus the definition. Not guarded: `tw_get_state`, `tw_get_next_task`, `tw_detect_drift`, `tw_switch_role`, `tw_index_prd`, `tw_clear_prd_chunks`, `tw_gate_stats`. The `tw_get_state` list equals this set.

Size: the six descriptions go from 1151 to 2492 characters (+1341, about 340 tokens per `tools/list`); `tw_void_task` shrinks 821 → 489. Per-tool: get_state 407, update_state 460, get_next_task 318, rollback_task 377, void_task 489, detect_drift 441.

## Acceptance Criteria
- **AC1** — Given the edit, when `CLAUDE.md` is grepped for `` `.current/handoff.md` `` and `.current/handoff.md`, then there are no hits; lines 13 and 220 name `.current/_primary/handoff.md`; lines 44, 64, 195 name `.current/<lane>/handoff.md`; the `agc-version` line is byte-identical; `git diff --numstat` for `CLAUDE.md` is `6	6`.
- **AC2** — Given the template, then it has 13 lines and one trailing newline; line 7 is byte-identical to base; line 9 equals the new line 9 above; line 11 is byte-identical; line 13 equals base line 13 with only `.current/handoff.md` → `.current/<lane>/handoff.md` (still starts `CRITICAL: If this session has no MCP tool-invocation path at all` and still contains `NEVER hand-edit`).
- **AC3** — Given `tools/registry.ts`, when the six entries are read from the built `dist/tools/registry.js` `TOOL_REGISTRY`, then each `description` equals the exact string above (concatenated), and every other entry's `description`, every `inputSchema`, and the registry order are unchanged from base.
- **AC4** — Given each of the six descriptions, then every return field and failure case it names exists in the handler (the claim tables above; reviewer re-checks each row).
- **AC5** — Given `tw_get_state`'s description, then the set of tool names it lists as blocked equals the set of `enforcePreFlight(…, "<tool>")` call-site names (six; table above).
- **AC6** — Given the six descriptions, then none contains `specs/`, `MANDATORY`, `(E` followed by a digit, `uniform not-found`, or `structurally reusable`.
- **AC7** — Given the whole change, then no file under `content/**`, `test/fixtures/compose-golden/**`, `test/context-budget.test.mjs`, `guards/**`, `docs/backlog.md`, other `tools/**` or other templates changed, and `dist/` changes only in `dist/tools/registry.js`, `dist/tools/registry.js.map` and `dist/tools/registry.d.ts.map` (the probe build changed exactly these three).
- **AC8** — Given the whole change plus QA's re-pins and new tests, when the full suite runs (`node scripts/test-lock.mjs -- npm test`), then it has 0 failures (baseline at `41c301e` had none).

## Test impact (probe: only this cut's edits applied, full suite)
Method: two throwaway `git clone`s of the lane worktree at `41c301e` in a temp directory (real git history, `node_modules` symlinked from the primary checkout); the second clone got exactly the S1-S13 replacements above; each ran `npm test` (prebuild + build + `node scripts/test-lock.mjs -- node --test test/*.test.mjs`).

- Baseline (unedited): tests 4228, pass 4226, fail 0, skipped 2. No pre-existing or environmental reds (e234, e258b, e295, e299 pass in a real clone).
- Edited: tests 4228, pass 4221, fail 5, skipped 2. All five reds are caused by this cut and all are in the lane's owned test set:

| test file | test name | caused by | owner |
|---|---|---|---|
| `test/e404-release-engineer-template.test.mjs` | `AC-E404-1: 13 lines, frontmatter then exactly four non-blank body lines in order, no trailing blank` | template line 9 (`LOAD`) and line 13 (`RELAY`) constants | e436 qa |
| `test/e404-release-engineer-template.test.mjs` | `AC-E404-3: the load line is the base sentence plus the not-restated sentence` | template line 9 (`LOAD`) | e436 qa |
| `test/e404-release-engineer-template.test.mjs` | `AC-E404-4: the RELAY paragraph is the pinned text and is the last line` | template line 13 (`RELAY`) | e436 qa |
| `test/feature-lease.test.mjs` | `E9A-S4: templates/claude-code-agents/release-engineer.md carries the matching no-MCP-path relay paragraph (dispatch-context copy)` | template line 13 path regex | e436 qa (S4 only) |
| `test/subagent-templates.test.mjs` | `e9a AC2: templates/claude-code-agents/release-engineer.md carries the no-MCP-path relay paragraph` | template line 13 path regex | e436 qa (`e9a AC2` only) |

Re-pin guidance (qa): AC-E404-3's title says "not-restated sentence"; retitle to match the new sentence. The three path regexes become ``NEVER hand-edit `\.current\/<lane>\/handoff\.md` or `tasks\.md` to simulate``. Stay green unchanged (checked): `test/e392-subagent-templates.test.mjs` AC8 (`startsWith("CRITICAL: If this session …")`), `feature-lease` E9A-S5 / E17-S4 (line 7 and the line-13 opening unchanged), `release-staging` AC5. `CLAUDE.md` edits and the six descriptions turn nothing red: no test pins the old CLAUDE.md lines or any of the six old description strings (`tools/registry.ts`, `dist/`, `docs/` only). Cross-lane items: none.

sr-engineer's expected-red manifest lists these five rows.

## Tasks
| id | ticket | owner | files | change |
|---|---|---|---|---|
| T-E436-01 | E436 | sr-engineer | `CLAUDE.md` | S1-S5 exact replacements |
| T-E436-02 | E436 | sr-engineer | `templates/claude-code-agents/release-engineer.md` | line 9 reword, line 13 path |
| T-E441-01 | E441 | sr-engineer | `tools/registry.ts`, `dist/tools/registry.*` | six descriptions verbatim, `npm run build` |
| T-E436-03 | E436 | qa-engineer | qa-owned pins (see Test impact) + new `test/e436-*.test.mjs` | re-pin the E436 reds; add AC1/AC2 pins |
| T-E441-02 | E441 | qa-engineer | new `test/e441-*.test.mjs` | add AC3/AC5/AC6 pins (AC5 derives the guard set by scanning `tools/` for `enforcePreFlight(` call sites, not a hard-coded list) |

sr-engineer leaves the probe's reds intentionally (tests are qa-owned) and lists them in `qa_reports/expected-red_e436-stale-paths-tool-contracts.txt` (`<file> | <exact test name>`).

## Cut

| id | desc | depends_on | est. files | touches | design-link |
|---|---|---|---|---|---|
| E436 | Stale handoff paths: `CLAUDE.md` lines 13/220-221 to the primary path, lines 44/64/195 to the lane path (D1); release-engineer template line 9 reworded (D2), line 13 lane path | — | 2 + qa pins | `CLAUDE.md`、`templates/claude-code-agents/release-engineer.md`、`test/e404-release-engineer-template.test.mjs`、`test/feature-lease.test.mjs`、`test/subagent-templates.test.mjs`、`test/e436-*.test.mjs` | — |
| E441 | Six tool descriptions rewritten as contracts, string-only, plus rebuilt registry output | — | 1 + dist + qa pins | `tools/registry.ts`、`dist/tools/registry.*`、`test/e441-*.test.mjs` | — |

## Out of Scope
- Template line 7 `CRITICAL:` and the `CRITICAL:`/`NEVER` capitals on line 13 (E442, ruled keep).
- Any other template, `content/**` (including `content/skill-release-engineer.md`), compose goldens, `test/context-budget.test.mjs`, guard behaviour, `docs/backlog.md`.
- Any schema, zod, handler, error-code or behaviour change in `tools/**`; other tool descriptions (`tw_complete_task`, `tw_add_task`, `tw_sync`, …) and parameter descriptions (e.g. `agent_id`'s "Validated against ALLOWED_TRANSITIONS").
- Installed copies of the template in a user's agent directory keep the old text until re-copied (no migration).
- Release / version bump: none (wave ships as one PR via `integ/prompt-audit-fixes`).

## Dependencies / Prerequisites
- No design source (no-design). External refs: none (all cited files are in-repo).
- Cross-lane: e437 owns all of `test/subagent-templates.test.mjs` except `e9a AC2`, and all of `test/feature-lease.test.mjs` except S4 (`E9A-S4`); any red outside the owned set is mailed to the integrator, not fixed here.

## Files touched
3 source/doc files (`CLAUDE.md`, `templates/claude-code-agents/release-engineer.md`, `tools/registry.ts`) + `dist/tools/registry.*` + the expected-red manifest + 3 re-pinned qa-owned test files (`test/e404-release-engineer-template.test.mjs`, `test/feature-lease.test.mjs` E9A-S4 only, `test/subagent-templates.test.mjs` `e9a AC2` only) + 2 new test files (`test/e436-*`, `test/e441-*`) + this spec. Probe diff of the three source files: 41 insertions, 22 deletions.
