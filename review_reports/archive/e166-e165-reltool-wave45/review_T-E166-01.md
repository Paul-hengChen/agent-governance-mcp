# Review — T-E166-01 (batched with T-E165-01)

covers: T-E166-01, T-E165-01

## Round 1 — APPROVED — by code-reviewer

Base: HEAD `af0dd77`, uncommitted worktree diff in `<lanes-root>/e166-e165`. Spec: handoff `scope_decision_why` (human-approved cut) and `docs/backlog.md` rows E166 and E165. There is no specs/ file or architecture spec, because this is a mini-chain.

## Summary
- T-E166-01: `templates/claude-code-agents/release-engineer.md:11` no longer carries its own 19-path staging list. It now defers to SOP step 8a "Stage explicitly" (with the existence pre-filter) and to 8a "Pre-commit verify".
- T-E165-01: `scripts/verify-release.mjs` `evaluateCIGroundTruth` gains `deriveCIBranch()`. It tries the upstream `@{u}` with the remote prefix stripped, then falls back to the current branch. A detached HEAD goes to `warn()`. `--workflow CI` is kept, and the messages name the derived branch or upstream.
- Non-negotiable AC (1), E166 defers and does not restate: MET. The template names no staging path. Both named anchors exist in `content/skill-release-engineer.md` under exactly those names: `**Stage explicitly**` (line 202) and `**Pre-commit verify (AC2)**` (line 216), both inside step 8a (line 201).
- Non-negotiable AC (2), E165 keeps `--workflow CI`: MET (`scripts/verify-release.mjs` listCompletedRuns argv, verified by gh-shim argv capture).
- Verdict: APPROVED. There are no blocking findings, and I left 3 non-blocking advisories below.

## Correctness
Branch derivation: I checked it empirically in a scratch fixture repo. The fixture ran a copy of the diffed script with `--ci-check`, `AGC_VERIFY_CI_WAIT_SECONDS=0`, and a `gh` shim on PATH that records argv.

| scenario | `--branch` passed to gh | message label | exit |
|---|---|---|---|
| `main`, no upstream | `main` | `main` | 0 (WARN) |
| `main` → `origin/main` | `main` | `origin/main` | 0 (WARN) |
| `release/3.x` → `origin/release/3.x` (branch contains `/`) | `release/3.x` | `origin/release/3.x` | 0 (WARN) |
| `hot/fix` → remote named `up/stream` (remote AND branch contain `/`) | `hot/fix` | `up/stream/hot/fix` | 0 (WARN) |
| `loc` → local `main` (`.` remote) | `main` | `main` | 0 (WARN) |
| detached HEAD, lenient | gh NOT called | WARN on stdout, stderr empty | 0 |
| detached HEAD, `--strict` | gh NOT called | FAIL on stderr | 1 |
| `release/3.x`, matched sha `success`, `--strict` | `release/3.x` | OK / CI-CHECK PASSED | 0 |
| `release/3.x`, matched sha `failure`, `--strict` | `release/3.x` | `FAIL: ... on release/3.x concluded "failure"` | 1 |

