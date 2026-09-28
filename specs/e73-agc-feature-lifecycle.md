# Spec: E73 — `agc feature start` / `agc feature finish`

- Ticket: E73 (P1), Wave 5 lane L-INIT, `docs/v4.0.0-execution-plan.md` §4/§6/§8
- Feature id: `e73-agc-feature-lifecycle`
- Owned files: `bin/agc-init.mjs`, `templates/**`, `docs/install.md`, `tools/config.ts`,
  `tools/lane-paths.ts`, files newly created by this ticket, this ticket's own test files.
- Forbidden: `content/**`, `bin/agent-governance-context.mjs`, `prompts/`, `lib/`, `gates/`,
  `tools/handoff-*`, `docs/backlog.md`, `docs/v4.0.0-*.md`, `test/fixtures/compose-golden/**`,
  `test/context-budget.test.mjs`.
- Scope: **mechanism only**. Whether lanes are the default workflow is E130 (later wave) —
  out of scope. Applying/numbering pending-ticket files and the `agc check` orphan detector
  are E124's module (E124b) — do not pre-build interfaces or stubs for them.
- Architect: **not needed**. No new architectural decision is introduced — lane-name
  derivation already exists (`resolveCurrentLane` in `tools/lane-paths.ts`, E123), and this
  ticket is CLI + `fs`/`git` plumbing on top of it.

## Grounding (read before implementing)

- `resolveCurrentLane(workspacePath)` (`tools/lane-paths.ts:231`) derives a lane id purely
  from the checked-out branch: `feat/<id>-*` → lowercased `<id>`, anything else →
  `PRIMARY_LANE` (`_primary`). This is the **single source of truth** for "what is this
  lane called" — `agc feature start` MUST NOT invent a second naming scheme, and MUST NOT
  persist a lane name into `.current/.config.json` (backlog amendment E123 F1-S0: that key
  was proposed and explicitly withdrawn — lane name is either untracked local state or
  re-derived from the branch, never written into a tracked file).
- `bin/agc-init.mjs` already has three precedents this ticket builds on directly:
  `isLinkedWorktree(cwd)` (detects a linked worktree via the `.git` **file**, not directory),
  `atomicWriteFile` (tmp+rename, symlink-aware), and `checkWorktreeEvidence` /
  `WORKTREE_EVIDENCE_DIRS` (the E111 advisory check). **Measured fact that changes this
  ticket's scope**: in this repo, `qa_reports/`, `review_reports/`, and `specs/` are
  ordinary **tracked** directories with real committed content (verified: `git ls-files --
  qa_reports` returns 924 tracked paths; a fresh `git worktree add` therefore checks them
  out as real directories, already clean under `git status`). The E111 symlink-back-to-
  primary discipline documented in `coord-03` is for **adopter workspaces** where those dirs
  are gitignored/untracked — `checkWorktreeEvidence`'s own logic is silent on a tracked,
  populated directory. **Consequence: `agc feature start` does not create or manage any
  qa_reports/review_reports/specs symlinks.** Worktree isolation for all tracked paths
  (`dist/`, `qa_reports/`, `specs/`, `.current/`, `tasks.md`, …) is inherent to
  `git worktree add` — each lane gets its own independent working copy for free. The two
  genuinely *un*tracked things that need explicit bootstrap work are `node_modules/`
  (gitignored, must be installed) and `.env` (not currently gitignored at all — see AC10).
- `content/coord-03-core-fallback.md`'s symlink-bootstrap wording therefore looks stale
  against this repo's actual tracked-evidence-dir setup. **Do not touch `content/**` to fix
  this** (forbidden) — recorded as a pending-note candidate for a future ticket, not cut here.

## Comment retarget fold-in (L-CONTENT-NEW-2, folded into T-E73-01, zero behaviour change)

`bin/agc-init.mjs` predates the E123 lane-layout flip and still describes handoff state at
the flat pre-E123 path in two comments: the file-header note at line 9
(`.current/handoff.md (E34): any seeded prev tuple dead-ends...`) and the `runInit` body
note at line 351 (`NOTE (E34): no .current/handoff.md is scaffolded here...`). Both should
read `.current/<lane>/handoff.md` to match the actual lane-scoped write path
(`resolveCurrentLanePaths`, E123). **Comment text only — no code, no behavior change**:
`agc init` still does not scaffold any handoff file, in either the flat or lane layout; only
the words describing that fact are updated. The `.current/.config.json` mentions elsewhere
in the same file (lines 4, 7, 229, 378–385) are correct as written and MUST NOT be touched —
`.config.json` stays a top-level, non-lane file under the E123 layout (E123 F1-S0). The
help-output string at line 46 (`STR_USAGE`) is user-facing CLI text, not a comment, and is
out of scope for this retarget.

