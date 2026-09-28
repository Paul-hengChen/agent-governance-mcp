# Review — T-E111-01

## Round 1 — CHANGES_REQUESTED — by code-reviewer

## Summary

- Scope verified independently: exactly 3 source files (`bin/agc-init.mjs` +87, `content/coord-03-core-fallback.md` +2/-1, `docs/backlog.md` 1 line) plus governance bookkeeping. `test/` untouched — correct, it is qa-owned (§2) and is T-E111-02.
- **The check is NOT inert.** Built 13 fixtures and ran the real `bin/agc-init.mjs check` from each. It fires correctly on the central case (linked worktree + real untracked evidence dirs → 3 warnings, exit 0) and stays correctly silent on symlinked dirs, tracked dirs, and primary checkouts.
- **This repo's silence is for the right reason**, proven directly, not assumed: `.git` here IS a file (`statSync('.git').isFile() === true`), so `checkWorktreeEvidence` runs and reaches the per-directory loop; all three dirs are real dirs (479 / 125 / 143 tracked files) so `isTrackedDir` short-circuits at line 515. Detection is live; the tracked-ness gate is what silences it.
- **The rule text binds.** Verified by rendering: the obligation is present in the composed coordinator skill in all four host × fullDetail combinations, and survives both strip passes. It restates nothing — `grep -c worktree content/const-*.md` is 0, so there is no constitution rule being duplicated.
- Blocking findings are C1 (the untracked predicate has a `.gitkeep`-shaped hole that T-E111-02 would otherwise freeze as intended behavior) and Q1 (the one adopter-facing string cites a path adopters do not have). Q2/Q3 are the two corrections sr-engineer asked for, both resolved below with a definite answer.

## Correctness

Fixture matrix (all run against the real CLI, not a reimplementation). P1–P4 and P6 are the behaviours the ticket needs; the rest are the probes:

| # | fixture | result | correct? |
|---|---|---|---|
| P1 | linked worktree, real untracked dirs | 3 warnings, exit 0 | yes |
| P2 | linked worktree, symlinked dirs | silent | yes |
| P3 | linked worktree, tracked dirs | silent | yes |
| P4 | primary checkout, real untracked dirs | silent | yes |
| P5 | `.git` gitfile → nonexistent gitdir | silent | yes (fails closed) |
| P5b | `.git` is a junk file, no repo | silent | yes |
| P5c | junk `.git` file in a subdir of a real repo | silent | yes |
| P6 | zero-commit repo via gitfile | 3 warnings | yes |
| P7 | git absent from PATH | silent | yes (fails closed) |
| P8 | **git submodule** | 3 warnings | **no — false positive (C4)** |
| P9 | **gitignored dirs w/ force-added `.gitkeep`** | silent | **no — false negative (C1)** |
| P10 | **symlink pointing inside the lane itself** | silent | **no — false negative (C2)** |
| P11 | dangling symlink | silent | partial (C2/C3) |
| P12 | run from a subdir of a warning-eligible lane | silent | accepted limitation |
| P13 | **dir tracked as `Specs/`, case-insensitive fs** | 1 warning | **no — false positive (C5)** |

**C1 — BLOCKING. `git ls-files` non-empty is not equivalent to "this directory's evidence is safe".** `bin/agc-init.mjs:492` + `:515`. This is the direct answer to the question put to this review. Empty output *is* a sound proxy for untracked; the unsound half is the inverse. A single tracked file anywhere under the directory makes `isTrackedDir` return true and the check skips it — including the near-universal pattern of force-adding a placeholder to keep a gitignored directory present:

```
$ git add -f qa_reports/.gitkeep      # dir is in .gitignore
$ # lane worktree now has qa_reports/.gitkeep (tracked) + review_T1.md (untracked)
$ agc check
(silent)
```

Fixture P9 reproduces exactly this: `qa_reports/` contains `.gitkeep` and a real `review_T1.md`, the directory is a real untracked-evidence directory in a linked worktree, and the check says nothing. `.gitkeep` in a gitignored directory is precisely how adopter workspaces keep these trees present, so this is not an exotic state — it is a likely one in the target audience. Suggested predicate: instead of "does the index contain anything under `<dir>`", ask "does the working tree contain untracked-or-ignored content under `<dir>`" — e.g. `git ls-files -z --others --exclude-standard --ignored -- <dir>` non-empty, which is true in exactly the state the ticket is about and false once the directory is a symlink.

**C2 — BLOCKING (same fix site). The symlink gate tests the wrong property.** `bin/agc-init.mjs:514`. `!st.isDirectory()` accepts *any* non-directory as "already linked". Two states pass it while the evidence still dies with the worktree:

- P10: `qa_reports -> <lane>/local-eviddir` — a symlink that resolves inside the lane itself. `git worktree remove` deletes both the link and its target. Silent.
- P11: a dangling symlink. Silent, and see C3 for why this one is reachable by following the rule correctly.

The property the check needs is "is a symlink **whose target resolves outside this worktree**", not "is not a directory". `fs.realpathSync` on the link target, compared against `cwd` with a path-prefix test, distinguishes them.

**C3 — the rule text omits the precondition that makes the symlink work.** `content/coord-03-core-fallback.md:11` says "symlink back to primary each of `qa_reports/`, `review_reports/`, `specs/` that is untracked". In the ticket's own motivating case those directories are gitignored in the adopter's repo, so primary may not have them either. Following the instruction literally then produces a dangling link, which I confirmed is operationally fatal rather than merely untidy:

```
$ ln -s <primary>/qa_reports <lane>/qa_reports    # primary lacks the dir
$ echo evidence > <lane>/qa_reports/review_T1.md
no such file or directory: <lane>/qa_reports/review_T1.md
```

The lane's first evidence write fails, and per C2/P11 `agc check` does not warn. Add the precondition to the rule: create the directory in primary first (`mkdir -p` at primary) and only then link. One clause.

