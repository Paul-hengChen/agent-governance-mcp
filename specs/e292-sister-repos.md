# e292-sister-repos

Fan-out lane `e292` of `specs/fanout-post-v4-w8.md` (post-v4 wave 8). Tickets: E292, E342, E343, E344, plus the E290 knock-on wording of three integrator SOP lines.
Branch `feat/e292-sister-repos`, dispatch base `a67d799`.

## Problem Statement

An integrator whose wave depends on work in another repo has no declared place to say which repos are related, what each owns, or where their backlog and contract documents live, so the `status` and `接手` (take-over) modes never look at them, and a manifest has no structured place to record which branch and sha of the other repo it was planned against — so `handoff --check` cannot notice when that repo moved (integrator revision 2026-10-08 §3.2, §6.2 D1 and D2; E292). Four small defects ride along in the same files: the `laneProtocolAddendum` section of `docs/config.md` says a refused path "starts with `..`" where the code means its first segment is `..`, and never tells integrators to run `render` from primary (E342); `render` swaps the template's lane-rules pointer with a plain string replace, so if the template wording drifts the addendum disappears from the prompt without an error (E343); the integrator SOP's two-hour idle stop says how to resume the mailbox watch but not the `lane-status.mjs --watch`, and its close-handoff timing says "the manifest is primary's only uncommitted change", which is false whenever primary holds its usual uncommitted `.current/` files (E344); and three SOP lines still say the shared lane rules live only in `docs/lane-protocol.md`, which stops being complete once a repo sets `laneProtocolAddendum` (E290 knock-on).

## User Stories

- As an integrator whose repo depends on a sister repo, I want to declare that repo once in `.current/.config.json` (path, what it owns, backlog and contract docs), so that `status` and take-over read its in-flight lanes and branch shas without me remembering where it lives.
- As an integrator planning a wave against another repo's branch, I want an optional `## 外部依賴` table in the manifest that `validate` checks, so that the recorded dependency is machine-readable and well-formed.
- As an integrator taking over a wave, I want `handoff --check` to compare each recorded sister-repo sha with that branch now, so that a moved contract stops the take-over instead of going unnoticed.
- As an integrator in a repo with no sister repos and no `## 外部依賴` section, I want `validate`, `render`, `handoff` and `handoff --check` to print exactly what they print today, so that nothing in my workflow moves.
- As an adopter reading `docs/config.md`, I want the `laneProtocolAddendum` refusal rule and the run-from-primary advice stated exactly, so that I neither avoid a valid name such as `..foo` nor get an absolute worktree path in my prompt by accident.
- As a maintainer, I want `render` to fail loudly when the template no longer holds the pointer it replaces, so that the addendum can never silently drop out of the prompt.
- As an integrator resuming after an idle stop, I want the SOP to say the `lane-status.mjs --watch` is simply restarted, and the close-handoff timing to name the bookkeeping edits, so that I follow the SOP literally and get the right result.
- As an integrator in a repo with an addendum, I want the SOP to say shared lane rules live in two layers (agc generic rules plus the repo addendum named by `laneProtocolAddendum`), so that my premise check and my reading of "the only copy" cover both files.

## Acceptance Criteria

All new test files below build fixtures (temp git repos, temp configs, temp manifests) in `os.tmpdir()`; none asserts growing content of a real `specs/fanout-*.md` or diffs against a fixed sha (lane rule). Proof commands that compare with the dispatch base use the three-dot form, so a later merge of the target branch does not count as lane change (lane-protocol §7.4).

### E292 D1 — `sisterRepos` config key

- **AC-E292-1** — Given a workspace whose `.current/.config.json` holds a `sisterRepos` array, when `loadConfig(<workspace>)` runs, then `sisterRepos` holds every valid entry, in list order, as `{ name, path, owns }` plus `backlog` when it is a non-empty string and `contracts` when it is an array with at least one non-empty string (non-strings and empty strings dropped from it), each string byte-verbatim; an entry is dropped when it is not an object, when `name` is not a string matching `^[A-Za-z0-9_.-]+$` or is `.` / `..`, when `path` is not a non-empty string or is absolute (POSIX, Windows or drive form) or starts with `~`, or when `owns` is not a non-empty string; a later entry with an already-kept `name` is dropped (first wins). Given the key absent, not an array, or an array with no valid entry, then the field is absent. In every case `getConfigError` stays `null` (non-fatal filter, same convention as `laneProtocolAddendum` / `nodeModulesLinks`).
  proof: `node --test test/e292-config-sister-repos.test.mjs`
- **AC-E292-2** (hard condition, human ruling) — Given the key is added, when the config schema version is read, then `CURRENT_VERSIONS.config` is still `2`, and `schema/**` and `test/config-versioning.test.mjs` are not modified by this lane.
  proof: `git diff --quiet a67d799...HEAD -- schema test/config-versioning.test.mjs; echo "exit=$?"` prints `exit=0`, and `node --test test/e292-config-sister-repos.test.mjs` asserts `CURRENT_VERSIONS.config === 2`.
