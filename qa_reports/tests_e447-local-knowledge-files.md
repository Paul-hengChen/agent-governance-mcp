# Tests — e447-local-knowledge-files (T-E447-01)

Author: qa-engineer, 2026-11-26. Spec: `specs/e447-local-knowledge-files.md` (cut approved 2026-11-26, O1 (a), O2 (a), O3 (a); D1–D10). No ticket file: the spec's Acceptance Criteria are the scenarios.

## Placement

Dispatch brief `Test-file placement`: new `test/e447-*.test.mjs` files, creation pre-authorized, naming left to qa. Branch acted on: new files (no existing file covers the mode). Split by area, each file with its own helpers (precedent: e180 / e213 / e287):

| file | covers |
|---|---|
| `test/e447-init-knowledge.test.mjs` | AC1, AC2 (a)–(f), usage / subcommand Copy strings |
| `test/e447-lane-seed-finish.test.mjs` | AC3–AC8 |
| `test/e447-cut-reseed.test.mjs` | AC9 |
| `test/e447-mode-off.test.mjs` | AC10 |
| `test/e447-served-text.test.mjs` | AC11, AC12 |

No existing test edited (goldens, `test/context-budget.test.mjs`, `test/lane-paths.test.mjs`, `test/e410-task-alias-content-tail.test.mjs` re-pins are T-E447-05). All CLI fixtures are scratch git repos under `os.tmpdir()`; `agc` and `fanout.mjs` run as CLIs (`spawnSync(process.execPath, [...])`). Except AC1 / AC2 / AC10-init, "mode on" is built by hand (config keys + the exclude rules init writes), so AC3–AC9 do not depend on the init task.

## Scenario → Test Map

