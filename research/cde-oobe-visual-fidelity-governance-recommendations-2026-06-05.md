# CDE-OOBE Visual Fidelity Governance Recommendations

> Date: 2026-06-05
> Scope: recommendations based on the current `agent-governance-mcp` architecture, routing flow, Constitution v3.14.1, and role skills.
> Input baseline: `research/cde-oobe-visual-fidelity-retrospective-2026-06-05.md`.

## Executive Summary

The CDE-OOBE failure is no longer best described as "no visual gate." The current repo already has a stronger visual pipeline than the earlier OOBE incident:

- `design/<feature>.md` with `## Mode` != `no-design` self-arms the visual gate.
- Missing `## Visual Baselines` blocks PASS with `VISUAL_BASELINES_REQUIRED`.
- Missing `qa_reports/visual_<task-id>.md` blocks PASS with `VISUAL_EVIDENCE_MISSING`.
- Unchecked `## Widget Shape Verification` rows block PASS with `VISUAL_WIDGETS_UNVERIFIED`.
- `visual_round` is tracked separately from logic QA.
- `design-auditor` now owns `## Layout / Canvas`, `## Source manifest`, `## Visual Widgets`, `## Visual Baselines`, and input volume guardrails.
- `sr-engineer` has a Design-Aware Pre-Flight and a cheap geometry assertion.

The remaining failure mode is subtler: the framework can require that visual evidence exists, but it does not yet make the visual verdict itself hard to corrupt. A coordinator can still dilute qa-visual's contract by injecting an accept-policy; a visual report can exist while accepting canonical-state mismatches; and the server does not parse the report deeply enough to know whether the screen matched the intended state, region, or structural components.

Recommended direction: keep the existing token-frugal architecture, but promote the high-risk visual verdict rules from prompt-only SOP into explicit report schema and server-validated evidence. The most important fix is not a lower pixel tolerance. It is authority separation plus canonical-state parity plus structural assertions.

## Current Architecture Reading

### What the Architecture Already Does Well

The repo's three-layer model is sound:

1. **Prompts / skills** define role responsibilities and visual workflow.
2. **`tw_*` tools** own shared state mutation.
3. **Guards / transition validation** prevent invalid PASS paths, missing evidence, stale writes, and runaway rounds.

For visual work specifically, the current implementation already moved several previous soft rules into hard gates:

- `hasDesignModeRequiringVisual()` arms visual QA from `## Mode`, not from optional baseline presence.
- `hasVisualBaselinesInDesign()` detects whether the design artifact declares comparable visual surfaces.
- `hasVisualEvidenceInFile()` requires one `qa_reports/visual_<task-id>.md` per completed task.
- `parseVisualWidgetsChecklist()` and `hasUncheckedWidgets()` reject PASS when visual widgets are explicitly left unchecked.

This is the right general pattern: cheap server checks verify that the AI did not skip required process artifacts.

### What the Architecture Still Cannot See

The server still treats most visual evidence as opaque markdown. It can tell:

- a visual report exists;
- a widget checklist row is unchecked.

It cannot yet tell:

- whether `## Verdict -- PASS` exists and is the final qa-visual verdict;
- whether canonical state matched the Figma baseline before diffing;
- whether focus/selection/scroll/drawer state was verified instead of excused;
- whether full-screen pixel percentages were used as the PASS metric;
- whether structural assertions such as focus bars, group boxes, primary button color, drawer nesting, and selected-card expansion were checked;
- whether an "accepted diff" came from qa-visual or from a coordinator-authored policy;
- whether the same actor built, judged, and signed PASS after subagent limits collapsed role separation.

That gap explains why this run could ship a bad UI while still producing a nominal PASS.

## Diagnosis Against the CDE-OOBE Retrospective

### 1. The design contract lost state, not just pixels

The failed screens were not merely off by a few pixels. Many were in the wrong state:

- Language screen lacked the selected English row and focused blue bar.
- Mode screen omitted the selected-card description.
- Network omitted Wi-Fi states, real static IP defaults, and IP octet drawer behavior.
- Time omitted grouped rows and drawer state verification.
- Consent modal used placeholder legal text.

