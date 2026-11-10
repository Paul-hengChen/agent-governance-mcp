# e406-release-and-merge-scripts

Tickets: E406, E203 (fan-out lane `e406`, plan `specs/fanout-backlog-wave-b.md`).
Spec sources: the two `docs/backlog.md` rows, the plan's dispatch-check bullets
for E406 / E203, the e406 Lanes row and the plan's Decisions (rulings 1–6 = a).
No architect hop.

## Problem Statement

Two script defects, one per ticket. **E406**: `scripts/release.mjs prepare`
step 8a-1 runs `git add -- <member> …` for every `STAGE_PATHS` member that
has a change, directories included (`docs/`, `specs/`, `qa_reports/`, …), so
an untracked file inside a member directory is swept into the release commit;
and the completeness check then stops with exit 30 `STAGING_INCOMPLETE` on any
untracked file it did not stage, so leaving the file out is not an option
either. The only way to keep an intentionally untracked file out of a release
today is a local `.git/info/exclude` line that every later release on that
machine silently depends on. **E203**: `tools/merge-invariants.ts` checks
compaction condition (c) over a union `U` that also counts closed rows the
merge still holds. When one side compacts section S into "N done" while the
other side adds a new closed row under S that the merge keeps, `U` exceeds N
and every compacted row is reported MISSING plus LOST_DONE, exit 1, although
nothing was lost. The failure is loud (never a silent pass) but false.

## User Stories

- As a release operator, I want an untracked file I deliberately keep in a
  member directory to be left out of the release commit with a warning naming
  it, so that a release neither ships it nor stops on it.
- As a release operator, I want `STAGING_INCOMPLETE` to mean "a path the plan
  meant to stage did not get staged", so that exit 30 always points at a real
  staging failure.
- As an integrator running merge-invariants after a lane merge, I want a
  compaction on one side and a new row kept by the merge on the other side to
  pass, so that the check fails only on a real loss.

## Acceptance Criteria

### E406 — explicit-path staging in `scripts/release.mjs` step 8a-1

Definitions used below.
- **Tracked change**: a `git status --porcelain=v1 -z --untracked-files=all`
  entry whose XY is not `??` (modification, deletion, rename, type change).
- **Untracked path**: an entry whose XY is `??`.
- **Plan-named set N** — the untracked paths the release plan itself names:
  (a) every `STAGE_PATHS` member that is a single file, not a directory
  (`CHANGELOG.md`, `.current/.config.json`, `tasks.md`, …; step 7b may create
  `.current/.config.json`); (b) `specs/<active_feature>.md`, plus
  `specs/<name>.md` for each feature a `Multi-feature release:` pending note
  names — exactly the specs step 8a-3 can require (one shared parser for the
  note, used by both 8a-1 and `classifySpecCheck`); (c) every step-7a archive
  move destination; (d) every root-level file step 7a admitted as new to the
  release (its per-tree list of root files absent from the previous tag) that
  is still at the tree root after the moves.
- **Planned paths**: every tracked change, plus every untracked path in N.
- **Unplanned untracked path**: an untracked path not in N.

- **AC-E406-1** — Given a release fixture on its release branch whose working
  tree holds the usual release edits plus one untracked file under `docs/`
  that no plan entry names, when `release.mjs prepare` runs, then it exits 0,
  the release commit does not contain that file, the file is still on disk
  and still untracked afterwards, and stderr carries exactly one
  `release.8a1.unplanned` warning line naming it.
  proof: `node --test --test-name-pattern "E406" test/e394-release-script.test.mjs` — the case qa names for this AC passes (scratch repo, one untracked file under `docs/`).
- **AC-E406-2** — Given the same tree, when step 8a-1 stages, then tracked
  changes are staged with one `git add --update -- <members>` call whose
  members are `planStage` over the tracked changes only, the plan-named
  untracked paths are staged with one `git add -- <paths>` call naming each
  path exactly (never a directory), and no 8a-1 `git add` call passes a
  directory member without `--update`.
  proof: `node --test --test-name-pattern "E406" test/e394-release-script.test.mjs` — the recorded-argv case qa names for this AC passes.
