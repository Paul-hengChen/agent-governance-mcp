# e381-fanout-and-ledger-fixes

Lane `e381` of `specs/fanout-backlog-wave-a.md` (Lanes row `e381`; Decisions 2026-11-09). Tickets: E381 (owned-cell prose tokenized as owned globs), E390 (`check --base` default), E388 (tracked non-agc file becomes a lane ledger). Spec source: the three `docs/backlog.md` rows, the manifest's site list and Decisions. No architect hop (manifest ruling).

Line numbers below were re-checked against the dispatch base `2425e04`.

## Problem Statement

Three small defects in the fan-out and ledger tooling. (1) E381: the fan-in ownership check reads every path-shaped backtick span in a lane's `擁有` cell as owned. Real cells carry explanatory clauses such as "其他跑 `scripts/**` 的 `test/**`（只限被本 lane 改變的行為斷言，…）" (wave 12 lanes e158, e161, e152, e367; wave 10/11 lanes e135, e139, e217). The clause becomes a bare `test/**` token, so `fanout.mjs check` and `check --cut` accept any test file, and only the hand-checked list stops an out-of-scope test edit. Exclusions written in parentheses become grants too: "`specs/**`（`specs/fanout-*.md` 除外）" granted `specs/fanout-*.md`. (2) E390: `fanout.mjs check <manifest> <lane>` defaults `--base` to `main`. In a repo whose integration target is not `main`, it stops at `REF_NOT_FOUND` naming neither `--base` nor where the default came from; `handoff --check` already fixed the same defect class (E386). (3) E388: in a repo that git-ignores `.current/` but tracks a `TODO.md` or root `tasks.md`, a linked lane worktree adopts that tracked team file as its `tw_*` ledger, so the lane's task rows are written into, and committed with, a team file.

## User Stories

- As an integrator, I want `fanout.mjs check` to grant only the paths a lane's `擁有` cell actually lists, so that an explanatory clause never silently widens a lane to a whole directory.
- As an integrator in a repo whose integration branch is not `main`, I want `check` without `--base` to use the target branch the manifest records, and to tell me about `--base` when that fails, so that I am not stopped by a `main` default I never chose.
- As a lane session in a team repo that ignores `.current/`, I want my task rows to stay in `.current/<lane>/tasks.md`, so that I never commit agc rows into the team's tracked `TODO.md` or `tasks.md`.

## Decisions

