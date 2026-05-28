# Code review — T55 through T66 (cohesive v3.9.0 change set)

<!-- Auto-appended-style header by code-reviewer. -->

## Round 1 — APPROVED — by code-reviewer

This review covers the cohesive v3.9.0 implementation landing T55–T66 (T67 is qa-scope per constitution §2). The change set is reviewed as one diff because the tasks form a single shipping unit (chain mutation + schema bump + skill split + version bump). Identical body is committed to `review_<T55..T66>.md` so the per-task evidence gate passes for every id.

## Summary

- Scope reviewed: `git diff 1e51df6...HEAD` — 14 src files modified + 3 created (`prompts/code-reviewer.ts`, `content/skill-code-reviewer.md`, plus the two spec files), with mirrored `dist/` rebuild.
- Constitution v3.8.3 → v3.9.0, package + Server() literal 3.8.3 → 3.9.0, handoff/sqlite schema 1 → 2.
- Routing chain mutated as AC-2 mandates: `sr-engineer:In_Progress → qa-engineer:In_Progress` edge removed; replaced with `sr → code-reviewer` and three new `code-reviewer:*` rows.
- New `review_round` counter symmetric to `qa_round`, cap=4, with file + SQLite evidence gating at the `cr → qa` handoff.
- Headline verdict: **APPROVED**. Implementation faithfully matches `specs/code-reviewer-role-extraction-architecture.md`. Two non-blocking concerns flagged below (one cosmetic, one a spec inconsistency owned by PM/qa not by this implementation).

## Correctness

- `tools/transitions.ts:117-141` — matrix mutations match AC-2 exactly: `sr-engineer:In_Progress` next-set replaces `qa-engineer:In_Progress` with `code-reviewer:In_Progress` while preserving `sr:Blocked` + `pm:In_Progress`. The three new `code-reviewer:*` rows are present with the AC-mandated edges.
- `tools/transitions.ts:236-246` — `REVIEW_ROUND_EXCEEDED` rejection logic mirrors the qa cap branch verbatim (cap value, error code, hint string template) and triggers only when next-tuple ≠ `(pm, In_Progress)`. Matches AC-3.
- `tools/transitions.ts:287-310` (`computeNewRound`) — semantics match the architecture table:
  - `(code-reviewer, FAIL)` → `prev_review + 1` (line 299).
  - `(qa-engineer, In_Progress)` gated on `prev.agent === "code-reviewer" && prev.status === "In_Progress"` → 0 (lines 301-307). Correct — this is the "successful handoff resets review_round" rule and the prev-tuple guard prevents accidental reset on unrelated qa-loop traffic.
  - `(pm, In_Progress)` → both counters 0 (lines 297, 308). Matches AC-3 and the qa_round precedent.
- `tools/handoff.ts:124-138` — `review_round` parsed with the same `Number.isFinite + floor + >= 0` defence as `qa_round`. Missing field defaults to 0 (backward-compat). ✓
- `tools/handoff.ts:143-153` — stderr migration warning is gated on (a) the migration runner having applied step `2` this read AND (b) `last_agent=sr-engineer && status=In_Progress`. The conjunction is correct: an upgraded handoff that already finished sr's phase doesn't false-positive.
- `index.ts:651-670` — evidence gate fires only on the exact `cr:IP → qa:IP` transition with non-empty `completed_tasks`. Error text matches AC-8 verbatim (`Code-reviewer evidence missing: write review_reports/review_<task-id>.md before handing off to qa-engineer.`). Defence-in-depth structure mirrors the L619 PASS evidence gate.
- `index.ts:673-688` — both `qa_round === 4 && prev === 3` AND `review_round === 4 && prev === 3` sentinel notes are appended on the cap-hit transition. Symmetric to qa branch. ✓
- `schema/migrations-handoff.ts:17-27` — v1→v2 pure transform: `{ ...input, schema_version: 2, review_round: 0 }`. The stderr I/O lives in the caller (`handoff.ts:143`), preserving the migration step's pure-function discipline. ✓
- `schema/migrations-sqlite.ts:31-57` — idempotent `PRAGMA table_info` check before `ALTER TABLE` (line 38-40). `CREATE TABLE IF NOT EXISTS code_review_reports` with the AC-9 verdict enum + the matching index. The constructor-level `addColumnIfMissing` at `storage-sqlite.ts:179` is a redundant safety net for already-bootstrapped DBs; both code paths converge on the same schema. Acceptable belt-and-braces given the v3.4.0 schema-versioning architecture (architect Decision A).
- `tools/storage.ts` + `tools/storage-sqlite.ts` — `writeState` trailing-optional `reviewRound?` preserves positional callers (CHANGELOG `### Breaking` correctly flags this as soft-breaking for named-arg consumers). SQLite UPSERT statement widens param tuple by one slot; the row reader at `storage-sqlite.ts:340-360` parses it with the same defensive normalisation as qa_round.

## Quality

