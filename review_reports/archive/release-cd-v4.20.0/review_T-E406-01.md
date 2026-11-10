# Review — T-E406-01

## Round 1 — APPROVED (task-level; the round's handoff is CHANGES_REQUESTED on T-E203-01) — by code-reviewer

## Summary
- `scripts/release.mjs` step 8a-1 now stages by explicit path: tracked changes via one `git add --update -- <planStage(tracked)>`, plan-named untracked paths (N) via one `git add -- <paths>`; unplanned untracked paths are warned once each on stderr and left out (commit b38ad15).
- Supporting changes: `readStatusEntries` keeps the `??` flag (`readStatusPaths` kept as a thin wrapper for `checkScope` / 13a-3); `STAGE_FILES` derived from `STAGE_MEMBERS`; step 7a records `freshRoots`; `multiFeatureNames` is the one shared parser for 8a-1 N(b) and `classifySpecCheck`; `checkStagingCompleteness` gains optional `unplanned` → `warnings`.
- Every hard constraint holds: `planStage({ changed, exists })` unchanged; `["add", "--", ...plan]` literal at 13a-4 (`scripts/release.mjs:1150`) untouched; `export function checkStagingCompleteness(` and the `STAGING_INCOMPLETE` throw text unchanged; both `leftovers([...])` argv arrays (`diff --name-only …` and `ls-files --others --exclude-standard …`, both `:!.current`) still in `step8aStage`.
- Expected-red manifest matches the actual e394 reds exactly (27/27); no red outside lane-owned `test/e394-release-script.test.mjs`.
- Verdict for this task: APPROVED (no required findings).

## AC Completeness
AC-E406-1 — implemented — `scripts/release.mjs:700-709`: unplanned `ls-files --others` leftovers go to `unplanned`, one `release: [8a-1] warning: untracked <p> is named by no release plan entry — left out of the release commit` per path via `ctx.err`; never staged (only `untracked ∩ named` reaches `git add --`, `:670-672`), never fatal (`warnings` never touch `pass`, `:639`). Test pin is T-E406-02.
AC-E406-2 — implemented — `:672-682`: `["add", "--update", "--", ...plan]` where `plan = planStage({ changed: [...tracked] })`, then `["add", "--", ...paths]` with exact file paths from status (`--untracked-files=all` lists files, never directories).
AC-E406-3 — implemented — `planNamedPaths` `:645-649`: N(a) `STAGE_FILES` (`:60`), N(b) active feature + `multiFeatureNames` filtered by `safeSegment` (the same predicate 8a-3's `specExists` applies, `:841`), N(c) `ctx.archived[].to`, N(d) `ctx.freshRoots` = fresh root files of participating trees minus moved sources (`:479-481`). In dry-run `ctx.staged` = `changed.filter(covered)` with `covered` admitting `added`, so 8a-2/8a-3 see the specs in the union.
AC-E406-4 — implemented — `:633-639`: `unplanned` defaults to `[]`, returned as `warnings: [...unplanned]`, absent from `problems`; existing inputs keep their verdicts; `untracked` now carries only plan-named leftovers.
AC-E406-5 — implemented — `:76-77`: second disjunct `a[1] === "--update" && a[2] === "--" && a.length > 3`; `["add","--update"]`, `["add","--update","docs/"]`, `["add","-A"]` all refused; `["add","--","a.txt"]` still admitted. ALLOW regex re-pin is T-E406-02 (in the manifest).
AC-E406-6 — implemented — `:660-668`: dry-run stand-ins classified into tracked / untracked / gone the same way a real run's status would; both `git add` shapes are `r.mutate` (recorded, not executed); the warning loop is shared with the real run; `leftovers` filters `covered` or `gone` only under dry-run.
AC-E406-7 — implemented — `checkScope` untouched; nothing-to-commit branch (`:683-691`) now keyed on `plan.length === 0 && paths.length === 0` = "no planned path to stage", body unchanged; 13a-4 untouched; e166 / e130 / e405 / release-staging / e115 green (171 tests, 0 fail, 2 skipped).

## Correctness
No required findings. Checked:
- Rename entries: the `R`/`C` origin path is recorded as tracked (`:341`); `--update` over the member covers the index-side deletion as before.
- Real run: `missing` only sees `changed = tracked ∪ plan-named untracked`, so a feature dir holding only an unplanned untracked file never trips the `missing` problem; if nothing else is staged it reaches the nothing-to-commit stop, which AC-E406-7 keeps.
- A 7a move that was "kept" (destination already existed) leaves its source in `freshRoots` and its destination in N(c): both are plan-named, matching the spec's N(c)/N(d) wording.
- An excluded/ignored plan-named path (e.g. `.current/.config.json` under a local exclude) never appears as `??`, so `git add --` is never asked to add an ignored path.
- `classifySpecCheck` parity: the old `m` was a match object, the new `m` is an array or null; an empty name list (`Multi-feature release: (x)`) is `[]`, truthy, so the MULTI-FEATURE branch is taken with an empty loop exactly as before.
- Expected-red (step 4a): manifest present; actual e394 reds diffed against it — identical 27 entries. Sampled `AC-S3 verb allow-list and array argv` (`test/e394-release-script.test.mjs:451`), `AC-S6 a Multi-feature release note …` (`:612`), `L:E50 …` (`:1117`), `AC-S1 dry-run mutates nothing, per phase` (`:395`): all real tests. L:E71b reasoning verified: `:1158-1165` writes `docs/a file with spaces.md` untracked and asserts it is in the release commit — under AC-E406-1 that path is unplanned, so the case stays red after the `workTree` re-pin and needs its own re-pin (make it a tracked change). The manifest's reasoning is correct.

## Quality
- optional — `scripts/release.mjs:674` `ctx.stagePlan = plan` has no reader in `scripts/`, `bin/` or `test/` (pre-existing, and now names only the `--update` half of the stage). Drop it or document it in a later touch.
- optional — `step8aStage` local `paths` (`:672`) could be named for what it holds (plan-named untracked paths); it sits next to `plan` and `named`, which makes the three easy to confuse.
- New comments are short WHAT/WHY lines; `agc check — comments` reports nothing in `scripts/release.mjs`.

## Architecture
No `specs/e406-release-and-merge-scripts-architecture.md` (no architect hop). The change stays inside 8a-1 plus the two small 7a / 8a-3 seams the Cut Sites list; one shared Multi-feature parser as the spec asks.

## Security
No findings. Every new child-process call is array argv through the allow-list; the new `--update` rule requires the `--` separator, so no path can be read as an option. N(b) names are `safeSegment`-filtered before becoming `specs/<n>.md`.

## Performance
No findings. One status read as before; `planNamedPaths` is a Set built once per run; the dry-run stand-in loop is linear in the recorded actions.

## Verdict
APPROVED — all seven E406 ACs are implemented within the hard constraints, with no required findings; the round as a whole returns to sr-engineer only for T-E203-01.

## Round 2 — APPROVED (confirmation) — by code-reviewer

Covered by the round-2 report in `review_reports/review_T-E203-01.md` (`covers: T-E203-01, T-E406-01`). `git diff b38ad15 HEAD -- scripts/release.mjs` is empty, so T-E406-01 is byte-unchanged since its round-1 APPROVED. `node --test test/e394-release-script.test.mjs` still fails exactly the 27 tests listed in `qa_reports/expected-red_e406-release-and-merge-scripts.txt` (T-E406-02 re-pins). The round-1 verdict stands: APPROVED.
