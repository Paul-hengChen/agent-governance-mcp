# Review — T-E405-02

covers: T-E405-02, T-E405-03, T-E405-04, T-E405-05, T-E405-06, T-E405-07

## Round 1 — APPROVED — by code-reviewer

Feature `e405-release-cd` (E405 release CD, E401 absorbed). Diff `18ffbc0...HEAD`, `.current` excluded. Contract: `specs/e405-release-cd.md` (with its Post-Review Amendments OQ1–3) and `specs/e405-release-cd-architecture.md`.

## Summary
- `scripts/release.mjs` gains two runner phases, `start` (SOP steps 1–11) and `record` (SOP steps 14–15). It also gains 11 runner-only exit classes (60–64, 70–75), with 9 E394 rows gaining phases; 6 exact `ALLOWED` shapes; a per-call child env with the npm/npx token and `AGC_*` scrub; the `AGC_RELEASE_STOP_FILE` stop-line hand-off; the orchestrator seam; and the E401 dry-run CI gate at publish 8b-2.
- `.github/workflows/release.yml` is new: one job, `workflow_dispatch` only, and every unit is a step in one checkout. `docs/release-cd.md` is new. The SOP changes by exactly two lines (14,690 B) and `CONTRIBUTING.md` gains one line. The expected-red manifest has 5 entries.
- `EXIT_CLASSES` equals the architecture's Exit-Code Table row for row: 42 rows, with distinct codes and ids. The docs class table equals the runner-only filter in code order.
- Release-related tests: 222 run, 215 pass, 5 fail, 2 skipped. The 5 failures are exactly the 5 manifest entries. The render, table and content-pin tests pass (248/248). `check:version` and `check:bookkeeping` exit 0. `dist/` is clean.
- Verdict: APPROVED. No required findings; four optional notes and two O-items for qa and the first real run.

