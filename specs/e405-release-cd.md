# e405-release-cd

Tickets: E405 (P2 — run `scripts/release.mjs` from GitHub Actions so a release no longer consumes agent tokens) and E401 (P3 — `publish --dry-run` really runs the strict CI gate and can wait on CI; absorbed by human ruling 7). Lane `e405`, branch `feat/e405-release-cd`, worktree `../agent-governance-mcp-lanes/e405`.
Scope source: `docs/backlog.md` rows E405 and E401; fan-out manifest `specs/fanout-e405.md` (E405 content, pre-dispatch check, the eight human rulings of Stage 2 on 2026-11-04, common scope, Lanes row `e405`, definition of done).

## Problem Statement

Since E394 (the release SOP rewrite that moved the mechanical steps into `scripts/release.mjs`) a release still needs an agent session: the script runs SOP steps 12, 13 and 16 (`prepare`, `publish`, `close-out`), but the opening write (step 2), the version derivation, release branch, bumps, build, test, advisory check, backlog done-mark and commit message (steps 5–11), and the closing write and read-back (steps 14–15) are prose an agent executes, and the three human decisions (bump kind, CHANGELOG entry, dependency-advisory disposition) are asked in chat. Every release therefore spends agent tokens on work that is mechanical once those decisions exist. This feature adds `.github/workflows/release.yml` (`workflow_dispatch`, inputs `bump`, `tickets`, `dry_run`), extends `scripts/release.mjs` with a runner path that performs steps 1–11 and 14–15 without an agent (state writes go through the in-repo compiled server under `dist/`), turns the human decisions into workflow inputs or artifacts pre-committed to `main`, files a GitHub issue carrying the `RELEASE_STOP` line when a run fails, documents all of it in `docs/release-cd.md`, and keeps the SOP as the manual fallback. It also fixes E401: under `--dry-run` the publish CI gate reports the CI state and never waits.

## User Stories

- As the human releasing this project, I want to trigger one workflow with the bump kind, the ticket ids and a dry-run switch, so that a release runs end to end on GitHub Actions without an agent session.
- As the human, I want every decision I own (the PASS verdict, the CHANGELOG entry, each advisory disposition) to be a reviewed commit on `main` before the run, so that the runner checks facts instead of trusting a checkbox.
- As the human, I want a failed run to open an issue that names the `RELEASE_STOP` class, its detail and the run, so that I know what stopped and where to look without reading the whole log.
- As a release-engineer session, I want the SOP to stay a working manual fallback that points at the automated path, so that a broken runner or a missing secret never blocks a release.
- As a release-engineer session running `publish --dry-run`, I want the CI gate to report the CI state without waiting, so that a dry run is quick and never mistaken for the real gate (E401).

## Acceptance Criteria

Prefixes: **W** = workflow file, **R** = runner path in `scripts/release.mjs`, **E** = E401, **D** = docs and SOP, **H** = hard conditions. `<mb>` in a proof = `git merge-base HEAD main` (never a literal sha). Test files: **WF** = `test/e405-release-workflow.test.mjs`, **RN** = `test/e405-release-runner.test.mjs`, **DC** = `test/e405-release-docs.test.mjs` (all new, qa-authored); **RS** = `test/e394-release-script.test.mjs`, **SP** = `test/e394-release-sop.test.mjs` (re-pinned by qa). Every proof that needs `gh` or `git` uses the injected `spawn` or the PATH shim of RS; no test calls the real GitHub API.

### Workflow (`.github/workflows/release.yml`, new)

- **AC-W1 (dispatch-only trigger, three inputs)** — Given the workflow parsed with `js-yaml`, then its `name` is `Release`; `on` has exactly one key, `workflow_dispatch`; its `inputs` are exactly `bump` (type `choice`, options `patch`, `minor`, `major` in that order, default `patch`, required), `tickets` (type `string`, required, no default) and `dry_run` (type `boolean`, default `true`). No other trigger and no other input exist (human ruling 4).
  proof: WF test "AC-W1 dispatch-only trigger with exactly bump, tickets, dry_run".
- **AC-W2 (main only, one at a time)** — Given the workflow, then every job that runs `scripts/release.mjs` refuses any ref other than `refs/heads/main` before its first release step, and the top-level `concurrency` has group `release` and `cancel-in-progress: false`.
  proof: WF test "AC-W2 main-only guard and a single release concurrency group".
- **AC-W3 (runner setup)** — Given each job that runs `scripts/release.mjs`, then it `runs-on: ubuntu-latest`; it checks out with `actions/checkout@v4` carrying `fetch-depth: 0` (the previous tag must resolve) and `token: ${{ secrets.RELEASE_TOKEN }}`; it sets up `actions/setup-node@v4` with `node-version: 22`; and `npm ci` then `npm run build` run before its first `node scripts/release.mjs` step (the script imports compiled `dist/tools/*.js`).
  proof: WF test "AC-W3 checkout with full history and the release token, Node 22, npm ci then build before the script".
- **AC-W4 (token use)** — Given the workflow, then the top-level `permissions` is exactly `contents: read` and `issues: write`; every step that runs `scripts/release.mjs` has `GH_TOKEN: ${{ secrets.RELEASE_TOKEN }}` in its `env`; `RELEASE_TOKEN` is the only `secrets.*` name in the file; and `secrets.GITHUB_TOKEN` / `github.token` appear only in the failure-issue step (a push or pull request made with `GITHUB_TOKEN` does not trigger the required checks `test (20)` / `test (22)`; human ruling 2).
  proof: WF test "AC-W4 every push, pull request and tag path uses RELEASE_TOKEN; GITHUB_TOKEN only files the issue".
