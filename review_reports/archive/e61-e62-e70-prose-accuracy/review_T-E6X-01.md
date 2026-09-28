# Review — T-E6X-01

covers: T-E6X-01, T-E6X-02

## Round 1 — CHANGES_REQUESTED — by code-reviewer

## Summary
- Batched review of both tasks in feature `e61-e62-e70-prose-accuracy`. 10 cut files modified, plus `dist/tools/handoff-orchestrator.js{,.map}` from the required build and the two governance files. Zero `test/` edits. Tree matches the cut exactly.
- Independently re-verified: `npm test` **1759/1759, exit 0**; `npx tsc --noEmit` clean; `agc check — OK (3.104.1)`; `GATE_REGISTRY` **33** entries live (`Object.keys` on the compiled registry) against `33` asserted at `CONTRIBUTING.md:21`, `CONTRIBUTING.md:63`, `docs/architecture.md:112`, with no `32` surviving in live prose; acceptance grep `transitions.ts:[0-9]` over `tools/` + the 3 named specs returns **empty (exit 1)**; residual repo-wide hits are confined to dated records and exactly the 6 historical specs the cut excludes per E56; dist carries the new comment text (source/dist parity).
- All four `transitions.ts:N` conversions are semantically **accurate** — I read `tools/transitions.ts:443-530` and `:601-690` and confirmed the three round caps, the hop-cap override, and the self-loop fast path all live inside `validateTransition`, that each round cap does `if (ok) return null` for `(pm, In_Progress)` unconditionally, and that the hop-cap override alone reads `!req.feature_changed`. The old line cites were all genuinely stale, so E62's premise holds.
- Two blocking findings, both single-line, both in the E62 half: an anchor rewrite that asserts a branch which does not exist and cross-references a comment that refutes its own sentence (C1); and a stale line-number self-citation left inside the very comment block the diff rewrote, which the diff's own new policy bullet forbids (C2).
- The three items flagged for judgement: N7 scope **accepted**, the 4th orchestrator citation **in-cut**, the CONTRIBUTING policy bullet **resolves N8**. Details under Architecture.
- Verdict: CHANGES_REQUESTED.

## Correctness

**C1 (blocking) — `specs/e1-feature-scoped-state-design.md:26-27`: the new anchor names a branch that does not exist, and points the reader at a comment that contradicts the sentence.**

The rewrite reads:

```
- **All counters are single-feature-scoped.** `hop_count`, `qa_round`,
  `review_round`, `visual_round` all reset on `active_feature` change
  (the feature-changed reset branch of `computeNewRound`, `tools/transitions.ts`;
  see also the `HOP_CAP` const's own doc comment in the same file).
```

Both halves of the new parenthetical are wrong:

1. `computeNewRound` (`tools/transitions.ts:601-690`) has **no `feature_changed` term for `qa_round`, `review_round`, or `visual_round`**. `feature_changed` appears only in `const hopBase = feature_changed ? 0 : prev_hop_count;` and in the three `*Base` lines for the `*_rounds_total` mirrors. The three per-cycle counters reset only on `qa-engineer:PASS`, on the `code-reviewer:In_Progress → qa-engineer:In_Progress` edge (`review_round`), and on `(pm, In_Progress)`. Nor are they zeroed upstream: `tools/handoff-orchestrator.ts:1380-1382` reads them straight off `prevState` with `?? 0` and no feature-change branch. So the cited "feature-changed reset branch" exists for exactly 1 of the 4 counters the sentence enumerates.
2. The `HOP_CAP` doc comment the rewrite sends the reader to (`tools/transitions.ts:382-387`) says the **opposite** of the sentence it is offered as support for: *"Unlike the three round caps above, hop_count is feature-scoped: it resets ONLY on active_feature change, never on PM re-entry (DR-6)."*

The pre-existing stale line range (`:519-527`) was a vague pointer; the rewrite upgrades it into a confident structural claim that is false, and adds a cross-reference that refutes the surrounding prose. In a ticket whose entire subject is prose accuracy, that is a regression, not a fix — it is the precise failure mode E62 exists to remove.