## Command surface

### `agc feature start <ticket-slug> [--base <branch>] [--path <dir>]`

- `<ticket-slug>` e.g. `e73-agc-feature-lifecycle`. Must parse to a ticket id under the same
  rule `resolveCurrentLane` uses for `feat/<id>-*` branches (reuse the function itself,
  post-creation — see AC3 — never a second copy of the regex).
- `--base <branch>` — default `main`. The branch the new lane forks from.
- `--path <dir>` — default `<parent-of-repo>/<repo-basename>-lanes/<ticket-id>` (e.g. for a
  repo checked out at `/x/agent-governance-mcp`, default
  `/x/agent-governance-mcp-lanes/e73`). Generic and adopter-portable; a human with an
  existing differently-named lanes directory (e.g. this workspace's own
  `~/agm-lanes/<ticket-id>`, created by hand before this mechanism existed) uses `--path` to
  point there instead. **Flagged as an open decision below (D1).**
- Effect: `git worktree add -b feat/<ticket-slug> <path> <base>`, then node_modules link +
  `.env` copy + exclude-rule upsert for **both** `.env` and `/node_modules` (AC9–AC13), a
  one-line shared-`node_modules` warning (AC14), then prints the lane id via
  `resolveCurrentLane(path)`.
- MUST NOT shell out to `agc init` in the new worktree (constraint 6) —
  `writeClaudeBlock`'s in-place upsert would rewrite the tracked `CLAUDE.md`, leaving the
  brand-new lane dirty before the human has done anything.
- MUST refuse to run from inside a linked worktree (reuse `isLinkedWorktree(cwd)`) — a lane
  is always cut from the primary checkout.

### `agc feature finish <ticket-id> (--shipped|--abandoned) [--base <branch>]`

- Exactly one of `--shipped` / `--abandoned` is required.
- `<ticket-id>` resolves the target worktree via `git worktree list --porcelain`, matching
  the entry whose branch, run through `resolveCurrentLane`, equals `<ticket-id>` exactly (no
  substring match — `e73` must never match a `feat/e730-...` lane).
- MUST refuse to run from inside a linked worktree — you cannot `git worktree remove` the
  directory you are standing in; always run `finish` from primary.
- `--shipped`: guard — `git merge-base --is-ancestor <branch> <base>` (default `--base
  main`) must succeed, else fail with a message pointing at `--abandoned` or "merge first"
  (constraint 2: never destroy a Blocked/unmerged lane silently). On pass: `git worktree
  remove <path>` (never `--force`; a dirty worktree fails loudly with git's own message —
  see AC10/AC16 for why that should not normally happen), then `git branch -d <branch>`
  (safe delete — refuses non-merged, which the guard already confirmed).
