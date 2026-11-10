# Review — T-E196-01 (round 1)

covers: T-E196-01, T-E196-02, T-E196-03, T-E196-08

Range: `e5da97a..f80330a` (implementation commits 7dd6775, d36626d, f17754f, aeaa7a9, 119c9a2). Spec: `specs/e196-agc-init-lane-checks.md`. No architecture spec (architect skipped per the fan-out plan).

## Round 1 — CHANGES_REQUESTED — by code-reviewer

## Summary
- E196/E206: `planLaneClose` (first-run, tracked shape) now plans a per-file copy of the lane's git-ignored `.current/<lane>/` files; `executeShippedIgnoredCopy` runs it after the close commit. `planAbandonCurrentHarvest` replaces the AC8 tracked-content early return with a per-file plan. One copy loop (`copyLaneIgnoredFiles`) is shared with the `alreadyClosed` re-run; `e125b.harvest-refresh-line` stays byte for byte.
- E225/E353: new `checkLanePendingTickets` advisory in `runCheck`. `checkOrphanLanes` now counts `errors.length > 0` as stranded and prints `e225.orphan-errors-*` after the unchanged orphan line. `docs/lane-protocol.md` §6 gains the `doc.s6-agc-check` line.
- E205: `start` saves primary's porcelain status into the per-worktree git dir. `finish` diffs path sets before its first check and warns.
- T-E196-08: the §3 known-gaps line is removed. The expected-red manifest names the two re-pin targets.
- Scope is clean: the diff touches only `bin/agc-init.mjs`, `docs/lane-protocol.md`, the expected-red manifest and `.current/e196/**`.
- Verdict: CHANGES_REQUESTED. There is one required finding (R1): the first-run `--shipped` tracked shape now silently overwrites primary's own differing `.current/<lane>/pending-tickets.md`. Base refuses this case with `e287.preserve-carry-refuse`.

## AC Completeness
AC-E196-1 — implemented — bin/agc-init.mjs `planLaneClose` (`ignoredCopy`), `executeShippedIgnoredCopy`, call site after `executeLaneClose` in `runFeatureFinish`; probe: 2 files copied, untracked in primary, exit 0, branch deleted
AC-E196-2 — implemented — `planAbandonCurrentHarvest` `files` branch + `executeAbandonCurrentHarvest` `files` path; probe: 1 file copied, branch kept, tracked files not copied
AC-E196-3 — implemented — `ignored.length === 0` returns null (abandoned); `ignoredCopy.length === 0` returns early (shipped)
AC-E196-4 — implemented — `grep -n "laneIgnoredStateFiles("` shows exactly the definition (:2803), the `alreadyClosed` call (:2840), the first-run `--shipped` call (:2883) and the `--abandoned` call (:1999); one copy loop `copyLaneIgnoredFiles` (:3090)
AC-E196-5 — implemented, with a declared deviation for `pending-tickets.md` (see Correctness D1) — shipped copy runs after the commit; abandoned re-run skips identical copies and copies over differing ones, except that a differing `pending-tickets.md` destination is refused (E287 rule)
AC-E196-6 — partial — the abandoned rule is correct (see D1). For `--shipped` first run, setting `covered = true` from the copy list also disarms the E287 carry check (R1)
AC-E196-7 — implemented — `ignoredCopy` is `[]` when not tracked; `ignored === null` keeps the whole-dir path
AC-E196-8 — implemented — `grep -c 已知缺口` = 0, `grep -c E196` = 0, one removed line in §3, harvest sub-item now directly followed by the E383 ledger sub-item
AC-E196-9 — not in this round (T-E196-09, qa)
AC-E225-1 — implemented — `checkLanePendingTickets`: linked-worktree gate, `resolveCurrentLane`, `findAppliedProvenance` over the worktree `docs/backlog.md` or `""`, errors verbatim in parser order
AC-E225-2 — implemented — returns on not-linked, `_primary`, absent file, zero errors
AC-E225-3 — implemented — try/catch prints `e225.lane-check-skip`; the `runCheck` exit path is untouched
AC-E225-4 — implemented — two-argument parse kept; `has` ORs `errors.length > 0`; orphan line text unchanged (only `laneOf.get(branch)` hoisted to `lane`); errors block printed after it
AC-E225-5 — implemented — no `tools/` or `dist/` path in the diff; finish's refusal path untouched
AC-E225-6 — implemented — one line after the `## 6.` heading + blank line, before `寫進 \`to-integrator.md\``; text matches `doc.s6-agc-check`
AC-E205-1 — implemented — snapshot written after the `base-sha` write; probe: file at `.git/worktrees/lane/agc-primary-status`, lane `git status --porcelain` empty; silent on success
AC-E205-2 — implemented — `warnPrimaryNewPaths` runs right after the target worktree resolves; sorted, `escapeSegmentForDisplay`; probe: new untracked, modified, rename (both sides) and a tab-name path all named
AC-E205-3 — implemented — path-set diff; probe: a pre-dirty `pre.txt` changed in between is not named
AC-E205-4 — implemented — `isFinishOwnPath` drops the history, archive and abandoned prefixes and the lane path prefix
AC-E205-5 — implemented — ENOENT is silent; other read or `git status` failures print `e205.finish-check-skip`
AC-E205-6 — implemented — try/catch around the snapshot write prints `e205.start-snapshot-warn`; `lane:` still printed, exit unchanged
AC-E205-7 — implemented — snapshot lives in the per-worktree admin dir; probe: absent after finish
AC-L1 — implemented — `git diff --name-only` lists only owned paths
AC-L2..L7 — qa scope (T-E196-10); the targeted suite run is under Verification below

