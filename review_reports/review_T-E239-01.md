# Review — T-E239-01

## Summary
- Commit fb93a88 (spec base 43b3f1e, lane base d0c66f0). `agc init --artifacts=local` and the `agc check` artifacts-drift check now anchor the exclude rules and tracked-path pathspecs at the workspace's repo-relative path, not at the repo root. New helpers in `bin/agc-init.mjs`: `repoRelativeWorkspacePrefix`, `artifactExcludeRulesForPrefix`, `artifactPathsForPrefix`. `trackedArtifactPaths` now takes the path set as a parameter and runs with `--literal-pathspecs`.
- Local mode refuses with exit 2 before any write when a workspace segment contains `* ? [ ]`. `agc check` prints one "cannot verify" advisory for a workspace declared `local` at such a path. `docs/install.md` gains the one AC14 sentence.
- File ownership is clean. The lane base to fb93a88 touches only `bin/agc-init.mjs`, `docs/install.md`, `specs/e239-init-subdir-exclude.md` and `.current/e108/**`.
- Cut amendments honoured: sr-engineer wrote no test file (`git diff d0c66f0 fb93a88 -- test` is empty) and no repro or expected-red file (there is no `qa_reports/expected-red_e239-init-subdir-exclude.txt`). The repro-first clause in the task row is superseded, as the spec says.
- Verdict: APPROVED. Every AC is implemented, and I found no correctness defect inside the contracted scope. The backslash finding goes to a follow-up (see Correctness F1).

## AC Completeness
Behaviour checks were run by hand in throwaway `$TMPDIR` repos. The formal proofs belong to QA (T-E239-02).
AC1 — implemented — bin/agc-init.mjs:482 (prefix computed), :601 (prefixed rules passed to `upsertSharedExclude`). A nested `pkgs/app` workspace wrote `/pkgs/app/.current/` and the other three prefixed rules.
AC2 — implemented — `git check-ignore -v pkgs/app/.current/x pkgs/app/tasks.md` from the repo root matched exclude lines 7 and 8.
AC3 — implemented — at the repo root, `artifactExcludeRulesForPrefix("")` returns a copy of the four original strings (:1312) and the qualifier is `""` (:615). I diffed base and HEAD scripts at the root in two setups: fresh `init`, and `init --artifacts=local` with `.current/` and `tasks.md` already tracked. stdout, stderr, exit code, the exclude file and the `check` output were all byte-identical. The unmodified `test/e106-init-artifacts-flag.test.mjs` and `test/agc-adapters.test.mjs` pass 55/55.
AC4 — implemented — :610-617. The display and target lists come from the prefixed path set, and the qualifier matches the Copy string verbatim.
AC5 — implemented — :483 (tracked detection with the prefixed set) and :492-497 (mode stays null, so no key is written). The display list uses the prefixed paths.
AC6 — implemented — `upsertSharedExclude` is unchanged and dedupes by line. A re-run from `pkgs/app` still leaves 4 non-comment lines.
AC7 — implemented — the repo branch is untouched (:588-592). Confirmed in the `weird[dir]` repo run: no rules were written.
AC8 — implemented — :508-514. The refusal throws `usageError` (exit 2) after only read-only git calls and before the first `fs` write at :552. After both the omitted-flag run and the explicit `--artifacts=local` run, the directory was empty and no exclude lines were written. The message matches `init.subdir.unsafe-refusal` verbatim.
AC9 — implemented — `--artifacts=repo` in `weird[dir]` scaffolded the files, stamped `"artifacts": "repo"`, exited 0 and wrote no exclude rules.
AC10 — implemented — :1149 and :1160. The rules tested are the workspace's own prefixed set.
AC11 — implemented — :1160-1171. This is the same `drift()` shape as the root case, using prefixed display paths.
AC12 — implemented — the check compares exact strings from the workspace's own set (:1149). Root declared `local` with the subdir declared `repo`: silent. The reverse case (root declared `repo`, subdir `local` rules present) is also silent.
AC13 — implemented — :1152-1158. The advisory matches `check.subdir.unsafe-advisory` verbatim, prints once, returns, and exits 0.
AC14 — implemented — docs/install.md:150. One sentence inside the `--artifacts` bullet list, with no ticket id.