- **AC-E292-3** — Given `docs/config.md`, when it is read, then it has exactly one section headed copy `docs.sister-heading`, placed after the `laneProtocolAddendum` section and before the next `---`, that states: the value is an array of objects with `name`, `path`, `owns` and the optional `backlog` and `contracts`; `path` is relative to the repo root (absolute and `~` entries are dropped), `backlog` and `contracts` are paths relative to the sister repo's root; which entries are dropped (AC-E292-1); that the integrator SOP's `status` and take-over modes read each sister repo through `node scripts/lane-status.mjs --repo <path>`; that `handoff --check` resolves a `## 外部依賴` row's `repo` through this key; and that the key is additive-optional with no `schema_version` bump.
  proof: `node --test test/e292-config-sister-repos.test.mjs` (asserts the heading occurs once and that the section contains `name`, `path`, `owns`, `backlog`, `contracts`, `lane-status.mjs --repo`, `handoff --check`, `外部依賴` and `schema_version`).

### E292 D2 — `## 外部依賴` manifest section, `validate`

- **AC-E292-4** — Given a valid manifest (open, and separately closed with a valid `## 接手步驟`) that also holds one `## 外部依賴` section (heading per D3) whose first table has header copy `ext.header` and one or more well-formed rows (D3), when `node scripts/fanout.mjs validate` runs, then it exits 0 and its stdout and stderr are byte-identical to the same manifest's output with the section removed.
  proof: `node --test test/e292-external-deps-validate.test.mjs`
- **AC-E292-5** — Given that manifest with exactly one of these defects, when `validate` runs, then it exits 2 and stderr names exactly the listed code: two `## 外部依賴` sections → `EXTERNAL_DEPS_SECTION_DUPLICATE`; a section with no table, or a table with a header row and no data row → `EXTERNAL_DEPS_TABLE_ABSENT`; a header that differs from copy `ext.header` (order, spelling or column count) → `EXTERNAL_DEPS_HEADER_DIFFERS`; a row with a cell count other than 5, an invalid `repo`, an empty `票`, an invalid `branch`, an invalid `sha` or an empty `協定出處` (D3) → one `EXTERNAL_DEPS_ROW_INVALID` per bad row. A manifest with no `## 外部依賴` heading never gets any of the four codes, whatever its prose says about 外部依賴.
  proof: `node --test test/e292-external-deps-validate.test.mjs`
- **AC-E292-6** — Given a manifest whose `## 外部依賴` section is malformed, when `render`, `check`, `check --cut`, `owners` and `handoff` (generate, without `--check`) run, then each one's stdout, stderr and exit code equal those for the same manifest with the section removed — the section is checked by `validate` and read by `handoff --check` only (`parseManifest` and `Manifest.errors` are unchanged by it).
  proof: `node --test test/e292-external-deps-validate.test.mjs`

### E292 D2 — `handoff --check` compares sister-repo shas

- **AC-E292-7** — Given a temp git primary whose committed `.current/.config.json` declares `sisterRepos` entry `s` with a relative `path` to a temp git sister repo, and a closed manifest with a `## 接手步驟` section written by `handoff` and a `## 外部依賴` row `s | E1 | feat/x | <sha of feat/x> | README.md`, when `handoff --check <manifest>` runs, then: with `feat/x` unchanged, no line names the row, the summary's checked count is one more than the same run without the section, and the exit is 0; after a new commit on `feat/x` in the sister repo, a line equal to copy `check.ext-diff` appears (`<now>` = the new sha cut to the recorded sha's length), the summary counts it under `differ`, and the exit is 1 — also when the new commit descends from the recorded one (Gate Summary G6); with `feat/x` deleted, the line reads `repo「（缺）」` and the exit is 1. A 7-character and a 40-character recorded sha both compare as equal while the branch is unchanged. The comparison lines come after every fact line and before the summary line, in table order.
  proof: `node --test test/e292-handoff-sister-sha.test.mjs`
- **AC-E292-8** — Given the same setup, when the row's `repo` is not a declared `sisterRepos` name → `handoff --check` exits 2 with copy `err.sister-unknown`; when primary's config is unusable (`getConfigError(<primary>) !== null`) → exit 2 with copy `err.sister-config`; when the declared path is not a git repository (missing directory or plain directory) → exit 2 with copy `err.sister-not-git`, and the message holds neither the configured path nor any absolute path; when the section is malformed → exit 2 with the AC-E292-5 code. Every such error of one run is reported together. Given the section is present, when `handoff` (generate) runs, then its stdout equals the same run with the section removed.
  proof: `node --test test/e292-handoff-sister-sha.test.mjs`