## AC Completeness
Proofs named "qa-owned" are T-E405-08..12 tests not yet written. Each line judges the implementation.
AC-W1 — implemented — `.github/workflows/release.yml` (name `Release`; `on` keys = [`workflow_dispatch`]; inputs bump/tickets/dry_run exactly; js-yaml load verified)
AC-W2 — implemented — release.yml step "Require main" precedes checkout; `concurrency: {group: release, cancel-in-progress: false}`
AC-W3 — implemented — release.yml checkout@v4 `fetch-depth: 0` + `token: ${{ secrets.RELEASE_TOKEN }}`; setup-node@v4 `node-version: 22`; `npm ci` → `npm run build` before step `start-dry-run`
AC-W4 — implemented — `permissions` = {contents: read, issues: write}; GH_TOKEN = RELEASE_TOKEN on the six release.mjs steps; `secrets.*` names = {RELEASE_TOKEN}; `github.token` only at release.yml:153 (issue step)
AC-W5 — implemented — one job; steps start → prepare → publish → record → close-out in one checkout
AC-W6 — implemented — dry run runs only `start-dry-run` (literal `--dry-run`); every later step `if: ${{ !inputs.dry_run }}`; no step outside the script pushes/tags/opens PRs/writes state
AC-W7 — implemented — no `run:` contains `${{` (checked over all 13 steps)
AC-W8 — implemented — "File failure issue", `if: ${{ failure() && !inputs.dry_run }}`, `github.token`, no `--label`, title `Release failed: $class`, body lines 1–3 per spec plus the architecture's `Phase:` line, `NO_STOP_LINE` fallback text verbatim
AC-W9 — implemented — job env 900/900/15; `timeout-minutes: 120` (7200 s > 4500 s)
AC-W10 — implemented — `ci.yml` not in `git diff --name-only`; name `Release` ≠ `CI`
AC-R1 — implemented — release.mjs `stepPrecondition` (tuple + safe `active_feature` checked before the byte-for-byte Buffer copy to `<work-dir>/state.md`; parse failure → PRECONDITION_NOT_PASS)
AC-R2 — implemented — `stepOpeningWrite` → `stateCall` get then update; isError/throw/load failure → STATE_WRITE_REJECTED with the server's first line; dry-run records `state` actions and never loads the orchestrator (`Runner.state`)
AC-R3 — implemented — `stepPreflightCi`: lenient `--ci-check`, non-zero → PREFLIGHT_CI_RED; dry-run overlay `AGC_VERIFY_CI_WAIT_SECONDS=0`
AC-R4 — implemented — `deriveVersion` (probe: 4.18.3 → 4.18.4 / 4.19.0 / 5.0.0); `stepReleaseBranch` local `rev-parse` + `ls-remote` → RELEASE_BRANCH_EXISTS before `switch -c`
AC-R5 — implemented — `bumpVersionFiles`, `moveUnreleased`, `checkLockfileParity`, `stepBumps` (every bump computed before the first write); s3(a) stops CHANGELOG_ENTRY_MISSING before any write
AC-R6 — implemented — `stepBuild` (npx tsc, check-version → VERSION_INCOHERENT, transitions sync), `stepTest`, `stepAudit` with `auditFindings` / `classifyAdvisories`
AC-R7 — implemented — `checkPreMarks` (s3) + `applyDoneMarks` (s10, named rows only, re-checked by `checkDoneMarks`); probe: `E10` untouched when `E1` is named
AC-R8 — implemented — `commitMessage` + `stepMessage` (file under `--work-dir`, OQ2 summary, no trailer; subject matches `releaseSubject`)
AC-R9 — implemented — `stepMergeSha`, `stepClosingWrite`, `stepReadBack`, `readBackMismatch`; re-ran `e405-t05-real-orch.mjs` against the compiled orchestrator: `record OK`, closing triple read back
AC-R10 — implemented — 42 rows, equal to the architecture table (scripted compare); the RS re-pin is qa-owned (T-E405-10)
AC-R11 — implemented — 6 shapes exactly; probe refuses `npm ci`, `npm install`, `npm install lodash`, `npm install --package-lock-only lodash`, `npm publish`, `npm run build`, `npm test -- x`, `npm audit fix`, `npx eslint`, `npx --yes tsc`, `npx tsc --build`; one `spawn(bin, argv` site; no `shell`; the RS/RN proof is qa-owned
AC-R12 — implemented — prepare/publish/close-out step lists, flags, success lines and codes are unchanged; the 8b-2 real-run branch is unchanged (below); RS is green apart from the 3 manifest reds
AC-R13 — implemented — `main` writes the same `line` to `AGC_RELEASE_STOP_FILE` before the final stderr write; `ReleaseStop` already flattens newlines in `detail`, so the line is one line
AC-R14 — implemented — the sr smoke `start --dry-run` / `record --dry-run` (re-run here, 12/12 checks) leaves the tree, index, refs, origin, gh log and `.current/` unchanged, and the orchestrator is never imported
AC-E1 — implemented — `stepPublish` 8b-2 under `--dry-run`: wait 0 overlay → `classifyCiState`; red → CI_GATE_FAILED; else one `DRY-RUN [8b-2] CI state of <sha>: …` line
AC-E2 — implemented — SOP step 13 ends with `sop.e401` verbatim (90 B)
AC-D1 — implemented — `docs/release-cd.md` section order Trigger → Inputs → Secret → Before you trigger → When a run fails → Manual fallback; contents per the Docs outline
AC-D2 — implemented — docs class table equals `EXIT_CLASSES` filtered to runner-only phases, in code order (scripted compare)
AC-D3 — implemented — the pointer appears once (166 B) directly under `## SOP`; step 13 sentence; exactly two changed lines; 14,690 B; the SP/ST re-pins are qa-owned (T-E405-11)
AC-D4 — implemented — `CONTRIBUTING.md` +1 line, `contrib.pointer` verbatim, appearing once
AC-H1 — implemented — `git status --porcelain dist/` empty; no `dist/` path in the diff
AC-H2 — implemented — `check:version` exit 0, `check:bookkeeping` exit 0 on lane HEAD
AC-H3 — implemented — the three absorbed scripts are not in the diff
AC-H4 — implemented — 14,690 ≤ 15,000
AC-H5 — implemented — the AC-H5 grep over the workflow, docs, script and SOP prints nothing
AC-H6 — implemented — no test in the diff; qa-owned
AC-H7 — implemented — `git diff --name-only 18ffbc0...HEAD` ⊆ owned files + `.current/e405/**` + pm/architect specs
AC-H8 — implemented — render-structure, skill-manifest, e92-e86, check-md-tables and e164-e167 pass, 248/248
AC-H9 — implemented — qa-owned (T-E405-12); the 5 current reds are exactly the manifest

