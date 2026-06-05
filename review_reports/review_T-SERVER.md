# Code Review — T-SERVER (+ T-SKILL, T-SR, T-CONST)

Feature: `visual-fidelity-gate-hardening`
Reviewer: code-reviewer (opus, clean-context — distinct model from sr-engineer; no same-model-bias concern)
Base: working tree vs `HEAD`
Contract: `specs/visual-fidelity-gate-hardening-architecture.md`; ACs: `specs/visual-fidelity-gate-hardening.md`

## Round 1 — APPROVED — by code-reviewer

## Summary

- T-SERVER adds `hasDesignModeRequiringVisual` + private `parseDesignMode` to `tools/evidence-file.ts`, wires a two-step PASS gate into `index.ts` (~711–778), and registers `VISUAL_BASELINES_REQUIRED` in the `TransitionRejection.error` union (`tools/transitions.ts:52–56`).
- T-SKILL/T-SR/T-CONST update `content/skill-design-auditor.md`, `content/skill-sr-engineer.md`, `content/skill-pm.md`, `content/constitution.md`; T-CONST also landed the architect's deferred `specs/qa-flow-enforcement-architecture.md` v3.16.0 amendment.
- Implementation matches the architecture contract verbatim in all normative points: exclusion-based arming (`mode !== "no-design"`), fail-open on missing/malformed, STEP-1-before-STEP-2 mutual exclusion, correct `isError` envelope.
- Gates green: `tsc --noEmit` = 0 errors, `npm run build` = 0, `npm audit --audit-level=high` = 0 vulnerabilities, dist rebuilt and in sync.
- Headline verdict: **APPROVED** — no defects, hand off to qa-engineer.

## Correctness

- **`hasDesignModeRequiringVisual` (evidence-file.ts:155–173)** — correct. Reuses the hardened `designFilePath` sanitiser (L114–125, which collapses `..` and `/`), guards `!activeFeature || !fs.existsSync`, wraps read+parse in try/catch returning `{required:false, mode:null, designPath}`. Never throws. `required = mode !== null && mode !== "no-design"` is the exclusion form mandated by D3 — future modes auto-arm. Matches contract §1 exactly.
- **`parseDesignMode` (evidence-file.ts:182–209)** — verified against all three `## Mode` shapes via standalone harness:
  - H2 `## Mode\nfigma` (incl. multiple blank lines before value) → `figma` ✓
  - bullet `- **Mode** — figma` / backtick `` `figma` `` / em-dash / hyphen separator → correct ✓
  - inline `mode: figma` / `mode: no-design` → correct ✓
  - `no-design` correctly wins via `\bno\-design\b` (full-token match); a bare `design` substring returns `null` (fail-open) ✓
  - no Mode line → `null` (fail-open, D6) ✓
  - uppercase `## MODE / FIGMA` → `figma` (case-insensitive) ✓
- **`index.ts` PASS gate (711–778)** — STEP 1 (`armCheck.required && !visualGate.present` → `VISUAL_BASELINES_REQUIRED`) fires BEFORE the evidence-file lookup and `return`s, so it short-circuits; STEP 2 (`if (visualGate.present)`) only runs when baselines ARE present. The two paths are provably mutually exclusive — no double-emission, no fall-through. `MISSING_EVIDENCE` (700–710) still precedes both. First-error precedence matches the contract's normative ordering.
- **`isError` shape (index.ts:723–732)** — identical structure to sibling `VISUAL_EVIDENCE_MISSING` (740–751) and `VISUAL_WIDGETS_UNVERIFIED` (766–775): `{ content: [{ type: "text" as const, text: ... }], isError: true }`. Consistent.
- **AC-10 backwards-compat** — confirmed against the contract's compat matrix: no design file → `required:false` → STEP 1 skipped, `present:false` → STEP 2 skipped → success; `mode: no-design` → `required:false` → silent pass-through; baselines PRESENT + real mode → STEP 1 falls through, STEP 2 behaves exactly as v3.14.0; malformed mode → `required:false` → no spurious block. The intended migration break (real mode + no baselines → blocks) is by design (locked Q-OQ1), not a regression.

## Quality

