# QA Review: T46+T47+T48 — pixel-perfect-design-coverage (Phase 1)

> @qa-engineer · 2026-05-26
> Spec: `specs/pixel-perfect-design-coverage.md`
> Tasks: T46 (skill-design-auditor.md), T47 (skill-pm.md), T48 (v3.8.1 bump + build)

## Scope

Phase 1 of `research/pixel-perfect-and-design-coverage.md`: A1 multi-pass audit + A2 source-agnostic frame manifest. Markdown-only changes to `content/`; no TS code paths added or removed.

## Phase 1 — Review

### AC traceability

| AC | Requirement | Evidence | Verdict |
|----|-------------|----------|---------|
| AC-1 | Source manifest is exhaustive + source-agnostic + status-tagged | `content/skill-design-auditor.md:18` — manifest schema lists Figma/Sketch/XD/Penpot/PDF/image surfaces, status column `audited \| deferred \| out-of-scope`, reason required for non-`audited` | ✅ PASS |
| AC-2 | Multi-pass permitted, ≤ 250 lines/pass, ≤ 5 passes, each follow-up MUST flip ≥ 1 deferred→audited | `content/skill-design-auditor.md:13` — "Token-frugal multi-pass" Hard rule with hard ceiling + progress requirement + §5 anti-loop cite | ✅ PASS |
| AC-3 | No-design mode unchanged | `content/skill-design-auditor.md:11` (no-design Hard rule untouched) + `:43` ("no-design mode skips multi-pass and manifest entirely") | ✅ PASS |
| AC-4 | PM enumerates deferred surfaces under Dependencies | `content/skill-pm.md:33` — Deferred-surface gate clause appended to SOP step 2 | ✅ PASS |
| AC-5 | Backwards-compat: old audits without status column work | `content/skill-design-auditor.md:18` (downstream-role compat: audited/unknown fallback) + `content/skill-pm.md:33` (PM no-action fallback) | ✅ PASS |
| AC-6 | Zero compile/type errors | `npm run build` clean; `dist/index.js:131` carries `version: "3.8.1"`; `scripts/check-version.mjs` passed | ✅ PASS |

### Copy Audit Gate

Spec Copy / Strings table contains 3 `authored-here` rows recording the planned SOP additions (`sop.auditor.manifest.header`, `sop.auditor.multipass.header`, `sop.pm.deferred.gate`). Implementation refined the prose for fluency and added a "Backwards-compat" sub-clause that AC-5 demanded.

- **Spec self-acknowledges**: "No user-facing product copy is introduced. The feature modifies internal SOP markdown that ships as LLM context. Per spec schema, the literal SOP additions are recorded below as `authored-here` for traceability."
- **Drift is non-semantic**: the implemented prose covers every constraint the spec rows describe (exhaustive listing, status tags, ≤ 250 lines/pass, ≤ 5 passes, deferred-surface enumeration).
- **No user-facing product strings**: the Copy Audit Gate's failure mode (cde-oobe `"Select your language"` vs Figma `"Language"`) does not apply — these are LLM-context SOP refinements with no ship-to-user surface.

**Resolution**: PASS with finding. The Copy / Strings table here is documentation traceability, not gating product copy. Future iteration: the spec schema could distinguish "documentation-only" rows from "user-facing gated" rows so the Copy Audit Gate applies asymmetrically. Out of scope for this feature.

### Visual Audit Gate

Spec records `Visual Tokens: N/A — no UI or visual change.` ✅ N/A confirmed — no hex / sp / dp / weight literal introduced.

### Security checklist

- No code path added or modified — markdown + version literal edits only.
- No secrets, no user input handling, no injection surface.
- ✅ N/A confirmed per sr-engineer handoff and independent inspection.

### Convention adherence

- README new section follows existing `#### (h)`-style alphabetic ordering (renamed prior `(h)` to `(i)` accordingly).
- CHANGELOG entry uses the established `### Changed` / `### Backwards-compatible` / `### Notes` shape.
- Version literals updated in lockstep: `package.json`, `index.ts`, `dist/index.js`.

### Drift acknowledgement

`tw_detect_drift` reports 45 historic completed tasks (T01–T45) in `tasks.md` not reflected in handoff `completed_tasks`. Pre-existing prior-session accumulation, **not caused by this feature**. Out of scope for this review; left unchanged.

## Phase 1 verdict

**PASS** — proceeding to Phase 3 (no Phase 2 round required).

## Phase 3 — Tests

### Spec-to-test map

| AC | Test |
|----|------|
| AC-1 | `t1_auditor_manifest_schema` |
| AC-2 | `t2_auditor_multipass_clause` |
| AC-3 | `t3_auditor_no_design_preserved` |
| AC-4 | `t4_pm_deferred_surface_gate` |
| AC-5 | `t5_backwards_compat_clauses` |
| AC-6 | `t6_version_coherence` |

### Coverage

Markdown-only feature. Per constitution test strategy ("unit for pure logic, integration for I/O boundaries"): no pure logic was added. Tests are integration-level — they exercise the I/O boundary where `prompts/build.ts` reads `content/skill-*.md` into rendered prompts. Tooling-based line coverage is not meaningful for markdown; the AC→test map above is the coverage record.

### Security smoke tests

N/A — no input boundary added.

### Test artifact

`test/pixel-perfect-design-coverage.test.mjs` — 6 tests mapped 1:1 to AC-1..AC-6.

## Phase 4 — Run

- Existing 248 tests: all PASS (rerun after build).
- New 6 tests: all PASS.
- Build: ZERO `tsc` errors.
- `scripts/check-version.mjs`: OK.
- CI runnability: `npm test` runs headlessly, no human interaction needed.

## Final verdict

**PASS** all three tasks (T46, T47, T48).
