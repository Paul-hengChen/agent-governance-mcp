# Review — T-E46-01

Feature: `e46-qa-spec-defect-status-rule` · Round 1 · reviewer model: opus (sr-engineer pinned `fable` — different model, no same-model-bias concern)

## Summary

- Content-only diff, 2 files, +17 lines: a new `## Contract Defect vs Implementation Failure` H2 in `content/skill-qa-engineer.md` (before Escalation Routes) plus a `contract defect | Blocked | … | pm` Escalation Routes row, and a one-line pointer at the end of Step C in `content/skill-qa-visual.md`.
- Scope is clean: no `content/const-*.md`, no `tools/`, `gates/`, `schema/`, or `test/` file touched; the only other modified paths are the governance state files (`.current/handoff.md`, `tasks.md` T-E46-01 row). No golden constitution fixture is affected (CONTRIBUTING "Reading the constitution" re-baseline path does not arm).
- The two-verdict decision test itself is sound and mid-round-applicable: it resolves the real incident correctly, and its AND-conjunct (both verdicts dishonest) is what excludes mere disagreement — the guard is structural, not just hortatory.
- But the section lands next to a sibling rule that already uses the term **contract defect** with the opposite route, its scoping sentence points at the one Phase-3 branch its own closing paragraph excludes, and the guard's only concrete citation resolves to a QA-self-authored artifact. Each is a small text fix; together they reintroduce exactly the misreadability this ticket exists to remove.
- Verdict: **CHANGES_REQUESTED** (F1–F3 blocking, F4 directional on the byte cap).

## Correctness

### F1 — `content/skill-qa-visual.md:24` already defines "contract defect" with the opposite route (BLOCKING)

The new section defines *contract defect* → `Blocked`, `next_role: pm`, no `qa_round` charge. The term is already in service in the sibling file this ticket also edits, meaning something else:

`content/skill-qa-visual.md:24` (Step A.5, canonical state, pre-existing):

> **Multi-value guard:** if a property has MORE than one correct value depending on context (focused vs unfocused, selected vs unselected), you MUST NOT adjudicate one value as "correct" — record BOTH contexts as separate baselines … and **FAIL it** with note: … Per Constitution §3.2, single-choice adjudication of a multi-value property is **a contract defect, not an implementation defect**.

So after this diff, a QA agent holding both files has one named term with two prescribed routes: `skill-qa-visual.md:24` says *contract defect → FAIL*; `skill-qa-engineer.md:97` says *contract defect → Blocked → pm, and FAIL is what implementation failures get*. The `:24` sentence even uses the exact contrastive pair ("contract defect, not an implementation defect") the new section defines, which makes the cross-reading feel authorized rather than accidental.

Run against the new decision test, the multi-value case does resolve to FAIL (there is no human-approved divergence on record, so the second conjunct fails) — the two rules are *reconcilable*, but only by a reader who runs the full test rather than matching the label. Under the mid-round pressure this ticket is written for, the label is what gets matched. This is a fresh instance of the failure mode the E46 backlog row cites as its justification ("three careful readers got it wrong in a row"), manufactured by the fix itself.

Fix (cheap, either direction):
- add a one-clause carve-out to the new section in the same shape as the existing coverage-gap paragraph — e.g. the multi-value guard's "contract defect" (`skill-qa-visual.md` Step A.5) is a *capture/baseline* defect and stays `FAIL` per that step, because no approved divergence exists; or
- reword `skill-qa-visual.md:24` off the collided term.

Either way the reconciliation must be written down, not left to the reader.

### F2 — the scoping sentence names the one Phase-3 branch the section excludes, and omits the one it governs (BLOCKING)

`content/skill-qa-engineer.md:91`:

> Before marking any verdict against `specs/<feature>.md` or `design/<feature>.md` — **a Phase 3a/3b coverage-gap call**, a Phase 1.5 Structural Assertion row …

`content/skill-qa-engineer.md:101`:

> The two coverage-gap rows below … are **unaffected by this rule and stay `FAIL`**

The opening enumerates as a trigger the exact case the closing paragraph carves out. Internally contradictory as written, and it costs the section its Phase-3 reach, because the Phase 3a/3b branch that genuinely has the contract-defect shape is **Drift**, not coverage gap — and Drift is never named. From `content/skill-qa-engineer.md:50` (pre-existing, Visual Audit Gate):