- New helper is placed directly below `hasVisualBaselinesInDesign` (~L150) as specified, parallel in shape and style. Comments are accurate and cite decision records.
- Minor (non-blocking, no action required): the `parseDesignMode` comment at evidence-file.ts:200 says "check longest first," but `KNOWN_MODES` lists `no-design` LAST. The behaviour is still correct because `design` is not an enum member and `no-design` is only matched by its full `\bno\-design\b` token (verified — bare `design` returns null). The comment's "longest first" phrasing is slightly inaccurate vs the array order but does not affect correctness.
- Observation (non-blocking): the design-auditor template's literal enum-listing bullet (`- **Mode** — one of \`figma\`, ... \`no-design\`.`) parses to `figma` (first token) → `required:true`. This is the unfilled template placeholder; a real audit replaces it with the actual mode. This matches the equally-permissive existing `hasVisualBaselinesInDesign` and is the auditor's responsibility, not a server defect. No regression.
- No `any`, no dead code, no convention drift. `KNOWN_MODES` typed `as const`.

## Architecture

- Fits the contract precisely: D1 (helper home in evidence-file.ts, index.ts stays orchestration-only), D2 (arm-before-evidence, mutually exclusive), D3 (exclusion not allow-list), D4 (all three Mode shapes), D6 (fail-open on unparseable), D7 (verbatim leading phrasing + interpolated `(mode=…, at …)`). No contradiction with the architecture spec.
- `VISUAL_BASELINES_REQUIRED` added to the union following the `VISUAL_WIDGETS_UNVERIFIED` handler-emitted precedent with the matching explanatory comment (transitions.ts:52–56); `validateTransition` does not produce it — correct, it is emitted by the index.ts handler.
- Doc/skill edits consistent with server behaviour:
  - `content/constitution.md` §3.1 relabelled `Visual evidence gate (v3.16.0)` with arming-on-`mode ≠ no-design`, mutual-exclusion, and `VISUAL_BASELINES_REQUIRED`; §4 `visual_round` paragraph updated to the self-arming signal. Matches AC-3.
  - `content/skill-design-auditor.md`: old contradictory sentence ("skip silently — non-UI features pay zero overhead") fully removed (grep count 0); replaced with no-design-only legitimacy + `VISUAL_BASELINES_REQUIRED` block text (AC-2). Mandatory `## Layout / Canvas` row added. Empty-node honesty rule added at step 4 — `empty`/`unresolved` vs `deferred` used in correct contexts (AC-8).
  - `content/skill-sr-engineer.md` step 3a.4 Geometry Assertion: Tier-A source-literal inspection mandatory, headless optional, build-gate only (no `visual_round`), silent degradation when no design file / no `## Layout / Canvas` (AC-5/AC-6, D5).
  - `content/skill-pm.md` Dependencies/Prerequisites copy-through of `## Layout / Canvas` (AC-4).
  - `specs/qa-flow-enforcement-architecture.md` v3.16.0 Amendment: Visual Gate Tiers section (AC-7) + `VISUAL_BASELINES_REQUIRED` error-code row (AC-9) — verbatim per the architect's Enforcement-Matrix Deliverable. The sr-engineer correctly covered the architect's deferred edits; content is complete and matches the contract verbatim.

## Security

- No new injection vectors. `designFilePath` sanitiser (L121–123) replaces non-`[A-Za-z0-9._-]` and collapses `..` — the new helper reuses it, so no path-traversal regression relative to `hasVisualBaselinesInDesign`.
- No `fs` call outside the try/catch + existence guard; never throws on hostile/malformed input. Regex constructed from the fixed `KNOWN_MODES` constant (no user input interpolated into the dynamic `RegExp` source other than the literal enum names, which are escaped for `-`). No ReDoS risk: `parseDesignMode` regexes are linear, inputs are small design files.
- No hardcoded secrets, no network I/O.

## Performance

- No regression vs base. The new helper reads the design file once per PASS attempt (PASS is infrequent; files are small) — same cost profile as the sibling `hasVisualBaselinesInDesign`, which is also called in the same gate. Two reads of the same small file per armed PASS is acceptable and matches the contract's explicit "no caching" decision.
- `parseDesignMode` is O(n) over file content with a bounded inner loop over 8 fixed enum names. No O(n²), no unbatched I/O, no leak. Acceptable.

## Verdict

**APPROVED** — implementation matches the architecture contract on every normative point (arming exclusion, fail-open, STEP-1 mutual exclusion, error shape, union registration, T-QA substrings `VISUAL_BASELINES_REQUIRED` and `## Visual Baselines is absent` preserved verbatim), all skill/constitution/spec edits are consistent and non-contradictory, gates are green, and no defects found.
