# QA Review — T-A12F-01, T-A12F-02

covers: T-A12F-01, T-A12F-02

## Summary
- Feature `a12-followup-qa-round-name`: one-line prose fix to `content/const-06-chain-31-head.md` L8 (the `qa_round` circuit-breaker line), mirroring const-08's shipped `review_round` phrasing (spec AC1-AC3, sr-engineer T-A12F-01, code-reviewer APPROVED per `review_reports/review_T-A12F-01.md`).
- QA-owned T-A12F-02 (spec AC4-AC5): regenerated the compose-golden fixtures, hand-recatted the retired-monolith baseline, and independently re-measured + bumped the 3 chain-tag context-budget caps to their exact new values (no headroom).
- Full gate: `npm run build` clean, `npm audit --audit-level=high` clean (0 high/critical — 1 pre-existing low-severity `esbuild` dev-server advisory, unrelated to this feature, exit code 0), `npm test` 1067/1067 pass, 0 fail.
- Verdict: **PASS**.

## Expected-Red Diff
Manifest present: `qa_reports/expected-red_a12-followup-qa-round-name.txt` (9 entries: 6 compose-equivalence + 3 context-budget).

Ran the full suite BEFORE any re-baseline edit (fixture regen / cap bump). Actual reds:
- `test/compose-equivalence.test.mjs`: the 4 templated `skill-sr-engineer.md` (`CHAIN_SKILL`) entries (design×fullDetail cross product), the SessionStart-hook-full entry, and the 15-fragment-monolith invariant — 6 reds.
- `test/context-budget.test.mjs`: the rationale-stripped (design-arm) floor, the teamwork-coordinator-bundle floor, and the non-design floor — 3 reds.

Diff against the 9-entry manifest: **empty**. Phase 0.5: clean (9/9 manifest entries confirmed red, 0 unexplained reds).

## Phase 1 — Review
T-A12F-01's implementation review (AC1-AC3, Copy Audit Gate, Visual Audit Gate N/A — no visual literals) was performed by code-reviewer and is APPROVED (`review_reports/review_T-A12F-01.md`); not re-litigated here per QA's out-of-scope-for-correctness/architecture boundary. This review covers T-A12F-02's own work: fixture regen + cap re-baseline (AC4-AC5), which is QA-owned by spec.

### AC4 — fixture regen + cap re-baseline
1. **Fixture regen**: ran `node scripts/capture-constitution-golden.mjs` (post-build). It regenerated 10 of 11 fixtures automatically; the 11th (`constitution-monolith.txt`) was skipped by the script's own post-A9 guard (`content/constitution.md` was deleted by T-CNSO-09 — the monolith source no longer exists to re-capture from). Per A12 precedent (T-A12-08), hand-recatted it: concatenated `CONSTITUTION_SEGMENTS` (imported from `dist/prompts/constitution-manifest.js`, the same manifest `capture-constitution-golden.mjs` and `prompts/build.ts` both use) over the 15 `content/const-*.md` fragments in manifest order, `join("")` — the identical operation `test/compose-equivalence.test.mjs`'s "cat(15 fragments) === monolith" assertion performs. Wrote the result to `test/fixtures/compose-golden/constitution-monolith.txt`.
2. **Diff review**: `git diff` on every changed fixture (`build-full-{design,nondesign}{,-fd}.txt`, `hook-full.txt`, `constitution-monolith.txt` — 5 of 11; the 6 lite-mode fixtures are unchanged because const-06 carries the `chain`-only tag and is stripped from lite bundles, consistent with the manifest's lite rows being absent from the expected-red list). All 5 diffs show **exactly one changed line**, byte-identical across all 5 files:
   ```
   - After 3 QA FAILs (Round 4), only `(pm, In_Progress)` is accepted.
   + After the `qa_round` cap of QA FAILs (Round 4 of `qa_round`), only `(pm, In_Progress)` is accepted.
   ```
   No other line differs in any fixture. Confirms AC3 (no other const-06 line changed) transitively through the fixture diff, and confirms the fixtures now pin the post-fix bytes.
3. **Cap re-measurement**: independently re-measured (own script, not trusted from sr-engineer's/code-reviewer's notes) using the same `approxTokens`/`stripRationale`/`stripOriginTags`/`composeConstitution` pipeline `test/context-budget.test.mjs` uses:

   | cap (bundle includes `chain` tag) | old | new | delta |
   |---|---|---|---|
   | rationale-stripped (design-arm) constitution floor | 6391 | **6399** | +8 |
   | teamwork coordinator bundle (design-arm, both strips) floor | 12538 | **12547** | +9 |
   | non-design (design-only + rationale stripped) constitution floor | 4293 | **4302** | +9 |

   All 3 caps bumped to the exact measured value, no headroom, per the established Phase-2 / T-A12-08 convention. Saving-margin invariants re-verified and still hold: raw−stripped = 6672 − 6399 = 273 ~tok (≥ 240 floor, unchanged); design-only strip saving = 6399 − 4302 = 2097 ~tok (≥ 2080 floor, unchanged). `test/context-budget.test.mjs` comment blocks updated with a new dated bump entry per cap, following the file's existing convention (no test-title renaming — confirmed as this file's standing practice; titles have carried stale numeric caps since a11-escalation-grammar without being renamed on each subsequent bump).