## Correctness

**R1 (required) — `--shipped` first run, tracked lane dir: the E287 carry refusal is bypassed and primary's own file is overwritten.** bin/agc-init.mjs:2539 (`shippedFindingsTarget`) sets `covered = close.harvestSrc !== null || close.ignoredCopy.some(...)`. `planFindingsPreserve` (:2580) runs the `carryAbs` check (`e287.preserve-carry-refuse`) only inside `if (!target.covered)`. The case:
- a tracked lane dir;
- an ignored, worktree-only `pending-tickets.md`;
- primary holds its own differing `.current/<lane>/pending-tickets.md`.

In that case `git mv` carries primary's file into `<hist>/`, and `copyLaneIgnoredFiles` then overwrites it with the lane's bytes. Reproduced in a temp fixture (exclude rule `pending-tickets.md`, primary file `PRIMARY OWN BYTES`):
- base `e5da97a`: exit 1, `e287.preserve-carry-refuse`, nothing moved;
- HEAD: exit 0, the history file holds the lane's bytes, and primary's bytes are gone.

No existing test pins the carry refusal, so every suite stays green. The diff introduced this regression. The spec's shipped bullet (covered when the copy list includes the file) does not require dropping the carry check. AC-E196-6's "no refusal occurs" applies only to its own setup, which has no primary copy.

Fix, either way:
- (a) keep `covered` as the spec states and run the carry check whenever `target.carryAbs !== null`, whatever `covered` is; or
- (b) mirror the abandoned rule: covered only when the copy list includes the file AND `carryAbs` is absent.

(a) leaves the spec text literally intact. Add a fixture test for this shape (base refuses → HEAD refuses), or ask qa to add it under T-E196-04.

**D1 (judged; no change requested) — the declared AC-E196-6 `--abandoned` deviation.** `abandonedFindingsTarget` (:2550) sets covered = the plan includes the file AND no history destination exists. My verdict: correct and necessary.
- `test/e287-finish-findings.test.mjs` "AC-E287-3: a differing file already at the history destination is refused" uses exactly the tracked + ignored-pending shape.
- Non-owned `test/e335-symlinked-pending-harvest.test.mjs` AC-E335-4 (×2) pins "uncovered destination symlink → refuse, never replaced, nothing written through it".

