# Review — T-INIT-EXTEND

> Per-id review evidence. Full findings: `review_reports/review_agc-cross-agent-adapter-scaffolding.md`.

## Summary
- Extended `bin/agc-init.mjs`: `switch(argv[2])` dispatch, `pkgRoot()`/`installedVersion()`/`stampTemplate()` helpers, `runInit` writes 3 stamped adapters (skip-existing for AGENTS.md/.antigravityrules, marker-block upsert for CLAUDE.md), STR_USAGE lists init+check.
- Verdict: **APPROVED**.

## Correctness
- Smoke-verified: empty-dir init creates + stamps all 3 (AC-2/4); 2nd init → `Updated: CLAUDE.md` + skips, BEGIN count stays 1 (AC-3, idempotent); CLAUDE upsert preserves user prose and refreshes a stale stamp in place (`bin/agc-init.mjs:85-91`).
- Existing `.current/` + tasks.md scaffolding preserved verbatim (`:135-155`).
- No-subcommand → usage + exit 1; bogus → exit 2 (`:239`).

## Quality
- Single-file, named small functions; `ADAPTERS` registry is the single path source. Stamp via `.split().join()` replaces all placeholder occurrences.

## Architecture
- `pkgRoot()` via `import.meta.url` → `resolve(here, "..")` (`:47-50`), package-relative template reads (`:62`); matches Q1/Q2 decisions. No server code touched.

## Security
- No shell/eval/network; writes only known cwd-relative targets. No secrets.

## Performance
- O(3) synchronous fs ops; no regression.

## Verdict
**APPROVED** — init path, dispatch, and usage match the blueprint; AC-2/3/4/9 verified by independent CLI run.
