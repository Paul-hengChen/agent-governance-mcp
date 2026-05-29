# Code review — T300 + T301 + T302 + T303 + T304 (v3.15.0 implementation batch)

## Round 1 — APPROVED — by code-reviewer

## Summary

- Six files changed (bundled per architect's task graph): `tools/transitions.ts` (T300 union extension), `tools/evidence-file.ts` (T301 parser + composition helper), `index.ts` (T302 gate wiring + T304 sentinel symmetry + T303 call-site update), `tools/handoff.ts` (T303 dual API), `tools/storage.ts` (T303 interface), `tools/storage-sqlite.ts` (T303 implementation).
- Diff is ~506 lines net add; all changes conform to `specs/v3.15.0-architecture.md` Affected Files + Interface Contracts.
- Build clean (`tsc` zero errors); existing 371/371 tests still pass (no regression).
- Verdict: APPROVED.

## Correctness

- `tools/transitions.ts:47-51`: `VISUAL_WIDGETS_UNVERIFIED` added to `TransitionRejection.error` union with a comment clarifying that `validateTransition` does NOT produce it (handler-side emission only). Architecture decision honoured. ✓
- `tools/evidence-file.ts:188-203` `parseVisualWidgetsChecklist`: section detection uses `headRe.exec()` + manual slice to next `\n## ` — the workaround for JS regex lacking `\Z`. Matches the existing pattern in `tools/handoff.ts:111-112` (extractSectionContent). ✓
- `tools/evidence-file.ts:208-219` checkbox parsing: `[x]` / `[X]` → checked; everything else (`[ ]`, `[Y]`, `[garbage]`) → unchecked. Matches AC-5 ("permissive on whitespace, case-sensitive on bracket content"). ✓
- `tools/evidence-file.ts:215`: widget-id separator split on em-dash OR ASCII hyphen with whitespace, both with explicit `\s+` around to avoid clobbering hyphens within the widget id itself. Edge case (widget id containing em-dash) is documented in architecture Decision Records as acceptable trade-off. ✓
- `tools/evidence-file.ts:236-263` `hasUncheckedWidgets`: per-task iteration; missing-file skip is defensive (handler calls `hasVisualEvidenceInFile` first). Unchecked rows are extracted via `filter` + `map`. `ok` derived from `Object.keys(uncheckedByTaskId).length === 0`. ✓
- `index.ts:730-755`: R6 gate placement is AFTER `VISUAL_EVIDENCE_MISSING` per architecture sequence diagram. Listing format `taskId: [w1, w2]; taskId2: [w3]` makes the operator-actionable list scannable. ✓
- `index.ts:795-805`: Round 4 sentinel predicates updated to `new >= 4 && prev < 4` for both `qa_round` and `review_round`. Symmetric with v3.14.1's visual_round Round 6 fix. Edge cases verified mentally:
  - prev=3 → new=4: fires ✓
  - prev=2 → new=4 (migration): fires ✓
  - prev=4 → new=5: does NOT fire ✓
  - prev=0 → new=0: does NOT fire ✓
- `index.ts:817-829`: `storage.writeState` call site converted to options-object form. Field names match `WriteHandoffStateOptions` interface verbatim — no silent drift. ✓
- `tools/handoff.ts:265-296`: dual API overload signatures (options-object first, then `@deprecated` positional, then a wider implementation signature accepting both). The JSDoc `@deprecated` on the positional signature matches the spec's `jsdoc.writestate.deprecated` copy entry verbatim. ✓
- `tools/handoff.ts:323-360`: implementation discriminates by `typeof workspacePathOrOpts === "object" && !Array.isArray(...)`. Both branches populate the same local variables; downstream logic unchanged. ✓
- `tools/storage.ts:30-58` and `tools/storage-sqlite.ts:396-447`: HandoffStorage interface gains both overload signatures; both implementations support both calling conventions. `FileHandoffStorage.writeState` delegates to `writeHandoffState`, preserving DRY. ✓

## Quality

- Comments throughout cite `v3.15.0` consistently for grep stability.
- The `_activeFeature` / `_status` non-null assertion locals in `tools/handoff.ts:357-359` are a TypeScript narrowing workaround (overload signatures widen the implementation signature). Comment explains the intent. Acceptable; alternative refactor (Zod parse the union upfront) would expand the diff without observable benefit.
- The `as string` cast in `tools/storage.ts:133` and `tools/storage-sqlite.ts:425` is the same pattern — needed because TS infers `string | (WriteHandoffStateOptions & any[])` in the else branch. Tight, scoped, well-comment-explained.
- Convention consistency: parser uses the same `replace` / `match` / `search` idiom as existing `extractSectionContent`. Helper function naming follows the `has<Thing>InFile` / `parse<Thing>` convention.
- No dead code. No new dependencies. No new exports beyond what the architecture spec mandated.

## Architecture

- All architecture spec decisions implemented:
  - Parser lives in `tools/evidence-file.ts` co-located with the visual-gate primitives ✓
  - Overload detection via runtime first-arg type check ✓
  - R6 gate hook placement: AFTER `VISUAL_EVIDENCE_MISSING` ✓
  - Widget-id separator split: em-dash OR ASCII hyphen with whitespace ✓
  - Unrecognised bracket content (`[Y]`, `[garbage]`) → unchecked ✓
  - Missing `## Widget Shape Verification` section → accept (backwards-compat) ✓
  - Positional signature removal target: v4.0.0 ✓
  - Sentinel symmetric `>= && <` for both qa_round / review_round ✓
- No architecture deviation. Sequence diagram in the spec maps 1:1 to the runtime code path.

## Security

- R6 gate adds a new file-read (`hasUncheckedWidgets` → `fs.readFileSync` on `qa_reports/visual_<id>.md`) on every PASS attempt with `## Visual Baselines` present. Path is the same sanitised `visualEvidencePath` introduced in v3.14.0 (and hardened in v3.14.1 against `..` literals). No new traversal surface. ✓
- Parser operates on already-trusted file content (qa-engineer is the role authorised to write `qa_reports/`). No content reaches `eval` / `Function()` / shell. Regex bounded — no nested quantifiers, no catastrophic backtracking risk. ✓
- Dual API does NOT introduce new attack surface. Options-object accepts the same fields as positional; the runtime defaults are identical. ✓
- Error messages name files / task ids / widget ids. None of these are credential-bearing. ✓

## Performance

- Parser is O(n) on report content with two passes (heading locate + line matches). Reports are typically < 5 KB; cost negligible per PASS. ✓
- `hasUncheckedWidgets` performs O(k) sync file reads where k = `completed_tasks` length. Same complexity class as existing `hasEvidenceInFile`. ✓
- Dual API: runtime cost is one `typeof` check + one destructure in the options branch. < 10ns delta vs positional. ✓
- No new loops in hot paths. No unbatched I/O. No memory leaks. ✓
- Sentinel predicate change is identical CPU cost (one `>=` vs one `===`). ✓

## Verdict

**APPROVED.** All five tasks (T300-T304) implement the architecture-mandated contracts cleanly. Backwards-compat is preserved for v3.14.x callers (visual reports without `## Widget Shape Verification` section accept; positional `writeState` signature still works). The Round 4 sentinel symmetric fix is a quality-of-life improvement now that v3.14.1 paved the predicate pattern.

Recommend qa-engineer write the AC-1..AC-5 (T305), AC-6..AC-10 (T306), AC-11..AC-13 (T307) tests next.

— @code-reviewer
