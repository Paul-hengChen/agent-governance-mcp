# Architecture: Constitution v3.27 Sync + Internal-Consistency Pass

> Feature: `constitution-v3.27-sync-consistency`
> Author: architect (opus)
> Date: 2026-06-08
> Source spec (AUTHORITATIVE): `specs/constitution-v3.27-sync-and-consistency.md`
> Implements: AC-A1..A4, AC-B1..B3, AC-SKILLS, AC-BUILD + folded-in matrix fix (A5)

This blueprint gives the implementer the exact target file, anchor, edit
operation, and satisfied AC for each task. Edits are surgical (Constitution §1):
no reflow of adjacent text, no version-string changes beyond the named header.
The note's loose wording is superseded by the spec's Acceptance Criteria for
A4 and B3 (see Decision Records).

## Affected Files

| File | Tasks | Op |
|---|---|---|
| `content/constitution.md` | T-DRIFT-A1, T-VISUAL-A2, T-VERSION-A3, T-WORDING-A4, T-TERSE-B1, T-MVP-B2, T-PRECEDENCE-B3 | 7 edits (see §Interface Contracts) |
| `content/skill-sr-engineer.md` | T-SKILLS-PROP | 1 insert |
| `content/skill-design-auditor.md` | T-SKILLS-PROP | 1 insert |
| `tools/transitions.ts` | T-MATRIX-A5 (folded in) | 3 edits (union + guard + ALLOWED row) |
| `specs/qa-flow-enforcement-architecture.md` | T-MATRIX-A5 | doc-sync mirror of the matrix row |
| `test/transitions.test.mjs` (or existing transitions test) | T-MATRIX-A5-TEST | qa-engineer-owned test additions |
| `package.json` + `index.ts` Server() literal | T-MATRIX-A5 | version bump (check-version.mjs pair) |

The constitution H1 version (T-VERSION-A3) is independent of `package.json`
(A3 policy). The `package.json`/`index.ts` bump in the table is required ONLY
because A5 adds server behavior — it is NOT triggered by the doc-only A-series.

## Data Structures

- `REQUIRED_VISUAL_SECTIONS` (`tools/evidence-file.ts:342-349`) — READ-ONLY
  source for A2. Six entries, copied verbatim into §3.1/§4. Do NOT redefine.
- `AgentName` union (`tools/transitions.ts:6-13`) — A5 adds `| "release-engineer"`.
- `ALLOWED` map (`tools/transitions.ts:104-191`) — A5 adds one entry keyed
  `"release-engineer:PASS"`.

## Interface Contracts (exact edits, ordered to avoid conflicts)

Edits are ordered so that two same-section edits never collide. §1 carries TWO
edits (B1 + B2); apply in the order below. Apply A-series before B-series within
the constitution for clean line-anchoring, but the operations are independent
inserts/replaces and do not overlap line ranges except where noted.

### T-DRIFT-A1 — §3 pre-flight + task-edit rule (satisfies AC-A1)
File: `content/constitution.md`
- **Edit 1 (replace, line 30):** in the Pre-flight read bullet, the parenthetical
  list `(tw_update_state, tw_complete_task, tw_rollback_task, tw_add_task)`
  becomes `(tw_update_state, tw_complete_task, tw_rollback_task, tw_add_task, tw_sync)`.
- **Edit 2 (replace, line 33):** append to the "Task list edits go through tools"
  bullet a sentence naming `tw_sync` as the sanctioned reconcile op:
  `tw_sync is the only sanctioned ledger→tasks.md reconcile operation (mirrors handoff.completed_tasks onto tasks.md; never promotes a tasks.md-only [x]).`
  Per CONST-PRE-FLIGHT-ADD / CONST-SYNC-RECONCILE in the spec Copy table.

