# Review — T-E247-02

covers: T-E247-02, T-E247-12

## Round 1 — APPROVED — by code-reviewer

Range: `afcc916..HEAD -- gates dist qa_reports/expected-red_e247-qa-pass-unticked-gate.txt` (commits 0f67342, 4f46d8c, e7d7179; bookkeeping 2703ebe, a5fe3e9).

## Summary
- T-E247-02 (`gates/expected-red.ts`) and T-E247-12 (`gates/ac-execution.ts`): each disposition predicate now checks an id's direct review file first. When that file is missing or lacks the H2, it also checks the id's `covers:` file. This fixes E396 (a per-id file without the H2 hid the covering file).
- R2 from the previous round: the comments in `gates/open-tasks.ts` are trimmed. The change is comment-only and the file is no longer flagged.
- The comments in the two fixed files were also tightened, because touching them made the comment advisory scan them. All of these edits are comment-only. The code changes are limited to the fix.
- The expected-red manifest is now comment-only: no intentional reds remain.
- Verdict: APPROVED. No required findings.

## AC Completeness
AC1 — implemented — reviewed in round 1 (`review_reports/review_T-E247-03.md`); qa tests in T-E247-10, out of this hop's diff
AC2 — implemented — reviewed in round 1; out of this hop's diff
AC3 — implemented — reviewed in round 1; out of this hop's diff
AC4 — implemented — reviewed in round 1; out of this hop's diff
AC5 — implemented — reviewed in round 1; `gates/registry.ts` is unchanged in this hop
AC6 — implemented — reviewed in round 1; out of this hop's diff
AC7 — implemented — reviewed in round 1; out of this hop's diff
AC8 — implemented — reviewed in round 1; `gates/open-tasks.ts` code is unchanged in this hop (comment-only diff)
AC9 — implemented — reviewed in round 1; out of this hop's diff
AC10 — implemented — reviewed in round 1; out of this hop's diff
AC10b — implemented — reviewed in round 1; out of this hop's diff
AC11 — implemented — qa-owned (T-E247-01). Negative control below: U2 and I are red against the pre-fix `dist/gates/expected-red.js` and green on HEAD.
AC12 — implemented — `gates/expected-red.ts:73-80`: direct first, then `covers:` when the direct file is missing or lacks the H2. U1/U2/I are green. The base-era tests `test/gates-expected-red.test.mjs` and `test/e136-evidence-path-injective.test.mjs` have zero lane diff (`git diff --stat 2425e04..HEAD`) and are green. `encodeEvidenceId` is kept (`:35`) and the file has no `taskId.replace(`.
AC16 — implemented — `gates/ac-execution.ts:93-106`, same traversal. AC-X is red pre-fix and green on HEAD. The lane diff to `test/ac-execution.test.mjs` is +18/−0, so existing cases are unedited, and they are green. `encodeEvidenceId` is kept (`:49`) and the file has no `taskId.replace(`.
AC13 — implemented — reviewed in round 1; out of this hop's diff
AC14 — implemented — reviewed in round 1; out of this hop's diff
AC15 — implemented for this hop — `npm run build` is clean and leaves the tree clean. This hop's dist diff is limited to `dist/gates/{expected-red,ac-execution,open-tasks}.*`, all within the AC15 allow-list. qa confirms the full suite on the final HEAD at close.

## Correctness
No required findings. Checks:
- **Traversal** (both files): the `hasHeading` closure adds each file to `checked` before reading it, so no file is read twice across ids. It returns `false` on a repeat or on a read error, so the function never throws. The coverage index is built under `coverage === null`, so at most once per call. It is now also built when the direct file exists but lacks the H2, which is the intended AC12/AC16 change. On a hit in the direct file, the index is never built. That matches the old lazy behaviour.
- **Self-cover**: when an id's covering file is its own direct file, the second `hasHeading` call is skipped by the dedup. The result is `false` with no double push.
- **ac-execution `checkedPaths`**: per id it is now the direct file (if it exists), then the `covers:` file (if any). The direct expected path is used only when neither is on disk. Smoke-run results on `dist/`:
  - direct file without the H2 plus a covers file with it: `[review_A.md, review_Z.md]`, present.
  - nothing on disk for ids A and B: `[review_A.md, review_B.md]`.
  - duplicate id, direct file without the H2: listed once.
  - `qa_reports/` absent: no throw, direct expected path listed.
  - direct path is a directory (the read throws): no throw, and the covers file still clears.

  The "nothing on disk" result is unchanged, and the e136 `deepEqual` pins (`test/e136-evidence-path-injective.test.mjs:136,140`) are green. The only other consumer is the `AC_EXECUTION_LOG_MISSING` envelope (`tools/handoff-orchestrator.ts:1163-1174`). It joins the paths into `Inspected: ...`, and that envelope's own comment says "every review file path inspected", so the new shape matches it better than the old one did. No test, spec or content file asserts the `Inspected:` text or the old one-path-per-id shape. The other `checkedPaths` mention, in `specs/e139-evidence-verdict-integrity.md:171`, is about the encoded stem only.