- **AC-W5 (phases in order, state continuity)** — Given the workflow, then the units `prepare`, `publish` and `close-out` (job ids or step ids, split fixed by the architecture) call `node scripts/release.mjs` in that order, preceded by the runner steps for SOP steps 1–11 and with the closing write and read-back (SOP steps 14–15) between `publish` and `close-out`; and the opening write, the closing write and `close-out` operate on the same `.current/_primary/` files (same job, or an explicit artifact hand-off the architecture names), so the bookkeeping pull request carries the run's state writes.
  proof: WF test "AC-W5 phase order and state continuity across the run".
- **AC-W6 (dry run)** — Given `dry_run` is true, then every `node scripts/release.mjs` invocation in the workflow carries `--dry-run`, and no workflow step outside the script pushes, opens a pull request, tags, creates a release or writes state.
  proof: WF test "AC-W6 dry_run puts --dry-run on every script call and nothing else mutates".
- **AC-W7 (input hardening)** — Given the workflow, then no `run:` block contains `${{ inputs.` or `${{ github.event.inputs.`; inputs reach shell steps only through `env:` entries.
  proof: WF test "AC-W7 inputs reach run blocks only through env".
- **AC-W8 (failure files an issue, success files none)** — Given the workflow, then exactly one step, named `File failure issue`, runs `gh issue create` under `if: failure()` with `GH_TOKEN: ${{ github.token }}` and no `--label`; its title is `Release failed: <CLASS_ID>`; its body's first line is the run's last `RELEASE_STOP <CLASS_ID>: <detail>` line byte-for-byte (or the no-stop-line text when the failure printed none, with `<CLASS_ID>` = `NO_STOP_LINE`), its second line is `Run: ${{ github.server_url }}/${{ github.repository }}/actions/runs/${{ github.run_id }}`, its third line is `Inputs: bump=<bump> tickets=<tickets> dry_run=<dry_run>`. No step files an issue on success.
  proof: WF test "AC-W8 one failure-only issue step with the stop line, run link and inputs".
- **AC-W9 (wait budgets fit the job)** — Given the workflow, then `AGC_VERIFY_CI_WAIT_SECONDS` and `AGC_RELEASE_MERGE_WAIT_SECONDS` are set explicitly for the script steps and every job's `timeout-minutes` exceeds the sum of the waits that job can incur (values fixed by the architecture).
  proof: WF test "AC-W9 explicit wait budgets inside the job timeout".
- **AC-W10 (CI workflow untouched)** — Given the lane diff, then `.github/workflows/ci.yml` is unchanged and the new workflow's `name` is not `CI` (`verify-release.mjs --ci-check` queries runs of the workflow named `CI`).
  proof: `git diff --stat <mb> -- .github/workflows/ci.yml` prints nothing, and WF test "AC-W1 dispatch-only trigger with exactly bump, tickets, dry_run" asserts the name.

### Runner path (`scripts/release.mjs`)

- **AC-R1 (precondition read from `main`, ruling 3)** — Given a checkout whose `.current/_primary/handoff.md` tuple is not `(qa-engineer, PASS)`, when the runner path starts, then it stops `PRECONDITION_NOT_PASS` naming the tuple, before any file write, git mutation or state write; given `(qa-engineer, PASS)`, it copies that handoff verbatim to a file outside the repository root before the opening write and passes the copy as `prepare --state`.
  proof: RN test "AC-R1 the main handoff must be (qa-engineer, PASS) before anything is written".
- **AC-R2 (opening write, SOP step 2)** — Given the precondition holds, when the runner path continues, then it calls `handleGetState` and then `handleUpdateState` from the compiled `dist/tools/handoff-orchestrator.js` (injectable for tests) with `agent_id="release-engineer"`, `status="In_Progress"`, `active_feature` unchanged and `pending_notes=["release-engineer: starting release for <active_feature>"]`, before the first git mutation; a rejected write stops `STATE_WRITE_REJECTED` with the server's code in the detail; under `--dry-run` no update call is made.
  proof: RN test "AC-R2 opening write through the compiled server, before any git mutation".
- **AC-R3 (pre-flight CI, SOP step 4)** — Given the opening write landed, when pre-flight runs, then it calls `node scripts/verify-release.mjs --ci-check` (lenient, no `--strict`) for the checked-out `main` head; a definite red stops `PREFLIGHT_CI_RED`; a warning continues; under `--dry-run` it never waits (AC-E1 semantics).
  proof: RN test "AC-R3 lenient pre-flight CI: red stops, a warning continues".
- **AC-R4 (version and release branch, SOP steps 5–6)** — Given `main`'s `package.json` version `x.y.z` and the `bump` input, then the version is `x.y.(z+1)` for `patch`, `x.(y+1).0` for `minor`, `(x+1).0.0` for `major` (choosing `major` in the dispatch form is the explicit opt-in); a `release/vX.Y.Z` branch existing locally or on `origin` stops `RELEASE_BRANCH_EXISTS` before any branch is created; otherwise the path runs `git switch -c release/vX.Y.Z` from the up-to-date `main` head.
  proof: RN test "AC-R4 version derivation per bump kind and an existing release branch stops".
