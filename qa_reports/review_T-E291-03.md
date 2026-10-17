# QA Review — lane e291, feature e291-start-link-locations

covers: T-E291-01, T-E291-02, T-E335-01, T-E335-03, T-E291-03, T-E335-02

Spec: `specs/e291-start-link-locations.md` (D1–D7, D7 amendment, AC-E291-1..13, AC-E335-1..6, AC-LANE-1..3).
Code under test: feaf40f (T-E291-01), bf33bdf (T-E291-02), c5869b3 (T-E335-01), d889523 (T-E335-03), 868b28d (comment trim).
Code review: round 1 APPROVED, `review_reports/review_T-E291-01.md` (commit 6f06271).
QA: qa-engineer, Task-spawned, opus.

## Phase 0.5 — Expected-Red Diff

Phase 0.5: skipped (no expected-red manifest declared). `qa_reports/expected-red_e291-start-link-locations.txt` does not exist and `dispatch_mode` is not `bugfix`.

## Phase 1 — Review

### Commit 868b28d: comment-only, made after the APPROVED verdict

Commit 868b28d ("trim executeAbandonCurrentHarvest comment to the 7-line limit") came after the code-review APPROVED verdict, which was recorded in 6f06271. `git merge-base --is-ancestor 6f06271 868b28d` exits 0. The coordinator made the change to follow reviewer recommendation 1.

QA checked independently that it changes only comment lines. The command was `git show 868b28d -- bin/agc-init.mjs | grep -E '^[+-]' | grep -vE '^(\+\+\+|---)' | grep -vE '^[+-]\s*//'`. It printed nothing (grep exit 1), so every added or removed line in `bin/agc-init.mjs` is a `//` comment line and no non-comment line changed. The commit touches only `bin/agc-init.mjs` (1 file, +6/−15). The function signature, the body and every other line are as reviewed in round 1.

### Implementation read

- **T-E291-01**: `parseNodeModulesLinks` follows D2 exactly. Non-array values return `null`. Duplicates are removed (first one wins) and one trailing `/` is stripped. The character class is the same one used by `GITIGNORE_UNSAFE_SEGMENT_RE`. `loadConfig` exposes the key only for an array value. There is no schema bump (D3).
- **T-E291-02**: the config is read raw before any mutation (D4). One exclude rule is written per non-root location, after the static rules (D5). The D6 checks run in order. The root rendering is templated so that it matches the base text byte for byte.
- **T-E335-01**: the `materializeFindingsCopy` temp+rename helper is called from `executeFindingsPreserve` (covered links only) and from `executeHarvestRefresh` (the lane source is a link and `rel === pendingRel`).
- **T-E335-03**: rename-aside, then the whole-dir copy, then materialize. The aside copy is restored on failure and removed on success.

QA found no correctness issue that the reviewer missed. Uncovered `--shipped` symlink destinations were also looked at. That state cannot be reached: the first run refuses when the history dir already exists, and on a re-run `sameFileBytes` (which uses lstat) lists a linked history copy as changed, so the copy is covered. AC-E335-4 is therefore exercised through `--abandoned`, its plan-time path.

### 3a — Copy Audit Gate

Each Copy / Strings row was checked against `bin/agc-init.mjs` and then pinned verbatim by a test:

| string id | verdict | evidence |
|---|---|---|
| e291.link-line | verbatim | `subLinked()` / `ROOT_LINKED` exact-line asserts (AC-E291-2/3) |
| e291.shared-warning | verbatim (both `{where}` renderings) | `subShared()` / `ROOT_SHARED` |
| e291.primary-missing | verbatim (both `{pwhere}` renderings) | `subMissing()` (AC-E291-5) / `ROOT_MISSING` (AC-E291-1) |
| e291.lane-exists | verbatim, reused unchanged | `laneExists()` (AC-E291-7) |
| e291.lane-dir-missing | verbatim | `laneDirMissing()` (AC-E291-6) |
| e291.invalid-entry | verbatim, `{json}` = `JSON.stringify(entry)` | `invalidEntry()` (AC-E291-8) |
| e291.not-array | verbatim | `NOT_ARRAY` (AC-E291-9) |
| e291.usage-start | verbatim (3 lines) | the "Copy e291.usage-start" test |