### T-VISUAL-A2 — §3.1 + §4 visual error-code docs (satisfies AC-A2)
File: `content/constitution.md`. DOCUMENTS already-shipped behavior — verified
at `index.ts:824` (VISUAL_ASSERTIONS_REQUIRED), `index.ts:850`
(VISUAL_REPORT_INCOMPLETE), `tools/evidence-file.ts:342-349` (sections). Do NOT
touch server code.
- **Edit 1 (insert in §3.1, after line 45 — the visual evidence gate bullet):**
  add a new bullet documenting the two error codes and the 6 required sections
  verbatim:
  `Visual report schema gate (v3.26.0/v3.27.0): when the design declares ## Visual Structural Assertions, PASS additionally validates qa_reports/visual_<id>.md against REQUIRED_VISUAL_SECTIONS. A missing section, failed/unverified canonical-state or structural row, or a non-PASS verdict returns VISUAL_REPORT_INCOMPLETE (v3.26.0). If the gate is armed (mode != no-design) but the design omits ## Visual Structural Assertions, PASS returns VISUAL_ASSERTIONS_REQUIRED (v3.27.0) — a hard error, not a silent fallback. Required sections (verbatim): Widget Shape Verification, Canonical State Verification, Structural Assertions, Region Diff, Allowed Differences, Verdict.`
- **Edit 2 (insert in §4, after line 106 — the VISUAL_BASELINES_REQUIRED paragraph):**
  add one sentence cross-referencing the same two codes so a §4 reader sees the
  full PASS-rejection set:
  `Beyond VISUAL_BASELINES_REQUIRED, an armed workspace also rejects PASS with VISUAL_ASSERTIONS_REQUIRED (design omits ## Visual Structural Assertions) or VISUAL_REPORT_INCOMPLETE (the report fails the required-section / row / verdict schema) — see §3.1.`
  Strings per CONST-VISUAL-ERR-1/2 and CONST-VISUAL-SECTIONS.

### T-VERSION-A3 — header bump (satisfies AC-A3)
File: `content/constitution.md`
- **Edit (replace, line 1):** `# Constitution v3.14.1` →
  `# Constitution v3.27.0 <!-- versioned independently of package.json; tracks the highest behavior the document describes; check-version.mjs does NOT read this header -->`
  Per CONST-HEADER-VERSION + the A3 policy note. No `docs/schema-versions.md`
  entry needed (Out of Scope).

### T-WORDING-A4 — §3.2 authorship softening (satisfies AC-A4)
File: `content/constitution.md`. NOTE: the handoff note misdescribes this as
orphan-task wording — IGNORE the note; the spec AC-A4 is authoritative.
- **Edit (replace, line 72):** in the §3.2 Enforcement clause, replace the phrase
  `is authored under the qa chain, not the coordinator` with
  `is accepted and owned by the qa chain at PASS time (server validates report schema, not file authorship), not the coordinator`.
  Per CONST-A4-AUTHORSHIP. Aligns with the `evidence-file.ts:329-334` authorship
  note (verified: server does NOT keyword-sniff for authorship).

### T-TERSE-B1 — §1 Terse carve-out (satisfies AC-B1) — §1 EDIT #1
File: `content/constitution.md`
- **Edit (replace, line 13):** the Terse bullet
  `**Terse**: Default chat replies ≤ 15 words. Skills MAY override (e.g. PM = 1 sentence).`
  becomes that text plus a new sentence:
  `The word cap does NOT apply when surfacing a blocker, flagging an assumption gap (§7), or stating acceptance criteria.`
  Per CONST-B1-CARVEOUT.

### T-MVP-B2 — §1 design-baseline generalization (satisfies AC-B2) — §1 EDIT #2
File: `content/constitution.md`
- **Edit (insert, after line 16 — the Visual Widgets exception sub-bullet, before
  the Surgical changes bullet at line 17):** add a sibling sub-bullet under
  MVP strict:
  `**Design-baseline scope (v3.27.0)**: For design-backed work, the canonical design (Figma node or equivalent) is the scope baseline — not the lossy prose transcription in the spec. Omitting a design-present element is a fidelity defect, not MVP compliance; flag the gap per §7, never drop silently.`
  Per CONST-B2-BASELINE.

