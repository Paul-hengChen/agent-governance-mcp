# e82-e84-release-verify-tooling

## Problem Statement

`scripts/verify-release.mjs` has two independent tooling defects in the L-RELTOOL
file set (backlog E82, E84; v4.0.0-execution-plan.md Wave 1, lane L-RELTOOL).

**E82** — Check 6's CI-ground-truth poll defaults `AGC_VERIFY_CI_WAIT_SECONDS` to
600s, which is exactly Claude Code's own Bash-tool-call ceiling (600000ms). A
release-engineer running step 9a at the shipped default therefore cannot
distinguish an ambiguous harness kill from the script's own designed
WARN-and-continue — both events land at the same instant. Every live executor
(v3.102.5, v3.103.0) has had to pick a lower budget by hand; a default nobody
can safely use is not a default. Only fix-shape option (i) — clamp the shipped
constant to ~480s — is in this lane's scope; option (ii) (a step 9a sentence in
`content/skill-release-engineer.md`) is `content/`, which v4.0.0-execution-plan.md
§2.1 reserves to the single L-CONTENT lane (Wave 1 = E91+E103, not this lane).

**E84** — A release cycle can end with its governance bookkeeping commit
(handoff, metrics, tasks — the E71c exclusion that keeps it separate from the
release commit) never pushed, and nothing at close-out checks for that. Check 2
(`pushed-to-origin`, `scripts/verify-release.mjs:104-127`) already compares
`git rev-parse HEAD` against `git rev-parse @{u}` and FAILs on inequality — but
it runs BEFORE the bookkeeping commit exists, so at verification time there is
nothing unpushed yet to see. Simply re-running `verify-release.mjs` after the
bookkeeping commit does not work either: Check 1 (`tag-at-HEAD`) would then FAIL
by construction, because HEAD has moved past the tag. The gap is temporal, not
logical — the bookkeeping commit `6cd767b` (v3.102.5) sat on local `main` one
commit ahead of `origin/main` for a full release cycle, undetected, because
nothing runs a "zero commits ahead of upstream" assertion at that later point in
time, independent of tag-at-HEAD.

**Decision (E84 shape)**: build a `--close-out` mode into
`scripts/verify-release.mjs` — a standalone check that fetches origin and FAILs
if HEAD carries any commits not on its upstream tracking branch, and that
deliberately does NOT require tag-at-HEAD, so it is runnable after the
bookkeeping commit lands (when HEAD is, by design, past the tag). This is
fix-shape (iii) from the backlog row's own menu run through the tool this lane
already owns, not the coordinator-close-out alternative — that alternative
requires a `content/coord-*.md` or `content/skill-release-engineer.md` line
telling a role to invoke it, which is `content/` and therefore L-CONTENT, out
of this lane's file ownership. This spec builds the tool only; wiring an
automatic invocation point into the coordinator/release-engineer SOP is
recorded as a deferred, not-built follow-up (see Out of Scope) — until it
lands, `--close-out` is a documented manual command a human or role runs after
pushing the bookkeeping commit. Run today against the v3.102.5 history, it
would have FAILed with `6cd767b` sitting one commit ahead of `origin/main` —
the exact instance this ticket exists for.

## User Stories

- As a release-engineer, I want Check 6's default CI-wait budget to sit under
  the harness's own Bash-call ceiling, so that the script's WARN-and-continue
  path is actually observable instead of racing an ambiguous harness kill.
- As a release-engineer (or a human closing out a release), I want a single
  command that asserts "nothing local is ahead of upstream" without also
  requiring a tag at HEAD, so that I can run it after the bookkeeping commit
  lands and catch the class of defect that left `6cd767b` unpushed for a full
  release cycle.

## Acceptance Criteria

- **AC1 (E82)** — Given `scripts/verify-release.mjs`, when
  `AGC_VERIFY_CI_WAIT_SECONDS` is unset, then Check 6's poll budget defaults to
  480 seconds (not 600), and the figure is consistent across all three places
  the file states it: the header comment block, the Check 6 comment above
  `DEFAULT_WAIT_SECONDS`, and the constant itself.
  proof: `n=$(grep -c '\b480\b' scripts/verify-release.mjs); m=$(grep -c '\b600\b' scripts/verify-release.mjs); test "$n" = 3 && test "$m" = 0 && echo PASS`

- **AC2 (E82 regression)** — Given `AGC_VERIFY_CI_WAIT_SECONDS` set explicitly
  (e.g. `0` or any positive integer), when Check 6 runs, then behavior is
  unchanged from before this ticket — the explicit value, not the new default,
  governs the poll budget. (Existing `VR-22` and related pins in
  `test/verify-release.test.mjs` already cover this; no new default-path
  behavior is introduced, only the unset-env fallback value changes.)
  proof: existing `test/verify-release.test.mjs` VR-22 and sibling
  `AGC_VERIFY_CI_WAIT_SECONDS`-pinned cases stay green unmodified.

