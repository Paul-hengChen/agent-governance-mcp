# Review — T-E260A-01

covers: T-E260A-01, T-E260A-02, T-E260A-03, T-E260A-04, T-E260A-05, T-E260A-06, T-E260A-07, T-E260A-08, T-E260A-09, T-E260A-11, T-E260A-12

## Round 1 — APPROVED — by code-reviewer

Range reviewed: `b37178a..306468d` on `feat/e260a-tools-a-h`. T-E260A-10 is voided and was not reviewed. Inputs: the diff, `specs/e260a-tools-a-h.md`, `specs/e260a-tools-a-h-rationale.md`, and `specs/fanout-e260.md` (the sections on rules shared by every lane and on tests that pin source comments). No architecture spec exists; the PM spec says no architect hop is needed. The reviewer runs on a different model tier (opus) from the sr-engineer (fable), so same-model bias is unlikely.

## Summary
- The lane trims comments only, in 15 of the 25 `tools/[a-h]*.ts` files. It removes 82 blocks of 8–20 counted lines and 14 blocks of more than 20, so the longest block is now 7 lines. Moved rationale sits under 18 headings in `specs/e260a-tools-a-h-rationale.md`, and the keep table is empty. The matching `dist/tools/[a-h]*` files were rebuilt and committed.
- I checked independently that the change is comment-only, with a check stronger than the lane's own script. Every changed file's TypeScript AST leaf-token stream, including type annotations and with JSDoc nodes excluded, is identical at base and HEAD. JSDoc counts per file are unchanged.
- Both lane scripts work as claimed. I found two coverage gaps, but my own checks show neither hides a defect here (details under Quality).
- The trims keep what callers need to know. Every pointer resolves. The test-pinned strings and the caller-token counts are intact, and the 12 test files that pin source text pass.
- Verdict: APPROVED. Four non-blocking findings are recorded (header first sentences, script coverage, a task-partition edit in the T-09 commit, and comment-ratio advisories).

## AC Completeness
AC1 — implemented — `node .current/e260a/measure.mjs --rev b37178a` prints `TOTAL files=25 with-long=15 mid=82 big=14 longest=52` (re-run by reviewer).
AC2 — implemented — `measure.mjs --check` exits 0, and the HEAD totals line reads `mid=0 big=0 longest=7`.
AC3 — implemented — `measure check OK: 0 kept blocks`. The keep table in the rationale file is empty, so there are no kept rows to copy. Kept-block list for this report: none.
AC4 — implemented — `prove-neutral.mjs` prints `neutral OK: 15 files`. The script really transpiles both sides with `removeComments: true` (`.current/e260a/prove-neutral.mjs`, `transpile` helper; the base text comes from `git show <base>:<f>`, HEAD from the working tree). The reviewer's AST-leaf comparison also reports SAME for all 15 files; unlike transpile output, it also covers type-only syntax.
AC5 — implemented — no `OUT-OF-SCOPE` line. The scope list combines `git diff --name-only <base>` (working tree against base, staged and unstaged) with `git ls-files --others --exclude-standard`, so every changed or new path is covered. Non-dist paths changed: 15 `tools/*.ts`, two `specs/e260a-*`, four `.current/e260a/*`.
AC6 — implemented — no `STYLE` or `MARKER` line. `/*` openers are counted from parser comment trivia, so strings and regexes are ignored. `tools/dispatch-log.ts` has no block comments. JSDoc counts per file match base (reviewer check, for example fanout-manifest 46/46 and feature-rollup 14/14), so no JSDoc was turned into `//`.
AC7 — implemented — no `PIN-MISSING`, `NEW-TOKEN` or `TOKEN-COUNT` line. Verified by hand as well: `tools/handoff.ts` still contains `@deprecated v3.15.0:`, `options-object overload` and `removal in v4.0.0`. `tools/feature-rollup.ts:58` keeps `SEAM FOR E132`. The `PROMPT_TEMPLATE_3B` JSDoc still holds its three required substrings, and the file has no `commands/integrator`. The per-file counts of `lane-paths`, `resolveLanePaths`, `resolveCurrentLane`, `migrateFlatToLane(`, `migrateLaneToFlat(` and `migrateFlatToLaneLocked` match base in every changed file. For example, the `tools/lane-paths.ts` mention in the `tools/gate-stats.ts` header survived. The pinning tests (writestate-options-object, feature-rollup, e178a-integrator-role, lane-paths, dispatch-log, ac-execution, gates-expected-red, visual-evidence-gate, source-credibility-gate, cut-approval-gate, error-code-contract, e35-pipeline-order) give 293 pass, 0 fail, 1 skipped.
AC8 — implemented — `citations OK`. I read well over 20 trimmed comments by eye and found no ticket-id-only line. That script skips trailing comments on code lines; a separate scan found one such comment with a ticket id, `tools/gate-stats.ts:355` (`non-string → null (E12 normalization)`), which already pairs the id with plain words.
AC9 — implemented — 20 `Why:` pointer lines in `tools/` name 18 headings, and every heading exists in `specs/e260a-tools-a-h-rationale.md`. Every file path cited in the rationale exists. History narrative ("round 2", "the D8 incident", version tags, "measured 34ms") was dropped, not moved.
AC10 — implemented — `grep -nE '^\s*(//|\*)\s*##' tools/[a-h]*.ts` prints nothing. Every JSDoc block the diff touched opens with a one-sentence summary of at most 80 columns (`writeHandoffState`, `featureHistory`, `LaneListProvider`, `resolveWorktree`, `resolveMailboxHeader`, `unmatchedOwnedTokens`). Several `//` module headers open with a longer first sentence; see Quality, finding Q1 (recommended).
AC11 — implemented — the reviewer ran `npm run build` and `git status --porcelain` lists only the reviewer's own `.current/e260a` state files. No dist drift.
AC12 — implemented — `agc check` prints no comments warning naming `.current/e260a/`. `grep -nE '/(Users|home)/' .current/e260a/*.mjs` prints nothing.
AC13 — implemented (pending QA re-run) — the full suite on the final HEAD belongs to QA. The reviewer ran the 12 pinning test files only (0 failures).
AC14 — implemented — the AC14 grep over added lines in `tools` and the rationale file prints nothing. No usernames, internal links or codenames were added. Function, file and config-key names are kept.