## Correctness
- **F1 (recommended, follow-up — not blocking): a backslash in a workspace directory name is not refused.** gitignore treats `\` as an escape character. For a workspace `<repo>/a\b`, the rule `/a\b/.current/` means `/ab/.current/`, so it fails to cover the scaffold and could cover a sibling `ab/`. Reproduced: `git status` lists `"a\\b/.current/.config.json"` and `"a\\b/tasks.md"` as untracked but not ignored, and `agc check` stays silent because the exact rule string is present. This is the same silent false-negative this ticket fixes for `* ? [ ]`, and it goes against the third user story's intent. It is still a follow-up and not a required change in this cut, for two reasons:
  1. The contract lists the charset explicitly as `* ? [ ]`: in the Key decision, in AC8 and AC13, and in all three verbatim Copy/Strings entries ("(one of * ? [ ])"). sr-engineer could not widen the refusal without changing PM-owned verbatim copy.
  2. The case needs a POSIX-only directory name with a literal backslash. `path.sep` is `\` on Windows, so it cannot arise there.

  Suggested follow-up scope: add `\` to `GITIGNORE_WILDCARD_RE` and to the three Copy strings. In the same pass, refuse control characters, CR and LF in particular. A segment containing a newline would be split by `upsertSharedExclude` into separate exclude lines, and could inject an unintended pattern such as a bare `*/...`. This is self-inflicted and rare, but it is the same class of problem.
- Prefix correctness verified in these setups:
  - nested dirs (`pkgs/app`);
  - a symlink above the repo (`$TMPDIR/link -> real`, cwd `link/sub`), which gives `/sub/...`;
  - an in-repo symlink alias (`alias -> sub`), which gives `/sub/...` and matches where git sees the files;
  - macOS `/var` -> `/private/var`, handled by `canonicalPath` on both sides (:1293).
- cwd outside the repo: `repoRelativeWorkspacePrefix` throws a plain `Error` (:1294-1296, message thrown after the :1293 relative-path check). In `checkArtifactsDrift` it sits inside the existing try and returns silently (:1142). In `runInit` it cannot be reached in normal use, because `repoRoot` comes from `cwd` itself. Only an environment override such as `GIT_WORK_TREE` pointing elsewhere could trigger it, and even then it fires before any write. Acceptable (optional: wrap it in `usageError` for a cleaner message).
- `--literal-pathspecs` is safe. For the four root targets (no glob or magic characters) the `ls-files` output is identical, as the byte-identical root run shows. It also closes a latent hazard: a directory name starting with `:` would otherwise be read as pathspec magic.
- No cross-contamination. The `.current` and `tasks.md` pathspecs run from the repo root match only top-level entries, and the `startsWith(display)` filter keeps `sub/.current/x` out of the root `.current/` entry, and the reverse.
- No new test and no intentional red, so the expected-red sampling in SOP step 4a does not apply.

## Quality
No findings. The helper names follow the spec's suggestions, and the module-level `ARTIFACT_PATHS` was removed with no leftover callers. The comments point a future uninstall/eject path at the reconstruction helpers in generic terms, with no ticket id, which satisfies constitution §6 information hygiene and generic citation. None of the added lines in `bin/` or `docs/` carry a ticket id.

## Architecture
There is no `specs/e239-init-subdir-exclude-architecture.md` (the spec skips the architect hop). The change follows the spec's Dependencies section exactly: a pure prefix helper, prefix-parameterized rule and path builders, `trackedArtifactPaths` taking the path set, and `upsertSharedExclude` unchanged.

## Security
No findings within scope. Git is still called through `execFileSync` with an argv array, so there is no shell injection. The newline and control-character injection into the exclude file noted in F1 is a local, self-inflicted edge case and belongs in the follow-up.

## Performance
No findings. Two `realpathSync` walks and one `ls-files` call per invocation, the same number of git calls as base.

## Verdict
APPROVED — all 14 ACs are implemented, root-cwd behaviour is byte-identical to base, and the one open gap (backslash, plus control characters) sits outside the contracted `* ? [ ]` charset, so it goes to a coordinator-filed follow-up.