**C4 — submodule false positive.** `bin/agc-init.mjs:477`. `statSync('.git').isFile()` is git's linked-worktree signal, but it is *also* a submodule's signal — a submodule working tree has a `.git` gitfile (`gitdir: ../../.git/modules/...`). P8 confirms a submodule with untracked evidence dirs draws all three warnings, where the advice ("symlink it back to primary before build so it survives `git worktree remove`") is not merely noisy but meaningless. Non-blocking on its own (advisory, exit 0) but cheap to exclude: `git rev-parse --git-common-dir` inside a linked worktree resolves to the primary's `.git`, and the gitfile body distinguishes `worktrees/` from `modules/`.

**C5 — case-insensitive-filesystem false positive.** `bin/agc-init.mjs:492`, macOS/Windows only. P13: a repo tracking `Specs/` on a case-insensitive volume — `lstatSync('specs')` succeeds (fs is case-insensitive), `git ls-files -- specs` returns empty (git pathspec is case-sensitive), so the check warns about a directory that is fully tracked. Lowest severity of the five; noted for completeness and because T-E111-02 will run on this platform.

**Expected-red sampling (SOP 4a): not armed.** The diff touches no test file and the review context surfaces no intentionally-red tests attributable to this diff, so `qa_reports/expected-red_e111-lane-worktree-evidence.txt` is correctly absent and no finding is raised. The two failing tests are pre-existing cap/golden re-baselines in qa-owned files, not intentional reds authored by this diff.

## Quality

**Q1 — BLOCKING. The warning string cites a path that does not exist in an adopter workspace.** `bin/agc-init.mjs:518`:

> `... (see content/coord-03-core-fallback.md Feature-Scope Gate)`

`content/coord-03-core-fallback.md` is a file inside the agc *package*, not inside the workspace `agc check` is run in. The entire audience for this warning is adopter workspaces where the evidence dirs are gitignored — and in every one of them that path resolves to nothing. Note that `checkResearchBinaries`, the pattern this deliberately reuses, has no such reference in its message: it states the rule inline. Do the same here, or name a public-doc anchor that adopters can actually reach.

**Q2 — the `v3.108.0` origin tag. sr-engineer asked for a ruling; the ruling is: drop the version, use `(E111)`.** `content/coord-03-core-fallback.md:11`. Reasoning, in order:

1. The convention is "the version this text shipped in", not "the next minor". Verified by locating the commit that first introduced each recent origin version: `v3.103.0` → introduced in `b6b7d30` (release v3.103.0), `v3.104.0` → `69a858a` (v3.104.0), `v3.105.0` → `9cc85cb` (v3.105.0). The tag always equals the version of the release commit that carried it.
2. The next release is more likely `v3.107.1` than `v3.108.0`. `content/skill-release-engineer.md` hard rule: "Default proposal MUST be `patch` unless the qa_review summary or the user's request explicitly names `minor`/`major`." The release history bears this out — the last 20 releases include `v3.102.1`–`.5`, `v3.103.1`, `v3.104.1`–`.5`, `v3.105.1`–`.2`. Patch releases are the majority, and they *do* carry content changes (v3.104.2 touched 2 `content/` files, v3.104.4 and v3.104.5 one each).
3. Nothing reconciles the guess later. The release SOP has no step that rewrites origin stamps, and step-7d's stamp bump is scoped to the three `agc-version:` adapter lines. A wrong guess ships permanently.
4. A code-only tag is fully in-convention: 12 of the 87 origin tags in `content/*.md` carry no version at all (`(R10)`, `(E20)`, `(E21)`, `(amended E32)`, `A1`, …).

So `<!-- origin:start --> (E111)<!-- origin:end -->` is correct, carries the same provenance, and cannot be wrong. (Zero runtime impact either way — I confirmed the span is stripped from every delivered prompt; this is maintainer-facing record only.)

**Q3 — the E73 amendment leaves the count-drift trap open, by the row's own standard.** `docs/backlog.md:195`. The amendment's factual claim is **accurate** on the narrow reading, and I checked it rather than assuming: constraint (3)'s body at base `d505878` names only `docs/backlog.md`, `.current/.config.json` and `tasks.md`, so "three more … it never named" is true *of constraint (3)*. (The row as a whole does mention these dirs 4/3/5 times elsewhere, in constraints (4)–(7) — the wording survives only because "it" scopes to the constraint. Worth tightening to "this constraint never named".)

The problem is the heading. It still reads:

> **(3) three artifacts accumulate ACROSS features while the worktree is disposable PER feature, and each needs its own placement answer**

while the constraint now covers six. This row explicitly identifies that failure mode in its own text — "the first version of this row hardcoded 'three', then grew a fourth — the exact E70 count-drift class, caught in this row's own text" — and the row's own precedent is to *fix the numeral*: the 2026-08-17 `CORRECTED` note says the earlier version "omitted the third artifact entirely", and the heading was updated to "three" at that time. Appending a note while leaving a now-false count in the heading is the pattern the row warns against. Update the heading to "six artifacts", or de-numeralize it so it cannot drift again.

**Q4 — the amendment asserts these three had no placement answer; the row already gave them one.** The new text says that unlike (a)–(c), "their placement answer is already decided and shipped, not left open". But the pre-existing E73 text already dispositions two of them — "`qa_reports/` and `review_reports/` excluded, conditional on constraint (2)'s harvest moving their substance in" — i.e. harvest-then-exclude, per constraint (2). E111's symlink discipline and constraint (2)'s harvest are now two mechanisms for one problem, sitting in one row with nothing saying how they relate. The intent (symlink at bootstrap makes the PASS-time harvest automatic rather than a separate step) is coherent and is worth one clause stating it, otherwise the next reader of E73 has to guess which mechanism governs.

**Q5 — minor, non-blocking.**
- `isTrackedDir` (`:485`) returns `true` on *every* error path, so it means "tracked, or unevaluable". The comment explains the fail-closed intent, but the name asserts something the function does not return; `shouldSkipDir` or `isTrackedOrUnknown` would not need the comment.
- Three `git ls-files` spawns where one would do — `git ls-files -z -- qa_reports review_reports specs` answers all three. Negligible cost (see Performance), but it is a CLI on an adopter's critical path.
- `out.split("\0").some((line) => line.length > 0)` at `:499` is equivalent to `out.length > 0` here. The `-z` flag is load-bearing in `checkResearchBinaries` (it regex-matches filenames); in this function only emptiness is tested and the pathspecs are fixed ASCII literals, so the NUL-splitting is inherited ceremony rather than a safety property. Harmless — noting it only because the copied comment claims the same load-bearing rationale that does not apply here.

