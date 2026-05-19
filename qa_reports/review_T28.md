# QA Review — T28: handoff YAML migration wiring (Phase 4)

<!-- @qa-engineer -->

## Scope

Reviewed:
- `schema/migrations-handoff.ts` (new, 21 lines)
- `tools/handoff.ts` (refactor: new `readAndMigrate()` helper; `writeHandoffState` stamps `schema_version`)

Implements `specs/schema-versioning.md` AC-1 / AC-2 / AC-4 / AC-5 for the handoff artifact, per `specs/schema-versioning-architecture.md`.

## Phase 1 — Review

### Correctness
- v0→v1 migration is additive only: stamps `schema_version: 1`, no field rename/coercion. Matches architecture's "no destructive bumps" rule.
- Side-effect import (`import "../schema/migrations-handoff.js";`) loads before any read — registration order is sound.
- `readAndMigrate()` is the single source of truth for parse+migrate. `parseHandoff()` and `readHandoffState()` both delegate; only `readHandoffState()` triggers write-back, avoiding the recursion trap where `writeHandoffState → parseHandoff → write-back → writeHandoffState`.
- Fire-and-forget write-back uses `void writeHandoffState(...).catch(() => {})`. The `.catch` swallows freshness errors from concurrent writers (AC-5).
- `schema_version` is the **first key** in `frontmatterData`, so `yaml.dump` emits it as line 1 — grep-friendly and stable across re-serialisation.

### Security
- No new I/O surface. All inputs flow through existing `yaml.load` (try/catch wrapped, malformed YAML still throws), `runMigrations` (validates payload via `typeof` guards from T27), and `withFileLock` (unchanged).
- No secrets, no shell, no path traversal, no injection.

### Concerns
None blocking. Two notes:
1. **MCP server hot-reload**: the running `tw_*` server still uses the prior `dist/`; new behaviour activates after server restart. Not a defect — tests exercise the freshly-compiled `dist/` directly, mirroring how production picks it up.
2. **Fire-and-forget timing in tests**: the write-back is async, returns immediately. Tests must yield (`setImmediate` / `setTimeout`) before asserting on-disk healing. Documented inline in the test file.

### Phase 2 — Discussion
Not needed. No blocking issues.

## Phase 3 — Tests

### Spec → Test Mapping (T28 scope)

| AC | Test name | File |
|---|---|---|
| AC-1 | `writeHandoffState stamps schema_version: 1 in YAML` | `test/handoff-versioning.test.mjs` |
| AC-1 | `schema_version appears as the first frontmatter key (grep-stable)` | same |
| AC-2 | `readHandoffState heals v0 handoff to v1 on disk (fire-and-forget)` | same |
| AC-2 | `readHandoffState fast-path: v1 file triggers no write-back` | same |
| AC-2 (boundary) | `parseHandoff returns v1 state in-memory but does NOT write back` | same |
| AC-2 (regression) | `existing handoff missing schema_version round-trips to v1` | same |
| AC-4 | `readHandoffState refuses-loud when on-disk schema_version > CURRENT` | same |
| AC-4 | `parseHandoff refuses-loud on future schema_version` | same |
| AC-5 (sim) | `concurrent migration write-backs: second swallows freshness error` | same |
| boundary | `readHandoffState returns exists:false when handoff.md missing` (regression) | same |
| boundary | `malformed YAML still throws with original error message` (regression) | same |

ACs 3 (open/closed-for-extension) and 6 (drift skew) remain T27-covered and T32-pending respectively.

### Coverage Gate
New/modified files:
- `schema/migrations-handoff.ts`: 1 `registerMigration` call + 1 `up` body → hit by every migration test (100%).
- `tools/handoff.ts` new branches: `readAndMigrate` (migrationApplied true/false), `readHandoffState` (write-back fired vs skipped), `writeHandoffState` (schema_version stamp). Every new branch has a dedicated test above.

Repo has no automated coverage tool — coverage asserted by branch-by-branch inspection.

### Security Smoke Tests
Boundary inputs covered:
- Missing file (`exists: false` path)
- Malformed YAML (throws)
- Future `schema_version` value (refuse-loud)
- Empty frontmatter (`schema_version` absent → v0 → migrates to v1)

No auth surface on this module.

## Phase 4 — Run

- `npm test`: **177/177 PASS** (+11 new from `test/handoff-versioning.test.mjs` over the 166 baseline; existing handoff/tasks/session/QA-flow/RAG tests survived the `readAndMigrate` refactor).
- Project build: ZERO `tsc` errors.
- CI runnable: tests run headlessly under `node --test`.

**Verdict: PASS.** T28 ready to complete.
## 2026-05-19T09:49:03.892Z — PASS — by qa-engineer

T28 PASS — handoff YAML migration wiring: schema/migrations-handoff.ts registers v0→v1 stamp; tools/handoff.ts refactored with readAndMigrate() internal helper, fire-and-forget heal in readHandoffState, schema_version stamped first in frontmatterData. 11 new tests cover AC-1 (stamp + first-key), AC-2 (heal + fast-path + parseHandoff read-only + regression round-trip), AC-4 (refuse-loud through both readHandoffState and parseHandoff), AC-5 (sequential second-write swallows freshness), regression (missing file, malformed YAML). 177/177 green.

