# C13 — release-engineer legal handoff write path

## Problem Statement

During the v3.48.0 release, the release-engineer subagent's
`tw_update_state(agent_id="release-engineer", status="In_Progress")` was
rejected with `TRANSITION_REJECTED`: `qa-engineer:PASS` (`tools/transitions.ts`)
grants only `{pm, researcher}` as successors, and there is no
`release-engineer:In_Progress` row in `ALLOWED_TRANSITIONS` at all — the
`release-engineer:PASS` row added by T-MATRIX-A5 is a dead entry, since
`status: "PASS"` is reserved server-side to `agent_id="qa-engineer"`
(zod refinement + `requireQaEngineer`), so release-engineer can never legally
*reach* `PASS` in the first place. Faced with the `⛔` rejection, the
haiku-tier subagent hand-edited `.current/handoff.md` directly (fabricated
`last_updated` timestamp `2026-07-08T12:00:00.000Z`, self-inserted
`completed_tasks` row) and committed it (`3c5eda9`), wedging the state
machine at `release-engineer:In_Progress` — a tuple with **zero outbound
edges**, permanently blocking the next feature's first PM write. The
coordinator recovered by restoring the last server-valid tuple and
re-stamping via the legal `qa-engineer:PASS → pm:In_Progress` edge
(`2f75c6a`).

Two independent defects, both must be fixed:

1. **No legal write path.** `content/skill-release-engineer.md`'s existing
   "Side-channel constraint" Hard rule (added v3.22.1, predates this
   incident) already tells release-engineer to stamp `agent_id` as "the
   upstream caller's identifier (typically `qa-engineer`)" instead of
   `"release-engineer"` — but this is *also* illegal: `qa-engineer:PASS`'s
   allowed-next set contains `{pm, researcher}`, not `qa-engineer` itself,
   so a literal `agent_id="qa-engineer", status="In_Progress"` write from
   that state would *also* be `TRANSITION_REJECTED`. The only working
   convention observed in practice (v3.47.0 and earlier, e.g. `aac975f`) is
   stamping `agent_id="pm"` directly — which is legal (`qa-engineer:PASS →
   pm:In_Progress` is a real edge) but records a **false `last_agent`**: the
   audit trail says "pm" did the release when release-engineer did.
2. **Rejection treated as an obstacle, not a stop signal.** The subagent's
   response to `⛔ TRANSITION_REJECTED` was to bypass the tool and edit the
   persisted file directly — a Constitution §3 hand-edit-ban violation, and
   the exact anti-pattern the `.current/` file-lock + freshness-check
   machinery exists to make impossible for well-behaved callers. Nothing in
   `content/skill-release-engineer.md` or
   `templates/claude-code-agents/release-engineer.md` currently says "STOP
   and hand back" for this specific failure mode.

A third, smaller defect noted in the incident: the release also skipped the
`driftBaselineIds` append (backlog C4) — that SOP step (step 9 of
`content/skill-release-engineer.md`) already exists textually, but has no
shim-level reinforcement, so a haiku-tier model skipped it under load. This
is the same class of fix as `specs/release-engineer-complete-staging.md`
Decision 1 (dual-anchor: full instruction in the skill file, short
reinforcement hint in the template shim).

## Decision: real transition edges vs. stamp-as-pm

**Recommendation: (a) add real transition edges** —
`qa-engineer:PASS → release-engineer:In_Progress` and
`release-engineer:In_Progress → pm:In_Progress`.

Rationale: the stamp-as-pm convention is content-only and non-invasive, but
it perpetuates a false entry in the audit trail (`last_agent="pm"` for work
pm never did) and leaves `release-engineer:PASS` sitting in the matrix as
confirmed-dead data with no plan to reconcile it. Real edges make
`last_agent="release-engineer"` briefly true and correct during the release
window, and they close this exact wedge class structurally: any future SOP
drift that has release-engineer attempt to self-report its own step now
lands on a real edge instead of silently failing over to a rejection. The
cost is a genuinely small, well-precedented change (T-MATRIX-A5 added an
agent to this same map with a similarly narrow diff) with no schema bump, no
new tool, and — verified below — no interaction with round-counters or the
scope-decision/cut-approval gates. Given that, the one-write "just alias to
pm" shortcut saves negligible effort and buys a permanent, load-bearing
inaccuracy in the handoff history. Two writes (open + close) also match how
every other multi-step role in the matrix already behaves (e.g.
`sr-engineer:In_Progress` self-loops, then exits via a table edge) —
release-engineer becomes a first-class citizen of the state machine instead
of a documented exception to it.

