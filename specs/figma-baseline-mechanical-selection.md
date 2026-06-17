# Spec: figma-baseline-mechanical-selection

> Feature ID: `figma-baseline-mechanical-selection`
> Version tag: `v3.39.0`
> Mode: `no-design` (SOP text change only — no design source, no visual surfaces)
> Scope decision: `single-feature`

---

## Problem Statement

When a task's PRD supplies a single Figma URL that expands to a multi-surface board (e.g., a full OOBE flow board containing many steps), design-auditor has no written rule preventing it from eyeball-picking which frames to use as baselines. Eyeball selection is unreproducible, unaccountable, and varies between runs — producing missed frames (漏抓), spuriously-included look-alike frames from other steps (誤收), and noise frames (connectors, annotation text) treated as screens. The downstream effect is that qa-visual re-derives its own baseline set from the URL rather than copying a frozen manifest, compounding the non-determinism. Both gaps need a written SOP rule. Research docs `research/figma-baseline-mechanical-filtering-method.md` and `research/figma-extraction-analysis.md` characterise the problem and converge on the fix: deterministic structural filter over Figma metadata, grouping by spatial proximity or componentId (NOT id-prefix), frozen into the Source manifest, then copied verbatim by downstream roles.

---

## User Stories

- As a design-auditor agent, I want a written SOP rule telling me to select baseline frames via a deterministic structural filter (frame-type + name pattern + semantic anchor + spatial/component grouping) and freeze the node-id list into the Source manifest, so that the baseline set is reproducible, auditable, and the same regardless of who runs it.
- As a qa-visual agent, I want a written SOP rule requiring me to copy the frozen baseline node-id list verbatim from the design-auditor's Source manifest rather than re-deriving it from the Figma URL, so that baseline identity is locked at audit time and downstream drift cannot occur.
- As a release engineer, I want version `3.39.0` reflected in `package.json`, `index.ts`, and `CHANGELOG.md`, so that the SOP additions are traceable to a named release.

---

## Acceptance Criteria

**AC-1 — Mechanical baseline selection rule present in skill-design-auditor.md**

Given `content/skill-design-auditor.md` is read,
When searching for the v3.39.0 step 2c block,
Then a step labelled "Mechanical baseline selection (v3.39.0)" MUST be present between step 2b and step 3, MUST forbid eyeball-scan baseline selection for multi-surface boards, MUST require deterministic structural filter (frame-type + name-glob + semantic-anchor descendant), MUST require grouping by spatial proximity (`absoluteBoundingBox`) and/or `componentId` (NOT by Figma `id` prefix), MUST require the resulting node-id list plus filter conditions and exclusion reasons to be recorded in the Source manifest, and MUST state that downstream copies these node ids verbatim and MUST NOT re-derive from the URL.

**AC-2 — qa-visual baseline-copy rule present in skill-qa-visual.md**

Given `content/skill-qa-visual.md` is read,
When searching for a baseline-copy clause,
Then a rule MUST be present (in Step A.5 or as a new named step before Step A) requiring qa-visual to copy the frozen baseline node-id list from the design-auditor's Source manifest verbatim, MUST explicitly forbid re-deriving the baseline set from the Figma URL, and MUST cite the Source manifest as the authoritative source of baseline node ids.

**AC-3 — Version bump to 3.39.0**

Given `package.json` and `index.ts` are read,
When checking the version fields,
Then `package.json` `"version"` field MUST equal `"3.39.0"` and the `Server()` literal in `index.ts` MUST equal `"3.39.0"`.

**AC-4 — CHANGELOG entry for 3.39.0**

Given `CHANGELOG.md` is read,
When checking for a `## [3.39.0]` heading,
Then a `## [3.39.0]` entry MUST be present and MUST mention `figma-baseline-mechanical-selection` and describe the SOP additions (mechanical baseline selection + qa-visual baseline-copy rule).

**AC-5 — No server/schema/build-logic change**

Given a `git diff` of all changed files,
When examining file types,
Then zero `.ts`, `.mjs`, `.js` (except `dist/`), or `package-lock.json` files MUST be modified (build artefacts in `dist/` are the only permitted non-content change — they result from `npm run build` after the version bump in `index.ts`).

**AC-6 — npm test green**

Given `npm test` is run after all changes,
When the test suite completes,
Then all tests MUST pass with zero failures (no regression from content-only + version bump changes).

---

## Copy / Strings

This feature introduces no user-facing strings (it is a SOP/governance document change, not a product UI feature). All text changes are internal governance content.

| string id | exact text | source |
|-----------|-----------|--------|
| N/A | — | feature has no user-facing strings |

---

## Visual Tokens

This feature introduces no visual tokens (mode = no-design).

| token id | property | value | source |
|----------|----------|-------|--------|
| N/A | — | — | feature has no visual tokens |

---

## Visual Widgets

This feature introduces no visual widgets (mode = no-design).

| widget id | description | source-node |
|-----------|-------------|-------------|
| N/A | — | feature has no non-primitive widgets |

---

## Visual Structural Assertions

Not applicable — `mode = no-design`. Section present to satisfy spec schema; no assertions required.

| assertion id | surface | required element/state | source node/token |
|---|---|---|---|
| N/A | — | mode = no-design; no visual surfaces | — |

---

## Out of Scope

- **`tw_extract_figma_baseline` MCP tool** — deferred. Tooling to automate the mechanical filter as a first-class server capability is premature at n=1 sample. Scope creep.
- **pHash state-grouping** — deferred. Perceptual-hash clustering of state variants (Phase B/C in the research doc) adds implementation cost without direct SOP value at this stage.
- **Empty-shell detection change** — already exists in `content/skill-design-auditor.md` step 4 (`nodes: []` → `unresolved`). No change needed.
- **depth/metadata token savings** — already covered by Volume Gate (step 2a) and node-scoped fetch (step 3). No change needed.
- **Constitution header bump** — the constitution version header tracks the highest behaviour the constitution document itself describes; this feature adds SOP rules only to skill files, not constitution paragraphs. No bump warranted.
- **`design-only` fence additions** — step 2c is a fetch-based-modes-only clause; it fires only when `mode ≠ no-design`. Whether to wrap it in a `<!-- design-only -->` fence is deferred (out of scope for this feature).

---

## Dependencies / Prerequisites

- **Resource Audit Gate (§7):** Research docs contain one external URL (`https://viewsonic-ssi.visualstudio.com/Corporate%20OS/_workitems/edit/104444`) — context-of-origin reference only, not load-bearing for the SOP changes. Classified: **ignore**.
- `content/skill-design-auditor.md` step 2c already self-tags `v3.39.0` (implemented in lite mode before this chain). The sr-engineer task (T-FBMS-01) MUST verify this text reads well and matches AC-1; if it already satisfies AC-1 exactly, that task is verify-and-confirm, not redo.
- `content/skill-qa-visual.md` has NO existing paired clause for baseline-copy from Source manifest. The sr-engineer task (T-FBMS-02) MUST add it.
- Prior-session historical drift (79 tasks T470–T-QAVBP-04) in `tasks.md` — leave as-is.
- T-ORM-02 and T-ORM-03 (pre-existing incomplete tasks on `retro-sop-hardening` feature) remain open and are unrelated to this feature.
