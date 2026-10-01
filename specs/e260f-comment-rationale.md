# e260f-comment-rationale

Rationale cut from test comments in `test/e1*` and `test/e2*` by lane `e260f` of E260 (spec: `specs/e260f-test-comment-trim.md`). A trimmed comment keeps at most one pointer line to this file. Each task appends one `## <source path>` section per file whose rationale it moved, and rows to the table below for blocks that stay at 8-20 lines.

## Retained blocks
| file | line at HEAD | counted | reason |
|---|---|---|---|
| none yet | — | — | rows are added by the task that keeps a block |

## test/e106-init-artifacts-flag.test.mjs
The header carried a spec-to-test map (AC1-AC14, AC16); every test name starts with its AC number, so the map is derivable. Unit-level narrow typing of the config value (AC15) lives in `test/config-versioning.test.mjs`; this file adds only the end-to-end check (AC16) that a real `agc init` write round-trips through the real `loadConfig()`. The invalid-value case (AC2) runs on an empty repo, per the spec's own proof; the undeclared-advisory and outside-git cases (AC12, AC14) run outside git entirely. The root-cwd regression block was appended under the lane test-ownership carve-out in `docs/lane-protocol.md` section 3, touching no earlier assertion; its subdirectory counterparts live in `test/e239-init-subdir-exclude.test.mjs`.

## test/e108-eject.test.mjs
The header carried a spec-to-test map for AC1-AC25 (test names carry the AC number). The top-level usage-text case (AC22) lives in `test/agc-adapters.test.mjs`; the docs check (AC23) is a grep proof against `docs/install.md`. Extra coverage beyond the AC text, from the round-2 code review: the "tracked host-trace" cases, the `git rm -r` line in both the root and the subdirectory "(run from the repository root)" forms, and cannot-do item 4 with the "(none)" filler and with a populated `~/.claude/agents/*.md` listing. Scratch repos are never this checkout or the lane worktree, and never use the ambient global git config. The unsafe-segment case also covers the wider character set `agc init` later began refusing (backslash, C0 control range, DEL) with no code change of its own; the plan carries no exclude line at all because `planExcludeEntry` returns null.

## test/e112-drift-fanout-feature-scope.test.mjs
Covers the two drift distortions fixed in `tools/drift.ts` and `tools/evidence-lookup.ts`. "Qualifying" evidence means the file's last recorded verdict section is PASS, or the file has no verdict section at all (a hand-authored covering report). Fixtures are built on tmpfs and asserted against `detectDrift` output directly, never against this repo's own `qa_reports/` corpus or live line numbers, and never through the live `tw_detect_drift` tool (the running server may hold a stale `dist`, same rationale as `test/drift-archived-tasks.test.mjs`). The ticket's standing bar was to not weaken the detector in exchange for quiet, so each group proves both directions.

## test/e115-join-precondition.test.mjs
Style mirrors `test/e116-archive-on-feature-change.test.mjs` (mkWs plus `writeHandoffState`) and `test/feature-rollup.test.mjs` (real on-disk fixtures). AC7 and AC8 are inspection-based and live in the QA report, because the test file owns only proof by execution. AC1 uses a real `git merge-base --is-ancestor`; AC2 degrades an unknown or deleted branch to false plus an error, never a throw; AC4 returns `compared:false` with a reason for a missing split file, unrecognizable column or unparseable handoff; AC5 pins that no exported signature takes a second workspace-path argument; AC6 pins exactly one hook-point comment for the later merge-invariants work. AC9 covers markdown-decorated headers and backtick/underscore-decorated declared values: they normalize before matching, an internal underscore round-trips unchanged, and a decoration-only cell drops instead of becoming an empty declared member.

## test/e114-cut-approval-inheritance.test.mjs
The header carried a spec-to-test map (AC1-AC9, F1, F2); AC7 checks the v13 and v14 rows of `docs/schema-versions.md`, AC9 that zero gates read the field, AC5 mirrors `dispatch_mode` and `dispatch_pins` (feature-scoped carry-forward, dropped on feature change, no PM re-entry re-arm). F1 and F2 came from review round 1 of the original task.
