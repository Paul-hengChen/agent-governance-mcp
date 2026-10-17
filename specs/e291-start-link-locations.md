# e291-start-link-locations

Lane `e291` of fan-out wave `specs/fanout-post-v4-w6.md` (post-v4 queue wave 6). Two tickets batched per the integrator manifest: **E291** (P3) and **E335** (P3), both in `bin/agc-init.mjs`. The scope cut is the manifest's e291 `範圍切線` cell (human-approved 2026-10-17); this spec writes it down and records the two choices the manifest delegates to PM (E291 key shape / schema bump, E335 option). It does not re-open the cut.

Line references below were verified against the lane base (`902462e`) at cut time.

## Problem Statement

**E291** (`docs/integrator-revision-2026-10-08.md` §4 O2, §7.2) — `agc feature start` links exactly one `node_modules`: the repo root's (`bootstrapLaneEnv`, `bin/agc-init.mjs` :1395–1460, link block :1406–1437). When the primary checkout has no root `node_modules` it warns (:1415–1420) and links nothing. A repo whose JavaScript lives in a subdirectory (for example `web/`) gets a useless root warning on every lane and must create `web/node_modules` by hand each time, and that hand-made symlink is not covered by the shared exclude rule `/node_modules` (`LANE_EXCLUDE_RULES`, :1046), so it shows up in `git status`. There is no way to configure the link locations.

**E335** (filed by lane e287 as `E287-NEW-2`) — `agc feature finish` on a lane whose `.current/<lane>/pending-tickets.md` is a symlink never converges. The O6 detector `readUnallocatedFindings` (:2203) follows the link (`fs.statSync`, :2209) and reads the target's bytes; the lane-close harvest (`executeLaneClose` `fs.cpSync`, :2678), the abandon harvest (`executeAbandonCurrentHarvest`, :1825) and the re-run refresh (`executeHarvestRefresh`, :2745) copy the link as a link. The preserve post-check `executeFindingsPreserve` (:2317) then sees a symlink at the destination (`fileHasBytes` uses `lstat` and requires a regular file, :2188–2196) and fails with `a different file is already there` (:2338). Every re-run re-copies the link and fails the same way. The failure is fail-closed (worktree and branch kept), but the lane cannot be finished without hand repair, and a history copy that is a symlink into the worktree would dangle once the worktree is removed.

## User Stories

- As an integrator on a repo whose JavaScript lives in `web/`, I want `agc feature start` to link `web/node_modules` from the primary checkout, so that I do not create that link by hand for every lane.
- As an integrator on such a repo, I want the root `node_modules` warning to stop when I have said the root is not a link location, so that start's output only shows real problems.
- As an integrator on any repo that does not set the new key, I want `agc feature start` to behave exactly as before, so that nothing changes for me.
- As an integrator, I want `agc feature finish` to succeed on a lane whose `pending-tickets.md` is a symlink, keeping the findings' contents (not a link) in the history dir, so that re-running finish is not required and no finding is lost.

## Acceptance Criteria

Tests are qa-owned (Constitution §2). Test files must build their own fixture repos (temp dirs); they must not assert growing content of any real `specs/fanout-*.md` and must not diff against a fixed base sha.

### Decisions (PM, delegated by the manifest)

