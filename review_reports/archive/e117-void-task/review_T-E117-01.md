# Review — T-E117-01

covers: T-E117-01

## Round 1 — CHANGES_REQUESTED — by code-reviewer

## Summary

- Adds `tw_void_task` (option (a)) across five sources: `tools/tasks-file.ts:250` `voidTaskInFile`, `tools/storage.ts:70,180` interface member + `FileHandoffStorage` delegate, `tools/storage-sqlite.ts:162,299,678` `voidTaskStmt` + `voidTask`, `tools/tasks.ts:39,86` delegator + `handleVoidTask`, `tools/registry.ts:269,627` zod schema + `defineTool` entry. +178 lines, no deletions.
- **Scope is correct.** Option (b) was genuinely not built: `TaskRecord` (`tools/tasks-file.ts:33`) is untouched, `parseTaskLine` is untouched, the SQLite `tasks` table (`tools/storage-sqlite.ts:75`) gains no column, no `schema_version` bump. No creep toward the rejected design.
- **The E112 acceptance point is met under the default regex, in both storage modes** — verified by execution, not by reading the claim.
- **Two blocking defects.** (C1) The Decision-2 guard reads the tasks.md checkbox instead of the authoritative `handoff.completed_tasks` ledger, so a task the ledger says is COMPLETED can be voided — and doing so permanently erases the drift signal rather than resolving it. (C2) Under a custom `taskPattern`, void returns `success: true` while `tw_get_next_task` keeps offering the row — the E112 defect, silently unfixed.
- Two further medium findings (C3 SQLite discards the required `reason`; C4 a re-cut id inherits the voided incarnation's review/QA evidence) and one minor (Decision 3).
- Verdict: **CHANGES_REQUESTED**.

## Correctness

### C1 — BLOCKING. Void accepts a ledger-completed task and makes the resulting drift permanently invisible.

`tools/tasks-file.ts:281` guards on `task.completed`, i.e. the tasks.md `[x]` checkbox. But `tasks.md` is the **mirror**, not the source of truth — `tools/sync.ts:14` states it outright: "tw_sync mirrors the AUTHORITATIVE ledger onto tasks.md." The authoritative completion record is `handoff.completed_tasks`.

The divergent state that `tw_sync` exists to repair is exactly "handoff ahead of tasks.md": the ledger says done, the checkbox is still `[ ]`. In that state the guard passes and the void succeeds on a task the server considers complete. Reproduced end-to-end against `dist/`:

```
drift BEFORE: driftDetected:true  ["Handoff says T-B completed, but task list shows it as incomplete."]
void T-B    : {"success":true,"taskId":"T-B","marked":"voided","reason":"PM decided this row was a mis-cut"}
drift AFTER : driftDetected:false ["No drift detected. Handoff and tasks are synchronized."]
sync  AFTER : {"ok":true,"synced":[],"refusedVibeDrift":[],"message":"Nothing to reconcile ..."}
ledger still claims: ["T-B"]
```

The drift was not fixed — it was made structurally unreachable. `tools/drift.ts:287` builds `idVocab` from the tasks.md ids only (`new Set([...completedTasks, ...incompleteTasks])`) and `handoffTaskIds` is derived by matching the ledger strings against that vocab. Once the id is no longer parseable out of tasks.md it can never again be compared against `handoff.completed_tasks`, so the "Handoff says X completed, but task list shows it as incomplete" check at `tools/drift.ts:296` cannot fire for it, ever. `tools/sync.ts:56` uses the same vocab-derived loop and goes equally quiet.

The Decision-2 rationale as written ("completion is terminal and voiding a done task would rewrite history invisibly") is the right instinct — the guard just reads the wrong field. And note the guard is not merely incomplete, it is inverted relative to its purpose: it is strictest in the state where the ledger and mirror already agree, and permissive in precisely the state where they disagree.

This is mode-symmetric, which makes it worse rather than better: `tools/storage-sqlite.ts:308`'s `AND completed = 0` has the identical blind spot, and there the `DELETE` makes the inconsistency unrecoverable.

Required: guard on the ledger. `storage.parse(workspacePath).completed_tasks` is already reachable from both implementations; refuse the void when the id matches a ledger entry (word-boundary match, mirroring `tools/drift.ts:290` and `tools/sync.ts:63`), and say so in the error. A void that leaves `handoff.completed_tasks` pointing at a row that no longer exists must not be silently accepted in either mode.

### C2 — BLOCKING. Under a custom `taskPattern`, void reports success but does not void.

The doc comment at `tools/tasks-file.ts:253` asserts the `[-]` marker is invisible to "`DEFAULT_TASK_REGEX`'s `[ x]` character class (and any custom taskPattern following the same 'space or x' convention)". The parenthetical is the whole risk and it is unenforced. The write path at `tools/tasks-file.ts:287` hardcodes `- \[ \]`; the read path at `tools/config.ts:353` `resolveTaskRegex` is config-driven. Nothing checks that the line written is invisible to the regex that will read it.

With `.current/.config.json` → `"taskPattern": "^- \\[(.)\\] (\\S+)\\s+(.+)$"` (a permissive checkmark group, still group-1/group-2/group-3 conformant per the `tools/config.ts:6` contract), reproduced:

```
void T-A  : {"success":true,"taskId":"T-A","marked":"voided","reason":"mis-cut"}
next AFTER: {"next":{"id":"T-A","completed":false,"description":"first task (voided: mis-cut)", ...}}
```

`parseTaskLine` (`tools/tasks-file.ts:39`) computes `completed: match[1] === "x"`, so `-` yields `completed: false` and the row is re-offered forever — the exact E112 defect the ticket exists to close, now with a `success: true` receipt on top of it.

Note this is a **new** failure mode, not one inherited from `completeTaskInFile`. Those two share the hardcoded write pattern, but under a non-default line format their write simply doesn't match and they fail loud (`tools/tasks-file.ts:175`, `:226` — "Could not find an unchecked checkbox line"). Void is the first operation whose write lands while its semantic effect silently does not.

Cheap fix: after building the replacement line, re-test it with `resolveTaskRegex(workspacePath)` and refuse before `atomicWrite` if it still parses as a task. That converts a silent no-op into a loud refusal and costs one regex test.

### C3 — SQLite discards the required `reason`; file mode persists it.

`reason` is required and non-empty in the schema (`tools/registry.ts:272`, `z.string().min(1)`). File mode persists it on disk as `(voided: <reason>)` (`tools/tasks-file.ts:291`). SQLite mode `DELETE`s the row (`tools/storage-sqlite.ts:308`) and the reason survives only in the ephemeral tool response — nothing durable records that the task ever existed or why it was voided.

This breaks an established convention in the same class: `rollbackTask` persists its reason in the `reverted_reason` column (`tools/storage-sqlite.ts:296`, schema `tools/storage-sqlite.ts:82`), and `listTasks` surfaces it (`tools/storage-sqlite.ts:600`). Requiring an argument and then throwing it away in one of two modes is the silent-divergence class the brief flags. It also forecloses C5 below: file mode *could* distinguish "already voided" from "never existed" because the evidence is on disk; SQLite structurally cannot, because it chose to destroy it.

### C4 — A re-cut id inherits the voided incarnation's review and QA evidence.

The tool description (`tools/registry.ts:632`) advertises "its id becomes reusable in a re-cut", and that reuse works (verified: re-adding a voided id succeeds and produces a clean `[ ]` row). But the evidence gates are keyed on task id and are existence-based: `hasCodeReviewEvidenceInFile` (`gates/code-review.ts:49`) is satisfied by the mere presence of `review_reports/review_<id>.md`, and in SQLite the `reports` rows (`tools/storage-sqlite.ts:90`, PK `(workspace_path, task_id, created_at)`) have no FK to `tasks` and survive the `DELETE` untouched.

So: void `T-X`, re-cut `T-X` for entirely different work, and `MISSING_REVIEW_EVIDENCE` / the QA completion-evidence gate are already satisfied by artifacts describing the *voided* task. The new work can reach PASS without ever being reviewed. Mode-symmetric, so not a parity bug — but it is a gate bypass that this change creates and then advertises. At minimum the tool should refuse to void an id that has evidence artifacts, or `addTask` should refuse an id with pre-existing evidence; either way this needs a deliberate decision rather than silence.

### Verified sound — stated explicitly per the brief

1. **E112 live consequence — PASS in both modes (default regex).** File: the voided line no longer matches `DEFAULT_TASK_REGEX` (`tools/config.ts:100`, `/^- \[([ x])\] (\S+)\s+(.+)$/`), so `parseTasks` drops it and `getNextTaskFromFile`'s `result.tasks.find(t => !t.completed)` (`tools/tasks-file.ts:116`) skips to the next live row — executed and confirmed (`T-A` voided → next is `T-C`, `progress.total` 3 → 1). SQLite: the row is gone, `listTasks` cannot return it, `getNextTask` (`tools/storage-sqlite.ts:610`) iterates that list. Subject to C2.
3. **Marker safety — PASS against the real regex, not the claim.** `[-]` does not read as complete (`parseTaskLine`'s `match[1] === "x"` never sees `-`, because the line does not match at all). Not vibe drift — `tools/drift.ts` consumes `storage.listTasks` only (`:209`), no raw-text scan of tasks.md exists anywhere in the consumer set (confirmed: `listTasks`/`parseTasksFromFile` consumers are exactly `tools/drift.ts:209` and `tools/sync.ts:38`). Not promoted by `tw_sync` — same vocab. Id reuse works: `addTaskInFile`'s dup scan (`tools/tasks-file.ts:346-356`) uses `resolveTaskRegex`, so the `[-]` line is not a collision target — executed and confirmed.
4. **Mutating-tool obligations — PASS.** `voidTaskInFile` is structurally identical to `completeTaskInFile`: `withFileLock` on the sibling `.lock` (`:259`), `verifyFreshness(..., "tasks")` inside the lock (`:260`), `atomicWrite` tmp + `fs.renameSync` (`:293` → `:136`), `refreshSnapshotFor` after (`:294`). No second, divergent pattern. Confirmed live — the freshness guard fired correctly in testing when tasks.md was touched mid-flight.
5. **Registry/tool contract — PASS.** `defineTool` entry with matching `inputSchema`/`zodSchema` (`tools/registry.ts:627`), `VoidTaskInput` exported (`:347`), `enforcePreFlight(parsed.workspace_path, "tw_void_task")` first statement in the handler (`tools/tasks.ts:88`) matching every sibling. No new SCREAMING_SNAKE token is introduced — the error strings are prose, and `DELETE FROM` already appears in `tools/storage-sqlite.ts:333`, so `test/error-code-contract.test.mjs`'s harvest over `tools/` sees nothing new.
- **Mode parity for the remaining observers — PASS.** `progress.total` / drift counts / the `FAIL`-status incomplete-task count all derive from the same filtered list in both modes. `tools/gate-stats.ts` carries no task-id reference at all, so `tw_gate_stats` cannot observe the difference. The only parity break found is C3.

## Quality

### Q1 — Decision 3 ("not found" for an already-voided id) is weakly justified and loses recoverable information.

The stated rationale is "to avoid leaking void-state as an oracle". There is no threat model that supports this: every caller is a local, already-trusted agent that can `cat tasks.md` and read the `(voided: ...)` line directly. Nothing is being protected.

What it costs is real. The two sibling operations both distinguish "no such id" from "right id, wrong state" (`tools/tasks-file.ts:172` "is already completed" vs `:168` "not found"; `:221` "is not completed, cannot rollback"), and this change itself adds a third such distinction for the `[x]` case. Collapsing only the already-voided case into "not found" means a PM who voids the wrong id and retries, or who re-runs after a transient failure, gets an error indistinguishable from a typo. In file mode the correct answer is sitting on disk. Recommend returning a distinct "already voided" result in file mode; SQLite cannot until C3 is addressed.

### Q2 — Comments assert behaviour that the code does not enforce.

`tools/tasks-file.ts:253-260` and `tools/storage-sqlite.ts:299-305` both narrate the full invisibility argument as settled fact ("every reader ... treats the id as though it never existed"). C1 and C2 are both cases where the narration is true of the default configuration and false in general. The reasoning is good and worth keeping, but it should describe a guarded invariant rather than stand in for one.

### Q3 — Minor: `tools/registry.ts:631` claims a voided row "disappears from ... `tw_detect_drift`". Accurate, but as C1 shows, that disappearance is itself the hazard — the wording reads as a feature where it is at best a trade-off. Worth restating once C1 is guarded.

## Architecture

Correct layering, and the option (a)/(b) boundary is respected exactly. The call chain `registry → tasks.ts delegator → getActiveStorage() → {FileHandoffStorage, SqliteHandoffStorage}` mirrors `completeTask`/`rollbackTask` one-for-one, the interface member lands in `HandoffStorage` (`tools/storage.ts:74`) so both implementations are compelled to satisfy it, and no import DAG edge is added.

One architectural observation feeding C1: the change treats tasks.md as authoritative for completion state, while `tools/sync.ts` treats the handoff ledger as authoritative. Both cannot be right. The existing code is consistent on this point; the new guard is the sole exception.

Adding a required member to `HandoffStorage` is a breaking change for any third-party implementation, but both in-tree implementations are updated and the interface is not part of the published surface — acceptable.

No `specs/e117-void-task.md` or architecture spec exists; the backlog E117 row (`docs/backlog.md:239`) is the contract, and it names the acceptance point as the E112 live consequence — which is what C1/C2 turn on.

## Security

No new trust boundary is crossed. `workspace_path` goes through `absoluteWorkspacePath` and `task_id`/`reason` are non-empty strings; the SQLite path is fully parameterised (`tools/storage-sqlite.ts:308`), no string interpolation into SQL. `taskId` is passed through `escapeRegExp` (`tools/tasks-file.ts:286`) before regex construction, so a crafted id cannot inject a pattern. `reason` is interpolated into the replacement string at `:291` unescaped — benign here, because `String.replace`'s special sequences (`$&`, `$1`, …) are only interpreted in the *replacement*, and `reason` is part of it: a reason containing `$1` would expand the captured description into the file. Cosmetic corruption of a comment tail only, no escape from the line, but `$$`-escaping the reason (or using the replacer-function form) is nearly free.

The substantive security-adjacent finding is **C4**: id reuse after void inherits stale review/QA evidence, letting a re-cut task satisfy `MISSING_REVIEW_EVIDENCE` and the QA completion-evidence gate without being reviewed. For a server whose purpose is making review non-bypassable, that belongs in this section.

No secrets, no new I/O surface, no privilege change. The absence of an `agent_id` gate on `handleVoidTask` (`tools/tasks.ts:86`) is correctly reasoned and consistent with `tw_add_task`/`tw_rollback_task`.

## Performance

No findings. `voidTaskInFile` does one `parseTasks` + one `readFileSync` + one `atomicWrite` — byte-for-byte the cost profile of `completeTaskInFile`, with the same single-pass regex replace; no added complexity class. The SQLite path is a prepared-statement `DELETE` against the `(workspace_path, task_id)` primary key — O(log n), cheaper than the `UPDATE` siblings. `voidTaskStmt` is prepared once in the constructor alongside the others (`tools/storage-sqlite.ts:307`), not per call. No new allocation in a hot path, no unbatched I/O, no listener or cache growth.

## Verdict

**CHANGES_REQUESTED** — the option-(a) shape, the mutating-tool obligations and the registry contract are all correct, but two blocking defects remain: the Decision-2 guard reads the tasks.md mirror instead of the authoritative `handoff.completed_tasks` ledger, so voiding a ledger-completed task succeeds and permanently erases the drift signal rather than resolving it (C1, reproduced); and under a custom `taskPattern` the void reports `success: true` while `tw_get_next_task` keeps offering the row, leaving E112 silently unfixed (C2, reproduced).

### Handed forward, not a defect
`test/e26-gate-stats.test.mjs:469` asserts `TOOL_REGISTRY` has exactly 12 entries; it is 13 with `tw_void_task`. Expected red, qa-engineer's under §2 — recorded here, not filed against this diff.

---

## Round 2 — CHANGES_REQUESTED — by code-reviewer

## Summary

- Three files changed this round: `tools/tasks-file.ts`, `tools/storage-sqlite.ts`, `tools/registry.ts`. `tools/storage.ts` and `tools/tasks.ts` are byte-identical to round 1 — confirmed against the diff, not the claim.
- **C1 is genuinely fixed in BOTH modes** — reproduced live in file mode *and* SQLite. **C2 is genuinely fixed** — the round-1 custom-`taskPattern` repro now returns a loud refusal. **C4's mandatory part is done** — the tool description now states the stale-evidence risk honestly. **Q1 works as described** in both modes.
- **One new blocking defect, C5** — reproduced. A `reason` containing a newline makes `tw_void_task` return `{"success":true,"marked":"voided"}` while `tw_get_next_task` immediately re-offers the same id. That is *literally* the C2 failure mode — a success receipt over a row that is still live — surviving inside the round that was supposed to close it, because the C2 guard validates a **reconstructed** string rather than the string `String.replace` actually writes.
- The injection vector itself is pre-existing and codebase-wide (`completeTaskInFile`, `rollbackTaskInFile`, `addTaskInFile` all inject identically — verified). **That part is not E117's to fix.** What is in scope is that void is the only member of the family where the injection *defeats the operation itself* rather than merely adding garbage, and that the new guard structurally cannot see it.
- Round 1's clearances all hold: no option-(b) creep, mutating-tool obligations intact, registry/error-code contract intact.
- Verdict: **CHANGES_REQUESTED** — one narrowly-scoped finding.

## Correctness

### C1 — FIXED. Verified in both modes, including the degradation paths.

File mode (`tools/tasks-file.ts:328-339`) and SQLite mode (`tools/storage-sqlite.ts:694-709`) both now consult the ledger, with the identical word-boundary predicate that `tools/drift.ts:290` and `tools/sync.ts:63` use. Round-1 repro, re-run against the rebuilt `dist/`:

```
[file]   ledger lists T-B done, tasks.md row still [ ]
         void T-B -> {"error":"Task T-B is already completed and cannot be voided — roll it back first ..."}
[sqlite] parse.completed_tasks: ["T-B second task"]
         void T-B -> {"error":"Task T-B is already completed and cannot be voided — roll it back first ..."}
```

Both modes carry the guard. The drift signal survives.

**The ledger read cannot silently degrade the guard.** I tested the three failure paths the brief asked about:

| ledger state | result | assessment |
|---|---|---|
| no `.current/handoff.md` at all | void succeeds | **correct** — absent ledger *is* an empty ledger; nothing is completed |
| handoff present, malformed YAML | **throws** `Failed to parse handoff.md frontmatter: ...` | **correct** — loud, propagates out of `withFileLock`; no degradation to "not completed" |
| SQLite `handoff_state.completed` unparsable | throws out of `JSON.parse` (`tools/storage-sqlite.ts:423`), captured into the rejected promise by `handleVoidTask`'s async frame | **correct** — loud |

One residual, **informational, not a finding**: if `handoff.md` exists but has no `## Completed` / `## 完成` heading, `readAndMigrate` (`tools/handoff-parse.ts:203`) yields an empty `completed_tasks` and the guard silently degrades. Reproduced with a `## Done Items` heading — void succeeded on a row the body listed as done. This is *systemic*, not introduced here: `drift.ts` and `sync.ts` read through the same parser and are equally blind, so the guard is exactly as sighted as the rest of the system. Nothing for this ticket.

Placement is right: the `parseHandoff` call sits **inside** `withFileLock` (`:328`), and `parseHandoff` — unlike `readHandoffState` — does not call `markStateRead`, so the guard cannot accidentally satisfy the pre-flight check as a side effect. Checked deliberately.

### C2 — FIXED, and the stricter rule is the right call.

`tools/tasks-file.ts:346-360`. Round-1 repro re-run with `.current/.config.json` → `"taskPattern": "^- \\[(.)\\] (\\S+)\\s+(.+)$"`:

```
void T-A -> {"error":"Refusing to void T-A: the configured taskPattern still parses the voided line
             as a task (completed=false), so it would remain visible to tw_get_next_task,
             tw_detect_drift, and tw_sync. ..."}
next     -> {"next":{"id":"T-A",...}}   // correctly still offered — the void did not happen
```

Silent no-op → loud refusal with an actionable remedy. Exactly the ask.

**On "stricter than still-live":** the extra strictness is free and refuses nothing legitimate. `parseTaskLine` (`tools/tasks-file.ts:47`) computes `completed: match[1] === "x"`, and the marker char is always `-`, so *any* pattern that matches the voided line yields `completed: false`. The "or completed" arm of the stricter rule is unreachable in practice — it refuses precisely the same set as "still live," while stating the invariant more honestly ("must not parse at all"). No reasonable custom pattern is caught by the stricter rule that the weaker one would have allowed.

**On "a tool that cannot void anything under a valid config":** I tested the adjacent worry — a config that is valid but not `- [ ]`-shaped:

```
taskPattern "^\* \[([ x])\] (\S+)\s+(.+)$", tasks.md using "* [ ] T-A first task"
parse -> [{"id":"T-A",...}]              // config is valid, tasks parse fine
void  -> {"error":"Could not find an unchecked checkbox line for T-A."}
```

Void is impossible under that config — but so are `tw_complete_task` and `tw_rollback_task`, which hardcode the same `- [ ]` / `- [x]` write shape (`tools/tasks-file.ts:183`, `:234`). The whole task-mutation suite, not void, is what's unusable there. Pre-existing, codebase-wide, and loud. Not E117's defect and not a blocker.

### C5 — BLOCKING (new this round). A newline in `reason` returns `success: true` while leaving the id live and re-offered.

`tools/tasks-file.ts:346-362`. Reproduced end-to-end against `dist/`:

```
void T-A, reason = "oops\n- [ ] T-A resurrected task"
  -> {"success":true,"taskId":"T-A","marked":"voided","reason":"oops\n- [ ] T-A resurrected task"}
next
  -> {"next":{"id":"T-A","completed":false,"description":"resurrected task)","section":"Backlog"},
      "progress":{"completed":0,"total":3}}

tasks.md after:
  - [-] T-A first task (voided: oops
  - [ ] T-A resurrected task)
  - [ ] T-B second task
  - [ ] T-C third task
```

`T-A` was reported voided and is being offered again on the very next call. This is the C2 finding verbatim — *"void reports success but does not void"* — reproduced through a different door, in the round that added a guard specifically to make it impossible.

**Why the C2 guard cannot see it.** The guard validates a string the code builds by hand:

```ts
const replacementLine = `- [-] ${taskId}${match[1]} (voided: ${reason})`;   // :354  <- validated
...
content = content.replace(oldPattern, `- [-] ${taskId}$1 (voided: ${reason})`);  // :366 <- written
```

These are two different constructions of what is meant to be one line, and they diverge whenever `reason` is not inert:

1. **Newlines.** `parseTaskLine` runs `DEFAULT_TASK_REGEX`, which carries **no `m` flag**, so `^…$` bind to the whole string. A multi-line candidate can never match, so `reparsed` is `null` and the guard passes — then `atomicWrite` writes both lines, the second of which parses as a live task on its own.
2. **`$`-expansion.** The written form goes through `String.replace`'s replacement grammar; the validated form does not. Reproduced:
   ```
   reason "see $& and $1" -> - [-] T-B second task (voided: see - [ ] T-B second task and  second task)
   ```
   Harmless under the default anchored regex (the injected text is mid-line), but it is direct proof that the guard is not inspecting the artifact it guards.

Round 1 examined this exact line and graded it *"cosmetic corruption of a comment tail only, no escape from the line."* **That grading was wrong** — a newline is precisely an escape from the line. I am correcting my own round-1 error, not raising a new bar: the code is unchanged at `:366` and the defect was present in round 1's diff.

**Scope — read this before fixing.** The injection vector is pre-existing and *not* E117's to repair. Verified against the siblings:

```
rollbackTaskInFile reason "oops\n- [ ] T-EVIL injected"     -> row injected
completeTaskInFile note   "n\n- [ ] T-EVIL2 x"              -> row injected
addTaskInFile      desc   "d\n- [ ] T-EVIL3 y"              -> row injected
```

For those three the intended state change still lands correctly and the injected row is inert garbage. **Void is the only one where the injection defeats the operation** — the id stays live, so the tool's entire contract is violated while it reports success. That asymmetry is what makes it in scope here and a separate backlog row for the other three.

Smallest correct in-scope fix: assert the *post-write* invariant instead of a reconstruction — build the new content, re-run `parseTasksFromFile`-equivalent parsing over it, and refuse if `taskId` still resolves to a task. That subsumes the current C2 check, closes the newline and `$`-expansion paths together, and costs one extra parse on a cold path. (Rejecting `/[\r\n]/` in `reason` at the zod schema also works and is smaller, but only covers the newline half.) SQLite mode is unaffected — parameterised SQL, and `reason` is not persisted at all (that is C3).

Secondary consequence worth noting: in the injected state a re-void returns `{"success":true}` a second time (it voids the resurrected row), so the Q1 marker scan and the void operation both become non-idempotent. Fixing C5 fixes this too.

### C3 — correctly left alone.

Not re-filed. I independently looked for a schema-change-free durable target in SQLite and agree there isn't one: `reports` is keyed to review/QA evidence and reusing it would corrupt the very gates C4 is about, and `handoff_state.pending` is feature-scoped and transient. A `tasks`-table column is the option-(b) surface that was rejected. The assessment is honest.

### C4 — the mandatory part is done, and the description is honest.

`tools/registry.ts:628-636` now reads:

> "Its id becomes structurally reusable in a re-cut, but review/QA evidence gates are existence-based and not void-aware: a re-cut under the SAME id can inherit the voided row's stale evidence artifacts and skip real review. Prefer a fresh id for unrelated work."

It names the mechanism (existence-based, not void-aware), the consequence (inherits stale evidence, skips real review), and the mitigation. It no longer bare-advertises reuse as a clean capability. Accepted. The `gates/` fix belongs on its own row, as instructed.

Round-1 **Q3** is resolved as a side effect: "disappears from `tw_detect_drift`" was flagged as reading like a feature where it was a hazard; now that C1 guards the ledger-completed case, the statement is simply accurate.

## Quality

### Q4 — NON-BLOCKING. The mode asymmetry is defensible but undocumented at the only surface a caller sees.

Confirmed live:

```
[file]   re-void       -> {"error":"Task T-A was already voided and cannot be voided again.","alreadyVoided":true}
[file]   never existed -> {"error":"Task T-ZZZ not found."}
[sqlite] re-void       -> {"error":"Task T-A not found."}
[sqlite] never existed -> {"error":"Task T-ZZZ not found."}
```

The asymmetry is **not** the C3 class, and the difference is not cosmetic. C3 is a *silent* divergence: SQLite returns `success: true` and a required argument vanishes with no durable trace — the caller is told the operation fully succeeded when part of it did not happen. Here both modes return an **error**, neither claims success, and they differ only in the *specificity* of a refusal. Every caller in both modes correctly learns "your void did not happen." The worst outcome is a less informative message. Different severity class, and acceptable.

It is also, whether or not by design, oriented correctly against the only threat model that could exist. The round-1 "oracle" worry is only meaningful for a caller who cannot read the workspace filesystem — i.e. a remote HTTP client. HTTP mode *is* SQLite mode, and SQLite mode is the one that does **not** distinguish. File mode, where the distinction was added, is by definition a caller with local fs access who can `cat tasks.md` and read the `(voided: …)` line. The informative behaviour exists exactly where it leaks nothing.

**What is missing is the documentation.** The tool description (`tools/registry.ts:628-636`) is the only surface an MCP client ever sees, and it says nothing about `alreadyVoided` or its mode-dependence. Worse, `tools/storage.ts:70-76` — the interface contract both implementations are written against — still asserts the pre-reversal behaviour:

> "A voided (or unknown) task id is reported as not-found by every read path"

That sentence is now false for file-mode `voidTask` and was not updated when the behaviour changed. A client branching on `alreadyVoided: true` will behave differently under an HTTP deployment with no warning anywhere in the tree. One clause in the tool description plus a corrected interface comment closes it. **Fold into the C5 round; not blocking on its own.**

### Q5 — NON-BLOCKING. The fixed marker scan is coherent. It is not C2 returning.

Asked directly, answered plainly: **genuinely different, and the inversion matters.**

- **C2's defect** was a **hardcoded write** consumed by a **config-driven read** (`parseTaskLine` via `resolveTaskRegex`). Two independent parties, able to disagree — and they did. The fix correctly made the writer consult the reader's config.
- **The Q1 scan** (`tools/tasks-file.ts:313`) has the tool read back **its own** hardcoded marker. Writer and reader are the same literal by construction and cannot disagree for any value of `taskPattern`.

Making this scan config-aware would be actively wrong. The voided line is, by design, the one line in the file the configured pattern must **not** match; the configured pattern is therefore the single tool guaranteed unable to find it. A fixed scan is the only thing that can work here.

So the surface shape — "hardcoded read beside a config-aware write" — resembles C2, but it is the mirror image: C2 was a hardcoded *write* consumed by a config-aware *read*. Not the same defect.

One real seam, minor: the scan is anchored (`^- \[-\] `, `:313`) while `oldPattern` is not (`:341` — no `^`). An indented row written unanchored would not be found by the anchored read-back. Unreachable under the default regex (`DEFAULT_TASK_REGEX` is itself `^`-anchored, so an indented line is never a task and never reaches the write), and the C2 guard would refuse most custom patterns that permit it. Anchor `oldPattern` for symmetry when convenient.

### Q6 — The round-1 Q1 reversal is sound on its merits, and my round-1 position was the weaker one.

The round-1 rationale asserted a confidentiality property without ever naming an adversary. In file mode there is none: the caller supplies an absolute `workspace_path`, has already read `tasks.md` through this very tool, and can read the `(voided: …)` line directly. Nothing was being protected.

The cost was real. Both sibling operations distinguish "right id, wrong state" from "no such id" (`tools/tasks-file.ts:172` "is already completed" vs `:168` "not found"; `:221` "is not completed, cannot rollback"), and this change itself adds a third such distinction for the `[x]` case. Collapsing only the already-voided case into "not found" made void the sole inconsistent member of its own family, and left a PM who mistypes an id — or retries after a transient failure — with an error indistinguishable from a typo, while the answer sat on disk. The reversal restores family consistency and costs nothing. Accepted without reservation.

### Q7 — Round 1's Q2 is addressed.

The doc comments (`tools/tasks-file.ts:251-280`, `tools/storage-sqlite.ts:306-313`) no longer narrate invisibility as settled fact; they now describe guarded invariants and cite which guard enforces which. The rewrite is long but earns its length — it records *why* the ledger is authoritative and why the config re-parse exists, which is the part a future reader will need. Good.

## Architecture

Unchanged from round 1 and still correct. The call chain `registry → tasks.ts delegator → getActiveStorage() → {File,Sqlite}` mirrors `completeTask`/`rollbackTask` one-for-one; no import DAG edge added beyond `tools/tasks-file.ts → tools/handoff-parse.js`, which is a read-only dependency on an already-lower layer (`tools/sync.ts` and `tools/drift.ts` both already depend on it) — no cycle, no inversion.

Round 1's architectural observation is now **resolved**: the change previously treated `tasks.md` as authoritative for completion while `tools/sync.ts` treats the handoff ledger as authoritative. Both guards now read the ledger, so the codebase is internally consistent on this point again.

**Option-(a)/(b) boundary re-verified this round, not assumed:**

| round-1 clearance | round-2 status |
|---|---|
| `TaskRecord` (`tools/tasks-file.ts:33`) untouched | holds — not in the diff |
| `parseTaskLine` untouched | holds — consumed, not modified |
| SQLite `tasks` table gains no column | holds — only a new prepared `DELETE`; no `ALTER`, no `CREATE` change |
| no `schema_version` bump | holds — no `schema/` file in the diff; `CURRENT_VERSIONS` unchanged |

No creep toward the rejected design.

**Mutating-tool obligations — re-verified, all four intact** (`tools/tasks-file.ts`): `withFileLock` on the sibling `.lock` (`:288`), `verifyFreshness(..., "tasks")` inside the lock (`:289`), `atomicWrite` tmp + `fs.renameSync` (`:368` → `:142`), `refreshSnapshotFor` after (`:369`). The new ledger read is correctly *inside* the lock and takes no second lock, so no deadlock against the handoff `.lock`.

## Security

`workspace_path` still goes through `absoluteWorkspacePath`; `task_id` / `reason` remain `z.string().min(1)`. SQLite is fully parameterised (`tools/storage-sqlite.ts:315`) — no interpolation, and C5 does not reach it. `taskId` is `escapeRegExp`'d before every regex construction (`:313`, `:330`, `:341`), so a crafted id cannot inject a pattern; the new ledger predicate at `:330` correctly escapes too, as does its SQLite twin (`tools/storage-sqlite.ts:27`).

**C5 is the security-relevant finding of this round** and is written up under Correctness because its primary consequence is a correctness contract violation, not a confidentiality one. Framed as a trust-boundary question: `reason` is free text that crosses from an untrusted caller into a governed artifact with no sanitisation, and the only validation standing between it and `tasks.md` inspects a different string. For a server whose purpose is that governance state cannot be quietly falsified, "an agent can forge a live task row, and resurrect the row it just claimed to void, by putting a newline in a free-text field" belongs here. The vector is pre-existing across four call sites; the *exploitable-into-a-false-success* consequence is specific to void.

Round-1's C4 (id reuse inheriting stale evidence) is unchanged in the code and now honestly disclosed in the tool description, with the structural fix deferred to its own row — the correct disposition for this cut.

## Performance

No findings, and no regression against round 1. The added work is one `parseHandoff` (a `readFileSync` + one YAML parse of the frontmatter) and one `parseTaskLine` call per void — both on a cold, human-initiated, once-per-mis-cut path already dominated by `parseTasks` + `readFileSync` + `atomicWrite` under a file lock. SQLite adds one `this.parse()` (single indexed row fetch + two `JSON.parse`) before an O(log n) primary-key `DELETE`; `voidTaskStmt` is still prepared once in the constructor (`tools/storage-sqlite.ts:314`), not per call. No new allocation in a hot path, no unbatched I/O, no listener or cache growth. The C5 fix I recommend adds one more parse on the same cold path — still free.

## Verdict

**CHANGES_REQUESTED** — C1, C2 and C4's mandatory part are all genuinely fixed and verified by execution in both storage modes, and the Q1 reversal is sound (my round-1 position was the weaker one). But `tw_void_task` still returns `{"success":true,"marked":"voided"}` for a `reason` containing a newline while `tw_get_next_task` immediately re-offers the same id — the exact C2 failure mode, reproduced, surviving because the new guard validates a hand-rebuilt string rather than the one `String.replace` actually writes.

**Scope for round 3 — this and nothing else:**
1. **C5 (blocking)** — make the void guard assert the post-write invariant ("after this write, `taskId` must not parse as a task") over the real content, rather than over `replacementLine`. Do **not** fix the sibling call sites (`completeTaskInFile` / `rollbackTaskInFile` / `addTaskInFile`); that vector is pre-existing and belongs on its own backlog row, alongside C4's `gates/` fix.
2. **Q4 (fold in, non-blocking)** — one clause in the `tw_void_task` description disclosing that `alreadyVoided` is file-mode only, and correct the now-false sentence in `tools/storage.ts:70-76`.
3. Optional: anchor `oldPattern` at `:341` for symmetry with the `:313` read-back.

### Handed forward, not a defect
`test/e26-gate-stats.test.mjs:469` (`TOOL_REGISTRY` 12 → 13) is still the sole red across the suite — `npm test` this round: **1814/1815**, `npx tsc --noEmit` clean, `npm run build` clean. Expected red, qa-engineer's under §2. Re-recorded here, not filed against this diff.

---

## Round 3 — APPROVED — by code-reviewer

## Summary

- Round 3 touches three files as declared: `tools/tasks-file.ts` (`voidTaskInFile`, the C5 guard + doc rewrite), `tools/registry.ts` (tool description), `tools/storage.ts` (interface doc comment). Siblings verified untouched by diff; `tools/storage-sqlite.ts` and `tools/tasks.ts` carry only round-1/2 content.
- **C5 is genuinely fixed.** The asserted artifact is the real one: `newContent` is the exact string handed to `atomicWrite`, not a reconstruction. Re-verified by execution, including a compound case sr-engineer did not test (newline + `$&`, which the guard catches).
- **Q4 both corrections are honest.** I checked each claim against live behaviour in both modes rather than reading them.
- **No regression in rounds 1–2.** C1 (both modes), C2, Q1, the `[x]` refusal, option-(a) scope, the four mutating-tool obligations, and the registry/error-code contract all re-verified.
- **C6 (new, NON-BLOCKING): sr-engineer's `$`-expansion premise is factually wrong** — `` $` `` and `$'` *do* escape the single line and duplicate real task rows. It does not block, because by round 2's own stated in-scope criterion it is the pre-existing sibling class. It must widen the backlog row round 2 opened, which currently names only the newline half.
- Verdict: **APPROVED**.

## Correctness

### C5 — FIXED. Verified against the real write path, not the claim.

`tools/tasks-file.ts:309-322`. The three things I was asked to confirm:

**1. It is genuinely the real content.** `:309` builds `newContent` with `content.replace(oldPattern, ...)`, and `:323` passes *that same binding* to `atomicWrite`. There is no second construction and no re-derivation between the assertion and the write. This is the structural difference from round 2, where `replacementLine` (`:354`) and the written replacement (`:366`) were two independent strings. Correct fix, correctly placed.

The re-parse is also faithful to how the file is actually read: `newContent.split("\n")` + `parseTaskLine(line.trim(), …, resolveTaskRegex(workspacePath))` mirrors `parseTasks` (`:79-90`) line for line, and uses the *configured* pattern, so it cannot regress C2. It is marginally **stricter** than `parseTasks` — the guard does not `continue` on `^##` section headings — which is the safe direction (no false negative).

**2. The refusal path leaves the file untouched.** Confirmed, and confirmed by a stronger signal than a byte-compare: `atomicWrite` unconditionally prepends the `schema_version` sentinel (`:142-148`), so *any* write is self-evident in the output. On every refusal the file came back with no sentinel at all — i.e. `atomicWrite` was never reached.

```
REPRO 1 — void T-A, reason = "oops\n<marker> T-A resurrected task"
  -> {"error":"Refusing to void T-A: the resulting task list would still contain a parseable task line for T-A ..."}
  next -> {"next":{"id":"T-A",...}}          <- id still offered, as required
  tasks.md -> no sentinel, byte-identical to input
```

**3. The round-2 C2 property still holds through the new path.** Re-run with `taskPattern` set to `^- \[([ x-])\] (\S+)\s+(.+)$` (a custom pattern whose checkmark class also matches the `-` void marker):

```
C2 custom pattern -> {"error":"Refusing to void T-A: ..."}
wrote anything?   -> no (file untouched)
```

C2 is not merely preserved, it is now enforced by a strictly more general rule. The round-2 check asked "does the voided line still parse?"; the round-3 check asks "does *any* line still parse as `taskId`?". The former is a subset.

I also probed two boundaries the fix was not written for, and it holds on both:

```
P8  newline + $&  (reason = "a\n$&", which reconstructs T-A's own row verbatim on a new line)
    -> REFUSED, file untouched                      <- the compound escape is closed
P11 decoy: an earlier prose line "<marker> T-Z see <marker> T-A mentioned in prose" makes the
    unanchored oldPattern (:295, the round-2 Q5 seam) match the WRONG line first
    -> REFUSED, file untouched                      <- previously a silent wrong-line write
```

P11 is worth naming: the Q5 seam I flagged as "minor, anchor when convenient" is now *defused* by the C5 guard, because a wrong-line replacement leaves the real row live and the guard sees it. The guard converted a silent no-op into a loud refusal. That is the behaviour the doc comment claims (`:246`, "a silent no-op is worse than a loud refusal here") and it is now true.

### C6 — NEW, NON-BLOCKING. `$`-expansion *does* reach beyond the single line. The question as posed rests on a false premise.

sr-engineer asked me to judge whether "succeeding with expanded garbage inlined on a single line" is acceptable, and offered `"see $& and $1"` as the repro. I re-ran it and it reproduces exactly as described:

```
REPRO 2 — void T-A, reason = "see $& and $1"
  -> {"success":true,...}
  tasks.md -> - [-] T-A first task (voided: see <marker> T-A first task and  first task)
  next     -> T-B                                   <- T-A correctly gone
```

**But `$&` and `$1` are the two benign members of `String.replace`'s replacement grammar, and they are the only two that were tested.** The grammar also has `` $` `` (everything *before* the match) and `$'` (everything *after* the match). Neither is confined to the matched line — both splice multi-line file content, newlines included, straight into the output:

```
P7  reason = "x $` y", file = [ T-B, T-A(target), T-C ]
    -> {"success":true}
    tasks.md:
      <marker> T-B second task
      - [-] T-A target task (voided: x # Tasks
      (blank)
      ## Backlog
      (blank)
      <marker> T-B second task            <- DUPLICATE real task row, parses as a live task
       y)
      <marker> T-C third task

P6  reason = "x $' y", file = [ T-A(target), T-B, T-C ]
    -> {"success":true}
    -> progress.total 3 -> 4, with T-B and T-C each duplicated into the file
```

So the direct answer to the question asked: **no, the expansion does not stay on one line, and the reason it appeared to is that only the two line-local expansions were exercised.** `` $` `` / `$'` duplicate arbitrary neighbouring task rows into `tasks.md` — the exact artifact this tool exists to keep clean — while returning `success: true`.

**Why this is nonetheless not a blocker.** Round 2 set the in-scope test explicitly, and I am going to hold myself to it rather than move it in the last round before the routing cap:

> "The injection vector is pre-existing and *not* E117's to repair… **Void is the only one where the injection defeats the operation** — the id stays live… That asymmetry is what makes it in scope here and a separate backlog row for the other three."

Under that criterion, C6 is out. In every case above — P3 through P7 — **void's own contract is satisfied**: `T-A` is voided, is not re-offered, and does not parse. The damage is entirely collateral to *other* rows, and `rollbackTaskInFile:242` and `completeTaskInFile:192` build their replacement strings the identical way, so they carry the identical `` $` ``/`$'` hole. This is one defect in three (now four) places, not an E117 defect. Blocking here would be me widening my own criterion after the builder met it.

**What must happen instead — and this is the part that is load-bearing.** The backlog row round 2 opened covers only the *newline* half of the injection class. It must be widened before it is filed, or the `$` half is lost:

- the class is **`reason`/`note`/`description` is interpreted as `String.replace` replacement-pattern syntax**, not just "an argument can contain a newline";
- it affects four call sites: `tools/tasks-file.ts:309` (void), `:242` (rollback), `:192` (complete), and `addTaskInFile`;
- the fix for the `$` half is one line per site — pass a replacer *function* instead of a replacement string, e.g. `content.replace(oldPattern, (_m, rest) => \`- [-] ${taskId}${rest} (voided: ${reason})\`)` — which removes the entire expansion grammar at zero risk;
- the newline half is separate and needs either argument rejection or serialisation-side escaping.

I considered requiring just the one-line `$` fix here, since it sits inside a line round 3 already edited. I am not, for the reason above — but I want it recorded that it was weighed and that the decision was about scope discipline, not about the defect being unreal.

For completeness, two further members of the same class I reproduced, both with `success: true`, both out of scope for the same reason:

```
P3  reason = "oops\n<marker> T-EVIL injected row"      -> tw_get_next_task then offers T-EVIL, a task nobody created
P4  reason = "oops\n<checked-marker> T-B second task"  -> a duplicate CHECKED row for T-B; progress.completed 0 -> 1
```

The C5 guard does not catch these because it tests `parsed.id === taskId` only. That scoping is correct for what C5 was raised to fix, and the doc comment (`:243-245`) and the refusal message both describe it accurately as being about `taskId` — no overclaim. Noted so the backlog row records the full blast radius.

### C1, C2, Q1, and the `[x]` refusal — all re-verified, no regression.

Round 3 rewrote the body of `voidTaskInFile`, so I re-ran round 2's acceptance rather than assuming it survived.

```
file   C1 ledger-completed (completed_tasks holds "T-A", tasks.md still unchecked)
       -> {"error":"Task T-A is already completed and cannot be voided — roll it back first ..."}
file   C1 ledger free-text ("T-A (note: done)")   -> same refusal      <- word-boundary match intact
file   C1 control (not completed)                 -> success
file   C2 custom taskPattern                      -> refused, file untouched
file   Q1 re-void                                 -> {"error":"... already voided ...","alreadyVoided":true}
file   Q1 never-existed                           -> {"error":"Task T-ZZZ not found."}
file   [x] row                                    -> {"error":"... already completed ..."}
sqlite C1 ledger-completed                        -> {"error":"... already completed ..."}
sqlite void / next / re-void / never-existed      -> success / T-B / not-found / not-found
sqlite id reusable after void (re-add T-A)        -> success
sqlite reason = "x $` y"                          -> inert (parameterised SQL, reason not persisted — C3, unchanged)
```

### Expected-red sampling — not armed.

The diff touches no test file, and the one red in the suite is explained and owned elsewhere (see Performance/Verdict). `qa_reports/expected-red_e117-void-task.txt` is correctly absent.

## Quality

### Q4 — FOLDED IN CORRECTLY. Both corrections are honest, checked against behaviour.

**(a) `tools/registry.ts:634-636`** now reads: *"File mode only: re-voiding an already-voided id is refused with an `alreadyVoided: true` flag distinguishing it from a plain not-found (the voided marker line is still on disk); SQLite/HTTP mode reports both cases as a uniform not-found, with no alreadyVoided distinction."*

Every clause matches the live matrix I captured above: file re-void carries the flag, file never-existed does not, and both SQLite cases return the same bare not-found. The mode-dependence is stated at the only surface an MCP client sees, which was precisely the Q4 gap. Accepted.

**(b) `tools/storage.ts:70-81`.** The false sentence — *"A voided (or unknown) task id is reported as not-found by every read path"* — is gone. The replacement scopes the invisibility claim to the read paths (`getNextTask`, `listTasks`, `tw_detect_drift`, `tw_sync`), then names `voidTask` as the one exception and restricts it to file mode. That is now an accurate description of the contract both implementations are written against, which is what an interface comment is for. Accepted.

Both corrections are narrow and neither reaches past documentation into behaviour — I checked the diff for exactly that.

### Q8 — MINOR, file-a-row. Two loud refusals are correct but under-explain themselves.

The C5 refusal message enumerates two causes ("the configured taskPattern still matches the voided line, or the reason text planted a new line"). Both P11 (decoy prose line matched first, via the unanchored `oldPattern` at `:295`) and P13 (two rows legitimately share one id) refuse with that message, and neither cause is in the list. P13 is the worse of the two: the id can then *never* be voided, and the message points the operator at `taskPattern` and at their own `reason`, when the actual fix is to deduplicate the rows. Refusing is right; the diagnosis is misleading. Cheap to improve, no behaviour change, not worth a round.

### Q9 — MINOR. Review-round identifiers are leaking into permanent source.

`tools/tasks-file.ts` now carries `C5 fix (round 3, replaces the round-2 C2 check)`, `C1:`, `Q1:`, and `tools/storage.ts:81` carries `see C3`. These resolve only against `review_reports/review_T-E117-01.md`, which the comment never names. The repo's own convention cites durable ids (`E36 split`, `E24`, `b8-external-ref-ledger`) that a reader can find. Either name the report file or restate the reason without the label. Cosmetic.

### Q10 — The doc comment is now ~50 lines for ~60 lines of code.

Round 2 (Q7) accepted the length because it recorded *why* the ledger is authoritative and why the config re-parse exists. Round 3 adds ~25 more lines, and the new block is the weakest of the three: the two-bullet explanation of how the round-2 check failed is review history, not code rationale, and it will read as noise to someone who never saw rounds 1–2. The invariant statement at `:241-247` is the part worth keeping. Not blocking; trim opportunistically.

## Architecture

Unchanged from rounds 1 and 2 and still correct. No new import edge in round 3 — `tools/tasks-file.ts → tools/handoff-parse.js` is the round-2 edge, still acyclic and still a read-only dependency on a lower layer. The call chain `registry → tasks.ts delegator → getActiveStorage() → {File,Sqlite}` continues to mirror `completeTask`/`rollbackTask` exactly.

**Option-(a) scope re-verified mechanically, not by assertion:**

```
TaskRecord / parseTaskLine / DEFAULT_TASK_REGEX in the +/- diff  -> only inside comment text, no code change
schema/ diff                                                     -> empty (no schema_version bump)
storage-sqlite.ts ALTER TABLE / ADD COLUMN / CREATE TABLE        -> empty (no tasks-table change)
```

No creep toward the rejected option (b) in round 3.

**The four mutating-tool obligations** (`CLAUDE.md`), re-read against `voidTaskInFile:236-327`: `withFileLock` on `${filePath}.lock` (`:236`), `verifyFreshness` inside the lock (`:237`), `atomicWrite` = tmp + `fs.renameSync` (`:323` → `:142-148`), `refreshSnapshotFor` (`:324`). `refreshSnapshotFor` is on the success path only, matching `completeTaskInFile:193` and `rollbackTaskInFile:244` — correct, since a refused void changes nothing to re-snapshot.

**Parallel-safety contract honoured.** `git status --porcelain` is empty for all five E111-held paths and for `docs/backlog.md`. The only `tasks.md` change is PM's two E117 rows.

## Security

C6 is the security-relevant finding of this round and is written up under Correctness. Summarising the posture rather than repeating it: `reason` crosses into a file-serialisation boundary uneseaped, and via `` $` ``/`$'` can duplicate arbitrary neighbouring content. The trust level is an authenticated local agent through an MCP tool, the same caller that already supplies `workspace_path` and can edit `tasks.md` directly, so this is an integrity-hygiene defect rather than a privilege boundary — which is consistent with how the identical hole in `rollbackTaskInFile` / `completeTaskInFile` has been carried. SQLite mode is unaffected (parameterised statements; `reason` is not persisted at all).

No new secrets, no new network or process boundary, no `eval`-class construct. `escapeRegExp` (`:150`) is applied to `taskId` at every one of the three sites that interpolate it into a `RegExp` (`:288` voided-marker scan, `:295` `oldPattern`, `:283` ledger match) — checked individually.

## Performance

No regression. The C5 guard adds one `String.replace`, one `split("\n")`, and one `parseTaskLine` per line over a file already fully read and parsed once in the same call — the second linear pass over a task list on the cold void path, which is not a hot path in any sense. No new I/O: `parseHandoff` (round 2) is the only added read and it is unchanged this round.

Suite timing is flat at ~63s.

## Verdict

**APPROVED** — C5 is fixed against the real write path and verified by execution including cases the builder did not test; Q4's two doc corrections are accurate; rounds 1–2 are intact in both storage modes; and the one genuinely new finding (C6) falls outside the in-scope criterion round 2 itself set, so it belongs on the backlog row rather than in a fourth round.

**Build state as I measured it:** `npx tsc --noEmit` exits 0. `npm test` is **1814/1815**, with a single failure — `test/e26-gate-stats.test.mjs` T2, `TOOL_REGISTRY has exactly 12 entries`, now 13 because `tw_void_task` is correctly registered. That assertion is a test-side count that must move with the feature, and `test/` is qa-engineer's under §2. `test/render-structure.test.mjs` is 10/10 green. I record, without it affecting this verdict, that round 3's handoff narrative reported this as "1811/1815, 3 pre-existing failures in `test/render-structure.test.mjs`", which was wrong on both the count and the attribution; the diff itself is unaffected, but the handoff's self-reported test numbers should not be taken on trust downstream.

### Handed forward, not a defect

- **C6 must widen the round-2 backlog row before it is filed** — the class is "mutator arguments are interpreted as `String.replace` replacement-pattern syntax", covering `tools/tasks-file.ts:309`, `:242`, `:192`, and `addTaskInFile`; the currently-drafted row names only the newline half. One-line fix per site (replacer function). See C6 for the exact shape.
- **C3** (SQLite discards `reason`) — unchanged, still correctly assessed as having no schema-change-free durable target.
- **C4** (a re-cut id inherits the voided incarnation's review/QA evidence) — the description-level mitigation is in; the `gates/` fix remains its own row.
- **Q8, Q9, Q10** — cosmetic, no round warranted.
- For qa-engineer: the coverage worth pinning beyond the obvious is the **refusal** side — REPRO 1, P8, P11, P13, and the C2 custom-`taskPattern` case all refuse *and must leave the file byte-untouched*. The sentinel-absence check is a cheap, precise assertion for "nothing was written".