> **Drift**: implementation literal ≠ spec literal → FAIL back to sr-engineer with the diff. … the gate catches the inverse — **when code is right but spec was stale**

"Code is right but spec was stale" is the contract-defect shape stated in the SOP's own words, and it currently routes to `FAIL` → **sr-engineer** — the most expensive wrong answer available (charges `qa_round` *and* re-dispatches an engineer who has nothing to fix). That is the case the new rule should intercept.

Net effect of :91 as written: an agent checks the rule at coverage-gap time, where `:101` tells it the rule never fires, and does not check it at drift time, where it should. Fix: replace "a Phase 3a/3b coverage-gap call" with the drift call (3a Drift / 3b Drift), and keep `:101` as the explicit exclusion.

### F3 — the anti-abuse guard's only concrete citation is a nonexistent section that, where it does exist, is QA-self-authored (BLOCKING)

`content/skill-qa-engineer.md:97`:

> `blocking_reason` must name the exact assertion and the approved divergence that supersedes it (**cite the cut-time record, e.g. `design/<feature>.md` `## Allowed Differences`**)

Two independent defects in one parenthetical:

1. **`design/<feature>.md` has no `## Allowed Differences` section.** The design-auditor artifact schema (`content/skill-design-auditor.md:20-30`) enumerates: Mode, Layout / Canvas, Source manifest, Copy / Strings, Visual Tokens, Visual Widgets, Visual Baselines, Visual Structural Assertions, Out of Scope. An agent following the instruction looks for a section that is never authored there.
2. **Where `## Allowed Differences` does exist it is the opposite of a cut-time human record.** It is a `REQUIRED_VISUAL_SECTIONS` section of `qa_reports/visual_<id>.md` (`content/const-07-design-chain-gates.md:3`), and it is constitutionally QA's own, written at verification time: `content/const-11-design-chain-32.md:11,17`; `content/coord-05-core-visual-drift.md:9` — "Pre-excusing a difference is qa-visual's call alone, recorded in **its own** `## Allowed Differences`"; `content/skill-qa-visual.md:69` — "in THIS report … A coordinator- or builder-authored acceptance is void".

This is the abuse hole, and it is load-bearing. The guard at `:99` ("an actual human-approved divergence on record, not a preference, a guess, or a wish to dodge the round cost") is only as strong as what counts as "on record", and the single concrete artifact the section names is one QA writes itself, in the same round, under authority the constitution grants it. The escape is then: write an `## Allowed Differences` item, cite it as the approved divergence, take `Blocked`. The guard is satisfied on its face and nothing downstream can tell the difference — `blocking_reason` is free text with no server predicate.

The new `content/skill-qa-visual.md:65` pointer makes that misreading the nearest one to hand: it sits two lines above `### Allowed Differences (qa-visual-owned ONLY)` at `:67`, and its compressed trigger ("the assertion describes a source a human has since approved diverging from") drops the AND-conjunct that is the actual guard.

Cost asymmetry compounds it, and the section advertises the asymmetry three times. `FAIL` is capped — the `qa_round` cap routes to pm and locks (`content/const-01-core-head.md:13`, `content/const-06-chain-31-head.md:8`). `Blocked` is counted by nothing: a `Blocked → pm → qa` loop has **no circuit breaker at all**. The rule therefore documents a cheaper *and* uncapped alternative whose only gate is a self-authorable citation.

Fix (one clause, no new mechanism): cite the artifacts that actually carry the human's approval at cut time — the incident's own record is "人類在 cut 階段核准了兩項 sanctioned divergence（D1/D2）" (`research/vs-ndi-button-realign-qa-blocked-dead-end.md:26`), i.e. the PM spec / ticket-cut record, not a QA report — and state explicitly that an `## Allowed Differences` entry in this round's own `qa_reports/visual_<id>.md` does **not** satisfy the guard, because QA authored it.

### Applicability check (no finding — recorded because it is the ticket's purpose)

The decision test proper holds up against the cases it must and must not capture:

| case | pass honest? | fail honest? | test says | correct? |
|---|---|---|---|---|
| Incident: `VSA-BR-05/07` assert superseded Figma focus ring after human-approved D1/D2 | no (impl has no inner ring) | no (blames a human-approved impl) | contract defect → Blocked → pm | yes — matches the live call |
| Ordinary drift: spec `#3C5AAA`, impl `#3D5BAB` | no | yes (spec is still approved truth) | implementation failure → FAIL | yes |
| Coverage gap: impl introduces an unsourced literal | n/a — spec asserts nothing, first conjunct unsatisfiable | yes | implementation failure → FAIL | yes, and `:101` nails it down |
| QA merely disagrees with the spec | no | yes (no approved divergence exists) | implementation failure → FAIL | yes — the AND-conjunct is the guard |

The "write out both verdicts and check each honestly" formulation is applicable to a single concrete assertion row without interpretation, which is the bar the ticket sets. The defects above are in the section's scoping, its terminology, and its evidence pointer — not in the test.

## Quality

### F4 — the addition does not currently earn its bytes; tighten before touching the cap

Measured: `content/skill-qa-engineer.md` 15,121 → 17,971 bytes (**+2,850**). Cap is `assert.ok(qaSize <= 15500, …)` at `test/qa-visual-skill-split.test.mjs:167`. Honoring the file's own documented ~350–550-byte headroom convention, a straight bump lands at ~18,400.

Context. This file is loaded on **every** qa-engineer dispatch (unlike `skill-qa-visual.md`, which is lazy-loaded only when `## Visual Baselines` is present, per `content/skill-qa-engineer.md:57`). And +2,850 is the largest single content addition in the file's cap history — the comment block at `test/qa-visual-skill-split.test.mjs:109-167` records the prior maximum as ~1,780 bytes, for the entire Phase 3.5 AC-Execution phase, which shipped with a server-side PASS gate. This addition is a routing distinction with no server enforcement.

The prose is loose enough that the bump is negotiable:

- **Cost asymmetry stated three times** in five lines — `:91` ("`FAIL` increments `qa_round` toward its cap … `Blocked` does not"), then twice more at `:97` ("This does NOT increment `qa_round` …" / "This DOES increment `qa_round` …").
- **Both definitions given twice** — the Decision-test bullets at `:94`/`:95`, then re-stated inside the WHEN/DO/ELSE parentheticals at `:97` ("ELSE (the spec/design is still correct and the implementation diverges from it, or introduces an unsourced literal)").
- **"a sanctioned divergence has since superseded" three times** — `:94`, `:101`, and `skill-qa-visual.md:65`.
- **Non-operative rhetoric** — "Choose on cost, not instinct." at `:91` is the backlog row's framing sentence, not an instruction; `:91`'s trigger enumeration ends in "or any other spec-derived pass/fail", which makes the enumeration itself decorative (and, per F2, wrong).

The operative content is four things: the two-verdict test with its AND-conjunct, the WHEN/DO/ELSE route, the on-record guard, and the coverage-gap carve-out. Those fit in roughly 1,800–2,000 bytes. Direction for round 2: **tighten first, then bump `15500 → ~17300`** with the house headroom. Do not raise the cap against the current text — the F1/F2/F3 fixes add a clause or two, so the tightening pass and the correctness pass are the same edit.

### Concurrence — leaving `:97`/`:98` (now `:112`/`:113`) as `FAIL` is correct

Explicit agreement with sr-engineer, on a slightly stronger basis than the one argued at `:101`. Two independent reasons:

1. **The decision test cannot reach them.** The contract-defect prong's first conjunct is "the implementation doesn't match what the spec/design **literally asserts**". In a coverage gap the spec asserts nothing about the literal — silent spec — so the conjunct is unsatisfiable and the branch is closed by construction, not by exception.
2. **The implementation genuinely did something wrong.** It introduced an unsourced literal on its own. Charging that to the implementation's own round budget is the correct allocation, and the rows exist specifically to prevent post-hoc ratification (`content/skill-qa-engineer.md:45,51` — "Do NOT let the spec ratify post-hoc; force PM to source the string"). Routing them to `Blocked` would make the cheaper, uncapped status the default for the exact case that should cost something.

No dissent. Note the carve-out paragraph at `:101` is right; it is `:91` that contradicts it (F2).

## Architecture

Layering is correct, with one term-ownership problem already filed as F1.

