# e447-local-knowledge-files

Ticket: `docs/backlog.md` row E447 (human rulings R1–R4, 2026-11-23, taken as written). Fan-out: `specs/fanout-post-v5-w6.md`, lane e447 (`approval` = `human`).

## Problem Statement

`agc init --artifacts=local` keeps only the runtime artifacts (`.current/`, `tasks.md`, `qa_reports/`, `review_reports/`) out of git. An adopter who wants zero agc footprint in a team repo must hand-exclude `specs/`, `design/`, `research/`, the ticket directory and `docs/backlog.md`, and the lane flow then breaks in four places: a lane worktree cannot see those files (git checks out tracked files only); `finish --shipped` deletes the lane's new design, research and ticket files with the worktree; finish cannot number findings (it reads `pending-tickets.md` and `docs/backlog.md` from the base branch's object database); and the Manifest tier halts every cut because the lane branch carries no `specs/fanout-<id>.md`. This feature adds an opt-in mode that keeps those knowledge files out of git, seeds each lane with a snapshot of them at `feature start`, brings back only what the lane created or changed at `finish`, numbers findings into the primary checkout's untracked backlog, and lets `check --cut` accept the lane's seeded manifest when it is still byte-identical to the primary checkout's. With the mode off, nothing changes.

## User Stories

- As an adopter in a team repo, I want every agc file kept out of git, so that teammates who do not use agc see no agc files in the repository or its history.
- As a lane session in that repo, I want the ticket files, backlog, specs, design and research of the primary checkout in my worktree, so that I can read the same knowledge the primary checkout has without a symlink.
- As the integrator, I want `finish --shipped` to bring back the files a lane created or changed and to number its findings, so that nothing written in a lane is lost when the worktree goes.
- As the integrator, I want the Manifest tier to keep working in this mode, guarded by a byte comparison, so that fanned-out cuts do not all halt for a human.

## Options for the human (needs human ruling)

**Human ruling 2026-11-26 (cut approval in the lane session): O1 (a), O2 (a), O3 (a); D1–D10 stand as written.**

**Human ruling 2026-11-27 (lane session): the post-approval Copy amendment to DOC-INST-5 (leading ". With" instead of " With", so the appended sentence no longer runs on from the existing cell) is accepted — the human typed "ok, 同意".**

**Amendment A1 (pm, 2026-11-27, after code-reviewer round 1 CHANGES_REQUESTED, `review_reports/review_T-E447-01.md`) — needs human consent before qa starts.** Everything approved above (O1–O3 (a), D1–D10, DOC-INST-5) stands. Every amended or added item below carries the tag **[A1]**: R1 — 12 Copy rows for strings sr added, each kept verbatim as built (no rewording), two reused-template rows, and one placeholder correction (`e447.reseed-not-knowledge`: `<operand>`, the path as typed, matching the built output); R2 — scenarios AC13–AC19 for sr-added behaviours (behaviour kept as built, except AC14's re-run property, which R4 changes); R3 — AC20 for the `docs/install.md` fact; R4 — D11 (the re-run mechanism) and AC15; AC10 wording aligned with D9 as built (the reviewer's accepted judgement item (2)); O4 (the optional D9 short-circuit, needs a ruling); tasks T-E447-08..10; hop estimate and test impact.

The ticket leaves (i) and (ii) to the cut. (iii) is an ambiguity found while writing the scenarios: read literally, "the existing refuse-on-differing-content rule applies to the rest" refuses every lane-changed seeded file, because its primary copy always exists and differs. **The Acceptance Criteria, Copy / Strings and tasks below are written for the recommended option of each; a different ruling changes the items named in its "changes if not recommended" line.**

### O1 — needs human ruling: opt-in flag and `.current/.config.json` key

