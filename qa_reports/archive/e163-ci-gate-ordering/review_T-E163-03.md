# Review — T-E163-03 (final QA, `e163-ci-gate-ordering`)

covers: T-E163-01, T-E163-03

Spec: `docs/backlog.md` row E163 + the three cut decisions (D1/D2/D3) recorded verbatim in
`scope_decision_why` (mini-chain, backlog row IS the spec — PM/architect skipped). Diff under
review: `content/skill-release-engineer.md`, `scripts/verify-release.mjs` (sr-engineer, code-reviewer
APPROVED round 2 — `review_reports/review_T-E163-01.md`), plus this task's own retargeting of
`test/release-staging.test.mjs` and a clarifying note in `test/render-structure.test.mjs`.

## Expected-Red Diff (Phase 0.5)

`qa_reports/expected-red_e163-ci-gate-ordering.txt` exists (4 entries, all in
`test/release-staging.test.mjs`). Per SOP, ran the full suite BEFORE any re-baseline edit to
verify the actual red set, rather than trusting sr-engineer's and code-reviewer's prior counts
(E161: a PASS's suite figures must be verified, not attested). Method: `git stash push -- test/release-staging.test.mjs test/render-structure.test.mjs` (reverting my not-yet-made edits to
their pre-QA state), ran `npm test`, recorded the actual failures, then `git stash pop` to restore
my edits and re-ran to confirm green.

**Pre-edit `npm test`: 2234 tests / 2230 pass / 4 fail.** The 4 failures, by exact test name:

```
not ok - E53: the Escalation Routes table gains exactly one new row (six pre-existing + the empty-baseline-hazard row = seven), placed last
not ok - E49/E44 step-order pin: step 7a precedes step 8 in the file, and 7a's derivation does not depend on the release commit's own content (guards F2's class from returning)
not ok - E65: the adapter-stamp step exists, names all three deployed adapter files, and requires agc check to exit 0
not ok - E65: step 7b (driftBaselineIds), 7c (backlog done-marking), and 7d (adapter-stamp bump) are ALL ordered before step 8's commit, in that relative order — order is the whole defect
```

**Diff against the manifest: empty.** All 4 actual reds match all 4 manifest entries 1:1, by exact
test name. Zero unexplained reds, zero manifest entries not actually red. Disposition per entry:

1. **`E49/E44 step-order pin`** — retargeted. Cause: literal-searches `"8. **Commit + tag +
   push**"`, which E163 renamed to `8a. **Commit + push branch**` / `8b. **CI gate**` /
   `8c. **Tag + push**` (D1). Not a defect — the rename is exactly what the cut specified.
2. **`E65: adapter-stamp step exists...`** — retargeted, same root cause.
3. **`E65: step 7b/7c/7d ... before step 8's commit`** — retargeted, same root cause.
4. **`E53: Escalation Routes table gains exactly one new row...`** — re-baselined. Cause: E163
   added two new rows (`pre-flight CI gate red (step 2a)`, `CI gate failure (step 8b)`) to the
   Escalation Routes table, placed first per the cut, so the pre-existing 7-row / hazard-row-last
   pin no longer holds a 9-row table. Not a defect — additive, cut-specified growth.

None of the four is a regression; all four are the direct, predicted consequence of D1's rename
and the two new Escalation Routes rows the cut required. Retargeted below (see Phase 3).
**Post-edit `npm test`: 2234 tests / 2234 pass / 0 fail** — full green, verified by execution (see
Phase 4).

## Phase 1 — Review

Read `content/skill-release-engineer.md` and `scripts/verify-release.mjs` in full (both already
code-reviewed to APPROVED across 2 rounds — see `review_reports/review_T-E163-01.md`). I did not
re-litigate correctness/architecture (code-reviewer's job, out of QA's scope per the Hard rules);
I focused on test coverage, the expected-red disposition, and the items the reviewer explicitly
carried forward for QA rather than spending a third review round.

### Copy Audit Gate / Visual Audit Gate (Phase 3a/3b)

