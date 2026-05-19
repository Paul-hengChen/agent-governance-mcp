# QA Review — T27: schema/versions.ts (Phase 4 runner)

<!-- @qa-engineer -->

## Scope

Reviewed:
- `schema/versions.ts` (new, 108 lines)
- `tsconfig.json` `include` addition

Implements the runner contract from `specs/schema-versioning-architecture.md`.

## Phase 1 — Review

### Correctness
- `CURRENT_VERSIONS` = `1` for all four `SchemaKind`s — matches architecture.
- `VERSION_WHEN_ABSENT` = `0` — matches.
- `registerMigration` enforces: integer `from`/`to`, non-negative, adjacent (`to === from + 1`).
- `runMigrations`: refuse-loud on `current > target`; no-op fast path on `current === target`; stepwise composition with missing-step refuse-loud.
- `peekVersion`: defensive — null/undefined/non-object/NaN/Infinity/negative/string all collapse to `0`; fractional version floored (`1.5 → 1`).

### Security
- Pure module, no I/O. No secrets, no shell/SQL/path traversal vectors.
- All `unknown` inputs guarded by `typeof` and `Number.isFinite` before access.

### Style
- TS strict, no `any`, `unknown` used at boundaries with type guards.
- Comments explain WHY (e.g. why migrations are keyed by `from`); no narration.
- Naming matches repo conventions.

### Concerns
None blocking. Two notes for the record:
1. **Silent registry overwrite**: re-registering the same `(kind, from)` overwrites the prior migration without warning. Architecture explicitly allows this ("Idempotent (same from/to overwrite)") so this is intentional, not a defect.
2. **No runtime `kind` validation in `runMigrations`**: TS prevents non-`SchemaKind` callers at compile time; JS callers passing an unknown string would silently no-op (target = `undefined`). Acceptable for an internal module called only from TypeScript sites in this repo; flagged in case T28–T31 wiring exposes a new entry point.

### Phase 2 — Discussion
Not needed. No blocking issues found.

## Phase 3 — Tests

### Spec → Test Mapping

T27 implements the foundation for `specs/schema-versioning.md` ACs 3 and 4:

| AC | Test name | File |
|---|---|---|
| AC-3 (closed-for-mod, open-for-ext) | `registerMigration accepts adjacent integer step` | `test/schema-versions.test.mjs` |
| AC-3 | `registerMigration rejects non-adjacent step (to !== from+1)` | same |
| AC-3 | `registerMigration rejects non-integer from/to` | same |
| AC-3 | `registerMigration rejects negative from/to` | same |
| AC-3 | `registerMigration idempotent overwrite` | same |
| AC-3 | `runMigrations composes multi-step chain v0→v2` | same |
| AC-3 | `runMigrations no-op when current === target` | same |
| AC-3 | `runMigrations refuses-loud on missing step` | same |
| AC-3 | `runMigrations threads payload through steps` | same |
| AC-4 | `runMigrations refuses-loud when on-disk version > current` | same |
| AC-4 | `runMigrations error message names kind + versions` | same |
| AC-3 + AC-4 supporting | `peekVersion handles object with valid schema_version` | same |
| supporting | `peekVersion collapses null/undefined to 0` | same |
| supporting | `peekVersion collapses non-object to 0` | same |
| supporting | `peekVersion collapses NaN/Infinity/negative/string to 0` | same |
| supporting | `peekVersion floors fractional versions` | same |
| supporting | `_clearRegistryForTests empties registry` | same |

ACs 1, 2, 5, 6 are out of scope for T27 (require T28–T32 wiring) and will be covered in their respective QA passes.

### Coverage Gate
T27 is a pure module — coverage on `schema/versions.ts` after this test suite should be ≥ 95% (every exported symbol and every error branch hit). Repo has no automated coverage tool wired in `package.json`; coverage asserted by line-by-line inspection of the test list above.

### Security Smoke Tests
Included in the boundary tests: `null`, `undefined`, empty object, oversized integer (`Number.MAX_SAFE_INTEGER + 1` not integer per `Number.isInteger`), special strings (`"1"`), NaN, Infinity, negative.

No auth surface on this module.

## Phase 4 — Run

- `npm test` (prebuild + `node --test test/*.test.mjs`): **166/166 PASS** (+30 from `test/schema-versions.test.mjs` over the prior 136 baseline).
- Project build: ZERO `tsc` errors.
- CI runnable: tests execute headlessly under `node --test` with no human interaction.

**Verdict: PASS.** T27 ready to complete.
## 2026-05-19T09:04:18.584Z — PASS — by qa-engineer

T27 PASS — schema/versions.ts runner: 30 new tests (registerMigration adjacency/integer/sign/idempotency guards, peekVersion edge cases incl. null/string/NaN/fractional/array, runMigrations no-op/single-step/multi-step/payload-threading, refuse-loud AC-4 on future-version + missing-step). 166/166 green. No I/O, pure module; security clean.