| scenario | test file | exact test name |
|---|---|---|
| AC1 | `test/e447-init-knowledge.test.mjs` | `AC1: init --knowledge=local -> clean status and all rules; lane start/commit/merge/finish keeps status clean and history free of agc files` |
| AC2 (a) | `test/e447-init-knowledge.test.mjs` | `AC2 (a): a ticketDir of work/tickets yields /work/tickets/ instead of /docs/tickets/` |
| AC2 (b) | `test/e447-init-knowledge.test.mjs` | `AC2 (b): a tracked AGENTS.md / .antigravityrules gets no exclude rule and is byte-unchanged` |
| AC2 (c) | `test/e447-init-knowledge.test.mjs` | `AC2 (c): a tracked docs/backlog.md is reported with the git rm -r --cached line and stays tracked` |
| AC2 (d) | `test/e447-init-knowledge.test.mjs` | `AC2 (d): --knowledge=local --artifacts=repo exits 2 with the needs-local message and writes nothing (D1)` |
| AC2 (e) | `test/e447-init-knowledge.test.mjs` | `AC2 (e): --knowledge=foo exits 2 with the bad-value message and writes nothing` |
| AC2 (f) | `test/e447-init-knowledge.test.mjs` | `AC2 (f): a subdirectory workspace sub/ gets /sub/specs/ etc.` |
| Copy e447.usage-init, e447.usage-feature | `test/e447-init-knowledge.test.mjs` | `Copy e447.usage-init / e447.usage-feature: usage names --knowledge, the start snapshot and feature reseed` |
| Copy e447.feature-unknown | `test/e447-init-knowledge.test.mjs` | `Copy e447.feature-unknown: the subcommand list names reseed` |
| AC3 | `test/e447-lane-seed-finish.test.mjs` | `AC3: start seeds all five knowledge files byte-identical, records exactly their hashes, lane clean, e447.start-seeded with 5` |
| AC4 | `test/e447-lane-seed-finish.test.mjs` | `AC4: a tracked knowledge path is neither overwritten nor recorded; a dangling design/ symlink is skipped with e447.start-dangling` |
| AC5 | `test/e447-lane-seed-finish.test.mjs` | `AC5: finish --shipped copies the lane's new design/x.md and research/y.md to the same paths, keeps the primary's newer backlog, copies no unchanged seed` |
| AC6 overwrite | `test/e447-lane-seed-finish.test.mjs` | `AC6 overwrite: a lane-appended docs/tickets/t1.md replaces the primary copy that still has the seeded bytes` |
| AC6 both changed | `test/e447-lane-seed-finish.test.mjs` | `AC6 both changed: the primary copy was edited too -> non-zero exit, e180 refuse line naming it, nothing removed or changed` |
| AC7 | `test/e447-lane-seed-finish.test.mjs` | `AC7: finish --shipped numbers the worktree pending block into the untracked backlog (no commit, history under ## Applied, no E287 warning); a re-run allocates nothing new` |
| AC8 | `test/e447-lane-seed-finish.test.mjs` | `AC8: finish --abandoned harvests design/z.md to design/abandoned/e9/z.md, nothing under specs/abandoned/e9/, and numbers the pending finding` |
| AC9 match | `test/e447-cut-reseed.test.mjs` | `AC9 match: in the lane, the seeded manifest equal to the primary's -> no MANIFEST_CHANGED, exit as today` |
| AC9 changed | `test/e447-cut-reseed.test.mjs` | `AC9 changed: the primary's manifest changed after start -> MANIFEST_CHANGED report line, exit 1` |
| AC9 reseed | `test/e447-cut-reseed.test.mjs` | `AC9 reseed: agc feature reseed copies the primary's manifest, records the new hash, and check --cut passes again` |
| AC9 reseed refuses | `test/e447-cut-reseed.test.mjs` | `AC9 reseed refuses: a file the lane changed -> exit 1, e447.reseed-refuse-changed, lane copy and record unchanged` |
| AC9 (boundary inputs, Copy e447.reseed-not-knowledge / -not-lane) | `test/e447-cut-reseed.test.mjs` | `AC9 reseed boundaries: non-knowledge and escaping paths exit 2; outside a mode-on lane exits 1; nothing written` |
| AC10 (init) | `test/e447-mode-off.test.mjs` | `AC10: mode off -> init writes no knowledge rule; --knowledge=repo records "repo" and no rule; a flag-less re-run keeps it` |
| AC10 (start / finish) | `test/e447-mode-off.test.mjs` | `AC10: mode off (key absent, and "repo") -> start copies no knowledge file, writes no seed record; finish prints no new line and keeps today's specs/archive rule` |
| AC10 (check --cut) | `test/e447-mode-off.test.mjs` | `AC10: mode off -> check --cut in a lane never reports MANIFEST_CHANGED; outside a worktree it runs no git command` |
| AC11 | `test/e447-served-text.test.mjs` | `AC11: C-C08K served once directly after the Batch-lane line on both design arms, not in lite; C-CO3K ends coord-03's bookkeeping line; C-IN-R4 ends Stage 1 step 3; all portable` |
| AC12 | `test/e447-served-text.test.mjs` | `AC12: docs/config.md has exactly one knowledge section after ticketDir; docs/install.md carries DOC-INST-1..5; docs/lane-protocol.md carries DOC-LP-1..3 at their anchors` |

### AC10 — how "unchanged" is covered

- **finish byte-for-byte as before**: leans on the existing finish suites, which pin their exact stdout/stderr and must stay green unedited in the full run: `test/e180-abandoned-harvest.test.mjs`, `test/e213-shipped-ignored-shape.test.mjs`, `test/e217-abandoned-specs-harvest.test.mjs`, `test/e287-finish-findings.test.mjs`, `test/e335-symlinked-pending-harvest.test.mjs`, `test/agc-feature-finish-history.test.mjs`, `test/agc-feature-lifecycle.test.mjs`. The targeted check adds: with the knowledge paths ignored and the key absent or `"repo"`, no new e447 output fragment appears, `specs/archive/<lane>/` still receives an ignored lane spec, `design/` is still not harvested, and a worktree-only finding still gets the E287 warning and no backlog row.
- **start**: no seeded file, no `knowledge-seed.json`, no new output line (key absent and `"repo"`).
- **init**: no knowledge rule and no key without the flag; `--knowledge=repo` records `"repo"`, writes no rule, and a flag-less re-run keeps it (red until T-E447-02).
- **check --cut**: in a mode-off lane, a manifest whose primary copy differs gives no `MANIFEST_CHANGED` and exit 0; outside any git repo a logging `git` shim first on `PATH` records zero git calls. "Reads no extra file" is not machine-checked (see Open Interface Details).
- **full suite**: the AC's `node scripts/test-lock.mjs -- npm test` proof runs on the final commit (judge).

### Judge-run items (not automated here)

