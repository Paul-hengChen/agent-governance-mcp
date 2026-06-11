# Spec: constitution-conditional-load

> Status: **CLASSIFICATION CHECKPOINT — awaiting human review.** This hop produces the
> contract-vs-procedure-vs-feature-inert classification and the gatable-span definition only.
> No build/impl tasks are bootstrapped and nothing is routed to architect/sr-engineer until a
> human ratifies the classification below.

## Problem Statement

Every chain-role dispatch (`prompts/build.ts` → `buildPromptForRole`) injects the **entire**
`content/constitution.md` (raw ~4233 tok; rationale-stripped ~4161 tok). A large, fixed span of
that text governs **visual fidelity** — §3.2 (Visual Verdict Authority & Separation of Duties) plus
the visual-specific bullets of §3.1 (visual evidence / report-schema gates) and §4 (the
`visual_round` paragraph). On a **non-design feature** — where `design/<active_feature>.md` is
absent or its `## Mode` = `no-design` — the server-side visual gates are already inert (they
self-arm only on a present, non-`no-design` design file), so this visual governance binds **no
role**: there is no visual verdict to author, relax, or pre-accept, and no `visual_round` to run.
Yet the text is still injected into every dispatch on those features, costing ~900–1000 tok/hop for
rules that cannot fire. We want a **feature-conditional load axis** that strips this span on
non-design features only, mirroring the existing two static axes (`stripChainOnly` for lite,
`stripRationale` for non-full-detail).

## User Stories

- As a **chain role on a non-design feature**, I want the inert visual-governance span omitted from
  my dispatch, so that my context budget isn't spent on rules that cannot apply to my work.
- As the **server/governance maintainer**, I want the gate to strip a span ONLY where provably no
  role needs it, so that conditional loading never weakens a cross-role contract.
- As a **chain role on a design feature**, I want the full visual governance to load unchanged, so
  the coordinator/sr/qa contract that prevents visual false-PASS (CDE-OOBE) stays intact.

## Acceptance Criteria

> Draft — these become the qa-authored test contract in the build phase. Not yet executable.

- **AC1 (gate trigger — non-design strips):** Given a workspace where `design/<active_feature>.md`
  is absent OR its `## Mode` = `no-design` (or the mode is unparseable), When `buildPromptForRole`
  runs for any chain role, Then the gatable visual span (defined below) is absent from the emitted
  constitution text and every NON-visual rule remains byte-for-byte present.
- **AC2 (gate trigger — design loads full):** Given a workspace where `design/<active_feature>.md`
  exists with `## Mode` ≠ `no-design`, When `buildPromptForRole` runs for any chain role
  (incl. coordinator and sr-engineer), Then the full §3.2 / visual §3.1 / visual §4 text is present
  unchanged.
- **AC3 (no-state / no-design-file safety default):** Given no handoff state, or state present but
  no design file, When the prompt builds, Then the gate behaves as the non-design case (strips) —
  the strip is the budget win and is provably safe when no design exists.
- **AC4 (semantics byte-unchanged):** For every rule that remains loaded in a given arm, its text is
  identical to today's `content/constitution.md` (the gate only removes a fenced span; it never
  rewords a surviving rule).
- **AC5 (composition with existing axes):** The feature-gate composes order-independently with
  `stripChainOnly` and `stripRationale`; on a lite + non-design dispatch the union of all three
  strips applies and no surviving rule is double-stripped or corrupted (disjoint or properly-nested
  fences).
- **AC6 (non-visual content inside §3.1/§4 is NEVER gated):** Any non-visual rule that physically
  sits inside §3.1 or §4 (e.g. the §4 routing-chain diagram, the qa/review `_round` mechanics, the
  scope-decision gate) survives on BOTH arms. Only visual-specific spans are gatable.
- **AC7 (lite unaffected on this axis where already stripped):** Lite mode already strips
  `chain-only` (§3.1+§4); the feature-gate must not reintroduce any of that span, and must still
  strip §3.2 on lite + non-design (§3.2 is currently OUTSIDE the chain-only fence — see Gap G1).

