# Review — T-E383-01 (batched: E383 + E385 sr tasks)

covers: T-E383-01, T-E385-01, T-E385-02, T-E385-03

## Round 1 — APPROVED — by code-reviewer

Range reviewed: `git diff 8dd1f7b..HEAD` (sr commit d123f05 + handoff-only commit 2260afa) against `specs/e383-lane-ledger-and-worktree-evidence.md` (no architecture spec; the spec records "No architect hop"). Clean-context note: `tw_get_state` returns the handoff's `pending_notes`, so the sr summary was visible; every claim below was checked against the diff, the spec and independent runs, not taken from those notes. Same-model-bias flag: sr-engineer and this reviewer both ran on the opus tier.

## Summary
- T-E383-01: `resolveTasksLedgerPath` (`tools/tasks-lane-migrate.ts:357-364`) gains exactly the D-E383 branch: after the unchanged early return and after the legacy lookup, it returns the lane ledger only when the lane is not `_primary` and `<ws>/.git` is a file. A module-private `isLinkedWorktree` (`:340-346`) mirrors `tools/drift.ts:87`. `dist/tools/tasks-lane-migrate.{js,d.ts}` are byte-identical to a fresh `tsc` build; the `.map` files differ only in the `sources` prefix, which comes from the scratch outDir.
- T-E385-01: `checkWorktreeEvidence` (`bin/agc-init.mjs:684-719`) now matches the D-E385-check table. Non-links are silent, inside links are silent, outside links emit `worktree-evidence.outside-link`, dangling links emit `worktree-evidence.dangling-link`. `isEmptyDir`, `hasUntrackedContent` and `hasIgnoredUntrackedContent` are removed and have no remaining callers. All hunks fall inside the `WORKTREE_EVIDENCE_DIRS`..`checkWorktreeEvidence` region.
- T-E385-02 / T-E385-03: `coord.bootstrap-obligation`, `doc.s1-git`, `doc.s3-ledger` and `doc.s3-evidence` are each byte-exact and present exactly once. Each sits at the line the spec prescribes.
- File scope is the four Cut files plus `dist/tools/tasks-lane-migrate.*`, with governance artifacts on top: `.current/e383/*`, the expected-red manifest, and a spec append of the E383-NEW-3 finding and Implementation notes. Nothing under `test/` changed. `tools/tasks-file.ts`, `tools/fanout-manifest.ts`, `schema/` and `gates/` are unchanged since base 35f20e2.
- Verdict: APPROVED. No required findings.

