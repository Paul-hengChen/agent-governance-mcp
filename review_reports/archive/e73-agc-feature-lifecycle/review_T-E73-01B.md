# Review — T-E73-01B

covers: T-E73-01B, T-E73-02B, T-E73-03B

## Round 1 — APPROVED — by code-reviewer

## Summary
- Adds `agc feature start` / `agc feature finish` to bin/agc-init.mjs (+651/-3 lines) and a "Feature lanes" section to docs/install.md (+39 lines). Also adds the sr-engineer expected-red manifest qa_reports/expected-red_e73-agc-feature-lifecycle.txt.
- Scope: the diff was checked against specs/e73-agc-feature-lifecycle.md AC1-AC29, Out of Scope and Security §6. There is no architecture spec (the spec says the architect is not needed). NEW-TICKETS.md, the tasks.md PM rows and .current/e73/ were not reviewed, per the brief.
- Independent verification: I built a scratch repo under $TMPDIR (removed afterwards) and exercised AC1-AC6, AC8-AC24 and AC26 against the real CLI. Every AC behaved as specified.
- Model independence: sr-engineer ran on fable and this reviewer ran on opus, so same-model bias is not a concern.
- Verdict: APPROVED. There are no required findings. Four recommended findings are listed below as follow-up candidates.

## AC Completeness
AC1 — implemented — bin/agc-init.mjs runFeatureStart. `worktree add -b feat/<slug> <path> <base>`. Smoke: exit 0, branch and worktree created.
AC2 — implemented — resolvePrimaryRepoRoot. isLinkedWorktree is applied to `--show-toplevel`, and the error names the primary path. Smoke confirmed the refusal from a lane.
AC3 — implemented — the last line printed is `lane: ${resolveCurrentLane(lanePath)}`, with no regex copy. Smoke: `lane: e73`.
AC4 — implemented — resolveLaneName(slug) === LEGACY_LANE is rejected (exit 2) before any git mutation. The only earlier git calls are read-only rev-parse. Smoke: `no-ticket-id-here` is rejected and no branch is created.
AC5 — implemented — default path is `path.join(dirname(repoRoot), basename+"-lanes", ticketId)`. Git creates the leading dirs. Smoke: repo-lanes/e73 and a nested `--path deep/x/e9` were both created.
AC6 — implemented — pre-checks for an existing branch (show-ref), an existing path (lstat), and a registered-but-missing worktree (canonicalPath compare). Smoke: the duplicate branch and the registered-missing path were both refused, with no stray branch left.
AC7 — implemented — nothing on the start path calls runInit or writeClaudeBlock.
AC8 — implemented — the exclude rules are upserted before the link and copy exist. Smoke: `git status --porcelain` was empty right after start.
AC9 — implemented — bootstrapLaneEnv creates the symlink with `fs.symlinkSync(primaryNm, laneNm, "dir")`. If primary has no node_modules, it warns and does not fail.
AC10 — implemented — `fs.copyFileSync(..., COPYFILE_EXCL)` only. Smoke: cmp showed identical bytes, mode 0600 was preserved, and the dummy value appeared 0 times in the output.
AC11 — implemented — upsertSharedExclude targets `<git-common-dir>/info/exclude` and checks lines with a Set. Smoke: after a second start, `.env` appeared exactly once.
AC12 — implemented — LANE_EXCLUDE_RULES = [".env", "/node_modules"] is applied unconditionally. Smoke: `/node_modules` appeared exactly once.
AC13 — implemented — Smoke with the fixture `.gitignore` = `node_modules/`: status was clean, and `finish --shipped` removed the lane without `--force`.
AC14 — implemented — a one-line stdout warning is printed right after the symlink, with the wording the spec requires.
AC15 — implemented — Smoke: primary `node_modules/dep/index.js` was intact after both `--shipped` and `--abandoned` removals, because git unlinks the symlink and does not follow it.
AC16 — implemented — `merge-base --is-ancestor`: status 1 gives the "merge it first, or use --abandoned" message, and other statuses fail closed. Smoke: an unmerged lane was left untouched.
AC17 — implemented — removeWorktreeNoForce followed by `branch -d`. Smoke: the worktree was gone and `branch --list feat/e5*` was empty.
AC18 — implemented — the same guard as AC2. Smoke: running from the target lane was refused.
AC19 — implemented — Smoke with a dirty lane: git's own "contains modified or untracked files" error was shown verbatim, nothing was removed, and there was no retry.
AC20 — implemented — the merge guard is inside `if (opts.shipped)` only. Smoke: an unmerged lane was abandoned with exit 0.
AC21 — implemented — abandonEvidence partitions `status --porcelain -z --untracked-files=all` before any move. Smoke: an edited src/a.txt was named and nothing was moved.
AC22 — implemented — tokenRe `(?:^|[_.-])id(?:[_.-]|$)` with flag i. Smoke: review_T-E73-01.md was moved, and review_T-E730-01.md and e73b_notes.md were left in place.
AC23 — implemented — Smoke: the branch tip was `chore(lane): abandon e73 — evidence to abandoned/` with the rename in the stat. For the untracked-only case, `git log` on feat/e9-baz was unchanged.
AC24 — implemented — Smoke: the untracked file was renamed and is still `??`. worktree remove refused with git's own message, there was no `--force` retry, and a hint was printed.
AC25 — implemented — ABANDON_EVIDENCE_DIRS = ["qa_reports","review_reports"] and only direct-child files are moved. No pending-ticket code exists.
AC26 — implemented — `--abandoned` never deletes the branch. Smoke: feat/e73-foo still exists after the removal.
AC27 — implemented — docs/install.md "Feature lanes" section covers both commands, the default path, the merge guard with the `--base` caveat, commit-before-remove, the untracked rough edge, the node_modules warning, and direct `git worktree remove` as undefined behaviour.
AC28 — implemented — docs/install.md has a "**Secrets:**" sentence.
AC29 — implemented — `git diff -U0` removed lines are exactly the 2 comment lines (header ~9, runInit ~351) plus the dispatch default-case `process.stderr.write(STR_USAGE)`. That last one is feature wiring (it appends STR_USAGE_FEATURE), not part of the retarget. The STR_USAGE literal is byte-identical to HEAD (sed-extracted diff is empty). Every `config.json` line is byte-identical to HEAD (grep diff is empty).

