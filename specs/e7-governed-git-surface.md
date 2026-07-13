# e7-governed-git-surface

## Problem Statement

`CLAUDE.md` states plainly: "It does NOT touch git. Commit/PR workflow is out
of scope" — but that is a description of the *server's* reach, not of what
agents actually do inside a governed workspace. In practice, release-engineer
touches git on every single release, and the two worst recent incidents were
both git incidents: C13 (a hand-edit wedge caused by an out-of-band commit)
and D10 (a haiku-tier release-engineer hit a non-fast-forward push rejection,
aborted a rebase, and ran `git reset HEAD~1`, discarding its own just-committed
release — only the reflog made recovery possible). D10 (v3.71.1) fixed this
for release-engineer specifically: `content/skill-release-engineer.md` now
carries a hard STOP rule forbidding `git reset`/`rebase`/`checkout --force`/
`clean` on push rejection or collision, in favor of `status=Blocked` +
coordinator recovery.

That fix is role-scoped. Nothing stops a *different* role from running the
same destructive commands — sr-engineer, code-reviewer, qa-engineer, and
qa-visual all already invoke read-only git (`git diff`, `git log`) in their
SOPs, and any of them (or a future role) could just as easily reach for
`git reset`/`git rebase`/`git push --force` under pressure, with no rule in
their own skill file to stop them and no general rule anywhere to point to
after the fact. The backlog risk is explicit: "the next git incident comes
from a role other than release-engineer, with no rule to point to."

Separately, test-green is currently self-reported: nothing external verifies
an agent's claim that tests pass. E9 (DONE, v3.78.0) already closed the
adjacent "release-engineer's *claims about git state* are unverified" gap
with a server-verifiable self-check script (`scripts/verify-release.mjs`:
tag-at-HEAD, pushed-to-origin, check-version green, CHANGELOG present, dist
parity). E9's own backlog entry explicitly scopes itself as "the
release-specific, CI-independent subset" and calls out overlap with E7's
"CI-reads-instead-of-trusting direction" — i.e., E9 verifies git-state
claims from data already inside the repo; it does NOT read external GitHub
Actions run status via `gh`. That narrower CI-status-read idea is this
ticket's *optional* second step, addressed in Out of Scope.

## Decision

Generalize D10's whitelist into a single core (always-shipped) constitution
bullet rather than duplicating role-specific STOP text everywhere:

1. **One sanctioned-git-ops whitelist, ALL roles, in `content/const-15-core-tail.md`
   §6 (Security & Privacy).** const-15 is tagged `core` in
   `prompts/constitution-manifest.ts` — `includeSegment` returns `true`
   for `core` unconditionally, so it ships in every dispatch arm: lite mode,
   full chain, design-armed, non-design. That is the correct home for a rule
   meant to bind every role, including roles and modes that don't route
   through the coordinator chain at all.
2. **release-engineer's existing D10 bullet becomes a pointer, not a
   restatement.** Mirroring the E10 precedent (`const-08-chain-31-mid.md`'s
   Lease-Override/Bookkeeping-Write bullets are cross-referenced from
   `skill-pm.md`/`skill-coordinator.md` rather than restated), the
   release-engineer-specific recovery mechanics (STOP → `status=Blocked` →
   local release-commit SHA in `pending_notes` → coordinator recovery →
   step 3a re-baseline) stay exactly where they are, verbatim — only the
   "why reset/rebase/force are forbidden" whitelist logic gets a one-line
   pointer to the new general §6 rule, so there is one source of truth for
   the whitelist itself.