## AC Completeness
Scope note: this round reviews the sr tasks. The `proof:` lines that name the new QA test files (`test/e383-…`, `test/e385-…`) belong to T-E383-02 and T-E385-04 and are not yet written. For those, behaviour was checked with an independent reviewer fixture probe: real `git init` plus `git worktree add` in temp dirs, with `/.current/`, `/tasks.md` and the evidence dirs ignored via `.gitignore`.
AC-E383-1 — implemented — `tools/tasks-lane-migrate.ts:362`. Probe: add on `feat/e999-x` in a linked worktree → path `<wt>/.current/e999/tasks.md`. Neither `.current/tasks.md` nor root `tasks.md` exists, and the read returns T-E999-01 with no `advisory` key.
AC-E383-2 — implemented (by construction; QA proof pending T-E383-02) — the ledger now lands in `.current/<lane>/`, which both finish paths already harvest. The finish code is unchanged.
AC-E383-3 — implemented — probe on a primary checkout (`.git` is a dir) on `feat/e998-y` → `.current/tasks.md`, no lane ledger, advisory present. `test/e125a-lane-local-ledgers.test.mjs` is green and unedited.
AC-E383-4 — implemented — `:360` legacy return precedes the new branch. Probe: a linked worktree holding `.current/tasks.md` reads and writes the legacy file, creates no lane ledger, and shows the advisory.
AC-E383-5 — implemented — `:362` `lane !== PRIMARY_LANE`. Probe: a linked worktree on `chore/misc` writes `.current/tasks.md`.
AC-E383-6 — implemented — e125a, finish-history, lifecycle, e213 and e180 all pass unedited (included in the 281/281 run below).
AC-E383-7 — implemented — `docs/lane-protocol.md:45` is `doc.s3-ledger`, byte-exact, once, directly after the E196 line (`:44`).
AC-E385-1 — implemented — `content/coord-03-core-fallback.md:17` is byte-exact (935 B), between `**Lane-start default**` and `## Escalation Routes`. The grep for the two removed phrases under `content/` prints nothing. Golden re-capture is T-E385-04, and that test is in the expected-red manifest.
AC-E385-2 — implemented — `bin/agc-init.mjs:698`. Probe: an empty real dir and a real dir of ignored files are both silent, with exit 0, the same as absent.
AC-E385-3 — implemented — `:711-714`. Probe: `qa_reports` → primary emits the outside-link line once, exit 0.
AC-E385-4 — implemented — `:707-710`. Probe: a dangling `review_reports` emits the dangling-link line once, exit 0.
AC-E385-5 — implemented — `:716-717` (inside link falls through silent). Probe: `qa_reports -> ./local-evidence` is silent.
AC-E385-6 — implemented — the grep for both removed warning strings in `bin/agc-init.mjs` prints nothing. A primary checkout gives zero lines in the probe. The tracked shapes stay silent because every non-link is silent (`:698`). The re-pins are T-E385-04.
AC-E385-7 — implemented — e213 and e180 pass unedited. The `bin/agc-init.mjs` hunks are confined to lines 625-719 (the advisory region).
AC-E385-8 — implemented — `docs/lane-protocol.md:23` is `doc.s1-git` and `:46` is `doc.s3-evidence`, both byte-exact. e294, e351 and e177a pass unedited.
AC-L1 — implemented — no error-code or refusal text touched. `error-code-contract` is green. `TasksLedgerAbsentError` / `mustMigrate` are untouched, and `ensureTasksMigratedLocked` still returns early on a null legacy path.
AC-L2 — implemented — `git diff --stat 35f20e2 -- schema` is empty.
AC-L3 — implemented for sr scope — the new branch is reachable only when the lane path is git-ignored. Full-suite confirmation is T-E385-05.
AC-L4 — implemented — `git diff --stat 35f20e2 -- tools/fanout-manifest.ts tools/tasks-file.ts` is empty, and the finish code has no hunk.
AC-L5 — deferred to T-E385-05 (QA). `dist/` is rebuilt and matches the source.

## Correctness
No required findings.
- Branch order (`tools/tasks-lane-migrate.ts:358-363`): (1) an existing or non-ignored lane ledger returns as before; (2) any legacy file wins, which keeps AC4b; (3) only then the new linked-worktree feat-lane branch; (4) otherwise the original `resolveTaskPaths(ws)[0] ?? laneTasksPath`. `findLegacyTasksFile` returns `string | null` (`tools/config.ts:489-498`), so replacing `??` with `!== null` is semantically identical. Lane derivation `basename(dirname(laneTasksPath))` matches `resolveLaneDir` (`.current/<lane>`) and the existing idiom at `:447`.
- Write path: `addTaskInFile` → `migrateForWrite` → `ensureTasksMigratedLocked` returns false on a null legacy path, so no migration and no `TASKS_LEDGER_ABSENT`. The writer then `mkdir -p`s `.current/<lane>/`. After the first write the lane ledger exists, and the unchanged early return keeps every later call on it. The lock path (`tasks-file.ts:337/416/506/633`) and the write target resolve through the same function, so they cannot diverge.
- `tasksLaneAdvisory` (`:367-371`) returns null when the ledger equals the lane path, so the new branch suppresses the ignored-lane advisory exactly as AC-E383-1 requires.
- Submodule residual (a submodule checkout also has a `.git` file): accepted. It is recorded in the spec's Implementation notes, the ledger lands beside the handoff in `.current/<lane>/`, and nothing is lost.
- `checkWorktreeEvidence`: the dangling probe runs before `isSafelyLinkedOutside`, so the false branch of that helper means only "resolves inside". One edge: `realpathSync(cwd)` failing returns false and the check stays silent. That is unreachable in practice, since `cwd` was just used to lstat, and it is fail-silent for an advisory.
- Expected reds (step 4a): `qa_reports/expected-red_e383-lane-ledger-and-worktree-evidence.txt` exists and lists 6 entries. All 6 were run (`node --test test/agc-adapters.test.mjs test/e130-lane-default.test.mjs test/skill-manifest.test.mjs` → 76 pass / 6 fail), and the 6 failures are exactly the manifest's test names. The assertion messages show old-behaviour pins: "W1: plain untracked real dir must warn", "a symlink resolving outside the worktree must be silent", "qa_reports/ empty … must still warn", "the advisory warning must still be present alongside the stale-adapter message" (built on the old W-shape). AC6 pins the removed untracked-only symlink paragraph. t-golden-byte-identity pins the pre-change coordinator monolith. These are not regressions. All are T-E385-04 re-pins named in the Cut.
- Regression suites run unedited: e125a, agc-feature-finish-history, agc-feature-lifecycle, e213, e180, e294, e351, e177a, compose-equivalence, e90, context-budget, error-code-contract, e289, e235b → 281/281 pass.

