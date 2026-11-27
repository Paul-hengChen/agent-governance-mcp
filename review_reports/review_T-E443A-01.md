# Review — T-E443A-01 (e443a-manifest-waves)

covers: T-E443A-01, T-E443A-02, T-E443A-03, T-E443A-04, T-E443A-05

## Round 1 — APPROVED — by code-reviewer

## Summary
- Reviewed the whole lane diff from the dispatch base (`.current/e443a/base-sha`) to HEAD 22fc3d7: qa's tests, fixtures and re-pins (T-E443A-01), the `波次` / `相依` checks (T-02), ticket-file lookup and `render --batch` (T-03), the `waves` command in `tools/fanout-waves.ts` (T-04) and the integrator SOP text (T-05).
- Every changed path is in the lane's 擁有 column of `specs/fanout-post-v5-w7.md` (`check --cut`: 1 ticket, 18 tokens, 0 out of bounds; the only FAIL is the expected `APPROVAL_HUMAN`). Nothing in the 禁止 column changed.
- A1-12 holds. The ten guarded render-reader files are unchanged from base. Separately, an independent run of hand-started `render` from the base and HEAD trees over every lane of all 57 real `specs/fanout-*.md` manifests (760 invocations: valid, addendum-config, missing-summary and bad-base variants, unknown lanes) produced byte-identical stdout, stderr and exit codes once the two copies' own install-root path was normalised.
- Full suite on a clean tree, apart from this hop's own `.current/e443a/` state writes: 4905/4907 pass, 0 fail, 2 skipped. The two skips were also present at base. All 18 expected-red manifest entries are now green, and nothing off the manifest is red.
- Verdict: APPROVED.

