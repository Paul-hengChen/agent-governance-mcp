# QA review — T-REL4-02 (release-v4.0.0 doc-writer gap-list verification)

## Phase 0 — Claim
Single-role judge dispatch (Task-spawned, Constitution §3.1/§3.2). Verifying
doc-writer's update to `docs/schema-versions.md` against the five numbered
gaps in `specs/release-v4.0.0.md` → `## Out of Scope` → the
`docs/schema-versions.md update` bullet. doc-writer's work landed pre-history-
reset (commit `61a89dd`, now folded into `d298782` — the squash commit noted
in the assignment); the task row stayed `[ ]` because doc-writer cannot call
`tw_complete_task`. Working tree clean at HEAD, `release-v4.0.0` /
`release-engineer:In_Progress`, `hop_count` at cap (10) — per assignment,
this hop issues `tw_complete_task` only, no `tw_update_state` role-transition
write.

## Phase 0.5 — Expected-Red Diff
Skipped (no `qa_reports/expected-red_release-v4.0.0.txt` manifest declared;
`dispatch_mode` unset — feature mode).

## Phase 1 — Review

### Copy Audit Gate
N/A — doc-only ticket, no user-facing product strings.

### Visual Audit Gate
N/A — no visual literals.

## Phase 1.5 — Visual Compare
Skipped (no `design/release-v4.0.0.md`; `## Mode` not armed).

## Phase 3 — Tests
Skipped per dispatch brief: doc-verification task, do NOT create or modify
any test file. No test file created or modified.

## Phase 3.5 — AC Execution Log

Re-read `docs/schema-versions.md` in full and checked each of the five
numbered gaps in the spec's Out-of-Scope bullet against it, then verified the
doc's factual claims against source (`tools/tasks-lane-migrate.ts`,
`schema/versions.ts`, `tools/lane-paths.ts`).

**Gap 1 — "What gets versioned" Location table's `tasks` row.**
`docs/schema-versions.md:16` now reads:
```
| `tasks`   | `.current/<lane>/tasks.md` (the live ledger); root `tasks.md` (if present) is a v2 index read-only to `tw_*` | Leading HTML comment `<!-- schema_version: N -->` |
```
States the live ledger path and that root `tasks.md` is a read-only v2 index.
**Covered.**

**Gap 2 — "Tasks version history" table.**
`docs/schema-versions.md:24-29` adds a "### Tasks version history" table
(v1 baseline, v2 lane-local ledgers/e125a) — parallel in structure to the
existing "Handoff version history" table. Narrates what changed and why the
`CURRENT_VERSIONS.tasks` bump 1→2 happened. **Covered.**