> **§1 collision-avoidance (REQUIRED reading for sr-engineer):** B1 edits line 13
> (Terse bullet) and B2 inserts after line 16 (Visual Widgets sub-bullet). They do
> NOT share a line. Apply **B1 first, then B2** — B1 is an in-place replace of an
> existing line; B2 is an insert that shifts subsequent line numbers. Doing B1
> first means B2's anchor (the Visual Widgets exception sub-bullet text, NOT a raw
> line number) is unaffected. Anchor B2 on the literal text "Widgets absent from
> that section remain governed by the default MVP rule." (end of line 16), inserting
> the new sub-bullet immediately after it. Do not anchor on numeric line offsets.

### T-PRECEDENCE-B3 — Document Priority tie-breaker + circuit-breaker (satisfies AC-B3)
File: `content/constitution.md`. NOTE: the handoff note misdescribes this as a
"spec > constitution > memory" document reordering — IGNORE the note; AC-B3 is
authoritative. This is an INTRA-constitution tie-breaker, NOT a cross-document
reorder. The existing inter-document line (line 140) is left UNTOUCHED.
- **Edit (insert, after line 141 — the end of the `## Document Priority` section):**
  add two new lines:
  `On any intra-constitution conflict, safety/correctness rules (§2, §3, §6, §7) override efficiency/style rules (§1).`
  and
  `When §5 anti-loop trips (2 fix tries / 3 reads exhausted), hand back Blocked/FAIL to the human. Never issue an error-laden PASS; never extend the loop.`
  Per CONST-B3-PRECEDENCE + CONST-B3-CIRCUIT.

### T-SKILLS-PROP — B2 forward-reference propagation (satisfies AC-SKILLS) — depends_on: T-MVP-B2
Must run AFTER T-MVP-B2 (the constitution B2 rule must exist before skills
forward-reference it). One line each, NO restatement (constitution line 4).
- **`content/skill-sr-engineer.md` (insert, end of line 26):** after the existing
  "Substituting an HTML primitive ... not MVP compliance" sentence, append:
  `See Constitution §1 Design-baseline scope (v3.27.0): the canonical design is the scope baseline — a gap vs design is a fidelity defect, not MVP compliance.`
  Per SKILL-B2-SR.
- **`content/skill-design-auditor.md` (insert, new bullet after line 16 in the
  `## Hard rules` list):**
  `**Design = scope baseline (Constitution §1, v3.27.0)**: the baseline you author is scope-law for design-backed work — a downstream gap vs the design is a fidelity defect, not MVP compliance. (Forward-ref only; see the constitution rule.)`
  Per SKILL-B2-DA.
- Do NOT modify `skill-coordinator.md`, `skill-qa-engineer.md`, or `skill-pm.md`
  (AC-SKILLS "And" clause + Blast Radius decision).

### T-MATRIX-A5 (FOLDED IN) — release-engineer transition gap
File: `tools/transitions.ts`. NOT in the original spec task list — added this
chain via `tw_add_task` after the bug was observed. See Decision Records.
- **Edit 1 (union, lines 6-13):** add `| "release-engineer"` to the `AgentName`
  union. REQUIRED — without it `isAgent()` rejects the value and
  `validateTransition` returns AGENT_ID_REQUIRED.
- **Edit 2 (guard, lines 207-217):** add `a === "release-engineer" ||` to the
  `isAgent()` predicate.
- **Edit 3 (ALLOWED map, after line 190 — the `qa-engineer:PASS` entry):** add
  ```
  ["release-engineer:PASS", [
    { agent: "pm", status: "In_Progress" },
    { agent: "researcher", status: "In_Progress" },
  ]],
  ```
  mirroring `qa-engineer:PASS`.
- **Edit 4 (doc-sync):** mirror the new row into
  `specs/qa-flow-enforcement-architecture.md` per the `transitions.ts:3`
  "MUST be mirrored in the design doc" rule.
