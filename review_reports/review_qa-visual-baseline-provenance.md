<!-- @code-reviewer | feature_id: qa-visual-baseline-provenance | reviewed_at: 2026-06-16 -->

# Review: qa-visual-baseline-provenance (T-QAVBP-01 / T-QAVBP-02 / T-QAVBP-03)

## Round 1 — CHANGES_REQUESTED — by code-reviewer

## Summary

- Adds a fifth visual sub-gate `VISUAL_PROVENANCE_MISSING` closing the empty-PASS gap (retrospective finding #1): a qa-visual report can no longer claim PASS on a diffed surface without a `baseline:` fingerprint + `diff-metric:` value.
- New code in `tools/evidence-file.ts`: pure parser `parseVisualProvenanceRows` (AC-9, verified no I/O) + composition helper `checkVisualProvenance` (D2 presence-gated opt-in, AC-3 carry-forward exempt, AC-4 fallback exempt). Wired into `index.ts` as the last visual sub-gate inside `if (armCheck.required)` per the architecture wiring point. SOP edits in `content/skill-qa-visual.md` (Steps B0/B1/B2 + report-schema reference).
- Gate logic, opt-in arming, exemptions, placeholder blacklist, and the error code (AC-8) all verified correct at runtime against the binding contracts.
- **One BLOCKING defect**: the SOP edits push `content/skill-qa-visual.md` from 14444 → 16881 bytes, exceeding the hard 15000-byte budget enforced by `test/qa-visual-skill-split.test.mjs:129`. `npm test` is RED (1 failing test) on an invariant the file satisfied at base. The architecture task-mapping (line 340) requires `npm test` green before handoff.
- Two non-blocking quality findings (bold-label regex gap, nested-heading false-positive) noted below; neither permits an empty-PASS (both fail-closed) so neither blocks.

## Correctness

- **[BLOCKING] `content/skill-qa-visual.md` over byte budget — regression.** `test/qa-visual-skill-split.test.mjs:129` asserts `qa-visual.md must be <= 15000 bytes`; the file is now 16881 bytes (was 14444 at HEAD; +2437). `npm test` → `1 fail`. The test file is unchanged by this diff, so this is a genuine regression introduced by the T-QAVBP-03 SOP edits. The sr-engineer notes claim "npm run build CLEAN" but the test gate (build + `node --test`) is not green. Fix: compress the Edit 1–5 additions to fit ≤ 15000 bytes (the two near-duplicate fenced `baseline:`/`diff-metric:` code blocks in Step B1's two branches and the long binding-heading-convention paragraph in Step B2 are the largest additions and can be tightened). If the budget genuinely must rise, that is a separate scope decision and must update the test with justification — not silently break it.
- `parseVisualProvenanceRows` — empty-PASS protection verified: a `## Region Diff` with table rows but **no** `### ` prose sub-headings parses to `[]` → gate dormant (`tools/evidence-file.ts:601-645`). This is the intended D2/AC-6 semantics (opt-in arms only once a `baseline:` line exists). Correct per contract; note the empty-PASS-with-zero-provenance case is *intentionally* not caught (the documented D2 trade-off).
- Placeholder blacklist verified: `baseline: <fingerprint>` (template stub) → `fingerprint: null` → blocks PASS in an opted-in report (`tools/evidence-file.ts:630`, `FINGERPRINT_PLACEHOLDERS`). Also catches `none`/`n/a`/`tbd`/`todo`/`-`/empty. Correct (D1).
- Opt-in arming verified: a report with one armed surface + one diffed surface lacking `baseline:` → `{ok:false, offendingByTaskId:{T1:["checkout: no baseline:"]}}`. One real baseline arms strict mode for the whole report (`tools/evidence-file.ts:673`). Correct (AC-1).
- AC-3 carry-forward exempt verified (a carry-forward surface with no baseline alongside a real surface → `ok:true`). AC-4 fallback verified (`B1 tool unavailable — LLM fallback` satisfies the metric with a null numeric `diffMetric`). Both correct (`tools/evidence-file.ts:677,683`).
- Gate placement verified: `index.ts:938` is the last block before the `}` closing `if (armCheck.required)` (line 958), itself inside `if (visualGate.present)`. Fires only on otherwise-clean armed reports. Matches the architecture wiring point exactly.

## Quality

- **[non-blocking] Bold-label regex gap.** `BASELINE_LINE_RE`/`DIFF_METRIC_LINE_RE` handle `**baseline**:` but not `**baseline:**` (closing emphasis after the colon). Input `- **baseline:** xyz789` captures `fingerprint = "** xyz789"` (leading `**` leaks into the value) — `tools/evidence-file.ts:563-564`. Non-empty + non-placeholder, so it does NOT enable an empty-PASS; it just records a slightly-garbled fingerprint. The SOP templates emit plain `- baseline: <...>` (no bold), so the canonical path is unaffected. Optional hardening: extend the closing-emphasis branch to allow `**` after the separator, or strip leading `*`/`_` from the captured value.
- **[non-blocking] Nested-heading false-positive (fail-closed).** A `#### detail` sub-section nested under a `### surface` is parsed as a *separate* surface (`tools/evidence-file.ts:607` splits on `#{3,6}`), so in an opted-in report it triggers a spurious `<heading>: no baseline:` offense and blocks PASS. This matches the architecture's deliberate flat-3-6-split contract (arch §Interface Contracts step 2) and the SOP binds qa-visual to one `### <surface id>` per surface — so it's an author-deviation guarded fail-closed (conservative; never an empty-PASS). Acceptable as-is; worth a one-line SOP caution that prose detail must not use deeper headings.
- Naming, comments, and the parser/composition pairing follow the established `parseVisualWidgetsChecklist` / `validateVisualReports` convention in the same file. No dead code, no `any`.

## Architecture

- Faithful to `specs/qa-visual-baseline-provenance-architecture.md`: D1 (either content-hash OR node-id, single line, permissive non-emptiness + placeholder blacklist), D2 (presence-gated opt-in via `rows.some(r => r.fingerprint !== null)`), D3 (no schema bump — parser reads only `visual_<id>.md`, confirmed), D4 (carry-forward + fallback exemptions with the documented asymmetry: fallback still requires `baseline:`). All resolutions implemented as specified.
- Interface signatures match the blueprint exactly (`VisualProvenanceRow`, `VisualProvenanceCheck`, `parseVisualProvenanceRows(content)`, `checkVisualProvenance(workspacePath, taskIds)`).
- **Spec/architecture string divergence (doc hygiene, non-blocking).** The implemented error string appends `; "B1 tool unavailable — LLM fallback" satisfies the diff-metric requirement.` which is present in the architecture wiring point (arch lines 218-220) but NOT in the spec §Copy/Strings `err.provenance_missing` row. The implementation matches its direct design constraint (the architecture, the more specific contract) verbatim, and AC-8's actual binding requirement — error *code* `VISUAL_PROVENANCE_MISSING` — is met exactly. The added clause is accurate (AC-4 is real). No action required in this diff; flag for spec/arch reconciliation at doc time.

## Security

- No injection vectors: parser is pure regex-over-string, no eval, no shell, no path interpolation from report content. `checkVisualProvenance` reads only `visual_<id>.md` via the existing `visualEvidencePath` helper (task ids come from the validated handoff, not free text). `readFileSync` wrapped in try/catch → skip on error. No secrets. No new dependency. Clean.

## Performance

- No regression. Per task id: one `existsSync` + one `readFileSync` + linear regex scans over the Region-Diff section (same I/O profile as the sibling `validateVisualReports`). `section.slice(start).search(...)` per heading is O(section length) per heading → O(headings × section) worst case, but surface counts and report sizes are tiny (handful of surfaces); not a hot path (fires once per PASS attempt). Acceptable.

## Verdict

`CHANGES_REQUESTED` — the parser/gate logic is correct and faithful to the contracts, but the T-QAVBP-03 SOP edits break `npm test` by pushing `content/skill-qa-visual.md` 1881 bytes over the 15000-byte budget (`test/qa-visual-skill-split.test.mjs:129`); the test suite must be green before handoff to qa. Tighten the SOP additions to fit the budget (or, with explicit justification, raise the budget + update the test — out of this diff's stated scope).

### Standing item (not introduced by this diff, do not block)
- 2 pre-existing HIGH npm-audit advisories (esbuild via tsx dev-dep; @xenova/transformers RAG dep). `package.json`/`package-lock.json` are untouched by this diff (zero deps added). Remediation = out-of-scope dependency bump. Noted for a separate hygiene pass per §6.

---

## Round 2 — APPROVED — by code-reviewer

## Summary

- Re-review of the single Round-1 blocker (byte budget) plus the two Round-1 non-blocking notes, both of which sr-engineer chose to address.
- `content/skill-qa-visual.md` compressed to **14993 bytes** (was 16881 at Round 1; cap is 15000 → 7-byte margin), by prose-only tightening. `npm test` is now **634 pass / 0 fail** — the byte-budget invariant at `test/qa-visual-skill-split.test.mjs:129` is green.
- All four machine-anchored strings survived compression **verbatim** (grep + runtime confirmed): the `### <surface id>` heading convention, the `baseline:` / `diff-metric:` prose fields, the carry-forward token `pass (carried forward — git diff confirms source untouched)`, and the B1-fallback token `B1 tool unavailable — LLM fallback`.
- Round-1 non-blocking note (1) **closed**: the `**baseline:**` closing-emphasis leak is fixed in `tools/evidence-file.ts` via a leading/trailing `^[*_]+|[*_]+$` strip on the captured value. Note (2) **closed**: a Step B2 caution against nesting `####` under a `### <surface id>` was added (`content/skill-qa-visual.md:128`).
- The gate/parser logic verified correct in Round 1 is **unchanged in substance** — `index.ts` is +31 lines / 0 deletions (the prior-APPROVED wiring, not re-touched this round); the parser change is value-extraction hardening only, behind the same fail-closed contract.

## Correctness

- **[RESOLVED — was BLOCKING] Byte budget restored.** `wc -c content/skill-qa-visual.md` → 14993 (≤ 15000). `npm test` → 634/634 pass, 0 fail. The Round-1 RED on `test/qa-visual-skill-split.test.mjs:129` is green. No test file was modified to achieve this (compression-only fix, the correct path).
- **Emphasis-strip did not break the placeholder blacklist or token matching (runtime-verified against `dist/`):**
  - `- baseline: <fingerprint>` (template stub) → `fingerprint: null` — blacklist intact, blocks PASS in an opted-in report.
  - `- baseline: abc123` (canonical) → `fingerprint: "abc123"` — clean.
  - `- **baseline:** xyz789` (the Round-1 leak) → `fingerprint: "xyz789"` — the `** ` no longer leaks (note 1 closed). diff-metric likewise clean.
  - carry-forward token → `isCarryForward: true`; B1-fallback token → `isFallback: true` with the verbatim token retained as the diff-metric. Both exemption paths (AC-3 / AC-4) unaffected.
- **Restored test-asserted phrases verified.** `test/pixel-perfect-visual-compare.test.mjs:135` asserts `/multimodal vision against a user-supplied baseline/i` → present at `content/skill-qa-visual.md:209`. The `(v) text content` enumeration is present at `:124`. Both green.
- **Step B2 caution does not affect parser slicing.** The new caution and the `#### Step B0/B1/B2` headings live under `## SOP — Phase 1.5` (`:8`), above `## Region Diff` (`:191`). The parser's `sliceH2Section(content, "Region Diff")` isolates only the Region-Diff body, so those `####` headings are never parsed as surfaces — no false-positive introduced.

## Quality

- Parser hardening (`tools/evidence-file.ts`) follows the existing convention: same `.replace(/`/g, "")` + new `.replace(/^[*_]+|[*_]+$/g, "")` + `.trim()` chain on both the baseline and diff-metric value extraction. Symmetric, commented, fail-closed. No `any`, no dead code.
- All ten acceptance criteria in `specs/qa-visual-baseline-provenance.md` remain exercised by the unchanged gate logic; the two verbatim Copy/Strings (AC-3 / AC-4 tokens) still match the implementation constants exactly.

## Architecture

- No architectural change since Round 1. D1–D4 resolutions intact; interface signatures unchanged; `index.ts` wiring point unchanged (+31 / -0). Faithful to `specs/qa-visual-baseline-provenance-architecture.md`.

## Security

- No change to the security surface since Round 1. Parser remains pure regex-over-string (no eval/shell/path interpolation); `checkVisualProvenance` reads only `visual_<id>.md`; no new dependency. Clean.

## Performance

- No change since Round 1. Same per-task-id `existsSync` + `readFileSync` + linear regex profile; fires once per PASS attempt; not a hot path. No regression.

## Verdict

`APPROVED` — the sole Round-1 blocker is resolved (file 14993 bytes ≤ 15000 cap, `npm test` 634/634 green), all four machine-anchored strings survived compression verbatim, the emphasis-strip hardening closed the Round-1 leak without breaking the placeholder blacklist or carry-forward/fallback matching, and no acceptance criterion regressed during the prose tightening. The 2 pre-existing HIGH npm-audit advisories are not introduced by this diff and remain out-of-scope. Handing off to qa-engineer.
