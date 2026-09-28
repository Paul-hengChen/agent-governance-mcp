# d10-release-engineer-git-stop-rule

## Problem Statement
Shipping D8, the release-engineer (haiku tier) hit a non-fast-forward push
(a concurrent D2 session had advanced `main` to v3.68.0) and "resolved" it
by aborting a rebase and running `git reset HEAD~1`, discarding its own
committed release (v3.67.2) and the working tree. Only the reflog
(`2115a2b`) made recovery possible; the coordinator had to re-version and
re-release as v3.68.1. `content/skill-release-engineer.md` currently has no
rule at all for this situation — release-engineer has no instruction to
STOP rather than "fix" a push conflict destructively. Concurrent sessions
are now routine (D2/D7/D8 overlapped in one day; D5/D9 collided on
v3.69.0), so the next collision is likely and, without a reflog-reachable
commit, unrecoverable.

## User Stories
- As the coordinator/human, I want release-engineer to STOP and hand back
  on any non-fast-forward push, push rejection, or concurrent-release
  collision, so that a destructive git recovery attempt never discards an
  already-committed release.
- As a release-engineer agent (any model tier, including haiku), I want an
  unambiguous Hard rule plus a reinforcement hint in my own template shim,
  so that under context pressure I still STOP instead of improvising a git
  recovery.

## Acceptance Criteria
- **AC1** — Given `content/skill-release-engineer.md`'s `## Hard rules`
  section, when a non-fast-forward push rejection or a concurrent-release
  collision occurs, then the SOP instructs release-engineer to STOP
  immediately and explicitly forbids `git reset`, `git rebase`,
  `git checkout --force`, and `git clean` as recovery actions.
- **AC2** — Given the same trigger, when the Hard rule fires, then the SOP
  instructs release-engineer to write `status=Blocked` with the local
  release-commit SHA recorded in `pending_notes`, and to hand back for
  coordinator recovery (not attempt recovery itself).
- **AC3** — Given `content/skill-release-engineer.md`'s
  `## Escalation Routes` table, when a non-fast-forward push
  rejection / concurrent-release collision is the trigger, then a
  matching row exists with `status=Blocked`, a pending-note string naming
  the local release-commit SHA placeholder, and `next_role=human`.
- **AC4** — Given `templates/claude-code-agents/release-engineer.md` (the
  haiku-tier shim), when the file is read, then it contains a ≤2-sentence
  reinforcement hint restating the STOP rule (C13 pattern — mirroring the
  existing STOP-on-⛔-rejection and driftBaselineIds hints already in that
  file), without altering the watermark line or the
  `tw_get_state`/`tw_switch_role` invocation line.