## Architecture

No architecture spec exists for this feature (no `specs/e111-lane-worktree-evidence-architecture.md`); the backlog E111 row is the contract, as the scope decision states.

The layering is right and is the main thing this diff gets correct. The enforcement mechanism is the coordinator rule; the CLI check is explicitly the backup detector, and the code says so at `bin/agc-init.mjs:468-473` including the instruction not to compensate for the missing test by making the check fail harder. That is the correct call and it was honoured — `test/` is genuinely untouched, so the §2 boundary holds and T-E111-02 remains QA's to write.

Placement mirrors `checkResearchBinaries` exactly (advisory, stderr, exit-code-neutral, wired adjacent in `runCheck` at `:526`), which is the right house pattern to have reused.

Two architectural notes, neither blocking:

- **Verified: the rule reaches the agent.** `composeSkill("skill-coordinator.md", …)` + `applyTextTransforms` renders the obligation in all four host × fullDetail combinations, with the origin span correctly stripped to `**Worktree bootstrap obligation**:`. The `coord-03` fragment is tagged `core`, so it is host-unconditional.
- **Absent from `skill-coordinator-lite.md` (0 occurrences).** I judge this correct, not a gap: lite is server-read-only with no chain, so it has no Feature-Scope Gate to hang the obligation off and produces no `review_reports/` or `qa_reports/` evidence to lose. Recording it so the omission is a decision on the record rather than an oversight.
- **Scope limitation, accepted:** `runCheck(process.cwd())` means the check only evaluates when run from the worktree root (P12: silent from a subdirectory). Identical to `checkResearchBinaries`' existing assumption, so this diff introduces no new inconsistency.

## Security

No findings.

- `execFileSync` with an argv array (`:492`), not `execSync` with a shell string — no shell, so no injection surface, and every argument is a module-level frozen literal (`WORKTREE_EVIDENCE_DIRS`, `:475`). The `--` separator is present, so even a hypothetical future entry could not be parsed as an option.
- No user input crosses any boundary: `rel` never derives from argv, env, or file content. `path.join(cwd, rel)` with fixed `rel` cannot traverse.
- No secrets introduced. The warning string emits only a fixed directory name, never a path, file content, or repo identity — correct for a CLI that runs in third-party workspaces.
- Failure modes are silent and exit-code-neutral by construction (`:526`), so a hostile or malformed repo cannot use this check to fail an adopter's release. Confirmed empirically by P5/P5b/P5c/P7.

## Performance

No findings. No regression versus base.

The check adds at most three `git ls-files` spawns, and only inside a linked worktree — `isLinkedWorktree` short-circuits at `:504` with a single `statSync` in the common case (primary checkout), which is the path essentially every `agc check` invocation takes. `checkResearchBinaries` already establishes one spawn as acceptable in this command. Bounded work: the loop is over a fixed 3-element constant, not over a directory scan, so there is no input-size dependence at all and no complexity class to regress. `git ls-files -- <dir>` is index-only (no tree walk, no object reads). The three spawns could be one (Q5) but the difference is unmeasurable against the process startup the CLI already pays.

## Verdict

**CHANGES_REQUESTED** — the central mechanism works and is verifiably not blind, but the untracked predicate has a reproducible `.gitkeep`-shaped hole (C1) plus a symlink-direction hole (C2) that T-E111-02 would otherwise freeze as intended behaviour, the sole adopter-facing string points at a file adopters do not have (Q1), and the two corrections sr-engineer asked for both resolve against the current text (Q2: use `(E111)`, not `v3.108.0`; Q3: the "three artifacts" heading is now false).

Required for round 2: **C1, C2, Q1, Q2, Q3.** Recommended: **C3, Q4.** Optional: **C4, C5, Q5.**

Same-model bias: none suspected — sr-engineer ran pinned to `fable`, this review ran on `opus`, and every claim above was re-derived from fixtures or from the repository rather than from the implementer's notes.

---

## Round 2 — CHANGES_REQUESTED — by code-reviewer

## Summary

- Round-2 diff re-verified independently against 14 freshly built fixtures and the **real** `bin/agc-init.mjs check` (never by reading the code). Scope still exactly 3 source files; `test/` still untouched.
- **All seven taken findings land correctly.** C1, C2, Q1, Q2, Q3, C3, Q4 — each re-measured below, none accepted on the implementer's word.
- **C1's departure from my literal round-1 suggestion is CORRECT, and my round-1 suggestion was WRONG.** Measured: the predicate I proposed (`--others --exclude-standard --ignored`) returns *empty* for a plain untracked, non-ignored evidence dir — i.e. it would have gone silent on fixture P1, the ticket's own central case. `--others` without `--exclude-standard` is the strictly-correct superset. Ruling: sr-engineer was right to depart.
- **C5 is no longer reproducible** — the C1 predicate change fixed the case-insensitive-fs false positive as a side effect (re-measured on this macOS box: now silent). **C4 still reproduces** (submodule warns); the decline is accepted on severity.
- **R1 and R2 both CONFIRMED, both blocking.** R2 in particular is not a judgement call: it directly violates an acceptance criterion already written into `tasks.md` T-E111-02 case (iii). Verdict: **CHANGES_REQUESTED**. The full required behaviour matrix is stated below in pin-it-in-a-test form so T-E111-02 is fully determined either way.

## Correctness

All rows run against the real CLI from the fixture root. Exit code was 0 in every warning case.

