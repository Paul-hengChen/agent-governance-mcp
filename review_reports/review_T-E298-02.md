# Review — T-E298-02

covers: T-E298-02

## Round 1 — APPROVED — by code-reviewer

## Summary
- Commit 6ea2f89, `bin/agc-init.mjs` only (+66/-10): `git()`/`gitTry()` take an optional `env` merged over `process.env`. New `deleteRemoteLaneBranch(repoRoot, branch)` is called once, right after the existing `deleted branch` stdout line in the `--shipped` block. The `finish` usage paragraph gains one clause.
- Scope: backlog row E298 item (5) plus the lane e298 manifest row ("no remote branch / no remote / offline: silent no-op plus one hint line, never a failure"). `--abandoned` is untouched; `dist/` is unchanged (`git diff --stat 6b8a195..HEAD` lists only the two in-scope files).
- I reproduced every path myself in throwaway repos under `$TMPDIR`, each with a bare repo as origin. All exit 0 with the exact line the AC calls for (see Correctness).
- The five existing finish test files pass: 117/117, 0 fail.
- Clean-context note: `tw_get_state` returned the sr-engineer's pending_notes and the dispatch pointed at them. The verdict below rests on the diff, the spec rows and my own reproductions, not on those claims.
- Verdict: APPROVED.

## AC Completeness
AC Completeness: SKIP — no specs/e298-ci-triggers-finish-remote-delete.md (backlog-row-as-spec mini-chain)

Checked against the dispatch-supplied cut anyway:
- AC3 — implemented — `bin/agc-init.mjs:2927` (called only after `git branch -d` succeeded, since the refusal path throws first), `:2793-2795` (argv array `["push","origin","--delete",branch]`, `GIT_TERMINAL_PROMPT: "0"`), `:2808` (one stdout line). Reproduced: origin branch gone, `refs/remotes/origin/<branch>` pruned by git, exit 0.
- AC4 — implemented — `:2770-2781`; no `origin` gives one stderr hint and a return, with no push spawned. Reproduced: exit 0, local branch deleted.
- AC5 — implemented — `:2783-2791`, `show-ref --verify --quiet refs/remotes/origin/<branch>`, a local-only check. Reproduced with the origin URL repointed at a nonexistent path: exit 0, AC5 hint, no failure. So no network access happens on that path.
- AC6 — implemented — `:2796-2806`; the first non-empty trimmed stderr line goes into the hint, falling back to `git push exited <n>`; no retry, no `--force`, no FeatureError. Reproduced two ways: (a) the remote branch was already deleted on origin (stale tracking ref), giving `error: unable to delete '<branch>': remote ref does not exist`; (b) an unreachable origin URL, giving `fatal: '...' does not appear to be a git repository`. Both exit 0.
- AC7 — implemented — the `--abandoned` block is not in the diff. On the `--shipped` path every earlier line and throw is unchanged (the hunk adds one call after the last pre-existing write). `deleteRemoteLaneBranch` receives only `branch`, never `base`. No `ls-remote` anywhere in the diff.
- Usage clause — implemented — `:1021-1022`. The paragraph was re-wrapped with wording otherwise kept; no test pins the old wrap (the five suites pass).
- Files — exactly `.github/workflows/ci.yml` and `bin/agc-init.mjs` across both commits; `dist/` unchanged.