- **D1 — key name and shape.** `.current/.config.json` gets an optional top-level key **`nodeModulesLinks`**: an array of repo-relative directory paths, each naming a directory whose `node_modules` `feature start` links to the same directory's `node_modules` in the primary checkout. `"."` means the repo root. The list **replaces** the root default: `["web"]` links only `web/node_modules` (and gives no root warning); `[".", "web"]` links both; `[]` links nothing and prints no node_modules line. Why replace: the O2 complaint is the root warning on a repo with no root install; an additive list could not silence it.
- **D2 — validation.** An entry is valid when it is a non-empty string that, after stripping one trailing `/`, is either exactly `.` or a `/`-separated path whose every segment is non-empty, is not `.` or `..`, and contains no backslash, no `*` `?` `[` `]` and no C0 control character or DEL; and it does not start with `/` or a Windows drive prefix (`X:`). `./web` is invalid (a `.` segment). Valid entries are deduplicated (first occurrence wins) and kept in list order. Invalid entries are skipped with a warning; the remaining valid entries still apply. A non-array value (including `null`) is ignored with a warning and the root-only default applies. The character class mirrors `GITIGNORE_UNSAFE_SEGMENT_RE` (:1061) because each location becomes an exclude rule; the parser lives in `tools/config.ts` and is the one validation definition for this key.
- **D3 — no config schema bump.** `CURRENT_VERSIONS.config` stays `2`. The key is additive-optional and absence means the pre-E291 behavior, so no migration transform exists to register — the same precedent `tools/config.ts` records for `driftBaselineIds`, `tokenBudgetPerFeature`, `host`, `cutApprovalAutoTier` and `staleDispatchNotifyFile`. `schema/**` and `docs/schema-versions.md` are not touched.
- **D4 — where start reads the key.** From the primary checkout's toplevel, `<repo root>/.current/.config.json`, read as raw JSON (like `checkArtifactsDrift`, :849–860; never through `loadConfig`, which may heal-write). Entries are relative to the repo root. A missing, unreadable, unparseable or non-object config file, or a config without the key, is treated as "key absent" silently. When the key is absent, `feature start` does not load `dist/tools/config.js` at all.
- **D5 — exclude rules.** `LANE_EXCLUDE_RULES` is unchanged and still upserted on every start. Each valid non-root location `<loc>` adds `/<loc>/node_modules` (no trailing slash, same reason as `/node_modules`: the lane copy is a symlink) to the same `upsertSharedExclude` call, after the three static rules.
- **D6 — per-location checks.** For each valid location, in order: (1) the lane-side directory `<lane>/<loc>` must be a real directory with no symlinked path segment inside the lane checkout — else warn and skip (never create the directory); (2) primary `<repo root>/<loc>/node_modules` must be a directory (`statSync`, as at :1411) — else the primary-missing warning; (3) `<lane>/<loc>/node_modules` must not exist (`lstat`) — else the existing already-exists warning; (4) otherwise create the symlink (junction on win32, as at :1427) and print the link line and the shared-install warning. For `"."` step (1) is skipped and steps (2)–(4) render byte-identical to the base strings.
- **D7 — E335 option: dereference.** The history copy of a symlinked `pending-tickets.md` becomes a regular file holding the bytes the O6 detector read. It is done at the single choke point that runs after every harvest that can cover the file and before the worktree is removed — `executeFindingsPreserve` (called at :3169 for `--shipped`, :3228 for `--abandoned`; `executeHarvestRefresh` runs before it at :3165). When the destination is a symbolic link (`lstat`) **and** the plan marked the destination as covered by this run's harvest, replace the link entry itself (write the bytes to a sibling temp file, then `renameSync` over the link) — never write through the link. Then the existing `fileHasBytes` post-check runs unchanged. Not chosen: a plan-time refusal, which keeps the hand repair the ticket is about and adds a Copy string; and `cpSync({ dereference: true })` for the whole lane dir, which would change how every other symlinked lane file is harvested. Only `pending-tickets.md` changes behavior.
- **D7 amendment (2026-10-17, implementation deviation recorded; ACs unchanged).** The dereference lives in one shared helper (temp file + `renameSync` over the entry, never through the link) called at **two** points, not one: `executeFindingsPreserve` (as above) and `executeHarvestRefresh`. Why the second point: on base, the AC-E335-3 re-run never reaches `executeFindingsPreserve` — `executeHarvestRefresh`'s `fs.cpSync` of the lane link over the history link a failed earlier run left throws `ERR_FS_CP_EINVAL` ("src and dest cannot be the same"), and over a now-regular history file throws `EEXIST`. So the refresh writes the detector's bytes for the covered `pending-tickets.md` when the lane source is a symlink; every other refreshed file keeps `cpSync`. Only `pending-tickets.md` changes behavior. T-E335-03 (AC-E335-6) uses the same helper or the same rule for the `--abandoned` whole-dir harvest.
- **D8 — colliding history links on an `--abandoned` re-run (amendment 2, 2026-10-17).** Re-opens the PASS feature: CI job `test (20)` disproved AC-E335-6 (a) and (b) on Node 20 (finish exit 1, expected 0) while `test (22)` was green. Cause: in `executeAbandonCurrentHarvest` the whole-dir `fs.cpSync(srcAbs, histAbs, { recursive: true, force: true, errorOnExist: false })` throws on Node 20 `EINVAL … cannot copy <target> to a subdirectory of self <history>/<file>` when another symlinked lane file (not `pending-tickets.md`) already sits in history as a link from the refused first run; Node 22 overwrites it with the lane's link. T-E335-03 set aside only the history copy of `pending-tickets.md`. Rule: before the whole-dir copy, every `--abandoned` whole-dir harvest walks the lane-side `.current/<lane>/` tree without following links; for each lane-side entry that is a symbolic link (`lstat`) whose same relative path under the history dir is already a symbolic link (`lstat`), the history link is renamed aside with the same aside naming and lifecycle T-E335-03 uses for `pending-tickets.md` (that file keeps its existing set-aside; it is not set aside twice). On any failure in the harvest, every aside is renamed back to its original path (a restore that fails leaves the entry at its aside path — lossless) and the existing `failed (…) — worktree and branch left in place` error is reported unchanged. On success every aside is removed. Effect: the result equals today's Node 22 result — the lane's link is copied as a link, resolving to the lane link's target — on Node 20 and Node 22 alike. Only rename operates on history entries; nothing is ever written through a link. History entries that are regular files or directories, and lane-side entries that are not links, are not set aside. Not gated on the shape of `pending-tickets.md`: the Node 20 throw does not depend on it, and on Node 22 the set-aside changes no result, so a regular-file `pending-tickets.md` lane ends byte-identical to before (AC-E335-5). Not chosen: `cpSync({ dereference: true })` (changes link-copy semantics) and removing colliding history links before the copy (not lossless on failure).

