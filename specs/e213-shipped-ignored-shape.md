# e213-shipped-ignored-shape

## Problem Statement
`agc feature finish --shipped` — the default lane-close path since E130 — cannot
complete at all in an adopter workspace shaped like the adopter acceptance project (root
`tasks.md`, `.current/`, `qa_reports/`, `review_reports/` all git-ignored), and
even when forced past that, it silently deletes git-ignored evidence with the
worktree. Both losses were measured 2026-09-27 by the E73 adopter acceptance on
a disposable clone (`specs/e73-adopter-acceptance-2026-09-27.md`, Runs A / A′ /
B) and filed as E213/E214/E216 (human ruling: ship together in lane `e213`,
v4 Wave 7.1f, before E130). `--abandoned` already solved the structurally
identical evidence-loss problem for its own path in E180/E194 (harvest to
primary, not refuse-by-default) — this spec extends that same shape to
`--shipped`, plus one small `--abandoned` output-clarity fix (E216) that fell
out of the same acceptance run.

- **E213** — `planLaneClose` / `executeLaneClose` write the `Closed Lanes`
  pointer into root `tasks.md` and then unconditionally `git add -- tasks.md`.
  When `tasks.md` is git-ignored, git refuses that add; the whole close rolls
  back cleanly but `--shipped` can never succeed in this shape. Sub-item: the
  `harvested untracked .current/<lane>/ …` stdout line prints *before* that
  failing add, so a rolled-back run still claims a harvest that no longer
  exists.
- **E214** — `--shipped` has no evidence check at all (`ABANDON_EVIDENCE_DIRS`
  is consulted only on `--abandoned`). Git-ignored, unlinked files under
  `qa_reports/`/`review_reports/` are deleted with the worktree, exit 0, no
  warning — the exact E111/E180 loss shape, unfixed for this path.
- **E216** — `--abandoned`'s existing `moved <src> -> <dst>` line, printed for
  every evidence file it relocates inside the lane, reads as a second durable
  copy when the file was *also* harvested to primary (E180) — that in-lane
  move is deleted with the worktree seconds later.

**Design decision (PM cut, all three): extend E180's own precedent, do not
introduce a second failure mode.** E180's spec already argued (and this cut
adopts the same reasoning for `--shipped`): harvest-to-primary as the default
remedial action, refusal reserved for the one shape where a copy would itself
be unsafe (a differing file already at the destination). Concretely:

1. **E213 → fs-only pointer write + advisory**, not refuse-up-front. Refusing
   would mean `--shipped` — the E130 default close path — can *never* complete
   for any adopter that ignores its ledger, which is precisely the failure
   this wave exists to close. The pointer stays at its normal path
   (`tasks.md`'s `## Closed Lanes` section); only the `git add`/commit of that
   one path is skipped when it is ignored, mirroring how the existing
   untracked-`.current/` branch of `executeLaneClose` already writes a plain
   file with no git operation on it.
2. **E214 → harvest git-ignored, unlinked `qa_reports/`/`review_reports/`/
   `specs/` evidence into `<dir>/archive/<lane>/`** before
   `removeWorktreeNoForce`, reusing the release-engineer step-7a directory
   convention (`content/skill-release-engineer.md` —
   `qa_reports/archive/<active_feature>/`, a parallel
   `review_reports/archive/<active_feature>/`; `specs/archive/<lane>/` is a
   same-shape extension of that convention, authored here) rather than
   `--abandoned`'s `abandoned/<ticket>/`, since a shipped lane's evidence is
   the same evidence release-engineer will later archive under that exact
   convention. Refuse loudly, before any mutation, only on a differing file
   already at that destination (same shape as E180 AC3). **Integrator
   pre-review ruling (2026-09-27, Q1/Q2)**: `specs/` is in scope for
   `--shipped` (a new `SHIPPED_EVIDENCE_DIRS` array, distinct from
   `--abandoned`'s unchanged `ABANDON_EVIDENCE_DIRS`); the harvest walks each
   dir **recursively**, preserving every file's path relative to the dir root
   and excluding nothing; and any symlink encountered anywhere in that walk
   is either dereferenced (its target resolves — copy the resolved content,
   never a link back into the worktree, closing the E207 shape) or, if it
   does not resolve, causes a loud refusal naming every such path before any
   mutation. `--abandoned`'s own `specs/` gap is a separate, out-of-scope
   finding — see `.current/e213/pending-tickets.md#E213-NEW-1`.
3. **E216 → qualify, not suppress**, the in-lane `moved` line for harvested
   files, so the existing per-file move is still visible for debugging but no
   longer reads as an independent durable copy.

## User Stories
- As a developer running `agc feature finish <ticket> --shipped` in a
  workspace that git-ignores root `tasks.md`, I want the close to complete
  (pointer recorded, worktree removed, branch deleted) instead of failing on
  every single run, so `--shipped` — my default close path — actually works.
- As that same developer, when `qa_reports/`/`review_reports/` are also
  git-ignored and never linked outside the lane, I want my code-review/QA
  evidence automatically preserved in primary before the worktree disappears,
  exactly as `--abandoned` already preserves it (E180), so shipping a lane
  never silently destroys its review trail.
- As a developer re-running a `--shipped` finish that previously failed
  partway, I want the tasks.md fs-write and the evidence harvest to be safely
  repeatable, not to fail or duplicate data on retry.
- As an integrator reading `--shipped`/`--abandoned` stdout, I want every line
  that claims a durable outcome to still be true after the command's actual
  exit code, and every in-lane-only move to be clearly marked as such.

## Acceptance Criteria

### E213 — `tasks.md` git-ignored: fs-only pointer

- **AC1** — Given a lane whose root `tasks.md` is git-ignored
  (`git check-ignore -q -- tasks.md` exits 0 in the primary checkout), when
  `agc feature finish <ticket> --shipped` runs, then the close completes
  (exit 0): the `Closed Lanes` pointer is written into `tasks.md` by a plain
  fs write, `git add -- tasks.md` is never attempted, and stdout prints the
  `e213.tasks-fsonly-line` string (verbatim below) once.
  proof: `node --test test/e213-shipped-ignored-shape.test.mjs`

- **AC2** — Given the same setup as AC1, and the lane's own `.current/<ticket>/`
  is *also* untracked (git-ignored or simply never committed), when
  `--shipped` runs, then the existing untracked-`.current/` harvest (E125b
  AC9) still fires independently — both advisories print, in the order the
  mutations actually happen (E213's fs-write, then the harvest) — and the
  command still completes with exit 0.
  proof: `node --test test/e213-shipped-ignored-shape.test.mjs`

- **AC3** — Given the same setup as AC1, but nothing else about the close
  needs a primary commit (`.current/<ticket>/` is tracked-empty *and*
  untracked with nothing under it — the existing AC9-ZEROWRITE case — so the
  only planned write is the fs-only pointer), when `--shipped` runs, then no
  `git commit` is attempted for the close step at all (an empty pathspec
  commit is never invoked), stdout prints `e213.tasks-nocommit-line` in place
  of the existing "recorded lane … under tasks.md" line, and the command
  still completes with exit 0.
  proof: `node --test test/e213-shipped-ignored-shape.test.mjs`

- **AC4** — Given root `tasks.md` is **not** git-ignored (today's default
  shape), when `--shipped` runs, then behavior is byte-for-byte unchanged
  from before this spec: `git add -- tasks.md` still runs, the commit still
  includes it, and neither `e213.tasks-fsonly-line` nor
  `e213.tasks-nocommit-line` is ever printed.
  proof: `node --test test/agc-feature-finish-history.test.mjs` and
  `node --test test/agc-feature-lifecycle.test.mjs` (existing suites) keep
  passing unchanged.

- **AC5 (sub-item)** — Given a `--shipped` run whose untracked-`.current/`
  harvest (E125b) succeeds but a *later* step in the same call fails and rolls
  back (e.g. the tasks.md write or its `git add`/commit, on a path where
  `tasks.md` is untracked-but-not-ignored), when the command exits non-zero,
  then stdout does **not** contain the `harvested untracked .current/<ticket>/
  …` line for this run — that line and every other close-step advisory are
  buffered and flushed together only once the close step's mutations have all
  durably succeeded (or, when `--shipped` writes nothing else and only the
  fs-only pointer applies, once that write itself has succeeded).
  proof: `node --test test/e213-shipped-ignored-shape.test.mjs` (forces the
  post-harvest failure path and asserts the harvest line is absent from
  stdout of the failing run)

### E214 — `--shipped` evidence harvest

- **AC6** — Given a lane whose `qa_reports/<relpath>` (`<relpath>` may be
  nested, e.g. `sub/dir/<file>`) is untracked, git-ignored
  (`git check-ignore -q` exits 0), and `qa_reports/` is a real directory (not
  a symlink resolving outside the worktree), when
  `agc feature finish <ticket> --shipped` runs, then the file is additionally
  fs-copied into `<primary>/qa_reports/archive/<ticket>/<relpath>` before the
  worktree is removed — the walk is **recursive**, every file at any depth is
  included, nothing is excluded, and each file's path relative to the dir
  root is preserved verbatim at the destination — that copy is **not**
  committed, and stdout prints the `e180.evidence-harvest-line` template
  (reused verbatim from E180, `{dst}` computed under `archive/<ticket>/` in
  place of `abandoned/<ticket>/`) once per harvested file. `review_reports/`
  and `specs/` behave identically (three parallel trees — `SHIPPED_EVIDENCE_
  DIRS`, a new array distinct from `--abandoned`'s unchanged two-entry
  `ABANDON_EVIDENCE_DIRS`; `specs/` per the integrator's 2026-09-27 Q1
  ruling, matching the release-engineer step-7a archive convention). Unlike
  `--abandoned`, no ticket-token filename match is required — **every**
  at-risk file anywhere under `qa_reports/`/`review_reports/`/`specs/` in the
  lane is harvested (see Open Design Choices below).
  proof: `node --test test/e213-shipped-ignored-shape.test.mjs`

- **AC7** — Given the same file, but its dir (`qa_reports/`, `review_reports/`,
  or `specs/`) **is** a symlink resolving outside the worktree (the coord-03
  bootstrap case), when `--shipped` runs, then no primary copy is made and no
  harvest line is printed for that dir — the file's true location already
  survives `git worktree remove` on its own.
  proof: `node --test test/e213-shipped-ignored-shape.test.mjs`

- **AC8** — Given an evidence file that would harvest per AC6, but
  `<primary>/qa_reports/archive/<ticket>/<file>` already exists with
  **different** bytes, when `--shipped` runs, then it refuses before moving,
  copying, or committing anything (the read-only planning phase, alongside
  `planLaneClose`, before any mutation), printing the
  `e180.evidence-harvest-refuse-line` template (reused verbatim, same
  `archive/` destination substitution), and the worktree, branch, and every
  other close-step file are left exactly as they were.
  proof: `node --test test/e213-shipped-ignored-shape.test.mjs`

- **AC9** — Given the same conflicting-destination setup as AC8 but the bytes
  are **identical** (a re-run after a prior partial failure), when
  `--shipped` runs, then it does not refuse, makes no new copy, and finishes
  normally (idempotent, same reasoning as E180 AC4/AC6).
  proof: `node --test test/e213-shipped-ignored-shape.test.mjs`

- **AC10** — Given an evidence file that is untracked but **not**
  git-ignored, when `--shipped` runs, then AC6's harvest does not apply to it
  — git's own plain (no `--force`) `git worktree remove` already refuses over
  an untracked file, so behavior is unchanged from today (mirrors E180 AC5).
  proof: `node --test test/e213-shipped-ignored-shape.test.mjs`

- **AC11** — Given no files at all under `qa_reports/`/`review_reports/`/
  `specs/` in the lane (or those directories absent), when `--shipped` runs,
  then no harvest is attempted for the absent/empty dir(s), nothing errors,
  and no harvest line is printed.
  proof: `node --test test/e213-shipped-ignored-shape.test.mjs`

### End-to-end / regression

- **AC12** — Given the acceptance-project-shaped adopter workspace (fixture:
  `.gitignore` containing exactly `.current/`, `tasks.md`, `/qa_reports/`,
  `/review_reports/`, `/specs/` — the same fixture `makePrimaryRepo` helper
  already used by `test/e180-abandoned-harvest.test.mjs`'s own AC12) with at
  least one matching evidence file in each of the three evidence dirs
  (including a nested `specs/<subdir>/<file>`, per AC17's recursion
  requirement) and a populated, untracked `.current/<ticket>/`, when
  `agc feature finish <ticket> --shipped` runs, then: the tasks.md fs-only
  write (AC1), the `.current/` harvest (E125b), and all three evidence
  harvests (AC6, AC16) all fire, the worktree is removed, the branch is
  deleted, and exit code is 0. This is the end-to-end proof for the real
  Run A/A′ shape from `specs/e73-adopter-acceptance-2026-09-27.md`.
  proof: `node --test test/e213-shipped-ignored-shape.test.mjs`

- **AC13** — `test/e180-abandoned-harvest.test.mjs`, `test/agc-feature-finish-
  history.test.mjs`, and `test/agc-feature-lifecycle.test.mjs` all keep
  passing unchanged (this spec adds new call sites and new functions in
  `bin/agc-init.mjs`; it edits no existing `--abandoned`-only or pointer-
  string logic outside the one E216 line below).
  proof: `npm test`

- **AC16** — Given a lane's `specs/<relpath>` (untracked, git-ignored,
  `specs/` a real directory not linked outside the worktree), when
  `--shipped` runs, then it is harvested into
  `<primary>/specs/archive/<ticket>/<relpath>` under the identical
  refuse-on-differing-conflict (AC8) and idempotent-on-identical (AC9) rules
  already specified for `qa_reports/`/`review_reports/` — `specs/` is a full
  third member of `SHIPPED_EVIDENCE_DIRS`, not a special case. (Integrator
  ruling 2026-09-27, Q1: `--abandoned`'s own `specs/` gap is explicitly
  **not** part of this AC or this ticket — see
  `.current/e213/pending-tickets.md#E213-NEW-1`.)
  proof: `node --test test/e213-shipped-ignored-shape.test.mjs`

- **AC17** — Given any file or symlink at any depth under a dir being
  harvested (`qa_reports/`, `review_reports/`, or `specs/`), when the
  `--shipped` evidence harvest runs, then: every regular file, at any depth,
  is copied preserving its path relative to the dir root, with nothing
  excluded (AC6's recursion requirement, restated precisely here); every
  symlink whose target resolves (`fs.realpathSync` succeeds) is
  **dereferenced** — the resolved file's content is copied to the symlink's
  own relative destination path, so the primary checkout NEVER gains a
  symlink pointing back into the (about-to-be-removed) worktree, closing the
  E207 shape one layer deeper than E180 already closed it; and every symlink
  whose target does **not** resolve causes the harvest for that dir to
  refuse before any mutation, printing the `e214.evidence-harvest-symlink-
  refuse-line` string (verbatim below) naming every such unresolvable path —
  never silently skipped, never silently copied as a dangling link.
  proof: `node --test test/e213-shipped-ignored-shape.test.mjs`

### E216 — `--abandoned` in-lane `moved` line

- **AC14** — Given an evidence file that `planAbandonEvidenceHarvest` marks
  as harvested to primary (whether a fresh copy was made this run, or it was
  already there byte-identical from a prior run — i.e. the file was in the
  "at risk" set at all, independent of `m.harvestAbs` being set), when
  `finish --abandoned` moves it inside the lane, then stdout prints the
  qualified `e216.moved-qualified-line` template (verbatim below) instead of
  the plain `moved {src} -> {dst}` line for that file.
  proof: `node --test test/e213-shipped-ignored-shape.test.mjs`

- **AC15** — Given an evidence file that is moved inside the lane but was
  **not** harvested to primary (tracked, or not git-ignored, or its dir was
  safely linked outside the worktree), when `finish --abandoned` runs, then
  the existing plain `moved {src} -> {dst}` line prints unchanged.
  proof: `node --test test/e180-abandoned-harvest.test.mjs` (existing
  assertions on the plain `moved` line keep passing unchanged) plus a new
  assertion in `test/e213-shipped-ignored-shape.test.mjs`.

## Copy / Strings

| string id | exact text (quote verbatim) | source |
|---|---|---|
| e213.tasks-fsonly-line | `agc feature finish — {tasksRel} is git-ignored here: wrote the lane-close pointer to it directly (fs write, not committed)` | authored-here — mirrors the existing e125b `harvested untracked … (fs copy, not committed — …)` advisory-line style already in `bin/agc-init.mjs`; `{tasksRel}` is the existing `TASKS_REL` constant (`tasks.md`) |
| e213.tasks-nocommit-line | `agc feature finish — lane {ticket} closed with no primary commit (nothing here is git-tracked: {tasksRel} and .current/{ticket}/ are both git-ignored) — the fs-only writes above are this lane's only durable record` | authored-here — printed only in place of the existing "recorded lane … under tasks.md ## Closed Lanes" line, for the one case where that line would otherwise misdescribe an empty commit |
| e180.evidence-harvest-line (reused) | `agc feature finish — harvested git-ignored evidence {src} -> primary {dst} (fs copy, not committed — {dir}/ is git-ignored here and not linked outside the worktree, so \`git worktree remove\` would otherwise delete it silently)` | E180 spec, `content`/string already shipped in `bin/agc-init.mjs`'s `applyAbandonEvidenceHarvest` — reused verbatim for `--shipped`, `{dst}` computed with `archive/{ticket}/` in place of `abandoned/{ticket}/` |
| e180.evidence-harvest-refuse-line (reused) | `agc feature finish --abandoned: harvest destination already exists in the primary checkout and differs (nothing moved):` (one `  {path}` line per conflict follows) | E180 spec, already shipped — reused verbatim; the `--shipped` call site prints the same template with `--shipped` in place of `--abandoned` in the lead sentence, since the existing string is verb-specific text authored inside `planAbandonEvidenceHarvest` (`bin/agc-init.mjs` ~1466) — this spec's `--shipped` counterpart substitutes the verb token, not the rest of the sentence |
| e216.moved-qualified-line | `agc feature finish — moved {src} -> {dst} (inside the lane worktree only — removed with it; the primary copy harvested above is the durable one)` | authored-here — per E216's own ticket text, option "qualify it (in the lane; the primary copy above is the durable one)"; this cut picks qualify over suppress (see Open Design Choices) |
| e214.evidence-harvest-symlink-refuse-line | `agc feature finish --shipped: harvest of {dir}/ found unresolvable symlink(s) — refusing before any mutation (nothing moved):` (one `  {path}` line per unresolvable symlink follows) | authored-here — integrator ruling 2026-09-27 (Q2); mirrors `e180.evidence-harvest-refuse-line`'s "naming every such path, nothing moved" shape, distinguished by the specific cause (a dangling/unresolvable symlink, not a differing destination file) |

## Visual Tokens
| token id | property | value (quote verbatim) | source |
|---|---|---|---|
| N/A | — | — | feature has no visual literals (CLI stdout/stderr only) |

## Visual Widgets
| widget id | description | source-node |
|---|---|---|
| N/A | — | feature has no non-primitive widgets (CLI feature) |

## Open Design Choices (cut decides; PM recommendation + one-line tradeoff each)

1. **E213: fs-only pointer write vs. refuse-up-front.**
   Recommend **fs-only + advisory** (adopted above). Tradeoff: fs-only means
   an untracked `tasks.md` change can appear in `git status` for adopters
   whose `.gitignore` doesn't also cover it consistently (rare — the same
   caveat E125b's harvest line already carries for `.current/history/`);
   refuse-up-front is simpler but means `--shipped` — the E130 default close
   path — can never complete in this shape at all, which is the exact defect
   this wave exists to close.

2. **Pointer location for ignored-ledger adopters: same `tasks.md` path
   (fs-only) vs. a separate location (e.g. under `.current/history/`).**
   Recommend **same path, same `## Closed Lanes` section** (adopted above).
   Tradeoff: reuses `planLaneClose`'s existing `hasClosedLanePointer`/
   `applyClosedLanePointer` idempotency check with zero branching by
   location; a separate location would need its own re-run/idempotency logic
   duplicated from scratch for no behavioral gain.

3. **E214 destination convention: `<dir>/archive/<lane>/` (release-engineer
   step-7a convention) vs. `<dir>/abandoned/<lane>/`-style (`--abandoned`'s
   own convention, e.g. `<dir>/shipped/<lane>/`).**
   Recommend **`archive/<lane>/`** (adopted above), for all three dirs
   including `specs/` (integrator ruling 2026-09-27, Q1 — `specs/` is in
   scope for `--shipped` only). Tradeoff: reusing `archive/` means a lane
   whose evidence release-engineer later re-archives under the same
   convention lands at the same path (harmless — the AC8/AC9 idempotent-copy
   reasoning already covers an identical pre-existing file); a novel
   `shipped/` directory would need its own convention documented and taught
   to release-engineer's SOP, which is out of this lane's owned files.

4. **E214 file selection: harvest every at-risk file under
   `qa_reports/`/`review_reports/`/`specs/` vs. only files matching the
   ticket's token (symmetric with `--abandoned`'s `planAbandonEvidence`).**
   **Decided by the same 2026-09-27 ruling (Q2): no token filter, recursive,
   exclude nothing** — this was already this spec's recommendation and is now
   locked in, not merely PM-recommended. Tradeoff: `--abandoned`'s token
   filter exists because it also *moves* matching files into
   `abandoned/<ticket>/` inside the still-live worktree and deliberately
   leaves non-matching files for another disposition path; `--shipped` has no
   such competing disposition — every file present in a dedicated lane
   worktree's evidence dirs belongs to this ticket, and the worktree is gone
   for good after this call, so filtering by token risks silently losing
   evidence whose filename doesn't literally contain the ticket id (a real
   gap — filenames are not a spec-enforced contract).

7. **E214/AC17 — dangling symlink under a harvested tree: dereference-if-
   resolves vs. always-refuse.** The 2026-09-27 ruling explicitly delegated
   "which of those two" to this spec, only requiring it never be silent.
   **Decided: dereference when the target resolves, refuse (listing every
   path) only when it does not.** Tradeoff: always-refusing on ANY symlink
   (even a healthy one) would be simpler to implement but would make
   `--shipped` fail on the ordinary case of a working symlink inside
   `qa_reports/`/`review_reports/`/`specs/` (e.g. a report symlinked to a
   shared fixture) purely because it's a symlink, not because anything is at
   risk; dereferencing the healthy case and refusing only the genuinely
   unsafe one (E207's exact shape — a link that would dangle once the
   worktree is gone) keeps the harvest maximally permissive while never
   silently producing a broken copy.

5. **`feature start` bootstrap links (mkdir -p + symlink `qa_reports/`,
   `review_reports/`, `specs/` back to primary at start time) — in scope for
   this lane, or deferred.**
   Recommend **defer** (not implemented in this cut). Tradeoff: bootstrap
   links would close the loss one step earlier (no harvest ever needed) but
   change `feature start`'s default behavior for every adopter and every lane
   regardless of whether it ignores anything, redirect where sr-engineer/
   qa-engineer evidence physically lands during work (a bigger blast radius
   for this budget), and the E214 backlog row itself notes any coord-03
   bootstrap-obligation prose rides with E130 (`L-CONTENT`), not this lane;
   E214's finish-time harvest alone already fully closes the data-loss gap
   this ticket is scoped to fix.

6. **E216: qualify vs. suppress the in-lane `moved` line.**
   Recommend **qualify** (adopted above). Tradeoff: qualifying keeps the
   in-lane move visible for debugging (at the cost of a longer line);
   suppressing it entirely is quieter output but removes information an
   integrator might want when auditing exactly what a `--abandoned` run did
   inside the worktree before it was removed.

## Out of Scope
- E215 (git hooks / nested `node_modules` in gitignored generated dirs) — v4
  Wave-post, queued separately.
- E196 / E207 (other queued harvest edge cases) — not this lane.
- E177c (`feature start` reading a fan-out manifest) — untouched, forbidden
  path.
- Any coord-03 prose changes (the Worktree bootstrap obligation write-up) —
  ride with E130 (`L-CONTENT`) if the cut later decides Open Design Choice 5
  differently; this lane touches code only.
- Rewriting the already-shipped E197 `git log -i --grep` pointer-fallback
  string — untouched, already `git-status: shipped` per `docs/backlog.md`.
- Extending either harvest to any directory beyond `qa_reports`,
  `review_reports`, `specs` (for `--shipped` only, per the 2026-09-27
  integrator ruling), and `.current/<ticket>/`.
- **`--abandoned`'s `specs/` harvest** — the same evidence-loss gap this spec
  closes for `--shipped`'s `specs/` (AC16) is NOT fixed here for
  `--abandoned` (whose `planAbandonEvidence`/`ABANDON_EVIDENCE_DIRS` is
  explicitly out of this lane's owned lines, per the E180 spec's own Out of
  Scope). Filed as a pending-ticket instead of silently left unfixed:
  `.current/e213/pending-tickets.md#E213-NEW-1` (integrator ruling
  2026-09-27, Q1).
- `agc check`'s `checkWorktreeEvidence` pre-flight advisory — unrelated
  finish-time enforcement, not touched.

## Dependencies / Prerequisites
- No external references (Figma/URL/JIRA/Azure DevOps/etc.) appear in the
  source tickets (`docs/backlog.md` E213/E214/E216 rows,
  `specs/fanout-wave7.md` e213 row, `specs/e73-adopter-acceptance-2026-09-27.md`,
  `docs/lane-protocol.md`) — Resource Audit Gate: zero hits, field omitted.
- No `design/e213-shipped-ignored-shape.md` exists and this is a non-visual
  CLI feature — Scope Decision Gate and Visual Structural Assertions section
  are both not triggered (no design mode armed); `scope_decision:
  "single-feature"` will be set on the routing write.
- **Reuse, do not reimplement**: `isSafelyLinkedOutside`, `hasTrackedContent`,
  `sameFileBytes`, `lstatOrNull`, `isDirectoryPath`, `listWorktrees`,
  `lanePaths.resolveHistoryBucket`/`resolveHistoryLaneDir` (already imported
  as `lanePaths` in `bin/agc-init.mjs`), and E180's own
  `evidenceAtRisk`/`planAbandonEvidenceHarvest`/`applyAbandonEvidenceHarvest`
  helpers as the template for the new `--shipped` counterparts (new sibling
  functions, e.g. `planShippedEvidenceHarvest`/`applyShippedEvidenceHarvest`
  — do not fold the two verbs' harvest logic into one shared function whose
  signature changes touch `--abandoned`'s existing call site). A new
  `SHIPPED_EVIDENCE_DIRS = ["qa_reports", "review_reports", "specs"]` constant
  is added alongside the existing `ABANDON_EVIDENCE_DIRS` (unchanged,
  2-entry, `--abandoned`'s own owned constant — do not edit its value or
  reuse it for `--shipped`). The recursive walk (AC6/AC17) is new code, not a
  generalization of `planAbandonEvidence`'s existing directory loop, which
  intentionally stays direct-children-only and token-filtered for
  `--abandoned`.
- New E213/E214 logic is inserted into the existing **read-plan-then-mutate**
  discipline already documented at `runFeatureFinish`'s `--shipped` branch
  (`bin/agc-init.mjs` ~2338, comment "Every refusal … runs before the first
  mutation"): the evidence-harvest plan (E214) and the `tasks.md`-ignored
  check (E213) are computed alongside `planLaneClose`, before
  `assertPrimaryWritable`; the evidence harvest's apply step runs from inside
  `executeLaneClose` or immediately after it, before `removeWorktreeNoForce`
  (~line 2382) — never inside `planAbandonEvidence`/`applyAbandonEvidence`,
  which are `--abandoned`'s own owned lines.
- `git check-ignore -q -- <path>` must be run **per file**, never per
  directory (see `hasIgnoredUntrackedContent`'s comment, ~line 700, and
  E180's own Dependencies note) — a directory holding even one tracked file
  reports "not ignored" from git even though the rule still applies to every
  untracked file inside it.
- Test fixture: reuse `test/e180-abandoned-harvest.test.mjs`'s
  `makePrimaryRepo`/`runAgc`/`mergeLane`/`historyBucket` helpers (already
  shaped for this exact adopter fixture, including its own AC12 test using
  the identical `.gitignore` contents this spec's AC12 needs) rather than
  reimplementing fixture setup in the new file.
