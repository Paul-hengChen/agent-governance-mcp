# Spec: drift-baseline-exemption

## Problem Statement

`tw_detect_drift` (`tools/drift.ts`) already excludes tasks archived under a
literal `## Completed` H2 heading (shipped v3.23.1, `drift-archived-task-
exclusion`). In practice this repo's own workflow never uses that heading:
every shipped feature gets its own `## <feature-name>` H2 section (e.g.
`## visual-fidelity-gate-hardening`, `## registry-pattern`) which the
archived-section filter conservatively treats as **active** (AC-7 of that
spec, by design — an unrecognized heading must not silently swallow real
drift). The result: 135 long-completed, already-shipped task IDs (T470
through C2-07) re-surface as "vibe-coding drift" on every single
`tw_detect_drift` call. Every subagent brief this session needed a manual
"known drift, ignore it" clause; real *new* drift would be invisible inside
that noise. `tw_sync` cannot reconcile this: it mirrors the authoritative
handoff ledger onto `tasks.md` (handoff → tasks direction only), by design —
pulling tasks-ahead completions into handoff would silently launder
unacknowledged (possibly vibe-coded) work, defeating the detector's purpose.

## Mechanism Decision

Two options were on the table (backlog C4):

- **(a) Archive-into-`## Archived`/`## Completed`** — already exists as a
  mechanism (v3.23.1) but requires *someone, every release,* to physically
  move completed lines under the recognized heading. It has not happened
  once since v3.23.1 shipped — teams here prefer per-feature headings for
  readability/history, so this failure mode would recur indefinitely.
- **(b) `drift_baseline` acknowledgment field** — chosen. A workspace-config
  field (`.current/.config.json` → `driftBaselineIds: string[]`) listing task
  IDs the team has explicitly acknowledged as already-shipped-and-reconciled.
  `tw_detect_drift` treats a task ID in this list exactly like an archived
  one: excluded from the vibe-coding-drift comparison and from the reported
  `tasksCompleted` array. IDs NOT in the baseline still surface normally —
  genuinely new drift stays visible.

**Why config, not handoff**: `.current/handoff.md` is echoed verbatim to the
agent on every `tw_get_state` pre-flight call. A 135-entry ID array living
there would cost real tokens on every single session start, forever growing.
`.current/.config.json` is read server-side only (`loadConfig()`, already
memo-cached per process by `configCache`) and never dumped wholesale into a
tool response — `tools/drift.ts` only needs Set-membership checks against it,
so the baseline costs zero incremental response tokens no matter how large it
grows. This directly avoids the token-cost failure mode the archived-section
precedent already causes if it were echoed anywhere agent-visible.

**Why no schema_version bump**: `WorkspaceConfig.taskPattern` /
`.taskPaths` were both added to the v1 shape without ever registering a
config migration step — additive-optional fields with no required transform
for old files (absence == empty) don't need one, per the existing precedent
in `tools/config.ts`. `driftBaselineIds` follows the identical pattern:
optional, array-of-string, absence == `[]`. `docs/schema-versions.md`'s
"Constraints to honour" (lossless, additive) are satisfied without a bump.

**Who is sanctioned to write the baseline (trust class)**: modeled on the
`cut_approved` precedent (Constitution §3.1) — a mechanism is only as safe as
its writer's incentive to be honest. Self-attestation by whichever role just
finished the work (sr-engineer, PM) would let fresh, unacknowledged
completions get pre-emptively baselined, silently defeating the anti-vibe-
coding purpose of the detector. **release-engineer** is the correct sanctioned
writer: it only fires after `(qa-engineer, PASS)` (its own hard-rule
precondition), meaning every ID it could baseline already cleared the full
QA + code-review chain. It already has an established "direct file edit, no
guarded tw_* tool" precedent for `package.json` / `CHANGELOG.md` / `README.md`
(see `content/skill-release-engineer.md` Artifact allowlist) — extending that
allowlist to `.current/.config.json` (`driftBaselineIds` field only) is
consistent with existing practice, not a new mechanism class.