| option | flag | key | schema |
|---|---|---|---|
| **(a) recommended** | `agc init --knowledge=local\|repo` | `"knowledge": "local"` (`"repo"` or absent = today's behaviour) | no bump: additive-optional key, the precedent of `host`, `nodeModulesLinks`, `ticketDir` (config `schema_version` stays 2) |
| (b) | `agc init --artifacts=all-local` | third value of the existing `"artifacts"` key | bump to config v3 needed: every reader of `artifacts` today accepts only `"local"` / `"repo"` (server loader, `agc check` drift test, eject header, the lane rules' `artifacts: local` text), so an older agc reading `"all-local"` reports "artifacts undeclared" and a flag-less `agc init` would re-default it |
| (c) | `agc init --local-knowledge` | `"localKnowledge": true` | no bump; but no flag turns it back off (needs a `--no-local-knowledge` or a hand edit), unlike the `local\|repo` pair beside it |

Worked example (a): a team repo already on `--artifacts=local` runs `agc init --knowledge=local`. Config gains `"knowledge": "local"`; `.git/info/exclude` gains `/specs/`, `/design/`, `/research/`, `/docs/tickets/`, `/docs/backlog.md`; `docs/backlog.md` is tracked, so init prints it with `git rm -r --cached docs/backlog.md` and runs nothing. Later `agc init --knowledge=repo` writes `"knowledge": "repo"` and leaves the rules (same as `--artifacts=repo` today).
Worked example (b): same repo runs `agc init --artifacts=all-local`; a teammate's older agc runs `agc check` and prints `artifacts undeclared`; `schema/versions.ts` and `schema/migrations-config.ts` enter scope with a v2→v3 migration, and the lane rules' pinned `artifacts: local` lines need rewording.
Changes if not recommended: (b) adds `schema/versions.ts`, `schema/migrations-config.ts` (+ their `dist/**`) to the touches and a migration task; (c) renames the flag and key in every Copy / Strings row.

### O2 — needs human ruling: the one sanctioned way to re-seed a lane's copy

| option | shape |
|---|---|
| **(a) recommended** | `agc feature reseed <path>...`, run **inside the lane worktree**: copies each named knowledge file from the primary checkout over the lane's copy and updates its hash in the seed record; refuses (exit 1, nothing changed) a file the lane changed since it was seeded |
| (b) | a documented line: `cp <primary>/specs/fanout-<id>.md <worktree>/specs/fanout-<id>.md` |
| (c) | `fanout.mjs check --cut --reseed`: copy, then compare |

Worked example: the integrator adds a Decisions row to `specs/fanout-w7.md` in the primary checkout after lane e500 started. In e500, `check --cut` exits 1 with `manifest changed since lane start — re-seed`. (a): `agc feature reseed specs/fanout-w7.md` prints `re-seeded specs/fanout-w7.md`, the seed record holds the new hash, `check --cut` exits 0, and at finish the file reads as unchanged and is discarded. (b): the `cp` works, but the record still holds the old hash, so finish treats the manifest as lane-changed; if the integrator amends it again before finish, finish refuses (both sides changed) and someone resolves it by hand. (c): a check command starts writing files, and it covers only the manifest.
Changes if not recommended: (b) drops the `reseed` subcommand rows from Copy / Strings and AC9, and the docs carry the `cp` line; (c) moves the copy into `tools/fanout-manifest.ts` and changes `fanout.mjs` usage (`scripts/fanout.mjs` header and `USAGE`), and `check --cut` is no longer read-only.

### O3 — needs human ruling: where `finish --shipped` puts a created or changed knowledge file

| option | rule |
|---|---|
| **(a) recommended** | the same path in the primary checkout. New file → copied. Lane-changed seeded file → copied over the primary copy when the primary copy still has the seeded bytes; when the primary copy changed too (both sides changed) → the existing refusal, before any mutation. In this mode `specs/` goes through this rule instead of `specs/archive/<lane>/`. |
| (b) | the evidence rule used for `specs/` today: `<dir>/archive/<lane>/<path>` for every knowledge dir; never conflicts |

Worked example: lane e500 appends a scenario under `## Added during build` in `docs/tickets/e500.md` and writes `design/e500.md`; meanwhile the primary checkout gains a backlog row. (a): finish copies `design/e500.md` and `docs/tickets/e500.md` to their own paths (the primary ticket file still has the seeded bytes), discards the unchanged backlog copy, and the new backlog row survives. Had the primary ticket file also been edited, finish refuses and names it. (b): `design/archive/e500/e500.md` and `docs/tickets/archive/e500/e500.md` appear; the real ticket file in the primary checkout never gains the appended scenario until someone moves it by hand, and the next wave seeds the stale one.
Changes if not recommended: AC5/AC6 destinations become `<dir>/archive/<lane>/<path>`; AC6's refusal case disappears.

### O4 — needs human ruling [A1]: short-circuit the D9 comparison on the lane's own config copy

D9 as built: inside a linked worktree, `check --cut` runs one `git worktree list` and reads the primary checkout's `.current/.config.json` raw, even when that config turns the mode off; its stdout, stderr and exit code are unchanged in that case (reviewer judgement item (2), accepted). Outside a linked worktree it runs no git and reads no extra file.

| option | shape |
|---|---|
| **(a) recommended** | keep D9 as built; AC10's wording is amended to the observable contract (below). No code change. |
| (b) | before the git call, read the lane's own copied `.current/.config.json` (the copy `agc feature start` makes); when it exists, parses, and does not set `"knowledge": "local"`, skip the comparison with no git call; otherwise as built. |

Worked example: a mode-off repo, lane e500, `check --cut` in the lane. (a): one `git worktree list` plus one read of the primary config, then the same report and exit as today. (b): one read of the lane's config, no git call, same report and exit. A lane that started before the mode was turned on also skips under (b), which is harmless: it holds no seed and its manifest came from a merge.
Why (a): either way `check --cut` reads one extra file inside a lane, so D9's literal "no extra read" cannot hold there; (b) saves one git call and adds `tools/fanout-manifest.ts` + its 4 `dist/` files and a test to the fix round.
Changes if not recommended: (b) adds `tools/fanout-manifest.ts` (+ `dist/tools/fanout-manifest.*`) to T-E447-09, one AC19 case (c) (lane config off and primary config on → not compared; lane config absent → compared as built), and ~10 lines.

## Decisions made at the cut (authored here; override at approval if you disagree)

- **D1 — the mode needs local artifacts.** `--knowledge=local` with an effective artifacts mode other than `local` exits 2, nothing written: the seed record lives in the lane's git-ignored `.current/<lane>/`.
- **D2 — adapter default.** With the mode on and no `--adapter`, `agc init` puts the agc block in `CLAUDE.local.md` unless `CLAUDE.md` already holds the block; otherwise init would create an untracked `CLAUDE.md` and acceptance (a) fails. An explicit `--adapter` still wins.
- **D3 — no config schema bump** (O1 (a)); `schema/**` untouched.
- **D4 — seed record.** A new `LANE_FILES` entry in `tools/lane-paths.ts`: key `knowledgeSeed`, filename `knowledge-seed.json`, `required: false`, `noFlatCounterpart: true` (it never had a flat location). Content: `{"version":1,"files":{"<repo-relative posix path>":"sha256:<64 hex>"}}`, keys sorted. `bin/agc-init.mjs` takes the filename from `laneFile("knowledgeSeed")`, never a literal.
- **D5 — what is seeded.** Every regular file under `specs/`, `design/`, `research/`, the ticket directory, plus `docs/backlog.md`, that exists in the primary checkout, is not tracked there, and whose lane path is absent after checkout and git-ignored in the lane. A symlink is copied as its target's bytes; a dangling one is skipped with a warning. Tracked paths are never copied (the checkout already has them).
- **D6 — `--abandoned` in this mode.** The same record filter applies, so unchanged seeded copies are never copied out; created or changed knowledge files go to `<dir>/abandoned/<lane>/<path>` (`docs/backlog.md` → `docs/abandoned/<lane>/backlog.md`), never committed; findings are numbered as for `--shipped` (Fix (4) names finish, not one verb).
- **D7 — a seeded file deleted in the lane** is not deleted in the primary checkout.
- **D8 — eject code unchanged.** The knowledge exclude rules stay in `.git/info/exclude` after `agc eject` (dropping them would put every untracked knowledge file one `git add -A` away from the team's history — the same reason eject keeps the `CLAUDE.local.md` rule); `docs/install.md` says so and how to remove them by hand.
- **D9 — `check --cut` comparison scope.** Only when run inside a linked worktree whose primary checkout's `.current/.config.json` sets `"knowledge": "local"`; the manifest's repo-relative path is compared byte for byte with the same path in the primary checkout; a missing primary copy counts as changed. Outside that case `check --cut` is unchanged (no git, no extra read).
- **D10 — no new `tools/*.ts`; `CLAUDE.md` untouched.** Seed, harvest and numbering live in `bin/agc-init.mjs`; the comparison lives in `tools/fanout-manifest.ts`, which already resolves the primary checkout with `git worktree list --porcelain` and reads config.
- **D11 [A1] — a `finish` re-run after a late failure completes on its own (R4).** When one run both harvests the lane's changed `docs/backlog.md` and numbers findings into it, finish composes the final backlog (lane bytes + numbered rows) before any write, then writes it to the **lane copy first** and to the primary copy second (temp file + rename each). A re-run then finds the primary copy either byte-identical to the lane copy (already harvested, no copy — the existing identical-destination rule) or still at the seeded bytes (the existing overwrite branch copies the final bytes), and numbering reads the lane copy, whose provenance rows make it allocate nothing. The lane copy is git-ignored and is removed with the worktree, so the write-back leaves no trace. This is the mechanism, decided here; sr does not substitute another without pm.
- **No architect hop.** The data model (D4), module boundaries (D10) and every behaviour choice are fixed here or in O1–O3; the remaining work is mechanical in four existing files. Hop estimate below.

## Acceptance Criteria

All scenarios run against scratch git repos created by the test (never the repo checkout), with `agc` invoked as the CLI. "Mode on" = `.current/.config.json` has `"artifacts": "local"` and `"knowledge": "local"`. `T` below = the qa-named test file(s) `test/e447-*.test.mjs`; each AC's test title starts with its id.

- **AC1 (acceptance a)** — Given a scratch repo with a commit on `main` and no agc files, when `agc init --knowledge=local` runs, then `git status --porcelain` is empty, `.git/info/exclude` holds `/specs/`, `/design/`, `/research/`, `/docs/tickets/`, `/docs/backlog.md`, `/AGENTS.md`, `/.antigravityrules` (agc created both) and `/CLAUDE.local.md` (D2); and after a lane `feature start` → a lane commit of one tracked file → merge into `main` → `feature finish --shipped` with one numbered finding, `git status --porcelain` is empty in the primary checkout at each step, and `git log --all --name-only` lists no path under any knowledge path, `AGENTS.md`, `.antigravityrules` or `CLAUDE.local.md`.
  proof: `node --test test/e447-*.test.mjs` — test `AC1`.
- **AC2 (Fix 1)** — Given a scratch repo, when `agc init` runs with `--knowledge`, then: (a) a `ticketDir` of `work/tickets` yields `/work/tickets/` instead of `/docs/tickets/`; (b) an `AGENTS.md` / `.antigravityrules` that already existed (tracked) gets no exclude rule and is byte-unchanged; (c) a tracked `docs/backlog.md` is listed with the `git rm -r --cached docs/backlog.md` line on stderr, still tracked afterwards (the command is not run); (d) `--knowledge=local --artifacts=repo` exits 2 and writes nothing (D1); (e) `--knowledge=foo` exits 2 and writes nothing; (f) a subdirectory workspace `sub/` gets `/sub/specs/` etc.
  proof: `node --test test/e447-*.test.mjs` — tests `AC2 (a)`…`AC2 (f)`.
- **AC3 (acceptance b, Fix 2)** — Given a mode-on primary checkout holding `docs/tickets/t1.md`, `docs/backlog.md`, `specs/s1.md`, `design/d1.md` and `research/r1.md` (all untracked), when `agc feature start` creates a lane, then the lane has all five, byte-identical; `.current/<lane>/knowledge-seed.json` maps each of the five paths to `sha256:` + its hash and nothing else; `git status --porcelain` in the lane is empty; and stdout carries `e447.start-seeded` with `5`.
  proof: `node --test test/e447-*.test.mjs` — test `AC3`.
- **AC4 (Fix 2, D5)** — Given mode on, when a knowledge path is tracked in the repo, then `feature start` does not overwrite or record it; a dangling symlink under `design/` is skipped with `e447.start-dangling` on stderr and the start still succeeds.
  proof: `node --test test/e447-*.test.mjs` — test `AC4`.
- **AC5 (acceptance c, Fix 3, O3 a)** — Given a seeded lane that writes `design/x.md` and `research/y.md` and nothing else, and a backlog row appended to the primary checkout's `docs/backlog.md` after the lane started, when `finish --shipped` runs, then `design/x.md` and `research/y.md` exist in the primary checkout byte-identical to the lane's, each with an `e447.finish-harvest` line; the primary backlog still holds the appended row, unchanged; no unchanged seeded file is copied (`e447.finish-unchanged` names the count); no file appears under any `archive/<lane>/` for a knowledge dir.
  proof: `node --test test/e447-*.test.mjs` — test `AC5`.
- **AC6 (Fix 3, O3 a)** — Given a seeded lane that appends to `docs/tickets/t1.md`, then `finish --shipped` copies it over the primary copy when the primary copy still has the seeded bytes; when the primary copy was also edited after the start, finish exits non-zero with the existing `e180.evidence-harvest-refuse-line` naming that path, and removes nothing (worktree, branch and primary files unchanged).
  proof: `node --test test/e447-*.test.mjs` — tests `AC6 overwrite` and `AC6 both changed`.
- **AC7 (acceptance d, Fix 4)** — Given a mode-on lane whose worktree `.current/<lane>/pending-tickets.md` holds one block (never committed), when `finish --shipped` runs, then the primary checkout's `docs/backlog.md` gains one row with the next id above its max, uncommitted (`git status` and `git log` unchanged), the history copy of the pending file carries the block under `## Applied`, stdout carries `e447.finish-numbered`, and the E287 "not allocated" warning is not printed. A re-run on an already-closed lane allocates nothing new.
  proof: `node --test test/e447-*.test.mjs` — test `AC7`.
- **AC8 (D6)** — Given a mode-on lane that writes `design/z.md` and leaves its seeded files unchanged, when `finish --abandoned` runs, then the primary checkout gains `design/abandoned/<lane>/z.md` and nothing under `specs/abandoned/<lane>/` for the unchanged seeded specs; a pending finding is numbered as in AC7.
  proof: `node --test test/e447-*.test.mjs` — test `AC8`.
- **AC9 (acceptance e, Fix 5, O2 a)** — Given a mode-on lane whose seeded `specs/fanout-x.md` is the manifest, when `fanout.mjs check --cut specs/fanout-x.md <lane> <spec>` runs in the lane with both manifests equal, then no `MANIFEST_CHANGED` line is printed and the exit code is what it is today for that cut; when the primary copy is changed after the start, it prints `e447.cut-manifest-changed` and exits 1; after `agc feature reseed specs/fanout-x.md` (stdout `e447.reseed-ok`) it passes again and the seed record holds the new hash. `agc feature reseed` on a file the lane changed exits 1 with `e447.reseed-refuse-changed` and changes nothing.
  proof: `node --test test/e447-*.test.mjs` — tests `AC9 match`, `AC9 changed`, `AC9 reseed`, `AC9 reseed refuses`.
- **AC10 (acceptance f)** — Given the mode is off (key absent or `"repo"`), then `agc init` writes no knowledge rule, `feature start` copies no knowledge file and writes no seed record, `finish` behaves byte-for-byte as before (same stdout/stderr on the existing fixtures), `check --cut` prints the same report with the same exit code as today **[A1 amended: was "runs no git command and reads no extra file"; outside a linked worktree it runs no git and reads no extra file; inside one it may run one `git worktree list` and read the primary checkout's config raw — D9 as built, see O4]**; and the full suite at the base (4789 pass / 2 skipped / 0 fail, 4791 tests) stays green apart from the re-pins listed under Test impact.
  proof: `node scripts/test-lock.mjs -- npm test` on the final commit; plus `node --test test/e447-*.test.mjs` — test `AC10`.
- **AC11 (Fix 6)** — Given the composed prompts, then the constitution carries `C-C08K` once, directly after the Batch-lane line, on both design arms and not in lite; coord-03's bookkeeping line ends with `C-CO3K`; skill-integrator Stage 1 step 3 ends with `C-IN-R4`; no new line in those three files cites a repo-only path or a bare ticket id, carries a backticked gate error code, or (coord-03) contains `Task`.
  proof: `node --test test/e447-*.test.mjs` — test `AC11`.
- **AC12 (docs)** — Given the shipped docs, then `docs/config.md` has exactly one `knowledge` section (`DOC-CFG`), `docs/install.md` carries `DOC-INST-*`, and `docs/lane-protocol.md` carries `DOC-LP-1..3` at the placements named in Copy / Strings, with every pre-existing line byte-unchanged.
  proof: `node --test test/e447-*.test.mjs` — test `AC12`.

**[A1] Added after code-reviewer round 1 (R2, R3, R4).** Same conventions as above. "Nothing removed" = the worktree, the branch, the primary checkout's knowledge files and backlog, and `tasks.md` / `.current/` in the primary checkout are unchanged, and no commit is added. Each behaviour is kept as sr built it unless the AC says otherwise.

- **AC13 [A1] (R2 a) — finish with no seed record.** Given a mode-on lane with no `.current/<lane>/knowledge-seed.json` (the lane was started before the mode was on, or start's seeding warned), when `finish --shipped` runs, then every untracked, git-ignored knowledge file in the lane counts as created: one absent in the primary checkout is copied there (`e447.finish-harvest`); one byte-identical to the primary copy is not copied and not counted; one that differs from the primary copy refuses the run with `e180.evidence-harvest-refuse-line` naming it, nothing removed (no record means no seeded bytes, so the AC6 overwrite never applies); no `e447.finish-unchanged` line.
  proof: `node --test test/e447-*.test.mjs` — test `AC13`.
- **AC14 [A1] (R2 b) — `--shipped` with a lane-changed backlog and findings to number.** Given a mode-on lane that appended a row to its seeded `docs/backlog.md` and holds one pending block, when `finish --shipped` runs and the primary backlog still has the seeded bytes, then the primary backlog becomes the lane's backlog followed by the numbered row (next id above the max of the lane's backlog), uncommitted, with `e447.finish-harvest` for `docs/backlog.md` and `e447.finish-numbered`. When the primary backlog was also changed after the start, finish refuses with `e180.evidence-harvest-refuse-line` naming `docs/backlog.md`, numbers nothing, nothing removed.
  proof: `node --test test/e447-*.test.mjs` — tests `AC14 numbered` and `AC14 both changed`.
- **AC15 [A1] (R4, D11) — re-run after a late failure.** Given the AC14 lane plus an untracked non-ignored file in the worktree that makes `git worktree remove` fail, when `finish --shipped` runs (exit non-zero after the harvest, the numbering and the lane close), the blocking file is deleted, and `finish --shipped` runs again, then the re-run exits 0 with no hand edit, prints no `e447.finish-numbered` line (allocates nothing), the primary backlog is byte-identical to its state after the first run (the lane's backlog plus exactly one numbered row), and the worktree is removed. Red today (the re-run refuses on `docs/backlog.md`).
  proof: `node --test test/e447-*.test.mjs` — test `AC15`.
- **AC16 [A1] (R2 c) — finish refusals in mode on, each exit 1, nothing removed:** (i) a malformed `knowledge-seed.json` (not JSON, or no `files` object) → `e447.finish-seed-unreadable`; (ii) a lane-created `design/new/x.md` while the primary checkout has a regular file at `design/new` → `e180.evidence-harvest-refuse-line` naming the primary `design/new`; (iii) one pending block in the worktree and no `docs/backlog.md` in the primary checkout (and none harvested from the lane) → `e447.finish-backlog-missing`; (iv) a malformed pending block in the worktree's `pending-tickets.md` → `e447.finish-pending-malformed`. Each case on `--shipped`; (i) also on `--abandoned`.
  proof: `node --test test/e447-*.test.mjs` — tests `AC16 (i)`…`AC16 (iv)`.
- **AC17 [A1] (R2 d) — `agc feature reseed` cases**, run inside a mode-on lane: (i) a knowledge path tracked in the lane → `e447.reseed-not-ignored`, exit 1; (ii) a path absent in the primary checkout, or a directory there → `e447.reseed-not-primary-file`, exit 1; (iii) a malformed seed record → `e447.reseed-seed-unreadable`, exit 1; (iv) no operand → `e447.reseed-no-operand`, exit 2; (v) two operands where one is refused → exit 1, neither copied, the record byte-unchanged (all or nothing); (vi) a file present in the primary checkout, absent in the lane and absent from the record → copied into the lane, the record gains its hash, `e447.reseed-ok`, exit 0. In (i)–(v) the lane's knowledge files and the record are byte-unchanged.
  proof: `node --test test/e447-*.test.mjs` — tests `AC17 (i)`…`AC17 (vi)`.
- **AC18 [A1] (R2 e) — init refuses an unsafe `ticketDir`.** Given `.current/.config.json` with `"ticketDir": "work/tick*ts"`, when `agc init --knowledge=local --artifacts=local` runs, then it exits 2 with `e447.init-ticketdir-unsafe` on stderr, and the config, `.git/info/exclude` and every adapter file are byte-unchanged (nothing created).
  proof: `node --test test/e447-*.test.mjs` — test `AC18`.
- **AC19 [A1] (R2 f) — `check --cut` cases outside D9's comparison.** Given a lane whose seeded manifest differs from the primary checkout's: (a) the primary `.current/.config.json` is not valid JSON → it counts as mode off: no `MANIFEST_CHANGED` line, exit as today for that cut; (b) the manifest operand resolves outside the lane worktree (for example the primary checkout's own copy by absolute path) → not compared, no `MANIFEST_CHANGED` line, exit as today.
  proof: `node --test test/e447-*.test.mjs` — tests `AC19 (a)` and `AC19 (b)`.
- **AC20 [A1] (R3) — the install doc names the right mode-off destination.** Given `docs/install.md`, then the `--shipped` bullet under "With `\"knowledge\": \"local\"`" says that in this mode `specs/` does not go to `specs/archive/<ticket-id>/`, and that bullet does not contain `specs/abandoned/`. Every other line of that section is byte-unchanged. Red today.
  proof: `node --test test/e447-*.test.mjs` — test `AC20`.

## Copy / Strings

CLI strings (stdout unless marked stderr). `<lane>` = the lane id; `<rel>` = a repo-relative posix path.

| string id | exact text (quote verbatim) | source |
|---|---|---|
| e447.usage-init | `  init [--artifacts=local\|repo] [--adapter=shared\|local] [--knowledge=local\|repo]` (replaces the first `init` line of `STR_USAGE`), plus after the `--adapter` sentences: `          --knowledge=local (opt-in, needs local artifacts) also keeps specs/,\n          design/, research/, the ticket directory and docs/backlog.md out\n          of git; agc feature start then seeds each lane with them.\n` | authored-here — O1 (a) |
| e447.init-bad-value | stderr `agc init: --knowledge must be "local" or "repo" (got <JSON value>)` (exit 2) | authored-here — mirrors the `--artifacts` usage error |
| e447.init-needs-local | stderr `agc init: --knowledge=local needs local artifacts — the lane seed record lives in the git-ignored .current/; re-run with --artifacts=local` (exit 2) | authored-here — D1 |
| e447.init-tracked | stderr `agc init — warning: the following knowledge path(s) are already tracked in this repo — the exclude rule just added has no effect on tracked files:\n  <display>…\nUntrack them with[ (run from the repository root)]:\n  git rm -r --cached <targets>\nNote: history still contains these files after that command.` | ticket Fix (1) "as E106 does" — same shape as the existing artifacts warning |
| (reused) | `agc init — added <rules> to the shared info/exclude` | existing string |
| e447.usage-feature | new `STR_USAGE_FEATURE` block after `feature finish`: `  feature reseed <path>...\n          Inside a lane worktree, with "knowledge": "local": copy each named\n          knowledge file from the primary checkout over the lane's copy and\n          record its new hash. Refuses a file the lane has changed.\n`; and appended to the `start` paragraph: `          With "knowledge": "local", also copies the primary checkout's\n          untracked specs/, design/, research/, ticket files and\n          docs/backlog.md (a snapshot, hashes in .current/<lane>/).\n`; every existing sentence kept | authored-here — O2 (a), Fix (2) |
| e447.feature-unknown | `agc feature: unknown subcommand <JSON> (start \| finish \| reseed)` / `agc feature: missing subcommand (start \| finish \| reseed)` | existing strings + `reseed` |
| e447.start-seeded | `agc feature start — copied <n> knowledge file(s) from the primary checkout (a snapshot; content hashes recorded in .current/<lane>/knowledge-seed.json)` | authored-here — Fix (2) |
| e447.start-dangling | stderr `agc feature start — warning: <rel> in the primary checkout is a symlink that does not resolve — not copied into the lane` | authored-here — D5 |
| e447.reseed-ok | `agc feature reseed — re-seeded <rel> from the primary checkout` | authored-here — O2 (a) |
| e447.reseed-refuse-changed | stderr `agc feature reseed: <rel> was changed in this lane since it was seeded — not re-seeded (nothing changed)` (exit 1) | authored-here — O2 (a) |
| e447.reseed-not-knowledge | stderr `agc feature reseed: <operand> is not under a knowledge path of this workspace — nothing changed` (exit 2); `<operand>` = the path as typed (an escaping or absolute operand has no repo-relative form) **[A1 amended: was `<rel>`; matches the built output, no code change]** | authored-here |
| e447.reseed-not-lane | stderr `agc feature reseed: run it inside a lane worktree of a workspace whose .current/.config.json sets "knowledge": "local"` (exit 1) | authored-here |
| e447.finish-harvest | `agc feature finish — harvested knowledge file <rel> -> primary <rel> (fs copy, not committed — the lane created or changed it)` (`--abandoned`: `-> primary <dir>/abandoned/<lane>/<path>`) | authored-here — Fix (3), D6 |
| e447.finish-unchanged | `agc feature finish — <n> seeded knowledge file(s) unchanged in the lane — not copied back` (printed only when n > 0) | authored-here — Fix (3) |
| (reused) e180.evidence-harvest-refuse-line | stderr `agc feature finish <verb>: harvest destination already exists in the primary checkout and differs (nothing moved):\n  <path>` | existing string — ticket Fix (3) "the existing refuse-on-differing-content rule" |
| e447.finish-numbered | `agc feature finish — appended <ids> to docs/backlog.md in the primary checkout (not committed — knowledge files stay out of git)` (followed by the existing `applied <n> pending ticket(s)` line) | authored-here — Fix (4) |
| e447.init-ticketdir-unsafe **[A1]** | stderr `agc init: refusing --knowledge=local — ticketDir "<dir>" contains a character unsafe for a gitignore exclude rule (a wildcard, a backslash, or a control character). Rename the directory, or re-run with --knowledge=repo.` (exit 2, nothing written) | authored-here — sr T-E447-02, kept verbatim; a rule built from such a segment would match other paths |
| e447.init-config-malformed **[A1]** | stderr `agc init — warning: <config>: could not add "knowledge" — left untouched (not valid JSON, or the "knowledge" key could not be rewritten unambiguously)` (`<config>` = the workspace-relative config path) | authored-here — sr T-E447-02, kept verbatim; same shape as the existing `could not add "host"` / `"artifacts"` warnings |
| e447.usage-feature-finish **[A1]** | appended to the `finish` paragraph of `STR_USAGE_FEATURE`, after "keeps it with a warning.": `          With "knowledge": "local", copies back only the knowledge files\n          (specs/ included) the lane created or changed: to the same path\n          (--shipped; refused when primary changed that file too) or under\n          <dir>/abandoned/<lane>/ (--abandoned); a worktree-only\n          pending-tickets.md is numbered into primary's untracked\n          docs/backlog.md, not committed.\n` | authored-here — sr T-E447-06, kept verbatim; O3 (a), D6, Fix (4) |
| e447.start-seed-not-ignored **[A1]** | stderr `agc feature start — warning: .current/<lane>/knowledge-seed.json would not be ignored by git in the lane — no knowledge file copied (run agc init --artifacts=local in the primary checkout)` | authored-here — sr T-E447-03, kept verbatim; D1's precondition checked at start |
| e447.start-copy-failed **[A1]** | stderr `agc feature start — warning: could not copy <rel> into the lane (<error>) — not seeded` | authored-here — sr T-E447-03, kept verbatim |
| e447.start-seed-failed **[A1]** | stderr `agc feature start — warning: could not seed the lane's knowledge files (<error>) — copy them by hand or re-run in a new lane` | authored-here — sr T-E447-03, kept verbatim; a hand copy has no record, so finish treats it as created (AC13) |
| e447.reseed-no-operand **[A1]** | stderr `agc feature reseed: expected at least one <path>` (usage error, exit 2) | authored-here — sr T-E447-03, kept verbatim |
| e447.reseed-seed-unreadable **[A1]** | stderr `agc feature reseed: cannot read .current/<lane>/knowledge-seed.json (<error>) — nothing changed` (exit 1) | authored-here — sr T-E447-03, kept verbatim |
| e447.reseed-not-ignored **[A1]** | stderr `agc feature reseed: <rel> is not ignored by git in this lane (tracked, or no exclude rule) — nothing changed` (exit 1; one line per refused operand) | authored-here — sr T-E447-03, kept verbatim |
| e447.reseed-not-primary-file **[A1]** | stderr `agc feature reseed: <rel> is not a file in the primary checkout — nothing changed` (exit 1; one line per refused operand) | authored-here — sr T-E447-03, kept verbatim |
| e447.finish-seed-unreadable **[A1]** | stderr `agc feature finish <verb>: cannot read .current/<lane>/knowledge-seed.json (<error>) — nothing removed` (exit 1) | authored-here — sr T-E447-06, kept verbatim |
| e447.finish-harvest-failed **[A1]** | stderr `agc feature finish <verb>: harvest of <rel> into the primary checkout failed (<error>) — worktree and branch left in place (re-running finish is safe)` (exit 1) | authored-here — sr T-E447-06, kept verbatim; "re-running finish is safe" is made true for the lane-changed backlog by D11 |
| (reused) e447.finish-backlog-missing **[A1]** | stderr `agc feature finish <verb>: docs/backlog.md not found on the primary checkout — cannot allocate ids for .current/<lane>/pending-tickets.md (nothing applied, nothing removed)` (exit 1) | existing template, mode-on value of `<base>` ("the primary checkout"); template unchanged |
| (reused) e447.finish-pending-malformed **[A1]** | stderr `agc feature finish <verb>: .current/<lane>/pending-tickets.md on the lane worktree has <n> problem(s) — fix them on the lane branch and re-run (nothing applied, nothing removed):\n  <problem>…` (exit 1) | existing template, mode-on value of `<revLabel>` ("the lane worktree"); template unchanged, so "on the lane branch" stays (changing it would move the mode-off text, AC10) |
| e447.cut-manifest-changed | report line `FAIL  MANIFEST_CHANGED: manifest changed since lane start — re-seed` (code `MANIFEST_CHANGED`, exit 1, failure counted like the other manifest-side failures) | message: ticket Fix (5) verbatim; code name authored-here — must not end in a gate-code suffix (`_CHANGE`, `_MISMATCH`, … — `test/error-code-contract.test.mjs` would read it as a gate code) |

SOP / doc text. Every item below ships to adopters: it cites no repo-only path and no bare ticket id, and quotes no gate error code in backticks. The exact text of each verbatim item is the fenced block under its id; leading spaces inside a block are part of the line.

| string id | placement | source |
|---|---|---|
| C-C08K | `content/const-08-chain-31-mid.md`: a new line directly after the Batch-lane sub-bullet (Lease-Override moves from line 6 to 7; the file goes from 11 to 12 lines) | authored-here from ticket Fix (6) and R3 |
| C-CO3K | `content/coord-03-core-fallback.md`: appended to the end of the "Bookkeeping never lands on local main" line (same line; no line added) | authored-here from ticket Fix (6) |
| C-IN-R4 | `content/skill-integrator.md`: appended to the end of the Stage 1 step-3 "Hard constraints" line (same line; the line count is unchanged) | authored-here from ticket R4 |
| DOC-LP-1 | `docs/lane-protocol.md` §3: a new line directly after the "證據目錄不 symlink" sub-item (the last sub-item of the `artifacts: local` bullet) | authored-here from Fix (2), (3), O2 (a), O3 (a) |
| DOC-LP-2 | `docs/lane-protocol.md` §4: a new line directly after the §4 `artifacts: local` line | authored-here from Fix (4) |
| DOC-LP-3 | `docs/lane-protocol.md` §5 rule 2: a new line directly after the "有 architect hop 的票，預審兩次" sub-item | authored-here from Fix (5), R3 |
| DOC-INST-5 | `docs/install.md` eject table, row (iii), appended to the disposition cell | authored-here from D8 |
| DOC-CFG | `docs/config.md`: a new `knowledge` section after the `ticketDir` section; content below (wording free, facts fixed) | authored-here from Fix (1), O1 (a) |
| DOC-INST-1..4 | `docs/install.md`; content below (wording free, facts fixed) | authored-here from Fix (1)–(4), D1, D2, D6, O2 (a), O3 (a) |

**C-C08K**
```text
  - **Local knowledge files**: in a workspace whose `.current/.config.json` sets `"knowledge": "local"` (`docs/config.md`), the lane branch carries no manifest, so the lane's seeded copy of `specs/fanout-<id>.md` — the copy `agc feature start` made — meets condition (2) in place of the branch copy, provided the `check --cut` of condition (3) also found it byte-identical to the primary checkout's current copy. In that mode the fresh `人類` row a mid-wave manifest change needs reaches the lane by `agc feature reseed`, not by a merge.
```

**C-CO3K** (starts with one space; appended to the existing line)
```text
 When `.current/.config.json` sets `"knowledge": "local"` (`docs/config.md`), the backlog, ticket files and fan-out manifests are git-ignored: edit them in the primary checkout with no commit, branch or pull request, and a running lane sees a manifest edit only after `agc feature reseed`.
```

**C-IN-R4** (starts with one space; appended to the existing line)
```text
 When `.current/.config.json` sets `"knowledge": "local"` (`docs/config.md`), B fans out only after `agc feature finish --shipped` has run for every lane B needs, not merely after their merge: each lane starts from a snapshot of the primary checkout, and a lane's specs, design, research and ticket edits reach the primary checkout only through that finish. In that mode the manifest is git-ignored too: edit it in the primary checkout, uncommitted.
```

**DOC-LP-1**
```text
  - **知識檔也留本機的 repo**（`.current/.config.json` 的 `knowledge` 是 `local`）：`specs/`、`design/`、`research/`、票檔目錄（`ticketDir`，預設 `docs/tickets/`）與 `docs/backlog.md` 也被 git exclude，lane 不 commit 這些路徑。`feature start` 把 primary 當下的這些檔複製進 worktree（快照：之後 primary 的修改不會自動進來）並記下每個檔的內容雜湊；`agc feature finish --shipped` 只把 lane 新建或改過的檔複製回 primary 的同一路徑（不 commit），沒改過的複本直接丟掉；primary 也改了同一個檔時 finish 拒絕、什麼都不動。要讓 lane 跟上 primary 改過的檔，在 worktree 裡跑 `agc feature reseed <路徑>`；lane 改過的檔不能 re-seed。
```

**DOC-LP-2**
```text
- **知識檔也留本機的 repo**：finish 直接從 worktree 的 `.current/<lane>/pending-tickets.md` 配號，把新列附加到 primary 未追蹤的 `docs/backlog.md`（不 commit），不走上一條「從未 commit」的路徑。
```

**DOC-LP-3**
```text
   - **知識檔也留本機的 repo**：fan-out 清單不在 lane branch 上，manifest tier 改看 `feature start` 複製進來的那份；`check --cut` 另外逐 byte 比對它和 primary 當下的清單，不同就 exit 非 0 並印 `manifest changed since lane start — re-seed`，這時先跑 `agc feature reseed specs/fanout-<id>.md` 再重跑 `check --cut`。
```

**DOC-INST-5** (starts with a period and one space, because the existing cell has no closing period; appended to the (iii) disposition cell — amended by the coordinator after T-E447-07 showed the run-on join)
```text
. With `"knowledge": "local"`, the knowledge exclude rules are kept, so untracked knowledge files never show up for a `git add -A`; remove them by hand from the shared `.git/info/exclude` when you no longer need them.
```

**DOC-CFG** — a section headed "`knowledge` — keep knowledge files out of git too (optional)": an example `{"artifacts": "local", "knowledge": "local"}`; a value table (`"local"`: `agc init` writes root-anchored exclude rules for `specs/`, `design/`, `research/`, the ticket directory and `docs/backlog.md`, plus `AGENTS.md` / `.antigravityrules` only when agc creates them; `"repo"` or absent: today's behaviour); semantics bullets: needs `"artifacts": "local"`; read raw from the primary checkout's file by `agc init`, `agc feature start`, `agc feature reseed`, `agc feature finish` and `fanout.mjs check --cut`; lanes see a snapshot, recorded in `.current/<lane>/knowledge-seed.json`; closing bullet verbatim:
```text
- **No schema version change.** The key is additive-optional; config `schema_version` stays 2 and no migration exists.
```

**DOC-INST-1..4** — (1) a subsection "Keeping knowledge files out of git too: `agc init --knowledge=local|repo`" after the `--adapter` subsection: the flag, the rules written, the D1 refusal, the D2 adapter default, the tracked-path report with the `git rm -r --cached` line (never run), a re-run keeps the declared value; (2) an `agc feature start` Env-bootstrap bullet: the byte copy of every untracked knowledge file where git ignores the lane path, hashes in `.current/<lane>/knowledge-seed.json`, a snapshot; (3) a subsection "`agc feature reseed <path>...`" after the `finish` subsection: run inside the lane, copies and re-records, refuses a lane-changed file, the `check --cut` re-seed line points here; (4) `finish` bullets: created or changed knowledge files to the same path (O3 (a)), unchanged copies discarded, the both-sides-changed refusal, the `--abandoned` destination (D6), numbering into the untracked backlog with no commit.

Unchanged on purpose: the `docs/config.md` skill-override caveat; the `docs/lane-protocol.md` hop-continuation (b) sentence; line 37 and every other existing line of `docs/lane-protocol.md` (pins: `test/e433-test-first-rules.test.mjs` line 37, `test/e351-lane-protocol-gaps.test.mjs` §3/§4 lines and adjacency, `test/e383-lane-ledger-worktree.test.mjs` adjacency, `test/e425-stop-ticket-batch.test.mjs` line-112 suffix); the four coord-03 sentences pinned by `test/e408-core-task-alias-tail.test.mjs`; the const-08 Manifest-tier and Batch-lane lines (pinned verbatim and adjacent by `test/e425-stop-ticket-batch.test.mjs`). `docs/lane-protocol.md` text must not contain `node bin/agc-init.mjs`, `dist/`, `test/`, `node scripts/fanout.mjs`, `content/**`, `compose-golden`, `context-budget`.

## Visual Tokens

| token id | property | value (quote verbatim) | source |
|---|---|---|---|
| N/A | — | — | feature has no visual literals |

## Visual Widgets

| widget id | description | source-node |
|---|---|---|
| N/A | — | feature has no non-primitive widgets |

## Implementation constraints (from the test probe)

- `bin/agc-init.mjs`: keep `ARTIFACT_EXCLUDE_RULES`, `SHIPPED_EVIDENCE_DIRS`, `ABANDON_EVIDENCE_DIRS`, `ABANDON_HARVEST_DIRS`, `KNOWLEDGE_RULES` byte-unchanged (new constants instead; `test/e351-lane-protocol-gaps.test.mjs` AC-E351-5 deep-equals them); keep the existing `STR_USAGE_FEATURE` sentence "is not numbered — finish warns, lists its findings and keeps a copy under .current/history/<YYYY-MM>/<lane>/"; add no call site of `laneIgnoredStateFiles(` (`test/e196-ignored-lane-state.test.mjs` counts 4); insert no function between `function deleteRemoteLaneBranch(` and `async function runFeatureFinish` (`test/e298-finish-remote-delete.test.mjs` slices that span) or inside `checkOrphanLanes`.
- No new importer of `lane-paths` and no new caller of `resolveLanePaths` / `resolveCurrentLane` outside `tools/lane-paths.ts` and `bin/agc-init.mjs` (`test/lane-paths.test.mjs` CALLERS1–3 allow-lists).
- `tools/fanout-manifest.ts`: the comparison runs in `runCheckCut` (`checkCut` stays pure); it must not call `loadConfig` on the primary checkout's config for this check if that would heal-write — read the key raw.
- `content/coord-03-core-fallback.md`: the new text contains no `Task` (`test/e408-core-task-alias-tail.test.mjs` AC1).

## Tasks

| id | role | description | depends_on |
|---|---|---|---|
| T-E447-01 | qa-engineer | Write AC1–AC12 as tests in `test/e447-*.test.mjs` (scratch git repos; CLI-level), list every red one in `qa_reports/expected-red_e447-local-knowledge-files.txt`. Do not touch goldens or budget caps yet. | none |
| T-E447-02 | sr-engineer (A1) | Config + init: `knowledge` key surfaced by `tools/config.ts` (additive, no schema bump); `LANE_FILES` `knowledgeSeed` entry in `tools/lane-paths.ts`; `agc init --knowledge` (rules, D1, D2, tracked report, usage); rebuild `dist/`. Makes AC1-init part, AC2, AC10-init green. | T-E447-01 |
| T-E447-03 | sr-engineer (A2a) | Lane start in `bin/agc-init.mjs`: `feature start` seed + record (Fix 2, D5); `feature reseed` (O2 a); start/reseed usage and the unknown-subcommand text. Makes AC1-start part, AC3, AC4, AC9-reseed, AC10-start green. | T-E447-02 |
| T-E447-06 | sr-engineer (A2b) | Finish in `bin/agc-init.mjs`: `finish --shipped` / `--abandoned` record-filtered copy-back (O3 a, D6, D7) with the both-sides-changed refusal; worktree numbering into the primary backlog (Fix 4); finish usage lines. Makes AC1-finish part, AC5–AC8, AC10-finish green. | T-E447-03 |
| T-E447-04 | sr-engineer (B1) | `check --cut` byte comparison + `MANIFEST_CHANGED` (Fix 5, D9) in `tools/fanout-manifest.ts`, rebuild `dist/`; C-C08K (const-08), C-CO3K (coord-03), C-IN-R4 (skill-integrator). Makes AC9-check part, AC11 green. | T-E447-06 |
| T-E447-07 | sr-engineer (B2) | DOC-CFG (`docs/config.md`), DOC-INST-1..5 (`docs/install.md`), DOC-LP-1..3 (`docs/lane-protocol.md`). Makes AC12 green. Last implementation task → planned return to qa (R3 (b)). | T-E447-04 |
| T-E447-05 | qa-engineer (planned return, 1 `sr_return`) | Re-capture the 7 compose goldens; set the moved `test/context-budget.test.mjs` caps to measured values with a per-hunk note; re-pin `test/lane-paths.test.mjs` REG1 and `test/e410-task-alias-content-tail.test.mjs` (const-08 row + count); update the expected-red manifest; then back to sr → code-reviewer. | T-E447-07 |

| T-E447-08 **[A1]** | qa-engineer | Write AC13–AC20 as tests in `test/e447-*.test.mjs` (scratch git repos, CLI level; the round-1 tests stay as they are). Pin the new Copy rows a test already provokes (AC16, AC17, AC18 strings); `e447.start-copy-failed` / `e447.start-seed-failed` / `e447.finish-harvest-failed` stay unpinned (hard to provoke portably; the reviewer accepted them untested). Update `qa_reports/expected-red_e447-local-knowledge-files.txt`: AC15 and AC20 are red today; the others pin behaviour sr already built and should be green — list any that is not, with the reason. No golden, budget-cap or `content/**` change. | T-E447-05 |
| T-E447-09 **[A1]** | sr-engineer | R4 / D11 in `bin/agc-init.mjs` (compose the final backlog before writing; lane copy first, then primary); R3 in `docs/install.md` (the `--shipped` bullet: `specs/archive/<ticket-id>/`, not `specs/abandoned/`). No Copy text changes (all R1 rows kept verbatim). With O4 (b) only: the lane-config short-circuit in `tools/fanout-manifest.ts` + rebuild `dist/`. Makes AC15 and AC20 green with AC1–AC19 still green. | T-E447-08 |
| T-E447-10 **[A1]** | code-reviewer | Round-2 review of the amended spec (A1), the T-E447-08 tests and the T-E447-09 diff; full-suite judge run. | T-E447-09 |

Order: T-E447-01 → 02 (A1) → 03 (A2a) → 06 (A2b) → 04 (B1) → 07 (B2) → 05 (planned qa return) → round 1 CHANGES_REQUESTED → **[A1]** 08 (qa) → 09 (sr) → 10 (code-reviewer). Ids 06 and 07 were added at the integrator's pre-review split; 03, 04 and 05 keep their ids with amended descriptions and `depends_on`.

`task_size` (≤ 5 files / ≤ 300 lines per sr task):

| task | files | line estimate |
|---|---|---|
| A1 (02) | `tools/config.ts`, `tools/lane-paths.ts`, `bin/agc-init.mjs` (+ `dist/`) | ~120 (config key ~20, `LANE_FILES` entry + path field ~10, init flag/rules/refusals/tracked report/usage ~90) |
| A2 as one task | `bin/agc-init.mjs` | ~400 — over the cap, so split: |
| A2a (03) | `bin/agc-init.mjs` | ~185 (seed walk + `check-ignore` batch + copy + record write ~95; `feature reseed` args, lane/mode checks, hash check, copy, record update ~75; usage + subcommand text ~15) |
| A2b (06) | `bin/agc-init.mjs` | ~220 (record-filtered classification + same-path / abandoned destinations + refusal in the harvest plan ~110; `--abandoned` wiring ~35; worktree numbering into the primary backlog + skipping the "not allocated" warning ~60; usage ~15) |
| B1 (04) | `tools/fanout-manifest.ts` (+ `dist/`), `content/const-08-chain-31-mid.md`, `content/coord-03-core-fallback.md`, `content/skill-integrator.md` | ~60 (comparison + code ~45; three text items 3 lines) |
| B2 (07) | `docs/config.md`, `docs/install.md`, `docs/lane-protocol.md` | ~70 (config section ~30, install subsections/bullets ~35, lane-protocol 3 lines) |
| **[A1]** fix (09), O4 (a) | `bin/agc-init.mjs`, `docs/install.md` | ~35 (D11: compose the final backlog in planning, hand it to the harvest copy and the lane write-back, drop the second primary write ~30; R3 one line) |
| **[A1]** fix (09), O4 (b) | + `tools/fanout-manifest.ts` (+ `dist/`) | ~45 (the above + the short-circuit ~10) |

Release bookkeeping (version, CHANGELOG, backlog done-mark) belongs to the integrator / release-engineer, not to these tasks.

## Test impact

Baseline at `07a6d47` (this worktree, `node scripts/test-lock.mjs -- npm test`): **4789 pass / 0 fail / 2 skipped, 4791 tests**.

Probe: literal and regex grep of `test/` for every owned file's path and for the strings, constants, line numbers and adjacencies the change touches (not run against a diff — none exists yet).

**Will go red, owned by e447 (re-pinned by qa in T-E447-05):**
- `test/fixtures/compose-golden/**` — 7 files move: `build-full-design.txt`, `build-full-design-fd.txt`, `build-full-nondesign.txt`, `build-full-nondesign-fd.txt`, `constitution-monolith.txt`, `hook-full.txt` (const-08), `skill-coordinator-monolith.txt` (coord-03). The 4 `build-lite-*` and `hook-lite.txt` do not move (const-08 is chain-only). Their readers `test/compose-equivalence.test.mjs`, `test/skill-manifest.test.mjs` and `test/e90-golden-capture-completeness.test.mjs` go green again on recapture with no edit.
- `test/context-budget.test.mjs` — caps that move: AC8 rationale-stripped design-arm constitution (≤ 9407), AC8 teamwork coordinator bundle (≤ 19699, const-08 + coord-03), AC8 non-design constitution (≤ 7495). Not moving: AC2 lean (const-08 is chain-only), skill-pm / spec-workshop / sr caps; skill-integrator has no cap.

**Will go red, outside the manifest's owned set — assigned to e447 by the integrator at cut pre-review (standing unowned-red rule); re-pinned by qa in T-E447-05:**
- `test/lane-paths.test.mjs` — REG1 pins `LANE_FILES` at 8 entries and its filename list; D4 makes 9 (`knowledge-seed.json`). Re-pin: count 9, 8 optional, list + `knowledge-seed.json`.
- `test/e410-task-alias-content-tail.test.mjs` — AC2 pins const-08 at 12 `split("\n")` parts and its Lease-Override alias site at line 6; C-C08K makes 13 and line 7.
- `test/e428-tracker-mirror.test.mjs` — AC6 and AC12 freeze the sha256 of `content/skill-integrator.md` with that file's own Copy taken out; C-IN-R4 changes it. Re-pin: the frozen hash value only, every other assertion unchanged (assigned by the integrator after T-E447-04, mailbox to-lane#7).

**[A1] Amendment test impact.** A1 touches no `content/**`, so no compose golden and no `test/context-budget.test.mjs` cap moves. T-E447-09 edits `bin/agc-init.mjs` (finish path only, mode on) and one line of `docs/install.md`. Readers of `docs/install.md` (`test/e447-served-text.test.mjs` AC12, `test/e444-claude-local-adapter.test.mjs`, `test/agc-feature-lifecycle.test.mjs`, `test/e259-comment-scan-limits.test.mjs`, `test/e258b-comment-scan.test.mjs`, `test/e234-hygiene-scan.test.mjs`) pin no text of the changed bullet (grep at A1: no hit for `does not go to` or that bullet's `specs/abandoned/` in `test/`); AC12's "every pre-existing line byte-unchanged" compares against the base `07a6d47`, where the bullet did not exist. The round-1 suite result (4815 pass / 0 fail / 2 skipped of 4817 at `db6e693`) is the new baseline; A1 adds only `test/e447-*` tests. With O4 (b), `tools/fanout-manifest.ts` + `dist/` also move; `test/e296-manifest-tier.test.mjs` and `test/e350-fanout-call-form.test.mjs` should stay green (outside a linked worktree the path is unchanged).

**Readers that stay green if the constraints above hold (owned; listed by the manifest or the probe):** `test/e106-init-artifacts-flag.test.mjs`, `test/e239-init-subdir-exclude.test.mjs`, `test/e108-eject.test.mjs`, `test/e351-lane-protocol-gaps.test.mjs`, `test/e429-lane-config-copy.test.mjs`, `test/e213-shipped-ignored-shape.test.mjs`, `test/e217-abandoned-specs-harvest.test.mjs`, `test/e180-abandoned-harvest.test.mjs`, `test/e335-symlinked-pending-harvest.test.mjs`, `test/e385-worktree-evidence.test.mjs`, `test/agc-feature-finish-history.test.mjs`, `test/agc-adapters.test.mjs`, `test/e444-claude-local-adapter.test.mjs`, `test/e296-manifest-tier.test.mjs`, `test/e350-fanout-call-form.test.mjs`, `test/e433-test-first-rules.test.mjs`, `test/e453-served-text-v5.test.mjs`, `test/e391-prompt-audit-stale-facts.test.mjs`, `test/e178a-integrator-role.test.mjs`, `test/skill-evolution-v3.11.test.mjs`. `test/e395-claude-md-tail.test.mjs` and `test/e436-stale-handoff-paths.test.mjs` stay green because D10 adds no `tools/*.ts` and leaves `CLAUDE.md` alone.

**Readers that stay green if the constraints hold (not owned; named so the integrator can watch them):** `test/e425-stop-ticket-batch.test.mjs` (const-08 lines 4–5 verbatim and adjacent; lane-protocol line 112 suffix), `test/e383-lane-ledger-worktree.test.mjs` (lane-protocol §3 adjacency), `test/e408-core-task-alias-tail.test.mjs` (coord-03 Task-free; owned by e446), `test/e297-main-protected-sop.test.mjs` (`docs/<date>-<slug>` once in coord-03), `test/e438-origin-fenced-labels.test.mjs`, `test/e349-integrator-repo-facts.test.mjs` (Stage 1 step 3 is one line), `test/e196-ignored-lane-state.test.mjs`, `test/e298-finish-remote-delete.test.mjs`, `test/error-code-contract.test.mjs`, `test/lane-migrate.test.mjs` and `test/e123b9-lane-flip.test.mjs` (derive from `LANE_FILES`; `noFlatCounterpart` keeps the movable set unchanged), `test/agc-feature-lifecycle.test.mjs`, `test/e5-intake-tiering.test.mjs`, `test/cut-approval-gate.test.mjs`, `test/feature-lease.test.mjs`, `test/e16-judge-dispatch-charter.test.mjs`, `test/e18-write-provenance.test.mjs`, `test/e440-current-rule-wording.test.mjs`. If the full suite after T-E447-07 shows any of these red, it goes to the integrator under the same rule.

## Hop estimate

`hop_count` counts role transitions only (`tools/transitions.ts`: a write whose `agent_id` differs from the previous one; same-agent writes such as the coordinator's cut-approval write under `pm`, sr task-to-task writes and code-reviewer In_Progress → PASS carry it unchanged). Cap 14.

pm (first write) 1 → qa T-01 2 → sr T-02, T-03, T-06, T-04, T-07 (five sessions, one role) 3 → qa T-05 (planned return) 4 → sr hand-off 5 → code-reviewer (In_Progress, then PASS) 6 = **6 of 14**. Each code-reviewer FAIL round adds 2 (→ sr, → code-reviewer): one round → 8, two → 10. An architect hop would add 1 plus a second mailbox pre-review; still not taken (see No architect hop). The split adds sr sessions, not hops.

**[A1] Re-estimate after round 1.** Round 1 ended at `hop_count` 6 (code-reviewer FAIL). pm (this amendment) 7 → qa T-08 8 → sr T-09 9 → code-reviewer T-10 (In_Progress, then PASS) 10 = **10 of 14**. A second CHANGES_REQUESTED that goes straight to sr adds 2 (→ 12); one that needs pm again adds 4 (→ 14, at the cap). `review_round` goes to 2 of 4; `sr_return` stays 1 of 2 (qa → sr here is the forward edge, not a return).

## Out of Scope

- E446 (doc-writer close), the E443 launcher, E420 visual error codes.
- Any gate, gate error code, `GATE_REGISTRY` entry (33) or `UPDATE_STATE_GATE_PIPELINE` step (17); `tools/transitions.ts`, `tools/handoff-orchestrator.ts`, `gates/**`, `prompts/**`.
- `agc check` drift reporting for the `knowledge` key (advisory; not asked by the ticket).
- Eject code changes (D8: documentation only).
- Seeding or harvesting for a subdirectory workspace's lanes (lanes operate at the repo root today; init's rules are prefix-anchored, AC2 (f)).
- Any change with the mode off: every existing behaviour, output and test stays as at base.
- `scripts/fanout.mjs`, `tools/lane-ticket-allocation.ts`, `schema/**`, `CLAUDE.md` (owned but untouched under the recommended options).

## Dependencies / Prerequisites

- Human rulings R1–R4 (2026-11-23) as written in the ticket.
- Human ruling on O1, O2, O3 at cut approval (recommendations: (a), (a), (a)).
- **[A1]** Human consent to Amendment A1 (the new Copy rows kept verbatim, AC13–AC20, D11, the AC10 wording) and a ruling on O4 (recommendation (a)), before T-E447-08 starts.
- Integrator pre-review assigns `test/lane-paths.test.mjs` and `test/e410-task-alias-content-tail.test.mjs` to this lane (standing unowned-red rule).
- No design source: mode no-design. No external references (Resource Audit: zero hits).
- The `## Cut` row below names `test/lane-paths.test.mjs` and `test/e410-task-alias-content-tail.test.mjs`, which are outside the lane's owned set today: `check --cut` reports them OUT until the integrator's pre-review assigns them. It also reports the 12 `dist/tools/{config,lane-paths,fanout-manifest}.*` outputs OUT: the Lanes row's prose ("上列 `.ts` 對應的 `dist/**` 輸出") covers them, but the parser does not read `dist/**` as an owned token there. Run at cut time: exit 1 (`APPROVAL_HUMAN` plus those 14 OUT tokens).

## Cut

| id | desc | depends_on | est. files | touches | design-link |
|---|---|---|---|---|---|
| E447 | Opt-in local knowledge files: `agc init --knowledge=local` exclude rules, lane seed + hash record at start, `feature reseed`, record-filtered harvest and worktree numbering at finish, `check --cut` manifest byte comparison, three SOP texts and three docs | none | 33 | `bin/agc-init.mjs`、`tools/config.ts`、`tools/lane-paths.ts`、`tools/fanout-manifest.ts`、`dist/tools/config.js`、`dist/tools/config.js.map`、`dist/tools/config.d.ts`、`dist/tools/config.d.ts.map`、`dist/tools/lane-paths.js`、`dist/tools/lane-paths.js.map`、`dist/tools/lane-paths.d.ts`、`dist/tools/lane-paths.d.ts.map`、`dist/tools/fanout-manifest.js`、`dist/tools/fanout-manifest.js.map`、`dist/tools/fanout-manifest.d.ts`、`dist/tools/fanout-manifest.d.ts.map`、`content/const-08-chain-31-mid.md`、`content/coord-03-core-fallback.md`、`content/skill-integrator.md`、`docs/install.md`、`docs/config.md`、`docs/lane-protocol.md`、`test/fixtures/compose-golden/**`、`test/context-budget.test.mjs`、`test/e447-*.test.mjs`、`test/lane-paths.test.mjs`、`test/e410-task-alias-content-tail.test.mjs` | — |