### E291 — configurable node_modules link locations (`bin/agc-init.mjs`, `tools/config.ts`, `docs/config.md`)

- **AC-E291-1** — Given a fixture repo whose primary `.current/.config.json` has no `nodeModulesLinks` key (and, separately, no config file at all, and an unparseable config file), when `agc feature start` runs, then its stdout, stderr, exit code, the lane's `node_modules` link and the shared `info/exclude` content equal the base behavior: the root-only link with the base strings, or the base primary-missing warning when primary has no root `node_modules`.
  proof: `node --test test/e291-start-link-locations.test.mjs` (key-absent cases) and `node --test test/agc-feature-lifecycle.test.mjs` passing with that file unmodified on the E291 commits.
- **AC-E291-2** — Given `"nodeModulesLinks": ["web"]`, a primary `web/node_modules` directory and a `web/` directory on the base branch, when `feature start` runs, then `<lane>/web/node_modules` is a symlink resolving to the primary's `web/node_modules`, `<lane>/node_modules` does not exist, stdout carries `e291.link-line` and `e291.shared-warning` for `web/node_modules`, stderr carries no root primary-missing warning, and the exit code is 0.
  proof: `node --test test/e291-start-link-locations.test.mjs` (subdir-only case).
- **AC-E291-3** — Given `[".", "web"]` with both primary installs present, when `feature start` runs, then both links exist, and the root lines are byte-identical to the base strings, printed before the `web/` lines.
  proof: `node --test test/e291-start-link-locations.test.mjs` (root+subdir case).
- **AC-E291-4** — Given `["web"]`, when `feature start` runs, then the shared `info/exclude` holds `/web/node_modules` exactly once (also after a second start for another lane), the `added … to the shared info/exclude` line lists it after the static rules on the first start, and `git status --porcelain` in the new lane is empty.
  proof: `node --test test/e291-start-link-locations.test.mjs` (exclude case).
