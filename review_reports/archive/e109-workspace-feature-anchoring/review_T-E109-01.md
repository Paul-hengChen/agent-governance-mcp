# Review — T-E109-01

covers: T-E109-01

## Round 1 — APPROVED — by code-reviewer

## Summary
- Two single-line content edits, exactly as the contract scopes them: the E109 anchoring statement appended to `content/coord-03-core-fallback.md:9`'s existing Feature-Scope Gate paragraph, and the E146 rider rewrite of `content/skill-release-engineer.md:219`'s step 9a Check 1 prose.
- AC1, AC3, AC4, AC5, AC7 verified by independent re-derivation (not by trusting the writer's notes). AC2's zero-additional-files judgment independently re-checked and confirmed correct. AC6 is qa-owned and out of this round.
- The E146 prose was checked against `scripts/verify-release.mjs`'s actual post-E141 Check 1 implementation (`scripts/verify-release.mjs:159-252`), not against its own claims. It is accurate on all three load-bearing points.
- Three non-blocking findings recorded (N1 anchoring-rule vs E111 adjacency, N2 missing origin-tag wrap, N3 partial NOTE-line quote). None blocks; N1 is the one worth a coordinator decision.
- Verdict: APPROVED.

## Correctness

**AC1 — both halves present, normative, in the right paragraph. PASS.**
`content/coord-03-core-fallback.md:9`, appended to the existing Feature-Scope Gate paragraph (same paragraph, no new one — confirmed: the added text shares line 9 with the pre-existing E1 prose).
- Half (a): "every per-workspace governance mechanism — this feature lease, `hop_count`, the `review_round`/`qa_round` caps, `tw_detect_drift`, telemetry sidecars, evidence paths, and `cut_approved` — is anchored to `workspace_path`, scoped to that lane alone, and never spans workspaces." The mechanism list is element-for-element the spec AC1(a) list. Normative register ("is anchored to", "never").
- Half (b): "its overall plan — which lanes exist, their tickets, their dependencies — lives in a version-controlled backlog/spec artifact, never inferred from or reconciled across per-lane `.current/handoff.md` files."
- "do not restate it a second time inside the same file": confirmed — `grep -n "Anchoring rule\|anchored to\|never spans workspaces" content/coord-03-core-fallback.md` returns line 9 only.
- Verified the rule actually reaches the shipped artifact, not just the source fragment: `buildCoordinatorPrompt(cwd)` on the rebuilt `dist/` contains both halves (`never spans workspaces` → true, `never inferred from or reconciled across` → true). It is outside the file's only rationale fence (line 55), so `stripRationale` does not remove it from the default non-fullDetail compose.

**AC4 (E146) — prose matches the script's real behaviour. PASS.**
Checked clause by clause against `scripts/verify-release.mjs`:
- "passes on an exact tag==HEAD match" ⟶ `:188-191` `if (tagSha === headSha) return;`. Correct.
- "when the tag is an ancestor of HEAD" ⟶ `:196-205` `git merge-base --is-ancestor`, and a non-ancestor pushes `pointsAtHeadFail` and returns. Correct, including that ancestry is a *precondition*, not a substitute.
- "every commit in `<tag>..HEAD` touches only the governance-bookkeeping allowlist" ⟶ `:208-238`, `git rev-list ${tagSha}..${headSha}` then per-commit `diff-tree` against `BOOKKEEPING_PATH_RES` (`:165`). Range expression matches the prose exactly.
- "the allowlist step 13a already stages" ⟶ accurate and is a real single definition point: `content/skill-release-engineer.md:232` (step 13a) enumerates `.current/handoff.md`, `.current/*.jsonl`, `tasks.md`, which is exactly `BOOKKEEPING_PATH_RES`. The script's own comment at `:160-161` names step 13a as the source of truth, so the citation direction is correct.
- "a run that prints the `NOTE: ...` line is still a pass, not a degraded one" ⟶ `:250-253` the NOTE is a bare `console.log` on the success path with no `fails.push`. Correct — this is precisely the misdirection E146 was filed against, and it is cured.
- E82 (ii) compliance: `sed -n '219p' content/skill-release-engineer.md | grep -c '\.current/handoff\.md'` prints `0`. The allowlist is cited, never re-typed. PASS.
- No internal tension with the retained "ALL checks MUST pass": the tolerance is written as part of Check 1's *pass condition* ("either path is a genuine pass"), not as an exemption from the exit-0 requirement.

**AC3 — content-only. PASS.**
`git diff --stat HEAD -- lib/ tools/ schema/ guards/ gates/ prompts/ bin/ transport/ index.ts test/ scripts/ templates/` prints nothing. Full `git diff --stat` shows only `content/coord-03-core-fallback.md` (+1/-1), `content/skill-release-engineer.md` (+1/-1), and governance bookkeeping (`.current/handoff.md`, `.current/telemetry.jsonl`, `tasks.md`).

**AC5 — rationale fence intact and symmetric. PASS.**
`content/skill-release-engineer.md:220-222` is byte-unchanged in the diff (the hunk's context lines show it untouched). `rationale:start` count = 8, `rationale:end` count = 8. `node --test test/render-structure.test.mjs` → 15/15 pass, including the asymmetric-span sweep.

**AC7 — no done-mark. PASS.**
`git diff --stat HEAD -- docs/` prints nothing; `docs/backlog.md:231` (E109) and `:268` (E146) are untouched.

**Scope containment — PASS.** The added text designs and implies no fix shape for E112–E116 or E113's cross-lane roll-up. It contains no reference to drift reporting behaviour, hop-cap overshoot handling, cut-approval propagation, join verification, or ledger archival — it states only the framing those tickets were waiting on.

**N1 (non-blocking, recommend coordinator decision) — `content/coord-03-core-fallback.md:9` vs `:11`.**
The new rule asserts that *evidence paths* are "scoped to that lane alone, and never spans workspaces". The paragraph immediately following it is the E111 Worktree bootstrap obligation, which mandates the opposite at the storage layer: symlink `qa_reports/`, `review_reports/`, `specs/` in a worktree lane *back to primary*, precisely so a lane's evidence does not die with `git worktree remove`. Both are correct under the intended reading — E109 is about what the mechanism is *keyed to* (the server writes to `<workspace_path>/qa_reports/...`), E111 is about where that path *resolves* — but the two sentences are adjacent and the distinction is never stated, so a reader can take E109 as having superseded E111. That matters more than usual here: this sentence is the framing E112–E116 will be built on, and a future ticket could cite it to undo E111.
Not a defect in this implementation: the mechanism list including "evidence paths" is verbatim from spec AC1(a) and from the ratified 待決 #4 position, so sr-engineer had no discretion to drop it. Blocking on it would be rejecting the approved deliverable over a one-clause readability gap. Recommended follow-up (coordinator's call whether it earns a round now or a separate ticket): qualify the evidence-path clause to "anchored to `workspace_path` for keying — where those paths *resolve* is a separate concern, see the Worktree bootstrap obligation below".

## Quality

**N2 (non-blocking) — `content/coord-03-core-fallback.md:9`: missing `<!-- origin:start -->`/`<!-- origin:end -->` wrap on the `(E109)` provenance code.**
The new label ships as `**Anchoring rule** (E109):`. The established convention in this same fragment wraps the provenance so `stripOriginTags` removes it from every composed bundle — 5 of the 6 bold-label-plus-code constructs in this file do (`**Hop counter scope**<!-- origin:start --> (v3.67.0, D2)<!-- origin:end -->`, `**Worktree bootstrap obligation**<!-- origin:start --> (E111)<!-- origin:end -->`, `**Claim-vs-state mismatch**`, `**Known non-mismatches**`, `**Auto-tier writer action**`); the sole exception, `**Feature-Scope Gate** (E1)`, predates the convention. Verified empirically on the rebuilt bundle: the composed coordinator prompt contains the literal `(E109)` but not `(E111)`. Effect is small (~7 bytes shipped per compose) but it is free to fix, it is the exact cost class the origin-tag mechanism exists to remove, and it lands in the fragment whose context-budget floor is already over (see Notes to qa). Recommend wrapping.

**N3 (non-blocking) — `content/skill-release-engineer.md:219`: the quoted NOTE line is a prefix, not the full literal.**
Prose quotes ``NOTE: tag-at-HEAD — tolerated N governance-bookkeeping commit(s) ahead of tag vX.Y.Z``; the script (`scripts/verify-release.mjs:251-252`) also appends ` (<tagSha12>..<headSha12>)`. The quoted text is a correct and stable prefix, so a release-engineer matching on it will still recognise the line — no misdirection. Noting only because the surrounding sentence presents it as a quoted literal.

No other quality findings. Both edits match the register, sentence density, and citation style of the prose they extend; no dead text, no duplication, no convention drift beyond N2.

## Architecture
No `specs/e109-workspace-feature-anchoring-architecture.md` exists — correctly so for an L-CONTENT lane. Placement is architecturally right on both edits: the anchoring rule lands in the existing normative home of workspace/worktree semantics (the Feature-Scope Gate paragraph, which already routes the coordinator to a separate worktree) rather than creating a competing home, and the E146 correction lands inside the step it describes rather than in a note beside it. Layer boundaries respected: no server behaviour was changed to match the prose, consistent with the spec's Out of Scope ("Any change to `scripts/verify-release.mjs` itself"). The composition pipeline is unaffected — no manifest entry added, no fragment created or removed.

## Security
No findings. Neither edit introduces input crossing a trust boundary, and neither adds a secret, credential, path literal, or executable instruction. The E146 edit is the security-relevant one in principle, since it describes a release-integrity check — checked and clean: it does not weaken the described gate, invent a bypass, or tell the operator to proceed past a FAIL. It narrows a false belief (Check 1 is unconditional) into the true one, and the "ALL checks MUST pass / on ANY non-zero exit, STOP" instruction survives intact.

## Performance
No findings. Content-only diff with no runtime code path. The one measurable cost is composed-bundle size: the coordinator bundle's stripped design-arm measurement is now 18722 ~tok against an 18570 floor (+152). That overage is AC6's re-baseline and qa-engineer's to resolve; N2's origin-tag wrap would return ~7 bytes of it. No algorithmic or I/O change anywhere.

## Notes to qa-engineer (AC6, not findings against this diff)
- The two reds are exactly and only the expected pair: `test/context-budget.test.mjs` subtest 35 (18722 > 18570 floor) and `test/skill-manifest.test.mjs` subtest 4 (golden byte-identity). Every other compose/structure test in the sweep is green, including `test/render-structure.test.mjs` 15/15. Nothing else is red, so the re-baseline is not masking a second regression.
- **Caution on the spec's rationale-fence suggestion**: the Dependencies section asks qa to try wrapping the new prose in a `<!-- rationale:start -->/<!-- rationale:end -->` fence before raising the cap a third time. Do NOT do that for the E109 anchoring rule — it is normative, and fences are stripped from the default compose. Verified on the rebuilt bundle: `content/coord-03-core-fallback.md:55`'s fenced sentence is absent from `buildCoordinatorPrompt()`'s output. Fencing the rule would delete the ticket's entire deliverable from exactly the stripped bundle the failing floor measures — a green test measuring an empty rule.

## Model-bias note
sr-engineer ran pinned to `fable`; this review ran on `opus`. Different model, so the SOP's same-model-blind-spot caveat does not apply. Every AC was re-derived from the diff, the spec, and `scripts/verify-release.mjs` directly; the writer's `pending_notes` reasoning was not used as evidence for any PASS above.

## Verdict
APPROVED — both edits satisfy AC1, AC3, AC4, AC5 and AC7 on independent verification, AC2's zero-additional-files judgment is recorded and independently confirmed correct, and the three findings (N1 E111 adjacency, N2 origin-tag wrap, N3 partial NOTE quote) are all non-blocking prose refinements rather than contract failures.
