# Spec: retro-sop-hardening

Source: `research/mode-feature-process-retrospective.md` §四 items #2, #7, #8.
Feature split row: `.current/feature-split.md` order 2.
Design mode: `no-design` — pure SOP governance text. No server, build, or test changes.

---

## Problem Statement

Three root causes identified across the Mode feature line's four phases are not yet encoded as
guardrails in the relevant SOP files. Without them, future agents running the same chain face the
same failure modes: (a) a design-auditor that transcribes from the wrong node type and poisons the
entire spec; (b) a visual-property adjudication that compresses a context-dependent multi-value
property into a single canonical answer, baking a wrong spec; (c) a lite-mode session that drifts
into iterative eyeball-loop on cross-file visual-fidelity work — exactly the §5 anti-loop pattern.
All three can be closed with targeted text additions to three existing `content/*.md` files.

---

## User Stories

- As a coordinator routing a design-backed feature, I want the design-auditor to self-screen the
  node type before transcribing values, so that a component variant or read-only overview page never
  poisons the downstream spec.
- As a design-auditor or qa-visual agent adjudicating a visual property, I want an explicit
  instruction to check for context-dependent multi-value properties before committing a canonical
  answer, so that an ON-state with two Figma variants is not compressed into one wrong value.
- As a solo developer in lite mode, I want the lite SOP to clearly mark cross-file visual-fidelity
  work as out-of-scope with a pointer to the §5 risk, so I escalate to `/teamwork` instead of
  iterating blindly.

---

## Acceptance Criteria

### AC-1 — design-auditor source-credibility gate (item #2)