- **AC-E291-5** — Given `["web"]` and no primary `web/node_modules`, when `feature start` runs, then it exits 0, creates the lane, creates no link, and stderr carries `e291.primary-missing` rendered for `web/node_modules`.
  proof: `node --test test/e291-start-link-locations.test.mjs` (primary-missing case).
- **AC-E291-6** — Given `["web"]` where the lane checkout has no `web/` directory (and, separately, where `web` is a symlink in the lane checkout), when `feature start` runs, then it exits 0, creates nothing under the lane's `web` path, and stderr carries `e291.lane-dir-missing`.
  proof: `node --test test/e291-start-link-locations.test.mjs` (lane-dir-missing cases).
- **AC-E291-7** — Given `["web"]` where the base branch tracks a `web/node_modules` path, when `feature start` runs, then the checked-out path is left untouched and stderr carries the base already-exists warning naming `<lane>/web/node_modules`.
  proof: `node --test test/e291-start-link-locations.test.mjs` (lane-exists case).
- **AC-E291-8** — Given a list mixing valid and invalid entries (`"/abs"`, `"C:/x"`, `"../up"`, `"a/../b"`, `"./web"`, `""`, `"a//b"`, `"w*b"`, `"a\\b"`, `42`, `null`, plus `"web"` and the duplicate `"web/"`), when `feature start` runs, then each invalid entry produces one `e291.invalid-entry` line on stderr in list order before any per-location line, `web` is linked once, and the exit code is 0.
  proof: `node --test test/e291-start-link-locations.test.mjs` (validation case).
- **AC-E291-9** — Given `"nodeModulesLinks": "web"` (and, separately, `null` and `{}`), when `feature start` runs, then stderr carries `e291.not-array` and the rest of the output is the base root-only behavior.
  proof: `node --test test/e291-start-link-locations.test.mjs` (not-array case).
- **AC-E291-10** — Given `"nodeModulesLinks": []`, when `feature start` runs, then no `node_modules` link is created and no `linked …`, shared-install, primary-missing or already-exists line is printed; the static exclude rules are still upserted.
  proof: `node --test test/e291-start-link-locations.test.mjs` (empty-list case).
- **AC-E291-11** — Given a workspace config, when `loadConfig` reads it, then `WorkspaceConfig.nodeModulesLinks` is the normalized, deduplicated valid list (possibly `[]`) when the key is an array, and absent when the key is absent or not an array; `loadConfig` never throws for any value of the key; `getConfigError` stays null for a well-formed file; `CURRENT_VERSIONS.config` is still `2`; the exported parser `parseNodeModulesLinks` returns the D2 result (valid list plus rejected entries) for the AC-E291-8 list.
  proof: `node --test test/e291-start-link-locations.test.mjs` (config-parse cases).
- **AC-E291-12** — Given a lane started with `["web"]`, when `agc feature finish <id> --shipped` (merged branch) and, in a second fixture, `--abandoned` run, then the worktree is removed without `--force` and the primary's `web/node_modules` directory and its contents are untouched.
  proof: `node --test test/e291-start-link-locations.test.mjs` (finish-after-subdir-link cases).
- **AC-E291-13** — Given `docs/config.md`, when read, then it has a `nodeModulesLinks` section stating: optional; array of repo-relative directories; `"."` = root; the list replaces the root default; `[]` links nothing; the D2 validation rules; invalid entries are skipped with a warning; read from the primary checkout's `.current/.config.json` at `agc feature start`; no schema version change; each listed directory gets a `/<dir>/node_modules` exclude rule.
  proof: `grep -n "nodeModulesLinks" docs/config.md` shows the section; qa reads it against this list.

### E335 — finish converges on a symlinked `pending-tickets.md` (`bin/agc-init.mjs`)

