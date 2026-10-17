# Pending tickets — lane e283

## Applied

```pending-ticket
lane_local_id: E283-NEW-1
title: Integrator SOP adopts the E283 closed-status wording and the E322 owners mode (Stage 6 close, Stage 4 mid-wave base fix condition 2)
priority: P2
depends_on: [E283, E322]
source: e283 PM cut (spec D1/D2, D4), integrator pre-review to-lane#1
body: |
  `fanout.mjs validate` requires `## 接手步驟` only when the manifest status text starts with
  `已結案` (spec D1). Manifests closed with the older `結案 <date>` wording are never checked, so
  content/skill-integrator.md Stage 6 should name the canonical status line
  `**狀態：已結案 <日期>。…**` and the `## 接手步驟` sub-item headings (### 核對 primary, 已結案,
  待人類決定, 進行中的背景工作; optional 裝置, 工具). Stage 4 Mid-wave base fix condition 2 can now
  run `node scripts/fanout.mjs owners <manifest> --range <lane branch>...origin/<target>` instead
  of a hand comparison (exit 0 = no lane-owned path touched).
```

```pending-ticket
lane_local_id: E283-NEW-2
title: fanout.mjs generic usage does not list the owners subcommand
priority: P3
depends_on: [E322]
source: e283 PM cut (spec D4)
body: |
  test/e296-manifest-tier.test.mjs AC12 pins exactly three continuation lines in the generic
  USAGE, and that file was not owned by lane e283, so `owners` has its own usage line printed only
  on owners usage errors and in the scripts/fanout.mjs header. Add it to the generic usage and
  re-pin AC12 in the same change.
```

```pending-ticket
lane_local_id: E283-NEW-3
title: fanout owners --range and check exit 1 with a stack trace when git diff fails (e.g. no merge base), the same code as "hit"
priority: P3
depends_on: [E322]
source: code-reviewer, e283 review round 1 (review_reports/review_T-E283-01.md)
body: |
  The git diff call in the owners range path, and the same call in checkLane (present at base),
  is not caught: a range whose two sides share no merge base throws, prints a stack trace and
  exits 1, which owners defines as "at least one hit". Fail-safe direction (reads as owned), but
  the message misleads. Catch it and exit 2 with a named error code.
```

```pending-ticket
lane_local_id: E283-NEW-4
title: validate handoff absolute-path detector misses some boundaries and flags a date form
priority: P3
depends_on: [E283]
source: code-reviewer, e283 review round 1 (review_reports/review_T-E283-01.md)
body: |
  The detector follows spec D3's boundary list exactly. Missed: a path right after `**` (bold),
  after an ASCII colon or comma, inside `|…|`, `file:///…`, `$HOME/…`, UNC paths. False positive:
  a `~10/17`-style date. Widen the boundary set and exclude the date shape, with fixture tests.
```

```pending-ticket
lane_local_id: E283-NEW-5
title: test/e283-validate-handoff.test.mjs takes over two minutes (many CLI child processes)
priority: P3
depends_on: [E283]
source: qa-engineer, e283 qa round
body: |
  Most cases spawn the CLI. Call validateManifest in-process for the grammar cases and keep a few
  CLI cases for exit codes and stderr.
```
