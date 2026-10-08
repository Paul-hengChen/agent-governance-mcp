# e275-advisory-upgrades

Source row: `docs/backlog.md` E275. Lane: e275 (`specs/fanout-e260-followups.md`, `docs/lane-protocol.md` §2-§3). Human disposition 2026-10-07: **upgrade all three**.

## Problem Statement

`npm audit --audit-level=high` exits 1 on base `f636029` (high 3, critical 1, moderate 6, low 2), so the Constitution §6 dependency-audit gate blocks every build in lanes e269, e264, e268. Three advisories published after the v4.4.1 release have no disposition in `docs/dependency-advisories.md`: GHSA-6qxp-vccf-f47h (`@modelcontextprotocol/sdk`, high, `>=1.12.0 <1.31.0`; direct `^1.29.0`, installed 1.29.0, published fixes through 1.32.1), GHSA-jqcg-44mw-7w3h (`proxy-addr`, critical, `<2.0.8`; transitive sdk -> express 5.2.1, installed 2.0.7, 2.0.8 published), GHSA-wq5f-xc86-pv6w (`sharp`, high, `<0.35.5`; held at 0.35.4 by `overrides.sharp: ^0.35.4`, 0.35.5 published). The `@xenova/transformers` high row is only the dependent-of-sharp finding (§5 pattern) and closes with sharp.

## User Stories

- As a maintainer of any lane or release, I want `npm audit --audit-level=high` to exit 0, so that the §6 build gate stops blocking unrelated work.
- As a future reader of `docs/dependency-advisories.md`, I want each new advisory to carry a decision and a re-review trigger in the existing record format, so that no advisory is waived ad hoc.

## Acceptance Criteria

- **AC1** — Given the upgrades are applied in the lane's own `node_modules`, when `npm audit --audit-level=high` runs, then it exits 0.
  proof: `npm audit --audit-level=high; echo "exit=$?"` prints `exit=0`.
- **AC2** — Given the lockfile is refreshed, when the installed tree is listed, then `@modelcontextprotocol/sdk` resolves to a version `>=1.31.0` (target: latest in `^1.x`, expected 1.32.1), `proxy-addr` to `>=2.0.8`, `sharp` to `>=0.35.5`.
  proof: `npm ls @modelcontextprotocol/sdk proxy-addr sharp` shows those versions with no `invalid` / `UNMET` markers.
- **AC3** — Given `package.json`, when read, then `dependencies["@modelcontextprotocol/sdk"]` floor is raised to the fixed version actually installed (e.g. `^1.32.1`) and `overrides.sharp` is `^0.35.5`; no other dependency, override or script entry changed. A `proxy-addr` override is added ONLY if a lockfile refresh alone leaves `proxy-addr <2.0.8` (the sr records which case applied).
  proof: `git diff f636029 -- package.json` shows exactly those lines.
- **AC4** — Given the upgrades, when the full suite runs, then it is green.
  proof: `node scripts/test-lock.mjs -- npm test` exits 0 with zero failing tests (baseline = pass/total measured in this lane at base `f636029` before the upgrade; any count change must be explained).
- **AC5** — Given `npm run build`, when run after the upgrade, then it exits 0 and produces no diff under `dist/` in this lane (dist is out of lane scope; a diff means the lane must stop and escalate, not commit dist).
  proof: `npm run build; echo "exit=$?"; git status --porcelain dist` prints `exit=0` and nothing.
- **AC6** — Given `docs/dependency-advisories.md`, when read, then the three dispositions are recorded in the file's existing format, each with GHSA link(s), dependency path, reachability, decision `upgrade`, and a re-review trigger:
  - new `### 6. @modelcontextprotocol/sdk` section (direct dependency; first-time package in the record — fast-uri §2 already names the sdk only as a transitive path);
  - new `### 7. proxy-addr` section (transitive via sdk -> express; record that it is fixed by lockfile refresh or by override, per AC3);
  - `### 4. sharp` gains a `#### Third round` subsection (trigger fired: new libvips-class advisory against `>=0.35.4`, per the §4 round-2 trigger text), leaving rounds 1-2 intact;
  - `### 5. @xenova/transformers` gets one added line noting it closes with #4 again (no new section).
  proof: `grep -nE '^### [67]\. |^#### Third round|GHSA-6qxp-vccf-f47h|GHSA-jqcg-44mw-7w3h|GHSA-wq5f-xc86-pv6w' docs/dependency-advisories.md` shows all of them.
- **AC7** — Given the record's stale header and residual table, when updated, then: the `## HIGH advisories (...)` heading count/parenthetical is updated to reflect 7 packages and the new re-dispositions; the "Out of scope: residual low/moderate findings" section is NOT re-tabulated or decided — it gets ONE new dated note (2026-10-07) stating the post-upgrade `npm audit` totals (as measured, severity counts) and that the composition may have shifted (e.g. the sdk/`@hono/node-server`/`hono` moderate rows after the sdk bump), still deliberately undecided, same "stale in composition, not in conclusion" treatment as the 2026-09-14 note. Moderate/low advisories are not upgraded or dispositioned.
  proof: `git diff f636029 -- docs/dependency-advisories.md` shows the heading edit and a single appended dated note in the residual section, with no changed table rows.
- **AC8** — Given the lane scope, when the diff is inspected, then only `package.json`, `package-lock.json`, `docs/dependency-advisories.md`, `specs/e275-*`, `qa_reports/*E275*`, `review_reports/*E275*`, `.current/e275/**` changed.
  proof: `git diff --name-only f636029` lists only those paths.
- **AC9 (stop-rule)** — Given the sdk upgrade turns any test red, when that happens, then the sr-engineer STOPS, makes no code or test edits, records the failure (failing test names, sdk version tried) in `pending_notes`, sets status Blocked, and the coordinator escalates to the integrator. A different fixed sdk version (e.g. 1.31.x instead of 1.32.1) MAY be tried once to bisect, as a `package.json` floor change only.

## Copy / Strings

| string id | exact text (quote verbatim) | source |
|---|---|---|
| N/A | — | no user-facing strings; the record text in `docs/dependency-advisories.md` is internal documentation authored-here following the existing sections' format |

## Visual Tokens

| token id | property | value (quote verbatim) | source |
|---|---|---|---|
| N/A | — | — | feature has no visual literals |

## Visual Widgets

| widget id | description | source-node |
|---|---|---|
| N/A | — | feature has no non-primitive widgets |

## Out of Scope

- Moderate and low advisories (including residual-table rows); no `npm audit fix` / `--force`.
- Any dependency other than `@modelcontextprotocol/sdk`, `proxy-addr` (transitive), `sharp` (override).
- Any code, test, `dist/`, `scripts/`, `content/` edit; version bump, CHANGELOG, backlog done-marking (release-engineer / integrator, post-PASS).
- Re-tabulating the residual low/moderate table.

## Dependencies / Prerequisites

- Lane worktree `../agent-governance-mcp-lanes/e275` has its own real `node_modules` (`npm ci` at base `f636029`, build clean); do not touch the primary's install.
- Must merge to `main` first: lanes e269, e264, e268 wait on it (`specs/fanout-e260-followups.md`).
- Visual Structural Assertions omitted: no `design/e275-*.md`, mode = no-design.
- Dispatch: `sr-engineer=fable` (human long-standing preference; coordinator persists after cut approval). Dispatch mode `feature` (dependency chore, no repro-first applies).
