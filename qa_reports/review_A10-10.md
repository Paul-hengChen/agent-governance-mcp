# QA Review — A10-10 (gate-registry, A10 + A2 folded in)

Reviewed against `specs/gate-registry.md` (8 ACs) and
`specs/gate-registry-architecture.md` (Decision Records DR-1..DR-8). Scope
per Constitution §2: qa-engineer owns new test logic — the deferred portion
of A10-08 (generative rewrite of `test/error-code-contract.test.mjs`) — plus
A10-10's phase-gate verification and bookkeeping. sr-engineer implemented
(A10-ARCH..A10-07, the mechanical import-retarget half of A10-08); code-reviewer
APPROVED the full diff (`review_reports/review_A10-09.md`).

## Phase 1 — Review

Read `gates/registry.ts` (18-entry `GATE_REGISTRY`, `gate()`, `TRANSITION_GATE_CODES`,
`ALL_GATE_CODES`), `tools/transitions.ts` (`TransitionRejection["error"]` 12-member
union, `validateTransition` hint sourcing), `tools/handoff-orchestrator.ts` gate
sequence, and the drained `tools/evidence-file.ts` (108 lines, zero `has*/check*/
validate*` predicates — confirms AC-6). Cross-checked against
`specs/gate-registry-architecture.md`'s reconciled 18-gate catalog table and DR
table. No copy/visual-token surface (spec: "N/A — no visual surface"); Phase 1.5
skipped (no `## Visual Baselines` in any design file for this feature — governance-
text/code-only feature, confirmed by spec Visual Structural Assertions section).

No correctness/architecture issues found beyond what code-reviewer already
adjudicated APPROVED — nothing to escalate. Proceeded directly to Phase 3 (no
Round 1 needed).

## Phase 3 — Tests (qa-engineer-owned rewrite)

### `test/error-code-contract.test.mjs` — generative rewrite (AC-5)

Rewrote the interim regex-scan guard (backlog A5) as a generative parity test
per architecture DR-3 and the Test Impact section:

- Imports `{ GATE_REGISTRY, ALL_GATE_CODES }` from the **built**
  `dist/gates/registry.js` (no more regex-scraping `content/*.md` as the code
  truth source) — AC-7 deliberately relaxed per architecture (this file now
  requires a built tree; `npm test`'s prebuild guarantees it).
- Added `...listFiles("gates", ".ts")` to `CODE_SOURCE_FILES` so the code-side
  shape-rule harvest reaches the new `gates/*.ts` modules (architecture Test
  Impact instruction).
- Kept the same shape rule (`SUFFIX_RE`/`PREFIX_RE`/`isGateErrorCode`) so the
  4 existing AC-6 noise-token tests (`ALLOWED_TRANSITIONS`,
  `REQUIRED_VISUAL_SECTIONS`, `AGC_AUTO_ROUTE`, `CHANGES_REQUESTED`) carry
  forward unchanged.

New assertions (spec AC-5 "What the parity check guarantees"):

| # | Assertion | Guards |
|---|-----------|--------|
| 1 | `GATE_REGISTRY.length === 18` and `ALL_GATE_CODES` preserves catalog order | AC-1/AC-5: 18 in, 18 out — no gate dropped or added |
| 2 | `Set(ALL_GATE_CODES) === Set(code-side shape-rule harvest)` over `CODE_SOURCE_FILES` (now incl. `gates/*.ts`) | registry ⇄ code parity, generative (not a hand allowlist) |
| 3 | every doc-mentioned (backtick, shape-rule) code ∈ `ALL_GATE_CODES` | doc ⊆ registry — no doc naming a phantom gate |
| 4 | every `documentedInProse: true` entry is backtick-quoted in ≥1 `content/*.md` | registry ⊆ doc — no silently-undocumented gate |
| 5 | every entry's `hintStatic` is non-empty | internal consistency |
| 6 | `producer: "validateTransition"` entries' `errorCode` literally appears in `tools/transitions.ts` | anchors code-side, not blind regex |
| 7 | `producer: "orchestrator"` entries' `errorCode` literally appears in `tools/handoff-orchestrator.ts` | same, for the other 13 codes |
| 8 | **DR-8**: `TransitionRejection["error"]` union parsed from `tools/transitions.ts` source has exactly 12 unique members, all ⊆ `ALL_GATE_CODES` | pins the deliberately-not-registry-sourced union at 12 (5 emitted + 7 handler-side), catches silent narrowing/growth without re-typing it |
| 9 | this file itself imports `dist/gates/registry.js` | pins the intentional AC-7 relaxation so a future revert to source-text scanning is a visible, deliberate diff |

Verified locally before commit (see Phase 4) that each new assertion is
non-vacuous against the live tree: code-side harvest over `index.ts tools/
schema/ guards/ gates/` = exactly 18 codes; doc-side backtick harvest over
`content/*.md` = the same 18 codes (both directions hold with zero
orphans/gaps); the `TransitionRejection` union regex-extraction yields exactly
the 12 documented members in `tools/transitions.ts:44-90`.

### Import retargets (mechanically-retargeted, sr-engineer-owned; verified, not modified)

Confirmed (grep) that all 8 spec-listed test files plus the 4 architecture-flagged
additional importers already retarget from `tools/evidence-file.js` to the
correct `gates/*.js` module, with assertions unmodified (AC-2):
`cut-approval-gate`, `baseline-manifest-gate`, `pixel-gate-attestation`,
`visual-evidence-gate`, `visual-widgets-unverified-gate`, `qa-flow`,
`evidence-provenance`, `visual-gate-e2e`, `visual-report-schema-validation`,
`context-budget` (source-grep line updated to `gates/visual`),
`constitution-deliverable-guard` (source read retargeted to `gates/visual.ts`).
No assertion text changed in any of these — only import paths, consistent
with AC-2's byte-parity requirement. `feature-scope-gate.test.mjs` and
`visual-round-transitions.test.mjs` do not import `evidence-file`/`gates`
directly — no retarget needed.

## Phase 4 — Run (phase gates)

- **`npm run build`** — zero TS errors.
- **`npm audit --audit-level=high`** — clean (1 low-severity `esbuild` advisory
  present but below the `high` threshold; exit code 0).
- **`npm test`** — **872/872 pass** (up from 868 — the rewritten
  `error-code-contract.test.mjs` nets +4 tests: 9 old assertions →
  13 new; all other suites unchanged and green, including every gate test
  whose imports were retargeted).
- **Smoke test** — spawned `dist/index.js`, sent `initialize`, observed
  `🛡️ Agent Governance MCP is online. (Tools + Prompts + Guards)` on stderr.
  PASS.

## AC coverage summary

| AC | Status | Evidence |
|----|--------|----------|
| AC-1 | PASS | `gates/registry.ts` — 18-entry `GATE_REGISTRY`, verified by code-reviewer + re-verified here |
| AC-2 | PASS | 8+4 gate/import-adjacent test files green, assertions unmodified; new test asserts `errorCode` literally present at producer files |
| AC-3 | PASS | zero `content/*.md` diff (confirmed via `git status`); golden-baseline test in full suite green |
| AC-4 | PASS | skill files byte-unchanged; doc-parity assertions in rewritten test cover skill + constitution token mentions (test scans all `content/*.md`, broader than spec's named list per architecture) |
| AC-5 | PASS | generative rewrite of `test/error-code-contract.test.mjs`, 18 in/18 out, this review |
| AC-6 | PASS | `tools/evidence-file.ts` drained to 108 lines of shared plumbing, zero predicates (confirmed via grep for `^export function`) |
| AC-7 | PASS | orchestrator gate-check block order unchanged (code-reviewer diff-verified; re-confirmed by reading `handoff-orchestrator.ts` sequence) |
| AC-8 | PASS | no `schema_version` constant touched (git diff scoped to `gates/`, `tools/{evidence-file,handoff-orchestrator,transitions,storage}.ts`, `prompts/build.ts`, tests, docs) |

## Bookkeeping (A10-10)

- Version bumped `3.46.0` → `3.46.1` (PATCH, per this project's own semver
  policy: "internal refactors with no observable behavior change") in
  `package.json` and the `index.ts` `Server()` literal; `node
  scripts/check-version.mjs` confirms package.json/index.ts/CHANGELOG agree.
- `CHANGELOG.md` — new `[3.46.1]` entry under `### Changed`.
- `docs/backlog.md` — A10 and A2 marked done in both the summary table rows
  and the section headers (A2's header cross-references A10 as the shipping
  vehicle per the spec's fold-in decision).

## Verdict

**PASS.** All 8 ACs satisfied, build/audit/test/smoke phase gates green,
generative test rewrite in place and independently verified non-vacuous
against the live source tree, bookkeeping complete.
## 2026-07-07T17:03:55.730Z — PASS — by qa-engineer

gate-registry (A10+A2 folded in) PASS. Rewrote test/error-code-contract.test.mjs as the generative registry-parity test (imports dist/gates/registry.js; asserts 18-in/18-out, registry<->code shape-rule harvest parity incl. gates/*.ts, doc<->registry subset in both directions, hintStatic/producer internal consistency, and DR-8: TransitionRejection[\"error\"] 12-member union subset of ALL_GATE_CODES). Verified all 8 spec-listed + 4 architecture-flagged import retargets already correct with assertions unmodified (AC-2). Phase gates: npm run build zero errors; npm audit --audit-level=high clean; npm test 872/872 pass (868+4 net new assertions); boot smoke test confirmed \"online\" on stderr. Bookkeeping: version 3.46.0->3.46.1 (package.json + index.ts, verified via scripts/check-version.mjs), CHANGELOG.md entry added, docs/backlog.md A10+A2 marked done (table rows + section headers). All 8 ACs verified — see qa_reports/review_A10-10.md.

