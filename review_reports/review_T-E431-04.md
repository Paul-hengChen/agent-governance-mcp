# Review — T-E431-04

covers: T-E431-04

Rounds 1 and 2 for T-E431-01..T-E431-06 are in `review_reports/review_T-E431-01.md`. This file holds the review rounds for the T-E431-04 fix that followed the qa FAIL on AC11 (qa_round 1). It continues that file's round numbering, so it starts at Round 3.

## Round 3 — CHANGES_REQUESTED — by code-reviewer

Reviewer model: opus (sr-engineer also ran on opus, so the same blind spots are possible). Scope: fix commit `0acbc85` (`git diff 8ca3345..0acbc85`). It touches `tools/handoff-orchestrator.ts` and `dist/` only. I did not use the sr's numbers. Every behaviour check below was rerun against fresh `tsc` builds of `0efc203` (base) and `0acbc85`. Both builds were extracted with `git archive` into the scratchpad, with `node_modules` symlinked.

## Summary
- New `exitChainPath(prev, prevChainPath, featureChanged, nextChainPath?)` at tools/handoff-orchestrator.ts:243-259. On the same feature it returns the persisted marker, as before. On a feature change it returns the previous marker only when the previous tuple is `code-reviewer:PASS` and the write carries no `chain_path`. It is used in two places: the TRANSITION_VALIDATION `validateTransition` call (:303-305) and the `effectiveAllowedSuccessors` lookahead (:1317). `resolveChainPath`, the persistence path, the build-entry predicates, the judge peek and transitions.ts are unchanged.
- Behaviour is correct. AC11 now holds on a feature change for all four exits. The new feature starts unmarked. The previous marker reaches nothing except the exits out of `code-reviewer:PASS`. The old path is unchanged apart from the sanctioned AC9 hint. `dist/` (including the `.map` files) is byte-identical to a fresh build of `0acbc85`.
- The fix changes a rule that the durable mirror doc states. `specs/qa-flow-enforcement-architecture.md:225` still says a write is evaluated as marked only on its own feature's persisted marker or on an incoming set-point marker. That is now false for the `code-reviewer:PASS` exits on a feature change, which is exactly the case qa failed. So AC19's "mirrors the marker-gated edges" regresses to partial.
- Full suite (`node scripts/test-lock.mjs -- npm test`): 4429 tests, 4425 pass, 2 fail, 2 skipped. The 2 reds are the known cross-lane pair: `test/e295-hop-cap-and-sop-halves.test.mjs:122` AC11 and `test/visual-evidence-gate.test.mjs:610` AC-4. `test/e431-test-first-server-path.test.mjs`: 38/38.
- Verdict: CHANGES_REQUESTED, on one required documentation finding. No code change is requested.

## AC Completeness
AC1-AC10, AC12-AC18, AC20 — implemented. The round-1/2 evidence in `review_reports/review_T-E431-01.md` stands. `0acbc85` changes none of their code paths except the marker input to `validateTransition` on a feature change, which was rechecked below.
AC11 — implemented — tools/handoff-orchestrator.ts:250-259, :303-305. Handler run (zod + orchestrator) from a marked `code-reviewer:PASS` (seed `sr_return_count: 2`, `hop_count: 9`), with a write that opens `new-feat` and carries no `chain_path`: pm, researcher, release-engineer and design-auditor `In_Progress` are each accepted. The new state has `active_feature: new-feat`, no `chain_path`, no `sr_return_count` and `hop_count: 1`. The unmarked half is unchanged: an unmarked code-reviewer PASS is still rejected with the refine text. Negative control: in a copy of the build, forcing `exitChainPath` to return `undefined` on a feature change turns exactly the 4 handler feature-change AC11 tests red.
AC19 — partial — specs/qa-flow-enforcement-architecture.md:225 (see Correctness finding 1).

