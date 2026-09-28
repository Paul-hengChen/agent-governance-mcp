# Review — T-REL4-03

covers: T-REL4-03

## Summary
- Single-purpose CI fix: adds `with: fetch-depth: 0` under the existing `actions/checkout@v4` step in `.github/workflows/ci.yml` (2 lines added, 0 removed in that file).
- Fixes the shallow-clone `fatal: bad revision` failures hit by the 6 SHA-pinned scope tests in `test/e130-lane-default.test.mjs` (2 invocations, range `121ddc8..5896bdd`) and `test/e178a-integrator-role.test.mjs` (4 invocations against `BASE_SHA = "3c72a83"`).
- Commit also carries `.current/_primary/dispatch.jsonl` and `.current/_primary/handoff.md` bookkeeping — expected per the dispatch note, not in scope for this review.
- No `test/` file touched; no other `ci.yml` line moved.
- Verdict: APPROVED.

## AC Completeness
AC5 — implemented — `.github/workflows/ci.yml:16-18` (checkout step gains `with: fetch-depth: 0`); (ii) GitHub Actions success confirmation is explicitly T-REL4-05's proof obligation, not this task's — correctly out of scope here.

## Correctness
- Diff is exactly the claimed change: `git show 0252e02 -- .github/workflows/ci.yml` shows a 2-line addition (`with:` / `fetch-depth: 0`) immediately under `- uses: actions/checkout@v4`, no other hunk in the file.
- YAML validity confirmed by parsing the file with `js-yaml`: `jobs.test.steps[0]` resolves to `{ uses: "actions/checkout@v4", with: { fetch-depth: 0 } }` — correctly nested under the intended step, not a sibling/dangling key.
- Sufficiency check against each SHA-pinned test's actual git invocation:
  - `test/e130-lane-default.test.mjs:156,280` — `git diff --stat 121ddc8..5896bdd [-- bin/ tools/ scripts/]`. Both `121ddc8` and `5896bdd` verified present as commit objects and ancestors of current `HEAD` (`git merge-base --is-ancestor` exit 0 for both).
  - `test/e178a-integrator-role.test.mjs:152,162,213,344` — `git diff BASE_SHA -- <path>` with `BASE_SHA = "3c72a83"`. Verified present and an ancestor of `HEAD`.
  - `actions/checkout@v4` with `fetch-depth: 0` fetches full history for all branches and tags (full unshallow), so any commit ancestor of a fetched branch tip — which includes every SHA above, all ancestors of `main`'s current tip — is guaranteed present in the runner's object database after checkout on a push to `main`. This is sufficient for all 6 tests; no additional `fetch-tags`/`ref` config is needed since none of the pinned SHAs are on an unreachable/orphan branch.
- No off-by-one or scoping issue: the `with:` block is a property of the `checkout@v4` step only, doesn't leak to `setup-node` or later steps (confirmed by full-file read).

## Quality
No findings. Change follows the same `with:` indentation convention already used later in the same file for `actions/setup-node@v4` (2-space nesting, `cache: npm` sibling pattern) — stylistically consistent with the surrounding YAML.

## Architecture
No `specs/release-v4.0.0-architecture.md` exists; this is a one-line infra fix against the AC5 spec text (route A, explicitly the sanctioned option — "no other line in the workflow, and no test file, changes"). Fully conforms.

## Security
No findings. `fetch-depth: 0` only changes clone depth (fetches more history), it does not alter checkout ref, credentials, or trust boundary; no secrets or new inputs introduced. Does not enable running untrusted PR code with extended permissions (this workflow triggers only on `push`/`pull_request` to `main`, unchanged).

## Performance
No findings. A full-history clone is slower/heavier than a shallow one, but this is an accepted, spec-sanctioned tradeoff (route A) for a two-job CI matrix, not a hot-path or production code path; no algorithmic regression in application code (none touched).

## Verdict
APPROVED — the diff is exactly the one-line-intent `fetch-depth: 0` addition under the correct step, valid YAML, and sufficient (verified against all 6 failing tests' actual git invocations and SHA ancestry) to fix the CI-red condition described in AC5.