- **AC3 (E84)** — Given a git checkout at HEAD that is one or more commits
  ahead of its `@{u}` upstream (e.g. an unpushed bookkeeping commit) and no tag
  at HEAD, when `node scripts/verify-release.mjs --close-out` runs, then it
  does NOT require or check tag-at-HEAD, runs only the ahead-of-upstream
  assertion, and exits non-zero with a FAIL line naming the ahead commit
  count.
  proof: qa-authored test, e.g. `test("close-out mode FAILs when HEAD is ahead of upstream")`.

- **AC4 (E84)** — Given a git checkout at HEAD where HEAD equals its `@{u}`
  upstream (nothing ahead), when `node scripts/verify-release.mjs --close-out`
  runs, then it exits 0, prints a `CLOSE-OUT PASSED` summary line (distinct
  from the normal-mode `ALL CHECKS PASSED` line), and does NOT invoke Check 1
  (tag-at-HEAD), Check 3 (check-version), Check 4 (CHANGELOG), Check 5 (dist
  parity), or Check 6 (CI ground-truth) — no version argument is resolved or
  required in this mode.
  proof: qa-authored test asserting exit 0, the `CLOSE-OUT PASSED` line, and
  absence of `OK: tag-at-HEAD` / `OK: CI ground-truth` etc. in stdout.

- **AC5 (E84 regression)** — Given no `--close-out` flag, when
  `scripts/verify-release.mjs` runs as before, then all six existing checks run
  exactly as they did before this ticket — `--close-out` is strictly additive,
  not a refactor of the existing check pipeline.
  proof: full existing `test/verify-release.test.mjs` suite stays green.

## Copy / Strings

| string id | exact text (quote verbatim) | source |
|---|---|---|
| vr.closeout.pass | `check:release — CLOSE-OUT PASSED` | authored-here — distinct from `ALL CHECKS PASSED` so operators/tests can tell modes apart |
| vr.closeout.fail-ahead | `FAIL: HEAD is <n> commit(s) ahead of upstream <ref> — not pushed` | authored-here — mirrors existing Check 2 FAIL phrasing style |

## Visual Tokens

| token id | property | value (quote verbatim) | source |
|---|---|---|---|
| N/A | — | — | feature has no visual literals |

## Visual Widgets

| widget id | description | source-node |
|---|---|---|
| N/A | — | feature has no non-primitive widgets |

## Out of Scope

- **E83** (CHANGED vs EVIDENCE path distinction in the E17 record-integrity
  rule) — its entire fix shape is rule text in `content/skill-release-engineer.md`,
  which is L-CONTENT-exclusive per v4.0.0-execution-plan.md §2.1 (Wave 1
  L-CONTENT = E91+E103, not this lane). Reported, not built, in this cut.
- **E82 option (ii)** (the step 9a sentence in `content/skill-release-engineer.md`
  telling the release-engineer to pick a budget below the harness ceiling) —
  same `content/` exclusivity reason. Reported, not built. Note: once option
  (i) ships, that file's existing "default ~10 minutes" prose
  (`test/verify-release.test.mjs` pin near its skill-doc assertions) becomes
  numerically stale (480s ≈ 8 minutes) until the L-CONTENT lane syncs it —
  flagged for the integrator, not a new backlog ticket (it is the same E82 row's
  content half).
- **E84 SOP wiring** — actually making a role/human invoke `--close-out` as a
  matter of course (a coordinator close-out line, or a release-engineer SOP
  step) requires editing `content/coord-*.md` or `content/skill-release-engineer.md`,
  both L-CONTENT-exclusive. This spec ships the tool only; invocation today is
  a manual, documented command.
- `test/verify-release.test.mjs` authorship — qa-owned per Constitution §2;
  this spec names the required coverage, qa-engineer writes the pins.
- (iii) from E84's original menu — "teach verify-release.mjs to fail when the
  working branch is ahead of upstream by anything at all" as a change to
  Check 2 itself — rejected: Check 2 already does exactly this at its own
  point in time (release-commit-pushed verification) and changing it would
  not address the temporal gap; a separate close-out mode is additive and
  leaves Check 2's existing contract untouched.

## Dependencies / Prerequisites

None. (Visual Structural Assertions omitted: no `design/<feature>.md`, mode =
no-design.) No external references found in `docs/backlog.md` rows E82/E84 or
the Wave 1 dispatch card (Resource Audit Gate: zero hits, field omitted).
