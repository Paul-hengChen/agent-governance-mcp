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
- **AC10 (acceptance f)** — Given the mode is off (key absent or `"repo"`), then `agc init` writes no knowledge rule, `feature start` copies no knowledge file and writes no seed record, `finish` behaves byte-for-byte as before (same stdout/stderr on the existing fixtures), `check --cut` runs no git command and reads no extra file; and the full suite at the base (4789 pass / 2 skipped / 0 fail, 4791 tests) stays green apart from the re-pins listed under Test impact.
  proof: `node scripts/test-lock.mjs -- npm test` on the final commit; plus `node --test test/e447-*.test.mjs` — test `AC10`.
- **AC11 (Fix 6)** — Given the composed prompts, then the constitution carries `C-C08K` once, directly after the Batch-lane line, on both design arms and not in lite; coord-03's bookkeeping line ends with `C-CO3K`; skill-integrator Stage 1 step 3 ends with `C-IN-R4`; no new line in those three files cites a repo-only path or a bare ticket id, carries a backticked gate error code, or (coord-03) contains `Task`.
  proof: `node --test test/e447-*.test.mjs` — test `AC11`.
- **AC12 (docs)** — Given the shipped docs, then `docs/config.md` has exactly one `knowledge` section (`DOC-CFG`), `docs/install.md` carries `DOC-INST-*`, and `docs/lane-protocol.md` carries `DOC-LP-1..3` at the placements named in Copy / Strings, with every pre-existing line byte-unchanged.
  proof: `node --test test/e447-*.test.mjs` — test `AC12`.

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
| e447.reseed-not-knowledge | stderr `agc feature reseed: <rel> is not under a knowledge path of this workspace — nothing changed` (exit 2) | authored-here |
| e447.reseed-not-lane | stderr `agc feature reseed: run it inside a lane worktree of a workspace whose .current/.config.json sets "knowledge": "local"` (exit 1) | authored-here |
| e447.finish-harvest | `agc feature finish — harvested knowledge file <rel> -> primary <rel> (fs copy, not committed — the lane created or changed it)` (`--abandoned`: `-> primary <dir>/abandoned/<lane>/<path>`) | authored-here — Fix (3), D6 |
| e447.finish-unchanged | `agc feature finish — <n> seeded knowledge file(s) unchanged in the lane — not copied back` (printed only when n > 0) | authored-here — Fix (3) |
| (reused) e180.evidence-harvest-refuse-line | stderr `agc feature finish <verb>: harvest destination already exists in the primary checkout and differs (nothing moved):\n  <path>` | existing string — ticket Fix (3) "the existing refuse-on-differing-content rule" |
| e447.finish-numbered | `agc feature finish — appended <ids> to docs/backlog.md in the primary checkout (not committed — knowledge files stay out of git)` (followed by the existing `applied <n> pending ticket(s)` line) | authored-here — Fix (4) |
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

Order: T-E447-01 → 02 (A1) → 03 (A2a) → 06 (A2b) → 04 (B1) → 07 (B2) → 05 (planned qa return). Ids 06 and 07 were added at the integrator's pre-review split; 03, 04 and 05 keep their ids with amended descriptions and `depends_on`.

`task_size` (≤ 5 files / ≤ 300 lines per sr task):

| task | files | line estimate |
|---|---|---|
| A1 (02) | `tools/config.ts`, `tools/lane-paths.ts`, `bin/agc-init.mjs` (+ `dist/`) | ~120 (config key ~20, `LANE_FILES` entry + path field ~10, init flag/rules/refusals/tracked report/usage ~90) |
| A2 as one task | `bin/agc-init.mjs` | ~400 — over the cap, so split: |
| A2a (03) | `bin/agc-init.mjs` | ~185 (seed walk + `check-ignore` batch + copy + record write ~95; `feature reseed` args, lane/mode checks, hash check, copy, record update ~75; usage + subcommand text ~15) |
| A2b (06) | `bin/agc-init.mjs` | ~220 (record-filtered classification + same-path / abandoned destinations + refusal in the harvest plan ~110; `--abandoned` wiring ~35; worktree numbering into the primary backlog + skipping the "not allocated" warning ~60; usage ~15) |
| B1 (04) | `tools/fanout-manifest.ts` (+ `dist/`), `content/const-08-chain-31-mid.md`, `content/coord-03-core-fallback.md`, `content/skill-integrator.md` | ~60 (comparison + code ~45; three text items 3 lines) |
| B2 (07) | `docs/config.md`, `docs/install.md`, `docs/lane-protocol.md` | ~70 (config section ~30, install subsections/bullets ~35, lane-protocol 3 lines) |

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