- `--abandoned`: no merge guard. Evidence disposition (constraint per backlog "待決 F",
  already decided 2026-09-16; amended 2026-09-24 human review, commit-before-remove): move
  any file directly under `qa_reports/` or `review_reports/` whose name contains
  `<ticket-id>` as a bounded token (delimited by `_`/`-`/`.`/string-edge, case-insensitive —
  never a bare substring match) into `qa_reports/abandoned/<ticket-id>/` /
  `review_reports/abandoned/<ticket-id>/`. **`specs/<feature>.md` is deliberately NOT
  moved** — see D2 below.
  - **Precondition (fail loudly, move nothing)**: snapshot `git status --porcelain` before
    touching anything. Partition it into entries that match a to-be-moved evidence file vs.
    everything else. If the "everything else" set is non-empty, refuse the whole
    `--abandoned` run with an error listing those paths — never commit unrelated work,
    never `--force`. This is a precondition check, not a fix-up: nothing is moved or
    committed once it fires.
  - **Tracked evidence**: `git mv <src> <dst>` for each match (this is why the precondition
    above matters — `git mv` requires a clean starting point for the paths it touches).
    After all matched `git mv`s, if anything is staged (`git diff --cached --name-only`
    non-empty), `git commit -m "chore(lane): abandon <ticket-id> — evidence to
    abandoned/"` on the lane branch. If zero tracked evidence matched, skip the commit
    entirely (no empty commit).
  - **Untracked evidence**: plain `fs.rename` to the same destination path. This does **not**
    stage or commit anything — an untracked file has nothing for `git mv`/`git commit` to
    act on, so it remains untracked at its new location. Documented consequence: if the
    only "dirty" content left afterward is such a renamed-but-still-untracked evidence file,
    the subsequent `git worktree remove <path>` (see below) will still refuse with git's own
    "contains modified or untracked files, use --force" error — `agc` does **not**
    auto-`--force` to paper over this. The operator can `git add`/commit it manually and
    re-run `finish --abandoned` (a no-op re-run: nothing left to move), or accept that this
    specific lane needs a manual `--force` removal after the evidence is otherwise disposed
    of. This is a known, accepted rough edge for untracked evidence, not a defect to solve
    here.
  - Then attempt `git worktree remove <path>` (never `--force`). On success, the branch is
    **left in place, not deleted** — it is exactly the "branch with an unapplied
    pending-ticket file but no worktree" shape E124's orphan detector (out of scope here) is
    meant to find later; deleting it here would make that detector unbuildable.
    Applying/numbering any pending-ticket file discovered on the branch is explicitly **not**
    this ticket's job (E124b) — `finish --abandoned` never touches it.
- Direct `git worktree remove` (bypassing `agc feature finish`) is **undefined behaviour**
  — no evidence disposition runs, no shipped/abandoned guard applies. State this in
  `docs/install.md` (AC22).

## Security (§6)

The agent process MUST NOT read `.env`'s contents into any string it constructs, logs, or
returns — copy it with `fs.copyFileSync` (kernel-level byte copy, never touches a JS string
of the content). QA fixtures use a dummy `.env` (e.g. `DUMMY_KEY=placeholder-value`) in
`$TMPDIR` and assert the value is never echoed to stdout/stderr by any `agc feature` command
(AC10, AC-QA-1).

## Acceptance Criteria

**`agc feature start`**

1. Given a clean primary checkout on `main` with no `feat/e2e-test-*` branch, `agc feature
   start e2e-test-lane --path <tmp>/lane` creates the branch `feat/e2e-test-lane`, a linked
   worktree at `<tmp>/lane`, and exits 0.
2. Running `agc feature start` from inside an existing linked worktree fails with a
   non-zero exit and an error naming the primary checkout as the required cwd; no branch or
   directory is created.
3. The lane id printed to stdout on success equals `resolveCurrentLane(<tmp>/lane)` computed
   independently after the command exits (i.e. the printed value and the value a fresh
   process would derive from the branch agree byte-for-byte) — proves there is no second,
   possibly-diverging naming scheme.
4. A ticket-slug that does not parse to a leading ticket id (e.g. `no-ticket-id-here`) is
   rejected before any `git` mutation — no branch, no directory.
5. `--path` omitted: the resolved path equals `<dirname(repoRoot)>/<basename(repoRoot)>-
   lanes/<ticket-id>` and that directory is created if its parent is missing.
6. If the target branch already exists, or the target path already exists (worktree or
   plain file/dir), the command fails with a clear error and creates nothing new
   (no partial worktree left registered).
7. `agc feature start` never invokes `writeClaudeBlock` / the `agc init` code path — the
   new worktree's tracked `CLAUDE.md` is byte-identical to what a plain `git worktree add`
   would have checked out.
8. Immediately after `agc feature start` succeeds, `git -C <path> status --porcelain` is
   empty (no untracked/dirty entries introduced by bootstrap — see AC9–AC11).

**Env bootstrap**

9. `<path>/node_modules` is a symlink to `<repoRoot>/node_modules` (not a copy); a package
   present only in the primary install (e.g. run `require.resolve` for an arbitrary already-
   installed dependency from inside the lane) resolves successfully with **zero** `npm
   install` run in the lane. If `<repoRoot>/node_modules` does not exist, `agc feature
   start` still succeeds (worktree + branch created) but prints a warning that the primary
   checkout itself needs `npm install` first.
