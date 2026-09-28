# e180-abandoned-harvest

## Problem Statement
`agc feature finish --abandoned` moves matching evidence files (`qa_reports/`,
`review_reports/`) into `<dir>/abandoned/<ticket-id>/` and then calls
`removeWorktreeNoForce`, which runs a plain (never `--force`) `git worktree
remove`. That native git command refuses when the worktree holds tracked
modifications or plain untracked files — but it does **not** refuse over
git-ignored content: it silently deletes it along with the rest of the
worktree. Two concrete data-loss shapes follow the same pattern (measured
2026-09-24 against E73's adopter-acceptance repo, where
`qa_reports/`, `review_reports/` **and** `.current/` are all git-ignored and
the lane skipped the coord-03 bootstrap symlink):

- **E180** — an evidence file that matches the ticket's token (so it gets
  "moved" into `abandoned/<ticket-id>/`) but is itself git-ignored, and whose
  containing directory is a real directory (or a symlink resolving *inside*
  the worktree, or a dangling symlink) rather than a symlink resolving
  *outside* it. The tool prints `moved <src> -> <dst>`, exits 0, and the file
  is gone the moment the worktree is removed. This is exactly the failure
  shape E111 (and `agc check`'s `checkWorktreeEvidence` advisory) exist to
  flag, except `finish --abandoned` has no equivalent check on its own
  mutation path.
- **E194** (folded into E180, human decision 2026-09-26; ships together) —
  `.current/<lane>/` is never touched by `--abandoned` at all. When it is
  tracked on the lane's own branch, that's fine — the branch is deliberately
  kept (AC26), so the content is recoverable from branch history. When it is
  git-ignored (or otherwise never committed), it is the lane's *only* copy of
  its own governance record (handoff, tasks ledger, pending-tickets,
  telemetry) and it disappears with the worktree, silently. `--shipped`
  already solves the structurally identical problem for the tracked-vs-
  ignored `.current/<lane>/` shape via E125b's AC9 fs-copy harvest into
  `.current/history/<YYYY-MM>/<lane>/`, committed nowhere, just left as a
  durable filesystem copy in primary.

**Design decision (PM cut, both tickets): harvest-to-primary, not
refuse-by-default.** The ticket text offers both options ("first move/copy it
back to primary or refuse loudly"). This spec picks **copy-to-primary as the
default remedial action**, with refusal reserved for the narrow case where a
copy would itself be unsafe (a differing file already at the destination).
Rationale:
1. `--shipped` already established this exact precedent for `.current/`
   (E125b AC9): fs-copy, never committed, advisory line, and an explicit
   re-harvest note when re-run after a partial failure. Extending the same
   shape to `--abandoned` (both for `.current/` and for evidence files) is
   more consistent than introducing a second, harder failure mode
   (hard-refuse) for the same underlying risk.
2. `--abandoned` already writes into primary today (`applyPendingOnAbandoned`
   commits allocated tickets into `docs/backlog.md` on `--base`) — harvesting
   evidence/`.current/` into primary is not a new category of side effect for
   this command, just a new destination.
3. The real adopter shape this must cover end-to-end (the adopter acceptance project:
   *everything* — `qa_reports/`, `review_reports/`, `.current/` — is
   git-ignored) would make `--abandoned` refuse on essentially every
   abandonment if refusal were the default, defeating the point of an
   abandon-and-forget path. A hard refusal is kept, but only for the one
   shape where copying would be genuinely unsafe (see AC3, AC9).

## User Stories
- As a developer running `agc feature finish <ticket> --abandoned` in a
  workspace that git-ignores `qa_reports/`/`review_reports/` and never set up
  the coord-03 bootstrap symlink, I want my code-review/QA evidence
  automatically preserved in primary before the worktree disappears, so
  abandoning a lane never silently destroys its review trail.
- As the same developer, when that workspace also git-ignores `.current/`, I
  want the lane's governance record (`handoff.md`, its task ledger,
  `pending-tickets.md`, telemetry) copied into
  `.current/history/<YYYY-MM>/<ticket>/` before the worktree goes, so an
  abandoned lane's history is findable later the same way a shipped lane's is.
- As that developer re-running a `finish --abandoned` that previously failed
  partway (e.g. the pending-ticket commit or the evidence commit failed), I
  want the harvest steps to be safely repeatable, not to fail or duplicate
  data on retry.
- As an integrator reviewing `finish --abandoned` output, I want a harvest to
  say plainly what was copied and why, and a refusal (when one fires) to say
  plainly what blocked it and that nothing was moved.

## Acceptance Criteria

- **AC1** — Given a lane whose `qa_reports/<ticket>-report.md` matches the
  abandon token, is untracked, is git-ignored (`git check-ignore` exits 0 on
  the file), and `qa_reports/` is a real directory (not a symlink resolving
  outside the worktree), when `agc feature finish <ticket> --abandoned` runs,
  then the file is additionally fs-copied into
  `<primary>/qa_reports/abandoned/<ticket>/<file>` before the worktree is
  removed, that copy is **not** committed, and stdout prints the
  `e180.evidence-harvest-line` string (verbatim below) once per harvested
  file, in addition to the existing `moved <src> -> <dst>` line for the same
  file (AC1 does not remove or change that existing line).
  proof: `node --test test/e180-abandoned-harvest.test.mjs`

- **AC2** — Given the same setup as AC1 but `qa_reports/` **is** a symlink
  that resolves outside the worktree (the coord-03 bootstrap case), when
  `finish --abandoned` runs, then no primary copy is made and no
  `e180.evidence-harvest-line` is printed — the pre-existing `moved` behavior
  is the only effect, because the file's true location is already outside
  the worktree and survives `git worktree remove` on its own.
  proof: `node --test test/e180-abandoned-harvest.test.mjs`

- **AC3** — Given an evidence file that would harvest per AC1, but
  `<primary>/qa_reports/abandoned/<ticket>/<file>` already exists with
  **different** bytes than the lane's copy, when `finish --abandoned` runs,
  then it refuses before moving or committing anything, printing the
  `e180.evidence-harvest-refuse-line` string (verbatim below) naming the
  conflicting destination path(s), and the worktree and branch are left in
  place. This refusal is computed in the read-only planning phase
  (`planAbandonEvidence`), before any of the existing mutations
  (pending-ticket archive commit, evidence move commit) run — same hoisting
  discipline as the existing "uncommitted changes unrelated to `<ticket>`
  evidence" and "destination already exists" refusals in the same function.
  proof: `node --test test/e180-abandoned-harvest.test.mjs`

- **AC4** — Given the same conflicting-destination setup as AC3 but the
  bytes are **identical**, when `finish --abandoned` runs, then it does not
  refuse — this is treated as a safe re-run (see AC6) and finishes normally.
  proof: `node --test test/e180-abandoned-harvest.test.mjs`

- **AC5** — Given an evidence file that is untracked but **not** git-ignored
  (a plain uncommitted file with no `.gitignore` rule covering it), when
  `finish --abandoned` runs, then AC1's harvest logic does not apply to it
  (it is not "at risk" by this spec's definition) and the pre-existing
  native behavior is unchanged: it gets `moved` into `abandoned/<ticket>/`
  same as before, remains untracked at its new path, and the plain (no
  `--force`) `git worktree remove` refuses over that untracked file exactly
  as it does today — this spec adds no new handling for that shape because
  git's own worktree-remove refusal already protects it.
  proof: `node --test test/e180-abandoned-harvest.test.mjs`

- **AC6** — Given a `finish --abandoned` run that harvested one or more
  evidence files per AC1, then failed at a later step (e.g. the evidence
  commit), when the same `finish --abandoned <ticket>` is re-run, then it
  does not error on the already-harvested primary copies (AC4) and the
  worktree removal proceeds once the earlier failure's cause is resolved —
  i.e. the evidence harvest is idempotent.
  proof: `node --test test/e180-abandoned-harvest.test.mjs`

- **AC7** — Given a lane whose `.current/<ticket>/` directory exists in the
  worktree, holds no tracked content at all (`git ls-files -- .current/<ticket>`
  is empty on the lane's own branch — the git-ignored-`.current/` adopter
  shape), when `finish --abandoned` runs, then `.current/<ticket>/` is
  fs-copied in full (every file, no exclusions — unlike `--shipped`'s
  harvest, `base-sha` is **not** excluded here because `--abandoned` writes
  no pointer line that would otherwise duplicate its content) into
  `.current/history/<YYYY-MM>/<ticket>/` in primary before
  `removeWorktreeNoForce` runs, that copy is **not** committed, and stdout
  prints the `e194.current-harvest-line` string (verbatim below) once.
  proof: `node --test test/e180-abandoned-harvest.test.mjs`

- **AC8** — Given a lane whose `.current/<ticket>/` **is** tracked (has at
  least one file in the branch's own index), when `finish --abandoned` runs,
  then no harvest copy is made and no `e194.current-harvest-line` is
  printed — the content is already durable via the kept branch (AC26 of the
  existing lifecycle tests), unchanged from today's behavior.
  proof: `node --test test/e180-abandoned-harvest.test.mjs`

- **AC9** — Given `.current/history/<YYYY-MM>/<ticket>/` already exists in
  primary and is **not a directory** (a stray file blocking it), when
  `finish --abandoned` runs, then it refuses before any mutation, printing
  the `e194.current-harvest-refuse-line` string (verbatim below), and the
  worktree and branch are left in place.
  proof: `node --test test/e180-abandoned-harvest.test.mjs`

- **AC10** — Given `.current/history/<YYYY-MM>/<ticket>/` already exists in
  primary **as a directory** (a prior run of this same lane's harvest, or a
  retried finish after an earlier step failed), when `finish --abandoned`
  runs, then it overwrites/refreshes that directory from the lane's current
  `.current/<ticket>/` contents rather than refusing — the same
  "overwriting is lossless by construction, since agc's only writer of this
  history dir is this same harvest" reasoning `--shipped`'s AC9-R1 re-harvest
  already relies on — and finishes normally. The refresh is a **copy-over,
  never a delete**: files from the lane overwrite same-named files in the
  history dir, and files already in the history dir that the lane source does
  not have are **kept** (e.g. an earlier harvest under the same ticket id).
  An `rm`-then-copy implementation fails this AC. (Amended 2026-09-27 per
  integrator pre-review, to-lane.md#1.)
  proof: `node --test test/e180-abandoned-harvest.test.mjs` (a pre-seeded
  history-only file survives the re-harvest byte-identical)

- **AC11** — Given a lane whose `.current/<ticket>/` directory does not
  exist at all in the worktree, when `finish --abandoned` runs, then no
  harvest copy is attempted, nothing errors, and no
  `e194.current-harvest-line` is printed (mirrors `--shipped`'s
  AC9-ZEROWRITE).
  proof: `node --test test/e180-abandoned-harvest.test.mjs`

- **AC12** — Given the acceptance-project-shaped adopter workspace (no
  coord-03 bootstrap symlink; `qa_reports/`, `review_reports/`, and
  `.current/` all git-ignored) with at least one matching evidence file and
  a populated, untracked `.current/<ticket>/`, when `finish --abandoned`
  runs, then: both harvests (AC1 and AC7) fire, both are logged, the
  worktree is removed, the branch is kept, and re-running the same command
  afterward (once the worktree is already gone — i.e. `agc feature finish`
  reports "no linked worktree found") is not required to be idempotent
  (there is nothing left to re-run against); the idempotency guarantee
  (AC6, AC10) covers a re-run **before** the worktree is removed, not after.
  This is the end-to-end proof for the real post-merge use case.
  Fixture shape (amended 2026-09-27 per integrator pre-review, to-lane.md#1 —
  mirrors the adopter acceptance project's actual repo): the fixture's `.gitignore` contains
  exactly these rules — `.current/` (unanchored), `tasks.md`,
  `/qa_reports/`, `/review_reports/`, `/specs/` (the last three with a
  leading slash, so `git check-ignore`'s anchored matching is really
  exercised). The fixture primary's `.current/` is the **flat legacy shape**
  (`.current/handoff.md`, `.current/tasks.md`, `.current/archive/`, no lane
  directories); the test asserts those flat files are neither modified nor
  moved by the harvest into `.current/history/<YYYY-MM>/<ticket>/`.
  proof: `node --test test/e180-abandoned-harvest.test.mjs`

- **AC13** — Given `closedLanePointerLine`'s composed pointer text (used only
  by `--shipped`, unaffected by AC1–AC12), when any *new* pointer line is
  composed, then its fallback clause reads `git log -i --grep <ticket> is the
  universal fallback` (lowercase `-i` flag added; case-insensitive match, so
  a lane named `e125b` still finds a commit subject `E125b T-E125B-01 — …`).
  Pointer lines already committed before this change are **not** rewritten
  (append-only — same rule as every other `.current/history/` artifact in
  this repo).
  proof: `node --test test/agc-feature-finish-history.test.mjs` (existing
  pointer-parsing tests must keep passing unchanged — the parenthetical
  clause is captured by a non-greedy `.*?`, not asserted verbatim there) plus
  a new assertion in `test/e180-abandoned-harvest.test.mjs` that a freshly
  composed pointer contains `git log -i --grep`.

## Copy / Strings

| string id | exact text (quote verbatim) | source |
|---|---|---|
| e180.evidence-harvest-line | `agc feature finish — harvested git-ignored evidence {src} -> primary {dst} (fs copy, not committed — {dir}/ is git-ignored here and not linked outside the worktree, so \`git worktree remove\` would otherwise delete it silently)` | authored-here — mirrors the existing `moved {src} -> {dst}` and e125b `harvested untracked …` line styles already in `bin/agc-init.mjs`; `{src}`/`{dst}` are the same relative paths already used by the existing `moved` line, `{dir}` is `qa_reports` or `review_reports` |
| e180.evidence-harvest-refuse-line | `agc feature finish --abandoned: harvest destination already exists in the primary checkout and differs (nothing moved):` (one `  {path}` line per conflict follows) | authored-here — mirrors the existing `destination already exists (nothing moved):` refusal in the same function verbatim except for the `in the primary checkout and differs` clause, which disambiguates it from that existing local-destination refusal |
| e194.current-harvest-line | `agc feature finish — harvested untracked .current/{ticket}/ into .current/history/{bucket}/{ticket}/ (fs copy, not committed — {reason}; if your .gitignore does not also cover .current/history/, this copy will show up as untracked in \`git status\` here)` where `{reason}` is `the source path is git-ignored in this workspace` or `this lane never committed .current/{ticket}/ on {branch}, so there was nothing durable to keep` | authored-here — verbatim reuse of e125b's `harvest-advisory-line` string (`--shipped`'s AC9), reworded only for `{branch}` in place of `{base}` since `--abandoned` reads from the branch, never `--base` |
| e194.current-harvest-refuse-line | `agc feature finish --abandoned: .current/history/{bucket}/{ticket}/ already exists in the primary checkout and is not a directory — move it aside first (nothing moved, worktree left in place)` | authored-here — mirrors `--shipped`'s planLaneClose "already exists in the primary checkout" refusal wording |
| e197.pointer-fallback-string | `git log -i --grep {ticket} is the universal fallback` | E197 ticket text (docs/backlog.md line ~320): "Change to `git log -i --grep`." — the ticket names the exact replacement token |

## Visual Tokens
| token id | property | value (quote verbatim) | source |
|---|---|---|---|
| N/A | — | — | feature has no visual literals (CLI stdout/stderr only) |

## Visual Widgets
| widget id | description | source-node |
|---|---|---|
| N/A | — | feature has no non-primitive widgets (CLI feature) |

## Out of Scope
- Rewriting already-committed `lane_closed:` pointer lines (append-only,
  per E197's own text and the repo-wide `.current/history/` convention).
- `feature start` reading a fan-out manifest (E177c) — untouched, forbidden
  path.
- Any change to the `--shipped` path itself (`planLaneClose`,
  `executeLaneClose`, `executeHarvestRefresh`, `planPendingOnShipped`,
  `commitPendingOnShipped`) beyond the one `closedLanePointerLine` string
  (E197). `--abandoned` gets its own, separate harvest functions rather than
  a shared refactor, specifically so this ticket's diff never touches
  `--shipped`'s owned lines.
- `agc check`'s `checkWorktreeEvidence` advisory (the `agc check` — warning:
  ... symlink it back …\` messages) — that is a pre-flight, exit-0 advisory
  covering `qa_reports/`, `review_reports/`, `specs/` before build; this spec
  is a `finish`-time enforcement covering `qa_reports/`, `review_reports/`,
  and `.current/` (no `specs/` — `ABANDON_EVIDENCE_DIRS` has never included
  it, and AC25 of the existing lifecycle tests already pins that). The two
  do not need to agree on directory coverage; no change to
  `checkWorktreeEvidence` is in scope.
- Extending harvest-on-abandon to any directory beyond
  `ABANDON_EVIDENCE_DIRS` (`qa_reports`, `review_reports`) and
  `.current/<ticket>/` — e.g. `specs/` is explicitly out (AC25 precedent).

## Dependencies / Prerequisites
- No external references (Figma/URL/JIRA/Azure DevOps/etc.) appear in the
  source tickets (docs/backlog.md E180/E194/E197 rows, docs/lane-protocol.md,
  specs/fanout-wave7.md) — Resource Audit Gate: zero hits, field omitted.
- No `design/e180-abandoned-harvest.md` exists and this is a non-visual CLI
  feature — Scope Decision Gate and Visual Structural Assertions section are
  both not triggered (no design mode armed).
- **Reuse, do not reimplement**, these existing helpers already in
  `bin/agc-init.mjs` (all outside the owned-lines range — call them, do not
  edit them): `isSafelyLinkedOutside(cwd, target)` (symlink-resolves-outside
  check — already exactly what AC1/AC2's "directory is not a link resolving
  outside the worktree" test needs), `hasTrackedContent(cwd, rel)` (AC8's
  tracked-vs-untracked check — call with `lanePath` and
  `.current/<ticket>` as `rel`, not `repoRoot`, since `--abandoned` judges
  the lane's own branch/index, never `--base`), `sameFileBytes(a, b)` (AC3/
  AC4's conflict-vs-identical distinction), `lstatOrNull`, `isDirectoryPath`,
  `listWorktrees(anyWorktreePath)` (its **first** entry is always primary,
  per the existing `resolvePrimaryRepoRoot` usage at
  `listWorktrees(top)[0]?.path` — this is how `planAbandonEvidence` obtains
  `repoRoot` internally without a signature change, since one of its two call
  sites — inside `applyPendingOnAbandoned` — is outside this lane's owned
  lines and must not be edited), and `lanePaths.resolveHistoryBucket(now)` /
  `lanePaths.resolveHistoryLaneDir(repoRoot, bucket, ticket)` (the exact
  `.current/history/<YYYY-MM>/<ticket>/` path helpers `--shipped` already
  uses — both are already exported from `tools/lane-paths.ts` and imported
  into `bin/agc-init.mjs` as `lanePaths`).
- `git check-ignore -q -- <path>` must be run **per file**, never per
  directory — a directory holding even one tracked file reports "not
  ignored" from git even though the ignore rule still applies to every
  untracked file inside it (this exact quirk is already documented in this
  file's `hasIgnoredUntrackedContent` comment, ~line 700).
- New harvest logic lives in `planAbandonEvidence`/`applyAbandonEvidence`
  (E180) and new sibling functions called from the `--abandoned` branch of
  `runFeatureFinish` (E194), inserted before its `removeWorktreeNoForce`
  call — never inside `applyPendingOnAbandoned`, whose own two mutations
  (pending-ticket commit; evidence-move commit) and single existing call to
  `planAbandonEvidence` are outside this lane's owned lines.