Under the literal "covered = plan includes", both of those become copy-over. AC-L7 forbids turning e335 red, so the literal spec cannot be satisfied as written. The refinement does not weaken AC-E196-6:
- the bullet says covered "**only when** the per-file plan includes that file", a necessary condition the refinement keeps;
- AC-E196-6's setup has no prior destination, so it is covered and nothing is refused.

What it does narrow is AC-E196-5's copy-over rule, for `pending-tickets.md` only. A re-run over a differing history copy refuses (fail-closed, nothing lost) instead of overwriting. That is the E287 "never overwrite a different findings file" contract, which is the safer choice. → Recommended (not blocking): PM records this carve-out in the spec (AC-E196-5 / -6 wording), together with whichever R1 rule the sr picks, so qa tests against consistent text. The sr should also have mailed the AC-L7 conflict rather than resolved it alone, but the resolution is the one I would have asked for.

**C1 (recommended) — primary's own non-findings ignored files carried by `git mv` are overwritten.** For any other git-ignored file that primary itself holds at `.current/<lane>/<rel>` with the same relpath as a lane ignored file, the first-run copy (`cpSync force: true`) now replaces primary's carried bytes with the lane's. Base did the opposite: primary's copy survived and the lane's was lost. This follows from the spec's copy rule and is rare, so I do not block on it. Worth one line in the spec's Out of Scope.

**Checked, no finding:**
- **Re-run path byte-identical.** `executeHarvestRefresh` passes the same `fail` text and `head` text as before. The stdout write is the same `head + items`.
- **Tracked vs ignored classification.**
  - Shipped `tracked` is read on primary (`hasTrackedContent(repoRoot, …)`), abandoned on the lane (`hasTrackedContent(lanePath, …)`), as the ACs require.
  - `base-sha` is excluded by `laneIgnoredStateFiles`.
  - The untracked shape never reaches the per-file path.
- **Node 20 vs 22.**
  - `cpSync(file, file, {force:true})` behaves the same on both.
  - A carried primary symlink at the destination was replaced, not written through, on both v22 and v20.20.2 (probe; the outside target was untouched).
  - Link-over-link for non-pending symlinked lane files on an abandoned re-run is the same exposure the existing re-run copy has (spec Out of Scope).
- **E225.**
  - `tools/lane-ticket-allocation.ts` is untouched and finish's refusal is unchanged.
  - The orphan line is byte-identical.
  - The lane check sits in its own try/catch, and `runCheck`'s exit-code computation is untouched.
- **E205.**
  - The snapshot is resolved via `git rev-parse --git-path agc-primary-status` in the lane worktree.
  - The compare runs before the merge guard and every mutation, so it cannot see finish's own writes.
  - Every failure path inside `warnPrimaryNewPaths` either returns silently or prints the skip line. None throws, so teardown is never blocked. The `canonicalPath` calls run on paths finish already canonicalised.
  - `-z` rename entries yield both sides (probe: `README.md` and `RENAMED.md`).
  - A lane worktree under primary is excluded via `laneRelPrefix` (probe).
  - `--no-optional-locks` is a read-only addition; the output is identical.

**Expected-red sampling (4a):** `qa_reports/expected-red_e196-agc-init-lane-checks.txt` exists. Both entries are locatable: `test/e351-lane-protocol-gaps.test.mjs:81` (AC-E351-3), `test/e383-lane-ledger-worktree.test.mjs:182` (AC-E383-7).

## Quality
- No dead code. The shared loop removed the duplicated copy and refuse code from `executeHarvestRefresh`. Names follow the surrounding conventions.
- optional: `primaryStatusSnapshotPath` / `primaryStatusBytes` / `gitErrorReason` sit between `parsePorcelainZ` and `escapeRegExp`, in a new section header, which is fine.
- Comment discipline (4b):
  - New comments are short and say why.
  - String ids appear as `Copy / Strings …` markers, the file's existing convention.
  - There are no absolute local paths.
  - Ticket ids appear only in a section header label (`(E205)`), matching existing headers such as `(E214 --shipped, E217 --abandoned specs/)`. Kept.
  - `agc check` in the lane reports no comment warnings touching the diff.

