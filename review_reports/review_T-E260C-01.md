# Review — T-E260C-01 (batched, lane e260c of fan-out E260)

covers: T-E260C-01, T-E260C-02, T-E260C-03, T-E260C-04, T-E260C-05, T-E260C-07, T-E260C-09, T-E260C-10, T-E260C-11

Feature: `e260c-bin-scripts`. Range reviewed: `b37178a..ca8685a` (branch `feat/e260c-bin-scripts`). T-E260C-06 and T-E260C-08 are voided and not reviewed.

## Round 1 — APPROVED — by code-reviewer

## Summary
- Comment-only trim of the 17 JS files under `bin/` and `scripts/` that had long blocks (the two smoke scripts are untouched). Comment lines went from 2231 to 1265, the longest block from 81 to 7, and the 8-20 / over-20 block counts from 58 / 17 to 0 / 0. All re-measured independently.
- Removed reasoning was moved to the spec's "Kept rationale" section, with one entry per topic. Each trimmed file that has an entry carries a `specs/e260c-bin-scripts.md` pointer.
- I re-ran the proof scripts (`check-invariance`, `measure`, `check-tokens`) and every AC4/AC5/AC7/AC8 grep, then mutation-tested the invariance check. I verified every test-pinned comment string and ran 38 targeted test files that read `bin/` or `scripts/` source (887/887 pass).
- Different model from sr-engineer (opus reviewing fable), so the same-model bias concern does not apply.
- Verdict: APPROVED. No required findings.

## AC Completeness
AC1 — implemented — `node .current/e260c/check-invariance.mjs` prints `invariance OK: 17 files`, which is every changed path under `bin/` and `scripts/` (`git diff --name-only b37178a..HEAD -- bin scripts | wc -l` = 17). Not vacuous: I appended `const __probe = 1;` to `scripts/fanout.mjs` and changed `DEFAULT_WAIT_SECONDS = 480` to `481` in `scripts/verify-release.mjs`, and the script reported `invariance FAIL` on both and exited 1. Reverted afterwards.
AC2 — implemented — `measure.mjs --fail-over 7` exits 0 with `mid 0, large 0, longest 7`. `--ref b37178a` reproduces the baseline `mid 58, large 17, longest 81`. No 8-20 block is left, so no keep reasons are needed.
AC3 — implemented — `grep -c e260c-bin-scripts` is at least 1 in all 16 files that have a Kept rationale entry (agc-init 14, check-md-tables 7, verify-release 3, the others 1-2). `check-version.mjs` has no entry and no pointer. I cross-checked the entries against the removed text (see Correctness).
AC4 — implemented — `git diff -U0 b37178a..HEAD -- bin scripts | grep -E '^[+-]' | grep -vE '^(\+\+\+|---) ' | grep -vE '^[+-]\s*(//|/\*|\*)'` (stricter than the spec grep, because it does not drop lines that start with `+`/`-`) prints only one `-` and one `+` blank line. Both come from one re-flowed hunk in `bin/agc-init.mjs` (the E214 harvest header), so the blank-line count is unchanged. No trailing-comment tails were edited.
AC5 — implemented — no removed `#!`, `// Coded by` or `/*!` line. Added `/*` = 0, removed `/*` = 0. The only `/** */` block touched (`reclaimStale` in `scripts/test-lock.mjs`) keeps its JSDoc form, with ` * ` continuation lines only.
AC6 — implemented — scanned all comment lines in `bin/*.mjs` and `scripts/*.mjs` for an id-only body (E/T-/AC tokens with punctuation only): none. Every added comment states the behaviour, with ids as trailing pointers.
AC7 — implemented — `git diff b37178a..HEAD | grep -E '^\+' | grep -E '/U[s]ers/|/h[o]me/'` prints nothing.
AC8 — implemented — the changed-path grep prints nothing. Changed paths are only `bin/`, `scripts/`, `specs/e260c-bin-scripts.md` and `.current/e260c/`.
AC9 — not judged here (qa owns the full suite). The targeted run is below.

### Test-pinned comment text (from the brief)
1. `bin/agc-init.mjs` AC29: line 4 (within the first 20) holds both `any seeded prev tuple dead-ends` and `.current/<lane>/handoff.md`. Line 2 after `function runInit(cwd` (line 356) holds both `no .current` and `.current/<lane>/handoff.md`. `.current/.config.json` appears 7 times. `.current/<lane>/.config.json` and `.current/handoff.md (E34)` appear nowhere. Pass.
2. `checkOrphanLanes` body (114 lines, up to the next top-level `async function`): no `history`. The "Never reads `.current/history/`" sentence sits in the header comment above the function, outside the scanned body. Pass.
3. `bin/agent-governance-context.mjs`: no `applyTextTransforms`, `stripOriginTags` or `stripRationale`. Pass.
4. `scripts/fanout.mjs`: `from "../dist/` appears exactly once. Pass.
5. `scripts/join-precondition.mjs`: no `HOOK POINT FOR E126`. Pass.
6. `scripts/capture-constitution-golden.mjs`: no comment quotes `writeFixture("x.txt"` or `captureHook("x.txt"`. The `BUILD_MODES` literal is byte-identical to base (diffed). Pass.
7. `RESEARCH_BINARY_RE` appears only in its definition and its one use. No comment quotes the regex line (`png|jpe` occurs once, in code). Pass.
8. `node .current/e260c/check-tokens.mjs` prints `tokens OK: 17 files (8 added on branch, skipped)`. The script compares per-file presence of all six tokens, base against the working tree, over every changed path that exists at base. Pass.

