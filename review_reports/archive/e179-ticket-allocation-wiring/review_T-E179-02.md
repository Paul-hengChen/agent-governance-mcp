# Review — T-E179-02

covers: T-E179-02, T-E179-03, T-E179-04, T-E179-05, T-E179-06, T-E179-15

## Round 1 — APPROVED — by code-reviewer

## Summary
- Scope: uncommitted diff in `<lanes-root>/e179` against HEAD `e4a47c0`. The changes are `tools/lane-paths.ts` (AC1), `tools/lane-migrate.ts` (AC10), `tools/lane-ticket-allocation.ts` (AC6, AC7, AC9, `findAppliedProvenance`, `appendBacklogRows`), `bin/agc-init.mjs` (finish wiring AC2/AC3/AC4, orphan check AC5), and prose in `content/coord-03-core-fallback.md` and `content/skill-release-engineer.md` (AC8). Also rebuilt `dist/**`, `tasks.md` rows, a tail-append to `NEW-TICKETS.md`, and the expected-red manifest.
- No path under `test/` is touched. `docs/`, `.claude/` and every forbidden file are untouched. `dist/tools/{lane-paths,lane-migrate,lane-ticket-allocation}.{js,d.ts}` are byte-identical to a fresh `tsc` build into `$TMPDIR`.
- `node --test test/*.test.mjs` gives 2485 tests with 2475 passing and 10 failing. The 10 reds are exactly the 10 manifest entries (8 lane-paths/lane-migrate LANE_FILES-count tests, context-budget AC8/AC-P2-7, and skill-manifest t-golden-byte-identity). There are no other reds.
- I ran scratch-repo smoke tests in `$TMPDIR`. They covered: a dirty lane refusing before any primary commit (G4(a)); primary on the wrong branch refusing; the content error being reported ahead of both a wrong primary branch and a dirty lane; a failing primary pre-commit hook restoring both files while a staged unrelated file stays staged; path-limited success commits that leave staged and unstaged unrelated files intact; the abandoned two-commit flow; and an orphan warning with exit 0. All of them behaved as the spec requires.
- Verdict: APPROVED. I found no required findings. There is one recommended finding and three optional ones.

