# QA review — T-ECCT-01 / T-ECCT-02

<!-- Auto-written by @qa-engineer for T-ECCT-01 (doc-drift fix, code-reviewer APPROVED) and T-ECCT-02 (contract test authoring) -->

## Phase 0 — Claim

QA claims review of T-ECCT-01 and authors T-ECCT-02. Feature: error-code-contract-test.
Code-reviewer APPROVED T-ECCT-01 (review_reports/review_T-ECCT-01.md). Contract:
specs/error-code-contract-test.md (AC-1..AC-7).

## Phase 1 — Review of T-ECCT-01 (working tree vs HEAD)

### Diff scope confirmed

Doc-only diff across `content/skill-code-reviewer.md`, `content/skill-coordinator.md`,
`content/skill-qa-engineer.md`, `content/skill-qa-visual.md`. Adds backtick-quoted
mentions of the 8 previously-undocumented gate error codes, each anchored to
existing conceptual prose describing the same gate. No behavior change.

### Independent verification (re-derived, not copied from code-reviewer report)

Extracted the code-side gate-error-code inventory directly from source
(`index.ts`, `tools/*.ts`, `schema/*.ts`) via the spec's shape rule
(`/^[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)*$/` + `/_(REQUIRED|MISSING|INCOMPLETE|EXCEEDED|UNVERIFIED|REJECTED)$/`
or `/^MISSING_/`): **18 codes, exact match to the spec's frozen inventory table**.
Extracted the doc-side inventory from `content/*.md` via the same shape rule
applied to backtick-delimited spans: **18 codes, exact match, mutual subset holds
both directions**. Each of the 8 codes T-ECCT-01 added
(`AGENT_ID_REQUIRED`, `MISSING_EVIDENCE`, `MISSING_REVIEW_EVIDENCE`,
`QA_ROUND_EXCEEDED`, `REVIEW_ROUND_EXCEEDED`, `TRANSITION_REJECTED`,
`VISUAL_ROUND_EXCEEDED`, `VISUAL_WIDGETS_UNVERIFIED`) verified present at a real
code-side emit site by direct grep (matches code-reviewer's line citations).

### Copy Audit Gate (Phase 3a)

N/A — this feature adds a test file only; per spec's Copy/Strings section it
introduces no user-facing strings, prompts, or UI copy. No dist/index.js string
surface to audit.

### Visual Audit Gate (Phase 3b)

N/A — spec's Visual Tokens / Visual Widgets / Visual Structural Assertions
sections are explicit N/A rows ("non-UI, test-only change"; "no
`design/<feature>.md` exists and the visual gate arm signal
(`hasDesignModeRequiringVisual()`) is inactive"). This is a non-design feature;
gate does not arm.

### Phase 1.5 — Visual Compare

No `design/error-code-contract-test.md` exists (confirmed: no `design/` dir at
all in this repo state). Phase 1.5 skipped — no Visual Baselines declared.

## Phase 3 — Test authoring (T-ECCT-02, in scope by design — human-approved cut)

### New file: test/error-code-contract.test.mjs

9 tests. Reads source `.ts` text and `content/*.md` text directly via
`fs.readFileSync` — never imports from `dist/` (AC-7).

AC → test mapping:

| AC | Test(s) | Coverage |
|---|---|---|
| AC-1 (code-side extraction, non-vacuous, size ≥ 18) | "AC-1: CODE_CODES extraction is non-vacuous (>= 18 known gate codes)" | FULL |
| AC-2 (doc-side extraction, non-vacuous, size ≥ 1) | "AC-2: DOC_CODES extraction is non-vacuous (>= 1 backtick-mentioned gate code)" | FULL |
| AC-3 (docs ⊆ code) | "AC-3: every doc-mentioned gate error code exists in code" | FULL |
| AC-4 (code ⊆ docs) | "AC-4: every code-side gate error code is documented" | FULL |
| AC-5 (green on introduction, zero hardcoded allowlist) | Folded into AC-3/AC-4 — both compare live-extracted sets directly, no allowlist/exclude entries anywhere in the file | FULL |
| AC-6 (shape-rule precision — no-noise guard) | 4 explicit inline assertions, one per token: `ALLOWED_TRANSITIONS`, `REQUIRED_VISUAL_SECTIONS`, `AGC_AUTO_ROUTE`, `CHANGES_REQUESTED` | FULL |
| AC-7 (no build dependency) | "AC-7: this test file does not import from dist/" + structural fact (imports section uses only `node:*` + `fs`/`path`/`url`) | FULL |

### Implementation note (bug caught and fixed during authoring)

First draft of the doc-side extractor captured arbitrary `` `([^`]+)` `` spans
and filtered by shape rule afterward. This broke on `content/skill-qa-visual.md`:
fenced code/example blocks contain literal single backticks that desynchronize
naive open/close backtick pairing for the rest of the file, silently merging
many short inline-code spans into a handful of giant multi-paragraph spans —
AC-4 then failed, reporting `VISUAL_WIDGETS_UNVERIFIED`, `VISUAL_PROVENANCE_MISSING`,
`PIXEL_GATE_ATTESTATION_MISSING`, `TRANSITION_REJECTED`, and `VISUAL_ROUND_EXCEEDED`
as spuriously undocumented (all 5 are demonstrably present in the file, confirmed
by direct `grep`). Fixed by matching the backtick-token-backtick pattern directly
(`` /`([A-Z][A-Z0-9]*(?:_[A-Z0-9]+)*)`/g ``) instead of capturing then filtering —
this only ever matches when a shape-rule token is flanked by exactly one backtick
on each side, independent of unrelated backtick parity elsewhere in the file.
Re-verified against a standalone extraction script before landing the fix; both
now agree at 18/18 mutual subset.

### Sanity-floor / noise-exclusion double-check (manual, outside the test run)

- `CODE_CODES` size == 18, `DOC_CODES` size == 18, sets identical (mutual subset
  holds both directions) — matches spec's frozen live-extraction table exactly.
- `ALLOWED_TRANSITIONS`, `REQUIRED_VISUAL_SECTIONS`, `AGC_AUTO_ROUTE`,
  `CHANGES_REQUESTED` all classify as `isGateErrorCode() === false`.
- `AGC_AUTO_ROUTE` confirmed absent from `tools/*.ts` and `index.ts` entirely
  (grep, zero hits) — matches spec's claim it "never appears" in code.

## Phase 4 — Run results

```
npm run build   → tsc clean, ZERO errors
npm test        → 811 tests, 811 pass, 0 fail (798 top-level incl. new file's 9)
```

Headless/CI-runnable: `node --test test/error-code-contract.test.mjs` run
standalone (no prior build) — 9/9 pass, confirming AC-7 empirically, not just
by static import-absence check.

## Verdict

T-ECCT-01: APPROVED (confirmed independently — re-derived extraction matches
code-reviewer's citations exactly, no discrepancies found).
T-ECCT-02: PASS. test/error-code-contract.test.mjs authored, all 7 ACs covered,
zero test failures, build clean.

## 2026-07-06 — PASS — by qa-engineer

T-ECCT-01/T-ECCT-02 PASS. Re-derived the code-side (18) and doc-side (18) gate
error-code inventories independently from source/content and confirmed mutual
subset holds — code-reviewer's APPROVED verdict on T-ECCT-01 stands. Authored
test/error-code-contract.test.mjs (9 tests, full AC-1..AC-7 coverage via
fs.readFileSync only, no dist/ dependency). Caught and fixed a backtick-parity
extraction bug during authoring (naive capture-then-filter broke across fenced
code blocks in content/skill-qa-visual.md; fixed by matching the token pattern
directly between backticks). npm run build: clean. npm test: 811/811 pass, 0
fail. Standalone `node --test test/error-code-contract.test.mjs` (no prior
build): 9/9 pass, confirming AC-7. Evidence: qa_reports/review_T-ECCT-01.md.
## 2026-07-06T03:09:18.364Z — PASS — by qa-engineer

T-ECCT-01 (doc-drift fix) re-verified independently: re-derived 18-code CODE_CODES and 18-code DOC_CODES from source/content, mutual subset holds, matches code-reviewer APPROVED verdict exactly. T-ECCT-02: authored test/error-code-contract.test.mjs (9 tests, AC-1..AC-7 full coverage, fs.readFileSync-only, no dist/ dependency). Fixed a backtick-parity extraction bug found during authoring (fenced-code blocks in content/skill-qa-visual.md desync naive backtick pairing). npm run build clean; npm test 811/811 pass, 0 fail. Standalone node --test on the new file (no prior build): 9/9 pass, confirming AC-7.

