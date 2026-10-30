# Review — T-E346-01

## Round 1 — APPROVED — by code-reviewer

## Summary
- `tools/fanout-handoff.ts` adds a private `isRepoRoot(root)`. It accepts the root when `realOrResolved(git rev-parse --show-toplevel)` equals `realOrResolved(root)`. When `--show-toplevel` throws, the existing `--git-dir` test decides. `compareExternalDeps` uses it in place of the bare `--git-dir` probe, and a mismatch goes down the existing `SISTER_REPO_NOT_GIT` path with no path echoed.
- `dist/tools/fanout-handoff.js` is byte-identical to a fresh `tsc` build of HEAD. `test/e292-handoff-sister-sha.test.mjs` passes unmodified (within the 131/131 run).
- Verdict: APPROVED, with one optional finding.
- Same-model note: this review ran on opus, the same tier sr-engineer was pinned to. Same-model bias is possible; nine sister-path fixtures below were run to offset it.

## AC Completeness
AC-E346-1 — implemented — tools/fanout-handoff.ts:570-582, 622 (a plain dir nested in the primary's working tree gives exit 2 with `SISTER_REPO_NOT_GIT` and the unchanged `err.sister-not-git` copy, no path echoed).
AC-E346-2 — implemented — same lines (a subdirectory of the sister repo gives the same rejection).
AC-E346-3 — implemented — same lines (a symlink to the sister root and a linked git worktree of the sister are both accepted, exit 0).
AC-E346-4 — implemented — e292 suite unmodified and green. A missing directory still gives `SISTER_REPO_NOT_GIT`: `execFileSync` fails on the missing cwd, the `--git-dir` fallback also fails, so it returns false.

Extra probes: a bare clone and a path inside `.git` are both still accepted through the `--git-dir` fallback (git 2.50 errors on `--show-toplevel` there), which matches the Out of Scope line. A trailing-slash declared path is accepted. The new test file (`test/e346-sister-nested-dir.test.mjs`) is QA scope (T-E346-02).

## Correctness
No required findings.
- [optional] tools/fanout-handoff.ts:573-582: git before 2.25 printed an empty `--show-toplevel` with exit 0 in a bare repository instead of erroring. On such a git, `top` would be `""`, `realOrResolved("")` would resolve to the process cwd, and a bare sister would be rejected rather than falling back to `--git-dir` as the spec Decision intends. Treating `top === ""` like the throw branch would close this. Current git (and the CI images) error out, so this is not blocking.

## Quality
No findings. The `isRepoRoot` doc comment is 6 lines with a one-sentence summary, and states WHAT plus the non-obvious WHY (a nested plain dir passes `--git-dir`). The retained in-body comment about not echoing the path is pre-existing.

## Architecture
No architecture spec. The helper is private and placed beside `compareExternalDeps`. It reuses the existing `git` and `realOrResolved` helpers and the existing error code and copy. No `GATE_REGISTRY`, schema or config change.

## Security
No findings. `git` runs through `execFileSync` with fixed arguments and `cwd` set to the config-declared root, as at base. The rejection message still echoes only the entry name (`WORKTREE_ABSOLUTE_WARN` convention), so local paths are not leaked.

## Performance
No findings. On success there is one `rev-parse` spawn per distinct sister (memoised by the existing `roots` / `notGit` sets), the same count as base. Only the failure branch adds a second spawn.

## Verdict
APPROVED — the realpath top-level comparison rejects nested and sub-directory roots, accepts symlinked and worktree roots, and keeps the `--git-dir` fallback, error code, exit code and copy unchanged.
