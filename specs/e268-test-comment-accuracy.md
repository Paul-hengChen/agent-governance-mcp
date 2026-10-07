# e268-test-comment-accuracy

Lane `e268` of the E260 follow-up fan-out (`specs/fanout-e260-followups.md`). Tickets E268, E270, E271, E272, E273 (all P3). Task ids `T-E268-NN`. Base commit `f1e6eb1`. Pure test lane: only qa-engineer edits `test/**` (Constitution section 2); there is no sr-engineer hop.

## Problem Statement
The E260 comment trim left a handful of test and rationale-spec comments that state something untrue about the code they describe: a "no flat fallback" claim the code contradicts, pointers to files that do not exist or have moved, a wrong count, one ruler a character off, one over-wide line. One expected-reference table (`test/subagent-templates.test.mjs`) maps the `teamwork` template to a coordinator file that no longer exists on disk. Each is small; together they leave readers following dead pointers. This lane corrects them without changing what any test asserts (E272 excepted, where the table is code).

## User Stories
- As a maintainer following a test comment, I want every file, function and count it names to be real, so that I do not chase a dead pointer.
- As a reviewer, I want a mechanical proof that only comments changed, so that I can approve without re-reading assertions.
- As a future editor of the `teamwork` subagent template, I want its test to check it against something that exists, so that the check protects me instead of misleading me.

## Acceptance Criteria
All commands run from the lane worktree root. `BASE` = `f1e6eb1` (the proof script reads `.current/e268/base-sha`). "Comment-only" files: every file below except, if the E272 decision changes the table, `test/subagent-templates.test.mjs`.

Evidence below was verified by the PM at BASE (line numbers are BASE lines).

### E268
- **AC1 (drift-skew, claim fixed)**: Given `test/drift-skew.test.mjs`, when the comments at `:35-40` and `:171-172` are read, then neither says the skew precheck lacks a flat fallback. Evidence: the code is `readArtifactVersion` in `tools/drift.ts:219-228`, which reads the lane path and falls back to `resolveFlatLanePaths(abs).handoffPath` when the lane file is absent; the same test file's AC8 test (`:208`) and comment (`:203`) already say so, and `:68` says "precheck falls back lane-then-flat". The corrected text keeps the part that is true: the fixture helper writes at the lane path, which is what makes the precheck see an already-migrated workspace. While editing the same sentence, the function name `readOnDiskVersion` and line `tools/drift.ts:248` at `:35` are also wrong (the function is `readArtifactVersion`; cite the name, not a line) and `NEW-TICKETS.md J2-NEW-9` at `:40` points at a retired file: fix or drop these in the same edit, comment text only.
  proof: `grep -nE "no (lane-then-)?flat (path )?fallback|no flat fallback" test/drift-skew.test.mjs` prints nothing, and `node .current/e268/proof.mjs` prints `emit: <N> files, 0 differ`.
- **AC2 (e73 report pointer)**: Given `specs/e260e-comment-rationale.md:50`, when the path of the expected-red manifest is read, then it is `qa_reports/archive/e73-agc-feature-lifecycle/expected-red_e73-agc-feature-lifecycle.txt` and that file exists. Evidence: at BASE the file is at that archive path (`ls qa_reports/archive/e73-agc-feature-lifecycle/`) and not at the `qa_reports/` root.
  proof: `test -f qa_reports/archive/e73-agc-feature-lifecycle/expected-red_e73-agc-feature-lifecycle.txt && grep -c "qa_reports/archive/e73-agc-feature-lifecycle/expected-red_e73" specs/e260e-comment-rationale.md` prints `1`; `node scripts/check-md-tables.mjs` exits 0 after commit.
- **AC3 (agc-adapters dead pointer)**: Given `test/agc-adapters.test.mjs:5` ("Spec-to-Test map lives in qa_reports/review_T-TESTS.md"), when read, then it names no non-existent file. Evidence: no `review_T-TESTS.md` exists at `qa_reports/`, `qa_reports/archive/**`, or `review_reports/**` at BASE; the only trace in history is the repository-reset commit. The spec the file already cites on `:2` exists (`specs/agc-cross-agent-adapter-scaffolding.md`). Decision (PM): drop the sentence; do not invent a replacement map. If qa finds a real report holding the map, repointing to it is equally acceptable.
  proof: `grep -n "review_T-TESTS" test/agc-adapters.test.mjs` prints nothing; every path-like token in the file's first 8 comment lines resolves with `test -e`.

