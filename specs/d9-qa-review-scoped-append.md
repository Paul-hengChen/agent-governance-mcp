# d9-qa-review-scoped-append

## Problem Statement

When a qa-engineer writes `tw_update_state(status=PASS|FAIL, agent_id="qa-engineer",
qa_review="...")`, the server auto-records that review text to
`qa_reports/review_<id>.md` (file mode) / the `reports` table (SQLite mode) for
"the task(s) under review." The id list is currently computed in
`tools/handoff-orchestrator.ts` (~L337-341) as:

```js
let ids = parsed.completed_tasks;
if (ids.length === 0) {
  const all = storage.listTasks(parsed.workspace_path);
  ids = all ? all.filter((t) => !t.completed).map((t) => t.id) : [];
}
```

`completed_tasks` is legitimately empty on every FAIL write — the canonical
Escalation call format (Constitution §3, const-05-core-standards.md) never
sets `completed_tasks` on a `status=FAIL` write (nothing completed), and the
sibling `REVIEWER_COMPLETED_TASKS_REJECTED` gate enforces the same convention
for code-reviewer. So the `ids.length === 0` branch fires on **every FAIL
write that carries `qa_review`**, and falls back to "every task in
`tasks.md`/the tasks table that isn't marked complete" — i.e. every other
open ticket in the whole workspace, unrelated to the one under review.

This is confirmed by the actual D8 incident (2026-07-11): a qa-engineer FAIL
write reviewing `T-D8-02` (`"FAIL — full test suite regression... Details:
qa_reports/review_T-D8-02.md"`) was auto-appended verbatim to
`review_A11-12.md`, `review_T-ORM-02.md`, `review_T-ORM-03.md`,
`review_T-PCAG-{ARCH,GATE,SCHEMA,SOP}.md`, `review_T-PGAT-{01,02,03,04}.md`
(11 pre-existing, unrelated files — confirmed via `git stash show -p
stash@{0}`) plus two spuriously created files for other open-but-not-reviewed
D8 tasks. Both storage backends (`recordReviewInFile` in
`tools/evidence-file.ts` / `recordReview` in `tools/storage-sqlite.ts`)
faithfully record exactly the `taskIds` array they are given — the bug is
entirely upstream, in how `handoff-orchestrator.ts` computes that array. This
pollutes the evidence trail the PASS gate and `covers:` coverage index
(`buildCoverageIndex`) trust as ground truth.

## User Stories

- As a qa-engineer, I want my FAIL/PASS review stamp to land only on the
  task(s) I actually reviewed, so that I don't forge evidence for tickets I
  never looked at.
- As a release-engineer / PM, I want `qa_reports/review_<id>.md` to be a
  trustworthy per-task audit trail, so that the PASS gate and coverage index
  can't be silently corrupted by an unrelated FAIL round.

## Acceptance Criteria

- **AC1** — Given a `tw_update_state` write with `agent_id="qa-engineer"`,
  `status="FAIL"`, `qa_review` set, and `review_task_ids=["T-X"]` (with
  `completed_tasks` empty, as FAIL always has it), when the server processes
  the write, then the review text is recorded **only** for `T-X` — no other
  task's evidence file/row is touched, regardless of how many other tasks are
  open in the workspace.
- **AC2** — Given a `tw_update_state` write with `agent_id="qa-engineer"`,
  `status="PASS"`, `qa_review` set, `completed_tasks=["T-Y","T-Z"]`, and
  `review_task_ids` omitted, when the server processes the write, then the
  review text is recorded for exactly `T-Y` and `T-Z` (back-compat: PASS
  behavior is unchanged — `completed_tasks` alone still resolves the target
  set).
- **AC3** — Given a `tw_update_state` write with `agent_id="qa-engineer"`,
  `qa_review` set, and BOTH `review_task_ids` and `completed_tasks` empty
  (e.g. a FAIL write that forgot to name the reviewed task), when the server
  processes the write, then it is rejected with a new error code
  `QA_REVIEW_TARGET_REQUIRED` and **no** review text is recorded anywhere —
  the write must fail loud, not silently fan out to "every open task" (the
  old behavior) nor silently no-op-and-drop-the-evidence.
- **AC4** — Given a workspace with N open tasks (N > 1) and no `review_task_ids`/
  `completed_tasks` overlap between them and the reviewed task, when a
  qa-engineer FAIL write names exactly one reviewed task via
  `review_task_ids`, then a regression test asserts exactly 1 evidence
  file/row changes, not N — covering both file mode (`qa_reports/review_<id>.md`)
  and SQLite mode (`reports` table row count).
