# e124-lane-ticket-allocation

## Problem Statement

A lane worktree that files a new backlog finding mid-run has no safe way to
number it: two lanes forked from the same base both read "max is E176" and
both mint E177, and because each lane appends its own row the collision is
**semantically** invisible to a textual `git merge` (`docs/backlog.md` §E124
row; live incident class, not theoretical — E106-E118, E119-E122 and the
current batch of rows were each filed by a different concurrent session).
Today's manual discipline (`v4.0.0-execution-plan.md` §2.4) works around this
by having lanes write lane-prefixed placeholder codes (`<LANE>-NEW-n`) into a
free-form `NEW-TICKETS.md` and having a human integrator serialize real ids
by hand at merge time. That discipline does not scale past the v4 execution
window and has no mechanism at all for the case where the lane filing the
finding is later abandoned rather than merged — its `NEW-TICKETS.md` simply
dies with the worktree unless something notices.

This ticket builds the pure-logic core that makes id allocation structurally
collision-free (single writer, each apply observes the prior apply's result)
and makes an abandoned lane's unapplied findings detectable instead of
silently lost. It does not wire either mechanism into a CLI or SOP — that is
E124b (see Out of Scope).

## User Stories

- As a lane working a ticket, I want to file a new finding without picking a
  real backlog id, so that my lane can never collide with a sibling lane's
  numbering.
- As the (future, E124b-wired) release-time allocator, I want a pure function
  that takes the current max id plus every lane's pending entries and returns
  sequential ids with dependencies resolved, so that running it once per
  apply is enough to guarantee no collision.
- As `agc check` / the Backlog Intake Loop (future, E124b-wired), I want a
  pure function that flags a branch carrying an unapplied pending-tickets
  file whose worktree no longer exists, so an abandoned lane's findings are
  never silently lost.

## Acceptance Criteria

**Module**: `tools/lane-ticket-allocation.ts` (new; sr-engineer/PM-picked
name — no architect pass needed, see cut notes). Pure functions only, no
`fs`/`child_process` imports in the exported surface — every impure edge
(reading `.current/<lane>/pending-tickets.md`, reading `docs/backlog.md`,
running `git worktree list`/`git branch`, writing the result back) is an
explicit argument or return value, left for the caller (E124b wiring).

- **AC1** — `.current/<lane>/pending-tickets.md` (file location per AC7's
  rationale — not the worktree root) is designed to become the **single
  source of truth** for ticket candidates once wired (E124b), not an
  additive parallel log kept forever alongside `NEW-TICKETS.md`. A
  ticket-candidate entry destined for `allocateTicketIds` lives there as one
  or more fenced ```` ```pending-ticket ```` YAML blocks. Each block carries
  `lane_local_id` (reusing the existing `<LANE>-NEW-n` token so it can still
  be cross-referenced against the `NEW-TICKETS.md` entry it originated
  from, if any), `title`, `priority`, `depends_on`, optional `source`, and a
  `body` field that may hold arbitrary free-form prose — so a later
  migration of today's rich `NEW-TICKETS.md` findings language does not
  require rewriting it into a stricter shape — and no `id`/`E<n>` field
  anywhere in the file.
  **This cut changes nothing about today's convention.** Every lane
  continues to write `NEW-TICKETS.md` exactly as it does today (free-form
  per-lane discussion log, human-curated promotion) — this ticket builds
  the parser/allocator module only; nothing in this cut requires, or even
  enables, a lane to write `pending-tickets.md` instead of, or in addition
  to, `NEW-TICKETS.md`. `NEW-TICKETS.md`'s retirement as the
  ticket-candidate source, once E124b wires the allocator into real
  dispatch, is recorded in Out of Scope, not enacted here.
  proof: `test/lane-ticket-allocation.test.mjs` — `"parsePendingTickets ignores NEW-TICKETS.md-shaped prose and extracts only fenced pending-ticket blocks"`.

- **AC2** — `parsePendingTickets(fileText: string, lane: string): { entries: PendingTicketEntry[]; errors: string[] }`
  extracts every well-formed fenced block into a `PendingTicketEntry` (fields:
  `laneLocalId`, `title`, `priority`, `dependsOn: string[]`, `source?`,
  `body`, `lane` — `lane` comes from the function argument, never parsed out
  of the file). A block missing `lane_local_id`, `title`, or `priority` is
  skipped and recorded in `errors` (human-readable, names the block's
  position) rather than aborting the whole parse — same degrade-honest
  posture as `tools/lane-registry.ts` (never silently drop everything for one
  bad entry).
  proof: `test/lane-ticket-allocation.test.mjs` — `"parses N valid blocks"` and `"a malformed block is skipped and reported, siblings still parse"`.

- **AC3** — `allocateTicketIds(input: { currentMaxId: number; batches: { lane: string; entries: PendingTicketEntry[] }[] }): AllocationResult`
  assigns sequential ids starting at `currentMaxId + 1`, processing batches in
  the given array order and entries within a batch in array order (pure,
  deterministic — caller owns any cross-lane ordering policy, e.g.
  alphabetical by lane, as part of the out-of-scope wiring). Each
  `AllocatedTicket` carries its `id` (`"E<n>"`), `laneLocalId`, `lane`,
  `title`, `priority`, resolved `dependsOn`, `body`, and a fully formatted
  `backlogRow` string ready to append to `docs/backlog.md`'s ticket table.
  proof: `test/lane-ticket-allocation.test.mjs` — `"allocateTicketIds assigns sequential ids across batches in input order"`.

- **AC4** — Dependency remapping. Given entry A with
  `depends_on: ["E109", "L-X-NEW-2"]` and entry B (`lane_local_id:
  L-X-NEW-2`) present in the same `allocateTicketIds` call, A's resolved
  `dependsOn` is `["E109", "<B's newly allocated id>"]` — an existing
  `E<n>`-shaped reference passes through unchanged, a lane-local reference
  resolvable within the same call is rewritten to the real id, and a
  reference that matches neither shape is placed in
  `AllocationResult.unresolvedDependencies` (never silently dropped, never
  silently left as a dangling lane-local token in a shipped backlog row).
  proof: `test/lane-ticket-allocation.test.mjs` — `"resolves same-batch lane-local dependency to its allocated id"` and `"an unresolvable depends_on is surfaced in unresolvedDependencies, not silently dropped"`.

- **AC5** — Collision-freedom is structural under the single-writer,
  sequential-apply discipline this function assumes but does not itself
  enforce. Calling `allocateTicketIds` a second time with `currentMaxId`
  re-derived from the just-updated backlog (i.e. the first call's highest
  allocated id) never repeats an id from the first call. This documents the
  collision-freedom contract (single writer, each apply observes the prior
  apply's result) that makes the E124 backlog row's core claim true; actually
  sequencing real applies one-at-a-time is release-engineer SOP wiring
  (E124b, out of scope).
  proof: `test/lane-ticket-allocation.test.mjs` — `"two sequential allocateTicketIds calls with re-derived currentMaxId never repeat an id"`.

- **AC6** — `extractMaxBacklogId(backlogText: string): number` returns the
  highest **base** number found across every ticket-table row shaped
  `| E<digits><optional letters> |` at the very start of a row — only the
  row's leading cell counts; an `E<n>` mentioned in a later cell or in prose
  is never counted. A sub-lettered split id (e.g. `E174a`, `E9A`) counts by
  its base number (174, 9 respectively) — this **reverses** an earlier draft
  of this AC that ignored sub-lettered ids entirely, which would have
  undercounted the true max. The test uses a small fixed fixture embedded in
  the test file, never a read of the live `docs/backlog.md` (decouples the
  test from backlog growth):
  ```
  | E1 | first ticket, mentions E999 in prose | P2 | none | 1 | — |
  | E9A | split-lettered ticket | P1 | E1 | 1 | — |
  | E50 | another ticket, body references depends on E999 too | P1 | none | 1 | — |
  | E174a | split ticket, base counts as 174 | P1 | E174 | 1 | — |
  ```
  Expected `extractMaxBacklogId` result on this fixture: **174** (from
  `E174a`'s base) — proving both that a suffixed id's base number is counted
  (174 and 9 both parse correctly) and that the two `E999` prose mentions,
  never in a row's leading cell, do not inflate the max.
  proof: `test/lane-ticket-allocation.test.mjs` — `"extractMaxBacklogId counts suffixed ids by base number and ignores prose-embedded ids, using a fixed fixture"`.

- **AC7** — `detectOrphanLanes(branches: { branch: string; hasUnappliedPendingTickets: boolean }[], liveWorktreeBranches: string[]): { orphans: string[] }`
  is pure plain-data set logic — it never shells out to git itself — and it
  compares **branch names against branch names**, never branch names against
  lane names. (An earlier draft of this AC compared `branch` values like
  `feat/e124-lane-ticket-allocation` against lane names like `e124`, which
  would have flagged every real branch as an orphan.) `liveWorktreeBranches`
  is the branch-name shape `git worktree list --porcelain` yields (one
  `branch refs/heads/<name>` line per worktree); the caller normalizes both
  sides consistently (e.g. strips `refs/heads/`) before calling — this
  function does exact string equality, nothing more.
  `hasUnappliedPendingTickets` is **not** "the file exists": after
  `markApplied` runs the file still exists (entries move to an `## Applied`
  archive section, AC8), so existence alone would misreport an
  already-applied lane as an orphan forever. The correct signal, computed by
  the caller before calling this function, is
  `parsePendingTickets(fileText, lane).entries.length > 0` — at least one
  **unapplied** entry remains.
  `detectOrphanLanes` returns exactly the branches where
  `hasUnappliedPendingTickets === true` and the branch is absent from
  `liveWorktreeBranches`, `[]` on empty input.
  **The pending file MUST be git-committed on the lane branch.** The orphan
  check is specifically "what does this branch still carry after its
  worktree is gone" — a worktree directory disappears with `git worktree
  remove`; only committed content survives on the branch for a later `git
  show <branch>:.current/<lane>/pending-tickets.md`-style read (impure,
  caller-owned, out of scope here) to find. An uncommitted
  `pending-tickets.md` is invisible to the orphan check by construction.
  **Multi-lane branches**: a branch could in principle carry more than one
  `.current/<lane>/pending-tickets.md` if its worktree changed active lane
  mid-life; the caller ORs across every such path on that branch to compute
  one `hasUnappliedPendingTickets` boolean before calling this function —
  the function's signature does not change to accommodate that case, since
  it only ever sees the already-reduced boolean.
  proof: `test/lane-ticket-allocation.test.mjs` — `"detectOrphanLanes finds branches with a pending file whose worktree is gone, ignores branches without one"`, `"a branch-name vs lane-name mismatch does not falsely orphan a live branch"`.

- **AC8** — `markApplied(fileText: string, appliedLaneLocalIds: string[]): string`
  returns `pending-tickets.md` text with the named entries moved verbatim
  into an `## Applied` archive section (not deleted — same "never silently
  lose a record" posture as the rest of this spec) so that re-parsing the
  result with `parsePendingTickets` no longer returns them, while every
  entry not named is untouched and still parses. This is what makes "has an
  unapplied pending-tickets file" (AC7's input) a checkable fact rather than
  an assumption.
  proof: `test/lane-ticket-allocation.test.mjs` — `"markApplied archives the named entries and leaves the rest parseable"`.