Recommended fix (one bullet, no new facts needed): state the actual split — `hop_count` and the three `*_rounds_total` mirrors reset on `active_feature` change via `computeNewRound`'s `feature_changed ? 0 : prev` bases, while `qa_round` / `review_round` / `visual_round` carry no `feature_changed` term and are instead zeroed by the `(pm, In_Progress)` branch (the write that in practice opens a new feature). If sr judges that correcting the *substance* of this bullet exceeds E62's citation-form cut, the minimum acceptable outcome is to drop the "feature-changed reset branch" assertion and the `HOP_CAP` cross-reference, and hand the substantive defect back as a note — but shipping the false anchor as written is not acceptable either way.

**C2 (blocking) — `tools/handoff-orchestrator.ts:1318`: a stale line-number self-citation left inside the rewritten comment block, in violation of the policy bullet this same diff adds.**

Line 1318 still reads:

```
//       hop-cap-cross sentinel at :1441-1444 already covers that writer)
```

The hop-cap-cross sentinel actually lives at `tools/handoff-orchestrator.ts:1502-1517` (`if (new_hop_count >= HOP_CAP_EXPORTED && prev_hop_count < HOP_CAP_EXPORTED)`). This cite was **already ~60 lines stale at base** — at `HEAD`, lines 1441-1444 were four arguments of the `computeNewRound` call/ctx literal (`prev_hop_count, feature_changed, evidenceSchemaPin, evidenceSchemaLabel`) — and the diff's net `+1` in the preceding hunk shifted it one line further off.

This is the same file, the same comment block, and the same defect class the task fixes; it escapes the acceptance grep only because the pattern is `transitions\.ts:[0-9]` and this is a bare same-file `:N`. Leaving it stale while the same commit adds `CONTRIBUTING.md`'s line-number-citation bullet makes the ticket self-undermining: the diff ships the policy and a live violation of it in the block it edited. Fix is one line — replace `:1441-1444` with the symbolic anchor (e.g. "the hop-cap-cross sentinel below, guarded by `new_hop_count >= HOP_CAP_EXPORTED && prev_hop_count < HOP_CAP_EXPORTED`").

**No other correctness findings.** Every remaining factual assertion I could check, I checked:

- `tools/handoff-orchestrator.ts:1305-1307` "round-cap overrides in validateTransition … each returns null for (pm,In_Progress) unconditionally" — matches `transitions.ts:456-491` (`if (ok) return null` in all three).
- `:1309-1310` "the hop-cap override in the same function is DIFFERENT: it reads feature_changed" — matches `transitions.ts:505-518` (`!req.feature_changed &&`).
- `:1715-1717` "self-loop fast path in validateTransition" — matches `transitions.ts:520-528`.
- `specs/e1-…:219-221` — both cited `ALLOWED_TRANSITIONS` entries exist: `qa-engineer:PASS → release-engineer:In_Progress` at `transitions.ts:318`, `release-engineer:In_Progress → pm:In_Progress` at `:335`.
- `specs/e8-…:91-92` "the per-cycle counters' own FAIL branches in computeNewRound" — matches; the `*_total` predicates are copied verbatim from the per-cycle FAIL branches.
- `specs/qa-visual-consolidation.md` S19 — `.trim().startsWith("visual_fail:")` is in `computeNewRound`, confirmed. S20 — `VISUAL_ROUND_CAP = 6` const plus its override in `validateTransition`, confirmed.
- `CONTRIBUTING.md`'s `npm audit` rewrite and `docs/dependency-advisories.md`'s preamble — both match Constitution §6 verbatim (`content/const-15-core-tail.md:11`: "every role that calls `npm run build` … MUST also run the language's audit command", "An inline rationale in a PR/commit description is NOT a waiver, at any role"), and `skill-release-engineer.md` step 6a does exist as the named release-engineer instance.
- N3 (`skill-doc-writer.md:33`) — `grep -c '^####' README.md` = **0**. The claim is true; deleting the fictitious release-notes-subsection instruction is correct.
- R2-3 (`skill-release-engineer.md:53`) — `grep -c '#v[0-9]' README.md` = **3**, so the dropped count was accurate-but-decorative. Dropping it is right: the instruction "replace all `#v<old>` pins" is already exhaustive, so the count carried no information and only drift risk.
- N4 (`skill-release-engineer.md:201`) — the no-trailer fallback closes a real gap (the prior text said "defer to your harness" with no branch for a harness that prescribes nothing) and does not contradict the surrounding E67d note.
- 4a (Expected-Red Sampling) does **not** arm: the diff touches zero test files and the suite is fully green, so no intentional reds exist and no `qa_reports/expected-red_*.txt` is required.

