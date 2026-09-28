# e3-outcome-shaped-acceptance

## Problem Statement
Every gate this server enforces today is process-shaped: it checks that an
evidence file exists, that it parses, and that the state-machine transition is
legal. Nothing in the chain verifies that the change actually does what the
spec's Acceptance Criteria say. QA writes its own tests and grades its own
homework — a PASS today attests "I looked at this and ran the suite," never
"I drove this AC end-to-end and observed the specified outcome." Two
retrospectives converge on this as the same root cause from different angles:
the F2 false-green postmortem (`research/104445-F2-qa-visual-false-pass-postmortem.md`)
shows qa-visual issuing PASS on DOM/structural assertions alone after the
pixel-diff gate silently degraded — the assertions were orthogonal to the
actual defect (a clipped selection frame), so 40/40 "passing" checks coexisted
with a shipped visual bug. The Mode four-phase retrospective
(`research/mode-feature-process-retrospective.md`) names this the chronic
"PASS ≠ 畫面對" (PASS ≠ the screen is actually right) theme across all four of
its phases, concluding that no automated visual gate ever caught a real
defect — only a human eye, applied after the fact, ever did. Both artifacts
point at the same fix shape: evidence must be tied to *executing the AC*, not
merely to a report file existing.

## User Stories
- As a PM writing acceptance criteria, I want each AC that can be proven by
  one command, test, or pixel-diff to carry that exact proof inline, so that
  "done" has a single unambiguous, executable definition instead of prose a
  reviewer has to interpret.
- As a qa-engineer reviewing a task, I want a mandatory step that actually
  runs each AC's declared proof and records the real command + output, so
  that my PASS reflects something I observed happening, not just that the
  general test suite was green.
- As the server enforcing PASS, I want to reject a PASS write that lacks the
  AC execution log when the spec declares at least one executable AC, so that
  "the runtime-evidence step was skipped" is a blocked transition, not a
  silent gap a busy QA pass could paper over.
- As a PM cutting a ticket whose AC is genuinely subjective (a UX judgment
  call, not a single-command truth), I want to leave that AC's proof
  unspecified without breaking the gate for the rest of the spec, so that this
  mechanism doesn't force fake automation onto criteria that can't honestly
  carry it.

## Acceptance Criteria
- **AC1** — Given a PM spec's Acceptance Criteria section, when an individual
  AC is provable by one command, one test (name), or one pixel-diff region,
  then that AC line carries a `proof:` annotation naming the exact
  command/test-id/region — this spec practices its own schema (see AC5–AC8
  below, each of which is written with a literal `proof:` line).
  proof: `grep -c '^  proof:' specs/e3-outcome-shaped-acceptance.md` returns
  ≥ 4 (one per AC1-schema-compliant AC in this file).
- **AC2** — Given an AC that is genuinely not provable by a single
  command/test/pixel-diff (a subjective judgment call), when PM writes the
  spec, then the AC MAY omit `proof:` and the gate below does NOT require one
  for that AC — "where feasible" is a per-AC judgment, not a blanket
  requirement across every AC in every spec.
  proof: `content/skill-pm.md`'s AC-schema guidance states the annotation is
  conditional ("where feasible"), not unconditional — reviewed verbatim
  against this line at code-review time.
- **AC3** — Given a task under qa-engineer review whose active spec has at
  least one `proof:`-annotated AC, when Phase 3 (Tests) completes, then
  qa-engineer executes each declared proof (or explicitly logs why a
  particular proof could not be run, e.g. missing fixture) and records
  command, raw output/exit code, and a pass/fail verdict per AC under a new
  `## AC Execution Log` H2 in `qa_reports/review_<task-id>.md`, BEFORE
  attempting PASS.
  proof: `content/skill-qa-engineer.md` contains a new mandatory phase
  (inserted between the existing Phase 3 "Tests" and Phase 4 "Run") whose
  heading text the test suite asserts verbatim.
- **AC4** — Given a qa-engineer PASS write for a task whose spec has ≥1
  `proof:`-annotated AC, when the server evaluates the write, then it rejects
  the write with a dedicated gate error code (e.g. `AC_EXECUTION_LOG_MISSING`)
  unless `qa_reports/review_<task-id>.md` (or a covering file, reusing the
  existing `covers:` label-line convention from `tools/evidence-file.ts`)
  contains a `## AC Execution Log` H2 section — mirroring the existence-only
  trust boundary already established by `VISUAL_EVIDENCE_MISSING` and
  `EXPECTED_RED_DIFF_MISSING`: the server checks the log's *presence*, not
  the semantic truth of its contents (that trust stays with qa-engineer /
  code-reviewer, same division of labor as every other evidence gate).
  proof: new test `test/gates/ac-execution.test.mjs` — construct a spec with
  a proof-annotated AC and a PASS write missing the H2 → assert rejection
  with the new error code; add the H2 → assert the write is accepted.