- **No constitution edit.** Correct: the state machine already carries `qa-engineer:Blocked → pm:In_Progress` (E45, `ad617da`), and role-specific actions belong to skills. Confirmed by diff — no `content/const-*.md` path is touched, so the golden-fixture re-baseline path in CONTRIBUTING "Reading the constitution" does not arm, and `test/compose-equivalence.test.mjs` / `test/skill-manifest.test.mjs` stay green.
- **No numeric restatement of the cap.** The new text says "toward its cap", "does NOT increment", "DOES increment" — never a number. `content/const-01-core-head.md:13` remains the sole authoritative definition, referenced by name. This is the discipline correctly applied. (Pre-existing literals "Round 4"/"Round 3" at `:87` and `:111` predate this ticket and are out of its scope.)
- **The `skill-qa-visual.md` pointer is a pointer, not a copy.** One sentence, one cross-reference, no route, no cost statement, no decision test — the rule keeps one home. The compressed trigger clause is lossy in a way that matters for F3, but the no-duplication call is right.
- **House voice matches.** WHEN/DO/ELSE, `*Escalation Routes: <situation>*` cross-reference, table row shaped like its siblings — consistent with the surrounding SOP.
- The new Escalation Routes row at `:110` is placed adjacent to the existing `Blocked` row, grouping by status. Correct placement.

## Security

No findings. No code, no execution path, no input crossing a trust boundary, no secrets. The nearest analogue to a security concern is the self-certification path in F3, filed under Correctness where it belongs.

## Performance

No findings in the runtime sense — content-only. The context-budget consequence is F4.

