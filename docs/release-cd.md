# Release CD

A release runs on GitHub Actions: the `Release` workflow (`.github/workflows/release.yml`) runs `scripts/release.mjs` end to end, so cutting a release uses no agent session and no agent tokens. A human makes the decisions beforehand (they are committed to `main`, see *Before you trigger*) and then dispatches the workflow. When the workflow cannot be used, the release-engineer SOP is the manual fallback (*Manual fallback*).

The run does what the SOP does, in five phases of the script, each a step of one job in one checkout:

| phase | SOP steps | what it does |
|---|---|---|
| `start` | 1–11 | checks the release gate, makes the opening state write, checks the human artifacts, runs pre-flight CI, derives the version, creates `release/vX.Y.Z`, bumps, builds, tests, re-audits, done-marks the backlog rows, writes the commit message |
| `prepare` | 12 | archives the evidence, runs the bookkeeping checks, commits, pushes and opens the release pull request |
| `publish` | 13 | strict CI gate on the release head, merge, tag, GitHub release, self-check |
| `record` | 14–15 | the closing state write and its read-back |
| `close-out` | 16 | commits the state files on `release/vX.Y.Z-bookkeeping`, merges that pull request, runs the close-out check |

## Trigger

From a terminal, on `main`:

```bash
gh workflow run release.yml -f bump=<kind> -f tickets=<ids|none> -f dry_run=<true|false>
```

Or in the browser: Actions → Release → Run workflow, with the branch set to `main`. The first step, *Require main*, fails the run on any other ref.

- One release at a time: the job is in the concurrency group `release`. A second dispatch queues behind the running one; nothing cancels it.
- A typical real run takes 20–40 minutes. The job stops after 120 minutes. Each wait inside the run (pre-flight CI, the strict CI gate, the release pull request merge, the self-check, the bookkeeping pull request merge) gives up after 900 seconds, so a stall shows as a class, not as a silent cancellation.
- A dry run takes a few minutes and should come first, every time.
- Follow a run with `gh run watch` or on its Actions page. A successful phase prints one last line `release: <phase> OK (vX.Y.Z) — …`; the last real-run line is `release: close-out OK (vX.Y.Z) — CLOSE-OUT PASSED`.

## Inputs

| input | type | default | meaning |
|---|---|---|---|
| `bump` | choice: `patch`, `minor`, `major` | `patch` | the version bump kind. `major` (any `X.0.0`) only by deliberate choice: a pushed tag cannot be retracted |
| `tickets` | string, required | — | the backlog ids to done-mark, comma-separated without spaces (`E1,E2`), or `none` |
| `dry_run` | boolean | `true` | `true` runs only `start --dry-run`; a run that ships means unticking it (`-f dry_run=false`) |