- AC12 "every pre-existing line byte-unchanged": run `git diff <lane base>..HEAD -- docs/config.md docs/install.md docs/lane-protocol.md` and confirm only `+` lines (and, for the appended items C-CO3K / C-IN-R4 / DOC-INST-5, the one changed line whose old text is its new prefix). Not automated because resident tests must not diff against a fixed lane base sha; the test asserts placement by anchor line, and the anchor lines stay pinned by `test/e351-*`, `test/e383-*`, `test/e425-*`, `test/e433-*`.
- AC10 full-suite proof on the final commit.

## Open Interface Details

- **Lane id / branch in fixtures**: `agc feature start e9-x` → lane `e9`, branch `feat/e9-x`; seed record at `<lane>/.current/e9/knowledge-seed.json` (D4 path from `.current/<lane>/`).
- **check --cut call form for AC9**: run with `cwd` = the lane worktree root and repo-relative operands (`specs/fanout-x.md e9 specs/e9-spec.md`), matching the lane-protocol call form. The comparison is expected to key on the manifest's repo-relative path in the lane against the same path in the primary checkout (D9); both "cwd in the lane" and "manifest path in the lane" hold, so either detection works.
- **"exit code is what it is today"** (AC9 match / reseed): computed in-test by running the same manifest + spec bytes through `check --cut` in a non-git temp dir.
- **MANIFEST_CHANGED line**: asserted as a whole line `FAIL  MANIFEST_CHANGED: manifest changed since lane start — re-seed` in stdout+stderr (the existing FAIL lines are in the stdout report), exit exactly 1. A deleted primary copy also yields it (D9 "missing primary copy counts as changed").
- **reseed boundary inputs**: `README.md`, `../outside.md` and `specs/../README.md` all exit 2 with the e447.reseed-not-knowledge tail (`is not under a knowledge path of this workspace — nothing changed`); the `<rel>` echoed is not pinned (normalisation is the builder's call). Reseed run in the primary checkout, and in a lane of a workspace without `"knowledge": "local"`, exits 1 with e447.reseed-not-lane. The order "not a mode-on lane" before "not a knowledge path" is not pinned.
- **AC2 (e) boundary**: `--knowledge=` (empty) is refused like `foo`: exit 2, `(got "")`, nothing written.
- **AC2 (c) display**: the tracked-path block is asserted by its fixed lines (header, `Untrack them with:`, `  git rm -r --cached docs/backlog.md`, the history note); the display line for the path itself is not pinned.
- **AC4 resolving symlink**: D5 "a symlink is copied as its target's bytes" is checked with `design/link.md -> d1.md`: the lane gets a regular file with d1's bytes and the record hashes those bytes.
- **e447.finish-unchanged on --abandoned**: AC8 expects the unchanged-count line (`5 seeded knowledge file(s) unchanged`) on `--abandoned` too — the string table does not scope it to `--shipped`, and D6 says the same record filter applies.
- **AC6 both changed, "removes nothing"**: asserted as an unchanged snapshot of every primary file outside `.git/` (so no history copy, no tasks.md pointer, no harvested file), an unchanged lane tree, worktree and branch present, HEAD unchanged. The refusal line's path is matched as any `  `-indented stderr line ending in `docs/tickets/t1.md` (today's e180 line prints an absolute path).
- **AC7 re-run**: forced late failure by an untracked, non-ignored `blocker.txt` in the lane (the e287 R1 precedent), then re-run after removing it; the backlog must hold exactly one row with the `(filed by lane `e9` as `L1`)` provenance.
- **AC7 numbered line order**: `e447.finish-numbered` is immediately followed by the existing `agc feature finish — applied 1 pending ticket(s): E11` line.
- **Usage placement**: the `--knowledge` sentences are asserted after the `--adapter=local puts` sentence (not "immediately after"); the start addition between the `feature start` and `feature finish` headers; the reseed block after `feature finish`.
- **AC11 portability**: checked on the verbatim literals (they are asserted equal to the served / source lines): no `test|dist|tools|gates|prompts|bin|content|schema|qa_reports|review_reports/` path, no `E<n>` ticket id, no backticked `UPPER_SNAKE` code; coord-03's addition has no `Task`. The coord-03 Task-alias sentences (another lane's) are not asserted; the bookkeeping line is located by its bold head and checked only for the appended tail and the sentence it follows.
- **AC12 wording-free items** (DOC-CFG body, DOC-INST-1..4): asserted by heading text and placement plus the fixed facts named in the spec (keys, values, readers, `knowledge-seed.json`, `git rm -r --cached`, `--artifacts=local`, `CLAUDE.local.md`, the `--abandoned` destination, `docs/backlog.md`); verbatim only where the spec gives a verbatim block (DOC-CFG closing bullet, DOC-INST-5, DOC-LP-1..3).
- **AC10 "reads no extra file"** for check --cut: not machine-checked (no portable file-access tracer in `node --test`); the no-git half is checked with the PATH shim outside a worktree only, since deciding the mode inside a linked worktree needs git by D9's own wording.

