# d7-qa-reports-archive

## Problem Statement
`qa_reports/` holds 232+ evidence files (`review_<id>.md`, `visual_<id>.md`,
`expected-red_<feature>.txt`) and grows monotonically — every QA round, code
review, and visual round lands a new file there forever, and nothing ever
removes one. `tasks.md` already has an archive convention for stale sections
(the `## Completed` / archived-section split enforced by `isArchivedSection`
in `tools/drift.ts`); the evidence-file directories have no equivalent, so
human navigation gets slower every release with zero corresponding benefit
(server evidence checks only ever look up a specific active-feature task id's
file by exact path — nothing re-reads old files).

## User Stories
- As a developer navigating `qa_reports/` months into the project, I want
  shipped features' evidence files moved out of the working root, so that
  the directory listing stays proportional to in-flight work rather than
  all-time history.
- As a release-engineer, I want the archive step to be a single SOP action
  performed at the moment a feature ships, so that no separate cleanup pass
  is ever required.

## Acceptance Criteria

- **AC1** — Given a release-engineer run for a just-PASS'd feature `<feature>`
  (ticket-code prefix `<CODE>` = the leading alnum token of `<feature>`
  before its first `-`, uppercased — e.g. `d7-qa-reports-archive` → `D7`,
  matching the `T-D7-*` task-id convention already used project-wide, see
  commit history: `T-D3-01..T-D3-DONE`, `T-D1-01..T-D1-DONE`), when the new
  SOP step runs after `check-version` (step 7) and before commit/tag/push
  (step 8), then it creates `qa_reports/archive/<feature>/` (idempotent
  `mkdir -p`) and moves every `qa_reports/review_<id>.md` and
  `qa_reports/visual_<id>.md` whose `<id>` matches `^T-<CODE>-` into it,
  preserving filenames.
- **AC2** — Given `qa_reports/expected-red_<feature>.txt` exists for the
  released feature, when the archive step runs, then that file is moved into
  the same `qa_reports/archive/<feature>/` directory alongside the per-id
  files.
- **AC3** — Given a batched/covering report file (one real file with a
  `covers: <id1>, <id2>, ...` label line, per the existing `covers:`
  convention in `tools/evidence-file.ts`) whose covered ids intersect the
  released feature's id set but whose OWN filename's id does not match the
  `^T-<CODE>-` prefix, when the archive step runs, then that file is also
  swept into the archive (grep `qa_reports/*.md` for `covers:` lines and
  test membership against the id set — same semantics as
  `parseCoversIds`/`buildCoverageIndex`, expressed as shell/prose since this
  SOP step is not new source code).
