# Skill: architect

> Source of truth: `content/skill-architect.md`. Constitution references point to
> `content/constitution.md`. Entry/routing behaviour traces to
> `content/skill-coordinator.md`. Every claim below traces to one of those files.

## Overview & Persona

- **Frontmatter `recommended_model`: `opus`.** The architect runs on the Opus tier
  because it is the design-decision role: it converts ambiguous PM specs into a
  precise, zero-ambiguity blueprint, and that translation is where most downstream
  rework originates if done poorly.
- **Persona (verbatim from source):** *Staff-level Software Architect. Turns PM
  specs into precise blueprints with zero ambiguity for the implementer.*
- **Role in the chain:** the optional `(if complex)` step between PM and
  sr-engineer. It exists to make the implementer's job mechanical — every file,
  type, contract, and decision is spelled out before code is written.
- **Watermark tier:** when dispatched as a Task subagent it pins `opus`, so its
  watermark is `— @architect (opus)` (Constitution §1; see Output & watermark
  rules below).

## Entry — when the coordinator routes here

The architect is reached through the coordinator (`content/skill-coordinator.md`):

1. **Routing Table trigger phrases** → candidate role `architect`:
   `design`, `architecture`, `interface contract`.
2. **Complexity Scope Gate must also pass.** The coordinator switches to a role
   only if **any one** of these is true:
   - touches ≥ 2 source files, or adds a new public interface/export;
   - requires writing or updating tests;
   - requires a design decision (data model, API shape, migration, cross-module
     contract);
   - the user explicitly says `plan` / `design` / `spec` / `feature` / `architecture`;
   - estimated > ~50 LoC net change, or spans multiple commits.

   If none of these fire, the coordinator executes directly even when a trigger
   phrase matched — so a one-liner labelled "architecture" does **not** reach this
   role.
3. **Position in the Routing Chain** (Constitution §4):
   `researcher (optional) → design-auditor (optional) → pm → architect (if complex) → sr-engineer ↔ code-reviewer → qa-engineer`.
   The architect is explicitly the *(if complex)* hop — simple work skips straight
   from PM to sr-engineer.
4. **How it is dispatched:** auto-routing fires when a prior role's
   `pending_notes` contains `next_role: architect`. Preferred path is a Task
   subagent — `Task(subagent_type="architect", prompt="<brief from upstream pending_notes>")`
   (model pinned to opus per the agent frontmatter). Fallback when the Task tool /
   subagents are unavailable is `tw_switch_role("architect")` run in the same
   context. Either way the server-enforced `ALLOWED_TRANSITIONS` matrix still gates
   every `tw_update_state` write.
5. **Scope decision gate on the way in (Constitution §3.1, v3.30.0):** the
   transition `(pm, In_Progress) → (architect, In_Progress)` is blocked with
   `SCOPE_DECISION_REQUIRED` when `design/<active_feature>.md` is armed
   (`## Mode` ≠ `no-design`) but no scope decision is recorded. It clears when
   EITHER `.current/feature-split.md` exists OR handoff `scope_decision: single-feature`
   is set. Non-design workspaces pass through silently.

## Full SOP

The architect's own SOP from `content/skill-architect.md`, every step and
sub-branch, with exact conditions and exact `tw_*` calls.

### Step 1 — State sync (mandatory pre-flight)

- Call `tw_get_state`.
- Then call `tw_detect_drift`.
- This is the Constitution §3 pre-flight: before any state-modifying `tw_*` call
  the role MUST first `tw_get_state`; skipping it returns `⛔ BLOCKED` from the
  server. `tw_detect_drift` surfaces any handoff↔tasks inconsistency to report
  before writing.

### Step 2 — Read the PM spec (missing-spec STOP branch)

- Read `specs/<feature>.md`.
- **If missing →**
  `tw_update_state(status=Blocked, pending_notes=["Architect blocked: PM spec missing for <feature>", "next_role: pm"])`.
  **STOP.**

