# e260h comment rationale

Rationale moved out of long comment blocks in the `test/` files whose names start with m to z (`test/render-structure.test.mjs` excluded) and in the four `.mjs` files under `test/eval/`, by lane e260h of ticket E260 (spec: `specs/e260h-test-m-z-eval-comment-trim.md`). A trimmed comment keeps at most one pointer line, for example `// Rationale: specs/e260h-comment-rationale.md (test/verify-release.test.mjs).`, and the text it points to lives in the section named after its test file below.

Rationale that a tracked spec already holds is not copied here; the comment points to that spec instead. Only comments moved: no assertion, test name, assertion message or string changed.

## Retained blocks

Blocks of 8 to 20 counted lines that stay in the tests, each with a one-line reason (acceptance criterion AC5). The code-reviewer copies each reason into the review report of the task that owns the file. `line at HEAD` is the block's first physical line as printed by `node .current/e260h/proof.mjs --list-mid`; `counted` is the size `analyzeText` reports.

| file | line at HEAD | counted | reason |
|---|---|---|---|
| — | — | — | none yet: rows are added by the trim tasks |
