# Review — T-E217-01

covers: T-E217-01, T-E217-02, T-E215-01

## Round 1 — APPROVED — by code-reviewer

## Summary
- Scope: lane commits ac1877e (T-E217-01 refactor), 2e21bb1 (T-E217-02), b80abe1 (T-E215-01), 1c142d7 (finding E217-NEW-2), judged via `git diff origin/main...HEAD` (merge-base e5f325d). Changed paths: `bin/agc-init.mjs`, `specs/e217-lane-lifecycle-gaps.md`, `.current/e217/**` only.
- T-E217-01: `planShippedEvidenceHarvest`/`applyShippedEvidenceHarvest` become `planIgnoredEvidenceHarvest`/`applyIgnoredEvidenceHarvest`, parameterised by `dirs`, `bucket`, `verb`, `display`. ac1877e on its own is a pure refactor: every changed non-comment line swaps a literal (`--shipped`, `archive`, `SHIPPED_EVIDENCE_DIRS`) for a parameter, or wraps an echo in `display`.
- T-E217-02: `--abandoned` plans a copy-only harvest of `ABANDON_HARVEST_DIRS = ["specs"]` into `specs/abandoned/<ticket>/<relpath>` before the first mutation, and applies it after the evidence move/commit and before the `.current/` harvest. Every echo goes through `escapeSegmentForDisplay`.
- T-E215-01: `laneHooksPathWarning` adds one stderr warning after `bootstrapLaneEnv` when a relative `core.hooksPath` is a directory in primary and missing in the lane. It is wrapped in try/catch, branches only on the `gitTry` status, and creates nothing.
- Verdict: APPROVED. No required findings. The `--shipped` byte-identity was checked with an old-vs-new differential run (below), not only by reading the code.

## AC Completeness
AC-E217-1 — implemented — bin/agc-init.mjs:3434-3442 (plan), :3474 (apply); differential `abandonedSpecs`: 4 files incl. nested `e9-feature/notes/deep.md` and untokened `plan.md` copied byte-identical, one harvest line each, worktree removed, branch kept
AC-E217-2 — implemented — :3068-3072 the `tracked` set (`git ls-files -- specs`) excludes tracked files from at-risk; the evidence move touches only `ABANDON_EVIDENCE_DIRS` (:1119 unchanged)
AC-E217-3 — implemented — :3083 `isSafelyLinkedOutside` skip (shared, unchanged path)
AC-E217-4 — implemented — planned at :3434, before `applyPendingOnAbandoned` (:3454); differential `abandonedConflict`: exit 1, refuse line with the `--abandoned` token and the escaped primary path, lane head unchanged, worktree kept
AC-E217-5 — implemented — identical destination → no copy entry (:3104-3110); `COPYFILE_EXCL` plus re-plan converges (shared apply :3143)
AC-E217-6 — implemented — :3096-3097, :3112-3122; differential `abandonedDangling`: exit 1, `e217.specs-symlink-refuse-line`, `specs/bro\nken.md` escaped, nothing changed
AC-E217-7 — implemented — walkEvidenceTree dereferences file and dir links (:2999-3037, shared); `readAbs` is the real path, so the copy is content only
AC-E217-8 — implemented — `check-ignore` exit 1 is not at risk (:3073-3074), so the existing precondition refusal still owns the case
AC-E217-9 — implemented — `display: escapeSegmentForDisplay` (:3441) covers the harvest line src/dst, the symlink, differs and read-fail lines, and the copy-fail src and reason; differential shows `specs/a\nb\x1bc.md` escaped in stdout while the raw-named file landed in primary
AC-E217-10 — implemented — `SHIPPED_EVIDENCE_DIRS` unchanged; identity display (:3370); test/e213-shipped-ignored-shape.test.mjs passes and is unmodified; differential byte-identical (below)
AC-E217-11 — implemented — `ABANDON_EVIDENCE_DIRS` still `["qa_reports", "review_reports"]` (:1119); test/e180-abandoned-harvest.test.mjs passes and is unmodified
AC-E217-12 — implemented — bin/agc-init.mjs:1025-1028: the four `e217.usage-abandoned` lines match Copy / Strings verbatim; e291 usage-start lines untouched (its test passes)
AC-E215-1 — implemented — :1571-1595, :1670-1671; probe: exactly one warning, text matches `e215.hooks-missing` verbatim, stdout identical to the unset run
AC-E215-2 — implemented — :1574-1576, :1585; probe sub-cases unset / absolute / `~` / tracked `.githooks` / missing in both: no warning, output identical to unset
AC-E215-3 — implemented — warning only; probe: no `.husky/_` in the lane, lane `git status --porcelain` empty, exclude line unchanged
AC-E215-4 — implemented — the check runs only after worktree creation and bootstrap (:1670), so no refusal path reaches it
AC-E215-5 — implemented — probe with value `h<ESC>k`: stderr shows `h\x1bk`, no raw byte
AC-E215-6 — implemented (review) — `gitTry` plus `status !== 0 → null` (:1575), whole body inside try/catch → null (:1592-1594); cannot throw into start's flow
AC-E215-7 — implemented — no nested node_modules output added; test/e291-start-link-locations.test.mjs passes and is unmodified
AC-E215-8 — implemented — the spec's grep over the bin diff prints nothing (exit 1)
AC-LANE-1 — partial (qa scope) — the 11 listed existing test files pass here: 257/257. The full suite on the final HEAD is qa's T-E215-02. Not a review finding.
AC-LANE-2 — implemented — `git diff --name-only origin/main...HEAD` lists only owned paths
AC-LANE-3 — implemented — `git diff --name-only origin/main...HEAD -- tools dist docs schema test` is empty; no schema_version change