- `@{u}` prefix strip (`scripts/verify-release.mjs` deriveCIBranch): the code uses `branch.<cur>.remote` together with `startsWith(remote + "/")`. That handles remote names that contain `/`, which a naive first-slash split would get wrong. The first-slash fallback runs only when no remote is configured but an upstream still resolves, which is effectively unreachable. That is acceptable.
- `.` remote: `abbrev-ref @{u}` already returns the bare local name, and the code handles this correctly.
- Detached HEAD: this reaches `warn()` before any gh call, so strict gives FAIL and lenient gives a WARN on stdout, as the cut requires.
- `git()` pipes stderr (`EXEC_OPTS.stdio` = pipe). So the expected `fatal: no upstream configured` from `rev-parse @{u}` and the exit-1 from `git config --get` never reach the script's stderr. The VR-8 "passing run prints nothing on stderr" contract is preserved, and I verified it: stderr was empty in every lenient scenario above.
- Check 6's E147 sha resolution (`runCheck("CI ground-truth", ...)`: tag-first `rev-parse --verify` + `rev-list -n 1`, HEAD fallback) sits outside every diff hunk and is byte-unchanged. The lenient `warn()` still uses `console.log` (stdout) and strict still pushes onto `fails` (stderr). Both are unchanged.
- Existing suites: `node --test test/verify-release.test.mjs test/release-staging.test.mjs` gave 126 pass, 0 fail. This includes the release-staging AC5 template-hint contract, which the new template sentence still satisfies.
- Expected-red sampling (SOP 4a): the diff touches no test files. The only known reds are `test/check-md-tables.test.mjs` AC7/CQ-9. They are pre-existing at base, come from `specs/e123a-lane-layout-migration.md:280`, and are logged as L-RELTOOL-NEW-3. They are not intentional reds of this feature, so no manifest is required.

Non-blocking advisory A1: `@{u}` is the merge upstream, not the push destination. Take a local branch whose name differs from its upstream, for example local `hotfix` tracking `origin/release/3.x`. SOP 8a pushes with `git push origin <branch>`, which lands on `origin/hotfix`, but CI is then asked about `release/3.x`. In the fixture, the `mismatch` → `origin/release/3.x` case queried `release/3.x`. This is exactly what the approved cut specifies (@{u} first), and it fails safe: no sha match gives WARN, and strict gives FAIL. It is recorded here only for a future ticket. `@{push}` or `branch.<cur>.merge` would be the more exact source.

## Quality
- Messages are slightly inconsistent. The zero-runs WARN uses `ciBranchLabel` (the full upstream, e.g. `origin/release/3.x`), while the matched-FAIL and poll-expiry messages use the bare `ciBranch`. Both forms name the derived branch, so the cut's "messages name the derived branch" line is satisfied. This is cosmetic only (advisory A2).
- The rewritten Check 6 header comment line "release's branch via the gh CLI and finds the one whose headSha matches the commit actually being" runs well past the file's surrounding wrap width. It is cosmetic.
- The template sentence is written clearly and does not duplicate any normative text. The `driftBaselineIds` paragraph at the template's tail still restates step 7b prose. It is outside E166's list-restatement scope and is already filed as L-RELTOOL-NEW-1.
- Advisory A3: the backlog row E166 also names the *installed* `~/.claude/agents/release-engineer.md` copy. That copy lives outside the repo and is not touched by this diff. The fix reaches users when they re-run `agc init`, so the release notes or doc-writer should mention a refresh.

## Architecture
No architecture spec exists (mini-chain). The derivation sits inside the shared `evaluateCIGroundTruth` (E163), so all three consumers pick it up with no second mechanism: step 2a, step 8b (`--ci-check`), and step 9a Check 6. The lane boundaries hold: nothing under content/, tools/, gates/, guards/, prompts/, bin/, schema/ or .github/ is touched. No sibling template in `templates/claude-code-agents/` restates a path list.

## Security
The argv-injection guard is sound. The derived branch reaches `spawnSync("gh", [...])` as a discrete argv element, with no shell, so the only real risk is that the value could be read as a flag. The code rejects an empty value or one starting with `-` via `warn()` before it gets to gh. git's refname rules already forbid a leading `-`, so the guard is defence in depth. `branch.${current}.remote` is passed to git's argv without a shell, and `current` comes from git itself. No secrets are introduced.

## Performance
The change adds at most 3 synchronous git subprocess calls, once per evaluation, outside the poll loop. The poll loop is unchanged. There is no regression.

## Verdict
APPROVED. Both non-negotiable acceptance lines hold: E166 defers to step 8a's existing "Stage explicitly" and "Pre-commit verify" anchors with no path restated, and E165 keeps `--workflow CI`. Branch derivation is correct across every edge case I exercised, and E147 sha resolution and the stdout-WARN contract are unchanged.