**Storage-mode scope (explicit, not silently dropped)**: `loadConfig()` reads
`<workspacePath>/.current/.config.json` from the filesystem. HTTP/SQLite mode
has no equivalent workspace-config table today, so this feature is
**file-mode only** — SQLite-mode drift reports keep today's behavior
unchanged (no regression; the noise this ticket fixes was observed, and this
fix ships, entirely within the file-mode dogfooding repo). This mirrors the
already-accepted `cut_approved` scoping precedent ("the gate stays a pure
boolean check... file-mode-only", per `cut-approval-coordinator-attestation`,
backlog C2) — extending to SQLite mode is out of scope for this P2 ticket and
can be a follow-up if HTTP-mode workspaces start hitting the same noise.

## User Stories

- As a coordinator/agent running `tw_detect_drift` in this repo, I want the
  135 already-shipped, already-reviewed task IDs excluded from the drift
  report, so that a clean project reports "no drift" instead of the same
  noise every pre-flight.
- As a release-engineer shipping a version, I want a lightweight step to
  acknowledge this release's completed IDs into the baseline, so that future
  drift reports stay quiet for shipped work without requiring anyone to
  reorganize `tasks.md` headings.
- As a sr-engineer or PM, I want a task I complete *this session* — not yet
  in the baseline — to still surface as drift if I forget to record it in
  handoff, so the detector keeps catching genuine vibe-coding.

## Acceptance Criteria

**AC-1 — Baseline ID suppresses vibe-coding drift**
Given `.current/.config.json` contains `driftBaselineIds: ["T470"]` and
`tasks.md` shows `T470` as `[x]` (not archived, not in handoff
`completed_tasks`),
When `tw_detect_drift` runs,
Then no "Task list shows T470 completed..." line appears, and `T470` is
absent from the returned `tasksCompleted` array.

**AC-2 — Non-baselined IDs still surface as drift**
Given the same config, and `tasks.md` also shows `T999` as `[x]` (not in
baseline, not in handoff `completed_tasks`),
When `tw_detect_drift` runs,
Then a drift line for `T999` IS emitted (vibe-coding drift), and `T999`
appears in `tasksCompleted`.

**AC-3 — Absent/empty baseline: no behavior change**
Given `.current/.config.json` has no `driftBaselineIds` key (or the file is
absent entirely),
When `tw_detect_drift` runs,
Then drift detection behaves exactly as before this feature (regression
safety; matches `taskPattern`/`taskPaths` absent-field precedent).

**AC-4 — Composes with the existing archived-section filter**
Given a `tasks.md` using the `## Active` / `## Completed` convention AND a
non-empty `driftBaselineIds`,
When `tw_detect_drift` runs,
Then both filters apply independently and correctly: archived-section tasks
are excluded (existing behavior unchanged) and baseline-listed active-scope
tasks are also excluded — no double-counting, no interaction bug.

**AC-5 — Handoff-ahead and FAIL/Blocked drift unaffected**
The baseline only exempts the "task list shows X completed but handoff
doesn't mention it" (tasks-ahead / vibe-coding) direction. "Handoff says X
completed but task list shows incomplete" and FAIL/Blocked-with-incomplete-
tasks drift lines are unaffected by this change (mirrors AC-9 of the
`drift-archived-task-exclusion` spec).

**AC-6 — No schema_version bump; old config files parse unchanged**
A `.current/.config.json` written before this feature (schema_version 1, no
`driftBaselineIds` key) continues to load without error, migration, or a
version increment. `CURRENT_VERSIONS.config` stays at `1`.

**AC-7 — SQLite/HTTP mode: no crash, no regression**
In SQLite/HTTP storage mode (no `.current/.config.json` on the filesystem for
the given `workspace_path`), `tw_detect_drift` behaves exactly as it does
today — `loadConfig` returns `{}` gracefully, no baseline filtering applies,
no error is thrown.

