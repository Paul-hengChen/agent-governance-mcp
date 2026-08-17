# Review — T-E48-02 (reviewing the T-E48-01 diff)

covers: T-E48-01, T-E48-02

## Round 1 — CHANGES_REQUESTED — by code-reviewer

## Summary

- **Diff reviewed**: 12 staged deletions under `docs/skills/` (2810 lines), a 2-line comment reword at `scripts/check-transitions-sync.mjs:17-18`, plus one untracked artifact `qa_reports/expected-red_e48-docs-skills-delete.txt`. `content/` and `test/` are byte-identical to HEAD (verified by `git diff HEAD -- content/` and `-- test/`, both empty).
- **The deletion itself is correct and complete**: `git ls-tree -r HEAD -- docs/skills` = 12 files, staged deletions = 12, `git diff --cached --diff-filter=d` empty (nothing but deletions staged), directory absent from disk, `git ls-files docs/skills/` empty. No stray directory left to hold a test falsely green — the two E59 pins go red exactly as predicted.
- **One blocking finding (C1)**: the reworded comment traded a dangling path for an untrue claim. `content/skill-*.md` are the composition **sources** on the prompt path, not "prose expansions", and their de facto referents (`ALLOWED_TRANSITIONS`, `GATE_REGISTRY`) *are* structured — so no reading of the new sentence is fully true. That makes it a fresh instance of the defect class E48 exists to close. One-sentence fix.
- **One forward-routed finding (C2, not a T-E48-01 defect)**: item (f) re-derived from the tree. Narrowing E59's *tree sweep* to `content/` loses zero coverage — confirmed. But shrinking the *per-site enumeration* to the single `const-15-core-tail.md:11` bullet, as T-E48-03 is currently written, would leave **three live normative sites unpinned** (`content/skill-release-engineer.md:56,:57,:58`). The correct re-baseline is **9 → 4, not 9 → 1**. This changes T-E48-03's scope.
- **Expected-red set independently confirmed**: `npm test` = 1720 tests, 1718 pass, **exactly 2 fail**, both `test/release-staging.test.mjs`, both ENOENT crashes, both listed verbatim in the manifest. Nothing else regressed. `test/` untouched (§2 respected).
- Model-bias note: sr-engineer ran pinned `fable`, this review ran `opus` — different models, no same-model blind-spot concern.

## Correctness

### C1 (BLOCKING) — `scripts/check-transitions-sync.mjs:17-18`: the reword replaced a dangling path with an inaccurate claim

New text:

```
// structured data — a Map in compiled JS, a markdown table with a fixed
// three-column shape — so a set-equality check is genuinely mechanizable
// here, unlike content/skill-*.md (the role SOPs), which are hand-written
// prose expansions with no structured source to diff against.
```

The comment's argument has a specific rhetorical slot to fill: the contrast term must be a **mirror-drift candidate whose check is not mechanizable *because its source side is unstructured prose***. `docs/skills/*` filled that slot exactly — they were expansions *of* `content/`, the source existed, the source was prose, therefore no diff. That relation is the argument's engine.

`content/skill-*.md` cannot fill that slot, and the sentence breaks in both directions:

- **"expansions" is false as written.** "Expansion" is relational — X expands Y. `content/skill-*.md` are the upstream sources themselves: `prompts/build.ts` composes them (via `prompts/skill-manifest.ts` / `prompts/partials-manifest.ts`) into the delivered prompt, and `tools/role.ts` serves them to `tw_switch_role`. Nothing in the tree stands upstream of them. The deleted mirrors were expansions; their sources are not.
- **"no structured source to diff against" is then either vacuous or false.** Vacuous under the reading "they have no source at all" — in which case the clause explains nothing about mechanizability, since the reason you cannot diff them is that they are not mirrors, not that their source lacks structure. False under the reading that their de facto referent is the code they describe — `ALLOWED_TRANSITIONS` in `tools/transitions.ts`, `GATE_REGISTRY` in `gates/registry.ts` — because those referents are structured, which would make a transitions-style check *applicable* rather than inapplicable, i.e. the exact opposite of what the sentence is asserting.