- `tools/evidence-file.ts:56-102` — code-review evidence pair (`recordCodeReviewInFile` + `hasCodeReviewEvidenceInFile`) is a faithful parallel of the qa pair above it. Same sanitisation regex (`[^A-Za-z0-9._-]` at line 64), same dir-create+append idempotency, same append-only round semantics. Naming is symmetric.
- `tools/storage-sqlite.ts:276-283` — `selectCodeReviewByTaskStmt` filters on `verdict = 'APPROVED'` to satisfy the "presence" check, matching the qa table's `status = 'PASS'` filter. Distinct table (per architect Decision C) is appropriate — reusing `reports` would have required filtering on a reviewer column for every qa PASS lookup.
- `tools/handoff.ts:201` — migration write-back propagates `state.review_round` through `writeHandoffState`. The fire-and-forget `.catch(() => {})` at line 203 is consistent with the existing prd_path / qa_round write-back pattern. ✓
- `prompts/code-reviewer.ts:5-10` — thin builder delegating to `buildPromptForRole`, matching the `qa-engineer.ts` shape exactly. ✓
- `content/skill-code-reviewer.md` — all six H2 schema sections present (`Summary`, `Correctness`, `Quality`, `Architecture`, `Security`, `Verdict`), `Persona` / `Output rule` / `Hard rules` / `Artifact` / `SOP` / `Notes` cover AC-6.
- Minor noise (not blocking): `readHandoffState` calls `readAndMigrate` on every read. If the async migration write-back at `handoff.ts:198-204` is in flight and a second read lands before disk rewrite completes, the stderr warning re-fires in-process. Real-world impact: 1–2 extra warning lines per pre-migration handoff. The CHANGELOG copy implies "one-shot stderr warning on first parse" — pedantically this is "one-shot per still-v1 read." Either tighten by gating on a process-level Set, or relax the CHANGELOG wording. Non-blocking.
- Minor noise (not blocking): fresh v3.9.0 SQLite DBs likely seed `schema_meta(sqlite, 1)` at boot (per the existing v3.4.0 framework) and immediately run the v1→v2 step. Both ALTER and CREATE TABLE are guarded for idempotency, so the only cost is one extra PRAGMA + two no-op statements per fresh boot. Could be optimised by seeding at `CURRENT_VERSIONS.sqlite` directly. Non-blocking.

## Architecture

- Conformance to `specs/code-reviewer-role-extraction-architecture.md` is high. Spot-check:
  - **Decision A (inline v1→v2 registration)**: implemented inline in `schema/migrations-handoff.ts:17-27`; no new `migrations-handoff-v1-v2.ts` file. ✓
  - **Decision B (per-task evidence granularity via `completed_tasks` overload)**: documented in skill `Notes` and implemented via the gate's `parsed.completed_tasks` iteration at `index.ts:657`. ✓
  - **Decision C (separate `code_review_reports` table)**: present at `tools/storage-sqlite.ts:91-101`, with the AC-mandated `verdict` CHECK constraint. ✓
  - **Decision D (no SessionStart hook code change)**: `bin/agent-governance-context.mjs` is correctly NOT in the diff. T65 collapses to the verification step the architecture predicted — the hook embeds `handoff.md` verbatim, so `review_round` flows once `writeHandoffState` emits it. ✓
- `AgentName` union ordering matches AC-1: `"code-reviewer"` sits between `"sr-engineer"` and `"qa-engineer"`, mirroring the routing chain reading order.
- The decision NOT to extend the `requireQaEngineer` guard for code-reviewer (AC-4) is honoured — PASS remains qa-exclusive; code-reviewer approval is expressed via a state transition + evidence file. No code-reviewer:PASS row was added (matrix verified).
- Constitution §4 chain diagram update at `content/constitution.md:48-58` uses the existing ASCII arrow vocabulary (`↑__________|`) for the qa loop rather than the spec's `↻` glyph. Cosmetic — semantically equivalent and consistent with the file's prior conventions.

## Security

- New filesystem write surface: `review_reports/review_<task-id>.md`. Sanitisation regex `[^A-Za-z0-9._-]` at `tools/evidence-file.ts:64` is identical to the qa path's regex — task ids containing `..`, `/`, `\`, NUL, spaces, etc. are neutralised to `_`. No path-traversal vector introduced.
- New SQLite write surface: `code_review_reports` table. All inserts via prepared statement (`insertCodeReviewStmt` at `tools/storage-sqlite.ts:276-279`) with positional parameters — no string interpolation. Verdict column constrained by SQL CHECK to the literal pair. ✓
- No hardcoded secrets, no new external boundaries, no new `eval`/dynamic require. Stderr warning emits a fixed string with no user input interpolation.
- The migration warning is *informational*, not a leak vector — it discloses only the literal tuple `(sr-engineer, In_Progress)` which is already trivially observable to anyone reading the handoff file.

## Verdict

**APPROVED.** The diff implements every applicable acceptance criterion (AC-1 through AC-11; AC-12 is qa-scope) per the architecture spec. Counter semantics, transition matrix, evidence gating, migration warning, and skill-set updates are coherent and conservative.

Two non-blocking notes for downstream attention (NOT review FAIL grounds):
1. **Spec inconsistency owned by PM, surfaced for T67**: AC-12 mandates "pre-existing test count (269 green at v3.8.3) MUST stay green; new tests are additive," but AC-2 *necessarily* breaks tests that assert the `sr-engineer:In_Progress → qa-engineer:In_Progress` edge or the old single-return `computeNewRound` signature. Sr-engineer correctly avoided touching `test/` (constitution §2 reserves test authorship to qa-engineer). T67's scope is therefore slightly broader than "additive" — qa-engineer must *revise* the obsoleted contract tests rather than purely append. Recommend PM acknowledge this in a one-line spec amendment; mechanically the implementation is correct.
2. **Cosmetic robustness**: the v1→v2 stderr migration warning may emit more than once in a single process if multiple reads race the async write-back. Tightening would require a process-level `Set<workspacePath>` cache. Optional polish.

Rationale: The change set is internally consistent, fully traceable to the architecture spec, schema-versioned cleanly, and preserves every constitutional invariant (PASS stays qa-exclusive; tw_complete_task stays qa-exclusive; lite mode untouched). Approved for qa-engineer hand-off.