| # | fixture (inside a linked worktree unless stated) | measured | required | ok? |
|---|---|---|---|---|
| F1 | gitignored evidence dirs, real, with content | 3 warns | warn | yes |
| P9 | gitignored dir, force-added tracked `.gitkeep` + untracked `review_T1.md` | warns | warn | **yes — C1 closed** |
| PN | NOT ignored, real untracked dir with content, zero tracked | warns | warn | yes |
| S1 | symlink → primary (outside the worktree) | silent | silent | **yes — C2 closed** |
| S2 | symlink → a path inside the lane | warns | warn | **yes — C2 closed** |
| S3 | dangling symlink | warns | warn | **yes — C2 closed** |
| F6 | primary checkout, real untracked dirs | silent | silent | yes |
| X1 | tracked as `Specs/`, case-insensitive fs | silent | silent | **yes — C5 now moot** |
| C4 | git submodule, untracked evidence dirs | warns | silent | no — accepted, see below |
| **R1** | **lane, evidence dirs created EMPTY (`mkdir -p`, nothing in them)** | **silent** | **warn** | **NO — blocking** |
| **R2** | **lane, TRACKED dir + one untracked straggler** | **warns** | **silent** | **NO — blocking** |
| R2b | lane, tracked dir + one *modified* tracked file | silent | silent | yes |
| F4 | lane, fully tracked and clean | silent | silent | yes |
| — | this worktree, `node bin/agc-init.mjs check` | **warns on `review_reports/`** | silent | **NO — R2** |

**R1 — BLOCKING. A lane whose evidence dirs exist but are empty is completely silent.** `bin/agc-init.mjs` `hasUntrackedContent` / `checkWorktreeEvidence`. Confirmed exactly as measured by the coordinator: `git worktree add` a lane, `mkdir -p qa_reports review_reports specs`, nothing else → 0 warnings, because `git ls-files --others -- <dir>` returns nothing for an empty directory (measured directly: 0 lines). Round 1's predicate warned here.

Sizing it honestly, because the loss window is narrower than it first looks: a *truly* fresh lane has these directories **absent**, and `lstatSync` → `continue` made that silent in round 1 too, so neither round ever covered the absent case. The regression is only the mkdir'd-but-empty slice, and it is self-closing — the lane's first evidence write creates an untracked file and the check starts warning again, still well before teardown.

It is nonetheless blocking, for one reason that survives that discount: **the empty-directory moment is the only moment at which remediation is free.** `rmdir && ln -s` costs nothing and loses nothing. Once evidence exists, remediation is a *move*, a naive `ln -s` over a non-empty directory fails or nests, and an ignored warning now costs real files. E111's stated thesis is harvest at bootstrap rather than at teardown, and this check is currently dark at precisely the bootstrap instant it was cut to cover.

It is also the cheapest possible fix with **zero false-positive cost**: an empty real directory at one of these three paths inside a linked worktree is never a correct state. A correct bootstrap yields a symlink, and git cannot track an empty directory, so "tracked and empty" does not exist. There is no legitimate counter-example to weigh.

**R2 — BLOCKING, and decided by the written spec rather than by my judgement.** `bin/agc-init.mjs` `hasUntrackedContent`. Confirmed in this worktree:

```
$ node bin/agc-init.mjs check
agc check — warning: review_reports/ is a real, untracked directory ...
$ git ls-files -- review_reports | wc -l        # 125 tracked files
$ git ls-files --others -- review_reports       # review_reports/review_T-E111-01.md
```

A directory with 125 tracked files is reported as "a real, untracked directory" because one report is not yet committed. `tasks.md` T-E111-02 already fixes the required behaviour in advance:

> **(iii) dir is a real dir but TRACKED is silent — this repo's own shape, and a regression here would fire on every `agc check` we run**

The stated symptom is the observed symptom, verbatim. That settles it without needing the ergonomics argument — though the ergonomics argument runs the same way: this check has no teeth by design, so its entire value is that a human believes it, and a warning that fires on nearly every governance run in the repo that ships it is trained-away within a week.

The counter-reading is real and I am not dismissing it — that straggler genuinely would die under `git worktree remove --force`. But it is answered by *diagnosis*, not by this warning: the remedy for an uncommitted file in a tracked directory is "commit it", and the remedy this check prints ("symlink it back to a location outside this worktree") is actively wrong for that shape — applying it would stage 125 deletions. The check is asserting a directory-level property from file-level evidence that does not support it.

**The two requirements are in genuine tension, and the fix must not resolve it by reverting C1.** "Has any tracked content ⇒ silent" closes R2 and reopens the C1 `.gitkeep` hole (P9 has a tracked `.gitkeep`). A distinguisher that separates them cleanly was measured this round — ignore status:

```
p1lane (gitignored evidence dirs):        qa_reports/review_reports/specs → all IGNORED
p4lane + this worktree (tracked dirs):    qa_reports/review_reports/specs → all not-ignored
```

which makes one workable predicate: **warn iff real dir AND [ empty OR ( has untracked content AND ( `git check-ignore -q <dir>` OR has zero tracked content ) ) ]**. Verified by hand against every row of the matrix above, including P9 (ignored → warns, C1 stays closed), X1 (`Specs/` → stays silent, C5 stays moot) and a gitignored-but-fully-force-added directory (→ silent, correctly). This is offered as an existence proof that both constraints are satisfiable at once, **not** as a mandated implementation — any predicate that produces the matrix below is acceptable.

**C4 — decline ACCEPTED.** Re-measured: a submodule working tree with untracked evidence dirs still draws the warning. Advisory, exit-0, and the disambiguation cost (parsing `worktrees/` vs `modules/` out of the gitfile) is real. Deferring pending adopter noise is a defensible call on a harmless-when-wrong warning. One condition, non-blocking: see Q7 — it currently survives only in `pending_notes`, which is feature-scoped.

**C5 — decline ACCEPTED as moot.** Re-measured on this machine (case-insensitive volume, repo tracking `Specs/`): `git ls-files --others -- specs` is now empty, so the check is silent. The C1 predicate change fixed it incidentally. Pin it anyway (X1 below) so it cannot regress.

