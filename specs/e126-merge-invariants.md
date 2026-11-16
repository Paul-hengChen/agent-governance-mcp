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
    counted once even if literally present in both parents' copies of F/S),
    minus the kept rows the manifest cannot have counted. Amended (E203): a
    `task_id` X that the whole-tree identity search (Row identity) does NOT
    find anywhere at MERGE always stays in `U`; a kept X — one the search
    finds somewhere at MERGE — stays in `U` only when BOTH (i) X has a row
    under F/S at the merge-base, AND (ii) no parent whose own copy of F
    carries a manifest naming S holds X anywhere in its tree; otherwise X
    leaves `U`. Why: summarization leaves no row of a summarized `task_id`
    in the compacting side's tree (Summarization, above), so a row that
    side still holds was not counted (ii), and a row absent from F/S at the
    merge-base is taken as the other side's post-fork addition, which the
    manifest never saw (i). A kept row passing both may be one the manifest
    counted, so it stays: dropping it would free a manifest slot for a row
    the merge really lost. Worked cases, one side compacting `## Wave`
    (T-A-01..03) into "3 done" while the other adds `- [x] T-D-01`: the
    merge keeps T-D-01 → it leaves `U` by (i), `U` = 3, pass; the merge
    drops T-D-01 → `U` = 4 > 3, fail; the merge keeps T-A-03 and drops
    T-D-01 → T-A-03 stays by (i)+(ii), `U` = 4 > 3, fail; the compacting
    side moved a fourth base row out of S before compacting and the merge
    keeps it there → it leaves `U` by (ii), pass. A kept row in `U` is
    never itself reported MISSING or COMPACTED. This kept-row rule is the
    **snapshot-only rule**. Amended (E417): when exactly one parent's own
    copy of F names S, the four snapshots are supplemented by that
    parent's history between the merge-base and itself: this snapshot-only
    check stays exactly as stated here and a second, history check is
    added next to it — see *Condition (c) history rule (E417)* below, which
    also states the limits that remain (it replaces the earlier "known
    limit" note). The
    manifest's `(done, voided)` pair for section S must be `>=`
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

**Condition (c) history rule (E417).** The snapshot-only (c) has a silent
false negative: a row a compacting side added under S after the merge-base
and then summarized is in neither parent's tree, so it never enters `U`,
yet the manifest counts it — that slot is then taken by a row of the other
side the merge really dropped (reported COMPACTED, exit 0). The
compacting side's pre-compaction rows exist only in history between the
merge-base and that parent; this rule reads exactly that history, only
when a verdict depends on it, and uses it only to ADD a second, history
check next to the unchanged snapshot-only check (step 4). Re-derived after
code-review round 1 of E417 (the first version of step 4 replaced the
snapshot-only `U` and produced new false positives when the merge's count
for S was below P_c's, and one new false negative; the cases are rows of
the step-7 table). The second shape first filed with E417 — the
NON-compacting side moves a base row out of S — is NOT closed: it is
ambiguous by construction (step 9).

*Terms.* For a ledger file F and a section S: `entry_C(S)` is the
`(done, voided)` pair `parseLedger` reports for S in F's manifest at commit
C (same-named bullets summed, as today), or `(0, 0)` when F is absent at C,
carries no manifest, or its manifest does not name S. Pairs compare and
subtract component-wise. "Closed row" = `[x]` or `[-]`.

1. **When history is read (trigger).** A walk for the pair (P_c, F) runs iff
   at least one section S meets all three:
   - (t1) the merge's copy of F carries a manifest naming S;
   - (t2) exactly one parent's own copy of F carries a manifest naming S —
     that parent is P_c (the compacting parent), the other is P_o;
   - (t3) some `task_id` is not found anywhere at the merge (Row identity)
     while P_o has a closed row of it under F/S — i.e. a row (c) could
     report COMPACTED exists (it passes (a), (b) by t1, (d) by t2).

   One walk covers every S of F that meets t1–t3 for that P_c (the
   *requested sections*). Otherwise no history is read and S keeps the
   snapshot-only rule, with zero extra git calls. In particular the walk is
   skipped when no parent's F names S (the merge compacted S itself: the
   pre-compaction rows are still in the parents' trees, which the snapshots
   already see) and when both parents' F name S ((d) bars every parent row
   under S, so (c) decides no verdict for S).