## Correctness
No required findings.

**`--shipped` byte-identity: verified by differential.** The merge-base `bin/agc-init.mjs` (e5f325d) and HEAD's ran side by side against the same `dist/`, on identical fresh fixtures, with stdout, stderr, exit code, primary file tree and lane head compared after replacing the tmp root. All five `--shipped` scenarios came out IDENTICAL:
- `shippedHarvest`: nested files, a file symlink, a file named with LF+ESC (still raw on `--shipped`, as AC-E217-10 requires), and one identical pre-existing destination.
- `shippedDangling`: dangling links in qa_reports/ and specs/, one ESC-named.
- `shippedConflict`: a differing destination plus a file-blocking ancestor.
- `shippedReadFail`: a chmod-000 ESC-named directory.
- `shippedCopyFail`: a read-only `specs/archive`.

`--abandoned` with no spec files was also IDENTICAL, so the E180 path is unchanged. The `--abandoned` runs with specs differ exactly as the ACs require.

**Ordering (D-E217-4):** the plan sits between `planAbandonCurrentHarvest` and `readUnallocatedFindings`, all before `applyPendingOnAbandoned`. The apply comes after the evidence commit and before `executeAbandonCurrentHarvest`. A copy failure leaves the evidence commit in place, but the re-run converges (moves are then empty, identical destinations are skipped), which D-E217-4 accepts.

- `optional` — bin/agc-init.mjs:3127-3131 — a ticket abandoned twice (re-picked and abandoned again) whose spec changed between the two runs is refused with the generic "differs" line. The operator gets no hint to move the older `specs/abandoned/<ticket>/` copy aside. This is by design (D-E217-1, differing destination refuses), so it is noted here only.
- `optional` — bin/agc-init.mjs:1585 — a relative value that climbs out of the worktree (`../hooks`) resolves to different directories for the lane and for primary. The warning is still accurate (git does run no hooks in the lane), so this needs no change.

## Quality
- `recommended` — `agc check — comments` flags three long blocks in the diff. Disposition:
  - bin/agc-init.mjs:1560 (11 lines, `laneHooksPathWarning`): could be trimmed. The sentence "a link could run hooks generated for primary's tree and would leave the lane's status dirty" repeats D-E215-1, and the spec pointer alone would do. Kept for this round: every line is WHY, not WHAT.
  - :2979 (12 lines, section header): kept. It is the one place that states the shared helper's bucket/verb/display contract, including why `--shipped` uses identity.
  - :3058 (8 lines, planner contract): kept. One line over the limit, and it documents the return shape and the at-risk rule.
- The old function names survive only in historical/design specs. E217-NEW-2 (1c142d7) correctly files the two that are rationale pointers (e260c, e351) as an out-of-lane finding. No test or code references the old names.
- The naming (`ABANDON_HARVEST_DIRS`, `planIgnoredEvidenceHarvest`, `laneHooksPathWarning`) fits the surrounding code. The `ABANDON_EVIDENCE_DIRS` comment points at the new constant as D-E217-3 asks.

## Architecture
No `specs/e217-lane-lifecycle-gaps-architecture.md` exists. The change follows D-E217-3: one shared planner/applier, with `--shipped` passing its old values and identity display. D-E217-5 holds (fs copy, never committed). D-E215-1..4 hold: warn only, no link, no config key, no nested node_modules hint (human ruling D-E215-3). Same-model note: sr-engineer and this review both ran on opus. The differential run and the live probes are the bias check.

## Security
No findings. Every new path echo on `--abandoned` and in the E215 warning goes through `escapeSegmentForDisplay`, including OS error reasons that embed absolute paths. The destination is built from a validated bare ticket id plus readdir names under primary `specs/abandoned/<ticket>/`. `blockingAncestor` plus `COPYFILE_EXCL` means no overwrite. No package manager or hook installer is run (AC-E215-8). No secrets.

## Performance
No regression. `--abandoned` now runs the existing per-file `git check-ignore` walk over the lane's `specs/`, the same O(n) spawn pattern `--shipped` already uses. `optional`: batching via `check-ignore --stdin` would serve both callers, but that is pre-existing and out of scope. `feature start` gains one `git config` spawn and two stats.

## Verdict
APPROVED — every in-scope AC is implemented; a side-by-side run against the merge-base binary showed `--shipped` output byte-identical, control characters included; there are no required findings.
