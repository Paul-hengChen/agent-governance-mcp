# Review — T-E141-01

covers: T-E141-01

Round 1 — APPROVED — by code-reviewer
Diff under review: `git diff cb7a665..HEAD -- scripts/verify-release.mjs` (commit `9fa486e`).
Contract: `specs/e141-tag-at-head-bookkeeping-tolerance.md` AC1-AC6.
Method: every AC was verified by EXECUTING the modified script against purpose-built fixture
repos in the scratchpad, not by reading the diff. No source file was modified by this review.

## Summary

- Check 1 (`tag-at-HEAD`) gains a path-derived tolerance: a tag not at HEAD still FAILs unless
  (i) the tag is an ancestor of HEAD and (ii) every commit in `<tag>..HEAD` touches only
  `.current/handoff.md`, `.current/<name>.jsonl`, or `tasks.md`. +88 lines, one file.
- All six ACs verified by execution. AC1 and AC4 confirmed byte-identical to the base
  (`cb7a665`) script by running both versions against the same fixture and diffing the output.
- AC5 — the half of the human's acceptance bar that matters most — holds: with the tolerance
  firing, an unpushed bookkeeping commit still FAILs Check 2 (`pushed-to-origin`).
- The `-m` choice for merge commits is correct and load-bearing. I verified independently that
  plain `diff-tree`, `-c`, and `--cc` ALL report zero paths for a merge that imports a source
  file — all three would vacuously pass. `-m` is the only mode that catches it.
- Verdict: APPROVED. Five non-blocking observations recorded below; none affect the ACs.

## Correctness

No blocking findings. Evidence, per AC:

**AC1 — tag == HEAD, byte-identical.** `scripts/verify-release.mjs:186-189` returns before any
new code runs. Fixture (tag at HEAD) printed exactly `OK: tag-at-HEAD`, no tolerance note. The
equality path is genuinely not the tolerance path.

**AC2 — tolerated pass prints the count.** Fixture reproducing the v3.111.0 shape (one commit
touching `.current/handoff.md` + `.current/metrics.jsonl` + `tasks.md`) printed:
`NOTE: tag-at-HEAD — tolerated 1 governance-bookkeeping commit(s) ahead of tag v1.0.0 (...)`
followed by `OK: tag-at-HEAD`. A three-bookkeeping-commit fixture correctly reported
`tolerated 3`. Counts are accurate.

**AC3 — offending sha and path named.** Fixture with a post-tag commit touching `src.txt`:
`FAIL: tag v1.0.0 (a3b5a1...) does not point at HEAD (8aafce...) — 1 of 2 commit(s) in range
touch non-bookkeeping paths: 8aafce4ed991 touches src.txt`. Both sha and path present.

**AC4 — non-ancestor keeps the ORIGINAL message.** `scripts/verify-release.mjs:196-205`. I built
a fixture whose tag sits on a divergent branch (`merge-base --is-ancestor` exit 1), then ran
BOTH the new script and the base `cb7a665` script against it. Output was character-for-character
identical: `FAIL: tag v1.0.0 (ee43ddf8...) does not point at HEAD (0bc4656b...)` — no range
enumeration appended, no new wording. The exit-code contract is read correctly: `execFileSync`
throws on non-zero, the `catch` sets `isAncestor = false`, and the code treats only the
non-throwing case as ancestry.

**AC5 — an unpushed release cannot look clean.** Verified with a real bare-remote fixture: push
main, then create the bookkeeping commit locally only. Result — Check 1 printed the tolerance
NOTE and `OK`, and Check 2 still emitted
`FAIL: HEAD (0200227e...) != upstream origin/main (3306d3f1...) — local commits not pushed`.
Check 2's body is untouched (`scripts/verify-release.mjs:256-279`) and compares `HEAD` to `@{u}`
directly, so the tolerance cannot reach it. The tolerance did not weaken Check 2.

**AC6 — merge handling and the empty range.** The author's stated rationale for `-m` is correct
and I confirmed it rather than taking it on trust. On a merge importing `scripts/evil.mjs` from
a side branch:

    plain diff-tree : []            <- zero paths, would vacuously pass
    -c              : []            <- zero paths
    --cc            : []            <- zero paths
    -m (chosen)     : [scripts/evil.mjs .current/telemetry.jsonl]

