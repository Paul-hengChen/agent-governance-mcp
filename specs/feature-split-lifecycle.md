# Spec: feature-split-lifecycle

> Source: user (this session). The Feature-Scope Gate (v3.17.0) writes a persistent
> `.current/feature-split.md` but tracks no completion — a finished unit looks
> identical to a pending one, so there is no single source of truth for "which units
> are done", risking confusion / redo on resume. This adds per-row status, done-
> marking on PASS, and a resume rule that skips done rows.

## Problem Statement

`.current/feature-split.md` is the cross-feature work list, but every row stays
visually "not done" forever — completion of a unit's `/teamwork` cycle leaves no
mark in the plan. On a later invocation the coordinator cannot tell which rows
remain, and the human can accidentally re-feed a completed feature. This feature
gives the split plan a lifecycle: a `status` column, done-marking driven by the
existing PASS signal, and a Feature-Scope-Gate resume path that reconciles the plan
against handoff state, skips `done` rows, and works the next `pending` row (or a
human-named row id) without regenerating the plan.

## User Stories

- As a **human operator**, I want completed split units marked `done` in the plan,
  so that I (and the coordinator) always know what's left and never redo a feature.
- As the **coordinator**, on a `/teamwork` where a split plan already exists, I want
  to reconcile it against handoff state and resume the next pending unit instead of
  re-assessing the whole PRD.
- As a **human operator**, I want to say "do F0" and have the coordinator hydrate
  that row from the plan, so I don't re-paste scope + Figma each time.

## Acceptance Criteria

- **AC1 (status column)**
  - Given the Feature-Split Plan schema in `content/skill-coordinator.md`,
  - When the coordinator generates `.current/feature-split.md`,
  - Then the Split Table has a `status` column the coordinator pre-fills `pending`
    for every row.
- **AC2 (done-marking on PASS)**
  - Given a split unit's `/teamwork` cycle reaches `status=PASS` for that feature,
  - When the coordinator next reconciles the plan (on resume, or at the terminal PASS
    in-session),
  - Then it flips that row's `status` to `done` by matching the row's `feature id`
    against the handoff `active_feature` whose status is PASS. (Coordinator edits the
    `.md`; this is not a `tw_*` state write.)
- **AC3 (resume — no regenerate)**
  - Given an incoming PRD/ticket AND an existing `.current/feature-split.md`,
  - When the Feature-Scope Gate runs,
  - Then it does NOT re-assess or regenerate the plan; it reconciles `done` rows
    (AC2) and proceeds with the next `pending` row, skipping `done` rows.
- **AC4 (no redo)**
  - Given a row marked `done`,
  - When resuming,
  - Then that row is never re-run.
- **AC5 (by-id resume)**
  - Given the human references a row id (e.g. "execute F0", "F0", "oobe-foundation"),
  - When the coordinator handles it,
  - Then it reads `.current/feature-split.md`, hydrates that row (scope + figma link +
    key visual widgets + notes) as the feature input, and runs the chain — the human
    need not re-paste the row.
- **AC6 (footprint budget)**
  - Given the additions land in the always-injected `skill-coordinator.md`,
  - When `scripts/measure-context-cost.mjs` / the footprint test runs,
  - Then the Feature-Scope-Gate section stays ≤ ~550 approx tokens (a bounded
    increase from the prior ~425 ceiling, justified by the lifecycle logic); the
    existing footprint test ceiling is updated to match.
- **AC7 (single-feature / no-plan unaffected)**
  - Given no `.current/feature-split.md` exists (single-feature path),
  - When the gate runs,
  - Then none of the lifecycle logic fires — zero overhead, behaviour unchanged.

## Copy / Strings

| string id | exact text (quote verbatim) | source |
|---|---|---|
| split.status.pending | `pending` | authored-here — split-row status value |
| split.status.done | `done` | authored-here — split-row status value |
| split.col.status | `status` | authored-here — Split Table column header |

## Visual Tokens

| token id | property | value | source |
|---|---|---|---|
| N/A | — | — | non-UI governance-content feature |

## Visual Widgets

| widget id | description | source-node |
|---|---|---|
| N/A | — | feature has no non-primitive widgets |

## Out of Scope

- Server-enforced split tracking (this stays prompt-layer; no `tools/transitions.ts`
  or new tw_* tool). The coordinator edits `.current/feature-split.md` directly.
- Auto-looping through all pending rows in one `/teamwork` (work stays human-paced,
  one unit per invocation).
- Migrating split tracking into `tasks.md` / `handoff.md` schema (the plan file is the
  cross-feature source of truth; handoff stays the current-feature source).

## Dependencies / Prerequisites

- Extends `specs/feature-scope-gate.md` (v3.17.0) — same `.current/feature-split.md`
  artifact + Feature-Scope Gate section; this adds the `status` column and the
  resume/done-marking logic. Combines with the open "resume by row id" idea (AC5).
- The footprint test from `test/feature-scope-gate.test.mjs` (≤425 cap) must be
  updated to the new ≤~550 ceiling (AC6) — qa-owned.
- No external references.
