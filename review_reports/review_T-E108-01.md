# Review — T-E108-01 (+ T-E108-03)

covers: T-E108-01, T-E108-03

Diff range `4d0a78e..HEAD` (code commits 64f97f4, aa48f3b; 02185c7 / c022a13 are handoff-only). Spec: `specs/e108-agc-eject.md`, where the "Cut amendments" section overrides the task-row text. There is no architecture spec (the spec itself says no architect hop).

## Summary
- Adds `agc eject [--yes] [--purge-knowledge]` to `bin/agc-init.mjs`. It has a plan/apply engine over classes (i)/(ii-b)/(ii-a) and (iii) host traces, a consolidated tracked `git rm -r` line, a linked-worktree refusal, a `--yes` refusal while live worktrees exist, and the cannot-do block. It also adds the top-level usage line and a `docs/install.md` passage.
- It reuses the E239 helpers: `artifactExcludeRulesForPrefix` / `artifactPathsForPrefix` are generalised with a `baseRules` parameter, and `trackedArtifactPaths`, `readSharedExclude`, `atomicWriteFile`, `CLAUDE_BEGIN/END` and `STAMP_RE` are reused. `stampTemplate` was refactored to share the new `readAdapterTemplate`.
- `resolvePrimaryRepoRoot` gains a `command` label parameter, defaulting to `agc feature ${verb}`. I confirmed byte-for-byte that the `feature start` / `feature finish` refusal output is identical to base `4d0a78e`, run from a real linked worktree in a scratch repo.
- Files touched: `bin/agc-init.mjs`, `docs/install.md`, `.current/e108/*`. All are in the lane's owned set. **No test files authored by sr** (`git diff --stat 4d0a78e..HEAD -- test` is empty).
- I ran behaviour checks in `$TMPDIR` scratch repos, never against the worktree or the primary checkout. Covered: AC1, AC2, AC4, AC5, AC6, AC8, AC12, AC15, AC16, AC17, AC18, AC21, AC22, AC24, AC25, and feature start/finish message identity. The existing e106/e239/agc-adapters suites pass 70/70. `check-md-tables` reports 0 malformed tables.
- Verdict: **APPROVED**. There are no required findings. The recommended/optional findings and decision (c) are below. (c) is a spec clarification for the integrator, not a defect in this cut.

