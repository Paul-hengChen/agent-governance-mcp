# E260I author evidence (T-E260I-01..11)

Author hops of lane e260i (spec `specs/e260i-budget-render-comment-trim.md`, rationale in `specs/e260i-comment-rationale.md`). This file is the author's record, not the verification: T-E260I-12 is a fresh qa-engineer that re-runs every check after the independent code-review. Worktree: `../agent-governance-mcp-lanes/e260i`, base `ab335b8`.

## Lane-wide proof (T-E260I-11, clean committed tree)

`node .current/e260i/proof.mjs` (no `--changed-only`, no `--through`):

```
emit: 2 files, 0 differ
leaves: 2 files, 0 differ
scanned: 2 file(s)
>20: 0
8-20: 0 block(s)
bare-id: 0
directives: ok
form: ok
hygiene: ok
width: ok
reflow: ok
pinned: ok
proof: PASS
```

`scope: ok` is printed first. `--list-mid` lists no block, so the "Retained blocks" table of the rationale spec carries a single "none" row. The DIRECTIVE pattern of the proof script was narrowed in T-E260I-06 to `\bc8 (?:ignore|disable|enable)` (prose such as "the c8 growth above" matched the bare form); neither owned file has a real directive comment at base, accepted by the coordinator.

## Full suite on the clean committed HEAD

`git status --porcelain` was empty before the run and is empty after it. Command: `node scripts/test-lock.mjs -- npm test`.

| metric | base run (integrator) | this run |
|---|---|---|
| tests | 3043 | 3043 |
| pass | 3040 | 3040 |
| fail | 0 | 0 |
| skipped | 3 | 3 |
| exit code | 0 | 0 |

Counts equal the base run; no re-baseline was needed or made.

## Per-block before to after (counted lines by `analyzeText`)

Before is the size at base for every block of 8 or more counted lines; after is the largest block at HEAD (7) for the whole lane, and the exact size for the rewritten blocks of T-E260I-08..10. Blocks are named by their first line at base.

### test/context-budget.test.mjs (31 blocks of 8 or more, 1490 counted lines before)

| task | blocks at base (line:counted) | after |
|---|---|---|
| T-E260I-03 | 1:29, 54:9, 127:9, 202:8, 227:121, 353:39, 428:20, 475:10, 495:8, 558:10, 665:10, 682:12, 703:8 | all 7 or fewer |
| T-E260I-04 | 721:94, 826:54, 889:8 | all 7 or fewer |
| T-E260I-05 | 943:188, 1133:34 | all 7 or fewer |
| T-E260I-06 | 1175:250 | 7 or fewer |
| T-E260I-07 | 1431:249 | 7 or fewer |
| T-E260I-08 | 1697:10 | 4 |
| T-E260I-08 | 1732:20 | 7 |
| T-E260I-08 | 1801:13 | 5 |
| T-E260I-08 | 1855:8 | 3 |
| T-E260I-08 | 1941:8 | 4 |
| T-E260I-08 | 1982:11 | 5 |
| T-E260I-08 | 2032:183 | 2 (a WHY head, a pointer, and the cap history moved to the rationale spec) |
| T-E260I-09 | 2217:26 | 2 |
| T-E260I-09 | 2274:8 | 4 |
| T-E260I-09 | 2295:20 | 7 |
| T-E260I-09 | 2354:13 | 4 |

### test/render-structure.test.mjs (9 blocks of 8 or more, 239 counted lines before)

| task | blocks at base (line:counted) | after |
|---|---|---|
| T-E260I-09 | 1:69 | 6 |
| T-E260I-09 | 85:9 | 3 |
| T-E260I-09 | 139:8 | 2 |
| T-E260I-09 | 157:49 | 7 |
| T-E260I-10 | 270:22 | 7 |
| T-E260I-10 | 356:24 | 6 |
| T-E260I-10 | 439:9 | 3 |
| T-E260I-10 | 498:41 | 7 |
| T-E260I-10 | 776:8 | 3 |

Block names at base: 270 is the Evidence-Citation pin, 356 the structural sweep, 439 the collect-then-assert note, 498 the history-fixture meta-test header, 776 the reconstructed-call helper. Blocks 1, 85, 139 and 157 are the file header, the composed-body helper, the code-span exclusion and the soundness and hermetic-fixture note.

## Per-task checks

For each trim task: `proof.mjs --changed-only` (with `--through` while later ranges were untrimmed) PASS, the touched file's own test green (T-E260I-08: 54 of 54 in `test/context-budget.test.mjs`; T-E260I-09 and T-E260I-10: render-structure, context-budget and `test/e122-state-render-injection.test.mjs` all green, 76 of 76 and 22 of 22), `node scripts/check-md-tables.mjs` exit 0 after each commit. The code lines `const NUMHEADER_RE = /…/;` and `const BULLET_RE = /…/;` are unchanged (proof `pinned: ok`) and each declaration substring still occurs once in `test/render-structure.test.mjs`.

## Rationale moved

`specs/e260i-comment-rationale.md` gained, for `test/context-budget.test.mjs`: the spec-to-test map of the file header, the lean always-on bundle cap history, the omitConstitution floor note, the hook test isolation note, the design-arm constitution floor history, the teamwork coordinator bundle cap history, the pm and sr-engineer skill token cap histories, the non-design constitution floor history, the constitution-conditional-load test map and sentinel notes, the phase 2 test map; for `test/render-structure.test.mjs`: the header and detector rationale, the composed-body helper, the code-span exclusion, the hermetic baseline fixture, the Evidence-Citation pin, the structural sweep, collect-then-assert, the history-fixture meta-test and the reconstructed-call helper.

## Round 1 fixes

Fix commit: `c837f25`, applied on top of the review commit.

| item | what changed |
|---|---|
| R1 | the rationale spec's lean cap-history intro now says the lean path loads core- and design-tagged fragments (chain-tagged ones are left out), checked against the lean composition call and the segment-inclusion rule; the "ships on the lean path" sentence now says core-tagged. The history rows stay as the record of the bump comments, and the intro says so. |
| R2 | the e43 row now cites the Decision section of the archived E43 review report (path confirmed to exist; its Decision heading records the fencing rejection) instead of the backlog row. |
| cap-rule ownership | the lean cap rule comment, the design-arm floor comment and the spec intro now say raises are qa-owned unless noted sr-owned. |
| coordinator bundle comment | dropped the causal "so"; restored the base meaning ("injected on every dispatch; the full coordinator bundle is the worst case"; the coordinator "must keep the full section 3.2" on a design feature). |
| conditional-load header | restored the reconcile-rule carve-out in plain words (section 3.2 minus the reconcile rule, plus the section 3.1 visual bullets), same line count. |
| dangling label | removed the "Cap history by ticket:" line. |
| fixture paragraph | the hermetic-baseline paragraph now names `content/skill-release-engineer.md` for "that file". |
| this file | the directive narrowing is attributed to T-E260I-06; the "Rationale moved" list now includes the file-header map, lean, omitConstitution, hook isolation, design-arm, coordinator and skill cap histories. |

Test files: comments only; new lines wrapped to 100 columns or fewer.

Proof (`node .current/e260i/proof.mjs`): scope ok, emit 2/0 differ, leaves 2/0 differ, >20: 0, 8-20: 0, bare-id 0, directives, form, hygiene, width, reflow, pinned ok, `proof: PASS`.

Targeted tests (context-budget, render-structure, e122): 76 tests, 76 pass, 0 fail.

Full suite on the clean fix commit via the test lock: tests 3043, pass 3040, fail 0, cancelled 0, skipped 3.
