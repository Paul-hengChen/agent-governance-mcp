# Review — T-E246-01

## Round 1 — APPROVED — by code-reviewer

## Summary
- Reviewed commit 8b2afd3 (`git diff 015b44c..8b2afd3`) against `specs/e246-mailbox-teardown.md` AC1–AC12 and its Copy / Strings table. There is no architecture spec for this feature.
- Change: `agc feature finish` removes `<dirname(lanePath)>/_mailbox/<lane>/` right after a successful `removeWorktreeNoForce`, in both `--shipped` and `--abandoned`. Only whitelisted regular files are allowed, and a watch-lock with a live holder keeps the folder. The usage text, the integrator SOP (stage 3 pt 3, stage 6 step 3) and `docs/lane-protocol.md` §5 were updated to match.
- Scope: only owned paths were touched (`bin/agc-init.mjs`, `content/skill-integrator.md`, `docs/lane-protocol.md`, `specs/e246-*`, `.current/e246/**`). `dist/`, `scripts/`, `tools/` and the other `content/**` files are unchanged.
- Independence disclosure: `tw_get_state` returns sr's `pending_notes`, so the reviewer saw them. The verdict below rests on the diff and the spec. Same-model bias: sr ran on fable and this review on opus, so the models differ.
- Verdict: APPROVED. No required findings.

## AC Completeness
AC1 — implemented — bin/agc-init.mjs:3232 (call after the removed-worktree line in `--shipped`). Delete at :2250 (`fs.rmSync`), success line at :2255. The test proof is qa-owned.
AC2 — implemented — bin/agc-init.mjs:3276 (call after the removed-worktree line in `--abandoned`; the branch is still kept).
AC3 — implemented — bin/agc-init.mjs:2204-2224 (`mailboxKeepReason`: `^\..+\.watch-lock$` sidecars are parsed and a dead pid passes). `isMailboxPidAlive` is at :2190.
AC4 — implemented — :2208 (a non-regular entry, which covers subdirectories and symlinks via `lstat`) and :2210 (a name not on the whitelist) return `unknown entry <name>`. One stderr line comes from `keep()` at :2235, and there is no throw, so the exit status is unchanged.
AC5 — implemented — :2222 gives `watch-lock <name> held by live pid <pid>`. Non-JSON input, a non-object, or a non-integer `pid` gives `unparseable watch-lock <name>` (:2213-2219).
AC6 — implemented — :2240: an `ENOENT` with the dir truly absent returns silently. The path is always `_mailbox/<ticketId>`, and `ticketId` is validated as a bare ticket id (:3148-3150), so a sibling cannot be addressed.
AC7 — implemented — see the ordering reading under Correctness. `--shipped`: :3230 `removeWorktreeNoForce`, then :3231 the removed-worktree line, then :3232 `removeLaneMailbox`, then :3233 `git branch -d`. A refused worktree removal throws `FeatureError` at :2177, so the mailbox call is never reached.
AC8 — implemented — `agc feature finish — removed mailbox ${dir}` (:2255). `dir` is built from the same `lanePath` value the worktree line prints, so the path form matches.
AC9 — implemented — bin/agc-init.mjs:1323-1326. This is the copy-table `usage.finish-mailbox` text wrapped in the existing layout, and it contains `_mailbox/<lane>/`.
AC10 — implemented — content/skill-integrator.md:88 (`sop.stage3`, verbatim, appended) and :161 (`sop.stage6` verbatim, `sop.stage6-watch` split into two appended sentences with fragments `stop the mailbox watch`, `by hand`). Existing text is byte-identical; only sentences were appended to the end of each item. `node --test test/e178a-integrator-role.test.mjs test/skill-frontmatter.test.mjs`: 27 pass, 0 fail, 1 skip.
AC11 — implemented — docs/lane-protocol.md:64 (`lane-protocol.mailbox`, verbatim).
AC12 — implemented — `git diff --stat 015b44c..8b2afd3` lists only owned paths. The test and qa paths are qa's to add.

