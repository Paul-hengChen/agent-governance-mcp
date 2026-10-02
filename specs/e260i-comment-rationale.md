# e260i comment rationale

Rationale moved out of long comment blocks in `test/context-budget.test.mjs` and `test/render-structure.test.mjs` by lane e260i of ticket E260 (spec: `specs/e260i-budget-render-comment-trim.md`). A trimmed comment keeps at most one pointer line, for example `// Rationale: specs/e260i-comment-rationale.md (test/context-budget.test.mjs).`, and the text it points to lives in the section named after its test file below.

Rationale that a tracked spec already holds is not copied here; the comment points to that spec instead. Only comments moved: no assertion, test name, assertion message, string or budget number changed.

## Retained blocks

Blocks of 8 to 20 counted lines that stay in the tests, each with a one-line reason (acceptance criterion AC5). The code-reviewer copies each reason into the review report of the task that owns the file. `line at HEAD` is the block's first physical line as printed by `node .current/e260i/proof.mjs --list-mid`; `counted` is the size `analyzeText` reports.

| file | line at HEAD | counted | reason |
|---|---|---|---|
| — | — | — | none yet: filled in as trim tasks land |

## test/context-budget.test.mjs

(Filled in by the trim tasks T-E260I-03 to T-E260I-09.)

## test/render-structure.test.mjs

(Filled in by the trim tasks T-E260I-09 and T-E260I-10.)