- **AC-R5 (bumps, SOP step 7; ruling 4)** — Given the release branch, then the path writes `package.json` `version`, the `index.ts` `Server({ name, version })` literal and README `#v<old>` → `#vX.Y.Z` pins; it moves the content under `CHANGELOG.md` `## [Unreleased]` into a new `## [X.Y.Z] - <UTC date>` section directly below an emptied `## [Unreleased]`; it runs `npm install --package-lock-only`, whose lockfile diff must touch only the root `version` and `packages[""].version`. An `## [Unreleased]` section with no entry content stops `CHANGELOG_ENTRY_MISSING` before any write.
  proof: RN test "AC-R5 bumps, CHANGELOG Unreleased becomes the version entry, lockfile parity".
- **AC-R6 (build, test, advisories, SOP steps 8–9; ruling 5)** — Given the bumps, then the path runs `npx tsc`, `node scripts/check-version.mjs` and the transitions-sync check, then `npm test`, then `npm audit --audit-level=high`; a build or sync failure stops `BUILD_FAILED` (a `check-version.mjs` failure stops `VERSION_INCOHERENT`); a test failure stops `TEST_FAILED`; each HIGH or CRITICAL advisory whose advisory id does not appear in `docs/dependency-advisories.md` stops `ADVISORY_UNDISPOSED` naming the package and the id; a recorded advisory continues and is named in the run log.
  proof: RN test "AC-R6 build, test and advisory stops, each its own class".
- **AC-R7 (done-mark, SOP step 10; ruling 1)** — Given `tickets` = `E1[,E2…]`, then in each named `docs/backlog.md` row the phrase `not yet released` is replaced in place by `shipped vX.Y.Z`; a named row whose description does not start `**DONE` or does not contain `not yet released` stops `DONE_MARK`; no other line of `docs/backlog.md` changes; `tickets` = `none` writes nothing to the backlog. `prepare`'s existing done-mark check and `check-bookkeeping.mjs` then pass on the result.
  proof: RN test "AC-R7 automatic done-mark amends only the named pre-marked rows".
- **AC-R8 (commit message, SOP step 11)** — Given the done-mark, then the path writes the commit message to a file outside the repository root whose first line is `chore(release): vX.Y.Z — <summary>`, `<summary>` derived from the pre-committed artifacts by the rule the architecture fixes (no workflow input supplies it), with no attribution trailer.
  proof: RN test "AC-R8 commit message file outside the root, derived summary, no trailer".
- **AC-R9 (closing write and read-back, SOP steps 14–15)** — Given `publish` ended `release: publish OK (vX.Y.Z) — tag at <merge-sha>`, then the path calls `handleUpdateState` with `agent_id="release-engineer"`, `status="In_Progress"`, `active_feature` unchanged, `next_role="pm"`, `pending_notes=["Released vX.Y.Z", "tag: <merge-sha>"]`, then `handleGetState`; a rejected write stops `STATE_WRITE_REJECTED`; a read-back whose `last_agent`, `status`, `next_role` or `pending_notes` differ stops `READBACK_MISMATCH`; `close-out` runs only after a match; under `--dry-run` neither write runs.
  proof: RN test "AC-R9 closing triple, read-back match gates close-out".
- **AC-R10 (exit table grows, never renumbers)** — Given `EXIT_CLASSES`, then its 31 E394 rows keep their `code` and `id` (their `phases` may gain the runner phase or phases); it adds one row per new class id in *Copy / Strings* plus any the architecture adds, each with a distinct code that keeps the decade grouping; the table equals, row for row, the union of the E394 architecture's Exit-Code Table and the E405 architecture's new rows.
  proof: RS test "AC-S2 exit table equals the architecture tables row for row" (re-pinned by qa).
- **AC-R11 (allow-list grows only by named verbs)** — Given `ALLOWED`, then it gains only the `npm`, `npx` and `node` argv shapes the architecture enumerates for SOP steps 7–9 (lockfile refresh, `tsc`, transitions sync, test, audit); `npm ci`, `npm install <package>`, `npm publish` and any other `npx` command stay refused; the runner keeps one `spawnSync` call site and array argv; no `shell: true`.
  proof: RS test "AC-S3 isAllowed admits the allow-list and refuses every absent verb" (re-pinned) and RN test "AC-R11 only the enumerated npm and npx shapes are admitted".
- **AC-R12 (manual CLI unchanged)** — Given the three phase command lines the SOP prescribes, then their flags, stdout success lines, stop lines and exit codes are unchanged; every RS test passes, edited only where AC-R10, AC-R11 or AC-E1 require, each edited title naming that AC.
  proof: `node scripts/test-lock.mjs -- node --test test/e394-release-script.test.mjs` green, and the qa evidence lists each re-pinned title with its AC.
- **AC-R13 (stop line reaches the issue unchanged)** — Given any runner-path stop, then the script exits with the class code and its last stderr line is `RELEASE_STOP <CLASS_ID>: <detail>`, and the mechanism the architecture fixes for the workflow to read that line (for example a stop-line file) yields the same bytes.
  proof: RN test "AC-R13 the stop line the workflow reads equals the last stderr line".
- **AC-R14 (runner dry run mutates nothing)** — Given a good fixture, when the whole runner path runs with `--dry-run`, then it exits 0 and leaves the working tree, the index, every ref, the fixture remote, the gh shim's mutation log and `.current/` unchanged, and the injected orchestrator receives no update call.
  proof: RN test "AC-R14 runner dry run mutates nothing and writes no state".

### E401

