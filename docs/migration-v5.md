# Migrating to v5 — one chain, code-reviewer judges

v5 keeps one routing chain and drops the old path where qa-engineer reviewed
the build and wrote PASS. This page says what changed, how to finish or restart
a feature that was mid-flight on the old path, and what to refresh in your
workspace after upgrading.

## What changed

- **One chain**: `pm → [architect] → qa-engineer → sr-engineer → code-reviewer`.
  qa-engineer writes the scenario tests first; sr-engineer builds to them;
  code-reviewer judges, writes `status=PASS` and owns `completed_tasks` /
  `tw_complete_task`. qa-engineer no longer writes PASS or FAIL.
- **Handoff schema 15 → 17** (v4.23.0 writes 15), migrated lazily on first
  read: `qa_round` and `qa_rounds_total` (and a pre-release `chain_path`) are
  dropped, and the new `sr_return_count` counter starts absent (read as 0). A
  `chain_path` sent by an old client is ignored. Nothing else in the handoff
  changes.
- **Upgrade every server that shares a workspace.** Once a v5 server has
  written a file-mode `handoff.md` at schema 17, an older server (v4.23.0 reads
  up to 15) refuses it as written by a newer server. Restart every MCP client
  on v5 before the first write.
- `resume_of` accepts only `code-reviewer`.
- The `sr_return` cap (2 sr-engineer → qa-engineer returns) applies to every
  file-mode feature. The count resets on every `pm:In_Progress` write, and the
  cap closes only that return edge: sr-engineer can still hand to
  code-reviewer or stop to pm.
- Error codes: `QA_ROUND_EXCEEDED` is gone (there is no qa round).
  `REVIEWER_COMPLETED_TASKS_REJECTED` and `NON_QA_COMPLETED_TASKS_REJECTED`
  are replaced by one code, `NON_JUDGE_COMPLETED_TASKS_REJECTED`: only the
  judge (code-reviewer) may record `completed_tasks`.

## A feature mid-flight on the old path

Read the handoff's current `(last_agent, status)` and take the matching row.
The five old-path steps the server no longer accepts are `pm → sr-engineer`,
`architect → sr-engineer`, `code-reviewer → qa-engineer`, `qa-engineer:PASS`
and `qa-engineer:FAIL`; a rejection names the code-reviewer route and points
here. A handoff already sitting at `qa-engineer:PASS` or `qa-engineer:FAIL`
can still leave it.

| Handoff is at | To finish |
|---|---|
| `pm:In_Progress` | Hand to qa-engineer (or architect). The build-entry gates and cut approval apply to `pm → qa-engineer`. |
| `architect:In_Progress` | Hand to qa-engineer. |
| `sr-engineer:In_Progress` | Continue to code-reviewer. |
| `sr-engineer:Blocked` | Write `sr-engineer:In_Progress` first, then continue to code-reviewer (`sr-engineer:Blocked → code-reviewer:In_Progress` is rejected). |
| `code-reviewer:In_Progress` | code-reviewer writes PASS itself, with `review_verdict: "APPROVED"`, `completed_tasks` and `qa_review`. |
| `qa-engineer:In_Progress` (reviewing a build) | Write `qa-engineer:Blocked` → `pm:In_Progress` → `code-reviewer:In_Progress` with `resume_of: "code-reviewer"`; or hand to sr-engineer, which needs `qa_reports/expected-red_<feature>.txt` or the no-new-test record. |
| `qa-engineer:FAIL` | sr-engineer fixes, then code-reviewer judges. |
| `qa-engineer:PASS` | The feature is closed. Open the next feature as usual. |

To **restart** instead of finishing: re-enter with `pm:In_Progress`, or start
a new `active_feature` once the feature lease allows it.

A release needs the gate feature closed by `(code-reviewer, PASS)`.

## Re-copy `~/.claude/agents/`

The Claude Code subagent templates changed: the qa-engineer template now runs on opus,
and `qa-visual.md` is gone (visual judging belongs to
`reviewer-visual.md`). Re-copy the templates into `~/.claude/agents/` and
delete any stale `qa-visual.md` there.

## `.current/skill-qa-visual.md`

No prompt or role loads that file name any more. If you kept local rules in
it, move them into `.current/skill-reviewer-visual.md`.

## The "judging in-context" wording

The Execution Profile sentence in `templates/agent-adapters/claude.md` (and the
`CLAUDE.md` it stamps) now reads: code-reviewer judging in-context, or
qa-engineer writing the tests in the builder's context, voids builder != judge.
Both roles are still dispatched as subagents, because the judge and the test
author must not share the builder's context.

## Re-stamp `agc-version`

Run `agc init` (or `agc check` to see what is stale). It updates the agc
block, and its `agc-version` stamp, in `CLAUDE.md` only. An existing
`AGENTS.md` or `.antigravityrules` is left as it is (`agc init` prints
`Skipped (already exists)`): bump the `agc-version:` line in each by hand to
the installed version, or delete the file and re-run `agc init`. Deleting and
re-running writes a fresh copy from the template, so any local edits in that
file are lost. Then run `agc check`; it must exit 0.

## SQLite / HTTP mode

Same transition table and same judge. SQLite does not store `sr_return_count`, so in SQLite the sr_return cap is not enforced.
No column and no SQLite schema version change.

Two build-entry checks run in file mode only: `CUT_APPROVAL_REQUIRED` and
`EXTERNAL_REFS_UNRESOLVED` (`SCOPE_DECISION_REQUIRED` and
`SOURCE_CREDIBILITY_UNVERIFIED` run in every mode). The expected-red manifest
check on the qa-engineer → sr-engineer hand-off (`REPRO_MANIFEST_MISSING`) is
file mode only too.

## Telemetry

Old sidecar rows carrying `QA_ROUND_EXCEEDED`,
`REVIEWER_COMPLETED_TASKS_REJECTED` or `NON_QA_COMPLETED_TASKS_REJECTED` show
as unregistered codes in `tw_gate_stats`. The `mean_qa_rounds` metric is gone.
