# e115-join-precondition-check

## Problem Statement
A join ticket's `depends_on` satisfaction today exists only as prose. J1b's
preconditions (J1a PASS, L3+L4 merged) were recorded as the sentence *"J1a
PASS at 0637e61, L3+L4 merged at 3245bb9"* and nothing ever checked it — the
server cannot, because L3/L4's PASS lives in another workspace's
`.current/handoff.md` that the integration workspace never reads (and per
E109's anchoring rule, it never should — governance state is workspace-scoped
and the fix must not become a cross-workspace read). A machine check IS
available without one: `git merge-base --is-ancestor <lane-branch> HEAD` is
local, cheap, and answers the exact question ("is this dependency actually
merged into what I'm building on") that the prose sentence only asserts.

A second, independent gap in the same incident: `tasks.md`/the lane plan
declared L3 would run under `active_feature=source-list-mock` and L4 under
`source-list-contract-docs`, while both actually ran in one
`source-list-mock-contract` workspace. Declared lane identity and actual lane
identity were never compared — and, like the first gap, this comparison is
fully local: the declared plan (`.current/feature-split.md`, when the
coordinator wrote one) and the actual record (this workspace's own
`.current/handoff.md`) both live in the SAME workspace that runs the join
ticket. Comparing them requires no read of any other workspace either.

## User Stories
- As a join-ticket build-entry self-check, I want to verify every
  `depends_on` lane branch is actually an ancestor of `HEAD` before work
  starts, so that a failed or unmerged lane blocks the join mechanically
  instead of on the honesty of a prose sentence.
- As a PM/coordinator closing a fan-out, I want the plan's declared per-lane
  `active_feature` compared against what this workspace's own handoff
  actually recorded, so that a silent lane-identity drift (two planned lanes
  collapsing into one workspace under a third name) is surfaced instead of
  passing unnoticed.

## Acceptance Criteria
- **AC1** — Given a list of lane branch names (a join ticket's `depends_on`),
  when `checkLaneAncestry` runs `git merge-base --is-ancestor <branch> HEAD`
  (via `execFileSync`, `cwd` pinned to the repo root, never throwing on a
  non-zero exit) for each one, then it returns one result per branch —
  `{ branch, isAncestor: boolean, error?: string }` — naming exactly which
  branch(es) are NOT yet merged, rather than a single pass/fail bit.
  proof: `test/e115-join-precondition.test.mjs` — case "AC1: ancestry check
  distinguishes merged vs unmerged branches".
- **AC2** — Given a `depends_on` branch that does not exist in the repo at
  all (typo, deleted, or never pushed), when `checkLaneAncestry` evaluates it,
  then that branch's result is `isAncestor: false` with a populated `error`
  describing the git failure — never a thrown exception that would crash the
  caller, and never silently coerced to `true`.
  proof: `test/e115-join-precondition.test.mjs` — case "AC2: unknown branch
  degrades to false+error, does not throw".
- **AC3** — *(Amended in review round 1 — see Amendment History. Original
  wording specified per-row equality; that check cannot pass on the
  canonical multi-row Split Table the coordinator template mandates, since
  only one row can ever equal the workspace's single `active_feature` and
  every sibling row would be reported as a fabricated mismatch. The
  question this check answers is MEMBERSHIP, matching the Problem
  Statement's own incident description, not per-row equality.)* Given
  `.current/feature-split.md` exists in the CURRENT workspace and declares a
  per-lane `active_feature` for one or more rows, when
  `checkDeclaredVsActualLaneIdentity` runs, then it reads this workspace's
  OWN `.current/handoff.md` `active_feature` (via `parseHandoff(repoRoot)` —
  no other path is ever read) and checks whether that actual value appears
  ANYWHERE among the declared per-row values — not whether every row equals
  it. A Split Table has one row per planned lane, so sibling rows declaring
  a *different* `active_feature` than the current workspace's own are
  expected and are NOT, by themselves, evidence of a problem. If `actual`
  matches at least one declared row, the result is satisfied
  (`mismatches: []`) regardless of how many other rows declare something
  else, and regardless of those other rows' `status` column. If `actual`
  matches NONE of the declared rows — the exact failure mode the ticket was
  filed from (two planned lanes silently collapsing into a workspace
  running under a third, undeclared name) — the function returns exactly
  ONE finding for the whole check, naming both the full declared set and
  the actual value, never one finding per non-matching row.
  proof: `test/e115-join-precondition.test.mjs` — case "AC3: declared vs
  actual lane identity — actual absent from every declared row surfaces one
  membership mismatch naming the declared set; actual present in any
  declared row, including sibling rows declaring a different value, is
  satisfied".
- **AC4** — Given `.current/feature-split.md` does not exist in the current
  workspace, when `checkDeclaredVsActualLaneIdentity` runs, then it returns a
  degraded-but-honest result (`compared: false`, a `reason` string) rather
  than fabricating a match or a mismatch — no plan artifact means nothing to
  compare, and the function says so explicitly.
  proof: `test/e115-join-precondition.test.mjs` — case "AC4: missing
  feature-split.md degrades honestly, never fabricates a verdict".
- **AC5** — Given this module and its CLI wrapper, when either is invoked,
  then NEITHER ever opens, reads, or shells a command against any path
  outside the single `repoRoot` passed in — no other lane's worktree path,
  no other lane's `.current/handoff.md`. `git merge-base --is-ancestor` is
  answerable from local git object history alone (shared across worktrees of
  the same repo); the identity comparison reads only this workspace's own two
  local files. Zero cross-workspace reads, full stop.
  proof: inspection — `git diff` for the T-E115-01 commit shows no file-read
  call (`readFileSync`, `parseHandoff`, etc.) parameterized by any path other
  than `repoRoot`/`.current/**` under it; `test/e115-join-precondition.test.mjs`
  additionally pins this by asserting the exported functions' signatures take
  no second workspace-path argument.
- **AC6** — Given the join moment where E126's post-merge ledger-preservation
  assertion will eventually run, when this ticket ships, then the module
  carries one clearly marked extension point (a `HOOK POINT FOR E126` code
  comment naming what a future assertion would need — pre/post-merge
  `completed_tasks`/`[x]` counts) at that same call site, WITHOUT
  implementing any part of E126's actual assertion logic.
  proof: inspection — `git diff` for the T-E115-01 commit contains exactly one
  `HOOK POINT FOR E126` comment and no assertion logic beyond it (E126 stays
  filed, P2, blocked on E123/E125, Wave 6).
- **AC7** — Given `scripts/join-precondition.mjs`, when it is invoked as
  `node scripts/join-precondition.mjs <depends_on-branch...> [repo-root]`,
  then it is a thin wrapper with zero script-level logic — it imports
  `checkLaneAncestry`/`checkDeclaredVsActualLaneIdentity`/a render function
  from `dist/tools/join-precondition.js` and prints the result, mirroring the
  existing `scripts/feature-rollup.mjs` pattern exactly (plain Node ESM,
  argv→function→console.log, no logic of its own).
  proof: inspection — `scripts/join-precondition.mjs` line count and shape
  compared against `scripts/feature-rollup.mjs`.
- **AC8** — Given this ticket ships, then `tools/drift.ts`,
  `tools/lane-registry.ts`, every file under `content/`, `tools/registry.ts`,
  and `scripts/verify-release.mjs` are ALL untouched, and no row in
  `docs/backlog.md` is done-marked.
  proof: inspection — `git diff --stat` for the full T-E115 ticket range
  shows none of the above paths.
- **AC9** — *(Added in review round 1 — see Amendment History; folds in
  the review's Q1 non-blocking note because a check that silently no-ops
  on a legal, commonly-produced artifact shape is the same class of defect
  this ticket exists to fix.)* Given a `feature-split.md` header cell or a
  declared feature-identity cell decorated with ordinary markdown emphasis
  (surrounding `**`, `` ` ``, or `_` — e.g. a header written `**feature
  id**`, or a value written `` `e115-join-precondition-check` ``), when
  `checkDeclaredVsActualLaneIdentity` locates the feature-identity column
  and reads declared values, then it strips leading/trailing `*`, `` ` ``,
  and `_` from each cell before the header-alias lookup and before
  collecting/comparing declared values — so a decorated header is still
  recognized (not silently degraded to `compared: false`), and a
  backtick-quoted declared value is not turned into a false membership
  mismatch against an otherwise-matching `actual`.
  proof: `test/e115-join-precondition.test.mjs` — case "AC9: markdown-
  decorated header and backtick-quoted declared values are normalized
  before matching".
| string id | exact text (quote verbatim) | source |
|---|---|---|
| N/A | — | feature has no user-facing strings (internal server/CLI mechanism, no client-visible copy) |

## Visual Tokens
| token id | property | value (quote verbatim) | source |
|---|---|---|---|
| N/A | — | — | feature has no visual literals |

## Visual Widgets
| widget id | description | source-node |
|---|---|---|
| N/A | — | feature has no non-primitive widgets |

## Out of Scope
- E112 (`tw_detect_drift` fan-out blindness) and E132 (derived lane list via
  `tools/lane-registry.ts`) — parallel lanes this wave, not touched.
- Any change to `tools/drift.ts`, `tools/lane-registry.ts`,
  `tools/handoff-write.ts`, `tools/registry.ts`, or `content/**`.
- Wiring this module into the `UPDATE_STATE_GATE_PIPELINE` as a hard gate —
  the backlog row and the Wave 3 dispatch card both describe it as a
  "build-entry self-check," i.e. a callable module + CLI a join ticket's
  build-entry step runs deliberately, not a new server-enforced gate in
  `gates/registry.ts`. Making it a gate is a separate, larger design decision
  (would need a gate id, an owner, exemption rules) not asked for here.
- E126 itself (post-merge ledger-preservation assertion) — only its hook
  point (AC6). E126 depends on E123/E125 and is deferred to Wave 6.
- Any change to how `.current/feature-split.md` is generated or maintained
  (that's the coordinator's Feature-Scope Gate territory, `content/coord-01`)
  — this ticket only reads it.

## Dependencies / Prerequisites
- Depends on E109 (shipped, v3.113.0) — the workspace-anchoring decision this
  ticket's "zero cross-workspace reads" boundary rests on directly.
- No design file exists for this feature (`design/e115-*.md` absent) — Visual
  Structural Assertions section correctly omitted per the no-design
  backwards-compat rule.
- Resource Audit: scanned this ticket's inputs (`docs/backlog.md:237`,
  `docs/v4.0.0-execution-plan.md` Wave 3 dispatch card) for `http(s)://`,
  `figma`, `URL`, "see <ticket>" etc. — zero external references found.
  `external_refs` field omitted per the Gate Summary's zero-hits rule
  (absence = non-blocking).
- **File-ownership declaration (this lane's complete touch list)**: NEW
  `tools/join-precondition.ts`, NEW `scripts/join-precondition.mjs`, NEW
  `test/e115-join-precondition.test.mjs`. Disjoint from E112's
  `tools/drift.ts`, E132's `tools/lane-registry.ts`, and E113's
  `tools/feature-rollup.ts`/`scripts/feature-rollup.mjs` (a same-shape sibling
  module, not an edit to it). `scripts/verify-release.mjs` surveyed and
  confirmed unowned this wave (E113's close-out interface landed in
  `tools/feature-rollup.ts` instead) but deliberately NOT used as this
  ticket's surface anyway — a new module keeps the self-check import-only
  from a join ticket's own build-entry step rather than growing the release
  script's responsibility.

## Amendment History

**Round 1 (2026-09-22), following code-reviewer CHANGES_REQUESTED on
T-E115-01 (C1, blocking):** the reviewer proved AC3's original literal
wording ("compares each declared value ... whenever they differ") produces
a check that reports N−1 fabricated mismatches on every healthy multi-row
`feature-split.md` — the canonical shape `content/coord-01-core-head.md:48+`
mandates — because only one row can ever equal the workspace's single
`active_feature`. Reproduced against this workspace's own real
`feature-split.md` and against a synthetic, entirely healthy 2-row plan.
Only a degenerate single-row exact-match plan ever returned clean, so the
AC was not satisfiable on the artifact the codebase actually generates.

- **AC3 amended** to a MEMBERSHIP test (reviewer's remedy option 1, over
  option 2's row-scoped/skip-`done` variant): flag iff the workspace's
  actual `active_feature` is absent from the full declared set, reporting
  one finding naming the declared set alongside the actual value. Chosen
  because it maps directly onto the Problem Statement's own incident —
  two planned lanes (`source-list-mock`, `source-list-contract-docs`)
  collapsing into one workspace under a third, undeclared name
  (`source-list-mock-contract`) — which is a membership failure: the
  actual value was absent from every declared row, full stop, independent
  of any row's `status`. Option 2's `status: done` carve-out addresses a
  different concern (whether a *completed* sibling lane's declared value
  should count) that the incident does not turn on, and would have made
  the check's pass/fail contingent on how faithfully `status` columns are
  kept current — an extra dependency the membership test doesn't need.
  Membership also keeps AC4's honest-degradation principle intact: exactly
  one finding is ever produced (satisfied, or one membership mismatch),
  never a fabricated per-row verdict.
- **AC9 added**, folding in the review's Q1 non-blocking note: markdown
  decoration (`**`, `` ` ``, `_`) must be stripped from cells before the
  header-alias lookup and before comparing declared values. Folded in
  because a check that silently degrades to `compared: false` on an
  ordinarily-decorated, legal header is the same class of defect as C1 —
  the check goes quiet on a real artifact shape — and the same
  normalization protects backtick-quoted declared *values* from becoming
  false membership mismatches, which is now a correctness concern under
  the amended AC3, not just a cosmetic one.
- **Q2 (no end-of-options guard on branch args) — deferred, no AC change.**
  `execFileSync` uses an argv array (no shell), so this is not an
  injection vector; a `-`-leading branch degrades safely to `false` +
  git's usage text as `error`. Cosmetic-message-quality only; left to
  sr-engineer's discretion, not required for round 2 PASS.
- **Q3 (empty-ancestry verdict undocumented) — deferred, no AC change.**
  The existing behavior (`ancestry.length > 0 && ...` reporting NOT
  satisfied on zero branches) is the correct conservative default — no
  evidence is not satisfaction — and is only reachable via the CLI with no
  `depends_on` branches given. A one-line comment stating the choice is
  deliberate is welcome but not gated on; no test case required.
