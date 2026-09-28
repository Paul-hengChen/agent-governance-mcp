# 7.0 re-run: E73 adopter acceptance (adopter acceptance project, disposable clone)

- executed: 2026-09-27 ~06:40Z–06:43Z (UTC), session `accept70r`, coordinator-direct, read-only (no `tw_*` calls at all)
- agc: `node <repo-root>/bin/agc-init.mjs`, invoked through the thin wrapper `$A/agc`. Checkout HEAD `73e277e`, package `3.119.0`. It contains merge `96c4123` (E213+E214+E216), and no `bin/` change after it.
- clone: `A=<lanes-root>/_accept70r`, primary = `$A/ndi`, lanes under `$A/lanes/`
- raw outputs: `$A/logs/*` (stdout and stderr split per finish, plus `*.exit` files). The state fingerprints `$A/logs/*.state` come from `$A/pstate.sh`: primary HEAD, sha256 of `tasks.md`, a per-file sha256 listing of `qa_reports/ review_reports/ specs/ .current/`, the worktree list, `branch -v`, and the lane's ignored files.
- First run: `specs/e73-adopter-acceptance-2026-09-27.md`

## Verdict

| Run | expected | verdict |
|---|---|---|
| A `start` + `finish --shipped` (zz911) | exit 0; fs-only pointer + advisory, no commit; `.current/` harvested; all ignored evidence in `<dir>/archive/zz911/` incl. nested + dereferenced link; worktree removed, branch deleted; no rolled-back lines | **PASS** |
| A2 dangling symlink (zz912) | loud refusal, non-zero, nothing changed; after removing the link it completes | **PASS** |
| B `--abandoned` (zz913) | evidence in primary `*/abandoned/zz913/`, `.current` harvested, branch kept, exit 0, `moved` lines qualified (E216) | **PASS**. `specs/` was silently deleted with the worktree, which is known gap E217 (post-v4) and not judged |
| C conflict refusal (zz914) | loud refusal, nothing moved or deleted | **PASS** |
| real repo untouched | before == after | **PASS**: `diff` empty |

**Summary: 7.0 PASSES.** Both first-run blockers are fixed in this adopter shape. `--shipped` now completes when everything is gitignored, and it loses no ignored evidence. One new P3 wording finding (below).

## Real-repo snapshots (the adopter acceptance project's primary checkout)

`$A/snap-before.txt` vs `$A/snap-after.txt`: `diff` empty → **REAL_REPO_IDENTICAL**.
```
HEAD      11ba7a02a1034759171cf605df89853f94e3d4bd
status    (empty)
worktrees <adopter-project> 11ba7a02 [main]; .claude/worktrees/ci01 61993f59 [feat/ci01-azure-pipeline];
          .claude/worktrees/ndi-lic01 96e5df3d [feat/ndi-lic01-vendor-license]          (3 lines)
branches  docs/spike-zorder-citations, docs/srcl-flip01-records, +feat/ci01-azure-pipeline,
          +feat/ndi-lic01-vendor-license, feat/netid01-network-identity, *main          (6)
exclude   41b9d9936e208f59eac7cc4cf3e505e24cd8cf89395a57e7238449aa4fb3cafd
```
`agent-governance-mcp`: `git status --porcelain` is empty before and after, HEAD `73e277e`. Nothing was pushed or committed to any real repo. No `.env` was read (neither the real repo nor the clone has a root `.env`).

## Clone setup

| step | result |
|---|---|
| `git clone -q --no-hardlinks $R $A/ndi`; `git -C $A/ndi remote remove origin` | ok; `remote=[]` |
| `cp -R $R/.current $A/ndi/.current`; `cp $R/tasks.md $A/ndi/tasks.md` | flat legacy shape (`archive/ handoff.md tasks.md telemetry.jsonl …`) |
| required 1: `cp -R $R/.husky/_ $A/ndi/.husky/_`; `git config core.hooksPath .husky/_` | ok. Control: `git commit --allow-empty -m "bad subject no type"` on the clone primary → exit 1, `✖ found 2 problems` / `husky - commit-msg script failed` (`logs/control-badcommit.out`) |
| required 2: `ln -s $R/node_modules $A/ndi/node_modules`; `ln -s $R/app/web/node_modules $A/ndi/app/web/node_modules` | ok. Used read-only; no npm/pnpm install was run |
| `.gitignore` vs real | `diff` empty. `check-ignore -v`: `.current/`→`:20`, `tasks.md`→`:21`, `/qa_reports/`→`:25`, `/review_reports/`→`:26`, `/specs/`→`:27` |