**Gap 3 — v2 index shape description.**
`docs/schema-versions.md:86-93` ("### Tasks v2 index shape and `_primary`
forward migration (e125a)") spells out the `<!-- schema_version: 2 -->`
sentinel, the exact `TASKS_INDEX_NOTICE` text, and the reverse-run receipt
`.current/tasks-index-receipt.json`. Verified the notice string verbatim
against `tools/tasks-lane-migrate.ts:40-41`:
```
const TASKS_INDEX_NOTICE =
  "<!-- tasks_role: index — the tw_* ledger for lane _primary is .current/_primary/tasks.md (E125a); tw_* never writes this file -->";
```
matches `docs/schema-versions.md:92` exactly, including the em dash and
punctuation. **Covered.**

**Gap 4 — `_primary` forward migration description, and the stamp-version
discrepancy to adjudicate.**
`docs/schema-versions.md:100-103` describes the three forward-migration
steps (copy body into `.current/_primary/tasks.md`, re-stamp legacy root as
v2 index, write the receipt) and explicitly says the lane ledger copy is
**"stamped v2"** (line 101: "Copies the root `tasks.md` body into
`.current/_primary/tasks.md` (stamped v2)").

The spec's own gap-4 text (`specs/release-v4.0.0.md` Out-of-Scope, item 4)
says the opposite — "stamped v1 — the ledger". Adjudicated against the
actual migration code:

`tools/tasks-lane-migrate.ts:288-295` (`migratePrimaryForward`):
```ts
function migratePrimaryForward(workspacePath: string, legacyPath: string, laneTasksPath: string, body: string): void {
  const split = splitLines(body);
  const { rest, closedLanes } = peelClosedLanes(split.lines);
  const ledgerBody = closedLanes.length === 0 ? body : joinCanonical(trimTrailingBlank(rest));
  atomicWriteRaw(laneTasksPath, currentSentinel() + ledgerBody);
  atomicWriteRaw(receiptPath(workspacePath), `${JSON.stringify({ bodySha256: primaryIndexReceiptSha(body) })}\n`);
  atomicWriteRaw(legacyPath, `${currentSentinel()}${TASKS_INDEX_NOTICE}\n${body}`);
}
```
Both the lane ledger (`laneTasksPath`) and the re-stamped legacy root
(`legacyPath`) are written with the **same** `currentSentinel()` helper
(`tools/tasks-lane-migrate.ts:67-68`):
```ts
function currentSentinel(): string {
  return `<!-- schema_version: ${CURRENT_VERSIONS.tasks} -->\n`;
}
```
and `CURRENT_VERSIONS.tasks` is `2` (`schema/versions.ts:9`: `tasks: 2,`).
There is no separate "v1" sentinel constant used anywhere in
`migratePrimaryForward` — `V1_SENTINEL` (`tools/tasks-lane-migrate.ts:487`)
is used only by the reverse migration (`migratePrimaryReverse`) when
restoring the legacy file to its pre-E125a shape, not by the forward path.

**Finding: the code stamps the `_primary` lane ledger v2, not v1.**
`docs/schema-versions.md`'s "stamped v2" claim is factually correct; the
mismatch is in the spec's own gap-4 wording ("stamped v1"), which is stale
relative to the code it cites. This is not a defect in the doc under review
— doc-writer's text already matches source. **Covered, doc is correct.**

**Gap 5 — git-ignored lane path exception (option A).**
`docs/schema-versions.md:111-119` ("### Option A: git-ignored lane path
exception") states the skip conditions, the advisory line, and the
`git check-ignore -q` mechanism. Verified against source:
- Advisory string (`tools/tasks-lane-migrate.ts:46`):
  ``tasks ledger: ${lanePath} is git-ignored in this workspace — lane-local migration skipped; ${legacyPath} remains the tw_* ledger (E125a option A)`` —
  matches `docs/schema-versions.md:117` verbatim.
- Mechanism comment (`tools/tasks-lane-migrate.ts:331`): "true iff
  `git check-ignore -q <lanePath>` exits 0 in `workspacePath`" — matches
  `docs/schema-versions.md:119`'s "read-only `git check-ignore -q`" claim.
- `docs/schema-versions.md:119`'s closing claim that both branches "route
  through the same `resolveTasksLedgerPath` logic" is confirmed: every
  `tw_*`-facing call site in `tools/tasks-file.ts` (lines 116, 379, 458,
  592, 772) resolves the ledger path via
  `resolveTasksLedgerPath(workspacePath, laneTasksPath)`
  (`tools/tasks-lane-migrate.ts:360`), with no separate code path for the
  option-A case.
**Covered.**

### Additional factual spot-checks (beyond the five numbered gaps)
- The doc's claim (line 88) that `tw_add_task`, `tw_complete_task`,
  `tw_rollback_task`, `tw_void_task`, `tw_sync` read/write only the
  lane-local ledger post-migration is consistent with every call site
  routing through `resolveTasksLedgerPath` (checked above) — no tool bypasses
  it to touch the legacy root file directly.
- No other discrepancy found between `docs/schema-versions.md`'s tasks-
  related sections and `tools/tasks-lane-migrate.ts` / `schema/versions.ts`
  / `tools/lane-paths.ts`.

## Phase 4 — Run / Verdict

All five numbered gaps from `specs/release-v4.0.0.md`'s Out-of-Scope bullet
are closed by doc-writer's update to `docs/schema-versions.md`. The one
discrepancy flagged for adjudication (gap 4's stamp version) resolves in the
doc's favor: the code (`tools/tasks-lane-migrate.ts` `migratePrimaryForward`,
`currentSentinel()` + `CURRENT_VERSIONS.tasks = 2`) stamps the `_primary`
lane ledger **v2**, exactly as the doc states — the spec's gap-4 text
("stamped v1") is the stale side of that mismatch, not the doc.

**Verdict: PASS.** No doc fix required.

`tw_complete_task(task_id="T-REL4-02", agent_id="qa-engineer", ...)` issued
per assignment — no `tw_update_state` role-transition write (hop_count at
cap 10; current tuple `release-engineer:In_Progress` unchanged).

## 2026-09-27T00:00:00.000Z — PASS — by qa-engineer

PASS — all five numbered gaps in specs/release-v4.0.0.md's Out-of-Scope
docs/schema-versions.md bullet are closed by doc-writer's update: (1) tasks
Location row now names .current/<lane>/tasks.md as the live ledger + root as
a v2 index, (2) a Tasks version history table exists, (3) the v2 index shape
(sentinel, TASKS_INDEX_NOTICE verbatim, receipt file) is documented, (4) the
_primary forward migration is documented including the stamp version, (5)
the git-ignored option-A exception is documented. Adjudicated the spec's
gap-4 "stamped v1" vs the doc's "stamped v2" claim against
tools/tasks-lane-migrate.ts's migratePrimaryForward (both ledger and
re-stamped legacy file use currentSentinel() = CURRENT_VERSIONS.tasks = 2
per schema/versions.ts) — the doc is correct, the spec's own gap-4 wording is
stale. No other factual mismatch found (TASKS_INDEX_NOTICE text, receipt
content, git check-ignore -q mechanism, resolveTasksLedgerPath routing all
verified verbatim against source). Full detail:
qa_reports/archive/release-v4.0.0/review_T-REL4-02.md.