## AC Completeness
AC1 — implemented — tools/lane-paths.ts:55 (entry `required:false`), :66 `pendingTicketsPath`, :79 `LANE_PATH_FIELD`
AC2 — implemented — bin/agc-init.mjs `applyPendingOnShipped`, called after the AC16 merge guard and before `removeWorktreeNoForce`. It reads both files via `readBlob(repoRoot, base, …)`. The (a)/(b) checks are in `assertPrimaryWritable`, and (c) is the path-limited `commitPathsOrRestore(…, [BACKLOG_REL, pendingRel])`. The smoke test confirmed a staged `other.txt` stays `M ` after the run.
Error-refusal precondition — implemented — `planPendingApply` throws on `parsed.errors` or `unresolvedDependencies` before `assertPrimaryWritable` or any write, listing each entry verbatim. The smoke test confirmed the content error wins over a wrong primary branch and a dirty lane.
AC3 — implemented — `applyPendingOnAbandoned` reads `refs/heads/<branch>:<pendingRel>` from the object db, commits backlog-only on base in primary (M1), then commits the pending file in `lanePath` (M2). The evidence move is a separate commit (DR-4).
AC3(a) G4 ordering — implemented — `planAbandonEvidence` (C4) runs before `assertPrimaryWritable` and M1. The smoke test showed a dirty lane refusing with `docs/backlog.md` untouched on main.
AC3(b) G4 idempotency — implemented — `planPendingApply` partitions into `skipped`/`toAllocate` using `findAppliedProvenance`. When `toAllocate` is empty, C2/C3 and M1 are skipped and M2 archives. `printSkipped` emits one "already applied, skipping" line per skipped entry. `--shipped` applies the same logic.
AC4 — implemented — every run does a fresh `readBlob(base, docs/backlog.md)` and uses `extractMaxBacklogId`. No state is held across processes.
AC5 — implemented as the spec is written — `checkOrphanLanes`: candidates come from `for-each-ref refs/heads/` (DR-6), and the live set comes from `listWorktrees` filtered by `fs.existsSync` (DR-9). It reads `.current/<lane>/pending-tickets.md` at depth 2 only, uses the two-argument parse, is not gated on the checkout, and runs inside try/catch. The smoke test showed an `rm -rf`'d worktree flagged with exit 0.
AC6 — implemented — tools/lane-ticket-allocation.ts `parsePendingTickets` archived branch. With `opts` omitted, archived blocks are skipped as before. With `opts`, only a well-formed block whose id is not in the set is reported. `validateBlock` is shared by both paths. Text matches the architecture verbatim.
AC7 — implemented — `scanPendingFile` `swallowed`. My probes confirmed `closes-enclosing-fence` (stray ``` followed by a complete block), `unclosed-at-eof`, and silence for the 4-backtick `markdown` nesting case.
AC8 — implemented — coord-03 Backlog Intake Loop (a new paragraph under the `## Backlog Intake Loop` heading) and skill-release-engineer `docs/backlog.md` bullet. `pending-tickets.md` gets 1 hit in each. The `NEW-TICKETS` count goes from 0 to 1 in each file, and in both places the new mention explicitly marks it "retired for lane ticket candidates", which AC8's proof allows. `NEW-TICKETS.md` is not deleted; it only gets a tail-append.
AC9 — implemented — backtick-only regexes, info-backtick special case removed, `normalizeDependsOn` string → `[v]`, overflow throw deleted. The AC9 grep returns no hits. A probe confirmed `~~~` is now inert text and `"a, b"` is a single reference.
AC10 — implemented — tools/lane-migrate.ts `isAppendLog` gates `sidecarMerge`, so `pending-tickets.md` is refused on conflict and never concatenated. The header comment is updated. The test is qa-owned (T-E179-12).
AC11 — partial by design, not an sr deliverable — reds are confined to the manifest. qa owns the re-baseline (T-E179-17) and the full green run (T-E179-18).

## Correctness
No required findings. I checked each focus area:
- (a) Ordering. In `--shipped`, C1a/C1b content checks run before C2/C3, which run before M1 writes, which run before the M2 commit, which runs before teardown. In `--abandoned`, `resolveBaseCommit` runs, then C1, then C4, then C2/C3 (only when `toAllocate` is non-empty), then M1, then M2, then the evidence commit, then teardown. Every commit is `git commit -m … -- <paths>` with `--only` semantics and no `git add`. I verified empirically that unrelated staged and unstaged files survive both a successful run and a failed one.
- (b) Restore. `commitPathsOrRestore` rewrites the pre-run blob bytes on a non-zero commit. I verified it with an always-failing pre-commit hook: exit 1, both files match HEAD, the index is unchanged, and the worktree is kept.
- (c) Provenance exactness. The `head` needle ends with the lane's closing backtick plus ``as ` ``, and the id must be followed by `` ` `` and then `)` or `;`. My probe confirmed `e17` does not match `e179`, `X-NEW-1` does not match `X-NEW-10` or `` `X-NEW-1`x ``, and prose lines without a `| E<n> |` leading cell are ignored.
- (d) AC10. Markdown is never concatenated (see above).
- (e) `checkOrphanLanes` cannot change the exit code. The probe `gitTry` is wrapped, everything else is inside try/catch, and `runCheck` still owns every `process.exit`.

**recommended R1** — bin/agc-init.mjs `applyPendingOnShipped` / `applyPendingOnAbandoned`: `alloc.appendBacklogRows(...)` is first evaluated inside the M1 write expression. That is after `assertPrimaryWritable`, and after `planAbandonEvidence` on the abandoned path. A backlog with no `| id | desc | priority |` header throws a plain `Error`, which `handleFeatureError` reports as `agc feature: docs/backlog.md: ticket table header … not found`. Nothing is mutated, so no invariant breaks. The problems are that this backlog-content refusal (a) only surfaces once primary is on base and clean, and (b) lacks the "nothing applied, nothing removed" wording the other refusals carry. Suggested fix: compute `newBacklog` inside `planPendingApply`, next to the `backlogBlob === null` check, and wrap the failure in a `FeatureError`.

**optional O1** — `applyPendingOnShipped` M1 makes two separate `atomicWriteFile` calls (backlog, then pending) outside the `commitPathsOrRestore` restore scope. If the second write throws, which is unlikely because C3 guarantees the file exists and is clean, `docs/backlog.md` is left modified and not restored, and C3 would then refuse the re-run. A small try/restore around the writes would close this.

**optional O2** — `findAppliedProvenance` also matches a provenance-shaped substring inside a row's `; source: …` text. For example, a source string containing ``(filed by lane `e179` as `X-NEW-4`)`` records `X-NEW-4 → E4`. The source is lane-authored, so this only causes a false "already applied, skipping", and that is visible. I note it as a sibling of E179-NEW-3.

## Quality
No required findings. The naming follows the file's conventions (`plan*`/`apply*`, `FeatureError`, `gitTry`). The filename is taken from `LANE_FILES` and the literal `pending-tickets.md` never appears in `agc-init.mjs`, as the architecture requires. The `validateBlock` extraction removes duplication between live and archived validation. The `runFeatureFinish` call passes both `lane: ticketId` and `ticketId`, which is redundant but harmless.

## Architecture
The implementation matches `specs/e179-architecture.md`'s step tables, pathspecs (shipped `-- docs/backlog.md <pendingRel>`; abandoned M1 `-- docs/backlog.md`, M2 `-- <pendingRel>` in lanePath), DR-1 through DR-13, the `isAppendLog` predicate, and the `provenancePrefix` shared composer. The one declared deviation is that `planPendingApply` takes `pendingText` instead of `rev`, so that `--abandoned` can run `resolveBaseCommit` between the branch read and the backlog read (DR-5). It is justified and changes no observable order.

On E179-NEW-2, which is escalated and not scored here: the implementation ORs every `.current/<lane>/` the branch carries, and that conforms to AC5 as written. My own reading is that AC5's `git show <branch>:.current/<lane>/pending-tickets.md` most naturally binds `<lane>` to the branch's own lane. If so, option (a) in NEW-TICKETS (count only the lane derived from `feat/<id>-*`) is arguably inside the spec rather than an amendment, and it would also fix the warning naming another lane's id. That decision belongs to the integrator.

## Security
No findings. Every git invocation is an argv array with no shell. `base` is refused if option-shaped (`resolveBaseCommit`) before any `${base}:${rel}` read, on both paths. Refs come from `for-each-ref`/`listWorktrees` (`refs/heads/…`), and paths come from `ls-tree -z`. Commit messages contain only allocator ids and the validated lane name. No secrets are introduced.

## Performance
No regression on existing paths. `readBlob` raises `maxBuffer` to 256 MiB for the backlog read, which is correct because the file is about 0.7 MB against the 1 MiB default. **optional O3**: `checkOrphanLanes` spawns one `ls-tree` per local branch plus two processes (`cat-file` and `show`) per pending file found. That is linear in branch count, which is acceptable for an advisory check, but a repo with hundreds of local branches will notice it on every `agc check`.

## Verdict
APPROVED. Every AC in sr scope is implemented, and every mutation-ordering, path-limiting, restore and exit-code invariant was verified both by reading the code and by scratch-repo runs. The reds are exactly the qa-owned manifest.

## Round 2 — APPROVED — by code-reviewer

Delta review only (T-E179-05 R1, T-E179-06 own-lane-only). Judged over `git diff e4a47c0` of the working tree (uncommitted, E158).

### Summary
- `checkOrphanLanes` (bin/agc-init.mjs) no longer runs `ls-tree` over `.current/`. Each local branch maps to its own lane the way `resolveCurrentLane` does: `feat/<rest>` goes through `lp.resolveLaneName(rest)`. It skips a branch that is not `feat/`, and any lane that is `LEGACY_LANE`, unsafe, or in `NON_LANE_DIRS`. Only `.current/<own-lane>/pending-tickets.md` is read, and the warning's ticket id is always the branch's own lane. This matches the amended AC5 "own-lane only" rule and proof (4).
- R1 is resolved. `planPendingApply` builds `newBacklogText`, and a missing ticket-table header becomes a `FeatureError` ending `(nothing applied, nothing removed)`, before `assertPrimaryWritable` and `planAbandonEvidence`. Both apply paths write `plan.newBacklogText`. On the abandoned path, `onBase` (toAllocate non-empty) implies `allocated` is non-empty, so `newBacklogText` is always the appended text there.
- Nothing else moved outside the delta. I diffed the current sr-file diff (tools/, content/, NEW-TICKETS.md, tasks.md) against the round-1 capture. The only differences are the `detectOrphanLanes` docstring rewrite in tools/lane-ticket-allocation.ts and the T-E179-11 `tasks.md` row text naming proof (4); the tasks.md row is not sr code. In bin/agc-init.mjs the changes are confined to `checkOrphanLanes`, `planPendingApply` and the two `newBacklogText` write sites. `dist/tools/lane-ticket-allocation.js` is byte-identical to a fresh `tsc` build.
- qa tests (test/ only). REG1 now asserts exactly 6 entries (5 optional). The context-budget cap moved 19284 → 19408, which is the measured value, and the golden fixture gained only the 2 new coord-03 lines. The additions cover AC1, AC2(1)/(a)/(b)/(c), Error-refusal (1)–(3), AC3, AC3(a), AC3(b), AC4, AC5 proofs (1)–(4), AC6 (1)–(3), AC7 (1)–(3), AC9 and AC10 (5 cases). The only removed test lines are the superseded REG1 and budget assertions. No AC is weakened.
- Suite: `node --test test/*.test.mjs` runs 2517 tests and all 2517 pass. The expected-red manifest now holds comments only.

### Findings
- **optional** — test/agc-feature-lifecycle.test.mjs:1013: the proof (4) title still says "EXPECTED RED until the next sr round…", and the test is now green. qa could drop that clause.
- Round-1 O1–O3 are unchanged and remain optional, as before.

### Verdict
APPROVED. The delta exactly implements AC5 own-lane-only and R1, nothing else in the sr files moved, the qa tests strengthen coverage, and the suite is 2517/2517 green.