2. **What is read.** One listing per walk:
   `git log --full-history --topo-order --reverse --max-count=<cap+1> --format=%H %P <merge-base>..<P_c> -- <F>`
   (`--format=%H %P` is one argv element; `%H %P` = the commit and its
   **real** parents from the commit object; `git rev-list --parents` with a
   path argument rewrites parents and must not be used; git applies
   `--max-count` before `--reverse`, so `cap + 1` lines means more than
   `cap` commits; `--full-history` keeps a merge commit that is TREESAME
   to only one parent, which is how a manifest arriving through a merge on
   P_c's path is seen). Then, for each listed commit C and each of C's real
   parents, F's content at that commit (a path absent from that commit's
   tree is an empty ledger, not an error), read through the run's shared
   blob cache and parsed with `parseLedger`. `<cap>` is
   `HISTORY_COMMIT_CAP` = 256.

   **Run probes** — once per run, only when at least one walk is requested,
   before any walk read, in this order; a probe that decides "unreadable"
   applies to every requested walk:
   - (p1) `git rev-parse --is-shallow-repository`: `true` → class
     `shallow repository`; any failure of the probe itself (non-zero exit,
     unexpected output) → class `history unreadable` (recorded decision
     from code-review round 1: a failed shallow probe counts as unreadable
     history).
   - (p2) partial-clone probe:
     `git config --get-regexp ^(extensions\.partialclone|remote\..+\.promisor)$`.
     Exit 1 with no output = no promisor remote, so nothing can be
     lazily fetched and no git-version check is needed. Any printed line —
     other than a `remote.<name>.promisor` whose value is `false`, `no`,
     `off` or `0` — means a partial clone. Any other non-zero exit →
     `history unreadable`.
   - (p3) only for a partial clone: `git version`, parsed with
     `/^git version (\d+)\.(\d+)/`. `GIT_NO_LAZY_FETCH` is honoured from
     git 2.44 on; older, or unparsable output → class `history unreadable`
     with detail `partial clone and git older than 2.44 (or version not
     recognised); history is not read to avoid a fetch`. Chosen over
     "require git 2.44": the check keeps working on any git, and only the
     one configuration that could fetch loses the history read.

   Every walk read runs with `GIT_NO_LAZY_FETCH=1` in its environment, so on
   git 2.44+ a partial clone's missing object becomes an unreadable-history
   fallback, never a network fetch (the tool writes nothing, object store
   included); p2/p3 cover older git.