The script correctly FAILed that fixture, naming both the merge sha and the side commit's sha.
Choosing anything other than `-m` would reopen the hole. The empty-range claim at
`scripts/verify-release.mjs:216-217` is airtight: `tagSha !== headSha` plus `tagSha` being an
ancestor of `headSha` guarantees `rev-list tagSha..headSha` is non-empty, so the
`tolerated 0 commit(s)` branch is unreachable.

**Allowlist predicate** (`scripts/verify-release.mjs:165-171`). The spec writes `.current/*.jsonl`
as prose; the code implements `/^\.current\/[^/]+\.jsonl$/`. I tested the predicate against 19
adversarial inputs; all 19 behaved as required. Specifically rejected: `notcurrent/handoff.md`,
`xcurrent/handoff.md`, `Xcurrent/handoff.md`, `a/tasks.md`, `src/.current/handoff.md`,
`.current/handoff.md.bak`, `.current/handoff.mdX`, `.current/sub/x.jsonl`, `.current/x.jsonl.bak`,
`.current/.jsonl`, `.current/config.json`, `tasks.mdx`, `Tasks.md`, `.CURRENT/handoff.md`. All
three regexes are fully anchored and every `.` is escaped, so no metacharacter slips through.
`[^/]+` correctly confines the jsonl rule to a single level under `.current/`.

**Renames and deletes.** `--name-only` without `-M` reports rename as delete+add, so both paths
are judged: a fixture renaming `src.txt` FAILed naming `src.txt`. A commit deleting `src.txt`
also FAILed. Deleting an allowlisted file is tolerated (observation 4 below).