10. If `<repoRoot>/.env` exists, it is byte-identical at `<path>/.env` after bootstrap
    (compare file bytes, not just existence), AND no `agc feature start` output (stdout or
    stderr) contains the dummy secret value from the QA fixture's `.env`. If
    `<repoRoot>/.env` does not exist, no `.env` is created and no error is raised.
11. After AC10, `.env` is listed in the shared `git rev-parse --git-common-dir`-resolved
    `info/exclude` (not the tracked `.gitignore` — a forbidden-adjacent tracked file this
    ticket does not touch), and running `agc feature start` again with a different ticket
    does not duplicate the `.env` exclude line (idempotent upsert, checked by content, not
    appended blindly).
12. `/node_modules` (no trailing slash — matches a symlink, not only a directory) is
    **also** upserted into the same shared `info/exclude`, via the same idempotent
    mechanism as AC11 — this repo's own root `.gitignore` (`node_modules`, no slash)
    happens to already cover the symlink, but that is not true of the common adopter form
    `node_modules/` (directory-only match), so the exclude rule is added unconditionally,
    never conditioned on what the target repo's own `.gitignore` says.
13. Fixture test: a scratch repo whose `.gitignore` contains `node_modules/` (trailing
    slash — deliberately the pathological case AC12 exists for). After `agc feature start`
    in that fixture, `git -C <path> status --porcelain` is still empty (AC8 holds even
    against this `.gitignore`), and later `agc feature finish <id> --shipped` removes the
    worktree **without** `--force`.