## Classification Table (PRIMARY DELIVERABLE)

Legend for **Class**: **CONTRACT** = cross-role mutual-knowledge rule (must stay universally
loaded); **PROCEDURE** = single-role how-to (safe to localize, mostly belongs in skill-\*.md);
**FEATURE-INERT** = a CONTRACT that is genuinely inert for a whole feature class (the gatable set).
**Gatable?** = may the feature-gate strip it on non-design features? (Yes only if FEATURE-INERT.)

| Section / bullet | Lines | Class | Litmus reasoning | Gatable? + range |
|---|---|---|---|---|
| **§1 Output Directives** (header) | L7 | CONTRACT | Universal output contract. | No |
| §1 NO YAPPING / banned phrases / silent exec | L9–11 | CONTRACT | Applies to every role's chat output; mutual expectation. | No |
| §1 Tool-First | L12 | CONTRACT | Universal. | No |
| §1 Terse + word cap | L13 | CONTRACT | Universal; other roles assume terse peers. | No |
| §1 Watermark | L14 | CONTRACT | Cross-role identity convention; coordinator parses watermarks. | No |
| §1 MVP strict | L15 | CONTRACT | Universal scope discipline. | No |
| §1 Visual Widgets exception | L16 | **FEATURE-INERT (candidate)** | Binds sr-engineer AND pm ("PM-declared widget shape is the minimum scope"); but the binding only exists when a spec has a `## Visual Widgets` section, which only design features produce. On a non-design feature no widget table exists → binds nobody. **BUT** the rule lives in §1 (not §3.2/§3.1/§4) and is NOT in this hop's named gatable span. **FLAG for human:** semantically inert on non-design, but OUT of the proposed gate range — recommend NOT gating this hop (keep gate minimal to §3.2/visual-§3.1/visual-§4). | Defer (not in span) |
| §1 Design-baseline scope (v3.27.0) | L17 | **FEATURE-INERT (candidate)** | "For design-backed work, the canonical design is the scope baseline." Explicitly scoped to design-backed work; inert on non-design. Same caveat as L16: lives in §1, outside the proposed span. **FLAG:** inert but out-of-span; defer. | Defer (not in span) |
| §1 Surgical changes | L18 | CONTRACT | Universal. | No |
| §1 Self-converge relaxation (v3.31.0) | L19 | **FEATURE-INERT (candidate)** | Entirely about sr-engineer's VSA self-converge loop + §3.1 visual report gate + §3.2 verdict ownership — all visual. Inert on non-design (no VSA, no visual gate). **BUT** lives in §1, out of the proposed span, AND it is sr-internal procedure-flavored (references skill-sr-engineer). **FLAG:** strongest §1 gate candidate, but defer this hop to keep the span contiguous in §3.2/§3.1/§4. | Defer (not in span) |
| **§2 Dev & Tech Standards** (all bullets) | L21–28 | CONTRACT | Strict typing, test ownership, build gate, conventions — universal engineering contract. | No |
| **§3 State Synchronisation** (all bullets) | L30–36 | CONTRACT | Pre-flight, drift, state-update, tool-routed edits, complete-task ownership — the core cross-role state protocol. | No |
| **§3.1 header + "server-enforced chain"** | L39–43 | CONTRACT | Frames the whole enforced routing chain; all chain roles rely on it. Inside `chain-only` fence. | No |
| §3.1 `status=PASS`/complete require qa | L44 | CONTRACT | qa-exclusivity is mutual knowledge (sr signals readiness, doesn't self-PASS). | No |
| §3.1 3-QA-FAIL circuit breaker | L45 | CONTRACT | qa/pm/sr all depend on the breaker semantics. | No |
| §3.1 PASS requires evidence | L46 | CONTRACT | qa + pm rely on evidence requirement. | No |
| §3.1 **Visual evidence gate (v3.16.0)** | L47 | **FEATURE-INERT** | Self-arms ONLY when `design/<feature>.md` mode ≠ no-design. On non-design it is silent pass-through by its own text — binds NO role (no `VISUAL_BASELINES_REQUIRED`/`VISUAL_EVIDENCE_MISSING` can fire). Purely visual. | **Yes — L47** |
| §3.1 **Visual report schema gate (v3.26.0/v3.27.0)** | L48 | **FEATURE-INERT** | Armed only when design declares `## Visual Structural Assertions`; impossible on non-design. Pure visual schema enforcement. | **Yes — L48** |
| §3.1 **Scope decision gate (v3.30.0)** | L49 | CONTRACT | Gates `(pm)→(architect/sr)` build entry. Arms on design files, BUT it is NOT visual — it's a routing/scope contract pm+architect+sr all act on, and its non-design behavior ("pass through silently") is itself a rule those roles must know. **Sits between two gatable visual bullets → must NOT be swept into the gatable span.** | No (anti-sweep flag) |
| §3.1 Code-reviewer approval signalling | L50 | CONTRACT | code-reviewer + qa routing contract. | No |
| §3.1 3-code-reviewer-FAIL breaker | L51 | CONTRACT | Symmetric breaker; cross-role. | No |
| §3.1 **`visual_round` sub-loop (v3.14.0)** | L52 | **FEATURE-INERT** | Ticks only on `visual_fail:` and only when armed (non-no-design design file). On non-design it can never increment. sr+qa+pm visual-loop contract — but inert with no design. | **Yes — L52** |
| §3.1 **Split escalation (Round 3)** | L53 | **FEATURE-INERT** | Sub-bullet of `visual_round`; depends entirely on visual_round being live. Inert on non-design. | **Yes — L53** |
| §3.1 "On rejection the server returns…" | L55–56 | CONTRACT | Generic self-correct guidance for ALL rejected writes, not visual. Must survive. | No (anti-sweep flag) |
| **§3.2 header + retrospective framing** | L58–64 | **FEATURE-INERT** | Entire §3.2 is "Visual Verdict Authority & Separation of Duties." On non-design there is no visual verdict, no allowed-diff, no role-collapse-visual-PASS scenario. **Critically (per dispatch brief): the CDE-OOBE incident was a COORDINATOR authoring an accept-policy, so on DESIGN features this binds the coordinator — must load there. On non-design, no visual PASS exists at all → binds nobody, incl. coordinator.** | **Yes — L58–92 (whole §3.2)** |
| §3.2 Visual verdict qa-visual-owned | L66–77 | **FEATURE-INERT** | The coordinator/non-qa "MUST NOT define visual tolerance" contract. Its binding TARGET (coordinator) only matters when a visual verdict can exist → design only. | **Yes — in L58–92** |
| §3.2 Builder ≠ judge (role-collapse) | L78–82 | **FEATURE-INERT** | "visual-backed work stops at Blocked." Explicitly visual-backed; no trigger on non-design. | **Yes — in L58–92** |
| §3.2 No global-frame metric | L83–85 | **FEATURE-INERT** | Defines the visual PASS metric; no visual PASS on non-design. | **Yes — in L58–92** |
| §3.2 Sequential-context + reconcile (R10) | L86–92 | **CONTRACT — ANTI-SWEEP FLAG** | This bullet is about `tw_detect_drift`/`tw_sync` after out-of-band/inline/parallel execution. **It is NOT visual** — drift/reconcile applies to ANY feature with background `Task` fan-out or inline-coordinator execution. It physically sits at the END of §3.2 but is general-purpose. **MUST NOT be gated.** Recommend the build phase either (a) place the feature-fence to END BEFORE L86, or (b) relocate R10 out of §3.2 into §3 proper. See Hard Constraints HC4. | **No — L86–92 carve-out** |
| **§4 Routing Chain** (diagram) | L96–99 | CONTRACT | The chain diagram itself; sr+coordinator always need it. Inside `chain-only`. | No (anti-sweep flag) |
| §4 review_round / qa_round prose | L101–106 (non-visual parts) | CONTRACT | sr↔code-reviewer + qa loop mechanics, non-visual. | No (anti-sweep flag) |
| §4 **`visual_round` paragraph** | L104–113 (visual sentences) | **FEATURE-INERT** | The sentences describing `visual_round`, the v3.16.0 self-arming signal, `VISUAL_BASELINES_REQUIRED`/`VISUAL_ASSERTIONS_REQUIRED`/`VISUAL_REPORT_INCOMPLETE`. All visual; inert on non-design. **BUT interleaved with non-visual chain prose in the SAME paragraph block** → cannot strip by a coarse fence without losing non-visual sentences. See Gap G2. | **Yes — but needs sentence-precise fence (G2)** |
| §4 design-auditor paragraph | L115–119 | **FEATURE-INERT (candidate)** | "design-auditor fires when the coordinator detects a design source… Tasks with no design reference skip the auditor entirely." Self-evidently design-only; on non-design the auditor never fires. Coordinator-facing. **Reasonable to gate**, but interleaved with §4 prose. Recommend gating with the visual_round span if fences are placed cleanly. | **Yes (candidate) — L115–119** |
| §4 "Each role finishes with `tw_update_state`…" | L121 | CONTRACT | Universal handoff convention. | No |
| **§5 Anti-Loop Circuit Breaker** (all) | L124–129 | CONTRACT | Fix-attempt / read / escalation / hop caps — universal safety. | No |
| **§6 Security & Privacy** (all) | L131–134 | CONTRACT | Access-denied + dependency-audit — universal. | No |
| **§7 Cognitive Discipline** (all) | L136–143 | CONTRACT | Think-first, goal-driven, conflicts, read-before-write, fail-loud, external-reference. Universal. | No |
| **Document Priority** + conflict rules | L145–153 | CONTRACT | Precedence + safety-override + anti-loop hand-back. Universal. | No |

### Classification verdict (summary)

- **Cleanly gatable on non-design features (the proposed span):**
  - **§3.2 in its entirety EXCEPT R10 (L58–85, carve-out L86–92).**
  - **§3.1 visual bullets L47, L48, L52, L53** (NOT L49 scope-decision, NOT L50/L51 review, NOT L55–56 generic).
  - **§4 visual sentences (the `visual_round` description, ~L104–113 visual portions) and the design-auditor paragraph L115–119**, contingent on sentence-precise fences (Gap G2).
- **Inert-but-DEFERRED (out of this hop's span):** §1 L16, L17, L19. Semantically inert on non-design
  but they live in §1 and gating them would fragment §1 with a feature-fence. **Recommend NOT gating
  this hop** — revisit only if the savings justify the added fence surface.
- **ANTI-SWEEP (must NOT be gated even though adjacent to gatable spans):** §3.1 L49 (scope-decision),
  L50/L51 (review rounds), L55–56 (generic rejection); §3.2 R10 (L86–92); §4 diagram + qa/review-round
  prose. These are CONTRACTs interleaved with or adjacent to the visual spans.

## Gaps the build phase must resolve (fence placement reality)

- **G1 — §3.2 is OUTSIDE the existing `chain-only` fence.** The `chain-only` fence is `L38→L122`
  (`<!-- chain-only:start -->` after §3 / `<!-- chain-only:end -->` after §4). §3.2 (L58–92) IS inside
  that range, so lite mode already strips §3.2. ✅ Re-verified: §3.2 at L58 is between the L38 start and
  L122 end. So lite already drops §3.2; the NEW feature-gate is what drops §3.2 (and visual §3.1/§4) for
  **non-lite chain roles on non-design features.** No conflict — the feature-fence is a NESTED region
  inside chain-only. Nesting must be verified safe (non-greedy regex, see HC5).
- **G2 — visual content in §3.1 and §4 is interleaved with non-visual content at sub-paragraph
  granularity.** §3.1 visual bullets (L47,48,52,53) are whole list items → fenceable as discrete spans,
  but L49 (scope-decision, CONTRACT) sits BETWEEN L48 and L52, so a single fence L47–L53 would wrongly
  swallow L49. Requires EITHER two fences (L47–L48 and L52–L53) OR moving L49. §4's `visual_round`
  description (L104–113) is woven into a single prose paragraph with non-visual chain text → needs a
  rewrite into separable sentences before it can be fenced. **The build phase must decide fence
  granularity; the safe default is to gate only the cleanly-fenceable spans (whole §3.2 minus R10; the
  four §3.1 visual bullets via two fences) and DEFER §4 visual prose to a follow-up if a clean fence
  isn't achievable without reflowing §4.**
- **G3 — R10 relocation.** §3.2's R10 (L86–92) is non-visual and ends the section. Cleanest fix:
  relocate R10 into §3 (state-sync) so the §3.2 feature-fence can wrap the whole remaining section.
  Alternatively place the fence end-marker BEFORE R10. Either is byte-preserving for the rule text.

## Gatable-span definition (explicit, for the build phase)

The feature-gate, when the design-arm probe reports **non-design**, strips exactly:

1. **§3.2 visual body** — from the §3.2 header (L58) through the end of "No global-frame metric"
   (L85), EXCLUDING R10 (L86–92). (Implementation: relocate R10 per G3, then wrap L58–L85 — or the
   relocated equivalent — in a feature-fence.)
2. **§3.1 visual bullets** — L47 (visual evidence gate), L48 (visual report schema gate), L52
   (`visual_round` sub-loop), L53 (split escalation). Via TWO fences to skip L49–L51.
3. **(Deferred-pending-clean-fence) §4 visual prose** — `visual_round` description + design-auditor
   paragraph (L104–119 visual portions). Gate only if a byte-preserving fence is achievable; else
   defer to follow-up.

**Estimated stripped budget on non-design dispatch:** ~900–1000 ~tok (§3.2 is the bulk; the four
§3.1 bullets add the rest). Canonical figures (`measure-context-cost.mjs`): constitution raw 4233 ~tok,
rationale-stripped 4161, lite-lean 1979.

## Hard Constraints (must be encoded in the build phase)

- **HC1 — No contract ever stripped where any role needs it.** The gate may remove a span ONLY if, on
  the stripped feature class, NO role (incl. coordinator and sr-engineer) needs it. Verified: on a
  non-design feature §3.2 binds nobody (no visual verdict can exist), so it is gatable; on a design
  feature it binds coordinator+sr+qa, so it must load. Same proof holds for §3.1 L47/48/52/53.
- **HC2 — Rule semantics byte-unchanged.** The gate only DELETES a fenced span. No surviving rule is
  reworded. (Mirrors `stripChainOnly`/`stripRationale` semantics.)
- **HC3 — The design-arm probe is the gate trigger.** The strip fires iff
  `design/<active_feature>.md` is absent OR its `## Mode` = `no-design` (or unparseable) — the SAME
  self-arming signal the server-side visual gates already use (v3.16.0). This guarantees the gate and
  the server gates agree: text is present exactly when the gate can fire.
- **HC4 — Anti-sweep.** §3.1 L49/L50/L51/L55–56, §3.2 R10, §4 diagram + qa/review-round prose are
  CONTRACT and MUST survive both arms. Fence boundaries must exclude them.
- **HC5 — Composition safety.** The feature-fence is NESTED inside `chain-only` (§3.2/§3.1/§4 all sit
  inside L38–L122). The new strip regex must be non-greedy and use a DISTINCT marker comment (e.g.
  `<!-- design-only:start/end -->`) so it neither crosses nor is crossed by `chain-only`/`rationale`
  markers. Must be order-independent with the existing two strips (qa to assert all 4–6 permutations).

## Proposed build.ts Mechanism Sketch (acknowledging NET-NEW I/O)

Today (`prompts/build.ts`): `buildPromptForRole` is **synchronous**; it resolves the constitution at
L259–269 from static args only (`skillFile === LITE_SKILL_FILE`, `fullDetail`), and reads handoff
state at L279–284 — AFTER constitution resolution and ONLY for the state block. It does **not** read
`design/<active_feature>.md` anywhere.

The feature therefore requires:

1. **(a) A new feature-fence** — wrap the gatable visual span(s) in a distinct marker comment
   (e.g. `<!-- design-only:start --> … <!-- design-only:end -->`) in `content/constitution.md`,
   placed per the Gatable-span definition + G3 relocation. (Plus a matching `stripDesignOnly()` regex
   helper in build.ts, sibling to `stripChainOnly`/`stripRationale`.)
2. **(b) Earlier / reordered state read** — `active_feature` must be known BEFORE constitution
   resolution. Move the `getActiveStorage().parse(workspacePath)` call (currently L279) above the
   constitution-resolution block, or read it once at top and reuse for both the design-arm probe and
   the state block. (The parse is already wrapped in try/catch; preserve that.)
3. **(c) A NET-NEW design-arm probe** — read + parse `design/<active_feature>.md` for its `## Mode`.
   This is new filesystem I/O in build.ts (mirrors the server-side arm logic; reuse the existing
   mode-parse helper if one exists, else add one). Absent file / `no-design` / unparseable → strip;
   present + non-no-design → keep. Safe default when `active_feature`/state is missing → treat as
   non-design (strip) per AC3 — this is the budget win and is provably safe (no design ⇒ no visual
   binding).
4. **(d) A new strip branch in `buildPromptForRole`** — after computing `isDesignFeature`, apply
   `stripDesignOnly` to the constitution when `!isDesignFeature`, composed with the existing
   `stripChainOnly`/`stripRationale` chain (order-independent per HC5).
5. **(e) qa-authored build.ts tests** — assert AC1–AC7: strips on non-design, loads on design, the
   anti-sweep contracts survive both arms, byte-equality of surviving rules, composition permutations,
   and the no-state safety default. (Test ownership: qa-engineer per §2.)

**Honest note on (b)/(c):** this makes the constitution resolution **state-dependent** for the first
time. `buildPromptForRole` stays synchronous (the design-file read is a cheap sync `fs` read, like
`loadContent`). The `chain-only`/`rationale` axes remain static-arg-driven; only the new axis consults
state. This is the real added surface and the main thing for the human to weigh.

## ROI Note (honest)

- **Per-dispatch saving:** ~900–1000 ~tok, on **non-design feature dispatches only**.
- **Total saving ≈ (non-design share of dispatch workload) × ~1k tok × hops-per-feature.** If, say,
  ~60% of features are non-design and a feature averages ~6 chain hops, the saving is
  ~0.6 × 1k × 6 ≈ ~3.6k tok/feature — but ZERO on design features (where the text must load).
- **Cost:** net-new design-file I/O on every dispatch, a state read moved earlier, a third strip axis,
  new fence markers in the constitution, and a fresh test matrix. The mechanism is the same shape as
  the two existing strip axes, so maintenance cost is incremental, not novel — EXCEPT that this axis
  reads state, which the others don't.
- **Verdict for human:** the saving is real but concentrated on non-design features; the principal
  risk is the new state-dependency in prompt building and the fence-placement gaps (G1–G3). The
  classification confirms the span is genuinely inert on non-design, so the governance risk (stripping
  a needed contract) is LOW provided the anti-sweep boundaries (HC4) are honored.

## Out of Scope

- Gating §1 inert bullets (L16/L17/L19) — deferred; out of this hop's span.
- Reflowing §4 visual prose into separable sentences IF a byte-preserving fence proves infeasible —
  may be deferred to a follow-up rather than blocking the §3.2 + §3.1 win.
- Any change to the server-side visual gates themselves (they already self-arm correctly).
- Cross-machine / non-local concerns (unchanged).

## Dependencies / Prerequisites

- **Human classification review (this hop's gate).** The build phase is NOT bootstrapped until a human
  ratifies: (1) the gatable-span definition, (2) the anti-sweep carve-outs (esp. §3.2 R10 and §3.1 L49),
  and (3) the decision on whether to gate §4 visual prose now or defer (Gap G2/G3).
- Canonical token figures from `scripts/measure-context-cost.mjs` (raw 4233 / rationale-stripped 4161 /
  lite-lean 1979 ~tok).
- Existing static strip axes in `prompts/build.ts` (`stripChainOnly` L55, `stripRationale` L70) — the
  new axis mirrors these.
- No external references; no Figma/URL/ticket artifacts (Resource Audit Gate: clean).
