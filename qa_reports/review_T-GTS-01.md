# QA Review — T-GTS-04..08 (governance-tag-strip, qa-engineer scope)

Verdict: **PASS**

Scope: `test/context-budget.test.mjs` updates for the `stripOriginTags` pipeline
(T-GTS-04 sentinel literals, T-GTS-05 byte-identity routing, T-GTS-06 cap
re-baseline, T-GTS-07 new stripOriginTags coverage, T-GTS-08 spot-check).
Predecessor: sr-engineer T-GTS-01..03, code-reviewer APPROVED
(`review_reports/review_T-GTS-01.md`). Contract: `specs/governance-tag-strip.md`.

## Phase 1 — Copy / Visual audit

N/A — spec's Copy/Strings and Visual Tokens sections are both explicitly N/A
(non-design, build-time governance-text transform, no user-facing strings or
visual properties introduced). Logged skip, no action needed.

## Phase 1.5 — Visual Compare

Skipped (no Visual Baselines declared — non-design feature, no `design/<feature>.md`).

## Phase 3 — AC → Test coverage map

| AC | Test(s) | Result |
|---|---|---|
| AC1 (bundle clean) | AC1: chain-role build on a NON-design workspace OMITS…; T-GTS-07/AC3 (unit span-removal); AC1: stripDesignOnly… (pre-existing, unaffected) | PASS |
| AC2 (mixed-content survives) | AC2: chain-role build on a DESIGN-armed workspace LOADS…; AC2/AC4: gated spans byte-equal (srcSpan via stripOriginTags); T-GTS-07/AC2 (string-level, skill-pm.md Visual Structural Assertions site); T-GTS-07/AC1/AC2 (end-to-end via buildPromptForRole, constitution visual_round site) | PASS |
| AC3 (stripper contract: idempotent, no-op default) | T-GTS-07/AC3 (idempotence + empty-string + no-marker passthrough + span-removal) | PASS |
| AC4 (order-independence) | T-GTS-07/AC4 (representative 4-permutation composition check + zero-orphan-marker sweep, all 4 axes) | PASS |
| AC5 (pinned literal tests updated) | All 11 previously-failing `context-budget.test.mjs` assertions (see re-baseline table below) | PASS |
| AC6 (caps re-baselined, not silently drifted) | 5 cap tests re-measured with `stripOriginTags` folded into composition (see table) | PASS |
| AC7 (error-code contract untouched) | `test/error-code-contract.test.mjs` — no changes made; re-ran, unaffected | PASS (9/9) |
| T-GTS-08 (13 tag-adjacent files, no hidden content-equality) | Spot-checked all 13; ran their full suites (245 tests) | PASS, 0 failures — confirms PM triage |

## Cap re-baseline table (T-GTS-06)