`docs/backlog.md` row E163 (the spec, mini-chain) carries no *Copy / Strings* or *Visual Tokens*
H2 — these gates apply to specs authored via the PM template, which was skipped here by cut
decision. Phase 3a/3b: **skipped (no Copy/Strings or Visual Tokens H2 in the spec)**.

### Phase 1.5 — Visual Compare

No `design/e163-ci-gate-ordering.md` file, no `## Visual Baselines` H2 anywhere. **Phase 1.5:
skipped (no Visual Baselines declared)** — this is a CLI/SOP-prose feature, not a UI feature.

## Phase 3 — Tests

### Test File Discovery / placement

Per the dispatch brief's **Test-file placement** line: `test/release-staging.test.mjs` (retarget 4
existing assertions) and `test/render-structure.test.mjs` (one stale prose-fixture note). Both
files already exist and already cover this exact area (release-SOP structural pins; the E69/E75
line-glue detector-soundness fixture, respectively) — edited both in place, per Constitution §2. No
new test file created; none is needed — the 4 failing assertions are pre-existing structural
pins whose target moved, not a new property to cover, and the render-structure item is a
documentation clarification on an existing fixture, not a new assertion.

### Spec-to-Test map

E163's three cut decisions map to existing, already-passing coverage plus the 4 retargeted pins:

| AC / decision | test(s) |
|---|---|
| D1: step 8 splits into 8a/8b/8c, sub-lettered | the 3 retargeted header-literal pins (below) — all now bound against `8a. **Commit + push branch**` |
| D1: 2 new Escalation Routes rows, additive, placed first | the retargeted E53 row-count/shape pin (below) |
| D3: step 2a pre-flight CI gate | `content/skill-release-engineer.md` prose-only; verified by reading (Phase 1) — no proof: annotation on this backlog row (Phase 3.5 below) |
| `--ci-check [--strict] [--sha]` mode, strictness asymmetry | already covered by code-reviewer's empirical table (review_T-E163-01.md) across all 7 reachable CI states; I independently re-exercised the `--sha` and `--strict` surfaces live (Phase 4 below) rather than re-deriving the same table |

### Retargeted assertions — what each still guards

1. **`E49/E44 step-order pin`** (`test/release-staging.test.mjs`) — retargeted `idx8` ->
   `idx8a` (`"8a. **Commit + push branch**"`). **Chose 8a, not 8c**: the property is "7a's moves
   must land IN the release commit", and the commit itself is 8a — 8c is the tag push, which has
   no relationship to this guard. Still guards: (a) step-order — 7a (and, since the slice extends
   through 7b/7c/7d unchanged, all of 7a-7d) must precede the commit; (b) the F2 regression class
   — the text in that span must not reference the release commit's own diff/content
   (`git diff HEAD~1`, `git show HEAD`) before that commit exists. Both properties are unchanged
   by the retarget; only the boundary marker's spelling changed.
2. **`E65: adapter-stamp step exists...`** — retargeted the same way, same reasoning: the
   adapter-stamp bump (7d) must land in the commit (8a), not merely before the tag (8c). Still
   guards: adapter-stamp step exists, names all three deployed adapter files, requires `agc check`
   to exit 0, and precedes the commit.
3. **`E65: step 7b/7c/7d ... before step 8's commit`** — retargeted the same way. Still guards:
   all three of 7b/7c/7d precede the commit, AND in their own numbered relative order (7b < 7c <
   7d) — order is the whole defect this pin exists to catch, unchanged by the retarget.
4. **`E53: Escalation Routes table row count/shape`** — re-baselined from 7 to 9 data rows.
   Re-expressed the "last row" assertion (was: hazard row is the 7th/last row) into three
   sub-assertions so it is not loosened into vacuity: (a) exactly 9 data rows (still fails if a
   row is duplicated, dropped, or a stray row is inserted anywhere in the table); (b) the new
   `pre-flight CI gate red (step 2a)` row is FIRST; (c) the new `CI gate failure (step 8b)` row is
   SECOND; (d) the pre-existing `empty-baseline hazard` row (E53) is still LAST — i.e. E163's two
   new rows are additive at the front, not a reorder of the six-plus-one rows that were already
   there. This still fails on: a dropped/duplicated row, a row inserted mid-table, either new row
   landing in the wrong position, or the hazard row losing its terminal spot — a strictly more
   specific guard than the count-only version it replaces, not a weaker one.

