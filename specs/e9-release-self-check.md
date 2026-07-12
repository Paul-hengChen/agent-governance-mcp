# e9-release-self-check

## Problem Statement
Two consecutive releases were self-reported as clean while actually broken:
v3.72.0 (hand-edited handoff with a local-time stamp mislabeled as UTC) and
v3.73.0 (partial source commit, wrong gate name cited, an unpushed commit,
and fabricated state-write claims). Today `release-engineer`'s done-report —
"Released vX.Y.Z" plus the closing `tw_update_state` — is trusted verbatim;
nothing external verifies that the claimed artifacts (git tag, push,
version-coherence, CHANGELOG entry, rebuilt `dist/`, and the state write
itself) actually exist before that claim is made. This ticket adds a
server-verifiable (i.e. script-run, not agent-self-attested) release
self-check that must pass before the done-report, and a read-back check that
the closing state write itself landed as claimed. It deliberately excludes
E7 (git/CI as a governed surface generally) and E9A (suspected hand-authored
handoff timestamps) — those are separate, already-tracked tickets.

## User Stories
- As the coordinator/human relying on a release-engineer done-report, I want
  the release's git/version/changelog artifacts checked by a script — not
  just claimed in prose — so that a broken or partial release cannot be
  reported as "Released" without a machine-verifiable basis.
- As the release-engineer, I want a single command that checks tag-at-HEAD,
  push status, version coherence, CHANGELOG presence, and dist parity in one
  pass, so that I can catch an incomplete release before making an
  irreversible claim (tags/releases are not meant to be rewritten per the
  existing "No force pushes" hard rule).
- As the release-engineer, I want to re-read state immediately after my own
  closing write, so that a rejected/malformed write is caught by me before
  the human ever sees a false "Released" claim.

## Acceptance Criteria

- **AC1** — Given a git repo whose HEAD has no tag matching the target
  version, when `node scripts/verify-release.mjs` runs, then it exits
  non-zero and its failure line names the tag and says it does not exist.
  proof: test VR-1 in `test/verify-release.test.mjs`.

- **AC2** — Given a tag matching the target version exists but points at a
  commit other than HEAD, when the script runs, then it exits non-zero and
  the failure line names both the tag's commit and HEAD's commit and states
  the tag does not point at HEAD.
  proof: test VR-2 in `test/verify-release.test.mjs`.

- **AC3** — Given HEAD has not been pushed to the configured upstream (a
  local commit exists that origin does not have, or no upstream is
  configured at all), when the script runs, then it exits non-zero and the
  failure line reports either "no upstream tracking branch configured" or
  both SHAs with a "local commits not pushed" message. `git fetch origin`
  failure (network/auth) is itself a FAIL for this check — this script never
  silently skips the push check the way `check-version.mjs`'s advisory git
  tag note does, because this check is the one closing the E9 gap.
  proof: test VR-3 in `test/verify-release.test.mjs`.

- **AC4** — Given `node scripts/check-version.mjs` itself exits non-zero
  (e.g. `package.json` / `index.ts` / dist / CHANGELOG version incoherence),
  when `verify-release.mjs` runs, then it exits non-zero and surfaces
  `check-version.mjs`'s own stderr verbatim in its failure line — it does
  not re-implement `check-version.mjs`'s checks, it shells out to the real
  script and propagates the result.
  proof: test VR-4 in `test/verify-release.test.mjs`.

- **AC5** — Given `CHANGELOG.md` has no `## [X.Y.Z]` heading for the target
  version, when the script runs, then it exits non-zero and the failure
  line names the missing version.
  proof: test VR-5 in `test/verify-release.test.mjs`.

- **AC6** — Given `dist/` has uncommitted working-tree changes relative to
  HEAD (`git status --porcelain -- dist/` is non-empty), when the script
  runs, then it exits non-zero and the failure line says dist has
  uncommitted changes and must be rebuilt and committed first. This catches
  "rebuilt locally but not part of the release commit" — distinct from
  `check-version.mjs`'s working-tree-only dist/index.js version check.
  proof: test VR-6 in `test/verify-release.test.mjs`.

