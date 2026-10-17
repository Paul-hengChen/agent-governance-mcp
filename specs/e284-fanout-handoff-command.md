# e284-fanout-handoff-command

Lane `e284` of fan-out wave `specs/fanout-post-v4-w6.md` (post-v4 queue wave 6). Five tickets batched per the integrator manifest, all in the fan-out manifest tool, one review round and one QA round: **E284** (P2), **E331** (P3), **E330** (P3), **E332** (P3), **E333** (P3, qa-only). The scope is the manifest's e284 `範圍切線` cell (human-approved 2026-10-17); this spec writes it down and records the decisions the cell delegates to PM. It does not reopen the scope.

Function and line references were checked against the lane dispatch base (`902462e`) at cut time.

## Problem Statement

**E284**: Integrator revision §3.1 Q2–Q4 (`docs/integrator-revision-2026-10-08.md`) ruled that a closed wave always writes a `## 接手步驟` handoff, that a new session (接手 mode, E285) or a same-session "continue" re-checks it against the repo first, and that a tool fills in the fact items. E283 shipped the `validate` grammar for the section. Nothing generates it yet, and nothing compares a written handoff with the repo, so an integrator types the facts in by hand and the next session re-derives them by hand.
**E331**: `rangePaths` (`owners --range`) and `checkLane` (`check`) call `git diff <a>...<b>` without catching errors. When the two sides share no merge base, git fails, the CLI prints a stack trace and exits 1. Exit 1 means "hit" for `owners` and "out of bounds" for `check`, so the failure is reported as a result.
**E330**: The generic usage text (`USAGE`) does not list `owners`. `test/e296-manifest-tier.test.mjs` AC12 pins exactly three continuation lines, so lane e283 could not add it.
**E332**: The E283 absolute-path detector (`HANDOFF_ABSOLUTE_PATH_RE`) misses six forms: a path right after `**`, a path after an ASCII colon or comma, a path inside `|…|`, `file:///…`, `$HOME/…`, and UNC. It also flags a `~10/17`-style date.
**E333**: `test/e283-validate-handoff.test.mjs` spawns a CLI child per case and takes over two minutes.

## User Stories

- As an integrator closing or pausing a wave, I want one command that prints the `## 接手步驟` section with every repo fact already filled in, so that I only write the judgement items.
- As an integrator taking over in a new session, or continuing after a close, I want `handoff --check` to re-collect the same facts and name each one that changed, so that I never act on a stale handoff.
- As an integrator, I want `owners --range` and `check` to report a failed `git diff` as an input error with a named code, so that a missing merge base is never read as "owned" or "out of bounds".
- As a CLI user, I want the generic usage to list every subcommand.
- As an integrator, I want the handoff path check to catch the remaining absolute-path forms without flagging dates.
- As a qa-engineer, I want the E283 grammar tests to run in-process, so that the suite stays fast.

## Decisions (delegated to PM by the manifest)

### D1: E284 module and interface

- New module `tools/fanout-handoff.ts`, built to `dist/tools/fanout-handoff.*`. It imports `parseManifest`, `resolvePrimary`, `resolveMailboxHeader`, `HANDOFF_SECTION`, `HANDOFF_SUBITEMS` and friends from `tools/fanout-manifest.ts`, and `computeLaneStatus` / `parseMailboxHeaders` from `tools/lane-status.ts`. No manifest logic goes into `tools/lane-status.ts` (e177b AC1 structural check). `tools/` cannot import `scripts/mailbox-watch.mjs` (dist layout), so the module re-derives two things from that script. A parity test pins each against the script's own export. The two are the watch-lock file name (`watchLockPath`: `.<basename>.watch-lock` beside the file) and the re-arm command shape (`formatRearmCommand`, without its `re-arm with: ` prefix). Planned new exports in `tools/lane-status.ts` / `scripts/mailbox-watch.mjs`: none.
- `scripts/fanout.mjs` routes `handoff` to `runHandoff` in `dist/tools/fanout-handoff.js`. The wrapper stays a thin shell.
- **Interface:** `node scripts/fanout.mjs handoff [--check] <manifest> [--target <branch>] [--repo <dir>] [--mailbox-root <dir>] [--closing]`. `--check` is recognised only as the first argument after `handoff`, the same convention as `check --cut`. `--closing` is valid only without `--check` (R2).
  - `--target`: default `main`.
  - `--repo`: default = the git repo that holds the manifest, the same default as `check` / `owners`. Primary = `resolvePrimary(--repo)`.
  - `--mailbox-root`: default = the manifest's `mailbox:` header resolved against primary (`resolveMailboxHeader`). If neither is present, the mailbox facts are not collected and stderr gets the note `handoff.note.no-mailbox`. That note does not change the exit code.