### E270
- **AC4 (e22 header pointer)**: Given `test/e22-stale-notify.test.mjs:3`, when read, then it says `notifyStaleDispatch` is wired by `tools/handoff-parse.ts`. Evidence: the import is `tools/handoff-parse.ts:15`, the call `:734`.
  proof: `sed -n 1,5p test/e22-stale-notify.test.mjs | grep -c "tools/handoff-parse.ts"` prints `1`.
- **AC5 (the other two `tools/handoff.ts` mentions are the same class of error; fix them)**: Given `:398` ("`getConfigError()`, which `tools/handoff.ts` spreads onto the envelope as `config_error`") and `:494` ("The Crash-Resume pointer appended to `stale_dispatch.message` (`tools/handoff.ts`)"), when checked against source, then both describe code that lives in `tools/handoff-parse.ts` (`config_error` spread at `:583` and `:745`; the Crash-Resume message built at `:718-727`), so both are changed to `tools/handoff-parse.ts`. `tools/handoff.ts` is only a re-export seam after the E36 split. The spec records this finding.
  proof: `grep -n "tools/handoff\.ts" test/e22-stale-notify.test.mjs` prints nothing.

### E271
- **AC6 (gates-expected-red header)**: Given `test/gates-expected-red.test.mjs:3`, when read, then it says `U1-U13`. Evidence: `U13` is the test at `:153`.
  proof: `sed -n 3p test/gates-expected-red.test.mjs | grep -c "U1-U13"` prints `1`.
- **AC7 (e260g e5 section)**: Given the `## test/e5-intake-tiering.test.mjs` section of `specs/e260g-comment-rationale.md`, when the const-08 bullet is read, then its count equals the number of quoted phrases. Evidence: the section says "the five `T-E5-02 content: const-08 ...` tests" and quotes four phrases ("trust rule", "SAME write", "HALTs exactly as today", "opt-in ... and advisory"); the file has five const-08 tests (`:260, :274, :287, :295, :308`) and the unquoted one is the defaults test at `:308` ("documents the conservative per-field defaults"). Fix by adding that fifth phrase; the count "five" stays. The section's other counts are not touched.
  proof: `grep -c "documents the conservative per-field defaults" specs/e260g-comment-rationale.md` prints `1`; `node scripts/check-md-tables.mjs` exits 0.
- **AC8 (e92-e86 ruler)**: Given `test/e92-e86-handoff-write-boundary.test.mjs:363` and `:366` (the two rulers framing one banner), when measured, then they have the same width. Evidence at BASE: `:363` is 77 characters and `:366` is 78. qa matches the closing ruler `:366` to the opening `:363`'s width unless the file's other banner pairs dictate the other direction (both widths occur in the file; only equality within the pair is required).
  proof: `awk 'NR==363||NR==366{print length}' test/e92-e86-handoff-write-boundary.test.mjs | uniq | wc -l` prints `1`.
- **AC9 (lane-ticket-allocation line 4)**: Given `test/lane-ticket-allocation.test.mjs:4` (comment, 133 characters wide), when rewrapped, then no line of that comment block exceeds 118 characters and the words are unchanged. Evidence: the neighbouring comment lines are at most 118 wide; `:4` is 133. Only the comment lines of the block containing `:4` are rewrapped.
  proof: `sed -n 1,6p test/lane-ticket-allocation.test.mjs | awk '{ if (length>118) bad=1 } END{ exit bad }'; echo "exit=$?"` prints `exit=0`.

### E273
- **AC10 (pixel-gate header)**: Given `test/pixel-gate-attestation.test.mjs:5`, when read, then the verbatim error strings (E) are said to be read from `dist/tools/handoff-orchestrator.js` and `dist/gates/registry.js`, not `dist/index.js`. The comment at `:622` ("E1-E5: ... (dist/index.js)") is the same wrong location and is fixed alike. Test names and assertion messages that contain `dist/index.js` (`:642`, `:647`, `:683`, `:689`) are string literals and are NOT touched.
  proof: `sed -n 5p test/pixel-gate-attestation.test.mjs | grep -c "dist/index.js"` prints `0`, and `node .current/e268/proof.mjs` shows `emit: ... 0 differ`.
- **AC11 (qa-flow pointer)**: Given `test/qa-flow.test.mjs`, when its header is read, then one added comment line points to `specs/e260h-comment-rationale.md` (section `## test/qa-flow.test.mjs`, which holds two points no other spec records). No other line changes.
  proof: `grep -c "e260h-comment-rationale" test/qa-flow.test.mjs` prints `1`.

