# e108-agc-eject

## Problem Statement
A project can adopt agc but never leave it. `bin/agc-init.mjs` has only `init`, `check`, and `feature start|finish` — no `eject`/`remove`/`uninstall`, and no definition of what "leaving agc" even means (filed 2026-09-14 from H4(b) in `docs/agc-feedback-2026-09-08.md`; H4(a), the per-feature/per-lane teardown, is `agc feature finish`, out of scope here). `agc init` only ever creates four things (`.current/.config.json`, `tasks.md`, the marker-delimited `CLAUDE.md` adapter block, `AGENTS.md`/`.antigravityrules`) — everything else (`handoff.md`, `telemetry.jsonl`, `metrics.jsonl`, `qa_reports/`, `review_reports/`, `specs/`, `design/`) is runtime growth, so eject cannot be "undo init": it must enumerate its own removal set. The backlog row's four-class disposition is the design: (i) machine state (`.current/*`) — remove; (ii-a) domain knowledge (`design/`, `specs/`) — KEEP by default (E107 made these generically readable project documentation, not agc artifacts); (ii-b) process evidence (`qa_reports/`, `review_reports/`, `tasks.md`, `docs/backlog.md`) — remove; (iii) host traces (the `CLAUDE.md` adapter block, the `.git/info/exclude` artifact rules) — remove. This spec cuts that work under E106's `artifacts` key (local/repo/undeclared) and reuses E239's subdirectory-prefix reconstruction helpers so eject can precisely reverse whatever a given workspace's `agc init` wrote.

## User Stories
- As an adopter who has decided to stop using agc, I want `agc eject` to show me exactly what it will remove before it touches anything, so I can review the plan first.
- As an adopter running `agc eject --yes` on a `local`-artifacts workspace, I want the untracked governance state actually deleted, so my working tree is clean without a leftover mess only agc understood.
- As an adopter running `agc eject --yes` on a `repo`-artifacts workspace (or one where an artifact path is tracked despite `local` mode), I want agc to tell me the exact `git rm` command instead of silently rewriting my git state, so I stay in control of a change that affects git history.
- As an adopter who wants a completely clean slate, I want `--purge-knowledge` to additionally offer to remove `design/`/`specs/`, but never by default, so I don't lose my only rationale record by accident.
- As an adopter, I want `agc eject` to tell me plainly which three (or four) things it cannot do for me — rewrite git history, edit code comments, edit my host's MCP/settings registration, or remove the machine-wide `~/.claude/agents/` templates — so I'm never left assuming the tool did more than it did.
- As an adopter running `agc eject` a second time after everything is already gone, I want it to say there's nothing left to do, not error or recreate anything.

## Acceptance Criteria

- **AC1** — Given a workspace with `.current/.config.json` declaring `"artifacts": "local"`, `.current/`, `tasks.md`, `qa_reports/`, `review_reports/` present and genuinely untracked, `design/`/`specs/` present and tracked, a `CLAUDE.md` with the agc adapter block, `AGENTS.md`/`.antigravityrules` byte-identical to the installed template, and the artifact exclude rules present in `.git/info/exclude`, when `agc eject` runs with no flags, then it prints a plan naming: machine state (`.current/`) as DELETE, process evidence (`qa_reports/`, `review_reports/`, `tasks.md`) as DELETE, `docs/backlog.md` as NOT DELETED (flagged for manual review), `design/`/`specs/` as KEPT (would need `--purge-knowledge`), the `CLAUDE.md` block as REMOVE, `AGENTS.md`/`.antigravityrules` as DELETE, the exclude rules as REMOVE, and the full "cannot do" block — AND makes zero filesystem changes — and exits 0.
  proof: `test/e108-eject.test.mjs` case "AC1: dry-run prints the full four-class plan, touches nothing"

- **AC2** — Given the AC1 setup, when `agc eject --yes` runs, then `.current/`, `tasks.md`, `qa_reports/`, `review_reports/` are gone from disk; `docs/backlog.md` still exists, unchanged; `design/`/`specs/` still exist, unchanged; `CLAUDE.md` is gone (it held only the adapter block — AC9; the has-other-content case is AC8); `AGENTS.md`/`.antigravityrules` are gone; the artifact exclude lines are gone from `.git/info/exclude`; the "cannot do" block is still printed; exit 0.
  proof: `test/e108-eject.test.mjs` case "AC2: --yes executes exactly the AC1 plan"