Targeted tests: `node scripts/test-lock.mjs -- node --test` over the 38 test files that reference `bin/*.mjs` or `scripts/*.mjs` (agc-adapters, agc-feature-lifecycle, agc-feature-finish-history, check-md-tables, check-version, compose-equivalence, context-budget, e115-join-precondition, e177a/b, e178b, e180, e223, e246, e258b, e90, verify-release, skill-manifest, lane-paths, render-structure, and others): 887 tests, 887 pass, 0 fail, 0 skipped.

## Correctness
No findings. Behaviour invariance is proved mechanically by AC1, which I confirmed is non-vacuous. Proof-script review:
- `check-invariance.mjs` compares base text (`git show`) against the working tree, both run through `ts.transpileModule` with `removeComments: true`. TypeScript's re-print normalises whitespace, which is acceptable for a behaviour proof. String, template and regex literal text is emitted verbatim, so any literal edit is caught. A deleted file is reported as FAIL, not skipped. The filter `/\.(m|c)?js$/` covers every file in scope (all `.mjs`).
- `measure.mjs` uses the same `analyzeText` as `agc check`, and `--ref` measures the base tree via `git ls-tree`/`git show`.
- `check-tokens.mjs` skips only paths absent at base and counts them.

I checked the accuracy of Kept rationale against the code: `POLL_INTERVAL_SECONDS = 20` and `DEFAULT_WAIT_SECONDS = 480` (`scripts/verify-release.mjs:373-374`); release sha from the tag with a HEAD fallback (`:530-544`); `CI-CHECK PASSED/FAILED` summaries (`:132,135`); `DEFAULT_DEADLINE_MINUTES = 29`, `.<name>.watch-lock`, `HOP_CAP_EXPORTED`, `armed:` / `expiring — re-arm` / `changed:` (`scripts/mailbox-watch.mjs:14,253,384,398,416,456`); `AGC_TEST_LOCK_HELD`, `LOCK_TIMEOUT_EXIT_CODE`, `CORRUPT_GRACE_MS`, `childPid` (`scripts/test-lock.mjs:17-23,70,165`); `HANDOFF_LAYOUT_CONFLICT` (`dist/tools/handoff-parse.js:123`); the 120 s hook-marker window (`dist/index.js:83`); `postbuild` wiring (`package.json:18`); primary from `listWorktrees(...)[0]` (`bin/agc-init.mjs:1639`); `findGenuineDoneMark` (`scripts/check-md-tables.mjs:97`). All accurate. Every "see specs/e260c-bin-scripts.md" pointer resolves to a matching `###` entry.

The test comment at `test/verify-release.test.mjs:1985-1990` quotes the script's claim that "a drift-guard test pins the mirror". The trimmed comment still says "pinned by a drift-guard test" (`scripts/verify-release.mjs`, E141 allowlist block), so that cross-reference holds.

## Quality
- optional — `scripts/fanout.mjs:5`, and the `Watch:` / `Send:` / `Exit codes:` lines in `scripts/mailbox-watch.mjs:6-8`, are now very long single lines (about 110-190 chars). The usage lines at base were already this long, so this is not convention drift, but wrapping the exit-code line would read better.
- optional — the header of `bin/agc-init.mjs` drops the `feature start` / `finish` argument shapes. They are still in `STR_USAGE_FEATURE`, so nothing a caller needs is lost.
- optional, out of lane scope — `content/skill-release-engineer.md:265` cites a stale verify-release line range. It is already filed as `E260-NEW-1` in `.current/e260c/pending-tickets.md`. Similar line-number citations of `bin/agc-init.mjs` / `scripts/verify-release.mjs` in test comments (`test/agc-adapters.test.mjs:481,813,820`, `test/verify-release.test.mjs:1989`) and historical docs and fixtures were already rotting at base. `test/` is forbidden to this lane, so no action is asked here.

No HOW-narration was introduced: the rewritten comments state what and why. Comment styles are unchanged, and every `// Coded by` line and shebang is preserved.

## Architecture
No `specs/e260c-bin-scripts-architecture.md` exists. Layering is unchanged (comment-only). The lane stays within its owned files per `specs/fanout-e260.md`.

## Security
No findings. No executable change, no new input surface, no secrets, and no absolute local paths in tracked additions (AC7). The proof scripts call `git` through `execFileSync` with argv arrays (no shell).

## Performance
No findings. Comment-only, with byte-identical transpiled output (AC1). No runtime path changed.

## Verdict
APPROVED — the invariance proof is real and non-vacuous, every AC1-AC8 proof passes when re-run, every test-pinned comment string holds, the targeted tests are green, and the removed reasoning is accurately preserved in the spec, with pointers.
