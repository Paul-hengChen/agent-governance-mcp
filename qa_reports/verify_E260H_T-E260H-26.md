# E260H independent verification: detail (T-E260H-26)

covers: T-E260H-11, T-E260H-12, T-E260H-13, T-E260H-14, T-E260H-15, T-E260H-16, T-E260H-17, T-E260H-18, T-E260H-19, T-E260H-20, T-E260H-21, T-E260H-22, T-E260H-23, T-E260H-24, T-E260H-25, T-E260H-26

Verifier: fresh qa-engineer Task context (opus). This context wrote none of the lane's changes. The author evidence (`qa_reports/author_E260H_T-E260H-11-25.md`) and the reviewer's numbers (`review_reports/review_T-E260H-11.md`) were not used as inputs. Every figure below comes from a run in this context.
Worktree: `../agent-governance-mcp-lanes/e260h`, branch `feat/e260h-test-m-z-eval`, base `bdbffaf`. The suite ran at `be7be65`, a clean committed tree that adds only lane-state commits to the dispatch HEAD `3f3fc3c`. The gate-required AC Execution Log is in `qa_reports/review_T-E260H-26.md`. This file holds the detail behind it.

## 1. Proof script re-run
`node .current/e260h/proof.mjs --base bdbffaf` and the same command with `--list-mid` both printed the following and exited 0:
`base: bdbffaf, changed: 38 file(s)` / `scope: ok` / `emit: 38 files, 0 differ` / `leaves: 38 files, 0 differ` / `scanned: 47 file(s)` / `>20: 0` / `8-20: 0 block(s)` / `bare-id: 0` / `directives: ok` / `form: ok` / `hygiene: ok` / `proof: PASS`. `--list-mid` listed no blocks.

## 2. Can the script pass vacuously? Mutation probes
Each probe ran in a throwaway worktree at HEAD under `$TMPDIR`, with `node_modules` symlinked in. The probe was reverted with `git checkout -- .` before the next one, and the worktree was removed afterwards (`git worktree list` shows none left). Every probe was caught, and a failing run exits 1.

| probe | expected check | observed |
|---|---|---|
| M1 edit a string literal in `test/qa-flow.test.mjs` | emit, leaves | `proof: FAIL (emit, leaves)` |
| M2 append a 25-line `//` block | >20 | `>20: 1`, FAIL |
| M3 append `// E123` | bare-id | `bare-id: 1`, FAIL |
| M4 append a comment with a home-directory path and a hex sha | hygiene | 2 problems (home path, sha), FAIL |
| M5 add a comment to `test/render-structure.test.mjs` | scope | `M` path plus `forbidden` path, FAIL |
| M6 add an untracked `test/zz-new.test.mjs` | scope | `?? test/zz-new.test.mjs`, FAIL |
| M7 append `/* ## Heading */` | form | block opener 0 -> 1 and `##` heading, FAIL |
| M8 insert a new first line in `test/rag.test.mjs` | form | `first line changed`, FAIL |
| M9 rename one `const` identifier | emit, leaves | FAIL (emit, leaves) |
| M10 delete the `// eslint-disable-next-line` line in `test/qa-review-scoped-append.test.mjs` | directives | `directives: 1 problem(s)`, FAIL |
| exit-code probe (append `// E9`) | exit status | `exit-on-fail=1` |

## 3. Checks run outside the proof script
- **Every changed `test/` line is a comment.** `git diff -U0 bdbffaf..HEAD -- test` was filtered to `+`/`-` lines that are not blank and do not start with `//`, `/*`, `*` or `*/`. Nothing was left, so no code line and no trailing same-line comment changed. Net change under `test/`: +607 / -2229 lines.
- **Directive comments.** A grep for the AC8 directive set, base blob against HEAD, over all 38 changed files: identical in every file.
- **Block sizes.** I ran my own `analyzeText` scan (from `dist/tools/comment-scan.js`) over the AC3-owned files, read with `git ls-tree`/`git show`:
  - base `bdbffaf`: 47 files, 38 with a long block, 117 blocks of 8–20 lines, 30 blocks over 20, longest 134. This matches the spec's base measurement exactly.
  - HEAD: 47 files, 0 blocks of 8–20, 0 over 20, largest block 7 counted lines.
- **Scope (AC3).** `git diff --name-status bdbffaf..HEAD` shows 38 `M` owned `test/` files. Everything else is an `A` under `specs/e260h-*`, `.current/e260h/**`, `qa_reports/*E260H*` or `review_reports/*E260H*`. No `test/` file was added, deleted or renamed. `git diff --stat bdbffaf..HEAD` over `test/render-structure.test.mjs`, `test/eval/fixtures`, `test/fixtures`, `test/context-budget.test.mjs`, `dist`, `content`, `tools`, `gates` and `prompts` is empty.

## 4. AC6 pointers and rationale spec
- `node scripts/check-md-tables.mjs` exits 0: 474 files, 0 malformed tables, and 5 advisory notes, all in `docs/backlog.md` and unrelated to this lane.
- 20 distinct `specs/e260h-comment-rationale.md (test/<file>)` pointer targets appear in owned files. Each has a matching `## test/<file>` section, and each pointer names its own host file.
- One section has no pointer: `## test/qa-flow.test.mjs` (see finding F2).
- I extracted the tracked paths cited in added comment lines (91 unique) and in the rationale spec, and all of them exist except:
  - `bin/gh`: a substring of `/usr/bin/gh`, not a path claim.
  - `docs/skills`: correctly described as deleted by E48.
  - `content/skill-coordinator.md`: carried over unchanged from base in `test/subagent-templates.test.mjs`. The template it describes still references that file. It is already filed as pending ticket E260H-NEW-1 in `.current/e260h/pending-tickets.md`.

