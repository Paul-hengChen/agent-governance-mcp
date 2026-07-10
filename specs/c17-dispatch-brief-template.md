# c17-dispatch-brief-template

## Problem Statement
Every `Task(subagent_type=<role>, prompt=…)` dispatch brief the coordinator
composes hand-restates the same invariant protocol boilerplate: the
mandatory first action (`tw_get_state` → `tw_detect_drift`), the known-drift
ignore list for the session, carrying `dispatch_pins` forward verbatim, the
"do NOT set `cut_approved`" rule when dispatching PM, and the Constitution
§1 watermark format. Because these lines are recomposed from memory on
every dispatch rather than copied from one canonical source, each
restatement is an independent chance to omit or contradict a rule — the
`dispatch_pins` carry-forward line in the live C9 run only survived because
the coordinator happened to remember it (this is exactly what C14 later
made structurally impossible to lose, by promoting `dispatch_pins` to a
first-class handoff field). C17 closes the remaining gap: the coordinator
skill has no canonical *template* for the brief text itself, so the
protocol block is still hand-authored prose every time.

C14 (`dispatch_pins` first-class handoff field, schema v8) shipped in
v3.56.0, so this spec's pin line in the template references the
`dispatch_pins` field directly — there is no legacy `pending_notes`
convention left to describe.

## User Stories
- As the coordinator composing a `Task(subagent_type=<role>, …)` dispatch,
  I want a canonical protocol block to copy verbatim into every brief, so
  that I never have to re-derive or restate rules from memory and risk
  dropping one.
- As a human reading a dispatch brief in the transcript, I want the
  invariant protocol lines to read identically across every dispatch, so
  that a missing or reworded line is immediately visible as a deviation
  rather than lost in restatement noise.

## Acceptance Criteria
- **AC1** — Given the coordinator composes a `Task(subagent_type=<role>,
  prompt=…)` call, when it assembles the brief, then the brief's `prompt`
  MUST open with the six invariant lines quoted verbatim in *Copy /
  Strings* below (in order), followed by a per-hop "Assignment" delta
  paragraph — never a hand-paraphrased restatement of those lines.
- **AC2** — Given the handoff's `dispatch_pins` field (schema v8) is
  non-empty, when the coordinator fills the pins line, then it MUST read
  the map via `tw_get_state` and quote it directly — no reference to any
  `pending_notes` pin convention (that convention was retired by C14).
- **AC3** — Given `tw_detect_drift` reported zero drift for the session,
  when the coordinator fills the known-drift line, then it MUST render the
  literal fallback `"none — drift clean"` rather than omitting the line —
  the line's *presence* (not just its content) is what makes a forgotten
  drift check visible in the transcript.
