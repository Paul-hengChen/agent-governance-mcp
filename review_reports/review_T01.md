# Review — T01 (lane e213, e213-shipped-ignored-shape)

covers: T01, T02, T04, T08

## Round 1 — APPROVED — by code-reviewer

Diff: `git diff 0626f1f..b042743 -- bin/agc-init.mjs` (sr commit b042743). Contract: `specs/e213-shipped-ignored-shape.md` (no architecture spec exists). Model note: sr ran on fable and this review ran on opus, so the two passes do not share one model's blind spots.

## Summary
- E213 (T01/T02): `planLaneClose` gains `tasksIgnored`. `executeLaneClose` now writes the tasks.md pointer first, skips `git add` when tasks.md is ignored, builds commit `rels` conditionally, skips the commit when `rels` is empty, and holds every stdout line until the step has durably succeeded.
- E214 (T08): adds `SHIPPED_EVIDENCE_DIRS` and a recursive, symlink-dereferencing walk. `planShippedEvidenceHarvest` is read-only, runs before any mutation, and refuses on differing destinations, blocking file ancestors, and at-risk dangling symlinks. `applyShippedEvidenceHarvest` copies with COPYFILE_EXCL just before `removeWorktreeNoForce`.
- E216 (T04): `m.harvested` is set on every at-risk `--abandoned` move, and those moves print the qualified line. All other moves print the plain line unchanged.
- The change stays in the owned paths. It does not edit `ABANDON_EVIDENCE_DIRS`/`planAbandonEvidence`. The only change to `--abandoned` is the E216 marker and line.
- Verdict: APPROVED. No required findings. Two recommended findings and three optional ones follow.

