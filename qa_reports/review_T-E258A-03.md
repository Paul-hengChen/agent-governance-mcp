# QA review T-E258A-03 (test-only header trim)

- Scope: integration comment-check send-back (Constitution §6 Comment discipline).
- `test/e258a-comment-rule.test.mjs` header: old 16 lines -> new 3 lines (authorship line, spec pointer, one-line WHY). Stale Spec-to-Test map (named nonexistent tests) and 4-line WHY removed.
- `test/context-budget.test.mjs` (~line 1167): removed the comment line `// non-design floor below: 10057 − 7959 = 2098 ~tok, unchanged.` (repeats margin arithmetic near lines 2241-2243). Preceding comment line reworded to end at "(E258)." so it stays a complete sentence. No assertion or code changed.
- Phase 0.5: skipped (no expected-red manifest declared)
- Phase 1.5: skipped (no Visual Baselines declared)
- Phase 3.5: skipped (no proof:-annotated ACs for this task)
- Phase 3: comment-only edits; no test added or removed; count expected unchanged.