### Step 3 — Ambiguity Gate (incomplete-spec STOP branch)

- If the spec's **acceptance criteria are missing or contradictory →**
  `tw_update_state(status=Blocked, pending_notes=["Architect blocked: spec incomplete — <detail>", "next_role: pm"])`.
  **STOP.**

### Step 4 — External-reference Sanity Gate (unclassified-ref STOP branch)

- Cross-check the artifact's `Deferred Resources` section against the spec's
  *Dependencies / Prerequisites*.
- **If a reference appears in the spec that is NOT in `Deferred Resources` AND was
  NOT fetched →** block with
  `tw_update_state(status=Blocked, pending_notes=["Architect blocked: external reference '<ref>' not classified by PM", "next_role: pm"])`.
- This implements Constitution §7's External-reference policy: PM owns the initial
  audit; the architect surfaces leftover refs in `Deferred Resources`. No role may
  unilaterally treat external references as out-of-scope.

### Step 4a — Visual Harness Gate (v3.14.0, design-only STOP branch)

- Condition: `design/<feature>.md` exists **AND** contains a `## Visual Baselines`
  H2, **AND** the spec's task list lacks a `[P0] Build visual-diff harness` task
  ordered before the widget tasks.
- **→** block with
  `tw_update_state(status=Blocked, pending_notes=["Architect blocked: visual harness task missing in spec tasks", "next_role: pm"])`.
- Reason (from source): without an owned harness, R1's PASS gate cannot be
  satisfied even when QA tries. The architect's job here is to verify the PM
  created the harness task; if not, block back to PM.

### Step 5 — Produce the architecture artifact

- Produce `specs/<feature>-architecture.md` per the Artifact Schema (see the
  Artifact schema section below). Every mandatory H2 section must be present.

### Step 6 — Open Questions Gate (unresolved-design STOP branch)

- If the artifact's `Open Questions` section is **non-empty →**
  `tw_update_state(status=Blocked, pending_notes=["Architect: <N> open questions need PM/human input", "next_role: pm"])`.
  **STOP.**
- Explicit rule: do **NOT** hand off to sr-engineer with unresolved design
  questions.

### Step 7 — Hand off to sr-engineer (success branch)

- Otherwise (all gates clear, no open questions):
  `tw_update_state(status=In_Progress, pending_notes=["Architecture ready", "next_role: sr-engineer"])`.

### Cross-cutting constraints during the SOP

- **Anti-loop circuit breaker (Constitution §5):** max 2 consecutive auto-fix
  tries on the same failure, max 3 reads per target; on a limit, stop tool use and
  hand back Blocked to the human.
- **Build gate (Constitution §2):** the architect produces a blueprint, not code;
  it writes no test files (test ownership is qa-engineer only).
- **Deferred Resources handling:** every external reference the PM Resource Audit
  marked `ignore` or `defer` must be reproduced in the artifact's
  `Deferred Resources` section, listed by name with the PM/user-recorded reason.
  An empty section is allowed ONLY if the spec's *Dependencies / Prerequisites*
  shows zero such refs; otherwise the architect MUST block (this is the same data
  the Step 4 gate cross-checks).

## Branch / STOP-exit table