## 5. AC7 and task-id-only comments (integrator check 2)
- The proof's `BARE_ID` regex covers `E`, `AC` and `DR` ids but not `T-<id>` task ids. This is confirmed by reading `.current/e260h/proof.mjs` and is a guard gap in the tool (F3), not a defect in the lane's output.
- I grepped the 47 owned files at HEAD by hand:
  - Comment lines whose whole content is a `T-` id: none.
  - Comment lines made only of id tokens of any family: none.
  - Comment lines that start with a `T-` id: 4. `test/qa-flow.test.mjs:41` and `:2403` read `(T-E53-03(h), T-QA-E128-01...)` and close a multi-sentence plain-language block. `test/qa-flow.test.mjs:2116` and `test/p0-onboarding-lite-default.test.mjs:60` continue a sentence. All four are trailing pointers after plain words, which AC7 allows.
  - Added comment lines containing a `T-` id: none. Every `T-` id in the trimmed comments was there at base.

## 6. Semantic accuracy sample (integrator check 1)
I checked the rewritten sentences against the code they describe:

| file | claim | verified against | result |
|---|---|---|---|
| `test/qa-flow.test.mjs` | Blocked self-loop is "step 3", an explicit pair, not a same-status wildcard | `tools/transitions.ts` step 3 | accurate |
| `test/qa-flow.test.mjs` | resume edge opens via the structured `next_resume_of` field | `tools/transitions.ts` `TransitionRequest.next_resume_of`, orchestrator mapping from `resume_of` | accurate |
| `test/qa-flow.test.mjs` | 1056 tuples; 76 = 69 + 7 | assertions at the test | accurate |
| `test/qa-visual-skill-split.test.mjs` | caps 17900 and 20700 bytes | asserted literals | accurate |
| `test/eval/run-eval.mjs` | checks the API key before any import | `ENV_KEY` check precedes the dynamic imports | accurate |
| `test/schema-versions.test.mjs`, `test/skill-evolution-v3.11.test.mjs` | handoff 15, sqlite 2, tasks 2, config v2 adds optional `artifacts` | `schema/versions.ts`, `schema/migrations-config.ts` | accurate |
| `test/skill-frontmatter.test.mjs` | 12 skill files, 12 -> 11 -> 12 | `ls content/skill-*.md` = 12, assertion = 12 | accurate |
| `test/telemetry.test.mjs` | `.current/` real dir, only `.current/_primary` a file | fixture code | accurate |
| `test/verify-release.test.mjs` | default budget 480s; gh-less PATH built from the runner's own PATH | `DEFAULT_WAIT_SECONDS = 480`; `noGhSystemPath()` symlinks `git` and `cat` resolved from PATH | accurate |
| `test/subagent-templates.test.mjs` | lite skill sonnet, lite template haiku | frontmatter of both files | accurate |
| `test/pixel-gate-attestation.test.mjs` header | "verbatim error strings in dist/index.js (E)" | the E-block reads `dist/tools/handoff-orchestrator.js` and `dist/gates/registry.js` | **stale location** (F1) |
| `specs/e260h-comment-rationale.md`, verify-release section | the no-gh PATH story and the VR-11/12 retarget | test code and the base comment | accurate in substance |

## Findings (none blocks PASS under the qa-engineer scope rule; all are surfaced for code-reviewer or PM)
- **F1, minor, semantic, inherited.** The rewritten header of `test/pixel-gate-attestation.test.mjs` (line 5) still says the E tests check verbatim error strings "in dist/index.js". The test actually reads `dist/tools/handoff-orchestrator.js` and `dist/gates/registry.js`, and the file's own comment at lines 624–627 says so. The base header said the same, so the trim carried a stale claim forward rather than creating one. This is the "kept a wrong location" pattern the integrator saw in lane e260e. It is a one-line comment fix, owned by qa-engineer under `test/`, and should be ticketed or folded into a follow-up. I did not edit it: I am the verifier, not an author.
- **F2, minor, AC6 findability.** `specs/e260h-comment-rationale.md` has a `## test/qa-flow.test.mjs` section with two points it says are "not held" in the cited specs: the design-auditor-after-PASS observation and the E45 research note. No comment in `test/qa-flow.test.mjs` points to that section. The reviewer accepted this because the comments cite tracked specs. AC6's literal text ("at most one pointer line") is met, but those two points cannot be found from the test. Suggested fix: add one pointer line to the two relevant section comments in a follow-up.
- **F3, tooling gap, no output defect.** The `BARE_ID` regex in `.current/e260h/proof.mjs` does not match `T-<id>` task ids, so a comment like `// T-E123A3-08` would pass the script. The hand grep in section 5 found no such comment in the owned files. Future lanes that reuse this script should widen the regex.
- Already filed, no new action: the `content/skill-coordinator.md` mapping in `test/subagent-templates.test.mjs` (E260H-NEW-1).

## Hygiene of this evidence
This file and `qa_reports/review_T-E260H-26.md` name no absolute local path. Temporary worktrees are referred to as "under `$TMPDIR`", and the lane worktree as `../agent-governance-mcp-lanes/e260h`.