## Red Reasons

| test | why it is red now |
|---|---|
| AC1 | `agc init` ignores `--knowledge`: `AGENTS.md`, `.antigravityrules`, `CLAUDE.md` show in `git status` and no knowledge rule is written |
| AC2 (a), (b), (f) | no knowledge exclude rules are written (`/work/tickets/`, `/specs/`, `/sub/specs/` missing) |
| AC2 (c) | no knowledge tracked-path report on stderr |
| AC2 (d), (e) | `--knowledge` is not parsed: exit 0 instead of 2, files written |
| Copy e447.usage-init / e447.usage-feature | usage has no `[--knowledge=local\|repo]`, no start snapshot sentences, no `feature reseed` block |
| Copy e447.feature-unknown | subcommand list is `(start \| finish)` |
| AC3 | `feature start` seeds nothing: lane has no `docs/tickets/t1.md` |
| AC4 | no `knowledge-seed.json` written |
| AC5 | finish does not copy `design/x.md` back to the primary checkout |
| AC6 overwrite, AC6 both changed | precondition fails: `feature start` did not seed `docs/tickets/t1.md` |
| AC7 | worktree-only finding not numbered: backlog keeps 1 row (E287 path) |
| AC8 | no `design/abandoned/e9/z.md` |
| AC9 match, changed, reseed, reseed refuses, reseed boundaries | precondition fails: `feature start` did not seed `specs/fanout-x.md` (then: no `feature reseed`, no `MANIFEST_CHANGED`) |
| AC10 (init) | `--knowledge=repo` does not record `"knowledge": "repo"` |
| AC11 | C-C08K not served (count 0); C-CO3K / C-IN-R4 absent |
| AC12 | no `knowledge` section in `docs/config.md`; DOC-INST / DOC-LP absent |

Green now, kept on purpose (mode-off regression guards; the behaviour exists): `AC10 (start / finish)`, `AC10 (check --cut)`.

## Counts

26 new tests: 24 red (all in the manifest), 2 green (AC10 guards).

Full suite (`node scripts/test-lock.mjs -- npm test`, 2026-11-26, this worktree): 4817 tests, 4791 pass / 24 fail / 2 skipped. Base 07a6d47 was 4789 pass / 0 fail / 2 skipped (4791 tests): +26 tests, +2 pass (the AC10 guards), the 24 failures are exactly the manifest entries; no pre-existing test changed state. `npm run build`: clean, no `dist/` change.

## CI Runnability

