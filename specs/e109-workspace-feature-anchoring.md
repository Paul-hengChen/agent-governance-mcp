# e109-workspace-feature-anchoring — E109 (primary) + E146 (rider)

Ticket: `docs/backlog.md` E109 (execution order `0k`) — Wave 2 of
`docs/v4.0.0-execution-plan.md` ("v4 框架決定"), the framing decision E112–E116 all
depend on. Rider: `docs/backlog.md` E146 (execution order `0t4`) — same lane, same
wave, per §2.1's one-L-CONTENT-lane-per-wave rule.
Lane: **L-CONTENT** only. One lane, one review round, one QA round. No worktree
(single lane; primary workspace).

## Problem Statement

**E109.** The server assumes `workspace` == `feature`: every governance mechanism
(feature lease, `hop_count`, `review_round`/`qa_round` caps, `tw_detect_drift`,
telemetry sidecars, evidence paths, `cut_approved`) keys on the workspace's own
`.current/handoff.md`. When one feature fans out across multiple lanes (multiple
git worktrees, each its own workspace), each mechanism is individually correct for
its own workspace and collectively wrong for the feature: measured in
an adopter acceptance project 2026-09-08, one feature (`screen-source-list`, 7 tickets) living
in 5 workspaces produced 5 different `active_feature` ledgers, 5 `hop_count`s, 5
telemetry sidecars, while the human and the docs called it one feature throughout.
Nothing is miscomputed — every mechanism reports a scope that is no longer a
feature. Nothing in the constitution or coordinator SOP says whether that is the
intended design or a defect, which is why E112–E116 (drift-lying, hop-cap
overshoot, cut-approval propagation, join-dependency verification, ledger
overwrite-on-reuse) have been sitting unscoped: their fix shapes are five
different answers to one unasked question.

