# QA Review: T49+T50+T51 — pixel-perfect-visual-compare (Phase 2)

> @qa-engineer · 2026-05-26
> Spec: `specs/pixel-perfect-visual-compare.md`
> Tasks: T49 (auditor Visual Baselines H2), T50 (QA Phase 1.5), T51 (v3.8.2 bump + build)

## Scope

Phase 2 of `research/pixel-perfect-and-design-coverage.md` (Option B — vision-LLM screenshot compare). Markdown-only changes to `content/`; no TS code paths added or removed.

## Phase 1 — Review

### AC traceability

| AC | Requirement | Evidence | Verdict |
|----|-------------|----------|---------|
| AC-1 | Visual Baselines OPTIONAL H2 with 4-column schema in `design/<feature>.md` | `content/skill-design-auditor.md:21` — full schema row added under Artifact Schema H2 list; surface id ties to *Source manifest*; baseline/impl paths workspace-relative; absence = Phase 1.5 skipped | ✅ PASS |
| AC-2 | Phase 1.5 fires only when Visual Baselines section exists | `content/skill-qa-engineer.md:41-42` — explicit absent-branch: log skip and proceed to Phase 2 | ✅ PASS |
| AC-3 | Per-row compare contract (Read both PNGs + structured 6-category diff appended to review doc) | `content/skill-qa-engineer.md:43-45` — Read tool used for both paths, diff covers layout/spacing/alignment/element presence/color/text/image content (6 categories i-vi), appended under `## Phase 1.5 — Visual Compare` heading with one sub-section per surface id | ✅ PASS |
| AC-4 | Three failure modes (drift / missing baseline / missing impl) + PASS sub-verdict | `content/skill-qa-engineer.md:46-50` — all 3 failure routes spelled out with correct `next_role` targets (sr-engineer / design-auditor / sr-engineer); PASS sub-verdict proceeds to Phase 2 | ✅ PASS |
| AC-5 | Source-agnostic gating logic | `content/skill-design-auditor.md:21` lists Figma + Sketch + XD + Penpot + PDF + raw mockup + photo without singling out Figma; `content/skill-qa-engineer.md:52` explicitly states "Source-agnostic: any image format the design source produced is consumable" | ✅ PASS |
| AC-6 | Backwards-compat with v3.8.1 (no Visual Baselines = silent skip) | Direct consequence of AC-2 skip branch. v3.8.1 audits have no Visual Baselines H2 → skip log line → proceed to Phase 2. No retroactive migration code anywhere | ✅ PASS |
| AC-7 | Zero compile/type errors | `npm run build` clean (re-verified by t6); `dist/index.js:131` carries `version: "3.8.2"`; `scripts/check-version.mjs` passed | ✅ PASS |

### Copy Audit Gate

Spec Copy / Strings table contains 2 `authored-here` rows (`sop.auditor.visual-baselines.header`, `sop.qa.phase15.header`) recording the planned SOP additions. Implementation refined prose for fluency, same documentation-trace pattern as Phase 1 (`qa_reports/review_T46-T48.md` § Copy Audit Gate).

- **Spec self-acknowledges**: "No user-facing product copy is introduced. The feature modifies internal SOP markdown that ships as LLM context. Per spec schema, the literal SOP additions are recorded below as `authored-here` for traceability."
- **Drift is non-semantic**: every constraint the spec rows describe (4-column schema, surface id foreign key, skip-if-absent, 6-category diff, 3 failure routes) is implemented verbatim in semantic terms.
- **No user-facing product strings**: same exemption as Phase 1.

**Resolution**: PASS with finding. Same precedent as `qa_reports/review_T46-T48.md`.

### Visual Audit Gate

Spec records `Visual Tokens: N/A — no UI or visual change.` ✅ N/A confirmed — markdown only.

### Security checklist

- No code path added or modified.
- No secrets, no user input handling, no injection surface.
- The Read tool is the only new I/O touchpoint; path validation is the host LLM's responsibility (Read enforces existence). `design/<feature>.md`-declared paths must exist on disk per AC-4 missing-file failure modes — server is not in the loop.
- ✅ N/A confirmed.

### Convention adherence

- README new `#### (i)` section follows existing alphabetic ordering; prior `(i)` renumbered to `(j)`.
- CHANGELOG entry uses the established `### Changed` / `### Backwards-compatible` / `### Notes` shape (matches `[3.8.1]`).
- Version literals updated in lockstep: `package.json`, `index.ts`, `dist/index.js`, CHANGELOG.
- QA SOP step renumbering preserves *Phase N* labels (which existing cross-refs at L29, L59 reference) — internal references remain valid.

### Drift acknowledgement

`tw_detect_drift` reports 48 historic completed tasks (T01–T48) in `tasks.md` not in handoff `completed_tasks`. Pre-existing prior-session accumulation, **not caused by this feature**. Out of scope; left unchanged.

## Phase 1 verdict

**PASS** — proceeding to Phase 3 (no Phase 2 round required).

## Phase 1.5 — Visual Compare

`design/pixel-perfect-visual-compare.md` does not exist (this is internal MCP server work with no design source). `Phase 1.5: skipped (no Visual Baselines declared)` — proceeded directly to Phase 3 per the AC-2 gating contract. The skip itself is dogfood evidence that AC-2/AC-6 work for non-UI features.

## Phase 3 — Tests

### Spec-to-test map

| AC | Test |
|----|------|
| AC-1 | `t1_auditor_visual_baselines_schema` |
| AC-2 | `t2_qa_phase15_skip_if_absent` |
| AC-3 | `t3_qa_phase15_per_row_contract` |
| AC-4 | `t4_qa_phase15_failure_modes` |
| AC-5 | `t5_source_agnostic_gating` |
| AC-6 | `t6_backwards_compat_v381` |
| AC-7 | `t7_version_coherence_382` |

Bonus regression: `t8_qa_step_numbering_consistency` — ensures the SOP renumber didn't leave dangling step numbers (e.g. two "6.") since manual renumbering of markdown lists is error-prone (the implementation needed one mid-edit follow-up fix on exactly this).

### Coverage

Markdown-only feature; constitution test strategy gives "integration for I/O boundaries". Tests exercise the prompts/build.ts I/O boundary that loads `content/skill-*.md` into the rendered agent prompt. Line-coverage tooling is not meaningful for markdown; the AC→test map above is the coverage record.

### Security smoke tests

N/A — no input boundary added. The Read tool is host-managed; no path-traversal surface lives in the modified markdown.

### Test artifact

`test/pixel-perfect-visual-compare.test.mjs` — 8 tests (7 mapped 1:1 to AC-1..AC-7 + 1 regression).

## Phase 4 — Run

- Existing 254 tests (post v3.8.1): all PASS.
- New 8 tests: all PASS.
- Build: ZERO `tsc` errors.
- `scripts/check-version.mjs`: OK at 3.8.2.
- CI runnability: `npm test` runs headlessly.

## Final verdict

**PASS** all three tasks (T49, T50, T51).