## Correctness
1. **required — the mirror doc no longer states the marker rule the code applies (AC19).** specs/qa-flow-enforcement-architecture.md:225 says: "A write is evaluated as marked when the persisted handoff of the same feature already carries the marker, or when the incoming write carries it at a set point. … An `active_feature` change drops it, so the new feature starts unmarked unless its own opening pm write carries it." After `0acbc85`, a feature-opening write out of a marked `code-reviewer:PASS` that carries no `chain_path` is evaluated against the previous feature's marker. Measured: `validateTransition` sees `marked = true` and the overlay's `code-reviewer:PASS` exits accept it. Neither condition in the doc holds, so a reader following the doc predicts the very rejection qa failed in round 1. transitions.ts:365 says the overlay is "Mirrored in specs/qa-flow-enforcement-architecture.md", and AC19 requires that mirror. Fix: amend that paragraph, and if useful the `code-reviewer:PASS` sentence at :205, to name the exception. For example: "On an `active_feature` change the write out of `code-reviewer:PASS` that carries no `chain_path` is judged against the previous feature's marker, so the four exits stay open; nothing carries to the new feature." Docs only, no AC text touched. The integrator's no-AC-edit ruling is respected.

Checks run with no finding:
- (1) AC11 feature change — accepted for all four roles (AC11 above). The test-file cases `AC11: feature change from marked code-reviewer:PASS accepted via handler for <role>` pass.
- (2) New feature unmarked and counters reset — all 97 feature-change writes accepted from a marked seed (32 prev tuples × 8 agents × {In_Progress, Blocked, FAIL} × `chain_path` {absent, test-first}): 0 carry `chain_path` (unless the write is a pm write with its own marker) and 0 carry `sr_return_count`. `hop_count` and the `*_rounds_total` counters restart from 0. `qa_round` / `review_round` carry across a feature change, exactly as base does: `computeNewRound` resets them only on their cycle close or on `pm:In_Progress`. On a real marked `code-reviewer:PASS`, `review_round` is already 0 and `qa_round` cannot have ticked, because the overlay closes `qa-engineer:FAIL`. A follow-on run (marked cr:PASS → pm `new` → … → sr → qa return) restarts `sr_return_count` at 1.
- (3) No leak into other checks — marked seed vs unmarked seed, same grid, through the handler: 1536 pairs, 1512 identical in outcome, text and new state. All 24 differences are prev `code-reviewer:PASS` with no `chain_path`: the 4 exits are accepted (they were rejected on the unmarked seed), and the 20 others are still rejected but list the 4 exits in `allowed`. With `chain_path: "test-first"` on the write, marked == unmarked on all 768 pairs, because `exitChainPath` returns `undefined` then.
  - sr-return cap: step 2.6 needs `!feature_changed` and prev `sr-engineer:In_Progress`, so it is untouched.
  - AC10/D5: a pm write opening a new feature from `code-reviewer:PASS` with `chain_path: "test-first"` is accepted, and the new feature persists `chain_path: test-first` with no `sr_return_count`. This is D5 (i), "the new feature's own opening pm write may carry the marker". researcher, release-engineer, design-auditor, architect, sr, cr and qa writes carrying the marker there are rejected `TRANSITION_REJECTED` at step 1.5 with the state unchanged. This is D5 "anywhere else is rejected", and it gives the same result as base-equivalent unmarked input.
  - Build-entry arming and the judge use `resolveChainPath` / the persisted-marker peek, both unchanged. After an unmarked pm opening from marked cr:PASS, pm → qa-engineer without a marker is rejected `TRANSITION_REJECTED` (old path), pm → sr is accepted, and a code-reviewer PASS on the new feature gets the refine `ZodError` (qa-engineer judge).