Current `## Visual Baselines` rows are too thin for this. A row with only `surface id | baseline path | impl path | notes` does not encode route, viewport, selected item, focused row, scroll position, drawer-open state, or required interaction path.

### 2. Whole-frame visual metrics diluted structural errors

The retrospective's Language example shows why global-frame pixel percent is dangerous: a sparse 1280x720 dark UI can look "near passing" numerically while the only meaningful content region is structurally wrong.

The metric must be surface/region-aware and structural. Pixel delta can be supporting evidence, not the authority.

### 3. Coordinator authority exceeded orchestration authority

The decisive false-PASS cause was a coordinator-authored accept-policy that pre-excused selection-state and scroll-offset drift. That violated the role model:

- coordinator should route and summarize;
- qa-visual should judge visual fidelity;
- qa-engineer should own PASS;
- sr-engineer should build and respond to findings.

When coordinator can redefine visual acceptance, the chain has process theatre instead of separation.

### 4. Evidence existence is not evidence quality

The server already blocks missing visual evidence. That is necessary but insufficient. The current evidence parser should be extended from "file exists and no unchecked widget rows" to "required visual report schema is present and internally consistent."

### 5. Token savings were optimized at the wrong boundary

Avoiding every render self-check saved small in-role costs but caused expensive bounce loops. For custom visual widgets, a scoped in-loop screenshot check by sr-engineer is cheaper than a full downstream role cycle after each miss.

The right token policy is:

- cheap geometry assertion early;
- scoped render self-check for custom widgets and changed visual surfaces;
- expensive qa-visual comparison once per canonical state at the end;
- split oversized visual features before they become whole-app rework loops.

## Recommended Changes

### P0-1: Lock Visual Verdict Authority

Add an explicit rule to `content/constitution.md`, `content/skill-coordinator.md`, and `content/skill-qa-visual.md`:

- Coordinator may pass context, baseline paths, node ids, and route instructions.
- Coordinator must not define visual PASS thresholds, accepted-diff policy, or pre-excused categories.
- Allowed differences may be declared only by qa-visual in the visual report, or by PM/spec before implementation.
- If qa-visual cannot run independently because of subagent limits, the workflow must stop as `Blocked`; coordinator cannot self-issue a visual PASS after building or editing.

Server-side follow-up: add a report-schema check that rejects visual reports containing coordinator-authored accept-policy markers unless they are under a qa-visual-owned `Allowed Differences` section.

### P0-2: Add Canonical-State Parity To Visual Baselines

Extend `design-auditor` and PM spec schema from:

```text
surface id | baseline path | impl path | notes
```

to a richer table:

```text
surface id | source node | baseline path | impl path | viewport | route | canonical state | state setup | compare region | notes
```

Minimum `canonical state` fields:

- selected item;
- focused row/card/control;
- scroll offset or "top/mid/bottom";
- drawer/modal open state;
- toggles and segmented-control values;
- expected default data values;
- interaction path needed to reach the baseline.

QA rule: if implementation capture is not in canonical state, the result is a capture defect and must FAIL or be recaptured. It must not be accepted as visual drift.

This directly addresses the Language, Mode, Network, Time, Consent modal, and Boot Source drawer misses.

### P0-3: Replace Global-Frame PASS With Region And Structure Checks

Update `content/skill-qa-visual.md`:

- ban whole-frame pixel percentage as a PASS metric for sparse canvases;
- require component/region-weighted comparison when `compare region` is declared;
- require structured findings for layout, spacing, element presence, color, text, image content, and state parity;
- require a `## Structural Assertions` section.

Recommended structural assertions for CDE-OOBE-class work:

```text
assertion id | surface id | required element/state | source node/token | result
primary.button.accent | all wizard action screens | primary action button uses #3C5AAA | token id | pass/fail
focus.row.bar | language/network/time/mode-adjust | full-width blue focused row rendered | source node | pass/fail
group.container.box | mode-adjust/network/time | settings group has rounded bordered container | source node | pass/fail
mode.selected.description | mode-list | selected card expands and shows description | source node | pass/fail
drawer.nesting.boot-source | boot-source | Custom opens nested Select App drawer | source node | pass/fail
legal.modal.real-copy | consent-modal | modal contains source legal text, not placeholder | string ids | pass/fail
```