- **AC-E406-3** — Given an untracked path of each N kind — the active
  feature's spec, a 7a move destination, a fresh root evidence file that 7a
  did not move, `.current/.config.json` created by step 7b, and a spec named
  by a `Multi-feature release:` note — when `prepare` runs, then each lands
  in the release commit and step 8a-3 finds the specs in the release range.
  proof: `node --test --test-name-pattern "E406" test/e394-release-script.test.mjs` — the plan-named-kinds case(s) qa names pass.
- **AC-E406-4** — Given `checkStagingCompleteness`, when it is called with a
  new optional `unplanned` list, then those paths never affect `pass` and are
  returned as `warnings`; the existing inputs keep their meaning and verdicts
  (`changed` = planned paths, `staged` = index, `unstaged` = tracked
  leftovers, `untracked` = plan-named untracked paths left unstaged), so exit
  30 fires only when a planned path did not reach the index (plus the
  unchanged nothing-to-commit stop, AC-E406-7).
  proof: `node --test --test-name-pattern "E406|AC-S6 staging stops|L:E94" test/e394-release-script.test.mjs` passes.
- **AC-E406-5** — Given the allow-list, when `isAllowed("git", ["add",
  "--update", "--", "docs/"])` is asked, then it is admitted; `["add",
  "--update"]`, `["add", "--update", "docs/"]` and `["add", "-A"]` are
  refused; the existing `["add", "--", "a.txt"]` shape stays admitted, and
  every git call prepare makes stays on the AC-S3 allow-list (which gains
  `/^git add --update -- \S/`).
  proof: `node --test --test-name-pattern "AC-S3|AC-R11" test/e394-release-script.test.mjs` passes.
- **AC-E406-6** — Given the AC-E406-1 tree, when `prepare --dry-run` runs,
  then it records (never executes) the same two `git add` shapes, prints the
  same warning line, and leaves the index and working tree unchanged.
  proof: `node --test --test-name-pattern "E406" test/e394-release-script.test.mjs` — the dry-run case qa names passes.
- **AC-E406-7** — Unchanged behaviour: pre-6 `checkScope` still stops with
  exit 13 on any change outside every member (an untracked root stray file
  included); the nothing-to-commit stop (exit 30 when there is no planned
  path to stage and HEAD is not the release commit) is unchanged; step 13a-4
  (close-out bookkeeping staging) is unchanged; and the pins in files this
  lane may not edit stay green without edits.
  proof: `node --test test/e166-template-defers-staging.test.mjs test/e130-lane-default.test.mjs test/e405-release-runner.test.mjs` passes.

### E203 — merge-invariants condition (c) counts only rows not found at the merge

Spec first: the (c) paragraph of `specs/e126-merge-invariants.md` is amended
in this PM commit (U collects only closed `task_id`s the whole-tree identity
search does NOT find at the merge); the code change follows in a later commit.

