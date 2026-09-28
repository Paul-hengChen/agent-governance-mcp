# Review — T-E94-01

covers: T-E94-01, T-E97-01

## Round 1 — CHANGES_REQUESTED — by code-reviewer

## Summary
- Working-tree diff for `e94-e97-release-staging-and-terminal-marker`: 3 source files (`content/skill-release-engineer.md`, `gates/feature-lease.ts`, `tools/handoff-parse.ts`) + `tasks.md` + regenerated `dist/`. No test files touched (qa-owned, correct).
- **T-E97-01 is clean.** `isReleaseClosingWrite` extraction is byte-verbatim (mechanically diffed against `HEAD:gates/feature-lease.ts`), exported with exactly 2 call sites, and the `handoff-parse.ts` guard short-circuits before `Date.parse` exactly as the task row required.
- **T-E94-01 item (1) and (2) are clean.** Both staging lines gain `CONTRIBUTING.md` + `tasks.md`, are token- and order-identical to each other, and the E71a prose recount to `33 paths (19 directories + 14 metadata)` is arithmetically correct under the `FEATURE_DIRS` convention (`dist/` counted as metadata).
- **T-E94-01 item (3) is defective.** The new AC2 "Root-file completeness (E94)" check has zero discriminating power as written: `git status --short` after `git add` prints staged paths too, so the STOP condition fires identically on a correct release and on the v3.104.2 escape it exists to catch. Demonstrated empirically below.
- Expected-red manifest is complete and accurate: the suite is 1764/1765 and the single `not ok` is byte-identical to the manifest's one entry.
- Verdict: CHANGES_REQUESTED — one blocking finding (C1), two non-blocking quality nits.

## Correctness

### C1 (BLOCKING) — `content/skill-release-engineer.md:202`, AC2 "Root-file completeness (E94)": the check fires on every release, correct or not

The new sentence reads:

> after `git add`, run `git status --short` again and inspect it directly — `.current/` is the ONE legitimate exclusion […]. If any tracked modification remains outside `.current/`, STOP, surface the missing paths, and stage them before proceeding.

`git status --short` reports **both** index-vs-HEAD and worktree-vs-index state, one per column. After staging, every successfully staged path is still printed — as `M ` (staged, worktree clean) rather than ` M` (unstaged). Empirically, in a scratch repo mirroring the v3.104.2 shape:

```
--- git status --short AFTER git add, CONTRIBUTING.md deliberately unstaged (the ESCAPE) ---
 M .current/handoff.md
 M CONTRIBUTING.md
M  tools/a.ts
--- git status --short AFTER a fully-correct staging (the PASS case) ---
 M .current/handoff.md
M  CONTRIBUTING.md
M  tools/a.ts
```

Both cases leave "tracked modifications outside `.current/`" in the output. A literal executor — the reader this SOP is explicitly written for, per its own E71a/E71b prose — STOPs on every release and is then told to "stage them", i.e. re-stage already-staged paths. The check discriminates nothing; in practice it becomes noise that gets waved past, which is worse than the silent gap it replaces.

The only discriminating signal is the **second (worktree) column**, which the prose never mentions. Two ways to make it executable, either acceptable:

```
# (a) explicit-column form, keeps `git status` as the surface
bash -c '
  LEFT=$(git status --porcelain -- . ":!.current" | awk "substr(\$0,2,1) != \" \"")
  [ -n "$LEFT" ] && { printf "%s\n" "$LEFT"; exit 1; }
'

# (b) enumeration-free and column-free — the unstaged set IS the output
git diff --name-only -- . ':!.current'                       # tracked, modified, unstaged
git ls-files --others --exclude-standard -- . ':!.current'    # untracked, never staged
```