- **Negative control** (SOP 4c): I used a copy of `dist/` outside the worktree, with `dist/gates/expected-red.js` and `dist/gates/ac-execution.js` restored from `afcc916`. Against it, AC-X, E396 U2 and E396 I fail; on HEAD all three pass. Five other failures in that copy come from source-file reads (`content/`, `tools/`) the copy does not contain, so they are environmental.
- **Tests on HEAD**: `node --test` over `e396-covers-expected-red`, `ac-execution`, `gates-expected-red`, `covering-evidence`, `e136-evidence-path-injective` and `e23-evidence-schema`: 109/109 pass. Over `error-code-contract`, `repro-first-gate` and `e247-pass-tasks-incomplete`: 46/46 pass.
- **4a Expected-Red Sampling**: the manifest exists and has 0 entries (comment-only), so there is nothing to sample. No test file is in this hop's range, and the targeted runs show no unexplained red.
- **optional (O1)**: `buildCoverageIndex` keeps the first covering file per id, in sorted order (`tools/evidence-file.ts:147-157`). This is older behaviour, not changed here. One shape still misses: a per-id file that has no H2 but has its own `covers:` line for that id, and that sorts before the real covering file. My smoke run confirms it returns `present: false`. It does not occur in the e391 shape, where the real covering file sorts first and the per-id files carry no `covers:` line. It is outside this cut, so this is a note only and no ticket.

## Quality
- **4b comment check** (`agc check` on HEAD, 3 warnings, none in a file this hop's code touches):
  - `gates/registry.ts:78` long-block (37 lines, limit 7): kept, already over the limit at the lane base. At `2425e04` the block is 36 lines, and this lane added one row (`PASS_TASKS_INCOMPLETE  skill-qa-engineer.md`). That row is required by the AC5 mapping and pinned by the `error-code-contract` c12 test. The lane grew the block by one line but did not introduce it, so this is a note only.
  - `gates/registry.ts:116` long-block (12 lines, limit 7): kept, already over the limit at the lane base. At `2425e04` it is 11 lines. The lane changed 35 -> 36 and appended one clause, following the E40/E300/E139 append pattern. The lane did not introduce it, so this is a note only. Round-1 optional O1 still stands: line 125 was not re-wrapped (about 145 characters), and "so it stays last" is ambiguous. Still optional.
  - `test/e396-covers-expected-red.test.mjs:1` long-block (8 lines, limit 7): **introduced by this lane** (new file in a8667eb, qa-owned), so **recommended (R1, qa item for the closing hop; not an sr item)**. Trim the header to 7 lines or fewer. It also describes the defect in the present tense ("gates/expected-red.ts only consults the covering file when ... MISSING"), which has not been true since 0f67342. Reword it as the reproduction record, e.g. "pinned the E396 defect, fixed in T-E247-02".
- **Scope of the comment edits** (Constitution §1): in-bounds own-mess cleanup, not an unrequested rewrite.
  - Touching `expected-red.ts` and `ac-execution.ts` put them in scope for the diff-scoped advisory. sr reports ratios of 31.7% and 35.4% (limit 30%), and SOP 4b requires every warning touching the diff to be trimmed or justified.
  - Every non-fix edit is comment-only. What was dropped is history and rationale (`8 matches, 0 false positives`, `v3.14.1 hardening`, `E23 D3`, `AC4/AC5, Decision b`), which belongs in specs and commits. The WHAT/WHY content is kept: anchor semantics, the traversal guard, dormancy polarity, never-throws.
  - The `ac-execution.ts` `reviewPath` comment now points at `gates/qa-review.ts evidencePath` instead of chaining through `expected-red.ts`. That is accurate.
  - The `open-tasks.ts` trim (R2) moved "any other ledger leaves the check off" into the `featureLaneLedger` JSDoc, so nothing was lost.
  - Code beyond the fix: none. Hoisting `const dir` and the `hasHeading` closure are the fix itself.
- Naming and structure stay parallel between the two predicates, as the T-E247-12 row asks ("same approach as T-E247-02").

## Architecture
There is no architecture spec. The two predicates stay in `gates/`, reuse `buildCoverageIndex` / `sliceH2Section(At)` / `encodeEvidenceId` from `tools/evidence-file.ts`, and add no new imports. The orchestrator is untouched.

## Security
No findings. Paths still come from `encodeEvidenceId(id)` joined under `qa_reports/`, and the covering-file names come from a `readdirSync` of that same directory. There is no new input and no traversal surface.

## Performance
No findings. The worst case per call is still one `readdirSync` plus one read of each `.md` (the coverage index, built at most once), plus at most one read per distinct candidate file (dedup). The only new cost is that a direct file without the H2 now triggers the index build, which the fix requires. Nothing changes on the hot path for non-PASS writes.
- Same-model note: sr-engineer and code-reviewer are both pinned to opus. To offset that, the mechanical checks above (negative control, edge smoke run, rebuild) were run independently.

## Verdict
APPROVED — both fixes meet AC12/AC16 (direct file first, `covers:` file when the direct one is missing or lacks the H2, lazy index, dedup, never throws, `encodeEvidenceId` kept), the comment edits are comment-only, the dist scope is right, and the build leaves the tree clean. No required findings. R1 is a qa item for the closing hop.