The second reading is not academic in this repo, which is what makes this worth blocking on rather than waving through. The immediately preceding release (v3.102.0) shipped **T-E67-01**, six text-accuracy fixes in `content/skill-release-engineer.md` — including `:54` (a claim about `npx tsc` vs the `postbuild check:transitions-sync` hook, i.e. about *this very script*), `:129` (`agc check` expected output), and `:41` (the retired `content/constitution.md` path) — plus **T-E67-02**, a stale `GATE_REGISTRY` count in `CLAUDE.md:87` (32 vs 33). Every one of those is a role-SOP/doc prose claim that drifted from a structured source. A comment asserting the role SOPs have "no structured source to diff against" therefore asserts something last week's release actively disproved, and a future reader could reasonably cite this comment as grounds *not* to build a check that is in fact buildable.

Net: item (b)'s failure mode ("a reword that guts the reasoning to remove a dead path name is a regression") is met on both counts — the contrast no longer instantiates the phenomenon being contrasted, and a false assertion was introduced into a comment, inside the very ticket whose purpose is deleting prose that asserts untruths.

Secondary loss in the same two lines: the `(E48)` ticket citation was dropped, so nothing in the file now records *why* the counter-example vanished. T-E48-01's own text offered keeping it ("or by citing E48 as the ticket that removed the example").

**Fix (one sentence, no logic change).** Make the contrast generic and self-contained rather than pointing at a live file that does not fit it, e.g.:

```
// here, unlike a hand-written prose expansion of a prose source, which has
// no structured source to diff against — the docs/skills/* mirror tree was
// exactly that case, and E48 deleted it rather than trying to check it.
```

Any wording that (i) keeps "both sides here are structured data, therefore mechanizable", (ii) does not attribute "expansion" to a source file, and (iii) records E48 as the reason the old example is gone, resolves this.

### C2 (NOT a T-E48-01 defect — routes to T-E48-03) — item (f) re-derived: the correct re-baseline is 9 → 4 sites, not 9 → 1

Re-derived from the tree, not from the assertion, per the instruction. Method: read the enumeration at `test/release-staging.test.mjs:1301-1354` for the site set as pinned, then sweep `content/` with four independent patterns for the E59 disposition-channel text (`re-review trigger`, `dependency-advisories`, `HIGH/CRITICAL`, `NOT a waiver`) and cross-check the results against each other.

**The 9 pinned sites, and what each has left behind:**

| # | pinned site | live counterpart in `content/`? |
|---|---|---|
| 1 | `content/const-15-core-tail.md:11` (source bullet) | **survives** — untouched |
| 2 | `docs/skills/release-engineer.md:51` (step 4 verbatim mirror) | mirrored `content/skill-release-engineer.md:56` (step 6a) — **live, unpinned** |
| 3 | `docs/skills/release-engineer.md:92` (STOP-exit table row 5) | none — `content/skill-release-engineer.md` has no numbered STOP-exit table (`grep -n "^| [0-9]"` returns zero rows) |
| 4 | `docs/skills/release-engineer.md:121` (server-enforced-gates bullet) | none — no "server-enforced" bullet exists in the live SOP (grep: zero hits) |
| 5 | `docs/skills/release-engineer.md:165-167` (mermaid AUDITOK) | none — the only mermaid in `content/` is `skill-architect.md` |
| 6 | `docs/skills/sr-engineer.md:82` (Step 7 verbatim mirror) | `content/skill-sr-engineer.md:38` is bare `7. Confirm full project builds with ZERO errors.` — **carries no audit clause** |
| 7 | `docs/skills/sr-engineer.md:112` (Branch/STOP-exit row 9) | none |
| 8 | `docs/skills/sr-engineer.md:132` (server-enforced-gates bullet) | none |
| 9 | `docs/skills/sr-engineer.md:206-208` (mermaid AUDITOK) | none |

**Finding (i) — the PM/handoff premise is imprecise but harmless.** The 8 deleted sites were *not* all "verbatim mirrors of the single source bullet". Only #2 was a verbatim restatement. #3, #4, #5, #7, #8, #9 were structures the live SOPs **do not contain at all** (STOP-exit table rows, server-enforced-gates bullets, mermaid decision branches), and `content/skill-sr-engineer.md` carries **no §6 dependency-audit text whatsoever** — the rule reaches sr-engineer only through `const-15-core-tail.md:11`'s "every role that calls `npm run build` … MUST also run the language's audit command". So four of the eight pins were guarding text that no agent ever received: `docs/skills/*` was never on the prompt path (`prompts/build.ts` and `tools/role.ts` compose from `content/` only). Deleting it removes no normative reach, and this does not weaken the human's decision — if anything it strengthens it. But the sentence in `scope_decision_why` should not be re-quoted downstream as if measured.

