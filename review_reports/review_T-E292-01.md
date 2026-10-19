# Review — T-E292-01 (batched round, e292-sister-repos)

covers: T-E292-01, T-E292-02, T-E292-03, T-E343-01, T-E342-01, T-E292-04, T-E344-01

## Round 1 — APPROVED — by code-reviewer

## Summary
- Diff `a67d799...HEAD` on `feat/e292-sister-repos`: `tools/config.ts` (the `sisterRepos` filter), `tools/fanout-manifest.ts` (the `## 外部依賴` reader plus the E343 pointer guard and `template` seam), `tools/fanout-handoff.ts` (sister sha comparison in `handoff --check`), `docs/config.md` (E292 D1 section, E342 wording), `content/skill-integrator.md` (E290 knock-on, E292 and E344 wording), the rebuilt `dist/tools/{config,fanout-manifest,fanout-handoff}.*`, the expected-red manifest, and lane bookkeeping.
- Scope matches the approved cut. `node scripts/fanout.mjs check specs/fanout-post-v4-w8.md e292` exits 0 (22 files, 0 out of bounds). No `schema/**`, `test/**` or other `dist/**` file changed. A fresh `tsc` into a scratch outDir gives byte-identical `.js` and `.d.ts` for all three modules; only the `.map` files differ, and only by their outDir-relative source path.
- All seven tasks match the spec's ACs, the Copy / Strings literals (checked byte for byte with a script), D1–D7 and G6. The findings below are recommended or optional only.
- Verdict: APPROVED.