- **AC-E1 (publish dry run never waits on CI)** — Given `publish --dry-run` with an open release pull request whose head CI run is still in progress, when step 8b-2 runs, then the script neither polls nor sleeps (no `verify-release.mjs` child receives a non-zero wait budget), prints one line naming the CI state of the head sha, and continues; a completed red CI still stops `CI_GATE_FAILED`; the real run keeps `--ci-check --strict --sha <head>` with its wait budget unchanged.
  proof: RN test "AC-E1 publish --dry-run reports the CI state without waiting" and RS tests "AC-S7 only CI-CHECK PASSED continues; a red or silent gate stops before the merge" and "L:E163 publish gate is --ci-check --strict" green.
- **AC-E2 (SOP says so)** — Given `content/skill-release-engineer.md`, then step 13 ends with the sentence `sop.e401` (*Copy / Strings*) verbatim.
  proof: SP test "AC-E2 step 13 says the dry-run CI gate never waits".

### Docs and SOP

- **AC-D1 (`docs/release-cd.md`, new)** — Given the file, then it has, in this order, the sections `## Trigger` (the `gh workflow run release.yml -f bump=<kind> -f tickets=<ids|none> -f dry_run=<true|false>` line and the Actions UI path), `## Inputs` (the three inputs of AC-W1), `## Secret` (`RELEASE_TOKEN`, a fine-grained personal access token with Contents read and write, Pull requests read and write, Actions read, Metadata read, created by a human in the repository's Actions secrets, never written to any file), `## Before you trigger` (the checklist: the release-gate feature's `(qa-engineer, PASS)` write and the CHANGELOG entry under `## [Unreleased]` are on `main` through one `docs/*` pull request; each HIGH or CRITICAL `npm audit` advisory has its row in `docs/dependency-advisories.md` and no re-review trigger has fired; each named backlog row carries the `not yet released` pre-mark; a dry run passed), `## When a run fails` (the issue title shape, how to read the class, the runner-only class table, a pointer to the SOP's *Escalation Routes* for the other classes), `## Manual fallback` (the SOP).
  proof: DC test "AC-D1 release-cd sections, inputs, secret and checklist".
- **AC-D2 (class table bijection)** — Given `docs/release-cd.md`, then its class table has one row per `EXIT_CLASSES` row whose phases are only runner phases, in code order, and no other row.
  proof: DC test "AC-D2 runner-only classes map one to one onto the docs table".
- **AC-D3 (SOP: two edits, one bijection re-pin)** — Given `content/skill-release-engineer.md`, then the line `sop.cd-pointer` appears exactly once, as its own paragraph directly under `## SOP`; step 13 carries `sop.e401`; nothing else in the file changes; `wc -c` ≤ 15,000; the SOP's *Escalation Routes* exit rows stay a bijection with the `EXIT_CLASSES` rows whose phases include `prepare`, `publish` or `close-out` (SP's AC-P4 is re-pinned to that filter, and so is the one assertion of `test/release-staging.test.mjs` that pins the same bijection — test "E53/E163: the Escalation Routes table is one row per exit class …", around line 1050; integrator ruling OQ1, 2026-11-04); every other test that reads the SOP passes unedited.
  proof: SP tests "AC-D3 one CD pointer under SOP", "AC-H5 size is at most 15000 bytes" and "AC-P4 one row per exit code, valid next_role" (re-pinned), plus `git diff <mb> -- content/skill-release-engineer.md` showing exactly two changed lines and the full suite green.
- **AC-D4 (CONTRIBUTING pointer)** — Given `CONTRIBUTING.md`, then its Dev workflow list gains exactly one line, `contrib.pointer` (*Copy / Strings*), and nothing else changes.
  proof: DC test "AC-D4 CONTRIBUTING names the release workflow once".

### Hard conditions

- **AC-H1 (dist)** — `npm run build` leaves `dist/` unchanged and the lane diff has no `dist/` path.
  proof: `npm run build && git status --porcelain dist/ && git diff --stat <mb> -- dist/` prints nothing.
- **AC-H2 (bookkeeping checks)** — `npm run check:version` and `npm run check:bookkeeping` exit 0 on lane HEAD.
  proof: `npm run -s check:version; echo "exit=$?"; npm run -s check:bookkeeping; echo "exit=$?"` prints `exit=0` twice.
- **AC-H3 (absorbed scripts unchanged)** — `scripts/verify-release.mjs`, `scripts/check-version.mjs` and `scripts/check-bookkeeping.mjs` have no diff, and their tests pass unedited.
  proof: `git diff --stat <mb> -- scripts/verify-release.mjs scripts/check-version.mjs scripts/check-bookkeeping.mjs test/check-version.test.mjs test/e299-check-bookkeeping.test.mjs test/e320-ci-check-sha.test.mjs test/e326-empty-branch-run-poll.test.mjs test/verify-release.test.mjs` prints nothing.
- **AC-H4 (SOP size)** — `wc -c < content/skill-release-engineer.md` ≤ 15000.
  proof: `wc -c < content/skill-release-engineer.md`.
- **AC-H5 (information hygiene)** — No token value, personal path or literal URL appears in the workflow, the docs, the script or the SOP.
  proof: `grep -nE 'github_pa[t]_|gh[pousr]_[A-Za-z0-9]{36}|/User[s]/|/hom[e]/|https?:/[/]' .github/workflows/release.yml docs/release-cd.md scripts/release.mjs content/skill-release-engineer.md` prints nothing (the workflow builds the run link from `${{ github.server_url }}`).