### E292 D1/D2 + E290 knock-on — integrator SOP

- **AC-E292-9** — Given `content/skill-integrator.md`, when it is read, then each of the copy literals `sop.premises`, `sop.render-layers`, `sop.stage4-layers`, `sop.status-sister`, `sop.takeover-sister` and `sop.stage1-ext` occurs exactly once, inside the section the copy table names (`sop.premises` in Stage 3 check 1, `sop.render-layers` in Stage 3 *Render*, `sop.stage4-layers` as the first paragraph of Stage 4, `sop.status-sister` in *Status (any time)*, `sop.takeover-sister` in *Take-over* step 4, `sop.stage1-ext` in Stage 1 step 6); the replaced wordings `` the prompt and `docs/lane-protocol.md` give `` and `` Shared rules live only in `docs/lane-protocol.md`; `` occur zero times; `test/e178a-integrator-role.test.mjs` AC10 is re-pinned from the old Stage 4 sentence to `sop.stage4-layers`, and every other e178a assertion is unchanged.
  proof: `node --test test/e292-integrator-sop.test.mjs test/e178a-integrator-role.test.mjs`

### E342 — `docs/config.md` wording

- **AC-E342-1** — Given the `laneProtocolAddendum` section of `docs/config.md`, when it is read, then its `ADDENDUM_INVALID` bullet equals copy `docs.addendum-invalid` (the phrase `a path that starts with ..` occurs zero times in the file), and the *Where the generic rules come from* bullet ends with copy `docs.render-from-primary`; `test/e289-config-key.test.mjs` stays green unmodified.
  proof: `node --test test/e342-config-doc-wording.test.mjs test/e289-config-key.test.mjs`

### E343 — render pointer guard

- **AC-E343-1** — Given `PROMPT_TEMPLATE_3B` and the exported `LANE_PROTOCOL_POINTER`, when the template is searched, then the pointer occurs in it exactly once.
  proof: `node --test test/e343-render-pointer-guard.test.mjs`
- **AC-E343-2** — Given the exported `replaceLanePointer(template, replacement)`, when the template holds `LANE_PROTOCOL_POINTER` exactly once, then it returns the template with that one occurrence replaced; when it holds it zero times or two or more times, then it returns `undefined`.
  proof: `node --test test/e343-render-pointer-guard.test.mjs`
- **AC-E343-3** — Given a primary whose config sets a valid `laneProtocolAddendum`, when `renderPrompt` runs with the `template` test seam (D4) set to a template lacking the pointer, then the result is not ok and its errors include one `TEMPLATE_POINTER_ABSENT` (copy `err.template-pointer`), collected together with any other missing-source error; with the key unset and the same seam, then render succeeds and the output is that template with the placeholders filled (no guard while nothing is replaced); without the seam, every e289 render test stays green unmodified.
  proof: `node --test test/e343-render-pointer-guard.test.mjs test/e289-render-addendum.test.mjs`

### E344 — integrator SOP wording

- **AC-E344-1** — Given the Stage 4 *Two-hour idle stop* sub-bullet, when it is read, then its last sentence equals copy `sop.idle-resume`; `re-arm from the printed baseline, always` still occurs exactly once in the file, and the AC-E285-4 phrases still hold.
  proof: `node --test test/e285-integrator-session-handoff.test.mjs` (re-pinned: asserts `sop.idle-resume` occurs exactly once inside `## Stage 4`).
- **AC-E344-2** — Given the Stage 6 *Write the handoff* sub-bullet, when it is read, then it contains copy `sop.handoff-timing` exactly once and `primary's only uncommitted change` occurs zero times in the file; AC-E285-1 and AC-E285-7 still hold.
  proof: `node --test test/e285-integrator-session-handoff.test.mjs` (re-pinned: asserts both).

### Lane-wide hard conditions

- **AC-HC-1** — Given every `specs/fanout-*.md` in the repo, when `node scripts/fanout.mjs validate` runs on each, then each exit code and error-code set equals the dispatch-base baseline in Dependencies D6.
  proof: `for f in specs/fanout-*.md; do o=$(node scripts/fanout.mjs validate "$f" 2>&1); echo "$? $f $(echo "$o" | grep -oE '[A-Z][A-Z_]{5,}' | sort -u | tr '\n' ' ')"; done` matches the D6 table line for line for every manifest present at base.
- **AC-HC-2** (no section, no key ⇒ byte-identical) — Given the dispatch-base CLI extracted into `$TMPDIR` (D7) and this branch's CLI, when each pair below runs from the worktree root, then stdout, stderr and exit code are identical: `validate` on every `specs/fanout-*.md` and every `test/fixtures/e177a/*.md`; `render test/fixtures/e177a/fanout-wave7.md e177a --summary S --reading R1 --reading R2 --mailbox-root /m --primary /p`; `handoff specs/fanout-post-v4-w7.md`; `handoff --check specs/fanout-post-v4-w7.md`.
  proof: the D7 procedure; qa records each pair's verdict in the evidence file.
