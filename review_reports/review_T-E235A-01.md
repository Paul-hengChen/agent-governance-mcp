# Review — T-E235A-01

covers: T-E235A-01, T-E235A-02, T-E235A-03, T-E235A-04, T-E235A-05, T-E235A-06

## Round 1 — CHANGES_REQUESTED — by code-reviewer

## Summary
- Diff `main...HEAD` on `feat/e235a-relative-prd-path` (commits fb3b436, f208e98, b5d6b9c, a9c2db8): three pure helpers in `tools/handoff-parse.ts` (`isInsideWorkspace`, `relativizePrdPath`, `resolveStoredPrdPath`), relativize at the single emit site in `tools/handoff-write.ts`, a read-time resolve and bound in `readAndMigrate`, both `tools/registry.ts` refines switched to the shared predicate, a no-bump note in `docs/schema-versions.md`, a one-field rewrite in each of 19 history files, and the adopter-name comment and prose scrub.
- The storage-layer code, the security bound, the history rewrites, and dist all check out. Probe results are below.
- There is one required finding: the lane's own spec file has a malformed markdown table. It makes 2 tests in `test/check-md-tables.test.mjs` fail, and those tests are not in the expected-red manifest. `main` passes them. AC10 is violated.
- Verdict: CHANGES_REQUESTED. It is a one-cell fix.

## AC Completeness
AC1 — implemented — tools/handoff-write.ts:581-590 (`relativizePrdPath` at the single emit site; covers new value, carry-forward, and heal). Probe: a write with an absolute in-workspace value stores `prd_path: "docs/b.md"`, and a follow-up write that omits it carries the relative form forward.
AC2 — implemented — tools/handoff-parse.ts:406-407, 509. Probe: `parseHandoff` returns the absolute `<ws>/docs/b.md`.
AC3 — implemented — tools/handoff-parse.ts:103-106 (an absolute value inside the workspace is returned verbatim, and no forced rewrite happens).
AC4 — implemented — tools/handoff-parse.ts:103-106 (read) and tools/registry.ts:354, 496 (boundary). Drop-to-absent follows DR-2, and the stderr line does not echo the value.
AC5 — implemented — tools/registry.ts:204/477 `isAbsolute` refines, messages, and JSON-schema text are unchanged. `test/handoff-write-arg-guard.test.mjs` passes.
AC6 — implemented — docs/schema-versions.md:50. The no-bump note matches the DR-4 text verbatim, and sqlite is addressed.
AC7 — implemented — 18 `prd_path:` lines (the `_primary` file plus 17 history files), 2 e178b `ref:` values, and the e125c prose line. Each hunk is exactly 1 line (e178b: 3 lines, all 3 leaking fields). The values match the DR-6 mapping exactly. A home-dir-prefix re-scan of the AC7 scope returns zero hits.
AC8 — implemented — tools/handoff-orchestrator.ts:1720 (comment only), dist mirror, and the e180/e213 tasks.md files. A word-diff shows only the adopter token changed, and no checkbox, id, or `covers:` line was touched. A case-insensitive re-scan (word-bounded short form, full form, personal config-dir form) returns zero hits in the 4 files plus the dist `.js`/`.js.map`.
AC9 — implemented — dist rebuilt. The home-dir-prefix grep of `dist/tools/handoff-orchestrator.js` returns zero hits.
AC10 — **partial** — the full suite has 8 failures. 5 are the manifest-listed DR-5 fixtures, whose failure cause I confirmed (out-of-workspace synthetic `prd_path` read as absent). 2 are NOT in the manifest and are caused by this branch (see Correctness C1). 1 (`test/usage-accounting.test.mjs` t-hook-noop-config-without-budget-key) passes when run alone; it is load-flake, not attributable to this diff, and not a finding. **required**.

## Correctness
- **C1 [required]** — specs/e235a-relative-prd-path.md:163. In the Visual Tokens table, the header declares 4 cells and the `N/A` row has only 3. `node scripts/check-md-tables.mjs` exits 1 on this branch and 0 on `main` at the merge-base. Two tests fail as a result: `test/check-md-tables.test.mjs` "AC7 (real corpus, …)" and "CQ-9 (real corpus, …)". Neither is listed in `qa_reports/expected-red_e235a-relative-prd-path.txt`, so merging would turn `main` red. Fix: add the missing source cell (for example `| N/A | — | feature has no visual literals | — |`). The file is lane-owned (`specs/e235a-*`), and the fix is a one-line table repair with no AC or semantic change.
- Expected-red sampling (SOP 4a): I grepped all 5 manifest entries, and each is a real, locatable test (3 in `test/handoff-migration.test.mjs`, 2 in `test/writestate-options-object.test.mjs`). Their failure cause matches DR-5.
- Edge-case probe of the helpers (dist build), with the workspace at a synthetic root. `docs/b.md`, `./docs/b.md`, `docs/./b.md`, and an absolute in-workspace path relativize to `docs/b.md` and resolve to absolute. The workspace itself, the workspace with a trailing slash, `""`, `..`, `../x`, `docs/../../x`, a sibling-prefix dir (`<ws>x/b.md`), and `/etc/passwd` are all rejected on both sides. `..foo/b.md` is also rejected, which is a pre-existing lexical quirk shared with the old refine, so the bound is not loosened. A legacy absolute with an in-bounds `..` segment is returned verbatim on read, as AC3 requires.
- DR-3 probe: a direct non-zod `writeHandoffState` with an out-of-bounds `prdPath` omits the field and logs one stderr line with no value. `relativizePrdPath` cannot return an absolute string, because `isInsideWorkspace` rejects `path.isAbsolute(rel)`, which also covers the win32 cross-drive case. So a direct writer can never persist an absolute path.
- Consumers: the orchestrator (`handoff-orchestrator.ts:1533`) passes the zod-absolute value down. Carry-forward (`handoff-write.ts:465`) and heal (`handoff-parse.ts:652`) read the resolved absolute value and re-relativize on emit. `prompts/build.ts` and `tools/rag.ts` are unchanged, and in-memory values stay absolute. No other reader of `frontmatter.prd_path` exists in tools/, gates/, schema/, prompts/, bin/, or lib/.
- Registry refine: for absolute input, `path.resolve(ws, p)` followed by `path.relative` is equivalent to the old `path.relative(ws, p)`. For relative input (already rejected by the field-level `isAbsolute` refine), the traversal check now resolves against the workspace instead of the process cwd. That changes only which secondary issue is listed, never accept vs. reject.

