# QA Review: T-INIT-EXTEND
## Feature: agc-cross-agent-adapter-scaffolding
## Date: 2026-06-09
## QA Agent: qa-engineer (claude-sonnet-4-6)

## Phase 1 — Implementation Review

### File Reviewed
- `bin/agc-init.mjs`

### AC-2 Verification
`runInit` iterates `ADAPTERS` (lines 159-177). Each adapter is stamped via `stampTemplate(tpl, ver)` where `ver = installedVersion()`. `installedVersion()` reads `<pkgRoot>/package.json` via `import.meta.url` (lines 47-58) — explicitly not `process.cwd()`. All three adapters written to target workspace; stdout reports them created.

### AC-3 Verification
- Skip-mode (`AGENTS.md`, `.antigravityrules`): `if (fs.existsSync(abs)) { skipped.push(rel); continue; }` — byte-for-byte unchanged.
- Upsert-mode (`CLAUDE.md`): `writeClaudeBlock` (lines 72-97) replaces only the BEGIN/END marker block; prose outside markers untouched. `beginIdx`/`endIdx` logic ensures single marker occurrence.

### AC-4 Verification
`stampTemplate` replaces all `{{AGC_VERSION}}` occurrences with the resolved version (line 64). Both stamp forms (HTML comment for CLAUDE.md, `# agc-version:` line for AGENTS.md/.antigravityrules) are present in the respective templates and survive the stamp replacement.

### AC-9 Verification
STR_USAGE updated to list both `init` and `check` (lines 33-39). Dispatcher (lines 229-240) routes `init` and `check`, exits 1 for undefined, exits 2 for unrecognised.

### Copy Audit
- STR-CREATED-ADAPTER: `Created: ${created.join(", ")}` — matches spec exactly.
- STR-SKIPPED-ADAPTER: `Skipped (already exists): ${skipped.join(", ")}` — matches spec exactly.
- STR-USAGE: verified verbatim match against spec table entry.

## Verdict
PASS — T-INIT-EXTEND implementation meets AC-2, AC-3, AC-4, AC-9.
## 2026-06-09T03:37:57.446Z — PASS — by qa-engineer

All 9 ACs verified. AC-8 programmatic line-intersection: 0 verbatim constitution lines in any adapter template. Version resolution cwd-poison-immune (seeded fake pkg v9.9.9, stamp/check used AGC_VERSION 3.28.0). CLAUDE.md upsert idempotent (BEGIN count=1 after 2 inits, user prose preserved). check: OK=exit 0, stale=exit 1+stderr, no-adapters=silent exit 0. AC-9: no-sub=exit 1+usage(init+check), bogus=exit 2. Visual gate: no design file, silent pass-through. npm build=0, npm test 570/570 (+12 new), check-version OK(3.28.0), audit 0 high (1 pre-existing moderate hono acceptable). Committer note: .antigravityrules/AGENTS.md already exist in repo root as pre-staged files; new test file uses mkdtempSync throughout and does not touch repo root. next_role: human

