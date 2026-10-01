# e260g-r3-fix

Follow-up feature in lane `e260g`, ticket E260. It fixes the one blocking finding and the cheap non-blocking findings from round 2 of the code review of the parent feature `e260g-test-e3-l-comment-trim` (parent spec: `specs/e260g-test-e3-l-comment-trim.md`). The human approved this re-scope in the coordinator's chat, so the hop counter resets for this feature. Acceptance criteria AC1 to AC9 are defined in the parent spec and are not restated here; this feature adds no new AC. Base commit and the proof script are the parent's (`.current/e260g/base-sha`, `.current/e260g/proof.mjs`). Test files are written only by qa-engineer (constitution section 2), so the single task is a qa-engineer authoring task.

## Problem Statement
Round 2 of the review (`review_reports/review_T-E260G-09.md`, section "Round 2") found that all round 1 findings were fixed, with one required item left.
- Required: the header of `test/e31-config-nonfatal.test.mjs` counts 8 lines after the round 1 fix. The "Retained blocks" table in `specs/e260g-comment-rationale.md` says "none", so AC5 fails until the header counts 7 or fewer.
- Recommended: the cited-paths check in `.current/e260g/proof.mjs` (around line 153) skips a path when the base file contains it anywhere as a substring. A re-introduced `gates/registry.js` in `test/error-code-contract.test.mjs` therefore passes, because the base contains `dist/gates/registry.js`.
- Optional nits in `specs/e260g-comment-rationale.md`: line 107 says "four" const-08 tests where there are five; line 176 says the `t-*` labels are not from the spec, but they came from the old file header.

## Task
One task, T-E260G-17, owner qa-engineer, depends_on none.

(a) In the `test/e31-config-nonfatal.test.mjs` header, join two comment lines (for example the lines at 6-7) so the block counts 7 or fewer lines. Keep the round 1 wording true. Comments only; the Retained blocks table stays "none".

(b) Change the cited-paths base exemption in `.current/e260g/proof.mjs` to match the exact cited path token, not a substring. A path is exempt only if the base file contains it as a whole path token (not preceded or followed by a path character). Add a negative control: in a scratch clone under `$TMPDIR`, put `gates/registry.js` into a comment of `test/error-code-contract.test.mjs` when the base only contains `dist/gates/registry.js`, run the proof there, and show `cited-paths` fails. Record the control's output in the review notes. Remove the scratch clone afterwards.

(c) Optional: fix the two rationale-spec nits above (line 107 "four" to five; line 176 say the labels came from the old file header).

## Done criteria
- `node .current/e260g/proof.mjs --list-mid` lists 0 blocks (closes AC5).
- `node .current/e260g/proof.mjs` full PASS (AC1 to AC4, AC7, AC8 still hold).
- `node scripts/check-md-tables.mjs` exits 0.
- Full suite via `node scripts/test-lock.mjs -- npm test` exits 0 on the clean committed HEAD (AC9).

## Chain
qa-engineer author, then pm, then code-reviewer (resume_of the round 2 review), then a fresh qa-engineer verifier. The verifier re-runs lane-wide AC1 to AC9 and flips T-E260G-09 to T-E260G-17 complete.

## Out of Scope
Everything the parent spec lists as out of scope. Also not in scope: the other optional review items (BARE_ID_WIDE gap for `// E1A-1..7`, the 133-character line at `lane-ticket-allocation:4`).