- (4) Old-path invariance —
  - `validateTransition` grid vs base: 342,144 unmarked requests (33 prev × 36 next × qa {0,3,4} × review {0,3,4} × visual {0,6} × hop {0,14} × feature_changed × resume_of {absent, next.agent} × sr_return {0,2}). 342,120 are deep-equal and 24 differ only by the AC9 suffix, all on `pm:In_Progress → qa-engineer:In_Progress` with resume_of absent. 24 is exact: qa {0,3} × review {0,3} × visual {0} × (hop 0 × both feature_changed values + hop 14 × feature_changed) × sr_return {0,2} = 2·2·1·3·2. Every other point hits a cap override first, or opens the resume edge.
  - Reconciling my round-1 "40": that harness script was not kept, so I cannot replay it. The 40 does not follow from the axes it reported, which are the axes above. Under those axes the count is 24 analytically and by measurement, so the round-1 figure was a miscount. Widening resume_of to {absent, next.agent, "code-reviewer", "qa-engineer"} gives 48 of 684,288. The extra 24 are `resume_of: "code-reviewer"` on the same edge. Both counts are on one edge only, so the sanctioned delta set is the same either way.
  - Unmarked feature-change handler replay, base vs head: 32 prev × 8 agents × {In_Progress, Blocked, FAIL} × next_role {none, pm} = 1,536 writes from a stale seed, 138 accepted. 1,534 are identical in outcome, text and state. 2 differ only by the AC9 hint suffix (`pm:In_Progress → qa-engineer:In_Progress`, next_role none/pm) and have identical state.
- Lookahead: the only caller-visible change is that, at hop cap, a marked `code-reviewer:PASS` with `next_role: researcher` (or release-engineer / design-auditor) no longer gets a "not a legal successor" advisory. The feature-change branch now opens those exits, which matches how `qa-engineer:PASS` behaves on the old path. Measured at hop 14 and hop 3: accepted, no warning.

## Quality
- **recommended** — no test pins the `nextChainPath === undefined` guard (tools/handoff-orchestrator.ts:258). Mutating it to `fromReviewerPass ? prevChainPath : undefined` leaves all 38 e431 tests passing. The only reds were 2 that need `specs/`, which my copy lacked. Under that mutation, a researcher opening a new feature from marked `code-reviewer:PASS` with `chain_path: "test-first"` would be accepted silently with the marker dropped, instead of being rejected per D5. This is qa-scope: one handler case beside the existing AC11 feature-change cases would pin it.
- **recommended** — the lane blueprint still prescribes the old wiring: specs/e431-test-first-server-path-architecture.md:167 ("the orchestrator passes `prev_chain_path: undefined` when `feature_changed`"), :185, :311 and :322. A one-line amendment note there would keep blueprint and code consistent. The justification itself (AC11, qa FAIL round 1) is sound and is recorded in the code comment.
- **optional** — a non-pm feature-opening write from marked `code-reviewer:PASS` that carries the marker is rejected with `allowed: []` (the unmarked successor list of `code-reviewer:PASS`). The hint's remedy, "Omit chain_path", is right, but the empty list understates the four exits that the same write without the marker would take. This is pre-existing and was not introduced by `0acbc85`.
- Comment discipline: the new block comment (:243-249) is 7 lines, at the limit. It states the invariant ("only opens those exits", nothing carries) without restating the code. The two call-site comment edits are accurate. `agc check — comments` reports no warning on the diff's lines; the one orchestrator warning (:1522) predates this diff.
- Typing: `TransitionTuple` / `ChainPath` / optional `ChainPath`. No `any`, no casts.

## Architecture
The implementation deviates from the blueprint (architecture :167/:311/:322: "undefined on feature change"). The deviation is justified: under the blueprint, AC11 was unmet for the normal post-PASS flow, a new feature (qa FAIL round 1). The change is confined to the orchestrator's input to `validateTransition` and adds no transitions.ts surface, so the overlay stays the only place that defines edges. The fix is the narrowest one: it opens only edges that exist solely in the overlay's `code-reviewer:PASS` key, and that key closes none. SQLite mode is unchanged: `fileMode ? … : undefined`, and the lookahead `chainPath` is always undefined there.

## Security
No findings. No new input crosses a trust boundary. `chain_path` is still zod-enum-limited, and a client cannot use a feature change to smuggle a marker into a new feature: an incoming marker disables the previous-marker pass-through, so step 1.5 still applies.

## Performance
No findings. The helper is O(1) and is called once per write and 64× per lookahead, the same call count as before.

## Verdict
CHANGES_REQUESTED — the code fix is correct and leak-free, but it makes `specs/qa-flow-enforcement-architecture.md:225` misstate the marker rule. That page is the AC19 mirror, so it needs a docs-only amendment, with no code or AC change.