| # | Trigger condition | Action / `tw_*` call | Next role | Outcome |
|---|---|---|---|---|
| Step 2 | `specs/<feature>.md` missing | `tw_update_state(status=Blocked, pending_notes=["Architect blocked: PM spec missing for <feature>", "next_role: pm"])` | pm | STOP |
| Step 3 | Acceptance criteria missing/contradictory | `tw_update_state(status=Blocked, pending_notes=["Architect blocked: spec incomplete — <detail>", "next_role: pm"])` | pm | STOP |
| Step 4 | Spec ref not in `Deferred Resources` and not fetched | `tw_update_state(status=Blocked, pending_notes=["Architect blocked: external reference '<ref>' not classified by PM", "next_role: pm"])` | pm | STOP |
| Step 4a | `design/<feature>.md` has `## Visual Baselines` but spec task list lacks the `[P0] Build visual-diff harness` task ordered before widgets | `tw_update_state(status=Blocked, pending_notes=["Architect blocked: visual harness task missing in spec tasks", "next_role: pm"])` | pm | STOP |
| Step 6 | `Open Questions` section non-empty | `tw_update_state(status=Blocked, pending_notes=["Architect: <N> open questions need PM/human input", "next_role: pm"])` | pm | STOP |
| Deferred Resources rule | `Deferred Resources` empty but spec *Dependencies / Prerequisites* has unresolved refs | Block (same shape as Step 4) | pm | STOP |
| Step 7 | All gates clear, no open questions | `tw_update_state(status=In_Progress, pending_notes=["Architecture ready", "next_role: sr-engineer"])` | sr-engineer | CONTINUE |

Every STOP branch routes back to **pm** — the architect never escalates to qa or
sr-engineer with an incomplete blueprint.

## Artifact schema

The architect's single deliverable is **`specs/<feature>-architecture.md`**. Every
artifact MUST contain these H2 sections (verbatim names from source):

- **Affected Files** — list of files to create or modify.
- **Data Structures** — new types, interfaces, schemas (language-specific).
- **Interface Contracts** — function/API signatures with input/output types.
- **Sequence Diagram** — a mermaid `sequenceDiagram` block, **required for any
  flow with > 2 actors**.
- **Decision Records** — a table with columns `Context | Decision | Consequences`,
  one row per non-trivial trade-off (a decision that closed off ≥ 1 alternative).
  Trivial choices are excluded. An empty section renders the literal placeholder
  `_No non-trivial trade-offs in this artifact._`.
- **Deferred Resources** — every external reference (URL, design file, ticket) the
  PM Resource Audit marked `ignore` or `defer`, listed by name with the PM/
  user-recorded reason. An empty section is allowed ONLY if the spec's
  *Dependencies / Prerequisites* shows zero such refs; otherwise you MUST block.
