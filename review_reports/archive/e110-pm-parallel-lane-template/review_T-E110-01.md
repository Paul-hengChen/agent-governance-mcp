# Review — T-E110-01

covers: T-E110-01, T-E110-02

## Round 1 — APPROVED — by code-reviewer

## Summary
- `content/skill-pm.md`: adds a `Parallel-Lane Cut` Gate Summary row (S0 seed → L1..Ln fan-out → J join, "never a general DAG", a per-AC `proof:` audit, and the `serial — shared layer` guardrail). SOP step 2's ordered sequence now lists it. The cut header gains `touches`, with a one-line definition under it.
- `content/coord-01-core-head.md`: the Split Table template gets a `touches` column after `scope`, a ninth separator cell, and `<paths>` in both placeholder rows. The split heuristics are unchanged.
- Scope: the diff vs `dea8544` touches only `content/skill-pm.md`, `content/coord-01-core-head.md`, `tasks.md`, `NEW-TICKETS.md` and `.current/**` (plus the untracked spec and the expected-red manifest). Nothing changed under `tools/`, `gates/`, `guards/`, `prompts/`, `bin/`, `schema/` or `dist/`, and a rebuild left `dist/` clean. AC8 holds.
- Verdict: APPROVED. Every AC1-AC5 literal is present, the wording is actionable, and the 6 reds match the expected-red manifest exactly.

## Correctness
AC proofs, run in `<lanes-root>/e110`:
- AC1: `grep -c 'Parallel-Lane Cut' content/skill-pm.md` prints 2 (step 2 at content/skill-pm.md:84 and the row at :104). The row names S0/L1..Ln/J with the required qualifiers and says "never a general DAG". The step-2 order matches the spec exactly. The marker-list half of the proof belongs to qa (T-E110-03).
- AC2: `Per-AC \`proof:\` audit` and `NOT the lane its subject suggests` each appear once, both outside the rationale fence. The rendered text (stripOriginTags → stripRationale) keeps them, and the `proof:` spanning two lanes → J rule is there.
- AC3: `serial — shared layer` is present with U+2014, outside the fence. The row states the no-parallelism-for-its-own-sake rule and both serial triggers (a shared file; S0 needing behaviour).
- AC4: the new 6-column header is present verbatim. `grep -c 'est. files | design-link\`'` prints 0. The definition line sits directly below the header, separated by a blank line.
- AC5: `| order | feature id | scope | touches | figma link |` is present. The separator has 9 cells and matches the 9-column header. Both placeholder rows have 9 cells. `tools/join-precondition.ts:115` resolves the column by header alias ("feature id"), so moving the column is safe.
- Expected-red sampling (step 4a): the manifest `qa_reports/expected-red_e110-pm-parallel-lane-template.txt` exists with 6 entries, and I located all 6: test/context-budget.test.mjs:686 and :1096, test/cut-approval-gate.test.mjs:607 (C3), test/skill-manifest.test.mjs `t-golden-byte-identity (AC1/AC5)`, and test/check-md-tables.test.mjs AC7 and CQ-9. A full `npm test` run gives `pass 2228 / fail 6`, and the 6 failures are exactly the manifest's entries. No unexplained reds.
- Old-header sweep (what the brief asked me to check): the only live consumers of the 5-column cut header are test/cut-approval-gate.test.mjs:615-616 (C3, in the manifest and covered by the AC8 amendment) and content/skill-coordinator-lite.md:21 (known issue, filed as L-CONTENT-NEW-1). The test/check-md-tables.test.mjs fixtures use the different backlog-shaped header (`id | desc | priority | ...`) and do not read skill-pm.md, so they are unaffected. The old Split-Table header survives only in the monolith golden (in the manifest, qa refresh) and in this lane's pre-existing `.current/feature-split.md`, which is parsed by header name and is harmless. `test/feature-scope-gate.test.mjs:74-77` only matches `/figma link/`, which is still present. Nothing else breaks.

## Quality
- Non-blocking, N1 (the `touches` definition has a gap): content/skill-pm.md:116 says "`touches` = the actual repo paths/globs the ticket writes". Read literally, that includes governance bookkeeping every lane writes: `tasks.md`, `NEW-TICKETS.md`, `qa_reports/**`, `review_reports/**`. A literal-minded PM would then find every pair of lanes overlapping and, under the guardrail, declare `serial — shared layer` for every cut. This repo's practice (this ticket's own `touches:` in tasks.md lists only `content/...`) shows the intended reading is product paths only. Suggested follow-up, about 8 tokens: "…the ticket writes (governance bookkeeping excluded); …". This does not block, because the AC4 literal is satisfied and the approved prototype text is preserved. Worth a NEW-TICKETS entry.
- Non-blocking, N2: the row says to record lanes in `.current/feature-split.md`, but that template's `order` column and "build order 0 first → re-invoke per row in `order`" text imply serial rows. The row does not say how to encode that L1..Ln share one stage (for example, the same `order` value). The spec puts `order` semantics out of scope, so this is only noted. A PM will probably work out "same order = parallel", but it is not stated.
- Naming and structure match the neighbouring Split Gate rows. The rationale is fenced and stripped, as the surrounding rows do. "behaviour" (British spelling) matches the spec literal.

## Architecture
No architecture spec exists (mini-chain, SOP prose only). The placement follows Decision #3's recommendation: the obligation lives in skill-pm.md, and coord-01 gets only the column, so the per-AC audit stays with the role that can run it. Recording lanes in `.current/feature-split.md` also clears the Scope Decision Gate via its existing option (a), which is consistent with that row's "if you split per the rows above" clause. The text restates no constitution rule and points at no constitution section. It is context-frugal: +248 ~tok on the PM render, +8 ~tok on the design-arm bundle, and nothing added to the always-on or lite bundles.

## Security
No findings. Prose only: no code, no trust boundary, no secrets.

## Performance
No findings. There is no runtime code change. The context cost is measured and bounded (skill-pm 4128→4376 ~tok, design-arm bundle 18982→18990 ~tok), and qa re-baselines both under T-E110-03.

## Verdict
APPROVED. T-E110-01 and T-E110-02 meet AC1-AC5 and AC8 byte-for-byte, and the only reds are the 6 already listed. N1 (the bookkeeping exclusion in `touches`) and N2 (how to encode `order` for parallel lanes) are non-blocking follow-ups.

Reviewer model: opus. The sr-engineer was pinned to fable, a different model, so there is no same-model bias concern.