## AC Completeness
- A1-1 — implemented — `tools/fanout-manifest.ts` `lanesShape` (four header shapes), `parseLanes` (approval read by its position in the header, `wave` / `depLanes` set on clean rows); `test/e443a-wave-columns.test.mjs` A1-1.
- A1-2 — implemented — `waveRowErrors` (`WAVE_NOT_INTEGER`, `DEPS_NOT_LANE_LIST`, `DEPS_SELF`, `DEPS_LANE_UNKNOWN`, `DEPS_LATER_WAVE` in the spec's order; the later-wave check is skipped when either wave is in error); messages match Copy / Strings byte-for-byte.
- A1-3 — implemented — the checks run only when `shape.wave` is defined; the validate-baseline loop prints nothing; validate stdout+stderr of all 57 real manifests is identical between base and HEAD.
- A1-4 — implemented — `tools/fanout-waves.ts` `compareWaves` condition 2 (same lane listed first, or `reaches` along `相依`); `formatWavesReport` prints the ok line, then `WAVES_REASON_LINE` last.
- A1-5 — implemented — both `DEPENDENCY_DROPPED` message shapes.
- A1-6 — implemented — `TICKET_ADDED` / `TICKET_REMOVED` / `TICKET_IN_TWO_LANES`.
- A1-7 — implemented — condition 3 with bookkeeping exclusion (`tasks.md`, `.current/`, `qa_reports/`, `review_reports/`, `isImplicitBookkeeping`), literal-in-glob containment and no glob-in-glob; `TICKET_FILE_ABSENT` comes from `lookupTicketFiles`.
- A1-8 — implemented — `content/skill-integrator.md` holds both blocks verbatim (each occurs once; checked against the spec's `text` blocks by script); still 269 lines; no new backtick-quoted error code.
- A1-9 — implemented — `batchTemplate` replaces each of the two lines exactly once; prompt ends with `BATCH_CLOSING_LINE` + `\n`.
- A1-10 — implemented — `batchSummaryAndReading` (titles joined by `；`, `<file>的 ## Scenarios（ids）` joined by ` + `); `TICKET_FILE_*` and `TICKET_CELL_EMPTY`; the two `USAGE` refusals in `runRender`.
- A1-11 — implemented — the batch template is derived before the pointer replacement, so the two-layer pointer still applies.
- A1-12 — implemented — the hand-started path is gated on `!opts.batch` and is otherwise unchanged; evidence in the Summary above.

## Correctness
No required findings.
- Tests (step 4): every automatable scenario A1-1..A1-11 has a test on the public CLI / `parseManifest` interface, and its assertions are exact: full error lines, full FAIL lines, last-line reason text. A1-12 is a command scenario by design: no resident test diffs against a historical sha, and `tests_e443a-manifest-waves.md` records why. Negative control, run on a copy outside the worktree: with `reaches` forced to `true` and the condition-3 check bypassed in `dist/tools/fanout-waves.js`, A1-5 and A1-7 turn red (7 failing subtests). The tests are not vacuous.
- The A1-3 base sweep reads its baseline from `qa_reports/` or `qa_reports/archive/*/`, and skips loudly when the file is absent. It pins no sha.
- Re-pins: e292, e296, e423 and e428 were listed in the spec. `test/e322-owners.test.mjs` was not, but it is in 擁有, and the change (5 → 6 usage continuation lines) follows directly from the spec's `USAGE_LINES`. qa disclosed it in the expected-red manifest and in `tests_*.md`. Accepted.
- Judgment calls, decided against the spec:
  - (1) Every render usage error, with or without `--batch`, now prints the new render usage line. Accepted: Copy / Strings `USAGE_LINES` explicitly replaces the render line in the single shared `USAGE` text. A1-12 is about render output for existing valid arguments, and none of the 禁止 render readers asserts the usage text.
  - (2) and (g) The `scripts/fanout.mjs` header comment carries both usage lines and keeps `handoff [--check] <manifest>` and `--closing`, as the spec requires. The added exit-code mention of waves is accurate. The e285 and e322 header readers stay green.
  - (a) waves reports manifest, wave-table and primary input errors together and looks up ticket files only once those are clean. Accepted: every one of them is exit 2, and the spec fixes no order.
  - (b) `WAVE_TABLE_DUPLICATE` lists every table's line. This is a faithful generalisation of `(lines <a>, <b>)`.
  - (c) A self-dependency in the wave table is `WAVE_TABLE_ROW_MALFORMED`. This is correct: the spec says each entry must be "another ticket".
  - (d) `TICKET_IN_TWO_LANES` names the lane of every occurrence. Matches "listed more than once across 票 cells".
  - (e) The local `waves` argument parser has the same USAGE semantics as the shared parser.
  - (f) `<d>` counts approved pairs, de-duplicated per row. Consistent with "approved dependency(ies) kept".
- Edge probes I ran (head copy):
  - a second Lanes table without `波次` gives `WAVES_COLUMN_ABSENT` naming that section;
  - three broken conditions give `3 broken condition(s)`, with the FAIL lines ordered by condition;
  - a lane holding only an unapproved ticket gives the `any approved ticket of the lane` wording;
  - a full-width `，` with spaces in both `相依` and `depends on`, plus `none` / `無`, passes with d = 2;
  - `--batch` placed before the positionals is accepted (a superset of the spec's "anywhere after `<lane>`").

## Quality
- recommended: `tools/fanout-waves.ts:36-37` repeats `WAVE_RE` and `LIST_SEPARATOR_RE` from `tools/fanout-manifest.ts`, where they are not exported. Exporting and reusing them would stop the two formats from drifting apart.
- optional: `tools/fanout-waves.ts:340` uses the literal `"MANIFEST_UNREADABLE"`. This matches `readManifest` in `tools/fanout-manifest.ts`, which also uses the literal.
- Comment check (step 5d): `agc check` reports 7 advisory long-block warnings. Each is kept, for these reasons:
  - `scripts/fanout.mjs:2` (11 lines) and `tools/fanout-manifest.ts:1` (11 lines) are pre-existing header blocks that grew by one line each, as the spec's usage lines and the read-only note require.
  - The new file headers (`tools/fanout-waves.ts:1`, 8 lines, and the four `test/e443a-*.test.mjs` headers, 8–12 lines) state WHAT, WHY and fixture provenance with no sensitive detail.
  - recommended: trim the test headers toward the 7-line limit in a later touch.
- No `any` in either source file. Strict `tsc` is clean: the build ran in the suite's prebuild, and `npm run build` left no `dist/` diff.

## Architecture
- There is no architecture spec (the spec's Gate Summary says no architect hop is needed).
- Layering follows I2 and I4:
  - Shared helpers (`ticketIds`, `lookupTicketFiles`, `lanesSectionsWithoutWave`) live in `tools/fanout-manifest.ts`, so there is no circular import.
  - `waves` is its own module, loaded on demand by `scripts/fanout.mjs` like `handoff`.
  - `tools/ticket-file.ts` and `tools/config.ts` are imported, not modified.
  - `PROMPT_TEMPLATE_3B` is untouched, and the batch template is derived from it (no second copy).
  - No `--template` string appears in `tools/fanout-manifest.ts`.
- `CLAUDE.md` needs no change, because its `tools/fanout-*.ts` Layout row already covers the new module.

## Security
- No findings.
- Every file read is a local path given by the operator or found under primary's configured ticket directory (top-level `*.md`, regular files only).
- git is reached only through the existing `resolvePrimary` (`execFileSync` argv, no shell).
- Error messages show ticket paths relative to primary, never absolute. The tests assert this, and I re-checked the evidence and the diff for absolute or home paths.
- `npm audit --audit-level=high` exits 0 (7 low/moderate, none high or critical).

## Performance
- No findings. Validation adds one extra pass over the Lanes rows (`waveLaneIndex`).
- `waves` is linear in lanes × tickets, except `reaches`, a BFS per approved pair over a handful of lanes.
- The ticket directory is read once per call.
- The hand-started render path does no extra work.

## Verdict
APPROVED. All twelve scenarios are met, with A1-12 verified independently. I found no required finding in tests or implementation; the recommended and optional notes do not block.
