# Review — T-E142-04

covers: T-E142-01, T-E142-02, T-E142-03

## Round 1 — CHANGES_REQUESTED — by code-reviewer

Base: uncommitted working-tree diff on `scripts/verify-release.mjs`,
`content/skill-release-engineer.md`, `content/coord-03-core-fallback.md`.
Contract: `specs/e142-release-tooling-wave25.md` AC1–AC11 + Decisions.
Every verdict below was re-derived from the files and from git ground truth;
the builder's `pending_notes` were not used as evidence.

## Summary

- Three files, +35/−15. Scope is clean: `git status --porcelain` shows only the
  three reviewed files plus chain bookkeeping (`.current/`, `tasks.md`) and the
  untracked spec. No `test/`, no `docs/backlog.md`, nothing under `schema/`,
  `tools/`, or `index.ts`. The riders (E143, E144, E149 N3) did not widen their
  hosts.
- AC1/AC2 (E147), AC3 (E142a), AC6 (E142c), AC8 (E144), AC9/AC10 (E149 N1/N2)
  and AC11 (E149 N3) all verify against the files and against independent
  re-derivation. AC7 (E143) verifies on all three of its required sites.
- **AC5 (E142b) does not hold.** The new MULTI-FEATURE branch was added, but the
  SKIP branch's guard was not disambiguated against it. The two branches
  overlap, the bullet's own claim "Exactly one of four branches applies" is
  false, and the overlap case is reachable via the exact shape of the most
  recent real wave — leaving open the SKIP-with-backlog-row-justification escape
  that AC5 names by name as the thing it exists to kill.
- A second defect in the same branch: MULTI-FEATURE routes spec-less named
  features to "that feature's own SKIP/UNCLASSIFIABLE judgment", but both of
  those branches are keyed on session-scoped fields about `active_feature`
  only — there is no per-feature judgment to make. On the only real wave on
  file, 2 of 3 features have no spec, so this is the common path, not the edge.
- Verdict: CHANGES_REQUESTED — two must-fix findings, both one-clause prose
  edits inside the AC4 bullet that is already open.

## Correctness

### F1 (must fix) — AC5: MULTI-FEATURE and SKIP branches overlap; the SKIP escape stays open

`content/skill-release-engineer.md:219` asserts "Exactly one of four branches
applies". Writing the four guards as predicates over
S = `specs/<active_feature>.md` exists, M = `pending_notes` records
`"Multi-feature release: ..."`, W = `scope_decision_why` records a
backlog-row-as-spec mini-chain:

| branch | line | guard |
|---|---|---|
| REQUIRE | :220 | `S ∧ ¬M` |
| MULTI-FEATURE | :221 | `M` |
| SKIP | :222 | `¬S ∧ W` |
| UNCLASSIFIABLE | :223 | `¬S ∧ ¬M ∧ ¬W` |

`M ∧ ¬S ∧ W` satisfies **both** MULTI-FEATURE and SKIP. The builder added the
disambiguating clause to REQUIRE (":220 … AND `pending_notes` does NOT record a
multi-feature release") and to UNCLASSIFIABLE (":223 … `pending_notes` does not
record a multi-feature release"), but left SKIP at :222 byte-unchanged — it is
the only one of the three siblings that did not get the clause.

This is not hypothetical. Ground truth from the most recent wave release
(v3.113.0), whose closing handoff write reads:

```
- Multi-feature release: e109-workspace-feature-anchoring (E109+E146), e145-md-tables-cited-donemark, e148-stamp-provenance-test-flake.
```

`ls specs/` shows `specs/e109-workspace-feature-anchoring.md` exists and there
is **no** `specs/e145-*` or `specs/e148-*` — two of the three features in that
wave are spec-less mini-chains. Had either been the wave's last feature (i.e.
`active_feature`, which is exactly how the REQUIRE branch's blind spot is
described), the state would have been `M ∧ ¬S ∧ W`: SKIP matches, the bullet
gives no precedence rule, and a release-engineer may legitimately take
SKIP — skipping the range check for *every* sibling spec, which is verbatim the
"v3.111.0's actual, ad hoc, historical behavior" AC5 was filed to eliminate.

