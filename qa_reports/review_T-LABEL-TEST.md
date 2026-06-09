# Review — T-LABEL-TEST

Task: `T-LABEL-TEST` — add missing regression coverage for the T-LABEL-FIX bug
(pre-existing CLAUDE.md without agc block → `agc init` reported `Created:` instead of `Updated:`).
Reviewer: qa-engineer (claude-sonnet-4-6).

## Phase 1 — Implementation Review

### T-LABEL-FIX correctness (already APPROVED by code-reviewer)

The fix in `bin/agc-init.mjs` (~L161-165) maps both `"updated"` and `"appended"` results
from `writeClaudeBlock` into the `updated` list; only `"created"` (brand-new file) goes
to `created`. The fix is correct and the code-reviewer's independent proof confirms both
directions (pre-existing → `Updated:`, fresh → `Created:`).

### Copy / Strings audit (Phase 1 gate 3a)

Spec Copy/Strings table entry relevant to T-LABEL-FIX:

| string id | exact text |
|---|---|
| STR-CREATED-ADAPTER | `Created: {files}` |
| STR-SKIPPED-ADAPTER | `Skipped (already exists): {files}` |

No new string IDs are introduced by T-LABEL-FIX. The existing `Updated: {files}` label
was already present in the implementation (lines 179-181); the fix corrects which bucket
CLAUDE.md lands in. No copy drift detected.

### Visual Audit Gate (Phase 1 gate 3b)

Spec declares N/A — CLI-only feature, no visual tokens. Gate: silent pass-through.

### Phase 1.5 — Visual Compare

No `design/agc-cross-agent-adapter-scaffolding.md` file exists. Phase 1.5: skipped
(no Visual Baselines declared).

## Phase 2 — Discussion

No issues found in Phase 1. Proceeding directly to Phase 3.

## Phase 3 — Tests (Spec-to-Test Map)

### AC coverage gap addressed by T-LABEL-TEST

The AC that T-LABEL-FIX addresses is implicitly AC-2 (stdout reports files as created/updated)
and AC-3 (CLAUDE.md upsert is idempotent for pre-existing content). The prior test suite
covered AC-3b (second init after first init, i.e. agc block already present) but NOT the
gap case: CLAUDE.md exists WITHOUT the agc block → label must be `Updated:`.

### New tests added to `test/agc-adapters.test.mjs`

| test name | AC / invariant | assertion |
|---|---|---|
| `T-LABEL-FIX: agc init reports CLAUDE.md under Updated when file exists without an agc block` | AC-2 stdout label + AC-3 prose preservation | `stdout` matches `/Updated:.*CLAUDE\.md/`; does NOT match `/Created:.*CLAUDE\.md/`; prior prose preserved; `BEGIN agc-adapter` count === 1 |
| `T-LABEL-FIX complement: agc init reports CLAUDE.md under Created in a truly-fresh dir (over-correction guard)` | AC-2 stdout label for fresh-dir path | `stdout` matches `/Created:.*CLAUDE\.md/`; does NOT match `/Updated:.*CLAUDE\.md/` |

### Security smoke tests

- Boundary: pre-existing file with empty content — covered transitively by AC-3a/AC-3b suite.
- No auth/permission surface: CLI writes to `cwd`-relative paths only.
- No injection vectors: filenames are static constants; no user-supplied path is interpolated.

### Coverage

New tests exercise the `"appended"` branch of `writeClaudeBlock` (lines 93-96) and the
caller's classification of that return value (lines 162-164). Both branches of the fresh/pre-existing
fork are now covered by dedicated tests. Coverage gate: satisfied.

## Phase 4 — Run

See verification notes in the PASS state update. Full suite ran to completion: test count
reported there.

## Verdict

APPROVED — T-LABEL-TEST adds the two regression tests that directly encode the invariant
the bug violated. Both tests are spec-driven, self-documenting (WHY is in the comment),
and cover the over-correction regression vector. All gates green.
## 2026-06-09T04:13:34.855Z — PASS — by qa-engineer

T-LABEL-FIX: fix correct — writeClaudeBlock 'appended' return now maps to updated[] not created[]; all three return values exhaustively partitioned; proof scenarios verified both directions. T-LABEL-TEST: 2 regression tests added to test/agc-adapters.test.mjs covering (1) existing CLAUDE.md without agc block → stdout shows Updated not Created, prose preserved, block count === 1; (2) fresh dir → stdout shows Created not Updated (over-correction guard). Gates: build exit 0, check-version OK (3.29.0), full suite 572/572 (+2 from prior 570), npm audit MODERATE hono pre-existing acceptable.

