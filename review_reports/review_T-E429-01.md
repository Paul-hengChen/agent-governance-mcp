# Review — T-E429-01

covers: T-E429-01, T-E429-02

## Round 1 — CHANGES_REQUESTED — by code-reviewer

## Summary
- Diff `main..e8a34b0`: `bin/agc-init.mjs` (+39: a config-copy step at the end of `bootstrapLaneEnv`, plus 3 usage-text lines) and `docs/lane-protocol.md` (+1 bullet). The spec is the E429 row of `docs/backlog.md`. There is no `specs/` file.
- The copy runs only when all three hold: primary has `.current/.config.json`, the lane path is absent per `lstat`, and `git check-ignore` exits 0 in the lane. The third condition was not in the brief. I checked it against seven layouts in scratch repos (table under Correctness). All four acceptance lines hold.
- The copy is byte-only (`copyFileSync` + `COPYFILE_EXCL`). No config content reaches any log line.
- One required finding: the new comment block trips `agc check — comments` (8 lines, limit 7). It is the only comment warning in the repo; `main` at `df85028` reports none.
- Verdict: CHANGES_REQUESTED, for a comment trim only. The logic is approvable as written.

## AC Completeness
AC Completeness: SKIP — no specs/e429-lane-config-copy.md (backlog-row-as-spec mini-chain)