## agc check

| when | cwd | exit | output |
|---|---|---|---|
| before Run A | `$A/ndi` | 1 | `agc check — stale adapter: CLAUDE.md (stamped 3.93.0, installed 3.119.0)` |
| after Run C | `$A/ndi` | 1 | same single line |
| after Run C (extra) | `$A/lanes/zz914` | 1 | 2× `warning: qa_reports/ (review_reports/) is a real, untracked directory in a linked git worktree …` + stale-adapter line |

Same as the first run. The stale stamp is the adopter's own state. The fact that it warns only from inside the lane is already recorded under E214 ("`feature start` bootstrap links deferred").

## Run A: `--shipped` (zz911)

**A1** `cd $A/ndi && $A/agc feature start zz911-accept-shipped --base main --path $A/lanes/zz911` → **exit 0**
```
created branch feat/zz911-accept-shipped (from main) and worktree …/lanes/zz911
added .env, /node_modules, /.current/**/base-sha to the shared info/exclude
linked node_modules -> …/_accept70r/ndi/node_modules
warning: node_modules is shared with the primary checkout (symlink) — never run `npm ci` …
lane: zz911
```
**A2** lane commit `docs(zz911): ZZ911 acceptance probe file` (`e2f36f81`, adds `docs/zz911/probe.md`) → exit 0. No hook ran in the lane (E215, post-v4); the subject is commitlint-valid anyway.