4. Delta sanity check: the L8 line grows from `After 3 QA FAILs (Round 4), only ...` (33 chars) to `After the \`qa_round\` cap of QA FAILs (Round 4 of \`qa_round\`), only ...` (68 chars), a +35 char / ~4 = +8-9 ~tok growth — matches all 3 measured deltas (+8, +9, +9) exactly (the ±1 token spread is `Math.ceil` rounding-boundary noise across the three different base strings).

### AC5 — full suite passes, no unrelated regressions
- `npm run build`: `tsc`, zero errors.
- `npm audit --audit-level=high`: 1 low-severity `esbuild` dev-server advisory (pre-existing, unrelated to this diff), exit code 0.
- `npm test`: 1067 tests, **1067 pass, 0 fail** (up from 1058 pass / 9 fail pre-regen — exactly the manifest's 9 entries flipped green, no other test's status changed).

## Quality
No findings. The regen touches only the declared fixture/test-cap surface; `content/const-06-chain-31-head.md` itself is unchanged by this task (T-A12F-01's scope).

## Architecture
No findings. No new structure introduced; applies the existing capture-script + manual-monolith-recat pattern established at T-A12-08.

## Security
No findings. Test-fixture and token-cap changes only; no runtime code path touched.

## Performance
No findings. The ~8-9 ~tok/dispatch growth on chain-tagged bundles is the acknowledged, spec-scoped cost of the AC1 phrasing fix (spec Performance section, T-A12F-01); no additional cost introduced by T-A12F-02 itself.

## Verdict
**PASS** — Phase 0.5 expected-red diff clean (9/9, 0 unexplained), all 11 golden fixtures regenerated/hand-recatted and diff-reviewed (only the declared const-06 L8 line moves), all 3 chain-tag context-budget caps independently re-measured and bumped to exact new values (no headroom), full gate (`npm run build` + `npm audit --audit-level=high` + `npm test`) green with 0 unrelated regressions.
## 2026-07-10T07:37:20.718Z — PASS — by qa-engineer

T-A12F-01/T-A12F-02 PASS. Phase 0.5 expected-red diff clean (9/9 manifest entries confirmed red, 0 unexplained) before any re-baseline edit. Regenerated 10/11 compose-golden fixtures via scripts/capture-constitution-golden.mjs; hand-recatted constitution-monolith.txt (its auto-capture branch is skipped post-A9 monolith delete, per T-A12-08 precedent) by concatenating CONSTITUTION_SEGMENTS over the 15 const-*.md fragments. All 5 changed fixtures (build-full-{design,nondesign}{,-fd}.txt, hook-full.txt, constitution-monolith.txt) diff-reviewed: exactly one line changed in each, the declared const-06 L8 qa_round phrasing. Independently re-measured (own script) and bumped all 3 chain-tag context-budget caps to exact new values, no headroom: design-arm floor 6391->6399, teamwork coordinator bundle 12538->12547, non-design floor 4293->4302. Saving-margin invariants re-verified (raw-stripped=273>=240; design-only-saving=2097>=2080). Full gate: npm run build clean, npm audit --audit-level=high clean (1 pre-existing unrelated low-sev esbuild advisory, exit 0), npm test 1067/1067 pass 0 fail (up from 1058/9 pre-regen, exactly the 9 manifest entries flipped green). Evidence: qa_reports/review_T-A12F-01.md (covers T-A12F-01, T-A12F-02).