Verified the blast radius of the two test failures so qa is not re-deriving it (this closes sr-engineer's stated unverified item):

- **Exactly two byte caps exist on these files**, both in one test: `test/qa-visual-skill-split.test.mjs:167` (`qa-engineer.md <= 15500` — **fails**, 17,971) and `:197` (`qa-visual.md <= 20700` — **passes**, 16,884 after +334). Only the qa-engineer cap needs to move; `skill-qa-visual.md` needs no bump.
- **`test/context-budget.test.mjs` pins `skill-pm` (`:750`) and `skill-sr` (`:814`) only** — no `skill-qa-engineer` entry, and the `teamwork` bundle pin at `:1278` composes the coordinator, not role SOPs. No second budget assertion fires.
- **Row-count pin**: `test/ac-execution.test.mjs:453` (`must stay at 6 data rows`). The number is not the whole fix — the enclosing test name at `:435` and the assertion message both assert *AC6 introduces NO new escalation-table row*, which stays true; the pin must be re-scoped (AC6 added no row; E46 added the contract-defect row → 7) rather than silently renumbered, or the test starts asserting something its own name denies.
- Confirmed by running both files: `# pass 34 / # fail 2`, the two named above and nothing else.

## Verdict

**CHANGES_REQUESTED** — the decision test is sound and the layering is right, but the section collides with `skill-qa-visual.md:24`'s pre-existing opposite-routed use of "contract defect" (F1), scopes itself to the one Phase-3 branch it then excludes while omitting the drift branch it should govern (F2), and grounds its anti-abuse guard in a section that does not exist in the cited file and is QA-self-authored where it does (F3); fold the byte tightening (F4) into the same edit rather than raising the cap against the current prose.

---

## Round 2 — CHANGES_REQUESTED — by code-reviewer

Re-review of the F1–F4 fixes. Each claim was verified against source rather than against the handoff note; three of four are closed, one is half-closed and blocks.

### F1 — closed on the governance surface; sr-engineer's "exactly one file" claim is false and is corrected here

`content/skill-qa-visual.md:24` now reads "**specification ambiguity**, not an implementation defect — and stays `FAIL` per this step: no approved divergence is on record here, so the `Blocked` contract-defect route … does not apply." That is the right fix: it renames off the collided term *and* states the reason it stays `FAIL` in the same sentence, so a reader at Step A.5 cannot route it to `Blocked` by label-matching. The forward pointer names the section. Closed for the two files an agent actually loads.

The handoff note's claim — *"'Contract defect' now has exactly one definition, in exactly one file"* — is **not true repo-wide**. Grep (excluding `dist/`, `node_modules/`, `review_reports/`, `.current/`) still finds the OLD, `FAIL`-routed meaning at five sites:

- `docs/skills/qa-visual.md:69` — "adjudicating a multi-value property as single-choice is a **contract defect**, not an implementation defect"
- `docs/skills/qa-visual.md:168` — "FAIL the surface … (contract defect per §3.2)"
- `docs/skills/qa-visual.md:189` — "FAIL the surface; … Contract defect (§3.2)"
- `docs/skills/qa-engineer.md:73` — "adjudicating it single-choice is a §3.2 contract defect"
- `specs/retro-sop-hardening.md:204` — same claim, historical design doc

Ruling: **not a blocker, and deliberately not sr-engineer's to fix in this diff.** `docs/skills/*.md` are doc-writer-owned mirrors, not a governance surface — they are never composed into a prompt (`prompts/build.ts` reads `content/`), no test pins them (`specs/skill-pm-consolidation.md:235` records `grep -rln "docs/skills" test/` returning zero hits), and `docs/skills/qa-visual.md:2` still cites `content/constitution.md`, a file retired at v3.44.0, so the mirror is independently stale already. Three precedents defer exactly this refresh to doc-writer post-PASS (`specs/c9-protocol-fields.md:208`, `specs/c14-dispatch-pins.md:236`, `specs/skill-pm-consolidation.md:232-236`). Editing them here would also violate the content-only scope this ticket was cut under.

The two instructions in play — "the term must have one meaning repo-wide" and "only the two content files should have moved" — are in tension, and scope wins for the diff. The list above is handed forward for doc-writer's post-PASS pass; it is not a round-3 item.

Not a collision: `tools/transitions.ts:271` and `test/qa-flow.test.mjs:2002` also say "contract defect", both in E45 provenance describing the `Blocked` route — consistent with the new definition.

### F2 — HALF-CLOSED, BLOCKING: the section now names Drift, but Drift still does not name the section

First clause satisfied. `content/skill-qa-engineer.md:91` now opens "A Phase 3a/3b **Drift** call (implementation literal ≠ spec literal) or a Phase 1.5 Structural Assertion row …", matching `:50`'s own wording verbatim, and the decorative catch-all is gone. The `:101` coverage-gap exclusion no longer contradicts the opening. The rule is attached to the branch that genuinely has the shape.

Second clause **not** satisfied — and this is the one that decides whether the rule fires. A reader at the Drift branch still sees only the unqualified FAIL route. Both Drift bullets are unchanged and carry no reference to the new section:

- `:44` (3a) — "**Drift**: implementation text ≠ spec text → FAIL back to sr-engineer with the diff (escalate to Phase 2 round 1, do NOT proceed to Phase 3)."
- `:50` (3b) — "**Drift**: implementation literal ≠ spec literal → FAIL back to sr-engineer with the diff. … the gate catches the inverse — **when code is right but spec was stale** …"

Neither routes through `## Escalation Routes` either, so the agent never passes the new `contract defect` row on its way out. The asymmetry is one line wide and self-indicting: the *Coverage gap* bullets sitting directly beneath each Drift bullet (`:45`, `:51`) both do carry the cross-reference — "→ DO FAIL back to PM per *Escalation Routes: copy coverage gap*". The file's own convention is that a phase step names the route it takes. It is applied to the branch the new rule excludes and withheld from the branch the new rule governs.

Consequence, in the exact shape this ticket exists to prevent: a QA agent working Phase 3b step by step reads "code is right but spec was stale → FAIL back to sr-engineer" and acts on it — charging `qa_round` and re-dispatching an engineer with nothing to fix — without the qualifying rule ever entering the decision. Naming Drift inside the section is a claim about the section; it is not a prompt at the decision point. That is the difference between a rule that is correct and a rule that is applied, and it is the whole content of the E46 backlog row's "it is not written".

Fix — two insertions, ~250 bytes total, no new concepts:

- `:44` → `… → FAIL back to sr-engineer with the diff (escalate to Phase 2 round 1, do NOT proceed to Phase 3). First check § *Contract Defect vs Implementation Failure* — if a sanctioned divergence supersedes the spec's text, this is `Blocked`, not `FAIL`.`
- `:50` → append the same one-sentence check after "…`#3C5AAA`).", worded to "supersedes the spec's literal".

### F3 — closed; escape analysis re-run against the new text, not against the words that changed

Both named targets checked against schema:

- **"the PM/coordinator attestation on the cut-approving `pm:In_Progress` write"** — real and durable. `cut_approved` is a first-class handoff field set by PM on exactly that write, and `scope_decision_why` carries the free-text rationale; both are feature-scoped and preserved across writes that omit them. Confirmed empirically in this very feature: both survived the sr-engineer and code-reviewer writes and are still readable at `hop_count: 4`. Non-QA-authored and predating the QA round, as required.
- **"a PM-authored divergence table in `specs/<feature>.md`"** — not in the required schema. `content/skill-pm.md:17-31` mandates Problem Statement, User Stories, Acceptance Criteria, Copy / Strings, Visual Tokens, Visual Widgets, Out of Scope, Dependencies / Prerequisites, and no divergence table. But that list is a MUST-contain minimum, not a closed set; `specs/<feature>.md` is PM-owned; and PM authoring the approved contract into the spec is precisely the remedy the incident performed (`research/…-dead-end.md:64-65`). Critically, this is **not** a repeat of round 1's failure: the round-1 target named a section that exists *elsewhere under QA's ownership*, and that shadow is what created the self-certification path. "Divergence table" has no QA-authored counterpart anywhere for an agent to grab by mistake. Weaker than the first target, but sound.

Escape analysis re-run from scratch against `:97` as written:

| attempt | outcome |
|---|---|
| Cite own `qa_reports/visual_<id>.md` `## Allowed Differences` | **Closed by name**, with the reason stated ("QA's own, written at verification time … lets QA self-certify the very escape this guard exists to gate") |
| Cite any other QA-authored artifact (`review_<id>.md`, own Region Diff prose) | **Closed categorically** by clause (a) "NOT authored by qa-engineer" — the general rule is stronger than round 1's example-only form |
| Claim `Blocked` with no citation at all | **Closed explicitly** — "No qualifying artifact on record → the claim is an implementation failure wearing a cheaper label; FAIL it" |
| Cite a code-reviewer- or sr-engineer-authored note asserting a divergence | Passes (a) and (b) literally; gated only by `:94`'s "a human already approved". See note N-1 |

The finding is closed: the self-certification path F3 named is shut both by name and by category, and the no-citation fallthrough fails safe toward `FAIL`.

Placement is right, which was the other half of the ask. The disqualification is not in a footnote — it is inside the same sentence that authorizes `Blocked` (`:97`), so an agent cannot reach the authorization without reading it. The route in is `content/skill-qa-visual.md:65`, which sits two lines above `### Allowed Differences (qa-visual-owned ONLY)` — the shortcut's own doorstep — and forwards to that sentence.

### F4 — closed; tightening cost no operative content

Measured: the new section (`:89`–`:101`) is **1,997 bytes**, inside the 1,800–2,000 target. `content/skill-qa-engineer.md` 17,211; `content/skill-qa-visual.md` 17,007 (under its 20,700 cap — no bump, as corrected in round 1).

Audited what was cut, since a guard lost to a byte target is the worse outcome:

- **AND-conjunct survived** — `:94` still reads "`pass` would be a falsehood … AND `fail` would blame an implementation doing exactly what a human already approved". This is the load-bearing clause that keeps mere disagreement out of `Blocked`; it is intact.
- **Cost asymmetry** now stated once (`:91`) instead of three times. The fact is operative; two of the three statements were not.
- **Round-1 standalone guard paragraph** ("not a preference, a guess, or a wish to dodge the round cost") folded into `:97` as the no-qualifying-artifact fallthrough. Net strengthening — the test moved from a disposition to a checkable artifact.
- **Both definitions** stated once instead of twice; coverage-gap carve-out retained and sharpened.
- One genuine, minor loss: round 1's "so PM can rewrite the assertion to describe the approved behavior rather than it being adjudicated unilaterally at verification time" is gone, so the section no longer says what PM does on receipt. Covered by the `next_role: pm` row plus Constitution §3.1 Amend-Resume. Non-blocking; restore only if it fits inside the cap being set.

**Cap guidance, revised — do not use 17300.** At 17,211 actual, a 17300 cap leaves 89 bytes, far under this test's own documented ~350–550-byte headroom convention (`test/qa-visual-skill-split.test.mjs:109-167`), and the F2 fix above adds ~250 more bytes. Set the cap **once, after round 3 lands, at 17900** (~440 bytes of headroom over the expected ~17,460) rather than bumping twice. Measured size plus convention headroom — not tighter, and not a round number chosen before the content is final.

### Verification and scope

- Scope clean: `git diff --name-only` = `content/skill-qa-engineer.md`, `content/skill-qa-visual.md`, plus governance state (`.current/handoff.md`, `tasks.md`). No third file. The `qa_round`-capped-vs-uncounted-`Blocked` asymmetry is correctly **absent** from this diff, carried forward to its own ticket as directed.
- Tests re-run: `# pass 34 / # fail 2` — `test/ac-execution.test.mjs:453` row-count pin and `test/qa-visual-skill-split.test.mjs:167` byte cap, the same two as round 1 and nothing new. Both remain qa-engineer's, with the round-1 corrections standing: bump `skill-qa-engineer.md` only, and re-scope the AC6 assertion rather than renumbering it (its test name at `:435` asserts "introduces NO new escalation-table row", which stays true of AC6 — attribute the 7th row to E46).

### Notes (non-blocking)

- **N-1** — `:97`'s clauses (a) non-QA-authored and (b) predates the round are *necessary*, not *sufficient*: a code-reviewer or sr-engineer note asserting a divergence satisfies both literally. Sufficiency comes from `:94`'s "a human already approved", which the WHEN clause reaches by back-reference ("WHEN both verdicts are dishonest"). The chain holds for a whole-section reader; a reader who stops at (a)/(b) could admit a non-human approval. Worth one clause ("human-approved") in the citation sentence if this section is ever reopened — not worth a round on its own.
- **N-2** — doc-writer backlog, post-PASS: the five stale "contract defect" sites listed under F1, plus `docs/skills/qa-visual.md:2`'s reference to the retired `content/constitution.md`.

### Round 2 verdict

**CHANGES_REQUESTED** — F1, F3, and F4 verified closed on the surfaces that matter, and the tightening cost no guard; the single blocker is F2's second half: the section names the Drift branch but neither Drift bullet (`:44`, `:50`) names the section, so an agent working Phase 3a/3b in order still meets only the unqualified FAIL → sr-engineer route at the exact decision point this ticket exists to govern. Two sentences, ~250 bytes, then set the byte cap once at 17900.

---

## Round 3 — APPROVED — by code-reviewer

Single-blocker re-review of the F2 fix.

### File attribution — sr-engineer's judgement was correct

The relayed instruction placed the `:44`/`:50` Drift bullets in `content/skill-qa-visual.md`. They are in `content/skill-qa-engineer.md` — `:44` is the Copy Audit Gate (3a) Drift bullet, `:50` the Visual Audit Gate (3b) Drift bullet; `skill-qa-visual.md` has no Drift bullets of that form at all. Round 2's report quoted both lines verbatim with their file, so the source of truth was unambiguous. sr-engineer went by the quoted text over the relayed line and edited the correct file. That is the right call — a relay that contradicts the cited artifact loses to the artifact — and the diff differing from the literal instruction is the correct outcome, not a scope violation.

### F2 — CLOSED

Both bullets now carry the cross-reference:

- `:44` — "… (escalate to Phase 2 round 1, do NOT proceed to Phase 3). **First check § *Contract Defect vs Implementation Failure* — if a sanctioned divergence supersedes the spec's text, this is `Blocked`, not `FAIL`.**"
- `:50` — same sentence, "supersedes the spec's **literal**", after the `#3D5BAB`/`#3C5AAA` example.

Against the round-2 standard — the agent must meet the rule on its way out, not have to already know the section exists — this is closed. The rule is now inside the bullet the agent is reading when it makes the call; nothing about it depends on having read ahead to `:89`.

On sequencing: the pointer is positionally *after* the FAIL clause and reorders itself with the imperative "First check". Positional-first would read marginally better, but a bullet is an atomic unit — an agent reads it whole before acting — and the explicit ordering word carries the sequencing. Cosmetic, not operative.

On convention parity with the neighbouring Coverage-gap bullets (`:45`, `:51`): those name their route by italic cross-reference inside the bullet ("per *Escalation Routes: copy coverage gap*"). The new sentence does structurally the same thing — a named section cross-reference in the file's italic style, inside the bullet, gating the action. It matches the convention rather than merely sitting near it. The `§ *…*` prefix is a minor style variance from the file's bare `*…*` form, but it is consistent with the two pointers this ticket added to `skill-qa-visual.md` (`:24`, `:65`), so the ticket is internally uniform.

### Compression of the pointer — safe, no restatement of the guard needed

The appended clause drops the AND-conjunct and the citation requirement, so the question is whether it can route to `Blocked` a case the full test would send to `FAIL`. It cannot, for two reasons:

1. **The trigger is a strict subset, not a loosening.** It fires on "a **sanctioned** divergence supersedes the spec's text/literal" — not on "the spec looks wrong" or "the spec is stale". If a sanctioned divergence genuinely supersedes the spec text, then by construction the implementation is doing the approved thing and the assertion is stale, so both prongs of `:94`'s test hold. The compressed condition *implies* the full test rather than widening it. This is the structural difference from the F1 label-matching failure: F1 collided two rules sharing a **label**, where matching the label bypassed the test; here the pointer's trigger is a **condition** that entails the test.
2. **It fails safe on the residual.** The case that could slip is an agent reading "code is right but spec was stale" (`:50`'s own inverse case) as if staleness alone were sanction. That agent has been told in the same sentence to check the section, where `:97`'s "No qualifying artifact on record → the claim is an implementation failure wearing a cheaper label; FAIL it" catches it. The failure direction is toward `FAIL`, which is the correct default.

No restatement of the guard in the pointer is warranted — restating the citation requirement at two call sites is the duplication F4 spent a round removing, and it would re-open the one-rule-one-home question F1 was about. Non-blocking refinement if the line is ever touched again: "a sanctioned divergence **on record**" would close the residual in ten bytes. Not worth a round.

### Bytes — 17900 confirmed

`content/skill-qa-engineer.md` is 17,512 (the two sentences cost 301 bytes against a ~250 prediction; the `## Contract Defect vs Implementation Failure` section itself is untouched this round, both edits landing in the pre-existing 3a/3b bullets). A 17900 cap leaves **388 bytes**, inside this test's documented ~350–550-byte convention (`test/qa-visual-skill-split.test.mjs:109-167`).

I considered 18000 (488 bytes, mid-convention, a rounder number) and rejected it. This cap is a context-budget guard, and for a budget guard the tighter end of a compliant range is the better default: headroom is precisely the amount of unreviewed growth the next edit can take without anyone deciding to allow it. 388 bytes still absorbs a one-bullet SOP amendment without forcing a re-bump, and the file's own history shows a 172-byte headroom bump (v3.40.0) shipping acceptably. **Set 15500 → 17900, once, this round.** `content/skill-qa-visual.md` stays at 17,007 under its 20,700 cap — no bump.

### Scope and verification

- `content/skill-qa-engineer.md` is the only source file that moved this round. `content/skill-qa-visual.md` still shows its round-2 hunks (3 insertions, 1 deletion) and is byte-identical at 17,007 — unchanged, as claimed.
- `.current/telemetry.jsonl` appears in `git diff --name-only`; it is server-written, not an sr-engineer edit. The appended line is `{"ts":"2026-08-10T06:25:20.921Z","gate":"validateTransition","error_code":"TRANSITION_REJECTED","agent_id":"code-reviewer","feature":"e46-qa-spec-defect-status-rule"}` — my own round-2 write attempted before claiming the review, correctly rejected by `ALLOWED_TRANSITIONS`. Recorded so qa does not chase it as a product defect.
- The `qa_round`-capped-vs-uncounted-`Blocked` asymmetry and the five stale `docs/skills/*` + `specs/retro-sop-hardening.md:204` sites are correctly absent, per the coordinator's ownership calls.
- Tests re-run: `# pass 34 / # fail 2` — the same two qa-owned failures as rounds 1 and 2, nothing new.

### Handoff to qa-engineer

1. `test/qa-visual-skill-split.test.mjs:167` — cap `15500 → 17900`, with a dated comment in the file's established convention recording the measured 17,512 and the 388-byte headroom. `:197` (qa-visual, 20700) unchanged.
2. `test/ac-execution.test.mjs:453` — **re-scope, do not renumber**. The enclosing test name at `:435` asserts "AC6 … introduces NO new escalation-table row", which stays true of AC6; attribute the 7th row to E46 in the assertion message so the test does not assert something its own name denies.

### Round 3 verdict

**APPROVED** — the sole round-2 blocker is closed at the decision point, in the correct file, matching the neighbouring bullets' cross-reference convention; the pointer's compression is sound because its trigger entails the full test and its residual fails toward `FAIL`; scope is clean and the byte cost is justified at a 17900 cap.
