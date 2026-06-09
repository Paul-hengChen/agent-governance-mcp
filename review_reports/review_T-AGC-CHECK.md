# Review — T-AGC-CHECK

> Per-id review evidence. Full findings: `review_reports/review_agc-cross-agent-adapter-scaffolding.md`.

## Summary
- Added `runCheck(cwd)` to `bin/agc-init.mjs`: scans the 3 adapter targets, extracts `STAMP_RE`, compares to `installedVersion()`; stale→stderr+exit 1, all-current→stdout+exit 0, none-present→silent exit 0.
- Verdict: **APPROVED**.

## Correctness
- Smoke-verified: current → `agc check — OK (3.28.0) — all adapters current` exit 0 (AC-6); tampered stamp → `agc check — stale adapter: .antigravityrules (stamped 0.0.0, installed 3.28.0)` on stderr, exit 1 (AC-5); empty dir → silent exit 0 (AC-7).
- Missing-stamp path (`m ? m[1] : "(none)"`, `:204`) treats clobbered stamp as stale — matches architecture conservative decision.
- `STAMP_RE.exec` first-match-wins (`:203`) matches both comment styles; robust to content below the block.

## Quality
- Reuses the `ADAPTERS` registry and `STAMP_RE`; per-file stale report; output stream split (stale→stderr, OK→stdout) mirrors `check-version.mjs`.

## Architecture
- Version resolved from the agc package, NOT cwd — proven by seeding a target `package.json` v9.9.9: check still reports `3.28.0`. Matches Q1.

## Security
- Read-only fs over fixed cwd-relative targets; bounded semver regex (no catastrophic backtracking). No surface.

## Performance
- O(3) synchronous reads; no regression.

## Verdict
**APPROVED** — stale/current/none exit codes and version-resolution-immunity verified by independent CLI run; AC-5/6/7 satisfied.