- **AC5** — Given `test/release-staging.test.mjs`, when `npm test` runs,
  then new tests pin (a) the verbatim Hard rule substrings in
  `skill-release-engineer.md`, (b) the verbatim Escalation Routes
  pending-note string, and (c) the verbatim reinforcement-hint substrings
  in the shim — following the same load-bearing-substring pinning
  convention as the existing AC1–AC5/C13 tests in that file (pin
  substrings, not whole paragraphs, so future rewording that preserves
  intent doesn't spuriously fail).
- **AC6** — Given the full suite, when `npm test` runs after the above
  changes, then it is green with zero regressions to the existing tests in
  `test/release-staging.test.mjs` and elsewhere.

## Copy / Strings
| string id | exact text (quote verbatim) | source |
|---|---|---|
| d10.hard-rule.stop-clause | `STOP immediately — NEVER run \`git reset\`, \`git rebase\`, \`git checkout --force\`, or \`git clean\` to work around it.` | docs/backlog.md §D10 (lines 928–931) |
| d10.hard-rule.blocked-clause | `write \`status=Blocked\` with the local release-commit SHA in \`pending_notes\` ... and hand back for coordinator recovery.` | docs/backlog.md §D10 (lines 930–932) |
| d10.hard-rule.example-note | `pending_notes=["release-engineer: push rejected (non-fast-forward) — local release commit <sha> not on remote, needs coordinator recovery"]` | authored-here — concrete instantiation of the ticket's "local release-commit SHA in pending_notes" requirement, following this file's existing convention of giving a literal `pending_notes=[...]` example inline in each Hard rule bullet (see the existing `Blocked` examples elsewhere in `content/skill-release-engineer.md`) |
| d10.hard-rule.reason | `Reason (D10): a haiku-tier release-engineer hit exactly this collision, aborted a rebase, and ran \`git reset HEAD~1\`, discarding its own committed release — only the reflog made recovery possible.` | docs/backlog.md §D10 (lines 923–927) |
| d10.escalation-row.pending-note | `release-engineer: push rejected (non-fast-forward) — local release commit <sha> not on remote, needs coordinator recovery` | authored-here — reuses `d10.hard-rule.example-note` verbatim so the Hard rule's worked example and the Escalation Routes table's canonical pending note read as one string, matching this file's existing pattern of paired Hard-rule/Escalation-row wording |
| d10.template-hint | `CRITICAL: On any non-fast-forward push rejection or concurrent-release collision, STOP — NEVER \`git reset\`, \`git rebase\`, \`git checkout --force\`, or \`git clean\`. Write \`status=Blocked\` with the local release commit SHA in \`pending_notes\` and hand back to the coordinator/human for recovery.` | authored-here — ≤2-sentence reinforcement hint per the ticket's explicit "C13 pattern" instruction (docs/backlog.md §D10, line 933), mirroring the existing STOP-on-⛔-rejection hint already shipped in `templates/claude-code-agents/release-engineer.md` |

## Visual Tokens
| token id | property | value (quote verbatim) | source |
|---|---|---|---|
| N/A | — | — | feature has no visual literals |

## Visual Widgets
| widget id | description | source-node |
|---|---|---|
| N/A | — | feature has no non-primitive widgets |

## Out of Scope
- Any server-side (`tools/`, `guards/`) enforcement of the STOP rule — this
  is prompt-text-only, same as every other release-engineer Hard rule; the
  contract is the SOP wording reaching the agent, not code enforcement.
- Retroactive fix-up of the already-recovered D8/v3.67.2 incident (re-versioned
  to v3.68.1) — nothing to redo there.
- E1 (feature-scoped state: concurrency isolation for parallel sessions) —
  D10's STOP rule is a tourniquet for the destructive-recovery symptom;
  the structural root cause (one shared `active_feature`/state file across
  concurrent sessions) is tracked separately as its own backlog item.
- Any change to `tools/transitions.ts` or the `ALLOWED_TRANSITIONS` state
  machine — the existing `qa-engineer:PASS → release-engineer:In_Progress`
  and `release-engineer:In_Progress → pm:In_Progress` edges are unaffected;
  this ticket only adds a Blocked escalation path within release-engineer's
  own SOP text.

## Dependencies / Prerequisites
None external. Resource Audit Gate: scanned the ticket (docs/backlog.md
lines 922–937) for `http(s)://`, `figma`, `sketch`, `mockup`, `URL`,
`link`, `see <ticket>`, `Azure DevOps`, `JIRA` — zero hits; all references
are in-repo file paths (`content/skill-release-engineer.md`,
`templates/claude-code-agents/release-engineer.md`,
`test/release-staging.test.mjs`, `docs/backlog.md`). `external_refs` is
therefore omitted from the routing `tw_update_state` call (empty =
non-blocking) per the PM SOP Gate Summary.

No design file exists for this feature (`design/d10-release-engineer-git-stop-rule.md`
absent) — non-design feature, so the Visual State-Count Split, Geometric-Density
Split, Scope Decision, and Visual Structural Assertions gates do not apply.
No clarifying questions accumulated (Question Batch Gate: no-op) — the
ticket's fix description is unambiguous and fully specifies the rule text,
escalation row, template hint, and test convention to follow.

Files touched (implementation, per task list below):
- `content/skill-release-engineer.md` (Hard rules bullet + Escalation
  Routes row)
- `templates/claude-code-agents/release-engineer.md` (reinforcement hint)
- `test/release-staging.test.mjs` (pinning tests, existing-file
  convention — new test cases only, no new test file)