## Correctness
No findings. The AST-leaf equality across all 15 changed files proves that no code, type or literal changed. The meaning checks found no comment that lost a caller-facing constraint or pitfall without its reason moving. The following were checked one by one:
- Every gate-step comment in `tools/handoff-orchestrator.ts` keeps its edge, its arming condition, its file-mode limit and its "never reorder or re-indent" warning. Reasons that no longer fit (stamp-provenance before lease, the lease's `pending_notes` file-mode limit, the strict non-set-difference rule, no fallback when the target is empty, the no-exemption reasons) moved under the matching headings.
- In `tools/handoff-write.ts` and `tools/handoff-types.ts`, each field-lifetime rule (always kept, feature-scoped with re-arm, feature-scoped without re-arm, one write only) is still stated at the field. The full reasoning, including the inverse polarity of `external_refs`, moved to "tools/handoff-write.ts — field lifetimes". The archive-name clamp keeps its ENAMETOOLONG hazard in the comment, and the byte budget moved to the rationale file.
- The `tools/evidence-lookup.ts` verdict rule (last verdict PASS, or no verdict section) stays in the header. The FAIL-record reasoning and the known gap moved.
- `tools/feature-rollup.ts` keeps "carried, never dropped or zero-filled" and the "ROLL-UP INCOMPLETE" banner, plus the stderr-capture reason at the call site.
- The cross-task edit noted in the T-09 commit (ba33f83) changes only the `featureHistory` JSDoc in `tools/feature-rollup.ts`. The T-08 commit had already removed `(E132)` there, and T-09 split the opener into a short summary. Comment-only, meaning preserved.

## Quality
- **Q1 (recommended)**: several `//` module headers open with a first sentence longer than 80 columns. Examples: `tools/fanout-manifest.ts:2-4` (one sentence across three lines), `tools/gate-stats.ts:2-4`, `tools/dispatch-log.ts:2-4`, `tools/exemptions.ts:2-3`, `tools/handoff-types.ts:2-4`, `tools/handoff.ts:2-4`. Whether a `//` module header counts as a "doc comment" is a judgment call, and the style rule forbids turning these into JSDoc. All JSDoc meets the rule, so this does not block. A later pass could end each header's first sentence within one line.
- **Q2 (optional, script coverage)**: `prove-neutral.mjs` compares `transpileModule` output, which drops type annotations, interfaces and type aliases. A type-only edit, for example in `tools/handoff-types.ts`, would pass that check unseen. AC4 asks for exactly this method, and the reviewer's AST-leaf comparison found no such edit in this range. Later lanes could compare `createSourceFile` leaf tokens with JSDoc nodes excluded. Similarly, `measure.mjs --citations` checks only lines whose lexed kind is `comment`, so trailing comments on code lines are skipped. Checked by hand here, with no miss.
- **Q3 (optional)**: the T-09 commit edits `tools/feature-rollup.ts`, a T-08 file. That breaks the spec's "tasks partition the files" cut shape. The commit body says so, and the change is one JSDoc opener, so no action is needed.
- **Q4 (optional)**: the `Why:` pointer lines run past 100 columns, for example `tools/handoff-orchestrator.ts:146`. The spec prescribes this one-line pointer form, so they are accepted as written.
- Comment check (step 4b): `agc check` reports high-ratio warnings on six touched files: `tools/config.ts` 41.9%, `tools/dispatch-log.ts` 32.7%, `tools/evidence-lookup.ts` 34.7%, `tools/handoff-parse.ts` 35.8%, `tools/handoff-types.ts` 71.7% and `tools/handoff-write.ts` 42.5%. All six are kept. Reason: the E260 rules cap block length, not file ratio, and every ratio is down from base. The rest is short field and contract comments; `handoff-types.ts` is a type file whose fields carry their lifetime contracts.

## Architecture
No architecture spec exists for this feature (comment-only lane, no architect hop). Layering is unchanged. `tools/handoff-orchestrator.ts` still documents that the pipeline array is the order and that a test pins it.

## Security
No findings. No code changed. No secrets, absolute paths or internal URLs were added (AC14 grep). The hygiene-scan authoring rule (no pattern literal may match its own source) is still stated in `tools/hygiene-scan.ts` and explained further in the rationale file.

## Performance
No findings. Program behaviour is unchanged (AST-identical), and the emitted `dist/` JS differs only in comments and source maps.

## Verdict
APPROVED. Behaviour is unchanged, proved by the lane script and by a stronger independent AST check. The trims keep every caller-facing constraint or move it with a pointer that resolves, and every test-pinned string is intact. Q1 to Q4 do not block.
