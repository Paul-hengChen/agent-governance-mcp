# e405-release-cd — architecture

Companion to `specs/e405-release-cd.md` (T-E405-01). The work: E405 (run the release on GitHub Actions so it uses no agent tokens) and E401 (a dry-run CI gate never waits). It extends the contract of `specs/e394-release-sop-rewrite-architecture.md` (E394, the release SOP rewrite into `scripts/release.mjs`): three phases, the runner and its dry-run recorder, `ALLOWED`, the stop line, `main(argv, deps)`. Anything this file does not restate stays as E394 fixed it.

Abbreviations: **RS** = `test/e394-release-script.test.mjs`, **SP** = `test/e394-release-sop.test.mjs`, **WF** / **RN** / **DC** = the new `test/e405-release-{workflow,runner,docs}.test.mjs`, **ST** = `test/release-staging.test.mjs`. `s<N>` = a step of the new `start` phase that does SOP step N; `r<N>` = a step of the new `record` phase.

## Affected Files

| path | change | task |
|---|---|---|
| `scripts/release.mjs` | modify — two runner phases `start` and `record`, 11 new exit classes plus phase additions on 9 existing rows, `ALLOWED` gains 6 argv shapes, per-call child env, the stop-line file, the orchestrator seam, the E401 dry-run CI gate | T-E405-02..05 |
| `.github/workflows/release.yml` | new — one job, `workflow_dispatch` only (*Workflow*) | T-E405-06 |
| `docs/release-cd.md` | new (*Docs outline*) | T-E405-07 |
| `content/skill-release-engineer.md` | two lines only (*SOP edits*), 14,434 → 14,690 bytes | T-E405-07 |
| `CONTRIBUTING.md` | one line (`contrib.pointer`) after the `npm audit --audit-level=high` bullet of *Dev workflow* | T-E405-07 |
| `test/e405-release-workflow.test.mjs`, `test/e405-release-runner.test.mjs`, `test/e405-release-docs.test.mjs` | new, qa-owned (*Test seams*) | T-E405-08, 09, 11 |
| `test/e394-release-script.test.mjs`, `test/e394-release-sop.test.mjs` | re-pinned, qa-owned (*Test seams*) | T-E405-10, 11 |
| `test/release-staging.test.mjs` | **one assertion conflicts with AC-R10 + C2; it is outside the lane's ownership** — Open Question 1 | — |
| `.github/workflows/ci.yml`, `scripts/verify-release.mjs`, `scripts/check-version.mjs`, `scripts/check-bookkeeping.mjs`, `tools/**`, `dist/**`, `package.json`, `CHANGELOG.md`, `docs/backlog.md`, `templates/**` | unchanged — `release.mjs` calls the three scripts as subprocesses with their CLIs unchanged; no `.ts` changes, so `dist/` has no diff | — |

`release.mjs` stays one file with only `node:*` imports at module level. `node:util` (`isDeepStrictEqual`) is added beside the existing ones. Three compiled modules are imported at runtime, each through an injectable seam: `dist/tools/handoff-parse.js` and `dist/tools/lane-paths.js` (unchanged) and `dist/tools/handoff-orchestrator.js` (new).

## Phase Split

Five phases. The new ones are `start` (SOP steps 1–11) and `record` (SOP steps 14–15). `prepare`, `publish` and `close-out` keep their CLI, step lists, stdout lines and exit codes (AC-R12). E401 changes only how step 8b-2 behaves under `--dry-run`.

| phase | SOP steps | starts on | inputs | ends with (stdout last line) |
|---|---|---|---|---|
| `start` (new) | 1–11 | `main` with upstream `origin/main` | `--bump`, `--tickets`, `--work-dir` | `release: start OK (vX.Y.Z) — release/vX.Y.Z bumped, built and tested` |
| `prepare` | 12 | `release/vX.Y.Z` | unchanged | unchanged |
| `publish` | 13 | unchanged | unchanged | unchanged |
| `record` (new) | 14–15 | `main` after `publish` | `--version` | `release: record OK (vX.Y.Z) — read-back matches the closing write` |
| `close-out` | 16 | unchanged | unchanged | unchanged |

Under `--dry-run` every phase still ends `release: <phase> DRY-RUN OK (vX.Y.Z) — nothing changed`. `start` sets `opts.version` in s5, and `main` prints that line from it.

### CLI

```
node scripts/release.mjs start     --bump <patch|minor|major> --tickets <E1[,E2…]|none> --work-dir <dir> [--dry-run]
node scripts/release.mjs prepare   --version X.Y.Z --state <file> --tickets <E1[,E2…]|none> --message-file <file> [--dry-run]
node scripts/release.mjs publish   --version X.Y.Z [--dry-run]
node scripts/release.mjs record    --version X.Y.Z [--dry-run]
node scripts/release.mjs close-out --version X.Y.Z [--dry-run]
node scripts/release.mjs --help
```

- `start` requires all three flags. `--bump` must be one of the three words. `--tickets` uses `prepare`'s rule exactly (ids matching `^[A-Z]+\d+[A-Za-z0-9]*$`, comma-separated, no spaces; or `none`). `--work-dir` is created if absent and must resolve outside the repository root (realpath compare, the same as `readInput`). Any failure → `USAGE`.
- The unknown-phase detail becomes `expected start, prepare, publish, record or close-out`. `USAGE_TEXT` gains the two lines above.
- Environment (new): `AGC_RELEASE_STOP_FILE` (*Stop-line hand-off*). Unchanged: `AGC_RELEASE_MERGE_WAIT_SECONDS`, `AGC_RELEASE_POLL_SECONDS`, `AGC_VERIFY_CI_WAIT_SECONDS`.

### Work directory (start → prepare / workflow)

Every file lives outside the repository root, so none can be staged and none trips the root-file completeness check.

| file | written by | read by | content |
|---|---|---|---|
| `<work-dir>/state.md` | s1, after the tuple check and before s2 | `prepare --state` | `.current/<lane>/handoff.md`, copied byte for byte |
| `<work-dir>/message.txt` | s11 | `prepare --message-file` | *Commit message* |
| `<work-dir>/version` | s11, the last write of `start` | the workflow's `start` step → `$GITHUB_OUTPUT` | `X.Y.Z\n` |

These are plain `fs` writes, not runner actions, because the runner refuses paths outside the root. They are made under `--dry-run` too, because nothing in the repository changes. Each one prints `release: [s<N>] wrote <work-dir>/<name>`.

### Step order — `start`

`read` actions run under `--dry-run`. `mutate`, `fs`, `deferred` and the new `state` actions are recorded and not run (E394 recorder semantics).