For the record, the E429 row's four acceptance lines checked by hand (pinning them is qa's job in T-E429-03):
- AC1 (local artifacts: identical file, and the output names the copy): met. Layout A below gives a byte-identical file, the stdout line `copied .current/.config.json from the primary checkout (a snapshot; ...)` and an empty lane `git status`. `bin/agc-init.mjs:1551-1562`.
- AC2 (tracked: checked-out file left as is, nothing copied): met. In layout D, primary's working copy differs from the commit; the lane keeps the committed bytes and prints no copy line. The `!lstatOrNull(laneConfig)` guard at `:1553` does this.
- AC3 (no primary config: no file, success): met. Layout E exits 0 and creates no file. The `fs.existsSync(primaryConfig)` short-circuit at `:1552` does this.
- AC4 (server `cutApprovalAutoTier` equals primary's): follows from AC1 because the copy is byte-identical. `loadConfig` reads `<workspace>/.current/.config.json`, and `resolveNodeModulesLinks` at `:1398` uses the same root-relative path, so the convention matches. Not run against `dist/tools/config.js` by me; T-E429-03 owns that.

## Correctness

### The check-ignore condition (the deviation from the brief)
I ran `node bin/agc-init.mjs feature start e1-x` in a fresh scratch repo per layout. `cutApprovalAutoTier` was set in primary every time.

| layout | primary config | lane result | output | lane `git status` |
|---|---|---|---|---|
| A: `/.current/` in shared `info/exclude` (what `agc init --artifacts=local` writes) | untracked, ignored | copied, identical | copy line | clean |
| B: `.current/` in a tracked `.gitignore` | untracked, ignored | copied, identical | copy line | clean |
| C: exclude covers `/.current/handoff.md` only | untracked, not ignored | absent | none | clean |
| D: config committed, primary working copy edited | tracked | committed bytes kept | none | clean |
| E: no config, `/.current/` excluded | none | absent | none | clean |
| F: `.gitignore` = `.current/*` + `!.current/.config.json`, config not yet committed | untracked, not ignored | absent | none | clean |
| G: tracked dangling symlink at the lane path | — | symlink kept, not followed or overwritten | none | clean |

On the brief's two questions:
- **Ignoring through a tracked `.gitignore` instead of the shared exclude (B):** handled. `check-ignore` reads the `.gitignore` that was checked out into the lane, so the copy happens.
- **An exclude rule that covers some `.current/` paths but not the config (C), or a whitelisted config not yet committed (F):** the copy is skipped with no notice, so the lane runs on defaults. That is the ticket's silent failure, limited to these layouts. I judge the silent skip **acceptable** for this ticket, and do not raise it as `required`:
  1. In both layouts primary's own `git status` already lists the config as untracked (`?? .current/`), so the state is visible in the primary checkout. That differs from the target case, where everything looks clean.
  2. Layout C contradicts what `agc init --artifacts=local` writes (`/.current/`). When the config declares `"artifacts": "local"`, `agc check` already reports `exclude rules are missing from .git/info/exclude` (`bin/agc-init.mjs:870-872`).
  3. Layout F is a tracked-config intent. There the lane gets what is committed on the base branch, which is AC2's rule ("checked-out config left as is"), the same outcome as D.
  4. Copying anyway in C/F would leave an untracked, unignored file in the lane, and `finish` would refuse to remove the worktree without `--force`. That is a worse failure, and the builder's reason for (c) holds. A notice in the else branch would change the exactly-pinned `out` / `err` arrays in `test/e291-start-link-locations.test.mjs` (e.g. `:151-152`, `:163-164`, `:187-188`, `:388`, `:398`), whose fixture is layout C/F.
  - `optional`: if the human later wants a fully non-silent path, add one stderr line when (a)+(b) hold and (c) fails, e.g. `agc feature start — note: the primary checkout's .current/.config.json is neither tracked nor git-ignored — not copied; the lane uses default settings` and update the e291 pins with it. This is not proposed as a ticket.

### Other paths
- EEXIST (`:1564`): only reachable through a race after the `lstat` check, so staying silent is correct (something else put a file there).
- Other errors become a warning and the bootstrap continues. This differs on purpose from the `.env` block, which rethrows (`:1535`). The worktree already exists at that point, so a warning beats a half-bootstrapped abort, and the inline comment says so. Fine.
- `lstatOrNull` versus a dangling symlink: correct choice. `fs.existsSync` would report false for a dangling link and then `COPYFILE_EXCL` would fail, while `lstat` sees the link and skips. Layout G confirms the tracked link is preserved.
- `optional`: `fs.mkdirSync(..., { recursive: true })` at `:1557` also throws `EEXIST` when the checkout has a regular file named `.current`. That `EEXIST` is swallowed by the same branch meant for the copy race, so the skip is silent. It is unrealistic (`.current` as a file), so this is not blocking.
- `gitTry` returns status 128 on a git fatal error; that counts as "not ignored" and skips the copy. It is conservative and right for a best-effort step.
- Ordering: the copy runs after `upsertSharedExclude` and before the `base-sha` write (`:1698-1701`). Both create `.current/` with `recursive: true`, so neither conflicts.
- `finish` handles only `.current/<ticket>/` and `.current/history/` (`:2017-2168`, `:2736+`). A root-level ignored `.current/.config.json` does not affect harvest or worktree removal, and every layout above leaves a clean lane status.
- No expected-red manifest is needed: the diff touches no test files and nothing points to intentional reds.

## Quality
- `required`: **comment block over the length limit.** `agc check` in the lane reports `bin/agc-init.mjs:1540 long-block 8 lines (limit 7)`. It is the only comment warning in the repo (`agc check` on `main` at `df85028` reports none), and this diff added it. Trim it to 7 lines or fewer. The sentence "A config the checkout produced (artifacts tracked in the repo) is the normal case, left as is with no output." repeats the `!lstatOrNull(laneConfig)` guard and can go; the WHY sentences (local artifacts mean no config in the lane; the ignore check avoids a dirty lane that blocks `finish`) should stay.
- The inner comment at `:1565-1566` is fine: it states the WHY of the warn-not-throw choice.
- Naming (`configRel`, `primaryConfig`, `laneConfig`) and the `out` / `warn` line shapes match the neighbouring `.env` block. The user-facing strings follow the `agc feature start — ...` convention.
- Usage text (`:997-999`): accurate against the code. It keeps the 10-space continuation indent and the surrounding line width.
- `optional`: `docs/lane-protocol.md:18` (the line just above the new bullet) still lists only worktree / node_modules / `.env` / exclude rules. The new bullet covers the config, so this is not wrong, only incomplete as a summary.

## Architecture
- No architecture spec. The change stays where the row puts it ("beside the existing dependency-link and environment-file steps") inside `bootstrapLaneEnv`. `tools/config.ts` / `loadConfig` are untouched, and nothing is back-filled into existing lanes, matching the row's Out of scope sentence.
- `LANE_EXCLUDE_RULES` is unchanged. The step relies on the existing `/.current/` artifact rule instead of adding a config-specific exclude, which avoids hiding an untracked config in primary.
- Doc bullet (`docs/lane-protocol.md`, the new line 19): accurate. It states both conditions (absent after checkout, and git ignores the path), says a tracked config is left alone, calls it a snapshot, and gives the manual `cp` with placeholders and no machine-specific path. No `content/**` change, so no compose golden or context-budget cap moves. `test/e177a-manifest.test.mjs:277-288` (no lane-protocol line over 20 chars in the rendered prompt) is unaffected, because the protocol doc is cited, not inlined; the suite was reported green.

## Security
- The copy uses `fs.copyFileSync`, so the content never becomes a JS string. The only interpolated value is `err.message` (paths and errno text), so no config content can reach stdout or stderr.
- `git check-ignore` runs through `execFileSync` with an argv array (`:1132-1139`) and a fixed literal pathspec after `--`, so there is no shell or injection surface.
- `COPYFILE_EXCL` together with the `lstat` guard means a file or symlink the checkout produced is never overwritten or followed.

## Performance
- Adds at most one `existsSync`, one `lstat` and one `git check-ignore` spawn per `feature start`. The cheap checks short-circuit before the spawn, so a repo without a primary config pays nothing beyond a stat. No hot path, no regression.

## Verdict
CHANGES_REQUESTED — the logic, the condition (c) deviation and the doc are sound and meet all four acceptance lines, but the new comment block is the repo's only `agc check — comments` warning and must be trimmed to 7 lines or fewer (Quality, `required`).

## Round 2 — APPROVED — by code-reviewer

covers: T-E429-01, T-E429-02

## Summary
- New commit `fa9f506` on top of `e8a34b0`: `bin/agc-init.mjs` only, 3 insertions and 5 deletions, all inside the config-copy comment block (`:1540-1545`).
- It fixes Round 1's one `required` finding. The block is now 6 lines and `agc check` exits 0 with no comment warning.
- Verdict: APPROVED.

## AC Completeness
AC Completeness: SKIP — no specs/e429-lane-config-copy.md (backlog-row-as-spec mini-chain)

The Round 1 per-line check of the E429 acceptance lines still holds; no behaviour changed (see Correctness).

## Correctness
- Comment-only, checked two ways. `git diff -w --ignore-blank-lines e8a34b0 fa9f506`, filtered to lines that are not `//` comments, prints nothing. `git diff --stat` shows one file, 8 lines.
- I re-ran the seven Round 1 scratch-repo layouts against `fa9f506`. Results match Round 1 exactly: A and B copied, D kept the committed version, C, E and F absent, G's symlink left alone.
- `node --test test/e291-start-link-locations.test.mjs test/agc-feature-lifecycle.test.mjs`: 91 tests, 91 pass, 0 fail. I accept the builder's choice not to re-run the full suite for a commit that changes no code: with no non-comment line changed, the last full run on `e8a34b0` (4182 / 0 failed / 2 skipped, builder-reported) still describes the same code.

## Quality
- The required finding is fixed. `node bin/agc-init.mjs check` exits 0 and prints no `agc check — comments` line.
- The shortened comment is accurate:
  - It keeps the WHY: with local artifacts the lane has no config, and the settings silently fall back to defaults.
  - It states the snapshot nature.
  - It keeps the reason for the ignore check: an unignored copy dirties `git status` and blocks `finish`.
  - The dropped sentence only restated the `!lstatOrNull(laneConfig)` guard.
  - "(the shared `/.current/` rule)" names the common case rather than the only one. A tracked `.gitignore` also passes the check (Round 1 layout B). That is accurate as an example and not misleading.

## Architecture
Unchanged since Round 1. No findings.

## Security
Unchanged since Round 1. No findings.

## Performance
Unchanged since Round 1. No findings.

## Verdict
APPROVED — the only Round 1 `required` finding is fixed by a verified comment-only change, the shortened comment is accurate, and the targeted suites and all seven layout checks still pass.
