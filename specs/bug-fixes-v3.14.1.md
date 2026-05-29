# bug-fixes-v3.14.1

## Problem Statement

Post-v3.14.0 audit (`research/spec-kit-vs-openspec-vs-agc.md` + audit checklist) surfaced four real findings + six missing e2e tests. v3.14.1 is a focused patch release closing these without changing public API. Three priorities ordered by severity: (1) **`protobufjs` CRITICAL waiver re-evaluation** — current waiver claims `@xenova/transformers` chain "not reachable" but `tools/rag.ts` runs embeddings on PRD text (user-controlled); needs reachability trace, (2) **path-sanitiser hardening** — `hasVisualBaselinesInDesign` allows `..` literal because slashes are replaced not rejected; surprising behaviour worth tightening, (3) **Round 6 sentinel off-by-one** — pending_notes synthesis only fires on `new === 6 && prev === 5` so an externally-bumped counter > 5 skips the sentinel. Plus six missing end-to-end tests that bridge unit-tested primitives to `index.ts` handler composition — refactors could regress them silently. R6 server-enforced widget verification and `writeHandoffState` options-object refactor are intentionally deferred to v3.15.0 per user decision (locked in Question Batch).

## User Stories

- As a **framework maintainer**, I want the `@xenova/transformers` waiver to be either factually accurate or mitigated so that we are not knowingly shipping a reachable RCE chain under "not reachable" justification.
- As a **server operator**, I want `hasVisualBaselinesInDesign` to reject `..` segments explicitly so that hostile feature names cannot create surprising file lookups even though they cannot escape the workspace.
- As a **framework maintainer**, I want the Round 6 lock sentinel to fire reliably even if `visual_round` reaches cap via migration / manual edit — not only via in-band increment — so that operators always see the rollback-to-PM directive.
- As a **future refactorer**, I want end-to-end tests for `VISUAL_EVIDENCE_MISSING`, `VISUAL_ROUND_EXCEEDED`, Round 6 sentinel, visual_round persistence, SQLite round-trip, and design-file read-error path so that changes to `index.ts` handler composition cannot silently regress the v3.14.0 contracts.

## Acceptance Criteria

### Investigation (R-audit priority 1)

- **AC-1**: `research/xenova-reachability.md` exists, classifying every `@xenova/transformers` API entry point exercised by `tools/rag.ts` against the protobufjs CVE call paths (`GHSA-xq3m-2v4x-88gg` arbitrary code execution + `GHSA-jvwf-75h9-cwgg` prototype pollution + 7 others), `Given` PRD text is user-controlled, `When` `tw_index_prd` runs embeddings, `Then` the report MUST conclude one of: (a) **NOT REACHABLE** with code-path evidence — waiver stands, append rationale to CHANGELOG; (b) **REACHABLE** — propose mitigation (downgrade transformers / pin alternative / remove RAG optionalDep / switch embedding model).
- **AC-2**: if AC-1 verdict is REACHABLE, v3.14.1 MUST ship at least one mitigation step before tagging.

### Bug fixes (priority 2-3)

- **AC-3 (sanitiser)**: `Given` a malicious `active_feature` containing literal `..` (e.g. `..feat` or `pp..pp`), `When` `hasVisualBaselinesInDesign(ws, feature)` runs, `Then` it MUST return `{ present: false, designPath: <safe> }` with the resolved path NOT containing `..` segments. Current implementation replaces `/` with `_` but preserves `.` — `..feat` survives. Fix: reject `..` after sanitisation OR collapse `..` to `_`.
- **AC-4 (Round 6 sentinel)**: `Given` `prev_visual_round` is ANY value ≥ 5 and `new_visual_round === 6`, `When` `index.ts` synthesises pending_notes, `Then` the `⛔ Visual Round 6: forced rollback to pm…` sentinel MUST be prepended. Change condition from `new === 6 && prev === 5` to `new >= 6 && prev < 6`.

### End-to-end test coverage (6 tests)

