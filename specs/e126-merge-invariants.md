# e126-merge-invariants

## Problem Statement

Nothing mechanically verifies that a merge preserved the two governance
ledgers (`tasks.md` rows and their `[x]` marks) and the append-only telemetry
sidecars. `tw_detect_drift` compares `handoff.completed_tasks` against
`tasks.md` checkboxes inside a SINGLE workspace's current state — a merge
that drops a lane's task rows **and** its `[x]` marks symmetrically leaves
both *consistently wrong*, so drift reports "no drift detected." It catches
disagreement between two views of one workspace, not data loss across a
merge. E126 adds a standalone, git-native check: given a merge commit, assert
that everything either parent had is still present in the merge, comparing
against `merge-base` to make the assertion additive rather than a naive
snapshot diff.

## Definitions

**Row identity.** A task row's identity is its `task_id` token alone (e.g.
`T-E125A-01`), never its file path. Task ids are unique across the whole
tree by convention (they embed the ticket/lane slug), and the lane machinery
already relies on this: a lane's ledger physically relocates over its
lifetime (root flat file -> `.current/_primary/tasks.md` or
`.current/<lane>/tasks.md` via `tools/tasks-lane-migrate.ts`'s forward
migration, then -> `.current/history/<YYYY-MM>/<lane>/tasks.md` via `agc
feature finish --shipped`, byte-identical per `docs/lane-protocol.md` §3). A
row is **present at commit C** iff its `task_id` appears in ANY
checkbox-shaped line (`- [ ]`, `- [x]`, or the void marker `- [-]` —
voiding is a legitimate lifecycle transition, not a loss) in ANY file the
tree at C shapes as a task ledger:
- `tasks.md` (root),
- `.current/_primary/tasks.md`,
- `.current/<lane>/tasks.md` for every lane directory (`isSafeLaneName`,
  excluding `NON_LANE_DIRS` — reuse these two pure predicates from
  `tools/lane-paths.ts` by import, never restate them),
- `.current/history/<bucket>/<lane>/tasks.md` for every `HISTORY_BUCKET_RE`
  bucket (also reuse from `tools/lane-paths.ts`).

**Line-trimming alignment (R-2, code-review round 1 observation).** The
ledger-line reader MUST trim each line the same way `tools/tasks-file.ts`'s
own row parser does before matching it against the checkbox-row shape —
either by importing that trimming behavior/regex directly or by
implementing the exact same rule, never a separate hand-rolled regex — so
that an indented checkbox row (leading whitespace, which `tools/
tasks-file.ts` tolerates) is not invisible to this tool while being a real,
counted row to every other consumer of the same file.

**Compaction recognition — relocation vs. summarization (revised; the
original draft's premise was checked against a real compaction merge,
`ed7432f`, and found false — see Sanity Check below).** Two DIFFERENT things
both get called "compaction" in this codebase, and only one of them
preserves `task_id`:

1. **Relocation** — `tasks_moved:` markers (`tools/tasks-lane-migrate.ts`)
   and `## Closed Lanes` `lane_closed:` pointers (`bin/agc-init.mjs`'s
   `applyClosedLanePointer`) move a row's *file*, never its *content*. The
   row's `task_id` and checkbox state survive byte-identical somewhere else
   in the tree. The whole-tree identity search in Row identity above already
   handles this — no special-casing needed, and neither marker is ever
   consulted to *decide* presence (they are lane-level bookkeeping, not
   row-level).
2. **Summarization** (the e125c one-time root-index compaction, `## Compacted
   History`) is destructive to identity: it deletes the actual `task_id`
   rows for entire H2 sections wholesale and replaces them with ONE
   aggregate line per section — `- <section heading text>: <N> done, <M>
   voided`. No `task_id` survives anywhere in the tree for a summarized row.
   A row's `task_id` disappearing this way is **not** found by the identity
   search in Row identity, and must be classified explicitly, never treated
   as an ordinary MISSING.

