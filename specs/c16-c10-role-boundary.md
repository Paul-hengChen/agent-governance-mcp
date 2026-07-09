# c16-c10-role-boundary

Source: `docs/backlog.md` §C16 — "code-reviewer overstepped bookkeeping:
ledger write + evidence-path drift" (P2, observed 2026-07-09) + §C10 —
"qa-engineer / release-engineer bookkeeping boundary blur" (P2, observed
2026-07-08). Batched per the execution-order row 3 note: "one content-only
batch: both are role-boundary bookkeeping rules — single QA round."

## Problem Statement

Two independent incidents both trace to the same root cause: a role wrote
bookkeeping that belongs to a different role, because no skill text (or
server check) drew the line.

**C16**: in the C9 run, code-reviewer's APPROVED handoff carried
`completed_tasks: T-C9-01..06, T-C9-12..16` on a write that also serves as
the `code-reviewer:In_Progress → qa-engineer:In_Progress` transition. That
particular use is legitimate — the field doubles as the review-scope
manifest the `MISSING_REVIEW_EVIDENCE` gate reads to know which ids to check
evidence for (`tools/handoff-orchestrator.ts` lines ~524-543, keyed on
`prevTuple.agent === "code-reviewer" && nextTuple.agent === "qa-engineer"`).
The actual defect is narrower than the backlog's original framing suggests
(re-verified against the current, v3.57.0 `content/skill-code-reviewer.md`
and gate wiring before drafting this spec): the skill's Escalation Routes
table currently says **"Both rows carry `completed_tasks`"** — including the
CHANGES_REQUESTED row, which self-stamps `agent_id="code-reviewer"` and
routes to sr-engineer. That row's `completed_tasks` serves **no gate
purpose** (the evidence gate only fires when `nextTuple.agent ===
"qa-engineer"`) — it exists purely as ledger pollution, writing ids into
`.current/handoff.md`'s `## Completed Tasks` section that qa-engineer hasn't
actually completed. This is the literal "task-completion bookkeeping that
belongs to qa-engineer's PASS" the backlog entry describes.

Separately, the reviewer's chat reply promised evidence at
`review_reports/review_c9-protocol-fields.md` (a feature-named path) but the
file actually written was `review_reports/review_T-C9-01.md` (a task-id-named
path, per the already-correct convention in the skill's step 4 / Output
rule). Re-reading the current skill text: there is only ONE naming
convention documented today (task-id-named, with a `covers:` label line for
batched rounds — the C3 covering-review precedent) — no
`review_<feature>.md` option is sanctioned anywhere in the file. The
backlog's "pick one, per-feature OR per-task" framing is therefore already
resolved in the mechanism; what's missing is a **reply-fidelity guarantee**:
nothing today requires the reviewer's stated path to match the path it
actually wrote, so a reviewer can (as happened) invent a plausible-looking
path in prose that diverges from reality. This spec closes that gap
directly rather than re-litigating a naming choice that's already settled.

