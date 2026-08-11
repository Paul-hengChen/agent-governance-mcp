# Review — T-E50-02 (T-E50-01)

covers: T-E50-02, T-E50-01

## Round 1 — CHANGES_REQUESTED — by code-reviewer

## Summary
- One file changed: `content/skill-release-engineer.md`, 36 insertions / 24 deletions. Boundary re-verified independently — `git diff --stat` reports that file plus `.current/handoff.md` and `tasks.md` (state bookkeeping) and nothing else. Zero source / gate / schema / prompt / constitution / test files touched. Content-only claim: **confirmed**.
- **The v3 (E49) membership predicate was NOT reshaped.** `:66-67` are byte-identical to `HEAD:content/skill-release-engineer.md:57-58`. It is wrapped, not rewritten. Confirmed by direct comparison, and step 8 / AC4 (E44) is untouched — the only line in the diff containing the token `AC4` is (b)'s new bullet; all three pre-existing AC4 lines compare byte-identical.
- **I re-ran the six-release backtest from git's own record, and it reproduces sr-engineer's table exactly** — including the `review_reports` column and the zero-extra-codes union claim. I added a seventh release (v3.96.0) that sr-engineer did not run, and it is the one that most matters: it is the first release where `review_reports/` carried a new file at all, and it independently confirms (c)'s parallel-destination pin against a **real** basename collision.
- **(c) and (d) are correct and I would approve them standing alone. (a) and (b) each ship a defect.** (b)'s log line references a shell variable the SOP never assigns, so executed literally it prints `{∅}` on *every* release — inverting the exact ambiguity it was written to remove. (a) is fail-safe (it never sweeps) but its global-OR outcome permanently wedges any workspace that has never produced a `review_reports/` tree, and the STOP it routes to targets a state transition the server rejects.
- Verdict: **CHANGES_REQUESTED** — F8 and F9 blocking. Both are one-clause fixes inside the existing structure; neither requires reopening the predicate.

## Correctness

### F8 — BLOCKING — `content/skill-release-engineer.md:80`: `${CODES:-∅}` expands an unassigned variable, so the log always prints `∅`

The (b) bullet instructs `echo "step 7a: <CODES> = {${CODES:-∅}}"`. But `CODES` is never assigned anywhere in the file:

```
$ grep -n 'CODES=' content/skill-release-engineer.md
(no output)
```

The derivation at `:65-70` is two bare pipelines that write paths to **stdout** and capture nothing. `:71` then says "Take the `T-<CODE>-` prefix off each resulting filename … and union both into one `<CODES>` set" — a prose instruction, with no shell binding. So the `${CODES:-∅}` expansion in the very next bullet resolves against an unset variable. Executed literally, on a release whose real set is `{E37,E38}`:

```
$ bash -c 'PREV_TAG=v3.93.0; echo "step 7a: <CODES> = {${CODES:-∅}}"'
step 7a: <CODES> = {∅}
```

This is worse than shipping no logging at all. The bullet's stated purpose is to make "a correct empty-by-design no-op and a broken empty-by-breakage run" distinguishable in the release transcript. As written it makes **every** release, empty or not, render as empty-by-design — it does not merely fail to disambiguate, it writes false evidence into the artifact a future reviewer would trust. Round 2's F7 hid for two full rounds precisely because `∅` was unattributable; this bullet manufactures that same `∅` unconditionally.

The "e.g." and the `<CODES>` placebracket do not rescue it. This file's sibling blocks establish the opposite convention — `:55` assigns `PREV_TAG=$(git describe --tags --abbrev=0)` and `:58` assigns `BASELINE_EMPTY=` — both real, copy-pasteable bindings inside fenced or inline code. A reader has every reason to treat `:80` the same way, and the one who does gets a lie. This is the E43/E44/E49-F1/F2/F3 class verbatim: literal SOP text that does not do what it says.

**Required change:** bind the variable the derivation produces, so the echo has something to expand. Direction, not mandated wording — e.g. capture both pipelines into `CODES` at `:65-70`:
```
CODES=$( { find qa_reports -maxdepth 1 -type f; find review_reports -maxdepth 1 -type f; } | sort \
  | grep -vxFf <(git ls-tree -r --name-only "$PREV_TAG" -- qa_reports/ review_reports/) \
  | sed -E 's#.*/##' | grep -oE '^[a-z_]*T-[A-Za-z0-9]+-' \
  | sed -E 's/^[a-z_]*T-//; s/-$//' | tr 'a-z' 'A-Z' | sort -u | tr '\n' ' ' )
```
(`git ls-tree` accepts both pathspecs in one invocation, verified.) Whatever form is chosen, the constraint is: the identifier the echo expands must be the identifier the derivation writes, and running the log line on the v3.94.0 shape must print `{E37 E38 }`, not `{∅}`. Note that keeping the two `find` pipelines separate is also fine — capture each and concatenate — but the predicate itself must stay byte-identical (see "Predicate integrity" below).

### F9 — BLOCKING — `:56-63`: the guard is a global OR, not the per-tree check its prose claims, and it permanently wedges any workspace without a `review_reports/` tree

`:56` states: *"Check both trees independently — one tree can be seeded while the other is not."* The code at `:58-61` does not do that. It folds three checks into **one** flag:

```
BASELINE_EMPTY=
[ -z "$PREV_TAG" ] && BASELINE_EMPTY=1
git ls-tree … -- qa_reports/     … | grep -q . || BASELINE_EMPTY=1
git ls-tree … -- review_reports/ … | grep -q . || BASELINE_EMPTY=1
```

The *checks* are separate; the *outcome* is global. Either tree empty → STOP for both.

**On the direction of the error: it does not let a half-seeded workspace through.** I want to answer the question as asked. A global OR is strictly more conservative than per-tree routing — every empty-baseline combination reaches STOP, none reaches `grep -vxFf`. The N4 unbounded-sweep hazard is genuinely closed, and the guard is correctly ordered (see "Guard ordering", below). The failure is in the other direction, and it is not benign.

**The wedge, reproduced in a scratch repo.** A workspace whose `qa_reports/` is tracked at every tag but which has never produced a `review_reports/` tree:

```
PREV_TAG=v1.0.0
BASELINE_EMPTY=1  -> STOP=YES
  (the qa_reports derivation would have been safe and correct:)
  qa_reports/review_T-NEW-01.md
release 3: PREV_TAG=v1.1.0 BASELINE_EMPTY=1 -> STOP=YES  (PERMANENT)
```

The STOP recurs at release 3, 4, N — forever. Nothing in the loop ever creates `review_reports/`, so the condition never clears on its own. And the qa half of the derivation was safe and correct at every one of those releases: the guard blocks work it had no reason to block.

This class is not exotic. `bin/agc-init.mjs` scaffolds **neither** `qa_reports/` nor `review_reports/` (`grep` over that file returns no such path) — both directories come into existence only when a role first writes into them. `review_reports/` is written by code-reviewer; a `teamwork-lite` workspace never dispatches code-reviewer, and the `release-engineer` prompt is separately registered, so that workspace can and does reach step 7a. Every such workspace released fine under v3.96.0 and is permanently blocked under this diff. The narrower case — a workspace whose first release predates its first code review — eats one STOP and then self-heals; the lite case does not.

The derivation half is not directory-absence-safe either, so the guard is currently the only thing standing between that workspace and a hard error:
```
$ find review_reports -maxdepth 1 -type f
bfs: error: review_reports: No such file or directory.   (exit 1)
```