### E272 (needs a human decision; see below)
- **AC12 (table and comments agree with reality)**: Given `test/subagent-templates.test.mjs:20-72`, when the comments and the `ROLE_TO_SKILL` / `FILE_PATH_DELEGATES` entries for `teamwork` are read, then no comment calls a file "retired" that is still the live composition key, and no comment implies `content/skill-coordinator.md` exists on disk. Facts verified at BASE: `content/skill-coordinator.md` does not exist (only `content/coord-01..07-*.md`); but `skill-coordinator.md` is still the logical key of `SKILL_SEGMENTS` (`prompts/skill-manifest.ts:27`), used by `prompts/coordinator.ts:7`, `tools/registry.ts:897` and `bin/agent-governance-context.mjs:123`, and the test's `readSkillFile` already composes it through `composeSkill` (so the tier and Auto-Routing assertions at `:45-125` work and need no change). The only thing that is stale is the `teamwork` template text itself (`templates/claude-code-agents/teamwork.md:9`), which tells the subagent to read `content/skill-coordinator.md` via the Read tool, a path that does not exist. `templates/**` is outside this lane. The exact edit depends on the option chosen below.
  proof: `node scripts/test-lock.mjs -- node --test test/subagent-templates.test.mjs` exits 0; the reviewer reads the diff of `:20-72` against the chosen option.

### Lane-wide
- **AC13 (emit unchanged for comment-only files)**: Given every comment-only file above, when the BASE blob and the working file are each transpiled with TypeScript `transpileModule` (`removeComments: true`, ESNext), then the outputs are byte-identical. This proves no string, test name, assertion message or file name changed.
  proof: `node .current/e268/proof.mjs` prints `emit: <N> files, 0 differ` (add `--e272-code` if the E272 choice changes table code; that file is then reviewed by hand).
- **AC14 (scope)**: Given the lane diff against BASE, when listed, then every changed `test/` path is one of the nine owned files and is modified (none added or deleted), and nothing else changed except `specs/e260e|g|h-comment-rationale.md`, `specs/e268-*`, `qa_reports/*E268*`, `review_reports/*E268*`, `.current/e268/**`.
  proof: `node .current/e268/proof.mjs` prints `scope: ok`.
- **AC15 (new-text hygiene)**: Given the lines added by the lane, when scanned, then none contains an absolute local path, a 40-character sha, `git show` or `git log`. Task evidence uses `../agent-governance-mcp-lanes/e268` or a category description, never the worktree's absolute path.
  proof: `node .current/e268/proof.mjs` prints `hygiene: ok`.
- **AC16 (no test added, removed or renamed; suite green on a clean committed tree)**: Given the final HEAD with `git status --porcelain` empty, when the full suite runs, then it exits 0 and the pass/skip/fail counts equal a BASE run recorded by qa.
  proof: `git status --porcelain | wc -l` prints `0`, then `node scripts/test-lock.mjs -- npm test; echo "exit=$?"` ends with `exit=0`.
- **AC17 (negative control)**: Given the proof script, when a copy of one owned file OUTSIDE the worktree has one string literal changed and the script's emit comparison is pointed at it, then it reports a difference. Done on a copy; never `git stash`.
  proof: the qa evidence records the copy's path category, the changed literal, and the `DIFFERS:` output.

## E272 decision
What the `teamwork` template should be checked against today. Facts: see AC12.

| option | change | pros | cons |
|---|---|---|---|
| **1 (recommended)** | Comment-only. Keep `"teamwork": "skill-coordinator.md"` (it is the live logical key and what `composeSkill` resolves); rewrite the comments at `:20-72` to say it is a logical name composed from `content/coord-01..07-*.md` by `SKILL_SEGMENTS`, not a file. Leave the `FILE_PATH_DELEGATES.teamwork` regex as is, with a comment that it pins the template's current text. Open a pending-ticket (`E268-NEW-1`) to fix the template's dead path (an sr-engineer edit in `templates/**`, outside this lane) and tighten the regex in the same change. | Stays inside the lane's boundaries; no assertion change; the tier and Auto-Routing checks keep working; the real defect (the template) is tracked, not hidden. | The regex still asserts the dead path until the template ticket lands. |
| 2 | Option 1 plus widen the regex so it also accepts a `content/coord-NN-` fragment path or `prompts/skill-manifest.ts`. | The test accepts both the current and a fixed template; no red when the template ticket lands. | Weakens the assertion (accepts the dead path too); is an assertion change on a table whose point is to catch drift. |
| 3 | Require the template to name `prompts/skill-manifest.ts` or the `coord-NN` fragments now. | Tests the right thing. | Red immediately: needs a `templates/**` edit this lane may not make, so it forces a re-cut of the lane's boundaries and a build role. |

