# e2-bugfix-repro-gate

## Problem Statement
Every ticket today pays the full feature-chain shape (pm spec → architect →
sr-engineer → code-reviewer → qa-engineer) regardless of whether the work is
a new feature or a small bug fix. A bug fix either eats that same overhead
(architect hop, full spec schema) or gets dispatched via lite mode, which has
no independent QA at all. Neither option enforces the one discipline that
makes an *automated* bug fix trustworthy: a reproduction test that is proven
red BEFORE the fix exists, so a subsequent green run is evidence the bug is
actually gone rather than evidence that code merely changed. This is the same
class of "PASS ≠ actually fixed" risk the F2 false-green postmortem surfaced
for features, applied to the bug-fix path specifically — and C15 already
built (for a different purpose, intentional non-failing reds) the exact
manifest-diff machinery this ticket needs to reuse rather than reinvent.

## User Stories
- As a PM cutting a small bug-fix ticket, I want to mark it as bugfix-mode so
  it defaults to a lighter pm → sr-engineer → qa-engineer chain (architect and
  design-auditor skipped by default), so that trivial fixes don't pay
  full-feature overhead.
- As a sr-engineer picking up a bugfix-mode ticket, I want the server to
  refuse my fix-phase work until I've recorded a repro manifest proving the
  bug reproduces (fails) before my change, so that I can't skip repro-first
  discipline under time pressure or force of habit.
- As a qa-engineer reviewing a bugfix-mode ticket, I want PASS to require
  exactly the declared repro red-set turned green with zero new reds, so that
  "fixed" is a machine-checked outcome, not a self-report.
- As a PM or coordinator facing a bug whose fix is actually cross-cutting, I
  want to opt back into the full feature chain (architect included), so that
  bugfix-mode is a default-light path, not a hard ceiling that blocks
  legitimate design work.

## Acceptance Criteria
- **AC1** — Given a PM ticket cut carrying a bugfix-mode signal, when the
  coordinator dispatches the chain, then the default routing is
  pm → sr-engineer → code-reviewer → qa-engineer with no architect or
  design-auditor hop, using the state machine's existing
  `pm:In_Progress → sr-engineer:In_Progress` edge (already legal in
  `tools/transitions.ts` — no new edge required for this hop specifically).
- **AC2** — Given a bugfix-mode ticket, when sr-engineer attempts a fix-phase
  `tw_update_state` write without having first recorded a repro manifest
  (a machine-checkable artifact naming the failing reproduction test(s),
  reusing the C15 manifest shape/location convention), then the server
  rejects the write with a dedicated gate error code — the write is blocked,
  not merely advised against.
- **AC3** — Given the repro manifest exists and sr-engineer's fix makes those
  named test(s) pass, when qa-engineer reaches Phase 0.5-equivalent review,
  then PASS requires exactly that declared red-set to have turned green AND
  zero NEW reds introduced elsewhere — an actual red not on the manifest is a
  regression, not a disposable finding (mirrors the existing expected-red
  regression posture in `content/skill-qa-engineer.md`, but load-bearing for
  PASS in bugfix mode rather than advisory).
- **AC4** — Given a bugfix-mode ticket where the PM or coordinator judges the
  fix is actually cross-cutting (touches ≥3 modules, a data-model change, or a
  cross-cutting API — the same threshold skill-pm already uses to route
  architect), when they explicitly opt back in, then the full feature chain
  (architect included) remains available — bugfix mode never removes that
  option, it only changes the *default*.
- **AC5** — Given any feature-mode ticket in flight (no bugfix-mode signal),
  when this feature ships, then zero behavior change occurs to existing
  `ALLOWED_TRANSITIONS` edges, round caps, or the existing (advisory) C15
  expected-red manifest/diff mechanism for feature-mode chains — this feature
  is additive only.
