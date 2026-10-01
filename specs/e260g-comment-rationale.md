# e260g comment rationale

Rationale moved out of long comment blocks in 28 test files (`test/e3*` to `test/e9*`, `test/error-*`, `test/eval-*`, `test/evidence-*`, `test/{f,g,h,i,j,k,l}*.test.mjs`) by lane e260g of ticket E260 (spec: `specs/e260g-test-e3-l-comment-trim.md`). A trimmed comment keeps at most one pointer line, for example `// Rationale: specs/e260g-comment-rationale.md (test/<file>).`

Rationale that a tracked spec already holds is not copied here; the comment points to that spec instead.

## Retained blocks

Blocks of 8 to 20 counted lines that stay in the code, each with a one-line reason (acceptance criterion AC5). The code-reviewer copies each reason into the review report of the task that owns the file. `line at HEAD` is the block's first physical line as printed by `node .current/e260g/proof.mjs --list-mid`.

| file | line at HEAD | counted | reason |
|---|---|---|---|
| — | — | — | none yet: filled in as tasks land |
