# e11-e12-release-integrity-batch

## Problem Statement
Two small, independent release-integrity/data-quality gaps surfaced during the
v3.74.0 release cycle. (1) `scripts/check-version.mjs` asserts `index.ts`'s
`Server()` version literal against `package.json`, but never checks the
*compiled* `dist/index.js` — the artifact `npx github:...#<tag>` consumers
actually run. At v3.74.0, `dist/index.js` shipped still carrying `"3.73.1"`
while source and `package.json` were correctly `3.74.0`; the check passed
anyway. The coordinator caught it in post-release verify (fixup commit
9b91db9), but nothing automated would have (E11). (2) The E8 release-time
metrics emit (`tools/metrics.ts`, wired at the release-engineer
terminal-marker write in `tools/handoff-orchestrator.ts`) fires on every write
matching the closing signature with no idempotency check. During v3.74.0
staging the signature fired twice, so `.current/metrics.jsonl` now holds two
identical `e8-success-telemetry` / `3.74.0` records differing only in `ts` —
corrupting the exact success-rate math E8 exists to make trustworthy (E12).

Both are small (~2 files each), single-module, code+test-only fixes
discovered in the same post-release verification pass, and are batched per
the existing small-fix-batch precedent in `docs/backlog.md`
§Recommended execution order (rows 3–4: C16+C10, C5+C18 — both closed under
a "single QA round" rationale).

## User Stories
- As a release engineer, I want `check-version.mjs` to fail loud when the
  compiled `dist/index.js` version literal doesn't match `package.json`, so
  that a stale-dist mis-versioned release (like the v3.74.0 near-miss) cannot
  pass the check silently.
- As a maintainer consuming `.current/metrics.jsonl` for cross-feature
  success-rate analysis (the E6/E5 consumers), I want each
  `(feature, released_version)` release recorded exactly once, so that a
  double-fired closing write cannot skew the aggregate one-pass-rate /
  average-rounds numbers.

## Acceptance Criteria

### E11 — check-version.mjs ships-vs-source blind spot
- **AC1** — Given `package.json` version `X` and `dist/index.js` containing a
  `Server({... version: X})` literal, when `node scripts/check-version.mjs`
  runs, then it exits 0 and the existing checks (index.ts-vs-package.json,
  CHANGELOG, git-tag advisory) are unchanged in behavior.
- **AC2** — Given `package.json` version `X` and `dist/index.js` containing a
  `Server({... version: Y})` literal where `Y != X`, when
  `check-version.mjs` runs, then it prints an error naming both the dist
  version and the package.json version, and exits non-zero (fail loud) —
  same message style as the existing index.ts-vs-package.json mismatch
  (script lines 25–31).