- **AC5** — Given a spec with ZERO `proof:`-annotated ACs (e.g. every
  pre-E3 spec in this repo today), when qa-engineer reaches PASS, then the
  new gate does not arm — zero behavior change, zero overhead — and every
  existing evidence gate (`MISSING_EVIDENCE`, `VISUAL_EVIDENCE_MISSING`,
  `EXPECTED_RED_DIFF_MISSING`) continues to behave exactly as today.
  proof: `npm test` — the full existing suite (1323/1323 as of v3.76.0) stays
  green with zero modifications to any pre-existing gate test file.
- **AC6** — Given the AC Execution Log records a proof whose output shows the
  command failed or the AC's observed outcome contradicts the AC text, when
  qa-engineer disposition this, then it is logged as a Phase 4 FAIL per the
  existing escalation route (`tw_rollback_task` + escalate) — the AC
  Execution Log is evidence feeding the existing FAIL path, not a new,
  separate outcome type.
  proof: `content/skill-qa-engineer.md`'s new phase explicitly cross-references
  the existing *Escalation Routes: Phase 4 FAIL* row rather than defining a
  new escalation row — reviewed verbatim at code-review time.
- **AC7** — Given this ticket's scope-cut discussion (`docs/backlog.md`
  E3 row + context brief), when the implementation lands, then it touches
  exactly the three legs named there — PM AC schema, QA runtime-evidence
  step, one evidence-gate extension — and no additional gate, schema field,
  or pixel-diff execution engine ships under this ticket.
  proof: the shipped diff's file list, reviewed at code-review time against
  the *Out of Scope* section below — any file outside that list is a scope
  violation.
- **AC8** — Given a non-visual, process-only feature spec like this one
  (no `design/<feature>.md`), when the PM Spec Schema's Visual
  Tokens/Widgets/Structural-Assertions sections are written, then each
  states `N/A` with the literal justification — this spec's own Copy/Visual
  sections below are the worked example.
  proof: `grep -c '^| N/A' specs/e3-outcome-shaped-acceptance.md` returns
  exactly 3 — one `N/A` row per table (Copy/Strings, Visual Tokens, Visual
  Widgets).

## Copy / Strings
| string id | exact text (quote verbatim) | source |
|---|---|---|
| N/A | — | feature has no user-facing strings — internal governance/server mechanism only |

## Visual Tokens
| token id | property | value (quote verbatim) | source |
|---|---|---|---|
| N/A | — | — | feature has no visual literals |

## Visual Widgets
| widget id | description | source-node |
|---|---|---|
| N/A | — | feature has no non-primitive widgets |

## Out of Scope
- Retroactively adding `proof:` annotations to any existing shipped spec
  (E1/E2/E4/E8/etc.) — AC schema applies going forward only; no migration
  sweep under this ticket.
- Building an automated pixel-diff *execution* engine as the AC proof
  mechanism. An AC MAY name `proof: pixel-diff <region>` as its proof
  category, but qa-visual's existing manual Read + vision-diff workflow
  (Phase 1.5, `content/skill-qa-visual.md`) is the mechanism that satisfies
  it — this ticket does not build new tooling to auto-invoke a pixel-diff
  tool.
- Semantic verification of the AC Execution Log's content by the server
  (e.g. re-running the logged command itself, or parsing pass/fail out of
  arbitrary stdout). The gate checks presence of the `## AC Execution Log`
  section only, same trust boundary as every other evidence gate in this
  repo (`MISSING_EVIDENCE`, `VISUAL_EVIDENCE_MISSING`,
  `EXPECTED_RED_DIFF_MISSING`).
- Keyword/self-admission scanning of qa_review text (e.g. blocking on
  "TODO" / "future sprint" / "skipped" language, per the F2 postmortem's R4
  suggestion). Cheap and plausibly valuable, but it is a SECOND gate
  mechanism — the brief caps this ticket at "one server-checkable
  evidence-gate extension." Deferred; candidate follow-up ticket.
- Any change to sr-engineer's SOP or implementation-phase behavior. This
  ticket only touches the PM (spec schema) and qa-engineer (execution step +
  gate) roles.