- **AC9** — Abandoned-lane disposition (待決 F, decided 2026-09-16, carried
  here rather than deferred to sr-engineer per this ticket's dispatch brief).
  `allocateTicketIds` and `markApplied` take no `disposition` parameter and
  run identically whether the lane's `agc feature finish` path is
  `--shipped` or `--abandoned`: a finding filed while working an abandoned
  lane is applied exactly as on the shipped path, ids allocated at that
  moment. Evidence-report disposal (`abandoned/` subtree vs. discard) is a
  separate, already-decided policy this spec documents but does not
  implement — wiring either path into `agc feature finish` is E124b/E73, out
  of scope for this cut. (No `proof:` — this is a scope/contract statement
  enforced by AC3/AC5/AC8's function signatures carrying no disposition
  parameter, not by a runnable command.)

## Copy / Strings

| string id | exact text (quote verbatim) | source |
|---|---|---|
| N/A | — | feature has no user-facing strings (internal governance file format) |

## Visual Tokens

| token id | property | value (quote verbatim) | source |
|---|---|---|---|
| N/A | — | feature has no visual literals | — |

## Visual Widgets

| widget id | description | source-node |
|---|---|---|
| N/A | — | feature has no non-primitive widgets |

## Out of Scope

Recorded here as **E124b** per this ticket's dispatch brief — the integrator
promotes these from this section, they are not implemented in this cut:

- Wiring `allocateTicketIds` / `extractMaxBacklogId` / `markApplied` /
  `detectOrphanLanes` into `agc feature start/finish` (E73).
- Wiring the orphan detector into `agc check`.
- Wiring any of the above into the release-engineer SOP (`content/skill-release-engineer.md`)
  or the Backlog Intake Loop (`content/coord-*.md`).
- **Retiring `NEW-TICKETS.md` as the ticket-candidate source once
  `pending-tickets.md` is wired.** Per AC1, this cut changes nothing about
  today's convention — every lane keeps using `NEW-TICKETS.md` exactly as
  today until E124b actually routes findings into `.current/<lane>/pending-tickets.md`
  instead. Single-source-of-truth is a design property of the format this
  ticket builds, not a migration this ticket performs.
- Evidence-report disposal mechanics for an abandoned lane (archive to an
  `abandoned/` subtree vs. discard) — the policy is stated (AC9) but not
  implemented; it belongs to the E73 `--abandoned` path.
- **Registering `pending-tickets.md` in `tools/lane-paths.ts`'s
  `LANE_FILES`.** Investigated this cut: `tools/lane-migrate.ts`'s
  `migrateLaneToFlatLocked` (the lane→flat rollback direction, :475-515)
  REFUSES outright — throws, moves nothing — when the lane directory holds
  any entry that is neither a `LANE_FILES` filename nor tolerable lock/tmp
  debris (:491-504, the `foreign` check). An unregistered
  `.current/<lane>/pending-tickets.md` is exactly such a "foreign" entry, so
  its mere presence would block a rollback to the flat layout while
  unapplied entries are pending. The forward `migrateFlatToLaneLocked`
  direction is unaffected (:352-385 — it only ever moves known `LANE_FILES`
  entries and never inspects or rejects anything else present). `tools/lane-paths.ts`
  is forbidden for this lane, so registration is not implemented here —
  filed as **L-STATE-NEW-1** in this worktree's (uncommitted) `NEW-TICKETS.md`
  for whichever lane next owns `tools/lane-paths.ts`.
- Any other change requiring `content/` or `bin/` edits to make a role
  actually invoke this module — per this lane's FORBIDDEN list, recorded
  instead in this worktree's `NEW-TICKETS.md` under lane-local codes
  (`L-STATE-NEW-n`), never committed, never given a real E-id here.
- Sub-lettered ticket ids (e.g. `E174a`) as a *minting* mechanism — this
  ticket only reads existing sub-lettered ids (AC6) to compute the correct
  max; it does not mint or manage new sub-lettered splits, a separate,
  already-existing mechanism.
- A `pending-tickets.md` template/example file — the format is fully
  specified by AC1-AC2 and the module's own doc comments; authoring a
  template is left to whichever lane wires E124b.

## Dependencies / Prerequisites

- Depends on E123 (per-lane `.current/<lane>/` layout) — already merged into
  `main` (Wave 4, 2026-09-24) before this lane started.
- Coexists with, and does not modify, `tools/lane-paths.ts`'s `LANE_FILES`
  registry (forbidden for this lane) — `pending-tickets.md` lives inside the
  already-existing `.current/<lane>/` directory but is deliberately kept
  outside the registry this cut. See Out of Scope for the
  `migrateLaneToFlatLocked` foreign-entry refusal this leaves as a known,
  filed gap (L-STATE-NEW-1) rather than a silently-accepted one.
- Coexists with, and does not modify, `tools/lane-registry.ts` (owned by
  L-LANEREG) — `detectOrphanLanes`'s `liveWorktreeBranches` parameter is
  shaped to accept branch-name data of the kind `git worktree list
  --porcelain` (or a future `tools/lane-registry.ts` extension) could supply,
  read-only, no import added.
- Resource Audit Gate: zero external references found (no URL/Figma/ticket
  links in this ticket's source material — `docs/v4.0.0-execution-plan.md`,
  `docs/backlog.md`, and the two `tools/*.ts` files read for context are all
  in-repo).