## Correctness
- recommended — the `--abandoned` evidence in a *gitignored* real evidence directory is silently deleted. In abandonEvidence, a matched file that is untracked *and ignored* does not appear in `git status`, so the precondition passes. It is then `fs.renameSync`'d and "moved ... ->" is printed. `git worktree remove` then succeeds, because it deletes ignored files without `--force`, and the evidence is gone. I reproduced this in a $TMPDIR repo with `.gitignore: qa_reports/`: exit 0, and the file no longer exists anywhere. This is outside every AC, because the spec scopes evidence dirs as tracked here and E111 advises symlinks in adopter repos. The tool still reports success after destroying the thing it exists to preserve. Suggested follow-up: refuse, or skip with a warning, when a matched file is ignored (`git check-ignore`). The related adopter case is also untested: an evidence dir that is an E111 symlink back to primary would make readdir and rename act on primary's files. File it as a follow-up ticket; it does not block these ACs.
- recommended — the `--shipped` path runs `git branch -d` after `git worktree remove`, but `-d` checks "merged into HEAD (or upstream)", not "merged into `--base`". If primary's HEAD is not `--base`, the guard passes, the worktree is removed, and then `-d` refuses. The code surfaces this cleanly ("worktree removed, but `git branch -d` refused"). It is non-destructive, but it leaves a half-finished teardown. Optional hardening: run `-d` pre-flight semantics before removing the worktree, or document it.
- recommended — the failed-add rollback runs `git update-ref -d refs/heads/<branch> <baseCommit>`. §6's git rules list the sanctioned mutations as add/commit/tag/ff-push/stash, and `update-ref -d` is not on that list. The same is true of the spec-mandated `git worktree add/remove`, `git branch -d` and `git mv`: this is a human-run CLI tool, and the §6 list governs agent-initiated mutations. On substance it is a compare-and-delete. It fires only if the ref still equals the base commit captured moments earlier, so it cannot drop any commit, and it restores the ref namespace to its pre-invocation state (it serves AC6's "creates nothing new"). The pre-checks cover every clash I could reproduce, so the path is defensive and rarely reached. My assessment is that it is non-destructive and acceptable. I am flagging it for explicit human sanction because it is spec-unmandated and outside the enumerated list. `git branch -d` would be the in-list alternative, but it is less precise because it checks against HEAD.
- optional — for the abandoned-flow commit, `git commit -m ...` commits the whole index. The precondition guarantees nothing unrelated is staged at snapshot time, so today this cannot pick up unrelated work. Only a hook or a concurrent process in the window could change that. Passing the moved src and dst pathspecs would make it structurally impossible.
- optional — a tracked evidence file with *unstaged modifications* passes the precondition, as intended. It is `git mv`'d, but the commit captures the index version. The worktree then stays dirty, so remove refuses verbatim, which is safe. The printed hint only mentions untracked files.

