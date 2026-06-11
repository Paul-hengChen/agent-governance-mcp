# QA Review — T-GTL-06 + T-GTL-07 (governance-text-load, Round-2 constitution fencing)

**Reviewer:** qa-engineer
**Date:** 2026-06-11
**Verdict:** PASS
**Spec:** `specs/governance-text-load-architecture.md` (R2 amendment — DR-8…DR-12, "Test thresholds that change")
**Code-reviewer:** APPROVED (`review_reports/review_T-GTL-07.md` combined, `review_reports/review_T-GTL-06.md` stub)

Combined report: T-GTL-06 (constitution §1/§7 rationale fencing) and T-GTL-07
(`buildPromptForRole` constitution-strip + measure-script mirror) are one
inseparable contract — the fences (T-GTL-06) are only load-bearing once the
call-site strips them (T-GTL-07). Verified together.

---

## Implementation under review

- `content/constitution.md` — two inline `<!-- rationale:start/end -->` spans:
  §1 (Visual Widgets, HTML-primitive `(e.g. …)` list) and §7 (External-reference,
  `(URLs, …, "see XYZ")` list). §3.1/§3.2 untouched. (sr-engineer, T-GTL-06)
- `prompts/build.ts` L259–269 — constitution rationale-stripped when `!fullDetail`,
  composed after `stripChainOnly`, gated on the same `fullDetail` flag. (T-GTL-07)
- `scripts/measure-context-cost.mjs` — `stripRationale` mirror applied to the
  constitution in the bundle rows (reporting-only, DR-2/DR-6). (T-GTL-07)
- `dist/**` — rebuilt by sr; my `npm run build` re-emitted it (expected).

## Out-of-scope, left untouched (per dispatch + reviewer notes)

- `CLAUDE.md` (modified in working tree) — belongs to the SEPARATE
  constitution-restructure (v3.32.0) feature; NOT part of T-GTL evidence.
- `package.json` / `index.ts` Server literal — stay at 3.31.0; release-owned bump.
- `test/context-budget.test.mjs` `t-lean-under-target` 2,600 lite cap — UNCHANGED
  (AC4 / DR-11: hook path never calls `stripRationale`, lite bundle byte-identical).

---

## Phase 1 — Review

- §3.x exclusion zone (DR-10/AC7): 0 rationale markers between the §3.1 anchor and
  the §4 anchor. The §3.1→§4 byte slice is identical pre/post `stripRationale`.
- Fence balance: 2/2 rationale markers, 1/1 chain-only markers — both fence types
  in disjoint regions (chain-only wraps §3.1+§4; rationale in §1/§7).
- Compose order (DR-9): `stripRationale(stripChainOnly(c)) === stripChainOnly(stripRationale(c))`
  verified true on the actual file.
- DR-8 two-span decision is reviewer-blessed and independently re-verified: §1 L17
  (definitional `(Figma…)` clarifier) and §1 L19 (rule + §3.x refs) correctly NOT fenced.
- No Copy/Strings or Visual Tokens H2 in the architecture spec (non-UI, governance-text
  feature); Copy/Visual Audit Gates N/A. Phase 1.5 visual: skipped (no design file /
  no `## Visual Baselines`).

## Phase 3 — Spec-to-Test map (assertions added to `test/context-budget.test.mjs`)

All ACs measured with the project `chars/4 approxTokens` heuristic against the real
`content/constitution.md` via the `dist/prompts/build.js` strippers.

| AC | Contract | Test(s) added | Result |
|---|---|---|---|
| **AC7** | §3.1–§3.2 byte-untouched; no fence marker in exclusion zone; 2 balanced fences | `AC7: §3.1–§3.2 exclusion zone is byte-identical after stripRationale`; `AC7: exactly two balanced rationale fences, both outside §3.x` | byte slice identical; 0 markers in zone; 2/2 fences |
| **AC8** | stripped constitution ≤ 4153 ~tok, saving ≥ 49; teamwork bundle ≤ 7626 ~tok | `AC8: rationale-stripped constitution is at/below the measured floor (≤ 4153 ~tok)`; `AC8: teamwork coordinator bundle (both strips) is at/below the floor (≤ 7626 ~tok)` | constitution raw 4225 → stripped **4153** (saved **72**); bundle **7617 ≤ 7626** |
| **AC9** | lossless: every rule/gate/heading survives; example-lists dropped; fullDetail retains; compose order irrelevant | `AC9: every operative rule/gate/heading survives stripRationale on the constitution`; `AC9: fullDetail retains both example lists verbatim (round-trip lossless)`; `AC9/DR-9: stripChainOnly ∘ stripRationale compose order is irrelevant` | all `## 1.`…`## 7.`, `3.1`/`3.2`, `MVP strict`, `Self-converge relaxation`, `External-reference policy`, `skill-pm §Resource Audit Gate` present; `column-scroller picker` + `see XYZ` absent after strip, present in raw + fullDetail bundle; compose order equal |
| **AC4 (UNCHANGED)** | lite 2,600 cap not regressed | existing `AC2: lean always-on … <= 2600` (NOT modified) | lite bundle byte-identical (DR-11); still passes |

The existing Round-1 F-B assertions (skill-pm ≤ 2322, skill-sr ≤ 2048, marker
retention, `stripRationale` idempotence/no-marker passthrough) also re-verified green.

## Phase 4 — Gate

- `npm run build` — zero tsc errors (`check:version` OK at 3.31.0).
- `npm audit --audit-level=high` — zero HIGH/CRITICAL. One pre-existing MODERATE
  hono advisory only → does NOT gate per §6.
- `npm test` — **608 / 608 pass, 0 fail**, headless (CI-runnable).
- New AC7/AC8/AC9/DR-9 assertions: all green (subtests 18–24 in context-budget group).

## Measured numbers (authoritative)

| Metric | Raw | Stripped | Saved |
|---|---|---|---|
| `constitution.md` | 4225 ~tok | **4153 ~tok** | **72** |
| `teamwork` coordinator bundle (both strips) | 7690 ~tok | **7617 ~tok** | **73** |

Stripped figures sit at/under the spec floors (≤ 4153, ≤ 7626); saving ≥ 49. Matches
DR-12 / the sr-engineer T-GTL-06 verification table exactly.

## Verdict

PASS. T-GTL-06 + T-GTL-07 satisfy AC7/AC8/AC9; AC4 lite cap did not regress; build/audit/test
gates all green. governance-text-load (F-B) is complete. Version target v3.31.0 — package.json
NOT bumped (repo already at 3.31.0; release is human-owned). Next role: human.
## 2026-06-11T02:59:53.263Z — PASS — by qa-engineer

PASS — T-GTL-06+07. AC7: §3.1–§3.2 byte-identical pre/post stripRationale, 0 markers in exclusion zone, 2/2 fences. AC8: constitution 4225→4153 ~tok (saved 72≥49), teamwork bundle 7617≤7626. AC9: all rule/gate/heading markers retained, example-lists dropped, fullDetail round-trip lossless, compose order irrelevant (DR-9). AC4 lite 2600 cap UNCHANGED (DR-11). Build 0 errors, audit 0 HIGH/CRITICAL (pre-existing MODERATE hono only), 608/608 tests pass. Evidence: qa_reports/review_T-GTL-07.md.