- **AC4** — Given the dispatch target's `next_role` is `pm`, when the
  coordinator fills the template, then the `cut_approved` line MUST be
  included; given the target is any other role, the line MUST be omitted
  (it only applies to a Task-dispatched PM's own state write).
- **AC5** — Given `content/skill-coordinator.md` gains this new section,
  when `test/context-budget.test.mjs`'s "AC8 design-arm floor" teamwork
  bundle test re-runs, then its literal token cap (currently `<= 11445`)
  MUST be independently re-measured and bumped by qa-engineer — per the
  established Phase-2 convention (exact measured value, no headroom) — not
  left stale and not bumped by sr-engineer (test-file edits are
  qa-engineer-owned per Constitution §2 Test ownership).
- **AC6** — Given the existing `subagent-templates.test.mjs` (AC3/AC4),
  `cut-approval-gate.test.mjs` (C4:S04), `feature-scope-gate.test.mjs`, and
  `design-auditor-volume-guard.test.mjs` assertions grep
  `content/skill-coordinator.md` for specific anchor phrases (e.g.
  `**Subagent Dispatch (Claude Code)**`, `**Fallback (`tw_switch_role`)**`,
  `ALLOWED_TRANSITIONS`), when the new section is inserted, then every one
  of those anchor phrases MUST remain present verbatim and unmoved — the
  new section is purely additive, not a rewrite of surrounding prose.

## Copy / Strings
The six invariant lines are the copy this feature introduces. Quote them
verbatim into `content/skill-coordinator.md`'s new template section — do
not paraphrase. Source is `authored-here`: each line deduplicates a
mechanism already canonical elsewhere in the constitution/skill (cited in
the third column), so the line itself is not a new rule, only a
single-sourced restatement of one.

| string id | exact text (quote verbatim) | source |
|---|---|---|
| dispatch-brief.heading | `**Dispatch Brief Template**` | authored-here — matches existing sub-bullet label style (`**Fallback (\`tw_switch_role\`)**`, `**Subagent Dispatch (Claude Code)**`) already in this file |
| dispatch-brief.preflight | ``First action: `tw_get_state(workspace_path=<workspace_path>)` → `tw_detect_drift`.`` | authored-here — restates Constitution §3 "Pre-flight read" / "Drift check" bullets, already canonical |
| dispatch-brief.known-drift | ``Known drift, ignore (do not reconcile): <ids from this session's `tw_detect_drift` vibe-drift list, or "none — drift clean">.`` | authored-here — restates the "Drift Reconcile after out-of-band execution" section already in this file (vibe-drift handling) |
| dispatch-brief.pins | ``Dispatch pins in effect: <current `dispatch_pins` map per `tw_get_state`, or "none">.`` | authored-here — restates the "Dispatch-time overrides (`dispatch_pins`)" section already in this file (handoff schema v8, C14) |
| dispatch-brief.cut-approved | ``Do NOT set `cut_approved` — you are Task-dispatched; the coordinator attests approval after the human approves in the coordinator's chat.`` (include ONLY when dispatching `next_role: pm`) | authored-here — restates the "Cut-approval gate writer obligation" paragraph already in this file / Constitution §3.1 |
| dispatch-brief.watermark | ``Watermark your reply per Constitution §1 (Task-spawned: `— @<role> (<tier>)`; `<tier>` = the `dispatch_pins` entry above if it names your role, else your frontmatter default).`` | authored-here — restates Constitution §1 Watermark table + Pin override bullet, already canonical |

## Visual Tokens
| token id | property | value (quote verbatim) | source |
|---|---|---|---|
| N/A | — | — | feature has no visual literals (content-only skill-file edit) |

## Visual Widgets
| widget id | description | source-node |
|---|---|---|
| N/A | — | feature has no non-primitive widgets |

## Out of Scope
- A separate `templates/` file for the brief text. The existing
  `.current/feature-split.md` template (skill-coordinator.md lines ~50–61)
  establishes the precedent of an inline fenced template living directly in
  the skill file that produces it; a separate file would add a lookup hop
  to every dispatch for no benefit. Backlog's "maybe templates/" hedge is
  resolved as: no.
- Templating the `tw_switch_role` fallback path. That path is same-context
  (the role reads its own SOP directly, no `prompt=` string is composed at
  all), so there is no "brief" to template — only the Task-tool dispatch
  path produces one.
- Any change to `tools/*.ts`, schema versions, or `ALLOWED_TRANSITIONS`.
  This is a skill-prose-only fix; no new handoff field, no migration.
- A worked filled-in example dispatch brief. Deferred to keep the bundle
  token-cost delta minimal (every added line re-bumps the qa-owned token
  cap in `test/context-budget.test.mjs`); the six invariant lines plus one
  placeholder "Assignment" paragraph are self-explanatory without a
  worked example.
- Automating brief composition via a script or hook. Stays
  skill-procedure-level, matching the existing "Subagent Token
  Observability" section's precedent (read-only guidance, no new tooling).

## Dependencies / Prerequisites
- **Sequenced after C14** (`dispatch_pins` first-class handoff field,
  schema v8) — shipped 2026-07-09, v3.56.0. Confirmed: the pins line above
  references the field directly; there is no remaining `pending_notes`
  pin convention to describe or deprecate.
- **Token-cap re-baseline is qa-owned and mandatory, not optional**: adding
  this section to `content/skill-coordinator.md` grows the "teamwork"
  bundle that `test/context-budget.test.mjs`'s AC8 design-arm floor test
  measures (`content/skill-coordinator.md` fixture, cap currently
  `<= 11445` — see that file's inline history of every prior
  skill-coordinator.md-touching feature's cap bump). Per the established
  Phase-2 convention, the new cap MUST be the exact independently
  re-measured value (no headroom), and only qa-engineer may write it
  (Constitution §2 Test ownership).
- No external references (URLs, Figma, tickets, Azure DevOps) were found
  in the backlog item text — Resource Audit Gate: zero hits, field omitted.
- Non-design ticket: no `design/<feature>.md`, Scope Decision Gate not
  armed. `scope_decision: "single-feature"` recorded on the routing write
  per standing PM practice regardless.
- Routing: `next_role: sr-engineer` (not architect) — single file
  (`content/skill-coordinator.md`), no new data model, no cross-cutting
  API/interface, well under the ≥3-module architect threshold. Matches the
  precedent set by C15/C16 (content-only, sr-engineer-routed, no
  architect hop).