PM recommendation: option 1, with the template fix ticketed. The ticket's "table and its comments change together" is satisfied because the table entry is already correct as a logical key and only its comments are wrong; if the human wants the table text itself to change, option 2 is the smallest such change.

## Copy / Strings
| string id | exact text (quote verbatim) | source |
|---|---|---|
| N/A | — | no user-facing string is introduced or changed; string literals are out of scope |

## Visual Tokens
| token id | property | value (quote verbatim) | source |
|---|---|---|---|
| N/A | — | — | feature has no visual literals |

## Visual Widgets
| widget id | description | source-node |
|---|---|---|
| N/A | — | feature has no non-primitive widgets |

## Out of Scope
- The E271 proof-script gap (range-form bare ids, whitespace-only reflow): left for a future comment-trim proof script, per the ticket.
- Assertions, test names, assertion messages, string literals and file names (E272 table excepted).
- The `teamwork` template itself (`templates/**`) and its dead path; tracked as `E268-NEW-1` in `.current/e268/pending-tickets.md`.
- Every other `test/**` file (incl. `test/context-budget.test.mjs`, `test/fixtures/**`), all source directories, `dist/**`, `content/**`, `scripts/**`, other `specs/**`, `docs/**`, `CHANGELOG.md`, `package.json`, `CLAUDE.md`, `AGENTS.md`, `.antigravityrules`, `.current/history/**`, `gates/registry.ts`, `test/error-code-contract.test.mjs`.
- Release bookkeeping (version, CHANGELOG, backlog done-marks): release-engineer and the integrator.

## Dependencies / Prerequisites
- E260 shipped (v4.4.1). No dependency on lanes e269 and e264 (files are disjoint); merge order in the fan-out manifest is e269, e264, e268.
- The E272 option is chosen by the human at cut approval.
- `dist/` is built in the worktree (tests import `dist/`); no source changes are made, so `dist/` is not rebuilt or committed.
- Design: no `design/<feature>.md`, mode = no-design (Visual Structural Assertions omitted).
- External refs: none.

## Chain plan
Per E233/E260 precedent, a pure test lane with no build role:
1. pm writes this spec and tasks, `pm:In_Progress`, `next_role: qa-engineer`.
2. qa-engineer authoring hop (single-role judge-dispatch charter, `resume_of: qa-engineer`): edits the files above, runs `.current/e268/proof.mjs`, commits, writes `qa-engineer:Blocked` ("authoring complete", not a failure).
3. pm reads it and routes to code-reviewer (`resume_of: code-reviewer`).
4. code-reviewer (fresh Task): adversarial diff review, `review_verdict`.
5. qa-engineer `In_Progress`, then a fresh Task-dispatched qa verifier runs the full suite on the final committed HEAD and writes `PASS`.
6. The integrator merges; release-engineer / integrator do done-marks.

## Task list
| id | ticket | owner | description | depends_on |
|---|---|---|---|---|
| T-E268-01 | E268 | qa-engineer | drift-skew two comments (+ stale function name/line, retired file ref), e260e spec e73 archive path, agc-adapters dead pointer (AC1-AC3) | none |
| T-E268-02 | E270 | qa-engineer | e22-stale-notify `:3`, `:398`, `:494` to `tools/handoff-parse.ts` (AC4-AC5) | none |
| T-E268-03 | E271 | qa-engineer | gates-expected-red U1-U13, e260g e5 fifth phrase, e92-e86 ruler, lane-ticket-allocation rewrap (AC6-AC9) | none |
| T-E268-04 | E273 | qa-engineer | pixel-gate-attestation header and `:622`, qa-flow pointer to e260h rationale (AC10-AC11) | none |
| T-E268-05 | E272 | qa-engineer | subagent-templates table comments per the chosen option; write `E268-NEW-1` pending ticket for the template path (AC12) | human decision |
| T-E268-06 | all | qa-engineer | run proof script, negative control on a copy, commit; then fresh-verifier full suite on clean HEAD (AC13-AC17) | T-E268-01..05 |
