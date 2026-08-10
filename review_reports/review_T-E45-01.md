# Review — T-E45-01

covers: T-E45-01

## Round 1 — CHANGES_REQUESTED — by code-reviewer

## Summary

- E45 option A (loose variant): `{ agent: "pm", status: "In_Progress" }` added to the `qa-engineer:Blocked` row of `ALLOWED` (`tools/transitions.ts:269`) plus a 20-line v3.95.0 provenance comment (`:249-268`); one matrix cell mirrored in `specs/qa-flow-enforcement-architecture.md:161`. Exactly the two sanctioned files.
- **The code is correct.** Verified by direct execution against the compiled `dist/`: the edge accepts, no sibling edge opened, all three round-cap overrides byte-identical, `computeNewRound` semantics unchanged, no forward-flow skip of code-reviewer/qa-engineer, build-entry gates unaffected. Full suite 1633/1633; `dist/tools/transitions.js` reproduces byte-identically from a clean `npm run build` (no hand-edited output).
- **The comment is not.** Its central "why it bites" claim — that skill-qa-engineer's Escalation Routes prescribe `status=Blocked` + `next_role: pm` for spec defects — is **false against `content/skill-qa-engineer.md` in every git revision**. Both spec-defect rows prescribe `status=FAIL` + `next_role: pm`, and `qa-engineer:FAIL → pm:In_Progress` already exists. As written, the comment tells a future maintainer to verify a prescription that is not there — and a maintainer who checks will find the cited route already works, i.e. the comment argues *against* its own edge.
- Second, smaller: the self-reference `(:250-253)` for the `qa-engineer:FAIL` row is stale. This diff shifted that row to `:271-274`; `:250-253` now points inside the new comment block itself.
- Verdict: CHANGES_REQUESTED — comment-text only. The one-line matrix change and the spec mirror are both approved as-is and must not be re-worked.

## Correctness

**C-1 (blocking) — `tools/transitions.ts:252-254`: the comment asserts a prescription that does not exist in the cited file.**

The comment claims:

> skill-qa-engineer's own Escalation Routes prescribe status=Blocked + next_role: pm for spec defects

`content/skill-qa-engineer.md:93-100` — the complete Escalation Routes table:

| situation | status | next_role |
|---|---|---|
| awaiting sr-engineer round | **Blocked** | **sr-engineer** |
| unresolved after Round 3 | FAIL | pm |
| copy coverage gap | **FAIL** | pm |
| visual token coverage gap | **FAIL** | pm |
| expected-red diff regression | FAIL | sr-engineer |
| Phase 4 FAIL | FAIL | sr-engineer |

There is exactly ONE `Blocked` row and it routes to **sr-engineer**, not pm. The two spec-defect rows the backlog E45 row names explicitly (*copy coverage gap*, *visual token coverage gap*) prescribe `FAIL`. `git log -S'copy coverage gap' -- content/skill-qa-engineer.md` returns a single commit (`b7e13f4`, a11) which introduced both rows as `FAIL` — the claim was never true, so this is not "the SOP drifted". `content/skill-qa-visual.md` (the Phase 1.5 sub-skill actually implicated in the live incident) contains **zero** occurrences of `Blocked`; all seven of its STOP routes are `FAIL`.

Why this matters beyond pedantry: `FAIL → pm:In_Progress` **already exists** in `ALLOWED` (`:271-274`). If the two coverage-gap rows really were the justification, this ticket would be unnecessary. The comment therefore documents the edge with a rationale that, when checked, refutes the edge. This is precisely the E39 failure class the repo has already paid for once ("a mirror that is silently wrong is worse than no mirror"), and it is the more durable copy of an error that has already propagated three hops: `research/vs-ndi-button-realign-qa-blocked-dead-end.md:99-100` → `docs/backlog.md:164` → `.current/handoff.md` `scope_decision_why` → this comment. The research doc and the backlog row are out of E45's sanctioned scope and must be left alone; the comment is in scope and is the copy that outlives them.

The true and sufficient rationale, which the corrected comment should state:

- QA reaches `Blocked` legitimately and by the book — `content/const-05-core-standards.md:19` (*Escalation call format*) sanctions `status=Blocked` for an escalation halt, and `content/skill-qa-engineer.md:18` mandates `status=Blocked` when awaiting another role.
- The live incident (`research/vs-ndi-button-realign-qa-blocked-dead-end.md` §2.1) is a contract defect that could honestly be marked neither `pass` (writes a falsehood into the evidence trail) nor `fail` (blames an implementation doing exactly what the human approved), so QA correctly halted at `Blocked` — and from there PM was unreachable while all six peer `<role>:Blocked` states could reach PM.

That argument stands on the incident and on the six-row asymmetry, both of which I verified independently and both of which are already in the comment. Only the skill-qa-engineer sentence has to go or be corrected.

**C-2 (blocking, minor) — `tools/transitions.ts:257`: stale intra-file line cite.**

`// (:250-253) already exists` — after this diff, `qa-engineer:FAIL` is at `:271-274`; lines 250-253 are now the comment's own text. The edit shifted the row by 21 lines and the cite was not re-checked. House style keeps these accurate: E37's neighbouring comment cites `(:177)` for the `null:null` design-auditor entry (correct), and the E45 comment's own `specs/qa-flow-enforcement-architecture.md:161` cite is correct (verified — line 161 is the `qa-engineer | Blocked` row).

**No correctness findings against the code itself.** Executed probes against the freshly rebuilt `dist/`:

| probe | result |
|---|---|
| `qa:Blocked → pm:In_Progress` | ACCEPT (the ticket) |
| `qa:Blocked → pm:Blocked` | TRANSITION_REJECTED (no over-open) |
| `qa:Blocked → architect / code-reviewer / release-engineer` | TRANSITION_REJECTED |
| `pm:IP → qa-engineer:IP` and `→ code-reviewer:IP`, no `resume_of` | TRANSITION_REJECTED (unchanged) |
| `pm:IP → qa-engineer:IP` with `resume_of="qa-engineer"` | ACCEPT (step 3.5, unchanged) |
| `sr:IP → qa-engineer:IP` | TRANSITION_REJECTED (code-reviewer still unskippable) |

**Precedence-order interaction (steps 1 → 2 → 2.5 → 3 → 3.5 → 4).** The change is confined to step 4's static table; nothing upstream reads the row.

- **§1 agent-id**: unaffected (operates on `next.agent` nullability/validity only).
- **§2 round caps**: all three (`:389`, `:400`, `:415`) hard-code `onlyAllowed = [{pm, In_Progress}]` and `return null` for the pm landing *before* the table is consulted, so `pm:In_Progress` from `qa-engineer:Blocked` was already accepted at cap and every non-pm candidate was already rejected. Confirmed empirically: `qa_round=4` `qa:Blocked → sr` → `QA_ROUND_EXCEEDED`; `review_round=4` `qa:Blocked → qa:IP` → `REVIEW_ROUND_EXCEEDED`; `visual_round=6` `qa:Blocked → pm` → ACCEPT. Rejection envelopes byte-identical (their `allowed` array is the local literal, not the table row).
- **§3 self-loop**: requires `prev.status === "In_Progress"`; `prev.status` is `Blocked` here, so the fast path never fires from this row. Unaffected.
- **§3.5 Amend-Resume**: requires `prev.agent === "pm"`. Unaffected. Correctly *unchanged* in the other direction too — this ticket does not make PM's return leg to QA any easier; `resume_of` still gates it.

**§2.5 HOP_CAP / E41 — partly resolved, and E41's own text is now stale.** The `HOP_CAP` branch (`:438-451`) excludes `(pm, In_Progress)` from its rejection and falls through to the table, so the escape exists only if the row carries a pm entry. E41 enumerates three rows lacking one: `code-reviewer:In_Progress`, `qa-engineer:In_Progress`, `qa-engineer:Blocked`. Measured at `hop_count=10`:

- `code-reviewer:In_Progress → pm:In_Progress` — still `TRANSITION_REJECTED`
- `qa-engineer:In_Progress → pm:In_Progress` — still `TRANSITION_REJECTED`
- `qa-engineer:Blocked → pm:In_Progress` — **now ACCEPT** (was `TRANSITION_REJECTED`)

So: E41's **root cause is unchanged** (`HOP_CAP` still falls through to the table instead of unconditionally allowing the landing, unlike the three round caps), its **blast radius shrinks from three rows to two**, and its backlog text's row enumeration ("the three rows that have no direct `pm` entry — …, `qa-engineer:Blocked`") is now **factually stale**. That is not a defect in this diff — `docs/backlog.md` is out of scope by explicit decision — but E41's row must be re-derived when E41 is picked up, or its reviewer will re-confirm a symptom that no longer reproduces from one of the three cited states. Recorded here for the handoff, not as a required change. `hop_count=10` `qa:Blocked → sr:IP` still returns `HOP_CAP_EXCEEDED`, confirming the cap itself is not weakened.

**`computeNewRound` counter semantics.** A `(pm, In_Progress)` landing zeroes `qa_round`, `review_round` and `visual_round` (`:560`, `:570`, `:584`), preserves the three `*_rounds_total` mirrors, and increments `hop_count` as a role transition. This diff does create a *new* path to that reset. Measured: `computeNewRound(3, 2, 5, pm:IP, qa:Blocked, [], hop=7, totals 9/8/7)` → `{qa_round:0, review_round:0, visual_round:0, hop_count:8, qa_rounds_total:9, review_rounds_total:8, visual_rounds_total:7}`. Correct, and not a laundering hole:

- The reset is the shared, intended semantics of PM re-entry — identical on `qa-engineer:FAIL → pm` and on all six peer `Blocked → pm` edges.
- A counter-reset path from `qa-engineer:Blocked` that skips a `qa_round` increment **already existed** at two hops (`qa:Blocked → sr-engineer:In_Progress → pm:In_Progress`, `:247` + `:222`). This shortens it to one hop; it opens no new capability class.
- The pre-existing "`Blocked` is a non-counting `FAIL`" property of the `qa:In_Progress → qa:Blocked → sr-engineer` route is untouched by this diff and is not E45's to fix.

**No unintended route.** The complete delta in reachability is: from `(qa-engineer, Blocked)`, the write `(pm, In_Progress)` is now accepted. Nothing else. It is a *backward* edge; the successor set of `pm:In_Progress` is unchanged (`architect`, `sr-engineer`, `researcher`, `design-auditor`, `pm:Blocked`, `pm:In_Progress`), and reaching `code-reviewer` or `qa-engineer` from PM still requires `resume_of` (step 3.5), so a code-bearing forward flow still cannot skip either judge — verified by probe. Build-entry gates still fire normally on the subsequent hop: `SCOPE_DECISION_REQUIRED`, `CUT_APPROVAL_REQUIRED` and `EXTERNAL_REFS_UNRESOLVED` all key on `prevTuple = (pm, In_Progress)` **and** `nextTuple.agent ∈ {architect, sr-engineer}` (`tools/handoff-orchestrator.ts:456-462` and siblings), so (a) the `qa:Blocked → pm` write itself arms none of them — it is not a build-entry edge — and (b) the following `pm → {architect, sr-engineer}` hop arms all three exactly as before. `cut_approved` is additionally re-armed by the landing itself: `tools/handoff-write.ts:258-261` sets it `undefined` on every `pm`/`In_Progress` write that does not explicitly re-attest, so a PM arriving through the new edge cannot inherit a stale approval.

## Quality

No findings on the code. The entry is placed last in the row, matching the C13/E37 convention of appending new edges after the incumbents, and the spec mirror preserves that order (`(sr-engineer, In_Progress), (qa-engineer, In_Progress), (pm, In_Progress)`).

Two notes on the comment, both non-blocking, to fold into the C-1/C-2 fix:

- 20 lines of comment for a one-line data change is at the top of the house range (C13 ≈ 4 lines, E37 ≈ 11). Once the false skill-qa-engineer sentence is removed the block gets shorter on its own; no further trimming is required.
- `research/vs-ndi-button-realign-qa-blocked-dead-end.md`, cited at `:259-260`, is currently **untracked** (`git status` → `??`). The cite is fine as long as the file is committed with the ticket; if it is deliberately left uncommitted the comment's only external pointer dangles. Flagging for the commit/release step, not a change request against sr-engineer.

Verified accurate and requiring no change:

- "the other six `<role>:Blocked` rows … all have `Blocked → pm:In_Progress`; this was the only one missing it" — confirmed by programmatic enumeration of `ALLOWED`. Seven `:Blocked` rows exist (`release-engineer` has none): researcher, design-auditor, pm, architect, sr-engineer, code-reviewer all carry `pm:In_Progress`.
- "`resume_of` is the PM RETURN-leg field gating `(pm, In_Progress) → {code-reviewer, qa-engineer}` … step 3.5 of `validateTransition`" — matches `tools/transitions.ts:372` and `:463-481` and the spec's *Amend-Resume Edge* paragraph.
- "none [of the six peers] require `resume_of` to reach pm" — confirmed; `resume_of` is read only in the step-3.5 branch, which requires `prev.agent === "pm"`.
- "Mirrored in `specs/qa-flow-enforcement-architecture.md:161`" — correct line, correct content.
- `v3.95.0` stamp — `package.json` is at `3.94.0`; next-minor is the right forward-looking stamp, matching how E37 stamped `v3.94.0`.

## Architecture

No architecture spec exists for E45 (mini-chain, backlog row is the spec). The change respects the layering: `tools/transitions.ts` stays pure and fs-free — the new entry is static data, no state read, no storage-mode branch, identical in file and SQLite/HTTP mode.

The mirror obligation declared at `tools/transitions.ts:3-4` is discharged correctly and minimally. `specs/qa-flow-enforcement-architecture.md:161` is byte-accurate against the row, in the same order, and the surrounding table was left untouched — it still lacks the `design-auditor` and `code-reviewer` row groups and still lists qa-engineer as an `sr-engineer | In_Progress` successor. That staleness is E39's, correctly not folded in. E39 (full re-derive), E41 (HOP_CAP), `content/`, `docs/backlog.md` and `test/` were all left alone as instructed.

Scope discipline: clean. Working tree carries `tools/transitions.ts`, `specs/qa-flow-enforcement-architecture.md`, the three `dist/tools/transitions.*` build artifacts (required — `dist/` is committed and shipped), `.current/handoff.md` and `tasks.md` (governance ledgers, `tasks.md` adds only the `T-E45-01` row). `docs/backlog.md` carries the E45 row and revision note but its mtime (12:42) precedes the implementation window (13:31–13:34) — cut-time authorship, and the row is this ticket's spec, so it must have predated the work. No source file outside the two sanctioned ones was touched.

Test ownership (§2) respected: no `test/` file created or modified. The suite is green *because* the change is purely additive — no existing pin asserts the `qa-engineer:Blocked` row's exact membership, so nothing needed flipping. The positive-accept and row-exact pins named in T-E45-01 remain qa-engineer's to author; note for QA that the strongest pin here is a row-equality assertion (the E37 `T-MATRIX-C13` shape at `test/qa-flow.test.mjs:1841`), since without one the next additive edit to this row is again unpinned.

## Security

No findings. No trust boundary crossed, no input parsed, no secret, no fs or network access — the diff adds one frozen object literal to an in-memory map and one table cell to a markdown doc.

Worth stating explicitly given the subject matter: this edge *widens* an authorization matrix, so it deserves the check, and it passes. It grants a strictly backward hand-off to PM from a halted QA state. It grants no forward progress, cannot be used to reach a judge role (step 3.5 still gates those), does not weaken any cap (round caps outrank the table; `HOP_CAP_EXCEEDED` still fires from this row for non-pm targets), and cannot be used to launder a completion — `status="PASS"` remains `qa-engineer`-only and `tw_complete_task` is unchanged.