**Compaction manifest shape** (verified against `ed7432f:tasks.md` and
`ed7432f:.current/_primary/tasks.md`): an `## Compacted History` H2 section
(matches `SECTION_HEADING_RE`, reuse from `tools/tasks-lane-migrate.ts`,
import-only) whose first content line is a single HTML comment `<!--
compacted: <label> <date> — <sectionCount> sections, <doneTotal> [x] rows,
<voidTotal> [-] rows summarized below; ... -->`, followed by zero or more
bullet lines `- <section heading text>: <done> done, <voided> voided` (one
per summarized section), until the next H1/H2 heading or EOF. `<section
heading text>` is the EXACT parent-side H2 heading text the rows lived
under (verbatim, including any `— re-cut ...` suffix — `ed7432f` has three
separate `e123a-lane-layout-migration ...` entries with different suffixes,
each a distinct section identity).

**Compaction exemption rule.** A `task_id` X, found at PARENT under file F /
section S with state `[x]` or `[-]`, that the whole-tree identity search
(Row identity) does NOT find anywhere at MERGE, is reclassified
**COMPACTED** (informational, never a failure) instead of MISSING iff ALL
FOUR conditions (a)–(d) hold:
  - (a) X's parent-side state was `[x]` or `[-]` — **an open `[ ]` row is
    NEVER eligible; it is always MISSING if the identity search doesn't find
    it.** A compacted summary only ever accounts for closed rows (`done` /
    `voided` counts) — it structurally cannot vouch for an open row, so an
    open row disappearing under cover of a compaction marker is exactly the
    silent-loss shape this whole feature exists to catch;
  - (b) the SAME file F (never a different file — a compacted manifest only
    vouches for its own ledger's history, not another file's rows) has, at
    MERGE, a Compacted History manifest naming section S; AND
  - (c) **count reconciliation over the UNION across parents, not
    per-parent** (revised — code-review round 1 surfaced a real hole in the
    per-parent version, R-1: a merge that compacts section S itself while
    BOTH sides independently added DIFFERENT closed rows to S would satisfy
    (a)/(b)/(d) checked separately per side — e.g. 5 distinct `[x]` rows
    across the two parents against a manifest saying "4 done" would let each
    side's rows pass its own per-parent count on its own, wrongly COMPACTED,
    exit 0). Fix: let `U` = the union of DISTINCT `[x]`/`[-]` `task_id`s
    found under file F / section S, taken across every parent for which
    (a), (b), and (d) already hold for that row in that parent (a `task_id`
    counted once even if literally present in both parents' copies of
    F/S). The manifest's `(done, voided)` pair for section S must be `>=`
    `U`'s own `(done, voided)` split. This is REQUIRED, not optional:
    presence of a same-named section in the manifest alone would let a
    manifest that under-counts (or a forged/edited-down marker) mask a real
    loss — the whole point of a mechanical, loud check. **When (c) fails for
    section S, EVERY row of `U` not found at the merge is reported MISSING
    individually, by `task_id`** (R2, integrator review, unchanged by the
    union fix) — never a single "N missing" count and never an arbitrary
    subset: the manifest gave no way to tell which specific rows its count
    was meant to cover, so once reconciliation fails, nothing under S is
    trusted. (d) itself stays evaluated per-parent, unchanged: a parent
    barred by (d) contributes NOTHING to `U` — its rows under S are judged
    by the ordinary whole-tree identity rule (present/MISSING), never by
    this compaction path; AND
  - (d) **the SAME parent where X was found (call it `P_row`) must NOT
    already carry a Compacted History manifest naming section S in ITS OWN
    copy of file F** (R1, integrator must-fix — closes a real hole). Section
    names get RECYCLED: `tw_add_task`'s default section is literally
    `"Active"` (`tools/tasks-file.ts:782`), and `ed7432f`'s own manifest has
    a `- Active: 428 done, 10 voided` bullet — yet the live `## Active`
    heading keeps accepting brand-new rows forever, forever sharing that
    label with the historical bullet. Without (d): 5 NEW `[x]` rows added
    under `## Active` after `ed7432f`, then dropped by a later bad merge,
    would satisfy (a) yes / (b) yes (same label "Active") / (c) `428 >= 5`
    yes -> wrongly COMPACTED, exit 0 — precisely the silent loss this ticket
    exists to catch. (d) blocks this: it requires the manifest naming S to be
    genuinely NEW relative to `P_row` (compaction happened "on the other
    side, or in the merge itself," never already-baked-into `P_row` before
    X was ever added there). `ed7432f` sanity is unaffected: at `ed7432f^1`
    (main, pre-merge) neither `tasks.md` nor `.current/_primary/tasks.md` yet
    carried a `## Compacted History` manifest for any of the 67 sections, so
    (d) holds trivially for every one of the 917 summarized rows found there.