**Quoted / escaped paths.** Under default `core.quotePath`, a non-ASCII path is emitted quoted —
`".current/m\303\251trics.jsonl"` — which does not match any regex, so the range FAILs closed.
I also probed newline injection: a file literally named `.current/a<LF>b.jsonl` is emitted by git
as `".current/a\nb.jsonl"` with `\` and `n` as two separate bytes (confirmed by hexdump), so
`.split("\n")` cannot be induced to manufacture a forged allowlisted line. No injection vector.

**No git failure is swallowed into a silent pass.** I traced every exit from the new block.
There are exactly two passing exits: the `tagSha === headSha` early return (AC1), and the final
tolerated path, which is reached only after `rev-list` succeeded AND every `diff-tree` succeeded
AND `offenders` is empty. Every error path terminates in a FAIL: the ancestry `catch` sets
`isAncestor = false` and falls into `fails.push` (`:196-205`); the `rev-list` `catch` pushes a
FAIL and returns (`:207-214`); the per-commit `diff-tree` `catch` pushes into `offenders` and
`continue`s, and a non-empty `offenders` is always a FAIL (`:228-231`, `:236-243`). `runCheck`
(`:76-89`) converts any residual throw into a FAIL for the check. Fail-closed throughout.

## Quality

- The change is strictly additive as required. The diff is four hunks: two in the header comment
  block, two in the Check 1 region (`@@ -1,7 +1,11 @@`, `@@ -35,9 +39,13 @@`,
  `@@ -148,7 +156,22 @@`, `@@ -160,9 +183,74 @@`). Nothing after Check 1 is touched — `runCheck`,
  Check 2, Checks 3-6, and the `--close-out` block are all unmodified, which I confirmed both
  from the hunk boundaries and by comparing symbol occurrence counts against the base file.
  `node --check` passes.
- The header comment now describes the behaviour the file actually has. Item (1) states the
  tolerance, names the three allowlisted paths, and names both FAIL conditions; the `--close-out`
  paragraph is correctly updated to say the tolerance now covers the single bookkeeping commit
  automatically and that `--close-out` remains for real source changes and non-ancestor tags.
  Both descriptions match observed behaviour.
- Minor, non-blocking: the per-commit `catch` at `scripts/verify-release.mjs:225` interpolates
  the full 40-char `sha`, while the normal offender branch at `:230` uses `sha.slice(0, 12)`.
  Cosmetic inconsistency in FAIL output only.
- `[...new Set(...)]` at `:229` is necessary, not incidental: `-m` emits a path once per parent,
  so a path modified against both parents would otherwise be listed twice. Correct as written.
- Naming (`BOOKKEEPING_PATH_RES`, `isBookkeepingPath`, `pointsAtHeadFail`) and the argv-array
  `git()` helper usage match the surrounding file's conventions. No shell strings introduced.

## Architecture

No architecture spec exists for this feature; `specs/e141-tag-at-head-bookkeeping-tolerance.md`
is the contract. The implementation matches the decision record: option (a), tolerance
implemented inside Check 1, no new CLI flag and no new env var — I confirmed `argv` handling is
unchanged and `closeOut` is the only flag. The tolerance is automatic and path-derived exactly as
the Decision section requires, preserving the property that the operator cannot select the mode
wrong. The allowlist constant is declared at module scope immediately above Check 1 with a
comment tying it to SOP step 13a, which is the right seam. Boundaries were respected: the diff
touches no file under `content/` or `test/`, and no `docs/backlog.md` row was done-marked.

I agree with the author's scoping of VR-2 out of this ticket. `test/verify-release.test.mjs` is
qa-owned under Constitution §2, and VR-2 pinning the old always-FAIL behaviour is the expected
consequence of a deliberate behaviour change, not a defect in this diff. T-E141-02 already names
amending it as required work. No disagreement to record.

## Security

No findings. Every git invocation added here uses the existing `git()` / `execFileSync` argv-array
form (`:199`, `:209`, `:222`) — no shell string, no interpolation into a command line, so no
command-injection surface is introduced. The only externally-influenced values are `version`
(already validated against `/^\d+\.\d+\.\d+$/` at `:150` before reaching Check 1) and git-reported
path names, which are used solely as regex test subjects and as text in output. Path names are
never resolved, opened, or executed. As noted above, git's quoting makes it impossible for a
crafted filename to forge an extra output line and be mistaken for an allowlisted path — the
predicate fails closed on every quoted form. No secrets, no new network or filesystem boundary:
the new code performs read-only git queries.

## Performance

No regression versus base in the normal case, and no complexity-class problem in the intended
workload: a real release has one bookkeeping commit in range, so the loop spawns one `diff-tree`.

One non-blocking observation. The offender loop at `scripts/verify-release.mjs:220-233` spawns
one `git diff-tree` subprocess per commit in range and has no early exit — it deliberately
collects every offender to report them all, so it keeps spawning after the first failure. The
script accepts an arbitrary version argv, so a stale argument makes the range large. Measured
against this repo read-only: `v3.69.0..HEAD` is 263 commits, and the identical loop spawned 263
subprocesses in ~5s (~19ms/commit). That is a tolerable worst case, not a defect, and the base
script did no work here only because it FAILed immediately with no diagnostic. Worth considering
a range-size sanity cap or an early exit in a later pass; it does not block this ticket.

## Verdict

APPROVED — all six acceptance criteria verified by executing the modified script against
purpose-built fixtures; AC1 and AC4 are byte-identical to base, AC5's unpushed-still-FAILs bar
holds with the tolerance firing, the allowlist predicate rejected all 19 adversarial paths, and
the `-m` merge choice is independently confirmed as the only mode that does not vacuously pass.

## Observations (non-blocking, recorded not fixed)

1. **`-m` can over-report on a merge whose parent predates the tag.** Verified: if a branch
   forked BEFORE the tag is merged into the post-tag range, the merge's diff against that parent
   includes everything main gained since the fork — including the release commit's own source
   changes — so the range FAILs even though no post-tag commit introduced a source change. This
   does not arise in the SOP step 13a shape (one bookkeeping commit on a tag) and it fails in the
   SAFE direction: a spurious FAIL blocks and the message names the sha and path, whereas the
   alternatives that avoid it (`-c`, `--cc`, plain) reopen the vacuous-pass hole. Over-reporting
   is the right failure direction here. The code comment at `:222-224` explains why `-m` was
   chosen but does not note this trade-off; a sentence there would help the next reader.
2. **No early exit / no range cap** in the offender loop — see Performance.
3. **Full sha vs 12-char slice** inconsistency between `:225` and `:230` — cosmetic.
4. **Deleting an allowlisted file is tolerated.** A commit that deletes `.current/telemetry.jsonl`
   passes the tolerance (verified). Defensible, since the path is bookkeeping either way, but it
   is a behaviour the spec's allowlist table does not explicitly address.
5. **A non-ASCII allowlisted filename would fail closed** under default `core.quotePath`
   (verified). No such file exists in this repo — `metrics`/`telemetry`/`usage` are all ASCII —
   so this is theoretical.

None of these five meet the bar for CHANGES_REQUESTED. No new `L-RELTOOL-NEW-n` ticket is filed:
observations 1-5 are all confined to Check 1, this ticket's own edit surface, and are judgement
calls on an approved implementation rather than out-of-scope defects.
