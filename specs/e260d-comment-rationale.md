# e260d comment rationale

Rationale moved out of long comment blocks in `gates/`, `prompts/`, `schema/`, `lib/`, `guards/`, `transport/` and `index.ts` by lane e260d of ticket E260 (spec: `specs/e260d-core-dirs-comment-trim.md`). A trimmed comment keeps at most one pointer line, for example `// Rationale: specs/e260d-comment-rationale.md (gates/feature-lease.ts).`, and the text it points to lives in the section named after its source file below.

Rationale that a tracked spec already holds is not copied here; the comment points to that spec instead.

## Retained blocks

Blocks of 8 to 20 counted lines that stay in the code, each with a one-line reason (acceptance criterion AC5). The code-reviewer copies each reason into the review report of the task that owns the file. `line at HEAD` is the block's first physical line as printed by `node .current/e260d/proof.mjs --list-mid`; `counted` is the size `analyzeText` reports.

| file | line at HEAD | counted | reason |
|---|---|---|---|
| — | — | — | none yet; tasks T-E260D-02 to T-E260D-07 add rows |