3. **No new server-side gate.** Like D10 before it, this is SOP text an
   agent must voluntarily follow — the server has no git awareness (per
   `CLAUDE.md`'s own "What this server does NOT do") and cannot mechanically
   block a `git reset`. This ticket closes the *documentation* gap the
   backlog risk names ("no rule to point to"), not a technical one.
4. **Byte-budget accounting.** const-15 is core-tagged, so adding text to it
   grows the byte count shipped even in lite mode, the tightest budget arm.
   `test/context-budget.test.mjs` enforces cap constants on these composed
   sizes (the b9-token-budget-brake convention) — this ticket must recompute
   and bump the relevant cap(s) as part of the same change, not as a
   surprise CI failure discovered later.

## User Stories

- As any role operating on a governed workspace's git history, I want a
  single, general whitelist of sanctioned git operations (and a clear STOP
  rule for destructive ones), so that I don't need to independently reason
  about the D10 incident's lesson from scratch, and so the same discipline
  applies whether I'm release-engineer or any other role that ever touches
  git.
- As release-engineer, I want my existing STOP mechanics preserved exactly
  as they are today, with the general rule cross-referenced rather than
  duplicated, so nothing about my recovery flow silently changes.
- As the coordinator/human recovering from a blocked git operation, I want
  the same recovery contract (`status=Blocked`, git state in
  `pending_notes`, hand back — never an unsupervised destructive fix)
  regardless of which role hit the wall.

## Acceptance Criteria

- **AC1** — Given any role whose SOP or ad-hoc action would touch git, when
  it considers a git operation, then `add`/`commit`/`tag`/fast-forward
  `push` are sanctioned and `reset`/`rebase`/`clean`/force-push/
  `checkout --force` are NOT — the agent must STOP, write
  `status=Blocked` with the git state (branch, local SHA, what triggered
  the STOP) in `pending_notes`, and hand back to the coordinator/human,
  generalizing D10 beyond release-engineer.
  proof: grep-based pinning test asserting `content/const-15-core-tail.md`
  §6 contains the sanctioned-verbs list (`add`, `commit`, `tag`,
  fast-forward `push`) AND the forbidden-verbs list (`reset`, `rebase`,
  `clean`, force-push/`checkout --force`) AND a STOP/`Blocked`/hand-back
  phrase, in the same bullet.
- **AC2** — Given `content/skill-release-engineer.md`'s existing D10 bullet,
  when read after this ticket ships, then it cross-references the new
  general §6 rule by name/section (pointer-only, mirroring the E10
  const-08 cross-reference convention) rather than being the sole locus of
  the whitelist logic.
  proof: grep-based test asserting `skill-release-engineer.md` contains a
  reference to the general git-ops rule (e.g. matches `§6` or "general
  git-ops whitelist" near the existing D10 bullet).
- **AC3** — Given the new §6 bullet is added to `const-15-core-tail.md`
  (tagged `core` in `prompts/constitution-manifest.ts`), when the
  constitution is composed for ANY dispatch arm — lite (no chain), full
  chain, design-armed, non-design — then `includeSegment("core", ...)`
  returns `true` unconditionally, so the bullet ships in the assembled
  prompt in every case, not just the full-chain/design arms.
  proof: existing `test/compose-equivalence.test.mjs` /
  `test/context-budget.test.mjs` golden-fixture assertions (core segments
  ship on every arm) continue to pass unmodified, plus the new AC1 pinning
  test itself running against the composed (not raw) constitution text.
- **AC4** — Given the new bullet's added bytes to a core-tagged fragment,
  when `test/context-budget.test.mjs`'s cap constant(s) for the
  core/lite-mode composed byte budget are evaluated, then they are
  recomputed and bumped (with a comment citing this ticket, mirroring the
  b9-token-budget-brake convention) so the size increase is an intentional,
  reviewed bump rather than a spurious CI failure.
  proof: `npm test` — `test/context-budget.test.mjs` passes post-bump.
- **AC5** (non-regression) — Given release-engineer's existing D10 recovery
  mechanics (STOP on non-fast-forward/push-rejection/collision → write
  `status=Blocked` with the local release-commit SHA in `pending_notes` →
  hand back for coordinator recovery → step 3a re-baseline-off-HEAD as the
  documented first recovery step), when this ticket ships, then that
  recovery text is unchanged verbatim except for the AC2 cross-reference
  addition — no release-engineer-specific behavior is altered.
  proof: `git diff` on `content/skill-release-engineer.md` shows only the
  cross-reference addition near the existing D10 bullet; the STOP/
  `Blocked`/`pending_notes`-SHA-example/coordinator-recovery/step-3a text
  is byte-identical elsewhere.
- **AC6** (non-goal, explicit) — Given this ticket ships, when checked for
  server-side enforcement, then NO new gate, predicate, or
  `tools/handoff-orchestrator.ts` check is added — the whitelist remains
  SOP text an agent must voluntarily follow, consistent with `CLAUDE.md`'s
  documented boundary that the server has no git awareness.
  proof: `git diff --stat` for this ticket touches only
  `content/const-15-core-tail.md`, `content/skill-release-engineer.md`,
  `test/context-budget.test.mjs`, and the new/extended pinning test file —
  zero changes under `gates/`, `tools/handoff-orchestrator.ts`, or
  `index.ts`.

## Copy / Strings

| string id | exact text (quote verbatim) | source |
|---|---|---|
| N/A | — | feature has no new user-facing strings (internal governance-tooling/content fix only) |

## Visual Tokens

| token id | property | value (quote verbatim) | source |
|---|---|---|---|
| N/A | — | — | feature has no visual literals |

## Visual Widgets

| widget id | description | source-node |
|---|---|---|
| N/A | — | feature has no non-primitive widgets |

## Out of Scope

- **Optional CI-status-read second step** (backlog: "where CI exists, the
  release gate reads CI status (`gh` checks) instead of trusting the
  agent's own test claim"). Explicitly deferred, NOT cut into this ticket —
  recommend a new, separate P3 backlog row. Reasoning: (a) the repo's
  `.github/workflows/ci.yml` (node 20/22 matrix, build+test) has no current
  integration point for looking up a run by commit SHA from inside the
  release SOP; (b) E9 (DONE, v3.78.0) already closed the adjacent
  "self-reported and unverified" gap for git-state claims specifically
  (tag/HEAD/push/CHANGELOG/dist parity) and explicitly scoped itself as the
  "release-specific, CI-independent subset," narrowing what's left; (c)
  reading external CI status safely is nontrivial in its own right —
  post-push CI latency (the workflow hasn't necessarily finished by the
  time release-engineer would check), `gh` auth availability in the agent's
  execution context, and pending/flaky-run handling all need their own
  design, not a bullet-point bolt-on to a 3-4-file content ticket.
- **A new server-side gate enforcing the whitelist mechanically** — out of
  scope per AC6; this is SOP-text discipline, matching D10's own precedent
  and `CLAUDE.md`'s documented "does NOT touch git" boundary.
- **Editing any other role's skill file beyond the AC2 cross-reference** —
  no other role currently performs git *mutations*; `skill-code-reviewer.md`,
  `skill-qa-engineer.md`, and `skill-qa-visual.md` only ever invoke
  read-only `git diff`/`git log`, which the new whitelist already permits
  implicitly (they're not `reset`/`rebase`/`clean`/force-push). No edits
  needed there.
- **E9A** (suspected hand-authored release-closing writes) — separate open
  ticket, not addressed here.
- Retroactively auditing past incidents (C13, D10, D9) for additional
  process fixes beyond what D10 and this ticket already cover.

## Dependencies / Prerequisites

Depends on D10 (done, v3.71.1) — this ticket generalizes D10's
release-engineer-only STOP rule to all roles; it does not modify D10's
underlying incident mechanics. Sequenced after D10 per backlog ordering.

Zero external references (no URLs/Figma/tickets) found in the backlog entry
or intake instructions — Resource Audit Gate: no action needed.