### `test/render-structure.test.mjs` — stale prose fixture (not an assertion)

`BASELINE_EXCERPT_MKDIR_P` / `BASELINE_EXCERPT_DRIFT_BASELINE` (lines ~192-193, ~199-200) are
frozen, byte-identical renderer **input** — copied verbatim from commit `ffa4082` (predating E163
by over a month) specifically to give `findAsymmetricRationaleSpans` /
`applyTextTransforms`+`findLineGlueFindings` a known historical glue shape to detect, per the
file's own HERMETIC FIXTURE comment (E77). They are never read against, or diffed against, the
live `content/skill-release-engineer.md` — the test asserts properties of the two detectors, not
properties of the current SOP text. That is why this test stayed green through E163's step-8
rename (nothing it does could have gone red from that rename) and why it is correctly absent from
the expected-red manifest (a manifest entry means "this test's target moved under the change";
this test has no live target).

**I did NOT edit the two excerpt strings.** Doing so would make them byte-diverge from the actual
`ffa4082` commit content, falsifying the file's own "verified byte-for-byte against a full
deep-clone `git show` of that commit" provenance claim two paragraphs above them, for zero
benefit — the detector-soundness property under test is invariant to which historical commit
supplies the input bytes. Instead I added a **STALE-BUT-CORRECT NOTE** immediately after the
HERMETIC FIXTURE comment block, explaining explicitly: these two constants say "step 8" and will
keep saying "step 8" forever (they are frozen provenance, not live text); do not "fix" them to
8a/8b/8c; this is exactly why the test was correctly green while its embedded prose was stale
relative to the live SOP. This satisfies the dispatch brief's ask ("confirm ... it is input rather
than assertion, so the next reader knows why it was green while wrong") without weakening the
fixture's own hermetic-provenance guarantee.

## Phase 3.5 — AC Execution Log

`docs/backlog.md` row E163 carries no `proof:`-annotated Acceptance Criteria (grepped the row: zero
matches). **Phase 3.5: skipped (no proof:-annotated ACs)** — this is a backlog-row-as-spec
mini-chain with no formal AC list at all, let alone one with `proof:` annotations.

## Item 4 — Disposition of the 4 non-blocking carried-forward items

