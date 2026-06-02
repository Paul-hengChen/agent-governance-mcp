# Spec: drift-archived-task-exclusion

## Problem Statement

`tools/drift.ts` calls `storage.listTasks()` which returns every task in `tasks.md` regardless of H2 section. It then feeds all `[x]` tasks — including those already moved to the `## Completed` archive section — into the completed-task comparison against `handoff.completed_tasks`. In long-running dogfooding repos (and any project where `tw_complete_task` has migrated items to `## Completed`), this produces false-positive drift reports of the form "Task list shows TNN completed, but handoff state doesn't mention it." for every archived task. The current dogfooding repo has 161 such tasks (T01–T469) permanently misfired as drift after each session, polluting the drift report with noise and wasting ~500+ tokens per call.

## User Stories

- As a coordinator agent running `tw_detect_drift`, I want archived tasks in `## Completed` to be silently excluded from drift comparison, so that a clean project produces "No drift detected" rather than hundreds of spurious vibe-coding-drift lines.
- As a sr-engineer, I want tasks that are `[x]` in `## Active` but not acknowledged in handoff to still surface as drift, so that genuine vibe-coding drift is not silently swallowed.
- As a workspace maintainer with a legacy `tasks.md` that has no `## Active` / `## Completed` sections, I want drift behaviour to remain unchanged (whole file is treated as active), so that upgrading the server does not break existing workspaces.

## Acceptance Criteria

**AC-1 — Archived tasks excluded from drift comparison**

Given a `tasks.md` that contains a `## Completed` H2 section,  
When `tw_detect_drift` is called,  
Then tasks that appear under `## Completed` (and only there) are NOT included in `completedTasks` fed to the drift comparison, and no "completed in task list but not in handoff" drift line is generated for them.

**AC-2 — Active `[x]` tasks still surface as drift**

Given a `tasks.md` with both `## Active` and `## Completed` sections, where a task `TNN` is marked `[x]` inside `## Active` and is NOT in handoff `completed_tasks`,  
When `tw_detect_drift` is called,  
Then a drift line is emitted for `TNN` (possible vibe-coding drift).

**AC-3 — Backward compatibility: no sections → full-file behaviour preserved**

Given a `tasks.md` with no `## Active` and no `## Completed` H2 headings (legacy format),  
When `tw_detect_drift` is called,  
Then all `[x]` tasks across the entire file are included in the drift comparison (existing behaviour unchanged).

**AC-4 — Backward compatibility: `## Active` only, no `## Completed` → full-file behaviour preserved**

Given a `tasks.md` that has a `## Active` section but no `## Completed` section,  
When `tw_detect_drift` is called,  
Then all `[x]` tasks are included (same as AC-3; archiving has not yet occurred).

**AC-5 — `## Incomplete` in report reflects only Active-section tasks**

Given a `tasks.md` with `## Active` (containing some `[ ]` tasks) and `## Completed` (containing `[x]` tasks),  
When `tw_detect_drift` returns its JSON,  
Then `tasksIncomplete` contains only the uncompleted tasks from `## Active`, and `tasksCompleted` reflects only the Active-section `[x]` tasks (not the archived ones).

**AC-6 — Section heading matching: case-insensitive, leading/trailing whitespace trimmed**

Given H2 headings written as `## active`, `##  Active  `, `## COMPLETED`, or `## Completed`,  
When the section-filter logic runs,  
Then all are matched correctly (Active → treated as active scope; Completed → treated as archive). The match uses `.trim().toLowerCase()` on the captured heading text, consistent with `tasks-file.ts` line 85 (`/^##\s+(.+)/` → `sectionMatch[1].trim()`).

**AC-7 — Tasks under H2 sections other than Active/Completed are treated as active (conservative)**

Given a `tasks.md` with `## Active`, `## Completed`, and a third section `## Sprint-3`,  
When `tw_detect_drift` runs,  
Then tasks under `## Sprint-3` are included in the comparison (treated as active, not archived), so no active drift is silently dropped due to an unknown section name.

**AC-8 — No schema_version bump required**

The `## Completed` section is already emitted by `tw_complete_task` (existing `tasks-file.ts` behaviour). This fix is a read-time filter change only; no on-disk format changes, no migration, no `schema_version` increment.

**AC-9 — Other drift types unaffected**

Version-skew drift (handled by `checkVersionSkew`), handoff-ahead drift ("Handoff says TNN completed but task list shows it as incomplete"), and FAIL/Blocked-status drift are not altered by this change.

