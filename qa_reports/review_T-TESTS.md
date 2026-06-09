# QA Review: T-TESTS
## Feature: agc-cross-agent-adapter-scaffolding
## Date: 2026-06-09
## QA Agent: qa-engineer (claude-sonnet-4-6)

## Phase 1 — Implementation Review
Test file: `test/agc-adapters.test.mjs`

All tests use `fs.mkdtempSync` temp dirs (never repo root) to avoid pollution from
pre-staged AGENTS.md/.antigravityrules in the repo. Matches code-reviewer flag.

## Spec-to-Test Map

| AC | Test name | Coverage |
|---|---|---|
| AC-2 | "AC-2: agc init creates all three adapter files stamped with the installed agc version" | Writes to fresh temp dir, checks all three files exist, stamp = AGC_VERSION, no raw placeholder |
| AC-3 | "AC-3a: agc init skips AGENTS.md and .antigravityrules when they already exist" | Pre-seeds skip-mode files with sentinel, verifies byte-for-byte unchanged after re-init |
| AC-3 | "AC-3b: agc init upserts CLAUDE.md idempotently — BEGIN marker count stays 1, user prose preserved" | 2-pass init, counts BEGIN markers (must be 1), verifies user prose preserved |
| AC-4 | "AC-4: version stamp in AGENTS.md and .antigravityrules uses # comment form" | Checks `# agc-version: <ver>` near top of file |
| AC-4 | "AC-4: CLAUDE.md version stamp uses HTML comment form inside the marker block" | Checks `<!-- agc-version: <ver> -->` in CLAUDE.md |
| AC-5 | "AC-5: agc check exits 1 and prints stale message to stderr when adapter stamp is old" | Seeds adapters with v0.0.1, asserts exit=1, stale message on stderr with version gap |
| AC-6 | "AC-6: agc check exits 0 with OK message when all adapters match installed version" | After init, asserts exit=0, OK message, empty stderr |
| AC-7 | "AC-7: agc check exits 0 and produces no output when no adapters are present" | Fresh temp dir (no adapters), asserts exit=0, empty stdout, empty stderr |
| AC-8 | "AC-8: no verbatim constitution line appears in any adapter template (pointer-only)" | Programmatic line-intersection of all 3 templates against content/constitution.md — expects 0 violations |
| AC-9 | "AC-9a: no subcommand exits 1 and prints usage listing both init and check to stderr" | Owns p0-onboarding-lite-default.test.mjs:136 assertion per code-reviewer §2 ruling |
| AC-9 | "AC-9b: bogus subcommand exits 2 and prints usage to stderr" | `agc notacommand` → exit 2 |
| Version-poison | "version-poison: stamp and check use the agc package version, not the target workspace's package.json" | Seeds fake package.json v9.9.9 in temp dir; verifies AGC_VERSION used, not 9.9.9 |

## Phase 4 — Run Results
- `npm run build` exit 0 (no dist delta — surgical scope)
- `npm test` FULL suite: **570/570 pass, 0 fail**
  - Baseline was 558; new file adds **12 tests**
- `node scripts/check-version.mjs` → OK (3.28.0)
- `npm audit --audit-level=high` → 0 high vulnerabilities; 1 pre-existing moderate (hono ≤4.12.20) acceptable per pre-approved scope

## Visual Gate
`design/agc-cross-agent-adapter-scaffolding.md` absent — gate: silent pass-through per spec §Dependencies #5 ("No design artifacts. This is a CLI-only feature.").

## Ownership Note for Committer
`AGENTS.md` and `.antigravityrules` are already present in the repo root (pre-staged, not managed by agc-init for the server's own repo). These are correctly excluded from the test's temp-dir approach. The committer should verify that no test accidentally writes into the repo root; `git status` before commit should show only `test/agc-adapters.test.mjs` and the four `qa_reports/review_T-*.md` files as new additions.

## Verdict
PASS — T-TESTS implementation complete. 12 new tests, all green. Full suite 570/570.
## 2026-06-09T03:37:57.446Z — PASS — by qa-engineer

All 9 ACs verified. AC-8 programmatic line-intersection: 0 verbatim constitution lines in any adapter template. Version resolution cwd-poison-immune (seeded fake pkg v9.9.9, stamp/check used AGC_VERSION 3.28.0). CLAUDE.md upsert idempotent (BEGIN count=1 after 2 inits, user prose preserved). check: OK=exit 0, stale=exit 1+stderr, no-adapters=silent exit 0. AC-9: no-sub=exit 1+usage(init+check), bogus=exit 2. Visual gate: no design file, silent pass-through. npm build=0, npm test 570/570 (+12 new), check-version OK(3.28.0), audit 0 high (1 pre-existing moderate hono acceptable). Committer note: .antigravityrules/AGENTS.md already exist in repo root as pre-staged files; new test file uses mkdtempSync throughout and does not touch repo root. next_role: human