## Architecture
No architecture spec. Layering is unchanged: everything lives in `bin/agc-init.mjs`, and `tools/` / `dist/` are untouched (AC-E225-5, AC-L2). Snapshot location and the E225 entry point match the spec's Dependencies decisions.

## Security
- All git calls use `execFileSync` / `gitTry` argv arrays, no shell.
- New E205 paths are escaped with `escapeSegmentForDisplay`.
- E225 prints parser errors verbatim (spec-mandated).
- The snapshot path comes from git, not from user input.
- No secrets.
- optional: `e196.copy-item` prints `rel` unescaped, the same as the existing `e125b` item line.

## Performance
- `--shipped` tracked first run: one extra `git ls-files`.
- Each finish: one `git rev-parse` and one `git status --untracked-files=all` on primary.
- Each start: the same pair.
- No loops over large sets beyond a Set diff (O(n)). No regression of note.

## Verification
- Probes (temp fixture repos in $TMPDIR, base copy staged in the scratchpad) cover the shipped/abandoned ignored copy, the carry regression (base vs HEAD), the carried-symlink case on Node 22 and Node 20, the E205 rename/escape/pre-dirty/lane-inside-primary cases and the snapshot lifetime.
- Targeted suites (Node 22): 19 files run:
  - finish-lifecycle: agc-feature-lifecycle, agc-feature-finish-history, e180, e213, e217, e246, e287, e298, e335;
  - start and adapters: e291, agc-adapters;
  - lane-protocol docs: lane-ticket-allocation, e290, e351, e383;
  - init/eject and lane defaults: e106, e108, e130, e125a.

  Result: 416 tests, 412 pass, 2 fail. The 2 fails are exactly the expected-red manifest entries (AC-E351-3, AC-E383-7); the remaining 2 are not failures. No unexplained reds.

## Verdict
CHANGES_REQUESTED — R1: the first-run `--shipped` tracked shape drops E287's carry refusal and overwrites primary's own differing `pending-tickets.md`, a data-loss regression vs base. The declared `--abandoned` deviation (D1) is correct and should be recorded in the spec by PM.

## Round 2 — APPROVED — by code-reviewer

covers: T-E196-01, T-E196-02, T-E196-03, T-E196-08

Range: `7f02063..HEAD` (PM spec amend 328c300, sr fix 38e2181, lane state 62bbea1), and the whole lane `e5da97a..HEAD` re-checked against the amended spec.

## Summary
- The sr fix moves the `e287.preserve-carry-refuse` check in `planFindingsPreserve` (bin/agc-init.mjs:2584-2597) out of `if (!target.covered)`. It now runs whenever `target.carryAbs !== null`. The `e287.preserve-differs-refuse` destination check stays inside `!covered` (:2598). This is option (a) from round 1.
- PM amend 328c300 records option (a) and adds case `AC-E196-6-carry`. It also writes down the D1 `--abandoned` carve-out (the AC-E196-5 `pending-tickets.md` exception) and adds the C1 line under Out of Scope. The code matches all of it.
- Since round 1, only `bin/agc-init.mjs`, `specs/e196-agc-init-lane-checks.md` and `.current/e196/**` changed. Scope is still clean.
- Verdict: APPROVED. R1 is resolved, nothing regressed, and no required findings remain.

## AC Completeness
Round 1's lines still hold for every AC except the two below, which the amend changed:
AC-E196-5 — implemented — the `pending-tickets.md` exception (refuse with `e287.preserve-differs-refuse`, no overwrite) is `abandonedFindingsTarget` :2553-2556 plus `planFindingsPreserve` :2598-2606, unchanged since round 1. Every other ignored file keeps the copy-over rule.
AC-E196-6 — implemented — `--shipped` first run: `covered` comes from the copy list (:2539), and the carry check runs regardless of it (:2586-2597). `--abandoned`: covered only when the plan includes the file and no destination exists (:2553-2556). Probes below.
AC-E196-9 / AC-E196-6-carry test case / AC-L2..L7 — qa scope (T-E196-04, -09, -10)