None of these four are qa-engineer's to fix directly — all four sit in `content/skill-release-engineer.md`
and/or `scripts/verify-release.mjs`, both explicitly declared sr-engineer's file in this feature's
`scope_decision_why` ("FILE-OWNERSHIP DECLARATION: content/skill-release-engineer.md and
scripts/verify-release.mjs are sr-engineer's"). Recording a reasoned disposition on each per the
dispatch brief's request, not silently omitting any:

1. **8b's retry loop is unbounded; budget-expiry strict FAIL is unreachable on hosts whose
   command timeout < `AGC_VERIFY_CI_WAIT_SECONDS` (480s)** — a genuinely hung CI (not merely slow)
   livelocks the operator with no escalation route, because every attempt is killed by the host
   before the script's own budget expires and prints a real `FAIL:`. **Disposition: AGREE this is
   worth fixing.** The reviewer's cheapest fix — advise setting `AGC_VERIFY_CI_WAIT_SECONDS`
   *below* the host's command timeout, so the script itself reaches its budget and prints a real
   strict `FAIL:` the executor can act on, rather than being killed first — is a one-line prose
   addition to step 8b with no behavioral/code change and no new escalation-route semantics. It
   converts an unobservable livelock into the existing printed-verdict path. I recommend this be
   routed to sr-engineer as a follow-up prose edit to `content/skill-release-engineer.md` step
   8b; I am not editing that file myself (not qa's to touch, per the file-ownership declaration
   above, and per the dispatch brief's explicit instruction).
2. **Hardcoded `--branch main`** (`scripts/verify-release.mjs:477-478`) — pre-existing (E78), not
   introduced by E163, but E163 newly makes it release-*blocking* (8b hard-FAILs after the full
   poll budget) rather than merely advisory (9a WARNs) for any release cut from a non-`main`
   branch. **Disposition: latent, non-blocking for this repo** (which releases from `main` only —
   confirmed via this session's own `git branch`/release history). Not a code fix I can make
   (`scripts/verify-release.mjs` is sr-engineer's), and not clearly worth an in-cut fix given it
   is a pre-existing condition E163 only sharpens, not introduces. Recommend a follow-up backlog
   ticket (as the reviewer suggested) rather than expanding this cut's scope.
3. **`CI-CHECK PASSED` is mode-dependent** (means "verified green" under `--strict`, "could not
   tell, degrading gracefully" under lenient) — sound today because 8b always passes `--strict`
   and the SOP hardcodes it; a sharp edge only for a *future* grep-based consumer that doesn't
   also track the mode flag. **Disposition: no action needed now.** Speculative-future risk with
   zero present consumers other than 8b itself (which is unaffected, since it always runs
   `--strict`). Not blocking, not currently actionable, no fix requested by the dispatch brief.
4. **`test/render-structure.test.mjs:193,200` stale prose fixture** — this is item 2 above,
   disposed there: confirmed as renderer input (not a live assertion), clarifying note added, no
   change to the fixture bytes themselves.

**F4-F6 from round 1** (the `gh`-unavailable Escalation Routes row reading against three
postures; `--strict` silently ignored outside `--ci-check` mode; step 2a's `--limit 10` window):
code-reviewer stood by these as non-blocking in both rounds and did not re-raise them in round 2.
**Disposition: concur — no QA action.** All three are documentation-coherence/observation-only
findings with no behavioral consequence and no test-coverage gap; none is a QA scope item (style/
architecture review is code-reviewer's, per the Hard rules), and code-reviewer already exercised
its judgment on all three across two rounds.

## Phase 4 — Run

**Crash checkpoint**: recorded via `tw_update_state` before the regression run (see state write
log; `bookkeeping_write=true` administrative note).

- **`npm run build`**: clean. `tsc` — zero compile errors. `check:version` — OK (3.115.1, parity
  confirmed across `dist/index.js` / `package-lock.json`). `check:transitions-sync` — OK (21 keys,
  exact match).
- **`npm test`** (post-retarget): **2234 tests / 2234 pass / 0 fail**, verified by execution (not
  attested) — see the stash/pop procedure under Phase 0.5 above, which independently confirmed
  both the pre-edit 4-fail state (exact name match to the manifest) and the post-edit fully-green
  state, in the same session, rather than trusting sr-engineer's/code-reviewer's prior counts.
- **CI Runnability**: `npm test` runs headlessly with zero human interaction (`node --test`, no
  prompts). Confirmed by direct execution above.
- **`--ci-check` surface, exercised live** (not merely read):
  - `node scripts/verify-release.mjs --ci-check --sha` (missing value) → `check:release — --sha
    requires a value (got null) — refusing to silently fall back to HEAD`, exit 1.
  - `node scripts/verify-release.mjs --ci-check --sha --strict` (flag-like next token) ->
    `check:release — --sha requires a value (got "--strict") — refusing to silently fall back to
    HEAD`, exit 1. Confirms F2's fix: no silent HEAD fallback in either failure shape.
  - Stubbed `gh` on `PATH` (exits 4, simulating an auth/rate-limit failure — same technique
    code-reviewer used in `review_T-E163-01.md`):
    - Lenient: `WARN: CI ground-truth — gh run list failed: ... ; continuing without CI
      verification (graceful degradation, E14)` then `OK: CI ground-truth` / `CI-CHECK PASSED`,
      exit 0.
    - `--strict`: `FAIL: CI ground-truth — gh run list failed: ... — refusing to proceed under the
      strict pre-tag gate ...` / `CI-CHECK FAILED`, exit 1.
  - Confirms the strictness asymmetry live: `--strict` converts a cannot-obtain-ground-truth path
    (here, a `gh` failure) into a FAIL, exactly as `content/skill-release-engineer.md` step 8b's
    prose and code-reviewer's round-1/round-2 tables claim.

**PASS.**

## Verdict

**PASS** — `T-E163-01` (implementation, code-reviewer APPROVED round 2) and `T-E163-03` (this QA
pass) both complete. All 4 expected-red entries retargeted/re-baselined with a stated, non-vacuous
guard rationale each; the stale render-structure fixture note added without weakening its
hermetic-provenance guarantee; all 4 non-blocking carried-forward items explicitly dispositioned
(1 recommended for a follow-up sr-engineer prose fix, routed rather than self-edited; 1 recommended
for a follow-up backlog ticket; 2 declined as non-actionable/already-settled); full suite green
(2234/2234), build clean, `--ci-check` surface exercised live in both the `--sha`-validation and
`--strict` WARN→FAIL directions. No version bump, no CHANGELOG edit, no `docs/backlog.md`
done-mark, no commit/tag/push performed by this session — release mechanics remain
release-engineer's, per the Hard rules.
## 2026-09-22T09:10:21.354Z — PASS — by qa-engineer

PASS. Retargeted all 4 expected-red assertions in test/release-staging.test.mjs (3 header-literal pins step 8 -> 8a, since all 3 guard the release commit not the tag push; 1 Escalation-Routes row-count/shape pin re-baselined 7->9 rows, asserting E163's 2 new rows are first and the E53 hazard row is still last) -- each still guards a real structural property, not loosened to vacuity. Added a clarifying STALE-BUT-CORRECT note to test/render-structure.test.mjs's frozen ffa4082 fixture (input, not a live assertion; left the byte-frozen excerpt strings untouched to preserve its provenance claim). Verified pre-edit red set (2234/2230/4, exact name match to the manifest) and post-edit green (2234/2234/0) myself via git stash/pop, not by trusting prior reports (E161). npm run build clean. Exercised --ci-check live: --sha with missing/flag-like value exits 1 (F2 confirmed); --strict converts a stubbed-gh failure into CI-CHECK FAILED/exit 1 while lenient still exits 0 (strictness asymmetry confirmed live). Dispositioned all 4 non-blocking carried-forward items (none are qa's file to fix): recommend routing the 8b unbounded-retry-loop prose fix to sr-engineer (content/skill-release-engineer.md, not mine to edit); recommend a follow-up backlog ticket for the pre-existing hardcoded --branch main; declined action on the mode-dependent CI-CHECK PASSED string (no present consumer); concur with code-reviewer's non-blocking F4-F6. Full detail: qa_reports/review_T-E163-03.md.

## 2026-09-22T09:10:52.127Z — PASS — by qa-engineer

PASS. Retargeted all 4 expected-red assertions in test/release-staging.test.mjs (3 header-literal pins step 8 -> 8a, since all 3 guard the release commit not the tag push; 1 Escalation-Routes row-count/shape pin re-baselined 7->9 rows, asserting E163's 2 new rows are first and the E53 hazard row is still last) -- each still guards a real structural property, not loosened to vacuity. Added a clarifying note to test/render-structure.test.mjs's frozen ffa4082 fixture (input, not a live assertion; left the byte-frozen excerpt strings untouched to preserve its provenance claim). Verified pre-edit red set (2234/2230/4, exact name match to the manifest) and post-edit green (2234/2234/0) myself via git stash/pop, not by trusting prior reports (E161). npm run build clean. Exercised --ci-check live: --sha with missing/flag-like value exits 1 (F2 confirmed); --strict converts a stubbed-gh failure into CI-CHECK FAILED/exit 1 while lenient still exits 0 (strictness asymmetry confirmed live). Dispositioned all 4 non-blocking carried-forward items (none are qa's file to fix): recommend routing the 8b unbounded-retry-loop prose fix to sr-engineer (content/skill-release-engineer.md, not mine to edit); recommend a follow-up backlog ticket for the pre-existing hardcoded --branch main; declined action on the mode-dependent CI-CHECK PASSED string (no present consumer); concur with code-reviewer's non-blocking F4-F6. Full detail: qa_reports/review_T-E163-03.md.

