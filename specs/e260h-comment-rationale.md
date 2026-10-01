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

Dependency-audit waiver escape (backlog rows E57, E59, E48): the escape was restated in slightly different words at 9 live sites across 3 files, and three review passes each derived a different site count (5, 6, 7) before an enumeration by site settled on 9. E48 later deleted `docs/skills/`, which was never on the prompt path (prompts are composed from `content/` only), removing 8 of the 9 sites; only one of those 8 was a verbatim mirror, the rest were structures the live SOPs never had. Re-deriving from the tree, not from the deletion count, found 3 live sites never pinned before: the dependency-audit disposition mechanism in `content/skill-release-engineer.md`. Net 9 to 4, not 9 to 1. Every historical escape phrasing used the verb form "waived"; the retained sentences use "waive" or "waiver", so the content-wide sweep for "waived" has no legitimate positives to exclude and also catches a fifth site nobody has listed yet. The per-site replacement-text check catches a site being deleted or truncated, which would not bring "waived" back.

Step 7a derivation rounds (backlog rows E49, E50):

- E49 round 1 hunted ticket slugs in commit messages; on v3.95.0 it yielded a set disjoint from the right one, because shipped tickets appear in the range only as bare codes.
- E49 round 2 used committed history only; it returned nothing on two of the last six releases because `qa_reports/` evidence is usually untracked when step 7a runs (step 8's `git add` first commits it), and an empty result was a silent no-op.
- E49 round 3 (approved) enumerates root-level `qa_reports/` files in the working tree and uses the git range only as a membership test against the previous tag's tree; it was backtested against six releases. It left one hazard open: an empty or unresolvable previous-tag baseline makes the `grep -vxFf` filter pass its whole input through.
- E50 round 1 guarded that hazard with one global flag, which wedged any workspace that never produced `review_reports/`, and its zero-match log expanded an unbound variable on every release.
- E50 round 2 (shipped) bound the variable, split the flag per tree (`STOP_QA`, `STOP_RR`, `EXCLUDE_QA`, `EXCLUDE_RR`), and extended the predicate to `review_reports/` under a parallel archive directory, since the two trees share basenames.

Move-loop asymmetry pin (backlog row E76): E76 rewrote step 7a's move loops into one heredoc block sharing a `for c in $CODES` loop, with the `review_reports` side wrapped in an enclosing `if`. The earlier predicates looked for a literal `<CODE>` placeholder and an inline `&&` guard, so they died before reaching the guard assertions and silently stopped pinning anything. The test was retargeted rather than retired; code-reviewer did not block on the asymmetry in either round, and fixing it is not QA's scope.