## Correctness
No required findings. Adversarial checks, all passing:
- **Throw / exit-code surface.** Every git call in the helper goes through `gitTry`, which turns any numeric non-zero exit into a value. It rethrows only on a spawn failure (git missing, or a child killed by signal so `status` is null). That exposure already existed: the `git branch -d` call one line earlier (`:2918`) uses the same `gitTry`, and the whole `--shipped` path runs git many times before reaching it. No new throw.
- **`git remote` parsing** (`:2771-2776`): exact line match after trim, so remotes like `origin2` or `my-origin` do not count as `origin`. A failing `git remote` (non-zero) counts as "no origin", which gives the benign AC4 hint.
- **Remote named `origin` vs a different tracking namespace.** Reproduced: lane pushed via a second remote `upstream` (same URL) with `origin` present. Only `refs/remotes/upstream/<branch>` exists, so the result is the AC5 hint and exit 0, with no wrong-remote push. A tracking ref that is stale under `origin` reaches the push and fails into the AC6 hint, also exit 0.
- **Env merge preserves existing behaviour.** When `env` is omitted, the spread adds no `env` key, so `execFileSync` inherits `process.env` exactly as before. A grep of every `git(`/`gitTry(` call site shows the push at `:2793` is the only one passing a third argument.
- **`GIT_TERMINAL_PROMPT=0` really reaches the push.** Verified with a `pre-push` hook (via `core.hooksPath`) in the scratch repo, which recorded `GIT_TERMINAL_PROMPT=0` and the update line `(delete) 0000... refs/heads/feat/e901-demo` — exactly the branch name, nothing else.
- **Leading-dash / refspec injection.** `branch` comes from `refs/heads/` in `git worktree list` (`:2864`) and is filtered by `resolveCurrentLane(...) === ticketId`. That filter requires the `feat/` prefix (`tools/lane-paths.ts:232`, `:266`), so `branch` always starts with `feat/` and can never be parsed as an option. A refname cannot contain `:`, so it cannot form a src:dst refspec either. Passed as a single argv element, with no shell.
- **Ordering.** Worktree removed, then mailbox teardown, then `git branch -d`, then remote delete (`:2915-2927`). The remote branch is deleted only after every local step succeeded. If `branch -d` refuses, the throw at `:2921` skips the remote delete, which is correct because an unmerged-locally branch should not lose its remote copy.

## Quality
- recommended — `:2767-2768` says the push "can never stall on a credential prompt". `GIT_TERMINAL_PROMPT=0` covers git's own HTTPS username/password prompt, not SSH passphrase or host-key prompts, which ssh reads from `/dev/tty`. `execFileSync` has no timeout either. Suggest softening the comment to "never stalls on git's own credential prompt", or, as an optional follow-up, adding `-o BatchMode=yes` through `GIT_SSH_COMMAND` only when the user has not set one. Not blocking: the AC requires only `GIT_TERMINAL_PROMPT=0`, and it is applied.
- optional — The AC5 hint says "<branch> was never pushed to origin". When the lane was pushed through a different remote name (the scenario above), the wording is slightly inaccurate, though the parenthetical "(no remote-tracking ref)" states the real test. Wording is pinned by the cut; no change asked.
- optional — After an AC6 failure caused by a stale tracking ref, `refs/remotes/origin/<branch>` stays behind. A `git fetch --prune` hint could be added, but the existing "delete it by hand if it still exists" is enough.
- Comment check (§6, step 4b): the new comments say WHAT/WHY, contain no absolute paths and no secrets. The `(E298)` tag follows the file's existing convention of ticket and AC tags in comments (`E246:`, `AC17/AC19`, `E214`), so it is kept. "lane" is the domain noun of the `agc feature` command itself, not governance jargon leaking into unrelated code.

## Architecture
No architecture spec for this feature. The helper sits beside the other finish-phase helpers and reuses `gitTry`; it adds no new git wrapper. It is a tool-internal op, sanctioned by invoking the tool (backlog row, Constitution §6); no grant change.

## Security
No findings. argv array, no shell; the branch name is constrained to `feat/...` (see Correctness); `--delete` with a bare branch name only, no `--force`, no `+` refspec; no credentials handled or logged. The hint echoes git's own stderr line, which can carry the remote URL. That matches what `git push` itself would print to the same terminal, so nothing new is disclosed.
- optional — The delete push runs the repo's `pre-push` hook, as any `git push` does. In a repo with a heavy pre-push hook (for example husky running the test suite), finish waits for it, and a failing hook ends in the AC6 hint. Not a defect under AC6; `--no-verify` would be a policy choice outside this cut.

## Performance
No findings. At most three extra git spawns (`remote`, `show-ref`, `push`) once per finish. The only network step is the push, and only when a tracking ref exists. No loops, no hot path.

## Verdict
APPROVED — AC3–AC7 and the usage clause are implemented and independently reproduced, with exit 0 on every path; there are no `required` findings, only one `recommended` comment-accuracy note and some optional notes.