## AC Completeness
- AC-E292-1 — implemented — `tools/config.ts:143-193` (`parseSisterRepos` / `normalizeSisterRepo` / `isRejectedSisterPath`), wired at `tools/config.ts:418`. Probed: non-object, `..`, a name with a space, `C:x`, UNC, `~/x` and `/x` entries are dropped; `backlog: ""` is left out; `contracts: ["", 3, "R.md"]` → `["R.md"]`; `contracts: [""]` is left out; a duplicate name is dropped (first wins); empty `owns` drops the entry; a non-array value leaves the field absent; `getConfigError` stays `null` throughout.
- AC-E292-2 — implemented — the diff has no `schema/**` or `test/**` change; `CURRENT_VERSIONS.config` is not touched. The test assertion is qa's.
- AC-E292-3 — implemented — `docs/config.md:163` heading occurs once (between the `laneProtocolAddendum` section and the next `---`). The section names `name`, `path`, `owns`, `backlog`, `contracts`, `lane-status.mjs --repo`, `handoff --check`, `外部依賴` and `schema_version`, plus the drop rules and the relative-path rule.
- AC-E292-4 — implemented — `tools/fanout-manifest.ts:1106` adds no output for a well-formed section. Probed: `validate` on the e177a wave7 fixture with a valid `## 外部依賴（sister）` section gives the same exit, stdout and stderr as the fixture without the section.
- AC-E292-5 — implemented — `tools/fanout-manifest.ts:1024-1096`. Probed each code and every row reason (`3 cell(s), expected 5`, `repo "."`, `branch "-b"`, `branch "b c"`, `sha "ABCDEF1"`, `協定出處 is empty`, `票 is empty`). A heading-less manifest whose prose mentions 外部依賴 gives `present:false` with no errors.
- AC-E292-6 — implemented — `parseManifest` does not call `readExternalDeps`, and `validateManifest` is the only caller apart from handoff `--check` (`tools/fanout-handoff.ts:740`). Probed: `render`, `check`, `owners` and `handoff` with and without a malformed section give the same stdout, stderr and exit.
- AC-E292-7 — implemented — `tools/fanout-handoff.ts:555-607, 637-641`. Probed with temp primary and sister repos: 40-char and 7-char shas are equal while the branch is unchanged (checked 1, differ 0). A fast-forward commit gives `DIFF  外部依賴 s feat/x: 清單「<7>」／repo「<new 7>」` (G6: DIFF, never MOVED). A missing branch gives `repo「（缺）」`. The external lines are appended after the fact lines and before the summary.
- AC-E292-8 — implemented — probed together in one run: one invalid row, one undeclared repo, one plain directory and one missing directory produce `EXTERNAL_DEPS_ROW_INVALID`, `SISTER_REPO_UNKNOWN` and two `SISTER_REPO_NOT_GIT`, reported together. No NOT_GIT message carries a path. An unparseable config gives the `err.sister-config` copy. Generate mode returns before the section is read (`tools/fanout-handoff.ts:738`).
- AC-E292-9 — implemented — `content/skill-integrator.md:92, 101, 105, 109, 235, 239`. Each `sop.*` literal occurs exactly once, in its named section. Both replaced wordings occur 0 times. The e178a AC10 re-pin is qa's; that test is listed as expected-red.
- AC-E342-1 — implemented — `docs/config.md:157` equals `docs.addendum-invalid`. `docs/config.md:155` ends with `docs.render-from-primary`. `a path that starts with ..` occurs 0 times. `test/e289-config-key.test.mjs` is green and unmodified.
- AC-E343-1 — implemented — `LANE_PROTOCOL_POINTER` is exported (`tools/fanout-manifest.ts:102`) and occurs exactly once in `PROMPT_TEMPLATE_3B` (probed).
- AC-E343-2 — implemented — `tools/fanout-manifest.ts:109-113`. Probed: 0 occurrences → undefined, 2 → undefined, 1 → replaced.
- AC-E343-3 — implemented — `tools/fanout-manifest.ts:1417-1430`. The guard runs only when `pointer !== undefined` (key set and valid), and its error is pushed into the shared `errors` before the single `errors.length > 0` return, so it is collected together with the other missing-source errors. With the key unset, the seam template is filled without a guard. The e289 render tests are green.
- AC-E344-1 — implemented — `content/skill-integrator.md:112`: the last sentence equals `sop.idle-resume`, inside `## Stage 4`. `re-arm from the printed baseline, always` occurs once. e285 is green.
- AC-E344-2 — implemented — `content/skill-integrator.md:197` contains `sop.handoff-timing` once. `primary's only uncommitted change` occurs 0 times.
- AC-HC-1 — implemented — the validate sweep over all 25 `specs/fanout-*.md` matches the D6 table line for line.
- AC-HC-2 — implemented (by construction, partly sampled) — the D7 pairs are qa's to record. Sampled here: a section-less manifest gives the same validate output; render and the `pointer === undefined` path keep the base template.
- AC-HC-3 — implemented — no hunk touches `PROMPT_TEMPLATE_3B` or its provenance comment. The golden fixture is unchanged (no `test/**` in the diff).
- AC-HC-4 — implemented — the e286, e329, e246, e295, e296, e294, e288, e297, e336 and error-code-contract tests are green and unmodified. No hunk touches `### Mid-wave base fix`.
- AC-HC-5 — implemented — `test/context-budget.test.mjs` is green.
- AC-HC-6 — implemented — the lane check exits 0 (see Summary).
- AC-HC-7 — qa scope (full suite at final HEAD). A 19-file targeted run gives 273/274, and the single red is the expected-red e178a AC10.

## Correctness
No required findings.
- Expected-red sampling (step 4a): `qa_reports/expected-red_e292-sister-repos.txt` has one entry, `test/e178a-integrator-role.test.mjs | AC10: SOP execution stage — mailbox + cut pre-review formalized`. It is locatable at `test/e178a-integrator-role.test.mjs:295`, and it is the only red test in the targeted run. The old sentence it pins (line 312) is exactly the one `sop.stage4-layers` replaces. The replacement literal in the SOP is correct and keeps `the only copy`.
- `optional` — `tools/fanout-handoff.ts:585`: the git-repo test is `git rev-parse --git-dir` with the sister root as cwd, exactly as D5 specifies. That command also succeeds for a plain directory nested inside another git working tree, for example a `path` pointing inside primary, or two side-by-side checkouts under a parent that is itself a repo. In that case the branch sha is read from the enclosing repo instead of reporting `SISTER_REPO_NOT_GIT`. Conforms to the spec, so it does not block. Possible follow-up: compare `realpath(git rev-parse --show-toplevel)` with `realpath(root)`.
- `optional` — `tools/fanout-manifest.ts:1417`: while the key is set but `ADDENDUM_INVALID`, `ADDENDUM_ABSENT` or `LANE_PROTOCOL_ABSENT` fires, `pointer` is undefined, so a drifted template is not reported in the same run. It is reported once the key resolves. This matches AC-E343-3 ("a valid `laneProtocolAddendum`") and costs one extra run at most.