Fix: add the same clause SKIP's two siblings already carry — `WHEN no
specs/<active_feature>.md exists anywhere in the working tree AND pending_notes
does NOT record a multi-feature release AND scope_decision_why records …`. One
clause; restores the exclusivity the bullet claims.

### F2 (must fix) — AC5: the MULTI-FEATURE branch's spec-less-feature path is undefined

`content/skill-release-engineer.md:221`: "a named feature with no spec file at
all falls through to that feature's own SKIP/UNCLASSIFIABLE judgment rather than
being silently skipped."

There is no such thing as "that feature's own SKIP judgment". SKIP (:222) is
keyed on `scope_decision_why`, and UNCLASSIFIABLE (:223) on
`scope_decision_why` + `specs/<active_feature>.md` — both are single,
session-scoped fields describing `active_feature` only. `tw_get_state` exposes
no per-feature `scope_decision_why`. So for a named sibling feature with no
spec, the instruction resolves to nothing an executing role can act on, which
is operationally indistinguishable from the "silently skipped" outcome the
clause claims to prevent.

Weight: on the only multi-feature wave on file, this is the path for 2 of the 3
features. Fix options (either is fine, this is a judgment call for the author):
state that a named feature with no spec file is *logged and skipped by design*
(backlog-row-as-spec is the project norm for mini-chain tickets), or require
the wave's `pending_notes`/`scope_decision_why` to carry a per-feature
justification. What must not stand is an instruction that names a decision
procedure that does not exist.

### Verified correct — AC1/AC2 (E147), `scripts/verify-release.mjs:380-386`

Re-derived, not accepted on the note. The new block is:

```js
let releaseSha;
try {
  git(["rev-parse", "--verify", "--quiet", `refs/tags/v${version}`]);
  releaseSha = git(["rev-list", "-n", "1", `v${version}`]);
} catch {
  releaseSha = git(["rev-parse", "HEAD"]);
}
```

- Same two-call pattern as Check 1 (`scripts/verify-release.mjs:179-181`):
  `rev-parse --verify --quiet refs/tags/<tag>` then `rev-list -n 1 <tag>`.
  Not a new or subtly different derivation.
- `git()` (`:65-67`) is `execFileSync(...).trim()`, so a non-zero exit throws
  and the `catch` is reached — `--quiet` makes a missing ref exit 1. Fallback
  reachable **only** when the ref does not resolve (AC2 preserved).
- `version` is normalized `v`-stripped at `:143-145`, so `v${version}` is the
  correct tag spelling; `rev-list -n 1` peels an annotated tag to its commit.
- Post-bookkeeping-commit run: tag at A, HEAD at B ⇒ `releaseSha === A`, and
  `:463` matches CI runs against A. AC1 satisfied.

### Verified correct — AC3 (E142a), `content/skill-release-engineer.md:214`

Union is real: "run BOTH `git diff <prev-tag>..HEAD --name-only` … AND
`git diff --cached --name-only`; confirm every file path … appears in the UNION
of the two — never `--cached` alone." `PREV_TAG=$(git describe --tags
--abbrev=0)` is byte-identical to step 7a's existing derivation at
`content/skill-release-engineer.md:68`, not a new one. Timing checks out: this
bullet runs *before* `git commit` and the `git tag -a` line is at :224, after
it — so `describe` resolves to the previous release's tag, and
`<prev-tag>..HEAD ∪ --cached` covers the whole release exactly once.

### Verified correct — AC4 range (E142b)

`grep -c "HEAD~1"` inside the AC4 bullet (:219-223) is 0; the only remaining
`HEAD~1` in the file is at :23, an unrelated historical anecdote about a
`git reset HEAD~1` incident. REQUIRE now reads "verify … appears in
`git diff <prev-tag>..HEAD --name-only`", and the STOP string was updated to
name the range rather than the commit. The failure path the ticket was filed
against (merge commit as `HEAD~1`) is closed.

### Verified correct — AC6 (E142c), `content/skill-release-engineer.md:160-166`, `:188`

The sweep catches every `expected-red_*.txt` at `qa_reports/` root, with no
feature filter beyond the mandated `$PREV_TAG` membership predicate:

```sh
for f in $(find qa_reports -maxdepth 1 -name "expected-red_*.txt"); do
  if ! git ls-tree -r --name-only "$PREV_TAG" -- "$f" 2>/dev/null | grep -q .; then
    ERFEAT=$(basename "$f" .txt); ERFEAT=${ERFEAT#expected-red_}
    mkdir -p "qa_reports/archive/${ERFEAT}/"
    mv -n "$f" "qa_reports/archive/${ERFEAT}/"
  fi
done
```

- Placement verified: the loop sits inside fragment 5's fence, i.e. inside the
  single `bash <<'STEP7A'` heredoc that binds `PREV_TAG` as fragment 1
  (:68-72). `$PREV_TAG` is in scope — this is the exact E76 failure mode
  (variable bound in one process, consumed in another) and it is not present.
- `$PREV_TAG` cannot be empty here: the empty-baseline guard (:80-107) `exit 9`s
  before the derivation when `PREV_TAG` is unset. Without that, the negated
  `grep -q .` would have made the predicate true for every file and swept the
  tree unbounded. The guard closes it.
- `ERFEAT` derivation is correct: `expected-red_foo.txt` → `foo` →
  `qa_reports/archive/foo/`. `mv -n` keeps a retried release idempotent.
- The predicate is *forward-only* by design and this is correct, not a gap:
  `qa_reports/` is tracked in this repo (no `.gitignore` entry; `git ls-files`
  counts 40 tracked `expected-red_*`), and `git ls-tree v3.113.0` already holds
  39 of them. The ~20 pre-existing root-level orphans are in `$PREV_TAG`'s tree
  and will therefore be skipped, consistent with the MUST NOT at :191 ("not new
  since `$PREV_TAG` MUST NOT be touched"). Flagging for qa-engineer so the
  surviving orphan backlog is not misread as an AC6 failure — AC6 prevents new
  orphans, it does not retroactively clean old ones.

### Verified correct — AC7 (E143), all three sites agree

- `:42` — new standalone bullet: `tasks.md` "staged and committed by SOP step 8
  … never by step 13a". The single normative record.
- `:240` — 13a no longer lists it and no longer carries the false "the E71c
  exclusion from step 8's release commit" premise; it defers explicitly ("see
  the Artifact list above").
- `:244` — `git add -- .current/handoff.md $JSONL`; `tasks.md` dropped from the
  invocation.
- `:273` — scope rule now reads "explicit non-STOP exclusions from THIS
  STOP-on-unrelated-uncommitted-changes rule only (E71c)" plus "This exclusion
  says nothing about which commit stages or owns either path (E143)". It
  disambiguates without asserting ownership. Correct.
- Proof command satisfied: `grep -n "tasks.md" content/skill-release-engineer.md`
  → `:20`, `:21` (pre-existing never-hand-edit rules), `:42`, `:201`, `:206`
  (step 8's `git add` and `PATHS`), `:273`. Absent from 13a's prose and script.
- Non-regression: dropping `tasks.md` from 13a does not weaken the non-empty
  stage assertion at `:245-248` — step 13's closing `tw_update_state` always
  dirties `.current/handoff.md`, so the stage is never empty for that reason.

### Verified correct — AC8 (E144), `content/skill-release-engineer.md:252`

Two FAILs, two remedies, and both FAIL strings are byte-accurate against the
script: `FAIL: no upstream tracking branch configured`
(`scripts/verify-release.mjs:114`) → `git push -u <remote> <branch>`; and
`FAIL: HEAD is <n> commit(s) ahead of upstream <ref> — not pushed` (`:130`)
→ plain `git push`. The prose also states *why* they differ ("a plain
`git push` cannot create the missing upstream"), so the two are not
re-conflatable.

### Verified correct — AC9/AC10 (E149 N1/N2), `content/coord-03-core-fallback.md:9`

- N1 is additive: the mechanism list (feature lease, `hop_count`,
  `review_round`/`qa_round`, `tw_detect_drift`, telemetry sidecars, evidence
  paths, `cut_approved`) is intact, nothing deleted, and the inserted text is
  the spec's `e149.n1-keying-vs-resolution` string verbatim. It points forward
  ("see the Worktree bootstrap obligation below") rather than restating E111's
  symlink obligation — AC9's "not a restatement" holds.
- N2/AC10 re-derived independently rather than accepted: composing the bundle
  from the working tree (`buildCoordinatorPrompt('<workspace>')`, 69,706 chars)
  gives `(E109)` → **false**, `(E111)` → false, `(E1)` → true (the sanctioned
  pre-convention exception, untouched), and both `for keying` and `where those
  paths resolve is a separate concern` → true. So the wrap works *and* the N1
  clause survives the strip passes — i.e. it was not fenced in
  `rationale:start/end`, which AC12 flags as the measured-dead route that would
  have deleted the normative deliverable from the shipped bundle.

### Verified correct — AC11 (E149 N3), `content/skill-release-engineer.md:227`

SOP quote now ends `… ahead of tag vX.Y.Z (<tagSha12>..<headSha12>)`, matching
the runtime literal at `scripts/verify-release.mjs:252`
(`… ahead of tag ${tag} (${tagSha.slice(0, 12)}..${headSha.slice(0, 12)})`).
Placeholders name both shas, as AC11 permits.

## Quality

### F3 (should fix this round) — `:273` scope rule no longer describes step 7a's output

`content/skill-release-engineer.md:273` still scopes the expected move-only
output to "`qa_reports/archive/<feature>/**` and `review_reports/archive/<feature>/**`
(E50) moves produced by SOP step 7a … **for the released feature's evidence
files only**". After E142(c), step 7a legitimately emits moves for *sibling*
features' `expected-red_*.txt` files. On the multi-feature wave this ticket
exists to serve, a release-engineer scanning `git status --short` will see
archive moves the scope rule does not list as EXPECTED, which is precisely the
STOP row's trigger. E143 was allowed to touch this same paragraph, so the
one-clause widening ("for the released feature's evidence files, plus the
per-feature `expected-red_*` archive dirs step 7a's sweep produces") belongs in
this round rather than a follow-up.

### F4 (should fix this round) — `scripts/verify-release.mjs` comments now contradict E143

Two comments in a file this diff already opens became false the moment `tasks.md`
left step 13a:

- `:160-163` — "Exactly the paths SOP step 13a stages when it closes a release
  out: the handoff's closing write, the per-run telemetry/metrics/usage
  sidecars, **and the task ledger**." 13a no longer stages the task ledger.
- `:41` — "runnable AFTER the governance bookkeeping commit
  (handoff/metrics/**tasks** — kept separate from the release commit per E71c)".
  Same stale premise E143 removed from `:240`.

Behaviour is unaffected — `BOOKKEEPING_PATH_RES` (`:165`) keeping
`/^tasks\.md$/` makes the E141 tolerance a harmless superset of 13a's staging
set, and the regex must **not** change. Only the two comments should. Flagging
because this is the same defect class the wave exists to kill: a comment that
plausibly claims what a check measures, which is no longer true. If the author
judges this outside E143's ratified three sites, a follow-up ticket is an
acceptable disposition — but it should be a recorded decision, not an omission.

### F5 (non-blocking) — `:42`'s "this is the one place" is self-falsifying

`:42` says "E143: this is the one place recording that ownership", while `:240`
also records it ("The task ledger is staged and committed by step 8, never by
this step"). Substantively the two agree and `:240` defers to `:42`, so nothing
misleads an executing role — but the literal claim is false, and a future reader
auditing "exactly one place" will find two. Suggest softening `:42` to "the
normative record for that ownership" or rephrasing `:240` purely as an
exclusion ("this step stages only `.current/handoff.md` and `.current/*.jsonl`")
with the cross-reference kept.

Related, recorded for transparency rather than as a finding: `:240` says "the
task ledger" instead of `tasks.md`, which is what lets AC7's grep-based proof
return clean. The substance is genuinely correct (the `git add` at `:244` really
did drop the path), so the proof is not being gamed into a false pass — but the
grep alone would not have distinguished the two cases, and a future AC of this
shape would be stronger asserting on 13a's fenced script block specifically.

### F6 (non-blocking) — the multi-feature key's only real-world instance carries a trailing annotation

`:221` recognises the shape `"Multi-feature release: <feature-1>, <feature-2>,
..."` and then derives `specs/<feature-N>.md` from each name. The only instance
of this convention in the repo's history is
`- Multi-feature release: e109-workspace-feature-anchoring (E109+E146), e145-…, e148-…`
— a leading `- ` bullet marker and a trailing `(E109+E146)` annotation on the
first name. A literal reading would look for
`specs/e109-workspace-feature-anchoring (E109+E146).md`. A human role will
handle it, but since this branch's whole job is to key off a convention, one
clause ("strip any trailing parenthetical annotation from each name") would make
the derivation unambiguous. Degradation on an *absent* or unrecognised key is
otherwise sane and was checked specifically: it falls to REQUIRE, which is a
hard STOP, not a silent no-op — the SKIP escape reached in F1 comes from the
guard overlap, not from key malformation.

### F7 (non-blocking) — minor convention drift in the new sweep loop

Two small deviations from the surrounding step 7a discipline at
`content/skill-release-engineer.md:160-166`:

- The sibling move loops guard on `[ -z "$EXCLUDE_QA" ]` / `[ -z "$EXCLUDE_RR" ]`
  (`:153-154`, `:158`); the new `expected-red` loop does not. The bullet at
  `:106` states an excluded tree's `find` "is skipped rather than run against a
  directory that doesn't exist". Functionally harmless (`EXCLUDE_QA` implies
  either no dir or no root files, so the loop body never runs), but when
  `qa_reports/` is absent the unguarded `find` writes to stderr inside the
  release transcript.
- `:214` and `:219` define `PREV_TAG=$(...)` as a shell variable and then use
  the `<prev-tag>` angle-bracket placeholder in the commands, whereas step 7a
  consistently uses `$PREV_TAG`. Internally consistent across both new bullets,
  so not confusing in practice — noted only for register consistency.

## Architecture

Fit with the spec's Decisions section is sound. The E143 decision (step 8 owns
`tasks.md`) is implemented as ratified, and the implementation independently
reproduces the decision's evidence: step 8's staging list at `:201`/`:206` does
contain `tasks.md`, which is what makes 13a's old "E71c exclusion" premise false.

One design consequence of AC6 worth recording for a follow-up, not for this
round — the ticket ratified it explicitly, so it is not a defect in the build:
generalising the sweep from `<active_feature>` to "every root-level
`expected-red_*.txt` new since `$PREV_TAG`" means an **in-flight** sibling
feature's manifest is now sweepable, where the hardcoded line structurally could
not touch it. `qa_reports/expected-red_<feature>.txt` at root is load-bearing for
the `REPRO_MANIFEST_MISSING` gate on a `dispatch_mode: "bugfix"` chain, and per
the E111 worktree bootstrap obligation a parallel lane's `qa_reports/` is
symlinked back to primary — so a release cut in primary while another lane's
bugfix chain is mid-flight can archive that lane's manifest and block it. `mv -n`
makes this recoverable rather than destructive, and it is out of scope here
(AC6 mandates the technique verbatim), but it deserves a backlog row.

No layering violations. No architecture spec exists for this feature
(`specs/e142-release-tooling-wave25-architecture.md` absent). The one script
change stays inside Check 6's closure and changes no exported surface.

## Security

No findings.

- The new tag-resolution path (`scripts/verify-release.mjs:380-386`) passes
  `v${version}` as a separate `execFileSync` argv element, never through a
  shell, and `version` is already constrained by `/^\d+\.\d+\.\d+$/` at `:150`.
  No injection surface added.
- No secrets, credentials, or network boundaries introduced. The `gh` invocation
  is unchanged.
- The new step 7a shell loop runs only on operator-controlled local paths under
  `qa_reports/`, uses `mv -n` (never clobbers, never deletes), and derives
  `ERFEAT` by prefix-strip from a filename matched against a fixed
  `expected-red_*.txt` glob. Worth stating explicitly since this is a generated
  path used in `mkdir -p`: a crafted filename could create a nested directory
  under `qa_reports/archive/`, but that requires write access to `qa_reports/`,
  which already implies full workspace write. Not a new trust boundary.
- The unquoted `$(find ...)` word-splitting in the new loop matches the
  established precedent in the same fence (`:149-158`) and carries the same
  space-in-filename caveat; feature slugs are `[a-z0-9-]` by convention.

## Performance

No findings. The script change replaces one `git rev-parse` with at most two
short-lived git invocations, once per run, outside any loop — and it strictly
reduces polling work in the post-bookkeeping case by targeting the correct sha.
The new step 7a loop is O(number of root-level `expected-red_*.txt`) with one
`git ls-tree` per file; the surrounding `<CODES>` derivation and `covers:` sweep
already run per-file `git`/`grep` at the same order, so this is no algorithmic
regression. Everything else is prose.

One observation, pre-existing and not introduced here: Check 6's
`gh run list --limit 10` window (`:407`) is unchanged, so on a busy `main` the
tagged commit's run can fall outside the last 10 completed runs. Post-fix this
degrades to the existing WARN-and-continue path, never to a FAIL, so the E78
contract is preserved.

## Expected-red disposition (SOP step 4a)

The diff touches no test files. The repository's currently-red tests
(`test/context-budget.test.mjs` floor 18722, and the compose golden fixture) are
the declared, coordinator-assigned consequence of the AC10 coord-03 edit and are
AC12's re-baseline, owned by qa-engineer under T-E142-05 per Constitution §2 —
sr-engineer was barred from `test/`. This is documented in the spec's own AC12,
not an undocumented red, and `dispatch_mode` is not `bugfix`, so no
`qa_reports/expected-red_e142-release-tooling-wave25.txt` repro manifest is
required. Recorded as disposed, not as a finding.

## Model-independence note

This review ran on opus; the dispatch pin for sr-engineer was `fable`. Different
model, so no same-model blind-spot concern to flag.

## Verdict

CHANGES_REQUESTED — AC5 is not met: the MULTI-FEATURE branch was added but the
SKIP branch's guard was not disambiguated against it (F1), leaving the
backlog-row-as-spec escape open on the exact wave shape v3.113.0 actually
shipped, and the branch's spec-less-feature path names a per-feature judgment
that does not exist (F2). Everything else in the wave — AC1, AC2, AC3, AC4's
range, AC6, AC7, AC8, AC9, AC10, AC11 — verifies.

## Round 1 reply — by sr-engineer

Addressed all seven findings, confined to the two files this ticket owns
(`content/skill-release-engineer.md`, `scripts/verify-release.mjs`), one pass
per file. `npm run build` clean.

- **F1** — `content/skill-release-engineer.md`, SKIP branch (:222 pre-edit):
  added the missing `AND pending_notes does NOT record a multi-feature
  release (see MULTI-FEATURE branch above)` clause, the same disambiguator
  REQUIRE and UNCLASSIFIABLE already carried. Guards are now exhaustive and
  mutually exclusive: `M` → MULTI-FEATURE only; `¬M∧S` → REQUIRE only;
  `¬M∧¬S∧W` → SKIP only; `¬M∧¬S∧¬W` → UNCLASSIFIABLE only.
- **F2** — same branch: replaced "falls through to that feature's own
  SKIP/UNCLASSIFIABLE judgment" (a procedure that doesn't exist — both are
  session-scoped to `active_feature` only) with a recorded decision: a named
  feature with no spec file is logged-and-skipped by design (backlog-row-as-
  spec is the project norm for mini-chain riders; requiring a per-feature
  justification would need information `tw_get_state` doesn't carry — same
  reasoning E109 settled on). Added the log-line example the other three
  branches already have.
- **F3** — the `:273` scope rule's EXPECTED-move clause widened from "the
  released feature's evidence files only" to also cover "the per-feature
  `expected-red_*` archive dirs step 7a's sweep produces," so a multi-feature
  wave's sibling-feature archive moves don't arm the STOP row.
- **F4** — `scripts/verify-release.mjs` comment-only fixes at the `--close-out`
  doc comment (~:40-41) and the `BOOKKEEPING_PATH_RES` comment (~:160-166):
  both no longer claim step 13a stages `tasks.md`; both now state step 8
  stages it (E143) and that the regex entry survives as a harmless tolerance
  superset. `BOOKKEEPING_PATH_RES` itself (`/^tasks\.md$/` included) is
  byte-unchanged, as required.
- **F5** — softened `:42`'s "this is the one place recording that ownership"
  to "the normative record for that ownership," per the reviewer's own
  suggested wording, so it no longer contradicts `:240` also recording it.
- **F6** — MULTI-FEATURE's key derivation now strips a trailing parenthetical
  annotation from each feature name before deriving `specs/<feature-N>.md`
  (e.g. `e109-workspace-feature-anchoring (E109+E146)` →
  `e109-workspace-feature-anchoring`), matching the one real instance on file.
- **F7** — the new expected-red sweep loop is now guarded by
  `if [ -z "$EXCLUDE_QA" ]; then ... fi`, matching its `EXCLUDE_RR`-guarded
  sibling; the two `PREV_TAG`-derivation sentences at :214/:219 now use
  `$PREV_TAG` (the just-bound variable) instead of the `<prev-tag>` template
  placeholder, consistent with the surrounding derivation — the STOP-message
  templates' own `<prev-tag>` placeholders (alongside `<active_feature>`) were
  left as-is since those are message templates, not command descriptions.

No other lines touched; the ~20 pre-existing root-level orphan
`expected-red_*.txt` files and the E111-symlink sibling-lane observation are
left for a backlog row, per the reviewer's own disposition. Routing back to
code-reviewer for round 2.

---

## Round 2 — APPROVED — by code-reviewer

Re-reviewed against the working tree after sr-engineer's round-1 fixes. Line
numbers below are post-fix (the AC4 branch block shifted +2). The ten ACs
verified in round 1 were re-checked only where this round's edits touched them;
`content/coord-03-core-fallback.md` is byte-unchanged from round 1
(`git diff --numstat` → `1 1`), so AC9/AC10 stand as verified.

### Scope (unchanged, re-confirmed)

`git status --porcelain`: the three source files plus `.current/`, `tasks.md`,
and two untracked artifacts (this report, the spec). No `test/`, no
`docs/backlog.md`, nothing under `schema/`, `tools/`, or `index.ts`.

`scripts/verify-release.mjs` grew from 14 to 35 diff lines this round, which
warranted a check rather than an assumption: the full diff is three hunks — two
comment-only (F4) and the unchanged E147 block. No executable line changed
beyond E147. `node --check scripts/verify-release.mjs` passes.

### F1 — RESOLVED. Mutual exclusivity genuinely restored, re-derived across all four guards

The clause landed at `:224`, but the question is exhaustiveness and disjointness
of the whole set, not the presence of a clause. Re-derived:

| branch | line | guard |
|---|---|---|
| REQUIRE | :222 | `S ∧ ¬M` |
| MULTI-FEATURE | :223 | `M` |
| SKIP | :224 | `¬S ∧ ¬M ∧ W` |
| UNCLASSIFIABLE | :225 | `¬S ∧ ¬M ∧ ¬W` |

Pairwise disjoint: REQUIRE∧MULTI and MULTI∧SKIP and MULTI∧UNCLASS each need
`M ∧ ¬M`; REQUIRE∧SKIP and REQUIRE∧UNCLASS each need `S ∧ ¬S`; SKIP∧UNCLASS
needs `W ∧ ¬W`. All six pairs are unsatisfiable. Exhaustive: `M` → MULTI;
`¬M∧S` → REQUIRE; `¬M∧¬S∧W` → SKIP; `¬M∧¬S∧¬W` → UNCLASSIFIABLE. Every
assignment lands in exactly one branch, so `:221`'s "Exactly one of four
branches applies" is now a true statement.

The round-1 falsifying case (`M ∧ ¬S ∧ W` — the v3.113.0 wave shape with a
spec-less mini-chain as the last feature) now routes to MULTI-FEATURE alone:
sibling specs are range-checked, and the spec-less `active_feature` is logged
per the F2 decision. The SKIP escape is closed.

### F2 — RESOLVED. Decision recorded, executable, and stated once

`:223` carries "**Decision (E142(b)): a named feature with no spec file at all
is logged and skipped by design**", with the rationale (backlog-row-as-spec is
the mini-chain norm; SKIP/UNCLASSIFIABLE are session-scoped to `active_feature`
so no per-feature form exists; a per-feature justification would need
information `tw_get_state` does not carry) and a concrete log line. `grep -c
"logged and skipped"` is 1 — stated once, in the branch that owns the case, in
the E143 style.

The fix is more than additive, which is the right call: the branch's closing
STOP sentence was tightened from "If any named feature's spec is absent from the
range" to "If any named feature's spec **DOES exist** but is absent from the
range". Without that, the new decision and the old STOP would have contradicted
each other on exactly the case the decision governs. Coherent.

One non-blocking note for the coordinator, not for sr-engineer: this is a
ratified decision that now lives only in the SOP. `specs/e142-release-tooling-wave25.md`'s
**Decisions** section records E143's ownership ruling and the E142/E144
file-surface correction but not this one. Adding it is spec-owner work and
correctly outside sr-engineer's three-file scope — flagging only so the
traceability gap is closed deliberately rather than by omission.

### F6 — RESOLVED, and the promotion to must-fix was right

`:223` now reads "stripping any trailing parenthetical annotation from each name
before deriving its spec path — e.g. `e109-workspace-feature-anchoring
(E109+E146)` → `e109-workspace-feature-anchoring`, the exact form v3.113.0's own
closing write used".

- Handles the real instance: the annotated first name in v3.113.0's note is
  quoted verbatim as the worked example, so the one string this branch will
  actually meet in the wild is unambiguous.
- Does not over-strip, checked against the tree rather than assumed:
  `ls specs/ | grep -c '('` is **0** across all 149 spec files. No legitimate
  feature slug contains a parenthesis, and the rule is scoped to a *trailing*
  annotation, so there is no name it can damage.

I under-ranked this in round 1. The branch's entire function is keying off a
convention, and the only instance of that convention on file did not parse —
must-fix was the correct call.

### F4 — RESOLVED. New comment text is true, not merely different

Both comments re-checked against what the SOP now actually says:

- `:41-44` — "(handoff/metrics — kept separate from the release commit per
  E71c; `tasks.md` is staged by step 8's release commit itself, never by this
  bookkeeping commit, per E143)". Matches the E143 decision and 13a's actual
  `git add -- .current/handoff.md $JSONL`.
- `:161-168` — "The paths SOP step 13a stages … the handoff's closing write and
  the per-run telemetry/metrics/usage sidecars", which is exactly
  `.current/handoff.md` plus the `find .current -maxdepth 1 -name "*.jsonl"`
  expansion. The dropped word is the load-bearing one: it no longer claims to be
  "**Exactly** the paths", and it now names the divergence explicitly —
  "`tasks.md` … stays in this allowlist anyway as a harmless superset … a safety
  margin rather than a precise mirror of 13a's `git add`". That is the honest
  description of the regex, so the comment can no longer drift out of truth the
  way the old one did.
- `BOOKKEEPING_PATH_RES` (`:170`) confirmed byte-unchanged independently: the
  line does not appear on either side of `git diff`. `/^tasks\.md$/` retained,
  E141 tolerance behaviour identical.

Cosmetic only, no action needed: hunk 1's rewrap leaves a short orphan line
("// commit automatically") with the next line resuming mid-sentence.

### F3 — RESOLVED

`:275` now reads "…for the released feature's evidence files, **plus the
per-feature `expected-red_*` archive dirs step 7a's sweep produces**". The
sibling-feature archive moves E142(c) introduces are now named as EXPECTED
move-only output, so the sweep can no longer arm the STOP-on-unrelated-changes
row on the very multi-feature wave it exists to serve. The widening is bounded
to `expected-red_*` dirs produced by 7a, not to archive paths generally.

### F5 — RESOLVED

`:42` now reads "E143: this is **the normative record** for that ownership".
No longer self-falsifying, and it reads correctly alongside `:240`'s deferring
cross-reference.

### F7 — RESOLVED (guard), ACCEPTED WITH A NOTE (placeholder split)

The `EXCLUDE_QA` guard landed at `:160-168`: the expected-red loop is wrapped in
`if [ -z "$EXCLUDE_QA" ]; then … fi`, matching the discipline of the sibling
move loops. `$PREV_TAG` remains in scope (same `STEP7A` heredoc), so the AC6
mechanics I verified in round 1 are unchanged.

On the `$PREV_TAG` vs `<prev-tag>` split, asked directly: **accepted, with the
observation that what landed is narrower than the rule as described.** The
stated rule — placeholders in STOP-message templates, the shell variable in
narrative commands — is sound. In the file, `git diff $PREV_TAG..HEAD
--name-only` appears twice (`:216` citation check, `:221` AC4 narrative) and
`git diff <prev-tag>..HEAD --name-only` twice more, at `:222` and `:223` — and
those two are *commands inside the branch bullets*, not STOP templates. So the
placeholder survives in the two places a reader is most likely to copy from.
This is cosmetic in a file whose `<...>` placeholder convention is established
throughout, it misleads nobody, and it does not touch any AC. Not worth another
round; recording it so the inconsistency is a known one rather than a
rediscovery.

### Regression check on the round-1 verified ACs

Re-run after this round's edits, since they touched the same bullets:

- `grep -c "HEAD~1" content/skill-release-engineer.md` → 1, still only `:23`'s
  unrelated `git reset HEAD~1` anecdote; 0 inside the AC4 block (AC4).
- `grep -c "expected-red_<active_feature>"` → 0 (AC6 proof).
- `grep -c "push -u"` → 1, in 13b (AC8 proof).
- `tasks.md` occurrences in the 13a block (`:240-250`) → 0 (AC7 proof).
- AC3's union intact at `:216`: "run BOTH `git diff $PREV_TAG..HEAD
  --name-only` … AND `git diff --cached --name-only` … appears in the UNION of
  the two".
- `grep -c "HEAD~1" scripts/verify-release.mjs` → 0.

No AC regressed and no fix introduced a new defect.

### Correctness / Quality / Architecture / Security / Performance

No new findings in any category this round. The two comment hunks and the six
prose edits introduce no executable change; the one executable block
(`scripts/verify-release.mjs:376-388`) is byte-identical to the round-1 version
I verified against Check 1's `:179-181` pattern. No new inputs cross a trust
boundary, no complexity-class change, and the added `EXCLUDE_QA` guard strictly
reduces work when the tree is excluded.

Standing exclusions, re-confirmed as not findings: the red
`test/context-budget.test.mjs` / compose-golden fixture (qa-engineer's
T-E142-05 AC12), the ~20 pre-existing root-level `expected-red_*.txt` orphans
(correctly skipped by AC6's range-bounded predicate), and the in-flight
sibling-lane symlink observation (backlog row).

## Verdict

APPROVED — all seven round-1 findings are fixed, the two must-fix defects are
resolved at the level of the property rather than the symptom (branch
exclusivity re-derived across all four guards; the spec-less-feature decision
recorded once, executable, and reconciled with the branch's STOP sentence), and
no fix introduced a regression. Routing to qa-engineer for T-E142-05.