- **AC-H6 (test discipline)** — The new and re-pinned tests call no real GitHub API (`gh` and `git` remote calls go through the injected `spawn` or the PATH shim), diff against no literal base sha, and assert no content of a real `specs/fanout-*.md`.
  proof: `grep -nE 'specs/fanout-|"fanout-' test/e405-*.test.mjs` prints nothing, and qa review of the test diff confirms no `git diff` / `git log` argv carries a literal sha and every `gh` call is faked.
- **AC-H7 (ownership)** — Every path in `git diff --name-only <mb>` is in the Lanes row's owned cell or is lane bookkeeping (`.current/e405/**`, `qa_reports/*E405*`, `review_reports/*E405*`).
  proof: `git diff --name-only <mb>` reviewed against the owned cell at mailbox pre-review and at qa.
- **AC-H8 (render and tables)** — The SOP still renders glue-free and passes the `qa_review` corpus sweep; every markdown table the lane adds passes the table checker.
  proof: `node scripts/test-lock.mjs -- node --test test/render-structure.test.mjs test/skill-manifest.test.mjs test/e92-e86-handoff-write-boundary.test.mjs test/check-md-tables.test.mjs` green.
- **AC-H9 (suite)** — Full suite green on the final HEAD, run after the last commit with no untracked file.
  proof: `node scripts/test-lock.mjs -- npm test`, suite-result recorded in the QA evidence.

## Copy / Strings

| string id | exact text (quote verbatim) | source |
|---|---|---|
| wf.name | `Release` | authored-here — must differ from `CI`, the workflow name `verify-release.mjs --ci-check` queries |
| wf.input.bump | `bump` — choice `patch` / `minor` / `major`, default `patch` | `specs/fanout-e405.md` human ruling 4 |
| wf.input.tickets | `tickets` — string, `E1,E2` or `none` | `specs/fanout-e405.md` human ruling 4 |
| wf.input.dry_run | `dry_run` — boolean, default `true` | ruling 4 (name); default authored-here — a run that ships needs a deliberate untick |
| wf.secret | `RELEASE_TOKEN` | `specs/fanout-e405.md` human ruling 2 (name delegated to PM; the recommended name kept) |
| wf.concurrency | `release` | authored-here — one release at a time |
| wf.units | `prepare`, `publish`, `close-out` | `specs/e394-release-sop-rewrite-architecture.md` *Phase Split* (phase names); job-vs-step split fixed by the E405 architecture |
| wf.issue-step | `File failure issue` | authored-here — names what the step does |
| wf.issue-title | `Release failed: <CLASS_ID>` | authored-here — the class is the first thing to read |
| wf.issue-body.1 | the last `RELEASE_STOP <CLASS_ID>: <detail>` stderr line, byte-for-byte; when none: `No RELEASE_STOP line was printed; read the run log.` | `specs/e394-release-sop-rewrite-architecture.md` *Output format*; fallback authored-here |
| wf.issue-body.2 | `Run: ${{ github.server_url }}/${{ github.repository }}/actions/runs/${{ github.run_id }}` | authored-here — run link built from context, no literal URL |
| wf.issue-body.3 | `Inputs: bump=<bump> tickets=<tickets> dry_run=<dry_run>` | authored-here |
| wf.no-stop-class | `NO_STOP_LINE` | authored-here — title placeholder when the failure printed no stop line (not an `EXIT_CLASSES` row) |
| stop.precondition | `PRECONDITION_NOT_PASS` | ruling 3 — main handoff tuple is not (qa-engineer, PASS) |
| stop.preflight | `PREFLIGHT_CI_RED` | SOP step 4 on the runner — lenient pre-flight reports a definite red |
| stop.branch | `RELEASE_BRANCH_EXISTS` | SOP step 6 on the runner |
| stop.changelog | `CHANGELOG_ENTRY_MISSING` | ruling 4 — no pre-committed entry under `## [Unreleased]` |
| stop.build | `BUILD_FAILED` | SOP step 8 on the runner (`npx tsc`, transitions sync) |
| stop.test | `TEST_FAILED` | SOP step 9 on the runner (`npm test`) |
| stop.advisory | `ADVISORY_UNDISPOSED` | ruling 5 ("new exit class") |
| stop.state-write | `STATE_WRITE_REJECTED` | SOP steps 2 and 14 on the runner — the server refused the write |
| stop.readback | `READBACK_MISMATCH` | SOP step 15 on the runner |
| stop.codes | one code per class above, decade-grouped | authored-here — fixed in the E405 architecture's exit-table rows (T-E405-01) |
| script.cli | the runner-path command line(s) and flags | authored-here — fixed in the E405 architecture (T-E405-01), as E394 fixed its CLI in its architecture |
| state.opening | `release-engineer: starting release for <active_feature>` | `content/skill-release-engineer.md` step 2 (kept) |
| state.closing | `Released vX.Y.Z`, `tag: <merge-sha>` | `content/skill-release-engineer.md` step 14 (kept); `gates/feature-lease.ts` keys on `^Released v` |
| backlog.shipped | `not yet released` → `shipped vX.Y.Z` | the integrator's pre-mark convention, as the v4.18.0 release commit amended rows E392 and E394 |
| commit.subject | `chore(release): vX.Y.Z — <summary>` | `specs/e394-release-sop-rewrite-architecture.md` *CLI* (`--message-file`) |
| changelog.version | `## [X.Y.Z] - <YYYY-MM-DD>` below `## [Unreleased]` | `content/skill-release-engineer.md` step 7 (kept); `CHANGELOG.md` already carries `## [Unreleased]` |
| sop.cd-pointer | `` Automated path: `.github/workflows/release.yml` runs this procedure on GitHub Actions without an agent — see `docs/release-cd.md`; this SOP is its manual fallback. `` (166 bytes with its newline) | authored-here — the manifest's "one line pointing to docs/release-cd.md" |
| sop.e401 | `` Under `--dry-run` the CI gate reports the release head's CI state and never waits for it. `` (90 bytes, leading space included, appended to step 13) | authored-here — E401's "report the CI state without waiting" |
| contrib.pointer | `` - Releases run from GitHub Actions: see `docs/release-cd.md` (the release-engineer SOP is the manual fallback). `` | authored-here — the manifest's optional Dev workflow pointer |
| docs.trigger | `gh workflow run release.yml -f bump=<kind> -f tickets=<ids\|none> -f dry_run=<true\|false>` | authored-here — the `gh` form of the dispatch |