- **AC-E335-1** — Given a lane whose `.current/<lane>/pending-tickets.md` is a symlink to a regular file holding ≥1 valid `pending-ticket` block (link target inside the lane worktree; second case: outside it), the file not committed on `--base`, and the branch merged, when `agc feature finish <id> --shipped` runs once, then it exits 0, the worktree is removed, `.current/history/<YYYY-MM>/<lane>/pending-tickets.md` in the primary checkout is a regular file whose bytes equal the target's, stderr carries `e287.unallocated-warning` naming that path, and the link target (when outside the worktree) is unchanged in bytes.
  proof: `node --test test/e335-symlinked-pending-harvest.test.mjs` (shipped cases).
- **AC-E335-2** — Given the same lane shape and `--abandoned`, when finish runs once, then it exits 0, the worktree is removed, the branch is kept, and the history copy is a regular file with the target's bytes.
  proof: `node --test test/e335-symlinked-pending-harvest.test.mjs` (abandoned case).
- **AC-E335-3** — Given the state a pre-fix failing `--shipped` run leaves (lane already recorded under `tasks.md` `## Closed Lanes`, history copy of `pending-tickets.md` is a symlink, worktree still present), when finish re-runs, then it exits 0, the history copy is a regular file with the target's bytes, and the worktree is removed.
  proof: `node --test test/e335-symlinked-pending-harvest.test.mjs` (re-run convergence case).
- **AC-E335-4** — Given a destination not covered by this run's harvest that already holds a symlink (plan-time path), when finish runs, then it still refuses with the unchanged `e287.preserve-differs-refuse` text and removes nothing — D7 replaces only a link this run's harvest put there.
  proof: `node --test test/e335-symlinked-pending-harvest.test.mjs` (uncovered-symlink refusal case).
- **AC-E335-5** — Given a lane whose `pending-tickets.md` is a regular file, when finish runs (`--shipped`, `--abandoned`, re-run), then behavior is unchanged: `test/e287-finish-findings.test.mjs`, `test/e180-abandoned-harvest.test.mjs`, `test/agc-feature-finish-history.test.mjs` and `test/e246-mailbox-teardown.test.mjs` pass, the last one byte-unmodified.
  proof: `node --test test/e287-finish-findings.test.mjs test/e180-abandoned-harvest.test.mjs test/agc-feature-finish-history.test.mjs test/e246-mailbox-teardown.test.mjs` passes and `git diff --quiet origin/main...HEAD -- test/e246-mailbox-teardown.test.mjs` exits 0.