## Correctness
**R1 — resolved.** I re-ran the round-1 fixture in a temp repo in $TMPDIR. It has a tracked lane dir, `pending-tickets.md` excluded, an ignored worktree-only lane `pending-tickets.md`, an extra ignored `notes.local` and a merged lane. Each case ran against HEAD and against base `e5da97a`, which was staged in the scratchpad.
- **Case 1, primary holds a differing `.current/e9/pending-tickets.md`.** HEAD: exit 1 with the `e287.preserve-carry-refuse` text.
  - Primary's bytes are intact, HEAD is unchanged (no close commit), and `git status --porcelain --untracked-files=all --ignored` is byte-identical before and after.
  - No history dir was created. The worktree, the lane file and the branch are all kept.
  - Base gives the identical result. Round-1 HEAD exited 0 and lost primary's bytes.
- **Case 2, no primary copy.** HEAD: exit 0, no refusal. `<hist>/pending-tickets.md` is one regular file holding the lane's bytes, the E287 warning names it, `notes.local` is copied (the E196 copy) and the worktree is removed. Base gives the same result, except that it does not copy `notes.local`, which is the E196 gap.
- **Case 3, primary holds an identical copy.** HEAD: exit 0, no refusal, the history file holds the lane's bytes. Base gives the same result.

**No regression from the move:**
- Only first-run `--shipped` sets `carryAbs`, and only for the tracked shape (:2540). The `alreadyClosed` re-run (:2533) and both `--abandoned` targets (:2557, :2573) pass `carryAbs: null`, so the re-run, `--abandoned` and the D1 rule are byte-for-byte unaffected.
- `harvestSrc` is non-null only when `!tracked` (planLaneClose). So for the untracked shape `carryAbs` is null and the old `covered`-via-harvest path is unchanged.
- The move therefore changes behaviour only in the new E196 combination (tracked and covered via `ignoredCopy`), and there it restores base behaviour.
- The suites below cover E287 (incl. AC-E287-3 and the R1-* re-run pins) and E335 (AC-E335-4).

**Expected-red sampling (4a):** the manifest is unchanged since round 1. Both entries are locatable (`test/e351-lane-protocol-gaps.test.mjs:81`, `test/e383-lane-ledger-worktree.test.mjs:182`) and are the only two reds.

## Quality
- The fix is a pure move plus a two-line comment, with no duplication. The header comment of `planFindingsPreserve` (:2577-2579) now says only the destination check is skipped, which matches the code.
- Comment discipline (4b): the new comment is short, says why (the `git mv` carry would be overwritten), has no ticket ids, no local paths and nothing sensitive. `agc check` in the lane reports OK (4.19.4), with no comment warnings on the diff.

## Architecture
No architecture spec. The change stays inside `bin/agc-init.mjs`, and the station map row in the spec now names `planFindingsPreserve`.

## Security
No new input, shell or path surface. The refusal fails closed before any mutation.

## Performance
No change: one `lstat` and one byte compare, as on base, now also run on the covered path.

## Verification
- Probes: see Correctness (scratchpad fixture, HEAD vs base, Node 22).
- Targeted suites (Node 22): agc-feature-lifecycle, agc-feature-finish-history, e213, e180, e217, e287, e335, agc-adapters, e246, e291, e298, lane-ticket-allocation, e290, e351 and e383. Result: 310 tests, 308 pass, 2 fail. The 2 fails are exactly AC-E351-3 and AC-E383-7 from `qa_reports/expected-red_e196-agc-init-lane-checks.txt`, confirmed by running e351 and e383 on their own.
- `agc check` in the lane: OK.

**Findings:**
- required: none.
- recommended: none new. C1 and D1 are now recorded in the spec.
- optional: carried from round 1, still not blocking: `e196.copy-item` prints `rel` unescaped, the same as the existing `e125b` item line.

## Verdict
APPROVED. The carry refusal is armed again whenever `git mv` would carry a differing primary copy, so behaviour matches base. The amended AC-E196-5 and AC-E196-6 are met, and the targeted suites show no reds beyond the two in the manifest.
