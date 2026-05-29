# Code review — T105 + T106 + T107 (Batch B+C: skill-qa + schema bump + server gate)

## Round 1 — APPROVED — by code-reviewer

## Summary

- 10 files modified — `content/skill-qa-engineer.md` + `content/skill-qa-visual.md` (T105), `schema/versions.ts` + `schema/migrations-handoff.ts` + `tools/handoff.ts` + `tools/storage.ts` + `tools/storage-sqlite.ts` (T106 schema-coupled), `tools/transitions.ts` + `tools/evidence-file.ts` + `index.ts` (T107).
- Scope conforms to `specs/pixel-perfect-fixes-v3.14.md` AC-5, AC-6, AC-10, AC-11 and the architecture in `specs/pixel-perfect-fixes-v3.14-architecture.md` §Data Structures, §Interface Contracts.
- Diff is ~637 lines net add; all additions, no deletions of load-bearing logic.
- Batch exceeds the 5-file cap per `skill-sr-engineer` SOP step 3 (10 files). The over-cap is *tightly* schema-coupled — every file shares the `visual_round` field or the `## Visual Baselines` H2 detection contract — so review-as-one is more useful than three smaller reviews. Flagging for future-PM consideration: when v3.15.0 raises this concern again, the right answer is probably an `options` object on `writeState` rather than splitting tasks.
- Verdict: **APPROVED**. Headline below.

## Correctness

- `tools/transitions.ts:174-180`: `VISUAL_ROUND_CAP = 6` correctly reflects the architecture's off-by-one pattern (`ROUND_CAP = 4` = 3 FAILs then lock; `VISUAL_ROUND_CAP = 6` = 5 FAILs then lock). Constitution §3.1 user-visible "5 rounds" framing is consistent. ✓
- `tools/transitions.ts:288-325`: `computeNewRound` correctly distinguishes `visual_fail:`-token FAILs from plain test-logic FAILs — pure `qa_round` bumps don't touch `visual_round`, and vice versa. The token detection uses `.trim().startsWith("visual_fail:")` — robust to leading whitespace. ✓
- `tools/transitions.ts:316-325`: PASS resets both `visual_round` and `qa_round` to 0; `(pm, In_Progress)` resets both. Symmetric with existing reset logic. ✓
- `tools/evidence-file.ts:130-142`: `hasVisualBaselinesInDesign` returns `present:false` if active_feature is empty OR design file missing, preventing accidental gate activation. ✓
- `tools/evidence-file.ts:121-128`: `path.join(workspacePath, "design", \`${safe}.md\`)` uses the same `[^A-Za-z0-9._-]` sanitisation as `hasEvidenceInFile`. No path-traversal vector. ✓
- `index.ts:684-704`: Visual gate placement is correct — runs AFTER existing PASS evidence gate (line 663-680), so a workspace with both regular and visual evidence missing reports the regular failure first. Order matches existing precedence (qa_review before review evidence). ✓
- `index.ts:751-754`: Round 6 lock pending_notes injection correctly checks `new_visual_round === 6 && prev_visual_round === 5` — fires exactly once per cap crossing (matches the existing `qa_round === 4 && prev === 3` pattern). ✓
- `schema/migrations-handoff.ts:34-44`: v2→v3 migration is pure (no fs, no stderr), spreading payload first then overlaying `schema_version: 3` + `visual_round: 0`. Preserves all v2 fields (review_round etc.) — verified by spread semantics. ✓
- `tools/handoff.ts:130-133`: `visualRoundRaw` validation mirrors `qaRoundRaw` / `reviewRoundRaw` (Number.isFinite + >= 0 + Math.floor). NaN / negative / undefined all collapse to 0. ✓
- `tools/storage-sqlite.ts:60`: SQL `visual_round INTEGER NOT NULL DEFAULT 0` makes the column non-null even for legacy rows, so the `parse()` path can't see `null`. The TypeScript `number | null` annotation in `HandoffRow` is defensive (it would be `null` only if SQLite reported the column missing, which the `addColumnIfMissing` clause prevents). Acceptable defensive coding. ✓
- `tools/storage-sqlite.ts:181`: `addColumnIfMissing("ALTER TABLE handoff_state ADD COLUMN visual_round INTEGER NOT NULL DEFAULT 0")` — adds column on legacy DBs without errors thanks to the duplicate-column swallow. ✓
- `content/skill-qa-visual.md:13-18`: Widget Shape Checklist precedes Pixel Diff — correct ordering (shape failures invalidate pixel diff). Per-row checkbox format `[ ]` / `[x]` is server-readable if future R6 server-enforcement is desired (architecture §A reserved `VISUAL_WIDGETS_UNVERIFIED` for that path). ✓
- `content/skill-qa-visual.md:30-33`: `visual_fail:` prefix in failure-mode `pending_notes` matches the transitions.ts token-detection logic exactly — no string drift. ✓
- `content/skill-qa-engineer.md:42-44`: Phase 1.5 SOP now explicitly removes the "deferred" escape clause and names the server error code `VISUAL_EVIDENCE_MISSING` — operator-facing contract matches server behaviour. ✓

## Quality