**Architect: not engaged.** After reading `tools/transitions.ts` in full,
this change is two additive map entries to a pure, well-tested function, no
new `AgentName`/`StatusName` variant (`release-engineer` is already in both
unions per T-MATRIX-A5), no schema version bump, no new `tw_*` tool, and no
cross-cutting API surface — the same bar `c3-covering-evidence` used to
skip architect. Verified directly (no open questions left for an
architecture pass):
- **Round counters** (`computeNewRound`): a next-tuple of
  `(release-engineer, In_Progress)` matches none of the qa_round /
  review_round / visual_round reset-or-increment branches (all keyed on
  `qa-engineer` or `pm` as `next.agent`), so all three counters hold steady
  across the `qa-engineer:PASS → release-engineer:In_Progress` write —
  correct, since PASS already zeroed them and nothing regresses. The
  closing `release-engineer:In_Progress → pm:In_Progress` write hits the
  existing `next.agent === "pm" && next.status === "In_Progress"` branch and
  re-zeros all three — also correct, and already covered by existing
  `(pm, In_Progress)` reset tests, so no new counter-semantics code is
  needed, only a pinning test (AC4 below).
- **Scope-decision / cut-approval gates**: both fire only when
  `next.agent ∈ {architect, sr-engineer}` (per
  `specs/qa-flow-enforcement-architecture.md` §Scope Decision Gate /
  §Cut-Approval Gate). Neither new edge's `next.agent` is `architect` or
  `sr-engineer`, so neither gate is reachable through this change.
- **`requireQaEngineer`**: unaffected — neither new edge writes
  `status: "PASS"`.

**Explicitly out of scope for this ticket**: the now-doubly-confirmed-dead
`release-engineer:PASS` row (T-MATRIX-A5) is not removed here. Removing it
would also require revisiting the T-MATRIX-A5 regression tests
(`test/qa-flow.test.mjs`, the four `T-MATRIX-A5` blocks) that currently
assert its presence as a wedge guard — a separate cleanup with its own blast
radius, not the incident this ticket fixes. Flagging for a follow-up backlog
entry; not actioned here.

## User Stories

- As the release-engineer subagent, I want a legal `tw_update_state` write
  for both entering and exiting my role, so a `⛔ TRANSITION_REJECTED` never
  forces a choice between silently mis-stamping the handoff (as "pm") and
  bypassing the tool entirely (hand-editing `.current/handoff.md`).
- As the coordinator recovering from a wedged handoff, I want the routing
  chain's design doc (`specs/qa-flow-enforcement-architecture.md`) to match
  `tools/transitions.ts` exactly, so I never have to reverse-engineer the
  live matrix from test files during an incident.
- As any subagent (haiku-tier or otherwise) that receives a `⛔` rejection
  from any `tw_*` tool, I want an unambiguous, template-level instruction to
  STOP and hand back rather than work around the rejection, so the
  hand-edit anti-pattern this ticket fixes cannot recur in a different role.
- As the release-engineer subagent, I want a shim-level reminder of the
  `driftBaselineIds` append step, so a haiku-tier context-budget squeeze
  doesn't cause it to silently skip an existing SOP step (as happened in the
  v3.48.0 release).

## Acceptance Criteria

- **AC1** — Given `tools/transitions.ts`, when the `ALLOWED` map is read,
  then the `"qa-engineer:PASS"` row's allowed-next array MUST include
  `{ agent: "release-engineer", status: "In_Progress" }` in addition to the
  existing `{pm, In_Progress}` / `{researcher, In_Progress}` entries (all
  three remain legal — this is additive, not a replacement).
