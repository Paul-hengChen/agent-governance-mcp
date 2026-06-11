# QA Review — T-CCL-P2-01 (constitution-conditional-load Phase 2)

Reviewer: qa-engineer
Date: 2026-06-11
Feature: `constitution-conditional-load-p2`
Spec: `specs/constitution-conditional-load.md` § Phase 2 (AC-P2-1…8, HC-NEST)
Code-reviewer: APPROVED (`review_reports/review_constitution-conditional-load-p2.md`)
Verdict: **PASS** — 629/629 tests green; build clean; no governance hole.

## Scope

Phase 1 (v3.33.0) shipped the `design-only` strip axis (`stripDesignOnly()` in
`prompts/build.ts`) gating §3.2-minus-R10 + the four §3.1 visual bullets. Phase 2 extends
the SAME axis (no new mechanism, no server-gate change, no rule reword) to two more
FEATURE-INERT spans deferred in Phase 1:

- **Span A** — §4 visual prose (S3/S4/S5 + the design-auditor paragraph), via a REORDER-ONLY
  reflow + one design-only fence nested inside `chain-only`.
- **Span B** — §1 L16/L17 (fence #1) + L19 (fence #2), with a `rationale` fence NESTED inside
  §1 fence #1 (HC-NEST: design-only OUTER, rationale INNER).

QA work was test authoring + verification only. The implementation
(`content/constitution.md` §1/§4 fences + §4 reflow, `prompts/build.ts`) was DONE and
reviewer-approved; it was NOT re-edited.

## Independently-measured figures (test's own chars/4 `approxTokens` heuristic, this working tree)

| Figure | Measured ~tok |
|---|---|
| constitution raw | 4311 |
| rationale-stripped (design-arm / kept path) | 4239 |
| design-only-stripped (alone) | 2434 |
| **non-design (design-only ∘ rationale stripped)** | **2409** |
| design-arm − non-design saving (constitution) | **1830** |
| teamwork coordinator bundle (design-arm, both strips) | 7703 |
| sr-engineer design bundle | 6283 |
| sr-engineer non-design bundle | 4453 |
| sr-engineer bundle saving | 1830 |

Marker inventory (MEASURED): `chain-only` = 2 (1 pair); `rationale` = 4 (2 pairs);
`design-only` = **12 (6 pairs)** — 2 §1 Span-B fences (OUTSIDE chain-only) + 4 nested in
chain-only (§3.1×2, §3.2, §4). `design-only` markers surviving `stripChainOnly` = **4**
(the 2 §1 fences; the reviewer's "4" is confirmed by counting). After `stripDesignOnly`,
surviving `rationale` markers = **2** (the §7 fence; the §1-nested rationale pair is removed
with its containing design-only fence #1 — HC-NEST).

Net win vs the original full-load constitution (~4200 pre-feature): ~1790 ~tok/dispatch on
non-design features. package.json stays 3.33.0 (release human-owned).

## AC-to-test mapping (all PASS)

| AC | Test (id / name) | Result |
|---|---|---|
| AC-P2-1 (§4 visual block strips non-design) | `AC-P2-1: §4 visual block … ABSENT on the non-design arm` (test 67) | PASS |
| AC-P2-2 (§4 visual block loads design) | `AC-P2-2: §4 visual block … PRESENT on the design arm` (test 68) | PASS |
| AC-P2-3 (§1 L16/17/L19 strip/load; L15/L18 retained) | `AC-P2-3: §1 L16/L17 + L19 …` (test 69) + `AC9/AC-P2-3: fullDetail … design-arm-aware round-trip` (test 50) | PASS |
| AC-P2-4 (HC-NEST permutation sweep, zero orphans) | `AC-P2-4/HC-NEST: rationale-inside-design-only nests clean across every strip permutation` (test 70) | PASS |
| AC-P2-5 (§4 reflow REORDER-ONLY) | `AC-P2-5: §4 reflow is REORDER-ONLY — every §4 rule sentence is byte-present` (test 71) | PASS |
| AC-P2-6 (non-visual §4/§1 survives both arms) | `AC-P2-6: non-visual §4 (DIAGRAM/S1/S2/S6) + §1 (L15/L18) survive byte-for-byte on BOTH arms` (test 72) | PASS |
| AC-P2-7 (AC8 floors re-measured) | tests 47 (≤4239), 48 (≤7703), 64 (≤2409), 65 (≥1830 saving) | PASS |
| AC-P2-8 (composition order-independent) | `AC5/HC5: all 6 strip-order permutations …` (test 60) + AC-P2-4 (test 70) | PASS |

## Assertions ADDED (Phase-2 acceptance contract)

In `test/context-budget.test.mjs`:

- **AC-P2-1 / AC-P2-2** — new tests asserting `P2_S4_VISUAL_SENTINELS` (S3 opener "A third
  counter"; S3 self-arming clause "the v3.16.0\nself-arming signal"; `VISUAL_BASELINES_REQUIRED`,
  `VISUAL_ASSERTIONS_REQUIRED`, `VISUAL_REPORT_INCOMPLETE`; P-AUDITOR opener + closing sentence)
  ABSENT on non-design, PRESENT on design.
- **AC-P2-3** — §1 inert bullets (L16/L17/L19) ABSENT non-design / PRESENT design; L15 (MVP
  strict) + L18 (Surgical) retained both arms. Sentinels use FULL-BULLET openers
  (`**Visual Widgets exception (v3.14.0)**: when a widget is listed…` etc.) — see governance
  note below.
- **AC-P2-4 / HC-NEST** — applies all 8 subsets of {stripChainOnly, stripRationale,
  stripDesignOnly} (encoding the reviewer's {design-only/rationale/chain-only}×{lite/full}
  sweep) and asserts balanced start/end marker counts per axis after every permutation (zero
  orphans) + the L15/L18 bullets stay byte-intact (no nested-fence corruption).
- **AC-P2-5** — eight verbatim §4 sentence anchors (DIAGRAM, S1, S2, S6, S3, S4, S5,
  P-AUDITOR) asserted byte-present in the post-reflow source; plus the design-arm dispatch
  carries the reflowed visual block byte-equal to source (reflow dropped/reworded nothing).
- **AC-P2-6** — `P2_S4_ANTISWEEP_SENTINELS` (DIAGRAM, S1 review_round, S2 qa_round, S6) +
  `P2_S1_ANTISWEEP_SENTINELS` (L15/L18) present byte-for-byte on BOTH arms.
- Helper `buildOnFixture` extended with a `fullDetail` parameter (default false) to drive the
  design-arm-aware round-trip.

## Assertions REBASELINED (the 4 originally-failing + 2 stale-but-passing floors)

| Location | Was | Now | Reason |
|---|---|---|---|
| test 47 (AC8 rationale floor) | ≤ 4200 | ≤ 4239 | Phase 2 adds 3 more design-only fence pairs; design-arm (kept-path) figure grew. MEASURED 4239. |
| test 48 (AC8 teamwork bundle floor) | ≤ 7665 | ≤ 7703 | Same marker cost on the design-arm bundle. MEASURED 7703. |
| test 50 (AC9 fullDetail round-trip) | unconditional "column-scroller picker" present | design-arm-aware | "column-scroller picker" now lives in §1 design-only fence #1; `stripDesignOnly` fires on non-design REGARDLESS of `fullDetail` (build.ts L315 vs L310). So it is ABSENT on a non-design fullDetail dispatch, PRESENT on the design arm. §7 "see XYZ" (not design-fenced) stays design-arm-independent. |
| test 61, line ~620 comment ("3 pairs") | "6 (3 pairs)" | "12 (6 pairs)" + explicit fence-inventory breakdown + `assert raw.design === 12` | Phase 2 = 6 design-only fence pairs. |
| test 61, line ~633 (`stripChainOnly→design-only` count) | `== 0` | `== 4` | The 2 §1 Span-B fences sit OUTSIDE chain-only, so they survive `stripChainOnly`; only the 4 nested §3.x/§4 fences are removed with it. VERIFIED by counting (not assumed). |
| test 61 (`stripDesignOnly→rationale` count) | `== raw.rationale` (4) | `== 2` | HC-NEST: §1 fence #1 contains a rationale pair; `stripDesignOnly` removes it with the fence, leaving only the §7 rationale fence (2 markers). MEASURED. |
| test 64 (AC8 non-design floor) | ≤ 3013 | ≤ 2409 | Phase 2 strips 2 more spans on non-design. MEASURED 2409. |
| test 64/65 (saving) | ≥ 1187 | ≥ 1830 | MEASURED design-arm − non-design = 1830. |

## Finding surfaced & resolved during authoring (test-infra defect, NOT a governance hole)

The first draft of AC-P2-3 used bold-only sentinels (`Design-baseline scope (v3.27.0)`). That
string also appears in `content/skill-sr-engineer.md` as a constitution cross-reference, so a
real non-design dispatch (constitution §1 stripped + skill body) matched the sentinel in the
SKILL and the test falsely failed. I verified the constitution §1 strip itself is correct (the
emitted §1 omits L16/L17/L19; dumped and confirmed) and replaced the sentinels with
constitution-unique full-bullet openers (absent from skill-sr / skill-coordinator). No
implementation change was warranted — the gate strips §1 correctly.

## Other verifications

- **AC4 lite cap** (`t-lean-under-target`, test 29): lean always-on bundle ≤ 2600 — PASS.
- **Arm-helper agreement** (AC8/HC3, test 66): `build.ts` imports `hasDesignModeRequiringVisual`
  from `tools/evidence-file` and reads `.required` — unchanged from Phase 1 (no build.ts change
  this phase) — PASS.
- **Composition** (test 60): all 6 strip-order permutations byte-identical — PASS.

## Gate results

- `npm run build` — zero tsc errors; `check:version — OK (3.33.0)`.
- `npm audit --audit-level=high` — only the pre-existing MODERATE `hono` advisory; no
  HIGH/CRITICAL, so the build gate is not tripped.
- `npm test` — **629/629 PASS, 0 fail, 0 skipped** (was 619 pass / 4 fail before rebaseline).
  Two consecutive runs confirm stability (one transient single-failure on an unrelated
  `teamwork-lite` ListPrompts test in an early run did not reproduce; all CCL fixtures clean up
  their temp workspaces).

## CI runnability

`npm test` runs headlessly (`node --test`), zero human interaction. All new fixtures use
`fs.mkdtempSync` + cleanup.
## 2026-06-11T06:30:26.088Z — PASS — by qa-engineer

PASS — AC-P2-1…8 authored + 4 failing AC8 floors rebaselined to independently-measured values. Build clean (tsc 0), npm audit only pre-existing MODERATE hono (no HIGH/CRITICAL — does not gate), npm test 629/629 green (was 619/4-fail). Measured: non-design constitution 2409 ~tok; design-arm rationale-stripped 4239; coord bundle 7703; saving 1830 (net ~1790 vs original ~4200). design-only=6 fence pairs (12 markers); stripChainOnly leaves 4 (the 2 §1 Span-B fences sit OUTSIDE chain-only — reviewer's 4 confirmed by count); stripDesignOnly leaves 2 rationale markers (HC-NEST: §1 rationale pair removed with its containing design-only fence). §4 reflow verified reorder-only (all 8 sentence anchors byte-present + design-arm visual block byte-equal to source). HC-NEST permutation sweep (8 subsets) leaves zero orphan markers. AC4 lite cap ≤2600 holds; arm-helper unchanged. One test-infra defect surfaced+fixed during authoring (non-unique §1 L17 sentinel collided with a skill-sr cross-ref; replaced with constitution-unique full-bullet anchors — NOT a governance hole, §1 strip itself correct). Evidence: qa_reports/review_T-CCL-P2-01.md.