The 11 pre-existing `npm audit --audit-level=high` advisories (js-yaml, sharp/libvips via `@xenova/transformers`, protobufjs) are noted and out of scope: `package.json` and `package-lock.json` are untouched by this diff.

## Performance

No findings. `ALLOWED` is a module-level `Map` built once at import; the row grows from 2 entries to 3, and step 4's `allowed.some(...)` is a linear scan over that row — 3 comparisons instead of 2, on a code path that runs once per state write. No complexity-class change, no new allocation, no regression vs base.

## Verdict

**CHANGES_REQUESTED** — the one-line matrix edit and the spec mirror are correct and approved as-is, but the provenance comment states as fact a prescription that `content/skill-qa-engineer.md` has never contained (C-1) and carries a line cite this diff itself invalidated (C-2); both are in the sanctioned file and both are comment-text-only fixes.

### Required changes (comment text only — do not touch the data entry or the spec mirror)

1. `tools/transitions.ts:252-254` — remove or correct the claim that skill-qa-engineer's Escalation Routes prescribe `status=Blocked` + `next_role: pm` for spec defects. Its Escalation Routes table has one `Blocked` row and it routes to sr-engineer; the two spec-defect rows route `FAIL → pm`, an edge that already exists. Replace with the accurate justification: `Blocked` is QA's sanctioned escalation halt (`content/const-05-core-standards.md:19` *Escalation call format*; `content/skill-qa-engineer.md:18`), the live incident's contract defect was honestly markable neither `pass` nor `fail`, and from that halt PM was unreachable while all six peer `Blocked` states could reach it.
2. `tools/transitions.ts:257` — update the stale `(:250-253)` cite for the `qa-engineer:FAIL` row to its post-edit location (`:271-274`, or whatever it lands at after change 1 resizes the block), or drop the numeric cite and name the row key instead so it cannot rot again.

No test change is implied by either fix, and neither alters compiled behaviour — `npm run build` and a re-run of the suite are sufficient re-verification.

---

## Round 2 — APPROVED — by code-reviewer

## Summary

- Both round-1 blocking findings are genuinely closed. The change since round 1 is comment text in `tools/transitions.ts` only (block grown from ~20 to ~39 lines, `:249-287`).
- **The code did not move.** Mechanically verified: stripping all `//` lines from the working-tree file and from `HEAD` leaves exactly ONE delta — `{ agent: "pm", status: "In_Progress" },`. Nothing else in the module changed in either round.
- Re-verified end to end: edge accepts, no sibling edge opened, judge-skip probes still reject, round-cap override still outranks the table, `specs/qa-flow-enforcement-architecture.md:161` still byte-accurate, `dist/tools/transitions.js` reproduces byte-identically from a clean build, suite 1633/1633.
- The two coordinator-authored propagation edits (research doc §4 勘誤, `docs/backlog.md` E45 row + preamble) check out against source on every factual claim. Three copies of the corrected rationale now agree with each other and with `content/skill-qa-engineer.md`.
- Five non-blocking notes below, **none of them sr-engineer's** — four are coordinator-owned bookkeeping, one is carried forward from round 1. Verdict: APPROVED.

## Correctness

**F1 — CLOSED.** The false citation is gone. The replacement text (`tools/transitions.ts:257-262`) states the position accurately and, unusually and correctly, states it *against* its own change:

> To be precise about what content/skill-qa-engineer.md's Escalation Routes actually say (its ONLY Blocked row routes to sr-engineer, not pm; the two spec-defect rows — copy coverage gap, visual token coverage gap — both prescribe FAIL -> pm, an edge that already existed): this change does not restore a broken SOP-prescribed route.

Every claim re-verified against source this round:

| claim | source | verdict |
|---|---|---|
| only `Blocked` row routes to sr-engineer | `content/skill-qa-engineer.md:95` | true |
| copy coverage gap → `FAIL`, pm | `content/skill-qa-engineer.md:97` | true |
| visual token coverage gap → `FAIL`, pm | `content/skill-qa-engineer.md:98` | true |
| that `FAIL → pm` edge already existed | `tools/transitions.ts:289-292` | true |
| six peer `<role>:Blocked` rows carry `pm:In_Progress`; this was the only one missing | programmatic enumeration of `ALLOWED` | true |
| `FAIL` charges the `qa_round` budget | `tools/transitions.ts:558` | true |
| live incident shape (sanctioned divergence, `pass`=falsehood / `fail`=blames compliant impl, ATTRIBUTION NOTE on a qa write) | research doc §2.1, §2.3 | matches |
| `resume_of` is the PM return-leg field, step 3.5 | `tools/transitions.ts:372`, `:463-481` | true |
| mirrored at `specs/qa-flow-enforcement-architecture.md:161` | that file | true |

The rewritten argument now rests on the two propositions that survive scrutiny — the six-row asymmetry and the live incident's defensible `Blocked` reading — and explicitly disclaims the one that did not. That is a stronger comment than the round-1 draft would have been even if its citation had been true.

**F2 — CLOSED.** `(:250-253)` is replaced by `the "qa-engineer:FAIL" row below`, a name-based reference. It is accurate (that row is at `:289-292`, below) and structurally rot-proof — which matters, because this round's comment expansion moved that row a second time, from `:271-274` to `:289-292`. A numeric cite would already be stale again.

**No code movement.** `diff` of the comment-stripped working tree against comment-stripped `HEAD` yields a single added line — the `ALLOWED` entry. Behaviour re-probed against the rebuilt `dist/`: `qa:Blocked → pm:In_Progress` ACCEPT; `qa:Blocked → pm:Blocked` TRANSITION_REJECTED; `pm:IP → qa:IP` without `resume_of` TRANSITION_REJECTED; `sr:IP → qa:IP` TRANSITION_REJECTED; `qa_round=4` `qa:Blocked → sr` QA_ROUND_EXCEEDED; row membership `sr-engineer:In_Progress, qa-engineer:In_Progress, pm:In_Progress`. Identical to round 1. The full round-1 precedence, HOP_CAP/E41, `computeNewRound` and gate-arming analysis stands unchanged and is not restated here.

**Coordinator edit 1 — `research/vs-ndi-button-realign-qa-blocked-dead-end.md` §4.** The 勘誤 block is accurate on all five of its assertions (the `:95` / `:97-98` cites, the `FAIL → pm` pre-existence, the single-commit `b7e13f4` provenance, and the statement that both downstream copies were corrected — which I confirmed independently). Preserve-by-correction rather than deletion is the right call for a field report. The restated argument ("SOP 的明文處方本來就走得通；缺口是另一條路徑") is consistent with the code comment and with the backlog row.

**Coordinator edit 2 — `docs/backlog.md` E45 row + preamble.** The correction clause is accurate on every source-checkable claim (`:95`, `:97-98`, `git log -S'copy coverage gap'` → one commit `b7e13f4`, both rows `FAIL` from the start). The reframing — two defensible status expressions for "the spec is wrong", one of which had no route — matches the code comment's framing without contradicting it. One stale cite, N-1 below.

Consistency across the three copies: no disagreement found. All three say the SOP prescribes `FAIL → pm`, that this edge already existed, that the only `Blocked` row routes to sr-engineer, and that the gap is the `Blocked` reading rather than a broken documented route.

## Quality

Five notes, **all non-blocking and none actionable by sr-engineer**. Listed for the coordinator's bookkeeping pass; none justifies another review round.