Headless, no human interaction; every fixture is created and removed under `os.tmpdir()`. Requires `git` on `PATH` and POSIX symlinks (AC4) — both already required by the existing finish suites. The AC10 git shim is a `/bin/sh` script (POSIX hosts, as CI's Linux runners).

## T-E447-05 — planned return: golden recapture, budget caps, re-pins (qa-engineer, 2026-11-26)

Placement branch: dispatch brief `Test-file placement` line — re-pin only the five named existing files; no new test file written.

### Compose goldens (re-captured with `npm run build && node scripts/capture-constitution-golden.mjs`, no hand edit)

The tool rewrote all 12 fixtures; exactly 7 changed bytes, each with one hunk. The 4 `build-lite-*` and `hook-lite.txt` are byte-unchanged (const-08 is chain-only). Content diff against lane base `07a6d47` touches only `content/const-08-chain-31-mid.md` (+1 line), `content/coord-03-core-fallback.md` (1 line appended to) and `content/skill-integrator.md` (1 line appended to); each was checked to be a pure insert / append (`git diff --word-diff`).

| golden | hunk | explained by |
|---|---|---|
| `build-full-nondesign.txt` | +1 line, 0 removed | C-C08K: the added line equals `content/const-08-chain-31-mid.md` line 6 byte for byte (536 chars, 544 bytes), directly after the Batch-lane sub-bullet (line 5); the next line is the Lease-Override bullet (origin tags stripped by the build) |
| `build-full-design.txt` | +1 / 0 | C-C08K, same line, same placement |
| `build-full-nondesign-fd.txt` | +1 / 0 | C-C08K, same line, same placement |
| `build-full-design-fd.txt` | +1 / 0 | C-C08K, same line, same placement |
| `hook-full.txt` | +1 / 0 | C-C08K, same line; next line is const-08 line 7 verbatim (origin tags kept in the hook) |
| `constitution-monolith.txt` | +1 / 0 | C-C08K, same line; neighbours const-08 lines 5 and 7 verbatim |
| `skill-coordinator-monolith.txt` | 1 line changed (+1 / -1) | C-CO3K: the new line starts with the old "Bookkeeping never lands on local `main`" line byte for byte and adds only the 289-char sentence `When .current/.config.json sets "knowledge": "local" ... only after agc feature reseed.`; the new line occurs verbatim in `content/coord-03-core-fallback.md` |

C-IN-R4 (`content/skill-integrator.md`) reaches no golden: the integrator SOP is not part of any captured bundle. Nothing else moved.

### `test/context-budget.test.mjs` caps (measured with the test's own `approxTokens` = ceil(chars / 4))

| test | old cap | new cap | delta | cause |
|---|---|---|---|---|
| AC8/AC-P2-7 rationale-stripped (design-arm) constitution | 9407 | 9541 | +134 | C-C08K: 535 chars + newline = 536 chars = 134 ~tok; const-08 is a chain fragment, carries no origin or rationale fence, so both strips leave it whole |
| AC8/AC-P2-7 teamwork coordinator bundle (design-arm, both strips) | 19699 | 19905 | +206 | C-C08K +134 (constitution half) plus C-CO3K, 289 chars appended to the coord-03 bookkeeping line = 72.25 ~tok; 134 + 72.25 = 206.25 → the whole bundle's ceil moves by 206 |
| AC8/AC-P2-7 non-design constitution | 7495 | 7629 | +134 | C-C08K lands on both arms (chain fragment, not design-only); design-only saving stays 9541 − 7629 = 1912, so that `≥ 1912` assertion is unchanged |

Each cap gets an `E447 re-baseline` history comment in the file's existing convention; the two inline `design-arm path` / `non-design path` comments in the non-design test now read 9541 / 7629. No other cap moved (AC2 lean, skill-pm, spec-workshop, sr caps all pass unchanged).

### Re-pins outside the golden set

- `test/lane-paths.test.mjs` REG1: count 8 → 9, optional 7 → 8, filename list + `knowledge-seed.json` (D4's `knowledgeSeed` entry, `required: false`); the test title names the new entry, so its name changed. Every other REG1 assertion (handoff sole required, `tasks` entry shape) unchanged.
- `test/e410-task-alias-content-tail.test.mjs` AC2: const-08 Lease-Override alias row line 6 → 7, const-08 line count 12 → 13 (C-C08K inserted above it); an `E447 re-pin` comment added beside the earlier re-pin notes. The skill-integrator rows and its 270-line count do not move (C-IN-R4 is appended to an existing line). AC3 (span lengths) untouched.
- `test/e428-tracker-mirror.test.mjs` AC6 / AC12: only `BASE[IN_FILE].sha` changed, `6e1a994b…a8bf60` → `bebdd0e8…f58d06` (integrator ruling: hash value only). The hash covers `content/skill-integrator.md` with C-IN1 taken out; the sole other difference from lane base is the C-IN-R4 append to Stage 1 step 3, so the new value is that file's base plus C-IN-R4. Value measured from the test's own `actual` output and equal to sr-engineer's measured value. No comment added (ruling: value only).

### Result

The 8 affected files (`node --test` on the five re-pinned files plus `compose-equivalence`, `skill-manifest`, `e90-golden-capture-completeness`, `e447-served-text`): 181 tests, 181 pass. All 15 reds from the T-E447-07 full suite are now green; the expected-red manifest is marked fully resolved.