Report every COMPACTED row as an explicit informational count in the output
(e.g. "917 rows compacted (informational) — see file:section breakdown"),
never folded silently into a bare PASS — deduplicated by `task_id` (Q-1,
code-review round 1 observation: the same `task_id` can legitimately appear
in more than one parent's copy of F/S, and the informational count must
reflect distinct rows, not raw parent×file occurrences). AC2
(`[x]`-preservation) gets the same exemption: a `[x]` row that resolves to
COMPACTED under this rule is not reported as a lost completion.

**Sanity check against `ed7432f`** (the real e125c compaction merge this
rule was derived from): parent (`ed7432f^1`) held 933 checkbox rows in root
`tasks.md`; the merge holds 16 literal rows + one `## Compacted History`
manifest naming 67 sections totalling 891 `[x]` + 26 `[-]` = 917 rows
(933 = 917 + 16, exact). Under the union-based (c): `ed7432f^2` (the e125c
lane branch) added no rows of its own under any of the 67 compacted
sections — it only performed the compaction — so `U` for every one of those
sections reduces to `^1`'s rows alone, and the outcome is unchanged. Under
this rule, running merge-invariants against `ed7432f` is expected to report:
0 MISSING, 0 lost `[x]`, 917 COMPACTED (informational) for `tasks.md` (and
the same shape again for `.current/_primary/tasks.md`, which was compacted
identically) — exit 0, assuming the sidecar invariant (AC3) also holds. The
16 literal rows (e.g. `T-E145-01`, `T-E137-01..06`, `T-E125A-01..07`) live
under H2 sections NOT named in the manifest, so they are checked by the
ordinary whole-tree
identity search, not the compaction exemption.

**`[x]`-preservation** uses the same identity rule: if `task_id` X is `[x]`
in ANY enumerated file at either parent, X must be `[x]` in ANY enumerated
file at the merge commit (not necessarily the same file/path).

**Sidecar identity.** A sidecar's identity is the pair `(kind, lane)` where
`kind` ∈ `{dispatch, telemetry, metrics, usage}` and `lane` is the owning
lane directory name (or `null` for a legacy flat `.current/<kind>.jsonl`).
Its **record count at commit C** is the number of newline-terminated lines
across the DEDUPLICATED set of paths shaping that `(kind, lane)` at C — the
same content-byte-prefix dedup rule as `tools/lane-paths.ts`'s
`enumerateLaneSidecarSources` / `isBytePrefix` (a history copy that is a
byte-prefix of, or equal to, a live copy of the same lane is not
double-counted). That function itself reads the live filesystem and cannot
be reused as-is (this check reads three-to-four different commits' trees,
never the working directory) — reimplement the same dedup algorithm against
`git ls-tree` / `git show` content, importing only the pure predicates
(`isSafeLaneName`, `NON_LANE_DIRS`, `HISTORY_BUCKET_RE`, `isBytePrefix`) from
`tools/lane-paths.ts`.

**Merge commit resolution.** Target ref defaults to `HEAD`. Parent 1 / 2 are
`<ref>^1` / `<ref>^2`. Merge-base is `git merge-base <parent1> <parent2>`.

## User Stories

- As an integrator, I want a single command that loudly fails when a merge
  silently dropped ledger rows, `[x]` marks, or sidecar records, so that I
  never have to trust a merge was clean by inspection alone.
- As an integrator, I want the check to run against an arbitrary already-made
  merge commit (not a live conflict-resolution session), so that it composes
  with my own SOP's post-`git merge --no-ff` step without a new agent role.

## Acceptance Criteria

- **AC1** — Given a merge commit M with parents P1, P2, when a `task_id`'s
  row is present (per Definitions) at P1 or P2, then merge-invariants finds
  it present at M too, OR it qualifies for the Compaction exemption (all of
  (a)–(d)) and is reported COMPACTED, OR it is reported MISSING with the
  parent(s) it was found in and the file path(s) checked at M.
  proof: `test/e126-merge-invariants.test.mjs` — "AC1: row dropped by a bad
  merge is reported MISSING"