- **AC-E335-6** (amendment 2026-10-17) — Given a lane whose `.current/<lane>/pending-tickets.md` is a symlink to a regular file holding ≥1 valid `pending-ticket` block, the lane's `.current/<lane>/` untracked (so the `--abandoned` whole-dir harvest runs), and a first `agc feature finish <id> --abandoned` that was refused at `git worktree remove` (for example an untracked file left in the worktree) after leaving the history copy of `pending-tickets.md` in place — (a) as a regular file (state a post-fix first run leaves) and, separately, (b) as a symlink (state a pre-fix first run leaves) — when the refusal cause is cleared and finish `--abandoned` re-runs, then it exits 0, the worktree is removed, the branch is kept, `.current/history/<YYYY-MM>/<lane>/pending-tickets.md` is a regular file whose bytes equal the link target's, and the other files of the lane dir are harvested as before (the whole-dir copy still runs; other symlinked lane files keep today's link-copy semantics). A lane whose `pending-tickets.md` is a regular file behaves unchanged (AC-E335-5 set green, `test/e246-mailbox-teardown.test.mjs` byte-unmodified).
  proof: `node --test test/e335-symlinked-pending-harvest.test.mjs` (abandoned re-run convergence cases a and b).
- **AC-E335-7** (amendment 2, 2026-10-17) — Given the AC-E335-6 fixtures (a) and (b), where the lane dir also holds another symlinked file (`other-link.md`) that the refused first run already copied into history as a link to the same target, when finish `--abandoned` re-runs under **Node 20 and under Node 22** (the CI matrix), then on both runtimes every AC-E335-6 outcome holds (exit 0, worktree removed, branch kept, history `pending-tickets.md` a regular file with the target's bytes) and the history `other-link.md` is a symbolic link resolving to the same target as the lane's link. Given a harvest that fails after D8 set a colliding history link aside, then that link is back at its original path (or, if the restore itself failed, at its aside path) and finish reports the unchanged harvest-failed error with worktree and branch kept.
  proof: `node --test test/e335-symlinked-pending-harvest.test.mjs` exits 0 under Node 20 and under Node 22 — CI matrix jobs `test (20)` and `test (22)`; locally, run the same command with any Node 20.x and any Node 22.x runtime selected through your version manager.

### Lane-wide

- **AC-LANE-1** — Given the final lane HEAD with a clean tree (all work committed, no untracked files), when the full suite runs, then it passes.
  proof: `node scripts/test-lock.mjs -- npm test` exits 0. (Amendment 2: on the final HEAD this must hold under Node 20 and under Node 22 — the CI matrix jobs `test (20)` and `test (22)`.)
- **AC-LANE-2** — Given the lane branch, when its changed files are listed against the merge base, then every path is in the e291 `擁有` cell of the manifest.
  proof: `node scripts/fanout.mjs owners specs/fanout-post-v4-w6.md --range origin/main...HEAD` attributes every changed path to e291 only (or `git diff --name-only origin/main...HEAD` checked against the owned list).
- **AC-LANE-3** — Given `dist/`, when `npm run build` runs on the final HEAD, then `git status --porcelain dist/` is empty (the committed `dist/tools/config.*` matches the source).
  proof: `npm run build && git status --porcelain dist/` prints nothing.

### Completion definition (manifest `完成定義` rows for e291, verbatim)

| 項目 | 負責 | 必要 |
|---|---|---|
| `.current/.config.json` 可設 node_modules 連結位置，`feature start` 照設定建連結；沒設時行為不變；`docs/config.md` 有說明 | e291（E291） | ✓ |
| lane 的 `pending-tickets.md` 是 symlink 時 finish 會收斂，並有回歸測試 | e291（E335） | ✓ |

## Copy / Strings

`{rel}` = `node_modules` for `"."`, else `<loc>/node_modules`. `{primaryNm}` / `{laneNm}` = absolute paths as today. Root rendering of every templated string is byte-identical to the base text at the cited line.

| string id | exact text (quote verbatim) | source |
|---|---|---|
| e291.link-line | `agc feature start — linked {rel} -> {primaryNm}` | base :1428, templated — authored-here: `{rel}` substitution only |
| e291.shared-warning | ``agc feature start — warning: {rel} is shared with the primary checkout (symlink) — never run `npm ci` / `npm install` inside {where} (`npm ci` deletes the directory first, which would delete primary's real {rel} through the link); for an independent install, `rm {rel}` (removes only the link) and then run `npm ci` in {where}`` — `{where}` = `the lane` for `"."`, else `the lane's <loc>/` | base :1430–1436, templated — authored-here: `{rel}`/`{where}` substitution only |
| e291.primary-missing | ``agc feature start — warning: the primary checkout has no {rel} ({primaryNm}) — run `npm install` in {pwhere} first; the lane was created without a {rel} link`` — `{pwhere}` = `the primary checkout` for `"."`, else `the primary checkout's <loc>/` | base :1416–1419, templated — authored-here: substitution only |
| e291.lane-exists | `agc feature start — warning: {laneNm} already exists after checkout (tracked in this repo?) — left as checked out, not linked` | base :1422–1424, reused unchanged |
| e291.lane-dir-missing | `agc feature start — warning: <loc>/ is not a directory in the lane checkout — no <loc>/node_modules link created` | authored-here — new D6 step (1) outcome |
| e291.invalid-entry | `agc feature start — warning: .current/.config.json nodeModulesLinks entry {json} is not a repo-relative directory path (no absolute path, no empty, "." or ".." segment, no backslash, wildcard or control character) — skipped` — `{json}` = `JSON.stringify(entry)` | authored-here — one fixed reason list instead of per-rule strings |
| e291.not-array | `agc feature start — warning: .current/.config.json nodeModulesLinks is not an array — ignored, linking the root node_modules only` | authored-here — D2 non-array outcome |
| e291.config-load-failure | ``agc feature: cannot load dist/tools/config.js from the agc install ({message}) — run `npm run build` (nothing created)`` — `{message}` = the import error's message | authored-here — recorded post-PASS (QA follow-up); only reachable when `nodeModulesLinks` is present and `dist/` is missing or broken |
| e291.usage-start | `          (default <parent>/<repo>-lanes/<ticket-id>), node_modules\n` + `          symlinked to primary's (root, or the directories listed in\n` + `          .current/.config.json nodeModulesLinks), .env byte-copied.\n` (replaces the two lines at :1014–1015 of `STR_USAGE_FEATURE`) | authored-here — usage must name the new key |

E335 adds no string: the existing `e287.unallocated-warning` (":2347") already says the copy is an fs copy kept at `{dstRel}`.

## Visual Tokens

| token id | property | value (quote verbatim) | source |
|---|---|---|---|
| N/A | — | — | feature has no visual literals |

## Visual Widgets

| widget id | description | source-node |
|---|---|---|
| N/A | — | feature has no non-primitive widgets |

## Out of Scope

- `docs/lane-protocol.md` §1 node_modules paragraph wording (E290).
- E304 (finish deleting the remote branch).
- `templates/**`, `docs/arming.md` and every other doc besides `docs/config.md`.
- A config schema version bump and any `schema/**` change (D3).
- Reading `nodeModulesLinks` from a subdirectory workspace's `.current/.config.json` (D4: the repo root's config only).
- Linking anything other than `node_modules` (no `.venv`, no per-location `.env`).
- Changing `npm` install behavior or detecting `package.json` per location.
- E335: dereferencing other symlinked files under `.current/<lane>/` — they are still harvested as links (`cpSync` link-copy semantics); after T-E335-04, when an `--abandoned` whole-dir harvest finds the history dir already holding a same-named link, that history link is first set aside (D8) and then replaced by the lane's link, restored on failure; a history entry that is a regular file where the lane holds a link (no finish run produces it) is not handled; the `alreadyClosed` refresh comparison (`sameFileBytes`, :2499) still lists a symlinked lane `pending-tickets.md` as changed on a re-run (`e125b.harvest-refresh-line`) — harmless, the preserve step re-materializes it; a symlinked `pending-tickets.md` whose target is not a regular file (detector returns null, behavior unchanged).
- Release bookkeeping (version bump, CHANGELOG, backlog done-marks) — integrator / release-engineer after merge.

## Dependencies / Prerequisites

- E287 shipped in v4.8.0 (finish O6 detector and preserve step exist on base `902462e`).
- No design file; mode = no-design (Visual Structural Assertions omitted).
- No external references in the source documents (Resource Audit: zero hits).
- Manifest dispatch pin: `sr-engineer=opus`.
- Order inside the lane: T-E291-01 → T-E291-02 → T-E335-01 → T-E335-03 (serial, `bin/agc-init.mjs` is shared by the last three) → qa.
- Amendment 2026-10-17 (human ruled option (a) in the lane session; integrator accepted the D7 two-point note): D7 deviation note added, AC-E335-6 and T-E335-03 added, T-E335-02 extended to AC-E335-6. Source: sr-engineer finding on commit `c5869b3` (`--abandoned` re-run with a symlinked `pending-tickets.md` fails in `executeAbandonCurrentHarvest` with EEXIST / EINVAL).
- Amendment 2 (2026-10-17, integrator ruling: fix in-lane): CI on the qa-PASS lane HEAD failed `test (20)` (AC-E335-6 a/b) while `test (22)` passed — the PASS is re-opened. D8, AC-E335-7, the AC-LANE-1 Node 20/22 note, T-E335-04 (sr) and T-E335-05 (qa) added. Order: T-E335-04 → code-reviewer pass on T-E335-04 (fresh review round, required before qa) → T-E335-05. Node 20 is verified with a generic command (see AC-E335-7 proof), never a machine-specific path.
- No architect hop: two modules, no new data model, one optional key with a fixed parser contract (D1–D7 above are the contract).
- No item needs a human ruling beyond approving this cut: both choices the manifest delegates to PM are made (D1–D3, D7).

## Cut

| id | desc | depends_on | est. files | touches | design-link |
|---|---|---|---|---|---|
| T-E291-01 | sr: `tools/config.ts` — export `parseNodeModulesLinks` (D2) and surface `WorkspaceConfig.nodeModulesLinks` in `loadConfig` (no schema bump, D3); `docs/config.md` `nodeModulesLinks` section; rebuild dist (AC-E291-11, AC-E291-13) | none | 3 | `tools/config.ts`, `dist/tools/config.*`, `docs/config.md` | — |
| T-E291-02 | sr: `bin/agc-init.mjs` `feature start` — raw-read the key from the primary config (D4), per-location exclude rules (D5) and links (D6), templated strings with byte-identical root rendering, usage text (AC-E291-1..10, AC-E291-12) | T-E291-01 | 1 | `bin/agc-init.mjs` | — |
| T-E335-01 | sr: `bin/agc-init.mjs` `executeFindingsPreserve` — replace a harvest-placed symlink destination with a regular file of the detector's bytes via temp + rename, covered destinations only (D7) (AC-E335-1..5) | T-E291-02 | 1 | `bin/agc-init.mjs` | — |
| T-E291-03 | qa: E291 tests (key absent byte-identical, subdir, root+subdir, exclude, warnings, validation, config parse, finish after subdir link); re-pin owned lifecycle/config tests only if needed (AC-E291-1..13) | T-E291-02 | 1–3 | `test/e291-*.test.mjs`, `test/agc-feature-lifecycle.test.mjs`, `test/config-versioning.test.mjs`, `test/config-cache.test.mjs`, `test/e31-config-nonfatal.test.mjs` | — |
| T-E335-03 | sr: `bin/agc-init.mjs` `executeAbandonCurrentHarvest` — an `--abandoned` re-run converges when the lane's `pending-tickets.md` is a symlink and the history copy already exists (regular file or link): the whole-dir copy must not copy that link over it; the history copy ends a regular file of the detector's bytes (shared D7 helper); every other lane file keeps today's copy semantics (AC-E335-6) | T-E335-01 | 1 | `bin/agc-init.mjs` | — |
| T-E335-02 | qa: E335 regression tests (shipped, abandoned, re-run convergence, uncovered-symlink refusal, abandoned re-run convergence a/b); regular-file finish tests and `test/e246-mailbox-teardown.test.mjs` green unmodified; lane-wide full suite on final HEAD, clean tree (AC-E335-1..6, AC-LANE-1..3) | T-E335-03, T-E291-03 | 1 | `test/e335-*.test.mjs` | — |
| T-E335-04 | sr: `bin/agc-init.mjs` `executeAbandonCurrentHarvest` — before the whole-dir copy, set aside every history link that collides with a lane-side link (D8), same aside naming/restore-on-failure/remove-on-success as T-E335-03; result equals today's Node 22 result on Node 20 and 22; never write through a link (AC-E335-6, AC-E335-7) | T-E335-02 | 1 | `bin/agc-init.mjs` | — |
| T-E335-05 | qa: after the code-reviewer pass on T-E335-04, re-run `test/e335-symlinked-pending-harvest.test.mjs` and the lane-wide full suite under Node 20 and Node 22 on the final HEAD, clean tree; test edits only if needed (AC-E335-1..7, AC-LANE-1..3) | T-E335-04 | 0–1 | `test/e335-*.test.mjs` | — |