**Required change:** make the outcome per-tree, matching what `:56` already promises. An absent or never-tracked `review_reports/` is *"this workspace has no code-review evidence to archive"* — not *"no baseline to diff against."* Those are different facts and the guard currently conflates them. Concretely: a tree whose baseline is empty is excluded from derivation and from the sweep; STOP is reserved for the case the guard was actually written for — `PREV_TAG` unset, or a baseline that is empty **while that tree has root-level files that would be swept**. That preserves N4's protection exactly (the mass-sweep needs root files to sweep) without blocking a release over a directory that legitimately does not exist. Whatever form is chosen, `:56`'s prose and the code must agree.

### F10 — non-blocking, MUST FILE — `:127`: the new Escalation Routes row targets a transition the server rejects

`release-engineer:Blocked` is not reachable. Verified against the compiled validator rather than by reading the table:

```
release-engineer:In_Progress -> release-engineer:Blocked  =>  REJECTED
    allowed=[{pm, In_Progress}]
qa-engineer:PASS             -> release-engineer:Blocked  =>  REJECTED
    allowed=[{pm,In_Progress},{researcher,In_Progress},{release-engineer,In_Progress},{design-auditor,In_Progress}]
release-engineer:Blocked     -> release-engineer:Blocked  =>  REJECTED  allowed=[]
```

`ALLOWED_TRANSITIONS` (`tools/transitions.ts:315-321`) declares exactly two release-engineer keys — `release-engineer:In_Progress` (→ `pm:In_Progress` only) and `release-engineer:PASS`. There is **no** `release-engineer:Blocked` key at all (`grep -n '":Blocked"' tools/transitions.ts` finds six peer roles and not this one), and the self-loop fast path at `:470-478` requires `In_Progress → In_Progress`, so a status change to `Blocked` falls straight through to table lookup and is rejected. Were the role somehow to land there, `allowed=[]` — a dead end.

**Why this is not blocking, stated plainly.** Three of the four release-engineer Blocked rows already ship in `HEAD` (push rejection D10, `gh` missing, self-check failure). E50 adds a fourth row to a table where none of the four edges exist; it does not make the hole deeper in kind, and the remedy is `tools/transitions.ts` — source, explicitly outside this content-only cut and outside the boundary the release-engineer role is permitted to cross. Blocking E50 on it would neither fix the three shipped rows nor be fixable within this ticket.

**Why it still matters here, and what it changes about F9.** This row is the *only* stated remedy for the guard, and unlike the other three (genuine emergencies where a human is already watching) it sits on a normal control-flow branch that F9 shows is routinely reachable. So the wedged workspace of F9 has no sanctioned exit at all: the SOP says STOP and write `Blocked`, and the server refuses the write. F9's fix must therefore not depend on the `Blocked` write landing — surface to the human in chat and hold. File a source ticket for the four missing `release-engineer:Blocked` edges (and the `allowed=[]` dead end once the state is reachable).

### Predicate integrity — CONFIRMED, the v3 rule was not reshaped

Direct comparison of the two predicate lines against `HEAD`:

| | `HEAD` | working tree |
|---|---|---|
| `find qa_reports -maxdepth 1 -type f \| sort \` | `:57` | `:66` |
| `\| grep -vxFf <(git ls-tree -r --name-only "$PREV_TAG" -- qa_reports/)` | `:58` | `:67` |

Byte-identical, position shifted only. `:68-69` add the `review_reports/` pair under the *same* form. `:64`'s surrounding prose gains the `review_reports/` path and the N5 parenthetical and is otherwise the same argument. `:71`'s `-maxdepth 1` / archive-subsumption clause is preserved and correctly generalized to "either tree's `archive/`". The E49 derivation is wrapped, not rewritten — which is what E50 was scoped to do.

### Step 8 / AC4 (E44) — CONFIRMED UNTOUCHED

Comparing every line containing `AC4` between `HEAD` and the working tree yields a single `0a1` — one **addition**, zero modifications, zero deletions — and that addition is (b)'s own new bullet at `:80`, which merely *cites* AC4's SKIP branch as precedent. The three pre-existing AC4 lines (step 8's staging cross-reference and the post-commit REQUIRE/SKIP/UNCLASSIFIABLE machinery) are byte-identical. E44's work is intact.

### Guard ordering — CONFIRMED CORRECT

The question is whether a guard that routes to `Blocked` can itself be outrun by a `mv`. It cannot, on two independent grounds:
1. **Position.** `:56-63` (guard) precedes `:64-79` (derivation), `:81` (`mkdir -p`), and `:82-85` (the moves). `:63` states the exit explicitly — *"do NOT proceed to the derivation and do NOT sweep"* — before any mutating bullet exists in the reading order.
2. **The guard performs no writes.** Its only commands are `git ls-tree`, `grep -q`, `[ -z ]`, and a variable assignment. There is no `mv`, no `mkdir`, no `git add` inside it. Even a role that mis-orders the bullets cannot sweep *from* the guard.

`:63`'s handling of route 1 is also right, and I want to record why: it explicitly declines the tempting shortcut ("Route 1 in a brand-new workspace would happen to sweep correctly … that is an accident of that one route"). Round 3's N4 named exactly that trap. Both routes STOP identically. Correct call.

### Independent six-release backtest (mine, re-run from git's record)

I reused round 3's reconstruction method rather than sr-engineer's, and extended it symmetrically: at 7a time every root-level file in *either* tree is either already tracked at the parent commit (present in a `git worktree add --detach <release>^` checkout, nothing to restore) or untracked, in which case the release commit records it as an `A` — under `archive/` if 7a moved it, at root if it did not. So the complete untracked-at-7a set for a tree is exactly *every path the release commit added under that tree*, mapped to its root basename. I restored that whole set — for `review_reports/` too — and ran the shipped pipelines verbatim in seven detached worktrees. Script at `/tmp/e50_cr_backtest.sh`.

| release | PREV_TAG | restored (qa / rr) | guard | qa_reports `<CODES>` | review_reports `<CODES>` | union | actually archived |
|---|---|---|---|---|---|---|---|
| v3.91.0 | v3.90.0 | 0 / 0 | clear | `{E25 E27 E28 E29 E30 E32 E33 RELSOP}` | `{E25 E32}` | `{E25 E27 E28 E29 E30 E32 E33 RELSOP}` | same 8 |
| v3.92.0 | v3.91.0 | 0 / 0 | clear | `{E34}` | `{E34}` | `{E34}` | `{E34}` |
| v3.92.1 | v3.92.0 | 0 / 0 | clear | `{E35}` | `{E35}` | `{E35}` | `{E35}` |
| v3.93.0 | v3.92.1 | 1 / 1 | clear | `{E36}` | `{E36}` | `{E36}` | `{E36}` |
| v3.94.0 | v3.93.0 | 2 / 2 | clear | `{E37 E38}` | `{E37 E38}` | `{E37 E38}` | `{E37 E38}` |
| v3.95.0 | v3.94.0 | 0 / 0 | clear | `{E45 E46}` | `{E45 E46}` | `{E45 E46}` | `{E46}` |
| **v3.96.0** | v3.95.0 | 4 / 1 | clear | `{E44 E49 E4X}` | `{E4X}` | `{E44 E49 E4X}` | `{E44 E49 E4X}` |

Every claim sr-engineer made about this table reproduces: the guard fires on none of the six; the `qa_reports` column is round-3 ground truth verbatim; the union adds **zero** extra codes on any release. The v3.95.0 row's `{E45 E46}` vs `{E46}` disagreement is round 3's established result — the rule is right and history is wrong; that orphan is E49's motivating defect.

**Is the extended restore faithful, or does it manufacture the inputs that make column 2 pass?** Faithful, and the completeness argument is what makes it so — the same argument round 3 used, and it transfers without weakening:
1. The restore rule reads git's record of each release commit. It never consults the new SOP text, sr-engineer's notes, or the expected answer, and it was applied unchanged to all seven releases including the four needing zero restores.
2. It is complete, not selective. For v3.93.0 exactly one `review_reports` file was restorable and for v3.94.0 exactly two — and the derivation returned precisely those. There was no larger pool from which a flattering subset could be drawn, so the restore step has no free parameter.
3. For `review_reports/` the completeness argument is in fact *stronger* than for `qa_reports/`, because 7a has never moved a `review_reports/` file in this repo's history — there is no `review_reports/archive/` anywhere in any tag. So the untracked-at-7a set is unambiguously "the A's at root", with no archive branch to reason about.
4. Bounded residual, disclosed: a file created before 7a but committed by some *later* commit rather than the release commit would be invisible to this reconstruction. Round 3 carried the same residual for `qa_reports/` and it remains unaddressed for both trees. I did not find an instance; I cannot prove there is none.

**The seventh row is the one that decides (c), and sr-engineer did not run it.** v3.96.0 is the first release where `review_reports/` carried a new file at 7a time. Under E50's rule that file is `review_reports/review_T-E4X-03.md` → destination `review_reports/archive/e44-e49-release-sop-conditional-checks/`. And:

```
$ find qa_reports review_reports -name 'review_T-E4X-03.md'
review_reports/review_T-E4X-03.md
qa_reports/archive/e44-e49-release-sop-conditional-checks/review_T-E4X-03.md
```

Both exist, same basename, and the `qa_reports` copy was placed in that archive dir *by the same release's 7a run*. A shared destination would have put two distinct files at one path and `mv -n` would have silently dropped the second — the exact silent-orphan class this step exists to kill, on the exact release in question. The parallel-tree pin is not a stylistic preference; it is load-bearing, and this is its proof.

### Item 7 — ∅-logging on the live tree, and whether the tracked status of `review_T-E4X-03.md` undercuts (c)

Confirmed on the live tree:
```
PREV_TAG=v3.96.0
-- qa_reports new --      (none, exit 1)
-- review_reports new --  (none, exit 1)
BASELINE_EMPTY=clear
```
Both trees derive `<none>`, guard clear. `<CODES> = ∅`, correctly and by design — nothing at either root is new since v3.96.0 yet. (Per F8, the shipped log line would print `{∅}` here for the wrong reason, so this particular run cannot distinguish the two causes. That is the defect, illustrated.)

**The tracked-status correction does not undercut (c) — it strengthens it.** `review_reports/review_T-E4X-03.md` is indeed committed in `27f59e2`, but it appears there with status **`A`**: it was *added by the v3.96.0 release commit*, which means it was untracked at that release's 7a time. So it is not a counterexample to the untracked-evidence case (c) targets; it is an instance of it. And (c)'s rationale never depended on tracked status in the first place — it rests on a basename collision at the destination, which is a property of the two filenames, not of the git index. Both legs hold.

### Item 4 — union semantics across a split destination

- **A code present in only one tree.** Verified on the v3.96.0 row: `E44` and `E49` enter `<CODES>` from `qa_reports/` alone. `:83`'s `review_reports/` move then matches nothing for them and no-ops. No spurious file lands in the wrong tree, and `:86`'s `mv -n` makes a retry idempotent. Correct.
- **Spurious `mkdir`.** `:81` creates *both* archive dirs unconditionally, so a release where only one tree has matches leaves an empty directory in the other — and a `<CODES> = ∅` release leaves two. Harmless in git (empty directories are not tracked, so nothing enters the release commit) but it is working-tree litter and sits awkwardly against `:87`'s "Zero matches = silent no-op". Non-blocking (N11).
- **`covers:` sweep across the split.** `:85` is correct as written: each tree's `covers:`-matching files go to that tree's own archive dir, "never cross-filed". I checked the live instance — `review_reports/review_T-E4X-03.md` carries `covers: T-E4X-03, T-E44-01, T-E49-01`, all three of which are in v3.96.0's `<CODES>`; it moves to `review_reports/archive/`, while the `qa_reports` files covering the same ids move to `qa_reports/archive/`. Cross-referencing works because the `<CODES>` set is shared while the destination is resolved per source tree. That is the right decomposition.
- **But the union widens F4's residual, and `:79` no longer describes it accurately** (N12, below).

### N12 — non-blocking — `:79`: the union gives `<CODES>` a second, independent source, and the F4 paragraph was not updated to say so

`:79` was updated to name both paths (`qa_reports/`/`review_reports/`) but still describes the residual as if there were one stream: "a ticket that WAS code-reviewed and then deferred or FAILed out, whose evidence file sits at root and is new since `$PREV_TAG`, still would" enter the set. Under the union that hazard is now strictly larger in a way the sentence does not capture: a code can enter `<CODES>` from `review_reports/` **alone** — which is precisely the deferred/FAILed-out shape, since a ticket that was code-reviewed but never reached QA PASS has a `review_reports/` file and no `qa_reports/` file — and once in the set it drives the `qa_reports/` `covers:` sweep at `:85` as well. So a ticket that got as far as code review and no further can now pull a *QA* evidence file into a shipping feature's archive dir. Round 2 and 3 asked for this residual to be stated honestly rather than papered over, and `:79` does state it honestly for the single-stream case; one clause should extend it to the union. Non-blocking — it is a misfiling under `mv -n`, reversible with `git mv`, and I found no instance across seven releases (the union added zero codes on all of them).

### N13 — non-blocking — `:80`: a time-stamped observation inside an imperative bullet

"(a docs-only release; this repo's own working tree at the time of writing derives `∅`)" is true today — I confirmed it above — and false the moment QA writes this chain's evidence. Same placement class as the round-1/2 quality findings that were resolved by moving rationale into `<!-- rationale -->` tags. Cheap to fix while F8 is being fixed.

### N6 (carried from round 3) — still true, still not this ticket's
The `<!-- origin -->` / `<!-- rationale -->` tags survive the `tw_switch_role` render path (`tools/role.ts` never calls `stripOriginTags`/`stripRationale`), and `:87` adds a *third* revision clause inside the MUST NOT's origin tag. My own `code-reviewer` SOP arrived this session carrying `<!-- origin:start --> (v3.58.0, C16)<!-- origin:end -->` verbatim, so the asymmetry is unchanged. Pre-existing and repo-wide; noting only so it is not read as new.

## Quality
- `:56` — the "Check both trees independently" sentence is the load-bearing half of F9. Prose and code must be made to agree whichever way the fix goes.
- `:54` — the header text `7a. **Archive shipped feature's qa_reports**` is byte-identical to `HEAD`, with the scope extension moved into the trailing parenthetical. This is the right call and it is what keeps `test/release-staging.test.mjs:1108`'s `SKILL.indexOf("7a. **Archive shipped feature's qa_reports**")` step-order pin green. sr-engineer's self-reported snag and its resolution both check out; 1657/1657 confirms.
- `:87`'s origin tag now carries three revisions of rescoping history, and `:71`/`:79` each grew a `/`-joined dual path. The bullet list is drifting back toward the density round 2 flagged and round 3 credited as fixed. Not a finding this round; worth watching if E50 gains a round 2.
- N11 (from item 4 above): `:81`'s unconditional two-directory `mkdir -p`.