**C3 — TAKEN, correct.** `content/coord-03-core-fallback.md` now carries the `mkdir -p` precondition with the reason (dangling link → the lane's first evidence write fails outright). This is the exact operational failure I reproduced in round 1.

**Expected-red sampling (SOP 4a): still not armed.** The round-2 diff touches no test file. The two failing tests (`test/context-budget.test.mjs` AC8/AC-P2-7, `test/skill-manifest.test.mjs` `t-golden-byte-identity`) are cap/golden re-baselines in qa-owned files, not intentional reds authored by this diff, so `qa_reports/expected-red_e111-lane-worktree-evidence.txt` is correctly absent.

## Quality

**Q1 — FIXED, verified.** The warning string no longer cites `content/coord-03-core-fallback.md`. It states the rule inline and names no path an adopter cannot reach, matching `checkResearchBinaries`.

**Q2 — FIXED, verified by rendering, not by reading.** `stripOriginTags` on the new line yields exactly `**Worktree bootstrap obligation**: when the separate-worktree route is taken, …`; `stripRationale` correctly leaves it intact. The `(E111)` code-only tag composes and strips cleanly.

**Q3 — FIXED, and the chosen resolution is the better of the two I offered.** De-numeralising ("(3) artifacts") rather than bumping three→six removes the drift surface permanently, which is the right call in a row whose own text documents having drifted this exact count once already. The "it" → "this constraint" tightening also landed.

**Q4 — TAKEN, correct.** The amendment now states that the symlink makes constraint (2)'s harvest automatic rather than being a second mechanism, and that `specs/` is covered by the symlink alone. That was the missing clause; E73 no longer leaves the next reader to guess which mechanism governs.

**Q6 — NEW, non-blocking. One message serves two unrelated diagnoses.** The warning reads `"<dir>/ is a real, untracked directory (or a symlink that does not resolve outside this worktree)"` — a disjunction that makes the reader work out which branch fired, and which is *factually false* on whichever branch did not. Once R2 lands, the real-dir half becomes true again, but the two branches still want different sentences: the real-dir branch should say the directory is not linked back; the symlink branch should say the link does not resolve outside the worktree (and, for the dangling case, does not resolve at all). Two strings, same call site.

**Q7 — NEW, non-blocking. The C4 and C5 declines currently live only in `pending_notes`, which is feature-scoped** and drops on the next `active_feature` change. A declined-with-reason finding that evaporates at feature close is indistinguishable next year from one nobody ever looked at. One comment line in the `checkWorktreeEvidence` block — already the natural home, the block already documents its own advisory-by-design limits — or one backlog line makes it durable. Same file, zero new surface.

**Q5 (round 1) — partially overtaken.** The `isTrackedDir` naming complaint is moot (function gone). Still live and still non-blocking: three `git ls-files` spawns where one pathspec list would do; and `out.split("\0").some(l => l.length > 0)` remains equivalent to `out.length > 0` here, with the copied `-z` rationale not actually load-bearing in this function.

## Architecture

Unchanged from round 1 and still correct. Advisory, stderr, exit-code-neutral, wired next to `checkResearchBinaries` in `runCheck`; linked-worktree detection via the `.git` gitfile rather than a path-name heuristic; the enforcement mechanism remains the coordinator rule with the CLI as backup detector, and the comment block still instructs against compensating by making the check fail harder. `test/` untouched, so the §2 boundary holds and T-E111-02 remains QA's.

One architectural consequence of R1/R2 worth stating plainly, since it is the reason both are blocking rather than deferrable: **neither is fixable by qa-engineer.** Both live in `bin/agc-init.mjs`. Approving this round would hand qa a spec (T-E111-02 (iii)) that the implementation contradicts, forcing a qa FAIL back to sr-engineer — a strictly longer and more expensive loop than one more review round, and one that burns a qa round to relay a finding already in hand.

`content/coord-03-core-fallback.md` remains absent from `skill-coordinator-lite.md`, still judged correct (lite is server-read-only, no chain, no evidence to lose) and still recorded as a decision rather than an oversight.

## Security

No findings; no change in posture from round 1.

`execFileSync` with an argv array and a `--` separator, no shell. `rel` still comes only from the module-level `WORKTREE_EVIDENCE_DIRS` literal — never from argv, env, or file content — so there is no injection surface and `path.join(cwd, rel)` cannot traverse. The two new helpers do not widen this: `hasUntrackedContent` passes the same fixed literals, and `isSafelyLinkedOutside` only calls `fs.realpathSync` and compares strings.

One note on the new `isSafelyLinkedOutside`: the prefix test uses `realCwd + path.sep`, which correctly avoids the `/lane` vs `/lane-2` sibling-prefix bug. Both `realpathSync` calls fail closed to `false` (→ warn), which is the safe direction for a detector.

The warning string still emits only a fixed directory name — no path, no file content, no repo identity — which remains correct for a CLI that runs in third-party workspaces.

## Performance

No findings, no regression versus base or versus round 1.

Still bounded work over a fixed 3-element constant, still gated behind a single `statSync` that short-circuits in a primary checkout (the path essentially every `agc check` takes). `git ls-files` is index-only. `hasUntrackedContent` uses `--others`, which does walk the working tree under the pathspec rather than reading only the index — measurably irrelevant at evidence-directory sizes (this repo's `review_reports/`, 125 files, is instant) and it only runs inside a linked worktree. `isSafelyLinkedOutside` adds at most two `realpathSync` calls per symlinked directory. The suggested R2 predicate would add one `check-ignore` and one `ls-files` per directory — still bounded, still index-only, still under the process-startup cost the CLI already pays.

## Verdict

**CHANGES_REQUESTED** — every taken finding from round 1 is genuinely closed (C1 and C2 re-measured against fixtures, and C1's departure from my literal suggestion is the *correct* call since my suggested predicate demonstrably misses the ticket's central case), but two new regressions block: **R2** puts the shipped behaviour in direct conflict with an acceptance criterion already written into `tasks.md` T-E111-02 (iii), and it fires in this very repo on every governance run; **R1** leaves the check dark at the one moment — empty directories — where remediation is free, lossless and has no false-positive cost, which is the bootstrap instant E111 exists to cover.

**Required for round 3: R1, R2.** Recommended: Q6, Q7. Optional (declines accepted): C4, C5, Q5.

### Required behaviour matrix — pin these in T-E111-02

Stated as test cases so this ruling is executable rather than advisory, and so no row can be frozen into the spec by silence. All rows are inside a **linked** worktree unless stated. **Bold** rows are the two that currently fail.

| id | state of `qa_reports/` `review_reports/` `specs/` | required | why it is load-bearing |
|---|---|---|---|
| W1 | real dir, gitignored, holds untracked evidence | WARN | the central defect |
| W2 | real dir, not ignored, holds untracked files, **zero** tracked files | WARN | plain-untracked lane; the shape my own round-1 predicate would have missed |
| W3 | real dir, gitignored, force-added tracked `.gitkeep` + untracked evidence | WARN | C1. A fix for W5 that reopens this is not a fix |
| **W4** | **real dir, EMPTY** | **WARN** | **R1. Currently silent. The only moment remediation is free** |
| **W5** | **real dir, has tracked content, plus an untracked straggler** | **SILENT** | **R2. Currently warns. This repo's shape; T-E111-02 (iii) verbatim** |
| W6 | real dir, fully tracked and clean | SILENT | T-E111-02 (iii) |
| W7 | real dir, tracked content + a *modified* tracked file | SILENT | already correct; pins that "uncommitted" ≠ "untracked" |
| A1 | directory **absent** entirely | SILENT | recorded decision, not an oversight — see note below |
| S1 | symlink resolving **outside** the worktree | SILENT | the state the bootstrap rule produces; a false positive here trains readers to ignore the check (T-E111-02 (ii)) |
| S2 | symlink resolving **inside** the lane | WARN | C2 |
| S3 | dangling symlink | WARN | C2 |
| X1 | tracked as `Specs/` on a case-insensitive fs | SILENT | C5 is currently moot by side effect; unpinned, it can silently come back |
| P1 | **primary** checkout (`.git` is a directory), any dir state | SILENT | T-E111-02 (iv) |
| Z1 | submodule working tree, untracked evidence dirs | WARN (accepted false positive) | C4 declined — pin the *current* behaviour so the decline is a decision on the record, not a gap |
| E1 | any warning case | **exit 0** | advisory by design; the stale-adapter exit-1 path untouched |
| E2 | git absent from PATH / not a repo / zero-commit repo | silent, exit 0 | fails closed |

**On W4 vs A1** — they look contradictory and are not, so the distinction needs to be in the test's name or comment or a later reader will "fix" one of them: *absent* is the state of a worktree where nobody has decided anything yet (and a repo may legitimately never use `specs/`), whereas an *empty real directory* is affirmative evidence that someone created it locally instead of linking it — which, in a lane, is always wrong, because a correct bootstrap yields a symlink and git cannot track an empty directory.

**On Z1** — pinning an accepted false positive is deliberate. If C4 is later fixed, that row is the thing that has to be consciously changed, which is exactly the visibility a decline should buy.

Same-model bias: none suspected — sr-engineer ran pinned to `fable`, this review on `opus`. Every claim in this round was re-derived from fixtures run against the real CLI or from direct repository measurement; the coordinator's R1/R2 measurements were treated as reports to reproduce, and both reproduced.

---

## Round 3 — APPROVED — by code-reviewer

## Summary

- Round-3 diff (`bin/agc-init.mjs` only, +138 → +267) re-verified against **21 freshly built fixtures** and the real `bin/agc-init.mjs check`, never by reading the code. Scope still exactly 3 source files; `test/` still untouched.
- **R1 and R2 are both closed, measured.** W4 empty → WARN, W5 tracked+straggler → SILENT, and this worktree — which has an untracked `review_reports/review_T-E111-01.md` sitting in a 124-file tracked directory, the exact R2 shape — now runs `agc check` clean.
- **C1 is NOT reopened.** W3 (gitignored dir + force-added tracked `.gitkeep` + untracked evidence) still WARNs. This was the row at risk and it is the row I checked first.
- **sr-engineer's central claim is CORRECT and my round-2 predicate was WRONG.** Measured on the C1/W3 fixture at git 2.50.1: `git check-ignore -q -- review_reports` exits **1** (not ignored) while `git check-ignore -q -- review_reports/review_T1.md` exits **0** (ignored). My round-2 "existence proof" predicate would have gone SILENT on W3 — i.e. it would have reopened C1 while claiming to close R2. The substitution to a per-untracked-file ignore test is a **correction, not a deviation**, and I was wrong to state I had verified that predicate by hand against P9.
- Verdict: **APPROVED.** No blocking defect remains. Two spec corrections to my own round-2 text are recorded below, because the matrix is T-E111-02's contract and two of its rows were wrong.

## Correctness

### The R2 substitution — adjudicated by measurement

Built the C1/W3 shape from scratch (gitignored `review_reports/`, `git add -f review_reports/.gitkeep`, untracked `review_T1.md`) and measured all three candidate mechanisms on it:

```
git ls-files -- review_reports                 -> review_reports/.gitkeep      (tracked content present)
git ls-files --others -- review_reports        -> review_reports/review_T1.md  (untracked content present)
git check-ignore -q -- review_reports          -> exit 1   (NOT ignored)   <-- my round-2 predicate
git check-ignore -q -- review_reports/review_T1.md -> exit 0   (ignored)
git ls-files -z --others --ignored --exclude-standard -- review_reports
                                               -> review_reports/review_T1.md  <-- shipped predicate
```

Running my round-2 predicate — `warn iff real-dir AND [ empty OR ( untracked AND ( check-ignore(dir) OR zero-tracked ) ) ]` — over that row: real dir ✓, non-empty ✓, untracked ✓, `check-ignore(dir)` **false**, zero-tracked **false** (the `.gitkeep`) → **SILENT**. W3 requires WARN. My predicate reopens C1.

The shipped `hasIgnoredUntrackedContent` (`bin/agc-init.mjs:592`) asks the same question **per untracked file** rather than per directory and returns non-empty on the same row → WARN. The final shape is the one I specified; only the ignore test changed, and it changed because mine did not survive its own fixture. **Ruling: the departure is correct and required.**

**On the pattern, since this is the second consecutive round it has happened.** Round 2: my suggested `--others --exclude-standard --ignored` missed the plain-untracked case, and sr-engineer departed correctly. Round 3: my suggested directory-level `check-ignore` reopens C1, and sr-engineer departed correctly again. Both times I labelled the suggestion as verified ("verified by hand against every row of the matrix above, including P9") and both times it was not. The repeatable lesson is narrow and worth carrying: **a reviewer's proposed predicate is a hypothesis with a reviewer's authority attached to it, and that authority is the dangerous part** — an implementer under round-cap pressure has every incentive to type it in verbatim. The mitigation that actually worked here was structural, not attitudinal: I stated the predicate as "an existence proof, **not** as a mandated implementation — any predicate that produces the matrix below is acceptable," and the matrix was executable. That framing is what left room for measurement to overrule me twice. Where a review must suggest a mechanism, it should ship the matrix as the binding artefact and the mechanism as disposable.

### Full behaviour matrix — re-measured this round

All rows run against the real CLI from the fixture root, git 2.50.1, node v22.22.3. Inside a **linked** worktree unless stated. **Bold** = the rows round 2 blocked on.

| id | state of `qa_reports/` `review_reports/` `specs/` | measured | required | ok? |
|---|---|---|---|---|
| W1 | real dir, gitignored, untracked evidence | 3 warns | WARN | yes |
| W2 | real dir, not ignored, untracked files, zero tracked | 3 warns | WARN | yes |
| W3 | real dir, gitignored, force-added tracked `.gitkeep` + untracked evidence | 3 warns | WARN | **yes — C1 stays closed** |
| **W4** | **real dir, EMPTY** | **3 warns** | **WARN** | **yes — R1 FIXED** |
| **W5** | **real dir, tracked content + untracked straggler** | **silent** | **SILENT** | **yes — R2 FIXED** |
| W6 | real dir, fully tracked and clean | silent | SILENT | yes |
| W7 | real dir, tracked content + *modified* tracked file | silent | SILENT | yes |
| W8 | gitignored dir, fully force-added, zero untracked | silent | SILENT | yes |
| W9 | gitignored dir, tracked `.gitkeep` only, no evidence yet | silent | SILENT (accepted) | yes — see note |
| A1 | directory absent entirely | silent | SILENT | yes |
| S1 | symlink resolving outside the worktree | silent | SILENT | yes |
| S2 | symlink resolving inside the lane | 3 warns ("resolves INSIDE") | WARN | yes |
| S3 | dangling symlink | 3 warns ("dangling") | WARN | yes |
| S4 | symlink outside, target dir EMPTY | silent | SILENT | yes — R1 must not leak past the symlink branch |
| X1 | tracked as `Specs/`, case-insensitive fs | silent | SILENT | yes — C5 stays moot |
| P1 | primary checkout, real untracked dirs | silent | SILENT | yes |
| Z1 | submodule working tree, untracked evidence dirs | 3 warns | WARN (accepted FP) | yes — C4 decline unchanged |
| E1 | every warning row above | **exit 0** | exit 0 | yes |
| **G1** | **linked wt, NON-EMPTY untracked dirs, git absent from PATH** | **silent** | SILENT | yes — fails closed |
| **G2** | **linked wt, EMPTY dirs, git absent from PATH** | **3 warns** | **WARN** | **yes — see correction (b)** |
| **G3** | **junk `.git` file, no repo at all, dirs EMPTY** | **3 warns** | **WARN** | **yes — see correction (b)** |
| G4 | junk `.git` file, no repo, dirs NON-EMPTY | silent | SILENT | yes |
| G5 | zero-commit repo reached via gitfile, untracked dirs | 3 warns | **WARN** | yes — see correction (a) |
| E2a | not a git repo, no `.git` at all | silent | SILENT | yes |

Verified separately: this worktree, `node bin/agc-init.mjs check` → `agc check — OK (3.107.0) — all adapters current`, exit 0, with `review_reports/review_T-E111-01.md` untracked on disk. R2's real-world symptom is gone.

### Corrections to my Round-2 report — these bind T-E111-02, the round-2 text does not

The report is append-only, so round 2's text stands as written; **where it conflicts with the following, round 3 governs.**

**(a) Round-2 row E2 is factually wrong about zero-commit repos.** It reads "git absent from PATH / not a repo / zero-commit repo → silent, exit 0", lumping three unrelated states into one row. Measured (G5): a zero-commit repo reached via a gitfile with untracked evidence dirs **warns** — correctly, since that is W2's shape and `git ls-files --others` works fine without any commit. Round 1's P6 had this right ("3 warnings — yes"); round 2 regressed it. **Superseded by rows G1–G5 above.** A test written from the round-2 row would fail against correct behaviour.

**(b) The fail-closed-on-git-absence property is now partial, by design, and the matrix must say so.** `isEmptyDir` (`bin/agc-init.mjs:525`) is a plain `fs.readdirSync` with no git call — that is precisely what makes R1's fix possible, since git cannot see an empty directory. The consequence is that the empty branch warns whenever `.git` is a file, even when git is absent (G2) or the gitfile is junk (G3). I am **not** raising this as a defect: it is the direct, intended consequence of the fix I required, it is advisory and exit-0, and the diagnosis ("an empty evidence dir in a lane is never right") does not depend on git. But it is a spec fact, and a test asserting blanket silence under git-absence would fail. The accurate statement is: **git-dependent branches fail closed to silent (G1, G4); the git-independent empty branch does not (G2, G3).**

**(c) Round-2 prose names a command the code does not call.** The R2 section proposes `git check-ignore -q <dir>`; the shipped mechanism is `git ls-files -z --others --ignored --exclude-standard -- <rel>`. Per the adjudication above, the code is right and the prose is wrong. **T-E111-02 must assert on observable warn/silent behaviour per the matrix, never on which git plumbing command is invoked** — a test that greps for `check-ignore`, or for `ls-files --others --ignored`, freezes a mechanism this ticket has now changed twice under measurement. The matrix rows are the contract; the plumbing is not.

**On W9 — a narrow, self-closing gap, recorded as a decision rather than left to be found later.** A gitignored evidence dir holding only a tracked `.gitkeep` and no evidence yet is SILENT: `isEmptyDir` is false (the `.gitkeep` is an entry) and there is no untracked content. This is the `.gitkeep`-pattern equivalent of W4's bootstrap instant. I am not blocking on it, for two reasons that are specific rather than convenient: R1's blocking argument was "the empty moment is the only moment remediation is **free**", and with a committed `.gitkeep` remediation already costs a `git rm`, so that argument does not transfer; and the window self-closes the instant the first evidence file lands, at which point the row becomes W3 and warns — well before teardown. Pin it as SILENT so a later reader changes it consciously.

**Expected-red sampling (SOP 4a): still not armed.** The round-3 diff touches no test file. The two failures are cap/golden re-baselines in qa-owned files, not intentional reds authored by this diff, so `qa_reports/expected-red_e111-lane-worktree-evidence.txt` is correctly absent.

## Quality

**R1 — FIXED, verified.** `isEmptyDir` (`:525`) is a plain `fs.readdirSync`, no git call, consulted before `hasUntrackedContent` (`:684`). Fails closed to "not empty" on readdir error, which falls through to the git-backed checks rather than manufacturing a warning — the right direction.

**R2 — FIXED, verified.** The guard at `:690-691` reads `warn iff real-dir AND [ empty OR ( untracked AND ( ignored-untracked OR zero-tracked ) ) ]`, which is the shape I required with a working ignore test substituted. Fail-closed analysis holds: when git errors, `hasUntrackedContent` returns false and the other two helpers are never reached, so the three cannot disagree into a spurious warning.

**Q6 — TAKEN, verified on the branches that fire.** Three distinct strings, each measured on the fixture that triggers it: real-dir (W1–W4), `"resolves INSIDE this worktree instead of outside it"` (S2), `"does not resolve to anything (dangling)"` (S3). No disjunction, no half-false sentence.

**Q7 — TAKEN, with one factual slip in the permanent text.** The C4/C5 declines now live in the comment block above `WORKTREE_EVIDENCE_DIRS` (`:497-504`) rather than in feature-scoped `pending_notes` — correct, and the right home. But `:503` attributes C5's silence to "a side effect of the **R2** fix above". It is not: X1 is silent because `hasUntrackedContent` returns empty for a case-mismatched pathspec, which is the **C1/round-2** `--others` change; `hasIgnoredUntrackedContent` and `hasTrackedContent` are never reached on that row. Non-blocking — but the whole point of Q7 was durability, and a durable comment that misattributes its own cause misleads exactly the reader it was written for. One-word fix, safe to fold into any later touch of this file.

**Q5 (rounds 1–2) — still live, still non-blocking, now slightly larger.** Worst case is three `git ls-files` spawns **per directory** (9 total) where a single pathspec list would answer each question for all three at once. And `out.split("\0").some(l => l.length > 0)` is still equivalent to `out.length > 0` in all three helpers — the `-z` rationale copied from `checkResearchBinaries` is load-bearing there (it regex-matches filenames) and is inherited ceremony here. Harmless; noted only because the copied comments assert a rationale that does not apply.

**Housekeeping, outside the diff:** an untracked `E111-SESSION-HANDOFF.md` (12.7 KB, not gitignored) sits at the worktree root. It is not part of this diff and was not reviewed. Flagging it only because it is precisely the class of file this ticket exists to stop losing: it is untracked, in a lane, and would vanish with `git worktree remove`.

## Architecture

Unchanged from rounds 1–2 and still correct. Advisory, stderr-only, exit-code-neutral, wired beside `checkResearchBinaries` in `runCheck`; linked-worktree detection via git's own `.git`-gitfile signal rather than a path-name heuristic; the coordinator rule remains the enforcement mechanism and the CLI remains the backup detector. The comment block still instructs against compensating for the missing test by making the check fail harder, and that instruction was honoured — `test/` is untouched, so the §2 boundary holds and T-E111-02 remains QA's.

`content/coord-03-core-fallback.md` and the `docs/backlog.md` E73 amendment are unchanged from round 2 and were approved there. `skill-coordinator-lite.md` still correctly omits the obligation (lite is server-read-only, no chain, no evidence to lose) — a decision on the record, not an oversight.

The rule text describes the check as warning on "a real, untracked copy — or a symlink that does not resolve outside the worktree", which now also covers the empty case. Accurate enough as prose; no change required.

## Security

No findings; no change in posture from rounds 1–2.

The two new helpers do not widen the surface. `hasIgnoredUntrackedContent` (`:592`) and `hasTrackedContent` (`:614`) both use `execFileSync` with an argv array and a `--` separator — no shell, no injection vector — and both pass only `rel` values drawn from the module-level `WORKTREE_EVIDENCE_DIRS` literal (`:505`), never from argv, env, or file content. `isEmptyDir` (`:525`) calls `fs.readdirSync` on `path.join(cwd, rel)` with the same fixed `rel`, so it cannot traverse, and it returns only a length comparison — no directory contents reach stderr. The warning strings still emit a fixed directory name and nothing else: no path, no file content, no repo identity, which remains correct for a CLI that runs in third-party workspaces. Every failure path is silent and exit-code-neutral; confirmed empirically by G1–G5 and E2a.

## Performance

No findings, no regression versus base.

Still bounded work over a fixed 3-element constant, still gated behind a single `statSync` that short-circuits in a primary checkout — the path essentially every `agc check` invocation takes. The worst case grew from 1 to 3 `git ls-files` spawns per directory, reached only when a directory has untracked content; in this repo the real cost is 5 spawns total (`review_reports` takes all three, `qa_reports` and `specs` short-circuit after one). `isEmptyDir` adds one `readdirSync` per directory and, on the empty path, *removes* git work rather than adding it. `--others` walks the working tree under the pathspec rather than reading only the index, which is measurably irrelevant at evidence-directory sizes and only ever runs inside a linked worktree. All of it remains far under the process-startup cost the CLI already pays.

## Verdict

**APPROVED** — R1 and R2 are both closed, independently measured against fresh fixtures rather than accepted on the implementer's word; C1 is verifiably not reopened (W3 warns); the R2 mechanism substitution is a **correction of a broken reviewer suggestion**, proven by direct measurement of `git check-ignore` on this review's own C1 fixture; Q6 and Q7 both landed; and the full 23-row matrix now measures correct, including the three git-degraded rows that round 2 had specified wrongly.

Handed to qa-engineer with the matrix above as T-E111-02's spec, corrections (a)/(b)/(c) governing over round 2, and the two known-failing tests as qa's re-baseline scope.

Same-model bias: none suspected — sr-engineer ran pinned to `fable`, this review on `opus`. Every claim in this round was re-derived from fixtures run against the real CLI or from direct repository measurement; sr-engineer's own measurements were treated as reports to reproduce, and the one that mattered most — that my round-2 predicate was broken — reproduced against me.