## AC Completeness
AC1 — implemented — `bin/agc-init.mjs` `runEject` (dry-run branch). Scratch run: every class line was present, the file-hash snapshot was unchanged, and it exited 0. Per the amendment, docs/backlog.md now prints as (ii-a) KEPT with the "may be this project's plan" suffix (AC7 supersedes AC1's "NOT DELETED" wording).
AC2 — implemented — scratch run: `.current/`, `tasks.md`, `qa_reports/`, `review_reports/` were deleted. `design/`, `specs/`, `docs/backlog.md` were untouched. CLAUDE.md, AGENTS.md and `.antigravityrules` were deleted. The 4 artifact exclude lines were removed. The cannot-do block printed. Exit 0.
AC3 — implemented — `--purge-knowledge` without `--yes` goes through the same dry-run path. Tracked knowledge paths go to `tracked` and are printed in the `git rm -r` block (the `trackedTargets` check comes before `onDisk`).
AC4 — implemented — scratch run: `git rm -r design specs` went to stderr with the "history still contains" note. design/ and specs/ were not deleted.
AC5 — implemented — scratch repo-mode run: all four runtime paths stayed on disk and in the index. One `git rm -r .current tasks.md qa_reports review_reports` line was printed. Host traces ran as in AC2. Exclude printed "nothing to remove".
AC6 — implemented — scratch run with the artifacts key undeclared: `.current/` and `qa_reports/` were deleted, and tracked `tasks.md` was kept and named in `git rm -r tasks.md`.
AC7 — implemented — `KNOWLEDGE_RULES` includes `/${BACKLOG_REL}`. It is KEPT by default. Under purge, the untracked backlog was deleted in the scratch run and a tracked one goes to the `git rm -r` line.
AC8 — implemented — `planClaudeBlockEntry`. Scratch run: the prose before and after the block was preserved byte-exact (`# Mine\nprose\n` + `\n` + `tail\n`). The file was rewritten through `atomicWriteFile` and the "file kept, other content preserved" line printed.
AC9 — implemented — `rest.trim() === ""` leads to `rmSync`. Confirmed in the AC2 scratch run.
AC10 — implemented — an absent file returns `null` (silent). An unmarked file prints the Copy/Strings line "no adapter block found — nothing to do" (see Correctness O2 on the AC10 wording vs Copy table).
AC11 — implemented — `planAdapterFileEntry`: only the STAMP_RE capture is swapped back to `{{AGC_VERSION}}`, then compared with the raw `readAdapterTemplate`. Each template holds exactly one placeholder, so single-occurrence normalisation is exact.
AC12 — implemented — a mismatch, missing stamp or read error gives KEPT plus the verbatim advisory, and the file is never deleted. Scratch run: the advisory survived a second "nothing to eject" run.
AC13 — implemented — `lstatOrNull(abs) === null` returns `null`, so nothing is printed.
AC14 — implemented — `planExcludeEntry` removes only lines equal to `artifactExcludeRulesForPrefix(prefix)`, ignoring a trailing CR. Scratch run: `.env`, `/node_modules`, `/.current/**/base-sha` and `# mine` were byte-identical afterwards.
AC15 — implemented — scratch run from `<repo>/sub`: only `sub/...` paths and `/sub/...` exclude lines were affected. The root `.current/`, `tasks.md`, CLAUDE.md, AGENTS.md, `.antigravityrules` and the root-anchored rules were untouched (checked with a diff of the exclude file).
AC16 — implemented — `resolvePrimaryRepoRoot(cwd, "eject", "agc eject")` runs before planning. Scratch run from inside a lane printed the same message shape as feature start/finish and exited 1.
AC17 — implemented — scratch run outside git: all four paths deleted with `deleted (no git repo — nothing to check-ignore)`, the exclude step printed "skipped (not inside a git repository)", no git rm line, exit 0.
AC18 — implemented — second run: "agc eject — nothing to eject." followed by the cannot-do block (required by AC19), exit 0.
AC19 — implemented — `ejectCannotDoBlock` is printed on every successful path, including nothing-to-eject. Items 1–4 are verbatim against the Copy table.
AC20 — implemented — no stdin read anywhere, and every `execFileSync` uses `stdio: ["ignore", ...]`.
AC21 — implemented — `parseEjectArgs` throws `usageError("agc eject: unknown option <flag>")` before any read or write. Exit 2 plus the usage block, confirmed.
AC22 — implemented — the default usage is `STR_USAGE + STR_USAGE_FEATURE + STR_USAGE_EJECT`. The eject summary text is verbatim.
AC23 — implemented — `docs/install.md` "Leaving agc" section covers dry-run default, `--yes`, `--purge-knowledge`, the four-class table and the four cannot-do items.
AC24 — implemented — the header prints `declared artifacts mode:`. The local-not-honoured note appears only for tracked runtime paths (scratch run with local mode and a tracked `tasks.md` confirmed it). The no-recovery line appears only when an entry has `untrackedDelete`.
AC25 — implemented — scratch run: `--yes` refused, named the lane and exited 1. Dry-run printed the `warning:` list to stderr, then the plan, and exited 0.

## Correctness
No required findings.

Invariants I verified:
- **agc never runs a git mutation.** The eject path uses only `rev-parse --show-toplevel`, `rev-parse --git-common-dir`, `worktree list --porcelain` and `--literal-pathspecs ls-files -z`. None of them mutate.
- **agc never deletes a tracked path in classes (i)/(ii-a)/(ii-b).** In the loop, `trackedTargets.has(p.target)` routes to `tracked` before any delete entry is built. A KEPT knowledge path has `apply: null`.
- **Exclude-line removal is prefix-scoped and exact.** The survivors keep their own terminators, so their bytes are unchanged.

Findings:
- R1 (recommended) — `runEject`, tracked routing. A class-(i)/(ii) directory that is *partly* tracked (e.g. `.current/` with tracked files plus untracked ones) is routed wholly to the `git rm -r` line. `git rm -r` removes only the tracked files, so the untracked remainder survives both eject and the pasted command, and the plan says nothing about it. This is the safe direction (nothing tracked is deleted, nothing is lost silently), but the adopter is left with residue. Suggestion: add a one-line note, or a follow-up ticket, to name the untracked remainder. Not blocking: no AC covers mixed-within-a-directory state.
- O1 (optional) — `planExcludeEntry` matches lines by exact equality after removing a CR, while `upsertSharedExclude` / `readSharedExclude` test membership by `trim()`. A hand-edited rule with trailing spaces counts as present for init but is not removed by eject. This is an edge case and fails in the safe direction.
- O2 (optional) — AC10 says an unmarked CLAUDE.md is a "silent skip", but the Copy table defines `CLAUDE.md: no adapter block found — nothing to do`. The implementation prints the Copy string, which is not alarming. This is a spec-internal wording tension and not an implementation defect.
- O3 (optional) — a `CLAUDE.md` that is a directory, or unreadable, throws out of `planClaudeBlockEntry`. The dispatcher prints `agc eject: <message>` and exits 1 before anything is applied (planning finishes before any apply). That is acceptable, just unfriendly.

## Quality
No required findings.

Judgment on the sr decisions I was asked to rule on:
- **(a) Dry-run wording for host-trace lines** (`REMOVE adapter block (...)`, `DELETE (matches the installed template)`, `REMOVE <n> artifact exclude line(s)`): **accept.** The spec gives only the applied forms. AC1 requires the plan to name the CLAUDE.md block as REMOVE, the adapter files as DELETE and the exclude rules as REMOVE, and these forms carry exactly those uppercase verbs in the same vocabulary as the (i)/(ii) `DELETE` lines. The applied forms stay verbatim to the Copy table.
- **(b) The `advisory` plan-entry flag:** **accept.** Without it, AC12 ("when agc eject runs … a dedicated advisory names it") would be silently dropped on the nothing-to-eject path. The flag is narrow: only the ambiguous-adapter entry sets it.
- **(d) Cannot-do block printed on "nothing to eject":** **accept.** It is required. AC19 says "any invocation … always includes". AC18's "single 'nothing to eject' line" refers to the plan portion.
- **(e) Item 4 lists only files whose names match shipped `templates/claude-code-agents/*.md`:** **accept.** This is the correct safe reading: an adopter's own agents in `~/.claude/agents/` never reach the printed `rm` line. The `(none)` filler shown when no templates are present is authored text outside the Copy table. That is reasonable, and QA should pin it.
- **(f) The " (run from the repository root)" qualifier on the subdirectory `git rm` line:** **accept.** It is a small deviation from the verbatim Copy string, but it copies the existing `init` precedent exactly (`bin/agc-init.mjs:627`, the `git rm -r --cached` warning), and without it the repo-relative targets would be wrong when pasted from `sub/`. Correctness outranks verbatim here. QA should assert both forms.
- R2 (recommended) — the printed `git rm -r <targets>` and `rm <files>` lines are not shell-quoted. A workspace prefix or `$HOME` containing a space would split when pasted. The damage is limited: `git rm` aborts the whole command on a non-matching pathspec, and `rm` on the split fragments almost always fails harmlessly. The `init` precedent at `:628` has the same gap, so this is existing convention rather than a regression. It fits alongside the already-filed E239-NEW-2 (special characters in workspace path).

## Architecture
No architecture spec exists. The code fits the spec's "Core reuse, no duplication" mandates:
- The `baseRules` generalisation follows the same pattern as `upsertSharedExclude`, so no near-duplicate function pair was added.
- `removeClaudeBlock` behaviour lives in a new function (`planClaudeBlockEntry`), so `writeClaudeBlock` is not rewritten.
- The template-match test uses the template-loading path (`readAdapterTemplate`), not `stampTemplate`.
- `atomicWriteFile` handles both in-place rewrites.

The `command` parameter on `resolvePrimaryRepoRoot` departs from the spec's "reused as-is (`verb = "eject"`)". As-is, the message would read "agc feature eject: …". The coordinator already sanctioned the change and I confirmed feature start/finish output is byte-identical, so I accept it.

**Decision (c) — tracked AGENTS.md / .antigravityrules / CLAUDE.md in repo mode under `--yes`.** Verdict: **consistent with this cut; not a defect. The coordinator should take a spec clarification to the integrator.**

- AC5 explicitly requires that in repo mode "the `CLAUDE.md` block, `AGENTS.md`/`.antigravityrules` … still run exactly as in AC2". Those files are normally committed in every mode, so AC5 can only be satisfied by a working-tree delete or edit of tracked files.
- The Out-of-Scope clause ("`git rm` … prints it, never runs it, for any tracked path in any class") is about not *running git rm*, and eject does not.
- A working-tree deletion of a tracked file is recoverable (`git checkout -- <file>`). It is correctly *excluded* from the "no git recovery" header line, because `untrackedDelete` is set only for untracked files.
- Routing a tracked whole-file host-trace deletion into the `git rm -r` line while still editing tracked CLAUDE.md in place would be incoherent: both are ordinary uncommitted working-tree changes the adopter reviews and commits.

However, the cut-amendment sentence "agc still never deletes a tracked path itself" reads as universal. The integrator should scope it explicitly to classes (i)/(ii-a)/(ii-b). One alternative is to give tracked host-trace deletes a plan note ("tracked — restore with `git checkout`"). The other is to reverse AC5 so they join the `git rm -r` line, which I do not recommend because of the CLAUDE.md-edit incoherence above. Neither blocks this cut.

## Security
No findings.
- Every deleted path is built from fixed constants (`ARTIFACT_EXCLUDE_RULES`, `KNOWLEDGE_RULES`, `ADAPTERS`) plus the realpath-derived workspace prefix, and resolved under `repoRoot` or `cwd`. There is no user-controlled path input, and flags are strictly allow-listed.
- `rmSync` on a symlink removes the link, not its target.
- `git` is invoked with argv arrays (no shell) and `--literal-pathspecs`.
- No secrets. Nothing is read from stdin.

§6 Information hygiene / Generic citation: none of the new code comments or the `docs/install.md` passage mention ticket ids, AC ids or spec paths. The only matches in the diff are in `.current/e108/handoff.md`, which is state and not in scope.

## Performance
No findings.
- A constant number of git subprocesses per run: one ls-files for the class paths, at most three per-file ls-files for host traces, plus rev-parse and a worktree list.
- One read and one atomic write of the exclude file.
- No loops over repository contents. The init/check paths are unchanged except for the `stampTemplate` refactor, which does the same single read.

## Verdict
APPROVED — all 25 ACs are implemented and every one I spot-ran behaved to spec. agc never runs a git mutation and never deletes a tracked (i)/(ii) path. Decisions (a), (b), (d), (e) and (f) are sound. Decision (c) is spec-consistent (AC5), and the only follow-up is a wording clarification for the integrator.

## Round 2 — APPROVED — by code-reviewer

covers: T-E108-01, T-E108-03

Scope: fix commit `ceb3c4a` (`bin/agc-init.mjs`, +26/−3) only, checked against the QA round-1 finding (`qa_reports/review_T-E108-01.md` @ `79c4946`, which the coordinator told me to read for this round) and the spec text added at `a997c5c` (Copy/Strings `eject.tracked.host-trace-changed` plus the host-trace sentence in "Cut amendments"). The round-1 approval of `64f97f4` + `aa48f3b` stands and is not re-opened.

### Summary
- Host-trace plan entries now carry `trackedChange` (`edited` | `deleted`) and `display` when the file is in the index. There are three sites: `planClaudeBlockEntry`, both the delete and the edit branch (`bin/agc-init.mjs:3275-3296`), and the delete branch of `planAdapterFileEntry` (`:3326-3333`).
- `runEject` prints the new list after the per-entry lines, on stdout, and before the tracked `git rm -r` block (stderr) (`:3479-3489`).
- The diff since round 1 touches only `bin/agc-init.mjs`, the spec, and state/QA files. The sr authored no test files (`git diff 58df48a..HEAD --stat`).
- Verdict: APPROVED.

### AC Completeness
- AC5 (tracked host-trace clarification, `a997c5c`) — implemented — `bin/agc-init.mjs:3479-3489`.
- Copy/Strings `eject.tracked.host-trace-changed`:
  - The `--yes` heading matches the spec byte for byte: `Tracked host-trace file(s) were changed in the working tree — this is uncommitted; review and commit it yourself:`.
  - Items print as `  <path> (edited|deleted)` with a two-space indent, which also matches.
- All other ACs are unchanged from round 1.

### Correctness
No findings. Live-verified with real `bin/agc-init.mjs` runs in scratch repos under the session scratchpad, using a temp `HOME`. After each run I diffed `.git/index` (shasum) and `HEAD`: the index was unchanged in every case and no git mutation happened.

| case | dry-run list | `--yes` list | git status after |
|---|---|---|---|
| A: all 3 tracked, CLAUDE.md block-only | CLAUDE.md, AGENTS.md, .antigravityrules (deleted) | same, verbatim heading | ` D` ×3 |
| B: tracked CLAUDE.md with prose | CLAUDE.md (edited), the other two (deleted) | same | ` M CLAUDE.md`, ` D` ×2 |
| C: all untracked | none | none | output identical to round 1 |
| D: subdir workspace `sub/`, tracked | `sub/…` paths | `sub/…` paths | git rm block unchanged |
| E: outside git | none | none | n/a |
| F: only CLAUDE.md tracked | CLAUDE.md only | CLAUDE.md only | ` D CLAUDE.md` |
| G: tracked CLAUDE.md with no block, tracked AGENTS.md KEPT (edited) | only .antigravityrules | only .antigravityrules | nothing changed is listed |

- Only tracked host-trace files are listed. `.git/info/exclude` and the class (i)/(ii) entries never set `trackedChange`. Every no-op branch (no block, KEPT, absent) returns no `trackedChange`, as case G shows.
- The `--yes` list names only changes that actually happened. The loop at `:3472-3475` applies entries one by one, and an `apply` that throws propagates before `:3479`, so the list never prints after a partial failure. It does not claim changes that were not made. The trade-off is that it also does not name tracked changes that did succeed before the throw. Those still appear in the per-entry lines already written, so this is acceptable.
- Tracked detection reuses `isWorkspaceFileTracked` → `trackedArtifactPaths`, which uses `--literal-pathspecs ls-files` and an exact `f === target` match. A staged-but-uncommitted file also counts as tracked, which is correct because its deletion is also working-tree state.

### Dry-run form (judgment call)
**Accepted.** The spec says the dry-run "lists the same paths under `will change tracked file(s) — uncommitted until you commit`". My reasons for accepting:
- Adding a trailing colon makes it a heading, parallel to the `--yes` line and to the other list headings in `runEject`.
- Reusing the `(edited|deleted)` qualifier satisfies "the same paths" and adds useful information.
- Neither change contradicts the spec wording.

### Quality
- optional (non-blocking): the dry-run heading is lower-case and the `--yes` heading is sentence-case. Both follow the spec's own casing, so leave them as they are unless Copy/Strings changes.
- recommended (non-blocking, for the coordinator to file): QA Phase 3 should pin cases A, B, C, D and G above in `test/e108-eject.test.mjs`. At present only live runs cover them.

### Architecture
No findings. The data stays on the plan entry, as the existing `untrackedDelete` field does. It adds no new git calls, because `tracked` is hoisted and reused for `untrackedDelete`.

### Security
No findings. There is no new input surface, and the git calls are the same argv-array `ls-files` calls as before.

### Performance
No findings. There are no extra subprocesses: the result of the existing per-file `ls-files` call is reused. The filter is O(entries).

### Verdict
APPROVED — the fix closes the QA round-1 AC5 finding with the verbatim `--yes` string. It lists only tracked host-trace files that actually changed, and it leaves the untracked, outside-git and subdir output unchanged apart from the new list.