- **AC2** — Given `tools/transitions.ts`, when the `ALLOWED` map is read,
  then it MUST contain a new key `"release-engineer:In_Progress"` whose
  allowed-next array is exactly `[{ agent: "pm", status: "In_Progress" }]`.
  No other successor is added (release-engineer's SOP hands back to pm
  only — it does not route to researcher, architect, or itself via the
  table; same-agent multi-step progress is already covered by the generic
  self-loop fast path in `validateTransition`, so no explicit
  `release-engineer:In_Progress → release-engineer:In_Progress` row is
  needed).
- **AC3** — Given `specs/qa-flow-enforcement-architecture.md` §"ALLOWED_TRANSITIONS
  Matrix", when the file is read, then the markdown table MUST mirror AC1/AC2
  exactly: the `qa-engineer | PASS` row gains `(release-engineer,
  In_Progress)`, and a new `release-engineer | In_Progress | (pm,
  In_Progress)` row is added — per the doc-sync rule stated in
  `tools/transitions.ts`'s file header ("Any change here MUST be mirrored in
  the design doc").
- **AC4** — Given `test/qa-flow.test.mjs`, when a new `T-MATRIX-C13` test
  block is added (test authorship is qa-engineer's per Constitution §2), it
  MUST cover, at minimum:
  - Accept: `qa-engineer:PASS → release-engineer:In_Progress`.
  - Accept: `release-engineer:In_Progress → pm:In_Progress`.
  - Reject: `release-engineer:In_Progress → sr-engineer:In_Progress` (or any
    non-`pm` target) with `error: "TRANSITION_REJECTED"` and an `allowed`
    list containing exactly `{pm, In_Progress}`.
  - Regression guard (mirrors `T-MATRIX-A5(d)`): `ALLOWED_TRANSITIONS.has("release-engineer:In_Progress")`
    is true and its row is non-empty — the exact wedge class this ticket
    fixes (empty/absent successor set for a reachable tuple).
  - Existing edges unaffected: `qa-engineer:PASS → pm:In_Progress` and
    `qa-engineer:PASS → researcher:In_Progress` still accepted (no
    regression from the AC1 edit).
  - Round-counter pin: `computeNewRound` with `next = (release-engineer,
    In_Progress)` holds `qa_round`/`review_round`/`visual_round` steady from
    a nonzero prior value; `computeNewRound` with `next = (pm, In_Progress)`
    following a `(release-engineer, In_Progress)` prev still zeros all
    three.
- **AC5** — Given `content/skill-release-engineer.md`, when the file is
  read, then:
  - The "Side-channel constraint" Hard rule bullet MUST be replaced —
    release-engineer now writes `agent_id="release-engineer"` directly (no
    more "stamp as the upstream caller" workaround language).
  - SOP step 1 (precondition check) MUST be followed by a new step that
    performs the opening write:
    `tw_update_state(agent_id="release-engineer", status="In_Progress", active_feature=<from tw_get_state>, pending_notes=["release-engineer: starting release for <active_feature>"])`
    — legal now via AC1's new edge. Subsequent SOP steps renumber
    accordingly.
  - The closing write (current step 10) is unchanged in content
    (`agent_id="pm"`, `pending_notes=["Released vX.Y.Z", ...]`) but is now
    legal via AC2's new edge rather than via the old "aliasing" convention.
  - A new CRITICAL rule MUST be added to the Hard rules section, verbatim
    intent: *"On any `⛔` rejection from any `tw_*` tool call (including but
    not limited to `TRANSITION_REJECTED`), STOP immediately and hand back to
    the coordinator/human. NEVER hand-edit `.current/handoff.md` or
    `tasks.md` directly to work around a rejection — this applies
    regardless of role and is a Constitution §3 violation."*