## Copy / Strings

No user-facing strings are introduced or changed. Drift report message templates in `drift.ts` are unchanged. This spec introduces no new copy.

| string id | exact text | source |
|-----------|-----------|--------|
| N/A | — | feature introduces no user-facing strings |

## Visual Tokens

No UI changes. This is a server-side TypeScript logic fix with no visual surface.

| token id | property | value | source |
|----------|----------|-------|--------|
| N/A | — | — | feature has no visual tokens |

## Visual Widgets

| widget id | description | source-node |
|-----------|-------------|-------------|
| N/A | — | feature has no non-primitive widgets |

## Out of Scope

- Moving tasks between `## Active` and `## Completed` on write (already implemented in `tw_complete_task`).
- Adding new H2 section semantics beyond Active/Completed.
- Any changes to SQLite-mode task storage (SQLite tasks carry a `section` field already populated by `tasks-file.ts`; the fix applies at the drift-comparison site which receives `TaskRecord[]`, so see Implementation Notes below).
- Changes to handoff schema or `handoff.md` format.
- Any UI or prompt changes.
- Schema version bumps (explicitly excluded per AC-8).

## Dependencies / Prerequisites

None. The `## Completed` section format is already stable in production (emitted by `tw_complete_task` since the `tasks-file.ts` heal-on-read era). No upstream blockers.

## Implementation Notes (for sr-engineer)

### Approach A — filter at drift.ts (preferred, minimal blast radius)

`storage.listTasks()` already returns `TaskRecord[]`, where each record carries a `section: string` field populated by `parseTasks()` in `tasks-file.ts` (line 86: `currentSection = sectionMatch[1].trim()`). The drift comparison in `drift.ts` lines 204–246 receives this list. The fix is:

1. Detect whether the file uses the Active/Completed convention: check if any `TaskRecord` has `section` equal to `"Active"` or `"Completed"` (case-insensitive, trimmed — AC-6). If neither section name is present, skip filtering (AC-3, AC-4).
2. If the convention is detected, partition `tasks` before calling `partitionTasks()`:
   - **active scope**: records whose `section.trim().toLowerCase()` is NOT `"completed"`.
   - **archived scope**: records whose `section.trim().toLowerCase()` is `"completed"` — these are excluded from the drift comparison entirely.
3. Pass only active-scope records to `partitionTasks()`.
4. `tasksCompleted` and `tasksIncomplete` in the returned JSON reflect only active-scope records (AC-5).

No changes to `tasks-file.ts` are needed because `section` is already populated per `TaskRecord`. No helper function addition required, though sr-engineer may extract a small `isArchivedSection(section: string): boolean` helper inline within `drift.ts` for clarity.

### SQLite mode

In SQLite mode, `storage.listTasks()` returns `TaskRecord[]` sourced from the DB; the `section` field is populated from the row's stored section string. The same filter in `drift.ts` applies transparently — no SQLite-specific changes needed.

### Backward-compatibility gate (AC-3 + AC-4)

```
const hasActiveSectionConvention = tasks.some(
  (t) => t.section.trim().toLowerCase() === "active" ||
         t.section.trim().toLowerCase() === "completed"
);
const activeScopeTasks = hasActiveSectionConvention
  ? tasks.filter((t) => t.section.trim().toLowerCase() !== "completed")
  : tasks;
```

If neither "active" nor "completed" section exists, `hasActiveSectionConvention` is false and `activeScopeTasks === tasks` (full-file, preserving current behaviour).

### Version bump decision

This is a bug fix with no breaking API or format change. Bump: **3.23.0 → 3.23.1** (patch). Update `package.json` `version`, the `Server(...)` literal in `index.ts`, and prepend a `## [3.23.1]` entry in `CHANGELOG.md`.

## Tasks

- [ ] T01 [P0] In `tools/drift.ts`: add `isArchivedSection` helper + Active/Completed convention detection; filter archived tasks from drift comparison before calling `partitionTasks()`; update `tasksCompleted`/`tasksIncomplete` in returned JSON to reflect active-scope only | depends_on: none
- [ ] T02 [P1] Bump version 3.23.0 → 3.23.1 in `package.json` + `index.ts` Server literal + prepend `## [3.23.1]` entry in `CHANGELOG.md`; run `npm run build` | depends_on: T01
- [ ] T03 [P1] QA: write tests in `test/drift-archived-tasks.test.mjs` covering AC-1 through AC-7 | depends_on: T01
