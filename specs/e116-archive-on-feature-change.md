# e116-archive-on-feature-change

## Problem Statement
`writeHandoffStateCore` (`tools/handoff-write.ts`) rewrites `.current/handoff.md`
wholesale on every write. When a workspace is reused for a second ticket and
`active_feature` changes, the previous ticket's entire ledger — its
`completed_tasks`, `hop_count`, `qa_round`/`review_round`/`visual_round`,
`pending_notes`, everything — is overwritten with no trace left on disk. The
only surviving record is whatever prose a human or PM happened to paste into
the new ticket's `scope_decision_why`, plus whatever git history retains
(which itself gets discarded on the far side of a lossy merge — see the E150
section below). This is the mechanism that makes E113's 28-hop fan-out figure
a measured floor rather than a true count: J1a's real hop/round history is
unrecoverable. The reset-on-feature-change behavior itself (six existing
fields: `cut_approved`, `external_refs`, `dispatch_pins`, `dispatch_mode`,
`evidence_schema`, `cut_approved_source` — each dropped or re-armed on
`active_feature` change by design) is correct and stays; the fix is to
preserve a durable copy of the outgoing ledger at the moment it would
otherwise be destroyed, not to weaken the reset.

## User Stories
- As a coordinator reusing a worktree for a second ticket, I want the first
  ticket's ledger preserved somewhere durable when I change `active_feature`,
  so that its hop/round/completion history survives past the moment of reuse.
- As anyone computing a feature-level roll-up (E113) after the fact, I want a
  file I can read back that holds the outgoing ticket's exact `hop_count`,
  round counters and `completed_tasks` at the moment it was superseded,
  instead of relying on prose in `scope_decision_why`.

## Acceptance Criteria

- **AC1** — Given a workspace whose `.current/handoff.md` has
  `active_feature: "e116-old"` with a non-trivial ledger (`completed_tasks`,
  `hop_count`, `qa_round` all non-zero), when `writeHandoffState`/
  `tw_update_state` is called with `active_feature: "e116-new"`, then a new
  file appears under `.current/archive/` whose parsed YAML frontmatter shows
  `active_feature: "e116-old"` with the exact `completed_tasks`, `hop_count`,
  `qa_round`, `review_round`, `visual_round`, `pending_notes` and
  `last_updated` values that were on disk immediately before the write —
  i.e. the pre-overwrite file, copied verbatim, not reconstructed field-by-
  field.
  proof: `test/e116-archive-on-feature-change.test.mjs` — case "AC1: archive
  captures the outgoing ledger verbatim on feature change".
- **AC2** — Given the same scenario as AC1, when the write completes, then
  `.current/handoff.md` itself shows the NEW `active_feature` with
  `hop_count`, `qa_round`, `review_round`, `visual_round` reset to 0 exactly
  as today (the six-field reset-on-feature-change design is unchanged) — the
  archive is additive, it does not alter what the live file contains.
  proof: `test/e116-archive-on-feature-change.test.mjs` — case "AC2: live
  handoff still resets on feature change".
- **AC3** — Given a workspace mid-feature (a write that keeps the SAME
  `active_feature`, e.g. an ordinary sr→code-reviewer→qa hop), when
  `writeHandoffState` is called, then no file is created under
  `.current/archive/` — the mechanism fires ONLY on an actual
  `active_feature` change, never on same-feature progression.
  proof: `test/e116-archive-on-feature-change.test.mjs` — case "AC3: no
  archive on same-feature write".
- **AC4** — Given a brand-new workspace with no pre-existing
  `.current/handoff.md`, when the first `writeHandoffState` call runs, then
  no archive file is created and the write succeeds exactly as it does today
  (nothing to archive; the null-`existing` path is unaffected).
  proof: `test/e116-archive-on-feature-change.test.mjs` — case "AC4: no
  archive on first-ever write".
- **AC5** — Given `active_feature` contains only the characters this repo's
  ticket ids already use (`[A-Za-z0-9._-]`), when the archive fires, then the
  archive filename is `<active_feature>.<pid>.<epochMillis>.md` under
  `.current/archive/`, with any character outside that set sanitized to `-`
  before use (defends against a pathological `active_feature` value smuggling
  a `/` or `..` into the filename — no path traversal outside
  `.current/archive/`).
  proof: `test/e116-archive-on-feature-change.test.mjs` — case "AC5: filename
  sanitization blocks path traversal".
- **AC6** — Given the SQLite storage backend (`storage-sqlite.ts`,
  HTTP/multi-tenant mode), when a feature change occurs through
  `SqliteHandoffStorage.writeState`, then no archive file is written and no
  error is raised — this ticket is FILE-MODE ONLY, the identical posture the
  six existing feature-scoped fields already declare (DR-5 precedent);
  `storage-sqlite.ts` is not modified by this ticket at all.
  proof: inspection — `git diff --stat` for the T-E116-01 commit shows
  `storage-sqlite.ts` absent from the changed-files list.