**A3** ignored fakes in the lane, with sha256 recorded in `logs/A3-fakes.sha`: `qa_reports/review_ZZ911-01.md`, `qa_reports/nested/deep_ZZ911.md`, `qa_reports/link.md -> review_ZZ911-01.md` (relative file symlink), `review_reports/review_ZZ911-01.md`, `specs/zz911-spec.md`, `.current/zz911/{handoff.md,tasks.md,telemetry.jsonl}` (+ agc's `base-sha`). `check-ignore -v` resolves every one to `.gitignore:25/26/27/20`.

**A4** `git merge --no-ff --no-edit feat/zz911-accept-shipped` on clone main → exit 0, `ce1d9787` (primary hooks ran). Pre-finish: `tasks.md` sha `391a6cb2…`, no `## Closed Lanes`.

**A5** `$A/agc feature finish zz911 --shipped` → **exit 0**, stderr empty, stdout:
```
agc feature finish — tasks.md is git-ignored here: wrote the lane-close pointer to it directly (fs write, not committed)
agc feature finish — harvested untracked .current/zz911/ into .current/history/2026-09/zz911/ (fs copy, not committed — …)
agc feature finish — lane zz911 closed with no primary commit (nothing here is git-tracked: tasks.md and .current/zz911/ are both git-ignored) — the fs-only writes above are this lane's only durable record
agc feature finish — harvested git-ignored evidence qa_reports/link.md -> primary qa_reports/archive/zz911/link.md (fs copy, not committed — …)
agc feature finish — harvested git-ignored evidence qa_reports/nested/deep_ZZ911.md -> primary qa_reports/archive/zz911/nested/deep_ZZ911.md (…)
agc feature finish — harvested git-ignored evidence qa_reports/review_ZZ911-01.md -> primary qa_reports/archive/zz911/review_ZZ911-01.md (…)
agc feature finish — harvested git-ignored evidence review_reports/review_ZZ911-01.md -> primary review_reports/archive/zz911/review_ZZ911-01.md (…)
agc feature finish — harvested git-ignored evidence specs/zz911-spec.md -> primary specs/archive/zz911/zz911-spec.md (…)
agc feature finish — removed worktree <lanes-root>/_accept70r/lanes/zz911
agc feature finish — deleted branch feat/zz911-accept-shipped
```
The `e213.tasks-fsonly-line`, `e213.tasks-nocommit-line` and `e180.evidence-harvest-line` strings match the spec's Copy / Strings verbatim.

**Checked independently of the output above:**
- main HEAD before = after = `ce1d9787`. **No close commit.** `git ls-files tasks.md` → 0, so `tasks.md` is still untracked and ignored.
- `diff $R/tasks.md $A/ndi/tasks.md`: the only change is an appended `## Closed Lanes` + `<!-- lane_closed: ticket=zz911 branch=feat/zz911-accept-shipped base_sha=11ba7a02… pr=none history=.current/history/2026-09/zz911/ closed_at=2026-09-27T06:41:28.608Z (… git log -i --grep zz911 …) -->`.
- `.current/history/2026-09/zz911/{base-sha,handoff.md,tasks.md,telemetry.jsonl}`: all 4 files are present, and their sha256 equal the lane originals.
- evidence (sha256 equal to the lane originals in `logs/A3-fakes.sha`):
  - `qa_reports/archive/zz911/review_ZZ911-01.md` `6f10bd86…` ✓
  - `qa_reports/archive/zz911/link.md`: **regular file** (`-rw-r--r--`, not `l`), sha `6f10bd86…`, which equals its target ✓
  - `qa_reports/archive/zz911/nested/deep_ZZ911.md` `dbec6e4e…` ✓
  - `review_reports/archive/zz911/review_ZZ911-01.md` `c346780d…` ✓
  - `specs/archive/zz911/zz911-spec.md` `973b079a…` ✓
- `git worktree list` → primary only; `git branch --list` → `* main`; `$A/lanes/` empty ✓
- No stdout line describes something that did not happen: every line is backed by the checks above, and stderr is empty ✓

**PASS.**

## Run A2: dangling symlink refused before any mutation (zz912)

`feature start zz912-accept-broken` → exit 0. Lane commit `docs(zz912): ZZ912 acceptance probe file` (`62cbadaa`). Ignored files: `qa_reports/review_ZZ912-01.md` + `qa_reports/broken.md -> /nonexistent/x`, `.current/zz912/handoff.md`. Merge → `219aa958`.

**A2-2** `$A/agc feature finish zz912 --shipped` → **exit 1**, stdout empty, stderr:
```
agc feature finish --shipped: harvest of qa_reports/ found unresolvable symlink(s) — refusing before any mutation (nothing moved):
  qa_reports/broken.md
```
The text matches `e214.evidence-harvest-symlink-refuse-line` verbatim. `pstate.sh` before vs after → `diff` empty (**STATE_IDENTICAL**). That covers HEAD, `tasks.md` sha, every file under primary `qa_reports/ review_reports/ specs/ .current/` (incl. `history/`), worktree list (lane still present), branch list with shas, and the lane's own ignored files incl. the dangling link.

**A2-3** `rm` the broken link, re-run → **exit 0**: fsonly line, `.current` harvest, nocommit line, `harvested … qa_reports/review_ZZ912-01.md -> primary qa_reports/archive/zz912/review_ZZ912-01.md`, worktree removed, branch deleted. State diff: `tasks.md` gains `ticket=zz912` (2 pointers total), `qa_reports/archive/zz912/review_ZZ912-01.md` (`e877ccb2…`, equal to the lane original), `.current/history/2026-09/zz912/{base-sha,handoff.md}`, worktree and branch gone. HEAD unchanged. **PASS.**

## Run B: `--abandoned` regression (zz913)

`feature start zz913-accept-abandoned` → exit 0. Ignored fakes: `qa_reports/review_ZZ913-01.md`, `review_reports/review_ZZ913-01.md`, `specs/zz913-spec.md`, `.current/zz913/{handoff.md,notes.md}`. There was no lane commit.

`$A/agc feature finish zz913 --abandoned` → **exit 0**, stderr empty:
```
harvested git-ignored evidence qa_reports/review_ZZ913-01.md -> primary qa_reports/abandoned/zz913/review_ZZ913-01.md (fs copy, …)
harvested git-ignored evidence review_reports/review_ZZ913-01.md -> primary review_reports/abandoned/zz913/review_ZZ913-01.md (fs copy, …)
moved qa_reports/review_ZZ913-01.md -> qa_reports/abandoned/zz913/review_ZZ913-01.md (inside the lane worktree only — removed with it; the primary copy harvested above is the durable one)
moved review_reports/review_ZZ913-01.md -> review_reports/abandoned/zz913/review_ZZ913-01.md (inside the lane worktree only — removed with it; the primary copy harvested above is the durable one)
harvested untracked .current/zz913/ into .current/history/2026-09/zz913/ (fs copy, …)
removed worktree <lanes-root>/_accept70r/lanes/zz913
kept branch feat/zz913-accept-abandoned (abandoned lanes keep their branch)
```
- The `moved` lines carry the qualifier, and match `e216.moved-qualified-line` verbatim ✓ (E216)
- state diff: primary `qa_reports/abandoned/zz913/review_ZZ913-01.md` `cfaa109f…` and `review_reports/abandoned/zz913/review_ZZ913-01.md` `d18e22f2…`, both equal to the lane originals. `.current/history/2026-09/zz913/{base-sha,handoff.md,notes.md}` sha-equal. `tasks.md` unchanged. Worktree removed, and branch `feat/zz913-accept-abandoned` kept ✓
- **`specs/zz913-spec.md` observation (E217, not judged):** there is no harvest line, and `find $A -name '*zz913*'` finds no copy. It was deleted silently with the worktree. This is exactly the open E217 shape (`ABANDON_EVIDENCE_DIRS` = qa/review only).

**PASS.**

## Run C: conflict refusal regression (zz914)

`feature start zz914-accept-conflict` → exit 0. Pre-planted primary `qa_reports/abandoned/zz914/review_ZZ914-01.md` = `PRE-EXISTING DIFFERENT CONTENT`. Lane fakes: qa, review, `.current/zz914/handoff.md`.

`$A/agc feature finish zz914 --abandoned` → **exit 1**, stdout empty, stderr:
```
agc feature finish --abandoned: harvest destination already exists in the primary checkout and differs (nothing moved):
  <lanes-root>/_accept70r/ndi/qa_reports/abandoned/zz914/review_ZZ914-01.md
```
`pstate.sh` before vs after → **STATE_IDENTICAL**. No `.current/history/2026-09/zz914/` (only zz911, zz912, zz913). **PASS.** Lane zz914 is left open on purpose.

## Clone final state (kept, do not delete until integrator says so)

main `219aa958`; worktrees: primary + `$A/lanes/zz914`; branches: `main`, `feat/zz913-accept-abandoned`, `feat/zz914-accept-conflict`. Main history since `11ba7a02`: `e2f36f81`, `ce1d9787` (merge zz911), `62cbadaa`, `219aa958` (merge zz912). No agc commits.
**Symlinks into the real repo (remove before deleting the clone):** `$A/ndi/node_modules -> $R/node_modules` and `$A/ndi/app/web/node_modules -> $R/app/web/node_modules`. The lane `zz914/node_modules` points to `$A/ndi/node_modules`, which is itself a link into the real repo. Use `rm` on the link only, never `rm -r` through it.

## Findings (pending-ticket blocks, no E ids; integrator assigns)

```pending-ticket
lane_local_id: E73ACC2-NEW-1
title: finish --shipped "closed with no primary commit … the fs-only writes above are this lane's only durable record" prints before the evidence-harvest lines, so it wrongly excludes the archive/ copies that follow
priority: P3
depends_on: [E213, E214]
source: 7.0 re-run, Run A (logs/A5-finish.stdout) and A2-3 (logs/A2-3-finish.stdout)
body: |
  In the all-ignored shape, the e213.tasks-nocommit-line is emitted third, right after the
  tasks.md fs-only and .current harvest lines. The e180.evidence-harvest-line lines for
  qa_reports/, review_reports/ and specs/ (-> <dir>/archive/<lane>/) are printed after it.
  "the fs-only writes above are this lane's only durable record" is therefore false as
  worded. The archive/ copies below it are also durable, and are the evidence the fix exists
  to keep. Behavior is correct (all files verified by sha256). Only the order/wording
  misleads a reader deciding what to keep. Fix: emit the nocommit line after the evidence
  harvest lines (just before "removed worktree"), or reword it to "above and below" / list the
  evidence archive as part of the durable record.
```

Not new, observed again: **E217** (Run B `specs/zz913-spec.md` silently deleted by `--abandoned`), **E215** (the lane runs no hooks), and the E214-deferred note that `agc check` warns about unlinked evidence only from inside a lane.