## Correctness
- **AC7 ordering (the reviewer's reading is the ordering evidence; qa may be unable to build a real `branch -d` refusal fixture).**
  (a) `--shipped` (bin/agc-init.mjs:3230-3240): `removeWorktreeNoForce(repoRoot, lanePath)` runs first. When it returns, the removed-worktree line is printed. Then `removeLaneMailbox(lanePath, ticketId)` runs, and only after that does `gitTry(... "branch", "-d" ...)` run. A `branch -d` refusal throws after the mailbox is already gone, and the exit code is unchanged because that throw site was not edited.
  (b) Refused worktree removal: `removeWorktreeNoForce` (:2170-2181) throws `FeatureError` whenever `git worktree remove` exits non-zero. Both call sites invoke it on the line before `removeLaneMailbox` with no try/catch, so a refusal can never reach the mailbox step, in either path.
  (c) No throw path in `removeLaneMailbox` (:2232-2256). The only fs calls that can throw are the `lstatSync`, `readdirSync` and `readFileSync` inside `mailboxKeepReason`, which run under try/catch at :2238, and `fs.rmSync`, which runs under try/catch at :2249. `fs.existsSync` never throws. `path.join` works on validated strings. `keep()` and the success line are plain `process.stdout` / `process.stderr` writes. The `String(err)` fallback handles non-Error throws. A mailbox problem therefore cannot turn a successful finish into a failure.
  (d) `--abandoned` (:3274-3276): the same pattern. The worktree is removed, the line is printed, then the mailbox step runs and the kept-branch line follows.
- **Delete safety / TOCTOU.** The target is `path.join(path.dirname(lanePath), "_mailbox", ticketId)`. `ticketId` must satisfy `resolveLaneName(raw) === raw.toLowerCase()` (the ticket-id regex), so it cannot be empty, `.`, `..` or contain a separator, and the `_mailbox/` parent can never be the target. The dir itself is checked with `lstat` and must be a real directory (:2206), and every entry must be a regular file by `lstat` (:2208). `fs.rmSync` never follows symlinks. On Node v22 I checked that `rmSync(recursive)` on a dir holding a symlink, and on a symlink-to-dir, removes only the link and leaves the target intact. So even if an entry or the dir is swapped for a symlink between the check and the delete, nothing outside `_mailbox/<lane>/` can be removed. The worst case in that window is losing a file newly written into this lane's own mailbox after its worktree is gone. The spec accepts that, since the lane is dead at that point.
- `pid <= 0` counts as dead (:2191). This matters: `process.kill(0|-n, 0)` would probe a process group and could report "alive" wrongly. The guard is correct.
- An `ENOENT` raised mid-scan while the dir still exists (an entry vanished) is reported as `unreadable (ENOENT)` and the folder is kept, not silently skipped. That is conservative and correct.
- optional — If the `_mailbox` parent is itself a symlink, it is followed, because only `_mailbox/<lane>` is `lstat`-checked. That matches the spec, which only checks `_mailbox/<lane>`, and deletion stays confined to `<that target>/<lane>/`. No action needed.

## Quality
- The three extra kept-mailbox reasons (`not a plain directory`, `unreadable (<code>)`, `delete failed (<code>)`) are acceptable. Each covers a case the spec names without giving a string: "If `_mailbox/<lane>` itself is a symlink or not a directory: keep, warn" and "any fs error during deletion is downgraded to the `kept mailbox` warning". All three keep the fixed `kept mailbox <path>: <reason>` prefix, so the fragments the tests assert on are preserved.
- A mailbox-watch `.<lock>.stale-<pid>-<ts>` aside file counts as an unknown entry, which is acceptable. It follows the spec's strict whitelist (`^\..+\.watch-lock$`). The aside file is transient: `scripts/mailbox-watch.mjs:334-345` renames and then unlinks it at once, so it survives only a crash inside that window, and keeping the folder with a warning is the safe outcome.
- `sop.stage6-watch` is reworded ("Before running finish for the lanes, stop the mailbox watch (TaskStop, or let it expire), since …") and split around `sop.stage6`. The spec allows sr to adjust wording, and every asserted fragment is present.
- Comment discipline (constitution §6). The new comments state WHAT or WHY in at most 3 lines each (:2184, :2188-2189, :2201-2203, :2227-2230, the inline WHY at :3232). `agc check — comments` gives two warnings for this diff, both kept:
  - `bin/agc-init.mjs high-ratio 30.2%`: kept. The file was already over the limit at base (by my arithmetic about 30.4% before this diff), and this diff lowers the ratio. Trimming existing comments is E260's job, not this lane's.
  - `bin/agc-init.mjs:2 long-block 41 lines`: kept. The diff adds one net line to an entry in the existing subcommand index header, which was already over 7 lines at base. Rewriting the header is out of scope (E260).
- Information hygiene: no absolute local paths in added lines (grep of `/Users/`, `/private/`, `/home/` in the diff returned none).

## Architecture
There is no `specs/e246-mailbox-teardown-architecture.md`. The code follows the PM Design Decisions: the path is derived from `lanePath` (no manifest read), inspection uses `lstat` against a whitelist, the liveness check is duplicated in `bin/` rather than imported from `scripts/`, `rmSync` runs only after every entry passes, and the `_mailbox/` root is never removed. The helpers sit next to `removeWorktreeNoForce`, which fits the existing section layout of `bin/agc-init.mjs`.

## Security
No findings. The only caller-derived path segment is `ticketId`, which is validated as a bare ticket id. Deletion cannot escape `_mailbox/<lane>/` and cannot follow symlinks (see Correctness). Reading watch-lock JSON is read-only and parse-guarded. `process.kill(pid, 0)` sends no signal and is gated to integers above 0. No secrets, no shell, no new input boundary.

## Performance
No findings. There is one `readdir` and at most a few `lstat` / `read` calls over a folder that normally holds 2 to 4 entries, run once per finish. The hot path is unchanged.

## Verdict
APPROVED — AC1–AC12 are implemented within the owned file bounds. The AC7 ordering was verified by reading the diff (mailbox step after a successful worktree removal, before `branch -d`, unreachable on a refused removal, never throws), and deletion is confined to `_mailbox/<lane>/` without following symlinks.