## Quality

**Q1 (non-blocking, fold into the C1/C2 round) — `specs/e1-feature-scoped-state-design.md:221` breaks the file's wrap convention.** The rewritten line is 131 characters in a file hard-wrapped at 79-82 (neighbours: 82, 59, 79, 79, 49, 79, 79, 81). Re-wrap to match.

**Q2 (non-blocking, informational for the next E62 slice) — bare `:N` citations of the same class survive in files this diff edited.** Named so QA and the follow-up ticket have the inventory, not as a scope demand — the cut was explicitly `transitions.ts`-citation-scoped and the acceptance criterion is satisfied. In `specs/e1-feature-scoped-state-design.md` alone, the paragraph immediately around the C1 site still carries `tools/handoff.ts:181-183`, `:712`, `tools/storage-sqlite.ts:58`, `:84`, `guards/session.ts:21`, `markStateRead, :31-55`, `verifyFreshness, guards/session.ts:111-128`, `tools/storage-sqlite.ts:246-253`. `tools/transitions.ts:338` cites `content/skill-release-engineer.md` as `(:152-157)`. `specs/qa-visual-consolidation.md` S16-S18 still cite `tools/evidence-file.ts:603` / `:606` / `:616-627` / `:464-483`. C2 is called out separately and *is* blocking because it sits inside the block this diff rewrote and was made worse by it; these are untouched neighbours.

**Q3 (non-blocking) — the new `CONTRIBUTING.md` bullet gives no artifact-class guidance.** Its carve-out is framed purely by the citation's *function*, which is the right axis (see Architecture A3), but a future reader has no textual basis for the E56 convention that dated records (`CHANGELOG.md`, `review_reports/`, `qa_reports/`, backlog forensics rows) are exempt as a class. "a forensics note pinning the exact line a bug lived on" gets most of the way there by example. Adequate as shipped; worth one clause if a later slice touches the bullet.

No dead code, no duplication, no naming issues. The `docs/dependency-advisories.md` change correctly inverts the pointer direction (Constitution §6 as the binding source, the skill as one instance) rather than leaving the record claiming the release-engineer SOP is what routes callers to it.

## Architecture

No `specs/e61-e62-e70-prose-accuracy.md` and no architecture spec exist — this is a backlog-row-as-spec mini-chain, and per `scope_decision_why` the authoritative contract is the `T-E6X-01` / `T-E6X-02` rows in `tasks.md`, not `docs/backlog.md`. I reviewed against those rows and the cut in `scope_decision_why`. Zero behaviour, schema, or gate change; documentation and comments only; the sole non-`.md` file changes are comment text, confirmed by `npx tsc --noEmit` clean and a green suite. Layering untouched.

**A1 — `specs/qa-flow-enforcement-architecture.md:147` (N7): in scope, not over-reach. Accept.**

A literal two-word swap to "Derived mirror." would have told the reader the table is *not* authoritative while leaving them no way to find what is — which is the actual harm N7 identifies, and the harm that already materialised once: the footnote at `:173` records that this table silently carried 4 wrong and 5 missing rows after v3.9.0 (`7e81cf7`) changed the source, precisely because a reader trusted the "Authoritative source" label. The rewrite adds **zero new facts** — both the real source (`ALLOWED_TRANSITIONS` in `tools/transitions.ts`) and the mirror footnote were already in this file at `:173`, along with the `scripts/check-transitions-sync.mjs` pin — and touches exactly one line. This is the minimum edit that actually discharges N7.

**A2 — the 4th `transitions.ts:N` conversion in `tools/handoff-orchestrator.ts`: in cut. Accept.**

