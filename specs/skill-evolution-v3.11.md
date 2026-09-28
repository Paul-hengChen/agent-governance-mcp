<!-- @pm | feature_id: skill-evolution-v3.11 | created_at: 2026-05-28 | research_basis: research/process-retrospective.md -->

# Skill Evolution v3.11 — researcher / coordinator-lite / code-reviewer refinement + doc-writer + release-engineer

## Problem Statement

The v3.9 architecture-and-skills evaluation (`research/process-retrospective.md`) surfaced three pieces of skill debt: (1) **researcher / coordinator-lite are too terse** vs the rest of the role family — researcher has no depth control or source-quality discipline; coordinator-lite has no concrete scope-creep examples to teach the boundary with `/teamwork`; (2) **code-reviewer's Review Report Schema lacks a Performance section** — O(n²) loops, unbatched I/O, and obvious memory leaks slip through into qa; (3) **two high-value roles are missing**: a `doc-writer` to keep CHANGELOG / README / docs synchronised with code after PASS, and a `release-engineer` to own version bumps, tags, and GitHub releases (today these are ad-hoc human work, with this very session producing v3.9.0 → v3.9.1 → v3.10.0 manually). Constitution §6 additionally lacks any dependency-audit rule even though the build gate is the natural place to run `npm audit` / `cargo audit`.

This release ships the **minimum-surface** version of all five fixes: both new roles are **side-channel agents** (skill files + prompts + `tw_switch_role` enum widening only — NOT inserted into `ALLOWED_TRANSITIONS`, so no schema bump and no breaking change for in-flight tickets). Multi-agent chain semantics (qa → release-engineer terminal step) are explicitly **deferred** to a later release once usage data justifies the schema cost.

## User Stories

- As a coordinator, I want to route doc-update or release-bump requests to specialised agents instead of treating them as ad-hoc sr-engineer work, so that CHANGELOG drift and version-coherence bugs stop recurring.
- As a researcher, I want a declared `depth` (shallow / deep) up front, so I don't spend 60 minutes researching a 5-minute lookup, and downstream PM knows the confidence weight of my findings.
- As a downstream PM, I want every Evidence row to carry a source-credibility tier (T1 / T2 / T3), so a recommendation backed only by blog posts (T3) doesn't pass unchallenged.
- As a code-reviewer, I want a Performance section in my review schema, so I'm forced to scan for O(n²) loops, unbatched I/O, and obvious memory leaks before forwarding to qa.
- As a solo-dev using `/teamwork-lite`, I want concrete examples of "looks lite but should be full" cases, so I don't simulate the chain when I should escalate.
- As a security-conscious operator, I want `npm audit` / `cargo audit` (or language equivalent) gating the build, so dependency CVEs surface before merge.

## Acceptance Criteria

### AC-1 — `content/skill-doc-writer.md` exists with required schema