- Any change to the existing Phase 1.5 visual-compare mechanism, the C15
  expected-red manifest, or the D9 `covers:`/`review_task_ids` machinery —
  all reused as-is, none modified.
- E5/E6/E7 (backlog-intake automation, rule-retirement cadence, git/CI
  governance) — unrelated tickets, not touched here.

## Dependencies / Prerequisites
- **Reuses existing plumbing, does not reinvent it**: the presence-check /
  H2-disposition pattern in `gates/expected-red.ts`
  (`hasExpectedRedManifest`/`hasExpectedRedDisposition`) and the shared
  `sliceH2Section`/`buildCoverageIndex` helpers in `tools/evidence-file.ts`
  are the direct precedent for AC4's new gate. `tools/handoff-orchestrator.ts`
  is the existing PASS-time call site for the sibling gates
  (`MISSING_EVIDENCE`, `VISUAL_EVIDENCE_MISSING`, `EXPECTED_RED_DIFF_MISSING`)
  and is almost certainly where the new check is wired in too.
- **Open design question for architect** (this ticket is architect-routed):
  how does the server detect the arm condition — "this spec has at least one
  `proof:`-annotated AC" (AC4/AC5)? Candidates: (a) the gate parses
  `specs/<feature>.md`'s Acceptance Criteria section for a `proof:` token per
  AC line, mirroring how `gates/visual.ts` already parses
  `design/<feature>.md` content for arm conditions — no new handoff field, no
  schema bump; or (b) PM stamps a first-class boolean/count on its
  `tw_update_state` write (schema `handoff` v12→v13 bump per
  `docs/schema-versions.md`, C9/C14-style precedent). PM's read: (a) is more
  consistent with the existing visual/expected-red "arm by file content"
  precedent and avoids a schema bump, but the exact module boundary (new
  `gates/ac-execution.ts` vs. extending `gates/qa-review.ts`) and the
  disposition-lookup shape (per-task vs. per-feature, given one spec can
  cover multiple tasks) are architecture decisions, not PM ones.
- **Dispatch pin**: the human has pre-pinned **sr-engineer to model tier
  "fable"** for this feature. The coordinator sets `dispatch_pins:
  {"sr-engineer": "fable"}` on its own state write (not this PM write, since
  `dispatch_pins` is feature-scoped and was dropped when `active_feature`
  changed away from `e11-e12-release-integrity-batch`) — every sr-engineer
  dispatch brief for T-E3-01/02/03/04 below MUST honor that pin.
- **Resource Audit Gate**: scanned the E3 backlog entry
  (`docs/backlog.md` L978–992) and the three artifacts it cites by name —
  `research/104445-F2-qa-visual-false-pass-postmortem.md`,
  `research/mode-feature-process-retrospective.md`, and
  `research/ticket-splitting-for-ai-agents.md` — all three are in-repo (not
  external URLs or Figma/JIRA links) and were read in full for this spec. No
  `http(s)://` / figma / sketch / JIRA / ADO reference appears in the backlog
  E3 entry itself. Zero external hits → `external_refs` field omitted
  (absence = non-blocking, per Constitution §7 / skill-pm Gate Summary).
- **Question Batch Gate**: no clarification accumulated beyond the
  architecture decision already delegated above — gate is a no-op.
- **Scope Decision Gate**: not armed — no `design/e3-outcome-shaped-acceptance.md`
  exists (non-design, process-only feature); gate does not apply.
- Current gate inventory for architect's reference: `gates/{code-review,
  cut-approval, expected-red, external-refs, feature-lease, qa-review,
  registry, scope-decision, visual}.ts`; handoff schema currently at v12
  (`schema/versions.ts`); PASS-time gate wiring lives in
  `tools/handoff-orchestrator.ts`.

## Complexity / routing rationale
This ticket touches ≥3 modules (`gates/` — new module or extension of an
existing one — plus `tools/handoff-orchestrator.ts`, plus TWO skill SOPs:
`content/skill-pm.md` and `content/skill-qa-engineer.md`) and carries an open
data-model question (whether the arm condition needs a schema field) per
skill-pm's architect-routing threshold. It is also explicitly bigger and more
design-laden than the immediately preceding E11/E12 small-fix batch (each
~2 files, independent, single content+code fix). Routed to **architect**
first, mirroring the E1/E2/E4 precedent of an `-ARCH` task producing
`specs/e3-outcome-shaped-acceptance-architecture.md` before implementation
tasks are picked up.