**Finding (ii) — the tree sweep narrows cleanly. Confirmed, no coverage loss.** `grep -rniI '\bwaived\b'` across `content/ docs/ templates/ prompts/ tools/ gates/ bin/ scripts/ CLAUDE.md README.md AGENTS.md .antigravityrules` returns hits in **`docs/backlog.md` only** (lines 180, 182, 206, 207 — the E57/E59 ticket rows that *describe* the abolished escape; legitimate history, must not be touched). Zero hits in `content/`, and zero in any other live tree. `content/` is now the only tree the sweep needs to cover, so dropping `docs/skills` from the `trees` array at `:1284` loses nothing. Note the sweep never covered `templates/`, the adapter stubs, or `docs/` before either — unchanged before and after, so not a regression, but also not a claim to inflate.

**Finding (iii) — the enumeration must NOT shrink to 1 site.** `content/skill-release-engineer.md:56,:57,:58` are live normative §6 text and carry precisely the disposition-channel language E59 introduced:

- `:56` — `6a. **Dependency-audit disposition** (Constitution §6 build-gate rule, mechanism per E57): after npm test (step 6), run npm audit --audit-level=high … cross-check every flagged HIGH/CRITICAL package against docs/dependency-advisories.md`
- `:57` — `**Already recorded** with a decision and no re-review trigger fired → expected and non-blocking. Cite the record's row … instead of improvising a fresh rationale in the PR/commit description`
- `:58` — `**Not recorded, or recorded but its re-review trigger has since fired** → a genuine build failure. STOP: tw_update_state(agent_id="release-engineer", status="Blocked" …)`

All three were **never in E59's enumeration** — E59 counted `const-15` plus the 8 mirrors and stopped. So this is a pre-existing gap in the pin, not a regression T-E48-01 introduced, and it is not grounds to fail this diff. It *is* directly load-bearing for T-E48-03, whose AC (3) requires confirming that E59 still covers all live normative text before accepting the narrowing:

- Shrinking 9 → 1 satisfies the letter of "drop the deleted sites" but leaves the actual E57/E59 **mechanism** — the release-engineer SOP text that says *cite the advisory record's row rather than improvising a rationale*, the exact behaviour E57 was filed to stop — deletable with the suite staying green. The `const-15` bullet alone would be pinned.
- The honest re-baseline is **4 sites**: `content/const-15-core-tail.md:11` + `content/skill-release-engineer.md:56` + `:57` + `:58`, with the `assert.equal(sites.length, N)` counter-guard at `:1353` moved to 4 and its dated comment recording that E48 removed 8 mirror sites *and* that 3 previously-unpinned live sites were added, so the count change is legible as deliberate in both directions.
- Anchors for the three new sites are available and stable: the `6a. **Dependency-audit disposition**` heading, and the `- **Already recorded**` / `- **Not recorded, or recorded but its re-review trigger has since fired**` bullet leads. The existing per-site assertions (`/dependency-advisory record/ || /disposition/` present, `\bwaived\b` absent) hold on all three excerpts as written — `:57`'s `waiver` and `const-15`'s `NOT a waiver` use the noun form, which the sweep deliberately does not match.

This repo's count history (5 → 6 → 7 → 9) is precisely why this is stated as a re-derivation rather than a restatement: the pattern in every prior miss was a live site nobody enumerated, and 9 → 1 would repeat it in the opposite direction.

### C3 (advisory) — backlog row E68 is now moot, and no live path points at `docs/skills/` any more

Item (a), swept tree-wide (`grep -rn "docs/skills"`, excluding `.git`/`node_modules`). Every surviving hit classifies cleanly, and **zero** are live consumers:

- **Zero hits** in `content/`, `prompts/`, `tools/`, `gates/`, `guards/`, `schema/`, `lib/`, `transport/`, `bin/`, `templates/`, `scripts/`, `index.ts`, `package.json`, `README.md`, `docs/install.md`, `CONTRIBUTING.md`, `docs/architecture.md`, `CLAUDE.md`. The `scripts/check-transitions-sync.mjs:17` citation was the only live one and is gone — correctly, that was change (2).
- **`test/release-staging.test.mjs` (13 hits)** — the deliberately-red qa-owned pins. Correctly left alone.
- **History, correctly NOT rewritten** (E56 precedent): `CHANGELOG.md` (4), `specs/*` (11 across 5 files), `review_reports/*` (46), `qa_reports/*` (11). Verified untouched — the whole-diff `--stat` lists none of them.
- **`.current/feature-split.md` (7) and `.current/handoff.md` (5)** — the F1 parking record and live state. `feature-split.md`'s diff is the coordinator's dated 2026-08-13 correction (present in the working tree before this session began, per the session-start git status), not an sr-engineer edit.
- **`docs/backlog.md` (9)** — ticket rows: E48 itself (`:171`), plus E39/E46/E59/E66 cross-references and order rows 2/6/8c. All descriptive of the problem being solved; correctly outside T-E48-01's "exactly two changes".