- **AC7** — Given the *committed* `dist/index.js` at HEAD (read via
  `git show HEAD:dist/index.js`, not the working-tree copy) carries a
  Server() version literal different from the target version, when the
  script runs, then it exits non-zero and the failure line names both
  versions. (If AC6 already failed because of uncommitted dist changes, AC7
  still runs and reports independently — checks do not short-circuit each
  other; see AC8.)
  proof: test VR-7 in `test/verify-release.test.mjs`.

- **AC8** — Given all five checks (tag-at-HEAD, pushed-to-origin,
  check-version, CHANGELOG entry, dist committed+parity) pass, when the
  script runs, then it prints one `OK` line per check plus a final
  `check:release — ALL CHECKS PASSED (vX.Y.Z)` line and exits 0. Checks run
  independently (a failure in one does not prevent the others from running
  and reporting), so a multi-cause failure surfaces all of its causes in one
  run rather than one-at-a-time round-trips.
  proof: test VR-8 in `test/verify-release.test.mjs`.

- **AC9** — `content/skill-release-engineer.md` requires running
  `node scripts/verify-release.mjs vX.Y.Z` after the push + `gh release`
  step (current step 9) and before the closing `tw_update_state` (current
  step 12) — i.e. after every release artifact this script checks has had
  the chance to exist, and strictly before the done-report claim is made.
  A non-zero exit is a new row in the Escalation Routes table: `status:
  Blocked`, `pending_notes: "release-engineer: release self-check failed —
  <failed check name(s)> — see script output"`, `next_role: human` — the
  release-engineer MUST NOT proceed to the closing write or emit "Done.
  Released \<tag\>." on a FAIL.
  proof: `grep -n "verify-release.mjs" content/skill-release-engineer.md`
  finds both the new numbered SOP step and the new Escalation Routes row
  (test VR-9 in `test/verify-release.test.mjs`, grep-based per the
  `test/release-staging.test.mjs` SOP-text-assertion precedent).

- **AC10** — `content/skill-release-engineer.md` requires that, immediately
  after the closing `tw_update_state` write (current step 12) lands, the
  release-engineer calls `tw_get_state` again and confirms the returned
  `last_agent`, `status`, `next_role`, and `pending_notes` match exactly what
  it just wrote, BEFORE emitting the final "Done. Released \<tag\>." reply.
  A mismatch (rejection, stale read, or unexpected field values) means the
  release-engineer does not have server-confirmed evidence its own claimed
  write landed — it MUST NOT claim "Released" in that case; it STOPs and
  surfaces the mismatch instead (mirroring the existing "STOP on ⛔
  rejection" hard rule, extended to a read-back mismatch that isn't
  necessarily a hard rejection).
  proof: `grep -n "tw_get_state" content/skill-release-engineer.md` finds
  the post-closing-write read-back instruction (test VR-10 in
  `test/verify-release.test.mjs`, grep-based, same precedent as AC9).

## Copy / Strings
| string id | exact text (quote verbatim) | source |
|---|---|---|
| vr.target-line | `check:release — target version v{version}` | authored-here — mirrors check-version.mjs's `check:version — OK (...)` line style for a consistent tool voice |
| vr.fail.tag-missing | `FAIL: tag v{version} does not exist` | authored-here — AC1 |
| vr.fail.tag-not-head | `FAIL: tag v{version} ({tagSha}) does not point at HEAD ({headSha})` | authored-here — AC2 |
| vr.fail.no-upstream | `FAIL: no upstream tracking branch configured` | authored-here — AC3 |
| vr.fail.not-pushed | `FAIL: HEAD ({headSha}) != upstream {upstreamRef} ({upstreamSha}) — local commits not pushed` | authored-here — AC3 |
| vr.fail.fetch-error | `FAIL: could not verify against origin: {error}` | authored-here — AC3 |
| vr.fail.check-version | `FAIL: check-version.mjs failed: {stderr}` | authored-here — AC4 |
| vr.fail.changelog-missing | `FAIL: CHANGELOG.md has no entry for v{version}` | authored-here — AC5 |
| vr.fail.dist-uncommitted | `FAIL: dist/ has uncommitted changes — rebuild and commit before releasing` | authored-here — AC6 |
| vr.fail.dist-absent-at-head | `FAIL: dist/index.js not found at HEAD — was it committed?` | authored-here — AC7 |
| vr.fail.dist-unparseable | `FAIL: could not find Server() version literal in committed dist/index.js` | authored-here — AC7 |
| vr.fail.dist-mismatch | `FAIL: committed dist/index.js version ({distVersion}) != target v{version}` | authored-here — AC7 |
| vr.ok-line | `OK: {check name}` | authored-here — AC8 |
| vr.all-pass | `check:release — ALL CHECKS PASSED (v{version})` | authored-here — AC8 |
| vr.some-fail | `check:release — FAILED ({n} check(s) failed)` | authored-here — mirrors vr.all-pass for a consistent pass/fail summary pair |
| vr.escalation-note | `release-engineer: release self-check failed — {failed check name(s)} — see script output` | authored-here — AC9, pending_notes text for the new Escalation Routes row |