**Given** the design-auditor is about to extract values from a Figma (or other fetch-based) node,
**When** the SOP step 3 (Extract) runs,
**Then** the auditor MUST first classify the node as one of: (a) full-page/screen composite frame,
(b) component variant / component-set child, (c) read-only review/overview page, (d) other;
if the classification does not match the feature intent (e.g. variant instead of full-page composite,
or a different mode's overview page), the auditor MUST STOP and call
`tw_update_state(status=Blocked, pending_notes=["design-auditor: node type mismatch — <node-id> is
<actual type>, expected <required type>; resolve before extraction", "next_role: pm"])`.
Transcription from the wrong node type is not permitted; the guardrail fires BEFORE any values are
written to the audit artifact.

**Testable**: a reviewer reading `skill-design-auditor.md` can find an explicit node-type
classification step with the four categories and a STOP path for mismatch.

### AC-2 — context-dependent property multi-value check (item #7)

**Given** any agent (design-auditor during extraction, qa-visual during adjudication) is about to
assign a single canonical value to a visual property,
**When** the property in question has multiple visual appearances in the source depending on
contextual state (e.g. toggle ON with focused-row variant vs. unfocused-row variant),
**Then** the agent MUST enumerate all context-dependent values separately, each tagged with its
governing context/state, rather than picking one as "the" canonical value.
The rule must appear in `skill-design-auditor.md` (Visual Widgets / Visual Tokens extraction)
and in `skill-qa-visual.md` (Step A.5 canonical-state adjudication).

**Testable**: the text in each target file explicitly states that a property with multiple
context-dependent appearances MUST NOT be collapsed into a single value, and requires per-context
enumeration.

### AC-3 — lite-mode visual-fidelity escalation guardrail (item #8)

**Given** a lite-mode session is being used for cross-file visual-fidelity work (comparing rendered
output against Figma across multiple files, iterating on discrepancies),
**When** the coordinator-lite SOP is followed,
**Then** the SOP MUST explicitly identify cross-file visual-fidelity iteration as a scope-creep
trigger that requires `/teamwork` escalation, with a note that iterative eyeball loops on visual
work violate Constitution §5 anti-loop, which `/teamwork` + `qa-visual` is designed to prevent.

**Testable**: `skill-coordinator-lite.md` contains an explicit entry in the scope-creep examples
(or a dedicated warning block) for visual-fidelity iteration, naming the §5 risk and requiring
`/teamwork` escalation.

---

## Copy / Strings

No user-facing strings — this feature modifies internal SOP governance text only.

| string id | exact text | source |
|---|---|---|
| N/A | — | feature introduces no user-facing strings |

---

## Visual Tokens

No visual tokens — pure text governance additions.

| token id | property | value | source |
|---|---|---|---|
| N/A | — | — | feature introduces no visual tokens |

---

## Visual Widgets

| widget id | description | source-node |
|---|---|---|
| N/A | — | feature has no non-primitive widgets |

---

## Out of Scope

- Server code changes (`index.ts`, `tools/`, `guards/`, `schema/`).
- Build or test additions.
- `content/constitution.md` changes — skills MUST NOT restate constitution rules; the additions
  reference §5 and §3.2 by pointer only, not by reproducing the rule text.
- Items #1, #3, #4, #5, #6 from §四 — addressed in F0 (qa-visual-baseline-provenance) or N/A to
  this repo (F1 descoped).
- `skill-coordinator.md` — the full coordinator already routes to `design-auditor` which will carry
  AC-1/AC-2; no independent addition needed there.

---

## Dependencies / Prerequisites

- F0 (qa-visual-baseline-provenance): PASS/done. No outstanding dependency.
- F1 (paired-token-build-check): descoped as N/A to this repo. No dependency.
- Constitution §5 anti-loop rule: exists; AC-3 cross-references it by section number only.
- Constitution §3.2 builder≠judge rule: exists; AC-2 cross-references it by section number only.
- No external URLs, Figma nodes, or Azure DevOps tickets referenced (Resource Audit Gate: zero hits).
- `scope_decision`: `single-feature` — three files, all `content/*.md`, surgical text additions,
  no state-machine or schema change. No split warranted.

---

## Tasks

Tasks are registered via `tw_add_task` (see below). One task per SOP file concern.

```
- [ ] T-RSH-01 [P1] Add node-type classification + STOP guardrail to skill-design-auditor.md (AC-1) | depends_on: none
- [ ] T-RSH-02 [P1] Add context-dependent multi-value property rule to skill-design-auditor.md and skill-qa-visual.md (AC-2) | depends_on: none
- [ ] T-RSH-03 [P2] Add lite-mode visual-fidelity escalation guardrail to skill-coordinator-lite.md (AC-3) | depends_on: none
- [ ] T-RSH-QA [P1] QA review: verify all three SOP files satisfy AC-1, AC-2, AC-3 | depends_on: T-RSH-01, T-RSH-02, T-RSH-03
```

### Exact text additions (binding on sr-engineer)

#### T-RSH-01 — `content/skill-design-auditor.md`

Insert a new sub-step **2b** (after existing step 2a Volume Gate, before step 3 Extract) titled
**"Source-Credibility Classification (v3.38.0)"**. The new text:

```
2b. **Source-Credibility Classification (v3.38.0)** — fetch-based modes only (figma/sketch/xd/penpot).
   BEFORE extracting any values, classify each target node into one of:
   (a) **full-page / screen composite frame** — the top-level frame representing the feature's actual
       surface as it renders for an end user;
   (b) **component variant / component-set child** — a sub-node inside a component definition, not a
       full composed screen;
   (c) **read-only review / overview page** — a documentation or handoff overview that shows a
       different mode, state, or context than the feature being built;
   (d) **other** — annotation, asset, or non-UI frame.

   If the classification is (b), (c), or (d) — i.e. NOT a full-page/screen composite frame for the
   intended feature — you MUST STOP and call:
   `tw_update_state(status=Blocked, agent_id="design-auditor",
     pending_notes=["design-auditor: node type mismatch — <node-id> is <actual classification>,
     expected full-page composite frame for <feature>; resolve source reference before extraction",
     "next_role: pm"])`.
   Do NOT transcribe values from the wrong node type. P2 was saved by this behaviour; P1 was reopened
   for lack of it (see `research/mode-feature-process-retrospective.md` §四#2).
   `image`/`pdf`/`paper`/`no-design` modes skip this gate (human-confirmed sources).
```

#### T-RSH-02a — `content/skill-design-auditor.md`

Append the following sentence to the end of the **Visual Widgets interactive-states inventory**
paragraph (currently ends "…an audit lacking the state inventory is **incomplete**, not done."):

```
   **Context-dependent multi-value guard**: before recording any token or property value as "the"
   canonical value, verify whether the property has more than one visual appearance depending on
   contextual state (e.g. a toggle ON that renders differently when the row is focused vs.
   unfocused). If multiple values exist, enumerate EACH separately with its governing
   context/state — do NOT collapse them into a single canonical entry. Collapsing a
   context-dependent property into one answer bakes a wrong spec (retrospective §四#7: toggle ON
   had two Figma variants but was compressed into one, producing an incorrect implementation).
```

#### T-RSH-02b — `content/skill-qa-visual.md`

Append the following note to the end of Step A.5 **Canonical-State Verification** (after the
"recapture the impl in the baseline's state, or FAIL" rule):

```
   **Context-dependent multi-value guard**: if, during Step A.5 or Step B adjudication, you
   discover a visual property that has MORE than one correct value depending on context (e.g.
   a component that renders differently when focused vs. unfocused, or selected vs. unselected),
   you MUST NOT pick one value as "correct" and accept/fail on the other. Instead, record BOTH
   contexts as separate baselines (or flag the surface as needing a re-audit with per-context
   baselines) and FAIL the current surface with note: "context-dependent property requires
   per-context baseline — see §四#7 in retrospective". The §3.2 builder≠judge rule applies:
   adjudicating a multi-value property as single-choice is a contract defect, not an
   implementation defect.
```

#### T-RSH-03 — `content/skill-coordinator-lite.md`

Add a new scope-creep example entry under the existing **"Scope-creep examples"** section:

```
- **"Fix the visual / make it match Figma"** (cross-file visual-fidelity iteration) — involves
  comparing rendered output to Figma across multiple UI files, then applying fixes and
  re-checking. Each iteration is a new cross-context visual comparison; iterative eyeball
  loops on visual work violate Constitution §5 anti-loop. This is `/teamwork` + `qa-visual`
  work by design. **Lite is appropriate ONLY for environment-exclusion** (e.g. confirming a
  stale build is the cause): run one diagnostic pass, report the finding, then escalate.
  Long-running lite visual iteration → **full**.
```