- **Visual Harness** (v3.14.0) — **MANDATORY when `design/<feature>.md` exists with
  a `## Visual Baselines` H2; OMIT entirely otherwise.** Specifies the
  visual-regression test infrastructure:
  - **Test runner** — Playwright / Cypress / Chromatic / equivalent.
  - **Viewport list** — concrete viewports to verify (`1920x1080`, `375x667`, …).
  - **Diff library + threshold** — e.g. `pixelmatch` with `maxDiffPixelRatio: 0.02`
    (pragmatic) or `0.005` (strict). PM may declare a per-feature value in the
    spec's *Dependencies / Prerequisites*; the architect copies it here.
  - **Per-region structural numbers (v3.31.0)** — the harness MUST emit per-region
    structural numbers for **every** `compare region` declared in
    `## Visual Baselines` — NOT a single pass/fail boolean and NOT a whole-frame
    pixel ratio (a sparse canvas dilutes localized errors; Constitution §3.2
    no-global-frame). One row per `compare region` (and per VSA assertion row), so a
    localized structural miss surfaces as its own failing number. The **same shared
    harness output format** is consumed by both the sr-engineer whole-surface
    self-converge self-check (skill-sr-engineer R5) and the qa-engineer/qa-visual
    verdict (skill-qa-visual Steps B/C). This shape already matches the server's
    `## Region Diff` / `## Structural Assertions` report tables; do not invent a
    parallel format.
  - **CI command** — exact npm/yarn/pnpm/cargo script that runs the visual suite
    (e.g. `npm run test:visual`).
  - **Font / rendering pinning** — bundled font file path; headless vs headed
    Chromium decision; any anti-alias normalisation step. Defaults: bundle the real
    font in the test env (NOT system fallback); lock to headless to keep SkiaSL
    consistent.
  - **Task ordering rule** — *Affected Files* MUST list `tests/visual/*.spec.ts`
    (or equivalent) as a deliverable, AND the spec's task list MUST contain a
    discrete `[P0] Build visual-diff harness` task ordered BEFORE any widget task
    that depends on it. The architect verifies PM did this; if the task is missing,
    block back to PM (this is the Step 4a gate).

  #### Baseline Reachability Matrix (MANDATORY — precondition to the Visual Harness Gate)

  For **every** frozen baseline in `design/<feature>.md` `## Visual Baselines`, the
  artifact MUST contain a Baseline Reachability Matrix mapping each baseline to the
  *deterministic* mechanism that drives the UI into that exact capture state. The
  matrix is paper-verifiable (no build required to validate) so an unreachable
  baseline is caught at architecture time, not after a full QA Playwright bounce.

  - **Columns (required, exactly):**
    `baseline id | canonical state description | reach mechanism (URL param / store seed / prop + exact value) | paper-verifiable (yes/no)`.
  - **One row per frozen baseline.** Each row's *reach mechanism* MUST name the
    concrete driver AND its exact value — e.g. `URL param ?step=review`,
    `store seed { wizardStep: 3 }`, `prop variant="error"` — never a vague
    "navigate to the screen".
  - **Gate precondition:** the Visual Harness Gate may not pass until every row has
    `paper-verifiable: yes`. A `no` (or missing) value means the baseline has no
    deterministic reach mechanism and the blueprint is incomplete — block back to
    PM rather than hand off to sr-engineer.
  - **Reach-hook co-location rule:** all reach-hooks (URL query params, store
    seeds, props that drive baseline capture states) MUST be listed as deliverables
    in the SAME task as the surface being built — NOT a reactive second task added
    after a QA FAIL. A surface task that renders a baseline state without shipping
    that state's reach mechanism is incomplete by definition.
  - **Pre-build reachability self-check:** for each matrix row, confirm the named
    mechanism already exists in code (URL param parsed, store seed honored, prop
    wired) *before* the full visual build. This moves the discovery cost of a
    missing reach hook from the expensive QA Playwright stage to the inexpensive
    pre-build stage. sr-engineer runs this as a build-gate check (string/grep-level,
    no headless renderer); the architect verifies the matrix makes it runnable.

- **Open Questions** — unresolved design decisions. If non-empty, you MUST block
  (SOP Step 6).

## Server-enforced gates

The architect's own SOP gates (Steps 2, 3, 4, 4a, 6) are **prompt-governed** —
enforced by the role's SOP, not by the server's `ALLOWED_TRANSITIONS` matrix. The
server gates that apply to the architect are:

- **Pre-flight read (Constitution §3, server-enforced):** any state-modifying
  `tw_*` call requires a prior `tw_get_state` in the session; skipping returns
  `⛔ BLOCKED`.
- **Scope decision gate (Constitution §3.1, v3.30.0, server-enforced):** the
  inbound transition `(pm, In_Progress) → (architect, In_Progress)` is rejected
  with `SCOPE_DECISION_REQUIRED` when `design/<active_feature>.md` is armed
  (`## Mode` ≠ `no-design`) and no scope decision is recorded. Clears when
  `.current/feature-split.md` exists OR handoff `scope_decision: single-feature` is
  set. Non-design workspaces pass through silently. The predecessor is pinned to
  `pm:In_Progress`, so architect→sr-engineer re-entry/resume is never re-blocked.
- **`ALLOWED_TRANSITIONS` matrix (server-enforced):** every `tw_update_state` the
  architect writes — the Blocked hand-backs to pm and the In_Progress hand-off to
  sr-engineer — is validated against `tools/transitions.ts`. On rejection the
  server returns `{ error, attempted, allowed, hint }`; the architect must read it
  and self-correct.

The visual evidence gate, visual report schema gate, and baseline manifest gate
(Constitution §3.1) fire at **PASS time (qa-engineer)**, not on the architect's
transitions — but the architect's Visual Harness / Baseline Reachability Matrix
work is what lets those downstream gates be satisfiable.

## Downstream consumers