## Architecture
Unchanged and sound. SOP prose only; no source added; `parseCoversIds`/`buildCoverageIndex` in `tools/evidence-file.ts` correctly retained at `:85` as the semantic reference "expressed as shell … not new source code". The one-release-one-archive-dir invariant is preserved and correctly generalized to one dir **per tree** at `:81`, with the two trees kept parallel rather than merged — validated empirically above.

The two edits outside step 7a are both genuinely required, not scope creep:
- **`:35` (Artifact allowlist)** is *mandatory* for (c), not decorative. `:37` states release-engineer MUST NOT touch source outside the allowlist; without a `review_reports/archive/**` entry, every move (c) instructs would be a role-boundary violation by the file's own rules. The entry is correctly scoped (move-only, never authoring content) and mirrors the `qa_reports/archive/**` row above it.
- **`:129` (Expected-vs-unrelated scope rule)** is likewise required: the archive moves show up in `git status --short` as deleted root paths plus new archive paths, and without the note they would trip the first Escalation Routes row's STOP. `review_reports/` was already in the EXPECTED directory list, so only the archive-moves sentence needed extending — and that is all that changed.
- **`:127` (new Escalation Routes row)** is required by (a) — a guard needs a route. It is also the fourth Blocked row for this role, so it is not the new state surface it appears to be. See F10 for the edge that does not exist.

## Security
No findings. No new trust boundary; no secrets; no commit-message text interpolated anywhere. The guard's added surface is two `git ls-tree` reads and a `grep -q`. `$PREV_TAG` is still produced by `git describe` and consumed as a single quoted argument, so a hostile tag name cannot break out. Blast radius is unchanged in kind and now spans one more tree: misfiled evidence under `qa_reports/` or `review_reports/`, via `mv -n`, to a fixed destination — non-destructive and reversible with `git mv`.

Worth recording as a *reduction*: the guard closes round 3's N4, which was the one genuine data-integrity hazard in the shipped v3 text (an empty baseline mass-sweeping every root file into one feature's dir). That is real and it is why F9 asks the guard to be narrowed rather than removed.

## Performance
No findings. Two additional `git ls-tree` calls in the guard and one additional `find` + `git ls-tree` in the derivation, all at release time, over two directories. `review_reports/` root currently holds 103 files — a single `find -maxdepth 1` over it is immaterial. No hot path, no complexity-class change.

## Verdict
**CHANGES_REQUESTED** — (c) and (d) are correct and independently validated (seven releases backtested, union adds zero codes on all of them, and the parallel-destination pin proved load-bearing against a real v3.96.0 basename collision), and the E49 predicate and E44's AC4 are both confirmed byte-untouched. Blocking on two defects introduced by this diff:

- **F8 (`:80`)** — `${CODES:-∅}` expands a variable the SOP never assigns; executed literally the log prints `{∅}` on every release including non-empty ones, inverting the exact ambiguity item (b) exists to remove.
- **F9 (`:56-63`)** — the guard's outcome is a global OR despite prose claiming per-tree independence; any workspace that has never produced a `review_reports/` tree is permanently STOPped at every release, and F10 shows that STOP has no reachable transition to land on.

**F10** (`release-engineer:Blocked` is not in `ALLOWED_TRANSITIONS`) is non-blocking — it is pre-existing across all four Blocked rows and its remedy is source, outside this content-only cut — but it must be filed, and F9's fix must not assume the `Blocked` write will be accepted.

Both blocking findings are one-clause changes inside the existing structure. Neither requires reopening the membership predicate, and the predicate must stay byte-identical through the fix.

Independently observed gates this round: `npm run build` → 0 errors (`check:version — dist/index.js parity OK (3.96.0)`, `check:version — OK (3.96.0)`); `npm test` → **1657 pass / 0 fail / 0 skipped** (1657 tests, 44.2s). sr-engineer's numbers confirmed exactly.

**Same-model bias:** none suspected. sr-engineer ran pinned to `fable`; this review ran on a different tier, and the backtest was reconstructed from git rather than from sr-engineer's script.

### Test-coverage note for T-E50-03 (qa-engineer, §2 test ownership — not authored here)

The suite is currently blind to this entire diff. `npm test` returns 1657/1657 on both the base and the change, because the step-7a assertions in `test/release-staging.test.mjs` are substring pins over the skill text plus a hardcoded local simulator (`deriveCodesFromWorkingTree`) with no coupling to file content. That is the same blindness round 1 documented for E44 and it would not have caught F8 or F9 either.

**Item 0 — flip the existing pin, do not add a competing one.** This is the most important instruction in this list. `test/release-staging.test.mjs:1087-1106` currently asserts the permissive empty-baseline pass-through as **specified** behavior:

```js
test("E49 step 7a (N4, non-blocking hazard — recorded per review round 3, NOT fixed in this ticket): an empty PREV_TAG baseline currently admits every root-level file", …
  const prevTagTree = [];
  assert.deepEqual(codes, ["E45", "OLD"],
    "current (unguarded) behavior: an empty baseline admits every root file …");
```

Round 3's item 5f offered two branches — *"if the guard clause is added, assert the STOP; if it is not, assert the current permissive behavior"* — and T-E44-02 correctly took the second. E50 takes the first, so that test is now **asserting the hazard the ticket was written to close**. It must be rewritten in place, not left standing beside a new guard test: two tests pinning opposite behaviors is a contradiction in the suite, and the stale one will read as sanction for the permissive path. Delete or invert `:1087-1106`, and carry its `["E45","OLD"]` fixture into the guard test as the set that must **not** be produced.

