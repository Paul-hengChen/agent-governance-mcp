# e260h comment rationale

Rationale moved out of long comment blocks in the `test/` files whose names start with m to z (`test/render-structure.test.mjs` excluded) and in the four `.mjs` files under `test/eval/`, by lane e260h of ticket E260 (spec: `specs/e260h-test-m-z-eval-comment-trim.md`). A trimmed comment keeps at most one pointer line, for example `// Rationale: specs/e260h-comment-rationale.md (test/verify-release.test.mjs).`, and the text it points to lives in the section named after its test file below.

Rationale that a tracked spec already holds is not copied here; the comment points to that spec instead. Only comments moved: no assertion, test name, assertion message or string changed.

## Retained blocks

Blocks of 8 to 20 counted lines that stay in the tests, each with a one-line reason (acceptance criterion AC5). The code-reviewer copies each reason into the review report of the task that owns the file. `line at HEAD` is the block's first physical line as printed by `node .current/e260h/proof.mjs --list-mid`; `counted` is the size `analyzeText` reports.

| file | line at HEAD | counted | reason |
|---|---|---|---|
| — | — | — | none yet: rows are added by the trim tasks |

## test/release-staging.test.mjs

The release-engineer SOP has no server enforcement: the contract is the SOP wording reaching a low-tier agent, so this file pins that wording. Spec-to-test map at the time of the trim:

- explicit directory enumeration (AC1): the AC1 git-add-line test.
- pre-commit `git diff --cached --stat` (AC2): the AC2 verify-command test and fixtures A and B.
- inverted failure-mode wording, where source dirs are expected rather than blocked (AC3): the AC3 wording test.
- post-commit spec-file check and its conditional branches (AC4, backlog row E44, later range-corrected by E142(b) with a fourth MULTI-FEATURE branch): the AC4 test, fixtures C to K and the branch-exhaustiveness test.
- shim reinforcement hint of at most two sentences (AC5): the AC5 shim test.
- the file exercises its own fixtures (AC6); `npm test` green (AC7); version 3.22.1 (AC8, AC9) lives in `test/subagent-templates.test.mjs`.
- step 7a ticket-code set derivation (backlog row E49): the "E49 step 7a" block.

The step 7a derivation changed twice in review: first slug-hunting over commit prose, then committed history with `--diff-filter=A` (silently empty on two of the six releases checked), and finally an enumeration of the working tree with the git range used only as a membership predicate. The tests couple the derived set to the file content that shipped, not to substring presence.

`FEATURE_DIRS` history: `gates/` was added when `tsconfig.json` `include` gained `gates/**/*.ts`, because the AC-B5.5 guard is a set difference between `include` and this array. `docs/`, `research/` and `multi-agent-scripts/` were missing from the git-add line and the AC2 cross-reference set at cut time; `.github/` was missed because the `ls -d */` measurement used at the time hides dot-directories. None of the four are TypeScript roots, so repairing `include` (the `gates/` fix) cannot cover them, and none belong in `NON_SOURCE_DIRS`, since all four are tracked and feature-touchable.

Root-file completeness check (backlog row E94): `git status --short` was rejected in review because it also prints already-staged paths (`M ` against ` M`), so it fires the same way on a correct release and on the escape. The two adopted commands are a `git diff --name-only` of tracked unstaged files and an `ls-files --others` of untracked files, both excluding `.current`; the test extracts them from the SOP rather than holding a second copy, so a wording edit is exercised.

`release-engineer:Blocked` reachability (backlog row E53): before the fix, step 7a's empty-baseline guard and every Escalation Routes row told release-engineer to write `status=Blocked`, yet `tools/transitions.ts` had no such key and no edge into it, so the server would reject the write. The SOP also carried two claims that this was by design. E53 opened the edge, deleted both claims and turned step 7a's guard into a real Escalation Routes row; the D10 and release self-check rows were already pinned elsewhere, so this block covers the remaining rows only.
