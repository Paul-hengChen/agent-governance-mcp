# Pending tickets — lane e392

```pending-ticket
lane_local_id: E392-NEW-1
title: coord-03 still says `Task` on the no-host / lean path, where coord-02's `Task(...)` alias definition does not load
priority: P3
depends_on: [E392]
source: pm, E392 cut (integrator pre-review to-lane#1, 2026-11-03)
body: |
  E392 defines `Task(...)` once in content/coord-02-host-dispatch.md line 1 as shorthand for
  Claude Code's `Agent` subagent tool. coord-02 is tagged host:claude-code, so the lean
  composition (no `.current/.config.json` host, or a non-Claude-Code host) drops it. The core
  fragment content/coord-03-core-fallback.md line 1 still reads "the host advertises no `Task`
  tool, or the `Task` call returns a tool-error" and is composed into every profile, so on the
  lean path it names an undefined tool. Fix options: a host-neutral wording in coord-03 (e.g.
  "no subagent-dispatch tool"), or move the alias definition into a core fragment. The coord-03
  sentence is pinned by test/e96-dispatch-preference.test.mjs (t-fallback-genuine-unavailability),
  so the test changes with it; re-capture the compose goldens and re-measure the teamwork and
  lean budgets.

## Applied