- **AC3** — Given the AC1 setup after AC2 (or a fresh equivalent) with `design/`/`specs/` tracked, when `agc eject --purge-knowledge` runs (no `--yes`), then the printed plan additionally lists `design/`/`specs/` as a candidate for removal but states that, being tracked, the disposition is "print the `git rm -r` command, never run it" — and no files are touched (still a dry-run without `--yes`).
  proof: `test/e108-eject.test.mjs` case "AC3: --purge-knowledge alone is still a dry-run and reports design/specs as tracked"

- **AC4** — Given the AC3 setup, when `agc eject --yes --purge-knowledge` runs, then `design/` and `specs/` are NOT deleted from the working tree (they are tracked), the exact `git rm -r design specs` command is printed to stderr with the same "history still contains these files" note used elsewhere in this tool, and every other AC2 disposition still applies; exit 0.
  proof: `test/e108-eject.test.mjs` case "AC4: --yes --purge-knowledge prints git rm for tracked design/specs, does not delete them"

- **AC5** — Given a workspace with `.current/.config.json` declaring `"artifacts": "repo"` and `.current/`, `tasks.md`, `qa_reports/`, `review_reports/` all genuinely tracked, when `agc eject --yes` runs, then NONE of those four paths are deleted from the working tree or the index — instead ONE consolidated `git rm -r <paths>` command covering all four is printed to stderr, with the history-retention note — while the `CLAUDE.md` block, `AGENTS.md`/`.antigravityrules`, and any exclude-file cleanup (a no-op here, since `repo` mode never wrote exclude rules) still run exactly as in AC2; exit 0.
  proof: `test/e108-eject.test.mjs` case "AC5: repo-mode tracked artifacts get a git rm command, never a delete"

- **AC6** — Given `.current/.config.json` has NO `artifacts` key (undeclared), `.current/` and `qa_reports/` are genuinely untracked, but `tasks.md` is genuinely tracked (a mixed/legacy state), when `agc eject --yes` runs, then `.current/` and `qa_reports/` are deleted from disk while `tasks.md` is left untouched and named in a printed `git rm -r tasks.md` command — proving the disposition is decided PER-PATH from actual git-tracked state (the same `git ls-files` test E106/E239 already use), never from the declared `artifacts` value, which here is absent entirely.
  proof: `test/e108-eject.test.mjs` case "AC6: disposition is per-path on actual tracked state, independent of the declared artifacts value"

- **AC7** — *(human ruling 2026-09-28: ii-a, per integrator recommendation)* Given `docs/backlog.md` present, when `agc eject` runs without `--purge-knowledge` (with or without `--yes`), then `docs/backlog.md` is classed with domain knowledge (ii-a) and KEPT, with a line noting it may be this project's plan and is removed only under `--purge-knowledge`; when `--purge-knowledge` is given, it follows the same per-path rule as `design/`/`specs/` (untracked → deleted under `--yes`; tracked → named in the consolidated `git rm -r` line, never deleted by agc).
  proof: `test/e108-eject.test.mjs` case "AC7: docs/backlog.md is kept by default and handled as domain knowledge under --purge-knowledge"

- **AC8** — Given `CLAUDE.md` contains the agc adapter block PLUS the adopter's own prose outside the `<!-- BEGIN/END agc-adapter -->` markers, when `agc eject --yes` runs, then only the marked block (markers inclusive) is removed — every byte outside the markers is preserved — the file is rewritten in place (not deleted), and one line notes the file was edited, not removed.
  proof: `test/e108-eject.test.mjs` case "AC8: CLAUDE.md with user prose keeps the prose, loses only the marked block"

- **AC9** — Given `CLAUDE.md`'s entire content IS the adapter block (no other prose, matching a fresh `agc init` that created the file), when `agc eject --yes` runs, then the whole file is deleted (not left as an empty file).
  proof: `test/e108-eject.test.mjs` case "AC9: CLAUDE.md holding only the block is deleted entirely"

- **AC10** — Given `CLAUDE.md` is absent, OR present with no `<!-- BEGIN/END agc-adapter -->` markers at all, when `agc eject` runs (with or without `--yes`), then it makes no change to `CLAUDE.md` and prints nothing alarming about it (silent skip — same "absent/no-op is not an error" posture as every other check in this file).
  proof: `test/e108-eject.test.mjs` case "AC10: CLAUDE.md absent or unmarked is silently skipped"

