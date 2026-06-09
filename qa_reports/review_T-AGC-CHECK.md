# QA Review: T-AGC-CHECK
## Feature: agc-cross-agent-adapter-scaffolding
## Date: 2026-06-09
## QA Agent: qa-engineer (claude-sonnet-4-6)

## Phase 1 — Implementation Review

### File Reviewed
- `bin/agc-init.mjs` — `runCheck()` function (lines 194-226)

### AC-5 Verification
`runCheck` iterates `ADAPTERS`, reads each present file, applies `STAMP_RE`, compares stamped version to `installedVersion()`. Stale files are accumulated in `stale[]`; if any exist, each is reported to stderr via `agc check — stale adapter: ${s.file} (stamped ${s.stamped}, installed ${s.installed})` and `process.exit(1)` is called. Matches STR-CHECK-STALE verbatim.

### AC-6 Verification
When `stale.length === 0` and `present > 0`, stdout receives `agc check — OK (${ver}) — all adapters current\n` and exits 0. Matches STR-CHECK-OK verbatim.

### AC-7 Verification
When no adapter files exist in the workspace, `present` stays 0 and `stale` stays empty. The function falls through to `process.exit(0)` after the `if (present > 0)` block — silent, no output. Matches STR-CHECK-NONE (no output, exit 0).

### Copy Audit
- STR-CHECK-STALE: verified against implementation (line 212-214 in bin/agc-init.mjs).
- STR-CHECK-OK: verified against implementation (line 220).
- STR-CHECK-NONE: no output path confirmed — silent exit 0 when `present === 0`.

## Verdict
PASS — T-AGC-CHECK implementation meets AC-5, AC-6, AC-7.
## 2026-06-09T03:37:57.446Z — PASS — by qa-engineer

All 9 ACs verified. AC-8 programmatic line-intersection: 0 verbatim constitution lines in any adapter template. Version resolution cwd-poison-immune (seeded fake pkg v9.9.9, stamp/check used AGC_VERSION 3.28.0). CLAUDE.md upsert idempotent (BEGIN count=1 after 2 inits, user prose preserved). check: OK=exit 0, stale=exit 1+stderr, no-adapters=silent exit 0. AC-9: no-sub=exit 1+usage(init+check), bogus=exit 2. Visual gate: no design file, silent pass-through. npm build=0, npm test 570/570 (+12 new), check-version OK(3.28.0), audit 0 high (1 pre-existing moderate hono acceptable). Committer note: .antigravityrules/AGENTS.md already exist in repo root as pre-staged files; new test file uses mkdtempSync throughout and does not touch repo root. next_role: human