1. **`CODES` is bound (F8).** Assert the skill text contains an actual assignment to `CODES` (`/CODES=/`), and that the identifier the log line expands is the identifier the derivation writes. Then a behavioral fixture: given the v3.94.0 working-tree/baseline pair, the logged line must render `{E37 E38 }` and must **not** render `{∅}`. A pin on the literal string `${CODES:-∅}` alone would pass today's broken text — assert the binding, not the echo.
2. **Guard fires, and fires before anything moves.** Both N4 routes: `PREV_TAG` empty, and `PREV_TAG` set with an empty baseline listing. Assert `BASELINE_EMPTY` is set and that zero moves are produced. Add a step-order assertion that the guard's text precedes the `mkdir -p` and the move bullets in the file (same shape as the existing `:1108` step-order pin) — an ordering regression is the one way this guard becomes worthless.
3. **Per-tree outcome (F9) — pin whatever the fix ships.** Four combinations of (qa baseline empty × review baseline empty). At minimum: qa non-empty + review absent/empty must **not** block the qa half, and must not sweep the review half. Include the permanent-recurrence shape — the same workspace at two consecutive releases — so a fix that merely defers the STOP does not pass.
4. **Directory absence.** `review_reports/` not present on disk at all: assert no error and no sweep. `find review_reports -maxdepth 1` exits 1 with `No such file or directory`, so this is a real path a consumer workspace takes.
5. **Union adds no codes on the seven-release fixture set.** Port the table above into fixtures (working-tree listing + baseline listing per release) and assert the union equals the `qa_reports` column on all seven. v3.96.0 is the highest-value row — it is the only one where `review_reports/` contributes at all.
6. **Parallel destination, no cross-filing.** The v3.96.0 collision is the fixture: `review_T-E4X-03.md` present in both trees, assert the two destinations differ and that neither `mv -n` is skipped. A single-destination implementation must fail this.
7. **Code in one tree only.** `E44`/`E49` present in `qa_reports/` only → the `review_reports/` move is a no-op, no file cross-files, and `mv -n` retry is idempotent.
8. **`covers:` sweep stays in its own tree.** A `review_reports/*.md` whose `covers:` line names an id in `<CODES>` lands in `review_reports/archive/`, never `qa_reports/archive/`, and symmetrically.
9. **Non-retroactivity, carried from round 3 item 5c** — a baseline *containing* a root file excludes that id. Extend to `review_reports/`: the 103 legacy files at `review_reports/` root are all in every recent baseline and must never be swept. This is the highest-consequence regression pin in the list — a bug here mass-relocates the project's entire code-review history.
10. **E44/E49 non-regression.** Round 3's items 5, 5a-5e and 7 stand verbatim; re-run them unchanged. In particular the `git log --diff-filter=A` negative pin must still fail, and the `7a. **Archive shipped feature's qa_reports**` step-order pin must still locate the header.

### Process finding — non-qa `completed_tasks` prefill (E40, second dated instance)

Not a defect in the diff under review, and it did not influence the verdict. Recording it because backlog **E40** describes exactly this class and a second dated instance strengthens that ticket.

sr-engineer's handoff write carried `completed_tasks: ["T-E50-01"]` on an `sr-engineer:In_Progress` write (2026-08-11, feature `e50-release-sop-step7a-hardening`). Per Constitution §3, sr-engineer signals readiness via `pending_notes`; only qa-engineer flips completion, and `tw_complete_task` is qa-exclusive. Observed directly:

```
tw_get_state  → last_agent: "sr-engineer", status: "In_Progress",
                completed_tasks: ["T-E50-01"]
tw_detect_drift → driftDetected: true
                "Handoff says T-E50-01 completed, but task list shows it as incomplete."
                tasksCompleted: []   tasksIncomplete: [T-E50-01, T-E50-02, T-E50-03]