**C10**: the A10 cut assigned version bump + CHANGELOG + backlog-marking to
qa-engineer; release-engineer then re-ran build/tests and did the actual
release, splitting bookkeeping across two roles and duplicating build/test
cost. Re-reading the current `content/skill-qa-engineer.md` and
`content/skill-release-engineer.md`: neither currently misassigns version/
CHANGELOG ownership (release-engineer's Hard Rules + Artifact allowlist
already scope those to itself; qa-engineer's skill never mentions them).
What's still genuinely missing: **`docs/backlog.md` done-marking has no
owner in any skill file at all** — every prior feature (C4, C14, A10, A11)
marked its backlog row done via an ad hoc `pm/coordinator (post-PASS)` task
line in `tasks.md`, never a documented SOP step. Left unowned, an operator
under time pressure could plausibly hand this back to qa-engineer ("you
already have the PASS context") exactly as A10 did, recreating the boundary
blur. This spec assigns backlog done-marking as a formal release-engineer
SOP step, and adds an explicit disclaiming line to skill-qa-engineer plus a
cut-template rule to skill-pm so a future ticket cut can't quietly
re-assign it.

## User Stories

- As a code-reviewer, I want an explicit rule that `completed_tasks` is
  never carried on the CHANGES_REQUESTED (self-stamped) row, so my
  escalations stop writing premature "done" ids into the handoff ledger.
- As a code-reviewer, I want my final reply's stated evidence path to be
  mechanically guaranteed to match the file I actually wrote, so a
  downstream consumer trusting the stated path is never misled.
- As the server, I want to reject any `code-reviewer`-authored write that
  carries a non-empty `completed_tasks`, so the C16 ledger-pollution class
  can't recur even if a future skill edit or a bypassing client omits the
  rule.
- As a PM cutting a future ticket, I want the cut-template to say release
  bookkeeping (version bump, CHANGELOG, backlog done-marking) is
  release-engineer-owned, so I never assign it to a QA or sr-engineer task
  by default.
- As qa-engineer, I want an explicit line disclaiming release-bookkeeping
  ownership, so PASS never gets read as an implicit invitation to also bump
  the version or mark the backlog.
- As release-engineer, I want backlog done-marking folded into my own
  post-PASS SOP, so it's no longer an unowned, ad hoc chore a human or PM
  has to remember every release.

## Acceptance Criteria

**AC-1 — `completed_tasks` scoped to the APPROVED row only
(skill-code-reviewer)**
- Given code-reviewer writes the APPROVED escalation row (`agent_id=
  "qa-engineer"`, `review_verdict="APPROVED"`), when it constructs the
  `tw_update_state` call, then `completed_tasks=[<task-ids>]` continues to
  carry the review-scope manifest — unchanged; this is the sole legitimate
  use, feeding `MISSING_REVIEW_EVIDENCE`.
- Given code-reviewer writes the CHANGES_REQUESTED escalation row
  (`agent_id="code-reviewer"`, `status="FAIL"`), when it constructs the
  call, then it MUST NOT include `completed_tasks` (omit the field
  entirely, or pass `[]`) — the Escalation Routes table's "Both rows carry
  `completed_tasks`" line is rewritten to name the APPROVED row only, and
  the CHANGES_REQUESTED row's example drops the field.
- The `## Notes` section is rewritten to state plainly: `completed_tasks` on
  a code-reviewer write is a review-scope manifest ONLY on the APPROVED→qa
  handoff; it is never legal on a self-stamped write, and never a
  completion signal (`tw_complete_task` remains qa-engineer-exclusive,
  unchanged from today).

**AC-2 — Reply-fidelity guarantee (skill-code-reviewer)**
- Given code-reviewer's final reply cites a `review_reports/review_*.md`
  path (per the Output rule), when it replies, then the cited path MUST be
  byte-identical to the path it actually wrote this round (the primary
  id's file, per the existing batched-round convention) — never a
  paraphrased, feature-named, or otherwise invented path. Add one
  explicit line making this a hard requirement, directly preventing a
  repeat of the C9 stated-vs-actual path drift.

**AC-3 — Server guard: `REVIEWER_COMPLETED_TASKS_REJECTED` (new gate)**
- Given any `tw_update_state` write with `agent_id="code-reviewer"` and a
  non-empty `completed_tasks` array, when the write is validated, then the
  server rejects it with a new error code `REVIEWER_COMPLETED_TASKS_REJECTED`
  — modeled exactly on the existing `REVIEW_VERDICT_STATUS_MISMATCH` gate
  shape (plain-text envelope, keys only on the incoming `parsed` args, no
  `FileHandoffStorage` guard so it applies uniformly in file mode AND
  SQLite/HTTP mode, wired in `tools/handoff-orchestrator.ts` immediately
  alongside the `REVIEW_VERDICT_STATUS_MISMATCH` block).
- Given `agent_id="code-reviewer"` with an empty/absent `completed_tasks`
  (the Phase-2 "claiming review" write, the Blocked route, or any other
  legitimate code-reviewer self-stamp), when validated, then the write is
  unaffected — zero regression on every existing legitimate code-reviewer
  write shape.
- Given `agent_id="qa-engineer"` (the APPROVED row) with non-empty
  `completed_tasks`, when validated, then this new gate does not fire at
  all — it keys on `agent_id`, not on which role authored the call, so the
  APPROVED row's legitimate use is untouched.
- Register the code in `gates/registry.ts` (22nd entry — one gate added,
  none dropped) with `triggerEdge`/`armCondition`/`clearingArtifact`/
  `hintStatic` fields in the existing prose-sourced style, `producer:
  "orchestrator"`, `envelope: "plain-text"`. The error-code shape rule
  (`test/error-code-contract.test.mjs`'s `SUFFIX_RE`) already covers the
  `_REJECTED` suffix (via the existing `TRANSITION_REJECTED` precedent) —
  no re-baseline of the suffix vocabulary itself is needed, unlike the
  b8/`UNRESOLVED` or c9/`MISMATCH` precedents that introduced novel
  suffixes.
- Backtick-quote `REVIEWER_COMPLETED_TASKS_REJECTED` at least once in
  `content/skill-code-reviewer.md` (satisfies the `documentedInProse: true`
  doc-parity assertion) — fold into the AC-1 rewrite rather than adding a
  separate passage.

**AC-4 — Test coverage for the new gate**
- `test/error-code-contract.test.mjs`: re-baseline the hardcoded
  `GATE_REGISTRY` entry count from 21 to 22 (qa-owned re-baseline, same
  precedent as the b8/c9/c15 count bumps documented inline in that file) —
  sr-engineer/code-reviewer must NOT edit this assertion themselves
  (Constitution §2 test-ownership).
- New or extended test file covering: (a) a code-reviewer write with
  non-empty `completed_tasks` is rejected with
  `REVIEWER_COMPLETED_TASKS_REJECTED` in both file mode and SQLite/HTTP
  mode; (b) the Phase-2 claim write (`agent_id="code-reviewer"`,
  `completed_tasks=[]`) is unaffected; (c) the APPROVED row
  (`agent_id="qa-engineer"`, non-empty `completed_tasks`) is unaffected and
  the pre-existing `MISSING_REVIEW_EVIDENCE` gate still fires correctly on
  it.

**AC-5 — Release bookkeeping ownership (skill-release-engineer,
skill-qa-engineer, skill-pm)**
- `content/skill-release-engineer.md`: add `docs/backlog.md` (done-marking
  of the active feature's row(s) only — do not edit unrelated rows) to the
  Artifact allowlist, and add a new SOP step (after the existing
  drift-baseline-acknowledgment step) that marks the active feature's
  backlog row(s) DONE with a one-line mechanism summary + commit
  reference, folding the ad hoc `pm/coordinator (post-PASS)` task line
  every prior feature (C4, C14, A10, A11) has needed into the role's own
  SOP.
- `content/skill-qa-engineer.md`: add one explicit line (adjacent to the
  existing "Scope" Hard Rule) disclaiming release-bookkeeping ownership:
  version bump, CHANGELOG, and backlog done-marking are release-engineer's
  job post-PASS, never qa-engineer's, even though QA is the role physically
  present at the PASS boundary.
- `content/skill-pm.md`: add a cut-template rule (Task Format section) that
  any ticket-cut line item describing release bookkeeping (version bump,
  CHANGELOG, backlog done-marking) MUST be assigned to release-engineer,
  never cut onto a qa-engineer or sr-engineer task by default.

## Copy / Strings

| string id | exact text (quote verbatim) | source |
|---|---|---|
| N/A | — | feature has no user-facing strings (skill-text + server-gate change only) |

## Visual Tokens

| token id | property | value (quote verbatim) | source |
|---|---|---|---|
| N/A | — | — | feature has no visual literals |

## Visual Widgets

| widget id | description | source-node |
|---|---|---|
| N/A | — | feature has no non-primitive widgets |

## Out of Scope

- **Re-litigating the evidence-naming convention.** The backlog's original
  framing ("per-feature `review_<feature>.md` OR per-task with `covers:`") is
  not actually a live ambiguity in the current skill text — see Problem
  Statement. This spec adds the reply-fidelity guarantee (AC-2) instead of
  introducing a second naming scheme.
- **A distinct `review_scope` field.** Considered (a schema-level split of
  "review-scope manifest" from "completion ledger") and rejected as
  over-engineering for what's actually a one-row misuse (the
  CHANGES_REQUESTED row); AC-1 + AC-3 close the gap without a schema bump.
- **Retroactively cleaning the C9 handoff history.** The polluted C9-run
  ledger entries are historical; same don't-rewrite-shipped-history
  precedent as c14/c15 Out of Scope.
- **C17 (coordinator dispatch-brief template).** Adjacent backlog item,
  separate ticket per the execution order.
- **Any change to `tw_complete_task` / `tw_rollback_task` semantics.**
  Unaffected — qa-engineer remains exclusive owner, unchanged.
- **SQLite-mode `docs/backlog.md` equivalent.** Backlog marking is a
  file-mode-only, human-facing markdown convention; SQLite/HTTP mode has no
  analog and none is added here.

## Dependencies / Prerequisites

- **Resource Audit Gate (Constitution §7):** scanned `docs/backlog.md`'s
  C10/C16 entries, `content/skill-code-reviewer.md`,
  `content/skill-qa-engineer.md`, `content/skill-release-engineer.md`,
  `content/skill-pm.md`, `gates/registry.ts`, `gates/code-review.ts`,
  `tools/handoff-orchestrator.ts`, `tools/transitions.ts`,
  `test/error-code-contract.test.mjs` for `http(s)://`, `figma`, `sketch`,
  `mockup`, `URL`, `link`, `see <ticket>`, `Azure DevOps`, `JIRA`. **Zero
  hits** — every reference in scope is an in-repo file path. `external_refs`
  is omitted from this ticket's `tw_update_state` write (absence = zero
  external refs found = non-blocking).
- **No `design/c16-c10-role-boundary.md`** exists; mode = no-design. The
  Scope Decision Gate and Visual gates are not armed for this feature.
- Sequencing note for sr-engineer: land the skill-text edits (T-C16-01,
  T-C10-01..03) independent of, and before, the gate code
  (T-C16-02..03) — the content edits are immediately useful on their own
  (a human-directed code-reviewer/release-engineer can follow the new SOP
  by hand even before the machine gate exists) and de-risk the smaller,
  mechanical gate-code slice by proving the rule in prose first (same
  sequencing rationale as c15-expected-red-manifest).
- Reuses the `REVIEW_VERDICT_STATUS_MISMATCH` gate shape shipped for
  c9-protocol-fields verbatim (plain-text envelope, `parsed`-args-only,
  code-reviewer-keyed) — this ticket adds a sibling of that family, not a
  new mechanism class.
