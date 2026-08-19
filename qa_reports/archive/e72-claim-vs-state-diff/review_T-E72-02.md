# QA Review — T-E72-01, T-E72-02

covers: T-E72-01, T-E72-02

## Context

Feature `e72-claim-vs-state-diff`, PM-sanctioned single-role judge dispatch
(Constitution §3.1 charter, `resume_of: qa-engineer`). T-E72-01 was built
coordinator-direct (content-only): a new **Claim-vs-state mismatch**
Escalation Routes row + a **Known non-mismatches** note in
`content/coord-03-core-fallback.md`, and `docs/backlog.md` E72/8f rows
amended with the investigation result (direction (i) marked DO-NOT-BUILD).
QA's own residue is the two tests the content edit reds by construction
(golden byte-identity fixture, AC8 design-arm token floor) plus an
independent judgment call on the content itself. No `specs/e72*.md` or
`design/e72*.md` exists — this is a governance-fragment content ticket, not
a spec-driven feature build.

## Phase 0.5 — Expected-Red Diff

No `qa_reports/expected-red_e72-claim-vs-state-diff.txt` manifest file exists.
Phase 0.5: skipped (no expected-red manifest declared) — the two reds were
communicated informally via `pending_notes` at dispatch, not via the manifest
file the gate checks for. Both named reds (t-golden-byte-identity,
the AC8 design-arm floor) were independently confirmed red before this round's
re-baseline edits (see Verification below), so the intent is honored even
though the formal gate does not arm.

## Phase 1 — Review (T-E72-01, verification only — not rebuilt)

**Verified the content itself, not just its presence:**

1. **`content/coord-03-core-fallback.md` diff** — exactly two additions: a
   `Claim-vs-state mismatch` Escalation Routes row (after the Stale-dispatch
   detection row, before Cut-approval gate) and a `Known non-mismatches` note
   after the table. Both origin-fenced `(v3.103.0, E72)`. No other line in the
   file touched.

2. **Direction (i) DO-NOT-BUILD verdict — independently re-verified against
   all three named sources, not taken on the investigation's word:**
   - `content/skill-code-reviewer.md:84` — the APPROVED row instructs
     `agent_id="qa-engineer"` verbatim as the write's identity stamp.
   - `tools/transitions.ts:247-251` — `code-reviewer:In_Progress` has exactly
     three outgoing edges: `(code-reviewer,FAIL)`, `(code-reviewer,Blocked)`,
     `(qa-engineer,In_Progress)`. The last is the ONLY non-FAIL/Blocked edge.
   - `tools/transitions.ts` `computeNewRound` (review_round rule, ~line 576):
     `(qa-engineer, In_Progress) when prev was (code-reviewer, In_Progress) →
     0` is the documented reset rule, not a side effect of a misstamp.
   - `content/const-08-chain-31-mid.md:10` — Constitution §3.1 states the
     canonical signal in so many words: "Code-reviewer approval is signalled
     via `(code-reviewer, In_Progress) → (qa-engineer, In_Progress)` handoff
     with the first-class `review_verdict` field set to `APPROVED`."
   All four sources agree: `agent_id="qa-engineer"` on the APPROVED write is
   SOP-mandated, not a bug. Direction (i) (reject `review_verdict` on a
   non-code-reviewer-stamped write) would reject this exact SOP-mandated edge
   and break every approval handoff in the chain. **Verdict: the DO-NOT-BUILD
   call is correct.**