The cut says "3 comments", and the diff touches exactly **3 comment blocks** (`~1301`, `~1712`, `~1730`); the first happens to contain two citations. So on the cut's own unit of counting nothing was exceeded. Independently, the acceptance criterion is that `grep -rn 'transitions\.ts:[0-9]'` over `tools/` returns **empty** — leaving the 4th would have failed acceptance outright, so converting it was mandatory, not discretionary. Same file, same class, same required end state, and I verified the 4th cite (`transitions.ts:417-422` for the hop-cap override, now at `:505-518`) was as stale as the other three. Correct call.

**A3 — the `CONTRIBUTING.md` citation-convention bullet: it resolves the N8 tension. Accept.**

N8's tension is that precise line cites are the legitimate output of adversarial review, so a blanket "don't use line numbers" rule would forbid the project's own most valuable artifact class. The bullet does not restate the problem — it draws the line on the correct axis, the citation's **function**:

- Default is anchor form, but explicitly scoped: *"wherever prose merely points at a concept"*. That is the reader-pointing half, and the scoping clause is what keeps the rule from swallowing everything.
- The carve-out is *"load-bearing for a reviewer verifying a specific claim (e.g. a forensics note pinning the exact line a bug lived on)"*. That is the adversarial-review half, stated as a test a reader can actually apply, with a discriminating example.
- It adds a maintenance rule — *"re-verify it at the next review of that paragraph rather than trusting it indefinitely"* — which is what makes the carve-out safe rather than a loophole, since the failure mode is trusting an old cite, not writing a fresh one.

Since the whole option-(ii) choice rests on this bullet, I state the judgement plainly: as worded it is load-bearing and sufficient. See Q3 for one optional sharpening, which does not affect this verdict. What the bullet does *not* survive is C2 — shipping the policy in the same commit as an uncorrected violation of it, inside the block the commit rewrote, is the one thing that would make the bullet dead on arrival. Fix C2 and the policy half lands clean.

## Security
No findings. No executable code changed — the `tools/handoff-orchestrator.ts` diff is entirely comment text (verified: `npx tsc --noEmit` clean, suite 1759/1759 green, `dist/` rebuilt in parity). No new input crosses a trust boundary, no secrets, no change to any gate predicate, error code, or `ALLOWED_TRANSITIONS` entry. The `content/skill-*.md` edits preserve rationale-fence parity exactly (`skill-release-engineer.md`: 4 `rationale:start` / 4 `rationale:end` before and after; `skill-doc-writer.md`: 0/0), so the E51 render-strip parity surface is untouched.

## Performance
No findings, and none possible: zero executable statements changed. No allocation, loop, or I/O difference; `effectiveAllowedSuccessors` remains the same 64 in-memory calls with no I/O described by its own header. No algorithmic regression vs base.

## Verdict
CHANGES_REQUESTED — two single-line fixes in the E62 half: `specs/e1-feature-scoped-state-design.md:26-27` asserts a `computeNewRound` "feature-changed reset branch" that exists for only 1 of the 4 counters it names and cross-references a `HOP_CAP` comment that contradicts the sentence (C1), and `tools/handoff-orchestrator.ts:1318` leaves a `:1441-1444` self-cite that was already ~60 lines stale and that this diff shifted further, violating the citation policy the same diff introduces (C2). Everything else — all 10 cut files, all four `transitions.ts` conversions, the N7 wording, the N8 policy bullet, N3/N4/R2-3, and the independently re-verified 1759/1759 suite, `agc check`, live `GATE_REGISTRY` count of 33, and empty acceptance grep — is correct as shipped.

## Model-Bias Note
Reviewed on `opus`; sr-engineer was pinned to `fable` per `dispatch_pins`. Different model than the writer, so no same-model blind-spot concern. All citation targets in this review were re-derived from source (`tools/transitions.ts`, `tools/handoff-orchestrator.ts`, `content/const-15-core-tail.md`, `README.md`, live `GATE_REGISTRY`) rather than taken from the diff's own claims; the `npm test 1759/1759` result was reproduced independently (exit 0).

## Round 1 reply — by sr-engineer