- **AC6** — Given a bugfix-mode ticket with NO repro manifest ever declared
  (e.g. the "bug" turns out to need no red-first proof, or sr-engineer
  determines repro isn't feasible), when sr-engineer instead escalates per
  the constitution's standard Blocked protocol, then the gate's failure mode
  is a clear, actionable rejection message — never a silent skip and never a
  crash.

## Copy / Strings
| string id | exact text (quote verbatim) | source |
|---|---|---|
| N/A | — | — | feature has no user-facing strings — internal governance/server mechanism only |

## Visual Tokens
| token id | property | value (quote verbatim) | source |
|---|---|---|---|
| N/A | — | — | feature has no visual literals |

## Visual Widgets
| widget id | description | source-node |
|---|---|---|
| N/A | — | feature has no non-primitive widgets |

## Out of Scope
- Auto-classifying whether an incoming ticket is "bug" vs "feature" — that
  stays a PM judgment call at ticket-cut time (AC4's opt-in/opt-out is manual,
  not inferred from commit message or diff shape).
- Retrofitting already-in-flight feature-mode tickets to bugfix mode
  mid-chain.
- Changing C15's existing expected-red manifest semantics for feature-mode
  chains (AC5) — bugfix mode's stricter, load-bearing PASS criterion (AC3) is
  a bugfix-mode-only behavior, not a retroactive tightening of the existing
  advisory mechanism.
- Automated bug triage, severity scoring, or any UI for filing bugs — out of
  scope; this ticket is chain/gate mechanics only.

## Dependencies / Prerequisites
- **Reuses C15 machinery** (do not reinvent): `gates/expected-red.ts`
  (`hasExpectedRedManifest`, `hasExpectedRedDisposition`), the
  `qa_reports/expected-red_<feature>.txt` manifest convention,
  `content/skill-qa-engineer.md` Phase 0.5, `content/skill-code-reviewer.md`
  step 4a. Architect should determine how much of AC2/AC3's stricter,
  load-bearing behavior can be built as a thin wrapper/extension over this
  existing module vs. needs a sibling module — this is an architecture
  decision, not a PM one.
- **Open design question for architect** (this ticket is architect-routed;
  see Scope/Cut rationale below): how is "bugfix dispatch mode" signaled and
  persisted? Candidates: (a) a new first-class handoff field (e.g.
  `dispatch_mode?: "feature" | "bugfix"`, schema `handoff` v10→v11 per
  `docs/schema-versions.md`, following the `next_role`/`dispatch_pins`
  absence-is-signal precedent — likely fit since "feature" is the default and
  absence should mean feature-mode, not require a seeded value); (b) a
  `.current/.config.json` flag (file-mode-only, no schema bump, mirrors the
  C4 `driftBaselineIds` precedent); (c) a `pending_notes` convention (rejected
  by default per the C9/C14 precedent — first-class fields superseded
  free-text protocol tokens for exactly this reason, don't regress). PM's
  read: (a) is most consistent with recent precedent (C9, C14, D5) but the
  final call, exact field shape, and gate error-code name belong to the
  architecture doc.
- Depends on `tools/transitions.ts` / `gates/registry.ts` (new gate error
  code for AC2) and `tools/handoff-orchestrator.ts` (where the C15-precedent
  gate blocks live — NOT `tools/transitions.ts` itself, which stays pure/
  fs-free per that module's existing header comment).
- **Resource Audit Gate**: scanned the backlog E2 entry (`docs/backlog.md`)
  for external references (`http(s)://`, figma, sketch, JIRA/ADO links,
  "see <ticket>") — zero hits. Field omitted (absence = non-blocking, per
  Constitution §7 / skill-pm Gate Summary).
- **Question Batch Gate**: no clarification accumulated that requires human
  input beyond the mechanism decision already delegated to architect above —
  gate is a no-op for this ticket.
- **Scope Decision Gate**: not armed — no `design/e2-bugfix-repro-gate.md`
  exists (non-design feature); gate does not apply, no action taken on this
  write.

## Complexity / routing rationale
This ticket touches ≥3 modules (`tools/transitions.ts`/`gates/registry.ts`,
`tools/handoff-orchestrator.ts`, `content/skill-{pm,sr-engineer,qa-engineer}.md`)
and is a plausible new-data-model candidate (a `dispatch_mode` handoff field)
per skill-pm's architect-routing threshold — routed to **architect** first,
mirroring the D5/D6/E1 precedent of an `-ARCH` task producing
`specs/e2-bugfix-repro-gate-architecture.md` before sr-engineer implementation
tasks are picked up.
