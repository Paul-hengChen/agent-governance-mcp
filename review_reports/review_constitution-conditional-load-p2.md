# Review — constitution-conditional-load-p2

_Reviewer: code-reviewer (opus). Clean-context: reviewed the working-tree diff, `specs/constitution-conditional-load.md` (## Phase 2), and `prompts/build.ts` strip logic. Did NOT read sr-engineer pending_notes commentary or qa_reports as authority — every claim below was independently reproduced._

## Summary

- Phase 2 extends the existing `design-only` fence axis to TWO deferred spans in `content/constitution.md`: Span A (§4 visual prose, reorder + one fence) and Span B (§1 L16/L17 fence#1 + L19 fence#2).
- Implementation change is content-only: `content/constitution.md` is the ONLY code artifact touched. `prompts/build.ts` strip logic UNCHANGED (markers reuse the shipped `stripDesignOnly`/`stripRationale`/`stripChainOnly` regexes); no `dist/` diff (constitution.md is runtime-read content, not compiled); no `package.json` bump; no test file edited.
- The §4 reflow is verified REORDER-ONLY: the multiset of 11 §4 sentence-units is byte-identical between HEAD and working tree — only position changed plus 2 inserted marker lines. §1 bullet text likewise byte-identical, only markers inserted.
- Both arms verified against the REAL compiled build pipeline (`buildPromptForRole`): non-design constitution strips all 10 gatable terms and retains all 6 anti-sweep contracts; design constitution loads all gatable content. HC-NEST + 8-permutation orphan-balance confirmed.
- Headline verdict: **APPROVED**. The 4 `npm test` failures (619/623) are exactly the expected stale floor/figure/count assertions for qa to rebaseline — zero logic/structural regression.

## Correctness

- **§4 reflow reorder-only (HIGH-RISK CHECK — PASS).** Extracted §4 (`## 4.` → `## 5.`) from `HEAD:content/constitution.md` and the working tree, stripped marker lines, segmented into sentence/paragraph units, and compared multisets order-independently: **all 11 §4 units byte-identical, only reordered.** Non-space char-multiset also identical. No sentence reworded, merged, or split. The S3 semicolon-fused sentence (`visual_round` description + self-arming signal) was NOT split — it moved whole into the fence (both clauses visual, so cleanly fenceable; HC2 escape hatch correctly unused). content/constitution.md:110–135.
- **§1 bullet byte-identity (PASS).** §1 (`## 1.` → `## 2.`) bullet text byte-identical between HEAD and WT after stripping both own-line and inline (rationale) markers — all 12 lines unchanged; only design-only markers inserted. content/constitution.md:16–23.
- **Reflow matches spec mechanics (PASS).** Diff confirms: (1) first §4 prose paragraph split after S2 (`…runs qa_round independently.`); (2) S6 (`Each role finishes with tw_update_state…`) moved UP to sit between the S1+S2 paragraph and the visual block; (3) [S3 S4 S5 paragraph] + [P-AUDITOR paragraph] wrapped in one design-only fence. Exactly the spec's "After order".
- **Both-arms behavior against the real build (PASS).** Ran `buildPromptForRole("skill-sr-engineer.md", …, fullDetail=false/true)` on a non-design fixture (no `design/<feat>.md`) and a design fixture (`## Mode: figma` + Visual Baselines), scoping assertions to the constitution section (before the first `---`, to exclude skill body + state JSON):
  - NON-DESIGN: gatable terms present = **[]** (column-scroller picker, Self-converge relaxation, Design-baseline scope, Visual Widgets exception, visual_round, VISUAL_BASELINES_REQUIRED, VISUAL_ASSERTIONS_REQUIRED, VISUAL_REPORT_INCOMPLETE, P-AUDITOR body, "An armed workspace missing" all STRIPPED). Anti-sweep = **6/6 present**.
  - DESIGN: all gatable terms PRESENT (incl. column-scroller picker on fullDetail=true). Anti-sweep = 6/6 present.
- **§4 visual block gating (AC-P2-1/2 — PASS).** On non-design, the §4 P-AUDITOR body (`fires when the coordinator detects`), S3 `visual_round` rule, S4/S5 `VISUAL_*` codes are stripped; the only surviving `design-auditor` token (count = 1) is the routing-chain DIAGRAM line L107 (anti-sweep). On design, all present.
- **Anti-sweep both arms (AC-P2-6 — PASS).** §4 DIAGRAM, S1 (`review_round`), S2 (`qa_round`), S6 (`Each role finishes with`), §1 L15 (`MVP strict`), §1 L18 (`Surgical changes`) all present on BOTH arms.

## Quality

- Marker placement is on dedicated own-lines except the pre-existing inline rationale pair inside L16, which is correctly preserved verbatim. No naming/convention drift; the fences reuse the established marker vocabulary.
- No dead code, no duplication introduced. The strip functions were not touched, so DR-3 three-copy parity (chain-only) is unaffected.

## Architecture

- **No new mechanism (PASS).** Conforms to the spec's "reuse `stripDesignOnly` + the `design-only` marker pair only; no server-gate change; no rule reword." `prompts/build.ts:90-94` (stripDesignOnly) and the composition pipeline `prompts/build.ts:303-315` are byte-unchanged vs HEAD.
- **HC-NEST / proper nesting (PASS).** Document-order marker map: §1 fence#1 = `design-only:start(L16) → rationale:start(L17) → rationale:end(L17) → design-only:end(L19)` — outer design-only, inner rationale, no crossing, both regexes non-greedy (unchanged). §1 fence#2 wraps L19 (L21–L23). §4 Span A = `design-only:start(L117) → design-only:end(L135) → chain-only:end(L136)` — design-only nested INSIDE chain-only. Stack-based balance check: PASS (balanced, no crossing).
- **Zero-orphan composition / HC5 (PASS).** Reproduced the permutation matrix {design-only}×{rationale}×{chain-only} (8 combos) independently via the shipped regexes. Genuine-orphan (unbalanced start/end) check: ALL 8 permutations balanced, zero genuine orphans. Fully-stripped (all three) → zero residual markers; no corrupted rule text.
- **Anti-sweep placement is architecturally correct.** §1 Span-B fences sit OUTSIDE chain-only (§1 is universal-scoped), so `stripChainOnly` alone leaves the 4 §1 design-only markers in place (verified: 4 remain post-chain-strip). This is the intended behavior and is precisely what test #61's stale constant (line 633, `assert == 0`) fails to anticipate.

## Security

- No injection vectors, secrets, or boundary changes — the change is governance prose + HTML-comment markers. The `hasDesignModeRequiringVisual` arm probe and path sanitiser (`designFilePath`, evidence-file.ts:114) are untouched.

## Performance

- No code path changed. The non-greedy regexes are unchanged; no new loop, I/O, or algorithmic class. Token budget: measured `scripts/measure-context-cost.mjs` — non-design constitution 2409 ~tok (down from Phase-1 3013); design-arm raw 4311 / rationale-stripped 4239 (unchanged vs Phase-1 floor, AC-P2-7 satisfied). No regression.

## Expected non-blocker — 4 failing tests (619/623)

Confirmed the 4 failures are ONLY stale floor/figure/count assertions; each diagnostic verified non-behavioral:

- **#47** AC8 rationale-stripped floor `4239 ≤ 4200` → measured 4239 is the correct new design-arm figure (+39 marker-line cost). Floor constant stale; rebaseline up.
- **#48** AC8 teamwork bundle floor `7703 ≤ 7665` → same +39 marker cost. Floor stale; rebaseline up.
- **#50** AC9 fullDetail retains `column-scroller picker` → that token is now inside §1 design-only fence#1, so it is correctly stripped on the NON-DESIGN fixture even at fullDetail. The assertion must become design-arm-aware (run the interior check on a DESIGN feature) per AC-P2-3. Strip is correct; test premise stale.
- **#61** AC5/HC5 orphan count `expected 0, actual 4` → the failing line is test/context-budget.test.mjs:633 `assert.equal(countMarkers(chainOut, "design-only"), 0)`, which embeds the now-FALSE premise that all design-only fences nest inside chain-only. The 4 residual markers are the §1 Span-B fences correctly sitting outside chain-only (anti-sweep). The real orphan invariant (lines 623–625, fully-stripped → zero) PASSES. Also line 620's comment "6 (3 pairs)" is stale: design-only is now 6 pairs (12 markers). Rebaseline line 633 to `== 4` and the count comment to 6 pairs.

No logic or structural test regressed: AC2/AC3 (chain-only strip + idempotence), AC3 single-balanced-fence, AC6 anti-sweep, AC9/DR-9 order-independence, and the 8-permutation byte-identity all pass.

## Verdict

**APPROVED** — §4 reflow is provably reorder-only (11 sentence-units byte-identical, only reordered + markers), §1 text byte-identical, HC-NEST and HC5 hold across all 8 permutations against the shipped regexes, both arms behave per AC-P2-1…6 in the real build pipeline, scope is confined to `content/constitution.md` §1/§4 with no strip-logic/test/package.json edits; the 4 test failures are exactly the expected bookkeeping/figure/count rebaselines for qa.

## Round 1 — APPROVED — by code-reviewer