Any `fail` row blocks PASS. This is stronger than asking the model whether the screenshots "look similar."

### P0-4: Parse Visual Report Verdicts Server-Side

Add a server parser beside `parseVisualWidgetsChecklist()` that validates required sections in `qa_reports/visual_<task-id>.md`.

Minimum required sections:

- `## Verdict` with final value `PASS`;
- `## Canonical State Verification`;
- `## Widget Shape Verification`;
- `## Structural Assertions`;
- `## Pixel Diff` or `## Region Diff`;
- `## Allowed Differences` (may be empty, but must be qa-visual-authored).

Reject PASS if:

- no final PASS verdict exists;
- canonical state verification has any failed or unverified row;
- structural assertions have any failed or unverified row;
- pixel/region diff lists unresolved material differences;
- allowed differences are present without qa-visual ownership;
- the report contains language equivalent to "accepted by coordinator policy."

This preserves the current evidence-file architecture while making the evidence meaningful.

### P0-5: Add Scoped Sr-Engineer Render Self-Check

Update `content/skill-sr-engineer.md` Design-Aware Pre-Flight:

- Keep the existing cheap Geometry Assertion.
- Add an opt-in render self-check when the task touches custom visual widgets, focus states, grouped settings rows, drawers, modals, or primary action components.
- The check should be scoped to the changed widget/surface, not the whole app.
- The engineer must attach or generate the declared `impl path` screenshot before handing off.

The current render-free gate catches root geometry but not component-internal layout. CDE-OOBE failed mostly inside components and states. A scoped render check is the cheapest place to catch that before full QA.

### P0-6: Make Per-Widget Kitchen-Sink Verification Mandatory For Custom Widgets

The retrospective notes that the tooling existed but was not connected to the loop. Add this to PM / architect / sr-engineer / qa-visual flow:

- Every row in `## Visual Widgets` must have a kitchen-sink or story route when feasible.
- QA verifies widget states in isolation before screen-level assembly.
- Widget baselines should include variants: default, selected, focused, disabled, drawer-open, modal-open, and error states where applicable.

This reduces whole-screen blast radius and stops fix-A-break-B loops.

## P1 Recommendations

### P1-1: Content-Verified Node ID Resolution

Strengthen `design-auditor`:

- A Figma node id is `audited` only if the fetched node's visible text/structure matches the intended surface.
- Name-only matching is insufficient.
- Empty `nodes: []` is `unresolved`, never `audited`.
- Wrong-frame discoveries must be recorded in Source manifest with reason.

This directly addresses the retrospective's wrong `4888:*` baseline-node issue.

### P1-2: Declared Token Must Render

Current QA greps source literals. Add a visual assertion that declared state tokens are actually rendered in the relevant state:

- primary action token `#3C5AAA` appears on primary buttons;
- focused-row token appears on focused rows;
- selected-card token appears on selected cards;
- disabled/secondary token appears only where expected.

Source grep proves code mentions a token. It does not prove the token is connected to the right component state.

### P1-3: Split By Surface State, Not Just Feature

The existing Feature-Scope Gate splits large PRDs and design volume. For visual-heavy UI, add a state-count heuristic:

- if a feature has more than roughly 8 to 10 canonical visual states, PM should split into surface-state tasks;
- each task gets its own baselines and impl screenshots;
- shared shell/components go first.

CDE-OOBE had many screens and many sub-states. Treating it as one visual convergence target made every QA round expensive.

### P1-4: Role-Collapse Policy Under Model/Subagent Limits

Add a hard rule:

- If coordinator implements code inline because sr-engineer is unavailable, coordinator cannot author the visual verdict.
- If qa-visual or qa-engineer is unavailable, visual-backed work stops as `Blocked`.
- Same-context fallback is acceptable for routing continuity, not for collapsing builder and judge into one authority.

This aligns the process with the existing state-machine intent.

## P2 Recommendations

### P2-1: Add A `tw_validate_visual_report` Helper

Rather than making every PASS path parse markdown ad hoc, expose a pure helper or MCP tool that returns:

```json
{
  "ok": false,
  "missing_sections": [],
  "failed_canonical_states": [],
  "failed_structural_assertions": [],
  "unresolved_diffs": [],
  "unauthorized_allowed_diffs": []
}
```

`index.ts` can call the same helper during PASS. Tests should cover all fail branches.

### P2-2: Add Baseline Freshness Checks

A visual report should record:

- baseline path;
- baseline file hash or mtime;
- impl screenshot path;
- impl screenshot hash or mtime;
- capture timestamp;
- app route / viewport.

Server can then reject stale visual reports when screenshots change after the report was written.

### P2-3: Optional Machine Pixel Diff

Vision comparison is useful for semantic structure, but deterministic region diff is useful for repeatability. Add it only after the report schema stabilizes:

- run region-level pixel diff where `compare region` is declared;
- use a threshold per region, not full screen;
- mask dynamic content;
- keep vision as the semantic reviewer for structural differences.

Do not start here. It will not solve wrong canonical state or coordinator override by itself.

## Concrete File-Level Roadmap

Suggested implementation order:

1. `content/constitution.md`
   - Add "Visual verdict authority" rule.
   - Add "builder cannot self-certify visual PASS" rule for role-collapse cases.

2. `content/skill-coordinator.md`
   - Forbid coordinator-authored visual accept-policies.
   - On qa-visual unavailability, route to `Blocked` / human instead of PASS.

3. `content/skill-design-auditor.md`
   - Extend `## Visual Baselines` schema with canonical state, route, viewport, setup, and compare region.
   - Add content-verified node-id requirement.
   - Add structural assertion extraction into a new `## Visual Structural Assertions` section.

4. `content/skill-pm.md`
   - Copy `## Visual Structural Assertions` into spec.
   - Require visual state count and split recommendation.

5. `content/skill-sr-engineer.md`
   - Add scoped render self-check for custom widgets/states.
   - Require screenshots at declared `impl path` before handoff when baselines exist.

6. `content/skill-qa-visual.md`
   - Require canonical-state verification.
   - Ban global-frame pixel percent as sole PASS metric.
   - Require structural assertions and allowed-differences section.

7. `tools/evidence-file.ts` + `index.ts`
   - Parse visual report sections and final verdict.
   - Reject unresolved canonical-state, structural, widget, or diff failures.
   - Reject unauthorized allowed-diff policy.

8. `test/*.mjs`
   - Add parser tests for visual verdict, canonical state, structural assertions, allowed differences, stale/missing sections, and coordinator-policy rejection.

## What Would Have Prevented The CDE-OOBE False PASS

The minimum set is:

1. Coordinator could not pre-accept selection/scroll differences.
2. Language baseline required `selected=English`, `focus=English`, `scroll=centered`; mismatch would be a capture FAIL.
3. Structural assertions required focus-row blue bar, group boxes, primary button accent, selected-card description, and modal legal copy.
4. Server parsed visual report and rejected PASS if those assertions were absent or failed.
5. Sr-engineer had to render-check custom row/list/drawer states before handoff.

Those five changes address the actual causal chain. Lowering a tolerance or re-running whole-app screenshots would not.

## Recommended Operating Policy

For visual-backed product UI, use this policy:

- **No design source**: existing lightweight path; no visual overhead.
- **Design source, simple UI**: design-auditor baselines + sr geometry assertion + qa-visual final compare.
- **Design source, custom widgets or multiple states**: add sr scoped render self-check and per-widget kitchen-sink verification.
- **Design source, many surfaces/states**: PM splits by shell, shared widgets, and surface states before implementation.
- **Subagent limits hit**: builder may continue only if an independent visual judge remains available; otherwise stop as `Blocked`.

## Final Recommendation

Do not weaken QA tolerance. Do not rely on more prose. Do not make the coordinator smarter at accepting differences.

Make visual PASS a structured, stateful, role-owned artifact:

- design-auditor records structure and canonical states;
- sr-engineer proves changed surfaces render before handoff;
- qa-visual alone judges visual fidelity;
- server parses enough of the visual report to reject bad or unauthorized PASS claims.

That keeps the current architecture's strengths while closing the exact hole that let CDE-OOBE report PASS while visibly diverging from Figma.

---

Report written by Codex + GPT-5.