**What a dry run covers.** `dry_run: true` runs `start --dry-run` and skips every later release step. It checks the release gate (the precondition), the CHANGELOG entry, the backlog pre-marks, the advisory dispositions, pre-flight CI, the version derivation and bump computation, and that no `release/vX.Y.Z` branch exists. Nothing in the repository is written, nothing is pushed, no state write is made and no issue is filed. The bumped tree is never built or tested (the workflow's own `npm ci` and build of `main` still run). `prepare`, `publish`, `record` and `close-out` cannot dry-run on a runner, because each needs the previous phase's real result (a bumped branch, then a real pull request). The first real `prepare`, `publish`, `record` and `close-out` on a runner is therefore the release that ships this workflow (v4.19.0). In the manual SOP, `publish --dry-run`'s CI gate reports the release head's CI state and never waits for it; only a completed red run stops it (E401, a dry run never waits on CI).

**Commit summary.** The release commit's first line is `chore(release): vX.Y.Z — <summary>`. `<summary>` is the release gate's `active_feature` when `tickets` is `none`, else `<active_feature> (<E1>, <E2>)`: the ids as passed, joined by a comma and a space. The same text is the tag message and the GitHub release title.

**Identity.** The release commit, the bookkeeping commit and the tag are authored as `github-actions[bot]` (author, committer and tagger). The pushes, pull requests and merges are made with the `RELEASE_TOKEN` secret, so GitHub shows the token's owner as the actor.

## Secret

`RELEASE_TOKEN` must exist before the first real run. It is a fine-grained personal access token for this repository with:

- Contents: read and write
- Pull requests: read and write
- Actions: read
- Metadata: read

A human creates it and stores it under the repository's Settings → Secrets and variables → Actions as `RELEASE_TOKEN`. It is never written to any file, commit, issue or log. It is also the checkout credential, so every `git fetch` / `git push` and every `gh` call of the release steps uses it.

Why not the job's own `GITHUB_TOKEN`: a push or pull request made with it starts no workflow runs, so the required checks `test (20)` / `test (22)` would never run and the release pull request could never merge. The job token is used for one thing only: filing the failure issue.

A missing or expired secret fails the run at checkout. The failure issue then has the class `NO_STOP_LINE` and `Phase: setup`.

## Before you trigger

The run makes no human decision; every decision is committed to `main` first. Check each item:

- [ ] One `docs/*` pull request, merged to `main`, carries both the release gate feature's `(qa-engineer, PASS)` state write (`.current/_primary/handoff.md`) and the release's CHANGELOG entry under `## [Unreleased]`.
- [ ] Each HIGH or CRITICAL `npm audit --audit-level=high` advisory has its row in `docs/dependency-advisories.md`, and no row's re-review trigger has fired. The runner only matches advisory ids; whether a trigger fired is a human check.
- [ ] Each backlog row named in `tickets` starts `**DONE` and carries the `not yet released` pre-mark.
- [ ] No `release/vX.Y.Z` branch is left over, locally or on `origin`, for the version this bump derives.
- [ ] A dry run with the same `bump` and `tickets` passed (`release: start DRY-RUN OK (vX.Y.Z) — nothing changed`). It covers `start` only (see *Inputs*).

After a successful release, `main`'s handoff is no longer `(qa-engineer, PASS)` and `## [Unreleased]` is empty, so dispatching again by mistake stops at once (`PRECONDITION_NOT_PASS` or `CHANGELOG_ENTRY_MISSING`) instead of releasing twice.

## When a run fails

A real run that fails files one GitHub issue titled `Release failed: <CLASS_ID>`. Its body has four lines:

```text
RELEASE_STOP <CLASS_ID>: <detail>
Run: <link to the workflow run>
Inputs: bump=<kind> tickets=<ids|none> dry_run=false
Phase: <start|prepare|publish|record|close-out|setup>
```

- Line 1 is the script's stop line, byte for byte. The class id names what stopped; the detail says why. `Phase` names the step that failed; `setup` means a step before the script ran (the ref guard, checkout, Node setup, `npm ci` or the build).
- `NO_STOP_LINE` (title and line 1 `No RELEASE_STOP line was printed; read the run log.`): the script never reached its stop line, for example a setup failure or a crash before the script started. Read the run log from the `Run:` link.
- A dry run never files an issue; read its log. A run cancelled by hand or by the 120-minute limit is cancelled, not failed, and files no issue either.

**Dispatch again, or resume by hand.** The runner's working tree, its state writes and its local branch are gone when the job ends. Look on `origin` for `release/vX.Y.Z`:

- Not there (every `start` stop, and a `prepare` stop before its push): nothing reached GitHub. Fix the cause on `main` through a pull request and dispatch again.
- There (a `prepare` stop after its push, or any stop in `publish`, `record` or `close-out`): do not dispatch again. Resume by hand with the SOP (*Manual fallback*) from the phase in `Phase:` — `prepare` is SOP step 12, `publish` step 13, `record` steps 14–15, `close-out` step 16 (after 14–15, since the runner's closing write was not kept). Redo SOP steps 1–2 first, because the runner's opening write was not kept either. One exception: if `release/vX.Y.Z-bookkeeping` is already on `origin`, the closing write reached it; follow the class's SOP row instead of redoing steps 14–15.

**Runner-only classes.** These classes exist only in the runner phases (`start`, `record`) and have no row in the SOP:

| code | class | phase | meaning | what to do |
|---|---|---|---|---|
| 60 | PRECONDITION_NOT_PASS | start | `.current/_primary/handoff.md` on `main` is not `(qa-engineer, PASS)`, has no usable `active_feature`, or cannot be parsed; the detail names the tuple | merge the release gate's PASS write to `main` (see *Before you trigger*), then dispatch again |
| 61 | STATE_WRITE_REJECTED | start, record | the state server could not be loaded from `dist/`, or a state read or write threw or was rejected; the detail is the server's first line and carries the gate code | `start`: fix what the gate code names on `main`, dispatch again. `record`: the tag exists; resume by hand from SOP step 14 |
| 62 | READBACK_MISMATCH | record | the read-back after the closing write differs from it in `last_agent`, `status`, `next_role` or `pending_notes` | do not run close-out; resume by hand from SOP step 14 |
| 63 | PREFLIGHT_CI_RED | start | the lenient pre-flight CI check found a completed red run for `main`'s head | make `main` green through a pull request, then dispatch again |
| 64 | RELEASE_BRANCH_EXISTS | start | `release/vX.Y.Z` already exists locally or on `origin` | never reuse or delete it; find the earlier run or session that made it and finish that release by hand with the SOP |
| 70 | CHANGELOG_ENTRY_MISSING | start | `CHANGELOG.md` has no `## [Unreleased]` heading, or nothing under it | commit the release's entry under `## [Unreleased]` in a `docs/*` pull request, then dispatch again |
| 71 | LOCKFILE_DRIFT | start | `npm install --package-lock-only` changed more of `package-lock.json` than its two version fields | bring the lockfile in line with `package.json` on `main` through a pull request, then dispatch again |
| 72 | BUILD_FAILED | start | `npx tsc` or the transitions-sync check exited non-zero after the bumps | fix the build on `main`, then dispatch again |
| 73 | TEST_FAILED | start | `npm test` exited non-zero; the detail carries the fail count and the first failing test | route the failure to qa-engineer, fix it on `main` (never edit a test to fit a version), then dispatch again |
| 74 | AUDIT_FAILED | start | `npm audit --audit-level=high --json` printed no parseable report, or an error object | usually a registry outage: dispatch again later; if it persists, run the audit locally |
| 75 | ADVISORY_UNDISPOSED | start | a HIGH or CRITICAL advisory id is not in `docs/dependency-advisories.md`; the detail names the package and the id | record a disposition through pm in a `docs/*` pull request, then dispatch again |

Every other class (`INTERNAL`, `USAGE` and the classes of `prepare`, `publish` and `close-out`) has its row, with the status and the next role, in the *Escalation Routes* table of `content/skill-release-engineer.md`. A class raised in `start` that also has an SOP row (for example `VERSION_INCOHERENT`, `DONE_MARK`, `MAIN_DIVERGED`) stopped before anything reached GitHub: fix the cause on `main` and dispatch again.

## Manual fallback

The manual path is the release-engineer SOP, `content/skill-release-engineer.md`, run by a release-engineer session. It runs the same script phases (`prepare`, `publish`, `close-out`) and does SOP steps 1–11 and 14–15 itself. Use it when:

- the `RELEASE_TOKEN` secret is missing or expired and cannot be replaced in time;
- the runner or the workflow is broken;
- a run stopped after `release/vX.Y.Z` reached `origin` and must be resumed by hand (*When a run fails*).

The two paths share one rule set: the same exit classes, the same stop line (`RELEASE_STOP <CLASS_ID>: <detail>`), and the same human decisions committed before anything runs.