3. **Transitions and the recovered set H.** Process the listed commits in
   listed order (ancestors before descendants), H starting empty, per
   requested S. For commit C with real parents p_1..p_k: `max` = the
   component-wise maximum of `entry_{p_i}(S)` (`(0, 0)` when k = 0) and
   `inc = entry_C(S) − max`.
   - Either component of `inc` negative → **unreconciled** (count fell).
   - `inc = (0, 0)` → C is not a transition (e.g. a merge commit on P_c's
     path that only carries one side's manifest).
   - Otherwise C is a **transition**. `removed(C)` = the `task_id`s with a
     closed row under F/S in F at any p_i, excluding any id that (r1) has
     a row (any section, any state) in F at C, (r2) has a row anywhere in
     P_c's tip tree (`rowsById` of the P_c snapshot), or (r3) is already in
     H. Each removed id's state is `x` if it is `[x]` at any p_i, else `-`.
     If the `(done, voided)` split of `removed(C)` differs from `inc` →
     **unreconciled** (the count rose by a different number than the rows
     that left S). Else add `removed(C)` to H with those states.

   After the last commit: if H's split exceeds `entry_{P_c}(S)` in either
   component → **unreconciled** (more rows recovered than P_c's manifest
   counts — e.g. two branches inside P_c's history each compacted S and a
   merge kept only one count). If no transition was found, S keeps the
   snapshot-only rule silently, no WARN: S was compacted at or before the
   merge-base, so no post-base summarized row exists to recover.

4. **Two checks in history mode** (the walk completed, at least one
   transition, nothing unreconciled). (c) for F/S fails iff EITHER check
   fails; otherwise it holds.
   - **Snapshot check** — `U_snap` is exactly the snapshot-only `U` above
     (rules (i)/(ii) for kept rows, "`[x]` in any contributing occurrence
     counts as done"), unchanged by history. Fails iff the manifest's pair
     is below `U_snap`'s split in either component; reason text exactly as
     today, no suffix.
   - **History check** (evaluated only when the snapshot check holds) —
     `U_hist = (U_snap − K_out) ∪ H_add`, where
     - `K_out` = ids of `U_snap` that are kept at the merge (found anywhere
       there) and are NOT in H: P_c's manifest provably never counted them
       (a base row P_c deleted outright, e.g.), so in this check they hold
       no slot;
     - `H_add` = ids of H that are (h1) not in `U_snap`, (h2) not found
       anywhere at the merge, (h3) absent from the merge-base tree, and (h4)
       absent from P_o's tip tree — i.e. rows that existed only on P_c's side
       after the merge-base and were summarized there (case 1's T-A-04).
     States: every id of `U_snap` keeps its snapshot state (fixes the review
     round 1 FN3c, where H's state overrode the other parent's `[x]`); an
     `H_add` id takes H's state (what P_c's manifest counted; no other
     record of it exists). Fails iff the manifest's pair is below
     `U_hist`'s split in either component; reason = the existing text built
     from `U_hist`'s numbers plus
     ` — includes <h> row(s) read from <parent label> history after the merge-base`,
     h = |`H_add`|, appended only when h > 0.

   R2 disposition unchanged: when (c) fails for F/S, every `task_id` not
   found at the merge with a parent occurrence under F/S is reported
   MISSING individually with that reason; `H_add` ids are counted but
   never reported themselves (AC1 reports rows present at a parent).

   *Why two checks rather than one replaced `U`.* (1) **No FAIL→PASS**: the
   snapshot check is today's (c) with today's states, so a failure today is
   a failure now. (2) **PASS→FAIL only where history proves the count
   short**: when `H_add` is empty, `U_hist ⊆ U_snap` with the same states,
   so the history check can only fail if the snapshot check already did —
   every case without a post-base summarized row on P_c's side keeps
   today's verdict exactly, whatever the merge did to the count (the
   review round 1 cases FP1, FP2, FP3, FP3b, FP5, FN3c, FP4 all have empty
   `H_add`). When `H_add` is non-empty, `U_hist` holds: rows not found at
   the merge that a parent had (any legitimate merge counts them), kept
   rows P_c summarized (the E203 / AC-E203-6 premise: a kept row that the
   compacting side summarized never frees a slot), and `H_add` rows (no row
   of them exists anywhere at the merge, so a merge that does not count one
   has erased it). Hence the reviewer's suggestion (a) — history only when
   the merge's count is at least P_c's — is not adopted: it is not needed
   for safety (FP1/FP2/FP5 return to PASS because `H_add` is empty, not
   because of the count), and it would lose true positives (step 7 row
   "case 1 + reopened row, count lowered, D01 dropped").
   Suggestion (b) is adopted in a stronger form (all snapshot ids keep
   their snapshot state, not only ids with an occurrence on the other
   parent).

5. **Fallback (human ruling 2026-11-16).** When a walk cannot complete, each
   of its requested sections keeps the snapshot-only rule and gets one WARN
   line; findings, exit code and the RESULT line are computed exactly as if
   no walk had been requested. A walk error never throws out of the walk,
   so it never reaches the outer USAGE_ERROR path. Classes, checked in this
   order:
   - `shallow repository` — probe p1 printed `true` (no detail, no colon);
   - `history unreadable: <detail>` — a failed probe p1/p2, probe p3's old
     or unrecognised git (detail as in step 2), any non-zero git exit, a
     listed commit or real parent whose object is missing, or a blob that
     cannot be read. `<detail>` = the first non-empty line of git's stderr,
     else the first non-empty line of the error message, else
     `git <subcommand> failed`; at most 200 chars. The detail is never
     empty, so the line never renders as `history unreadable: ;`;
   - `history over cap: more than <cap> commits touch <F> between the merge-base and <parent label>` —
     the listing returned `cap + 1` lines (no blob is read for that walk);
   - `history unreconciled: <detail>` — step 3, with detail one of
     `count fell at <short sha>`,
     `count rose by <d> done/<v> voided at <short sha> but <d'> [x]/<v'> [-] row(s) left the section`,
     `<d> [x]/<v> [-] recovered row(s) exceed the parent's manifest <D> done/<V> voided`.

   Line format (one per fallen-back F/S, in the report directly after the
   header line and before `[AC1]`, sorted by parent label, then file, then
   section; the CLI prints the report on stdout as today):
   `WARN (c) history fallback: <parent label> (<short sha>) <F> § <S> — <class>; snapshot-only (c) used for this section`.
   Each fallback is also returned in `findings.historyFallbacks`. The
   output stays deterministic: the same repository objects give the same
   listing order, the same H and the same WARN lines.

6. **Cost bound.** Skipped walks cost nothing (not even the probes; at most
   3 probe calls per run otherwise, `git version` only for a partial clone).
   Walks per run ≤ 2 × L, L = ledger files whose merge copy carries a
   manifest (≤ 4 with the current root + `.current/_primary/` layout; both
   already carry the e125c manifest on every parent, so (t2) only holds
   after a fresh one-sided compaction). Per walk: one `git log` of at most
   257 lines; F's blob at ≤ 256 listed commits and their real parents, ≤
   256 × 3 = 768 blob lookups (a merge commit has two parents), typically
   listed + 1 on a linear path; every distinct blob read at most once per
   run through the shared cache. Worst case per run: 3 probes + 4
   listings + ≤ 3,072 blob lookups. Resolving `<sha>:<F>` to blob ids is
   best done with one `git cat-file --batch-check` process per walk (feed
   `<sha>` lines too, to confirm each commit object exists, since a
   `<sha>:<F>` line prints `missing` both for an absent path and for an
   absent commit); per-blob `cat-file blob` through the existing cache is
   acceptable — the bound is stated in objects, not processes.

7. **Worked cases** — every row below was built as a scratch git repo
   (`commitTree` fixtures, as in the E203 tests) and run against three
   builds: the pre-E417 tool, the first E417 implementation (step 4 as it
   first stood) and a prototype of this step 4. "before" = pre-E417,
   "after" = this rule. Base is Wave T-A-01..03 `[x]` unless stated (ids
   shortened: A01 = T-A-01); M(d) / M(d,v) = manifest "Wave: d done, v
   voided"; P2 is the compacting side unless stated. `H_add` and `K_out`
   per step 4; "snap" / "hist" = the two checks.

   *E417 repro — PASS → FAIL, each a provable loss:*

   | id | shape | H, `H_add`, `K_out` | snap / hist | before → after |
   |---|---|---|---|---|
   | R1 case 1 | P2 adds A04 then compacts M(4); P1 adds D01; merge M(4), no D01 | H A01..04; `H_add` A04 | 4 ≤ 4 / 5 > 4 | PASS → **FAIL**, MISSING A01..03, D01, reason h = 1 |
   | R4 compacted twice | base A01..02; P2: M(2), add A03, M(3); P1 adds D01; merge M(3) | two transitions, H A01..03; `H_add` A03 | 3 ≤ 3 / 4 > 3 | PASS → **FAIL**, MISSING A01, A02, D01 |
   | R5 merge commit on P2's path | P2 = merge of its own line (no ledger change) with a side branch that adds A04 and compacts M(4); P1 adds D01; merge M(4) | side commit is the transition, the merge commit has inc 0; `H_add` A04 | 4 ≤ 4 / 5 > 4 | PASS → **FAIL**, MISSING A01..03, D01 |
   | R6 voided rows | P2 adds `[-]` A04, compacts M(3,1); P1 adds `[-]` D01; merge M(3,1) | `H_add` A04 (`-`) | (3,1) ok / voided 2 > 1 | PASS → **FAIL**, MISSING A01..03, D01 |
   | R7 completion folded into a voided count | base A03 `[-]`; P2 adds A04, compacts M(3,1); P1 completes A03; merge M(3,1), no A03 | `H_add` A04 (`x`); A03 keeps P1's `[x]` | 3 done ≤ 3 / 4 done > 3 | PASS → **FAIL**, MISSING A01..03 |
   | R8 count lowered | P2 adds A04, compacts M(4); P1 reopens A03 and adds D01; merge keeps A03 open, M(3), no D01 | `H_add` A04 | 3 ≤ 3 / 4 > 3 | PASS → **FAIL**, MISSING A01, A02, D01 (suggestion (a) would have passed it) |
   | compactor deleted a base row, merge drops it | P2 deletes A03, adds A04, compacts M(3); P1 = base; merge M(3) | H A01, A02, A04; `H_add` A04 | 3 ≤ 3 / 4 > 3 | PASS → **FAIL**, MISSING A01..03 (A03 is gone with no count, as AC1 for any deleted row) |
   | R1 in a lane ledger | R1 with `.current/lane-a/tasks.md` as F | `H_add` A04 | 4 ≤ 4 / 5 > 4 | PASS → **FAIL** |
   | R1 with parent1 compacting | R1 mirrored | `H_add` A04 | 4 ≤ 4 / 5 > 4 | PASS → **FAIL** |

   *Intended strictness — PASS → FAIL, ambiguous by construction:*

   | id | shape | H, `H_add`, `K_out` | snap / hist | before → after |
   |---|---|---|---|---|
   | S1 kept summarized row plus a post-base summarized row | P2 adds A04, compacts M(4); P1 = base; merge keeps A03 `[x]` literally and writes M(3) | H A01..04; `H_add` A04; A03 in H so not in `K_out` | 3 ≤ 3 / 4 > 3 | PASS → **FAIL**, MISSING A01, A02 |

   S1's snapshots and history are identical to a merge that kept A03 AND
   its count and erased A04's. FAIL is chosen for the same reason
   AC-E203-6 already FAILs its twin (kept A03, dropped D01): a kept row
   the compacting side summarized never frees a manifest slot. It needs a
   hand-edited count and a hand-kept summarized row; the alternative reading
   loses a completed row silently.

   *Must keep today's verdict — review round 1 cases and companions:*

   | id | shape | why unchanged | before → after |
   |---|---|---|---|
   | FP1 | P2 M(3); P1 reopens A03; merge keeps A03 open, M(2) | `H_add` empty | PASS → PASS |
   | FP1k | FP1 with merge M(3) | `H_add` empty | PASS → PASS |
   | FP2 | base A01..04; P2 M(4); P1 moves A04 to `## Other`, adds D01; merge keeps both, M(3) | `H_add` empty | PASS → PASS |
   | FP3 | base A03 `[-]`; P2 M(2,1); P1 un-voids A03; merge M(3,0) | `H_add` empty; snapshot states | PASS → PASS |
   | FP3b | P2 M(3); P1 voids A03; merge M(2,1) | `H_add` empty | PASS → PASS |
   | FP4 | FP1 plus P1 adds D01; merge keeps A03 open, M(3) | `H_add` empty | PASS → PASS (no strictness decision needed) |
   | FP5 | P2 M(3); P1 moves A03 to `.current/lane-a/tasks.md`; merge keeps it there, root M(2) | `H_add` empty | PASS → PASS |
   | FN3c | base A03 `[-]`; P2 M(2,1); P1 completes A03; merge M(2,1), no A03 | snapshot check fails (A03 keeps `[x]`) | FAIL → FAIL, MISSING A01..03 |
   | G1–G5 | R1, case-2 shape, cherry-pick shape, R4, R5 with the merge keeping D01 (cherry-pick: A04 and D01) | hist within count | PASS → PASS |
   | R6 / R7 / R8 companions | merge keeps D01 (R6, R8) or counts A03 done, M(4,0) (R7) | hist within count | PASS → PASS |
   | merge also summarizes D01 | R1 with merge M(5) | 5 ≤ 5 | PASS → PASS |
   | compactor deleted a base row, merge keeps it | as above, merge keeps A03, M(3) | A03 in `K_out`; hist A01, A02, A04 = 3 | PASS → PASS (the case that rules out a plain `U_snap ∪ H_add`) |
   | compactor deleted A03, M(2); merge keeps A03, writes M(3), drops D01 | — | snapshot check fails as today | FAIL → FAIL |
   | voided post-base row, D01 `[x]` dropped | P2 adds `[-]` A04, M(3,1); P1 adds `[x]` D01; merge M(3,1) | snapshot check fails as today | FAIL → FAIL |
   | unrelated kept row | R1 keep plus P1 adds E01, merge keeps it | hist 4 ≤ 4 | PASS → PASS |
   | review round 1 G-set | compaction commit also adds a kept row; also moves a row to a lane ledger; duplicate id in two sections (WARN); split compaction (WARN); criss-cross keep / drop; renamed section (FAIL both); discarded side compaction keep / drop (WARN); compact–revert–recompact (WARN); zero-count manifest; P1 deletes a base row and keeps D01; two sections compacted, one requested | unchanged | as before, same ids |
   | AC-E203-1, -3, -4, -6, -7 | the E203 fixtures | `H_add` empty (all H rows are base rows) | PASS / FAIL / FAIL + WARN / FAIL / PASS, unchanged |
   | every e126 case | — | skipped by t1/t2 (no manifest on a parent) or t3 (AC11 (iii)) | unchanged |
   | shallow / missing object / over cap / failed probe / partial clone on old git | — | WARN, snapshot-only | unchanged |

   *Accepted limits — PASS → PASS although the merge may have dropped a row (step 9):*

   | id | shape | why history cannot decide | before → after |
   |---|---|---|---|
   | case 2 | base A01..04; P2 M(4); P1 moves A04 to `## Other`, adds D01; merge M(4) + Other A04, no D01 | A04 is a base row (h3) | PASS → PASS |
   | cherry-pick | P2 adds A04, compacts M(4); P1 adds A04 and D01; merge M(4) + Wave A04, no D01 | A04 is in P1's tip (h4) | PASS → PASS |
   | other side deleted a base row | P2 adds A04, compacts M(4); P1 deletes A03, adds D01; merge M(4), no D01 | `H_add` A04, but A03 is not in `U_snap` either; hist {A01, A02, D01, A04} = 4 ≤ 4 | PASS → PASS |

   Scratch-run totals: 51 fixtures; zero FAIL → PASS; PASS → FAIL only in
   the 9 repro rows and the 1 intended-strictness row above. Running
   `test/e126-merge-invariants.test.mjs` and
   `test/e203-merge-invariants-union.test.mjs` (with R1–R5 as committed in
   1368ea4) against the prototype: 24 of 26 pass; the 2 failures are R2 and
   R3, whose expectation this amendment flips to PASS (accepted limits).

8. **No new false positive, no new false negative.** By step 4's two-check
   construction: the snapshot check is today's (c) with today's states, so
   nothing that fails today passes; the history check can fail only when
   `H_add` is non-empty, and then only by counting rows a legitimate merge
   must count, plus kept rows the compacting side summarized — the premise
   the E203 rule already applies (S1 is the one shape where that premise
   turns a PASS into a FAIL, listed as intended strictness). Whenever P_c's
   history breaks step 3's premises the rule falls back to the snapshot
   check alone — never to a stricter one — with a WARN line.

9. **Limits that remain (accepted, not detected).** Human ruling 2026-11-16:
   no second mechanism, no new ticket.
   - **Case 2** (the non-compacting side moves a base row out of S, the
     merge drops a new row): not closed. A merge may legitimately keep the
     moved row literally, take it out of the count and summarize the new
     row instead — same count, same snapshots, same history as the drop.
     Closing case 2 would make that merge FAIL (the review round 1 FP2
     family) and telling the two apart would need information neither the
     snapshots nor the history carry. The same holds for the cherry-pick
     shape (the row is in the other side's tip) and for a base row the
     other side deleted. These are the rows of the "Accepted limits" table.
   - Every fallback in step 5 (shallow clone, failed probe, partial clone
     on git older than 2.44, missing objects, git error, more than 256
     commits, unreconciled history): case 1 passes as before, with a WARN.
   - A compaction that removed its rows in a different commit from the one
     that raised the count, or a ledger relocated between the compaction
     and P_c's tip: unreconciled, snapshot check only.
   - Both parents compacting S: (d) bars every parent row, the walk is
     skipped, and a merge that resolves two different counts for S into
     the smaller one is not detected (unchanged).

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
- **AC12** (E417, condition (c) history rule — sr-engineer, in
  `test/e203-merge-invariants-union.test.mjs`). Fixtures build multi-commit
  parent paths with `commitTree`, literals as in that file (`ROWS3`,
  `MANIFEST(n)`, `NEW_ROW`); shapes exactly as the step-7 rows of the
  same id. Three groups:
  - **Repro (red before, green after; listed in
    `qa_reports/expected-red_e417-merge-invariants-lost-row.txt` as
    `<test file> | <exact test name>`)** — each must FAIL, exit 1, with the
    listed ids MISSING, each carrying the `(c) manifest under-reconciles`
    reason, and the history-only id (T-A-04) neither MISSING nor COMPACTED:
    - R1, R4, R5 — kept exactly as committed in 1368ea4 (names unchanged;
      R1 still asserts the `includes 1 row(s) read from parent2 history
      after the merge-base` suffix).
    - **R6** — step-7 row R6; MISSING T-A-01..03, T-D-01.
      proof: "E417 R6: a voided row the compacting side added after the merge-base and summarized does not free a voided slot for a dropped voided row"
    - **R7** — step-7 row R7; MISSING T-A-01..03.
      proof: "E417 R7: a completion on the other side is not hidden in the voided count when the compacting side also summarized a post-base row"
    - **R8** — step-7 row R8; MISSING T-A-01, T-A-02, T-D-01.
      proof: "E417 R8: a merge that lowers the count for a reopened row still fails when a post-base summarized row and a dropped row both need slots"
  - **Accepted-limit pins (green before and after; NOT in the manifest)** —
    the committed R2 and R3 are rewritten (renamed, expectation flipped)
    and their two lines removed from the manifest:
    - **R2** → "E417 R2: case 2 (the non-compacting side moved a base row out of the section) stays an accepted limit and passes" — PASS, exit 0, no MISSING.
    - **R3** → "E417 R3: the cherry-pick shape (the summarized row is also in the other side's tip) stays an accepted limit and passes" — PASS, exit 0, no MISSING.
  - **Review round 1 guards (green before and after; NOT in the
    manifest)** — step-7 rows of the same id, each run once:
    - "E417 FP1: the other side reopens a base row and the merge lowers the count; PASS" — PASS, no MISSING.
    - "E417 FP2: case-2 shape with the merge keeping both rows and lowering the count; PASS" — PASS.
    - "E417 FP3: the other side un-voids a base row and the merge counts it done; PASS" — PASS.
    - "E417 FP3b: the other side voids a base row and the merge counts it voided; PASS" — PASS.
    - "E417 FP4: reopened base row plus a new row, merge keeps the compacting side's count; PASS" — PASS.
    - "E417 FP5: the other side moves a base row to a lane ledger and the merge lowers the root count; PASS" — PASS.
    - "E417 FN3c: a completion folded into the compacting side's voided count still FAILs" — FAIL, MISSING T-A-01..03.
- **AC13** (E417 companions + fallback, qa-engineer) — new file
  `test/e417-merge-invariants-history.test.mjs`, names prefixed `E417`.
  - **G1–G5** — R1, case-2 shape, cherry-pick shape, R4, R5 with the merge
    keeping T-D-01 (cherry-pick: T-A-04 and T-D-01 under `## Wave`): PASS,
    exit 0, no MISSING, COMPACTED = the summarized ids found at a parent
    (T-A-01..03; R4: T-A-01, T-A-02), no `WARN (c)` line.
    proof: "E417 G1".."E417 G5"
  - **G6–G8** — the R6 / R8 companions (merge keeps T-D-01) and the R7
    companion (merge writes M(4,0)): PASS, no MISSING.
    proof: "E417 G6".."E417 G8"
  - **S1 intended strictness** — step-7 row S1: FAIL, exit 1, MISSING
    T-A-01, T-A-02, reason with the `includes 1 row(s) read from parent2
    history` suffix. The test comment cites step 7's S1 paragraph.
    proof: "E417 S1: a kept row the compacting side summarized does not free a slot for its post-base summarized row (intended strictness)"
  - **K1 / K2** — compactor deleted a base row: merge keeps it → PASS
    (`K_out`); merge drops it → FAIL, MISSING T-A-01..03.
    proof: "E417 K1: a kept base row the compacting side deleted holds no slot in the history check", "E417 K2: a base row the compacting side deleted and the merge dropped is MISSING"
  - **F1 shallow** — R1 fixture with the merge-base sha written to
    `.git/shallow`: PASS (snapshot verdict), exit 0, exactly one line
    matching
    `/^WARN \(c\) history fallback: parent2 \([0-9a-f]{7}\) tasks\.md § Wave — shallow repository; snapshot-only \(c\) used for this section$/m`
    before the `[AC1]` line; `findings.historyFallbacks` = one entry with
    `reason: "shallow"`; a second run gives a byte-identical report.
    proof: "E417 F1: a shallow repository falls back to the snapshot-only rule with one WARN line, exit code unchanged"
  - **F2 missing object** — R1 fixture with the loose object of
    `<c1>:tasks.md` deleted (c1 = the T-A-04 commit): PASS, exit 0, one WARN
    whose class starts `history unreadable: ` followed by a non-empty detail.
    proof: "E417 F2: an unreadable history object falls back with a WARN line, exit code unchanged"
  - **F3 over cap** — R1 fixture via
    `runMergeInvariants(merge, root, { historyCommitCap: 1 })`: PASS, one
    WARN with class `history over cap: more than 1 commits touch tasks.md between the merge-base and parent2`.
    proof: "E417 F3: history over the commit cap falls back with a WARN line"
  - **F4 unreconciled** — AC-E203-4 fixture: FAIL, exit 1, MISSING
    T-A-01..03 as today, one WARN with class
    `history unreconciled: count rose by 2 done/0 voided at <short sha> but 3 [x]/0 [-] row(s) left the section`.
    proof: "E417 F4: an unreconciled compaction keeps today's verdict and adds a WARN line"
  - **F5 skip** — AC11 (iii) and AC11 clean-compaction fixtures, each with
    `.git/shallow` written: verdicts as today, no `WARN (c)` line.
    proof: "E417 F5: no history is read when no verdict depends on it"
  - **F6 partial clone** — point a branch at the R1 merge
    (`git update-ref refs/heads/main <merge>`; the fixtures make bare
    commit objects), clone it with
    `git clone --filter=blob:none --no-local file://<fixture>`: on the
    running git (2.44+) the walk reaches c1's missing blob (the four
    snapshot reads may still fetch their own blobs lazily — pre-existing,
    out of E417's scope),
    the run gives PASS + one `history unreadable:` WARN, and c1's blob is
    still absent afterwards (`git cat-file -e` fails), i.e. no fetch.
    Skip with a reason when `git version` < 2.44.
    proof: "E417 F6: a partial clone never fetches during the history read"
  - **F7 probe helpers** (pure, exported per the architecture file):
    `gitVersionAllowsNoLazyFetch` → false for `git version 2.43.0` and for
    unparsable text, true for `git version 2.44.0` and
    `git version 2.50.1 (Apple Git-155)`; `historyErrorDetail` → the first
    non-empty stderr line, else the first non-empty message line, else
    `git <subcommand> failed` (never empty).
    proof: "E417 F7: the git-version gate and the WARN detail are never empty"
  - **N1** — every existing case in `test/e126-merge-invariants.test.mjs`
    and the AC-E203 cases pass unmodified.
    proof: `node --test test/e126-merge-invariants.test.mjs test/e203-merge-invariants-union.test.mjs test/e417-merge-invariants-history.test.mjs`

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
| T-E417-01 (architect) | AC12, AC13 (spec only) | the *Condition (c) history rule (E417)* block and AC12/AC13 |
| T-E417-02 (sr) | AC12 (repro first, expected-red manifest), then the rule | `tools/merge-invariants.ts` + `dist/tools/merge-invariants.*`; contracts in `specs/e417-merge-invariants-lost-row-architecture.md` |
| T-E417-03 (qa) | AC12 green, AC13 | new `test/e417-merge-invariants-history.test.mjs`; review O-2 is moot after the re-derivation (the cherry-pick shape stays an accepted limit, now alongside case 2), so the header comment of `test/e203-merge-invariants-union.test.mjs` only needs case 2 added if sr has not done it |

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
| merge.c.history-warn (E417) | `WARN (c) history fallback: <parent label> (<short sha>) <F> § <S> — <class>; snapshot-only (c) used for this section` — classes per *Condition (c) history rule (E417)* step 5 | authored-here |
| merge.c.history-suffix (E417) | ` — includes <h> row(s) read from <parent label> history after the merge-base` appended to the history-check (c) reason when h > 0 (step 4) | authored-here |

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
- E417 changes condition (c) only: conditions (a), (b), (d), AC2's
  mechanics, AC3, the CLI argv/exit-code contract (beyond the WARN lines in
  the report) and the integrator SOP are unchanged; the tool still only
  reads git, writes nothing and fires no gate.
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