## Correctness
No required findings. Verified paths:
- **start order** (`PHASES.start`): pre-1 `preWorkDir` → pre-2 `preGh` → pre-3 `preStart` (main + `@{u}` = `origin/main`) → s1 → s2 → s3(a,b,c) → s4 → s5 (fetch, `pullMain`, derive) → s6 → s7 → s8 → s9 (test, then audit again) → s10 → s11. This is the architecture's step table. Nothing is written in the repository before s1 holds, and the opening write precedes the first git mutation (`fetch` at s5).
- **record order** (`PHASES.record`): pre-1/pre-3 → r14-1 (tag `^{commit}`; a real run without the tag stops USAGE; a dry run uses the placeholder, or the real sha when the tag exists, as accepted) → r14 get-then-update → r15 get + `readBackMismatch`.
- **E401 real-run branch is byte-identical in behaviour**: with `r.dryRun` false, `seen` is `null`, the overlay is `undefined`, and `childEnv` returns the runner env unchanged for `node`. The `else if (ci.status !== 0 || !ci.stdout.includes("CI-CHECK PASSED"))` condition and its detail string are unchanged. `verify-release.mjs` treats `"0"` as a valid budget (`parsedBudget >= 0`), polls once, and never sleeps. 9a is `deferred`, so no other verify-release child waits in a publish dry run.
- **Stop-line one-line guarantee**: `ReleaseStop` collapses `\s*[\r\n]+\s*` in `detail` (probe: a pretty-printed npm error JSON becomes one line), so `tail -n 1` of the stop file always yields the whole `RELEASE_STOP` line.
- **Advisory rule cannot pass an unrecorded HIGH/CRITICAL**: `classifyAdvisories` needs the id as a whole token (`(?<![\w-])…(?![\w-])`). Probe: `GHSA-aaaa-bbbb-ccccX` and `npm-advisory-777` do not satisfy `GHSA-aaaa-bbbb-cccc` / `npm-advisory-77`. A report without `vulnerabilities`, or with `error`, stops AUDIT_FAILED.
- **Bumps**: package.json must deep-equal the old object with only `version` changed; the index literal must match exactly once; README pins are whole tokens (probe: `#v1.2.30` untouched). The `[Unreleased]` move gives `## [Unreleased]`, a blank line, `## [X.Y.Z] - <UTC date>`, a blank line, the entry, a blank line, then the rest. Lockfile parity names the first differing top-level key.
- Optional — `scripts/release.mjs` `stepVersion` (s5): a failed `git fetch origin` stops `MUTATION_FAILED`. The architecture's s5 row lists `MAIN_DIVERGED` / `VERSION_INCOHERENT` and does not name the fetch. `MUTATION_FAILED` carries `start` in its phases and the docs' re-dispatch rule covers it, so this is acceptable as is.

