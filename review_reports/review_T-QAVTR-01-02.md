# Review — T-QAVTR-01 (B10) / T-QAVTR-02 (B11) — qa-visual-token-reduction

## Round 1 — APPROVED — by code-reviewer

## Summary

- Single-file SOP-prose change to `content/skill-qa-visual.md` (+74 lines): inserts **Step B0** (round-≥2 carry-forward gate), **Step B1** (deterministic CLI pixel-diff pre-screen), and renames the legacy LLM diff to **Step B2** (escalated surfaces only).
- Load-bearing whole-frame-pixel-% BAN sentence (line 49) is preserved verbatim and exactly once; neither B0 nor B1 opens a whole-frame PASS path.
- Carried-forward `pass` rows keep the result cell exactly `pass`; the carry-forward annotation lives in prose, so `parseRegionDiffFailures` continues to accept the row with zero server-code change.
- Verdict: **APPROVED**. All 11 ACs + AC-INV-1 satisfied. One acknowledged, out-of-scope follow-up (byte-cap test) is qa-engineer-owned — see Quality.

## Correctness

- **AC-INV-1 / AC-B11-4 (whole-frame ban survives) — PASS.** `grep -c` returns exactly 1 occurrence of the verbatim ban sentence; it sits at line 49, outside every diff hunk (the first hunk starts on the line after the ban paragraph). The new B-stage intro and B1 both explicitly re-state "compare region, NOT the full frame," and B1 hard-crops both images to the `compare region` (`magick <img> -crop <WxH+X+Y>`) before the deterministic metric runs — so a tool run cannot silently become a full-frame PASS metric. `content/skill-qa-visual.md:49-51, 67-72, 79-82`.
- **AC-B10-5 / AC-B10-4 (parser compatibility) — PASS.** Read `tools/evidence-file.ts:426-443`. `parseRegionDiffFailures` takes the LAST cell of each `|`-prefixed row, lowercases it, and fails the row unless it is exactly `pass` or `accepted`. The SOP forces the result cell to stay exactly `pass` (`content/skill-qa-visual.md:60-63`: "the parsed result **cell** stays exactly `pass` ... annotations never go in the result cell, or the server parser stops seeing the row") and repeats the constraint in the B2 trailer (`:118-121`). The verbatim carry-forward label `pass (carried forward — git diff confirms source untouched)` is placed in the prose sub-section, which the parser never inspects. A carried-forward row therefore parses to a non-failure. Verified, not taken on trust.
- **Carried-forward `fail` cannot slip through — PASS.** B0 step (a) (`:62-65`) forces ALWAYS-re-diff for any surface whose prior result was `fail`, `accepted`, or was recaptured; only a prior-`pass` surface is eligible for carry-forward (step b). So a regressed/failing surface is never written as a carried `pass`; the worst case is an unnecessary re-diff, never a masked failure.
- **AC-B10-2 / B0 git-diff soundness (shared-file false-negative) — PASS.** The fallback wording is imperative and conservative: a diff touching "a shared/common file (shared component, global stylesheet, design token) that could affect the surface" → "**fall back to a full re-diff**," closing with "When in doubt, re-diff; carry-forward is only for a provably-untouched surface" (`:71-77`). The trigger is "could affect," not "definitely affects" — the safe direction. This forces re-diff on uncertainty rather than merely suggesting it. A transitive/shared-CSS change therefore lands in the re-diff path, not a wrongful carry-forward.
- **AC-B11-5 / AC-B11-6 (tool-unavailable fallback) — PASS.** B1 (`:95-97`): "**Tool unavailable** (binary absent, Bash not permitted, or crop/diff errors) → fall back to the Step B2 LLM path for that surface (treat it as escalated)." Degradation is to the full LLM read, never a silent skip or auto-pass. No wrapper script / npm dependency is introduced (`:79-82`: "invoke an already-installed CLI directly via Bash").
- **AC-B11-1/2/3 (tool-first gate, threshold escalation) — PASS.** B1 runs the CLI over the cropped region first; at/below per-baseline threshold → record `pass` without any image read (`:88-92`); above threshold → escalate to B2 with no verdict recorded yet (`:93`), where the original 6-category Read-both-images diff is preserved verbatim (`:111-114`).
- **AC-B10-1 / AC-B10-3 — PASS.** Round 1 / no prior `## Region Diff` table = explicit no-op (`:57-58`); from round ≥2 prior-`pass` + git-untouched carries forward without image reads (`:66-70`); non-pass/recaptured always re-diffed (`:62-65`).
- **Report completeness (AC-B10-4) — PASS.** "every `## Visual Baselines` surface has a row every round" (`:79-81`) and the B2 trailer requires every surface — B1-pre-screened or B2-judged — to appear in the single `## Region Diff` table (`:116-121`). Report stays self-contained.

## Quality

- Step renumbering is internally consistent: the B-stage intro, B0/B1/B2 headings, the Copy/Strings table in the spec, and the "## Why this is correct" trailer bullets all agree on B0/B1/B2 semantics.
- Copy strings match the spec verbatim: `#### Step B1 — Deterministic Pixel-Diff (tool-first gate)` and `#### Step B2 — LLM Region Diff (escalated surfaces only)` and the carry-forward label all match `specs/qa-visual-token-reduction.md:48-51`.
- **Noted (NOT a review FAIL — qa-engineer-owned, per task framing):** `test/qa-visual-skill-split.test.mjs:128` asserts `skill-qa-visual.md <= 9000` bytes; the file is now 14444B (`wc -c`), so `npm test` fails 1 assertion. The spec's Dependencies section (line 80) only inventoried `test/context-budget.test.mjs` and missed this cap. qa-visual is lazy-loaded (cost paid only when the visual gate arms), so this is the documented scoped-cost pattern and the fix is a one-line cap bump owned by qa-engineer/test files (§2). Per the review framing this does not gate APPROVED, but qa-engineer MUST bump the cap (or escalate to PM) before PASS.

## Architecture

- Pure SOP-prose change; the implementation deliberately requires **zero** server-code change, exactly as the spec's "Out of Scope" mandates (`specs/...:69-75`). The carry-forward design is reconciled against the real parser rather than against an assumed one — the result-cell-vs-prose split is the correct minimal seam.
- Three-stage gate (B0 skip → B1 deterministic pre-screen → B2 LLM) is correctly ordered cheapest-to-most-expensive; the multimodal Read is confined to B2 only (`:55-56`), which is the stated cost-reduction goal.

## Security

- No new external input surface, no injection vector, no secret. The only new execution is QA invoking an already-installed image-diff CLI via Bash over local baseline/impl paths; no untrusted argument construction is introduced by the SOP text. Nothing to flag.

## Performance

- This change is itself a performance improvement to the QA loop (the feature's entire purpose): B0 removes cross-round redundant image reads, B1 removes within-round sub-threshold image reads. No new hot-path loop or unbatched I/O in product code (there is none — text-only). No regression vs base.

## Verdict

**APPROVED** — all 11 ACs and the load-bearing AC-INV-1 whole-frame ban hold; the carry-forward design provably parses to PASS via the unchanged `parseRegionDiffFailures` and cannot mask a `fail`; the one open item (byte-cap test) is an acknowledged qa-engineer-owned cap bump, not a correctness defect.
