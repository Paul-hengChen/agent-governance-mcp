# Pending tickets — lane e226

```pending-ticket
lane_local_id: E226-NEW-1
title: verify-release／check-bookkeeping 沒有可在 adopter 使用的版本
priority: P3
depends_on: [E226]
source: pm, e226 cut (specs/e226-integrator-sop-portable.md, Decisions made at cut; integrator pre-review 2026-10-19)
body: |
  scripts/verify-release.mjs and scripts/check-bookkeeping.mjs set their root to the script's own
  parent directory (import.meta.url) and run git / gh there. Run from an agc install in an adopter
  workspace, `node <agc install>/scripts/verify-release.mjs --ci-check` silently checks the agc
  install's repository CI, not the workspace's. After E226/E349 the integrator SOP no longer calls
  either script generically: every CI verdict reads "the repo's CI check" (the CI run for that sha is
  green; record the run id), and the bookkeeping check is "the repo's bookkeeping check when the
  addendum names one"; this repo's addendum names both scripts. An adopter therefore has only the
  `gh run list --commit <sha>` / `gh run view` fallback for the CI check and no bookkeeping check.
  The other tools the SOP calls (fanout, mailbox-watch, lane-status, merge-invariants, test-lock,
  feature-rollup) use the working directory. Decide whether verify-release --ci-check takes the
  workspace from cwd (or a --repo flag) so the SOP can name it again, and whether a generic
  bookkeeping check is wanted at all.
```

```pending-ticket
lane_local_id: E226-NEW-2
title: integrator SOP still states repo facts the E349 list did not name
priority: P3
depends_on: [E349]
source: pm, e226 cut (specs/e226-integrator-sop-portable.md, Out of Scope)
body: |
  After E226/E349 the integrator SOP still carries facts true only in the agc repository: 5a says
  ci.yml triggers on feat/** (E298); the CI flake rule points at the load-sensitive list in
  docs/backlog.md; 5b-4 restarts the primary MCP server after a merge (only meaningful when the
  workspace is the agc server itself); 5a checks root NEW-TICKETS.md untouched; the full suite is
  written as npm test. Decide which become generic wording plus an addendum line, as E349 did.
```

```pending-ticket
lane_local_id: E226-NEW-3
title: lane-protocol addendum preamble says it only fills 見補充規則 places, but §5 now also carries integrator-SOP tool/CI/bookkeeping facts
priority: P3
depends_on: [E349]
source: code-reviewer round 1, lane e226
body: |
  docs/lane-protocol-addendum.md line 3 says the addendum only fills the generic 見補充規則 places
  in the lane protocol. After E226/E349, §5 also carries the tools, CI-check and 5c-bookkeeping
  lines that the integrator SOP points at ("the repo's CI check", "the repo's bookkeeping check
  when the addendum names one"). Those lines fill places in the integrator SOP, not 見補充規則
  places, so the preamble understates what the addendum holds. Either widen the preamble to say
  the addendum also supplies the repo facts the integrator SOP defers to, or give integrator-only
  facts their own heading. The heading structure is frozen by test/e290 in this wave, so this is
  a follow-up, not a change in lane e226.
```

## Applied