Fixture shape for AC-E203-1..4 (the backlog row's repro): base and parent2
(the lane) hold `## Wave` with `- [x] T-A-01`, `- [x] T-A-02`, `- [x] T-A-03`;
parent2 compacts `## Wave` into a `## Compacted History` manifest bullet
`- Wave: 3 done, 0 voided`; parent1 (main) keeps the three rows and adds
`- [x] T-D-01` under `## Wave`; the merge holds the manifest plus whatever row
set the AC names.

- **AC-E203-0** — Given `specs/e126-merge-invariants.md`, when its (c)
  paragraph is read, then `U` is defined over closed `task_id`s the
  whole-tree identity search does NOT find anywhere at MERGE, and the
  amendment commit precedes the `tools/merge-invariants.ts` change on the
  lane branch.
  proof: `grep -n "does NOT find anywhere at" specs/e126-merge-invariants.md` prints the (c) line.
- **AC-E203-1** — Given the repro fixture with the merge keeping `- [x]
  T-D-01` under `## Wave`, when merge-invariants runs, then it exits 0
  (`PASS`), MISSING and LOST_DONE are empty, and the COMPACTED set is exactly
  `T-A-01`, `T-A-02`, `T-A-03` (`T-D-01` is present, not compacted).
  proof: `node --test --test-name-pattern "E203" test/e126-merge-invariants.test.mjs` — the repro case qa names passes.
- **AC-E203-2** (verification point 1) — Given the existing AC11 (iv) R-1
  5-vs-4 fixture, when merge-invariants runs, then it still FAILs with all
  five `T-U-01..05` reported MISSING, the test unchanged.
  proof: `node --test --test-name-pattern "R-1 5-vs-4 fixture" test/e126-merge-invariants.test.mjs` passes.
- **AC-E203-3** (verification point 2) — Given the repro fixture with the
  merge dropping `T-D-01`, when merge-invariants runs, then `U` = {T-A-01..03,
  T-D-01} = 4 done > 3, it FAILs, and all four are reported MISSING
  individually, each with the `(c) manifest under-reconciles` reason.
  proof: `node --test --test-name-pattern "E203" test/e126-merge-invariants.test.mjs` — the dropped-row case qa names passes.
- **AC-E203-4** (verification point 3, only genuinely compacted rows are
  exempted) — Given the repro fixture with the merge keeping `T-D-01` but the
  manifest under-counting (`- Wave: 2 done, 0 voided`), when merge-invariants
  runs, then it FAILs with exactly `T-A-01..03` reported MISSING: a row the
  merge keeps neither counts toward `U` nor absorbs the manifest's shortfall,
  and is itself never reported MISSING or COMPACTED.
  proof: `node --test --test-name-pattern "E203" test/e126-merge-invariants.test.mjs` — the under-count case qa names passes.
- **AC-E203-5** — Every existing case in `test/e126-merge-invariants.test.mjs`
  passes unchanged, and `npm run build` leaves `dist/tools/merge-invariants.*`
  byte-identical to the committed files.
  proof: `node --test test/e126-merge-invariants.test.mjs` passes, then `git status --porcelain -- dist/` after `npm run build` prints nothing.

## Copy / Strings

| string id | exact text (quote verbatim) | source |
|---|---|---|
| release.8a1.unplanned | `release: [8a-1] warning: untracked <path> is named by no release plan entry — left out of the release commit` (stderr, one line per path, `<path>` repo-relative) | authored-here — E406 row asks for "a warning naming the path"; the `release: [<step>]` prefix matches the script's existing stderr lines |
| merge.c.reason | `(c) manifest under-reconciles <file> § <section>: manifest <D> done/<V> voided < closed rows not found at merge, union across parents <d> [x]/<v> [-] (<n> distinct task_id(s))` | authored-here — E203 changes what `U` holds; the `(c) manifest under-reconciles` prefix is kept because `test/e126-merge-invariants.test.mjs` matches it |

## Visual Tokens

| token id | property | value (quote verbatim) | source |
|---|---|---|---|
| N/A | — | — | feature has no visual literals |

## Visual Widgets

| widget id | description | source-node |
|---|---|---|
| N/A | — | feature has no non-primitive widgets |

## Out of Scope

- The local `.git/info/exclude` line ruled at v4.18.0 (local, uncommitted
  state; not part of the repo).
- `content/skill-release-engineer.md`: its exit-30 row (`| exit 30
  STAGING_INCOMPLETE | Blocked | <stop> (paths) | — |`) still holds — a
  planned path that failed to stage is still exit 30 with the paths named —
  and no SOP sentence describes directory-wide staging, so content does not
  change (verified at cut).
- `scripts/merge-invariants.mjs` (the CLI wrapper; only the library changes).
- Untracked files deeper than a tree root under `qa_reports/` or
  `review_reports/` that 7a did not move, and untracked files under `dist/`:
  they are not plan-named, so they are warned and left out. A `dist/` file
  the release build created without a committed source counterpart is a lane
  that forgot to commit its `dist/` — the warning names it; turning it into a
  stop is not this ticket.
- Changing `checkScope` (pre-6, exit 13), step 13a-4 close-out staging, the
  `STAGE_PATHS` lists, or `planStage`'s signature and behaviour.
- AC11's wording in `specs/e126-merge-invariants.md` and every other
  paragraph of that spec except the (c) union paragraph.

## Dependencies / Prerequisites

- Human rulings 1–6 of the plan's Decisions table are all (a); this lane does
  not re-ask. Ruling 6 = four parallel lanes, so E406 + E203 ship as lane e406.
- No `design/<feature>.md`; mode = no-design (Visual Structural Assertions
  omitted).
- No file-system or symlink behaviour changes: the lane's tests use temporary
  git repositories and `git add --update`, identical under the CI matrix
  (Node 20 and 22); no extra Node 20 verification step is needed.
- Constraints on `scripts/release.mjs` from pins in files this lane may not
  edit (`test/e166-template-defers-staging.test.mjs`,
  `test/e130-lane-default.test.mjs`): keep `export function planStage({
  changed, exists })` filtering by `exists(m)`; keep the literal
  `["add", "--", ...plan]` (step 13a-4 carries it — do not rename that
  variable); keep `export function checkStagingCompleteness(`; keep `throw new
  ReleaseStop("STAGING_INCOMPLETE", \`${verdict.problems.join("; ")} — stage
  them and re-run\`)`. Lane-owned `test/release-staging.test.mjs` AC2 (E94)
  lifts exactly two `leftovers([...])` argv arrays out of `step8aStage`
  (`diff --name-only …` and `ls-files --others --exclude-standard …`, both
  with `:!.current`): keep both calls and their argv.
- Expected reds after T-E406-01, before T-E406-02: the `test/e394-release-script.test.mjs`
  fixture's `workTree` leaves `content/foo.md` untracked while the CHANGELOG
  entry cites it, so every prepare happy-path case stops at exit 31
  `CHANGELOG_CITATION` once that file is no longer swept in (correct new
  behaviour: a feature file not yet committed is not part of a release). The
  AC-S3 allow-list regex list also lacks `git add --update`. sr-engineer
  records the red set in `qa_reports/expected-red_e406-release-and-merge-scripts.txt`;
  qa re-pins (fixture commits `content/foo.md` in `buildTemplate` and edits it
  in `workTree`; ALLOW gains `/^git add --update -- \S/`).
- If a test file this lane does not own turns red (`test/e130-lane-default.test.mjs`,
  `test/e166-template-defers-staging.test.mjs`, `test/e405-release-runner.test.mjs`,
  `test/e115-join-precondition.test.mjs`, or any other), stop and mail the integrator.

## Cut

| id | desc | depends_on | est. files | touches | design-link |
|---|---|---|---|---|---|
| E406 | `release.mjs prepare` stages by explicit path: tracked changes via `git add --update -- <members>`, untracked only when plan-named (N); unplanned untracked warned by path, never staged, never fatal; exit 30 only for a planned path that did not stage | — | 4 | `scripts/release.mjs`, `test/e394-release-script.test.mjs`, `test/release-staging.test.mjs`, `specs/e406-release-and-merge-scripts.md` | — |
| E203 | merge-invariants (c): `U` counts only closed rows not found at the merge; spec (c) amended first; three verification points tested | — | 4 + dist | `specs/e126-merge-invariants.md`, `tools/merge-invariants.ts`, `dist/tools/merge-invariants.*`, `test/e126-merge-invariants.test.mjs` | — |

## Cut Sites

Per-site breakdown of the Cut above (line numbers re-verified at cut on the lane base):

| file | site | AC | task |
|---|---|---|---|
| `scripts/release.mjs` | `:51-56` `STAGE_PATHS` (unchanged lists) and `:58` `STAGE_MEMBERS`: add a derived list of single-file members for N(a) | AC-E406-3 | T-E406-01 |
| `scripts/release.mjs` | `:74` `ALLOWED` `git add` rule: also admit exactly `add --update -- <paths>` | AC-E406-5 | T-E406-01 |
| `scripts/release.mjs` | `:331-337` `readStatusPaths`: add a sibling that keeps the `??` flag (tracked vs untracked); `checkScope` and 13a-3 keep the path list | AC-E406-2 | T-E406-01 |
| `scripts/release.mjs` | `:438-468` `step7a`: keep the per-tree fresh root-file lists on `ctx` for N(d) (moves are already on `ctx.archived` for N(c)) | AC-E406-3 | T-E406-01 |
| `scripts/release.mjs` | `:744-775` `classifySpecCheck`: move the `Multi-feature release:` note parsing into one exported helper used by both 8a-3 and 8a-1's N(b) | AC-E406-3 | T-E406-01 |
| `scripts/release.mjs` | `:609-611` `planStage`: unchanged; called with tracked changes only | AC-E406-2, AC-E406-7 | T-E406-01 |
| `scripts/release.mjs` | `:616-623` `checkStagingCompleteness`: add optional `unplanned` input returned as `warnings`, never affecting `pass` | AC-E406-4 | T-E406-01 |
| `scripts/release.mjs` | `:625-661` `step8aStage`: split status into tracked / untracked; build N; `git add --update -- <planStage(tracked)>` then `git add -- <untracked ∩ N>`; partition the `ls-files --others` leftovers into plan-named (→ `untracked`, fatal) and unplanned (→ `unplanned`, warning line per path); dry-run stand-ins classified the same way; nothing-to-commit branch unchanged | AC-E406-1, -2, -4, -6, -7 | T-E406-01 |
| `test/e394-release-script.test.mjs` | `buildTemplate` / `workTree` (`:107-172`): commit `content/foo.md` in the template, edit it in `workTree`; AC-S3 `ALLOW` (`:439-444`) gains `/^git add --update -- \S/`; AC-R11 (`:482-510`) gains the AC-E406-5 shapes; new E406 cases for AC-E406-1/2/3/4/6 | AC-E406-1..6 | T-E406-02 |
| `test/release-staging.test.mjs` | AC2 (E94) Shape 2 (`:254-268`): stays green as written (the pure function still fails on a plan-named leftover); qa updates its comment or adds an `unplanned` assertion so it describes the step's new partition; other pins hold | AC-E406-4 | T-E406-02 |
| `specs/e126-merge-invariants.md` | (c) union paragraph (`:98-130`): `U` = closed ids not found at the merge — done in this PM commit | AC-E203-0 | PM (this hop) |
| `tools/merge-invariants.ts` | `:324-366` `unionReconciliationFailures` (function at `:331`): skip an occurrence whose `task_id` has any row in `merge.rowsById`; reason text per `merge.c.reason`; doc comment updated | AC-E203-1..4 | T-E203-01 |
| `dist/tools/merge-invariants.*` | rebuilt by `npm run build`, committed with the source | AC-E203-5 | T-E203-01 |
| `test/e126-merge-invariants.test.mjs` | new E203 cases (repro passes; dropped T-D-01 fails; under-count with kept T-D-01 fails); existing cases unchanged | AC-E203-1..5 | T-E203-02 |

Existing assertions that move: in `test/e394-release-script.test.mjs`, every
prepare happy-path case through the `workTree` fixture (red until the fixture
commits `content/foo.md`), the AC-S3 allow-list enumeration, and AC-R11 (new
shapes added). Nothing moves in `test/e126-merge-invariants.test.mjs` or in any
file outside the lane's ownership.

Tasks:
- `T-E406-01` [P0] sr-engineer — `scripts/release.mjs` explicit-path staging (all `scripts/release.mjs` rows above) + expected-red manifest | depends_on: none
- `T-E406-02` [P1] qa-engineer — E406 tests and re-pins in `test/e394-release-script.test.mjs`, `test/release-staging.test.mjs` | depends_on: T-E406-01
- `T-E203-01` [P0] sr-engineer — `tools/merge-invariants.ts` (c) fix + `dist/tools/merge-invariants.*` rebuild | depends_on: none (spec amended in the cut commit)
- `T-E203-02` [P1] qa-engineer — E203 tests in `test/e126-merge-invariants.test.mjs` | depends_on: T-E203-01

Release bookkeeping (version, CHANGELOG, backlog done-marks) is not in this
cut: this wave does not release, and done-marks are the integrator's.