- **AC-5**: `test/visual-gate-e2e.test.mjs` MUST exist and assert: invoking `tw_update_state(status=PASS, agent_id="qa-engineer", completed_tasks=["T01"])` with a workspace that has `design/<feature>.md` containing `## Visual Baselines` AND no `qa_reports/visual_T01.md` → handler returns `⛔ VISUAL_EVIDENCE_MISSING: T01` and `isError: true`. (Currently `hasVisualBaselinesInDesign` + `hasVisualEvidenceInFile` are unit-tested but the composition path through `index.ts` is not.)
- **AC-6**: Round 6 sentinel injection — assert that `tw_update_state` with `prev_visual_round=5` + `agent_id="qa-engineer"`, `status="FAIL"`, `pending_notes=["visual_fail: pixel"]` results in persisted handoff `pending_notes` whose first line matches `/⛔ Visual Round 6: forced rollback to pm/`.
- **AC-7**: visual_round persistence — assert that after the above FAIL, a subsequent `tw_get_state` returns `visual_round: 6`.
- **AC-8**: SQLite round-trip — in SQLite mode (`SqliteHandoffStorage`), assert `writeState(..., visualRound=4)` then `parse(ws).visual_round === 4`. Mirror of existing file-mode handoff-versioning tests.
- **AC-9**: design-file read-error path — `Given` `design/<feature>.md` exists but is unreadable (chmod 000 or invalid UTF-8), `When` `hasVisualBaselinesInDesign` runs, `Then` it MUST NOT throw; current behaviour silently returns `{ present: false }`. Confirm the silent-swallow is intentional and add a test. (If we decide to fail-loud instead, that's an API change — defer to v3.15.0.)
- **AC-10**: `VISUAL_ROUND_EXCEEDED` end-to-end via `tw_update_state` — assert handler returns the structured rejection envelope when `prev_visual_round=6` and `next` is not `(pm, In_Progress)`.

### Release / build gates

- **AC-11**: `npm run build` zero error. `npm test` 100% passing (was 353/353; new tests add 6+).
- **AC-12**: `npm audit --audit-level=high` either (a) clean if AC-1 led to mitigation, or (b) carries documented waiver with the AC-1 reachability report cited.
- **AC-13**: version bump 3.14.0 → 3.14.1 across `package.json` + `index.ts` Server literal + CHANGELOG `[3.14.1]` entry.

## Copy / Strings

| string id | exact text (quote verbatim) | source |
|---|---|---|
| err.sanitiser_double_dot_rejected | (none — internal behaviour change, no new user-facing string) | authored-here — AC-3 reuses the existing `{ present: false }` return shape, no new error code surfaces to operators |
| changelog.3.14.1.heading | `## [3.14.1] - 2026-05-29` | authored-here — standard CHANGELOG entry format mirroring `[3.13.0]` |

## Visual Tokens

N/A — this is a patch release with no UI surfaces. Visual Widgets section likewise N/A (no widgets in framework code).

## Visual Widgets

N/A — feature has no non-primitive widgets.

## Out of Scope

- **R6 server-enforced widget verification** — deferred to v3.15.0 per user Question Batch decision. v3.14.0 architecture §A pre-emptively reserved `VISUAL_WIDGETS_UNVERIFIED` error code; v3.15.0 will activate it.
- **`writeHandoffState` options-object refactor** — deferred to v3.15.0 with dual-API (positional `@deprecated`, options-object new). Locked via Question Batch.
- **TOCTOU between visual gate check and `writeState`** — audit identified theoretical race; not exploitable, not blocking, defer indefinitely.
- **`fail-loud` rewrite of `hasVisualBaselinesInDesign`** — current silent-swallow on read errors is preserved (matches existing `hasEvidenceInFile` convention). AC-9 just adds a test confirming current behaviour. Changing the convention is API change → v3.15.0+.

## Dependencies / Prerequisites

- Question Batch decisions (locked):
  1. **Release scope**: v3.14.1 patch first (this spec); v3.15.0 next session (R6 + refactor).
  2. **writeState refactor**: dual API in v3.15.0 (positional deprecated; options-object new).
  3. **R6 strategy**: parse markdown checkbox in v3.15.0, any `[ ]` → reject PASS.
- `research/xenova-reachability.md` — must be produced by researcher before sr-engineer can decide T01 fix path.
- `npm audit` output as of v3.14.0 release (already captured in CHANGELOG): 5 vulnerabilities (1 moderate, 3 high, 1 critical), all under `@xenova/transformers` transitive chain. Critical is `protobufjs` RCE.

## Task Breakdown

```
T200 [P0] researcher: trace xenova/transformers → onnxruntime-web → onnx-proto → protobufjs reachability from tools/rag.ts | depends_on: none
T201 [P0] sr-engineer: hasVisualBaselinesInDesign sanitiser — reject `..` literal | depends_on: none
T202 [P0] sr-engineer: index.ts Round 6 sentinel — change `===` to `>= && <` | depends_on: none
T203 [P0] sr-engineer: implement T200 mitigation if REACHABLE (close RAG path, downgrade transformers, OR document with cited evidence) | depends_on: T200
T204 [P0] qa-engineer: write test/visual-gate-e2e.test.mjs covering AC-5, AC-6, AC-7, AC-10 (4 end-to-end tests through tw_update_state) | depends_on: T201, T202
T205 [P0] qa-engineer: write test/visual-round-sqlite.test.mjs covering AC-8 (SQLite mode visual_round round-trip) | depends_on: T201, T202
T206 [P0] qa-engineer: add test/visual-evidence-gate.test.mjs entry for AC-9 (read-error silent-swallow confirmation) + AC-3 sanitiser `..` reject test | depends_on: T201
T207 [P1] sr-engineer: version bump 3.14.0 → 3.14.1, CHANGELOG [3.14.1] entry, README §(r) | depends_on: T203, T204, T205, T206
```

Next role: **researcher** (T200 is no-dependency P0 + required input for T203; running researcher in parallel with sr-engineer's T201/T202 saves hops).

— @pm