- **AC11** — Given `AGENTS.md` and `.antigravityrules` are each byte-identical to the currently-installed template (`templates/agent-adapters/{codex.md,antigravity.md}`) once the version stamp is normalized back to `{{AGC_VERSION}}` (i.e. the file is exactly what SOME version of `agc init` wrote and nothing else touched it), when `agc eject --yes` runs, then both files are deleted entirely.
  proof: `test/e108-eject.test.mjs` case "AC11: template-identical AGENTS.md/.antigravityrules are deleted"

- **AC12** — Given `AGENTS.md` or `.antigravityrules` does NOT byte-match its template after stamp normalization (the adopter appended, edited, or the installed template's wording has since changed), when `agc eject` runs, then that file is NOT deleted under any flag combination, and a dedicated advisory names it as ambiguous — "may hold content beyond agc's own template" — instructing the adopter to review and remove it by hand; exit 0 (advisory, not an error).
  proof: `test/e108-eject.test.mjs` case "AC12: a non-template-matching AGENTS.md/.antigravityrules is flagged, never deleted"

- **AC13** — Given `AGENTS.md` and `.antigravityrules` are both absent, when `agc eject` runs, then nothing is printed about either and nothing errors.
  proof: `test/e108-eject.test.mjs` case "AC13: absent adapter files are silently skipped"

- **AC14** — Given the shared `.git/info/exclude` holds BOTH this workspace's `ARTIFACT_EXCLUDE_RULES`-shaped lines AND unrelated `LANE_EXCLUDE_RULES` lines (`.env`, `/node_modules`, `/.current/**/base-sha`) left by an `agc feature start` elsewhere, when `agc eject --yes` runs, then only the artifact-exclude lines for THIS workspace's prefix are removed — the lane-exclude lines and any other unrelated line are byte-identical afterward.
  proof: `test/e108-eject.test.mjs` case "AC14: exclude-line removal never touches LANE_EXCLUDE_RULES or unrelated lines"

- **AC15** — Given cwd = `<repo>/sub`, where an earlier `agc init` (E239) wrote the subdir-prefixed exclude rules (`/sub/.current/`, etc.) and `sub/.current/.config.json`, and a SEPARATE root workspace in the same repo has its own artifacts declared and its own root-anchored exclude rules, when `agc eject` (dry-run) and `agc eject --yes` run from `<repo>/sub`, then every path computed and every exclude line removed is the subdir-prefixed set for `sub/` only — the root workspace's own `.current/`, `tasks.md`, etc. and its root-anchored exclude lines are completely untouched.
  proof: `test/e108-eject.test.mjs` case "AC15: subdirectory eject never touches a sibling root workspace's artifacts"

- **AC16** — Given cwd is inside a linked git worktree (a lane), when `agc eject` runs (with or without any flags), then it refuses immediately — before computing or printing any plan — naming the primary checkout to run it from instead (same message shape as `agc feature start/finish`'s existing linked-worktree refusal), makes zero filesystem changes, and exits 1.
  proof: `test/e108-eject.test.mjs` case "AC16: eject refuses inside a linked worktree, same as feature start/finish"

- **AC17** — Given cwd is not inside any git repository, with `.current/`, `tasks.md`, `qa_reports/`, `review_reports/` present as plain directories/files, when `agc eject --yes` runs, then all four are still deleted (plain filesystem removal needs no git), no `git rm` command is ever printed (there is no possible tracked state without git), the exclude-rule removal step is skipped with a one-line note (mirrors e106 AC14's outside-git precedent), and it exits 0 with no crash.
  proof: `test/e108-eject.test.mjs` case "AC17: outside a git repo, plain deletion still runs and exclude cleanup is skipped with a note"

- **AC18** — Given a workspace where every eject-managed artifact is already absent (a second `agc eject --yes` run, or a workspace that never had them), when `agc eject` or `agc eject --yes` runs, then it prints a single "nothing to eject" line, makes no changes, and exits 0 — idempotent, no error, no partial recreation of anything.
  proof: `test/e108-eject.test.mjs` case "AC18: idempotent second run reports nothing to eject"

- **AC19** — Given any invocation of `agc eject` (dry-run or `--yes`, with or without `--purge-knowledge`), when it runs, then its output always includes, verbatim, the three-plus-one "cannot do" statements: it does not rewrite git history (files ever tracked survive there); it does not edit code comments (citations to `specs/`/ticket ids are not machine-decidable); it does not edit the host's MCP/settings registration (prints the Claude Code removal command, and tells other hosts to remove this server's entry from their MCP config file by hand); and it does not delete the machine-wide `~/.claude/agents/*.md` subagent templates (listing the ones present, stating they may be in use by other projects on this machine, and printing the manual `rm` command).
  proof: `test/e108-eject.test.mjs` case "AC19: the cannot-do block is always present, in both dry-run and --yes output"

- **AC20** — Given `agc eject` (any flag combination) is run with stdin closed, when it runs, then it completes without ever reading from stdin and without hanging — no interactive confirmation exists (same non-interactive posture as `init`/`check`/`feature`).
  proof: `test/e108-eject.test.mjs` case "AC20: eject never prompts, runs to completion with stdin closed"

- **AC21** — Given `agc eject --bogus-flag`, when it runs, then it exits 2 and prints a usage-shaped error to stderr naming the unknown flag, making no filesystem changes.
  proof: `test/e108-eject.test.mjs` case "AC21: an unknown flag is a usage error, exit 2, no changes"

- **AC22** — Given the top-level usage text (`agc` with no subcommand, or an unknown subcommand), when it prints, then it lists `eject` alongside `init`, `check`, and `feature`, with a one-line description matching this spec's Copy/Strings `eject.usage.summary`.
  proof: `test/agc-adapters.test.mjs` extended case "AC22: top-level usage text lists eject" (qa-owned extension, per this lane's ownership carve-out)

- **AC23** — Given `docs/install.md`, when a reader looks up `agc eject`, then a new passage documents: the default dry-run behavior, `--yes`, `--purge-knowledge`, the four-class disposition table, and the three-plus-one things it cannot do.
  proof: `grep -n 'agc eject' docs/install.md` shows a passage covering all five points above

- **AC24** — Given any `agc eject` run inside a git repo, when the plan prints, then its header names the declared `artifacts` mode (`local`, `repo`, or `undeclared`); when mode is `local` and any artifact path is tracked, one line notes that local mode was not in effect for those paths; and when any path will be deleted from disk because it is untracked, one line states that those deletions have no git recovery.
  proof: `test/e108-eject.test.mjs` case "AC24: plan header reports the declared artifacts mode and the no-recovery note"

- **AC25** — Given the repo has at least one linked worktree (`git worktree list` shows more than the primary), when `agc eject --yes` runs from the primary, then it refuses before any change, names each linked worktree, and exits 1; `agc eject` without `--yes` still prints the plan plus the same warning and exits 0.
  proof: `test/e108-eject.test.mjs` case "AC25: --yes refuses while linked worktrees exist; dry-run warns"

## Copy / Strings

| string id | exact text (quote verbatim) | source |
|---|---|---|
| eject.usage.summary | `eject [--yes] [--purge-knowledge]\n          Print (default) or execute (--yes) the removal plan for agc's own\n          runtime artifacts, process evidence, and host traces. --purge-knowledge\n          additionally offers to remove design/ and specs/ (never by default).\n          Never interactive. See docs/install.md for the full disposition table.` | authored-here — mirrors the existing `init`/`check`/`feature` summary voice in `STR_USAGE`/`STR_USAGE_FEATURE` |
| eject.usage.unknown-flag | `agc eject: unknown option <flag>` | authored-here — mirrors `agc feature: unknown option <flag>` (`parseFeatureArgs`) |
| eject.refuse.linked-worktree | *(reused verbatim — not authored here)* the exact message `resolvePrimaryRepoRoot(cwd, "eject")` already produces for `feature start`/`finish` | reused — `bin/agc-init.mjs`'s existing `resolvePrimaryRepoRoot` function, called with `verb="eject"` |
| eject.plan.header.dry-run | `agc eject — plan for <cwd> (dry-run; re-run with --yes to apply):` | authored-here |
| eject.plan.header.apply | `agc eject — applying to <cwd>:` | authored-here |
| eject.class.machine-state | `(i) machine state — <path>: <disposition>` where `<disposition>` is one of `DELETE`, `deleted`, or (only outside git, per AC17) `deleted (no git repo — nothing to check-ignore)` | authored-here — one line per path, same per-path-line convention as `init.local.already-tracked-warning`'s `<path>\n  ...` |
| eject.class.process-evidence | `(ii-b) process evidence — <path>: <disposition>` — same disposition vocabulary as machine-state | authored-here |
| eject.class.domain-knowledge.kept | `(ii-a) domain knowledge — <path>: KEPT (pass --purge-knowledge to remove; never the default)` — for `docs/backlog.md` the line adds ` — may be this project's plan` | authored-here |
| eject.class.domain-knowledge.purge | `(ii-a) domain knowledge — <path>: <disposition>` under `--purge-knowledge`, same disposition vocabulary as machine-state | authored-here |
| eject.class.host-traces.claude-md | one of: `(iii) host traces — CLAUDE.md: adapter block removed (file deleted, held only the block)` / `(iii) host traces — CLAUDE.md: adapter block removed (file kept, other content preserved)` / `(iii) host traces — CLAUDE.md: no adapter block found — nothing to do` | authored-here |
| eject.class.host-traces.adapter-file.deleted | `(iii) host traces — <path>: deleted (matched the installed template)` | authored-here |
| eject.class.host-traces.adapter-file.ambiguous | `(iii) host traces — <path>: KEPT — may hold content beyond agc's own template; review and remove by hand` | authored-here |
| eject.class.host-traces.exclude | `(iii) host traces — .git/info/exclude: removed <n> artifact exclude line(s)` / `(iii) host traces — .git/info/exclude: nothing to remove` / `(iii) host traces — .git/info/exclude: skipped (not inside a git repository)` | authored-here |
| eject.tracked.git-rm-command | `The following are tracked and were left untouched (agc does not run git rm):\n  <path>\n  ...\nRemove them (from the index and the working tree) with:\n  git rm -r <targets>\nNote: history still contains these files after that command.` | authored-here — reuses the exact voice and the same "history still contains" caveat as `init.local.already-tracked-warning` (e106 spec), generalized to any of the four disposition classes rather than only machine-state |
| eject.plan.header.mode | `  declared artifacts mode: <local\|repo\|undeclared>` | authored-here (AC24) |
| eject.plan.local-not-honoured | `  note: local mode was not in effect for the tracked path(s) listed below` | authored-here (AC24) |
| eject.plan.no-recovery | `  untracked paths marked DELETE have no git recovery — once deleted they are gone` | authored-here (AC24) |
| eject.refuse.live-worktrees | `agc eject: refusing --yes — linked worktree(s) still exist and would be stranded:\n  <path>\n  ...\nFinish or remove them first (agc feature finish).` (dry-run prints the same list prefixed `warning:` and continues) | authored-here (AC25) |
| eject.tracked.host-trace-changed | `Tracked host-trace file(s) were changed in the working tree — this is uncommitted; review and commit it yourself:\n  <path> (edited\|deleted)\n  ...` (printed only under `--yes` when at least one tracked host-trace file was edited or deleted; the dry-run lists the same paths under `will change tracked file(s) — uncommitted until you commit`) | authored-here (AC5 clarification, integrator 2026-09-28) |
| eject.nothing-to-eject | `agc eject — nothing to eject.` | authored-here — mirrors `init`'s existing `All files already exist — nothing to do.` |
| eject.cannot-do | `agc eject cannot do the following — review and act on these yourself:\n  1. Rewrite git history: any of the above that was ever tracked remains in git history even after this command untracks or deletes it.\n  2. Edit code comments: citations to specs/, qa_reports/, review_reports/, or ticket/AC ids inside source comments are not machine-decidable and are left as-is.\n  3. Edit your host's MCP/settings registration: this server's entry in .mcp.json, ~/.claude.json, or an equivalent settings file is untouched. Claude Code:\n       claude mcp remove -s user agent-governance-mcp\n     Other hosts: remove this server's entry from their MCP config file by hand.\n  4. Remove the machine-wide subagent templates in ~/.claude/agents/: they may be in use by other projects on this machine, so eject never deletes them. Present:\n       <file>\n       ...\n     Remove them yourself with:\n       rm <files>` | authored-here — required verbatim per backlog E108 row's three things (1-3) plus this ticket's own reasoned fourth addition (~/.claude/agents is host-global, not per-workspace — flagged for human sign-off since the backlog row names only three) |

## Cut amendments (integrator pre-review, 2026-09-28)
- Tracked paths: the printed command is `git rm -r <paths>` (removes from index AND working tree), not `--cached` — `--cached` would leave the files on disk as local artifacts. agc still never deletes a tracked path in classes (i), (ii-a) or (ii-b) itself. Host traces (iii) are the exception AC5 already requires: a tracked `CLAUDE.md` is edited and tracked `AGENTS.md`/`.antigravityrules` template copies are deleted from the working tree under `--yes` — both recoverable through git. Under `--yes` the output names every tracked host-trace file it edited or deleted and states the change is uncommitted working-tree state for the user to review and commit (Copy/Strings `eject.tracked.host-trace-changed`; QA round 1 found it missing).
- `docs/backlog.md` moves to domain knowledge (ii-a): kept by default, handled under `--purge-knowledge` (AC7) — human ruling 2026-09-28: approved.
- Cannot-do item 3 prints the Claude Code removal command; item 4 (machine-wide subagent templates) lists the files and the `rm` command, print-only — human ruling 2026-09-28: approved.
- AC24 (declared mode visible in the plan) and AC25 (`--yes` refuses while linked worktrees exist) added; AC2 wording fixed.
- Task split for the `task_size` budget. The T-E108-01 task row text is superseded by this map:

| task | owner | ACs |
|---|---|---|
| T-E108-01 | sr-engineer | AC1, AC2, AC3, AC4, AC5, AC6, AC7, AC15, AC16, AC17, AC18, AC19, AC20, AC21, AC24, AC25 — flags, plan/apply engine, classes (i)/(ii-a)/(ii-b), tracked `git rm -r` line, refusals, cannot-do block |
| T-E108-03 | sr-engineer | AC8, AC9, AC10, AC11, AC12, AC13, AC14, AC22, AC23 — host traces (CLAUDE.md block, AGENTS.md/.antigravityrules, exclude-line removal), top-level usage text, docs/install.md passage |
| T-E108-02 | qa-engineer | AC1–AC25 tests (`test/e108-eject.test.mjs`, AC22 in `test/agc-adapters.test.mjs`), AC23 grep proof, full suite |

## Visual Tokens
| token id | property | value (quote verbatim) | source |
|---|---|---|---|
| N/A | — | — | feature has no visual literals (CLI-only) |

## Visual Widgets
| widget id | description | source-node |
|---|---|---|
| N/A | — | feature has no non-primitive widgets |

## Out of Scope
- Any config schema change — no new `.current/.config.json` key, no `schema_version` bump; eject only reads the existing `artifacts` key (E106) and the actual git-tracked state.
- Any SOP/`content/**` prose change.
- `agc feature start`'s `LANE_EXCLUDE_RULES` (`.env`, `/node_modules`, `/.current/**/base-sha`) — untouched; a lane's own teardown is `agc feature finish`, a different mechanism and a different ticket (E73/E179).
- Retroactively rewriting git history, or running any git mutation beyond the sanctioned list (Constitution §6: `git add`, `git commit`, `git tag`, fast-forward `git push`, `git stash`/`git stash pop`) — `git rm` is not on that list, so eject prints it, never runs it, for any tracked path in any class.
- Editing code comments that cite `specs/`/`qa_reports/`/ticket ids (H6/H7 territory) — named in the "cannot do" block, not attempted.
- Editing `.mcp.json`, `~/.claude.json`, or any host's `settings.json` MCP-server registration — named in the "cannot do" block, not attempted.
- Deleting the machine-wide `~/.claude/agents/*.md` subagent templates (`templates/claude-code-agents/` installed copies) — these are per-machine, shared across every agc-managed project, installed by a manual `cp` step per `README.md`/`docs/architecture.md`, not by `agc init`; a per-project eject must not delete state another project depends on. Print-only, per the "cannot do" block's fourth item.
- Any interactive confirmation prompt — flag-only (`--yes`, `--purge-knowledge`), matching H8 decision 1's established non-interactive precedent; `agc eject` commonly runs inside an agent session where a readline prompt hangs.
- A dedicated `--path <dir>` flag (unlike `agc feature start`) — eject always operates on `cwd`, matching `agc init`'s existing convention.
- Committing or staging anything eject changes — eject only ever mutates the working tree (plain `fs` writes/deletes, never a git command that stages or commits), exactly like `agc init` today; the adopter commits the result themselves when ready.

## Dependencies / Prerequisites
- Builds on `specs/e106-init-artifacts-flag.md` (shipped) and `specs/e239-init-subdir-exclude.md` (shipped, this lane) — does not re-open either's settled decisions.
- **Core reuse, no duplication** (exact naming at sr-engineer's discretion; behavior below is load-bearing):
  - `repoRelativeWorkspacePrefix(repoRoot, cwd)`, `artifactExcludeRulesForPrefix(prefix)`, `artifactPathsForPrefix(prefix)`, `trackedArtifactPaths(repoRoot, artifactPaths)` (all from E239) are the exact functions that let eject reconstruct, for any workspace (root or subdirectory), precisely which rules and paths a given `agc init` wrote. Eject's default disposition set (classes i + ii-b minus `docs/backlog.md`) is exactly `artifactPathsForPrefix(workspace.prefix)` — no new path-list constant needed for that part.
  - `--purge-knowledge`'s `design`/`specs` set needs the same shape (display/target pairs, prefix-aware, tracked-checkable) but a different base rule pair — generalize `artifactPathsForPrefix`/`artifactExcludeRulesForPrefix` to take the base rule array as a parameter (the same generalization `upsertSharedExclude` already went through for `LANE_EXCLUDE_RULES` vs `ARTIFACT_EXCLUDE_RULES`) rather than hand-rolling a second, near-duplicate function pair.
  - `docs/backlog.md` is NOT part of the default (i)+(ii-b) set. Human ruling 2026-09-28: it is domain knowledge (ii-a) — kept by default, and under `--purge-knowledge` it follows the same per-path rule as `design/`/`specs/` (untracked → deleted under `--yes`; tracked → named in the `git rm -r` line). Reason it is not (ii-b): in a repo where the backlog doubles as the PRD, deleting it by default destroys the project's plan.
  - **Human ruling 2026-09-28 (approved)**: the "cannot do" block's fourth item (`~/.claude/agents/*.md`) is this spec's own addition beyond the three things the backlog row names (git history, code comments, host settings). The reasoning (host-global, shared across every agc-managed project on the machine, never written by `agc init` in the first place) is in this spec's Dependencies section above — confirm it belongs in the standing "cannot do" contract.
  - `writeClaudeBlock`'s `CLAUDE_BEGIN`/`CLAUDE_END` marker constants are reused for the reverse operation (strip-block-in-place, or delete-whole-file when the block is the file's only content) — a new function (e.g. `removeClaudeBlock`), not a rewrite of `writeClaudeBlock` itself.
  - `resolvePrimaryRepoRoot(cwd, verb)` is reused as-is (`verb = "eject"`) for the linked-worktree refusal (AC16) — same message shape as `feature start`/`finish`, no new refusal text authored.
  - `atomicWriteFile` is reused for any in-place rewrite (`CLAUDE.md`'s block-stripped content, `.git/info/exclude` with lines removed) — same atomic tmp-file-plus-rename discipline as every other mutator in this file.
  - The AGENTS.md/.antigravityrules "byte-matches-template" test (AC11/AC12): read the file, regex-replace the found `STAMP_RE` version back to the literal placeholder token the raw template file uses (`{{AGC_VERSION}}`), and compare to the raw template read via `stampTemplate`'s own template-loading path (not `stampTemplate` itself, which substitutes a version in rather than out) — an exact match means the file is still exactly what some version of `agc init` wrote and nothing else touched it; any other result (no stamp found, stamp found but body differs, or the file predates `templates/agent-adapters/` changes) keeps the file (AC12), never guesses.
- **Test-ownership note** (`docs/lane-protocol.md` §3): only qa-engineer may touch `test/`. New file `test/e108-eject.test.mjs` is qa-engineer's; qa-engineer may also extend `test/agc-adapters.test.mjs` for AC22 (top-level usage text), per this lane's ownership carve-out (both files are in-lane).
- No architect hop: same class as E106/E239 — one new subcommand in `bin/agc-init.mjs`, reusing already-shipped helpers, no new data model, no cross-cutting API, no schema change. Routed directly to sr-engineer. `dispatch_mode: "feature"` (chain: pm → sr-engineer → code-reviewer → qa-engineer; architect and design-auditor skipped).
- Resource Audit Gate: zero external references found load-bearing to this ticket's own requirements (no URLs, Figma/Sketch/mockup links, or external ticket refs beyond the in-repo `specs/e106-init-artifacts-flag.md`, `specs/e239-init-subdir-exclude.md`, and `docs/backlog.md` E108 row already read) — `external_refs` omitted from the routing write.
