# e217-lane-lifecycle-gaps

Lane `e217` of post-v4 wave 11 (`specs/fanout-post-v4-w11.md`). Tickets: **E217** (`agc feature finish --abandoned` drops git-ignored, unlinked `specs/`) and **E215** (`agc feature start` leaves a lane with no git hooks when a relative `core.hooksPath` points at a git-ignored generated directory). Both live in `bin/agc-init.mjs`.

## Problem Statement

`agc feature finish --abandoned` copies a lane's git-ignored, unlinked `qa_reports/` and `review_reports/` evidence into the primary checkout before `git worktree remove` (E180), and `--shipped` does the same for those two directories plus `specs/` (E214, AC16/AC17). `--abandoned` never looks at `specs/`. In a workspace that git-ignores `specs/` and has no bootstrap link for it, an abandoned lane's spec (and anything else the lane wrote under `specs/`) is deleted with the worktree, and the command still exits 0. That is the silent loss E180 and E214 closed for the other directories (E217).

Separately, `agc feature start` links `node_modules` and copies `.env`, but does nothing about git hooks. When the repository sets a relative `core.hooksPath` that points at a git-ignored generated directory (husky's `.husky/_` is the common case), a fresh worktree does not have that directory, so git runs no hooks in the lane and says nothing. In the adopter acceptance run a commit with a non-conforming subject went through in the lane while the primary checkout's commit-msg hook rejected it (E215). The second half of E215 (nested `node_modules` such as `app/web/node_modules`) already has a fix: E291's `nodeModulesLinks` key lets `feature start` link any listed directory. This spec only decides whether `start` should point users at that key.

## User Stories

- As an integrator abandoning a lane in an all-ignored adopter workspace, I want `finish --abandoned` to keep a copy of the lane's git-ignored specs in the primary checkout, so that the design record survives the worktree removal the same way the qa and review evidence does.
- As an integrator, I want `--shipped` and the existing `--abandoned` qa/review handling to behave exactly as before, so that no shipped evidence layout or test changes under me.
- As a lane operator in a repository whose hooks live in a git-ignored generated directory, I want `feature start` to warn me loudly when the new worktree has no hooks directory, so that I do not commit work that skipped every hook.
- As a lane operator, I want `feature start` to never run a package manager or create files on my behalf beyond what it already creates, so that the primary checkout's dependencies are never put at risk.

## Acceptance Criteria

Test files: E217 → `test/e217-abandoned-specs-harvest.test.mjs`; E215 → `test/e215-start-hooks-path.test.mjs`. Both are new, authored by qa-engineer, and build every fixture repository in `os.tmpdir()` at runtime. "All-ignored lane" means a primary repository whose `.gitignore` ignores `/specs/` and that has no `specs` link, started with `agc feature start`.

### E217: `finish --abandoned` harvests git-ignored, unlinked `specs/`

- **AC-E217-1** (recursive, no token filter): Given an all-ignored lane `<t>` that wrote three untracked files `specs/<t>-feature.md`, `specs/plan-without-id.md` and `specs/<t>-feature/notes/deep.md`, when `finish <t> --abandoned` runs, then it exits 0, each file exists byte-identical in the primary checkout at `specs/abandoned/<t>/<relpath>` (`<relpath>` relative to `specs/`), stdout has one `e217.specs-harvest-line` per file, the worktree is gone and the branch is kept.
  proof: `node --test test/e217-abandoned-specs-harvest.test.mjs` test "AC-E217-1".
- **AC-E217-2** (tracked specs stay where they are, D2 of E73): Given a lane whose `specs/<t>-tracked.md` is committed on the lane branch, when `finish <t> --abandoned` runs, then the file is still at `specs/<t>-tracked.md` on the kept branch (`git show <branch>:specs/<t>-tracked.md` matches its bytes), no commit on the branch touches `specs/`, and the primary checkout gets no copy of it.
  proof: test "AC-E217-2".
- **AC-E217-3** (linked outside: no copy): Given a lane whose `specs` is a symlink resolving outside the worktree (the coord-03 bootstrap shape), when `finish --abandoned` runs, then no `specs/abandoned/` copy is made and no `e217.specs-harvest-line` is printed.
  proof: test "AC-E217-3".
- **AC-E217-4** (differing destination refuses before any mutation): Given an at-risk `specs/x.md` and a primary `specs/abandoned/<t>/x.md` with different bytes, plus a matching ignored `qa_reports/review_T-<T>-01.md` and a committed `.current/<t>/pending-tickets.md` holding one block, when `finish --abandoned` runs, then it exits non-zero with `e180.evidence-harvest-refuse-line` (`--abandoned` token) naming that primary path, and nothing has changed: the worktree, the branch head, the lane's qa file, the primary's `docs/backlog.md` and `.current/history/` are all as before.
  proof: test "AC-E217-4".
- **AC-E217-5** (identical destination, idempotent re-run): Given the primary copy already exists byte-identical, when `finish --abandoned` runs, then it does not refuse, does not copy again (no harvest line for that file), and completes. A run that fails after the specs copy (for example on a blocking `.current/history/` path) followed by a fixed re-run ends with exactly one primary copy per file.
  proof: test "AC-E217-5".
- **AC-E217-6** (dangling symlink refuses before any mutation): Given an at-risk dangling symlink `specs/broken.md`, when `finish --abandoned` runs, then it exits non-zero with `e217.specs-symlink-refuse-line` listing `specs/broken.md`, and nothing has changed (same checks as AC-E217-4).
  proof: test "AC-E217-6".
- **AC-E217-7** (resolvable symlinks are dereferenced): Given at-risk `specs/link-file.md` → a regular file and `specs/link-dir` → a directory holding `a.md`, when `finish --abandoned` runs, then the primary gets regular files `specs/abandoned/<t>/link-file.md` and `specs/abandoned/<t>/link-dir/a.md` with the target bytes, and no symlink.
  proof: test "AC-E217-7".
- **AC-E217-8** (untracked, not ignored: unchanged): Given an untracked spec that is NOT git-ignored, when `finish --abandoned` runs, then the existing precondition refusal fires unchanged (the path is listed as an uncommitted change unrelated to the evidence, nothing moved). This is today's behaviour.
  proof: test "AC-E217-8".
- **AC-E217-9** (control characters escaped): Given an at-risk spec whose file name contains an LF and an ESC byte, when `finish --abandoned` runs, then the harvest line shows them as `\n` and `\x1b` (the `escapeSegmentForDisplay` rendering) and no raw control byte reaches stdout, while the primary copy is written at the raw path. The same escaping applies to every path echoed by `e217.specs-symlink-refuse-line`, the `--abandoned` differs refusal of a specs path, `e217.specs-read-fail-line` and `e217.specs-copy-fail-line`.
  proof: test "AC-E217-9".
- **AC-E217-10** (`--shipped` unchanged): `test/e213-shipped-ignored-shape.test.mjs` and every other existing `--shipped` test pass unmodified; `SHIPPED_EVIDENCE_DIRS` is unchanged, and `--shipped` output stays byte-identical, including for control-character paths (escaping on `--shipped` belongs to E252/E253).
  proof: `node --test test/e213-shipped-ignored-shape.test.mjs` passes on the final HEAD with `git diff <merge-base>...HEAD -- test/e213-shipped-ignored-shape.test.mjs` empty.
- **AC-E217-11** (qa/review handling under `--abandoned` unchanged): `ABANDON_EVIDENCE_DIRS` is still exactly `["qa_reports", "review_reports"]`, and `test/e180-abandoned-harvest.test.mjs` passes unmodified.
  proof: `node --test test/e180-abandoned-harvest.test.mjs` passes with `git diff <merge-base>...HEAD -- test/e180-abandoned-harvest.test.mjs` empty.
- **AC-E217-12** (usage text): `node bin/agc-init.mjs feature` prints `e217.usage-abandoned` in place of the current `--abandoned` lines, and the rest of the feature usage is unchanged (the `e291.usage-start` lines pinned in `test/e291-start-link-locations.test.mjs` included).
  proof: test "AC-E217-12".

### E215: `feature start` warns on a relative `core.hooksPath` missing in the lane

- **AC-E215-1** (warn): Given a primary repository with `core.hooksPath=.husky/_` (relative, shared config), where `.husky/_` is a git-ignored directory that exists in the primary checkout, when `feature start <t>-x` runs, then it exits 0, stderr has exactly one `e215.hooks-missing` line with `{v}` = `.husky/_`, and stdout is byte-identical to the same run without `core.hooksPath`.
  proof: `node --test test/e215-start-hooks-path.test.mjs` test "AC-E215-1".
- **AC-E215-2** (quiet when there is nothing lane-specific): No `e215.hooks-missing` line, and stdout and stderr byte-identical to a run without `core.hooksPath`, when any of these holds: (a) `core.hooksPath` is unset; (b) it is absolute; (c) it starts with `~`; (d) it is relative and the directory exists in the lane, for example a tracked `.githooks/`; (e) it is relative and missing in the primary checkout too.
  proof: test "AC-E215-2" (one sub-case per a–e).
- **AC-E215-3** (warn only, nothing created): In the AC-E215-1 run, the lane has no `.husky/_` entry of any kind afterwards, `git status --porcelain` in the lane is empty, and the shared `info/exclude` holds the same rules as a run without `core.hooksPath`.
  proof: test "AC-E215-3".
- **AC-E215-4** (refusals and rollback unchanged): Each of start's existing refusals (branch exists, path exists, path still registered as a worktree, `git worktree add` fails) with `core.hooksPath=.husky/_` set prints no `e215.hooks-missing` line and creates nothing, exactly as without it.
  proof: test "AC-E215-4".
- **AC-E215-5** (control characters escaped): Given a relative `core.hooksPath` whose value contains an ESC byte and that exists as a directory only in the primary, when `feature start` runs, then the warning shows `\x1b` and no raw control byte reaches stderr.
  proof: test "AC-E215-5".
- **AC-E215-6** (best-effort, never fatal): If reading `core.hooksPath` fails with a git exit status other than 0 or 1, start skips the check silently and finishes with its normal output and exit 0. Nothing in the hooks check can throw into start's flow.
  proof: code review of the T-E215-01 diff (the check uses `gitTry` and a status branch only), plus test "AC-E215-6" if qa can force such a status (for example a `core.hooksPath` entry with an invalid type in a per-test `GIT_CONFIG_GLOBAL`). Otherwise qa records the review-only disposition in the report.
- **AC-E215-7** (no nested `node_modules` output, E291 contract kept): Key-absent `feature start` output is unchanged by this lane (D-E215-3). `test/e291-start-link-locations.test.mjs` passes unmodified, AC-E291-1/D4 included (the key-absent path never loads `dist/tools/config.js`).
  proof: `node --test test/e291-start-link-locations.test.mjs` passes with `git diff <merge-base>...HEAD -- test/e291-start-link-locations.test.mjs` empty.
- **AC-E215-8** (never a package manager): `bin/agc-init.mjs` gains no code path that runs `npm`, `pnpm`, `yarn` or any hook installer.
  proof: `git diff <merge-base>...HEAD -- bin/agc-init.mjs | grep -nE '^\+.*(execFileSync|spawnSync|execSync|spawn)\(\s*"(npm|npx|pnpm|yarn|husky)"'` prints nothing.

### Lane-wide

- **AC-LANE-1**: The full suite passes on the final HEAD with a clean tree. qa reports pass/total, and every existing test listed under *Existing tests* below passes unmodified.
  proof: `node scripts/test-lock.mjs -- npm test` on the final HEAD after `git status --porcelain` is empty.
- **AC-LANE-2**: Every path the lane changes is in the owned set.
  proof: `git diff --name-only <merge-base>...HEAD` lists only `bin/agc-init.mjs`, `specs/e217-lane-lifecycle-gaps.md`, `test/e217-*.test.mjs`, `test/e215-*.test.mjs`, `qa_reports/*E217*`/`*E215*`, `review_reports/*E217*`/`*E215*` and `.current/e217/**`.
- **AC-LANE-3**: No `schema_version` changes and no new config key. `tools/config.ts`, `dist/**` and `docs/config.md` are untouched. `bin/agc-init.mjs` is plain `.mjs` with no compiled twin (`dist/` has no `bin/`), so there are no build artifacts to commit.
  proof: `git diff --name-only <merge-base>...HEAD -- tools dist docs schema` prints nothing.

## Design decisions

### E217

- **D-E217-1: semantics (the manifest's design question).** Neither existing treatment is reused as is. `specs/` gets the **E214/AC17 walk** (recursive, no token filter, per-file at-risk test, resolvable symlinks dereferenced, dangling at-risk symlink refuses, differing destination refuses, identical destination is idempotent, every refusal comes before any mutation). It is applied as a **copy into primary only**, under `--abandoned`'s own `abandoned/` bucket. The token-filtered, non-recursive move of `ABANDON_EVIDENCE_DIRS` does not apply to `specs/`. Rationale:
  1. *No token filter.* A token filter exists to pick this ticket's files out of a shared flat directory. For an at-risk spec there is nothing to pick from: a file is at risk only if it is untracked and git-ignored, and a fresh `git worktree add` checkout contains no untracked files, so every at-risk file under the lane's `specs/` was written by this lane. Spec names are feature slugs (`specs/<feature>.md`, `specs/<feature>-architecture.md`) and are not required to carry the ticket id. A filter would therefore drop exactly the files E217 is meant to save, silently.
  2. *Recursive.* `specs/` is a document tree (per-feature subdirectories, attachments), unlike the flat `qa_reports/`/`review_reports/` report directories. `git worktree remove` deletes nested ignored files just as readily, and E214/AC17 already settled recursion for this directory under `--shipped`.
  3. *Copy, not move.* E73 D2 decided that `--abandoned` leaves specs in place so a re-picked ticket still finds them. Tracked specs survive on the kept branch, so moving them adds a commit and saves nothing. `ABANDON_EVIDENCE_DIRS` therefore stays `["qa_reports", "review_reports"]`, tracked specs are untouched, and only at-risk files get a primary copy.
  4. *`abandoned/`, not `archive/`.* `<dir>/archive/<lane>/` is the shipped and released bucket (E214, release 7a). An abandoned lane's spec copied there would read as shipped. `specs/abandoned/<ticket>/<relpath>` matches the `qa_reports/abandoned/<ticket>/` destination E180 already uses for the same command.
- **D-E217-2: destination** is `<primary>/specs/abandoned/<ticket>/<relpath>`. The considered alternative was copying back to the same path in primary, which follows E73 D2 to the letter, but it would mix an abandoned lane's files into primary's live `specs/` and collide with primary's own ignored specs. Rejected for that reason.
- **D-E217-3: one shared planner.** sr extracts the walk, at-risk test, conflict and dangling refusals and copy-apply that `planShippedEvidenceHarvest`/`applyShippedEvidenceHarvest` already contain into one helper parameterised by directory list, bucket (`archive` | `abandoned`), verb token (`--shipped` | `--abandoned`) and a path-display function. `--shipped` calls it with its current values and the identity display, so its output stays byte-identical (AC-E217-10). The `--abandoned` specs call uses `escapeSegmentForDisplay` (AC-E217-9). The `--abandoned` caller also renders the read-failure and copy-failure reason text through `escapeSegmentForDisplay`. A new constant, for example `ABANDON_HARVEST_DIRS = ["specs"]`, names the copy-only directory list (sr names it), and the comment over `ABANDON_EVIDENCE_DIRS` is updated to point at it. If sr finds that the extraction cannot keep `--shipped` byte-identical, sr stops and reports instead of diverging.
- **D-E217-4: order.** The specs plan is computed before the first `--abandoned` mutation, next to `planAbandonCurrentHarvest` and so before `applyPendingOnAbandoned`'s backlog and pending commits (AC-E217-4). The copies are applied after the evidence move/commit and before the `.current/<ticket>/` harvest and `removeWorktreeNoForce`, so they capture the lane's final state. A failed copy leaves the worktree and branch in place, and a re-run converges (AC-E217-5).
- **D-E217-5: never committed.** The copy is an fs copy, as with E180 and E214. A primary that ignores `specs/` keeps it ignored.

### E215

- **D-E215-1: warn, do not link.** `start` prints one loud stderr warning and creates nothing. Reasons:
  1. Generated hook directories differ by tool, and some embed absolute paths into the checkout that generated them. A link would then run primary's hooks against primary's tree and appear to work.
  2. A symlink at a path that is ignored only through a rule inside the directory (husky writes `.husky/_/.gitignore` = `*`), or through a trailing-slash rule, shows as untracked in the lane. That is the same lesson as E291 AC12 for `node_modules`. The result would be a dirty `git status`, a refused `finish --abandoned` precondition and a refused `git worktree remove`, unless `start` also writes a new shared exclude rule that affects primary too.
  3. The manifest asks for a loud warning at minimum. Warning keeps start's refusals, rollback and created-file set unchanged (AC-E215-3, AC-E215-4).

  The warning therefore tells the operator to recreate the directory inside the lane with the tool that generated it. It does not suggest a hand-made symlink, for reason 2.
- **D-E215-2: when to warn.** Read the lane's effective `core.hooksPath` (`git config --get core.hooksPath` run in the new worktree; exit 1 = unset). Warn only when the value is relative (not `path.isAbsolute`, no leading `~`), `<lane>/<value>` is not a directory, and `<primary>/<value>` is a directory. git resolves a relative hooks path against the working tree root (githooks(5)), so the two checks compare the same path in each checkout. When neither checkout has the directory, the lane behaves like primary and this is not a lane-lifecycle gap, so start stays quiet (AC-E215-2e). The check runs after `bootstrapLaneEnv`, uses `gitTry`, never throws, and appends to the existing `warn` lines. Its exact position among the stderr lines is sr's choice; the tests assert presence and count.
- **D-E215-3: no nested `node_modules` hint.** Reasons:
  1. E291 shipped a contract that a key-absent `start` is byte-identical to the pre-E291 output. `test/e291-start-link-locations.test.mjs` AC-E291-1 pins it across five variants, and its fixture has an untracked `web/node_modules` in primary. A hint that fires on that fixture breaks the contract.
  2. A hint keyed on git-ignored directories only (`git ls-files -o -i --directory`) would avoid that fixture, but it depends on each machine's global excludes file, which the tests do not isolate. A developer whose global ignore lists `node_modules` would see AC-E291-1 go red.
  3. A missing nested `node_modules` fails loudly (module not found, exit 254). The hooks gap is silent, and silence is the severity reason queue row #17 gives.
  4. `nodeModulesLinks` is documented in `docs/config.md` and named in the `feature start` usage line.

  If the human prefers the hint, it can be added as option B: key absent only; candidates are nested `node_modules` directories in primary, untracked or ignored (env-independent), whose parent directory exists as a real directory in the lane; one stderr line listing up to 5 directories plus "and N more", telling the operator to list them in `nodeModulesLinks` and keep `"."`; no `dist/tools/config.js` load. Option B re-pins AC-E291-1's `err` assertions in `test/e291-start-link-locations.test.mjs` and needs one more sr task and one more qa task. **Needs human ruling at cut approval: confirm D-E215-3 (no hint) or choose option B.**
- **D-E215-4: no config key.** Neither D-E215-1 nor D-E215-3 needs one, so `tools/config.ts`, `dist/tools/config.*` and `docs/config.md` are not touched and the config schema is unchanged.

## Copy / Strings

| string id | exact text (quote verbatim) | source |
|---|---|---|
| e217.specs-harvest-line | `agc feature finish — harvested git-ignored evidence {src} -> primary {dst} (fs copy, not committed — specs/ is git-ignored here and not linked outside the worktree, so \`git worktree remove\` would otherwise delete it silently)` — `{src}` = `specs/<relpath>`, `{dst}` = `specs/abandoned/<ticket>/<relpath>`, both rendered with `escapeSegmentForDisplay` | E180 spec `e180.evidence-harvest-line`, reused verbatim (`{dir}` = `specs`); only the display escaping is new (E250 precedent) |
| e180.evidence-harvest-refuse-line (reused, specs paths) | `agc feature finish --abandoned: harvest destination already exists in the primary checkout and differs (nothing moved):` followed by one `  {path}` line per conflict (absolute primary path, `escapeSegmentForDisplay` rendering) | E180 spec, already shipped; reused verbatim |
| e217.specs-symlink-refuse-line | `agc feature finish --abandoned: harvest of specs/ found unresolvable symlink(s) — refusing before any mutation (nothing moved):` followed by one `  {path}` line per dangling symlink (`escapeSegmentForDisplay` rendering) | E214 spec `e214.evidence-harvest-symlink-refuse-line` with the `--abandoned` verb token; reused verbatim otherwise |
| e217.specs-read-fail-line | `agc feature finish --abandoned: could not read {rel}/ in the lane worktree ({reason}) — nothing removed` — `{rel}` and `{reason}` escaped | the existing `walkEvidenceTree` read-failure line with the `--abandoned` verb token |
| e217.specs-copy-fail-line | `agc feature finish --abandoned: harvest of {src} into the primary checkout failed ({reason}) — worktree and branch left in place (re-running finish is safe)` — `{src}` and `{reason}` escaped | the existing `applyShippedEvidenceHarvest` failure line with the `--abandoned` verb token |
| e217.usage-abandoned | the four usage lines `          moves the lane's qa_reports/ + review_reports/ evidence into\n`, `          abandoned/<ticket-id>/, commits it, copies git-ignored specs/\n`, `          files into primary's specs/abandoned/<ticket-id>/, removes the\n`, `          worktree, and keeps the branch. Either way, the lane's committed\n` replace the current three lines `moves the lane's qa_reports/ + review_reports/ evidence into` / `abandoned/<ticket-id>/, commits it, removes the worktree, and` / `keeps the branch. Either way, the lane's committed` | authored-here: the usage must name the new behaviour; wording follows the surrounding usage lines |
| e215.hooks-missing | `agc feature start — warning: core.hooksPath "{v}" is a relative path that the primary checkout has but the lane worktree does not — git runs NO hooks in this lane until it exists; recreate it inside the lane with the tool that generated it (for husky: \`npx husky\`)` — `{v}` = the config value rendered with `escapeSegmentForDisplay` | authored-here: E215 fix shape ("warns"); prefix and tone follow the E291 `agc feature start — warning:` lines; no absolute path printed |

## Visual Tokens

| token id | property | value (quote verbatim) | source |
|---|---|---|---|
| N/A | — | — | feature has no visual literals |

## Visual Widgets

| widget id | description | source-node |
|---|---|---|
| N/A | — | feature has no non-primitive widgets |

## Existing tests

The manifest counts about 15 test files that mention `feature start`/`finish`. A grep over `test/` (files that reference `bin/agc-init.mjs` together with the `feature` subcommand, plus every file whose text mentions `feature start`/`finish`) gives this list.

**Files that run `feature start`/`finish`.** No assertion change is expected in any of them; each must pass unmodified (AC-LANE-1):

| file | why it stays unchanged |
|---|---|
| `test/agc-feature-lifecycle.test.mjs` | no fixture sets `core.hooksPath`; `--abandoned` fixtures write no ignored spec file |
| `test/agc-feature-finish-history.test.mjs` | `--shipped` history behaviour is unchanged (D-E217-3) |
| `test/e180-abandoned-harvest.test.mjs` | `ABANDON_EVIDENCE_DIRS` is unchanged; AC12's fixture ignores `/specs/` but writes no spec file in the lane, so no new output (AC-E217-11) |
| `test/e213-shipped-ignored-shape.test.mjs` | proves `--shipped` is byte-identical through the shared planner (AC-E217-10) |
| `test/e246-mailbox-teardown.test.mjs` | mailbox teardown is not touched |
| `test/e287-finish-findings.test.mjs` | the findings path is not touched; the new plan step is read-only and no fixture has an at-risk spec |
| `test/e291-start-link-locations.test.mjs` | its exact `err` arrays stay valid: no fixture sets `core.hooksPath` and there is no nested hint (D-E215-3); the start usage lines are unchanged (AC-E215-7, AC-E217-12) |
| `test/e298-finish-remote-delete.test.mjs` | remote branch deletion is not touched |
| `test/e335-symlinked-pending-harvest.test.mjs` | the `.current/<ticket>/` harvest is not touched |

**Files that only quote or mention the commands, or write the lane exclude rules by hand.** These do not run the changed code and need no change: `test/e106-init-artifacts-flag.test.mjs` (no exclude rule is added), `test/e108-eject.test.mjs`, `test/e250-eject-path-escape.test.mjs`, `test/agc-adapters.test.mjs` (asserts only that the usage lists `feature`), `test/e130-lane-default.test.mjs`, `test/e178a-integrator-role.test.mjs`, `test/e226-integrator-sop-portable.test.mjs`, `test/e289-render-addendum.test.mjs`, `test/e294-lane-enterworktree.test.mjs`, `test/e329-integrator-sop-followups.test.mjs`, `test/e351-lane-protocol-gaps.test.mjs`, `test/lane-paths.test.mjs`, `test/e125a-lane-local-ledgers.test.mjs`, `test/e126-merge-invariants.test.mjs`.

`test/e351-lane-protocol-gaps.test.mjs` pins `docs/lane-protocol.md` §3, which still lists E217 as a known gap. Updating that text is not this lane's job; see *Findings filed*.

If qa finds an existing assertion that this lane's behaviour does change, qa may re-pin only that assertion, in a file from the first table, and must name it in the qa report. Any other file stays untouched; qa reports instead of editing it.

## Out of Scope

- E218, E219, E220 and the other `finish` edge cases; E242; path-echo escaping on existing lines (E252/E253), including all `--shipped` output.
- Linking `core.hooksPath` from primary, or any opt-in config key for it (D-E215-1).
- A nested `node_modules` hint (D-E215-3, unless the human picks option B).
- Moving or committing specs under `--abandoned`. Changing `ABANDON_EVIDENCE_DIRS`.
- Documentation updates outside the owned set: `docs/install.md` (its `--abandoned` step 2 says "`specs/` is never touched") and `docs/lane-protocol.md` §3 (lists E217 as a known gap). Both are filed under *Findings filed*.
- Worktree-scoped `core.hooksPath` (`extensions.worktreeConfig`): the lane reads its own effective value, and per-worktree divergence is not detected.

## Dependencies / Prerequisites

- Base `1adb50b` (main after the wave 11 manifest merge). There is no S0 seed or join inside the lane. All sr tasks touch the one file `bin/agc-init.mjs`, so they run serially (Parallel-Lane Cut: `serial — shared layer`).
- Resource Audit: the inputs (`docs/backlog.md` rows E215/E217, queue rows #16/#17, the manifest) reference only in-repo specs, tickets and code. They contain no external URLs, Figma links or tracker links, so there are no `external_refs` entries.
- No `design/` file (mode = no-design); Visual Structural Assertions do not apply.
- Release bookkeeping (backlog done-marks for E217 and E215, the queue DONE marks, the E215 premise-correction note) belongs to the integrator (5c). It is not a lane task.
- Manifest tier is not eligible: `.current/.config.json` `cutApprovalAutoTier` is `{}`. The cut goes to the integrator for pre-review (coordinator, mailbox), and then the human approves it in the coordinator's session.

## Cut

| id | desc | depends_on | est. files | touches | design-link |
|---|---|---|---|---|---|
| T-E217-01 | sr: `bin/agc-init.mjs`: extract the `--shipped` ignored-evidence harvest (walk, at-risk test, dangling and differs refusals, copy-apply) into one helper parameterised by dirs, bucket, verb token and display function. `--shipped` calls it with its current values; output byte-identical; pure refactor, no behaviour change (D-E217-3; AC-E217-10) | none | 1 | `bin/agc-init.mjs` | — |
| T-E217-02 | sr: `bin/agc-init.mjs` `--abandoned`: plan a copy-only, recursive, no-token-filter harvest of `specs/` into primary `specs/abandoned/<ticket>/<relpath>` before the first mutation; apply it after the evidence move/commit and before the `.current` harvest and worktree removal; escaped path echoes; new copy-only dir constant; `ABANDON_EVIDENCE_DIRS` and tracked specs untouched; `e217.usage-abandoned`; comment updates (D-E217-1..5; AC-E217-1..9, 11, 12) | T-E217-01 | 1 | `bin/agc-init.mjs` | — |
| T-E215-01 | sr: `bin/agc-init.mjs` `feature start`: after `bootstrapLaneEnv`, read the lane's `core.hooksPath` with `gitTry`; when it is relative, missing as a dir in the lane and present as a dir in primary, append one escaped `e215.hooks-missing` warning; never throws; creates nothing; refusals and rollback unchanged; no nested `node_modules` hint (D-E215-1..4; AC-E215-1..8) | T-E217-02 | 1 | `bin/agc-init.mjs` | — |
| T-E217-03 | qa: `test/e217-abandoned-specs-harvest.test.mjs` (AC-E217-1..9, 12); run `test/e213-shipped-ignored-shape.test.mjs` and `test/e180-abandoned-harvest.test.mjs` unmodified (AC-E217-10, 11) | T-E217-02 | 1 | `test/e217-*.test.mjs` | — |
| T-E215-02 | qa: `test/e215-start-hooks-path.test.mjs` (AC-E215-1..6); `test/e291-start-link-locations.test.mjs` unmodified (AC-E215-7); AC-E215-8 grep; lane-wide full suite on the final HEAD with a clean tree, every listed existing test unmodified (AC-LANE-1..3) | T-E215-01, T-E217-03 | 1 | `test/e215-*.test.mjs` | — |

## Findings filed

- `E217-NEW-1` (in `.current/e217/pending-tickets.md`): `docs/install.md` (`--abandoned` step 2: "`specs/` is never touched") and `docs/lane-protocol.md` §3 (the "已知缺口" line listing E217) describe the pre-E217 behaviour once this lane merges. Both files are outside this lane's owned set. `docs/lane-protocol.md` is under the common-forbidden list, and its §3 text is pinned by `test/e351-lane-protocol-gaps.test.mjs`.