- **AC7** — Given this ticket ships, then `schema/versions.ts` and the
  `schema_version` written into `.current/handoff.md`'s frontmatter are
  UNCHANGED — the archive is a side-artifact file, not a new
  `HandoffState` field, so no migration is needed and none is written.
  proof: inspection — `git diff` for the T-E116-01 commit touches neither
  `schema/versions.ts` nor `tools/handoff-types.ts`.

## Copy / Strings
| string id | exact text (quote verbatim) | source |
|---|---|---|
| N/A | — | feature has no user-facing strings (internal server mechanism, no client-visible copy) |

## Visual Tokens
| token id | property | value (quote verbatim) | source |
|---|---|---|---|
| N/A | — | — | feature has no visual literals |

## Visual Widgets
| widget id | description | source-node |
|---|---|---|
| N/A | — | feature has no non-primitive widgets |

## Out of Scope
- Removing or weakening the reset-on-feature-change behavior for
  `cut_approved`, `external_refs`, `dispatch_pins`, `dispatch_mode`,
  `evidence_schema`, or `cut_approved_source`. Explicitly rejected by the
  ticket; archiving PRECEDES the reset, it does not replace it.
- E150 door 1 (same-feature `completed_tasks` loss on amendment) — different
  trigger condition (no `active_feature` change involved at all). See the
  E150 section below.
- E150 door 2 (cross-worktree git-merge ledger loss) — see the E150 section
  below for why this ticket's mechanism does not reach it.
- E112, E113, E115, E132 — untouched. E113's feature-level roll-up may one day
  consume these archive files as a data source, but building that consumer is
  not this ticket.
- Any `schema/versions.ts` change (none is needed — AC7).
- Pruning/rotation/cleanup of old archive files. `.current/archive/` grows
  monotonically; a retention policy is future work, not blocking for this
  ticket's DoD.

## Dependencies / Prerequisites
- Depends on E109 (✓ shipped, v3.113.0) — the per-workspace anchoring
  decision this ticket's whole framing rests on (archives are scoped to the
  workspace they're written in, exactly like `hop_count` and the other five
  feature-scoped fields).
- Occupies `tools/handoff-write.ts` alongside E114's already-landed v14 block
  (`cut_approved_source`, at `:142`/`:211`/`:359` in this ticket's base
  commit `1b5a48c`) — see the reconciliation section below.
- Archive files land under `.current/archive/`, a new subdirectory of
  `.current/`. Since `.current/handoff.md` is itself git-tracked in this
  repo's dogfooding setup (confirmed: `git status` shows it modified, not
  ignored), archive files are ALSO git-tracked by default — no new
  `.gitignore` entry is added. This is a deliberate choice, not an oversight:
  it is what makes the archive durable across commits, and it is what keeps
  door-2 merges collision-free (see the E150 section: unique filenames per
  feature+timestamp never collide on the same git merge that clobbers the
  single-path `handoff.md`). Adopter workspaces that don't commit `.current/`
  get the same non-durability they already have for `handoff.md` itself today
  — no new adoption requirement is introduced.
- No design file exists for this feature (`design/e116-*.md` absent) — Visual
  Structural Assertions section is correctly omitted per the no-design
  backwards-compat rule.
- Resource Audit: scanned this ticket's inputs (`docs/backlog.md` rows E116 /
  E150 / E109 / E113, all in-tree) for `http(s)://`, `figma`, `URL`, "see
  <ticket>" etc. — zero external references found. `external_refs` field
  omitted per the Gate Summary's zero-hits rule (absence = non-blocking).

## Reconciliation with E114's v14 block
E114 landed first (base commit `1b5a48c` already contains the v14
`cut_approved_source` clause at `tools/handoff-write.ts:142` [option doc],
`:211` [const + `parseCutApprovedSource` sanitize], `:359` [carry-forward
clause]). This ticket's archive mechanism is **not a seventh member of the
six-field preserve/reset pattern** — it is a different kind of concern and
sits alongside that pattern rather than inside it:

- The six fields (`cut_approved`, `external_refs`, `dispatch_pins`,
  `dispatch_mode`, `evidence_schema`, `cut_approved_source`) all answer "what
  value does THIS field carry into the new write" — each is a scalar/array
  that gets either replaced, carried forward, or dropped, and is then emitted
  into the SAME new `frontmatterData` object that becomes the new
  `.current/handoff.md`.
- The archive answers a different question entirely: "should a COPY of the
  OLD file be preserved before it's overwritten." It never reads or writes
  any of the six fields' values, never touches `frontmatterData`, and never
  touches the v14 block's three sites at all.
