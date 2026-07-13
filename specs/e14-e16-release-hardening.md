# e14-e16-release-hardening

Batched 3-item release per small-batch precedent (C16+C10/C5+C18): two P3 backlog rows + one waiting E15.

## E14: CI-ground-truth read at release

Add Check 6 to `scripts/verify-release.mjs`: query latest completed CI run on origin/main via `gh` and FAIL on non-success conclusion. Degrade gracefully (gh missing/unauthenticated or zero completed runs is WARN-and-continue, never a release blocker). Integrates into release-engineer SOP step 9a.

**AC:**
- Check 6 reads CI ground truth via `gh api repos/.../commits/<sha>/check-runs`
- FAIL on conclusion !== "success"
- WARN-and-continue on gh CLI missing, unauthenticated, or zero completed runs
- SOP step 9a calls the script and exercises Check 6 live during release self-check

## E15: Spawned-server test de-flake

De-flake spawned-server integration tests via response-driven waits instead of fixed delays. Shipped in commit 3267a69.

**AC:**
- Wait patterns detect server readiness from response content, not time-based heuristics
- No more fixed sleep(ms) in spawned-server handoff paths
- Test suite green with de-flaked waits

## E16: Single-role judge-dispatch charter broadening

Broaden Constitution §3.1 judge-dispatch gate: split resume_of enforcement into two edges — code-reviewer:In_Progress direct entry (unchanged: requires `resume_of`) and qa-engineer:In_Progress Amend-Resume entry (NEW: also requires `resume_of`). Content-only Constitution amendments (no handoff schema changes).

**AC:**
- tools/handoff-orchestrator.ts gate predicate accepts qa-engineer:In_Progress Amend-Resume when resume_of names "qa-engineer"
- content/const-08-chain-31-mid.md: two new §3.1 bullets governing qa-engineer Amend-Resume semantics
- content/coord-03-core-fallback.md: coordinator pointer explaining qa-engineer Amend-Resume + resume_of
- test/e16-judge-dispatch-charter.test.mjs: new test suite; golden fixtures regenerated for E16 coverage
- Full suite green: 1420/1420 tests pass

## Quality Gates

- E14, E16: code-review APPROVED (qa_reports/review_T-EB-03.md)
- E14, E15, E16: QA verified (qa_reports/review_T-EB-04.md, 1420/1420 tests)
- E15: shipped in commit 3267a69, verified by E14/E16 release batch

## Release Artifacts

- v3.83.0 tag + GitHub release
- CHANGELOG entry covering E14, E15, E16
- Drift baseline IDs: T-EB-01, T-EB-02, T-EB-03, T-EB-04
- Backlog rows marked done (docs/backlog.md)