## Quality
- `recommended` — `tools/fanout-handoff.ts:1-10`: `agc check` warns `long-block 10 lines (limit 7)`. At base the header was already 8 lines; the two added lines (7-8) repeat what the `compareExternalDeps` docblock at line 547 already says. Trimming them back brings the file to the base state; this is the only comment-discipline warning the diff makes worse.
- `optional` — `tools/config.ts`: `agc check` warns `high-ratio 39.6% (limit 30%)`. Kept: the new comments describe what the code does (the field doc next to `laneProtocolAddendum`, a `parseSisterRepos` docblock in the same form as `parseNodeModulesLinks`, and a no-bump note that mirrors the existing addendum note). None of them is rationale that belongs in a spec.
- `optional` — `tools/fanout-handoff.ts:740` and `:556`: `readExternalDeps(text)` runs twice on the `--check` path (once for `present`, once inside the compare). It is cheap, but the result could be passed in.
- Naming and conventions match the surrounding code: `EXTERNAL_DEPS_CODES` / `SISTER_REPO_CODES` follow the `HANDOFF_CLI_CODES` shape, and the new `FanoutErrorScope` value `"external"` is documented in the scope docblock. No `any`; the one non-null assertion (`roots.get(dep.repo)!`, line 603) is guarded, because every unresolved row throws first.

## Architecture
There is no architecture spec (G14: hop skipped). The layering follows D2 and D5:
- the pure reader lives in `fanout-manifest.ts`;
- `fanout-handoff.ts` uses the existing import edge and adds a new `./config.js` import for `loadConfig` / `getConfigError`, which D5 requires;
- the parser stays untouched, so G5 and AC-E292-6 hold by construction.

D4 is also followed: the seam lives on `RenderOptions` next to `installRoot`, and nothing throws at module load (G11).

## Security
- All git calls go through `execFileSync` argv; none uses a shell. The manifest `branch` cell cannot start with `-`, so it cannot inject an option; it reaches git only as `<branch>^{commit}` behind `--verify --quiet`. All of these commands only read.
- `SISTER_REPO_NOT_GIT` never echoes the configured path, and the config refuses absolute and `~` sister paths, so no local path lands in the tracked config.
- `optional` (Constitution §6 hygiene) — `tools/fanout-handoff.ts:565`: `err.sister-config` embeds the `getConfigError` text, and that text holds the absolute path of the config file (probed). The spec copy requires this, and the existing `CONFIG_UNREADABLE_WARN` does the same. It goes to stderr only, never to a tracked file. Not a defect against the spec; noted only as a possible follow-up.
- No secrets introduced.

## Performance
No findings. The added work runs only when a manifest has a `## 外部依賴` section:
- one config read;
- one `rev-parse --git-dir` per distinct sister repo (cached in `roots` / `notGit`);
- one `rev-parse --verify` per row.

The duplicate-name check in `parseSisterRepos` is O(n²) over a hand-written config list, which is negligible. Nothing changes on the existing hot paths.

## Verdict
APPROVED — all seven tasks meet every AC, copy literal and hard condition in the spec, with only recommended and optional findings (trim the two added header-comment lines in `tools/fanout-handoff.ts`). Same-model note: sr-engineer and this reviewer both ran on opus (dispatch pins), so the blind spots may overlap. The tool's `tw_get_state` output also showed the sr-engineer's `pending_notes`; the verdict rests only on the diff, the spec and the probes above.
