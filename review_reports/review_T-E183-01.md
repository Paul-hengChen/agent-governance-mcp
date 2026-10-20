# Review — T-E183-01

## Round 1 — APPROVED — by code-reviewer

## Summary
- `scripts/summarize-metrics.mjs` now finds its default path through the shipped resolver (`../dist/tools/lane-paths.js`). It tries the current lane's `metricsPath` first, then the legacy flat path, and prints a stderr note when it falls back. It exits 1 with a `summarize-metrics:` diagnostic when no file is found (default or explicit path) and on any non-`ENOENT` read error.
- `docs/gate-retro-procedure.md`'s Success-metrics section and the script header comment describe the new behaviour. The "still the pre-lane flat path" paragraph is gone.
- `qa_reports/expected-red_e209-test-infra-fixes.txt` is new. It lists E8-S4 as intentionally red until qa re-pins it in T-E183-02.
- Scope: 3 files, all owned by this lane. No changes under `tools/**` or `dist/**`.
- Verdict: APPROVED. Same-model note: sr-engineer and this reviewer both ran on opus.

## AC Completeness
AC-E183-1 — implemented — scripts/summarize-metrics.mjs:39-43. Scratch fixture (branch `feat/e999-x`, records in `.current/e999/metrics.jsonl`): exit 0, `aggregate — features: 1`. A bare run inside this linked worktree also resolves `.current/e209/metrics.jsonl`.
AC-E183-2 — implemented — same lines. Fixture on branch `main` with `.current/_primary/metrics.jsonl`: exit 0, summary printed.
AC-E183-3 — implemented — :46-52. Lane file absent and flat file present: exit 0, summary printed, and stderr says `summarize-metrics: .current/e999/metrics.jsonl not found; reading legacy flat .current/metrics.jsonl.`
AC-E183-4 — implemented — :53-58. Neither file present: exit 1. Stderr names both paths, the explicit-path hint and `tw_gate_stats`. Stdout is empty.
AC-E183-5 — implemented — :35-38 and :23-30. Missing explicit path: exit 1 with `no metrics file at nope.jsonl.` A directory as the explicit path: exit 1 with `cannot read .git (EISDIR).` No lane resolution runs on the explicit branch. The E8-S4 re-pin is qa-owned (T-E183-02).
AC-E183-6 — implemented — the record loop, legend and aggregate are unchanged below :60. An existing empty file still exits 0 with `no metrics yet`. E8-S1..S3 are green.
AC-E183-7 — implemented — :14 imports `resolveCurrentLanePaths` and `resolveFlatLanePaths`. Both exist in dist/tools/lane-paths.js:243 and :254, take `(workspacePath)` and return `LanePaths` with `metricsPath` (tools/lane-paths.ts:48, :280, :292). `git diff 2ad039d --name-only -- tools/ dist/` is empty.
AC-E183-8 — implemented — docs/gate-retro-procedure.md:101-116 and the script header :6-9. The proof grep for `default: .current/metrics.jsonl` and `still the pre-lane flat path` prints nothing. The doc still tells readers to use `tw_gate_stats` for cross-lane totals and not to glob several files into the script.

## Correctness
No findings. Rulings on the questions I was asked:
- A non-`ENOENT` error on the lane path fails loudly and does **not** fall back to the flat file (scratch: lane path is a directory and a flat file exists, so exit 1 with `cannot read .current/e999/metrics.jsonl (EISDIR).`). This is correct. AC-E183-3 allows the fallback only when the lane file is *absent*. An unreadable lane file is a real fault, and silently reading an older flat file would bring back the silent-zero failure this ticket is removing.
- Default-mode paths are printed relative to cwd (`path.relative(cwd, p) || p`, :41). They are read relative to cwd too, which is the same file because the resolver is rooted at `cwd`. Every path tried is still named, as the Copy table requires. The `|| p` guard never triggers for a file path, but it is harmless.
- Run from a repository subdirectory, the resolver sees no `.git/HEAD` under cwd and falls back to `_primary` under that subdirectory. Base also resolved relative to cwd, so this is unchanged. Not a finding.
- Explicit-path mode now also loads `dist/tools/lane-paths.js` at import time. `dist/` is committed, and `scripts/lane-status.mjs` and `scripts/feature-rollup.mjs` already depend on it this way.

**Expected-red sampling (SOP 4a).** The manifest has 1 entry; I sampled all of it. `test/success-metrics.test.mjs | E8-S4: summarizer on a missing file exits 0 with a 'no metrics yet' notice (never throws ENOENT)` matches test/success-metrics.test.mjs:941 exactly. It is the only red in the related run (96/97) and it is red for the reason given.

**Expected-red manifest in feature mode (scope ruling).** The manifest is consistent with the mechanism.
- In feature mode the file is the SOP 7a manifest of intentional reds: sr-engineer writes it, QA's Phase 0.5 diffs the run against it, and the disposition is advisory. It is not the bugfix-mode repro manifest, and no gate arms on it here.
- The format matches the 7a format: `<path> | <exact name>`, with `#` lines as rationale.
- docs/lane-protocol.md §2 allows files the ticket newly creates. The server fixes the name (`expected-red_<active_feature>.txt`), and it can only be lowercase.
- recommended (integrator pre-merge, not sr) — the lane row's ownership cell lists `qa_reports/*E209*` and `qa_reports/*E183*`. Those globs match this lowercase name only if matched case-insensitively, as docs/lane-protocol.md already does for its abandoned-lane harvest. When AC-LANE-2 is checked, the integrator should count it as owned under the §2 new-file clause.

## Quality
- Comment check (SOP 4b): the new comments at :6-9, :16 and :22 are accurate and generic. Kept.
- `readMetrics` relies on `fail()` never returning (`process.exit`), so its catch branch has no `return`. This matches the script's existing exit-on-error style.
- The "no metrics yet" message changed from base's "not found or unreadable" to "has no valid records". It is now reached only for an existing file, so the new text is more accurate. AC-E183-6 pins only the `no metrics yet` fragment and exit 0.

## Architecture
No architecture spec. Reusing the shipped resolver instead of copying the lane logic keeps one source of truth with `tw_gate_stats`, which is what the PM interpretation and the manifest row both ask for.

## Security
No findings. The path argument comes from the operator and is read, never executed. Error output includes only the path and the errno code.

## Performance
No findings. At most two `readFileSync` calls plus the resolver's HEAD read, once per run.

## Verdict
APPROVED — AC-E183-1..8 are implemented and verified by scratch fixtures. The only red is the declared expected-red E8-S4, which qa re-pins.

### Notes for qa (T-E183-02)
1. E8-S4's re-pin: exit 1 and stderr containing `no metrics file at <path>`. For an unreadable path (directory → `EISDIR`), stderr contains `cannot read <path> (<code>)`.
2. The stderr fragments the tests can match: `summarize-metrics:`, `no metrics file`, `legacy flat`, `tw_gate_stats`, `cannot read`. In default mode, paths in stderr are cwd-relative (`.current/<lane>/metrics.jsonl`), so assert on the relative form or on a suffix.
3. A lane path that exists but can't be read exits 1 even when a flat file exists. This is intended (see Correctness) and worth a case.