The frozen root literals (`ROOT_LINKED`, `ROOT_SHARED`, `ROOT_MISSING`, `STATIC_ADDED`) are proven equal to the base strings: all 10 AC-E291-1 key-absent cases pass when run against the base `bin/agc-init.mjs` (negative control below).

Copy coverage observation (non-blocking, noted for PM): one user-facing string is not in the Copy table, `agc feature: cannot load dist/tools/config.js from the agc install (<err>) — run \`npm run build\` (nothing created)`, at `bin/agc-init.mjs:1416`. It appears only when the agc install itself is broken (the dist module is missing). It uses the existing base template for `dist/tools/lane-paths.js` (base `:1173`) with the module name substituted and the start-time `(nothing created)` suffix added. That is the same "templated reuse" class the spec already accepts for e291.lane-exists. The code reviewer judged it acceptable. QA does not route it as a coverage-gap FAIL, because it is an install-integrity diagnostic and not feature copy. It is recorded here and in pending_notes so PM can add it to the Copy table, or rule otherwise.

### 3b — Visual Audit Gate

Not applicable. The spec's Visual Tokens and Visual Widgets are `N/A` (no visual literals, CLI only).

## Phase 1.5 — Visual Compare

Phase 1.5: skipped (no Visual Baselines declared; no `design/e291-*.md`).

## Phase 2 — Discussion

No issues, so there was no round.

## Phase 3 — Tests

**Test-file discovery.** No existing test covered `nodeModulesLinks` or a symlinked `pending-tickets.md`. The brief's `Test-file placement` line pre-authorized creating `test/e291-*.test.mjs` and `test/e335-symlinked-pending-harvest.test.mjs`, and that is the branch QA followed. No owned lifecycle or config test needed re-pinning, so `test/agc-feature-lifecycle.test.mjs`, `config-versioning`, `config-cache` and `e31-config-nonfatal` are unmodified. No other test file was touched.

Files added:
- `test/e291-start-link-locations.test.mjs`: 38 tests.
- `test/e335-symlinked-pending-harvest.test.mjs`: 15 tests.

**Hygiene.** Every fixture repo is built in `os.tmpdir()` at runtime and removed in `after`. No test reads any real `specs/fanout-*.md`. No test diffs against a fixed sha; the base strings are frozen literals. A grep of both files for absolute local paths finds none.

### Spec-to-Test Map