- **AC-HC-3** (hard condition) — Given `tools/fanout-manifest.ts`, when it is read, then `PROMPT_TEMPLATE_3B` is unchanged and its provenance comment still contains `content/skill-integrator.md`, `the single canonical copy` and `E177a render golden`; no template line equals a trimmed `docs/lane-protocol.md` line longer than 20 characters.
  proof: `node --test test/e178a-integrator-role.test.mjs test/e177a-manifest.test.mjs test/e289-render-addendum.test.mjs` green (e178a AC15, e177a AC6/AC7, AC-E289-6); `git diff --quiet a67d799...HEAD -- test/fixtures/e177a/render-e177a.golden.txt; echo "exit=$?"` prints `exit=0`.
- **AC-HC-4** (hard condition) — Given the tests this lane must not touch, when they run, then they are green and unmodified.
  proof: `node --test test/e286-integrator-trust-and-git.test.mjs test/e329-integrator-sop-followups.test.mjs test/e246-mailbox-teardown.test.mjs test/e295-hop-cap-and-sop-halves.test.mjs test/e296-manifest-tier.test.mjs test/e294-lane-enterworktree.test.mjs test/e288-integrator-stage0.test.mjs test/e297-main-protected-sop.test.mjs test/e336-portable-pull.test.mjs test/error-code-contract.test.mjs` green; `git diff --quiet a67d799...HEAD -- test/e286-integrator-trust-and-git.test.mjs test/e329-integrator-sop-followups.test.mjs test/e246-mailbox-teardown.test.mjs test/e295-hop-cap-and-sop-halves.test.mjs test/e296-manifest-tier.test.mjs test/e294-lane-enterworktree.test.mjs; echo "exit=$?"` prints `exit=0`.
- **AC-HC-5** — Given the shared generated artifacts this lane owns, when the suite runs, then `test/context-budget.test.mjs` and the compose-golden tests are green; the integrator SOP is not part of any composed bundle, so no re-pin is expected — if one is needed, qa re-pins and explains every hunk in the evidence file.
  proof: `node --test test/context-budget.test.mjs` green, plus the compose-golden test files that read `test/fixtures/compose-golden/**`.
- **AC-HC-6** — Given the lane branch, when `node scripts/fanout.mjs check specs/fanout-post-v4-w8.md e292` runs, then it exits 0.
  proof: `node scripts/fanout.mjs check specs/fanout-post-v4-w8.md e292; echo "exit=$?"` prints `exit=0`.
- **AC-HC-7** — Given the final HEAD with a clean worktree (everything committed), when the full suite runs, then it is green.
  proof: `node scripts/test-lock.mjs -- npm test`

## Copy / Strings