All 5 caps folded `stripOriginTags` into their composition chain (recommended
per spec AC6 — raw-only would have let fence-marker bytes drift the caps UP,
masking the feature's actual saving). Every cap moved **lower** than its
pre-feature value, per the ticket's intent:

| Cap | Old (pre-feature) | New (measured, post-fold) | Test |
|---|---|---|---|
| design-arm constitution (rationale-stripped) | ≤ 4523 | ≤ 4487 | `AC8/AC-P2-7: rationale-stripped (design-arm) constitution…` |
| non-design constitution (design-only + rationale stripped) | ≤ 2409 | ≤ 2403 | `AC8/AC-P2-7: non-design (design-only + rationale stripped) constitution…` |
| teamwork bundle (constitution + skill-coordinator, design-arm) | ≤ 8160 | ≤ 8078 | `AC8/AC-P2-7: teamwork coordinator bundle…` |
| skill-pm stripped body | ≤ 2850 | ≤ 2817 | `AC1/AC2: skill-pm stripped token count…` |
| skill-sr-engineer stripped body (the "5th cap" sr flagged, reviewer confirmed spec's Affected Tests undercounted) | ≤ 2210 | ≤ 2138 | `AC1/AC2: skill-sr-engineer stripped token count…` |

Delta assertions also re-measured and updated:
- constitution rationale+origin-tag saving: `raw - stripped >= 49` → `>= 240` (raw grew due to inline fence bytes; folding `stripOriginTags` into the stripped side recovers a much larger, representative delta).
- design-only strip saving (non-design floor): `ratStripped - nonDesign >= 1830` → `>= 2080`.
- The one delta test that already passed unmodified (`AC8/AC-P2-7: chain-role non-design bundle is ~1830 ~tok lighter…`) was re-verified empirically (still holds, ok) and left as-is — not a cap, and spec's Affected Tests item 8 only required re-verification, not a mandatory fold.

## T-GTS-04/05 fix inventory (11 originally-failing assertions, all now green)

1. `DESIGN_ONLY_SENTINELS` — "Visual evidence gate" and "`visual_round` sub-loop" literals updated to post-fence form (version-tag substring dropped).
2. `ANTI_SWEEP_SENTINELS` — "Sequential-context assumption + reconcile" (R10 suffix dropped).
3. Raw R10 byte anchor — literal updated to include the inline fence markup (matches actual raw source bytes); extracted span routed through `stripOriginTags` before comparing against the (already-stripped) build output.
4. `P2_S1_DESIGN_SENTINELS` — "Design-baseline scope" and "Self-converge relaxation" literals updated (version-tag dropped). The "Visual Widgets exception (v3.14.0)" entry was left **unchanged**, per handoff note — that site was deliberately left un-fenced/test-pinned.
5. "AC4: surviving rule byte-identical" — `expectedConstitution` composition extended to `stripDesignOnly(stripRationale(stripOriginTags(CONSTITUTION)))`.
6. "AC2/AC4: gated spans byte-equal (srcSpan)" — `srcSpan` routed through `stripOriginTags` before the containment check (the §3.2 header carries an inline origin fence).
7. AC8 cap tests (4 + the 5th sr-flagged skill-sr cap) — re-baselined per table above.
8. "AC-P2-5: §4 reflow…" — sentence anchor updated to the fenced raw form (visual_round line); `visBlockSrc` comparison also routed through `stripOriginTags` (same class as the R10/§3.2 fixes — this tick-up was flagged by sr-engineer and confirmed by code-reviewer as belonging to the same class as R10, spanning T-GTS-04/06).

## T-GTS-07 new coverage added

4 new tests in `test/context-budget.test.mjs` (inserted after the DR-3 3-copy-parity block):
- `T-GTS-07/AC3`: idempotence, empty-string / no-marker passthrough, span-removal at a known site.
- `T-GTS-07/AC2`: mixed-content site (skill-pm.md Visual Structural Assertions) keeps its normative half at the string level.
- `T-GTS-07/AC1/AC2`: same contract end-to-end through `buildPromptForRole` on a design-armed fixture (constitution `visual_round` site).
- `T-GTS-07/AC4`: representative (not exhaustive 4!=24) composition-order check against the other three strippers, plus a zero-orphan-marker sweep across all 4 axes.

## T-GTS-08 spot-check

Grepped all 13 PM-triaged files (constitution-deliverable-guard, cut-approval-gate,
design-auditor-volume-guard, handoff-migration, qa-flow, phase-0-5-sop,
pixel-perfect-visual-compare, qa-visual-skill-split, release-staging,
researcher-deep-research, skill-evolution-v3.11, subagent-templates,
visual-evidence-gate) for version/finding-code patterns. Every hit is in a test
name, `describe` title, or code comment — none is a content-equality assertion
against `content/*.md` at a fenced site. One borderline case checked closely:
`design-auditor-volume-guard.test.mjs`'s `"2c\.\s+\*\*Mechanical baseline
selection \(v3\.39\.0\)\*\*"` regex — confirmed that site is **not** one of the
11 origin-fenced sites in `skill-design-auditor.md` (outside T-GTS-02/03
scope), so it is unaffected. Ran the full suites for all 13 files (245 tests,
1 file — `node --test` on all 13 paths): **245/245 pass**, confirming PM's
triage.

## Phase 4 — Build & full suite

- `npm run build`: clean, zero TypeScript errors.
- `npm test`: **817/817 pass, 0 failures** (2 consecutive clean runs; an
  isolated single flake on one run, in a file untouched by this ticket, did
  not reproduce on re-run — not attributable to `context-budget.test.mjs`,
  the only file touched in this QA pass).
- `error-code-contract.test.mjs`: 9/9 (AC7 — untouched, re-verified).

## Non-design gate log

Copy Audit Gate: N/A (spec Copy/Strings = N/A). Visual Audit Gate: N/A (spec
Visual Tokens = N/A). Phase 1.5 Visual Compare: skipped (no Visual Baselines).
All logged per SOP step 3a/3b/4 skip conditions — non-design feature.
## 2026-07-06T11:06:36.268Z — PASS — by qa-engineer

governance-tag-strip PASS. Updated test/context-budget.test.mjs for the stripOriginTags pipeline: T-GTS-04 sentinel literals (DESIGN_ONLY_SENTINELS, ANTI_SWEEP_SENTINELS, P2_S1_DESIGN_SENTINELS, R10/visual_round raw anchors), T-GTS-05 byte-identity tests routed through stripOriginTags (srcSpan, r10, expectedConstitution, visBlockSrc), T-GTS-06 re-baselined 5 caps (design-arm constitution 4523->4487, non-design constitution 2409->2403, teamwork bundle 8160->8078, skill-pm 2850->2817, skill-sr 2210->2138 — all folded stripOriginTags into composition, all LOWER than before), T-GTS-07 added 4 new tests (idempotence/passthrough/span-removal, mixed-content string+e2e, composition-order), T-GTS-08 spot-checked all 13 tag-adjacent test files (245 tests, 0 failures, confirms PM triage — no hidden content-equality breaks). npm run build clean; npm test 817/817 pass (0 failures, 2 consecutive clean runs). Evidence: qa_reports/review_T-GTS-01.md.