Note that form (b) also closes a second hole in the current wording: it says "any **tracked** modification". The historical v3.104.2 escape happened to be tracked (`CONTRIBUTING.md` entered the tree at `abf5baf`, was edited by T-E6X-01, and was absent from `de9326c`; `b55991a` backfilled it), so the wording covers that one incident — but a brand-new *untracked* root file is the strictly worse version of the same class and passes a "tracked modification" check unchallenged, while the sentence claims to be a general, "enumeration-free" close of the root-file gap. `??` lines are right there in the same `git status --short` output; the assertion should name them.

Everything else in the sentence checks out: both cited SHAs are real and are what they are claimed to be (`aac5a40` = post-v3.104.1 bookkeeping, `.current/` + `tasks.md`; `67c72e9` = post-v3.104.4 bookkeeping, `.current/` + `docs/backlog.md`), and the `.current/`-is-the-one-exclusion premise holds. Minor overreach worth a word while editing: `.current/.config.json` is itself in the step-8 stage list, so blanket-excluding `.current/` also excludes a path the check could legitimately cover — harmless today because the enumeration covers it, but the sentence asserts the exclusion is about step 12's closing write only.

### C2 (non-blocking, accepted consequence) — advisory suppression is a strict widening, matching the shared predicate by design

`tools/handoff-parse.ts:503` now suppresses the stale-dispatch advisory for any state matching `isReleaseClosingWrite`, which per E13 is a *strict superset* of the E1A exact triple: `last_agent === "release-engineer" && status === "In_Progress" && (next_role === "pm" || /^Released v/…)`. A release-engineer → pm write that is an escalation rather than a closing write (status `In_Progress`, `next_role: "pm"`, ordinary notes) therefore also stops producing a stale advisory, and stops producing the E22 watch-file emit with it.

Not a defect and not a reason to change the code: the feature-lease gate already releases the lease on exactly that state, and any narrower predicate here would recreate the two-owners divergence E97 exists to kill. Recording it so QA pins the intent rather than discovering it later. The complementary non-regression case — the release *opening* write (no `next_role`, "starting release…" notes) — still emits, because it matches neither disjunct; the task row already routes that pin to QA.

### Verified clean (no finding)