| string id | exact text (quote verbatim) | source |
|---|---|---|
| docs.sister-heading | `` ### `sisterRepos` — sister repos the integrator reads (optional) `` | authored-here — mirrors the `### \`nodeModulesLinks\` — …` heading form in `docs/config.md` |
| ext.heading | `## 外部依賴` (a `（…）` / `(…)` qualifier is allowed, `isNamedHeading` rule) | integrator revision §6.2 D2 (「外部依賴段落」) |
| ext.header | `repo \| 票 \| branch \| sha \| 協定出處` | integrator revision §6.2 D2 (對方 repo、票號、分支 sha、協定出處); 票 matches the Lanes header column name |
| err.ext-duplicate | `EXTERNAL_DEPS_SECTION_DUPLICATE: <n> "## 外部依賴" sections found (lines <a>, <b>); exactly one is allowed` | authored-here — same shape as `HANDOFF_SECTION_DUPLICATE` |
| err.ext-table | `EXTERNAL_DEPS_TABLE_ABSENT: section "<heading line>" (line <n>) has no table with a data row` | authored-here — same shape as `DECISIONS_TABLE_ABSENT` |
| err.ext-header | `EXTERNAL_DEPS_HEADER_DIFFERS: section "<heading line>" line <n>: header is "<found cells joined by \| >", expected exactly "repo \| 票 \| branch \| sha \| 協定出處"` | authored-here — same shape as `DECISIONS_HEADER_DIFFERS` |
| err.ext-row | `EXTERNAL_DEPS_ROW_INVALID: 外部依賴 row <n> (line <l>): <reason>`, `<reason>` one of `<k> cell(s), expected 5` · `repo "<v>" is not a name of [A-Za-z0-9_.-]` · `票 is empty` · `branch "<v>" is not a single ref name` · `sha "<v>" is not 7–40 lowercase hex` · `協定出處 is empty` | authored-here — reasons follow the `DECISION_*` row messages |
| check.ext-diff | `DIFF  外部依賴 <repo> <branch>: 清單「<recorded sha>」／repo「<now>」` | authored-here — same `DIFF  ` prefix and 「」／ pair form as the existing fact lines of `compareFacts` |
| err.sister-unknown | `SISTER_REPO_UNKNOWN: 外部依賴 row <n>: repo "<name>" is not declared in sisterRepos of .current/.config.json` | authored-here |
| err.sister-config | `SISTER_REPO_UNKNOWN: 外部依賴 names sister repos, but .current/.config.json could not be read (<getConfigError text, newlines collapsed to one space>)` | authored-here — reuses the `getConfigError` text like `CONFIG_UNREADABLE_WARN` |
| err.sister-not-git | `SISTER_REPO_NOT_GIT: sister repo "<name>" (sisterRepos in .current/.config.json) is not a git repository at its declared path` | authored-here — the path is deliberately not echoed (`WORKTREE_ABSOLUTE_WARN` convention) |
| err.template-pointer | `TEMPLATE_POINTER_ABSENT: the dispatch-prompt template does not hold the lane-rules pointer exactly once, so the two-layer pointer cannot replace it — fix PROMPT_TEMPLATE_3B or LANE_PROTOCOL_POINTER in tools/fanout-manifest.ts` | authored-here — E343 |
| docs.addendum-invalid | ``  - `ADDENDUM_INVALID` — the value is absolute, starts with `~`, or normalizes to `.` or to a path whose first segment is `..` (a name such as `..foo` is accepted). The message does not echo the value. `` | E342 (backlog row) — matches `isValidAddendumPath` |
| docs.render-from-primary | `` Run `render` from primary: run from a lane worktree's own build output, the agc install is that worktree, so the prompt would name an absolute path into the worktree. `` | E342 (backlog row) |
| sop.premises | ``for every instruction the prompt and the lane rules it points at give (agc's generic `docs/lane-protocol.md`, plus the repo addendum named by `laneProtocolAddendum` in `.current/.config.json` when that key is set), confirm by command against the repo's current state`` — replaces ``for every instruction the prompt and `docs/lane-protocol.md` give, confirm by command against the repo's current state`` in check 1; the rest of the line is unchanged | manifest 「SOP 兩層說法」 bullet (E290 knock-on); integrator revision §6.3 |
| sop.render-layers | `` Shared rules live in two layers only — agc's generic `docs/lane-protocol.md` and, when `laneProtocolAddendum` is set in `.current/.config.json`, the repo addendum it names (`render` points the lane at both); the prompt carries lane-specific fields only. `` — replaces `` Shared rules live only in `docs/lane-protocol.md`; the prompt carries lane-specific fields only. `` | manifest 「SOP 兩層說法」 bullet; integrator revision §6.3 |
| sop.stage4-layers | `` Message format, lane-side rules and the report format: `docs/lane-protocol.md` §5 and §6 — the only copy; a repo's own lane rules live in the addendum named by `laneProtocolAddendum`. `` — replaces the sentence `` Message format, lane-side rules and the report format: `docs/lane-protocol.md` §5 and §6 — the only copy. `` (the `Send with …` sentence after it is unchanged) | manifest 「SOP 兩層說法」 bullet; keeps `the only copy` (e178a AC-file check) |
| sop.status-sister | `` When `.current/.config.json` declares `sisterRepos`, also read each sister repo, read-only: `node scripts/lane-status.mjs --repo <path>` for its in-flight lanes and their branches, and `git -C <path> rev-parse --short <branch>` for each branch's sha (`<path>` resolved against primary). `` — inserted after the first sentence of *Status (any time)* | integrator revision §6.2 D1 |
| sop.takeover-sister | `` When `sisterRepos` is declared, also read each sister repo as in *Status* before acting; step 2 already compared every sha in the manifest's `## 外部依賴` section. `` — appended to Take-over step 4 | integrator revision §6.2 D1, D2 |
| sop.stage1-ext | `` When the wave depends on work in a repo declared in `sisterRepos`, add the optional `## 外部依賴` table (`repo \| 票 \| branch \| sha \| 協定出處`, `repo` = the `sisterRepos` name): `validate` checks its format, and `handoff --check` compares each recorded sha with that branch now. `` — appended to Stage 1 step 6 | integrator revision §6.2 D2; PM addition (Gate Summary G10) |
| sop.idle-resume | `` Resuming — the human says so in this session, or a `接手 <manifest>` session takes over — re-arms the mailbox watch from that section's `watch baseline` line, never the current count, and simply restarts `node scripts/lane-status.mjs --watch` with the same options (it has no baseline in the handoff). `` — replaces the sub-bullet's last sentence | E344 (backlog row, item 1) |
| sop.handoff-timing | `` Run it after the last lane's finish while none of the other bookkeeping edits (queue entries, backlog rows and done-marks, the plan document) is uncommitted — before making them, or after committing them: the tool records every uncommitted path except the manifest in its `git status` fact and marks the primary `lane-status` row `dirty`, so a bookkeeping edit left uncommitted then is gone from both facts once the pull request merges, and a later `handoff --check <manifest>` (step 7 continue, *Take-over*) reports both as `DIFF` and stops; a file that stays uncommitted across the merge, such as primary's own `.current/` working files, leaves both facts unchanged. `` — replaces the sentence from `Run it after the last lane's finish, while the manifest is primary's only uncommitted change` through `reports both facts as \`DIFF\` and stops.` | E344 (backlog row, item 2) |

In the table, `\|` stands for a literal `|` (escaped only for this table). The `err.*` lines are written by the existing formatter (`fanout: error: <CODE>: <message>`). None of the new codes ends in a gate-code suffix (`test/error-code-contract.test.mjs` `SUFFIX_RE`), and none is named in `content/**`.

## Visual Tokens

| token id | property | value (quote verbatim) | source |
|---|---|---|---|
| N/A | — | — | feature has no visual literals |

## Visual Widgets

| widget id | description | source-node |
|---|---|---|
| N/A | — | feature has no non-primitive widgets |

## Out of Scope

- Editing `docs/lane-protocol.md`, writing `docs/lane-protocol-addendum.md`, or setting `laneProtocolAddendum` in `.current/.config.json` (lane e290).
- A cross-repo mailbox (integrator revision §6.2 rationale) and any write into a sister repo.
- Mid-wave handoff (E293, deferred).
- A config `schema_version` bump and its migration (human ruling 2026-10-19).
- A new `lane-status` column or flag (Gate Summary G9): `tools/lane-status.ts`, `scripts/lane-status.mjs`, `scripts/fanout.mjs` stay untouched.
- `handoff` (generate) emitting a sister-repo fact; `MOVED` for a sister branch that only moved forward (G6).
- Any other SOP wording (Stage 1 shared-artifact list, Stage 6 invocation forms); `content/const-15-core-tail.md`'s `docs/lane-protocol.md` sentence (still true for the generic file).
- Release bookkeeping (version, CHANGELOG, backlog done-marks) — release-engineer after the wave.

## Dependencies / Prerequisites

- E285 (SOP session handoff) and E289 (`laneProtocolAddendum`, render two-layer pointer) shipped before base `a67d799`. Resource audit: zero external references — every source is an in-repo document (`external_refs` omitted).
- **D1 — `sisterRepos` key.** Exported `interface SisterRepo { name: string; path: string; owns: string; backlog?: string; contracts?: string[] }`; `WorkspaceConfig.sisterRepos?: SisterRepo[]`, filtered in `loadConfigEntry` per AC-E292-1 next to `laneProtocolAddendum`. Example: `"sisterRepos": [{ "name": "receiver", "path": "../receiver", "owns": "the device protocol", "backlog": "docs/backlog.md", "contracts": ["README.md"] }]`. Read by `handoff --check` (code) and by the integrator SOP (agent reads the file); nothing else changes behaviour on it.
- **D2 — where the section is checked.** A new exported pure reader in `tools/fanout-manifest.ts` (name sr-engineer's choice, e.g. `readExternalDeps(text)`) returns `{ rows, errors }` for the `## 外部依賴` section (no section ⇒ no rows, no errors). `validateManifest` appends its errors after the existing ones (like `handoffSectionErrors`); `parseManifest` does not call it, so render, check, check --cut, owners and handoff generate are unaffected (AC-E292-6). Error scope: a new `FanoutErrorScope` value or `"input"`, sr-engineer's choice.
- **D3 — section format.** Heading copy `ext.heading`, detected like `## 接手步驟` (`splitSections` + `isNamedHeading`); first table of the section; header exactly copy `ext.header`; at least one data row. Per row (cells trimmed; one surrounding backtick pair stripped from `repo`, `branch` and `sha`): `repo` matches `^[A-Za-z0-9_.-]+$` and is not `.` / `..`; `票` non-empty; `branch` non-empty, no whitespace, does not start with `-`; `sha` matches `^[0-9a-f]{7,40}$`; `協定出處` non-empty (free text, e.g. `README.md §3`). Validated whether or not the manifest is closed.
- **D4 — E343 guard.** Export `LANE_PROTOCOL_POINTER` and a pure `replaceLanePointer(template, replacement): string | undefined` (undefined unless the pointer occurs exactly once). `renderPrompt` uses it whenever the two-layer pointer applies and pushes `TEMPLATE_POINTER_ABSENT` (scope `input`) when it returns undefined. `RenderOptions` gains an optional `template` test seam (the CLI never sets it; default `PROMPT_TEMPLATE_3B`), mirroring the E289 `installRoot` seam. A module-load throw is rejected (G11). `PROMPT_TEMPLATE_3B` itself does not change.
- **D5 — `handoff --check` sister comparison.** Runs only when the manifest has a `## 外部依賴` section; otherwise primary's config is never read and every code path is the base one. Section errors → exit 2 (AC-E292-5 codes). Config read with `loadConfig(<primary>)` / `getConfigError(<primary>)`; each row's sister root = `path.resolve(<primary>, entry.path)`; git-repo test = `git rev-parse --git-dir` with that cwd (a throw, including a missing cwd, is `SISTER_REPO_NOT_GIT`); branch sha = `git rev-parse --verify --quiet <branch>^{commit}` there, absent ⇒ `（缺）`. Equal when the current full sha starts with the recorded sha. Lines and counts per AC-E292-7; `HANDOFF_CHECK_SUMMARY` unchanged. All git via `execFileSync` argv, read-only.
- **D6 — validate baseline at dispatch base `a67d799`** (AC-HC-1): exit 0, no codes, for `fanout-e229`, `fanout-e233`, `fanout-e234`, `fanout-e235`, `fanout-e243-e248`, `fanout-e246-e259`, `fanout-e250`, `fanout-e258`, `fanout-e260-followups`, `fanout-e260`, `fanout-feedback-leftovers-wave2`, `fanout-feedback-leftovers`, `fanout-post-v4-w1` … `fanout-post-v4-w8`, `fanout-wave7.2`, `fanout-wave7.2b`, `fanout-wave7` (all `.md`); exit 2 with `DECISIONS_SECTION_ABSENT` + `PINS_SECTION_ABSENT` for `fanout-wave5.1.md` and `fanout-wave6.md`. No real manifest has a `## 外部依賴` heading (only prose mentions in `fanout-post-v4-w8.md`).
- **D7 — byte-identity procedure** (AC-HC-2), each git command its own call: `git archive --format=tar -o "$TMPDIR/e292-base.tar" a67d799 dist scripts package.json`; extract it into a fresh `$TMPDIR/e292-base/`; symlink the worktree's `node_modules` into it; then run base = `node "$TMPDIR/e292-base/scripts/fanout.mjs" …` and head = `node scripts/fanout.mjs …` for each AC-HC-2 pair from the worktree root and compare stdout, stderr and exit code. The base copy never enters the repo; the evidence names it `$TMPDIR/e292-base`, never an absolute path.
- **D8 — cross-lane notes.** e290 sets `laneProtocolAddendum` in this repo's config; every render test of this lane uses temp primaries, so e296 AC10 and e177a AC7 meet the two changes first at integration CI (manifest 「跨 lane 的交會點」). The SOP wording names only the shipped key `laneProtocolAddendum`, never e290's file contents.
- **Architect hop skipped.** The work touches three code modules, but each change is local and additive on existing import edges (`fanout-handoff` already imports `fanout-manifest`, `fanout-manifest` already imports `config`); D1–D5 fix the two new data shapes (config key, manifest table), every error code, the module placement and the comparison rule, so no design question is left for an architecture doc. Same reasoning as e289. Skipping also avoids the lane-protocol §5-2 second pre-review.

## Gate Summary (option choices)

| # | choice | decision | why |
|---|---|---|---|
| G1 | config `schema_version` bump? | **No bump** (stays 2) | **human ruling 2026-10-19** (manifest Decisions); additive-optional precedent `laneProtocolAddendum`, `nodeModulesLinks` |
| G2 | key name and shape | **PM option**: `sisterRepos`, array of `{ name, path, owns, backlog?, contracts? }`, surfaced only with ≥ 1 valid entry, first name wins | array keeps declared order and makes `name` explicit; alternative (object keyed by name) rejected — no order, duplicate keys invisible in JSON |
| G3 | absolute `path` allowed? | **PM option**: relative only (absolute / `~` entries dropped, non-fatal) | `.current/.config.json` is tracked here; an absolute path would leak a local path into git; sister repos sit side by side (`../x`) |
| G4 | how a manifest row names the repo | **PM option**: `repo` = a `sisterRepos` name, not a path | one source of truth for the path; the manifest stays free of local paths |
| G5 | where the section is validated | **PM option**: `validateManifest` only (D2) | render / check / owners / handoff generate stay byte-identical by construction (hard condition) |
| G6 | sister branch moved forward (recorded sha is an ancestor) | **needs human ruling** — recommendation: **`DIFF`, exit 1** (never `MOVED`) | the point of D2 is to notice that the other repo moved; take-over then stops and the human says continue, the existing pattern for a mail-after-watch-stop `DIFF`. Alternative: `MOVED` (exit 0) for a fast-forward, which would let a contract change pass a take-over silently |
| G7 | unresolvable inputs | **PM option**: branch gone ⇒ `DIFF` with `（缺）` (exit 1); undeclared name, unusable config, path not a git repo ⇒ exit 2 | a deleted branch is a fact that changed; a missing declaration is a setup error, like `REF_NOT_FOUND` |
| G8 | `handoff` (generate) and the section | **PM option**: ignores it | the manifest's own table is the record; generate stays byte-identical |
| G9 | branch sha in `status` / take-over | **PM option**: SOP pairs `lane-status --repo <path>` with `git -C <path> rev-parse --short <branch>`; no `lane-status` change | the listing prints branches but no tip sha; adding a column would move e177b / e178b outputs for every user |
| G10 | SOP Stage 1 mention of `## 外部依賴` (copy `sop.stage1-ext`) | **PM addition — integrator to confirm in pre-review** | the brief names only `status` and take-over; without a Stage 1 sentence no integrator learns the section exists. Drop it on the integrator's word and AC-E292-9 loses that literal |
| G11 | E343: module-load check vs render-time check | **PM option**: render-time check (key-set path only) + exported helper + `template` test seam (D4) | a module-load throw would break `validate`, `check` and `owners` too; the seam makes "fails loudly" provable by a test |
| G12 | E344 Stage 6 wording | copy `sop.handoff-timing` | names the bookkeeping edits and explains why files uncommitted across the merge do no harm (backlog row) |
| G13 | E290 knock-on wording | copies `sop.premises`, `sop.render-layers`, `sop.stage4-layers`, written from the key name only | manifest 「SOP 兩層說法」; no dependency on e290's file contents |
| G14 | architect hop | **skipped** | see Dependencies, last bullet |

## Cut

| id | desc | depends_on | est. files | touches | design-link |
|---|---|---|---|---|---|
| T-E292-01 | sr: `SisterRepo` + `sisterRepos` in `WorkspaceConfig`, non-fatal filter in `loadConfig` (D1, G2, G3, no schema bump); `docs/config.md` `### sisterRepos` section (AC-E292-3); rebuild dist. qa: new config test (AC-E292-1..3) | none | 6 | `tools/config.ts`、`dist/tools/config.*`、`docs/config.md`、`test/e292-config-sister-repos.test.mjs` | — |
| T-E292-02 | sr: `## 外部依賴` reader + `validateManifest` format errors, four `EXTERNAL_DEPS_*` codes (D2, D3, G5); rebuild dist. qa: new validate test (AC-E292-4..6) + baseline sweep (AC-HC-1) | none | 6 | `tools/fanout-manifest.ts`、`dist/tools/fanout-manifest.*`、`test/e292-external-deps-validate.test.mjs` | — |
| T-E292-03 | sr: `handoff --check` compares each `## 外部依賴` sha with the sister branch now; `SISTER_REPO_UNKNOWN` / `SISTER_REPO_NOT_GIT` (D5, G6–G8); rebuild dist. qa: new handoff test with temp primary + sister repos (AC-E292-7, AC-E292-8) + byte-identity procedure (AC-HC-2) | T-E292-01, T-E292-02 | 6 | `tools/fanout-handoff.ts`、`dist/tools/fanout-handoff.*`、`test/e292-handoff-sister-sha.test.mjs` | — |
| T-E343-01 | sr: export `LANE_PROTOCOL_POINTER` + `replaceLanePointer`; render pushes `TEMPLATE_POINTER_ABSENT`; `template` test seam; template and provenance comment unchanged (D4, G11); rebuild dist. qa: new guard test (AC-E343-1..3) + AC-HC-3 | T-E292-02 | 5 | `tools/fanout-manifest.ts`、`dist/tools/fanout-manifest.*`、`test/e343-render-pointer-guard.test.mjs` | — |
| T-E342-01 | sr: `docs/config.md` `ADDENDUM_INVALID` bullet + run-from-primary sentence (copies `docs.addendum-invalid`, `docs.render-from-primary`). qa: new doc test (AC-E342-1) | T-E292-01 | 2 | `docs/config.md`、`test/e342-config-doc-wording.test.mjs` | — |
| T-E292-04 | sr: integrator SOP — two-layer wording at Stage 3 check 1, Stage 3 *Render*, Stage 4 opening (E290 knock-on, G13) + sister-repo wording in *Status*, *Take-over* step 4, Stage 1 step 6 (G9, G10). qa: re-pin e178a AC10, new SOP test (AC-E292-9), AC-HC-4, AC-HC-5 | T-E292-03 | 3 | `content/skill-integrator.md`、`test/e178a-integrator-role.test.mjs`、`test/e292-integrator-sop.test.mjs` | — |
| T-E344-01 | sr: integrator SOP Stage 4 idle-stop resume sentence + Stage 6 *Write the handoff* timing (copies `sop.idle-resume`, `sop.handoff-timing`). qa: re-pin e285 (AC-E344-1, AC-E344-2), AC-HC-6, final full suite (AC-HC-7) | T-E292-04 | 2 | `content/skill-integrator.md`、`test/e285-integrator-session-handoff.test.mjs` | — |