- **AC2** — Given a `task_id` was `[x]` at P1 or P2, when checked at M, then
  it is `[x]` somewhere in M's enumerated tree, OR it qualifies for the
  Compaction exemption and is reported COMPACTED (not a lost completion), OR
  it is reported as a lost completion (task_id + the parent it was `[x]` at +
  where it was found at M, if at all).
  proof: `test/e126-merge-invariants.test.mjs` — "AC2: [x] regressed to [ ]
  across a merge is reported"
- **AC3** — Given a sidecar identity `(kind, lane)` observed at P1, P2, or
  base, when `recordCount(M) < recordCount(P1) + recordCount(P2) -
  recordCount(base)`, then merge-invariants reports the shortfall naming
  `kind`, `lane`, and the three counts.
  proof: `test/e126-merge-invariants.test.mjs` — "AC3: sidecar record
  shortfall is reported with counts"
- **AC4** — Given a row was moved by lane migration (root -> `_primary` /
  `.current/<lane>/`) or by `feature finish --shipped` (`.current/<lane>/` ->
  `.current/history/<YYYY-MM>/<lane>/`) between a parent and the merge, when
  checked, then it is NOT reported as missing (identity is by `task_id`
  across the whole enumerated tree, never by fixed path).
  proof: `test/e126-merge-invariants.test.mjs` — "AC4: a row relocated by
  migration/finish --shipped is not a false MISSING"
- **AC5** — Given one or more of AC1/AC2/AC3 fail, when merge-invariants
  runs, then it exits non-zero and prints EVERY offending row / lost `[x]` /
  sidecar shortfall (file + identity) — never a single `FAIL` line.
  proof: `node scripts/merge-invariants.mjs <bad-merge-sha>; echo exit=$?`
  prints one line per offending item and a non-zero exit code
- **AC6** — Given the target ref does not have exactly two parents (0, 1, or
  ≥3 — octopus merges are explicitly unsupported), when merge-invariants
  runs, then it exits with the NOT_A_MERGE_COMMIT code and a message naming
  the actual parent count, never a silent pass.
  proof: `test/e126-merge-invariants.test.mjs` — "AC6: non-merge commit exits
  NOT_A_MERGE_COMMIT"
- **AC7** — Given the two parents share no common ancestor (`git merge-base`
  fails), when merge-invariants runs, then it exits with the NO_MERGE_BASE
  code and a distinct message, never a silent pass.
  proof: `test/e126-merge-invariants.test.mjs` — "AC7: unrelated histories
  exit NO_MERGE_BASE"
- **AC8** — Given a merge commit that dropped nothing, when merge-invariants
  runs, then it exits 0 and prints a summary confirming all three invariants
  held.
  proof: `test/e126-merge-invariants.test.mjs` — "AC8: clean merge exits 0"
- **AC9** — Given a bad `--ref` (unresolvable) or a working directory that is
  not a git repository, when merge-invariants runs, then it exits with the
  USAGE_ERROR code and a usage message, never crashing with a raw stack
  trace.
  proof: `node scripts/merge-invariants.mjs bogus-ref-xyz; echo exit=$?`
