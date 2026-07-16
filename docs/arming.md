# Arming the Opt-Ins

Several server capabilities ship **implemented but disarmed**: they do nothing until a workspace
explicitly opts in via `.current/.config.json` (and, for the usage sidecar, a client hook). That is
by design — each one trades context, disk, or human-checkpoint cost for a benefit not every
workspace wants. The failure mode this doc exists to prevent (backlog E27): an unarmed feature
*reads as dead* — a retrospective observing "no `usage.jsonl` was ever written" concluded the token
sidecar "was never implemented" and nearly filed a duplicate reimplementation ticket. If a feature
below appears inert in your workspace, check whether it is armed before filing anything.

Each section: how to arm it, the expected effect, and how to verify it's live.
Config-key reference details live in [docs/config.md](config.md).

## 1. Token-usage sidecar (`usage.jsonl` + `tokenBudgetPerFeature`)

Durable per-dispatch token accounting (`tools/usage-accounting.ts`) feeding the coordinator's
opt-in Token Budget Brake. **Double opt-in** — both steps required:

1. **Wire the hook** (Claude Code only): register `bin/agent-governance-usage-hook.mjs` as a
   `PostToolUse` hook with matcher `Task` in `~/.claude/settings.json` — exact JSON block in
   [README §PostToolUse usage hook](../README.md). Register it in at most ONE settings file.
2. **Arm the config key**: set `tokenBudgetPerFeature` to a positive finite number in
   `.current/.config.json`, e.g. `{ "tokenBudgetPerFeature": 500000 }`.

**Effect**: after each completed `Task` subagent dispatch, one JSON record (feature, dispatched
role, the four canonical `usage.*` token fields) is appended to `.current/usage.jsonl`; the
coordinator sums it feature-scoped and halts for human confirmation when the running total crosses
the budget (Token Budget Brake, `content/coord-06-host-token.md`). Either step missing = silent
no-op — no file, no accounting, coordinator falls back to the `agent-*.jsonl` hand-sum.

**Verify it's live**: dispatch any subagent via `Task`, then check `.current/usage.jsonl` exists
and gained a line whose `feature` matches the active feature. No file after a dispatch means one of
the two steps is missing.

## 2. `driftBaselineIds` — historical-drift noise fold

**Arm**: list already-shipped-and-reconciled task IDs in `.current/.config.json`:
`{ "driftBaselineIds": ["T-E7-01", "T-E7-02"] }`. Sanctioned writer: release-engineer, post-PASS
(appends the just-released feature's task IDs).

**Effect**: `tw_detect_drift` excludes the listed IDs from the vibe-coding-drift comparison and the
reported `tasksCompleted` array — long-lived workspaces stop re-reporting dozens of historical
completed-task rows as drift every run (one retro carried 105 items of such noise). Non-listed IDs
still surface; handoff-ahead / FAIL-Blocked drift directions are untouched.

**Verify it's live**: run `tw_detect_drift` before and after adding a known-shipped ID — the ID
disappears from the report. Absent key = empty baseline = pre-existing behavior.

## 3. `cutApprovalAutoTier` — cut-approval auto-tier

**Arm**: set the key (even `{}`) in `.current/.config.json`; threshold fields and defaults in
[docs/config.md §cutApprovalAutoTier](config.md#cutapprovalautotier--cut-approval-auto-tier-threshold-opt-in).

**Effect**: ticket cuts meeting ALL threshold conditions (small file count, low priority, no schema
change, not design-armed) auto-approve — the PM/coordinator sets `cut_approved: true` without
halting for the human, recording `cut-approved: auto-tier` in `pending_notes`. Absent key = every
cut halts for human approval (the default, and the last checkpoint you should remove). Advisory:
the server surfaces the key but never enforces the threshold itself.

**Verify it's live**: cut a ticket under the thresholds — the coordinator/PM proceeds without a
human halt and the handoff `pending_notes` carries the `cut-approved: auto-tier` line. Over-threshold
cuts still halt.

## 4. `staleDispatchNotifyFile` — stale-dispatch push channel (E22)

**Arm**: `{ "staleDispatchNotifyFile": ".current/stale-dispatch.notify" }` in
`.current/.config.json`; full semantics in
[docs/config.md §staleDispatchNotifyFile](config.md#staledispatchnotifyfile--stale-dispatch-watch-file-emit-opt-in).

**Effect**: when a `tw_get_state` read finds an in-flight dispatch stale (>15 min, `next_role` set),
the server writes the advisory payload to the watch-file (atomically, deduped per dispatch) so an
**external** watcher — fswatch, launchd, anything — can raise an alert without waiting for the next
pull. Absent key = pull-only advisory, byte-identical pre-E22 output. File-mode only; never blocks
the read.

**Verify it's live**: the 5-step check in
[docs/config.md](config.md#staledispatchnotifyfile--stale-dispatch-watch-file-emit-opt-in) —
arm, age a dispatch past 15 min, call `tw_get_state`, confirm `stale_dispatch.notify.emitted: true`
and the file exists; a second read shows `skipped_duplicate: true`.