- **AC5** — Given the existing `hasEvidence`/`hasEvidenceInFile` PASS-gate
  read path and the `covers:` coverage-index fallback, when this fix ships,
  then neither is touched or altered — the bug and the fix are entirely on
  the write side (`handoff-orchestrator.ts`'s id-resolution), matching the
  backlog D9 scope note ("~3 files: auto-append target resolution, regression
  test, cleanup note").

## Copy / Strings

| string id | exact text (quote verbatim) | source |
|---|---|---|
| error.qa_review_target_required | `QA_REVIEW_TARGET_REQUIRED` | authored-here — new error code, follows the existing `SCREAMING_SNAKE_CASE` convention used by every other gate code in `gates/registry.ts` (e.g. `MISSING_EVIDENCE`, `AGENT_ID_REQUIRED`) |
| error.qa_review_target_required.hint | `A qa_review write must name the reviewed task(s) via review_task_ids (or completed_tasks on PASS) — it can no longer fall back to "every open task." Set review_task_ids=[<task-id>, ...] on the tw_update_state call.` | authored-here — mirrors the existing `hintStatic` style in `gates/registry.ts` (short imperative instruction naming the exact field to set) |

## Visual Tokens

| token id | property | value (quote verbatim) | source |
|---|---|---|---|
| N/A | — | — | feature has no visual literals (server-side field/logic fix, no UI) |

## Visual Widgets

| widget id | description | source-node |
|---|---|---|
| N/A | — | feature has no non-primitive widgets |

## Out of Scope

- Changing `recordReviewInFile` / SQLite `recordReview` themselves — both
  already faithfully record exactly the `taskIds` array passed in; no bug
  exists there (confirmed by reading `tools/evidence-file.ts` and the
  `recordReview` method in `tools/storage-sqlite.ts`).
- Changing `hasEvidenceInFile` / `hasEvidence` (the PASS-gate read path) or
  the `covers:` coverage-index fallback (`buildCoverageIndex` /
  `parseCoversIds`) — those are unaffected read-side mechanisms, not the
  write-side bug.
- Retroactively re-attributing or scrubbing the 11 polluted files from the
  D8 incident — see Dependencies/Prerequisites below; this is a housekeeping
  decision, not an engineering task in this cut.
- Extending `review_task_ids` to the code-reviewer's `recordCodeReview` path
  (`review_reports/`) — the D8 incident and this backlog row are qa_review-
  specific; the code-reviewer path already scopes correctly today (no report
  of an equivalent code-reviewer fan-out) and is not touched here. Flag as
  future follow-up if the same fallback pattern is ever found there.

## Dependencies / Prerequisites

- **Root cause, verified against the actual incident**: the fallback at
  `tools/handoff-orchestrator.ts` ~L337-341 (`if (ids.length === 0) { ... }`)
  treats "no explicit task ids on this write" as "broadcast to every
  incomplete task in the workspace." Verified against `git stash show -p
  stash@{0}` (the parked D8 pollution diff) and `.current/telemetry.jsonl` /
  `qa_reports/review_A11-12.md` git-stash content, which show the exact FAIL
  text for `T-D8-02` duplicated verbatim into 11 unrelated review files. This
  is a code-level confirmation, not a hypothesis.
- **New field**: `review_task_ids: z.array(z.string().max(500)).max(200).optional()`
  added to `UpdateStateArgs` in `tools/registry.ts` (same shape/limits as
  `completed_tasks`), and to the tool's JSON Schema input definition. It is a
  transient, write-scoped field (like `next_role`/`resume_of`/`review_verdict`
  — c9-protocol-fields convention): consumed only by the id-resolution logic
  in `handoff-orchestrator.ts`, never persisted/carried across writes.
- **Cleanup decision (housekeeping, not a cut ticket)**: the 11-file D8
  pollution diff is parked, uncommitted, in `git stash@{0}` — it has not
  touched the working tree or any commit. The two spuriously-created files
  (`review_T-D8-REL.md`, `review_T-D8-DONE.md`) do **not** currently exist in
  the working tree (verified: `ls qa_reports/ | grep D8` returns nothing) —
  they were never captured by the stash (plain `git stash` does not capture
  untracked files) and are already gone. Recommendation, presented to the
  human for confirmation rather than cut as an engineering task: once this
  fix ships, `git stash drop stash@{0}` — the pollution is inert (uncommitted,
  never pushed) and re-deriving "what SHOULD review_T-ORM-02.md etc. contain"
  from the stash is not useful once the fan-out bug is fixed. No task cut for
  this — it is a one-line git op with no code path, not sr-engineer/qa-engineer
  work.
- **Escalation-call-format cross-reference**: `content/skill-qa-engineer.md`
  (Phase 4 FAIL step, ~L78, and the canonical-format note ~L82) must be
  updated to instruct the qa-engineer to set `review_task_ids=[<task-id>]`
  (or the batch's ids) on its `qa_review`-bearing `tw_update_state` write —
  this is additive to the existing canonical Escalation call format
  (Constitution §3 / const-05-core-standards.md), not a change to that
  general-purpose format, since `review_task_ids` is QA-evidence-specific
  (mirrors how `visual_fail:`/`covers:` are also QA-evidence-specific
  addenda, not general escalation-format fields).
