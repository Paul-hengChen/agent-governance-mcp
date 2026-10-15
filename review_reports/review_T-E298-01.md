# Review — T-E298-01

covers: T-E298-01

## Round 1 — APPROVED — by code-reviewer

## Summary
- Commit 8200227: one-line change to `.github/workflows/ci.yml` — `on.push.branches` gains `'feat/**'`, `'integ/**'`, `'release/**'` next to `main`.
- Scope: backlog row E298 item (1) only (folds E170 option (i)); `pull_request`, `jobs`, and `matrix` untouched.
- Spec input: the `| E298 |` row in `docs/backlog.md` plus the lane e298 row of the post-v4-w1 fan-out manifest (lives on the integration branch). AC1/AC2 come from the integrator-approved cut.
- Reviewer model (opus) differs from the sr-engineer pin (fable), so same-model bias is not a concern.
- Verdict: APPROVED.

## AC Completeness
AC Completeness: SKIP — no specs/e298-ci-triggers-finish-remote-delete.md (backlog-row-as-spec mini-chain)

Checked against the dispatch-supplied cut anyway:
- AC1 — implemented — `.github/workflows/ci.yml:5` `branches: [main, 'feat/**', 'integ/**', 'release/**']`
- AC2 — implemented — `.github/workflows/ci.yml:7` `pull_request.branches` still `[main]`; `git diff 6b8a195..HEAD -- .github/workflows/ci.yml` is that single line, so jobs/matrix are unchanged.

## Correctness
No findings. `**` globs are the right GitHub Actions filter for slash-containing branch names (`feat/e298-...`, `integ/post-v4-w1`, `release/vX.Y.Z`); a single `*` would not match past a `/`. The globs are quoted, which YAML needs because `*` would otherwise start an alias. The file still parses as YAML: CI reads the rest of the file unchanged.

## Quality
No findings. The flow-sequence style matches the line it replaces.

## Architecture
No architecture spec for this feature. No test reads `ci.yml` (per the manifest). The change is the trigger list only.

## Security
No findings. Push triggers on repo-owned branch patterns only; `pull_request` (not `pull_request_target`) is unchanged, so fork code still runs without secrets. No new permissions or secrets.

## Performance
- optional — A push to a `feat/**` branch that also has an open PR into `main` now runs CI twice (push + pull_request), 2 matrix jobs each. The backlog row already prices this in ("(N+1) x 2 Actions jobs per wave"). A `concurrency:` group would trim it, but that would touch the workflow beyond the triggers, which AC2 rules out. No action requested.

## Verdict
APPROVED — the trigger list matches AC1 exactly and AC2 holds, with no findings above `optional`.