```

This is E40's mechanism verbatim: nothing gates a non-qa prefill on the way in, and `QA_COMPLETION_EVIDENCE_MISSING` evaluates only the set-*difference* between the incoming and on-disk `completed_tasks`. An id already on disk when qa's PASS lands contributes zero to that difference and therefore escapes the per-id evidence requirement entirely — the ledger records a completion no evidence check ever saw. The asymmetry is worth noting: the server *does* reject a `code-reviewer`-stamped write carrying non-empty `completed_tasks` (`REVIEWER_COMPLETED_TASKS_REJECTED`), so the guard exists for one role and not the writer role upstream of it. E40's fix should close the prefill at the write, not at the PASS.

---

## Round 2 — APPROVED — by code-reviewer

## Summary
- One file, 57 insertions / 11 deletions. Boundary re-verified independently: `git diff --stat HEAD` over `test/ tools/ gates/ prompts/ schema/ guards/ lib/ transport/ bin/ scripts/ templates/ specs/ index.ts` reports **nothing**. `content/skill-release-engineer.md` plus state bookkeeping only. `tools/transitions.ts` untouched as claimed.
- **F8 and F9 are both CLOSED**, verified by execution rather than by reading. I extracted the two shipped fences verbatim out of the SOP with `awk` and ran *those bytes* — not a transcription — in seven detached worktrees and five scratch repos, so the harness cannot have drifted from the text under review.
- **My seven-release table is unchanged from Round 1, column for column.** The new `CODES=` binding reproduces every set exactly, including `RELSOP` on v3.91.0 and `E4X` on v3.96.0.
- The new code-extraction chain — genuinely new surface this round — is correct on every real filename shape I could construct, including the `expected-red_*` case round-3 N2 established. No shape produces a *wrong* code.
- **F10 honored properly.** The Escalation Routes row is gone (`grep -c` → 0), replaced by inline halt-and-surface prose plus a pointer at `:159` explaining why. This is the right resolution and better than what I asked for.
- Four new non-blocking findings, none affecting behavior. **N14 is the one that matters** and it belongs to qa: the `:983-997` fence pin now guards the *non-executable* fence.
- Verdict: **APPROVED**.

## Correctness

### F8 — CLOSED. `CODES` is bound, and the log tells the truth

`:99` now binds the variable the log line expands. Verified against the exact bytes in the file:

```
$ awk '/^     CODES=\$\( \{/,/^     ```$/' content/skill-release-engineer.md | … > /tmp/e50r2_codes.sh
$ bash -n /tmp/e50r2_codes.sh   →  codes OK
```

Running that extracted block at the v3.94.0 step-7a point (Round 1's counter-example, real set `{E37,E38}`):
```
step 7a: <CODES> = {E37 E38 }
```
Round 1's defect printed `{∅}` here. It is fixed.

**Live-tree check, and it is better than sr-engineer's claim.** They reported `{∅}` against clean `HEAD` in a detached worktree. The live tree now derives:
```
PREV_TAG=v3.96.0  EXCL=.. STOP=..
step 7a: <CODES> = {E50 }
```
Both are correct — their worktree predated this round's evidence file. The live result is the stronger demonstration: `review_reports/review_T-E50-02.md` (Round 1's own report, untracked at root, new since v3.96.0) is picked up, which is precisely the evidence the pre-E50 rule would have orphaned. Item (c) is working end-to-end on the release in flight, not just in backtest.

**Shell-precedence check on the new guards.** `[ -z "$EXCLUDE_QA" ] && find … | sort | grep -vxFf <(…)` parses as `test && (pipeline)` — pipelines bind tighter than `&&` in the shell grammar — so an excluded tree short-circuits the *whole* pipeline, not just the `find`. Confirmed empirically rather than by grammar argument: in the shape-(i) scratch repo (`review_reports/` absent), the block produced `CODES={NEW }` with **0 bytes on stderr**. `find` never ran against the missing directory. This is what `:93`'s claim requires and it holds.

### Attack 1 — the new extraction chain, exercised on real and adversarial filename shapes

`sed -E 's#.*/##' | grep -oE '^[a-z_]*T-[A-Za-z0-9]+-' | sed -E 's/^[a-z_]*T-//; s/-$//' | tr 'a-z' 'A-Z' | sort -u` is new surface — Round 1 approved the `find`/`grep -vxFf` pair, not this. Every case below was run through the shipped chain:

| filename | → | disposition |
|---|---|---|
| `review_T-RELSOP-01.md` | `{RELSOP}` | correct — v3.91.0 depends on it |
| `review_T-E4X-03.md` | `{E4X}` | correct — alphanumeric code preserved |
| `visual_T-E36-01.md` | `{E36}` | correct — `visual_` prefix handled |
| `review_T-E11E12-02.md` | `{E11E12}` | correct — matches the real task id |
| `review_T-C5C18-01.md` / `review_T-A12F-01.md` | `{C5C18}` / `{A12F}` | correct |
| `review_T-C7-CR.md` / `review_T-E3-CR.md` | `{C7}` / `{E3}` | correct |
| **`expected-red_e50-….txt`** | `{}` | **correct — dropped.** The `-` in `expected-red` is outside `[a-z_]`, so the anchored match fails. This is round-3 N2's case and the regex implements the stated rule faithfully |
| `expected-red_T-E51-01.txt` | `{}` | dropped for the same reason — even with a code in the name, `expected-red_*` stays out of `<CODES>`, as its own bullet requires |
| `review_C1-02.md`, `review_b8.md`, `review_a11-….md` | `{}` | correct — legacy pre-convention names carry no `T-<CODE>-` |
| `README.md`, `.DS_Store` | `{}` | correct |
| `T-E51-01.md` (no prefix) | `{E51}` | correct — `[a-z_]*` matches empty |
| `REVIEW_T-E51-01.md`, `review_t-e51-01.md` | `{}` | dropped; the move bullets are lowercase-`review_`/uppercase-`T-` too, so derivation and moves agree |

**No shape produced a wrong code.** The two over-accepts I found (`notes_about_T-E99-01_backup.md` → `{E99}`, `archive_T-E51-01.md` → `{E51}`) are N15 below — an over-wide prefix class, not a mis-derivation. F8's defect class has not returned in a new place.

### F9 — CLOSED. Per-tree outcome, and the permanent wedge is gone

`:57-81` replaces the single `BASELINE_EMPTY` flag with `STOP_QA`/`STOP_RR` and `EXCLUDE_QA`/`EXCLUDE_RR`. I ran the verbatim-extracted guard in four scratch repos:

| shape | PREV_TAG | flags | outcome | `<CODES>` |
|---|---|---|---|---|
| **(i)** `review_reports/` never exists — Round 1's wedge, release 2 | `v1.0.0` | `EXCLUDE_RR` | **proceed** | `{NEW}` |
| **(i)** same workspace, release 3 | `v1.1.0` | `EXCLUDE_RR` | **proceed** | `{NEXT}` |
| **(i)** same workspace, release 4 | `v1.2.0` | `EXCLUDE_RR` | **proceed** | `{FOUR}` |
| **(ii)** `review_reports/` exists with root files, baseline empty | `v1.0.0` | `STOP_RR` | **STOP** | not derived |
| **(iii)** no tags at all | *unset* | `STOP_QA`+`STOP_RR` | **STOP** | not derived |
| **(iv)** `review_reports/` exists but empty, baseline empty | `v1.0.0` | `EXCLUDE_RR` | **proceed** | `{NEW}` |

Row (i) is the finding. Round 1 reproduced a STOP that recurred at release 3 and never cleared; the same workspace now proceeds cleanly at releases 2, 3 **and** 4, deriving the correct set each time, with the qa half unaffected by the review half's absence. The wedge is gone and it does not merely defer.

Row (ii) confirms the guard did not become permissive in the process. That scratch repo held `review_T-UNRELATED-99.md` at root — exactly the file an unbounded `grep -vxFf` would have mass-swept — and the guard refuses to derive. N4's hazard is still closed.

**Is `EXCLUDE` the right disjunction?** Yes. "Tree absent, **or** baseline empty AND zero root files" is precisely "there is nothing this empty baseline could sweep." The hazard N4 named requires root files to sweep; with none, an empty baseline is a fact about an empty directory, not a danger. Row (iv) is the case that proves the disjunction is doing work rather than being decorative.

**Is `STOP` on unset `PREV_TAG` a global masquerading as per-tree?** No — it is genuinely global. An unset `PREV_TAG` means there is no baseline for *any* tree; that is a property of the repository, not of a tree, so setting both flags is the correct encoding rather than a regression to Round 1's shape. It does STOP a tree that has nothing to sweep (N18), which is a mild asymmetry against the else-branch's own logic — but it is exactly what Round 1's required change specified and what round 3's N4 endorsed for the no-tags route, and I am not moving that goalpost.

**TOCTOU, considered and dismissed as non-blocking.** The guard samples root-file presence, then the derivation re-runs `find`. A tree marked `EXCLUDE` that gained root files in between would be skipped, not swept — the safe direction. The unsafe direction (a tree marked *included* whose baseline is empty) is unreachable, since inclusion requires a non-empty baseline. The only writer of evidence is qa-engineer, who has already PASSed before step 7a runs. No action needed; recording that I checked.

### F10 — HONORED, and better than what Round 1 asked for

The Escalation Routes row is removed (`grep -c 'step 7a has no membership baseline.*| Blocked |'` → **0**). In its place:
- `:81` makes the STOP an in-SOP halt-and-surface with an explicit message, stating outright that it "does not depend on a `status=Blocked` write landing," and citing step 8's AC4 branches as the precedent this role already sets for a hard in-SOP STOP. That is the right pattern — AC4 does exactly this.
- `:159` adds a one-line pointer in the Escalation Routes section explaining *why* step 7a's hazard is deliberately not a row there.

`tools/transitions.ts` is untouched, confirmed by `git diff --stat`. Round 1 asked only that F9's fix not depend on the `Blocked` write; sr-engineer went further and documented the unreachable edge at both sites so the next reader does not re-add the row. The source ticket for the four missing `release-engineer:Blocked` edges still needs filing — the SOP now says so in two places, which is the right interim state for a content-only cut.

### Seven-release backtest — re-run, unchanged from Round 1

Same reconstruction method (restore every path the release commit added under either tree to its root basename; complete, not selective), now driving the **shipped** guard and `CODES` blocks extracted verbatim from the file:

| release | PREV_TAG | guard flags | shipped `<CODES>` | actually archived |
|---|---|---|---|---|
| v3.91.0 | v3.90.0 | none | `{E25 E27 E28 E29 E30 E32 E33 RELSOP}` | same 8 |
| v3.92.0 | v3.91.0 | none | `{E34}` | `{E34}` |
| v3.92.1 | v3.92.0 | none | `{E35}` | `{E35}` |
| v3.93.0 | v3.92.1 | none | `{E36}` | `{E36}` |
| v3.94.0 | v3.93.0 | none | `{E37 E38}` | `{E37 E38}` |
| v3.95.0 | v3.94.0 | none | `{E45 E46}` | `{E46}` |
| v3.96.0 | v3.95.0 | none | `{E44 E49 E4X}` | `{E44 E45 E49 E4X}` |

Every column identical to Round 1. No `STOP_*` or `EXCLUDE_*` fires on any of the seven, so the guard is inert on all real history — it adds no behavior to the path this repo actually takes.

Both apparent divergences are the known-correct ones and both are *confirmations*, not misses:
- **v3.95.0** — `{E45 E46}` vs `{E46}`: round 3 settled this. The rule is right and history is wrong; the orphaned `review_T-E45-01.md` is E49's motivating defect.
- **v3.96.0** — history archived `E45` because that release included the coordinator's manual `R100` rename cleaning up that orphan. The rule correctly does **not** re-derive `E45`, because it sits in v3.95.0's baseline. That is the non-retroactivity property (round 3 item 5c) demonstrated on real history rather than on a fixture.

### Predicate and AC4 integrity — re-confirmed for round 2
- **E49 membership predicate**: `diff` of `HEAD:57-58` against working-tree `:87-88` → **byte-identical**. Wrapped, never reshaped, for the second round running.
- **Step 8 / AC4 (E44)**: diffing every `AC4`-containing line between `HEAD` and the working tree yields `0a1,2` and `3a6` — **pure additions, zero modifications, zero deletions**. The three additions are the new guard bullet, the logging bullet, and the `:159` pointer, all of which *cite* AC4 as precedent. E44's text is untouched.
- **Both fences carry the identical predicate pair** — `diff` of the extracted `find`/`grep -vxFf` invocations from the illustrative fence and the `CODES=` fence: identical. They agree today (see N14 for the risk that they will not tomorrow).

### N14 — NEW, non-blocking, but a MANDATORY T-E50-03 item: the fence pin now guards the wrong block

Attack 2's duplication concern is real and has **already** produced its characteristic failure. `test/release-staging.test.mjs:983` locates the derivation with:
```js
const fenceMatch = SKILL.match(/```\n(\s*find qa_reports -maxdepth 1[\s\S]*?)```/);
```
That regex matches the *first* fence beginning `find qa_reports -maxdepth 1` — which, after this diff, is the illustrative block. Verified directly:
```
$ node -e '… const m = S.match(/```\n(\s*find qa_reports -maxdepth 1[\s\S]*?)```/); …'
contains CODES= ?  false
```
So the assertions at `:987-997` — including *"the EXECUTABLE derivation fence must not invoke `git log`"* and *"must not contain `--diff-filter=A`"*, which rounds 2 and 3 called the single most important guard in the suite — are now attached to a block the role does not execute. Reintroduce `git log` into the `CODES=` fence tomorrow and the suite stays green.

**Why this is not blocking, and not sr-engineer's to fix here.** The SOP's *behavior* is correct — both fences agree today, verified byte-for-byte above. The defect is in test coverage, and §2 assigns test ownership to qa-engineer; fixing it requires editing `test/release-staging.test.mjs`, which is outside this content-only cut. sr-engineer kept the illustrative fence precisely *because* the pin would otherwise fail — shaping the source to satisfy a stale test. That instinct is backwards and worth naming, but the in-cut alternative was to break a green pin they had no license to update.

**The resolution is sequenced, and both halves are required.** T-E50-03 repoints the pin at the `CODES=` fence (item 1 below). Then a follow-up collapses the two fences into one, since the duplication is the E39/E48/E51 "two copies, only one kept honest" shape and it should not survive as a permanent feature — every future edit to the membership predicate now has to be made twice, and only one copy is tested.

### N15 — NEW, non-blocking — `:99`: the `[a-z_]*` prefix class is wider than the prefixes that exist

Only `review_` and `visual_` occur in practice, but `[a-z_]*` accepts any lowercase/underscore run:
```
notes_about_T-E99-01_backup.md  -> {E99}
archive_T-E51-01.md             -> {E51}
```
A stray non-convention file at a tree's root that is new since `$PREV_TAG` injects a phantom code into `<CODES>`, which then drives the `covers:` sweep at `:117` — so a file that is never itself moved can still widen what gets moved. Requires a stray file at root, so exposure is small and no real shape hits it. Tightening the class to `^(review|visual)_` would close it exactly. Non-blocking; worth folding in if the file is touched again.

### N16 — NEW, non-blocking, pre-existing and internally consistent — task ids with no trailing segment are invisible end-to-end

`review_T-PGAT.md` → `{}`, because the regex requires the `-` after the code. That is faithful to the stated rule ("ignore any filename with no `T-<CODE>-` prefix"), and it is *consistent*: the move bullets at `:113-115` key on the same `^T-<CODE>-` shape, so such a file is neither derived nor moved. Derivation and moves agree, which is what matters — this is not a divergence. But the consequence is that an evidence file for a task id like `T-PGAT` would be orphaned at root forever, which is the class step 7a exists to kill. Pre-existing since E49 and not introduced here; recording it so it is pinned in the suite rather than rediscovered.

### N17 — NEW, cosmetic — `:117`: the `covers:` sweep is not `EXCLUDE_*`-conditioned

The derivation (`:93`) and the `mkdir` (`:112`) are both gated on `EXCLUDE_*`; the `covers:` sweep bullet is not, so it still nominally greps `review_reports/*.md` in a workspace where that tree is excluded. Harmless — `EXCLUDE` implies zero root files, so no move can result — but an absent directory makes the glob emit stderr noise. One clause for symmetry with its two sibling bullets.

### N18 — recorded, not a finding — unset `PREV_TAG` STOPs both trees regardless of content
Noted under F9 above. Consistent with Round 1's required change and round 3's N4; recording only so a future reader does not read it as an oversight in the per-tree logic.

### N6 — carried, unchanged
The `<!-- origin -->` / `<!-- rationale -->` tags still survive the `tw_switch_role` render path, and this round moves *more* prose into `<!-- rationale -->` at `:111` (correctly — that was N13). Net effect on the `switchRole` path is unchanged; the asymmetry remains pre-existing and repo-wide.

## Quality
- N13 is properly resolved: the dated "at the time of writing derives `∅`" claim is gone, replaced by the timeless "e.g. a purely docs-only release", and the surrounding justification is wrapped in `<!-- rationale:start/end -->` per the repo's convention. Correct handling.
- N11 is resolved as asked, with the residual **disclosed in the text itself** at `:112` ("a participating tree that happens to match zero codes this release can still leave an empty dir behind; harmless and git-invisible") rather than silently left. That is the right way to close a partial fix.
- N12 is resolved at `:110`, and more thoroughly than Round 1 asked: it now spells out that a ticket can enter `<CODES>` from `review_reports/` alone, that this is "exactly the deferred/FAILed-out shape", and that it "then also drives the `qa_reports/` `covers:` sweep below, pulling a QA-side evidence file into a shipping feature's archive dir for a ticket that never shipped as QA-PASSed." The residual is now stated at full strength.
- The step-7a bullet list is long — the guard fence alone is 24 lines — but the structure is right: fence, then a two-bullet legend for the four flags, then the derivation. Each block is independently copy-pasteable and both syntax-check clean (`bash -n`).
- The duplicated fence (N14) is the one quality regression this round, and it is test-driven rather than authorial.

## Architecture
Unchanged and sound. Still SOP prose plus copy-pasteable shell; no source added; `parseCoversIds`/`buildCoverageIndex` retained at `:117` as the semantic reference rather than reimplemented. The per-tree flag model is the right decomposition: `<CODES>` stays a single shared set (so cross-tree `covers:` intersection keeps working) while participation, destination, and STOP are all resolved per tree.

The F10 resolution is the notable architectural improvement. Moving the STOP out of the Escalation Routes table and into inline halt-and-surface prose aligns step 7a with step 8's AC4 branches — the precedent this same role already sets — and removes the file's only instruction that pointed at a server-rejected write. The SOP now documents the unreachable edge instead of depending on it.

## Security
No findings, and the round-1 posture improves. The guard's added surface is `git ls-tree`, `grep -q`, `find`, and `[ -d ]` — all reads. `$PREV_TAG` is still `git describe` output consumed as a single quoted argument. The extraction chain is fixed patterns over path text with no interpolation, and `sed -E 's#.*/##'` reduces every candidate to a basename before any pattern touches it, so a hostile path component cannot reach the code regex. Blast radius unchanged: misfiled evidence via `mv -n` to a fixed destination, reversible with `git mv` — and now strictly smaller, since `EXCLUDE_*` removes absent trees from consideration entirely and `STOP_*` refuses the unbounded-sweep case outright.

