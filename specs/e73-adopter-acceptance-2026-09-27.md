# 7.0 — E73 adopter acceptance (adopter acceptance project, disposable clone)

- executed: 2026-09-26T21:53Z – 21:56Z (UTC), session `accept70`, coordinator-direct, read-only (no `tw_*` writes)
- agc: `node <repo-root>/bin/agc-init.mjs`, checkout HEAD `6c961a6`
  (= brief's `08eaa0c` + one docs-only commit touching `specs/fanout-wave7.md`; `bin/` identical; includes E180/E194/E197)
- clone: `A=<lanes-root>/_accept70`, primary = `$A/ndi`, lanes under `$A/lanes/`
- raw outputs: `$A/logs/*.out`

## Verdict

| Run | expected | verdict |
|---|---|---|
| A `start` + `finish --shipped` | lane closes, `.current/<lane>/` harvested, pointer written, worktree + branch removed, evidence not silently lost | **FAIL**: (1) `finish --shipped` hard-fails on the adopter's gitignored root `tasks.md` (rolls back cleanly, loud, exit 1, and cannot complete); (2) diagnostic A′ (with `tasks.md` force-tracked) completes with exit 0 but **silently deletes** the ignored `qa_reports/` + `review_reports/` evidence |
| B `start` + `finish --abandoned` | evidence copied to primary `*/abandoned/zz902/`, `.current/zz902/` harvested, worktree removed, branch kept, exit 0 | **PASS** (E207 reproduced: harvested inner symlink dangles; already filed) |
| C `--abandoned` with differing destination | loud refusal; nothing moved or deleted | **PASS** |
| real repo untouched | before == after | **PASS**: identical |

**Summary: 7.0 does NOT pass.** `--shipped`, the normal close path, cannot run in this adopter shape. Once that is unblocked, it loses evidence silently, the same class E180 fixed for `--abandoned`.

## Real-repo snapshots (the adopter acceptance project's primary checkout)

`$A/snap-before.txt` vs `$A/snap-after.txt`: `diff` empty → **REAL_REPO_IDENTICAL**.

```
HEAD      11ba7a02a1034759171cf605df89853f94e3d4bd
status    (empty)
worktrees <adopter-project> 11ba7a02 [main]
          .claude/worktrees/ci01       61993f59 [feat/ci01-azure-pipeline]
          .claude/worktrees/ndi-lic01  96e5df3d [feat/ndi-lic01-vendor-license]
branches  docs/spike-zorder-citations, docs/srcl-flip01-records, +feat/ci01-azure-pipeline,
          +feat/ndi-lic01-vendor-license, feat/netid01-network-identity, *main
exclude   41b9d9936e208f59eac7cc4cf3e505e24cd8cf89395a57e7238449aa4fb3cafd
```
`agent-governance-mcp`: `git status --porcelain` empty before and after, HEAD `6c961a6`. Nothing pushed or committed to any real repo. No `.env` read (neither the real repo nor the clone has a root `.env`).

## Clone setup

| step | result |
|---|---|
| `git clone --no-hardlinks $R $A/ndi`; `git -C $A/ndi remote remove origin` | ok; `git remote` → empty |
| `cp -R $R/.current $A/ndi/.current`; `cp $R/tasks.md $A/ndi/tasks.md` | flat legacy shape: `.current/{handoff.md,tasks.md,archive/,telemetry.jsonl,…}`, handoff `schema_version: 14` |
| `ln -s $R/node_modules $A/ndi/node_modules` | ok |
| `git config core.hooksPath .husky/_` | ok |
| `.gitignore` diff vs real | identical: `.current/` (l.20), `tasks.md` (21), `/qa_reports/` (25), `/review_reports/` (26), `/specs/` (27), `/node_modules/` (32) |
| **deviation 1**: `cp -R $R/.husky/_ $A/ndi/.husky/_` | `.husky/_` is husky-generated and gitignored, so a clone doesn't have it. Without it `core.hooksPath` points at nothing and no hook runs. I copied it so the primary's hooks really run, as the brief intends |
| **deviation 2**: `ln -s $R/app/web/node_modules $A/ndi/app/web/node_modules` (clone **primary** only; lane left bare as instructed) | without it, the primary's pre-commit (`cd app/web && pnpm exec lint-staged`) fails, so no commit on clone main is possible. The real primary has this dir. It shows as `?? app/web/node_modules` in the clone because the real repo's local `info/exclude` was not cloned. It blocked nothing |
| clone `.git/info/exclude` | git default template (the real repo's local exclude is per-checkout, not cloned), i.e. a fresh-adopter exclude |

Control, clone primary: `git commit --allow-empty -m "bad subject no type"` → exit 1, commitlint `✖ subject may not be empty / type may not be empty` (hooks live on primary).

## agc check

| when | cwd | exit | output |
|---|---|---|---|
| before Run A | `$A/ndi` | 1 | `agc check — stale adapter: CLAUDE.md (stamped 3.93.0, installed 3.119.0)` |
| after Run C | `$A/ndi` | 1 | same single line (no warning about open lane zz903's unlinked evidence) |
| after Run C (extra) | `$A/lanes/zz903` | 1 | 2× `warning: qa_reports/ (review_reports/) is a real, untracked directory in a linked git worktree — symlink it back …` + the stale-adapter line |

The stale stamp is the adopter's own state (it was never re-stamped after 3.93.0), not an agc defect.

## Run A — `--shipped` (zz901)

**A1** `cd $A/ndi && agc feature start zz901-accept-shipped --base main --path $A/lanes/zz901` → **exit 0**
```
created branch feat/zz901-accept-shipped (from main) and worktree …/lanes/zz901
added .env, /node_modules, /.current/**/base-sha to the shared info/exclude
linked node_modules -> <lanes-root>/_accept70/ndi/node_modules
warning: node_modules is shared with the primary checkout (symlink) — never run `npm ci` …
lane: zz901
```
**A2** observations:
- lane `node_modules` → `$A/ndi/node_modules` (itself a link to the real repo). This is a two-hop chain, read-only use, and it works.
- lane `app/web/node_modules`: **absent**. Impact measured in a lane: `cd app/web && pnpm exec prettier --version` → exit 254 `Command "prettier" not found`; `sh .husky/pre-commit` → exit 254 `Command "lint-staged" not found`. So in a lane the web tree cannot lint, format-check, build or test, and the pre-commit gate could not pass even if hooks ran (see A3).
- clone `info/exclude` appended: `.env`, `/node_modules`, `/.current/**/base-sha`. Run B's start added nothing more (idempotent).
- `.current/zz901/base-sha` = `11ba7a02a1034759171cf605df89853f94e3d4bd`; the lane `.current/` holds only that file.
- primary flat `.current/`: sha256 of every file before and after start is equal → **untouched**.
- lane `.husky/_`: **absent** (gitignored, generated), while `core.hooksPath=.husky/_` is shared.
- lane has **no** `qa_reports/`, `review_reports/` or `specs/` symlinks: `feature start` does not perform the coord-03 Worktree bootstrap obligation.

**A3** lane commit: `git commit -m "bad subject no type"` → **exit 0, commit accepted**. **No hook ran in the lane** (commitlint rejects the same subject on primary). Reset, then re-committed as `docs(zz901): ZZ901 acceptance probe file` (`da3aafa7`).

**A4** ignored fakes: `qa_reports/review_ZZ901-01.md`, `review_reports/review_ZZ901-01.md`, `.current/zz901/{handoff.md,tasks.md,telemetry.jsonl}`. `check-ignore -v` resolves to `.gitignore:25/26/20`.

**A5** `git merge --no-ff feat/zz901-accept-shipped` on clone main → exit 0 (`a74f6443`). Then `agc feature finish zz901 --shipped` → **exit 1**:
```
agc feature finish — harvested untracked .current/zz901/ into .current/history/2026-09/zz901/ (fs copy, not committed — …)
The following paths are ignored by one of your .gitignore files:
tasks.md
agc feature finish --shipped: git add tasks.md failed — lane close not applied, worktree and branch left in place (re-running finish is safe)
```
Post-state: worktree and branch present, `.current/history/` **absent** (rolled back despite the "harvested" line), root `tasks.md` byte-identical, main HEAD unchanged. Re-run gives the identical exit 1 and identical output, so "safe" holds, but the command can never succeed in this shape. Cause: `executeLaneClose` (`bin/agc-init.mjs` ~2160) does `git add tasks.md` when `tasks.md` is untracked, and commits it. Here it is gitignored.

**A6 (diagnostic A′, clone only)**: to observe evidence fate, force-tracked root `tasks.md` on clone main (`82394660`), re-ran `finish zz901 --shipped` → **exit 0**:
```
harvested untracked .current/zz901/ into .current/history/2026-09/zz901/ (…)
recorded lane zz901 under tasks.md ## Closed Lanes
removed worktree <lanes-root>/_accept70/lanes/zz901
deleted branch feat/zz901-accept-shipped
```
- history: `.current/history/2026-09/zz901/{base-sha,handoff.md,tasks.md,telemetry.jsonl}`, all four present, bytes correct.
- pointer: in root `tasks.md` `## Closed Lanes` (commit `16e3ac4c chore(lanes): record closed lane zz901 (shipped)`, only `tasks.md`):
  `<!-- lane_closed: ticket=zz901 branch=feat/zz901-accept-shipped base_sha=11ba7a02… pr=none history=.current/history/2026-09/zz901/ closed_at=2026-09-26T21:55:15.590Z (base_sha invalidated by a history rewrite; git log -i --grep zz901 is the universal fallback) -->` → **carries `-i`** (E197 ✓)
- worktree removed ✓, branch deleted ✓.
- **evidence: `find $A -name 'review_ZZ901*'` → nothing.** Both fake reports were deleted with the worktree. There was no warning, no refusal, and the exit code was 0.
- Shape restored afterwards: `git rm --cached tasks.md` (`49773655`); `tasks.md` shows `!!` again.

## Run B — `--abandoned` (zz902)

**B1** `agc feature start zz902-accept-abandoned --base main --path $A/lanes/zz902` → exit 0. Fakes: `qa_reports/review_ZZ902-01.md`, `review_reports/review_ZZ902-01.md`, `.current/zz902/{handoff.md,notes.md}` plus `notes-link -> $A/lanes/zz902/.current/zz902/notes.md` (absolute symlink).

**B2** `agc feature finish zz902 --abandoned` → **exit 0**:
```
harvested git-ignored evidence qa_reports/review_ZZ902-01.md -> primary qa_reports/abandoned/zz902/review_ZZ902-01.md (fs copy, …)
harvested git-ignored evidence review_reports/review_ZZ902-01.md -> primary review_reports/abandoned/zz902/review_ZZ902-01.md (fs copy, …)
moved qa_reports/review_ZZ902-01.md -> qa_reports/abandoned/zz902/review_ZZ902-01.md
moved review_reports/review_ZZ902-01.md -> review_reports/abandoned/zz902/review_ZZ902-01.md
harvested untracked .current/zz902/ into .current/history/2026-09/zz902/ (fs copy, …)
removed worktree <lanes-root>/_accept70/lanes/zz902
kept branch feat/zz902-accept-abandoned (abandoned lanes keep their branch)
```
**B3** verify: primary `qa_reports/abandoned/zz902/review_ZZ902-01.md` = "fake qa evidence zz902" ✓; `review_reports/abandoned/zz902/review_ZZ902-01.md` ✓; `.current/history/2026-09/zz902/{base-sha,handoff.md,notes.md,notes-link}` ✓. `notes-link` still points into the removed worktree and **dangles** (`cat` → No such file), which is **E207 reproduced** and already filed. Worktree removed ✓, branch kept (at main tip, nothing to commit because all fakes were ignored) ✓. **PASS.**

## Run C — conflict refusal (zz903)

Start → exit 0. Pre-planted primary `qa_reports/abandoned/zz903/review_ZZ903-01.md` = "PRE-EXISTING DIFFERENT CONTENT", then lane fakes (qa, review, `.current/zz903/handoff.md`). `agc feature finish zz903 --abandoned` → **exit 1**:
```
agc feature finish --abandoned: harvest destination already exists in the primary checkout and differs (nothing moved):
  <lanes-root>/_accept70/ndi/qa_reports/abandoned/zz903/review_ZZ903-01.md
```
Before/after checks: lane fakes sha256 equal, primary `qa_reports`/`review_reports`/`.current/history` sha256 equal, worktree list, branch list, and `HEAD` + branch ref all equal, and no `.current/history/2026-09/zz903/`. **PASS.** Lane zz903 is left open on purpose (clone kept for integrator verification).

## Clone final state (kept, do not delete until integrator says so)

main `49773655`; worktrees: primary + `$A/lanes/zz903`; branches: `main`, `feat/zz902-accept-abandoned`, `feat/zz903-accept-conflict`. Main history since `11ba7a02`: `da3aafa7` (lane), `a74f6443` (merge), `82394660` (A′ track), `16e3ac4c` (agc close zz901), `49773655` (A′ untrack).

## Findings (pending-ticket blocks, no E ids; integrator assigns)

```pending-ticket
lane_local_id: E73ACC-NEW-1
title: finish --shipped cannot complete when root tasks.md is gitignored (adopter shape) — git add tasks.md fails, every run exits 1
priority: P1
depends_on: [E73]
source: 7.0 adopter acceptance, Run A (adopter acceptance project clone; logs/A5-finish.out, A5-finish-rerun.out)
body: |
  The adopter acceptance project's .gitignore lists `tasks.md` (l.21) and `.current/`. executeLaneClose
  (bin/agc-init.mjs ~2160) writes the Closed Lanes pointer into root tasks.md, then, because
  tasks.md is untracked, runs `git add -- tasks.md`, which git refuses for an ignored path.
  Everything rolls back (history dir removed, tasks.md restored, worktree+branch kept), so no
  loss and the error is loud. But finish --shipped can NEVER succeed in this shape, and E130
  makes it the default close path. Fix shape: mirror the ignored-.current/ harvest. When
  TASKS_REL is git-ignored, write the pointer fs-only and skip add/commit (advisory line like the
  harvest's), or refuse up front in planLaneClose before any mutation. Decide where the
  pointer lives for ignored-ledger adopters. Sub-item: the "harvested untracked .current/<lane>/
  …" stdout line prints before the failing git add and is then rolled back, so the output
  claims a harvest that no longer exists. Emit it only after the close commits, or say
  "rolled back".
```

```pending-ticket
lane_local_id: E73ACC-NEW-2
title: finish --shipped silently deletes git-ignored, unlinked qa_reports/ + review_reports/ evidence (exit 0, no warning) — E180's fix covers --abandoned only
priority: P1
depends_on: [E180]
source: 7.0 adopter acceptance, Run A′ diagnostic (tasks.md force-tracked to get past E73ACC-NEW-1; logs/A6-finish-aprime.out)
body: |
  With the lane's qa_reports/review_ZZ901-01.md and review_reports/review_ZZ901-01.md
  git-ignored and not symlinked to primary, finish --shipped harvested .current/zz901/, recorded
  the pointer, removed the worktree and deleted the branch, exiting 0. Both evidence files were
  gone and nothing mentioned them. ABANDON_EVIDENCE_DIRS is only consulted on the --abandoned
  path; --shipped has no evidence check at all. This is the exact E111/decision-F loss that
  E180 closed for --abandoned. Contributing: `agc feature start` does not perform (or even warn
  about) the coord-03 Worktree bootstrap obligation. It creates no qa_reports/review_reports/specs
  links, so every lane in an all-ignored adopter starts in the losing shape. `agc check` warns
  only when run inside the lane (verified in lanes/zz903), not from primary and not from finish.
  Fix shape: in --shipped, harvest ignored unlinked evidence into primary (for example
  <dir>/archive/<lane>/, matching the release 7a convention) or refuse before any mutation. And/or
  have feature start create the bootstrap links (mkdir -p in primary first) when the dirs are
  git-ignored. Must land before E130.
```

```pending-ticket
lane_local_id: E73ACC-NEW-3
title: lanes run with no git hooks and no nested node_modules when core.hooksPath/app deps live in gitignored generated dirs (husky .husky/_, app/web/node_modules)
priority: P2
depends_on: [E73]
source: 7.0 adopter acceptance, Run A steps 2–3 (logs/A3-badcommit.out, A2-appweb-probe.out, A2-precommit-probe.out)
body: |
  The adopter acceptance project sets core.hooksPath=.husky/_ (shared config, relative path). .husky/_ is
  husky-generated and gitignored, so a fresh worktree has none and git silently runs NO hooks.
  In lane zz901 `git commit -m "bad subject no type"` succeeded, while the same subject on primary
  is rejected by commitlint. Lanes therefore bypass the repo's commitlint and pre-commit gates
  unnoticed. Separately, feature start links only the root node_modules. app/web/node_modules
  (where this repo's app deps live) is absent in the lane: `pnpm exec prettier` and
  `.husky/pre-commit` both exit 254 "Command not found", so the web tree can't
  lint/format/build/test there, and the pre-commit gate couldn't pass even if hooks ran.
  Fix shape: feature start detects a relative core.hooksPath that is missing in the new
  worktree and warns (or links it from primary). It also warns about (or optionally links)
  nested node_modules dirs present in primary, carrying the same never-npm-ci caveat.
```

```pending-ticket
lane_local_id: E73ACC-NEW-4
title: finish --abandoned prints "moved <ignored file> -> abandoned/<id>/" for a lane-local move that is deleted with the worktree seconds later
priority: P3
depends_on: [E180]
source: 7.0 adopter acceptance, Run B (logs/B2-finish.out)
body: |
  For git-ignored evidence the harvest lines correctly report the copy into primary. But the
  following "moved qa_reports/review_ZZ902-01.md -> qa_reports/abandoned/zz902/…" lines describe
  a move inside the lane worktree, which is not committed (the file is ignored) and is removed
  with the worktree. Next to the harvest line, that reads as a second durable copy. Suppress
  the "moved" line for harvested ignored files, or qualify it ("in the lane; primary copy above
  is the durable one").
```

Not new: **E207** reproduced exactly in Run B (the history `notes-link` dangles after worktree removal).