- **Version bump:** A5 ships server behavior → bump `package.json` + the
  `index.ts` Server() literal together (so `scripts/check-version.mjs` passes),
  e.g. to the next patch. This is separate from the constitution v3.27.0 header.

### T-MATRIX-A5-TEST — qa-engineer-owned (Constitution §2 test ownership)
File: existing transitions test under `test/`. Assert: (a)
`release-engineer:PASS → (pm, In_Progress)` and `→ (researcher, In_Progress)`
accepted; (b) an unrelated next-tuple from `release-engineer:PASS` rejected with
`TRANSITION_REJECTED` and a NON-EMPTY `allowed` array; (c)
`isAgent("release-engineer")` true. Reuse existing test infra; add no new harness.

## Sequence Diagram

_Not applicable — this is a documentation + single-state-machine-row change with
≤ 2 actors (implementer edits files; server reads them at PASS time). No runtime
multi-actor flow is introduced._

## Decision Records

| Context | Decision | Consequences |
|---|---|---|
| `release-engineer` absent from `ALLOWED_TRANSITIONS` wedged the prior PM session at `release-engineer:PASS` (empty allowed set via `transitions.ts:314 ?? []`), forced a manual `last_agent` reset to `qa-engineer` (a §3 violation by necessity). PRD said doc-only; PM recommends fold-in. | **FOLD IN as T-MATRIX-A5 + T-MATRIX-A5-TEST.** A routing state no valid transition can escape is a correctness defect in the chain's safety layer (highest severity). It directly caused observable breakage in THIS chain, the fix is mechanical (mirror `qa-engineer:PASS`), and §7 (fail loud / surface conflicts) makes shipping a known re-triggerable wedge worse than a slightly wider PR. Scoped to its own task pair so doc edits stay independently reviewable; atomicity preserved within one PR. | PR is no longer doc-only: adds `tools/transitions.ts` (3 edits, not 1 — union + guard + map row), a `specs/qa-flow-enforcement-architecture.md` doc-sync, a qa-engineer-owned test (§2), and a `package.json`/`index.ts` version bump. Constitution v3.27.0 header (A3) stays independent of that bump. |
| Handoff `pending_notes` misdescribes A4 (says "orphan-task wording") and B3 (says "spec > constitution > memory reorder"). | Trust spec AC-A4 / AC-B3 verbatim; ignore the note. | A4 = §3.2 authorship softening (line 72). B3 = intra-constitution tie-breaker + circuit-breaker appended to `## Document Priority`; the inter-document line 140 is untouched. |
| B1 and B2 both edit §1 and risk a line-number collision. | Apply B1 (replace line 13) before B2 (insert after line 16); anchor B2 on literal text, not numeric offset. | No collision; deterministic for the implementer. Documented inline in T-MVP-B2. |
| A2 documents behavior already shipped (verified at the three code sites). | Documentation-only; no re-implementation. | Server code untouched; AC-A2 satisfied by constitution prose matching the live literals. |
| Constitution semver vs `package.json` (A3). | Constitution carries independent semver (v3.27.0); `check-version.mjs` unchanged (it never reads the header). | The A5 `package.json` bump and the A3 constitution bump are decoupled and must not be conflated. |

## Deferred Resources

_No external references to defer._ The spec's *Dependencies / Prerequisites*
(line 247-254) lists zero external URLs, Figma links, or ticket IDs — all
evidence is in-repo code sites, each verified inline by this architect
(`index.ts:824`, `index.ts:850`, `tools/evidence-file.ts:342-349`,
`tools/transitions.ts:6-13/104-191/207-217`, `scripts/check-version.mjs`). The
External-reference Sanity Gate (architect SOP step 4) passes with an empty
Deferred set, which the spec's zero-ref Dependencies section permits.

## Open Questions

_None._ All A3/B2/B3 enforcement-mode questions were resolved by PM
(Dependencies §Open Question Resolutions). The matrix-gap decision is made and
recorded above. No block to sr-engineer.