## Performance
No findings. The guard adds up to two `git ls-tree` calls and two `find`s, short-circuited by `elif` so the `find` runs only when the baseline is empty. The derivation adds one `find` + one `git ls-tree` and a five-stage text pipeline over at most a few hundred path names. All at release time. No hot path.

## Verdict
**APPROVED** — F8 and F9 are closed against the ground truth that produced them, verified by extracting the shipped fences verbatim and executing *those bytes* in seven detached worktrees and five scratch repos. `CODES` is bound and the log line renders `{E37 E38 }` on the shape that printed `{∅}` in Round 1, and `{E50 }` on the live tree. The per-tree guard proceeds cleanly across three consecutive releases in the exact workspace shape that wedged permanently in Round 1, while still refusing the real N4 hazard. My seven-release table is unchanged column for column, `RELSOP` and `E4X` survive the new extraction chain, `expected-red_*` is correctly ignored, and no filename shape produces a wrong code. The E49 predicate is byte-identical for the second round running, AC4 is untouched, and F10 was resolved more thoroughly than asked — the Blocked row is gone and the unreachable edge is documented at both sites.

N14 (the `:983-997` fence pin now guards the non-executable fence) is the only finding with teeth, it is a test-coverage defect rather than a behavioral one, and §2 places it with qa-engineer — it is item 1 of the coverage note below and is mandatory. N15/N16/N17/N18 are cosmetic or pre-existing.