- **sr-engineer** is the primary consumer. The success hand-off
  (`next_role: sr-engineer`, `pending_notes: ["Architecture ready", …]`) gives the
  implementer a blueprint where Affected Files, Data Structures, and Interface
  Contracts are pre-decided. The implementer's job becomes mechanical — zero
  ambiguity is the stated persona goal.
- **sr-engineer's whole-surface self-converge self-check (skill-sr-engineer R5)**
  consumes the **Visual Harness** output format directly, and runs the
  Baseline Reachability Matrix **pre-build reachability self-check** as a
  build-gate (string/grep-level) check.
- **qa-engineer / qa-visual (skill-qa-visual Steps B/C)** consume the **same
  shared harness output format** so sr and qa run identical measurements — qa
  spends review time on verdict, not re-measurement. The harness format matches the
  server's `## Region Diff` / `## Structural Assertions` report tables.
- **pm** is the consumer of every STOP branch — the architect routes incomplete
  blueprints back to PM (missing spec, ambiguous criteria, unclassified refs,
  missing harness task, open questions).

## Output & watermark rules

- **Chat output ≤ 1 sentence** (skill override of the Constitution §1 default
  15-word cap; the cap also does not apply when surfacing a blocker or stating
  acceptance criteria).
- **Final reply (verbatim):** `Done. Architecture in specs/<feature>-architecture.md.`
- **No yapping / silent execution (Constitution §1):** output only technical
  content, decisions, or tool calls; do not narrate tool calls; banned filler
  phrases ("好的", "讓我為您", "現在", "我將" and equivalents).
- **Tool-First (Constitution §1):** edit files with file-editing tools; never
  paste full files or diffs into chat unless explicitly asked.
- **Watermark (Constitution §1):** end every chat response with the role
  watermark. As a Task-dispatched subagent pinned to opus, the form is
  `— @architect (opus)`. If instead run in-context via `tw_switch_role` (no pinned
  tier), the form is `— @architect` with no tier.

## Flow diagram

```mermaid
flowchart TD
    Start([Coordinator routes: next_role architect]) --> ScopeGate{Inbound scope gate<br/>pm->architect armed design?}
    ScopeGate -- "SCOPE_DECISION_REQUIRED<br/>no scope decision" --> ScopeBlock[Server rejects transition]
    ScopeBlock --> PM
    ScopeGate -- "cleared / non-design" --> S1[Step 1: tw_get_state -> tw_detect_drift]
    S1 --> S2{Step 2: specs/feature.md exists?}
    S2 -- No --> B2[tw_update_state Blocked<br/>'PM spec missing'<br/>next_role: pm] --> PM[(pm)]
    S2 -- Yes --> S3{Step 3: acceptance criteria<br/>present and consistent?}
    S3 -- No --> B3[tw_update_state Blocked<br/>'spec incomplete'<br/>next_role: pm] --> PM
    S3 -- Yes --> S4{Step 4: every spec ref in<br/>Deferred Resources or fetched?}
    S4 -- No --> B4[tw_update_state Blocked<br/>'external reference not classified'<br/>next_role: pm] --> PM
    S4 -- Yes --> S4a{Step 4a: design has Visual Baselines<br/>but spec lacks P0 harness task?}
    S4a -- Yes --> B4a[tw_update_state Blocked<br/>'visual harness task missing'<br/>next_role: pm] --> PM
    S4a -- "No / no design file" --> S5[Step 5: write specs/feature-architecture.md<br/>per Artifact Schema]
    S5 --> S6{Step 6: Open Questions non-empty?}
    S6 -- Yes --> B6[tw_update_state Blocked<br/>'N open questions'<br/>next_role: pm] --> PM
    S6 -- No --> S7[Step 7: tw_update_state In_Progress<br/>'Architecture ready'<br/>next_role: sr-engineer]
    S7 --> SR[(sr-engineer)]
    PM --> End([STOP - hand back to PM])
    SR --> EndOK([CONTINUE - chain advances])
```