- **N-1 (coordinator-owned, same class as F2) — `docs/backlog.md:167`.** The correction clause cites the pre-existing `FAIL → pm` edge as `(:271-274)`. That was its position when I wrote the round-1 report; this round's comment expansion moved it to `:289-292`, so the cite is stale by 18 lines. It is also ambiguous: it appears immediately after a `content/skill-qa-engineer.md:97-98` cite with no intervening filename, so it reads as a line range in that ~100-line file. Suggest `tools/transitions.ts` `"qa-engineer:FAIL"` row, name-based — the same fix F2 just applied one file over.
- **N-2 (coordinator/PM-owned) — `.current/handoff.md:9`, `scope_decision_why`.** A fourth, uncorrected copy of the original claim survives here: *"making Constitution 3.1 Amend-Resume reachable from the state skill-qa-engineer's Escalation Routes actually prescribe for spec defects."* It is blind-preserved on every same-feature write and is the copy every agent on this ticket reads via `tw_get_state` — currently the highest-traffic one. It is feature-scoped and dies on the next `active_feature` change, and it is PM's attestation field, so neither sr-engineer nor I should rewrite it; flagging so the coordinator can decide whether to correct it before close.
- **N-3 (soft residue) — research doc, the paragraph following the restated argument.** *"現行 SOP 已經有兩列 Escalation Route 寫著 `next_role: pm`"* — three rows route to pm (`unresolved after Round 3`, plus the two coverage gaps), not two; and juxtaposing those `FAIL` rows with "從 `qa-engineer:Blocked` 出發…走不到" re-implies the very conflation the 勘誤 above it just corrected. Technically defensible under its explicit `從 qa-engineer:Blocked 出發` conditional, and the 勘誤 inoculates a careful reader, but a skimmer lands back on the original error.
- **N-4 (carried from round 1, unchanged) — `docs/backlog.md:164`, E41.** Still enumerates three rows lacking a direct `pm` entry; after this ticket there are two (`code-reviewer:In_Progress`, `qa-engineer:In_Progress`). Re-derive when E41 is picked up.
- **N-5 (carried from round 1) — commit hygiene.** `research/vs-ndi-button-realign-qa-blocked-dead-end.md` is still untracked and is the comment's only external pointer; commit it with the ticket.

Comment length is now ~39 lines for a one-line data change, well above the C13 (~4) / E37 (~11) house range. I am not asking for a trim: the length is spent on a correction that a future maintainer would otherwise have to re-derive from `git log`, and the block is the ticket's primary durable artifact. Noting it so the next editor of this row knows the bar was consciously raised here and need not match it.

## Architecture

Unchanged from round 1 and still correct. `tools/transitions.ts` stays pure and fs-free; the mirror obligation at `:3-4` is discharged minimally at `specs/qa-flow-enforcement-architecture.md:161`; the surrounding E39-stale table, E41, `content/`, and `test/` are untouched by sr-engineer.

Scope: sr-engineer's round-2 delta is `tools/transitions.ts` comment text plus the required `dist/` rebuild — nothing else. The `docs/backlog.md` and research-doc edits are coordinator-authored propagation of a review finding, disclosed in advance, and are correctly *not* charged against sr-engineer's scope.

One design question surfaced by the corrected rationale, explicitly **out of scope** and offered as a candidate ticket, not a change request: the comment now documents a standing disagreement between the state machine and `content/skill-qa-engineer.md` — the SOP routes spec defects via `FAIL`, while this edge exists to serve the `Blocked` reading the SOP does not prescribe. Both are now reachable, so nothing is broken; but the SOP arguably should acknowledge the `Blocked` option (or the two framings should be reconciled) so the next QA agent does not have to invent the choice under pressure the way the VS-NDI session did. `content/` was excluded from E45 by explicit decision — this belongs to a follow-up.

## Security

No findings. Comment-only delta this round; the round-1 analysis of the widened authorization matrix stands — backward hand-off to PM only, no judge-skip, no cap weakened, `PASS` still qa-exclusive.

## Performance

No findings. Comment-only delta; comments are inert in the compiled output. Round-1 conclusion unchanged (row scan 2 → 3 entries, once per state write).

## Verdict

**APPROVED** — F1 and F2 are closed against source, the code is provably unmoved (one non-comment line in the entire two-round diff), the three copies of the corrected rationale agree with each other and with `content/skill-qa-engineer.md`, and the five residual notes are coordinator-owned bookkeeping that no further review round would improve.