14. `agc feature start`'s stdout contains a one-line warning after the symlink is created,
    stating that `node_modules` is shared with the primary checkout, that `npm ci`/`npm
    install` must not be run inside the lane (an `npm ci` deletes the whole directory
    first, which would delete primary's real `node_modules` through the symlink), and that
    an independent install requires removing the symlink first (`rm node_modules`, which
    removes only the link) before running `npm ci` in the lane.
15. After `agc feature finish` (either `--shipped` or `--abandoned`) removes a lane whose
    `node_modules` is still the AC9 symlink, `<repoRoot>/node_modules` still exists on disk
    with its original contents intact (`git worktree remove` unlinks the worktree's own
    `node_modules` entry — a symlink — never follows it into primary's real directory).

**`agc feature finish`**

16. `agc feature finish <id> --shipped` on a branch that has NOT been merged into `--base`
    fails with a non-zero exit, a message pointing at `--abandoned` or "merge first", and
    leaves the worktree and branch untouched.
17. `agc feature finish <id> --shipped` on a branch merged into `--base` (fast-forward or
    real merge) removes the worktree (`git worktree remove`, no `--force` passed) and
    deletes the local branch (`git branch -d`, not `-D`); after it, `git worktree list`
    no longer shows the lane and `git branch --list feat/<id>-*` is empty.
18. `agc feature finish` refuses to run from inside any linked worktree — including the one
    being targeted — with an error directing the human to run it from primary.
19. `agc feature finish --shipped` on a worktree with uncommitted changes fails with git's
    own "contains modified or untracked files" class of error (not silently forced, not our
    own swallowed exception) and removes nothing.
20. `agc feature finish <id> --abandoned` on an unmerged branch succeeds (no merge guard
    applied) — verifies AC16's guard is `--shipped`-only.
21. **Precondition guard**: given a lane with an unrelated uncommitted change (e.g. an
    edited tracked source file, unconnected to any evidence file) alongside otherwise
    matchable evidence, `--abandoned` fails before moving or committing anything, naming the
    unrelated path(s); a re-run after that unrelated change is committed/discarded then
    proceeds normally.
22. Given `qa_reports/review_T-<ID>-01.md` (tracked) and `review_reports/review_T-<ID>-
    02.md` (untracked) where `<ID>` embeds the ticket id as a bounded token, `--abandoned`
    moves both into `qa_reports/abandoned/<ticket-id>/` and
    `review_reports/abandoned/<ticket-id>/` respectively, preserving filenames; a
    similarly-named-but-different ticket's files (e.g. ticket `e730` when finishing `e73`)
    are left untouched (bounded-token match, not substring).
23. **Tracked evidence is committed**: for the tracked file in AC22, after `--abandoned`
    the lane branch's tip commit contains the `qa_reports/abandoned/<ticket-id>/...` path
    (`git show --stat HEAD` on the branch, read before the worktree is removed), with a
    message matching `chore(lane): abandon <ticket-id>`. If zero tracked evidence matched in
    a given run, no new commit is created (verify no-op case separately: `git log` unchanged
    when only untracked evidence — or none — was disposed).
24. **Untracked evidence documented behavior**: for the untracked file in AC22, after the
    move it exists at the new path and is still reported by `git status --porcelain` as
    untracked (`??`) — nothing was committed for it. If that untracked file is the only
    remaining dirty entry, the subsequent `git worktree remove` in this same `--abandoned`
    run fails with git's own "contains modified or untracked files, use --force" error, and
    `agc` does not retry with `--force` — the failure is surfaced verbatim, matching AC19's
    "never auto-force" rule.
25. `--abandoned` never moves anything under `specs/` and never reads or writes any
    pending-ticket file — confirms the E124b boundary is not crossed.
26. After an `--abandoned` run whose worktree removal succeeds (AC22's evidence was all
    tracked, or there was none), `git branch --list feat/<id>-*` still shows the branch (not
    deleted) and `git worktree list` no longer shows the lane.

**Docs / security**

27. `docs/install.md` gains a section documenting both commands, the default `--path`
    convention, the `--shipped` vs `--abandoned` distinction including the merge guard,
    the commit-before-remove evidence-disposition behavior (including the untracked-evidence
    rough edge from AC24), the shared-`node_modules` warning (AC14), and explicitly states
    that calling `git worktree remove` directly (bypassing `agc feature finish`) is
    undefined behaviour.
28. `docs/install.md`'s new section states the `.env`-never-read-into-output guarantee
    (Security §6) in one sentence, for adopters auditing the tool before running it against
    a workspace with real secrets.

**Comment retarget (L-CONTENT-NEW-2 fold-in)**

29. In `bin/agc-init.mjs`, the only diff introduced by the comment retarget is at the two
    named `.current/handoff.md` → `.current/<lane>/handoff.md` comment lines (header note
    near line 9, `runInit` note near line 351) — `git diff -- bin/agc-init.mjs` for this
    change touches comment lines only (no `+`/`-` on any executable line), and every
    `.current/.config.json` occurrence in the file is byte-identical before and after. The
    code-reviewer verifies this directly from the diff.

## Decisions (human-reviewed 2026-09-24)

- **D1, D2, D4 — approved as recommended** (default `--path`, `specs/` excluded from
  `--abandoned` disposition, `--shipped` merge guard defaults `--base main`). See below for
  the original reasoning, kept for the record.
- **D3 — `content/coord-03-core-fallback.md`'s symlink-bootstrap wording appears stale**
  against this repo's actual tracked-evidence-dir setup (see Grounding). Not fixed here
  (`content/**` forbidden) — **filed by the coordinator as NEW-TICKETS L-INIT-NEW-1**; no
  further action for this ticket.

### Original reasoning (kept for the record)

- **D1 — default `--path`**: this spec defaults to `<repo-basename>-lanes/<ticket-id>`
  sibling to the primary checkout, generic and adopter-portable. This workspace's own
  existing manual lanes (`~/agm-lanes/e73`, `e124`, `e137` — created by hand before this
  mechanism existed) use a differently-named shared directory; `--path` covers that, but if
  the human wants THAT exact convention as the tool's default, say so and D1 flips to a
  `--lanes-dir <dir>` global default instead of the derived name. Recommend: keep the
  generic default; low cost to add `--lanes-dir` later if wanted.
- **D2 — `specs/<feature>.md` excluded from `--abandoned` evidence disposition**: specs are
  a design record, not a pass/fail report; leaving it in place (rather than moving to
  `abandoned/`) keeps it discoverable if the ticket is picked up again later. Flag if this
  reasoning is wrong.
- **D4 — `--shipped`'s merge guard base defaults to `main`, not persisted from `start`**:
  since lane name/base are never written to a tracked file (E123 F1-S0), `finish` cannot
  know what `--base` `start` used unless the human passes the same `--base` again on
  `finish`. Default `main` covers the common case; document that a lane started with a
  non-default `--base` must pass the same `--base` to `finish --shipped`.
