# QA Review — T-E102-01, T-E102-02

covers: T-E102-01, T-E102-02

Contract: the **E102 row in `docs/backlog.md`** + `docs/v4.0.0-execution-plan.md` §8
decision E. Mini-chain, backlog-row-as-spec — no `specs/` file exists and none is
required, so the AC-execution machinery (Phase 3.5) is dormant and was not treated
as blocking, per the assignment brief.

Code review: **APPROVED at round 2** (`review_reports/review_T-E102-01.md`), on
F1 fixed (ENOENT discriminator), F2 fixed (comment corrected), F3 declined
(optional, correctly). QA round 1 starts from that baseline.

## Expected-Red Diff

Phase 0.5. `qa_reports/expected-red_e102-agc-init-symlink-atomicwrite.txt` declares one entry:
`test/agc-adapters.test.mjs | KNOWN BEHAVIOUR (R3-A ...)`.

Pre-QA full suite: **1865 tests / 1864 pass / 1 fail** — the single fail is exactly
that manifest entry (`test/agc-adapters.test.mjs:684`), confirmed both by
code-reviewer (round 1 and round 2, independently) and re-confirmed here before
any edit. Diff: **empty** (1/1 manifest entries confirmed red, 0 unexplained reds).

Disposition: this is qa-engineer's own re-baseline target, not a stray regression
— the manifest's own text says inverting it is qa-engineer's task
("Inverting the assertions to pin the NEW (fixed) behaviour is qa-engineer's
task, not sr-engineer's"). Phase 0.5: **clean**, proceeding to re-baseline.

## Phase 1 — Review

Read `bin/agc-init.mjs`'s full diff against `HEAD` (`178cfa4`) and both review
rounds in `review_reports/review_T-E102-01.md`. Independently re-derived the
same conclusions the reviewer reached (not accepted on trust):

- `atomicWriteFile` now resolves `target` via `fs.realpathSync` before deriving
  `tmpPath`, so `renameSync` lands on the canonical path, not the link — read at
  `bin/agc-init.mjs:167-224`.
- The ENOENT catch's `lstatSync`-based discriminator (plain-missing vs dangling)
  is real but **unreachable from every call site** — `fs.existsSync` is `false`
  for both a dangling symlink and a plain-missing path, and all three call
  sites (`writeClaudeBlock`'s two branches, `upsertHostKey`) pre-guard with it.
  `atomicWriteFile` is not exported, so there is no unit-level way to drive this
  catch directly either. Confirmed by reading every call site myself, not
  taken from the review report.
- The dangling-symlink shape that backlog row `0f` actually cares about is
  handled earlier and differently: `writeClaudeBlock`'s `!fs.existsSync(target)`
  branch at **`bin/agc-init.mjs:88-89`** (verified the exact lines — `:88` is
  the `if (!fs.existsSync(target))` test, `:89` is the `fs.writeFileSync`) lets
  a dangling link be followed and the canonical file created, leaving the link
  itself intact. This branch is **pre-existing** (present before this ticket's
  diff — confirmed via `git diff HEAD` showing no changes inside
  `writeClaudeBlock`'s first `if` block) — E102 changed only the
  `atomicWriteFile` path, so this is a behaviour E102 *documents*, not one it
  *introduces*.
- Decision-E divergence (both halves) reviewed against `docs/v4.0.0-execution-plan.md:792-806`
  (read-only, `docs/` untouched by me): the record in `pending_notes` is
  accurate, and the reviewer's "better but different, not a regression"
  characterization holds up — write-through removes the silent-failure harm
  decision E was written to prevent, at the cost of repairing rather than
  refusing a dangling link (a typo'd dotfiles path now silently creates a file
  at the resolved location instead of surfacing the typo — small, and reported
  under `created`, not silent). This is a **ratification item for the human**,
  not a QA blocker; carried forward below and into the closing state write per
  the assignment's instruction not to drop it.
- No spec `Copy / Strings` or `Visual Tokens` H2 exists (mini-chain,
  backlog-row-as-spec) — Phase 3a/3b gates are dormant, consistent with the
  code-reviewer's own framing and the assignment brief. No copy or visual
  coverage gap: `bin/agc-init.mjs`'s two new user-facing error strings
  ("no such file or directory" / "... (dangling)") are internal diagnostics on
  an unreachable branch, not spec-governed UI copy.
- No architecture spec exists; none required. Single-file change
  (`bin/agc-init.mjs`), this lane's exclusive file.

No correctness/architecture issues beyond what code-reviewer already found and
closed. Nothing to escalate back to code-reviewer or PM.

## Phase 1.5 — Visual Compare

No `design/<feature>.md` file, no Visual Baselines H2. **Skipped** (no Visual
Baselines declared). Non-UI, CLI-only feature.

## Phase 3 — Tests

**Test File Discovery**: per the dispatch brief's `Test-file placement` line,
`test/agc-adapters.test.mjs` already holds the R3-A documented-behaviour test to
invert and is the right home for the new pins — no new file created.

**Spec-to-Test map** (backlog-row-as-spec, no `specs/<feature>.md` ACs; mapping
against the E102 row's own named obligations instead):

| Row obligation | Test |
|---|---|
| write-through on a live symlink (R3-A) | `E102/R3-A: a symlinked CLAUDE.md is written through the link ...` (inverted from the old KNOWN BEHAVIOUR pin) |
| fail-closed on a dangling one (row `0f`, discharged end-to-end as write-through repair per decision-E divergence, ratified by code-reviewer) | `E102/backlog-0f: agc init against a DANGLING CLAUDE.md symlink repairs it ...` (new) |
| the documented hardlink limitation | Not independently pinned as a behaviour test — hardlink handling is unchanged by this ticket (declared unsupported by decision, in a code comment `bin/agc-init.mjs:148-158`) and there is no fix to regress-guard; the comment's presence/accuracy was verified by direct reading in Phase 1 above rather than a new grep-based test, since two such comment-honesty tests already exist for this file's other classes (E101, `R3-B`/`R3-D` verified by code-reviewer via direct reading) and the row does not name a hardlink *behaviour* obligation, only a documentation one |
| R3-C: mode preservation (`0600` stays `0600`) | folded into the R3-A write-through test (asserts `mode === 0o600` after write-through) |
| R3-C: no `.tmp` residue on success | folded into the R3-A write-through test (`findTmpFiles` on both the canonical dir and workspace root) |
| R3-C: no `.tmp` residue on a **failed** write | `E102/R3-C: a failed write (read-only canonical directory) ...` (new) |

**Coverage gate**: `bin/agc-init.mjs` is a CLI script exercised end-to-end via
subprocess (`spawnSync`), not instrumented for line coverage in this suite
(consistent with every other test in this file) — noted explicitly per SOP 6c,
not measured.

**Security smoke**: covered by the existing `E100`/`E104`/`E111` boundary tests
in this file (malformed JSON, falsy values, oversized-shape arrays, binary
detection); no new access-control surface introduced by this ticket.

### New / changed tests (`test/agc-adapters.test.mjs`)

1. **Inverted** the "KNOWN BEHAVIOUR (R3-A ...)" test (was `:684`) into
   `E102/R3-A: a symlinked CLAUDE.md is written through the link ...`. Old
   assertions (`linkIsSymlink === false`, `canonicalStillHasOldBlock === true`)
   replaced with their opposites, plus: adopter prose above/below survives,
   exactly one BEGIN marker remains, mode `0600` survives, no `.tmp` residue in
   either the canonical dir or the workspace root, and `agc check` reports OK
   against the real file afterward (closing the "looks like success" loop the
   backlog row names).
2. **New**: `E102/backlog-0f: agc init against a DANGLING CLAUDE.md symlink
   repairs it ...` — pins the write-through-repair shape at
   `bin/agc-init.mjs:88-89` that code-reviewer verified end-to-end and named
   explicitly as pinnable in round 2's "Note for qa". Does NOT attempt to pin
   the `atomicWriteFile` ENOENT catch's `(dangling)` string — confirmed
   unreachable via the public CLI surface (see Phase 1 above and code-reviewer
   round 1/2 F1 discussion).
3. **New**: `E102/R3-C: a failed write (read-only canonical directory) ...` —
   chmods the canonical directory to `0o500` (no write bit) so the `.tmp` file
   can never be created, forcing an `EACCES` that propagates uncaught (no
   top-level try/catch wraps `runInit`'s adapter loop). Asserts non-zero exit,
   `EACCES` in stderr, zero `.tmp` residue, canonical file byte-identical, link
   intact. The **other** R3-C failure shape code-reviewer verified manually
   ("rename-fails-after-tmp-exists → EISDIR, tmp cleaned up") is **not**
   automated: reaching it requires `resolvedTarget` to already be a directory
   at rename time while surviving an earlier `fs.readFileSync(target, "utf-8")`
   as text — a contradiction at every current call site (both
   `writeClaudeBlock` and `upsertHostKey` read the target as text before
   `atomicWriteFile` is ever invoked) — and `atomicWriteFile` is not exported
   for a direct unit-level test. Same class of public-surface unreachability as
   F1's `(dangling)` diagnostic; disclosed here rather than silently
   substituted.

## Phase 3.5 — AC Execution

`Phase 3.5: skipped (no proof:-annotated ACs)` — no `specs/<active_feature>.md`
exists at all (backlog-row-as-spec mini-chain).

## Non-vacuousness proof (inverted test + both new tests)

Per the assignment's instruction to prove the inversion isn't vacuous:
`git stash push -- bin/agc-init.mjs` (reverting the whole diff to `HEAD`'s
pre-fix `atomicWriteFile`), re-ran `test/agc-adapters.test.mjs`:

```
not ok 26 - E102/R3-A: a symlinked CLAUDE.md is written through the link ...
ok    27 - E102/backlog-0f: agc init against a DANGLING CLAUDE.md symlink repairs it ...
not ok 28 - E102/R3-C: a failed write (read-only canonical directory) ...
# tests 38 / pass 36 / fail 2
```

- The R3-A test and the R3-C failed-write test both fail against pre-fix code,
  exactly as expected — the fix's absence is what they exist to catch.
- The dangling-symlink test (`#27`) **still passes** against pre-fix code. This
  is correct, not a gap: that test exercises `writeClaudeBlock`'s
  `!existsSync` branch, which is pre-existing and untouched by this diff (see
  Phase 1) — it was never expected to depend on the fix.

`git stash pop` restored the fix; re-ran the full file: **38/38 pass**. The
inversion and the two new tests are non-vacuous where they claim to be, and
correctly independent of the fix where the underlying behaviour predates it.

## Phase 4 — Run

- `npm test`: **1867 tests / 1867 pass / 0 fail** (was 1865/1864/1 before this
  round; +2 new tests, +1 net pass from the inverted test flipping green).
- `npx tsc --noEmit`: clean, exit 0.
- `npm run check:md-tables`: OK, 244 files scanned, 0 malformed tables.
- `npm run check:version`: OK (3.110.0); dist/index.js and package-lock.json
  parity confirmed. Advisory note about `HEAD` being past the last tag is
  release-engineer's concern, not qa-engineer's, and this lane does not
  release.
- **CI runnability**: `npm test` runs headlessly, zero human interaction.
- Diff scope re-derived independently: `bin/agc-init.mjs`, `tasks.md`,
  `NEW-TICKETS.md`, `.current/*`, plus the two evidence files, plus my own
  `test/agc-adapters.test.mjs` edit. `docs/` byte-untouched (`git diff HEAD --stat -- docs/`
  empty). `git status test/` before my edits was clean per code-reviewer's own
  measurement; my edits to it are QA-owned per Constitution §2.

## Known drift — acknowledged, not reconciled

`tw_detect_drift` reports T-E103-01 and T-E91-01 as completed-but-unmentioned.
Per the dispatch brief, this is residue from the finished E91+E103 feature
committed at `178cfa4` (a different feature on this same branch/worktree), not
this feature. Left untouched, not reconciled, per instruction.

## Decision-E divergence — carried forward for the human (not a QA finding)

Relaying, not re-litigating, per the assignment's instruction that these two
records must survive into the handoff:

1. **Decision C** (from the prior, already-finished feature on this branch):
   E103's resolution source is `~/.claude/agents/<role>.md`, not the
   `content/skill-<role>.md` the decision names. Amendment, not a defect —
   already shipped and reviewed in the prior feature.
2. **Decision E**: point (1) is discharged as literally written (the
   `realpathSync` catch inside `atomicWriteFile` does throw). End-to-end,
   `agc init` **repairs** a dangling `CLAUDE.md` link (via the pre-existing
   `writeClaudeBlock:88-89` branch) rather than refusing — code-reviewer
   judged this "better but different, not a regression," and I agree on
   re-derivation in Phase 1 above. This is a **ratification item for the
   human**, not an escalation — no QA FAIL and no round consumed on it.

## Verdict

**PASS** — T-E102-01, T-E102-02.

R3-A through R3-E all verified present and correct in the shipped diff (code
review APPROVED round 2; independently re-derived above). The expected-red
manifest's single entry was the intended re-baseline target and is now
inverted, non-vacuously, to pin the fixed behaviour. Backlog row `0f`'s three
named shapes are addressed: write-through (pinned), dangling/fail-closed
(pinned against the shape that actually discharges it, per the ratified
divergence), hardlink (unsupported by decision, documented, unchanged —
verified by reading, not newly tested). R3-C's two behaviours (mode
preservation, no-stranded-`.tmp`) are pinned on both the success and the
failure path, with the one unreachable failure-path variant disclosed rather
than silently skipped. Full suite 1867/1867, `tsc`/md-tables/version checks
clean, diff scope confirmed. No release action taken — PASS is a handoff, not
a ship.
## 2026-09-17T04:47:15.083Z — PASS — by qa-engineer

PASS. Inverted test/agc-adapters.test.mjs:684 (KNOWN BEHAVIOUR R3-A pin) into a fixed-behaviour pin: symlinked CLAUDE.md written through, link preserved, canonical updated, adopter prose preserved, mode 0600 preserved, no stray .tmp, agc check OK against the real file. Proved non-vacuous by reverting bin/agc-init.mjs via git stash, re-measuring (2/3 new/changed tests fail on pre-fix code as expected; the dangling-symlink test correctly still passes since it exercises pre-existing writeClaudeBlock:88-89, untouched by this diff), then restoring. Added two new pins per code-reviewer round 2's guidance: (1) dangling CLAUDE.md symlink -> agc init repairs it end-to-end at bin/agc-init.mjs:88-89 (exit 0, link preserved, canonical created with block) -- this is backlog row 0f's fail-closed obligation, discharged as write-through repair per the ratified decision-E divergence, not as the unreachable atomicWriteFile ENOENT catch; (2) R3-C failed-write (read-only canonical dir) leaves no .tmp residue and canonical/link untouched. Did NOT pin atomicWriteFile's "(dangling)" diagnostic string -- confirmed unreachable from every call site and the function isn't exported, matching the reviewer's finding. Full suite 1867/1867 (was 1865/1864/1), tsc/md-tables/version checks clean, diff scope confirmed (docs/ byte-untouched). Two divergence records relayed for human ratification, not treated as blockers: (1) Decision C's resolution source is ~/.claude/agents/<role>.md not content/skill-<role>.md (prior feature, already shipped); (2) Decision E point (1) discharged as literally written but agc init repairs a dangling link end-to-end rather than refusing -- better but different, not a regression, per code-reviewer. Known drift (T-E103-01, T-E91-01 completed-but-unmentioned) is residue from the finished E91+E103 feature at 178cfa4 -- acknowledged, not reconciled, per dispatch brief. Full review: qa_reports/review_T-E102-01.md.

## 2026-09-17T04:47:45.189Z — PASS — by qa-engineer

PASS. Inverted test/agc-adapters.test.mjs:684 (KNOWN BEHAVIOUR R3-A pin) into a fixed-behaviour pin: symlinked CLAUDE.md written through, link preserved, canonical updated, adopter prose preserved, mode 0600 preserved, no stray .tmp, agc check OK against the real file. Proved non-vacuous by reverting bin/agc-init.mjs via git stash, re-measuring (2/3 new/changed tests fail on pre-fix code as expected; the dangling-symlink test correctly still passes since it exercises pre-existing writeClaudeBlock:88-89, untouched by this diff), then restoring. Added two new pins per code-reviewer round 2's guidance: (1) dangling CLAUDE.md symlink -> agc init repairs it end-to-end at bin/agc-init.mjs:88-89 (exit 0, link preserved, canonical created with block) -- this is backlog row 0f's fail-closed obligation, discharged as write-through repair per the ratified decision-E divergence, not as the unreachable atomicWriteFile ENOENT catch; (2) R3-C failed-write (read-only canonical dir) leaves no .tmp residue and canonical/link untouched. Did NOT pin atomicWriteFile's "(dangling)" diagnostic string -- confirmed unreachable from every call site and the function isn't exported, matching the reviewer's finding. Full suite 1867/1867 (was 1865/1864/1), tsc/md-tables/version checks clean, diff scope confirmed (docs/ byte-untouched). Two divergence records relayed for human ratification, not treated as blockers: (1) Decision C's resolution source is ~/.claude/agents/<role>.md not content/skill-<role>.md (prior feature, already shipped); (2) Decision E point (1) discharged as literally written but agc init repairs a dangling link end-to-end rather than refusing -- better but different, not a regression, per code-reviewer. Known drift (T-E103-01, T-E91-01 completed-but-unmentioned) is residue from the finished E91+E103 feature at 178cfa4 -- acknowledged, not reconciled, per dispatch brief. Full review: qa_reports/review_T-E102-01.md.