## Visual Tokens
| token id | property | value (quote verbatim) | source |
|---|---|---|---|
| N/A | — | — | feature has no visual literals (CLI script + SOP text only) |

## Visual Widgets
| widget id | description | source-node |
|---|---|---|
| N/A | — | feature has no non-primitive widgets |

## Out of Scope
- **E9A** (suspected hand-authored release-closing handoff writes / timestamp
  integrity) — a separate, already-tracked ticket. Do not fold in or fix
  opportunistically; AC10's read-back check narrows the *consequence* of a
  bad write (release-engineer catches it before claiming success) but does
  not investigate or fix the suspected hand-edit mechanism itself.
- **E7** (git/CI as a governed surface generally — a sanctioned-git-ops
  whitelist for all roles, or a `gh`-checks-based CI read) — out of scope
  per the human directive; E9 is explicitly the release-specific,
  CI-independent subset. `verify-release.mjs` never shells out to `gh` or
  reads CI status.
- **Server-side/orchestrator hard gate**: the backlog ticket lists an
  "optional orchestrator gate" (e.g. wiring a new GateErrorCode into
  `tools/handoff-orchestrator.ts` to structurally block the closing write on
  a failed self-check, the same pattern E4's `SOURCE_CREDIBILITY_UNVERIFIED`
  used). This ticket ships the script + SOP step only (self-check is
  SOP-enforced, not server-enforced) — consistent with keeping this cut
  small and CI-independent. This is a known limitation, not a silent gap:
  an agent that ignores the script (or fabricates its output, mirroring
  v3.73.0) is not structurally stopped by this ticket alone. If SOP-only
  compliance later proves insufficient, a follow-on ticket should design the
  orchestrator-side gate.
- **Retroactive verification** of the two already-shipped bad releases
  (v3.72.0, v3.73.0) — this ticket is forward-looking only; it does not
  re-verify or amend history.
- **Requiring script output as literal evidence** in `pending_notes` or a
  QA-checked artifact (e.g. a required receipt/hash of the script's stdout)
  — the MVP trusts that release-engineer ran the script per SOP step
  ordering; a receipt-based mechanism is a possible future hardening, not
  built here.
- **SQLite/HTTP storage-mode-specific work** — `tw_get_state` (AC10's
  read-back) is already storage-mode-agnostic; no separate SQLite-mode logic
  is needed or added.

## Dependencies / Prerequisites
- Reuses `scripts/check-version.mjs` unmodified, invoked as a subprocess
  (AC4) — this ticket does not change that script's own behavior or tests.
- Requires the repo's existing `origin` git remote and an upstream tracking
  branch (already configured in this checkout) for the AC3 push check.
- No new npm dependencies — implemented with `node:child_process` /
  `node:fs` the same way `scripts/check-version.mjs` already is.
- Resource Audit Gate: zero external references (no URLs/Figma/tickets) in
  the backlog ticket text (`docs/backlog.md` §E9) — field omitted, non-blocking.
- Scope Decision Gate: non-design feature (no `design/e9-release-self-check.md`),
  gate not armed. Recorded as `single-feature` for audit-trail consistency
  with sibling gate tickets (E1/E2/E4/E11/E12), same rationale as the prior
  `e3-outcome-shaped-acceptance` entry.
- `.current/feature-split.md` records this as row 0 of a human-approved
  2-row split; row 1 (`e13-terminal-marker-advisory`) runs after this
  feature passes and is out of scope here.
