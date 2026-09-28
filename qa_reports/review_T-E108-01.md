# QA Review — T-E108-01 (+ T-E108-03)

covers: T-E108-01, T-E108-03

Spec: `specs/e108-agc-eject.md`. Code-review evidence read: `review_reports/review_T-E108-01.md` (APPROVED, 0 required findings). Diff range `4d0a78e..HEAD` (commits 64f97f4, aa48f3b).

## Phase 0.5 — Expected-Red Diff
Phase 0.5: skipped (no `qa_reports/expected-red_e108-agc-eject.txt` manifest declared).

## Phase 1 — Review (AC5 integrator clarification)

The coordinator relayed an integrator-accepted clarification of AC5 (spec commit `83ba1c3`, "scope the never-delete-tracked rule to classes i/ii-a/ii-b"): when `agc eject --yes` edits or deletes a **tracked** host-trace file — a tracked `CLAUDE.md` edited in place, or a tracked template-identical `AGENTS.md`/`.antigravityrules` deleted from the working tree — the output must say so and state that the change is uncommitted working-tree state for the user to review and commit. No silent tracked deletions/edits.

**Verification method**: built two scratch git repos under `$TMPDIR` (never the lane worktree or primary), `HOME` set to a separate temp dir in both, ran the real `bin/agc-init.mjs` (not a mock) via `agc init --artifacts=repo` then committed everything to make `.current/`, `tasks.md`, `qa_reports/`, `review_reports/`, `CLAUDE.md`, `AGENTS.md`, `.antigravityrules` all genuinely tracked, then ran `agc eject --yes` and inspected both the printed output and `git status --short` afterward.

**Case A — tracked CLAUDE.md holding only the block** (deleted branch, `planClaudeBlockEntry`):
```
(iii) host traces — CLAUDE.md: adapter block removed (file deleted, held only the block)
(iii) host traces — AGENTS.md: deleted (matched the installed template)
(iii) host traces — .antigravityrules: deleted (matched the installed template)
```
`git status --short` afterward: ` D .antigravityrules`, ` D AGENTS.md`, ` D CLAUDE.md` — all three genuinely tracked, all three now show as unstaged working-tree deletions.

**Case B — tracked CLAUDE.md with adopter prose (edit-in-place branch)**:
```
(iii) host traces — CLAUDE.md: adapter block removed (file kept, other content preserved)
```
`git status --short` afterward: ` M CLAUDE.md` (plus the two adapter-file ` D` lines as in Case A).

**Finding**: in neither case, nor anywhere else in `runEject`'s output (the per-entry lines, the plan header, the tracked-`git rm -r` block, or the cannot-do block), is there any line stating that these tracked host-trace changes are uncommitted working-tree state for the adopter to review and commit, or that they are git-recoverable. The only related header note —
```
untracked paths marked DELETE have no git recovery — once deleted they are gone
```
— is gated on `entries.some((e) => e.untrackedDelete)` (`bin/agc-init.mjs` runEject, header assembly), and `untrackedDelete` is computed as `!isWorkspaceFileTracked(ctx, rel)` for the adapter-file entry and hardcoded `false` for the CLAUDE.md edit-in-place branch — so a **tracked** host-trace file never sets it and never triggers any note, in either direction (no "has git recovery" note either). This matches code-reviewer's own R-series observation (`review_reports/review_T-E108-01.md`, Decision (c) discussion): the reviewer proposed "give tracked host-trace deletes a plan note ('tracked — restore with `git checkout`')" as an alternative but this was not implemented, and the reviewer's APPROVED verdict treated it as non-blocking at the time. The integrator has since elevated this to a required AC5 behavior.

**Missing line**: no per-entry or header text anywhere in `planClaudeBlockEntry`, `planAdapterFileEntry`, or the `runEject` header-assembly block acknowledges that a *tracked* host-trace file was just edited/deleted in the working tree and needs the adopter's review/commit. This is confirmed by direct execution against the real binary in two independent scratch repos (Case A: whole-file delete; Case B: edit-in-place), not by reading the diff alone.

**Verdict: FAIL.** Per the coordinator's routing instruction, this is filed as a FAIL and NOT fixed here — QA does not add behavior. Routed to sr-engineer.