| AC | tests |
|---|---|
| AC-E291-1 | `AC-E291-1: <variant>, primary root node_modules present …` and `… no primary root node_modules …` × 5 variants (no file, no key, unparseable, array root, null root); `AC-E291-1/D4: key absent never loads dist/tools/config.js …` (sandbox install with a throwing `config.js`) |
| AC-E291-2 | `AC-E291-2: ["web"] links only web/node_modules …`, `AC-E291-2: a nested location (packages/ui) …` |
| AC-E291-3 | `AC-E291-3: [".", "web"] links both …`, `AC-E291-3: list order decides print order …` |
| AC-E291-4 | `AC-E291-4: /web/node_modules is added after the static rules, exactly once across two starts; lane status clean` |
| AC-E291-5 | `AC-E291-5: ["web"] with no primary web/node_modules …` |
| AC-E291-6 | `AC-E291-6: lane checkout has no web/ …`, `… web is a tracked symlink …`, `… a symlinked parent segment …`, `… web is a regular file …`, `AC-E291-6 (security smoke): [".", "node_modules/dep"] …` |
| AC-E291-7 | `AC-E291-7: base branch tracks web/node_modules …` |
| AC-E291-8 | `AC-E291-8: each invalid entry warns once, in list order, before any per-location line; web linked once`, `AC-E291-8 (security smoke): control characters, wildcards and newline injection …`, `AC-E291-8 (boundary): an oversized all-invalid list …` |
| AC-E291-9 | `AC-E291-9: nodeModulesLinks is a string / null / an object …` |
| AC-E291-10 | `AC-E291-10: [] links nothing …` |
| AC-E291-11 | `AC-E291-11: parseNodeModulesLinks returns the D2 result …`, `… normalizes, dedups …`, `AC-E291-11: loadConfig surfaces …` (also asserts no heal-write), `AC-E291-11 / D3: the config schema version is still 2` |
| AC-E291-12 | `AC-E291-12: finish --shipped / --abandoned after a ["web"] start …` |
| AC-E291-13 | `AC-E291-13: docs/config.md has a nodeModulesLinks section stating every required point` |
| Copy e291.usage-start | `Copy e291.usage-start: the feature usage names the nodeModulesLinks key` |
| AC-E335-1 | `AC-E335-1: --shipped, <shape> …` × 3 link shapes (relative link in the lane dir, relative link out of the lane dir, absolute link outside the worktree); each also asserts that another symlinked lane file is still harvested as a link |
| AC-E335-2 | `AC-E335-2: --abandoned, <shape> …` × 3 |
| AC-E335-3 | `AC-E335-3: --shipped re-run over a history symlink left by a failed run …` × 2 shapes (pre-fix residue recreated by hand), `AC-E335-3: --shipped re-run when the failed run already left a regular history copy …` |
| AC-E335-4 | `AC-E335-4: --abandoned, lane file a symlink / a regular file, uncovered destination already a symlink …` (the link target holds identical bytes, which proves the refusal is on the link itself; nothing is written through the link) |
| AC-E335-5 | `AC-E335-5: regular-file pending-tickets.md, --abandoned refused then re-run …`, plus the four existing suites run as the proof (log below) |
| AC-E335-6 | `AC-E335-6 (a)`, `AC-E335-6 (b)` (other link kept as a link, history-only file kept, whole-dir copy refreshed, no temp or aside file left), `AC-E335-6 (failure path): a failed --abandoned harvest restores the earlier history copy …` (chmod-000 injection; skipped as root or on win32) |
| AC-LANE-1..3 | AC Execution Log below |

### Coverage Gate

Line coverage cannot be measured for `bin/agc-init.mjs`. Every test runs it as a spawned CLI subprocess (black box), and the repo has no subprocess coverage tooling (no c8/nyc). Branch-level accounting instead:
- Every new `bin/agc-init.mjs` branch is exercised by a named test above: `resolveNodeModulesLinks` (file missing, parse failure, non-object root, key absent, load failure, not-array, rejected entries, valid list); `isRealLaneDir` (missing, symlinked segment, symlinked parent, non-directory); `linkLaneNodeModules` (root and subdir × primary-missing, lane-exists, link); `executeFindingsPreserve` (covered link materialized; uncovered link refused at plan time); `executeHarvestRefresh` (symlinked source materialized, regular source copied); `executeAbandonCurrentHarvest` (no prior, prior regular, prior link, copy failure restore).
- `tools/config.ts` `parseNodeModulesLinks` and the `loadConfig` surface run in-process, and every return path is asserted.

### Security smoke

- Boundary inputs: `""`, `null`, `42`, nested arrays and objects, a 300-entry all-invalid list (start) and a 5000-entry list (loadConfig).
- Special characters: newline, C0, DEL, `* ? [ ]`, backslash, drive prefix, absolute path, `..`. No entry reaches `info/exclude`, and the warning JSON-escapes the newline.
- Path safety: symlinked segment, symlinked parent, and the through-root-link probe `[".", "node_modules/dep"]` (the primary install is unchanged). E335: an uncovered link whose target holds identical bytes is never replaced or written through. No auth surface.

## Phase 3.5 — AC Execution Log

ACs with `proof:` lines are executed below. This one log covers every id in the round.