**AC-8 — One-time backfill clears the live noise**
After this feature ships, running `tw_detect_drift` in THIS repo's own
workspace (`agent-governance-mcp`) reports the pre-existing 135 IDs (T470
through C2-07, captured live at the start of this feature's PM phase) as
exempt — a fresh clean `tw_detect_drift` call here should report "No drift
detected" (assuming no other genuine drift exists at that point).

**AC-9 — release-engineer SOP + allowlist updated**
`content/skill-release-engineer.md` documents (a) `.current/.config.json`
(`driftBaselineIds` field only) added to the Artifact allowlist, and (b) a
SOP step appending the release's newly-completed task IDs into
`driftBaselineIds` (deduplicated, array created if absent) as part of the
existing post-PASS packaging flow.

## Copy / Strings

| string id | exact text | source |
|-----------|-----------|--------|
| N/A | — | feature introduces no new user-facing strings (drift detail message templates are unchanged; see AC-5) |

## Visual Tokens

| token id | property | value | source |
|----------|----------|-------|--------|
| N/A | — | feature has no visual surface |

## Visual Widgets

| widget id | description | source-node |
|-----------|-------------|-------------|
| N/A | — | feature has no non-primitive widgets |

## Out of Scope

- Reorganizing `tasks.md` to use per-feature-to-`## Completed` archiving
  (rejected mechanism — see Mechanism Decision).
- Any change to `tw_sync`'s direction (handoff → tasks only; stays
  authoritative-ledger-only by design).
- SQLite/HTTP-mode support for the baseline field (explicitly out of scope,
  AC-7 documents graceful no-op instead).
- Any `schema_version` bump to `handoff`, `tasks`, `sqlite`, or `config`.
- A guarded `tw_*` MCP tool for writing the baseline (release-engineer writes
  it via direct file edit, consistent with its existing `CHANGELOG.md` /
  `README.md` precedent — no new tool surface).

## Dependencies / Prerequisites

- Live `tw_detect_drift` snapshot captured at PM-phase start (2026-07-07),
  135 IDs (`T470`–`C2-07`) — see `tools/drift.ts` current output; the exact
  list is reproduced in task C4-03 for the one-time backfill.
- No external references (no URLs/Figma/tickets) in this ticket — Resource
  Audit Gate is a no-op.

## Tasks

- [ ] C4-01 [P0] sr-engineer: extend `tools/config.ts` — add `driftBaselineIds?: string[]` to `WorkspaceConfig`; extract/filter it in `loadConfig()` mirroring the existing `taskPaths` string-array pattern exactly (filter to strings, only set when non-empty). No schema_version bump (AC-3, AC-6). | depends_on: none
- [ ] C4-02 [P0] sr-engineer: extend `tools/drift.ts` — after the existing archived-section filter builds `activeScopeTasks`, further exclude any task ID present in `loadConfig(workspacePath).driftBaselineIds` (Set-based O(1) lookup) from both the vibe-coding-drift comparison and the reported `tasksCompleted` array; `tasksIncomplete` and handoff-ahead/FAIL-Blocked drift lines unaffected (AC-1, AC-2, AC-4, AC-5). | depends_on: C4-01
- [ ] C4-03 [P0] sr-engineer: one-time backfill — create/update THIS repo's `.current/.config.json` with `driftBaselineIds` populated with the exact 135 currently-drifting IDs (`T470`...`C2-07`, from the live pre-feature `tw_detect_drift` snapshot) to clear existing noise immediately (AC-8). | depends_on: C4-02
- [ ] C4-04 [P1] sr-engineer: update `content/skill-release-engineer.md` — add `.current/.config.json` (`driftBaselineIds` field only) to the Artifact allowlist; add a SOP step (after commit/tag/push, before the final `tw_update_state`) instructing release-engineer to append this release's newly-completed task IDs (from `tw_get_state`'s `completed_tasks` or `tw_detect_drift`'s `tasksCompleted`) into `driftBaselineIds`, deduplicated, creating the array if absent (AC-9). | depends_on: C4-02
- [ ] C4-05 [P1] [qa-engineer] write `test/drift-baseline.test.mjs` covering AC-1 through AC-7: baseline suppression, non-baselined-ID drift still fires, absent/empty-baseline regression safety, composition with the archived-section filter, handoff-ahead/FAIL-Blocked unaffected, config schema_version stays 1 with old files unchanged, SQLite/HTTP-mode graceful no-op. Run `npm test` — full suite green. | depends_on: C4-02, C4-04
- [ ] C4-06 [P1] sr-engineer: bump `package.json` + `index.ts` `Server()` literal version; add `CHANGELOG.md` entry describing the drift-baseline-exemption mechanism; run `npm run build` && `node scripts/check-version.mjs`. | depends_on: C4-05
- [ ] C4-07 [P2] pm/coordinator (post-PASS): mark backlog ticket C4 done in `docs/backlog.md` with mechanism summary and commit reference, matching the C1/C2 "Done" convention. | depends_on: C4-06