- **Output (generate):** the section goes to stdout. The command never writes in place: like every other `fanout.mjs` subcommand it is read-only. It runs no `git fetch` and writes no file or ref. The integrator pastes the section into the manifest and fills in the placeholders.
- **Exit codes (generate):**
  - 0 = section printed.
  - 2 = any of: usage error; unreadable manifest; manifest error of scope `lanes` / `row` (the `owners` rule: a dropped row could be a lane whose facts would be missed); `REPO_NOT_GIT`; `REF_NOT_FOUND` for `--target`; `MAILBOX_TILDE`; `HANDOFF_GIT_FAILED` (a git command for a required fact failed: named, first stderr line only, no stack trace).
  - Generate never exits 1.
- **Exit codes (`--check`):**
  - 0 = every fact agrees. `MOVED` lines (R1) are allowed.
  - 1 = at least one `DIFF` line.
  - 2 = any generate-side exit-2 cause, plus any of: the manifest has no or several `## 接手步驟` sections (`HANDOFF_SECTION_ABSENT` / `HANDOFF_SECTION_DUPLICATE`, the E283 codes reused); a fact key appears on more than one line (`HANDOFF_FACT_DUPLICATE`).

### D2: E284 section format (the contract shared by generate, `--check` and `validate`)

Generated text, in this order. Placeholders are `<待填：…>`. Every fact line is `- <key>：<value>` with a fullwidth colon:

```
## 接手步驟
（事實欄位由 `node scripts/fanout.mjs handoff` 產生；接手時先跑 `node scripts/fanout.mjs handoff --check <manifest>`。`<待填：…>` 由整合者填寫。）
### 核對 primary
- 目標分支：<target> @ <sha7>
- 目標分支對 origin：<relation>
- git status：<status>
- worktree：<worktrees>
- lane-status：<rows>
### 已結案
- <待填：本波次結果、lane 紀錄位置、未配號的新發現>
### 待人類決定
- <待填：下一波要不要開、待裁定的題目、整合者的建議>
### 進行中的背景工作
<background fact lines, or the single line 無>
```

Fact values. Every value is deterministic for a given repo state. No absolute path is ever written: paths are relative to primary with `/` separators, and a path that cannot be made relative is written as `<非相對路徑>`.