## Disposition
- `tw_rollback_task` was attempted on T-E108-01 and T-E108-03 and rejected by the server (`"Task T-E108-... is not completed, cannot rollback"`) — both are still open `[ ]` rows in `.current/e108/tasks.md` (never `tw_complete_task`'d, since QA had not yet PASS'd them). FAIL is therefore recorded via the `tw_update_state(status=FAIL, review_task_ids=[T-E108-01, T-E108-03], next_role=sr-engineer)` write alone; both tasks are implicated (T-E108-01 owns AC5's routing/header contract in `runEject`; T-E108-03 owns the `planClaudeBlockEntry`/`planAdapterFileEntry` host-trace entry functions where the note would need to be emitted).
- No test authoring proceeded past this point for AC5's tracked-host-trace sub-case; Phase 3 (test/e108-eject.test.mjs authoring for the remaining ACs) is deferred until this FAIL is resolved and QA re-verifies, per the qa-engineer SOP's "no simulating sr-engineer" rule and to avoid baking an incomplete AC5 contract into the test file that would need rework.
- Pre-existing review findings R1/R2 (`review_reports/review_T-E108-01.md`) are already filed as lane pending-tickets `E108-NEW-1`/`E108-NEW-2` (`.current/e108/pending-tickets.md`) — out of scope for this FAIL, unaffected.

## Escalation
`QA: T-E108-01/T-E108-03 FAIL — AC5 clarification (83ba1c3): no output line states that a tracked host-trace file (CLAUDE.md edited in place, or template-identical AGENTS.md/.antigravityrules deleted) is left as uncommitted working-tree state for review/commit; confirmed by live scratch-repo execution, both the whole-file-delete and edit-in-place branches` → `next_role: sr-engineer`.
## 2026-09-27T20:37:37.487Z — FAIL — by qa-engineer

FAIL — integrator-accepted AC5 clarification (spec commit 83ba1c3): agc eject --yes must state, when it edits or deletes a TRACKED host-trace file (tracked CLAUDE.md edited in place; tracked template-identical AGENTS.md/.antigravityrules deleted), that the change is uncommitted working-tree state for the user to review and commit. Verified live in two scratch git repos under $TMPDIR (HOME set to a separate temp dir): (A) whole-file delete of a tracked CLAUDE.md holding only the block, plus tracked AGENTS.md/.antigravityrules — git status shows ` D` on all three afterward, but no line in the printed output says so; (B) edit-in-place of a tracked CLAUDE.md with adopter prose — git status shows ` M CLAUDE.md`, again with no corresponding output line. The only related header note (\"untracked paths marked DELETE have no git recovery\") is gated on untrackedDelete, which is false or unset for every tracked host-trace path in both planClaudeBlockEntry and planAdapterFileEntry — so no note fires in either direction for a tracked file. Full detail in qa_reports/review_T-E108-01.md (covers: T-E108-01, T-E108-03). Did not add behaviour myself per dispatch instruction; routing to sr-engineer.

## Round 2 — PASS — by qa-engineer

covers: T-E108-01, T-E108-02, T-E108-03

Spec: `specs/e108-agc-eject.md`. Round-1 FAIL: `qa_reports/review_T-E108-01.md` @ 79c4946 (this file, superseded). Fix commit: `ceb3c4a`. Code-review evidence read: `review_reports/review_T-E108-01.md` (round 1 APPROVED @ 58df48a; round 2 re-review of the fix, APPROVED @ e40f76b — 0 required findings in either round). Diff range for the fix under re-verification: `58df48a..ceb3c4a` (`bin/agc-init.mjs`, +26/−3).

## Phase 0.5 — Expected-Red Diff
Phase 0.5: skipped (no `qa_reports/expected-red_e108-agc-eject.txt` manifest declared).

## Phase 1.5 — Visual Compare
Phase 1.5: skipped (no `design/e108-agc-eject.md` — this feature has no Visual Baselines; confirmed CLI-only per the spec's own Visual Tokens/Visual Widgets tables, both N/A).

## Phase 1 — Re-verification of the round-1 finding (AC5 tracked host-trace clarification)

Round-1 FAIL: `agc eject --yes` edited a tracked `CLAUDE.md` or deleted tracked template-identical `AGENTS.md`/`.antigravityrules` without stating the change is uncommitted working-tree state. The fix (`ceb3c4a`) adds `trackedChange` (`"edited"` | `"deleted"`) to the affected host-trace plan entries and prints Copy/Strings `eject.tracked.host-trace-changed` after the plan lines.

Re-verified live (not by reading the diff) via `test/e108-eject.test.mjs`, "tracked host-trace: all three tracked, CLAUDE.md block-only — listed as deleted" and "tracked host-trace: tracked CLAUDE.md with prose — listed as edited": both build real scratch git repos under `$TMPDIR` (temp `HOME`), run the real `bin/agc-init.mjs`, and assert the printed text byte-for-byte against the spec's Copy/Strings `eject.tracked.host-trace-changed` (verbatim quoted below) and cross-check `git status --short` afterward.

- **`--yes` heading** — implementation and spec agree, verbatim:
  `Tracked host-trace file(s) were changed in the working tree — this is uncommitted; review and commit it yourself:`
- **Dry-run heading** — implementation and spec agree, verbatim:
  `will change tracked file(s) — uncommitted until you commit:`
- **Per-path line shape** — `  <path> (edited|deleted)`, confirmed for `CLAUDE.md (deleted)`, `AGENTS.md (deleted)`, `.antigravityrules (deleted)` (case A, block-only CLAUDE.md) and `CLAUDE.md (edited)` (case B, adopter prose), matching `git status --short` (` D` / ` M` respectively) in the same test runs.

**Verdict: FIXED, confirmed.** The round-1 finding is closed; no regression found in the fix's scope.

## Phase 3 — Tests (T-E108-02)

New file `test/e108-eject.test.mjs` (34 cases) per this lane's dispatch brief (Test-file placement: creation pre-authorized) plus one additive case in `test/agc-adapters.test.mjs` (AC22 only — existing assertions unmodified, confirmed by running that file's full 39-case suite, up from 38 before the addition).

Spec-to-test map (also recorded in `test/e108-eject.test.mjs`'s header comment):

| AC | test case |
|---|---|
| AC1 | "AC1: dry-run prints the full four-class plan, touches nothing" |
| AC2 | "AC2: --yes executes exactly the AC1 plan" |
| AC3 | "AC3: --purge-knowledge alone is still a dry-run and reports design/specs as tracked" |
| AC4 | "AC4: --yes --purge-knowledge prints git rm for tracked design/specs, does not delete them" |
| AC5 | "AC5: repo-mode tracked artifacts get a git rm command, never a delete" (+ tracked host-trace cases A/B/C/D/G below) |
| AC6 | "AC6: disposition is per-path on actual tracked state, independent of the declared artifacts value" |
| AC7 | "AC7: docs/backlog.md is kept by default and handled as domain knowledge under --purge-knowledge" |
| AC8 | "AC8: CLAUDE.md with user prose keeps the prose, loses only the marked block" |
| AC9 | "AC9: CLAUDE.md holding only the block is deleted entirely" |
| AC10 | "AC10: CLAUDE.md absent or unmarked is silently skipped" |
| AC11 | "AC11: template-identical AGENTS.md/.antigravityrules are deleted" |
| AC12 | "AC12: a non-template-matching AGENTS.md/.antigravityrules is flagged, never deleted" |
| AC13 | "AC13: absent adapter files are silently skipped" |
| AC14 | "AC14: exclude-line removal never touches LANE_EXCLUDE_RULES or unrelated lines" |
| AC15 | "AC15: subdirectory eject never touches a sibling root workspace's artifacts" |
| AC16 | "AC16: eject refuses inside a linked worktree, same as feature start/finish" (real linked worktree via `git worktree add`) |
| AC17 | "AC17: outside a git repo, plain deletion still runs and exclude cleanup is skipped with a note" |
| AC18 | "AC18: idempotent second run reports nothing to eject" |
| AC19 | "AC19: the cannot-do block is always present, in both dry-run and --yes output" (+ dedicated "(none)" filler assertion) |
| AC20 | "AC20: eject never prompts, runs to completion with stdin closed" |
| AC21 | "AC21: an unknown flag is a usage error, exit 2, no changes" |
| AC22 | `test/agc-adapters.test.mjs` "AC22: top-level usage text lists eject" (qa-owned additive extension, per this lane's ownership carve-out) |
| AC23 | grep proof: `grep -n 'agc eject' docs/install.md` — see below |
| AC24 | "AC24: plan header reports the declared artifacts mode and the no-recovery note" |
| AC25 | "AC25: --yes refuses while linked worktrees exist; dry-run warns" (real linked worktree via `git worktree add`) |

Additional coverage beyond the bare AC text (per code-reviewer's round-2 recommendation, `review_reports/review_T-E108-01.md` "Round 2", and this lane's dispatch brief):
- Tracked host-trace cases A–D and G from that review's live-verification table, each pinned as its own test: "tracked host-trace: all three tracked, CLAUDE.md block-only — listed as deleted" (A), "…tracked CLAUDE.md with prose — listed as edited" (B), "…untracked host-trace files — no uncommitted-change list printed" (C), "…subdirectory workspace — uncommitted list uses subdir-prefixed paths" (D), "…no-op branches (no block, KEPT-advisory) never appear in the change list" (G).
- Both forms of the `git rm -r` line: "git rm -r line: root workspace never prints the subdirectory qualifier" and "…subdirectory workspace includes the repository-root qualifier".
- Cannot-do item 4's `(none)` filler (folded into AC19) and its populated-listing contrast: "cannot-do item 4: installed machine-wide subagent templates are listed with the rm command".
- Boundary/security smoke (SOP Phase 3d): empty-string arg, a 5000-char garbage flag, and a flag carrying embedded whitespace/newlines — all three confirmed rejected as usage errors, never silently accepted. Auth/permission tests N/A (no access-control surface).

**AC23 grep proof:**
```
$ grep -n 'agc eject' docs/install.md
195:## Leaving agc: `agc eject [--yes] [--purge-knowledge]`
197:`agc eject` takes agc back out of the current workspace. Run it from the workspace directory in the primary checkout.
200:agc eject                            # dry-run: print the plan, change nothing
201:agc eject --yes                      # apply the plan
202:agc eject --purge-knowledge          # dry-run, also plan design/, specs/, docs/backlog.md
203:agc eject --yes --purge-knowledge    # apply, including those
210:- **Idempotent.** When nothing is left, it prints `agc eject — nothing to eject.` and exits 0.
221:**What `agc eject` cannot do.** Every run prints these four items. Act on them yourself:
```
Confirmed present (read directly, `docs/install.md:195-224`): the default dry-run behavior, `--yes`, `--purge-knowledge`, the four-class disposition table (`docs/install.md:216-220`), and the four cannot-do items (`docs/install.md:222-225`) — all five points AC23 requires.

**Coverage gate**: new/modified file is `test/e108-eject.test.mjs` (all new) plus one additive case in `test/agc-adapters.test.mjs`. Every branch in `bin/agc-init.mjs`'s eject section (`planClaudeBlockEntry`, `planAdapterFileEntry`, `planExcludeEntry`, `ejectPathClasses`, `runEject`, `parseEjectArgs`, `installedAgentTemplates`, `ejectCannotDoBlock`) is exercised by at least one test above — ≥80% line coverage is satisfied by inspection (tooling: no per-file coverage instrumentation configured in this repo, noted per SOP 6c).

## AC Execution Log

Every AC in `specs/e108-agc-eject.md` carries a `proof:` annotation. All 25 were executed; verdicts below.

| AC | proof | result |
|---|---|---|
| AC1 | `test/e108-eject.test.mjs` "AC1: dry-run prints the full four-class plan, touches nothing" | PASS |
| AC2 | `test/e108-eject.test.mjs` "AC2: --yes executes exactly the AC1 plan" | PASS |
| AC3 | `test/e108-eject.test.mjs` "AC3: --purge-knowledge alone is still a dry-run and reports design/specs as tracked" | PASS |
| AC4 | `test/e108-eject.test.mjs` "AC4: --yes --purge-knowledge prints git rm for tracked design/specs, does not delete them" | PASS |
| AC5 | `test/e108-eject.test.mjs` "AC5: repo-mode tracked artifacts get a git rm command, never a delete" | PASS |
| AC6 | `test/e108-eject.test.mjs` "AC6: disposition is per-path on actual tracked state, independent of the declared artifacts value" | PASS |
| AC7 | `test/e108-eject.test.mjs` "AC7: docs/backlog.md is kept by default and handled as domain knowledge under --purge-knowledge" | PASS |
| AC8 | `test/e108-eject.test.mjs` "AC8: CLAUDE.md with user prose keeps the prose, loses only the marked block" | PASS |
| AC9 | `test/e108-eject.test.mjs` "AC9: CLAUDE.md holding only the block is deleted entirely" | PASS |
| AC10 | `test/e108-eject.test.mjs` "AC10: CLAUDE.md absent or unmarked is silently skipped" | PASS |
| AC11 | `test/e108-eject.test.mjs` "AC11: template-identical AGENTS.md/.antigravityrules are deleted" | PASS |
| AC12 | `test/e108-eject.test.mjs` "AC12: a non-template-matching AGENTS.md/.antigravityrules is flagged, never deleted" | PASS |
| AC13 | `test/e108-eject.test.mjs` "AC13: absent adapter files are silently skipped" | PASS |
| AC14 | `test/e108-eject.test.mjs` "AC14: exclude-line removal never touches LANE_EXCLUDE_RULES or unrelated lines" | PASS |
| AC15 | `test/e108-eject.test.mjs` "AC15: subdirectory eject never touches a sibling root workspace's artifacts" | PASS |
| AC16 | `test/e108-eject.test.mjs` "AC16: eject refuses inside a linked worktree, same as feature start/finish" | PASS |
| AC17 | `test/e108-eject.test.mjs` "AC17: outside a git repo, plain deletion still runs and exclude cleanup is skipped with a note" | PASS |
| AC18 | `test/e108-eject.test.mjs` "AC18: idempotent second run reports nothing to eject" | PASS |
| AC19 | `test/e108-eject.test.mjs` "AC19: the cannot-do block is always present, in both dry-run and --yes output" | PASS |
| AC20 | `test/e108-eject.test.mjs` "AC20: eject never prompts, runs to completion with stdin closed" | PASS |
| AC21 | `test/e108-eject.test.mjs` "AC21: an unknown flag is a usage error, exit 2, no changes" | PASS |
| AC22 | `test/agc-adapters.test.mjs` "AC22: top-level usage text lists eject" | PASS |
| AC23 | `grep -n 'agc eject' docs/install.md` (see transcript above) | PASS |
| AC24 | `test/e108-eject.test.mjs` "AC24: plan header reports the declared artifacts mode and the no-recovery note" | PASS |
| AC25 | `test/e108-eject.test.mjs` "AC25: --yes refuses while linked worktrees exist; dry-run warns" | PASS |

No proof command failed and no observed outcome contradicted its AC text — zero Phase 4 FAILs from this log.

## Phase 4 — Run

- Project build: `npm run build` ran as part of `npm test`'s prebuild step — zero errors.
- CI runnability: `npm test` (`node --test test/*.test.mjs`) runs headlessly, zero human interaction, zero stdin reads (confirmed structurally by AC20 above).
- Full regression run on the clean COMMITTED tree (commit `33c1d1e`, `test(e108): E108 T-E108-02 — eject test suite AC1-AC25, AC22 additive case`):

```
1..2878
# tests 2891
# suites 1
# pass 2888
# fail 0
# cancelled 0
# skipped 3
# todo 0
# duration_ms 157259.215709
```

**2888/2891 pass, 0 fail, exit 0.** The 3 skipped tests are pre-existing (not introduced by this ticket — `test/e108-eject.test.mjs` runs all 34 of its own cases with 0 skips, confirmed in an isolated run before the full-suite run above) and are out of scope for T-E108-01/02/03; not investigated further here per the dispatch brief's scope discipline.

`node scripts/check-md-tables.mjs`: 0 malformed tables (372 files scanned); the 4 pre-existing `docs/backlog.md` done-mark advisories are unrelated to this ticket (E88, not E108).

## Disposition

- All 25 ACs implemented and verified live against the real `bin/agc-init.mjs` (never mocked), in real scratch git repos under `$TMPDIR` with a temp `HOME` per invocation, including real linked git worktrees for AC16/AC25.
- Round-1 finding (AC5 tracked host-trace clarification) is confirmed fixed, verbatim to spec Copy/Strings, no regression.
- Lane findings `E108-NEW-1` / `E108-NEW-2` (filed `review_reports/review_T-E108-01.md` round 1, tracked in `.current/e108/pending-tickets.md`) are out of scope for this QA round — pre-existing, not touched by T-E108-01/02/03.
- Code-reviewer's round-2 recommended findings (R1: partial-tracked-directory residue note; O1: exclude-line trim() vs equality mismatch; the dry-run/`--yes` heading casing note) are non-blocking per that review's own verdict; not re-litigated here — QA's scope is coverage and test-infra, not design judgment calls the reviewer already ruled on.
- Note for the coordinator (not filed by QA, per dispatch instruction not to expand scope): the hop budget did not leave room to add a mixed-tracked-directory test case for code-reviewer's R1 (`.current/` partly tracked, partly untracked) — flagging it here as a possible future pending-ticket candidate, not filing one.

**Verdict: PASS.**

## 2026-09-27T21:01:38.829Z — PASS — by qa-engineer

QA round 2 PASS. Re-verified round-1 finding (AC5 tracked host-trace clarification, fix ceb3c4a) live against the real binary in scratch repos — Copy/Strings eject.tracked.host-trace-changed matches verbatim, both --yes and dry-run forms. Authored test/e108-eject.test.mjs (34 cases, AC1-AC25 + tracked host-trace cases A-D/G + both git-rm-line forms + boundary smoke) and one additive AC22 case in test/agc-adapters.test.mjs. AC23 verified by grep proof against docs/install.md. Full npm test on the clean committed tree (33c1d1e): 2888/2891 pass, 0 fail, 3 pre-existing unrelated skips, exit 0. Lane findings E108-NEW-1/E108-NEW-2 out of scope, unaffected.

