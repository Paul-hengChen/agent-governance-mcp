<!-- pending-tickets for lane e384 (E179). New blocks go ABOVE ## Applied. -->

## Applied

```pending-ticket
lane_local_id: E386-NEW-1
title: fanout.mjs check <manifest> <lane> defaults --base to main, fails REF_NOT_FOUND in a repo without main, and the message does not name --base
priority: P3
depends_on: [E386]
source: pm, e384 lane cut (specs/e384-design-mode-and-handoff-target.md, Decisions — checkLane conclusion)
body: |
  tools/fanout-manifest.ts checkLane uses `opts.base ?? "main"`. In a repo whose integration
  target is not named main, the fan-in ownership check stops with
  `REF_NOT_FOUND: base ref "main" does not resolve (git rev-parse --verify) in <repo>` until
  --base is added by hand, and the message names neither the flag nor where the default came
  from. This is the same defect class as E386 (handoff --check). The manifest headers are not
  usable defaults: the `base:` sha is the planning base and can predate the dispatch base, so
  `base...branch` would list main's later merges as OUT; the integration branch, once it has
  merged the lane, makes `integ...branch` empty (RANGE_EMPTY).
  Proposed fix: resolve the default the same way E386 does for handoff --check (the target
  branch recorded under `### 核對 primary` in the manifest's `## 接手步驟` section when present,
  else main), and make the default-case REF_NOT_FOUND message name --base. Explicit --base
  behaviour, error codes and exit codes unchanged. Not done in lane e384 because
  tools/fanout-manifest.ts belonged to lane e383 in wave 13.
```
