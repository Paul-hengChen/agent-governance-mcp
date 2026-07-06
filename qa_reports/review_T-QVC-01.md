# QA Review — T-QVC-01 — `content/skill-qa-visual.md` consolidation rewrite

> Reviewer: @qa-engineer (sonnet) · 2026-07-06 · independent verification (not trusting `review_reports/review_T-QVC-01.md`'s own claims — re-derived against parser source and compiled `dist/` myself)

## Verdict: PASS

## What I verified independently

- **AC-1 (build/test green, content-only diff):** Ran `npm run build && npm test` myself — 811/811 green pre-my-change, 812/812 green after I added one regression test (see Phase 3 below). `git diff --stat HEAD -- tools/ index.ts schema/ guards/` produced zero output — confirmed no server-code touched. Working tree changes limited to `content/skill-qa-visual.md` + chain artifacts (`.current/handoff.md`, `docs/backlog.md`, `tasks.md`).
- **AC-2 / S21 (sole-mention error codes retained):** Wrote a scratch Node script (not reused from the reviewer) that `grep`-equivalent-checks all 8 codes (`VISUAL_EVIDENCE_MISSING`, `VISUAL_WIDGETS_UNVERIFIED`, `VISUAL_PROVENANCE_MISSING`, `PIXEL_GATE_ATTESTATION_MISSING`, `BASELINE_MANIFEST_MISSING`, `BASELINE_PROVENANCE_INCOMPLETE`, `VISUAL_ROUND_EXCEEDED`, `VISUAL_REPORT_INCOMPLETE`) are still backtick-quoted in the rewritten file. All 8 present. `test/error-code-contract.test.mjs` (doc↔code mutual-subset, generic across all `content/*.md`) passed in the full run.
- **AC-3 (S01–S21 verbatim survival) — spot-checked myself, did not just trust the review:**
  - Pulled `CARRY_FORWARD_TOKEN` and `B1_UNAVAILABLE_TOKEN` literal string constants directly out of `tools/evidence-file.ts:602-603`, then ran `content.includes(TOKEN)` against the actual rewritten file via a scratch script importing nothing from the review's own tooling. Both present, byte-exact. Verified the em-dash codepoint (`—`.codePointAt(...) === 0x2014`) explicitly rather than eyeballing it.
  - Verified S18's full negation-token list (`not/fail/failed/blocked/blocking/changes requested/incomplete/pending`) is present in the new file.
  - Verified S17 REJECTED-placeholder lists (fingerprint set + diff-metric set, including `dimensionsMatch=false` human form) are reproduced and framed as invalid, not as valid examples (line 53-54).
  - Verified S19 (`visual_fail:` prefix) against `tools/transitions.ts:408` and S20 (`VISUAL_ROUND_CAP = 6`) against `tools/transitions.ts:226` — both concepts correctly documented in the new file's error table.
- **AC-4 / AC-5 (exactly one exemption matrix, exactly one error-code table):** Confirmed via heading scan (`grep '^### \|^## '`) — exactly one "Provenance matrix" H3 (lines 42-55) and exactly one "Error codes & STOP routes" H3 (lines 73-91); the two tables inside the AC-7 example are report-template tables, not duplicates of these.
- **AC-6 (step order preserved):** Heading scan confirms sequence Step A.0 → A → A.5 → B (B0/B1/B2 inline) → provenance matrix → C → Allowed Differences → per-widget isolation → PASS sub-verdict → error codes → example — matches the spec's required behavioral sequence with no reordering/merging that loses a decision point.
- **AC-7 (worked example passes compiled parsers) — ran it myself, not reused from the review:** Extracted the fenced ` ```markdown ` example from the new file with a scratch script, wrote it to `qa_reports/visual_T42.md` under a throwaway workspace dir, and called `validateVisualReport`, `checkVisualProvenance`, `checkPixelGateAttestation` from freshly-rebuilt `dist/tools/evidence-file.js`. Results: `{ok:true, missingSections:[], ...verdictPass:true}`, `{ok:true, offendingByTaskId:{}}`, `{ok:true, offendingByTaskId:{}}` — all three green, matching the review's claim independently.
- **AC-8 (line count):** `wc -l content/skill-qa-visual.md` → 124 lines, inside the 110–145 soft target.
- **Content-only scope:** Confirmed via `git diff --stat` above; also confirmed no changes to `design/`, no design-mode arming for this feature (spec's Visual Tokens/Visual Widgets/Visual Structural Assertions sections are explicitly N/A — this is a non-design, server-behavior-only feature). Copy/Visual audit gates and Phase 1.5 visual-baseline comparison do not apply here — logged as **skipped (N/A, non-design feature)**.

## Phase 3 — test coverage mapping

Existing suites already pin this file's contract at multiple layers and all stayed green with zero modification needed for behavior coverage:

| Layer | Test file | What it pins |
|---|---|---|
| Skill-text structural contract (headings, failure routes, `visual_fail:` tokens, PASS sub-verdict) | `test/qa-visual-skill-split.test.mjs` | AC-1/AC-6 combined-surface assertions, Step A.0 baseline-manifest verbatim-copy requirement |
| Skill-text structural contract (legacy v3.8.2/v3.14.0 invariants) | `test/pixel-perfect-visual-compare.test.mjs` | 6-category diff enumeration, 4 failure routes, backwards-compat ordering |
| Doc↔code error-code mutual subset (generic, all `content/*.md`) | `test/error-code-contract.test.mjs` | AC-2/S21 — every doc-mentioned gate code exists in code and vice versa |
| Server parser correctness (constants, not doc text) | `test/evidence-provenance.test.mjs`, `test/pixel-gate-attestation.test.mjs` | `CARRY_FORWARD_TOKEN`/`B1_UNAVAILABLE_TOKEN`/placeholder-set behavior against `tools/evidence-file.ts` directly |
| Context budget | `test/context-budget.test.mjs` | Confirms the file is still reachable/loadable within budget after the line-count drop |

**Gap found and closed:** none of the above pin the two most fragile verbatim literals (S15 `pass (carried forward — git diff confirms source untouched)` and S16 `B1 tool unavailable — LLM fallback`) against the **skill doc text itself** — only against the server-side string constants. An em-dash→hyphen paraphrase in a future doc edit (visually indistinguishable in most fonts, exactly the failure class AC-3 exists to prevent) would pass every existing test yet silently break agent-authored reports that copy the doc's prose literally. Added one test to the existing `test/qa-visual-skill-split.test.mjs` (no new file):

- `"AC-3 (qa-visual-consolidation S15/S16): carry-forward and B1-fallback annotation tokens are byte-exact (em-dash, not hyphen)"` — asserts `body.includes(...)` for both exact strings, including the U+2014 em-dash.

No new test file was created (per SOP instruction to ask first) — the gap was small enough to close with one assertion in an existing, topically-matching file.

## Full suite result

`npm run build && npm test` → **812/812 passing, 0 failures** (811 pre-existing + 1 new regression assertion added above).
## 2026-07-06T05:46:15.523Z — PASS — by qa-engineer

T-QVC-01 PASS: independent AC-by-AC verification of content/skill-qa-visual.md 265→124-line consolidation. Re-derived S15/S16 em-dash tokens, S17/S18 lists, S19-S21 codes directly from tools/evidence-file.ts and tools/transitions.ts (not trusting the code-reviewer's manifest). AC-7 example independently re-run against freshly-built dist/tools/evidence-file.js: validateVisualReport/checkVisualProvenance/checkPixelGateAttestation all ok:true. git diff confirms zero changes under tools/, index.ts, schema/, guards/ (content-only, AC-1). Exactly one exemption matrix (AC-4) and one error-code table (AC-5); step order preserved (AC-6); 124 lines within soft 110-145 target (AC-8). Non-design feature: Copy/Visual audit gates and Phase 1.5 visual-compare are N/A, logged skipped. Phase 3: found one real coverage gap (S15/S16 em-dash tokens pinned only against server constants, not doc text) and closed it with one new assertion added to existing test/qa-visual-skill-split.test.mjs (no new file). npm run build && npm test: 812/812 green, 0 failures. Full report: qa_reports/review_T-QVC-01.md.

