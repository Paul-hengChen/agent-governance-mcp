# Author report: e233d-test-comments-b (T-E233D-01..13)

covers: T-E233D-01, T-E233D-02, T-E233D-03, T-E233D-04, T-E233D-05, T-E233D-06, T-E233D-07, T-E233D-08, T-E233D-09, T-E233D-10, T-E233D-11, T-E233D-12, T-E233D-13

Author: qa-engineer A (authoring context). This is not a verdict. Builder is not judge: the code reviewer and a fresh qa-engineer context verify.

## Baseline (AC6)
Recorded at base 6c61864 before any edit, via `node scripts/test-lock.mjs -- npm test`: tests 2958, pass 2955, fail 0, skipped 3, cancelled 0, todo 0. Exit 0. The spec file and `.current/e233d/` were untracked in the tree during that run. The post-commit run on a clean tree is recorded in the handoff notes, so this report does not have to be committed again after it.

## What changed
Comments only in 48 of the 50 owned test files (`test/file-lock.test.mjs` and `test/handoff.test.mjs` have no id-bearing comments). About 430 id-bearing comment blocks were reviewed and the ones that leaned on an id were rewritten to say what the test pins and why, with ids kept as trailing pointers. History was cut down to today's reason. References to review or QA report files became plain words, except tracked paths kept as trailing pointers. Every label another tracked file cites next to an owned file's path is still present (checked by script).

## Check scripts
Kept outside the repo, run from the lane root. Named here by file name only.

- `check-invariance.mjs` (AC1): `invariance OK: 48 files`.
- `check-bare-ids.mjs` (AC2): `bare-id OK`. Id detection is case-insensitive and matches suffixed and lowercase shapes (for example e178a, e123b9, E233B-NEW-1), plus parenthesised lowercase slugs. Before the rewrite it flagged 5 divider blocks in `test/e235b-relative-worktree.test.mjs`; all 5 are fixed.
- `check-xrefs.mjs` (AC3): `xrefs OK (5323 cited tokens checked)`. It treats a token with a trailing `)` literally (the spec's token pattern), so a few pointers keep that exact shape, for example `(backlog C1, spec AC-8)` in qa-flow.
- `check-hygiene.mjs` (AC7, mechanical half): `hygiene OK: 1756 added lines`, with no home-directory path and no URL in added lines. The home-path pattern is built by string concatenation.
- AC4 grep: prints exactly the trailing-comment lines listed below.
- AC5 name-only diff filter: prints nothing, and nothing changed under `test/render-structure.test.mjs` or `test/fixtures`.

## Trailing-comment code lines (AC4)
Only the trailing comment changed on each of these lines. The code before the `//` is byte-identical, and AC1 confirms it.

- `test/e213-shipped-ignored-shape.test.mjs`, the `gitTry(repo, ["worktree", "remove", "--force", lane])` cleanup line. The old comment only cited other ids. The new one says why the cleanup is needed: git refused the removal above, so the worktree is still there (e180 AC5).
- `test/e38-next-role-lookahead.test.mjs`, the `dispatch_pins` line in the combined test. The id moved from the middle to a trailing pointer: `shrink warning (E28)`.
- `test/e38-next-role-lookahead.test.mjs`, the `next_role: "design-auditor"` line in the same test. The id moved to a trailing pointer: `lookahead warning (E38)`.

## Points for the reviewer
- Some test-local labels that match test names (R1-R11, D1-D5, S01a, AC15, "QA probe 1") remain, and the comment next to each also says what is checked. The rewrite rule allows this.
- "round cap" and "PASS" remain where they name real code concepts or status values (`ROUND_CAP`, the PASS status the test writes), not workflow verdicts.
- Some history was deliberately dropped: the e5 state-integrity note, the gate-count history in error-code-contract, the schema-bump history in handoff-versioning and handoff-migration, and the byte-cap raise history in qa-visual-skill-split (reduced to a trailing list of ids). Worth a second look against the base text.
- A stale count ("12 members") in the error-code-contract header was dropped rather than corrected, because the test itself pins the real number.