- Concretely: this ticket **extends the same shared `existing = parseHandoff(...)`
  read** at `tools/handoff-write.ts:~392` by adding one more unconditional
  clause to the trigger `if` (`:380`–`:391`) — the read must now ALSO happen
  when it wasn't otherwise needed, because the archive decision
  (`existing.active_feature !== _activeFeature`) requires the on-disk
  `active_feature` on every single write, not just on writes that omit one of
  the six fields. This is exactly the forcing function the coordinator
  flagged: a write that sets every one of the six fields explicitly AND is
  not a `bookkeepingWrite` currently skips the read entirely, so the new
  clause must be unconditional (`|| true`, documented as its own numbered
  concern, the same commenting convention the six fields already use) rather
  than piggybacking on an existing conditional.
- The actual archive-copy side effect (a `fs.copyFileSync`-style write of the
  pre-overwrite `handoffPath` to `.current/archive/...`) happens once, right
  after the existing-read block resolves (after `:426`, before the tmp-write
  + rename at `:574`–`:576`), inside the SAME `withFileLock` critical section
  and after the SAME `verifyFreshness` call — so it observes the identical
  "last known good" file the six-field preserve logic itself observes, with
  no new lock or freshness check needed.
- Net effect on the v14 block specifically: zero. `cut_approved_source`'s own
  carry-forward/drop algorithm at `:359`–`:373` is untouched; it still runs
  exactly as E114 shipped it, and the field it computes still gets dropped
  (not archived-and-forgotten, just dropped from the LIVE file, per its own
  documented "absence === non-inherited" semantics) when `active_feature`
  changes — except now its outgoing value is *also* recoverable from the
  archive copy, same as every other field in the old ledger.

## E150 two-door coverage
**Verdict: NO — one mechanism does not cover both E150 doors.** Reasons,
door by door:

- **Door 1 (same-feature `completed_tasks` loss on amendment)** is triggered
  by a write that KEEPS the same `active_feature` but omits/replaces
  `completed_tasks` without a carry-forward rule. E116's archive fires ONLY
  when `active_feature` CHANGES (AC3 makes this an explicit acceptance
  criterion: no archive on a same-feature write). These are disjoint trigger
  conditions on the same field — a same-feature amendment that erases
  `completed_tasks` never touches the `active_feature`-change branch at all,
  so no archive is ever written for it. Door 1 needs its own fix (most likely
  giving `completed_tasks` the same feature-scoped preserve-if-omitted
  algorithm the other six fields already have) — unrelated code path,
  different ticket.
- **Door 2 (cross-worktree git-merge loss)** is the harder case, and the
  ticket's own framing names the crux directly: **a lane that reaches PASS
  and never changes `active_feature` again never fires this mechanism.**
  E116's archive is written by `writeHandoffStateCore` at the moment a NEW
  `writeHandoffState` call supplies a different `active_feature` than what's
  on disk. A lane that finishes at PASS just stops calling
  `tw_update_state` — there is no subsequent write, changed-feature or
  otherwise, for the archive clause to attach to. Its only on-disk ledger
  remains the single `.current/handoff.md`, which is exactly the file that
  git conflicts on when two such lanes' worktrees get merged; whichever side
  `git merge`/the human keeps is preserved, the other is gone, archive or no
  archive.
  - Even setting the PASS-and-stop case aside: the merge itself is a `git`
    operation performed OUTSIDE any `tw_*` tool call — per this project's own
    stated non-goal ("It does NOT touch git. Commit/PR workflow is out of
    scope," `CLAUDE.md`), there is no write-path hook this ticket (or any
    future one, on the server's current architecture) can attach to that
    fires "during" a merge. `writeHandoffStateCore` never runs as part of
    `git merge`.
  - The unique-filename property this ticket DOES provide
    (`<feature>.<pid>.<epochMillis>.md`, never colliding across lanes or
    across time) is a genuinely useful primitive for whatever door-2 fix gets
    built later — an archive-style artifact per lane that IS written
    proactively (e.g. at PASS, not just at feature-change) would merge
    cleanly for exactly the reason this ticket's own archive files do
    (distinct paths never conflict, unlike the single `handoff.md` path).
    But that proactive-at-PASS write is a different trigger condition than
    "active_feature changed," and building it is explicitly out of scope
    here (per the human's boundary: this is a design judgment, not
    permission to implement E150).
- Net: E150's future cutter should read this section knowing that (a) E116
  ships a reusable "durable, uniquely-named ledger snapshot" primitive, but
  (b) its trigger condition (feature change, observed inside one workspace's
  own write path) structurally cannot cover door 2's crux case (a lane that
  never writes again after PASS, discovered only at a cross-workspace git
  merge that no `tw_*` call ever sees) — door 2 needs its own trigger,
  proactive rather than reactive to `active_feature` change, and door 1 needs
  its own fix to `completed_tasks`'s carry-forward semantics, unrelated to
  either.