3. **Does the new row earn its ~217 ~tok on a monitored only-grows budget?**
   Measured independently (not taken on the coordinator's word): the AC8
   design-arm bundle moved from 17281 → **17498 ~tok exactly** (+217), matching
   the ticket's own figure. Judgment: **yes, it earns its cost.** Defect (b)
   (silent `pending_notes` loss) is real and — per
   `tools/handoff-orchestrator.ts:1479-1526` (`pending_notes` passed through
   verbatim, zod defaults `[]` when omitted) — genuinely undetectable by any
   of the 33 server-side gates; a coordinator-side post-handoff diff is the
   only available defense. 217 ~tok for one Escalation Routes row + one
   inoculating note is proportionate next to this feature's own history
   (e.g. e5-intake-tiering cost +1218 ~tok for a comparable single-fragment
   change) and the row is fully additive (no existing rule weakened).

4. **Does the "Known non-mismatches" note actually prevent the false positive
   it exists for?** Concrete test performed: read the row + note fresh, as a
   coordinator would, against the exact scenario that occurred pre-investigation
   (seeing `agent_id="qa-engineer"` and a `review_round` reset on the
   code-reviewer's APPROVED write, and misreading it as an identity misstamp).
   **Yes, it inoculates against that specific case** — the note names both
   facts explicitly (`agent_id="qa-engineer"` APPROVED stamp,
   `review_round` reset) and states in plain language "Neither is an identity
   misstamp — do not fire the row above on them," which is precisely the
   confusion that happened. One wording nit, not a blocker: the note's
   placement puts it directly under the LAST table row ("visual work complete
   but no independent qa-visual context…"), so "the row above" is one row
   removed from its actual referent (Claim-vs-state mismatch, several rows up)
   rather than literally adjacent. The note's own content (agent_id/
   review_round) is specific enough that no other row in the table is a
   plausible referent, so this does not create real ambiguity in practice —
   but a future edit inserting a new row directly above the note would make
   "the row above" point at the wrong thing. Recorded here rather than failed
   on: fixing it costs zero content bytes of substance (name the row
   explicitly) and is a candidate one-line tightening for a future pass, not
   a defect that lets the false positive back in today.

## Phase 3 — Verification tests (T-E72-02, qa-owned)

Per `content/skill-code-reviewer.md` §2 / this feature's scope, all test
edits are QA-owned. Two re-baselines, both mechanical refreshes of frozen
fixtures the content edit legitimately reds:

- **`test/fixtures/compose-golden/skill-coordinator-monolith.txt`** —
  regenerated via `composeSkill("skill-coordinator.md",
  hostCapabilitiesFor("claude-code"), readContent)` and diffed against the
  prior fixture before overwriting: the ONLY delta is the two new lines added
  to `content/coord-03-core-fallback.md` (the Claim-vs-state mismatch row +
  the Known non-mismatches note), byte-for-byte. No unintended drift.
- **`test/context-budget.test.mjs`** AC8 design-arm floor: cap raised
  17281 → 17498 (both the assertion and the test's own title string, matching
  the established per-rebaseline convention verified against every prior
  entry in this file's git history). Measured independently via a standalone
  script reproducing the test's exact composition
  (`stripRationale(stripOriginTags(CONSTITUTION)) + SEP +
  stripRationale(stripOriginTags(body))`, `CONSTITUTION =
  composeConstitution({chain:true, design:true})`) — **17498 ~tok exact**,
  confirming the ticket's own figure rather than trusting it. Comment added
  citing E72 in the same style as the e40 precedent it follows.

No new production code — evidence-only ticket; Copy Audit / Visual Audit
gates (Phase 3a/3b) and Phase 3.5 AC Execution Log are not applicable (no
`specs/e72*.md`; this is a governance-fragment content change, not a
spec-driven surface). Phase 1.5 Visual Compare: skipped, no
`design/e72*.md`.

## Phase 4 — Run

- `npm run build`: clean.
- `npm test`: **1745/1745 green** (full suite, ~56s). Both previously-red
  tests (`t-golden-byte-identity`, the AC8 design-arm floor test) now pass at
  the new baseline; no other test moved.
- CI runnability: `npm test` runs headlessly, zero human interaction.

## Verdict

**PASS.** T-E72-01's content is judged sound: the DO-NOT-BUILD call on
direction (i) is independently confirmed against three code sources plus the
constitution; the new row's token cost is earned by a real, server-undetectable
defect; the Known-non-mismatches note inoculates the exact false positive it
was written for (with one non-blocking wording nit recorded for a future
pass). T-E72-02's two re-baselines are verified minimal and correct, and the
full suite is green.
## 2026-08-19T05:37:49.786Z — PASS — by qa-engineer

T-E72-01 verified (not rebuilt): coord-03 diff is exactly the two claimed additions; direction (i) DO-NOT-BUILD independently re-confirmed against skill-code-reviewer.md:84, transitions.ts:247/576, and const-08-chain-31-mid.md:10 (all three agree agent_id=qa-engineer on the APPROVED write is SOP-mandated, not a misstamp). New row's +217 ~tok judged earned (defect (b) is real and server-undetectable per handoff-orchestrator.ts:1479-1526). Known-non-mismatches note judged to inoculate the exact pre-investigation false positive (one non-blocking wording nit recorded: "the row above" is one row removed from its actual referent). T-E72-02: golden fixture regenerated and diffed (only delta = the 2 new coord-03 lines); AC8 floor independently re-measured at 17498 ~tok exact (not trusted from the ticket's figure), test title + assertion + comment updated. Full npm test 1745/1745 green. qa_reports/review_T-E72-02.md (covers both ids).