- **AC10** (X5 / E198(a)) — Given `scripts/verify-release.mjs`'s
  `BOOKKEEPING_PATH_RES` (Check 1's bookkeeping-commit tolerance), when a
  post-tag commit touches only `.current/_primary/tasks.md`, then it is
  tolerated (NOTE + OK), same as the existing `.current/_primary/handoff.md`
  / `*.jsonl` tolerance. **Decision (this cut): `.current/<lane>/tasks.md` is
  ALSO added to the tolerance list.** Reason: a lane's own `tw_add_task` /
  `tw_complete_task` write touches its lane-scoped `tasks.md` exactly the way
  it already touches its lane-scoped `handoff.md` and `*.jsonl` sidecars
  (both already tolerated per-lane since E174a) — there is no principled
  reason to tolerate one lane-scoped bookkeeping file and not the other, and
  withholding it would make an otherwise-bookkeeping-only lane commit fail
  Check 1 for an arbitrary reason.
  proof: `test/verify-release.test.mjs` — new cases mirroring VR-39/VR-40
  for `tasks.md` in place of `handoff.md`
- **AC11** (Compaction exemption, X6/X9) — Given a merge commit whose
  ledger(s) carry a `## Compacted History` manifest (per Definitions) that
  correctly reconciles (conditions (a)–(d) all hold for every named
  section), when merge-invariants runs, then every summarized row is
  reported COMPACTED (informational) and the run exits 0 (assuming AC3 also
  holds) — sanity-check target: `ed7432f` (root `tasks.md` and
  `.current/_primary/tasks.md`, see Sanity Check in Definitions: 917
  COMPACTED, 0 MISSING each). Four counter-examples, each MISSING + exit 1:
  (i) a row OPEN (`[ ]`) at the parent, absent at the merge under a section a
  Compacted History manifest names — condition (a) bars it; (ii) count
  reconciliation (c) fails for section S — EVERY row of `U` not found at the
  merge is listed individually by `task_id` (R2), not a single aggregate
  count; (iii) (R1 counter-example, per-parent recycled section) a `[x]` row
  added under an ALREADY-compacted section name (the row's own parent
  already carries that section's manifest entry — the recycled-
  `"Active"`-label trap) is dropped by a merge — condition (d) bars the
  exemption, so it is MISSING, never silently absorbed by the stale manifest
  bullet; (iv) (R-1 counter-example, cross-parent union — code-review round
  1) the merge itself compacts section S while BOTH parents independently
  added DIFFERENT closed rows to S (5 distinct `[x]` `task_id`s total across
  the two sides) and the manifest says "4 done" — under the corrected
  union-based (c), `U`'s 5 distinct ids exceed the manifest's 4, so
  reconciliation fails and every one of the 5 is reported MISSING, exit 1
  (NOT wrongly COMPACTED as a naive per-parent count would allow).
  proof: `test/e126-merge-invariants.test.mjs` — "AC11: a real compaction
  merge exits 0 with an informational COMPACTED count", "AC11: an open row
  dropped under a compaction marker is MISSING, exit 1", "AC11: a failed
  count reconciliation lists every un-found row of that section by task_id,
  exit 1", "AC11: a row added under an already-compacted section name is
  MISSING when dropped, exit 1 (R1 counter-example)", "AC11: a merge that
  compacts S while both parents added different closed rows exceeding the
  manifest count reports every row MISSING, exit 1 (R-1 5-vs-4 fixture)"

## Task → AC Coverage

Authoritative AC ownership per task (integrator review R3): `tasks.md` row
text is terse by convention and is NOT edited to restate this — this table
is the source of truth for what each task must cover, and takes precedence
over the one-line descriptions in `.current/e126/tasks.md` wherever they
appear to conflict or under-state scope.

| task | ACs owned | notes |
|---|---|---|
| T-E126-01 | AC1, AC4, AC6, AC7, AC9 (read/enumeration layer) | git-tree enumeration, task-row + Compacted History manifest parsing; no invariant logic yet |
| T-E126-02 | **AC1, AC2, AC3, AC4, AC5, AC8, AC11 (explicitly incl. R1 condition (d), the R-1 cross-parent UNION fix to condition (c), R2's "list every un-found row of `U` individually" behavior, and the R-2 line-trimming alignment with `tools/tasks-file.ts`)** | the three invariants + the full compaction exemption (a)–(d) with union-based (c) + loud report content |
| T-E126-03 | AC5, AC6, AC7, AC8, AC9 (CLI surface) | exit-code wiring + printing the report `runMergeInvariants` produces |
| T-E126-04 | AC10 | `BOOKKEEPING_PATH_RES` extension only |
| T-E126-05 (qa) | **AC1–AC9, AC11 (incl. all four AC11 counter-examples — open row / failed reconciliation / R1 recycled-section-name / R-1 cross-parent union 5-vs-4 fixture)** | fixture-repo coverage; the authoritative fixture list for this row |
| T-E126-06 (qa) | AC10 | mirrors VR-39/VR-40 for `tasks.md` |

Decision on how to carry this (integrator's "your call, state which"): kept
the six existing task rows as-is and added this table rather than
void+re-adding T-E126-02/05 — voiding would churn the ledger for a
purely-descriptive gap with no functional difference in what get built, and
`tw_add_task` cannot edit an existing row's text in place. This table is
authoritative for AC ownership; the ledger rows stay the stable work-log.

## Copy / Strings

| string id | exact text (quote verbatim) | source |
|---|---|---|
| N/A | — | — |

(This is a CLI/tooling feature; its console output is diagnostic text, not
user-facing product copy with a canonical source. Exact wording is at
sr-engineer's discretion provided it satisfies AC1–AC10's content
requirements — e.g. AC5's "every offending item," AC6/AC7's distinct
messages.)

## Visual Tokens

| token id | property | value (quote verbatim) | source |
|---|---|---|---|
| N/A | — | — | feature has no visual literals |

## Visual Widgets

| widget id | description | source-node |
|---|---|---|
| N/A | — | feature has no non-primitive widgets |

## Out of Scope

- A conflict-resolving agent of any kind (Constitution §3.2 — no independent
  judge for a resolver's own resolution; server charter does not touch git).
- Git-hook wiring (`agc init`, adopter hooks, `.git/hooks/*`) — flagged in
  6.2 pre-dispatch as out of bounds; report if it turns out load-bearing,
  don't add it.
- Wiring the actual post-merge call site — that is
  `.claude/commands/integrator.md` §5b, owned by the integrator, added in
  their own commit after this lane merges.
- `tools/join-precondition.ts` — untouched. Default decision this cut: no
  shared hook. `scripts/merge-invariants.mjs` is its own entry point, sharing
  only the *module/CLI-shell pattern* with `scripts/join-precondition.mjs`
  (logic in `tools/`, thin `.mjs` importing `dist/tools/*.js`), not its call
  time (X10).
- Octopus merges (>2 parents) — explicitly unsupported (AC6).
- E198(b) — the `content/skill-release-engineer.md` step-8a staging prose /
  artifact allowlist line. Placed in Wave 7 (E130), not this lane.
- `content/**`, goldens, `test/context-budget.test.mjs`, any `tools/**` file
  other than `tools/merge-invariants.ts` (others: import only), `bin/**`,
  `docs/**`, `.claude/commands/integrator.md`, root `tasks.md`,
  `NEW-TICKETS.md`.
- Legacy flat `.current/<kind>.jsonl` / `.current/tasks.md` (pre-E123/E125a
  layout) beyond what falls out naturally from enumerating whatever shapes
  exist in a given commit's tree — no special-cased migration-era logic
  beyond the identity/dedup rules in Definitions.

## Dependencies / Prerequisites

- Depends on E125a (lane-local ledgers exist), E125b (`feature finish
  --shipped` history-bucket layout + `lane_closed:` pointers exist), E125c
  (root-index compaction shape is stable) — all three already merged into
  `main` as of this lane's base (`b5ebcfe`).
- Reuse by import only (never restate): `tools/lane-paths.ts`'s
  `isSafeLaneName`, `NON_LANE_DIRS`, `HISTORY_BUCKET_RE`, `isBytePrefix`;
  `tools/config.ts`'s `resolveTaskRegex` (task-row shape); `tools/
  tasks-lane-migrate.ts`'s `SECTION_HEADING_RE` (`/^##\s+(.+)/`) for both
  ordinary row-section attribution and Compacted History manifest parsing;
  optionally `tools/tasks-file.ts`'s row-shape constants if any are exported
  and reused without duplicating the regex literal.
- Mirrors `scripts/join-precondition.mjs`'s CLI-shell pattern (thin `.mjs`,
  zero logic, imports `dist/tools/*.js`) — same shape, distinct entry point,
  not the same call time (see X10 in `specs/fanout-wave6.md` §6.2).
- No external references (URLs, Figma, tickets outside this repo) found in
  the source backlog rows (E126, E198) or `specs/fanout-wave6.md` §6.2 —
  Resource Audit Gate: zero hits, field omitted.
- Suggested structure (non-binding — sr-engineer's call): a git-tree reader
  layer (`git ls-tree -r --name-only <ref>` to enumerate candidate paths,
  `git show <ref>:<path>` to read blob content — never the working tree, so
  the tool works against ANY merge commit, not only `HEAD`'s checked-out
  state) underneath the three invariant checks and the exit-code/report
  layer.