**Given** there is no `content/skill-doc-writer.md` today
**When** the implementation lands
**Then** the file MUST exist with H2 sections in order: **Persona** (one-paragraph staff-level technical writer), **Output rule** (≤ 1 sentence chat; final reply `Done. Doc updates in <files>.`), **Hard rules** (no API/spec changes; reads code + CHANGELOG only; doc edits must preserve every code-cited fact verbatim), **Artifact** (which files the role is allowed to write: `README.md`, `CHANGELOG.md`, `docs/**/*.md`, in-tree `*.md` excluding `specs/` / `content/` / `qa_reports/` / `review_reports/` / `research/`), **SOP** (1. `tw_get_state` + `tw_detect_drift`; 2. read the PASS handoff's `completed_tasks` + `qa_review`; 3. diff README/CHANGELOG vs implementation; 4. write doc updates; 5. `tw_update_state(status=In_Progress, pending_notes=[…, "next_role: <whoever called you>"])`).

### AC-2 — `content/skill-release-engineer.md` exists with required schema

**Given** there is no `content/skill-release-engineer.md` today
**When** the implementation lands
**Then** the file MUST exist with H2 sections in order: **Persona** (one-paragraph staff-level release engineer), **Output rule** (≤ 1 sentence chat; final reply `Done. Released <tag>.`), **Hard rules** (only fires when prior handoff is `(qa-engineer, PASS)` — verify in SOP step 1; refuses to bump major version without explicit user opt-in; never force-pushes tags; always uses HEREDOC for commit messages; passes `scripts/check-version.mjs` before tag), **Artifact** (which files the role writes: `package.json`, `index.ts` Server() literal, `CHANGELOG.md`, `README.md` install pins, `dist/` rebuild), **SOP** (1. `tw_get_state` + `tw_detect_drift` + PASS-precondition check; 2. ask user for bump kind (`patch` / `minor` / `major`); 3. apply bumps; 4. `npm run build`; 5. `npm test` + `node scripts/check-version.mjs`; 6. `git commit` + `git tag -a v<X.Y.Z>` + `git push origin <branch> v<X.Y.Z>`; 7. `gh release create`; 8. `tw_update_state(status=In_Progress, pending_notes=["Released v<X.Y.Z>", "next_role: coordinator"])`).

### AC-3 — Prompt + role registration for both new roles

**Given** the server registers 8 prompts today (teamwork, teamwork-lite, sr-engineer, pm, architect, researcher, qa-engineer, code-reviewer, design-auditor — 9 actually)
**When** the implementation lands
**Then**:
- `prompts/doc-writer.ts` MUST exist, calling `buildPromptForRole("doc-writer")`, mirroring `prompts/code-reviewer.ts` shape.
- `prompts/release-engineer.ts` MUST exist, same shape.
- `index.ts` MUST register both prompts (`ListPromptsRequestSchema` + `GetPromptRequestSchema` dispatcher cases).
- `tools/role.ts` `ROLE_SKILL_MAP` MUST include `"doc-writer": "skill-doc-writer.md"` and `"release-engineer": "skill-release-engineer.md"`.
- The `tw_switch_role` zod enum AND JSON inputSchema enum in `index.ts` MUST be widened to include both new role names.

### AC-4 — Side-channel constraint (no `ALLOWED_TRANSITIONS` edges)

**Given** the v3.9.0 transition matrix is in `tools/transitions.ts`
**When** the implementation lands
**Then**:
- `AgentName` union MUST NOT be widened.
- `ALLOWED_TRANSITIONS` MUST NOT gain any `doc-writer:*` or `release-engineer:*` keys.
- No `schema_version` constants change (`CURRENT_VERSIONS.handoff` stays at 2; `CURRENT_VERSIONS.sqlite` stays at 2).
- Neither new role MAY call `tw_update_state` with `agent_id` set to its own name from inside the existing chain — they invoke `tw_update_state` with `agent_id` matching whatever upstream agent loaded them (typically `qa-engineer` for post-PASS work). The skill files MUST document this constraint explicitly under Hard rules.
- Rationale: minimum-surface ship. Chain semantics deferred until usage data warrants the schema cost. Compatible with `#v3.10.0` consumers — no breaking change.

### AC-5 — `content/skill-researcher.md` depth control + source tier + recency gate

**Given** `content/skill-researcher.md` today has only a Findings Schema with five sections and no depth or source-quality discipline
**When** the implementation lands
**Then** the file MUST add:
- A new **Depth** clause under Hard rules declaring two depths: `shallow` (≤ 15 min, ≥ 1 source, condensed to 3 bullets — used for lookups and feasibility sniff-tests) and `deep` (≤ 60 min, ≥ 3 sources spanning ≥ 2 tiers, full Findings Schema). The coordinator or PM MUST declare the depth in `pending_notes` when invoking researcher; researcher MUST honour it.
- A **Source Credibility Tier** clause under the Findings Schema describing three tiers — `T1` (official docs, RFCs, standards-body publications, peer-reviewed papers), `T2` (recognised authors, well-known engineering blogs from companies with skin in the game, MCP / Anthropic official posts), `T3` (random blogs, Stack Overflow, Reddit) — and requiring Evidence rows to suffix each citation with `[T<N>]`. Recommendations supported only by T3 sources MUST flag this explicitly under Open Questions.
- A **Recency Gate** clause: any technical source older than 18 months MUST be tagged `(stale)` in Evidence; deep-depth research MUST include ≥ 1 source ≤ 12 months old per major claim, otherwise flag under Open Questions.

### AC-6 — `content/skill-coordinator-lite.md` scope-creep examples

**Given** today's coordinator-lite Hard rules list only the abstract scope-creep tripwires (≥ 3 files / new public API / needs tests / design decision)
**When** the implementation lands
**Then** the file MUST gain a new **Scope-creep examples** clause (separate from Hard rules, after the SOP) listing exactly 3 concrete cases that LOOK lite but require `/teamwork` escalation, each ≤ 2 lines: (a) "Add a single config option" — touches both `tools/config.ts` and `tasks/handoff` schema → 2 files + schema change → full; (b) "Refactor a 30-line helper" — innocent until grep reveals 8 callers → cross-module → full; (c) "Add a CLI flag" — needs test coverage by definition → full. Solo-dev edits that genuinely stay lite get a one-line affirmative example: "Fix a typo in README.md" → lite.

### AC-7 — `content/skill-code-reviewer.md` Performance section in Review Report Schema

**Given** today's Review Report Schema has 6 H2 sections: Summary / Correctness / Quality / Architecture / Security / Verdict
**When** the implementation lands
**Then** the schema MUST insert a new **Performance** section between Security and Verdict, with this body: "O(n²) loops in hot paths, unbatched I/O (loops that should be batch queries / pipelined fetches), obvious memory leaks (event listeners not removed, caches with no eviction), and any algorithmic regression vs the prior implementation. Cite file:line. PASS criterion: no performance regression vs base; new code carries no obvious complexity-class issues. This is review for *obvious* regressions only — micro-benchmarking is qa-engineer scope." Existing Reports section ordering changes from 6 to 7 sections; all skill SOP references that count sections MUST update.

### AC-8 — Constitution §6 dependency-audit amendment

**Given** today's §6 covers only `.env*` / `*secret*` / `*ignore` file access
**When** the implementation lands
**Then** §6 MUST gain a new bullet: "**Dependency audit at build gate**: every role that calls `npm run build` / `cargo build` / `pip install` / equivalent MUST also run the language's dependency-audit command (`npm audit --audit-level=high`, `cargo audit`, `pip-audit`) and treat any HIGH or CRITICAL finding as a build failure unless explicitly waived in the PR description with rationale. The audit runs after build, before `tw_update_state`. Toolchains without an audit command waive the rule for that toolchain." Constitution header bumps `v3.10.0` → `v3.11.0`. No other §1-§7 mutations.

### AC-9 — Version bump + release artifacts

**Given** `package.json` and `index.ts` Server() literal are at `3.10.0`
**When** the implementation lands
**Then**:
- `package.json.version` MUST be `3.11.0`.
- `index.ts` Server() literal MUST be `3.11.0`.
- `CHANGELOG.md` MUST have a `[3.11.0]` entry with `### Added` (doc-writer + release-engineer skills + prompts), `### Changed` (researcher depth/tier/recency, coordinator-lite scope-creep examples, code-reviewer Performance section, constitution §6 dependency audit), `### Notes` (side-channel only — no transition-matrix or schema changes).
- `README.md` MUST gain a new release-notes subsection after `#### (m) Conditional test writing` (currently the v3.10.0 entry). Subsequent letters renumber per existing convention.
- All `#v3.10.0` install pins in `README.md` MUST bump to `#v3.11.0`.
- `npm run build` MUST produce ZERO compile errors and refresh `dist/`.
- `scripts/check-version.mjs` MUST pass.

### AC-10 — Test coverage (qa-engineer authored)

**Given** the existing test suite (297 green at v3.10.0)
**When** the implementation lands
**Then** new tests MUST cover:
- `tools/role.ts`: `ROLE_SKILL_MAP` contains `"doc-writer"` and `"release-engineer"` mapped to their respective skill files; both skill files exist on disk.
- `index.ts`: `tw_switch_role` zod enum accepts both new role names; rejects an unknown role (regression).
- `index.ts`: `ListPromptsRequestSchema` returns both `doc-writer` and `release-engineer` prompts; `GetPromptRequestSchema` dispatcher resolves them without throwing.
- `tools/transitions.ts`: `AgentName` union is UNCHANGED (regression — the side-channel constraint AC-4 must hold).
- `schema/versions.ts`: `CURRENT_VERSIONS.handoff === 2` and `CURRENT_VERSIONS.sqlite === 2` (regression — no schema bump).
- Skill-file schema sanity: each of `skill-doc-writer.md` / `skill-release-engineer.md` / `skill-researcher.md` / `skill-coordinator-lite.md` / `skill-code-reviewer.md` contains the H2 sections mandated by ACs 1, 2, 5, 6, 7 respectively. Grep-based assertions are sufficient (no AST parsing required).
- Constitution §6 contains the dependency-audit bullet substring `Dependency audit at build gate`.
- AC-7 version-coherence test (currently at 3.10.0) bumps to 3.11.0.
- Pre-existing 297-green baseline holds.

### AC-11 — Side-channel `tw_switch_role` widening regression

**Given** the existing test suite has no test enumerating the `tw_switch_role` enum
**When** the implementation lands
**Then** add a positive regression test: `tw_switch_role(role="doc-writer")` returns the doc-writer SOP body (string contains `# Skill: doc-writer`); same for `release-engineer`. Rejecting unknown roles is already covered by zod and need not be duplicated.

## Copy / Strings

| string id | exact text | source |
|---|---|---|
| role_doc_writer | `doc-writer` | authored-here — new agent identifier; hyphenated to match existing role naming convention (`design-auditor`, `code-reviewer`, `sr-engineer`, `qa-engineer`) |
| role_release_engineer | `release-engineer` | authored-here — new agent identifier; same naming convention |
| skill_doc_writer_file | `skill-doc-writer.md` | authored-here — mirrors existing `skill-*.md` pattern |
| skill_release_engineer_file | `skill-release-engineer.md` | authored-here — same pattern |
| const_dependency_audit_header | `Dependency audit at build gate` | authored-here — new §6 bullet anchor for grep stability |
| researcher_depth_shallow | `shallow` | authored-here — depth literal used by coordinator/PM in `pending_notes` when invoking researcher |
| researcher_depth_deep | `deep` | authored-here — same |
| researcher_tier_t1 | `T1` | authored-here — credibility tier literal; brevity over verbosity to keep Evidence tables compact |
| researcher_tier_t2 | `T2` | authored-here |
| researcher_tier_t3 | `T3` | authored-here |
| researcher_stale_marker | `(stale)` | authored-here — Recency Gate marker |
| changelog_3_11_0_header | `## [3.11.0] - 2026-05-28` | authored-here — release entry header; date matches workspace `currentDate` |

## Visual Tokens

N/A — internal MCP-server infrastructure; no UI surface introduced or changed.

## Out of Scope

- Inserting doc-writer or release-engineer into `ALLOWED_TRANSITIONS` (deferred per user decision; side-channel only).
- Schema versioning bumps (no handoff or sqlite schema changes in this release).
- §5 token / cost budget amendment (user declined for this release).
- §2 commit convention amendment (user declined for this release).
- Auto-triggering doc-writer / release-engineer (no event hooks). They are manually invoked via `tw_switch_role`.
- The other report-recommended new role `refactor-planner` (deferred — single-shot research first).
- Architect ADR sections (P1 in report, but out of scope for this release per user-implied focus on the three named items).

## Dependencies / Prerequisites

- Research artifact `research/process-retrospective.md` (audited 2026-05-28 by PM; all external references resolve to workspace-internal `file:///` paths — no fetch required).
- Existing prompt-builder infrastructure (`prompts/build.ts:buildPromptForRole`) — reused by both new prompts.
- Existing `tools/role.ts` `ROLE_SKILL_MAP` — extended, not rewritten.
- Existing constitution authoring conventions (header version, §-numbered sections) — followed verbatim.
- No deferred external resources.