## Round 3 — sr-engineer reply — by sr-engineer

(Written by sr-engineer in 23f8a0e. Kept as their reply; it is not part of any code-reviewer verdict. The code-reviewer moved it from an H3 under Round 3's Verdict to its own H2.)

- Required (1), addressed: `specs/qa-flow-enforcement-architecture.md` *Set-point rule* now names the feature-change exception (a write out of `code-reviewer:PASS` with no `chain_path` is evaluated against the previous feature's marker, so the four exits stay open; nothing is persisted for the new feature). The `code-reviewer:PASS` sentence under *Opened on a test-first feature* points to it. Tables and the matrix section are unchanged; `check:transitions-sync` OK.
- Recommended (blueprint), addressed: `specs/e431-test-first-server-path-architecture.md` *Feature change* bullet, the `prev_chain_path` field comment, the TRANSITION_VALIDATION bullet and the lookahead comment now describe `exitChainPath`. Lane spec and AC text untouched.
- Recommended (guard test): left to qa-engineer per routing. No code or test change in this round.

## Round 4 — APPROVED — by code-reviewer

Reviewer model: opus (sr-engineer also on opus). Scope: docs fix `23f8a0e` (`git diff dc70f4c..23f8a0e`). Outside `.current/e431/` and this report, it touches only `specs/qa-flow-enforcement-architecture.md` and `specs/e431-test-first-server-path-architecture.md`.

### Summary
- Round 3's required finding is fixed. The *Set-point rule* in `specs/qa-flow-enforcement-architecture.md` (:225) now states the feature-change exception. A write out of `code-reviewer:PASS` with no `chain_path` is judged against the previous feature's marker. That opens the four exits, and nothing is persisted for the new feature. The note under the *Opened* table (:205) points to that rule.
- The recommended blueprint fixes in `specs/e431-test-first-server-path-architecture.md` (:167, :185, :311, :322) now describe `exitChainPath` as the code implements it.
- No code, test, `dist/` or AC text change. `specs/e431-test-first-server-path.md` is not in the diff.
- Verdict: APPROVED.

### AC Completeness
Unchanged from Round 3 (AC11 implemented in `0acbc85`). This round is docs only. The AC19 mirror (`specs/qa-flow-enforcement-architecture.md`) now matches the code again.

### Correctness
No findings. I checked the wording against `exitChainPath` at tools/handoff-orchestrator.ts:250-259:
- Same feature: returns the persisted marker. The docs say "persisted handoff of the same feature".
- Feature change out of `code-reviewer:PASS` with `nextChainPath === undefined`: returns the previous marker. The docs say the exception applies only to a write that "carries no `chain_path`".
- Every other feature change returns `undefined`. The docs say the change "drops it", and the exception "carries nothing".
- The blueprint call shapes match the two call sites: TRANSITION_VALIDATION :303-305, with `parsed.chain_path` as the 4th argument, and the lookahead :1317, with three arguments and no `next_chain_path`.
- `npm run build` exits 0, and `check:transitions-sync` is OK (21 keys). The tables and the matrix are unchanged.

### Quality
No findings. The wording is consistent across both specs. One note on this file: sr-engineer's Round 3 reply had been appended as an H3 under the Round 3 Verdict. I moved it to its own attributed H2 so that the verdict sections hold only code-reviewer text.

### Architecture
No findings. The blueprint now records the qa-FAIL-round-1 amendment instead of the pre-fix `feature_changed ? undefined : ...` wiring.

### Security
No findings. Information hygiene: the diff has no personal names, credentials, hostnames or private paths. Neither file is under `content/**`, so the adopter-portability rule does not apply.

### Performance
No findings. Docs only.

### Verdict
APPROVED — the docs-only fix restores agreement between the AC19 mirror and `exitChainPath`, and changes no code, tests or AC text. Round 3's recommended guard test (a write carrying `chain_path` out of `code-reviewer:PASS` on a feature change ignores the old marker) is still recommended, for qa-engineer.