| step | action | stop class | under `--dry-run` |
|---|---|---|---|
| pre-1 | parse args; create and check `--work-dir` | `USAGE` | same |
| pre-2 | `gh auth status` | `GH_UNAVAILABLE` | read |
| pre-3 | `rev-parse --abbrev-ref HEAD` = `main`; `rev-parse --abbrev-ref --symbolic-full-name @{u}` = `origin/main` | `WRONG_BRANCH` | read |
| s1 | lane = `laneDir(ctx)` (the close-out resolver). Read `.current/<lane>/handoff.md`, parse it with `parseHandoffCopy`, require `(qa-engineer, PASS)` and a safe `active_feature`, **then** copy the text to `<work-dir>/state.md` | `LANE_UNRESOLVED`, `PRECONDITION_NOT_PASS` (also when the parse fails) | same |
| s2 | opening write: `get`, then `update` (*Orchestrator seam*) | `STATE_WRITE_REJECTED` | `state` actions recorded; the orchestrator is not loaded |
| s3 | (a) `unreleasedEntry(CHANGELOG.md)` is non-empty; (b) `checkPreMarks` over the named backlog rows; (c) `npm audit --audit-level=high --json` → `auditFindings` → `classifyAdvisories` | `CHANGELOG_ENTRY_MISSING`; `DONE_MARK`; `AUDIT_FAILED`, `ADVISORY_UNDISPOSED` | reads run |
| s4 | `node scripts/verify-release.mjs --ci-check` (lenient, HEAD): non-zero = a definite red; WARN lines continue | `PREFLIGHT_CI_RED` | read, child env `AGC_VERIFY_CI_WAIT_SECONDS=0` |
| s5 | `git fetch origin`; `pullMain(ctx, "s5")` (the one portable pull site); read `package.json`; `deriveVersion` | `MAIN_DIVERGED`; `VERSION_INCOHERENT` (version is not `x.y.z`) | fetch and pull recorded |
| s6 | `rev-parse -q --verify refs/heads/release/vX.Y.Z` and `ls-remote --heads origin refs/heads/release/vX.Y.Z` must both be empty, then `git switch -c release/vX.Y.Z` | `RELEASE_BRANCH_EXISTS`; `MUTATION_FAILED` | `switch` recorded (`runner.branch` follows the plan) |
| s7 | `bumpVersionFiles` → write `package.json`, `index.ts`, `README.md`; `moveUnreleased` → write `CHANGELOG.md`; `npm install --package-lock-only`; `checkLockfileParity` over `deferred` `git show HEAD:package-lock.json` and the file on disk | `VERSION_INCOHERENT`, `CHANGELOG_ENTRY_MISSING`, `MUTATION_FAILED`, `LOCKFILE_DRIFT` | writes and install recorded; parity skipped (deferred read returns null) |
| s8 | `npx tsc`; `node scripts/check-version.mjs`; `node scripts/check-transitions-sync.mjs` — all `deferred` | `BUILD_FAILED`; `VERSION_INCOHERENT`; `BUILD_FAILED` | deferred |
| s9 | `npm test` (`deferred`), then `npm audit --audit-level=high --json` (read) with s3(c)'s rule | `TEST_FAILED`; `AUDIT_FAILED`, `ADVISORY_UNDISPOSED` | test deferred, audit runs |
| s10 | tickets ≠ `none`: `applyDoneMarks` → write `docs/backlog.md` | `DONE_MARK` | write recorded |
| s11 | `commitMessage` → `<work-dir>/message.txt`; then `<work-dir>/version` | — | written |

The order follows AC-R1 (nothing is written before the tuple is checked) and AC-R2 (the opening write comes before the first git mutation, `fetch` at s5). s3 is fail-fast: the three human-owned artifacts are checked before branch, bump or build work. s9 repeats the audit after the test, as AC-R6 orders, and as the SOP does with steps 3 and 9.

### Step order — `record`

