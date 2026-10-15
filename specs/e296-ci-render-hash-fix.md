# e296-ci-render-hash-fix

Lane e296 of the post-v4 wave 3 fan-out (`specs/fanout-post-v4-w3.md`). Follow-up to the qa-PASS feature `e296-manifest-tier-cut-approval` (`specs/e296-manifest-tier-cut-approval.md`, AC10). One qa-only test fix inside the lane's owned set (`test/e296-*.test.mjs`). Base `d9d4036`.

## Problem Statement

CI on `d9d4036` is red at `test/e296-manifest-tier.test.mjs` test "AC10: render output is byte-identical to base". The test hashes `node scripts/fanout.mjs render` stdout with no `--primary` / `--mailbox-root`, so the render embeds the running checkout's absolute path (three lines on the author's checkout). Both pinned hashes — w3/e296 `045b56ae…128a` and the w2/e295 control `485eabe0…f863` — therefore hold only on the author's machine; CI computed `54995a2f…` for the first. The adjacent test "AC10: render ignores the approval column" already passes fixed `--primary ROOT --mailbox-root TMP` and is environment-independent. Product code is correct; only the test is environment-dependent.

## User Stories

- As the integrator, I want the lane's AC10 test to pass on CI and on any checkout path, so that the lane's CI is green for the reason the test claims (render output unchanged vs base), not because of where it ran.

## Acceptance Criteria

- **AC1** — Given any checkout path (the lane worktree, a CI runner, or a copy of the tree at another absolute path), when `test/e296-manifest-tier.test.mjs` runs, then both assertions of the test "AC10: render output is byte-identical to base" (w3/e296 at base `c392cc3`, and the w2/e295 control at base `25bc84c`) pass, and each still proves the lane-HEAD render output is byte-identical to the base render output for those arguments. qa picks ONE of: (a) pass fixed `--primary` / `--mailbox-root` arguments, following the adjacent "AC10: render ignores the approval column" test, and re-pin both hashes to the path-independent output — each re-pinned hash measured identically on the base commit's tree and on lane HEAD, both measurements recorded in the evidence; or (b) drop the pinned hashes and compare the lane-HEAD render output against the base render output produced in the same run under the same arguments. No other test in the file and no other file changes; no code, content, `dist/**` or golden changes. The full suite is green on the final HEAD with a clean tree.
  proof: `node --test test/e296-manifest-tier.test.mjs` passes in the lane worktree AND in a second copy of the same HEAD at a different absolute path (e.g. `git worktree add <tmp>/e296-copy HEAD` with `node_modules` linked); then `node scripts/test-lock.mjs -- npm test` on the final HEAD, clean tree, 0 fail (the known E312 flake in `test/e123b9-lane-flip.test.mjs` AC-MIG-3, if it fires, is reported, not fixed).

## Copy / Strings

| string id | exact text (quote verbatim) | source |
|---|---|---|
| N/A | — | test-only fix; no user-facing strings |

## Visual Tokens

| token id | property | value (quote verbatim) | source |
|---|---|---|---|
| N/A | — | — | feature has no visual literals |

## Visual Widgets

| widget id | description | source-node |
|---|---|---|
| N/A | — | feature has no non-primitive widgets |

## Out of Scope

- E312 / `test/e123b9-lane-flip.test.mjs` AC-MIG-3 (the known flake, also red on the same CI run) — not touched.
- Any file other than `test/e296-manifest-tier.test.mjs` (plus qa evidence): no `tools/**`, `scripts/**`, `dist/**`, `content/**`, goldens, ceilings or other tests.
- Changing `fanout.mjs render`'s default `--primary` / `--mailbox-root` resolution (product behaviour is correct).

## Dependencies / Prerequisites

- Base `d9d4036` (feature `e296-manifest-tier-cut-approval` qa PASS, T-E296-01..06).
- Resource Audit Gate: the inputs (the CI failure report, the test file, the prior spec) contain no external references; `external_refs` omitted.
- Routing: single-role judge dispatch — test-only, no sr-engineer / code-reviewer hop; pm → qa-engineer via `resume_of: qa-engineer`, after integrator pre-review and human cut approval.
- Visual Structural Assertions omitted: no `design/<feature>.md`, mode = no-design.

## Cut

| id | desc | depends_on | est. files | touches | design-link |
|---|---|---|---|---|---|
| T-E296-07 | qa: make both AC10 render-hash assertions in `test/e296-manifest-tier.test.mjs` checkout-path independent (fixed `--primary` / `--mailbox-root` + re-pinned base-measured hashes, or HEAD-vs-base output comparison; qa picks) (AC1); full suite green on final HEAD, clean tree; evidence `qa_reports/review_T-E296-07.md` | none | 1 | `test/e296-manifest-tier.test.mjs` | — |