| id | decision | why |
|---|---|---|
| D-E381 | **Option 1 of the row: skip backticked globs inside a parenthesised or prose clause, in the `擁有` cell only.** New exported `ownedPathTokens(cell)` beside `pathTokens` in `tools/fanout-manifest.ts`; `parseManifest` uses it for `ownedTokens` (`:580`). `pathTokens` itself, `forbiddenTokens` (`:609`) and the Cut `touches` tokens (`:1898`) are unchanged. Rule: the cell splits into list items at `、` `，` `,` `；` `;` that sit outside backtick spans and outside parentheses. A span that is a glob (`isGlobToken`: contains `*` or `{`, or ends with `/`) is **not** an owned token when (a) it sits inside a parenthesis, ASCII `( … )` or full-width `（ … ）`, at any depth; or (b) its list item is a prose clause: the item's text before its first depth-0 backtick span is non-blank once one leading role label (`<label>：` or `<label>:`, no whitespace before the colon) and then the new-file marker `新檔` are removed. Non-glob spans are tokenized exactly as today. | **Why option 1.** It removes the cause (prose read as a grant) in every real instance: all seven real `test/**` grants come from prose-led items, and the one real parenthesised exclusion (`specs/fanout-*.md`) becomes a non-grant. Errors fall in the loud direction: a dropped grant shows as an `OUT` line the integrator reads, never as a silent pass. **Why globs only.** A concrete path grants one file and is already caught by the E208 unmatched-token warning when it is a prose aside; E208 skips globs, so globs are where the gap is. Dropping concrete paths in parentheses would also turn red `test/e178b-fanout-unmatched.test.mjs` AC19 (outside this lane). **Why the label / `新檔` allowance.** A `qa：新檔` prefix before a glob is the declared-new-file idiom the code already names (`unmatchedOwnedTokens` doc, `:1567`); without it the wave-7 fixture's legitimate `test/e177a-*.test.mjs` grant drops and AC19 goes red. **Why owned only.** `forbiddenTokens` only annotates `OUT` lines with `(禁止: …)`; forbidden cells are mostly prose, and running the rule on them would drop dozens of annotations across real manifests (including wave A's e230 `gates/registry.ts`). Over-reading forbidden is the safe direction. **Option 2 rejected** (move clauses to their own column): it changes the manifest format, which the manifest rules out ("不做：改 manifest 格式"). **Option 3 rejected** (warn on a bare `test/**` / `**`): a warning leaves the grant in place, so the machine check still passes out-of-scope files; it also hard-codes this repo's test directory into a generic agc tool, and it misses the other real prose globs (a `dist/**` behind 上列檔案對應的, the parenthesised `specs/fanout-*.md`). |
| D-E390 | **`runCheck` resolves the default base from the manifest text the same way E386 resolves `handoff --check`'s target.** Without `--base`: take the single `## 接手步驟` section (`findHandoffSections`, already in `tools/fanout-manifest.ts`), find its single `- 目標分支：<value>` fact line, and use group 1 of `^(.+) @ ([0-9a-f]{7,40})$`; otherwise (no section, more than one section, no fact line, more than one fact line, unparseable value) use `main`. `CheckOptions` gains `baseSource?: "flag" \| "manifest" \| "default"`; `checkLane` keeps `opts.base ?? "main"` and defaults the source the way `collectFacts` does (`flag` when `base` is given, else `default`), and picks the base `REF_NOT_FOUND` message by source. | **No import from `tools/fanout-handoff.ts`.** It imports `parseManifest` and other bindings from `tools/fanout-manifest.ts`, so a static import back would create a module cycle and pull `lane-status` into every `check` run; `scripts/fanout.mjs` deliberately loads handoff only for `handoff` ("so the other subcommands keep their import graph"), and `runCheck` is synchronous, so a dynamic import does not fit. `TARGET_FACT_RE` is module-private there. The resolver is therefore about 15 lines in `tools/fanout-manifest.ts` reusing the shared `findHandoffSections`, and the two commands are pinned to agree by AC-E390-6. Library callers that pass no `base` keep `main` (`test/e177a-check-cli.test.mjs` pins `report.base === "main"`). |
| D-E388 | **Direction 1 of the row: exclude git-tracked files from the legacy lookup in linked lane worktrees.** In `resolveTasksLedgerPath` (`tools/tasks-lane-migrate.ts:357-364`), on the option-A branch (lane ledger absent, lane path ignored), when the current lane is not `_primary` and the workspace is a linked worktree (`isLinkedWorktree`, `:340`), the legacy candidate is the first `resolveTaskPaths` candidate that `findLegacyTasksFile` would accept **and** that git does not track (`git ls-files --error-unmatch -- <rel>` exits non-zero). A git error counts as not tracked, which keeps today's behaviour. With no such candidate, the existing E383 branch returns the lane ledger. Primary checkouts, the `_primary` lane, and untracked or ignored legacy files keep today's resolution. `tools/config.ts` is not touched. | **Why direction 1.** It is exactly the defect: a lane writing into a tracked team file, which only happens in a linked lane worktree of an ignore-`.current/` repo. **Direction 2 rejected** (require `taskPaths` to opt into `TODO.md`): it changes the default for every adopter, primary checkouts included, where E125a AC4b deliberately keeps an existing legacy ledger; `TODO.md` is also a documented workspace marker (`docs/install.md`, `docs/config.md`, `README.md`) and `test/p0-onboarding-lite-default.test.mjs` uses it; and it does not cover a tracked root `tasks.md`. **E383 AC4b semantics.** AC4b (an existing legacy file stays the ledger when the lane path is ignored) still holds in a primary checkout and for every untracked legacy file. In a linked lane worktree it no longer holds for a tracked file. That narrowing is the ticket; the E383 rationale ("keeps a lane opened before this fix on the ledger it already has") is about agc's own ignored ledgers, which stay. **`tw_get_next_task` advisory.** `tasksLaneAdvisory` derives from `resolveTasksLedgerPath`, so a linked lane worktree that skipped a tracked file gets no advisory (the ledger is the lane path); a primary checkout with a tracked `TODO.md` still gets the advisory naming it. **Residual risk.** A lane that already wrote rows into a tracked file before this change switches to an empty lane ledger after it; the rows stay in the tracked file and show in `git status`. Not coded around (the defect is that those rows are there at all). |

## Acceptance Criteria

### E381 — owned-cell clause tokens

- **AC-E381-1 (prose-led glob is not owned)** — Given an `擁有` cell `` `scripts/**`、其他跑 `scripts/**` 的 `test/**`（只限被本 lane 改變的行為斷言）、`test/e9-x.test.mjs` ``, when it is parsed, then the lane's `ownedTokens` are exactly `["scripts/**", "test/e9-x.test.mjs"]`. The same holds for the English form `` `scripts/**`, other `test/**` that run `scripts/**` `` (owned: `["scripts/**"]`) and for an item `` 上列檔案對應的 `dist/**` `` placed after another owned item (no token from that item).
  proof: `node --test test/e381-owned-clause-tokens.test.mjs` (AC-E381-1 cases).
- **AC-E381-2 (parenthesised glob is not owned, both paren forms)** — Given `` `specs/**`（`specs/fanout-*.md` 除外） `` and `` `specs/**` (except `specs/fanout-*.md`) ``, when parsed, then `ownedTokens` is `["specs/**"]` in both. A glob nested two parentheses deep is also dropped.
  proof: `node --test test/e381-owned-clause-tokens.test.mjs` (AC-E381-2 cases).
- **AC-E381-3 (what stays owned)** — Given each of these items, when parsed, then every listed span stays owned: `` `test/fixtures/compose-golden/**`（coordinator monolith 那一檔除外；只在動憲法時） `` (a glob followed by a parenthesised qualifier) → `test/fixtures/compose-golden/**`; `` qa：新檔 `test/e9-*.test.mjs` 與 `test/fixtures/e9/**`（建立已預先授權） `` → both globs; `` 新檔 `tools/x.ts` `` → `tools/x.ts`; `` `tools/a.ts` 與其 `dist/tools/a.*` `` → both; `` `scripts/fanout.mjs`（同 `feature-rollup.mjs` 模式） `` → both (concrete paths are unchanged; the parenthesised one stays an E208 warning candidate).
  proof: `node --test test/e381-owned-clause-tokens.test.mjs` (AC-E381-3 cases).
- **AC-E381-4 (wave A manifest unchanged)** — Given the real `specs/fanout-backlog-wave-a.md` at review time, when every dispatchable lane's `ownedTokens` is compared with `pathTokens(owned)` (the unchanged pre-E381 tokenizer, same build), then they are equal for all five lanes, and `node scripts/fanout.mjs validate specs/fanout-backlog-wave-a.md` exits 0. Review-time check only: no resident test asserts the real manifest's content.
  proof: `node --input-type=module -e 'import fs from "node:fs"; import {parseManifest,pathTokens} from "./dist/tools/fanout-manifest.js"; const m=parseManifest(fs.readFileSync("specs/fanout-backlog-wave-a.md","utf8")); let d=0; for (const l of m.dispatchable) if (JSON.stringify(l.ownedTokens)!==JSON.stringify(pathTokens(l.owned))) {d++; console.log(l.lane)}; console.log("lanes", m.dispatchable.length, "differ", d)'` prints `lanes 5 differ 0`.
- **AC-E381-5 (machine checks follow)** — Given a temp repo and an in-test manifest whose lane owns `` `scripts/**`、其他跑 `scripts/**` 的 `test/**`（只限…）、`test/e9-x.test.mjs` ``, and a lane branch that changes `scripts/a.mjs`, `test/e9-x.test.mjs` and `test/other.test.mjs`: when `fanout.mjs check <manifest> <lane> --base main` runs, then it exits 1 with exactly one `OUT  test/other.test.mjs` line; and when `check --cut` runs on a spec whose Cut touches `` `test/other.test.mjs` ``, it exits 1 with one `OUT` line naming `test/other.test.mjs`. Exit codes and error codes are otherwise unchanged.
  proof: `node --test test/e381-owned-clause-tokens.test.mjs` (AC-E381-5 cases).
- **AC-E381-6 (forbidden and touches unchanged)** — Given a `禁止` cell `` `gates/**`（含 `gates/registry.ts` 的 `hintStatic`）、其他 `test/**` ``, when parsed, then `forbiddenTokens` is `["gates/**", "gates/registry.ts", "test/**"]` (as before). `pathTokens` keeps its exact behaviour for any input.
  proof: `node --test test/e381-owned-clause-tokens.test.mjs` (AC-E381-6 cases).

### E390 — `check` base default

- **AC-E390-1 (recorded target used)** — Given a temp repo with no `main` branch (only `develop`) and an in-test manifest whose single `## 接手步驟` section has `### 核對 primary` with `- 目標分支：develop @ <sha7>`, when `fanout.mjs check <manifest> <lane>` runs without `--base`, then it diffs `develop...<branch>`, prints the normal report (`E158` note naming `develop`), exits 0 or 1 by the diff, and prints no `REF_NOT_FOUND`.
  proof: `node --test test/e390-check-recorded-base.test.mjs` (AC-E390-1).
- **AC-E390-2 (none recorded → `main`, output unchanged)** — Given a repo with `main` and a manifest with no `## 接手步驟` section, or one without a `目標分支` line, or with an unparseable value (e.g. `<待填：…>`), or with the line twice, when `check` runs without `--base`, then stdout and exit code are byte-identical to the same run with `--base main`.
  proof: `node --test test/e390-check-recorded-base.test.mjs` (AC-E390-2).
- **AC-E390-3 (default fails → names `--base`)** — Given a repo without `main` and a manifest that records no target, when `check` runs without `--base`, then it exits 2 and stderr is `fanout: error: REF_NOT_FOUND: ` followed by copy `err.base-default` (verbatim, `<repo>` substituted).
  proof: `node --test test/e390-check-recorded-base.test.mjs` (AC-E390-3).
- **AC-E390-4 (recorded target fails → names it and `--base`)** — Given a recorded `- 目標分支：gone-branch @ <sha7>` where `gone-branch` does not resolve, when `check` runs without `--base`, then it exits 2 with `REF_NOT_FOUND` and copy `err.base-recorded` verbatim.
  proof: `node --test test/e390-check-recorded-base.test.mjs` (AC-E390-4).
- **AC-E390-5 (explicit `--base` unchanged)** — Given the AC-E390-1 manifest, when `check` runs with `--base <x>`, then `<x>` is used even though a target is recorded; with an `<x>` that does not resolve, stderr carries copy `err.base-flag` byte-identical to today; `REF_INVALID`, `RANGE_EMPTY`, `GIT_DIFF_FAILED` and exit codes 0/1/2 are unchanged; and library `checkLane(m, lane, { repo })` without `base` still reports `base === "main"`.
  proof: `node --test test/e390-check-recorded-base.test.mjs` (AC-E390-5) and `node --test test/e177a-check-cli.test.mjs` unedited.
- **AC-E390-6 (agrees with `handoff --check`)** — Given the AC-E390-1 manifest and repo, when `check` (no `--base`) and `handoff --check` (no `--target`) both run, then both resolve `develop`: the check report's `E158` note names `develop...<branch>`, and `handoff --check` prints no `REF_NOT_FOUND`.
  proof: `node --test test/e390-check-recorded-base.test.mjs` (AC-E390-6).
- **AC-E390-7 (usage synced)** — Given the CLI, when it prints usage (no subcommand), then the `check` line is copy `usage.check`; `scripts/fanout.mjs`'s header usage comment carries the same text after `//        `; the usage still has five continuation lines.
  proof: `node scripts/fanout.mjs 2>&1 | grep -c 'check <manifest> <lane> \[--base <ref>\] \[--repo <dir>\]'` prints `1`, `grep -c 'check <manifest> <lane> \[--base <ref>\] \[--repo <dir>\]' scripts/fanout.mjs` prints `1`, and `node --test test/e296-manifest-tier.test.mjs` passes unedited.

### E388 — tracked legacy file in a lane worktree

- **AC-E388-1 (tracked `TODO.md` skipped)** — Given a repo that ignores `.current/` and commits a `TODO.md`, and a linked worktree on `feat/e996-q`, when `addTaskInFile` writes `T-E996-01` and `getNextTaskFromFile` reads, then the row lands in `.current/e996/tasks.md`, `TODO.md` is byte-identical and `git status --porcelain` in the worktree is empty, and the read result has no `advisory`.
  proof: `node --test test/e388-tracked-legacy-ledger.test.mjs` (AC-E388-1).
- **AC-E388-2 (tracked root `tasks.md` skipped)** — Same as AC-E388-1 with a committed root `tasks.md` instead of `TODO.md`, and with both committed.
  proof: `node --test test/e388-tracked-legacy-ledger.test.mjs` (AC-E388-2).
- **AC-E388-3 (only tracked candidates are skipped)** — Given the AC-E388-1 worktree with a committed root `tasks.md` and an ignored, untracked `TODO.md` (add `/TODO.md` to `.gitignore`) holding a row, when the tools run, then `TODO.md` is the ledger and the advisory names it.
  proof: `node --test test/e388-tracked-legacy-ledger.test.mjs` (AC-E388-3).
- **AC-E388-4 (primary checkout unchanged)** — Given a primary checkout (`.git` is a directory) of a repo that ignores `.current/` and commits a `TODO.md`, on `main` and on `feat/e995-p`, when `addTaskInFile` runs, then it writes `TODO.md` and the read carries the ignored-lane advisory naming `TODO.md` (E125a option A).
  proof: `node --test test/e388-tracked-legacy-ledger.test.mjs` (AC-E388-4).
- **AC-E388-5 (`_primary` lane in a linked worktree unchanged)** — Given a linked worktree on a non-feat branch of the AC-E388-1 repo, when `addTaskInFile` runs, then it writes `TODO.md` as today.
  proof: `node --test test/e388-tracked-legacy-ledger.test.mjs` (AC-E388-5).
- **AC-E388-6 (E125a and E383 regressions)** — `test/e125a-lane-local-ledgers.test.mjs` (AC4b included) and `test/e383-lane-ledger-worktree.test.mjs` (AC-E383-4: an ignored, untracked legacy file in a linked lane worktree stays the ledger) pass unedited.
  proof: `node --test test/e125a-lane-local-ledgers.test.mjs test/e383-lane-ledger-worktree.test.mjs`.

### Lane-level

- **AC-L1** — The full suite passes on the final committed HEAD with a clean worktree: `node scripts/test-lock.mjs -- npm test`. Re-pins limited to the one listed under Dependencies (`test/e177a-manifest.test.mjs` AC1).
- **AC-L2** — `dist/` changes only under `dist/tools/fanout-manifest.*` and `dist/tools/tasks-lane-migrate.*`; `npm run build` on HEAD leaves `git status --porcelain` empty.
  proof: `git diff --stat main...HEAD -- dist/` lists only those eight files at most, and `npm run build` followed by `git status --porcelain` prints nothing.
- **AC-L3** — `node scripts/fanout.mjs check specs/fanout-backlog-wave-a.md e381 --base main` exits 0; `npm audit --audit-level=high` exits 0; `npm run check:bookkeeping` exits 0.

## Copy / Strings

| string id | exact text (quote verbatim) | source |
|---|---|---|
| err.base-flag | `base ref "<x>" does not resolve (git rev-parse --verify) in <repo>` (unchanged) | existing (`tools/fanout-manifest.ts:1643` at dispatch base) |
| err.base-recorded | `base "<branch>" is the target branch recorded in the manifest (目標分支 under ### 核對 primary) and does not resolve (git rev-parse --verify) in <repo> — pass --base <ref> to check against another ref` | authored-here — E390 asks the default-case message to name `--base`; mirrors E386 `err.target-recorded` and says where the base came from |
| err.base-default | `default base "main" does not resolve (git rev-parse --verify) in <repo> and the manifest records no target branch (目標分支 under ### 核對 primary) — pass --base <ref>` | authored-here — E390; mirrors E386 `err.target-default` (the case a repo without `main` hits) |
| usage.check | `node scripts/fanout.mjs check <manifest> <lane> [--base <ref>] [--repo <dir>]` | authored-here — E390 "usage string synced": the default is no longer always `main`, so the usage names the value kind, as `render` does for `[--base <sha>]` |

The branch-ref check line (`branch ref "<x>" does not resolve …`) and `REF_INVALID` messages are unchanged.

## Visual Tokens

| token id | property | value (quote verbatim) | source |
|---|---|---|---|
| N/A | — | — | feature has no visual literals |

## Visual Widgets

| widget id | description | source-node |
|---|---|---|
| N/A | — | feature has no non-primitive widgets |

## Out of Scope

- Any manifest format change (columns, cell grammar, headers) — manifest "不做".
- `validate`, `render` and `handoff` semantics other than what flows from `ownedTokens` (D-E381); `pathTokens`, `forbiddenTokens` and Cut `touches` tokenization.
- Warning lines or notes for dropped clause globs; `PROSE_NOTE` stays as is (still true).
- Moving the handoff fact reader into a shared module (would edit `tools/fanout-handoff.ts`, not owned).
- `tools/config.ts` (`DEFAULT_TASK_PATHS`, `findLegacyTasksFile`, `findTasksFile`): unchanged. Index-only readers that use `findTasksFile` (the session freshness snapshot, `tools/drift.ts` schema-skew read) may still read a tracked legacy file in a lane worktree before the lane ledger exists; they never write it.
- `docs/lane-protocol.md` §3 ledger line (see needs-integrator item 1).
- Release bookkeeping (version, CHANGELOG, `docs/backlog.md` done-marks) — integrator / release-engineer.

## Dependencies / Prerequisites

- **Planning simulation (dispatch base `2425e04`).** D-E381 was prototyped on a scratch copy of `dist/`: `validate` output is byte-identical for all 39 `specs/fanout-*.md`; `ownedTokens` change for no wave A lane; the historical changes are only the prose-led or parenthesised globs (the seven `test/**`, `dist/**`/`dist/tools/**` "上列…的" items, `specs/fanout-*.md`, `tools/*.ts`, `test/eval/fixtures/**`, two parenthesised `test/e1xx-*.test.mjs`) and `.current/<lane>/` items, which the implicit bookkeeping set already covers. Of the 22 fan-out test files (254 tests), only `test/e177a-manifest.test.mjs` AC1 went red.
- **Re-pin (owned):** `test/e177a-manifest.test.mjs` AC1 (`:88-96`) lists `.current/e177a/` among e177a's owned tokens; the fixture item is "自己的 spec／證據／`.current/e177a/`", a prose-led glob, so it is no longer owned. qa removes it from the expected list (implicit bookkeeping covers `.current/e177a/**`) and adds an assertion that it is absent, citing E381.
- **Unedited regressions:** `test/e177a-check-cli.test.mjs`, `test/e178b-fanout-unmatched.test.mjs`, `test/e296-manifest-tier.test.mjs`, `test/e386-handoff-recorded-target.test.mjs`, `test/e125a-lane-local-ledgers.test.mjs`, `test/e383-lane-ledger-worktree.test.mjs`, `test/lane-paths.test.mjs`.
- No external references (Resource Audit: the three rows cite only in-repo specs and code).
- No `content/**`, golden or budget change.

## Gate Summary

| gate | result |
|---|---|
| Visual / geometric split | n/a (no design file) |
| Parallel-Lane Cut | serial — shared layer: E381 and E390 both edit `tools/fanout-manifest.ts`; one lane, three sr tasks in order |
| Scope Decision | single feature (no design arm) |
| Resource Audit | zero external refs |
| Question Batch / Ambiguity | none open |
| **Option choice 1 (E381)** | option 1 of the row, owned cell only, globs only, with the role-label / `新檔` allowance (D-E381). Options 2 and 3 rejected with reasons |
| **Option choice 2 (E388)** | direction 1 of the row: skip git-tracked legacy candidates in linked lane worktrees; `tools/config.ts` untouched (D-E388). Direction 2 rejected |
| **Option choice 3 (E390)** | resolver duplicated (~15 lines) in `tools/fanout-manifest.ts` rather than imported from `tools/fanout-handoff.ts`; parity pinned by AC-E390-6 (D-E390) |
| needs integrator 1 | `docs/lane-protocol.md:45` (§3 task ledger, E383) lists root `tasks.md` and `TODO.md` as legacy files that keep the legacy ledger in a linked lane worktree; after E388 a git-tracked one no longer does. `docs/**` is forbidden to this lane and the line is pinned by `test/e383-lane-ledger-worktree.test.mjs` AC-E383-7 (head and tail substrings only). Suggested bookkeeping edit after merge: after "或 `taskPaths` 指定的檔" add "；git 追蹤中的檔不算（E388）". |
| needs human ruling | none beyond approving the three option choices above |
| Cut approval | `cutApprovalAutoTier` is `{}` — the human approves in the coordinator's session |

## Cut

| id | desc | depends_on | est. files | touches | design-link |
|---|---|---|---|---|---|
| T-E381-01 | sr (E381, D-E381; AC-E381-1..3, 5, 6): in `tools/fanout-manifest.ts` add exported `ownedPathTokens(cell)` beside `pathTokens` (`:423-425`): one pass tracking backtick state, paren depth (ASCII and full-width) and the current top-level list item; a glob span (`isGlobToken`) inside a paren or in a prose-led item (leading text non-blank after removing one `<label>：`/`<label>:` and then `新檔`) is dropped, every other path-token span is kept in order. Use it for `ownedTokens` in `parseManifest` (`:580`) only; `pathTokens`, `forbiddenTokens` (`:609`) and Cut touches (`:1898`) unchanged. Doc comment states the rule and why globs only. Rebuild `dist/`. About 40 lines | none | 1 (+dist) | `tools/fanout-manifest.ts`、`dist/tools/fanout-manifest.*` | — |
| T-E381-02 | sr (E390, D-E390; AC-E390-1..7): in `tools/fanout-manifest.ts` add a private `recordedTargetBranch(text)` (single `## 接手步驟` section via `findHandoffSections`, single `- 目標分支：` line, group 1 of `^(.+) @ ([0-9a-f]{7,40})$`, else undefined); `runCheck` (`:2307-2323`) passes `base: flag ?? recorded`, `baseSource` flag/manifest/default; `CheckOptions` (`:1530`) gains `baseSource`; `checkLane` (`:1627`) keeps `opts.base ?? "main"`, defaults the source like `collectFacts`, and picks copy `err.base-flag`/`err.base-recorded`/`err.base-default` for the base `REF_NOT_FOUND` (`:1643`; branch line unchanged). `USAGE` check line (`:228`) and the `scripts/fanout.mjs` header usage comment (`:8`) become copy `usage.check`; nothing else in `scripts/fanout.mjs`. Rebuild `dist/`. About 45 lines | T-E381-01 | 2 (+dist) | `tools/fanout-manifest.ts`、`scripts/fanout.mjs`、`dist/tools/fanout-manifest.*` | — |
| T-E381-03 | sr (E388, D-E388; AC-E388-1..6): in `tools/tasks-lane-migrate.ts` `resolveTasksLedgerPath` (`:357-364`), when the lane is not `_primary` and `isLinkedWorktree` holds, pick the first `resolveTaskPaths` candidate that exists, is not nested in `.current/<dir>/` (the `findLegacyTasksFile` rule) and is not git-tracked (`git ls-files --error-unmatch -- <rel>`, read-only, stderr suppressed, 5 s timeout; any error = not tracked; optional per-process cache like `ignoredCache`); otherwise keep `findLegacyTasksFile`. Update the function's doc comment (E388, tracked files). `tools/config.ts` untouched. Rebuild `dist/`. About 35 lines | none | 1 (+dist) | `tools/tasks-lane-migrate.ts`、`dist/tools/tasks-lane-migrate.*` | — |
| T-E381-04 | qa (E381): new `test/e381-owned-clause-tokens.test.mjs` for AC-E381-1..3, 5, 6 (in-test cells and manifests, temp repos; no assertion on real `specs/fanout-*.md`); re-pin `test/e177a-manifest.test.mjs` AC1 (`:88-96`) for `.current/e177a/` per Dependencies | T-E381-01 | 2 | `test/e381-owned-clause-tokens.test.mjs`、`test/e177a-manifest.test.mjs` | — |
| T-E381-05 | qa (E390): new `test/e390-check-recorded-base.test.mjs` for AC-E390-1..6 (temp repos, one with only `develop`; in-test manifests; copy asserted verbatim) | T-E381-02 | 1 | `test/e390-check-recorded-base.test.mjs` | — |
| T-E381-06 | qa (E388): new `test/e388-tracked-legacy-ledger.test.mjs` for AC-E388-1..5 (real `git init` + `git worktree add` fixtures in the OS temp dir, the `test/e383-lane-ledger-worktree.test.mjs` pattern) | T-E381-03 | 1 | `test/e388-tracked-legacy-ledger.test.mjs` | — |
| T-E381-07 | qa (lane verification): on the final committed HEAD with a clean worktree run AC-E381-4, AC-E390-7, AC-E388-6, AC-L1..L3 (full suite under `node scripts/test-lock.mjs -- npm test`); confirm the unedited-regression list in Dependencies; PASS lists T-E381-01..07 | T-E381-04, T-E381-05, T-E381-06 | 0 | — | — |