Advisory for the coordinator/release bookkeeping, not for sr-engineer: **`docs/backlog.md:191` (E68)** is an *open* row whose entire subject is `docs/skills/release-engineer.md` — "now partially synced to the SOP it mirrors, which is worse than uniformly stale" — and order row `8c` records E68 as "blocked — needs E48's design decision first". That decision has now been made and executed, so E68 is resolved-by-deletion and should be closed with a pointer to E48 rather than left open against a nonexistent file. Out of scope for this diff (backlog bookkeeping is not sr-engineer's), flagged so it is not lost.

### C4 (no finding) — expected-red set is exactly the two E59 tests; `test/` untouched

Item (e), independently re-run rather than taken from `pending_notes`. `npm test`: `# tests 1720 / # pass 1718 / # fail 2`. Failure extraction:

- `not ok 1174 — E59: the abolished 'waived' dependency-audit escape does not reappear anywhere in content/ or docs/skills/ (structural, tree-wide sweep)` → `ENOENT: scandir '<root>/docs/skills'`
- `not ok 1175 — E59: all 9 live §6 dependency-audit normative sites carry the disposition-channel replacement text (structural, per-site enumeration per review_T-E59-01.md Round 2)` → `ENOENT: open '<root>/docs/skills/release-engineer.md'`

Nothing else red. Both are ENOENT crashes rather than assert failures, exactly as T-E48-01 predicted, and both are qa-owned re-baselines under §2. `git diff HEAD --stat -- test/` is empty, so §2 test ownership was respected. The suite also exercised `prebuild → build → postbuild check:transitions-sync`, which passed — independent confirmation the reworded comment did not break the script it lives in.

### C5 (no finding) — the unplanned third artifact belongs, and is in fact mandatory

`qa_reports/expected-red_e48-docs-skills-delete.txt` is **not** scope creep, and the premise that the manifest convention is bound to `dispatch_mode: "bugfix"` conflates two distinct SOP steps:

- **`skill-sr-engineer.md:39` step 7a** (v3.57.0, C15) is unconditional on dispatch mode: *"WHEN this handoff intentionally leaves ≥ 1 test red (e.g. a schema-bump re-baseline, a deliberately deferred implementation) → DO append each such test to `qa_reports/expected-red_<active_feature>.txt`"*, and explicitly *"A prose catalogue in `pending_notes` does NOT substitute"*. T-E48-01 plans two intentional reds, so 7a arms and the file is required. Emitting it in `pending_notes` prose only would have been the non-compliant path.
- **`skill-sr-engineer.md:29` step 3b** (v3.73.0, E2) is the bugfix-mode step: it reuses 7a's format and adds the server-side `REPRO_MANIFEST_MISSING` block on the fix-phase handoff. That gate is what binds to `dispatch_mode: "bugfix"`. Its absence here means the manifest is unenforced, not unwarranted.

Role boundary: no crossing. The `code-reviewer` SOP's clean-context rule carves this exact path out as *"sr-engineer-authored machine data (not QA commentary)"* and step 4a **requires** me to read and sample it. The convention is long-established and tracked — 17 live `qa_reports/expected-red_*.txt` plus 12 more archived, from `expected-red_c15-*` onward. Currently untracked in git, which is normal; staging is release-engineer's step-8 job.

**SOP 4a sampling performed** (2 entries, fewer than 3, so all of them), by grepping the named file for the exact named string:

- entry 1 → `test/release-staging.test.mjs:1283`, byte-identical
- entry 2 → `test/release-staging.test.mjs:1301`, byte-identical

Both real and locatable; the manifest's dated rationale block correctly names the ENOENT-vs-assert distinction and the T-E48-03 owner.

### C6 (no finding) — deletion completeness, and `content/` byte-identical

Items (c) and (d), verified by diff rather than by reading the task description:

- `git diff HEAD --stat -- content/` → empty. `content/` is byte-identical to HEAD.
- `git ls-tree -r --name-only HEAD -- docs/skills` → 12 files; `git diff --cached --name-only --diff-filter=D` → the same 12. Nothing partially removed.
- `git diff --cached --name-status --diff-filter=d` → empty: the staged set is deletions only, no accidental modification or addition rode along.
- `ls docs/skills` → `No such file or directory`; `git ls-files docs/skills/` → empty; `ls docs/` shows 13 remaining files and no `skills/` entry. No stray directory, which the ENOENT failures independently corroborate.
- Whole diff vs HEAD: 16 files, 52 insertions, 2810 deletions — the 12 deletions, the 2-line comment reword, the 3-line `tasks.md` task addition (coordinator-authored), and the two `.current/` state files. No unexplained file.

## Quality

- The two-line reword preserves the comment's line discipline and rewraps cleanly at the file's existing width; the surrounding argument structure and the 4-block comment layout are untouched. The problem is the claim's content (C1), not its form.
- The manifest follows the C15 format exactly — `<relative test file path> | <exact test name>`, `#`-prefixed rationale block above the entries — and matches the shape of the tracked precedents.
- No dead code, no duplication, no convention drift introduced. The diff is a pure deletion plus one comment edit.

## Architecture

- No architecture spec exists for this feature (mini-chain, PM/ARCH skipped by design; the backlog row plus the recorded human decision are the spec). No `specs/e48-*.md` present, as expected.
- Layering is unaffected and the deletion is provably inert on agent behaviour: `prompts/build.ts` composes from `content/` via `prompts/constitution-manifest.ts` / `skill-manifest.ts` / `partials-manifest.ts`, and `tools/role.ts` serves `content/skill-<role>.md`. Neither reads `docs/`. Zero hits for `docs/skills` across `prompts/`, `tools/`, `bin/`, `index.ts` confirms no prompt-path or build-path dependency was severed.
- The deletion respects the E56 history precedent: every `docs/skills` reference in `specs/`, `CHANGELOG.md`, `review_reports/`, `qa_reports/` and `tasks.md` is left verbatim.

## Security

- No findings. Pure deletion of documentation plus one comment edit; no code path, no input boundary, no trust boundary, no dependency change, no secret introduced or exposed. The deleted files contained prose only.
- `npm audit --audit-level=high` exit status is unaffected by this diff (no manifest or lockfile change: `package.json` / `package-lock.json` absent from the diff). The five standing moderate/low transitive advisories are pre-existing and outside §6's HIGH/CRITICAL threshold.

## Performance

- No findings. Zero runtime code changed. The removed files were never read at runtime, so no I/O is added or removed on any hot path.
- Test-suite direction of travel: the tree sweep at `:1283` now walks one tree instead of two, a marginal reduction once re-baselined. No complexity-class change anywhere.

## Verdict

**CHANGES_REQUESTED** — the deletion is complete, clean, correctly scoped and provably inert on agent behaviour, and the expected-red handling is exemplary; but the `scripts/check-transitions-sync.mjs:17-18` reword substitutes a contrast term that does not fit the argument's slot and asserts something untrue about `content/skill-*.md` (C1), which is a fresh instance of the very defect class E48 exists to close and is a one-sentence fix. Additionally, C2 must be carried into T-E48-03: the E59 enumeration re-baseline is **9 → 4 sites**, not 9 → 1, or the release-engineer SOP's §6 disposition mechanism at `content/skill-release-engineer.md:56-58` ships unpinned.

## Round 2 — APPROVED — by code-reviewer

## Summary

- **Round-2 diff surface is one hunk**: `scripts/check-transitions-sync.mjs:17-19` (3 insertions / 2 deletions vs HEAD, one line longer than round 1's version). Nothing else in the tree moved. The 12 staged deletions, `content/`, `test/`, and the expected-red manifest are all exactly as sampled in round 1.
- **C1 is resolved.** The new sentence is true as written, it still instantiates the contrast, and the past-tense `docs/skills/*` citation is a legitimate historical citation rather than a new dangling reference — it carries its own tombstone, and the argument is complete without it. The `(E48)` audit trail is restored in a strictly more usable form than the original bare parenthetical.
- **Red set independently re-verified as exactly two.** `npm test` = 1720 / 1718 pass / 2 fail, same ordinals (`not ok 1174`, `not ok 1175`), both `ENOENT` `testCodeFailure`, no third failure. `check:transitions-sync` fired inside this run and returned OK (21 keys, exact match) — the file whose comment was edited still parses and passes.
- **One new advisory (C7), not blocking**: the manifest's rationale block at `qa_reports/expected-red_e48-docs-skills-delete.txt` instructs the T-E48-03 owner to "shrink the 9-site enumeration to the 1 remaining live site" — the exact prescription C2 refutes. Round 1's C5 called that rationale block correct without reading the count claim in it; that was my miss, corrected here. Unchanged this round, so not an sr-engineer regression — handled by making the C2 brief explicitly supersede it in `pending_notes`.
- **C2 is not required of sr-engineer** and was correctly not attempted. Its required scope is restated verbatim in `pending_notes` for the qa brief (anchors, count, and the `:1353` counter-guard text).

## Correctness

### C1 (RESOLVED) — `scripts/check-transitions-sync.mjs:17-19`

Text on disk, verified byte-identical to round 1's suggested wording (`diff` against the suggestion: no differences):

```
// here, unlike a hand-written prose expansion of a prose source, which has
// no structured source to diff against — the docs/skills/* mirror tree was
// exactly that case, and E48 deleted it rather than trying to check it.
```

All three round-1 acceptance criteria hold:

- **(i) "both sides here are structured data, therefore mechanizable" intact.** Lines 14-17 (`Both sides are structured data — a Map in compiled JS, a markdown table with a fixed three-column shape — so a set-equality check is genuinely mechanizable here`) are byte-identical to HEAD; the diff touches only the contrast clause. The argument's load-bearing half was not disturbed.
- **(ii) "expansion" is no longer attributed to a source file.** The predicate now attaches to a generic class ("a hand-written prose expansion of a prose source") and to `docs/skills/*`, which genuinely was one. `content/skill-*.md` is not mentioned, so the false claim that the composition sources are expansions with no structured referent is gone, and with it the risk that a future reader cites this comment as grounds not to build a check that E67/E67b prove is buildable.
- **(iii) E48 recorded as the reason the example is gone.** "and E48 deleted it rather than trying to check it" is a better audit trail than the original `docs/skills/* (E48)`: it names the ticket, the action (deleted), *and* the disposition (deletion chosen over checking), which is precisely the decision the E48 row records. A reader who wants the reasoning has a ticket id to look up and a one-clause summary of the outcome. Restored in usable form — confirmed.

**Is the new sentence true as written?** Yes, clause by clause. "A hand-written prose expansion of a prose source has no structured source to diff against" is true by construction of the class — that is what makes the class the right contrast term rather than a specific file. "The `docs/skills/*` mirror tree was exactly that case" is true and is the same relation round 1 identified as the argument's engine: the tree consisted of expansions *of* `content/`, the source existed, the source was prose, therefore no mechanizable diff. "E48 deleted it rather than trying to check it" is true and matches the recorded decision, including that the two check-it options were falsified before deletion was chosen.

**Does the past-tense citation reintroduce a dangling reference in a different form?** No — and this is the round-2 question worth answering explicitly rather than assuming, since the fix trades a live-path pointer for a dead-path mention. Three properties separate the two:

- **Tense and explicit tombstone.** The old text was present-tense (`unlike docs/skills/*, which are hand-written prose expansions`) and asserted a currently-existing tree with current properties, so a reader had no way to know the path was dead and would go looking. The new text says the tree *was* that case and that E48 *deleted* it. A reader cannot be sent hunting for something the sentence itself declares removed.
- **Nothing needs resolving.** The relevant property is stated inline ("a hand-written prose expansion of a prose source, which has no structured source to diff against"). The `docs/skills/*` clause is an appositive example, not a pointer the reader must dereference to understand the claim. Delete the clause and the argument still stands — which is the operational test for "citation" versus "dangling reference".
- **The E56 precedent covers it.** E56 permits paths that no longer exist to remain in dated records (`CHANGELOG.md`, `specs/`, `review_reports/`, `qa_reports/`), and round 1 verified those references were correctly left verbatim in this very diff. The distinguishing feature of a legitimate historical citation is that it is self-dating and describes a past state. This sentence self-dates via the ticket id and describes a past state in the past tense, so it sits on the citation side of that line even though it lives in source rather than in a changelog. The defect class E48 exists to close is live prose asserting present-tense untruths; a historical note that says "this used to exist, ticket X removed it" is the opposite of that class, and is in fact the standard way source comments record removed context.

**One precision note, non-blocking.** "the `docs/skills/*` mirror tree was exactly that case" is a tree-level generalization, and one of the 12 files does not fit it cleanly: `docs/skills/coordinator.md` had no single `content/` source file (there is no `content/skill-coordinator.md` — the coordinator SOP lives in the seven `content/coord-0*.md` fragments), which is what killed the generate-from-source option at order 6. It was still a hand-written prose expansion of prose sources, just of a fragment set rather than of one file, so the sentence is true at the granularity it speaks at ("mirror tree", not "each file"). No change requested; recorded so the nuance is not lost if this comment is ever revised again.

### C7 (advisory, NOT blocking — routes with C2 into T-E48-03) — the expected-red manifest's rationale block carries the 9 → 1 prescription C2 refutes

`qa_reports/expected-red_e48-docs-skills-delete.txt`, unchanged this round (mtime `Aug 17 14:22:18`, predating both round 1's report at `14:31:35` and this round's script edit at `14:34:25`; SHA `04c15b09`), contains in its `#` rationale block:

```
# both: drop docs/skills from the :1284 trees array, and shrink the 9-site enumeration to
# the 1 remaining live site (content/const-15-core-tail.md:11).
```

That is the 9 → 1 re-baseline C2 shows to be wrong by three sites. Round 1's C5 verified the manifest's *entries* (the load-bearing part: both re-sampled again this round and still resolve — entry 1 → `test/release-staging.test.mjs:1283`, entry 2 → `:1301`, byte-identical) and characterised the rationale block as correct on the strength of its ENOENT-vs-assert note and its T-E48-03 owner attribution. It does carry both of those correctly, but it also carries a count prescription I did not check. My miss, stated plainly rather than quietly folded into C2.

Why this is advisory and not a second blocking finding:

- It is not a round-2 regression — the file is byte-unchanged, and round 1 approved it as-is, so sr-engineer had no signal to act on.
- C2 is explicitly qa-owned and scoped out of sr-engineer's work for this ticket; requiring a manifest edit here would smuggle C2's substance back into T-E48-01 through a side door.
- The gate-relevant and re-baseline-targeting content (the two `file | test name` pairs) is correct, so nothing downstream mis-fires mechanically. The risk is purely that a qa engineer reads the manifest comment and follows it.

That residual risk is real, though, because qa reads both the manifest and `pending_notes`, and they now disagree. Mitigation applied at the handoff rather than in the diff: the C2 brief in `pending_notes` states explicitly that the manifest's rationale line is superseded, and recommends qa correct that line as part of T-E48-03 (qa owns both the file's consumers and the re-baseline). If the line ships uncorrected it becomes a dated expected-red record containing a superseded plan — tolerable as history, but avoidable at zero cost by the owner who is already editing the pin.

### C8 (no finding) — nothing else moved

Verified by diff, not by report. All four scope claims hold:

- `git diff HEAD -- content/` → empty. `content/` byte-identical to HEAD.
- `git diff HEAD -- test/` → empty. `test/` untouched; §2 test ownership respected for the second round running.
- `qa_reports/expected-red_e48-docs-skills-delete.txt` → unchanged from the round-1 sample (SHA and mtime above; content matches what round 1 recorded, including the two entries and their line targets).
- Deletions still complete and still deletions-only: `git ls-tree -r --name-only HEAD -- docs/skills` = 12, `git diff --cached --name-only --diff-filter=D -- docs/skills` = 12, `git diff --cached --name-status --diff-filter=d` = empty.
- No stray `docs/skills` directory: `ls docs/skills` → no such file, `git ls-files docs/skills/` → empty, and a tree-wide `find . -name skills` (excluding `.git`/`node_modules`) returns nothing at all.
- Whole diff vs HEAD: 16 files, 59 insertions, 2811 deletions — the same 16-file set as round 1 (12 deletions, the script hunk, `tasks.md`'s coordinator-authored 3-line task addition, and the two `.current/` state files). The delta from round 1's 52/2810 is accounted for by the one extra comment line and `.current/` state churn. No unexplained file entered the diff.
- `git status --porcelain` shows exactly two untracked files: the expected-red manifest and this review report. Both expected; staging them is release-engineer's step-8 job.

### C9 (no finding) — the red set is still exactly two, verified independently

Re-ran rather than accepting the reported count. `npm test`: `# tests 1720 / # pass 1718 / # fail 2 / # cancelled 0 / # skipped 0 / # todo 0`.

- `not ok 1174 — E59: the abolished 'waived' dependency-audit escape does not reappear anywhere in content/ or docs/skills/ (structural, tree-wide sweep)` → `failureType: 'testCodeFailure'`, `ENOENT: scandir '<root>/docs/skills'`
- `not ok 1175 — E59: all 9 live §6 dependency-audit normative sites carry the disposition-channel replacement text (structural, per-site enumeration per review_T-E59-01.md Round 2)` → `failureType: 'testCodeFailure'`, `ENOENT: open '<root>/docs/skills/release-engineer.md'`

Nothing else red. Both are still crashes rather than assert failures, both are still the qa-owned pins, and the failure **ordinals are identical to round 1** (1174 / 1175 out of an unchanged 1720 total), which independently corroborates that no test was added, removed, or reordered between rounds. The run also exercised `pretest → build → postbuild`, and `check:transitions-sync` printed `OK (21 keys, exact match between dist/tools/transitions.js and specs/qa-flow-enforcement-architecture.md)` — direct evidence the edited file still loads and its check still passes.

### C2 (unchanged, carried forward) — the enumeration must re-baseline to 4 sites, not 1

Re-confirmed live this round, so the brief rests on current facts rather than round-1 memory:

- `content/skill-release-engineer.md:56` — `6a. **Dependency-audit disposition** (Constitution §6 build-gate rule, mechanism per E57)`, `:57` — `- **Already recorded** …`, `:58` — `- **Not recorded, or recorded but its re-review trigger has since fired** …`. All three present, all three live normative §6 text on the prompt path.
- `grep -rniIE '\bwaived\b' content/` → zero hits, so narrowing the `:1284` tree sweep to `content/` alone still loses no coverage.
- `:57`'s `waiver` is the noun form only (confirmed by extraction), which `/\bwaived\b/i` deliberately does not match — so adding these three sites to the enumeration cannot make the sweep false-positive.
- The counter-guard is `test/release-staging.test.mjs:1353`: `assert.equal(sites.length, 9, "this enumeration must itself stay at 9 sites (review_T-E59-01.md Round 2 count) — update it deliberately, not by accident, if the mirror set changes")`.

Not required of sr-engineer; restated in `pending_notes` for T-E48-03.

## Quality

- The three-line comment holds the file's wrapping discipline and leaves the four-block comment layout intact. The sentence now carries three dash-delimited clauses, which is at the edge of readable — but it is the wording round 1 proposed, so it is my construction and not a defect to charge to sr-engineer; it reads unambiguously and I am not re-opening it.
- No dead code, no duplication, no convention drift. Round 2 remains a pure comment edit on top of a pure deletion.
- Scope discipline was exact: sr-engineer changed the one file the finding named and left the flagged-but-out-of-scope items (C2, and the C3 backlog E68 advisory) alone rather than opportunistically fixing them. That is the correct response to a mixed-ownership review.

## Architecture

- Unchanged from round 1. No architecture spec exists (mini-chain by design); the E48 backlog row plus the recorded human decision are the spec. No layering effect: `prompts/build.ts` and `tools/role.ts` compose from `content/` only, and `content/` is byte-identical to HEAD, so the deletion remains provably inert on agent behaviour.
- The comment edit is inside a build-time script and touches no exported behaviour; `check:transitions-sync` passing in this run is the direct confirmation.

## Security

- No findings. A comment reword on top of a documentation deletion: no code path, no input boundary, no trust boundary, no dependency or lockfile change (`package.json` / `package-lock.json` absent from the diff), no secret introduced or exposed.
- `npm audit --audit-level=high` disposition is unaffected by this diff; the standing moderate/low transitive advisories are pre-existing and below §6's HIGH/CRITICAL threshold.

## Performance

- No findings. Zero runtime code changed in round 2. The comment is not evaluated; the script's work is unchanged.
- Test-suite direction of travel unchanged: once T-E48-03 re-baselines, the `:1284` sweep walks one tree instead of two. No complexity-class change anywhere.

## Verdict

**APPROVED** — C1 is fully resolved: the replacement sentence is true clause by clause, still instantiates the contrast through the generic class it now names, and its past-tense `docs/skills/*` mention is a self-tombstoning historical citation (E56-precedent shape) rather than a new dangling reference, with the `(E48)` audit trail restored in a more usable form than the original. Nothing else moved — `content/` and `test/` byte-identical, manifest unchanged, 12 deletions complete and deletions-only, no stray directory — and the red set is independently confirmed at exactly two identical ENOENT pins out of an unchanged 1720. C2 remains qa-owned and is carried into T-E48-03 verbatim via `pending_notes`, joined by advisory C7 (the manifest's rationale block repeats the refuted 9 → 1 prescription and should be corrected by its owner in the same ticket).