**E146 (rider).** `content/skill-release-engineer.md:219`'s step 9a prose still
describes Check 1 (`tag-at-HEAD`) as an unconditional assertion — "ALL checks MUST
pass" with `tag-at-HEAD` listed as one of the five things verified, no mention of
E141's bookkeeping-commit tolerance or the `NOTE: tag-at-HEAD — tolerated N
governance-bookkeeping commit(s) ahead of tag vX.Y.Z` line a tolerated run now
prints. E141 (merged, v3.112.0) removed the exact unconditional behaviour this
sentence still describes. The script's exit code is unaffected (misdirection, not
a halt), but every wave from here ends in a release, and step 9a is read by a
release-engineer at the end of each one.

## User Stories

- As a coordinator dispatching a multi-lane feature, I want an explicit,
  unambiguous statement of what `workspace_path` anchors and what it does not, so
  that a lane's per-workspace ledger is never mistaken for — or silently expected
  to behave as — the whole feature's ledger.
- As a PM cutting a fan-out feature (E110's parallel-lane template, E112–E116's
  eventual fixes), I want the anchoring rule settled first, so five separate
  tickets don't each re-derive their own answer to "does workspace == feature."
- As a release-engineer running step 9a after a tolerated release, I want the SOP
  prose to describe what Check 1 actually verifies now, so I recognize a
  NOTE-carrying pass as a pass instead of misreading it against stale prose.

## Decision: 待決 #4 — declare-as-designed (adopted here; human ratifies at cut approval)

**Adopted position: declare-as-designed**, per the backlog row's own argued
coordinator position — restated here, not re-argued from scratch:

- For ONE lane, a per-lane budget is the correct semantics — a lane IS a bounded
  work unit. The thing to give up is the unstated "one feature, one ledger"
  assumption, not the per-workspace keying. Making lease/`hop_count`/round caps
  span lanes would need cross-workspace reads the server deliberately does not do
  (workspace-scoped, not cross-machine — `CLAUDE.md`'s own *What this server does
  NOT do*).
- Decisive evidence the alternative (treat-as-defect, i.e. make the mechanisms
  span workspaces) is unworkable: NDI's own `docs/BACKLOG.md` §SRCL mandates
  *governance `workspace_path` = primary, never pass a worktree path to a `tw_*`
  tool*, and J1a/J1b nonetheless wrote into the worktree's own `.current/` — the
  rule's own author broke it inside a day. "Some tickets anchor primary, others
  anchor the worktree" is not an executable rule.
- **This is the human's call, not mine to finalize silently.** The cut table this
  spec ships with presents the choice for ratification. If the human instead
  picks treat-as-defect, this cut does not proceed as written — that branch needs
  a design pass per `docs/v4.0.0-execution-plan.md` execution-order row `0k`
  ("a design pass first if treat-as-defect is chosen") and is out of scope for
  this chain.

**Deliverable, scoped to exactly this:** one explicit statement of the anchoring
rule — a lane's plan (which lanes exist, their tickets, their dependencies) lives
in a tracked backlog/spec artifact (e.g. `docs/v4.0.0-execution-plan.md`'s own Wave
dispatch-card convention, or a feature-specific spec); a lane's `.current/handoff.md`
stays scoped to that lane only and is never expected to represent the feature as a
whole. **Nothing else.** E112–E116's cut shapes and E113's cross-lane roll-up
obligation are explicitly NOT this ticket — they wait on this statement landing,
per the plan's Wave 2 prohibitions, and are the coordinator's job to re-confirm
after PASS.

## Acceptance Criteria

- **AC1** — Given the merged change, when `content/coord-03-core-fallback.md`'s
  Feature-Scope Gate paragraph (the existing normative home of workspace/worktree
  semantics — it already tells the coordinator to "run the second feature in a
  separate git worktree") is read, then it states, in normative language: (a)
  every per-workspace governance mechanism (feature lease, `hop_count`,
  `review_round`/`qa_round` caps, `tw_detect_drift`, telemetry, evidence paths,
  `cut_approved`) is anchored to `workspace_path`, scoped to that lane, and never
  spans workspaces; and (b) a multi-lane feature's overall plan is tracked in a
  version-controlled backlog/spec artifact, not inferred from or reconciled across
  per-lane handoffs. This is the single deliverable — do not restate it a second
  time inside the same file.
- **AC2** — sr-engineer's judgment call on whether a second file carries a
  cross-reference/pointer (not a restatement — same discoverability logic as the
  E59 precedent that forbids restating rules across `content/skill-*.md` files) is
  STATED in the task's notes, not made silently. Zero, one, or two files touched
  under E109 is all acceptable as long as the choice and why are recorded.
- **AC3** — Given the merged change, when `git diff --stat` against the pre-lane
  commit is inspected, then only files under `content/` (and, if AC2's pointer
  choice needs it, `docs/`) appear — zero `lib/`, `tools/`, `schema/`, `guards/`,
  `gates/`, `prompts/`, `bin/`, `transport/`, `index.ts`, or `test/` changes.
  proof: `git diff --stat main -- lib/ tools/ schema/ guards/ gates/ prompts/ bin/ transport/ index.ts test/` prints nothing.
- **AC4 (E146 rider)** — Given `content/skill-release-engineer.md:219`'s step 9a
  paragraph, when it is read, then its Check 1 (`tag-at-HEAD`) sentence describes
  the ACTUAL current behaviour: a tag-equals-HEAD pass, OR a tag-not-at-HEAD pass
  that requires (i) the tag being an ancestor of HEAD and (ii) every commit in
  `<tag>..HEAD` touching only the governance-bookkeeping allowlist step 13a
  already defines — and states plainly that a NOTE-carrying pass is still a pass.
  Describe the behaviour; do NOT re-enumerate the allowlist paths inline (E82
  (ii): cite by reference to where it's already defined — step 13a — never
  restate the literal path list a second time, the exact staleness class E82 (ii)
  exists to prevent).
  proof: `sed -n '219p' content/skill-release-engineer.md | grep -c '\.current/handoff\.md'` prints `0` (the allowlist is not re-typed into step 9a's prose).
- **AC5 (E146 rider)** — Given the same file, when the E82(ii) rationale fence
  immediately following step 9a (currently lines 220-222, the `DEFAULT_WAIT_SECONDS`
  citation-by-name note) is read after the edit, then it is untouched in meaning
  and remains a symmetric `<!-- rationale:start -->...<!-- rationale:end -->` span.
  proof: `test/render-structure.test.mjs`'s structural sweep ("zero UNTRACKED asymmetric rationale spans") stays green; full suite green.
- **AC6** — Given the merged change, when the compose-golden fixture and the
  context-budget floor(s) covering `content/coord-03-core-fallback.md` and/or
  `content/skill-release-engineer.md` are re-run, then they are re-baselined to
  the new measured values (qa-owned, not sr-engineer's — see Dependencies below),
  and the re-baseline records whether a rationale fence around the new prose kept
  the cap from moving, or why it couldn't.
- **AC7** — Given the merged change, when `docs/backlog.md`'s E109 and E146 rows
  are inspected, then neither has been done-marked (`[x]` or equivalent) by
  sr-engineer or qa-engineer — that is release-engineer's step 7c, post-PASS.

## Copy / Strings

| string id | exact text (quote verbatim) | source |
|---|---|---|
| N/A | — | feature is internal governance prose, not user-facing product copy |

## Visual Tokens

| token id | property | value (quote verbatim) | source |
|---|---|---|---|
| N/A | — | — | feature has no visual literals |

## Visual Widgets

| widget id | description | source-node |
|---|---|---|
| N/A | — | feature has no non-primitive widgets |

## Out of Scope

- Any part of E112 (drift lying on single-workspace multi-feature), E113
  (cross-lane hop/round/telemetry roll-up), E114 (cut-approval inheritance
  semantics), E115 (join-dependency machine check), or E116 (ledger
  overwrite-on-reuse archival) — their cut shapes wait on this ticket's PASS and
  are the coordinator's job to re-confirm, not this chain's.
- E110's parallel-lane PM template and cut-table `touches` column — depends on
  E109 per the backlog but is its own ticket (execution order `0l`).
- Any change to `scripts/verify-release.mjs` itself — E141 already shipped the
  behavior; E146 only corrects the prose describing it.
- Raising the context-budget cap a third time as the default response — see
  Dependencies: try a rationale fence first.
- Any server code, gate, or `test/**` change — L-CONTENT is content-only by
  definition; `test/**` is qa-engineer's exclusively (Constitution §2).
- `docs/backlog.md` done-marking — release-engineer, post-PASS (SOP step 7c).

## Dependencies / Prerequisites

- Wave 1 merged into `main` (confirmed 2026-09-17, v3.111.0).
- E141 shipped and merged (v3.112.0, 2026-09-18) — clears Wave 2's release-tooling
  prerequisite; this ticket's own release will exercise E141's tolerance again.
- 待決 B (worktree-trigger conditions) — already decided 2026-09-16
  (`docs/v4.0.0-execution-plan.md:848`); not reopened here. It settles a
  *different* question (when a lane escapes to a worktree) from 待決 #4 above
  (what a lane's ledger means once it exists) — cited for completeness, not as an
  input to this decision.
- **qa-engineer, not sr-engineer, owns**: re-baselining the golden compose fixture
  and the context-budget floor(s) this edit moves. Before scoping another cap
  raise, qa-engineer must check whether the new prose can be wrapped in a
  `<!-- rationale:start -->/<!-- rationale:end -->` fence instead — `coord-*.md`
  fragments had zero such fences before v3.110.0 and carry several now (e.g. the
  E87 Evidence-Citation Convention fence in `content/coord-03-core-fallback.md`),
  so there is in-repo precedent for containing growth this way rather than
  raising the cap a third time (17984 → 18303 → 18369 → 18570 to date).
- Another session is working E148 in worktree `<lanes-root>/e148`;
  it does not touch `content/` but will churn `test/**` — expect `git pull`/rebase
  noise in `test/` unrelated to this ticket by the time this lane's QA round runs.