Re-derivation of the 8 sr interpretations (from the code, not the notes):
1. Validating with resolveLaneName and printing via resolveCurrentLane is correct. Both share TICKET_ID_RE (tools/lane-paths.ts:111) and there is no regex copy.
2. Guarding the toplevel rather than cwd is correct and strictly safer.
3. The `lane: <id>` last line is fine and matches AC3.
4. `finish` takes a bare id: `resolveLaneName(raw) !== raw.toLowerCase()` rejects a slug. This is correct.
5. The registered-missing pre-check plus conditional rollback is verified by the smoke test (no stray branch). The rollback is discussed above.
6. A tracked .env or node_modules is left alone with a warning: COPYFILE_EXCL catches EEXIST, and lstat is checked before the symlink. This is correct and never clobbers.
7. A destination clash is refused before any move. Verified in code: the clash check runs before the move loop.
8. The AC29 removed lines are verified above.

## Quality
No required findings. The helpers (git/gitTry, parseFeatureArgs, listWorktrees, canonicalPath) are small and match the file's existing execFileSync-argv house style. FeatureError/usageError give consistent exit codes (2 for usage, 1 otherwise). optional — `resolveBaseCommit` resolves the SHA but `worktree add` is passed the symbolic `base`, which leaves a negligible TOCTOU window. Passing `baseCommit` would pin it, but the branch start point would then be recorded as the SHA. It is fine either way.

## Architecture
No architecture spec exists, and the spec says one is not needed. The design fits the spec's Grounding. There is a single naming source (dist/tools/lane-paths.js, loaded dynamically so init and check don't depend on dist). Nothing is persisted to .config.json (E123 F1-S0). No agc init runs in the lane. No evidence symlinks are managed. There are no E124 or E130 stubs or interfaces: grep finds only explanatory comments at bin/agc-init.mjs:851-852 and :1461. Size is 690 lines across 3 batched tasks and 2 source files. With about 230 lines per task on average, it is within the task_size budget (≤5 files / 300 lines per task) as a 3-task batch. The start and env-bootstrap work is roughly 330 lines combined and finish plus docs is roughly 360, so each task individually is near the ceiling but not clearly over it. This is not a defect.

## Security
No findings.
- Shell-free: every git call is `execFileSync("git", argv)` via git()/gitTry(). There is no `execSync` or `shell:` in the new code (the one grep hit, :525, is a pre-existing comment). Option injection is closed: `--base` values starting with "-" are rejected, the lane path is always absolute via path.resolve, branch is `feat/...` and validated with `check-ref-format --branch`, and `git mv` uses `--`.
- `.env` (§6): it is only touched via `fs.existsSync` and `fs.copyFileSync`, never readFileSync, and its content is never interpolated into output. Smoke: the dummy value was absent from stdout and stderr. I did not read any real .env.
- `--force` is never passed anywhere: worktree remove, branch `-d` (not `-D`), and no retry on refusal.
- Exclude: it writes only `<git-common-dir>/info/exclude` (existing file: atomicWriteFile), never `.gitignore`, and the upsert is idempotent.
- Primary node_modules cannot be deleted by `finish`. Git unlinks the lane's symlink, and nothing in the code recurses into node_modules (verified in the smoke test on both paths).
- See Correctness for the rollback update-ref and the ignored-evidence data-loss path.

## Performance
No findings. All operations are one-shot CLI git calls plus one readdir per evidence dir. canonicalPath is O(depth) per worktree entry. `agc init`/`agc check` are unchanged, and the lane-paths import is dynamic and loaded only for `feature`.

Expected-red sampling (SOP 4a): the manifest exists with 2 entries, and both were sampled. `test/lane-paths.test.mjs:280` (CALLERS2) and `:568` (CALLERS3) are real, locatable tests whose names match the manifest byte-for-byte. They are caused by the spec-mandated lane-paths import, and they are QA-owned under T-E73-04B.

## Verdict
APPROVED. All 29 ACs are implemented and were independently exercised in a scratch repo, and there are no required findings. The ignored-evidence deletion path, the branch -d vs --base ordering and the update-ref rollback sanction question are recommended follow-ups, not blockers.