| AC | command | output / exit | verdict |
|---|---|---|---|
| AC-E291-1..12 | `node --test test/e291-start-link-locations.test.mjs` | `# tests 38 # pass 38 # fail 0`, exit 0 | pass |
| AC-E291-1 (2nd half) | `node --test test/agc-feature-lifecycle.test.mjs` (unmodified; `git diff --quiet 902462e -- test/agc-feature-lifecycle.test.mjs` exit 0) | run together with the config tests: `# tests 87 # pass 87 # fail 0` | pass |
| AC-E291-13 | `grep -n "nodeModulesLinks" docs/config.md` | heading `### \`nodeModulesLinks\` — \`agc feature start\` node_modules link locations (optional)` at line 108, plus body lines. QA read it against the AC list: optional ✓, array of repo-relative dirs ✓, `"."` = root ✓, replaces the root default ✓, `[]` nothing ✓, D2 rules ✓, invalid entries skipped with a warning ✓, read from the primary `.current/.config.json` at start ✓, no schema version change ✓, `/<dir>/node_modules` exclude ✓ (also asserted by the AC-E291-13 test) | pass |
| AC-E335-1..4, 6 | `node --test test/e335-symlinked-pending-harvest.test.mjs` | `# tests 15 # pass 15 # fail 0 # skipped 0`, exit 0 | pass |
| AC-E335-5 | `node --test test/e287-finish-findings.test.mjs test/e180-abandoned-harvest.test.mjs test/agc-feature-finish-history.test.mjs test/e246-mailbox-teardown.test.mjs` | `# tests 76 # pass 76 # fail 0` | pass |
| AC-E335-5 / e246 | `git diff --quiet origin/main...HEAD -- test/e246-mailbox-teardown.test.mjs`; also `git diff --quiet 902462e -- test/e246-mailbox-teardown.test.mjs` (working tree included) | exit 0 and exit 0 (`origin/main` = 902462e), so byte-identical to base | pass |
| AC-LANE-2 | `node scripts/fanout.mjs owners specs/fanout-post-v4-w6.md --range origin/main...HEAD` | `14 path(s), 14 hit(s)`, every path attributed to e291, exit 0 (before the QA commit). The paths QA adds (`test/e291-*.test.mjs`, `test/e335-*.test.mjs`, `qa_reports/*E291*`/`*E335*`, `.current/e291/**`) are all in the e291 `擁有` cell. Re-run on the final HEAD is recorded under *Full suite* | pass |
| AC-LANE-3 | `npm run build && git status --porcelain dist/` | build OK (`check:transitions-sync — OK`), porcelain output empty | pass |
| AC-LANE-1 | `node scripts/test-lock.mjs -- npm test` on the final committed HEAD, clean tree | recorded under *Full suite (final HEAD)* below | see below |

### Negative control (copy outside the worktree, never `git stash`)

`git archive HEAD` was extracted to a scratch dir outside the worktree, and `bin/agc-init.mjs` was replaced with the base `902462e` version. HEAD `dist/` was kept so the in-process parser tests can import it. Both new test files were then run: `# tests 53 # pass 18 # fail 35`.
- Every E291 subdir, validation, not-array, empty-list, exclude, usage and AC-E291-12 test is red on base, and so are all E335-1/2/3/6 tests. The tests detect the missing behavior.
- All 10 AC-E291-1 key-absent cases are green on base. This proves the frozen root literals equal the base output byte for byte.
- AC-E335-4 (×2) and AC-E335-5 are green on base, as intended: they pin unchanged behavior.
- AC-E291-11 and AC-E291-13 are green because HEAD `dist/` and `docs/` were kept.

## Findings

- None blocking.
- Copy observation, non-blocking: the `dist/tools/config.js` load-failure string is not in the Copy table (see 3a). PM is invited to add it.
- Comment scan: on the final HEAD, `agc check` comment warnings are only the two pre-existing or reviewer-kept ones (`bin/agc-init.mjs` `executeHarvestRefresh` 9-line block, kept per the review; `tools/config.ts` ratio, lower than base). The new test files add none.