Independent verification (fixtures in $TMPDIR, scripts in session scratchpad):
- Run A shape (all ignored, nested `specs/sub/deep/f.md`, an in-lane file link, an external dir link): exit 0. The fs-only line, the `.current` harvest line, the no-commit line and five evidence-harvest lines print in mutation order. Primary has 0 symlinks afterwards (`find -type l`). The tasks.md pointer is present.
- Tracked tasks.md + ignored `.current/` + ignored `qa_reports/`, with a forced pre-commit failure: exit 1. stdout has neither the harvest line nor the "recorded" line. `git status --ignored` is clean (history copy and dirs rolled back). The primary gets no `qa_reports/` copy. The re-run exits 0.
- Ignored tasks.md + tracked `.current/<lane>/`, with a forced commit failure: exit 1. The newly created tasks.md is removed and the git mv is undone. The re-run exits 0, and the commit touches only the `.current/` rename.
- An at-risk dangling symlink refuses with exit 1 and the exact e214 string. Primary is untouched and the lane is kept.
- A dangling evidence-dir root is skipped. A file blocking `review_reports/archive` refuses at plan time and mutates nothing. After the blocker is removed the re-run exits 0.
- Re-run after a refused `git worktree remove` (plain untracked file) with the evidence unchanged: idempotent (AC9, per sr's smoke run and the code path).
- `node --test test/e180-abandoned-harvest.test.mjs test/agc-feature-finish-history.test.mjs test/agc-feature-lifecycle.test.mjs`: 85/85 pass.

## AC Completeness
AC1 — implemented — bin/agc-init.mjs:2093 (`tasksIgnored`, check-ignore exit 0 only), :2168-2174 (no add, fs-only line verbatim)
AC2 — implemented — :2163-2201: pointer write happens first, then the `.current` harvest, so the lines print in mutation order. Verified in the Run A fixture.
AC3 — implemented — :2213-2224: an empty `rels` means no `git commit` and the no-commit line (verbatim) replaces the "recorded" line.
AC4 — implemented — a tracked tasks.md never reports ignored (check-ignore consults the index). The add/commit path and its strings are unchanged, and on success the lines print in the same order as before. The existing suites pass.
AC5 — implemented — the `out` buffer is flushed only after the commit (:2241-2246) or after the fs-only return (:2222). Every `fail()` path throws before any flush. Verified with a forced commit failure.
AC6 — implemented — :2302-2338 (recursive walk, relative path preserved, no token filter), :2402-2415 (`archive/<ticket>/<relpath>`), :2464-2468 (e180 harvest line verbatim)
AC7 — implemented — :2387 `isSafelyLinkedOutside` skips the dir
AC8 — implemented — :2413-2414 plus the refuse string with the `--shipped` verb token (:2433-2437). Planned at :2608, before `assertPrimaryWritable` and every mutation.
AC9 — implemented — an identical destination makes no copy and does not refuse (`sameFileBytes`, :2413)
AC10 — implemented — `atRisk` requires check-ignore != 1, so a plain untracked file is left to git's own refusal
AC11 — implemented — an absent dir is skipped (:2385) and an empty walk makes no copies and prints nothing
AC12 — implemented — confirmed end-to-end with the Run A fixture above (the formal test is T10, owned by qa)
AC13 — implemented — the three named suites pass 85/85 (qa runs the full `npm test`)
AC14 — implemented — :1465 (set for every at-risk move, whether copied this run or already identical), :1537-1543 (qualified line verbatim)
AC15 — implemented — the plain line is unchanged for non-harvested moves, and the e180 suite passes
AC16 — implemented — `specs` is a full member of `SHIPPED_EVIDENCE_DIRS` (:979) under the same rules
AC17 — implemented — :2316-2331 dereferences resolving links (content copied, never the link) and collects dangling links. :2400/:2420-2431 refuse before any mutation with the e214 string verbatim, naming every path.

## Correctness
Ruling on sr's three decisions the spec leaves open:
1. **A dangling symlink refuses only when it is at risk** (:2400) — ACCEPTED. A tracked dangling link is restored from git history, and git's own non-force `worktree remove` refuses over a plain untracked one (the AC10 precedent). Only the untracked-and-ignored case, or a link beyond a symlink (exit 128, which fails toward refusing), is silently deletable, and that case still refuses loudly. The spec says "never silently skipped". A link that survives, or that git itself blocks on, is not being skipped silently, so the reading holds.
2. **An evidence-dir root that is a dangling link or a non-directory is skipped** (:2390-2396) — ACCEPTED. A dangling root link holds no bytes, so nothing is lost. An anchored `/specs/`-style ignore rule only matches directories, so a non-directory root would not be ignored, and git's worktree remove would refuse over it. See O3 for the leftover edge.
3. **A destination parent that is a file is refused at plan time** (:2348-2360, :2408-2410) — ACCEPTED, and it is the right call. Without it, `mkdirSync` would throw ENOTDIR mid-apply, after the close commit had already landed. It is verified to refuse with no mutation. The wording is covered in O1.
4. **tasks.md write moved ahead of the `.current/` harvest** — ACCEPTED. Every rollback branch still covers both mutations: `tasksText` is restored, a created tasks.md is removed (with `rm --cached` when it was added), and `moved`/`harvestStarted` unwind. The only new window is `git mv` or `cpSync` failing after the tasks write, and that runs the same rollback. An untracked-but-not-ignored pre-existing tasks.md cannot reach `git add`, because `assertPrimaryWritable` refuses it first. I confirmed this with a fixture, so the `tasksText !== null && tasksAdded` rollback gap that already existed is unreachable.

Other focus areas:
- **No mutation before every refusal:** confirmed. The order is `planPendingOnShipped` → `planLaneClose` → `planShippedEvidenceHarvest` → `assertPrimaryWritable` → mutations.
- **Rollback when the close commit fails:** the evidence harvest is applied only after `executeLaneClose` returns, so a failed commit leaves no primary evidence copies. `applyShippedEvidenceHarvest` failing after the commit leaves the lane in place, and the `alreadyClosed` re-run re-plans and skips copies that are already identical.
- **No symlink copied into primary:** confirmed. Only `copyFileSync` of dereferenced `readAbs` runs. 0 links were found in primary after Run A.
- **Symlink-loop guard:** the `chain` of real paths on the current descent ends a cycle. Checked by reasoning for self, parent and mutual A↔B cycles, and by fixture for `qa_reports/up -> ..`, which terminates.

- **R1 (recommended) — dereferencing has no bound; it walks and copies content that is not at risk.** `walkEvidenceTree` (:2326-2327) follows any directory link wherever it resolves. Every file reached through a link gets a rel "beyond a symlink", so `git check-ignore` exits 128, the file counts as at risk, and it is copied. Fixture `qa_reports/up -> ..` copied the lane's tracked `README.md`, `.gitignore`, `qa_reports/r.md` a second time, `.current/<lane>/base-sha` and the worktree's `.git` gitdir file into `primary/qa_reports/archive/<t>/up/`. The external-dir link in Run A copied `$T/ext/e.md`, which survives on its own anyway. In a real adopter, a link to `../node_modules/...` or to a large external dataset would copy all of it and spawn one git process per file. This is literal AC17 compliance, since the spec says "every symlink whose target resolves is dereferenced", so it does not block. Suggested follow-up: apply AC7's reasoning at entry level. Skip a link that resolves outside the worktree (it survives), and skip a link whose resolved target sits inside the worktree but outside the evidence dir being walked (its content has its own disposition). Worth a pending-ticket.
- **R2 (recommended) — a re-run hits a dead end when lane evidence changes after a partial run.** Fixture: the first `--shipped` run harvested `qa_reports/q.md`, then git refused the worktree remove over a plain untracked file. The user edited `q.md` and removed the blocker. The re-run then refuses with "harvest destination already exists … and differs", and that destination is the one this command wrote on the previous run. This matches AC8/E180 AC3, which the spec mandates, so it is not required. But the refusal gives no remediation, while `.current/` in the same situation is overwritten (e125b R1). Suggest a remediation clause in the message or a pending-ticket.

## Quality
- O1 (optional): a blocking-ancestor conflict (decision 3) is reported under the "already exists in the primary checkout and differs" sentence and lists the blocker's path. That is accurate enough, but it reads oddly. A per-cause clause would be clearer. The verbatim string constraint only covers the differing-file case.
- O2 (optional): `e213.tasks-nocommit-line` says ".current/{ticket}/ are both git-ignored" even when `.current/<lane>/` was simply never committed and is not ignored (`tasksIgnored && !tracked && !sourceIgnored`). This is a spec string issue and is implemented verbatim, so there is no action for sr.
- Naming, comments and structure follow the E180/e125b neighbours. The new sibling functions follow the spec's instruction not to fold them into shared code.

## Architecture
No `specs/e213-shipped-ignored-shape-architecture.md` exists. The change fits the read-plan-then-mutate discipline the spec prescribes (`runFeatureFinish` --shipped branch). The plan sits alongside `planLaneClose`, and apply runs just before `removeWorktreeNoForce`. There is no scope creep outside the owned `--shipped`/E216 lines.

## Security
No findings. No shell interpolation: every git call is `execFileSync` with an argv array, and paths are passed after `--`. Destination paths come from `path.posix.join(dir, "archive", ticketId, rel)`, where the ticket id is already validated as a bare id and `rel` comes from `readdir` names, so there is no `..` traversal. COPYFILE_EXCL prevents clobbering. O3 (optional): FIFOs, sockets, and links to either are skipped silently by the walk. Reading a FIFO could block, so skipping is the safe choice.

## Performance
With no evidence present, the added cost over base is one `git ls-files` plus one `git check-ignore` per untracked evidence file. That is acceptable at typical sizes and follows the per-file rule the spec requires. The unbounded-dereference cost is covered in R1. The `new Set([...chain, real])` copy per directory level is O(depth²) over the tree height, which is negligible.

## Verdict
APPROVED. Every AC (1–17) is implemented, sr's three undocumented decisions and the reorder are all sound, and rollback, idempotency and the no-mutation-before-refusal order all hold under independent fixtures. R1 and R2 are recommended follow-ups and do not block.