- **AC3** — Given `dist/index.js` does not contain a recognizable `Server()`
  version literal (parse failure on an existing file), when
  `check-version.mjs` runs, then it fails loud with a clear
  "could not find dist version literal" message and exits non-zero —
  mirroring the existing index.ts literal-not-found precedent (script lines
  19–23), which already fails loud in the analogous case. Given
  `dist/index.js` does not exist at all (fresh unbuilt checkout, e.g. a
  clone that hasn't run `npm run build` yet), the check MUST NOT crash with
  an unhandled exception — skip the dist check with a clear informational
  note, mirroring the git-tag check's "not in a git checkout" tolerance
  (script lines 70–72). sr-engineer: implement this file-absent-vs-parse-fail
  distinction explicitly; do not conflate the two.
- **AC4** — Given the check passes, the script's existing success line
  (`` `check:version — OK (${pkg.version})` ``) still prints unchanged, and
  the dist-parity confirmation is visible in stdout alongside it.
- **AC5** (qa-owned) — A test seeds a temp `dist/index.js` with a
  deliberately stale `Server()` version literal alongside a correct
  `package.json`/`index.ts` pair, runs the check-version logic against it,
  and asserts a non-zero exit / thrown failure (AC2). A second test asserts
  the matching-version case still passes (AC1). A third test asserts the
  file-absent case does not crash (AC3, skip branch).

### E12 — E8 metrics emit not idempotent per release
- **AC6** — Given `.current/metrics.jsonl` contains no record with
  `feature === F && released_version === V`, when `emitFeatureMetrics` is
  called with `feature: F` and `package.json` version `V`, then a new record
  is appended (unchanged from today's behavior).
- **AC7** — Given `.current/metrics.jsonl` already contains a record with
  `feature === F && released_version === V`, when `emitFeatureMetrics` is
  called again with the same `feature: F` and `package.json` version `V`,
  then NO new record is appended — this is the exact v3.74.0 double-fire
  scenario reproduced.
- **AC8** — Given `.current/metrics.jsonl` contains a record for
  `feature === F` with `released_version === V1`, when `emitFeatureMetrics`
  is called with `feature: F` and `package.json` version `V2` (`V2 != V1`),
  then a new record IS appended — the dedupe key is the pair, not `feature`
  alone; a genuinely new release of the same feature must still be recorded.
- **AC9** — Given `released_version` resolves to `null` (unreadable/
  unparseable `package.json`, existing AC7 of E8) and
  `.current/metrics.jsonl` already contains a `null`-`released_version`
  record for `feature === F`, when `emitFeatureMetrics` is called again for
  the same feature with `released_version` still resolving to `null`, then
  the dedupe treats `(F, null)` as a valid pair and skips the second append —
  do NOT special-case `null` as "always append."
- **AC10** — The dedupe read of `.current/metrics.jsonl` is defensive: a
  missing file is treated as "no existing records" (append proceeds); a
  malformed/non-JSON line already in the file is skipped without crashing
  the read.
- **AC11** — `emitFeatureMetrics`'s existing never-throw / never-block
  contract is preserved even when the dedupe read itself fails (e.g. a
  permissions error mid-read): fail open — fall back to appending — rather
  than silently dropping a legitimate record. The function must still never
  propagate an exception to the caller (AC2 of E8, unchanged).
- **AC12** — Explicitly out of scope: the two pre-existing duplicate records
  already in `.current/metrics.jsonl` (`e8-success-telemetry` /
  `3.74.0`, `ts` ~2026-07-12T06:28:03 and 06:28:25) are NOT hand-edited or
  removed by this fix — append-only telemetry; hand-edits are the E9
  anti-pattern (per `docs/backlog.md`). Historical dedupe, if ever wanted, is
  a future summarizer/migration concern, not this ticket's.
- **AC13** (qa-owned) — A test dispatches the release-engineer closing-write
  signature (`agent_id: "release-engineer"`, `status: "In_Progress"`,
  `next_role: "pm"`) twice in a row for the same feature against a fixture
  workspace with a fixed `package.json` version, and asserts exactly one line
  is appended to `.current/metrics.jsonl` (not two) (AC7). A second test
  changes `package.json` version between the two dispatches and asserts two
  lines result (not deduped across versions) (AC8). A third test seeds a
  pre-existing malformed line in the fixture jsonl and asserts the dispatch
  still succeeds and appends correctly (AC10).

## Copy / Strings
| string id | exact text (quote verbatim) | source |
|---|---|---|
| N/A | — | feature has no user-facing copy; `check-version.mjs` console output is developer/CI-facing tooling output, not product copy |

## Visual Tokens
| token id | property | value (quote verbatim) | source |
|---|---|---|---|
| N/A | — | — | feature has no visual literals |

## Visual Widgets
| widget id | description | source-node |
|---|---|---|
| N/A | — | feature has no non-primitive widgets |

## Out of Scope
- Hand-editing or removing the two existing duplicate records in
  `.current/metrics.jsonl` (AC12) — append-only; no retroactive cleanup in
  this ticket.
- Any change to the release-engineer closing-write *signature* itself
  (`agent_id`/`status`/`next_role` guard in `tools/handoff-orchestrator.ts`,
  lines 939–944) — E12 only changes what happens inside
  `emitFeatureMetrics`, not when/whether it's invoked.
- Any change to the CHANGELOG.md or git-tag advisory checks in
  `check-version.mjs` — E11 only adds the `dist/index.js` parity check.
- SQLite/HTTP-mode metrics parity — `emitFeatureMetrics` already only fires
  in file-mode (`FileHandoffStorage` instance check); out of scope for this
  batch.
- Any `schema_version` bump — neither ticket touches persisted
  handoff/tasks/config/sqlite schemas.

## Dependencies / Prerequisites
- E12 depends on E8 (`tools/metrics.ts`, the release-engineer
  terminal-marker wiring in `tools/handoff-orchestrator.ts` lines 939–953) —
  already merged and live as of v3.75.0 (confirmed on disk; current
  `.current/metrics.jsonl` holds the exact 2-record duplicate this ticket
  targets).
- No design source for either ticket — design-auditor not routed; Visual
  Structural Assertions section omitted per PM SOP (no
  `design/<feature>.md`, mode = no-design).
- Resource Audit Gate: zero external references found in either backlog
  entry (`docs/backlog.md` §E11 ~line 1158, §E12 ~line 1176) — `external_refs`
  omitted (non-blocking).
- Batch precedent: `docs/backlog.md` §Recommended execution order, rows 3–4
  (C16+C10, C5+C18) — both closed under the "single QA round" rationale;
  this batch follows the same shape: two independent small fixes, one
  shared code-review pass, one shared QA verification round, one shared
  release.
- Both tickets are code+test only (~2 files each, ~4 files total) — no
  cross-module contract change, no new data model, no ≥3-module surface.
  Architect is not routed for this batch; `next_role` is `sr-engineer`
  directly (see routing rationale in the PM state write).