## Quality
- `optional` — `tools/tasks-lane-migrate.ts:340`: `isLinkedWorktree` is now the third copy of the same `statSync(.git).isFile()` probe (`tools/drift.ts:87`, `bin/agc-init.mjs:637`). The spec asks for a module-private mirror, so this is acceptable. A shared helper in `tools/lane-paths.ts` would be a future cleanup.
- `optional` — `bin/agc-init.mjs:1749-1750` (finish region, outside this lane's editable region): the `evidenceAtRisk` comment still says "see hasIgnoredUntrackedContent", which no longer exists. This is already filed as E383-NEW-3. No action this lane.
- Comment check (4b): the added comments (`tasks-lane-migrate.ts:337-339, 348-355`; `agc-init.mjs:625-634, 645-649, 663-667, 695-696, 716-717`) are accurate. They describe current behaviour and cite only ticket ids and repo-relative files, with no sensitive or absolute paths. The rewritten region header is self-contained and drops the pointer to `specs/e260c-bin-scripts.md`, as the spec requires (E383-NEW-1 filed). Kept.

## Architecture
No architecture spec (the spec records no architect hop). Layering is unchanged. The ledger decision stays in the single resolver every `tools/tasks-file.ts` reader and writer already uses. The advisory stays a void, exit-code-neutral call (`bin/agc-init.mjs:894`). `PROMPT_TEMPLATE_3B` is unchanged, per D-E385.
Prose consistency: coord-03 line 17 and lane-protocol §3 `doc.s3-evidence` agree on four points: no symlink back to primary, untracked evidence stays a real dir, `agc feature finish` is the only teardown, and `agc check` warns on outside and dangling links. lane-protocol §1 `doc.s1-git` documents the `PATH=`/`NAME=value` refusal and keeps the E294-pinned tokens. No other surface (`content/`, `templates/`, `prompts/`, `docs/install.md`, `docs/lane-protocol-addendum.md`) still tells lanes to symlink evidence.

## Security
No findings. No new trust-boundary input. `isLinkedWorktree` is a pure `fs.statSync`. The removed helpers took the only `execFileSync` calls out of the advisory path. `hasTrackedContent` keeps the argv-array form. The diff contains no absolute local paths (`git diff -G` for user/temp roots is empty). The doc text follows Constitution §6 hygiene: generic host naming, repo-relative citations only.

## Performance
No regression. The resolver adds one `statSync` only on the already-slow ignored-lane path, after `git check-ignore`. `checkWorktreeEvidence` now spawns zero git processes per dir, where it used to spawn up to three, so `agc check` gets faster.

## Verdict
APPROVED. All sr-owned ACs are implemented and byte-exact against the Copy table. Legacy, `_primary` and not-ignored resolution are unchanged. The 6 expected reds are genuine old-behaviour pins owned by T-E385-04, and no required findings remain.
