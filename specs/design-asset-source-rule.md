# design-asset-source-rule

## Problem Statement

When sr-engineer builds design-backed screens, they sometimes author approximate SVG `path` data by hand to mimic Figma icons, logos, or illustrations instead of downloading the actual exported asset via the Figma MCP. Hand-authored SVG never pixel-matches the Figma baseline, producing an avoidable visual_round FAIL on every screen containing a sourced asset. Constitution §1 design-only has the adjacent spirit ("Design-baseline scope", "Visual Widgets exception") but contains no explicit rule mandating "source the asset; don't redraw it." This feature closes that governance gap with three surgical insertions: one in `content/skill-design-auditor.md` (asset export + manifest), one in `content/skill-sr-engineer.md` (import mandate + fidelity-defect label), and one concise line inside the `<!-- design-only:start -->` fence in `content/constitution.md` §1.

## User Stories

- As a design-auditor, I want to export raster/vector assets from Figma during extraction and record them in an asset manifest table in `design/<feature>.md`, so that downstream roles have a paper-verifiable list of sourced assets and their file paths.
- As an sr-engineer, I want a clear governance rule that I must import Figma-exported assets for icons/illustrations, so that I never hand-author approximate SVG path data and avoid a guaranteed visual_round FAIL.
- As a qa-engineer, I want the constitution and skills to name hand-drawn asset approximation as a fidelity defect, so that I have explicit grounds to FAIL a review when sr-engineer substitutes hand-drawn SVG for a sourced asset.

## Acceptance Criteria

### AC-1 — design-auditor skill: asset export step added
Given a design source with raster/vector assets (icons, logos, illustrations),
When design-auditor runs its extraction SOP,
Then it MUST call `download_figma_images` (or the equivalent MCP export call for non-Figma modes) for each such asset, save the file to the workspace (e.g., `src/assets/` or the repo's established convention), and record an **asset manifest** table in `design/<feature>.md` with columns `Figma node-id | exported file path | usage/widget`. The manifest is paper-verifiable: each row maps one design element to one file on disk.

### AC-2 — sr-engineer skill: import mandate + fidelity-defect label added
Given `design/<active_feature>.md` contains an asset manifest with one or more rows,
When sr-engineer implements a surface that uses any listed icon, logo, or illustration,
Then sr-engineer MUST import the exported file from the auditor's manifest; hand-authoring approximate SVG path data to mimic that asset is labelled a **fidelity defect** and must not be handed off. Pure CSS/geometric primitives that are NOT sourced design assets remain governed by the default MVP rule.

### AC-3 — constitution §1: one concise line added inside design-only fence
Given `content/constitution.md` §1 `<!-- design-only:start -->` block,
When the rule is loaded for a design feature,
Then the block contains exactly one new rule stating that design-sourced raster/vector assets are sourced (exported) not redrawn; hand-drawn approximation = fidelity defect. The line sits inside the existing `<!-- design-only:start -->…<!-- design-only:end -->` fence (so it is conditionally loaded only on design features, consistent with the v3.33.0 conditional-load architecture).

### AC-4 — no consumer CLAUDE.md / no tier change / no server code
Given the full diff for this feature,
When code-reviewer and qa-engineer inspect it,
Then the diff contains ONLY changes to `content/skill-design-auditor.md`, `content/skill-sr-engineer.md`, and `content/constitution.md`; no consumer `CLAUDE.md` is touched; no agent frontmatter model tiers are changed; no TypeScript server code (`index.ts`, `tools/`, `guards/`, `prompts/`, `schema/`, etc.) is modified.

### AC-5 — constitution version header bumped
Given the constitution header currently reads `# Constitution v3.27.0`,
When the changes in AC-3 land,
Then the header reads `# Constitution v3.28.0` (next minor; the exact bump is recorded here as the canonical target — release-engineer owns the package.json version bump as a separate concern).

## Copy / Strings

| string id | exact text | source |
|---|---|---|
| copy-fidelity-defect-label | "fidelity defect" | authored-here — consistent with existing constitution/skill terminology for visual correctness failures |
| copy-constitution-line | "**Design-sourced assets (v3.28.0)**: design-sourced raster/vector assets (icons, logos, illustrations) MUST be sourced via export (e.g., `download_figma_images`), not redrawn by hand; hand-authored approximation of a design asset is a **fidelity defect**." | authored-here — new governance rule, no external design source |
| copy-sr-rule | "For any design-sourced icon, logo, or illustration listed in the auditor's asset manifest (`design/<feature>.md`), you MUST import the exported Figma asset file. Hand-authoring approximate SVG `path` data to mimic a design asset is a **fidelity defect** and must not be handed off. Pure CSS/geometric primitives that are NOT sourced design assets remain governed by the default MVP rule." | authored-here — new governance rule |
| copy-auditor-manifest-header | "**Asset manifest** — table mapping exported assets: `Figma node-id \| exported file path \| usage/widget`." | authored-here — new section header for design-auditor artifact schema |

## Visual Tokens

N/A — this feature introduces no visual UI; it is a governance-document-only change.

| token id | property | value | source |
|---|---|---|---|
| N/A | — | — | feature has no visual tokens |

## Visual Widgets

N/A — this feature introduces no non-primitive widgets.

| widget id | description | source-node |
|---|---|---|
| N/A | — | feature has no non-primitive widgets |

## Visual Structural Assertions

N/A — `design/<feature>.md` mode = `no-design`. Gate is silent.

## Out of Scope

- Any server-side enforcement (TypeScript code changes, new tw_* tools, new PASS gate logic) — governance-text only.
- Changes to consumer `CLAUDE.md` files.
- Changes to agent model tier frontmatter.
- Updating `content/constitution-rationale.md` (non-normative; outside surgical scope for this feature).
- Updating `docs/backlog.md` (release-engineer's call at version bump time).
- Reconciling the pre-existing 67-task drift (T470–T-SCOPE-QA) in `tasks.md`.

## Dependencies / Prerequisites

- No external references in the requirements (no URLs, Figma links, or tickets).
- Constitution version header target: v3.27.0 → v3.28.0 (governance text only; check-version.mjs does NOT read this header).
- Package.json version bump: release-engineer's responsibility at ship time; noted but out of pm scope.
- Exact insertion point for AC-3: inside the FIRST `<!-- design-only:start -->` block in §1 (lines 16–19 of the current `content/constitution.md`), appended as a new bullet after the existing "Design-baseline scope (v3.27.0)" bullet, before `<!-- design-only:end -->`.