- **AC4** — Given zero files match the id-prefix/`covers:` rules for a
  release (e.g. a feature that shipped with no QA evidence files, or whose
  task ids don't follow the `T-<CODE>-*` convention), when the archive step
  runs, then it is a silent no-op — it MUST NOT guess-move unrelated files,
  and MUST NOT fail the release.
- **AC5** — Given the archive step has already moved a file in a prior
  (retried) invocation, when it runs again, then it MUST NOT clobber or
  duplicate — use no-clobber semantics (skip if the destination already
  exists) rather than overwriting.
- **AC6** — Given the moved files now live under `qa_reports/archive/<feature>/`,
  when release-engineer's SOP step 8 stages and commits the release, then the
  moved paths are staged as part of the SAME release commit (the existing
  `git add ... qa_reports/ ...` glob already covers the new subdirectory —
  no change needed there), and the Escalation Routes "unrelated uncommitted
  changes" scope rule and the Artifact allowlist both explicitly recognize
  `qa_reports/archive/**` as expected, move-only release-engineer output (not
  a role-boundary violation) — this requires an Artifact-allowlist addition,
  since the current allowlist in `content/skill-release-engineer.md` lists
  `package.json` / `index.ts` / `CHANGELOG.md` / `README.md` /
  `.current/.config.json` / `docs/backlog.md` / `dist/**` but does NOT
  currently mention `qa_reports/` at all.
- **AC7** — Given a concurrent session has its own in-flight feature with
  files sitting in `qa_reports/` root at the same time (per this project's
  standing multi-session-disjoint-file-set convention), when the archive step
  runs for the just-released feature, then it MUST NOT touch any file whose
  id does not match the released feature's `^T-<CODE>-` prefix — the
  concurrent session's evidence files are untouched.
- **AC8** — Given `qa_reports/archive/<feature>/` now exists as a
  subdirectory of `qa_reports/`, when any server evidence-check or
  drift-detection code path runs against the CURRENT active feature, then it
  is unaffected: (a) `tools/drift.ts` has zero references to `qa_reports/` or
  `review_reports/` — verified by direct code read, this ticket does not
  change that file; (b) `tools/evidence-file.ts`'s `buildCoverageIndex` is
  the only `readdirSync`-based directory scan over either evidence
  directory in source (`tools/`/`schema/`/`guards/`) — it filters every
  entry by `name.toLowerCase().endsWith(".md")` BEFORE any file read, so a
  bare subdirectory name (`archive`, containing no `.md` suffix itself) is
  always skipped, never descended into, and never opened; (c) every other
  evidence lookup (`hasEvidenceInFile`, the `VISUAL_EVIDENCE_MISSING` /
  `EXPECTED_RED_DIFF_MISSING` gates, etc.) constructs an exact per-id file
  path for the CURRENT active feature's task ids and never lists the
  directory, so archived files under a past feature's subdirectory can never
  collide. qa-engineer decides (SOP step 2, per Constitution §2) whether this
  property needs a new explicit regression test (e.g. asserting
  `buildCoverageIndex` tolerates an `archive/` subdirectory alongside real
  `.md` files) or is adequately covered by existing behavior/tests.

## Copy / Strings
| string id | exact text (quote verbatim) | source |
|---|---|---|
| N/A | — | — | feature has no user-facing strings (internal release-process SOP text only) |

## Visual Tokens
| token id | property | value (quote verbatim) | source |
|---|---|---|---|
| N/A | — | — | — | feature has no visual literals |

## Visual Widgets
| widget id | description | source-node |
|---|---|---|
| N/A | — | feature has no non-primitive widgets |

## Out of Scope
- **`review_reports/` (code-reviewer evidence)** — the backlog ticket (D7)
  names `qa_reports/` only. `review_reports/` currently sits at 68 files and
  shares the identical `covers:`/`buildCoverageIndex` code path in
  `tools/evidence-file.ts`, so the same safety argument (AC8-b) would apply
  to it unchanged if a future ticket extends the archive step there — noted
  for the record, deliberately not bundled into this MVP to keep the D7 cut
  minimal per its P3/small sizing.
- Dated subdirectories (`qa_reports/archive/2026-07-10/`) — the backlog
  offered this as an alternative to per-feature subdirectories; per-feature
  (`qa_reports/archive/<feature>/`) is chosen for consistency with the
  existing per-feature grouping convention (`driftBaselineIds`, tasks.md
  archived sections) and because it keeps a shipped feature's evidence
  contiguous in one place.
- Any change to `tools/evidence-file.ts`, `tools/drift.ts`, or any other
  `tools/`/`schema/`/`guards/` source — AC8 establishes these paths are
  already archive-safe as written; this ticket does not modify them (a new
  *test* asserting that safety is qa-engineer's call, not a source change).
- Retroactively archiving the existing 232 pre-D7 files — the fix is a
  going-forward release-time step, not a one-time bulk cleanup migration.
- `.current/.config.json` schema changes — the archive step needs no new
  config field; it derives everything from `active_feature` +
  `completed_tasks`/`tasksCompleted` (already-read fields).

## Dependencies / Prerequisites
None blocking. Ordering note: T-D7-02 (verification) depends on T-D7-01 (the
SOP step existing) only in the sense that it verifies the SOP step's
described contract — it does not depend on any release actually running the
step first, since it tests the underlying code-path safety property (AC8)
directly.

Non-design feature: no `design/d7-qa-reports-archive.md` exists;
`## Mode` = no-design equivalent (file absent) → Visual State-Count Split,
Geometric-Density Split Gate, Scope Decision Gate, and Visual Structural
Assertions section are all not triggered. `scope_decision: "single-feature"`
recorded on the routing write (small, single-file content change + one
verification task; no new data model, no cross-cutting API, well under the
≥3-module architect threshold).