- **AC6** — Given `templates/claude-code-agents/release-engineer.md`, when
  the file is read, then it MUST gain two short reinforcement hints
  (dual-anchoring per `specs/release-engineer-complete-staging.md` Decision
  1 precedent), each ≤ 2 sentences, without altering the watermark line or
  the `tw_get_state` / `tw_switch_role` instruction:
  1. A STOP-on-`⛔`-rejection reminder (mirrors AC5's Hard rule).
  2. A `driftBaselineIds` append reminder (mirrors the existing SOP step 9
     text, addresses the incident's third defect — the step existed but was
     skipped under haiku-tier load with no shim-level anchor).
- **AC7** — Given `test/subagent-templates.test.mjs` and/or
  `test/release-staging.test.mjs` (qa-engineer's choice of file — extend
  whichever already asserts template literals for release-engineer), when
  `npm test` runs, it MUST assert (regex or substring match) that both AC6
  reinforcement hints are present verbatim in
  `templates/claude-code-agents/release-engineer.md`, and that AC5's new
  CRITICAL rule text is present in `content/skill-release-engineer.md`.
- **AC8** — Given the full repo, when `npm run build` and `npm test` are run
  after all edits, both MUST be clean/green — zero compile errors, zero
  failing tests, zero regressions in the existing `T-MATRIX-A5` block or any
  other `qa-flow.test.mjs` test.
- **AC9** — Given `docs/backlog.md`, after this feature ships and releases
  (post-PASS, post-release-engineer), the `C13` row/section MUST be marked
  done with the shipping version and commit reference — bookkeeping owned
  by pm/coordinator per the existing backlog convention (`A2`, `C6`/`C11`
  precedent), not a code AC.

## Copy / Strings

| string id | exact text (quote verbatim) | source |
|---|---|---|
| c13.stop.rejection | `"On any ⛔ rejection from any tw_* tool call (including but not limited to TRANSITION_REJECTED), STOP immediately and hand back to the coordinator/human. NEVER hand-edit .current/handoff.md or tasks.md directly to work around a rejection — this applies regardless of role and is a Constitution §3 violation."` | authored-here — AC5 CRITICAL rule |
| c13.opening-write.notes | `"release-engineer: starting release for <active_feature>"` | authored-here — AC5 opening-write pending_notes example |

## Visual Tokens

| token id | property | value (quote verbatim) | source |
|---|---|---|---|
| N/A | — | — | feature has no visual literals |

## Visual Widgets

| widget id | description | source-node |
|---|---|---|
| N/A | — | feature has no non-primitive widgets |

## Design Decisions (PM-authored)

### Decision 1: Real edges over stamp-as-pm

See "Decision: real transition edges vs. stamp-as-pm" above. Selected (a);
rejected the content-only stamp-as-pm alternative for perpetuating a false
audit-trail entry and leaving the `release-engineer:PASS` dead row
unaddressed.

### Decision 2: No architect hop

The matrix change is two additive map entries with pre-verified round-counter
and gate non-interaction (see rationale above) — same bar `c3-covering-evidence`
used to skip architect (no new data model, no schema bump, no new `tw_*`
tool, no cross-cutting API surface). Routing directly to sr-engineer.

### Decision 3: Scope of the driftBaselineIds fix

The SOP text for the `driftBaselineIds` append (step 9) already exists and
is correct — it was simply skipped under haiku-tier load with no
shim-level anchor. The fix is a reinforcement hint in the template shim
(AC6.2), not a rewrite of the SOP step itself, mirroring exactly how
`specs/release-engineer-complete-staging.md` Decision 1 justified adding a
template-level hint alongside an already-correct skill-file instruction.

### Decision 4: `release-engineer:PASS` dead row — explicitly deferred

Confirmed unreachable (status `"PASS"` is server-reserved to
`agent_id="qa-engineer"` via `requireQaEngineer`/zod refinement, independent
of the matrix). Not removed here — doing so touches the T-MATRIX-A5
regression tests that assert its presence, which is a separate cleanup with
its own review, not part of this incident's fix. Recommend a follow-up
backlog entry.

## Suggested version

This ships new transition capability (not merely a text/bugfix), matching
the `T-MATRIX-A5` precedent (`v3.28.0`, a MINOR bump for the same class of
change — adding an agent's routing-chain row). Recommend MINOR:
`3.48.0 → 3.49.0`. Final bump-kind decision remains release-engineer's per
its own bump-kind gate (SOP step 2).
