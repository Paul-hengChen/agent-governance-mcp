# Review — design-asset-source-rule (T-DASR-01 / T-DASR-02 / T-DASR-03)

## Round 1 — APPROVED — by code-reviewer

## Summary
- Three surgical, content-only governance-doc insertions: `content/skill-design-auditor.md` (T-DASR-01, asset export + manifest), `content/skill-sr-engineer.md` (T-DASR-02, import mandate + fidelity-defect label), `content/constitution.md` (T-DASR-03, one §1 line + header bump).
- All 5 ACs satisfied. Fence placement (AC-3) verified load-bearing-correct: the new line sits INSIDE the first `<!-- design-only:start -->…<!-- design-only:end -->` fence and is stripped on the non-design arm.
- Build gate clean (`tsc` + `check:version` OK at 3.35.0); no server code, no consumer CLAUDE.md, no model-tier/frontmatter touched.
- `npm test` shows exactly the 4 EXPECTED context-budget overages — genuine governance-prose text cost, NOT a fence-strip defect. qa must re-baseline these 4 caps as part of PASS.
- Headline verdict: **APPROVED** → route to qa-engineer.

## Correctness
- **AC-1 (T-DASR-01, skill-design-auditor.md:69)** — adds `**Asset export + manifest (v3.28.0)**`: mandates `download_figma_images` per asset node for fetch modes (`figma`/`sketch`/`xd`/`penpot`), saving to `src/assets/` or repo convention, and records the asset-manifest table `Figma node-id | exported file path | usage/widget` in `design/<feature>.md`, one paper-verifiable row per asset. Mode-conditional behavior is correct: `image`/`pdf`/`paper` record human-supplied path; `no-design` emits no manifest. Matches AC-1 and `copy-auditor-manifest-header`. ✅
- **AC-2 (T-DASR-02, skill-sr-engineer.md:27)** — adds `**Source assets, don't redraw them (v3.28.0)**`: mandates importing the exported asset from the auditor manifest for any design-sourced icon/logo/illustration; labels hand-authored approximate SVG `path` data a **fidelity defect** that must not be handed off. Critically, the no-over-reach carve-out is present and correct: "Pure CSS/geometric primitives NOT in the manifest stay MVP-governed" — the rule does NOT ban all inline SVG, only hand-redrawn substitutes for manifest-listed assets. Matches AC-2 and `copy-sr-rule`. ✅
- **AC-3 (T-DASR-03, constitution.md:19)** — exactly ONE new bullet `**Design-sourced assets (v3.28.0)**`, verbatim `copy-constitution-line`. Raw line-number check confirms placement: first fence `start` @ L16, `Visual Widgets exception` @ L17, `Design-baseline scope` @ L18, **new line @ L19**, `end` @ L20. The bullet is BETWEEN the markers and appended after Design-baseline scope per the spec insertion point. ✅
- **AC-5 (constitution.md:1)** — header bumped `v3.27.0 → v3.28.0`. package.json/index.ts remain 3.35.0 (release-engineer's separate concern, correctly untouched). ✅
- **Fence-strip proof**: `npm test` test #64 ("non-design constitution ≤ 2409 ~tok") still PASSES. Since the new line is inside the design-only fence, `stripDesignOnly` removes it on the non-design arm, so it does not count against the 2409 non-design floor. A fence MISPLACEMENT (line outside the fence) would have broken test #64. It did not. This is positive proof the fence placement is correct. ✅

## Quality
- Each clause is load-bearing; no redundancy. The auditor block carries mode-branching logic; the sr bullet carries mandate + label + carve-out + back-reference; the constitution line is the tersest of the three and is spec-mandated verbatim copy. Version tags (v3.28.0) and cross-references (constitution ↔ skills) are consistent and bidirectional (auditor "Upstream half"; sr "Constitution §1 Design-sourced assets v3.28.0").
- **Verbosity assessment (per coordinator request)**: The only ALWAYS-ON cost is the constitution line (counts in both the lean/lite bundle and the design-arm bundle, since lite applies `stripChainOnly` only — not `stripDesignOnly`, confirmed at test L96). That line already equals the spec's `copy-constitution-line` verbatim; trimming it would diverge from the approved Copy/Strings contract. No needless prose to cut without dropping spec content. The skill-auditor/skill-sr text is design-arm-or-role-scoped (not lean-always-on) and is appropriately dense for governance prose. No trim recommended.

## Architecture
- Consistent with the v3.33.0 conditional-load architecture: the design-only governance line is fenced so it loads only when `hasDesignModeRequiringVisual()` arms the design strip — matching where the server PASS gates can fire. Upstream/downstream split (auditor exports + manifests; sr imports) is clean separation of concerns. No contradiction with any architecture spec (none present for this feature). ✅

## Security
- N/A — governance-document text only. No injection vectors, no secrets, no boundaries. AC-4 guard confirmed: `git diff --name-only` yields only the 3 content files plus the dogfood state files (`.current/handoff.md`, `tasks.md`); grep for `\.(ts|mjs|js)$|CLAUDE\.md` over the diff returns NONE; grep for model/tier/frontmatter additions returns NONE. ✅

## Performance
- N/A — no executable code path changed; `dist/` byte-unchanged (content/*.md read at runtime). The only runtime effect is +65 ~tok on the design-arm constitution bundle and +41 ~tok on the lean always-on bundle — a deliberate, spec-justified governance-prose cost, not an algorithmic regression. No performance concern.

## Verdict
**APPROVED** — all 5 ACs met, fence placement proven load-bearing-correct (test #64 passes), AC-4 guard clean, build green; the 4 `test/context-budget.test.mjs` overages are genuine governance-text cost (not a fence defect) and must be re-baselined by qa-engineer as part of PASS.

### qa-engineer re-baseline note (required for PASS)
The following 4 floors in `test/context-budget.test.mjs` are now exceeded by the legitimately-scoped, spec-mandated governance text and MUST be re-baselined (qa owns test files per §2). Rationale per floor:
1. **AC2 lean always-on**: 2641 vs 2600 (+41). The lean/lite bundle applies `stripChainOnly` only (test L96), NOT `stripDesignOnly`, so the new §1 design-sourced-assets line legitimately counts here. New floor ≈ 2641 (+ editing headroom).
2. **AC2 skill-sr stripped body**: 2160 vs 2048 (+112). New "Source assets, don't redraw them" bullet (sr already trimmed connective prose 2198→2160; residual is spec-mandated `copy-sr-rule`). New floor ≈ 2160.
3. **AC8 design-arm constitution**: 4304 vs 4239 (+65). The new design-only line counts on the design arm. New floor ≈ 4304.
4. **AC8 teamwork design-arm bundle**: 7768 vs 7703 (+65). Propagates the constitution +65 into the coordinator bundle. New floor ≈ 7768.
Pre-edit baseline was 45/45 green, so these 4 are entirely attributable to this feature's adds. sr-engineer correctly did NOT touch the test file (§2).