## Visual Tokens

| token id | property | value (quote verbatim) | source |
|---|---|---|---|
| N/A | — | — | feature has no visual literals |

## Visual Widgets

| widget id | description | source-node |
|---|---|---|
| N/A | — | feature has no non-primitive widgets |

## Out of Scope

- Creating the `RELEASE_TOKEN` secret, verifying that it exists, or switching to a GitHub App token (ruling 2: a human creates it before the first real run; an App is a later ticket).
- Running the workflow for real, and the first real release (v4.19.0, which ships E405 itself; triggered by the human after integration, ruling 6). The lane's qa verifies `--dry-run` paths, YAML structure and injected-`spawn` behaviour only.
- `.github/workflows/ci.yml`, `scripts/verify-release.mjs`, `scripts/check-version.mjs`, `scripts/check-bookkeeping.mjs`, `tools/**`, `dist/**`, `package.json` (no `release` npm alias), `docs/backlog.md`, `docs/dependency-advisories.md`, `CHANGELOG.md`, `templates/**`, every `content/**` file other than the two SOP edits.
- Changing `STAGE_PATHS` (see *Dependencies*, fact F1).
- E402 (content-level handoff parser export), E404 (slimming the release-engineer template), E406 (staging member directories wholesale).
- Release bookkeeping for E405/E401 themselves (version bump, CHANGELOG, backlog done-marks, queue #214 and #217): integrator 5c and the release after integration.

## Dependencies / Prerequisites

None blocking. Binding human rulings (`specs/fanout-e405.md`, Stage 2, 2026-11-04 — "approve, 1–8 as recommended"), fixed constraints of this spec, not open questions:
1. **Scope**: SOP steps 2, 5–11 and 14–15 are automated inside `scripts/release.mjs` (a new phase or pre-steps of `prepare`, chosen by the architect), not as scattered workflow shell steps; the version derives from `main`'s `package.json` plus `bump`; the done-mark is written from `--tickets` (AC-R4, AC-R7).
2. **Token**: fine-grained PAT with Contents RW, Pull requests RW, Actions R, Metadata R; secret name chosen here as `RELEASE_TOKEN`; a human creates it before the first real run (AC-W4, AC-D1).
3. **Runner state source**: the release-gate feature's `(qa-engineer, PASS)` write is committed to `main` by a `docs/*` pull request before the run; the workflow checks the tuple and stops if it does not match; no "human vouches for PASS" input (AC-R1).
4. **CHANGELOG and inputs**: the CHANGELOG entry is pre-committed in that same pull request; the inputs are exactly `bump`, `tickets`, `dry_run` (AC-W1, AC-R5).
5. **Advisories**: no input; `npm audit --audit-level=high` findings without a row in `docs/dependency-advisories.md` stop with a new class (AC-R6).
6. **First real run**: v4.19.0 through the workflow after integration, the SOP as fallback; the lane verifies dry-run, structure and injected-spawn paths only.
7. **E401** absorbed: `--dry-run` does not wait on CI; the SOP's dry-run sentence changes with it (AC-E1, AC-E2).
8. **Dispatch pins**: pm opus, architect opus, sr-engineer opus, code-reviewer opus, qa-engineer sonnet.

Facts the architecture builds on (verified at dispatch):
- **F1** — `STAGE_PATHS.featureDirs` in `scripts/release.mjs` includes `.github/` (lines 42–43; `test/release-staging.test.mjs` lines 58–61 list it too). The manifest's pre-dispatch note saying it does not is wrong. A release commit made from a dirty local tree would stage a modified `release.yml`; on a clean runner checkout this cannot happen. `STAGE_PATHS` is not changed.
- **F2** — The publish CI gate is `r.read("node", ["scripts/verify-release.mjs", "--ci-check", "--strict", "--sha", <headRefOid>], { step: "8b-2" })` (~line 901). `read` actions execute under `--dry-run`, which is why E401's dry run waits; the fix lives in `release.mjs` only.
- **F3** — `dist/tools/handoff-orchestrator.js` exports `handleGetState` and `handleUpdateState`; a get then an update in one process satisfies the pre-flight guard, and writes stamped through the server path carry millisecond `last_updated` (stamp-provenance never fires). `.current/_primary/handoff.md`, `tasks.md` and `*.jsonl` are tracked.
- **F4** — The `main` ruleset requires checks `test (20)` and `test (22)`, strict up-to-date, a pull request, merge method `merge` only. Pushes and pull requests made with `GITHUB_TOKEN` trigger no workflow, so every push, pull request and tag push uses `RELEASE_TOKEN`; filing the failure issue is not a push and uses `GITHUB_TOKEN` with `issues: write`.

Derived constraints (no option choice; listed for the integrator's pre-review):
- **C1 — the pre-committed entry sits under `## [Unreleased]`.** `npm run build` runs `check:version` as its prebuild, and `scripts/check-version.mjs` stops when the highest `## [x.y.z]` heading differs from `package.json`. A `## [X.Y.Z]` heading committed to `main` before the bump would turn the docs pull request's required checks red. `## [Unreleased]` (already present in `CHANGELOG.md`) matches no version heading, so the entry is committed there and the runner moves it (AC-R5).
- **C2 — new classes are runner-only; the SOP gets no new Escalation rows.** The SOP has 566 bytes of headroom and the lane may change only two of its lines (≈ 256 bytes, budgeted in *Copy / Strings*). A class whose phases include `prepare`, `publish` or `close-out` would need an SOP row, so every new class belongs only to the runner phase(s); the 31 existing rows keep code and id; runner-only classes are documented in `docs/release-cd.md` (AC-D2, AC-D3). If the architecture needs a new class in a manual phase, it goes back to mailbox pre-review with its byte cost.
- **C3 — the done-mark is mechanical only on a pre-marked row.** The script cannot author the one-line summary an agent wrote before; it amends the integrator's `not yet released` pre-mark, and a named row without one stops (AC-R7). The pre-trigger checklist says so.
- **C4 — pre-flight CI (SOP step 4) runs on the runner too.** It is outside ruling 1's step list but is a read-only call of an absorbed script, and the run has no agent to do it; dropping it would let a red `main` reach a pushed release branch (AC-R3).
- **C5 — the commit summary has no input.** Ruling 4 fixes the inputs, so the summary derives from the pre-committed artifacts by a rule the architecture fixes and `docs/release-cd.md` states (AC-R8).
- **C6 — state survives the job boundary.** The opening and closing writes change `.current/_primary/`, which `close-out` commits; a fresh job checkout would lose them, so the architecture keeps them in one job or hands them over explicitly (AC-W5).

No design file (mode: no-design); Visual Structural Assertions omitted. Resource Audit: no external reference in the E405 or E401 rows or the manifest; `external_refs` omitted.

Expected-red window: once the sr tasks add `EXIT_CLASSES` rows (T-E405-02) and allow-list shapes (T-E405-04), and change the dry-run CI gate (T-E405-05), these tests are red by design until qa re-pins them: RS "AC-S2 exit table equals the architecture table row for row" (31-row count, single architecture table), RS "AC-S3 isAllowed admits the allow-list and refuses every absent verb" (`npm test` in the refused list), any RS test that expects the dry-run CI gate to wait, and SP "AC-P4 one row per exit code, valid next_role" (bijection over the whole table). sr-engineer lists the red tests in its `pending_notes`; a red test outside this list is a regression.

Chain: pm → architect (T-E405-01; second mailbox pre-review of its Open Questions) → sr-engineer (T-E405-02..07, consecutive sessions) → code-reviewer (whole diff) → qa-engineer (T-E405-08..12). Hops: about 10 on the clean path, inside the cap of 14 with one review and one QA round.

## Step Map (SOP step → runner destination → AC → task)

| SOP step | on the runner | AC | task |
|---|---|---|---|
| 1 precondition, `--state` copy | read `main`'s `.current/_primary/handoff.md`; copy outside the root | AC-R1 | T-E405-02 |
| 2 opening write | `handleGetState` + `handleUpdateState` from `dist/` | AC-R2 | T-E405-02 |
| 3 human decisions | inputs `bump`, `tickets`; CHANGELOG under `## [Unreleased]`; advisory rows (pre-committed) | AC-W1, AC-R5, AC-R6 | T-E405-03, T-E405-04 |
| 4 pre-flight CI | lenient `--ci-check` | AC-R3 | T-E405-03 |
| 5–6 version, release branch | derivation; branch-exists stop; `switch -c` | AC-R4 | T-E405-03 |
| 7 bumps | package, index literal, CHANGELOG move, README pins, lockfile | AC-R5 | T-E405-03 |
| 8–9 build, test, audit | `npx tsc`, check-version, transitions sync, `npm test`, `npm audit` | AC-R6, AC-R11 | T-E405-04 |
| 10–11 done-mark, message file | automatic amend; derived subject | AC-R7, AC-R8 | T-E405-04 |
| 12–13 `prepare`, `publish` | existing phases; E401 dry-run gate | AC-R12, AC-E1 | T-E405-05 |
| 14–15 closing write, read-back | `dist/` server path | AC-R9 | T-E405-05 |
| 16 `close-out` | existing phase | AC-R12 | — |
| 17 reply | issue on failure; run summary on success | AC-W8, AC-R13 | T-E405-05, T-E405-06 |

## Gate Summary

| gate | outcome |
|---|---|
| Visual State-Count Split | not triggered — no design file |
| Geometric-Density Split | not triggered — non-design |
| Parallel-Lane Cut | already a single fan-out lane; inside it `serial — shared layer`: the workflow, docs and SOP edits depend on the script's classes, flags and stop-line contract |
| Scope Decision | non-design (not gated); `scope_decision: "single-feature"` set per the manifest's one-lane plan and the eight rulings |
| Resource Audit | grep of rows E405, E401 and the manifest for `http(s)://`, figma, sketch, mockup, 設計圖, URL, link, see, Azure DevOps, JIRA: no external reference (hits are repo paths and the in-workflow run link); `external_refs` omitted |
| Source-Credibility | not applicable — no fetch-based design |
| Question Batch | no-op — the eight rulings are decided; derived constraints C1–C6 listed for pre-review |
| Ambiguity | none load-bearing |
| Cut-Approval | Task-dispatched: cut in the final reply; `cut_approved` not set; mailbox pre-review first, then human approval in the coordinator's chat |
| Manifest-Tier Self-Attestation | `.current/.config.json` `cutApprovalAutoTier` has no `manifest: true` → not eligible |
| needs human ruling | none |

## Cut

| id | desc | depends_on | est. files | touches | design-link |
|---|---|---|---|---|---|
| T-E405-01 | architect: workflow↔script contract — job/step split and state continuity (C6); runner phase(s) or pre-steps for SOP steps 1–11 and 14–15 with CLI flags and env; new exit-class codes (decade grouping, runner-only per C2) and any added classes; `ALLOWED` npm/npx/node shapes; orchestrator import seam; dry-run semantics incl. E401; commit-summary rule (C5); advisory matching rule; stop-line hand-off to the issue step; wait budgets and job timeouts; `docs/release-cd.md` outline; the two SOP edits within the byte budget (~350 lines) | none | 1 | `specs/e405-release-cd-architecture.md` | — |
| T-E405-02 | sr: runner-path skeleton in `release.mjs` — CLI, new `EXIT_CLASSES` rows, orchestrator dynamic-import seam, main-handoff precondition and `--state` copy, opening write (AC-R1, R2, R10, R13) (~220 lines) | T-E405-01 | 1 | `scripts/release.mjs` | — |
| T-E405-03 | sr: pre-flight CI, version derivation, release-branch stop and `switch -c`, bumps incl. CHANGELOG `## [Unreleased]` move and lockfile refresh (AC-R3, R4, R5) (~260 lines) | T-E405-02 | 1 | `scripts/release.mjs` | — |
| T-E405-04 | sr: build, test and audit with the `ALLOWED` extension, automatic done-mark, commit message file, hand-off into `prepare` (AC-R6, R7, R8, R11) (~260 lines) | T-E405-03 | 1 | `scripts/release.mjs` | — |
| T-E405-05 | sr: closing write and read-back before `close-out`, E401 dry-run CI gate, whole-path dry run (AC-R9, R14, E1) (~200 lines) | T-E405-04 | 1 | `scripts/release.mjs` | — |
| T-E405-06 | sr: new workflow file (AC-W1..W9) (~150 lines) | T-E405-05 | 1 | `.github/workflows/release.yml` | — |
| T-E405-07 | sr: `docs/release-cd.md` (AC-D1, D2), the two SOP edits (AC-E2, D3), the CONTRIBUTING pointer (AC-D4) (~160 lines) | T-E405-06 | 3 | `docs/release-cd.md`、`content/skill-release-engineer.md`、`CONTRIBUTING.md` | — |
| T-E405-08 | qa: new workflow structure test (AC-W1..W10) | T-E405-07 | 1 | `test/e405-release-workflow.test.mjs` | — |
| T-E405-09 | qa: new runner-path test with injected spawn and orchestrator (AC-R1..R9, R11, R13, R14, E1) | T-E405-07 | 1 | `test/e405-release-runner.test.mjs` | — |
| T-E405-10 | qa: re-pin the release-script test — exit table union, allow-list shapes, dry-run CI gate; each edited title names its AC (AC-R10, R11, R12, E1) | T-E405-07 | 1 | `test/e394-release-script.test.mjs` | — |
| T-E405-11 | qa: re-pin the SOP test (AC-P4 filter, AC-E2, AC-D3), re-pin the one exit-row bijection assertion of the staging test to the same filter (AC-D3; nothing else in that file), and new docs test (AC-D1, D2, D4) | T-E405-07 | 3 | `test/e394-release-sop.test.mjs`、`test/release-staging.test.mjs`、`test/e405-release-docs.test.mjs` | — |
| T-E405-12 | qa: hard conditions AC-H1..H9, full suite under test-lock on the final HEAD, evidence | T-E405-08, T-E405-09, T-E405-10, T-E405-11 | 0 | — | — |

## Post-Review Amendments

- **Architecture pre-review (integrator, 2026-11-04, mailbox to-lane#2)** — the three Open Questions of `specs/e405-release-cd-architecture.md` are settled: (OQ1) `test/release-staging.test.mjs` is added to the lane's owned files for ONE assertion only (the exit-row bijection test near line 1050), re-pinned by qa in T-E405-11 to the manual-phase filter; AC-D3 and the Cut row above carry the change; the `RUNNER_EXIT_CLASSES` fallback is rejected. (OQ2) the release commit summary is `<active_feature>` when `tickets` is `none`, else `<active_feature> (<E1>, <E2>)`; the same string is the tag message and the GitHub release title; `docs/release-cd.md` states the rule. (OQ3) `dry_run: true` runs only `start --dry-run` and the later steps are skipped by an `if` condition; `docs/release-cd.md` says a dry run covers only `start` (precondition, CHANGELOG entry, pre-marks, advisories, pre-flight CI, version derivation, bump computation) and that the first `prepare`/`publish`/`close-out` on a runner is the v4.19.0 release itself (human ruling 6); the pre-trigger checklist's "a dry run passed" reads accordingly. The ownership change lives in the primary checkout's manifest and lands with the wave bookkeeping commit; the lane branch's copy of `specs/fanout-e405.md` predates it.