**Readers that stay green if the constraints above hold (owned; listed by the manifest or the probe):** `test/e106-init-artifacts-flag.test.mjs`, `test/e239-init-subdir-exclude.test.mjs`, `test/e108-eject.test.mjs`, `test/e351-lane-protocol-gaps.test.mjs`, `test/e429-lane-config-copy.test.mjs`, `test/e213-shipped-ignored-shape.test.mjs`, `test/e217-abandoned-specs-harvest.test.mjs`, `test/e180-abandoned-harvest.test.mjs`, `test/e335-symlinked-pending-harvest.test.mjs`, `test/e385-worktree-evidence.test.mjs`, `test/agc-feature-finish-history.test.mjs`, `test/agc-adapters.test.mjs`, `test/e444-claude-local-adapter.test.mjs`, `test/e296-manifest-tier.test.mjs`, `test/e350-fanout-call-form.test.mjs`, `test/e433-test-first-rules.test.mjs`, `test/e453-served-text-v5.test.mjs`, `test/e391-prompt-audit-stale-facts.test.mjs`, `test/e178a-integrator-role.test.mjs`, `test/skill-evolution-v3.11.test.mjs`. `test/e395-claude-md-tail.test.mjs` and `test/e436-stale-handoff-paths.test.mjs` stay green because D10 adds no `tools/*.ts` and leaves `CLAUDE.md` alone.

**Readers that stay green if the constraints hold (not owned; named so the integrator can watch them):** `test/e425-stop-ticket-batch.test.mjs` (const-08 lines 4–5 verbatim and adjacent; lane-protocol line 112 suffix), `test/e383-lane-ledger-worktree.test.mjs` (lane-protocol §3 adjacency), `test/e408-core-task-alias-tail.test.mjs` (coord-03 Task-free; owned by e446), `test/e297-main-protected-sop.test.mjs` (`docs/<date>-<slug>` once in coord-03), `test/e438-origin-fenced-labels.test.mjs`, `test/e349-integrator-repo-facts.test.mjs` (Stage 1 step 3 is one line), `test/e196-ignored-lane-state.test.mjs`, `test/e298-finish-remote-delete.test.mjs`, `test/error-code-contract.test.mjs`, `test/lane-migrate.test.mjs` and `test/e123b9-lane-flip.test.mjs` (derive from `LANE_FILES`; `noFlatCounterpart` keeps the movable set unchanged), `test/agc-feature-lifecycle.test.mjs`, `test/e5-intake-tiering.test.mjs`, `test/cut-approval-gate.test.mjs`, `test/feature-lease.test.mjs`, `test/e16-judge-dispatch-charter.test.mjs`, `test/e18-write-provenance.test.mjs`, `test/e440-current-rule-wording.test.mjs`. If the full suite after T-E447-07 shows any of these red, it goes to the integrator under the same rule.

## Hop estimate

`hop_count` counts role transitions only (`tools/transitions.ts`: a write whose `agent_id` differs from the previous one; same-agent writes such as the coordinator's cut-approval write under `pm`, sr task-to-task writes and code-reviewer In_Progress → PASS carry it unchanged). Cap 14.

pm (first write) 1 → qa T-01 2 → sr T-02, T-03, T-06, T-04, T-07 (five sessions, one role) 3 → qa T-05 (planned return) 4 → sr hand-off 5 → code-reviewer (In_Progress, then PASS) 6 = **6 of 14**. Each code-reviewer FAIL round adds 2 (→ sr, → code-reviewer): one round → 8, two → 10. An architect hop would add 1 plus a second mailbox pre-review; still not taken (see No architect hop). The split adds sr sessions, not hops.

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
- Integrator pre-review assigns `test/lane-paths.test.mjs` and `test/e410-task-alias-content-tail.test.mjs` to this lane (standing unowned-red rule).
- No design source: mode no-design. No external references (Resource Audit: zero hits).
- The `## Cut` row below names `test/lane-paths.test.mjs` and `test/e410-task-alias-content-tail.test.mjs`, which are outside the lane's owned set today: `check --cut` reports them OUT until the integrator's pre-review assigns them. It also reports the 12 `dist/tools/{config,lane-paths,fanout-manifest}.*` outputs OUT: the Lanes row's prose ("上列 `.ts` 對應的 `dist/**` 輸出") covers them, but the parser does not read `dist/**` as an owned token there. Run at cut time: exit 1 (`APPROVAL_HUMAN` plus those 14 OUT tokens).

## Cut

| id | desc | depends_on | est. files | touches | design-link |
|---|---|---|---|---|---|
| E447 | Opt-in local knowledge files: `agc init --knowledge=local` exclude rules, lane seed + hash record at start, `feature reseed`, record-filtered harvest and worktree numbering at finish, `check --cut` manifest byte comparison, three SOP texts and three docs | none | 33 | `bin/agc-init.mjs`、`tools/config.ts`、`tools/lane-paths.ts`、`tools/fanout-manifest.ts`、`dist/tools/config.js`、`dist/tools/config.js.map`、`dist/tools/config.d.ts`、`dist/tools/config.d.ts.map`、`dist/tools/lane-paths.js`、`dist/tools/lane-paths.js.map`、`dist/tools/lane-paths.d.ts`、`dist/tools/lane-paths.d.ts.map`、`dist/tools/fanout-manifest.js`、`dist/tools/fanout-manifest.js.map`、`dist/tools/fanout-manifest.d.ts`、`dist/tools/fanout-manifest.d.ts.map`、`content/const-08-chain-31-mid.md`、`content/coord-03-core-fallback.md`、`content/skill-integrator.md`、`docs/install.md`、`docs/config.md`、`docs/lane-protocol.md`、`test/fixtures/compose-golden/**`、`test/context-budget.test.mjs`、`test/e447-*.test.mjs`、`test/lane-paths.test.mjs`、`test/e410-task-alias-content-tail.test.mjs` | — |