## Quality
- **Q1 [optional]** — tools/handoff-parse.ts:408-412. The out-of-bounds stderr line fires on every parse of such a file until the next write heals it. Parse runs on many hot paths, so a hand-edited bad value could repeat the line often. The noise is acceptable and bounded by self-heal.
- **Q2 [optional]** — tools/handoff-write.ts:581-590. A direct write that supplies an out-of-bounds new `prdPath` also drops a previously valid carried value, because the new value wins before relativize. This is consistent with DR-3's "omit" and cannot be reached through zod.
- Naming and comments match the surrounding conventions. No dead code.

## Architecture
The change matches DR-1 through DR-6: one serializer boundary, helpers in `handoff-parse.ts` with no new module or import cycle (`registry.ts` only imports), drop-to-absent failure shape, no schema bump, and no changes to sqlite, `rag.ts`, or `build.ts`. `content/**`, the goldens, and the budget test are untouched (`git diff --stat` is empty). Every touched file is in the e235a owned column of `specs/fanout-e235.md`.

## Security
- The traversal bound is the same lexical predicate at both registry refines and at read time. It is not loosened in either direction, and it gets stricter at read, where no bound existed before (a stored out-of-bounds legacy absolute value is now dropped, as AC4 requires).
- Symlinks: lexical only, identical to the old refine. There is no realpath at either layer, so no regression.
- Out-of-bounds values are never echoed: both stderr messages are constant strings.
- Leak hygiene: I scanned all added diff lines (excluding `.current/e235a/handoff.md` by agreement) and all 4 commit messages for a home-dir prefix, the OS username, the adopter short and full forms, and the personal config-dir form. Zero hits. This report reproduces none of those strings either.

## Performance
No findings. The additions are O(1) `path` operations per parse and per write, with no new I/O.

## Verdict
CHANGES_REQUESTED — the implementation is correct and secure, but the lane's own spec file breaks `scripts/check-md-tables.mjs`. That causes 2 unlisted test failures (AC10). Fix the 3-cell row at specs/e235a-relative-prd-path.md:163.

### sr-engineer reply — Round 1
- **C1** — fixed. specs/e235a-relative-prd-path.md:163 Visual Tokens `N/A` row now has 4 cells (`| N/A | — | — | feature has no visual literals |`), with the reason in the `source` column as in the sibling Copy / Widgets tables. `node scripts/check-md-tables.mjs` exits 0; `node --test test/check-md-tables.test.mjs` is green.
- **Q1 / Q2** — optional; left as-is (bounded by self-heal / unreachable through zod, as noted).

## Round 2 — APPROVED — by code-reviewer

## Summary
- Round-2 re-review of `9b0e292` (the fix for Round 1 C1). covers: T-E235A-01, T-E235A-02, T-E235A-03, T-E235A-04, T-E235A-05, T-E235A-06.
- `9b0e292` touches only `specs/e235a-relative-prd-path.md` (1 line) and this report (the sr reply). No code, test, or dist file changed.
- Verdict: APPROVED.

## AC Completeness
Round 1 dispositions stand. AC10 (no unlisted test failures) is now met: `node --test test/check-md-tables.test.mjs` passes 49/49.

## Correctness
C1 — resolved. specs/e235a-relative-prd-path.md:163 is now `| N/A | — | — | feature has no visual literals |`, which has 4 cells to match the 4-column header. `node scripts/check-md-tables.mjs` exits 0 (381 files, 0 malformed tables). The 4 advisories on docs/backlog.md:165/166/180/181 are pre-existing, non-blocking done-mark notes outside this lane's diff. No new findings.

## Quality
No new findings. Q1 and Q2 were optional and are left as-is, which is acceptable.

## Architecture
No change since Round 1.

## Security
No change since Round 1. The new commit has no code surface.

## Performance
No change since Round 1.

## Verdict
APPROVED — the only required finding (C1) is fixed with a 1-line spec edit, and the Round 1 code findings still hold because `9b0e292` touched no code.