- **Extraction is verbatim.** Mechanically compared the extracted body against `git show HEAD:gates/feature-lease.ts` — the E1A comment block, both conjuncts, the E13 comment, and the disjunct are byte-identical. `isFeatureLeaseHeld`'s guard ordering (`!prevState` → same-feature → `PASS` → terminal marker → age) is unchanged, so the null-guard still precedes the now-non-nullable parameter.
- **Guard placement matches the task row.** `state.next_role && state.dispatched_at && !isReleaseClosingWrite(state)` short-circuits left-to-right, so `Date.parse` / `elapsedMin` are never evaluated in the suppressed case — "skipped entirely, not computed then discarded", as asked. `notifyStaleDispatch` sits inside the same block, so the push channel is suppressed with it.
- **Call sites: exactly 2** (`gates/feature-lease.ts:148`, `tools/handoff-parse.ts:503`), per acceptance. `dispatched_at` has no other consumer that computes staleness — `tools/stale-notify.ts` only receives the already-built advisory, so no second owner survives.
- **Path counts.** Parsed both edited lines: 33 tokens each, order-identical, split 19 `FEATURE_DIRS` + 14 metadata. Prose reads 33 / 19 / 14. Correct. (The naive "ends with `/` ⇒ directory" split gives 20/13 and is the wrong convention — `dist/` is metadata, matching `test/release-staging.test.mjs`'s `METADATA_PATHS`.)
- **Acceptance greps.** `grep -c CONTRIBUTING.md` = 3 (≥2 ✓), `grep -c tasks.md` = 5 (≥5 ✓). `package-lock.json` correctly not re-added — E60 already staged it.
- **Expected-red manifest (SOP 4a).** Manifest holds a single entry; sampled all 1. `test/release-staging.test.mjs:2151` contains the named test verbatim. Full-suite run: `# tests 1765 / # pass 1764 / # fail 1`, and the only `not ok 1223` is that exact string. Manifest is complete — no unlisted red — and its rationale (METADATA_PATHS fixture + hardcoded 31/12 pin predate the change) is accurate.
- **Build health.** `npx tsc --noEmit` exit 0; `npm run build` green; `agc check` → `OK (3.104.4) — all adapters current`; a fresh build produced no `dist/` churn beyond what is already in the working tree, so committed `dist/` is in parity with source.

## Quality

### Q1 (non-blocking) — `gates/feature-lease.ts:114-117`: the new block comment misdescribes the pre-state it is justifying

> "…each encoded their own idea of 'the release-engineer closing write' — the lease predicate carried E13's `pending_notes` disjunct, the advisory carried no predicate at all"

and, two lines up, "instead of two independently-maintained copies". There was one copy and one *absence*, not two copies, and an absent predicate is not "its own idea" of anything. The single-owner argument is correct and worth keeping; the framing of the prior state is not what the diff itself shows. Suggest: "…the lease predicate encoded the E1A/E13 terminal marker while the stale-dispatch advisory encoded nothing, and that asymmetry let a released feature's closing write still read as a stale in-flight dispatch. Re-stating the predicate in a second module would convert today's asymmetry into tomorrow's divergence (the A8 / C12 pattern); one owner with two consumers cannot."

This repo removed exactly this class of comment in v3.104.2 (`de9326c`, "prose/comment accuracy fixes across 10 files") — worth holding the new comment to the same bar. Same paragraph: "See the block comment above for the full E1A/E13 rationale" points *up*, but the E1A/E13 rationale lives inside the function body *below* the sentence. Re-point it.

### Q2 (non-blocking) — `gates/feature-lease.ts:119`: parameter name `prevState` no longer fits both consumers

Fine inside `isFeatureLeaseHeld` (incumbent's previous state); in `tools/handoff-parse.ts` the argument is the *current* persisted state. `state` would read correctly at both call sites. Cosmetic only — no behavior implication.

The `Pick<FeatureLeaseFields, …>` parameter type is a good call: it narrows the shared surface to the four fields the predicate actually reads and keeps `handoff-parse.ts` from depending on the lease-specific fields.

## Architecture

No architecture spec exists for this feature; the backlog rows in `tasks.md` are the contract, and both are followed except finding C1.

The new `tools/ → gates/` import direction is consistent with the existing codebase, not a new layering exception: `tools/drift.ts` imports `gates/stamp-provenance.js`, `tools/transitions.ts` and `tools/telemetry.ts` import `gates/registry.js`, and `tools/storage.ts` imports `gates/qa-review.js`. The task row's cycle claim also verifies — `gates/feature-lease.ts` has zero imports, so it stays a runtime leaf and the new edge closes no loop.

Single-owner-with-two-consumers is the right shape here, and it is the shape the row asked for. No objection.

## Security

No findings. No new input crosses a trust boundary — `isReleaseClosingWrite` reads four already-parsed fields of workspace-owned state and returns a boolean. The `/^Released v/` regex is unchanged, anchored, and backtrack-free (no ReDoS surface). No secrets, no new filesystem or network path, no change to what the advisory payload discloses. The `content/` edits add two repo-relative paths to a `git add` pathspec list; neither is user-controlled.

## Performance

No findings, and a marginal improvement. `isReleaseClosingWrite` is O(1) — three string comparisons and one anchored regex against a single array element — and its position as the third `&&` operand means the suppressed case now performs *less* work than base (`Date.parse` + arithmetic skipped) while the common case adds at most four comparisons per `readHandoffState`. `readHandoffState` is on the `tw_get_state` hot path; this is noise against the YAML parse that precedes it. No new allocation, no I/O, no loop, no cache.

## Verdict

CHANGES_REQUESTED — T-E97-01 is fully approvable and T-E94-01 items (1)/(2) are correct, but the AC2 root-file completeness check (item 3) is not enforceable as written: `git status --short` lists staged paths too, so the STOP condition fires identically on a correct release and on the escape it targets.

## Round 1 reply — by sr-engineer

Fixed C1 in `content/skill-release-engineer.md:202`. Note for the record: the defective wording was mine as coordinator/PM-hat, not the sr-engineer implementation — the row itself specified an unenforceable check, and it was implemented faithfully. Superseding the row's literal text per the routing instruction.

Picked **form (b)** (`git diff --name-only -- . ':!.current'` for tracked-unstaged, `git ls-files --others --exclude-standard -- . ':!.current'` for untracked-never-staged) over form (a)'s porcelain-column-parse, because:
- it needs no column-position parsing (no `awk substr($0,2,1)`, no porcelain-format coupling) — the two commands report exactly the leftover set with nothing already-staged mixed in, so "both empty" is the PASS signal directly, not an inference from a filtered column;
- it separates the two failure classes (tracked-left-unstaged vs. never-staged-at-all) into two named commands, so a future reader — or a STOP surfaced to a human — can tell which kind of gap fired without additional inspection;
- it closes the "tracked" vs "untracked" gap C1 also flagged in the same finding (a new untracked root file, the strictly worse variant of the v3.104.2 escape) as a natural consequence of the two-command split, rather than as a further patch on top.

Verified empirically in a scratch repo mirroring the C1 repro shape (tracked-file-left-unstaged + a new untracked root file):
- ESCAPE case (`CONTRIBUTING.md` unstaged, `NEWROOT.md` untracked, after `git add -- tools/ .current/`): `git diff --name-only` → `CONTRIBUTING.md`; `git ls-files --others --exclude-standard` → `NEWROOT.md`. Both non-empty → correctly STOPs.
- PASS case (same tree, then `git add -- CONTRIBUTING.md NEWROOT.md`): both commands produce empty output → correctly silent, unlike the old `git status --short`-based wording which still printed `M  CONTRIBUTING.md` / `A  NEWROOT.md` and would have fired identically to the escape case.

New sentence also states explicitly why `git status --short` is the wrong surface for this check (prints staged paths as `M `, not just unstaged as ` M`), so a future editor doesn't reintroduce the same non-discriminating form.

Q1 (comment misdescription) and Q2 (`prevState` param name) both fixed in `gates/feature-lease.ts`: the block comment above `isReleaseClosingWrite` now says what was actually true (one copy + one absence, not two copies) using close to your suggested wording, and its "see above" pointer now correctly points at the inline comments inside the function body (below), not above. The exported function's parameter is renamed `prevState` → `state`, matching both call sites (`isFeatureLeaseHeld`'s own `prevState` argument passed positionally, and `handoff-parse.ts`'s `state`); `isFeatureLeaseHeld`'s own parameter is untouched since "previous state of the incumbent" is the correct name there.

No QA-pin impact from any of these three fixes: none of them touch behavior QA needs to re-pin (C1 is prose-only against a check `test/release-staging.test.mjs` doesn't yet assert the wording of; Q1/Q2 are comment/param-name only, `isReleaseClosingWrite`'s I/O contract and both call sites are unchanged). C2 (advisory-widening) was already flagged non-blocking/accepted-consequence for QA to pin — no code change made for it, per the report's own recommendation.

Verification this round: `npx tsc --noEmit` clean; `npm run build` green (dist rebuilt, `isReleaseClosingWrite`'s `state` param and inline comment fixes present in `dist/gates/feature-lease.js`); full suite `node --test test/*.test.mjs` → 1765 tests, 1764 pass, 1 fail, and that sole fail is still byte-identical to the existing expected-red manifest entry (`test/release-staging.test.mjs | E71(a): the git-add line stages exactly 31 paths...`, unchanged by this round — no new reds introduced, manifest still accurate); `agc check` → `OK (3.104.4) — all adapters current`; acceptance greps re-confirmed unaffected by the C1 edit (`grep -c CONTRIBUTING.md` = 3, `grep -c tasks.md` = 5, both unchanged).

---

## Round 2 — APPROVED — by code-reviewer

## Summary
- Delta-scoped re-review of the three round-1 findings. Round-1 conclusions on the staging lines, the E71a prose count, and the guard placement were re-confirmed mechanically as collateral guards, not re-derived.
- **C1 is genuinely fixed.** The `git status --short` form is gone (0 occurrences of the old sentence), replaced by form (b). I re-tested it empirically across four workspace shapes, including two adopter-workspace cases: it now discriminates PASS from ESCAPE, which is precisely what the round-1 version could not do.
- **Q1 and Q2 both fixed**, and the `prevState` → `state` rename is provably rename-only: after normalizing the identifier, the predicate body is byte-identical to `HEAD:gates/feature-lease.ts` again, so round 1's verbatim-extraction finding still holds.
- Suite still 1764/1765 with the sole `not ok 1223` byte-identical to the manifest's single entry; `tsc --noEmit` 0; `agc check` OK (3.104.4); `dist/` parity holds after a fresh build (same 7 files, no new churn).
- Verdict: APPROVED. Three non-blocking notes carried to QA — C2 unchanged from round 1, plus two hardening nits on the new AC2 prose that do not warrant a round 3.

## Correctness

### C1 — RESOLVED, and it is correct for the adopter-workspace case

`content/skill-release-engineer.md:202` now prescribes, after `git add`:

```
git diff --name-only -- . ':!.current'                      # tracked, modified, left unstaged
git ls-files --others --exclude-standard -- . ':!.current'   # untracked, never staged at all
```

with an empty result from both as the PASS signal, and it explicitly documents the anti-pattern it replaces ("Do NOT use `git status --short` for this check: after `git add`, it still prints every successfully staged path (as `M ` rather than ` M`)"). Both parentheticals are accurate descriptions of what each command reports, and `--exclude-standard` is the right flag — without it every gitignored path (`node_modules/`) would be listed.

I re-ran the check across four shapes rather than trusting the prose:

| case | shape | `git diff` | `git ls-files --others` | outcome |
|---|---|---|---|---|
| A | adopter repo, **no `.current/` at all**, source in `src/` (outside the 19 FEATURE_DIRS), only `lib/` staged | `CONTRIBUTING.md`, `src/app.ts` | — | STOP, correct |
| B | same repo, everything correctly staged | empty | empty | PASS, correct |
| C | `.current/handoff.md` dirty + stray untracked root file | `.current/` correctly absent | `NOTES-local.txt` | STOP, correct |
| D | run from a subdirectory | scope silently narrows | — | see N2 |

Two things worth recording from that table:

- **Case A is the answer to "is this right for adopters".** The exclude pathspec `':!.current'` does **not** error when `.current/` is absent — exit 0, no `fatal: pathspec … did not match` (unlike `git add`, `git diff` and `git ls-files` never treat an unmatched pathspec as fatal). And the check surfaced `src/app.ts` — a source directory the 19-entry `FEATURE_DIRS` cross-reference above it structurally cannot see. So in an adopter workspace whose layout does not match this repo's enumeration, the new check converts a silent under-staged release into a loud STOP. That is a strict improvement over both the round-1 version and the pre-E94 baseline, and it is the "enumeration-free" property the task row claimed.
- **Case C confirms the `.current/` exclusion works on the directory's contents**, not just a literal path of that name — `.current/handoff.md` was dirty and correctly absent from the diff output, so the one intended exclusion behaves as documented.

### C2 — unchanged from round 1, still QA's to pin

No code change was made, per round 1's own recommendation. `isReleaseClosingWrite` remains a strict superset of the E1A exact triple, so a release-engineer → pm write that is an escalation rather than a closing write also stops producing the advisory and the E22 watch-file emit. Correct by design (the lease gate already releases on exactly that state, and narrowing here would recreate the two-owner divergence E97 exists to kill) — recorded so QA pins the intent.

### Verified clean (delta re-checks)

- **The extraction is still equivalent.** The `prevState` → `state` rename made the body no longer *raw* byte-identical to base, so I re-verified with the rename normalized away: identical, with no other edit smuggled in. All four references renamed consistently; `isFeatureLeaseHeld`'s own `prevState` parameter correctly left alone, since "previous state of the incumbent" is the right name at that layer.
- **`tools/handoff-parse.ts` is untouched this round** — the guard is still `state.next_role && state.dispatched_at && !isReleaseClosingWrite(state)`, short-circuiting before `Date.parse`.
- **No collateral damage to round-1-approved work**: both staging lines still 33 tokens, still order-identical to each other; prose still reads "33 paths" / "19 directories + 14 metadata paths"; acceptance greps still `CONTRIBUTING.md` = 3 and `tasks.md` = 5.
- **Manifest still accurate**: `# tests 1765 / # pass 1764 / # fail 1`, sole `not ok 1223` byte-identical to the manifest's one entry. No new red, none removed.

## Quality

### N1 (non-blocking) — the STOP remedy has no branch for a file that legitimately should not ship

Case C above is the scenario: an untracked, non-ignored stray file at root (a scratch note, a draft `.env.example`) makes `git ls-files --others` non-empty, and the prose's remedy is unconditional — "STOP, surface the missing paths, and stage them before proceeding". A literal executor stages a stray local file into a release commit. The halt itself is right; only the remedy is missing its second branch (stage it, gitignore it, or confirm it is deliberately excluded). Not raised as blocking because the pre-existing AC2 sentence directly above uses the identical "STOP, surface the missing paths, and stage them" phrasing — this matches house convention rather than diverging from it, and changing one without the other would be worse. Worth folding into whichever ticket next touches that bullet.

### N2 (non-blocking) — `.` scopes the check to the current directory

Case D: run from a subdirectory, both commands narrow to that subtree and report nothing — a silent PASS. The hazard is largely defused in practice because the `git add -- lib/ tools/ …` line three bullets earlier fails loudly from a subdirectory (`fatal: pathspec 'lib/' did not match any files`), so AC2 is unreachable from anywhere but the repo root. Cheap hardening if the bullet is edited again: `':/'` and `':!:/.current'` are root-anchored regardless of cwd, at no cost to readability.

### Q1, Q2 — RESOLVED

The block comment above `isReleaseClosingWrite` no longer claims "two independently-maintained copies"; it now states the actual asymmetry ("the lease predicate carried the full E1A/E13 terminal-marker logic, while the stale-dispatch advisory carried no predicate at all"), and the pointer correctly directs the reader to the inline comments *inside* the function. One residual strain — "encoded two different ideas" when one side encoded none — is immediately spelled out by the clause that follows it, so the paragraph is accurate as a whole. Not worth a round 3. The parameter rename reads correctly at both call sites, and the `Pick<FeatureLeaseFields, …>` narrowing is retained: still the right call, keeping `handoff-parse.ts` off the lease-specific fields.

## Architecture

Unchanged this round. The `tools/ → gates/` edge, the single-owner-with-two-consumers shape, and the zero-import leaf property of `gates/feature-lease.ts` all still hold. No objection.

## Security

No findings. This round changed one prose bullet, one comment block, and one parameter identifier. No trust boundary, input path, or disclosed payload moved. The two new commands in the SOP are read-only git queries over repo-relative pathspecs; neither takes operator-supplied input.

## Performance

No findings. The rename is identifier-only and compiles to the same `dist/` shape; `isReleaseClosingWrite` remains O(1) in the third `&&` position, so the suppressed path still performs strictly less work than base.

## Verdict

APPROVED — C1 is fixed with form (b) and verified correct across four workspace shapes including the adopter case with no `.current/` and source outside the enumeration; Q1/Q2 resolved; the extraction is still provably equivalent under the rename; suite, typecheck, `agc check`, and `dist/` parity all clean. N1/N2 are non-blocking prose hardening for a future touch of that bullet; C2 carries to QA to pin as intended behavior.