| step | action | stop class |
|---|---|---|
| pre-1 | parse args | `USAGE` |
| pre-3 | `requireBranch(main)` | `WRONG_BRANCH` |
| r14-1 | merge sha = `rev-parse -q --verify refs/tags/vX.Y.Z^{commit}`. A real run with no such tag → `USAGE` `record runs after publish: v<X.Y.Z> has no tag`. Under `--dry-run` the placeholder `<merge-commit>` is used | `USAGE` |
| r14 | `get` (pre-flight guard and freshness snapshot for this process; `active_feature` read from it), then `update` with the closing triple (*Data Structures*) | `STATE_WRITE_REJECTED` |
| r15 | `get` → `readBackMismatch`; any difference → stop, detail `<field>: wrote <a>, read <b>` (the SOP note's shape) | `READBACK_MISMATCH` |

Under `--dry-run` r14 and r15 are recorded `state` actions and the orchestrator is not loaded (AC-R9, AC-R14). The merge sha comes from the tag `publish` pushed, not from parsing `publish` stdout, so `record` needs no hand-off file.

### Bump, CHANGELOG, lockfile, done-mark rules (s7, s10)

- `deriveVersion(x.y.z, bump)`: patch → `x.y.(z+1)`, minor → `x.(y+1).0`, major → `(x+1).0.0`.
- `package.json`: replace the first `"version": "<old>"` in the text. The result must parse, and must equal the old object with only `version` changed (`isDeepStrictEqual`). Otherwise `VERSION_INCOHERENT`.
- `index.ts`: replace the one match of `name:\s*"<package name>",\s*version:\s*"<old>"` (the `check-version.mjs` pattern, with the name read from `package.json`). Zero or several matches → `VERSION_INCOHERENT`.
- `README.md`: replace every `#v<old>` whole-token pin (the `pinsTag` boundary `(?!\w|\.\d)`) with `#vX.Y.Z`. No pin → `VERSION_INCOHERENT`.
- `moveUnreleased(text, version, date)`: the section is the lines after the exact line `## [Unreleased]`, up to the next `## ` line. Leading and trailing blank lines are trimmed. A missing heading or an empty section → `CHANGELOG_ENTRY_MISSING`. A `## [X.Y.Z] - ` heading that already exists → `VERSION_INCOHERENT`. The output is `## [Unreleased]`, a blank line, `## [X.Y.Z] - <date>`, a blank line, the section, a blank line, then the rest of the file unchanged. `<date>` = `deps.now().toISOString().slice(0, 10)` (UTC).
- `checkLockfileParity({ before, after, oldVersion, newVersion })`: take the HEAD lockfile, set its root `version` and `packages[""].version` to the new version, and it must deep-equal the file on disk. Otherwise `LOCKFILE_DRIFT` names the first differing top-level key. A HEAD with no lockfile skips the check (as `check-version.mjs` does).
- `checkPreMarks({ backlogText, tickets })` (s3): each id has exactly one `| <id> |` row, its desc cell starts `**DONE` and contains the exact phrase `not yet released`. Otherwise `DONE_MARK` with one problem per id. `none` → no check.
- `applyDoneMarks({ backlogText, tickets, version })` (s10): in each named row only, replace every `not yet released` with `shipped vX.Y.Z`. The result must pass `checkDoneMarks` with `diffLines` built from the changed rows. Otherwise `DONE_MARK`. `prepare` 7c and `check-bookkeeping.mjs` then pass on the output (AC-R7).

### Advisory rule (s3, s9; ruling 5)

`auditFindings(stdout)`: the stdout must be a JSON object with an object `vulnerabilities` and no `error` key. Otherwise `AUDIT_FAILED` with the exit status and the first 300 characters. For each `vulnerabilities[name].via[]` entry that is an object with `severity` `high` or `critical`, the finding is `{ pkg: via.name ?? name, id, severity }`, de-duplicated by `(pkg, id)`. `id` is the `GHSA-xxxx-xxxx-xxxx` token in `via.url`, else `npm-advisory-<via.source>`. String `via` entries point at another package's finding and are skipped. `classifyAdvisories({ findings, recordText })`: a finding is recorded when its `id` occurs in `docs/dependency-advisories.md`, and each recorded one is logged as `release: [s<N>] advisory <pkg> (<id>) recorded in docs/dependency-advisories.md`. Any unrecorded ones → `ADVISORY_UNDISPOSED` with detail `npm audit flagged <pkg> (<id>) with no disposition in docs/dependency-advisories.md`, joined by `; `. Whether a recorded row's re-review trigger has fired stays a human check in the pre-trigger checklist (*Decision Records*).

### Commit message (s11; C5)

```
chore(release): vX.Y.Z — <summary>

Release gate: <active_feature> (qa-engineer PASS committed to main).
Tickets: <E1, E2 | none>.
Bump: <bump> from v<old>.
```

`<summary>` follows Open Question 2's rule. No attribution trailer (AC-R8). No repository path appears in the message, so *Record integrity* cannot fail on it.

## Workflow (`.github/workflows/release.yml`)

One job, `release`. Every unit is a step, so `.current/_primary/`, the release branch and the work directory share one working tree from the opening write to `close-out` (C6). No artifact hand-off is needed.

```yaml
name: Release
on:
  workflow_dispatch:
    inputs:
      bump:     { description: "...", type: choice, options: [patch, minor, major], default: patch, required: true }
      tickets:  { description: "...", type: string, required: true }
      dry_run:  { description: "...", type: boolean, default: true }
permissions: { contents: read, issues: write }
concurrency: { group: release, cancel-in-progress: false }
jobs:
  release:
    runs-on: ubuntu-latest
    timeout-minutes: 120
    env:
      AGC_VERIFY_CI_WAIT_SECONDS: "900"
      AGC_RELEASE_MERGE_WAIT_SECONDS: "900"
      AGC_RELEASE_POLL_SECONDS: "15"
      GIT_AUTHOR_NAME: "github-actions[bot]"
      GIT_AUTHOR_EMAIL: "41898282+github-actions[bot]@users.noreply.github.com"
      GIT_COMMITTER_NAME: "github-actions[bot]"
      GIT_COMMITTER_EMAIL: "41898282+github-actions[bot]@users.noreply.github.com"
    steps:
      # 1 "Require main"        env REF: ${{ github.ref }}; exits 1 with a message unless "$REF" = refs/heads/main
      # 2 "Work directory"      mkdir -p "$RUNNER_TEMP/release"; appends RELEASE_DIR=$RUNNER_TEMP/release and
      #                         AGC_RELEASE_STOP_FILE=$RUNNER_TEMP/release/stop-line.txt to "$GITHUB_ENV"
      # 3 actions/checkout@v4   with: fetch-depth: 0, token: ${{ secrets.RELEASE_TOKEN }}  (persist-credentials left at its default, true)
      # 4 actions/setup-node@v4 with: node-version: 22, cache: npm
      # 5 "Install dependencies" run: npm ci
      # 6 "Build"               run: npm run build
      # 7 id start-dry-run  if: ${{ inputs.dry_run }}
      #     run: node scripts/release.mjs start --bump "$BUMP" --tickets "$TICKETS" --work-dir "$RELEASE_DIR" --dry-run
      # 8 id start          if: ${{ !inputs.dry_run }}
      #     run: node scripts/release.mjs start --bump "$BUMP" --tickets "$TICKETS" --work-dir "$RELEASE_DIR"
      #          echo "version=$(cat "$RELEASE_DIR/version")" >> "$GITHUB_OUTPUT"
      # 9 id prepare        if: ${{ !inputs.dry_run }}
      #     run: node scripts/release.mjs prepare --version "$VERSION" --state "$RELEASE_DIR/state.md" --tickets "$TICKETS" --message-file "$RELEASE_DIR/message.txt"
      # 10 id publish       if: ${{ !inputs.dry_run }}   run: node scripts/release.mjs publish --version "$VERSION"
      # 11 id record        if: ${{ !inputs.dry_run }}   run: node scripts/release.mjs record --version "$VERSION"
      # 12 id close-out     if: ${{ !inputs.dry_run }}   run: node scripts/release.mjs close-out --version "$VERSION"
      # 13 name "File failure issue"  if: ${{ failure() && !inputs.dry_run }}   (below)
```

Step env for 7–12: `GH_TOKEN: ${{ secrets.RELEASE_TOKEN }}` on every step. `BUMP: ${{ inputs.bump }}` and `TICKETS: ${{ inputs.tickets }}` where a step uses them. `VERSION: ${{ steps.start.outputs.version }}` on 9–12. Steps 1–6 have no `GH_TOKEN`.

Contract, one line per item:

| item | producer → consumer | rule |
|---|---|---|
| inputs | dispatch → `env:` only | no `run:` block contains `${{` (AC-W7, stated more strictly) |
| ref guard | step 1 → every later step | job fails before checkout unless `refs/heads/main` (AC-W2); `start` pre-3 checks again |
| tokens | secret → checkout + step env | `actions/checkout` gets `token: ${{ secrets.RELEASE_TOKEN }}` and keeps `persist-credentials: true`, so every `git fetch` / `git push` the script makes authenticates as that token through the checkout's stored credential. Every release step sets `GH_TOKEN: ${{ secrets.RELEASE_TOKEN }}`, so every `gh` call (including those inside `verify-release.mjs`) uses the same token. Only the issue step overrides `GH_TOKEN` with `${{ github.token }}` (integrator note b; AC-W4) |
| git identity | job `env` → `git commit`, `git tag -a` | `GIT_AUTHOR_*` / `GIT_COMMITTER_*` in the job env; the runner passes its env to every git child. Nothing is written to git config and the script has no identity code (integrator note a) |
| version | `start` → `<work-dir>/version` → `$GITHUB_OUTPUT` → `VERSION` | set only on a real run |
| state continuity | s2, r14 and close-out 13a all touch `.current/_primary/` in one checkout | C6, AC-W5 |
| stop line | `release.mjs` → `$AGC_RELEASE_STOP_FILE` → step 13 | *Stop-line hand-off* |
| waits | job `env` → `release.mjs` and `verify-release.mjs` | *Wait budgets* |
| dry run | `inputs.dry_run` | only step 7 runs, with the literal `--dry-run`. Steps 8–12 and 13 are skipped. No issue is filed (Open Question 3 for the scope of a dry run) |

Step 13, the only use of `github.token`:

```yaml
- name: File failure issue
  if: ${{ failure() && !inputs.dry_run }}
  env:
    GH_TOKEN: ${{ github.token }}
    RUN_URL: ${{ github.server_url }}/${{ github.repository }}/actions/runs/${{ github.run_id }}
    BUMP: ${{ inputs.bump }}
    TICKETS: ${{ inputs.tickets }}
    DRY_RUN: ${{ inputs.dry_run }}
    PHASE: ${{ steps.start.outcome == 'failure' && 'start' || steps.prepare.outcome == 'failure' && 'prepare' || steps.publish.outcome == 'failure' && 'publish' || steps.record.outcome == 'failure' && 'record' || steps['close-out'].outcome == 'failure' && 'close-out' || 'setup' }}
  run: |
    stop="No RELEASE_STOP line was printed; read the run log."
    class=NO_STOP_LINE
    if [ -n "${AGC_RELEASE_STOP_FILE:-}" ] && [ -s "$AGC_RELEASE_STOP_FILE" ]; then
      line="$(tail -n 1 "$AGC_RELEASE_STOP_FILE")"
      case "$line" in
        "RELEASE_STOP "*) id="${line#RELEASE_STOP }"; id="${id%%:*}"
          case "$id" in ""|*[!A-Z_]*) ;; *) stop="$line"; class="$id" ;; esac ;;
      esac
    fi
    printf '%s\nRun: %s\nInputs: bump=%s tickets=%s dry_run=%s\nPhase: %s\n' "$stop" "$RUN_URL" "$BUMP" "$TICKETS" "$DRY_RUN" "$PHASE" > "$RUNNER_TEMP/release-issue.md"
    gh issue create --repo "$GITHUB_REPOSITORY" --title "Release failed: $class" --body-file "$RUNNER_TEMP/release-issue.md"
```

Lines 1–3 of the body are AC-W8's. Line 4 (`Phase:`) is added. It has no `--label`, and a run that succeeds files nothing. A run cancelled by hand or by `timeout-minutes` is `cancelled`, not `failure`, so it files no issue. The docs say so.

### Stop-line hand-off (AC-R13)

`main`'s catch block builds `line = "RELEASE_STOP <CLASS_ID>: <detail>\n"`. It prints `line` as the last stderr write, as today. When `env.AGC_RELEASE_STOP_FILE` (from `deps.env ?? process.env`) is non-empty, it also writes `line` to that path with `writeFileSync`, replacing any earlier content, inside a `try` that never masks the stop. The file therefore holds the same bytes as the last stderr line. Every phase does this, including the three E394 phases. A crash before `main` runs (for example an import error) writes no file, and the issue says `NO_STOP_LINE`.

### Wait budgets (AC-W9)

| wait | where | bound |
|---|---|---|
| pre-flight CI (lenient) | `start` s4 | `AGC_VERIFY_CI_WAIT_SECONDS` = 900 |
| strict CI gate | `publish` 8b-2 | 900 |
| release PR merge | `publish` 8c-2 | `AGC_RELEASE_MERGE_WAIT_SECONDS` = 900 |
| self-check CI ground truth (lenient Check 6) | `publish` 9a | 900 |
| bookkeeping PR merge (needs its own CI run) | `close-out` 13a-6 | 900 |

The worst case is 3 × 900 + 2 × 900 = 4,500 s (75 min). Other work (`npm ci`, build, `tsc`, `npm test`, audits) takes about 10 min, since recent `CI` runs took 3–4 min. `timeout-minutes: 120` gives 7,200 s > 4,500 s plus the other work. WF asserts `timeout-minutes × 60 > 3 × AGC_VERIFY_CI_WAIT_SECONDS + 2 × AGC_RELEASE_MERGE_WAIT_SECONDS`.

## Exit-Code Table

Machine-read: rows whose first cell is an integer equal `EXIT_CLASSES` row for row (`code`, `id`, `phases`). This is the only such table in this file. The 31 E394 rows keep their `code` and `id`, and 9 of them gain `start` and/or `record`. The 11 new rows are runner-only, in two new decades: 60s runner state and gates, 70s runner bump, build and checks. Phases are listed in run order: `start, prepare, publish, record, close-out`.

| code | class | phases | trigger (E394 trigger unchanged unless stated) | change |
|---|---|---|---|---|
| 1 | INTERNAL | start, prepare, publish, record, close-out | uncaught error, or the runner refused a call outside `ALLOWED` | + start, record |
| 2 | USAGE | start, prepare, publish, record, close-out | E394; `start`: bad `--bump` / `--tickets` / `--work-dir` (missing, or inside the repository); `record`: no `vX.Y.Z` tag yet | + start, record |
| 10 | WRONG_BRANCH | start, prepare, publish, record, close-out | E394; `start`, `record`: not on `main`, or `main` has no upstream `origin/main` (`start`) | + start, record |
| 11 | STALE_BASE | prepare | — | — |
| 12 | VERSION_INCOHERENT | start, prepare | E394; `start`: version at HEAD not `x.y.z`, a bump target not found exactly once, the `## [X.Y.Z]` heading already present, `check-version.mjs` non-zero after `npx tsc` | + start |
| 13 | UNRELATED_CHANGES | prepare, close-out | — | — |
| 14 | GH_UNAVAILABLE | start, prepare, publish, close-out | E394; `start` pre-2 | + start |
| 20 | EMPTY_BASELINE | prepare | — | — |
| 21 | DRIFT_BASELINE | prepare | — | — |
| 22 | DONE_MARK | start, prepare | E394; `start`: a named row is missing or not unique, does not start `**DONE` or lacks `not yet released` (s3), or the amended row fails `checkDoneMarks` (s10) | + start |
| 23 | BOOKKEEPING_CHECK | prepare | — | — |
| 24 | ADAPTER_STAMP | prepare | — | — |
| 30 | STAGING_INCOMPLETE | prepare | — | — |
| 31 | CHANGELOG_CITATION | prepare | — | — |
| 32 | SPEC_REQUIRE | prepare | — | — |
| 33 | SPEC_UNCLASSIFIABLE | prepare | — | — |
| 34 | PUSH_REJECTED | prepare, publish, close-out | — | — |
| 35 | MUTATION_FAILED | start, prepare, publish, close-out | E394; `start`: `git switch -c`, `npm install --package-lock-only` non-zero | + start |
| 40 | TAG_EXISTS | publish | — | — |
| 41 | CI_GATE_FAILED | publish | E394; under `--dry-run` only a completed red run stops (E401) | — |
| 42 | PR_CANNOT_MERGE | publish, close-out | — | — |
| 43 | MERGE_WAIT_TIMEOUT | publish, close-out | — | — |
| 44 | MAIN_DIVERGED | start, publish, close-out | E394; `start` s5: `pull --ff-only` non-zero | + start |
| 45 | SELF_CHECK_FAILED | publish | — | — |
| 50 | CLOSING_WRITE_ABSENT | close-out | — | — |
| 51 | LANE_UNRESOLVED | start, close-out | E394; `start` s1 uses the same resolver | + start |
| 52 | EMPTY_STAGE | close-out | — | — |
| 53 | BRANCH_EXISTS | close-out | — | — |
| 54 | CLOSE_OUT_NO_UPSTREAM | close-out | — | — |
| 55 | CLOSE_OUT_AHEAD | close-out | — | — |
| 56 | CLOSE_OUT_UNVERIFIED | close-out | — | — |
| 60 | PRECONDITION_NOT_PASS | start | `.current/<lane>/handoff.md` on the checkout is not `(qa-engineer, PASS)`, has no safe `active_feature`, or cannot be parsed; the detail names the tuple | new |
| 61 | STATE_WRITE_REJECTED | start, record | the orchestrator cannot be loaded, or `handleGetState` / `handleUpdateState` throws or returns `isError`; the detail is the server's first text line (it carries the gate code) | new |
| 62 | READBACK_MISMATCH | record | read-back `last_agent`, `status`, `next_role` or `pending_notes` differ from the closing write | new |
| 63 | PREFLIGHT_CI_RED | start | lenient `verify-release.mjs --ci-check` exits non-zero | new |
| 64 | RELEASE_BRANCH_EXISTS | start | `release/vX.Y.Z` exists locally or on `origin` | new |
| 70 | CHANGELOG_ENTRY_MISSING | start | no `## [Unreleased]` line, or nothing under it | new |
| 71 | LOCKFILE_DRIFT | start | `npm install --package-lock-only` changed more than the two lockfile version fields | new |
| 72 | BUILD_FAILED | start | `npx tsc` or `check-transitions-sync.mjs` non-zero | new |
| 73 | TEST_FAILED | start | `npm test` non-zero; the detail carries the `# fail <n>` line and the first `not ok` line | new |
| 74 | AUDIT_FAILED | start | `npm audit --json` printed no parseable report, or an `error` object | new |
| 75 | ADVISORY_UNDISPOSED | start | a HIGH/CRITICAL advisory id is absent from `docs/dependency-advisories.md` | new |

Runner-only (`phases ⊆ RUNNER_PHASES`) = codes 60–64 and 70–75. Those go in `docs/release-cd.md` and never in the SOP (C2). The SOP's *Escalation Routes* exit rows stay a bijection with the 31 rows that include `prepare`, `publish` or `close-out`.

## Data Structures

```js
// Exported, frozen. Phase encoding letters: s start, p prepare, u publish, r record, c close-out.
EXIT_CLASSES: ReadonlyArray<{ code: number; id: string;
  phases: ReadonlyArray<"start"|"prepare"|"publish"|"record"|"close-out"> }>        // 42 rows, table above
RUNNER_PHASES: readonly ["start", "record"]
ALLOWED: ReadonlyArray<{ cmd: "git"|"gh"|"node"|"npm"|"npx"; verb: string; mutates: boolean; rule: string; match }>

type Action = { step: string; kind: "read"|"mutate"|"fs"|"deferred"|"state";       // "state" is new
  cmd?: string; args?: string[]; op?: "write"|"move"|"mkdir"|"get"|"update"; path?: string; dest?: string; executed: boolean };

type StateWrite = { workspace_path: string /* repository root */; agent_id: "release-engineer"; status: "In_Progress";
  active_feature: string; completed_tasks: [];                                     // zod default made explicit
  next_role?: "pm"; pending_notes: string[] };
// opening (s2): pending_notes ["release-engineer: starting release for <active_feature>"], no next_role
// closing (r14): next_role "pm", pending_notes ["Released vX.Y.Z", "tag: <merge-sha>"]

type Orchestrator = { handleGetState(a: { workspace_path: string }): Promise<ToolResult>;
                      handleUpdateState(a: StateWrite): Promise<ToolResult> };          // ToolResult = { content: [{ type: "text", text }], isError? }
type AuditFinding = { pkg: string; id: string; severity: "high"|"critical" };
type CiState = "passed" | "red" | "pending" | "unverified";
```

`ALLOWED` additions (narrowest shapes; everything else from these commands stays refused, including `npm ci`, `npm install <pkg>`, `npm publish`, `npm run …`, and any `npx` other than `tsc`):

| cmd | verb | args after verb | mutates | used by |
|---|---|---|---|---|
| `npm` | `install` | `--package-lock-only` | yes | s7 |
| `npm` | `test` | none | no (writes only `dist/`; always called `deferred`) | s9 |
| `npm` | `audit` | `--audit-level=high --json` | no | s3, s9 |
| `npx` | `tsc` | none | no (writes only `dist/`; always `deferred`) | s8 |
| `node` | `scripts/check-transitions-sync.mjs` | none | no | s8 |
| `node` | `scripts/verify-release.mjs` | `--ci-check` (lenient, added to the existing `either`) | no | s4 |

The runner keeps one `spawn(bin, argv` call site and array argv, with no `shell`. `npm` and `npx` are spawned by name. New git shapes: none. `start` uses only existing ones (`fetch origin`, the portable pull on `main`, `switch -c release/*`, `rev-parse`, `ls-remote`, `show`).

Child env: `exec` passes `opts.env`, built as follows. Start from the runner's `env` and lay the per-call `env` overlay on top (`read` / `deferred` option, used by E401 and s4). For `npm` and `npx` children, also delete `GH_TOKEN`, `GITHUB_TOKEN` and every `AGC_*` key. `npm test` then sees the same env as `ci.yml`'s `npm test`. A test that runs the real `verify-release.mjs` keeps its 480 s default budget, and a test that hits a failure path cannot overwrite the workflow's stop-line file.

## Interface Contracts

All new exports are pure, or take the runner or ctx explicitly. Importing the module still has no side effect.

| export / function | signature | task |
|---|---|---|
| `parseArgs` | adds `{ phase: "start", bump, tickets, workDir, dryRun }` and `{ phase: "record", version, dryRun }` | 02 |
| `EXIT_CLASSES`, `RUNNER_PHASES` | as *Data Structures* | 02 |
| `main` | `(argv, deps?: { spawn?, env?, root?, out?, err?, sleep?, importLanePaths?, importHandoffParse?, importOrchestrator?, now? }) => Promise<number>`; writes the stop-line file | 02 |
| `createRunner` → `Runner.read / deferred` | `(cmd, args, { step, env? })`; `env` = per-call overlay | 02 |
| `Runner.state` (internal) | `(op: "get"\|"update", label: string, fn: () => Promise<T>, { step }) => Promise<T \| null>`; dry-run records `{ kind: "state", op }` and prints `release: DRY-RUN [<step>] <label>`; a real run prints `release: [<step>] $ <label>` | 02 |
| `loadOrchestrator` (internal) | `(ctx) => Promise<Orchestrator>`; `deps.importOrchestrator ?? import(<root>/dist/tools/handoff-orchestrator.js)`; failure → `STATE_WRITE_REJECTED` `cannot load dist/tools/handoff-orchestrator.js (run npm run build) — <msg>` | 02 |
| `stateLabel` (internal) | `tw_update_state agent_id=<a> status=<s> active_feature=<f>[ next_role=<r>] pending_notes=<JSON>` / `tw_get_state` | 02 |
| `deriveVersion` | `(current: string, bump) => string`; throws `VERSION_INCOHERENT` on a non-`x.y.z` input | 03 |
| `bumpVersionFiles` | `({ packageText, indexText, readmeText, oldVersion, newVersion }) => { packageText, indexText, readmeText }` | 03 |
| `unreleasedEntry`, `moveUnreleased` | `(changelogText) => string \| null`; `(changelogText, version, date) => string` (throws as stated) | 03 |
| `checkLockfileParity` | `({ before, after, oldVersion, newVersion }) => string \| null` | 03 |
| `checkPreMarks`, `applyDoneMarks` | `({ backlogText, tickets }) => string[]`; `({ backlogText, tickets, version }) => string` | 04 |
| `auditFindings`, `classifyAdvisories` | `(stdout) => AuditFinding[]` (throws `AUDIT_FAILED`); `({ findings, recordText }) => { recorded, undisposed }` | 04 |
| `commitMessage` | `({ version, oldVersion, bump, activeFeature, tickets }) => string` | 04 |
| `classifyCiState` | `({ status, stdout, stderr }) => CiState`: exit 0 with `CI-CHECK PASSED` → passed; a `FAIL:` line containing ` concluded "` → red; a `FAIL:` line containing `no completed CI run for ` → pending; anything else → unverified | 05 |
| `readBackMismatch` | `({ wrote: StateWrite, read: object }) => string \| null` over `last_agent`, `status`, `next_role`, `pending_notes` (deep-equal) | 05 |

**Orchestrator seam.** Each process that writes calls `get` before `update`, which satisfies the in-memory pre-flight guard and the freshness snapshot (F3). `start` does this in s2, and `record` does it in r14. Results are read from `content[0].text`; `get` results are parsed as JSON. Under `--dry-run` nothing is loaded. A real `get` can lazily migrate an old handoff and write it, and AC-R14 requires `.current/` to stay unchanged.

**E401, publish 8b-2.** The argv stays `["scripts/verify-release.mjs", "--ci-check", "--strict", "--sha", headRefOid]`. Under `--dry-run` the call passes `{ env: { AGC_VERIFY_CI_WAIT_SECONDS: "0" } }`. The child therefore polls once and never sleeps, and its verdict goes to `classifyCiState`. `red` → `CI_GATE_FAILED`, with the real run's detail. Any other state prints one line and continues:

`release: DRY-RUN [8b-2] CI state of <headRefOid>: <passed | not completed yet | unverified — <failLines>> — not waited for under --dry-run`

The real-run branch stays as it is: `ci.status !== 0 || !ci.stdout.includes("CI-CHECK PASSED")` → `CI_GATE_FAILED`, with the default budget. `classifyCiState` is defined above `stepPublish`, so the first `"CI-CHECK PASSED"` literal inside `stepPublish` still comes before the tag push. That position is pinned by `test/e164-e167-content.test.mjs`.

### Source shapes pinned by tests outside the lane (keep them)

- `test/e336-portable-pull.test.mjs`: `["-c", "pull.rebase=false", "pull", "--ff-only"]` appears **exactly once**, so `start` s5 calls `pullMain`, which also makes its failure `MAIN_DIVERGED`. The allow-list text `"-c pull.rebase=false pull --ff-only, on main only"` is unchanged.
- `test/e297-main-protected-sop.test.mjs`: the push, `pr merge` rule text, `--json` field list and pull argv strings are unchanged.
- `test/e164-e167-content.test.mjs`: `stepPublish` keeps `pullMain(ctx` before `["tag", "-a", tag`, and `"CI-CHECK PASSED"` before `["push", "origin", tag]`. The `"CI_GATE_FAILED"` literal stays. The SOP steps stay 1..17; the pointer line is not numbered.
- `test/e166-template-defers-staging.test.mjs`, `test/e130-lane-default.test.mjs`: `STAGE_PATHS`, `planStage({ changed, exists })` and `["add", "--", ...plan]` are unchanged.
- RS AC-S3 (static): one `spawn(bin, argv` site, only `spawnSync` imported from `node:child_process`, no `exec*`.
- ST line 1023 (`EMPTY_BASELINE` = 20) holds. **ST "E53/E163 … one row per exit class" (line 1050) does not hold**: it equates the SOP exit rows with *all* of `EXIT_CLASSES` → Open Question 1.

## Sequence Diagram

```mermaid
sequenceDiagram
  actor H as Human
  participant W as release.yml (job release)
  participant S as scripts/release.mjs
  participant O as dist handoff-orchestrator
  participant G as git + origin
  participant GH as gh / GitHub
  H->>GH: docs/* PR merged to main: PASS state, CHANGELOG under [Unreleased], backlog pre-marks, advisory rows
  H->>W: workflow_dispatch(bump, tickets, dry_run)
  W->>W: Require main, work dir, checkout (RELEASE_TOKEN), Node 22, npm ci, npm run build
  W->>S: start --bump --tickets --work-dir [--dry-run]
  S->>S: s1 handoff tuple is (qa-engineer, PASS), copy to work-dir/state.md
  S->>O: s2 handleGetState, handleUpdateState (opening write)
  S->>S: s3 [Unreleased] entry, pre-marks, npm audit vs advisory record
  S->>GH: s4 verify-release --ci-check (lenient)
  S->>G: s5-s6 fetch, pull --ff-only, derive vX.Y.Z, branch absent, switch -c
  S->>S: s7-s11 bumps, CHANGELOG move, lockfile parity, tsc, checks, npm test, audit, done-mark, message + version
  S-->>W: start OK, version to $GITHUB_OUTPUT
  W->>S: prepare (existing phase)
  S->>G: archive, bookkeeping, commit, push -u
  S->>GH: pr create
  W->>S: publish (existing phase)
  S->>GH: ci-check strict, pr merge --auto --merge, wait MERGED
  S->>G: switch main, pull, tag -a, push tag
  S->>GH: release create, verify-release vX.Y.Z
  W->>S: record --version
  S->>O: r14 get, update (closing triple); r15 get, compare
  W->>S: close-out (existing phase)
  S->>G: bookkeeping branch with .current/_primary handoff + jsonl, push
  S->>GH: pr create, merge, wait; verify-release --close-out
  alt a step exits non-zero and dry_run is false
    S->>W: RELEASE_STOP line on stderr and in AGC_RELEASE_STOP_FILE
    W->>GH: gh issue create "Release failed: CLASS_ID" (github.token)
  end
```

## SOP edits (AC-E2, AC-D3; C2)

Exactly two changed lines and no new Escalation rows:

1. A new line directly after `## SOP`, with no blank line, so the diff has one added line (166 bytes with its newline):
   `` Automated path: `.github/workflows/release.yml` runs this procedure on GitHub Actions without an agent — see `docs/release-cd.md`; this SOP is its manual fallback. ``
2. Step 13 gets this appended at the end of the same line (90 bytes, leading space included):
   `` Under `--dry-run` the CI gate reports the release head's CI state and never waits for it. ``

Bytes: 14,434 + 166 + 90 = 14,690 ≤ 15,000. 310 bytes of headroom remain.

## Docs outline (`docs/release-cd.md`, AC-D1, AC-D2)

`# Release CD`, then in this order:
- `## Trigger` — the `docs.trigger` line; the Actions UI path (Actions → Release → Run workflow on `main`); one release at a time (`concurrency: release`); a typical run takes 20–40 min, and the job limit is 120 min.
- `## Inputs` — `bump` (`major` only by deliberate choice), `tickets` (`E1,E2` without spaces, or `none`), `dry_run` (default `true`: runs `start --dry-run` only — precondition, CHANGELOG entry, pre-marks, advisories, pre-flight CI, version and branch checks; nothing is written, pushed or filed). The commit-summary rule (Open Question 2's answer) and the commit and tag identity (`github-actions[bot]`).
- `## Secret` — `RELEASE_TOKEN`: fine-grained personal access token with Contents read and write, Pull requests read and write, Actions read, Metadata read, created by a human under the repository's Actions secrets and never written to any file. Why `GITHUB_TOKEN` cannot do the pushes (its pushes and PRs start no required checks). `GITHUB_TOKEN` only files the failure issue.
- `## Before you trigger` — the AC-D1 checklist. One `docs/*` PR puts on `main` both the release gate's `(qa-engineer, PASS)` write and the entry under `## [Unreleased]`. Every HIGH/CRITICAL advisory has its row, and no re-review trigger has fired (a human check: the runner matches ids only). Each named backlog row carries `not yet released`. No `release/vX.Y.Z` branch is left over. A dry run passed.
- `## When a run fails` — the issue title `Release failed: <CLASS_ID>` and the four body lines; `NO_STOP_LINE` means read the log. Cancelled and timed-out runs file no issue. Re-dispatch rule: if `release/vX.Y.Z` is not on `origin` (every `start` stop, and `prepare` stops before 8a-5), fix `main` and dispatch again, because the runner's state and branch are gone. Otherwise resume by hand with the SOP from the phase in `Phase:`, redoing SOP steps 1–2 first, because the runner's opening write was not kept. The runner-only class table is `| code | class | phase | meaning | what to do |`, with one row per runner-only `EXIT_CLASSES` row in code order (60–64, 70–75). For every other class, point to the SOP's *Escalation Routes*.
- `## Manual fallback` — `content/skill-release-engineer.md`, used when the secret is missing, the runner is broken, or a run must be resumed by hand.

## Test seams (T-E405-08..11)

- **WF** (`js-yaml` load; js-yaml 4's default schema keeps `on` as a string key). It checks:
  - `name` is `Release`; the only `on` key is `workflow_dispatch`, and its inputs are exactly as AC-W1 (option order, defaults, types).
  - `permissions` deep-equals `{ contents: read, issues: write }`; `concurrency` deep-equals `{ group: release, cancel-in-progress: false }`.
  - One job, `release`: `runs-on: ubuntu-latest`, plus the timeout inequality above.
  - Steps run in the order of *Workflow*. The guard step comes before checkout. Checkout has `fetch-depth: 0` and the token. `setup-node` uses 22. `npm ci` comes before `npm run build`, which comes before the first `release.mjs` step.
  - Every `release.mjs` step has `env.GH_TOKEN === "${{ secrets.RELEASE_TOKEN }}"`. The set of `secrets.*` names in the raw text is `{RELEASE_TOKEN}`. `github.token` and `secrets.GITHUB_TOKEN` appear only in the step named `File failure issue`.
  - Unit order: `start` < `prepare` < `publish` < `record` < `close-out`. Every `release.mjs` step except `start-dry-run` has `if: ${{ !inputs.dry_run }}`, and `start-dry-run` carries the literal `--dry-run`. No step outside the script runs `git push`, `git tag`, `gh pr`, `gh release` or `tw_`.
  - No `run` contains `${{`.
  - The issue step: `if` contains `failure()`; it has `gh issue create`, the `Release failed: ` title and no `--label`; `RUN_URL` is built from the three contexts.
  - The job env carries the wait budgets and the four `GIT_*` identity keys.
- **RN** (in-process `rel.main`, real git fixture). The fixture copies RS's layout: a bare `origin`, a `gh` PATH shim, and `STUB` for `check-version`, `check-bookkeeping`, `check-transitions-sync`, `verify-release` and `bin/agc-init.mjs`. It also has a `package.json` with `name`, an `index.ts` Server literal, README pins, a CHANGELOG with `## [Unreleased]`, pre-marked backlog rows, `docs/dependency-advisories.md`, `package-lock.json`, and `.current/_primary/handoff.md` at PASS. Injected deps:
  - `spawn`: a wrapper that answers `npm` / `npx` from a canned table keyed by argv. The `npm install` answer writes the bumped lockfile into `opts.cwd`; a variant writes a drifted one. Other calls go to `spawnSync`. Each call's `opts.env` is recorded for the scrub and wait-0 assertions.
  - `importOrchestrator`: a recorder fake whose results can be set to accept, `isError`, throw, or return a mismatched read-back.
  - `importLanePaths`: `_primary`. `importHandoffParse`: the repository's compiled parser. `now`: a fixed date.
  - `env`: `AGC_RELEASE_STOP_FILE` under the test's temp dir.

  Tests: one per AC-R1..R9, R11, R13, R14 and E1, plus "one exit code per runner class" over the 11 new rows. AC-R14 runs `start --dry-run` and `record --dry-run` and takes the RS `snapshot` before and after, plus `.current/` and the fake's call log. Integrator note (c): the fixture uses real git subprocesses, which will likely add 1–2 min. That is accepted, and qa records the single-file time in the evidence.
- **DC**: the AC-D1 section order and contents; class-table rows = `EXIT_CLASSES.filter(c => c.phases.every(p => RUNNER_PHASES.includes(p)))` in code order; the `contrib.pointer` line appears exactly once in `CONTRIBUTING.md`.
- **RS re-pins** (each edited title names its AC):
  - "AC-S2 exit table equals …" (AC-R10): read this file's table, which has 42 rows and must equal `EXIT_CLASSES`. For every E394 row, this table must have the same `code`/`id` and a superset of its phases.
  - "AC-S2 one exit code per failure class" (AC-R10): the trigger keys filter to classes with a manual phase; the runner classes are covered by RN.
  - "AC-S3 isAllowed …" (AC-R11): `["npm", ["test"]]` moves to the admitted list with the other five shapes. `npm ci`, `npm install x`, `npm publish`, `npm run build` and `npx eslint` go to the refused list.
  - No RS test is expected to go red from E401: the dry-run stub prints `CI-CHECK PASSED`, and L:E163 still sees the strict argv.
- **SP re-pins**: AC-P4's bijection filters to `phases` including `prepare`/`publish`/`close-out` (AC-D3). New: "AC-E2 …" and "AC-D3 one CD pointer under SOP". "AC-H5 size …" holds as is.

## Task Mapping (sr-engineer)

Each task touches ≤ 5 files and adds ≤ 300 lines. Tasks 02–05 touch only `scripts/release.mjs`. Under 02 a phase body that is not built yet throws `INTERNAL` `not implemented` (the E394 pattern). Every task leaves RS and SP green except the expected-red tests the spec lists.

| task | implements | exports / steps | est. lines |
|---|---|---|---|
| T-E405-02 | CLI for `start`/`record`; all 42 `EXIT_CLASSES` rows and `RUNNER_PHASES`; stop-line file in `main`; runner per-call `env`, `npm`/`npx` env scrub, `state` actions; orchestrator seam; `start` pre-1..pre-3, s1, s2; `PHASES` entries for both new phases | `parseArgs`, `EXIT_CLASSES`, `RUNNER_PHASES`, `main` deps `importOrchestrator`/`now`, `loadOrchestrator`, `Runner.state` | ~220 |
| T-E405-03 | s3(a), s4 (+ lenient `--ci-check` shape), s5, s6, s7 (+ `npm install --package-lock-only` shape) | `deriveVersion`, `bumpVersionFiles`, `unreleasedEntry`, `moveUnreleased`, `checkLockfileParity` | ~240 |
| T-E405-04 | s3(b), s3(c), s8, s9, s10, s11 (+ the `npm test`, `npm audit`, `npx tsc`, `check-transitions-sync` shapes); `start` OK suffix | `checkPreMarks`, `applyDoneMarks`, `auditFindings`, `classifyAdvisories`, `commitMessage` | ~250 |
| T-E405-05 | the `record` phase (pre-1, pre-3, r14-1, r14, r15); E401 8b-2 under `--dry-run`; a whole-path dry-run audit (every `start`/`record` effect goes through the recorder) | `classifyCiState`, `readBackMismatch` | ~170 |
| T-E405-06 | `.github/workflows/release.yml` per *Workflow* | — | ~150 |
| T-E405-07 | `docs/release-cd.md` per *Docs outline*; the two SOP lines; the `CONTRIBUTING.md` line | — | ~170 |

## Decision Records

| Context | Decision | Consequences |
|---|---|---|
| Where SOP steps 1–11 and 14–15 run (ruling 1) | Two new phases, `start` and `record`, rather than pre-steps of `prepare` or one `run` phase | The three E394 command lines are unchanged byte for byte (AC-R12). `prepare` consumes the copy and message file through its existing flags, and the workflow shows the SOP's shape step by step. Costs two new phase names in `EXIT_CLASSES.phases` and two work-dir hand-offs |
| State across units (C6) | One job; every unit is a step in one checkout | No artifact plumbing. The opening write, the closing write and close-out's commit share `.current/_primary/`. The job timeout bounds the whole release. A re-run reruns everything (guarded below) |
| `start` → `prepare` inputs | A `--work-dir` outside the root holds `state.md`, `message.txt` and `version`. The version reaches later steps through `$GITHUB_OUTPUT` | The script stays Actions-agnostic. The files are written even under `--dry-run`, and none can be staged |
| Stop line → issue (AC-R13) | `AGC_RELEASE_STOP_FILE`, written by `main` with the same string it prints | Byte equality by construction, in every phase. The workflow needs no stderr capture or `tee`. A crash before `main` yields `NO_STOP_LINE` |
| E401 mechanism | Per-call `AGC_VERIFY_CI_WAIT_SECONDS=0` on the strict gate under `--dry-run`, classified by `classifyCiState`; not a `deferred` record | The child still runs once, so a completed red still stops `CI_GATE_FAILED`. L:E163 and AC-S7 stay green unedited, and the three absorbed scripts are untouched. The dry run depends on two `verify-release.mjs` FAIL phrasings, which that script's own tests already pin |
| Fail-fast human artifacts | s3 checks the `[Unreleased]` entry, pre-marks and advisories before any branch, bump or build; s9 repeats the audit after the test (AC-R6) | A missing decision stops in seconds, not after the test suite. Two audit calls per run |
| Exit codes | New decades 60s (runner state and gates) and 70s (runner bump, build, checks); 9 E394 rows only gain phases | Nothing is renumbered, and the SOP keeps its 31 rows. Adds `LOCKFILE_DRIFT` and `AUDIT_FAILED` beyond the spec's list, because neither cause is a version incoherence or a missing disposition, and each has its own remedy (fix dependencies on `main` / re-dispatch) |
| `ALLOWED` growth (AC-R11) | Six exact shapes; `npx tsc` and `npm test` are `mutates: false` and always called `deferred` | A dry run never builds or tests, so its bumps stay unapplied. `dist/` is a build product, the same as `check-version.mjs` reading it. Any other `npm`/`npx` form stays refused |
| Orchestrator calls | Direct import of the compiled server, `get` before `update` in each process; nothing loaded under `--dry-run` | Server stamps and gates apply as in an MCP call, with no agent. A dry run cannot trigger a lazy-migration write |
| Token surface | Checkout credential + `GH_TOKEN` on the release steps; the `npm`/`npx` children lose `GH_TOKEN`, `GITHUB_TOKEN` and `AGC_*` | One secret serves git and gh, and the test suite runs with CI's env and no token. The checkout's stored credential is still readable by install scripts and tests inside the job (the same exposure as a local release); `persist-credentials: false` + `gh auth setup-git` was rejected because it depends on gh's env-token credential helper, which this lane cannot verify |
| Git identity | `GIT_AUTHOR_*` / `GIT_COMMITTER_*` = `github-actions[bot]` in the job env | No config write and no identity code in the script. The release commit and the tag show the bot as author and tagger, even though the PAT's owner pushes |
| Advisory match | GHSA-token presence in `docs/dependency-advisories.md` | Mechanical and exact (ruling 5). A recorded `upgrade` row whose advisory still fires, or whose re-review trigger fired, is caught only by the human checklist item |
| Merge sha for the closing write | `refs/tags/vX.Y.Z^{commit}`, not `publish` stdout | `record` needs no hand-off. A `record` before `publish` stops `USAGE` |
| Re-dispatch after a failed run | No automatic resume (ruling 4 fixes the inputs, so there is no resume input) | A real stop before 8a-5 leaves nothing on GitHub, and re-dispatching is safe. After a success, `main`'s handoff is no longer PASS (`PRECONDITION_NOT_PASS`) and `[Unreleased]` is empty (`CHANGELOG_ENTRY_MISSING`), so a double release is refused. A partial run resumes through the SOP |
| Wait budgets | 900 s per CI or merge wait, 120-minute job | Covers a 3–4 min CI with queueing headroom. A stall shows as `MERGE_WAIT_TIMEOUT` or `CI_GATE_FAILED` before the job limit, not as a silent cancellation |
| Dry-run failures | No issue (`if: failure() && !inputs.dry_run`) | The person who just dispatched the dry run reads its log. Issues mean only real-run stops |

## Deferred Resources

_None — the spec's Dependencies / Prerequisites shows zero ignored/deferred refs (Resource Audit: no external reference in rows E405, E401 or the manifest; `external_refs` omitted)._

## Open Questions

1. **ST pins the SOP exit rows to every `EXIT_CLASSES` row.** `test/release-staging.test.mjs`, test "E53/E163: the Escalation Routes table is one row per exit class …" (around line 1050), compares the SOP's `exit N CLASS` rows with `REL.EXIT_CLASSES.map(code id)`. It turns red as soon as T-E405-02 adds the runner-only rows. AC-R10 (`EXIT_CLASSES` grows), C2 (no SOP rows) and AC-D3 ("every other test that reads the SOP passes unedited") cannot all hold, and the file is outside the lane's ownership. **Proposed:** add `test/release-staging.test.mjs` to the lane's owned cell for that one assertion. qa re-pins it in T-E405-11 to the same filter as SP AC-P4 (rows whose phases include `prepare`, `publish` or `close-out`), the edited title names AC-R10, and AC-D3's "unedited" clause excludes that one test. **If refused:** keep the 11 runner rows out of `EXIT_CLASSES` in a second frozen export, `RUNNER_EXIT_CLASSES`. `ReleaseStop` resolves ids from both. AC-R10 and AC-D2 are reworded to the union. ST and SP AC-P4 then pass unedited, so SP's AC-P4 re-pin is dropped, but `EXIT_CLASSES` stops being the single exit table (≈ +10 lines in T-E405-02).
2. **Commit summary rule (C5).** **Proposed:** `<summary>` = `<active_feature>` when `tickets` is `none`, else `<active_feature> (<E1>, <E2>)` (ids as passed, joined by `, `), for example `chore(release): v4.19.0 — release-e405 (E405, E401)`. It is always derivable and needs no new format in any pre-committed artifact. The same text becomes the tag message and the GitHub release title. **If refused:** the human writes `Summary: <text>` as the first line under `## [Unreleased]` in the docs PR. s3 requires it (`CHANGELOG_ENTRY_MISSING` when absent), and s7 removes it while moving the entry (≈ +15 lines in T-E405-03/04, plus one checklist line).
3. **What a workflow dry run covers.** `prepare --dry-run` needs the bumped release branch, and `publish --dry-run` needs `prepare`'s real PR, so nothing after `start` can dry-run in a run where `start` changed nothing (AC-R14). **Proposed:** `dry_run: true` runs only `start --dry-run`. That covers the precondition, the CHANGELOG entry, pre-marks, advisories, pre-flight CI, version derivation and the branch check. The other steps are skipped (`if: ${{ !inputs.dry_run }}`), which satisfies AC-W6 (every call that runs carries `--dry-run`). `prepare`'s checks are covered anyway: a real run's `prepare` stops before its push (8a-5), and leaves nothing on GitHub. **If refused:** a "rehearsal" amends AC-W6. `dry_run: true` runs `start` without `--dry-run` (branch, bumps, build, test and the opening write stay on the throwaway runner), then `prepare --dry-run`. Nothing is pushed, and the run takes about 8 min instead of 2. It is one extra workflow step and no script change. `publish`, `record` and `close-out` still cannot be dry-run before a real `prepare`.