## Quality
- Optional — `scripts/release.mjs` comments at the `unreleasedSection` / `moveUnreleased` heads (around lines 1262 and 1279–1280) contain `## [Unreleased]` / `## [X.Y.Z]` inside backticks. They are kept: each names a literal markdown heading, as the pre-existing E394 comment above `extractChangelogEntry` (around line 663) does, and `runCommentScan` reports nothing for the lane.
- Optional — `.github/workflows/release.yml` lines 1–21: the 21-line header comment largely restates `docs/release-cd.md`. Constitution comment discipline prefers a one-line pointer, but a workflow file has no doc-comment convention, so it is not sent back.
- Carried note (1), s7 `git show HEAD:package-lock.json` printed in full by `exec`: this is acceptable log noise, not a defect. The lockfile is public and carries no secret, and suppressing it would mean a quiet mode on the runner's single `exec` path, which the architecture does not provide.
- Carried note (2), `npm test` / `npm audit --json` stdout in full: this is acceptable and useful. `ci.yml` prints the same suite output, and the full audit report is what a human needs when ADVISORY_UNDISPOSED or AUDIT_FAILED fires.
- Same-model note: sr-engineer and this review both ran on opus (the dispatch pins). A different model was not available within the pins, so blind spots may be shared.

## Architecture
- Matches `specs/e405-release-cd-architecture.md`: the Phase Split and CLI (`--help` text checked), the Work directory files, both step tables, the Exit-Code Table (row-for-row equal), the `ALLOWED` additions (six exact shapes), the child-env scrub, the Interface Contracts (all listed exports present), the orchestrator seam (get before update per process; nothing loaded under `--dry-run`), the Stop-line hand-off, E401 at 8b-2, the Workflow (step list, env, `if` conditions, issue step verbatim), the SOP edits and the Docs outline.
- Source shapes pinned outside the lane still hold: the e164-e167, e336, e297, e166 and e130 tests pass, the portable pull argv appears once (`pullMain`), and STAGE_PATHS is unchanged.
- OQ1–3 rulings are honoured: no `RUNNER_EXIT_CLASSES` second export; the summary is `<active_feature>[ (<E1>, <E2>)]`; a dry run runs only `start --dry-run`, and the docs name v4.19.0 as the first real runner release.
- Optional — `docs/release-cd.md` *Trigger*: "A second dispatch queues behind the running one; nothing cancels it." GitHub concurrency keeps at most one pending run per group, so a third dispatch replaces the queued second. The sentence is accurate for two dispatches only.

## Security
- Array argv only, with one `spawn(bin, argv, …)` call site in `exec` and no `shell`. Each runner method calls `assertAllowed` before `exec`, and `state` actions spawn nothing.
- Refused verbs stay unreachable. Probe: `git reset --hard`, `git rebase main`, `git push origin main`, `git push --force …` and `gh pr merge 1 --admin` are all refused.
- `childEnv` drops `GH_TOKEN`, `GITHUB_TOKEN` and every `AGC_*` key for every `npm` / `npx` child, whatever the overlay.
- In the workflow, inputs reach shells only through `env:`. `TICKETS` is validated by `parseTickets` before any use. The issue step validates the class id against `[A-Z_]`, passes body text through `printf '%s'`, and quotes the title argument. The token surface matches the architecture's Decision Record: `RELEASE_TOKEN` on checkout and on the six release steps, `github.token` on the issue step only, and minimal `permissions`.
- No literal URL, personal path or token pattern in the four files (AC-H5 grep). The bot noreply e-mail is GitHub's public identity, not an internal URL.

## Performance
- No regression on the manual phases: one extra `childEnv` call per spawn, which returns the base env when there is no overlay and the command is not npm/npx.
- The runner adds two `npm audit` calls by design (Decision Record "Fail-fast human artifacts") and one lockfile echo (Quality, carried note 1). There are no loops over unbounded input beyond the backlog and CHANGELOG line scans, which are linear.

## Verdict
APPROVED — every runner-path, workflow, docs and SOP AC is implemented as the architecture fixes it. The safety invariants hold under probe. The 5 reds are exactly the expected-red manifest, and no finding is `required`.

O-items for qa-engineer:
- O1: the RN fixture should cover a real-run `start` through the compiled orchestrator, not only a fake. `e405-t05-real-orch.mjs` exercised `record` against `dist/`, and the opening write was issued directly, not through `stateCall`.
- O2: first real run (v4.19.0, human-triggered) assumes `actions/checkout@v4` leaves `main` tracking `origin/main` (needed by `start` pre-3 and lenient `--ci-check`). That is not verifiable in the lane, so record it for the integrator's first-run watch.