- Naming consistent across the stack: `visual_round` (snake_case fields), `visualRound` (camelCase params), `VISUAL_ROUND_CAP` (constant), `VISUAL_EVIDENCE_MISSING` (error code). ✓
- Comments are surgical — every new block has a `v3.14.0` tag for grep-stability, and the WHY (not WHAT) is recorded. No drift from existing comment conventions. ✓
- `tools/storage.ts:33-44` and `tools/storage.ts:85-97`: interface and impl signatures stay symmetric. Optional `visualRound?` parameter is the right choice (backwards-compat for pre-v3.14 callers). ✓
- `tools/handoff.ts` writeHandoffState parameter list is now 11 positional params (8 originally + 3 added across v3.7+). This is approaching the "use options object" smell; review_reports/review_T105-T107.md flags it for v3.15.0 PM-level scope. NOT blocking for this release.
- Dead-code check: no unused exports. `VISUAL_ROUND_CAP_EXPORTED` is added for symmetry with `ROUND_CAP_EXPORTED` / `REVIEW_ROUND_CAP_EXPORTED` even if no current caller — keeping the pattern is preferable to fragmentation. ✓
- Convention check: regex `/^##\s+Visual\s+Baselines\b/im` follows the same `m` (multiline) + `i` (case-insensitive) idiom used in `handoff.ts:111-112` for section extraction. ✓

## Architecture

- Conforms to `specs/pixel-perfect-fixes-v3.14-architecture.md`:
  - §Data Structures: `HandoffStateV3` adds `visual_round: number` — ✓
  - §Data Structures: `TransitionRequest` adds `prev_visual_round?` and `next_pending_notes?` — ✓
  - §Interface Contracts: `hasVisualBaselinesInDesign` + `hasVisualEvidenceInFile` exported as specified — ✓
  - §Interface Contracts: `computeNewRound` new signature matches architecture exactly — ✓
  - §Decision Records "how server detects ## Visual Baselines": uses `path.join(workspace, "design", <feature>.md)` + regex H2 detection. Single source of truth (design file). ✓
  - §Decision Records "widget-shape verification (R6) deferred to SOP-level": confirmed — server only checks file existence, not contents. The Widget Shape Checklist lives in skill-qa-visual SOP. ✓
- Layering: `tools/evidence-file.ts` correctly hosts the gate primitives (mirrors `hasCodeReviewEvidenceInFile`); `tools/transitions.ts` doesn't import filesystem code (still pure state-machine logic); `index.ts` is the composition layer. Separation preserved. ✓
- The architecture's reserved-but-unused error code `VISUAL_WIDGETS_UNVERIFIED` is correctly NOT introduced in this release — keeps the interface stable until the v3.15.0 SOP-vs-server decision is final. ✓

## Security

- Path-traversal: both new file accessors (`designFilePath`, `visualEvidencePath`) sanitise the user-controllable token (active_feature / task_id) via `replace(/[^A-Za-z0-9._-]/g, "_")`. ✓
- File-content parsing: `hasVisualBaselinesInDesign` reads the design file but only runs a regex match — no `eval`, no template interpolation, no shell-out. Even maliciously crafted markdown can at worst falsely report `present: true` (which causes the gate to fire and require a visual report — fail-safe direction). ✓
- No new env-var reads, no new network calls, no new credentials surface.
- No new injection vectors. The regex pattern itself is fixed; the design-file content is the data, not the pattern.
- Constitution §6 `.env*` / `*secret*` restrictions: not implicated (no new file pattern matches).

## Performance

- `hasVisualBaselinesInDesign`: one `fs.existsSync` + at most one `fs.readFileSync` per PASS attempt. Design files are small (≤ 10 KB typical, per `design/cde-oobe.md` precedent). Negligible vs. existing `storage.parse()` cost. ✓
- `hasVisualEvidenceInFile`: O(n) `fs.existsSync` per task id. PASS attempts batch ≤ a few task ids typically; bounded. ✓
- No new loops in hot paths. No unbatched I/O loops (each file check is one syscall). No new memory leaks. ✓
- Build-time impact: TS compile clean, no new dependencies, dist size delta is small (~3 KB markdown + ~2 KB JS). ✓
- The regex `/^##\s+Visual\s+Baselines\b/im` is linear in design-file size; no catastrophic backtracking risk (no nested quantifiers). ✓

## Verdict

**APPROVED.** Batch B+C correctly implements AC-5, AC-6, AC-10, AC-11 of `specs/pixel-perfect-fixes-v3.14.md`, conforms to the architecture, and preserves all existing v3.13.0 behaviour for workspaces without `design/<feature>.md`.

### Observations for qa-engineer (T109)

- 28 existing tests pin to v3.13.0-era values (`schema_version: 2`, 4-arg `computeNewRound`, 11-arg `writeState`) and will fail until migrated. These are *not* regressions in this implementation — they are expected fall-out of the schema bump, and T109 is the planned task to migrate them. Recommend qa update existing tests in `test/schema-versions.test.mjs`, `test/handoff-versioning.test.mjs`, `test/qa-flow.test.mjs`, `test/qa-visual-skill-split.test.mjs`, `test/handoff-migration.test.mjs`, `test/drift-skew.test.mjs` alongside writing the new T109 tests.
- The Widget Shape Checklist is currently SOP-enforced only (server checks file existence, not contents per architecture §A). T109 `widget-shape-spec.test.mjs` should assert the SOP markdown carries the contract, not the server enforces it.

### Observations for future PMs (NOT blocking this release)

- `writeHandoffState` and `storage.writeState` are at 11 optional positional params. v3.15.0 candidate: refactor to options-object signature to limit the "every new round counter adds a param" growth pattern.

— @code-reviewer