| key | sub-item | value |
|---|---|---|
| `目標分支` | 核對 primary | `<target> @ <first 7 hex of the full sha>` |
| `目標分支對 origin` | 核對 primary | `一致` / `本機領先 <n>` / `本機落後 <n>` / `分岔（本機 +<a>／origin +<b>）` / `origin/<target> 不存在`. Compared with the local `origin/<target>` ref as last fetched; no fetch. |
| `git status` | 核對 primary | `乾淨`, or `<n> 項：<porcelain v1 line>；…` in git's order, from `git status --porcelain` in primary. **The manifest file itself is excluded**: pasting the section always dirties it. |
| `worktree` | 核對 primary | `git worktree list --porcelain` order, `；`-joined: `primary（<branch>）` first, then `<relative path>（<branch>）`; detached = `（detached @ <sha7>）`; a worktree whose branch is not a dispatchable lane branch of this manifest gets the suffix ` ［別的清單］`. |
| `lane-status` | 核對 primary | From `computeLaneStatus({ repoRoot: primary, baseRef: <target> })`. Only the primary row and rows whose branch equals a dispatchable lane's `branch` cell of this manifest are included; other sessions' lanes show only in `worktree` (integrator revision §3.2: watch only your own manifest's lanes). Each row is `<primary or lane id>（<branch>）<active_feature>／<status>／<last_agent>，hop <n>，commits <n>，<clean or dirty>`, with `-` for null. An unreadable row is `<lane>（<branch>）unreadable`, and its reason (which can hold a path) is never echoed. Rows are `；`-joined in lane-status order. |
| `整合分支` | 背景工作 | Present only when the manifest's `integration branch:` header (base line) names a branch that exists locally: `<branch> @ <sha7>（origin 有）` or `（origin 無）`. Omitted under `--closing` (R2). |
| `未 push 的 commit` | 背景工作 | For each existing local branch among {target, integration branch, each dispatchable lane branch}: `<branch> <n>` with `n = git rev-list --count <branch> --not --remotes` and n > 0, `；`-joined in that order. Present only when one or more branches qualify. Under `--closing` the integration branch is skipped (R2). |
| `信箱` | 背景工作 | For each dispatchable lane whose `<mailbox-root>/<lane>/` directory exists: `<lane> to-integrator <n>／to-lane <n>`, where n is the message count (`parseMailboxHeaders(...).length`) and a missing file shows as `-`. Present only when one or more such directories exist. |
| `watch baseline` | 背景工作 | Present only when one or more `to-integrator.md` exist: `node scripts/mailbox-watch.mjs <relative to-integrator.md paths> --baseline <N or lane=N,…>`, the same shape as `formatRearmCommand` (run from primary). |
| `監看` | 背景工作 | Present only when a watch-lock exists beside a manifest lane's `to-integrator.md` / `to-lane.md`: `<lane>/<file>`, `、`-joined. |

**Primary on the integration branch under `--closing` (R2).** This rule applies only when `--closing` is given and primary's current branch is the manifest's integration branch. Primary's branch is then written as the closing annotation `<target> ← <integ> @ <sha7>`, where `<sha7>` is primary's HEAD at generation time:
- in the `worktree` fact, as `primary（<target> ← <integ> @ <sha7>）`;
- in the `lane-status` primary row, as `primary（<target> ← <integ> @ <sha7>）…`, with `commits 0`. That is the post-merge expectation; it is checked, not trusted.

Every other primary fact (active_feature / status / last_agent / hop / clean or dirty) is written as collected. Without `--closing`, or when primary is on any other branch, primary's facts are a plain snapshot.

`### 進行中的背景工作` is exactly the single line `無` when no background key is present. Otherwise it holds the background fact lines in table order. The tool never writes `無` over a live fact.

`--check` behaviour:

1. Read the manifest's single `## 接手步驟` section.
2. Take every line in it of the form `- <key>：<value>` whose key is one of the ten keys above. The fact's sub-item position is not enforced.
3. If the `### 進行中的背景工作` sub-item reads `無` (the E283 `readsNone` rule), treat every background key as absent in the handoff.
4. Re-collect the facts with the same flags and compare key by key (absent equals absent).
5. Print a `DIFF` line for each differing key (absent on one side is written `（缺）`). Print `MOVED` instead in two cases:
   - the `目標分支` forward move (R1);
   - a closing annotation (R2) on `worktree` or `lane-status`, when all three hold:
     - primary is now on `<target>`;
     - the annotated `<sha7>` resolves to a commit that is an ancestor of (or equal to) the current `<target>`, i.e. the wave PR merged;
     - the line, with the annotation replaced by `<target>`, equals the re-collected line.

     The `MOVED` line says `（<integ> @ <sha7> 已合併進 <target>）`. If any of the three fails (PR not merged, sha unknown, primary elsewhere, or another part of the line changed), the result is a `DIFF`.

   This check needs the sha, not the branch name, so it still works after the integration branch is deleted.
6. Print the summary line. Placeholders and other lines are ignored.

### D3: E331 error code

The `git diff` call in `rangePaths` and the main `git diff` call in `checkLane` are wrapped. On failure: exit 2 with `GIT_DIFF_FAILED` (a CLI code: its suffix is outside the gate vocabulary of `test/error-code-contract.test.mjs`, the same as `FANOUT_CODES`). The message names the range and git's first stderr line, and no stack trace is printed. `checkLane`'s ls-tree / added-files probe already degrades to a note and is unchanged. Every other `owners` / `check` exit code is unchanged.

### D4: E330 usage

`USAGE` gains two continuation lines after `check --cut`:

- the owners form: `OWNERS_USAGE` without its `usage: ` prefix, indented 7 spaces;
- the handoff form from D1.

`OWNERS_USAGE` stays as it is and is still printed on owners usage errors. In the `scripts/fanout.mjs` header comment:

- the line `owners is not in the generic usage text yet (E322)` is removed;
- the handoff form is added;
- the exit-code line names `handoff --check` under exit 1.

`test/e296-manifest-tier.test.mjs` AC12 is re-pinned from 3 to 5 continuation lines. That is the only change to that file. `test/e322-owners.test.mjs` AC-E322-9 is re-pinned to "generic usage lists owners".

### D5: E332 boundary and form rules

`HANDOFF_ABSOLUTE_PATH_RE` (or a small function, if a regex gets unreadable) changes as follows.

**Boundaries.** The existing set stays: line start, whitespace, `` ` `` `'` `"` `(` `[` `（` `「` `：` `，` `、` `=`. Added:
- ASCII `:`
- ASCII `,`
- `|`
- `**`, but only when that `**` itself sits at a boundary (bold opener). `tools/**/a/b` stays a non-hit.

**Forms.** The existing forms stay, with the tilde form narrowed:
- (a) Windows drive.
- (b) Tilde: `~/` or `~<name>/` with `<name>` = `[A-Za-z_][A-Za-z0-9._-]*`. This excludes `~10/17`.
- (c) POSIX path with at least two segments.

Added:
- (d) `file:///`.
- (e) `$HOME/` and `${HOME}/`.
- (f) UNC `\\<host>\<share>`. The forward-slash `//host/share` stays a non-hit, because it is indistinguishable from a protocol-relative URL.

**Unchanged.** URLs (`https://…`), with `:` now a boundary: `//` is not a POSIX hit, since its first segment is empty. The message never echoes the path. One error per line.

### D6: E333

QA-only. Grammar cases (AC-E283-1..8, 10, and the AC-E283-11 sweep) call `validateManifest` / `isManifestClosed` in-process from `dist/tools/fanout-manifest.js`. CLI spawns are kept only where the AC is about the CLI itself, at most 6:
- exit 0 + `fanout: ok` stdout;
- exit 2 + `fanout: error: <CODE>:` stderr format;
- the absolute path not echoed on stderr;
- AC-E283-9 `render` / `check` / `check --cut` / `owners` behaviour.

## Acceptance Criteria

All fixtures are in-test manifests, repos and mailboxes under `$TMPDIR`: no assertion on the growing content of real `specs/fanout-*.md`, no diff against a fixed sha, no local path literal in tests or evidence.

### E284: `handoff` and `handoff --check`

- **AC-E284-1**: Given a temp repo with:
  - primary on `main` = `origin/main`, clean;
  - an in-test manifest (status `人類核准 …`) with two dispatchable lanes whose worktrees exist under a sibling lanes dir;
  - a `mailbox:` header pointing to a mailbox dir holding `<lane>/to-integrator.md` with 2 messages and `to-lane.md` with 1;

  when `handoff <manifest>` runs, then it exits 0, prints to stdout exactly the D2 skeleton with these facts filled in:
  - `目標分支：main @ <sha7>`, `目標分支對 origin：一致`, `git status：乾淨`;
  - `worktree` with relative lane paths;
  - `lane-status` rows for primary and both lanes;
  - `信箱` with `to-integrator 2／to-lane 1`;
  - `watch baseline` = the `formatRearmCommand` shape;
  - `未 push 的 commit` naming the lane branches;

  and the two judgement placeholders, and stdout contains no substring equal to the temp root path.
  proof: `test/e284-fanout-handoff.test.mjs` case "generate fills facts".
- **AC-E284-2**: Given the same manifest with its status changed to the canonical `**狀態：已結案 2026-10-17。**`, plus repo facts with no background (no lane worktrees/branches, no mailbox dirs, no integration branch, nothing unpushed, no watch-lock), when the generated section is appended to it, then `validate` exits 0. Given background facts exist, `### 進行中的背景工作` lists them and `validate` on the closed manifest reports `HANDOFF_BACKGROUND_NOT_NONE`: the tool never writes 無 over a live fact. In both cases, `validate` on the non-closed manifest with the section appended exits 0.
  proof: `test/e284-fanout-handoff.test.mjs` case "skeleton passes validate".
- **AC-E284-3**: The relation values: given local `main` ahead of, behind, or diverged from `origin/main`, or no `origin/main` ref, then `目標分支對 origin` reads `本機領先 <n>` / `本機落後 <n>` / `分岔（本機 +<a>／origin +<b>）` / `origin/main 不存在`. Given `--target integ/x`, the facts use that branch. An unresolvable `--target` exits 2 `REF_NOT_FOUND`.
  proof: `test/e284-fanout-handoff.test.mjs` case "target relation".
- **AC-E284-4**: The `git status` line lists porcelain entries of primary and excludes the manifest file. A worktree on a branch that is not a lane of this manifest gets `［別的清單］` in `worktree` and has no `lane-status` row. A watch-lock file (named as `watchLockPath` from `scripts/mailbox-watch.mjs` names it) beside a lane's `to-integrator.md` produces the `監看` line.
  proof: `test/e284-fanout-handoff.test.mjs` case "status, foreign worktrees, watch-lock".
- **AC-E284-5** (R2): Given an existing local integration branch named by the manifest's `integration branch:` header, then `整合分支` and its `未 push 的 commit` entry appear, and under `--closing` both are omitted. Given primary checked out on that integration branch, then:
  - without `--closing`, the `worktree` / `lane-status` primary entries name the integration branch (plain snapshot);
  - with `--closing`, they read `primary（main ← <integ> @ <sha7>）`, and the primary row has `commits 0`.

  `--closing` with primary on `main` changes nothing but the two omissions. `--closing` together with `--check` is a usage error (exit 2).
  proof: `test/e284-fanout-handoff.test.mjs` case "integration branch and --closing".
- **AC-E284-6**: Given a manifest whose section was just generated and pasted, with the repo unchanged, when `handoff --check <manifest>` runs, then it exits 0 and prints only the summary line `fanout handoff --check: <n> fact(s) checked, 0 differ, 0 moved`. Judgement text edited by hand (placeholders replaced, extra prose lines) does not affect the result.
  proof: `test/e284-fanout-handoff.test.mjs` case "check clean".
- **AC-E284-7**: Given the pasted section, then each of these changes produces one `DIFF  <key>: handoff「<old>」／repo「<new>」` line naming the key, and exit 1:
  - a new mailbox message;
  - a lane hop advance;
  - a new uncommitted file in primary;
  - a new worktree;
  - `origin/main` moving ahead;
  - a background fact appearing when the handoff says `無`;
  - a fact line deleted from the handoff (`（缺）` on the handoff side).

  Several changes give several lines.
  proof: `test/e284-fanout-handoff.test.mjs` case "check names each difference".
- **AC-E284-8** (R1): Given the handoff's `目標分支` sha is a strict ancestor of the current target, then `--check` prints `MOVED  目標分支: handoff「…」／repo「…」（前進 <n> 個 commit）`. With no other difference it exits 0. Given the recorded sha is not an ancestor (or unknown), it is a `DIFF` with exit 1.
  proof: `test/e284-fanout-handoff.test.mjs` case "target moved forward".
- **AC-E284-12** (R2 closure round trip): Given a temp repo where:
  - primary is on the manifest's integration branch, with commits ahead of `main` and `origin/main`;
  - no lane worktrees, mailbox dirs or watch-locks exist;

  when `handoff --closing` runs and its section is pasted into the closed manifest and committed, then `validate` exits 0. When the integration branch is then merged into `main` (`--no-ff`), `origin/main` is updated to it, primary switches to `main`, and the integration branch is deleted, `handoff --check` exits 0, prints `MOVED` lines for `目標分支`, `worktree` and `lane-status`, and prints no `DIFF`. Given the same handoff with the merge not done (primary switched to `main` but the integration branch not merged), or with the primary row's `status` changed, the affected line is a `DIFF` with exit 1.
  proof: `test/e284-fanout-handoff.test.mjs` case "closing round trip".
- **AC-E284-9**: Given:
  - no `## 接手步驟` section, then `--check` exits 2 with `HANDOFF_SECTION_ABSENT`;
  - two sections, then it exits 2 with `HANDOFF_SECTION_DUPLICATE`;
  - two `- git status：…` lines, then it exits 2 with `HANDOFF_FACT_DUPLICATE`.

  Given a Lanes row error, unreadable manifest, `--repo` outside git, or bad flags, then both modes exit 2 with `fanout: error: <CODE>:` and no stack trace (`    at ` never appears on stderr).
  proof: `test/e284-fanout-handoff.test.mjs` case "errors".
- **AC-E284-10**: Both modes are read-only: the manifest, the mailbox files, `git rev-parse HEAD`, `git status --porcelain`, `git branch --list`, and `git for-each-ref refs/remotes` of the temp repo are unchanged after each run. Given neither a `mailbox:` header nor `--mailbox-root`, then no mailbox/watch fact is collected, stderr has the `handoff.note.no-mailbox` note, and the exit code is unaffected.
  proof: `test/e284-fanout-handoff.test.mjs` case "read-only and no mailbox".
- **AC-E284-11** (parity): The module's watch-lock name and its `watch baseline` command equal what `watchLockPath` / `formatRearmCommand` (minus the `re-arm with: ` prefix) from `scripts/mailbox-watch.mjs` produce for the same inputs, for one file and for several.
  proof: `test/e284-fanout-handoff.test.mjs` case "mailbox-watch parity".

### E331: `git diff` failure is a named exit 2

- **AC-E331-1**: Given a temp repo with two branches that share no merge base (an orphan branch), when `owners <m> --range a...b --repo <repo>` runs, then it exits 2, stderr has `fanout: error: GIT_DIFF_FAILED:` naming the range, and no stack-trace line (`/^\s+at /m`).
  proof: `test/e331-git-diff-failure.test.mjs` case "owners range without merge base".
- **AC-E331-2**: Given a manifest lane whose branch shares no merge base with `--base`, when `check <m> <lane> --base <b> --repo <repo>` runs, then the result is the same as AC-E331-1: exit 2, `GIT_DIFF_FAILED`, no stack trace.
  proof: `test/e331-git-diff-failure.test.mjs` case "check without merge base".
- **AC-E331-3** (hard condition): `owners` exit 0 / 1 / 2 and `check` exit 0 / 1 / 2 on every other path are unchanged. `test/e322-owners.test.mjs`, `test/e177a-check-cli.test.mjs` and `test/e178b-fanout-unmatched.test.mjs` pass with no edit other than the AC-E322-9 usage re-pin (D4).
  proof: `node --test test/e322-owners.test.mjs test/e177a-check-cli.test.mjs test/e178b-fanout-unmatched.test.mjs`.

### E330: generic usage lists `owners` (and `handoff`)

- **AC-E330-1**: Given no subcommand or an unknown one, then exit 2 and the usage has exactly 5 lines starting `       node scripts/fanout.mjs`. One of them is the owners form and one is the handoff form (Copy `usage.*`). The `check --cut` line is still present exactly once. `OWNERS_USAGE` is still printed on owners usage errors. The `scripts/fanout.mjs` header comment lists the owners and handoff forms and no longer says owners is missing from the generic usage.
  proof: `test/e296-manifest-tier.test.mjs` AC12 (re-pinned 3 → 5; no other e296 change) and `test/e322-owners.test.mjs` AC-E322-9 (re-pinned).

### E332: absolute-path boundaries and date shape

- **AC-E332-1**: Given a closed in-test manifest whose handoff section has one line each containing:
  - `**/Users/x/y**`
  - `path:/home/user/r`
  - `a,/srv/a/b`
  - `| /opt/a/b |` and `|/opt/a/b|`
  - `file:///Users/x/y`
  - `$HOME/lanes/e1` and `${HOME}/lanes/e1`
  - `\\server\share\x`

  then `validateManifest` reports one `HANDOFF_ABSOLUTE_PATH` per line, naming its line number, and no message contains the path.
  proof: `test/e332-absolute-path-boundaries.test.mjs` case "new boundaries and forms".
- **AC-E332-2**: Given lines with:
  - `~10/17`, `（~10/17）`, `約 ~10/17 完成`
  - `tools/**/a/b`
  - `https://github.com/a/b`, `|https://x.y/a/b|`
  - `10:30`, `a,b/c/d`, `|origin/main|`
  - `../lanes/e1`, `/teamwork`, `//cdn.example/a/b`

  then no `HANDOFF_ABSOLUTE_PATH`. The AC-E283-5 hit and non-hit sets are unchanged.
  proof: `test/e332-absolute-path-boundaries.test.mjs` case "non-hits"; `node --test test/e283-validate-handoff.test.mjs`.
- **AC-E332-3** (hard condition): For every `specs/fanout-*.md` at lane HEAD that exists at the dispatch base, the `validate` exit code and error-code set equal the dispatch-base result: all exit 0 except `fanout-wave5.1.md` and `fanout-wave6.md` (exit 2, `{DECISIONS_SECTION_ABSENT, PINS_SECTION_ABSENT}`). If a closed manifest is newly blocked, that is a real finding: report it to the mailbox and do not edit the test.
  proof: qa ad-hoc sweep recorded in the qa report (`for f in specs/fanout-*.md; do node scripts/fanout.mjs validate "$f"; echo "$f exit=$?"; done`, codes collected from stderr) compared with this list; plus `node --test test/e296-manifest-tier.test.mjs test/e235b-relative-worktree.test.mjs`.

### E333: in-process grammar tests

- **AC-E333-1**: Given `test/e283-validate-handoff.test.mjs` after the change, then:
  - every AC-E283-1..11 case still exists and asserts the same codes;
  - grammar cases call `validateManifest` / `isManifestClosed` in-process;
  - at most 6 CLI child processes are spawned (D6);
  - the file's wall time measured before and after on the same machine is recorded in the qa report, and after is at most a quarter of before.

  proof: `grep -c "spawnSync" test/e283-validate-handoff.test.mjs` plus the qa-report timing pair (`time node --test test/e283-validate-handoff.test.mjs` on the dispatch-base file and the lane file).

### Lane-wide hard conditions

- **AC-HC-1**: `render` output is byte-identical between a `dist/` built from the dispatch base and lane HEAD, for every dispatchable lane of every `specs/fanout-*.md`.
  proof: qa ad-hoc comparison recorded in the qa report (base tree extracted and built under `$TMPDIR`, same `--summary` / `--reading` / `--primary` / `--base` arguments on both sides); not a resident test.
- **AC-HC-2**: `tools/lane-status.ts`, `scripts/mailbox-watch.mjs` and `dist/tools/lane-status.*` are unchanged (no new exports were needed, D1). If the implementation does need an export, then only exports are added, and the `scripts/lane-status.mjs` and `scripts/mailbox-watch.mjs` outputs exercised by `test/e177b-*.test.mjs` / `test/e178b-lane-watch.test.mjs` stay byte-identical (those tests pass unedited). No non-comment line of `tools/lane-status.ts` mentions a manifest (e177b AC1 structural).
  proof: `git diff --stat origin/main...HEAD -- tools/lane-status.ts scripts/mailbox-watch.mjs dist/tools/lane-status.js` is empty, or `node --test test/e177b-lane-status.test.mjs test/e177b-mailbox-watch.test.mjs test/e178b-lane-watch.test.mjs` passes unedited.
- **AC-HC-3**: The full suite is green on the final HEAD under `node scripts/test-lock.mjs -- npm test`, run after commit with no untracked files. `test/e178a-integrator-role.test.mjs` (reads `tools/fanout-manifest.ts`; not owned) passes unedited.
  proof: `node scripts/test-lock.mjs -- npm test` summary line recorded in the qa report.

## Copy / Strings

| string id | exact text (quote verbatim) | source |
|---|---|---|
| usage.owners | `       node scripts/fanout.mjs owners <manifest> (--range <a>...<b> [--repo <dir>] \| --paths <file\|->)` | existing OWNERS_USAGE text (E322), indented as a USAGE continuation line (D4) |
| usage.handoff | `       node scripts/fanout.mjs handoff [--check] <manifest> [--target <branch>] [--repo <dir>] [--mailbox-root <dir>] [--closing]` | authored-here: D1 interface |
| handoff.intro | `（事實欄位由 \`node scripts/fanout.mjs handoff\` 產生；接手時先跑 \`node scripts/fanout.mjs handoff --check <manifest>\`。\`<待填：…>\` 由整合者填寫。）` | authored-here: tells the reader which lines are facts |
| handoff.placeholder.closed | `- <待填：本波次結果、lane 紀錄位置、未配號的新發現>` | integrator-session-per-wave §5 P2 sub-item table (已結案 row) |
| handoff.placeholder.decide | `- <待填：下一波要不要開、待裁定的題目、整合者的建議>` | integrator-session-per-wave §5 P2 sub-item table (待人類決定 row) |
| handoff.fact.* | the ten keys and value shapes in the D2 table, verbatim | authored-here: D2 (fact items listed by the manifest e284 `範圍切線` cell) |
| handoff.background.none | `無` | E283 HANDOFF_NONE |
| handoff.check.diff | `DIFF  <key>: handoff「<old>」／repo「<new>」` (absent side = `（缺）`) | authored-here: two-space separator like check's `OUT` lines |
| handoff.check.moved | `MOVED  <key>: handoff「<old>」／repo「<new>」（前進 <n> 個 commit）` | authored-here: R1 |
| handoff.check.moved-closing | `MOVED  <key>: handoff「<old>」／repo「<new>」（<integ> @ <sha7> 已合併進 <target>）` | authored-here: R2 |
| handoff.closing.annotation | `<target> ← <integ> @ <sha7>` | authored-here: R2 primary closing annotation |
| handoff.check.summary | `fanout handoff --check: <n> fact(s) checked, <d> differ, <m> moved` | authored-here: mirrors `fanout check:` / `fanout owners:` summaries |
| handoff.note.no-mailbox | `note: no mailbox root (no mailbox: header and no --mailbox-root) — mailbox facts not collected.` | authored-here |
| handoff.err.fact-duplicate | `HANDOFF_FACT_DUPLICATE: fact "<key>" appears on <n> lines (lines <l>, …) of "## 接手步驟"` | authored-here: CLI code, outside the gate-suffix vocabulary |
| handoff.err.git | `HANDOFF_GIT_FAILED: git <subcommand> failed for fact "<key>": <first stderr line>` | authored-here |
| diff.err | `GIT_DIFF_FAILED: git diff <a>...<b> failed in <repo>: <first stderr line>` | authored-here: E331 (D3) |
| handoff.err.reused | `HANDOFF_SECTION_ABSENT`, `HANDOFF_SECTION_DUPLICATE`, `REPO_NOT_GIT`, `REF_NOT_FOUND`, `MAILBOX_TILDE`, `MANIFEST_UNREADABLE`, `USAGE` | existing codes |

## Visual Tokens

| token id | property | value (quote verbatim) | source |
|---|---|---|---|
| N/A | — | — | feature has no visual literals |

## Visual Widgets

| widget id | description | source-node |
|---|---|---|
| N/A | — | feature has no non-primitive widgets |

## Out of Scope

- `content/skill-integrator.md`. The SOP citing `handoff` / `handoff --check`, the 接手 mode, and when in Stage 6 the closure handoff is generated are all E285.
- E289 (render supplement files), E294 (prompt template line), E314, E315.
- In-place writing of the section into the manifest (D1: stdout only).
- `git fetch` inside `handoff` (the origin relation is as of the last fetch).
- A `validate` rule for unfilled `<待填：…>` placeholders.
- lane-status `--watch` fingerprint baselines (`lane-status` rows are the fact; the mailbox-watch baseline is the watch baseline).
- Any change to `parseManifest`, `render`, or the `validate` grammar other than D5.
- `docs/**`, `specs/fanout-*.md`, `CHANGELOG.md`, version bump, backlog done-marks (integrator / release-engineer).

## Dependencies / Prerequisites

- Resource Audit: no external references (only in-repo docs and specs are cited); `external_refs` omitted.
- Routing: pm → sr-engineer → code-reviewer → qa-engineer. sr works T-E331-01 → T-E332-01 → T-E330-01 → T-E284-01 → T-E284-02 serially, because they share `tools/fanout-manifest.ts` / `scripts/fanout.mjs`. qa then does all tests including T-E333-01, in one review round and one QA round. **No architect hop**: there is one new module, which consumes existing exports from two modules; there is no new persisted data model and no cross-cutting API, and the only cross-module contract (the section text) is fully specified in D2. Dispatch pin `sr-engineer=opus` (manifest).
- New and changed test files are qa-only (Constitution §2).
- `cutApprovalAutoTier.manifest` is off for this wave (manifest 派工前核對), so the human approves this cut in the lane session after the integrator's pre-review.
- Visual Structural Assertions omitted: no `design/<feature>.md`, mode = no-design.

## Gate Summary

| gate | result |
|---|---|
| Scope Decision | single-feature (five tickets batched by the approved manifest; not design-armed) |
| Parallel-Lane Cut | serial: shared layer (all sr tasks touch `tools/fanout-manifest.ts` and/or `scripts/fanout.mjs`) |
| Resource Audit | zero external refs |
| Ambiguity | none blocking; the two interpretation points are R1 and R2 below |
| Manifest tier | not eligible: `cutApprovalAutoTier.manifest` off this wave |

**needs human ruling**

- **R1: Does `--check` tolerate the target branch moving forward?** The scope says `--check` exits non-zero on any mismatch. A closure handoff is committed inside the wave PR (the wave-5 pattern), so in the next session `main` always sits past the recorded sha.
  - (a) **Recommended**: a recorded sha that is a strict ancestor of the current target prints `MOVED` and does not by itself fail (exit 0). A non-ancestor is a `DIFF` (exit 1).
  - (b) Strict: any sha change is a `DIFF` (exit 1), so every post-merge `--check` fails on this line.
- **R2: What goes in `### 進行中的背景工作` at closure?** The integrator-session-per-wave P2 table puts the watch, the integration branch and unpushed commits there, and validate requires 無 once closed. The wave-5 closure writes the handoff on the integration branch before the PR, while that branch still exists unpushed. The generator would then list it, and a closed manifest would fail `validate` with `HANDOFF_BACKGROUND_NOT_NONE`.
  The same timing also affects `### 核對 primary`: at closure primary stands on the integration branch. The `worktree` primary entry and the `lane-status` primary row (branch, and commits counted against target) would therefore always `DIFF` once the next session runs `--check` on `main` after the merge (integrator pre-review).
  - (a) **Recommended**: snapshot faithfully by default, plus `--closing`, which does two things:
    - omits the integration branch and its unpushed count (the wave PR closes them);
    - writes primary's branch as the annotation `<target> ← <integ> @ <sha7>`, with the primary row at `commits 0`.

    `--check` reports an annotated line as `MOVED` (exit 0) only when primary is now on target, the annotated sha is an ancestor of target (the PR merged), and the rest of the line is unchanged. Anything else is a `DIFF`. This is verifiable from the sha alone after the integration branch is deleted. A mid-wave pause (no `--closing`) stays a plain snapshot. Primary-row active_feature / status changes (e.g. a later release) stay a `DIFF`.
  - (b) No flag: background and primary always reflect the live repo. Closure handoffs are then generated only after the wave PR merges and primary is back on `main`, which E285 must schedule and which needs a second PR on protected `main`.
  - (c) `--closing` writes primary directly in its predicted post-merge state (`primary（<target>）`, `commits 0`) with no annotation. The diff is simpler, but `--check` cannot tell whether the merge actually happened (an unmerged integration branch reads the same once primary switches back), so the prediction is never verified.
  - (d) `--check`-side only (no annotation): `MOVED` when primary changed from the integration branch to target and that branch is merged into target. The merge order deletes the integration branch after the merge, so the merged-ness check would have to fall back to the sha, which the plain snapshot does not record in a parseable form. This is (a) without the explicit marker.

## Cut

| id | desc | depends_on | est. files | touches | design-link |
|---|---|---|---|---|---|
| T-E331-01 | sr: wrap the `git diff` in `rangePaths` and `checkLane` → exit 2 `GIT_DIFF_FAILED`, no stack trace (D3); rebuild dist. qa: new test (AC-E331-1..3) | none | 5 | `tools/fanout-manifest.ts`、`dist/tools/fanout-manifest.*`、`test/e331-git-diff-failure.test.mjs` | — |
| T-E332-01 | sr: widen the handoff absolute-path boundaries and forms, narrow the tilde form to exclude dates (D5); rebuild dist. qa: new fixture test + hard-condition validate sweep (AC-E332-1..3) | T-E331-01 | 5 | `tools/fanout-manifest.ts`、`dist/tools/fanout-manifest.*`、`test/e332-absolute-path-boundaries.test.mjs` | — |
| T-E330-01 | sr: `USAGE` gains the owners and handoff continuation lines; wrapper header comment updated (D4); rebuild dist. qa: re-pin e296 AC12 (3 → 5, AC12 only) and AC-E322-9 (AC-E330-1) | T-E332-01 | 7 | `tools/fanout-manifest.ts`、`dist/tools/fanout-manifest.*`、`scripts/fanout.mjs`、`test/e296-manifest-tier.test.mjs`、`test/e322-owners.test.mjs` | — |
| T-E284-01 | sr: new `tools/fanout-handoff.ts`: fact collection + D2 section rendering, `--closing` (omissions + primary closing annotation, R2), flags, generate exit codes; `handoff` route in `scripts/fanout.mjs`; build dist. qa: new test (AC-E284-1..5, 10, 11) | T-E330-01 | 6 | `tools/fanout-handoff.ts`、`dist/tools/fanout-handoff.*`、`scripts/fanout.mjs`、`test/e284-fanout-handoff.test.mjs` | — |
| T-E284-02 | sr: `handoff --check`: parse fact lines, background-無 rule, key-by-key compare, `DIFF` / `MOVED` lines (R1 target move, R2 closing annotation with the merged-sha check), summary, exit 0 / 1 / 2, `HANDOFF_FACT_DUPLICATE` (D1, D2); rebuild dist. qa: extend the E284 test (AC-E284-6..9, 12) + lane-wide hard conditions (AC-HC-1..3) | T-E284-01 | 5 | `tools/fanout-handoff.ts`、`dist/tools/fanout-handoff.*`、`test/e284-fanout-handoff.test.mjs` | — |
| T-E333-01 | qa: convert the E283 grammar cases to in-process `validateManifest`, keep ≤ 6 CLI cases, record before/after timing (D6, AC-E333-1) | T-E332-01 | 1 | `test/e283-validate-handoff.test.mjs` | — |
