# Spec: qa-visual-skill-split (v3.8.3)

> Scope: implement the Token-cost watch-item from
> `research/skill-token-cost-and-pixel-perfect-success-rate.md` § Recommendation —
> split `content/skill-qa-engineer.md` into two files so non-UI workspaces no
> longer load the Phase 1.5 Visual Compare SOP.

## Problem Statement

`content/skill-qa-engineer.md` reached 2.17K tokens in v3.8.2 — 27% larger than the next-biggest skill (`skill-pm.md` at 1.25K) and 2× any other role. ~25% of that bulk is the Phase 1.5 Visual Compare sub-phase (and its rationale), which only fires when `design/<feature>.md` declares a `## Visual Baselines` H2. For every non-UI feature (server logic, CLI tools, this MCP repo itself), the Phase 1.5 SOP is dead weight loaded into context. Splitting Phase 1.5 into a separate skill file that qa-engineer Reads on demand via the existing Read tool cuts the always-loaded portion by ~500 tokens with zero server / TS change. The Phase 1.5 contract (skip-if-absent gating, 6 diff categories, 3 failure routes) is preserved verbatim.

## User Stories

- As a **qa-engineer agent on a non-UI feature**, I want to load only the Phase 1..4 SOP, so my context budget isn't wasted on a Visual Compare sub-phase that will skip anyway.
- As a **qa-engineer agent on a UI feature**, I want my SOP to instruct me to Read the visual sub-skill at the right moment, so the Phase 1.5 protocol stays accessible without manual intervention.
- As **anyone maintaining the QA SOP**, I want the visual gate to live in its own file so future visual-only changes (Phase 1.5 → Phase 1.6 baseline-mtime check, vision-model swaps, etc.) don't churn the core review SOP.

## Acceptance Criteria

- **AC-1 (Visual sub-skill file exists with the v3.8.2 Phase 1.5 contract preserved)**
  Given v3.8.3 is checked out,
  When the qa-engineer agent loads its skill,
  Then `content/skill-qa-visual.md` MUST exist and MUST carry: (a) the skip-if-absent gating logic, (b) the per-row Read+vision-diff contract, (c) the six diff categories (i layout / ii spacing / iii element presence / iv color / v text / vi image), (d) the three failure routes (visual drift → sr-engineer, missing baseline → design-auditor, missing impl → sr-engineer), (e) the PASS sub-verdict. The Phase 1.5 *content* must be functionally equivalent to v3.8.2; only the *location* changes.

- **AC-2 (Phase 1.5 inline block is removed from skill-qa-engineer.md)**
  Given v3.8.3,
  When skill-qa-engineer.md is loaded,
  Then it MUST NOT contain the v3.8.2 Phase 1.5 SOP block; in its place SOP step 4 MUST be a `Phase 1.5 — Visual Compare (lazy-load)` hook that instructs the agent to Read `content/skill-qa-visual.md` when `design/<feature>.md` contains a `## Visual Baselines` H2, and skip otherwise.

- **AC-3 (Lazy-load contract)**
  Given a workspace where `design/<feature>.md` lacks a Visual Baselines H2 (or design file is absent),
  When qa-engineer reaches SOP step 4,
  Then the agent MUST NOT Read `content/skill-qa-visual.md` (no-op skip; logs `Phase 1.5: skipped (no Visual Baselines declared)` in the review doc, same wording as v3.8.2).

  Given a workspace where `design/<feature>.md` carries a Visual Baselines H2,
  When qa-engineer reaches SOP step 4,
  Then the agent MUST Read `content/skill-qa-visual.md` and follow its SOP for each baseline row.

- **AC-4 (Phase numbering and cross-refs stable)**
  Given v3.8.3 skill-qa-engineer.md,
  When the file is read,
  Then SOP steps 1..7 MUST remain sequential with no duplicates (step 4 still carries the `Phase 1.5 — Visual Compare` label), and existing internal references to `Phase 1` / `Phase 2` / `Phase 3` / `Phase 4` remain valid.

- **AC-5 (Measurable token savings)**
  Given the post-split files,
  When their byte counts are compared to v3.8.2 baselines,
  Then `content/skill-qa-engineer.md` MUST shrink by ≥ 1200 bytes (≥ ~300 tokens) and `content/skill-qa-visual.md` MUST be ≤ 2400 bytes (≤ ~600 tokens). Net: non-UI workspaces save ~300 tokens per qa-engineer load; UI workspaces pay roughly the v3.8.2 total (one Read brings the visual sub-skill into context).

- **AC-6 (Backwards-compat with v3.8.2 audits and reviews)**
  Given an existing `design/<feature>.md` written under v3.8.2 (Visual Baselines section present),
  When v3.8.3 qa-engineer runs,
  Then the visual sub-skill MUST execute the same Phase 1.5 protocol on those baselines as v3.8.2 did — no migration required. The qa-engineer skill's other phases (0, 1, 2, 3, 4) are unchanged.

- **AC-7 (Zero compile/type errors)**
  Phase 3 touches only markdown under `content/` and version literals. `npm run build` MUST pass with zero errors before handoff.

## Copy / Strings

No user-facing product copy is introduced. Same documentation-trace precedent as v3.8.1 and v3.8.2.

| string id | exact text (quote verbatim) | source |
|---|---|---|
| sop.qa.phase15.lazy-load | `**Phase 1.5 — Visual Compare** (lazy-load): if `design/<feature>.md` contains a `## Visual Baselines` H2, Read `content/skill-qa-visual.md` and follow its SOP for each baseline row. Otherwise log `Phase 1.5: skipped (no Visual Baselines declared)` in the review doc and proceed to Phase 2.` | authored-here (replaces v3.8.2 inline block — implements AC-2 + AC-3) |
| sop.qa-visual.header | (verbatim transplant of v3.8.2 `content/skill-qa-engineer.md` Phase 1.5 block — see `content/skill-qa-visual.md` after T52 for the canonical text) | authored-here (file move, no semantic change — implements AC-1) |

## Visual Tokens

N/A — markdown only.

## Out of Scope

- **Server-side conditional inject** — explicitly rejected by user during scope clarification; SOP-only lazy Read keeps `prompts/build.ts` unchanged.
- **Separate role + tw_switch_role** — explicitly rejected; would double-load the constitution and add 5 files (prompt, transitions, schema enum, role-skill map, index wire-up) for no fidelity gain.
- **Further splitting** (e.g., separate copy-audit-gate / visual-audit-gate sub-skills) — premature. The two literal gates remain in the core qa-engineer skill since they fire on *every* feature with a spec, not just UI ones.
- **Baseline mtime staleness check** — `research/skill-token-cost-and-pixel-perfect-success-rate.md` § Recommendation §2 deferred.
- **Phase 3 (Playwright VRT)** — still out of scope per the original research.

## Dependencies / Prerequisites

- **v3.8.2** — Phase 1.5 source-of-truth content lives here; T52 transplants it verbatim into `content/skill-qa-visual.md`. Already shipped.
- **research/skill-token-cost-and-pixel-perfect-success-rate.md** — `index` (workspace-internal; this spec implements its Recommendation watch-item).
- **research/pixel-perfect-and-design-coverage.md** — `index` (workspace-internal; the Phase 1.5 origin).
- **content/skill-qa-engineer.md** — must exist; primary edit target.
- **No external references** require fetching. All `file://` links in the prerequisite research files are workspace-internal.
- **Version bump** — backwards-compatible reorganisation (AC-6 guarantees v3.8.2 audits keep working). Ship as **v3.8.3** (patch).
- **Deferred surfaces** (auditor manifest) — N/A: this is internal MCP work with no design source.