Independently observed gates this round: `npm run build` → 0 errors (`check:version — dist/index.js parity OK (3.96.0)`, `check:version — OK (3.96.0)`); `npm test` → **1657 pass / 0 fail / 0 skipped** (48.2s); `node --test test/release-staging.test.mjs` → **41/41**, file unmodified (`git diff --stat HEAD -- test/` empty). sr-engineer's numbers confirmed exactly, for the second round.

**Same-model bias:** none suspected. sr-engineer ran `fable`-pinned; this review ran a different tier. Noting for the record that the `CODES=` capture form resembles the direction sketched in Round 1's F8 — I therefore did not accept it on inspection, and instead ran the shipped bytes against all seven releases plus fourteen filename shapes, treating it as unreviewed surface.

### Test-coverage note for T-E50-03 — FINAL, supersedes Round 1

The derivation changed materially this round, so Round 1's list is restated with the shipped text pinned. Items are ordered by consequence.

**Item 0 — flip the stale permissive pin in place (unchanged from Round 1, still the critical item).** `test/release-staging.test.mjs:1087-1106` asserts `deriveCodesFromWorkingTree(workingTree, [])` → `["E45","OLD"]` and labels it *"current (unguarded) behavior … NOT this ticket's to fix."* E50 fixes it. That test now asserts the hazard this ticket closes. **Rewrite it in place** — do not add a guard test beside it. Two tests pinning opposite behaviors is a contradiction, and the stale one reads as sanction for the permissive path. Carry its `["E45","OLD"]` fixture over as the set that must **not** be produced when the baseline is empty *and* root files are present.

**Item 1 — repoint the fence pin at the executable block (N14).** `:983`'s `/```\n(\s*find qa_reports -maxdepth 1[\s\S]*?)```/` matches the illustrative fence; `CODES=` is absent from the match. Change the anchor to the `CODES=$( {` fence so the `git log` / `--diff-filter=A` negative assertions guard the block the role runs. Additionally assert the two fences carry an identical `find`/`grep -vxFf` pair, so the duplication cannot silently diverge before it is collapsed.

2. **`CODES` is bound, not free (F8).** Assert the skill text contains `CODES=$(` and that the logging bullet expands `${CODES:-∅}` *after* it. Behavioral fixture: the v3.94.0 working-tree/baseline pair must render `step 7a: <CODES> = {E37 E38 }` and must **not** render `{∅}`. A pin on the literal `${CODES:-∅}` alone would have passed Round 1's broken text — assert the binding.

3. **Filename-shape matrix for the extraction chain (attack 1) — new this round.** Table-drive it; every row below was verified by hand against the shipped chain and is a regression pin:
   - `review_T-RELSOP-01.md` → `RELSOP` (v3.91.0 depends on it), `review_T-E4X-03.md` → `E4X`, `visual_T-E36-01.md` → `E36`, `review_T-E11E12-02.md` → `E11E12`, `review_T-C7-CR.md` → `C7`.
   - `expected-red_<feature>.txt` **and** `expected-red_T-E51-01.txt` → **no code** (round-3 N2; the second is the adversarial form).
   - `review_C1-02.md`, `review_b8.md`, `README.md` → no code.
   - `T-E51-01.md` (no prefix) → `E51`; `REVIEW_T-E51-01.md` and `review_t-e51-01.md` → no code.
   - **N16**: `review_T-PGAT.md` → no code, *and* assert the move rule keys on the same `^T-<CODE>-` shape, so derivation and moves agree.
   - **N15**: `notes_about_T-E99-01_backup.md` → currently `E99`. Pin whichever behavior is intended — if the prefix class is tightened to `^(review|visual)_`, assert no code; if not, record the over-accept explicitly, the way item 0's test was *meant* to work.

4. **Per-tree guard outcomes (F9).** All four shapes, with the exact flags:
   - tree absent → `EXCLUDE_*`, proceed, other tree derives normally;
   - baseline empty + zero root files → `EXCLUDE_*`, proceed;
   - baseline empty + root files present → `STOP_*`, nothing derived, no moves;
   - `PREV_TAG` unset → both `STOP_*`.
   **Include the repeated-release shape**: the same workspace at three consecutive tags must proceed every time. A fix that merely defers the STOP must fail this — it is the assertion that encodes Round 1's finding.

5. **Guard ordering and no-writes.** Assert the guard text precedes the `mkdir -p` and move bullets in the file (same shape as the existing `:1108` step-order pin), and that the guard block contains no `mv`/`mkdir`/`git add`. A guard evaluated after a sweep is worthless.

6. **`EXCLUDE_*` short-circuits the whole pipeline, not just `find`.** Assert zero stderr when a tree is absent — this is the shell-precedence property, and it is the difference between a clean skip and a `No such file or directory` on every release.

7. **Union adds no codes across the seven-release fixture set.** Port the Round 2 table (working-tree listing + baseline listing per release). v3.96.0 is the highest-value row — the only one where `review_reports/` contributes.

8. **Parallel destination, no cross-filing.** Fixture: `review_T-E4X-03.md` present in both trees (the real v3.96.0 collision). Assert the two destinations differ and neither `mv -n` is skipped. A single-destination implementation must fail this.

9. **Non-retroactivity — highest-consequence regression pin.** A baseline *containing* a root file excludes that id. Extend to `review_reports/`: the 103 legacy files at that root are in every recent baseline and must never be swept. Use the real v3.96.0 shape, where `E45` is in v3.95.0's baseline and must **not** be re-derived even though history archived it via a manual rename.

10. **Code in one tree only.** `E44`/`E49` from `qa_reports/` alone → the `review_reports/` move no-ops, nothing cross-files, `mv -n` retry is idempotent.

11. **E44/E49 non-regression.** Round 3's items 5, 5a-5e and 7 stand verbatim; re-run unchanged. The `git log --diff-filter=A` negative pin must still fail (now against the *executable* fence, per item 1), and the `7a. **Archive shipped feature's qa_reports**` step-order pin must still locate the header.

### Process finding — carried from Round 1, unchanged
The `completed_tasks: ["T-E50-01"]` prefill on an `sr-engineer:In_Progress` write (E40, second dated instance, 2026-08-11) still stands on disk and still shows in `tw_detect_drift`. Recorded in Round 1; not re-litigated here and not a factor in this verdict.