- **C1 fixed by rewriting the substance (took the "fix the claim" branch, not the "drop + note" branch).** `specs/e1-feature-scoped-state-design.md:25-32` now reads: `hop_count` and its `*_rounds_total` mirrors reset via `computeNewRound`'s `feature_changed ? 0 : prev` base (matching the `HOP_CAP` doc comment, which the bullet still cross-references — now correctly, since it only speaks to `hop_count`); `qa_round`/`review_round`/`visual_round` carry no `feature_changed` term and are zeroed instead by the `(pm, In_Progress)` branch in the same function. Chose this over dropping the assertion because the correction needed zero new facts beyond what the reviewer's own C1 note and the existing `HOP_CAP` comment already supplied, the file is already in the T-E6X-02 cut for this exact anchor, and leaving a bare "no such branch exists" note would ship a known-false claim one more round rather than fixing it now. Re-verified against `tools/transitions.ts:601-690` (`computeNewRound`) and `:382-394` (`HOP_CAP` comment) before writing the new text.
- **C2 fixed.** `tools/handoff-orchestrator.ts:1317-1320` now points at the sentinel symbolically — "the hop-cap-cross sentinel below, guarded by `new_hop_count >= HOP_CAP_EXPORTED && prev_hop_count < HOP_CAP_EXPORTED`" — instead of the stale `:1441-1444` line range. Confirmed the guard text is a verbatim match of the live condition at `tools/handoff-orchestrator.ts:1511`.
- **Q1 fixed.** `specs/e1-feature-scoped-state-design.md:221` (now `:225`, shifted by the C1 bullet's +4 lines) re-wrapped from 131 chars to 4 lines of 71-82 chars, matching the file's neighbouring wrap width.
- Re-ran the full acceptance surface after both fixes: `npx tsc --noEmit` clean; `npm run build` clean (dist rebuilt, `check:version` + `check:transitions-sync` both OK); `npm test` **1759/1759, exit 0**; `grep -rn 'transitions\.ts:[0-9]'` over `tools/` + the 3 named specs — empty; `grep -n ':1441-1444' tools/handoff-orchestrator.ts` — empty; `33` still asserted at `CONTRIBUTING.md:21`, `:63`, `docs/architecture.md:112`; `agc check` — OK (3.104.1).
- No other files touched. Diff stays inside the 10-file cut (+ `dist/tools/handoff-orchestrator.js{,.map}` rebuild + the two governance files). Zero `test/` edits.

---

## Round 2 — APPROVED — by code-reviewer

## Summary
- Delta-only round. Scope reviewed: `specs/e1-feature-scoped-state-design.md` (C1 + Q1) and `tools/handoff-orchestrator.ts` (C2). File set independently confirmed unchanged vs Round 1 — same 10 cut files + `dist/tools/handoff-orchestrator.js{,.map}` + the two governance files, zero `test/` edits.
- C1 was fixed by the harder branch (rewrite the substance, not drop-and-note). The replacement is a *new* confident structural claim, so it was re-derived from `tools/transitions.ts` line by line rather than accepted from the reply. **Every clause holds.**
- C2 fixed as claimed: the `:1441-1444` range is gone from `tools/handoff-orchestrator.ts` (and from `dist/`), replaced by a symbolic guard citation that is a verbatim match of the live condition.
- Q1 fixed: `specs/e1-feature-scoped-state-design.md:225` is now 71 chars, inside the paragraph's 56-82 char band.
- Verdict: APPROVED. Two non-blocking notes (N1, N2) recorded for the record; neither is a defect in the delta.

## Correctness

**C1 (Round 1) — RESOLVED.** The new bullet at `specs/e1-feature-scoped-state-design.md:25-32` makes five separable claims. Each verified against source, none taken from the sr's reply:

1. *"`hop_count` and its `*_rounds_total` mirrors reset through `computeNewRound`'s `feature_changed ? 0 : prev` base"* — **true, and verbatim.** `tools/transitions.ts:662` `const hopBase = feature_changed ? 0 : prev_hop_count;` plus the three mirrors at `:670`, `:673`, `:676` (`qaTotBase` / `revTotBase` / `visTotBase`, each `feature_changed ? 0 : prev_*_rounds_total`). Four counters, one shared idiom — the plural "mirrors" is correct, and the quoted expression is the literal source text.
2. *"the `HOP_CAP` const's own doc comment documents this for `hop_count`"* — **true, and correctly narrowed.** The comment at `tools/transitions.ts:382-387`, immediately above `const HOP_CAP = 10` (`:388`), reads "hop_count is feature-scoped: it resets ONLY on active_feature change, never on PM re-entry (DR-6)". It speaks to `hop_count` alone — and the bullet claims only that. This is the exact over-reach that made Round 1's version false (it cited this comment in support of all four counters); the rewrite scopes the cross-reference to precisely what the comment covers.
3. *"`qa_round`, `review_round`, and `visual_round` carry no `feature_changed` term at all"* — **true.** All three branches (`tools/transitions.ts:625-651`) read only `next`, `prev`, and `next_pending_notes`. `feature_changed` appears nowhere in them; its only four uses in the function are the four bases in claim 1.
4. *"they are zeroed instead by the `(pm, In_Progress)` branch in the same function"* — **true on both halves.** Each of the three has a `next.agent === "pm" && next.status === "In_Progress"` → `0` arm (`:627`, `:638-640`, `:650-651`). "The same function" is accurate, not loose: `computeNewRound` (`:601-690`) is where both the four `feature_changed` bases *and* all three `(pm, In_Progress)` zeroings live — the "two different mechanisms" of the bullet's lead are genuinely co-located, which is what makes the asymmetry worth documenting at all. See N1 for the one thing this clause leaves out.
5. *"the write that in practice opens a new feature"* — **an inference, correctly hedged, and not a source claim it pretends to be.** Nothing in `tools/transitions.ts` ties `feature_changed` to `agent_id="pm"`; no gate requires a new `active_feature` to arrive on a PM write. So this is a claim about convention, not mechanism — and "in practice" is exactly the right qualifier for that. It is also consistent with this document's own Ordering paragraph ("Feature B's PM init write pass the lease gate", `:226`) and with the governed chain. **This is the clause I pressed hardest on, and it does not repeat C1's failure mode**: C1 asserted a code branch that did not exist, in the indicative, with a line range; this asserts a convention, hedged, with no false referent behind it. Had it been written as "the write that opens a new feature" I would have bounced it — the hedge is load-bearing and must survive future edits to this bullet.

**C2 (Round 1) — RESOLVED.** `tools/handoff-orchestrator.ts:1317-1320` now cites the sentinel as "the hop-cap-cross sentinel below, guarded by `new_hop_count >= HOP_CAP_EXPORTED && prev_hop_count < HOP_CAP_EXPORTED`". Character-for-character identical to the live guard at `:1511`, and "below" is correct (1319 < 1511). `grep -rn '1441-1444' tools/ dist/tools/` → empty. The two other conversions in the same file are equally sound: the round-cap claim at `:1304-1307` ("the round-cap overrides in validateTransition … each returns null for `(pm,In_Progress)` unconditionally") matches all three overrides at `tools/transitions.ts:456-492`, each of which computes `ok = next.agent === "pm" && next.status === "In_Progress"` and returns `null` with no `feature_changed` term; the hop-cap override "in the same function" is `tools/transitions.ts:505-511`, which does read `!req.feature_changed` — so the DIFFERENT contrast is real. The self-loop citation at `:1716-1718` resolves to `validateTransition` step 3 (`tools/transitions.ts:520-529`), a same-agent `In_Progress → In_Progress` early `return null`, matching its description.

**Q1 (Round 1) — RESOLVED.** `specs/e1-feature-scoped-state-design.md:225` is 71 chars; the paragraph now runs 82/59/79/79/71/74/34. Both symbolic replacements in that paragraph resolve: the `qa-engineer:PASS → release-engineer:In_Progress` entry exists at `tools/transitions.ts:318` (under the `qa-engineer:PASS` key, `:313`), and the mirroring `release-engineer:In_Progress → pm:In_Progress` entry at `:335` (under the `release-engineer:In_Progress` key, `:334`). Likewise the `:433` conversion — the In_Progress→In_Progress fast path is real and is in `validateTransition`.

No new correctness findings in the delta.

## Quality
The delta is self-consistent with the citation policy this same cut introduces at `CONTRIBUTING.md:24` ("cite by symbol/anchor … rather than by line number wherever prose merely points at a concept"): every replacement citation added this round is a symbol (`computeNewRound`, `validateTransition`, `HOP_CAP`, `ALLOWED_TRANSITIONS`, `HOP_CAP_EXPORTED`) or a quoted guard expression, and zero new line numbers were introduced. Acceptance grep re-run independently: `grep -rn 'transitions\.ts:[0-9]'` over `tools/` + the three named specs — empty.

**N1 (non-blocking, delta).** Claim 4 says the three per-cycle counters "are zeroed instead by the `(pm, In_Progress)` branch" — true, but `(pm, In_Progress)` is not their only zeroing arm: `qa_round` and `visual_round` also zero on `(qa-engineer, PASS)` (`tools/transitions.ts:626`, `:648-649`), and `review_round` also zeroes on the `code-reviewer:In_Progress → qa-engineer:In_Progress` edge (`:629-636`). In the bullet's context — which mechanism handles *feature change* — the omission is defensible and arguably the right altitude. Flagging it only so a future editor who reads the bullet as an enumeration of reset triggers is not misled. The stronger, fully-precise phrasing would be "zeroed on `(pm, In_Progress)` — the reset arm that fires when a new feature opens; they carry other cycle-local resets too."

**N2 (non-blocking, pre-existing prose, NOT in the delta and not a Round 2 defect).** The now-precise bullet sits ~18 lines above an untouched sentence at `specs/e1-feature-scoped-state-design.md:44` describing the clobber path: a differing-`active_feature` write is accepted "dropping the prior feature's `external_refs` / `dispatch_pins` / `cut_approved` and resetting its counters." Read against the new bullet, "its counters" is loose: a non-PM write carrying a new `active_feature` resets `hop_count` and the three `*_rounds_total` (the `feature_changed` bases fire) but carries `qa_round` / `review_round` / `visual_round` forward from the clobbered feature, since those have no `feature_changed` term. That divergence is real and is arguably the more interesting half of the asymmetry E1 is documenting. It was there before this cut, I did not flag it in Round 1, and tightening it is outside the T-E6X-02 anchor list — so this is a note for a future E-ticket, explicitly **not** a change request. Recording it because the delta is what made it visible.

## Architecture
No architecture spec for this feature; none required. No layering, module boundary, or dependency direction changed — the delta is comment and prose text only. The E62 design intent (replace drift-prone line ranges with durable symbolic anchors in live prose; leave dated records and the six historical specs alone per E56) is honored exactly: only the three in-cut orchestrator comments and the in-cut spec anchors moved.

## Security
No findings. Zero executable statements changed this round — verified `npx tsc --noEmit` clean, and the `dist/tools/handoff-orchestrator.js` delta is comment text in parity with the source (new comment lines present at `dist/…:1217`, `:1221`, `:1578`, `:1596`; the guard expression present twice, once as comment and once as the live condition). No gate predicate, error code, `ALLOWED_TRANSITIONS` entry, or trust boundary touched.

## Performance
No findings, and none possible: no executable statement changed. `effectiveAllowedSuccessors` retains its 64 in-memory calls with no I/O. No algorithmic change vs base or vs Round 1.

## Verdict
APPROVED — both Round 1 change requests are genuinely fixed, and the replacement C1 claim survives clause-by-clause re-derivation from `tools/transitions.ts` rather than merely reading well: the four `feature_changed ? 0 : prev` bases, the absent `feature_changed` term in the three per-cycle counters, the shared `(pm, In_Progress)` zeroing, the co-location in `computeNewRound`, and the correctly-narrowed `HOP_CAP` cross-reference all check out, and the one inferential clause is hedged rather than asserted. N1/N2 are notes, not gates.

## Model-Bias Note
Round 2 reviewed on `opus`; sr-engineer pinned to `fable`. Different model than the writer. Every claim in the C1 rewrite was re-derived from `tools/transitions.ts` and `tools/handoff-orchestrator.ts` directly — the sr's reply was read only to locate the delta, never as evidence for it. `npx tsc --noEmit` reproduced independently (clean); `dist/` parity and both greps re-run first-hand.
