# Changelog

All notable changes to `agent-governance-mcp` are documented here.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/)
and the project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## Versioning policy

- **Install via tagged ref**: `npx -y github:Paul-hengChen/agent-governance-mcp#v<version>`.
- `main` is the development branch; pinning to a tag is the supported way to use this server.
- **MAJOR** bumps signal breaking changes to the MCP tool surface, prompt schema, or
  handoff/state file format. Re-read this changelog before upgrading across a MAJOR.
- **MINOR** bumps add backwards-compatible tools, role skills, or storage features.
- **PATCH** bumps are bug fixes, doc clarifications, and internal refactors with no
  observable behavior change.

## [Unreleased]

## [3.8.3] - 2026-05-26

### Changed
- **`skill-qa-visual.md` extracted from `skill-qa-engineer.md`** — the
  v3.8.2 Phase 1.5 SOP block (skip-if-absent gate, six diff categories,
  three failure routes, PASS sub-verdict, rationale) was moved verbatim
  into a new `content/skill-qa-visual.md`. `skill-qa-engineer.md` step 4
  shrinks to a 3-line lazy-load hook that instructs the agent to Read
  the sub-skill *only* when `design/<feature>.md` declares a
  `## Visual Baselines` H2.
- **Token impact** — non-UI workspaces (server logic, CLI, this MCP
  repo) save ~300 input tokens on every qa-engineer load. UI workspaces
  pay roughly the v3.8.2 total: the Read brings the sub-skill into
  context on demand. Motivated by
  `research/skill-token-cost-and-pixel-perfect-success-rate.md`
  § Recommendation watch-item (`skill-qa-engineer.md` was 2.17K tokens,
  27% larger than the next-biggest skill).

### Backwards-compatible
- Phase 1.5 contract is unchanged: same skip-if-absent gating, same six
  diff categories, same three failure routes (visual drift → sr-engineer,
  missing baseline → design-auditor, missing impl → sr-engineer), same
  PASS sub-verdict. v3.8.2 `design/<feature>.md` files with Visual
  Baselines declarations execute the same protocol.
- No server tool surface, prompt schema, ALLOWED_TRANSITIONS, or
  handoff/state format change. No new role registered. Pure SOP-text
  reorganisation.
- SOP step numbering 1..7 in `skill-qa-engineer.md` is preserved; Phase
  N labels remain stable so internal cross-refs keep working.

### Notes
- Spec: `specs/qa-visual-skill-split.md`.
- Mechanism chosen: SOP-only lazy Read (rejected alternatives:
  server-side conditional inject, separate role with `tw_switch_role`).

## [3.8.2] - 2026-05-26

### Changed
- **`design-auditor` Artifact Schema** (`content/skill-design-auditor.md`): new
  OPTIONAL `**Visual Baselines**` H2 section. 4-column table
  `surface id | baseline path | impl path | notes`. `surface id` MUST match a
  *Source manifest* row; `baseline path` is workspace-relative to whatever
  image file the design source produced (Figma / Sketch / XD / Penpot export,
  PDF page rendered to PNG, raw mockup file, photo); `impl path` is
  workspace-relative to where the QA agent expects the implementation
  screenshot at QA time. Absence of the section is the explicit no-op signal
  to QA Phase 1.5.
- **`skill-qa-engineer` SOP** — new step 4 `**Phase 1.5 — Visual Compare**`
  inserted between Phase 1 (3a Copy Audit / 3b Visual Audit) and Phase 2.
  Skip-if-absent gating against `design/<feature>.md` *Visual Baselines*.
  For each row, QA Reads both PNGs (multimodal context) and emits a
  structured diff covering layout / spacing / alignment / element presence
  / color / text / image content into the review doc. Three failure routes:
  visual drift → sr-engineer; missing baseline file → design-auditor;
  missing impl file → sr-engineer. Prior steps 4–6 renumber to 5–7
  (`Phase 2 — Discussion`, `Phase 3 — Tests`, `Phase 4 — Run`); the
  *Phase N* labels are unchanged so internal cross-refs remain stable.

### Backwards-compatible
- `design/<feature>.md` files written under v3.8.1 (Source manifest present,
  no Visual Baselines section) cause QA Phase 1.5 to skip silently — no
  retroactive migration. Phase 1 behavior is unchanged.
- Non-UI features (server logic, CLI tools, this MCP repo) pay zero
  Phase 1.5 overhead because they declare no Visual Baselines.
- Server tool surface unchanged. No new `tw_*` tool, no
  ALLOWED_TRANSITIONS edits, no handoff/state format change. Pure
  skill-text refinement.

### Notes
- Phase 2 of `research/pixel-perfect-and-design-coverage.md` — the
  vision-LLM screenshot-compare arm. Phase 3 (Playwright VRT) remains
  out of scope.
- SOP-only delivery (no `tw_visual_compare` tool); vision capability is
  provided by the QA agent's host LLM, not via the Figma REST API or any
  pixel-diff library.
- Spec: `specs/pixel-perfect-visual-compare.md`.

## [3.8.1] - 2026-05-26

### Changed
- **`design-auditor` Source manifest is now exhaustive + status-tagged**
  (`content/skill-design-auditor.md` Artifact Schema): every surface in
  the design source (Figma frame, Sketch / XD artboard, Penpot board,
  PDF page, image / photo file) MUST appear in the manifest, tagged
  `status: audited | deferred | out-of-scope` with a one-line reason for
  non-`audited` rows. Replaces the old behaviour of audit-only-task-
  referenced-frames + cite-the-rest-in-Out-of-Scope, which silently
  dropped frames the task description did not name.
- **`design-auditor` multi-pass is now explicit** — Hard rules upgraded
  from single-pass `Token-frugal` to `Token-frugal multi-pass`: ≤ 250
  lines per pass, up to 5 passes per feature, each follow-up pass MUST
  flip ≥ 1 `deferred` row to `audited`. No-op passes forbidden
  (constitution §5 anti-loop).
- **`skill-pm` Deferred-surface gate** (`content/skill-pm.md` SOP step 2):
  PM MUST enumerate every `status: deferred` manifest row (pointer +
  reason) under the spec's *Dependencies / Prerequisites* section, so
  the team knows which surfaces ship without coverage.

### Backwards-compatible
- Older `design/<feature>.md` artifacts written before v3.8.1 lack the
  status column and require no retroactive migration. Downstream roles
  treat the listed surfaces as `audited` and any unknown surfaces as
  `unknown`.
- `no-design` mode is unchanged: empty manifest, single pass, no gate
  activation.
- Server tool surface unchanged. No prompt schema, ALLOWED_TRANSITIONS,
  or handoff/state format change. Pure skill-text refinement.

### Notes
- Phase 1 of `research/pixel-perfect-and-design-coverage.md`. Phase 2
  (vision-LLM screenshot compare) and Phase 3 (Playwright VRT) remain
  out of scope.
- Spec: `specs/pixel-perfect-design-coverage.md`.

## [3.8.0] - 2026-05-21

### Added
- **`design-auditor` role** — new optional pre-PM role registered in
  `tools/transitions.ts`, `tools/role.ts`, `prompts/design-auditor.ts`,
  and `index.ts` prompt list. Reads any design source — Figma, Sketch,
  Adobe XD, Penpot, PDF mockup, PNG screenshot, paper photo — and
  produces `design/<feature>.md` with verbatim *Copy / Strings* and
  *Visual Tokens* tables that PM copies into the spec.
  Source-agnostic: detects mode from the supplied design surface and
  picks the matching extraction strategy. Never assumes Figma. Tasks
  with no design reference skip the auditor entirely (zero per-prompt
  overhead — the skill is not loaded).
- **`skill-coordinator` Design-source detection** — coordinator scans
  every incoming PRD / ticket / user prompt for design-source patterns
  (`figma.com`, `sketch.cloud`, `xd.adobe.com`, `penpot.app`, `marvelapp`,
  `invisionapp`, `framer`, `.fig` / `.sketch` / `.xd` / `.penpot`, plus
  mockup-context `.pdf` / `.png` / `.jpg`, plus EN / 中文 / 日本語
  design keywords). On hit → routes to `design-auditor` before PM.
- **ALLOWED_TRANSITIONS** — three new edges:
  `null → design-auditor:In_Progress` (coordinator entrypoint),
  `researcher:In_Progress → design-auditor:In_Progress` (chain after
  researcher), `pm:In_Progress → design-auditor:In_Progress` (PM
  re-route when refs surface late). Exit edges:
  `design-auditor:In_Progress → pm:In_Progress` and
  `design-auditor:Blocked → {design-auditor, pm}:In_Progress`.

### Changed
- **`skill-pm` SOP step 2** — PM must now copy `design/<feature>.md`'s
  *Copy / Strings* and *Visual Tokens* tables verbatim into the spec
  when a design audit exists. Additional entries authored by PM stay
  flagged `authored-here` per the existing spec schema rule.
- **Constitution §4 routing chain** — adds the optional design-auditor
  hop with a one-paragraph explanation of when it fires.

### Token economy

The design-auditor's skill markdown is only loaded when (a) the
coordinator detects a design source and (b) routes to it via
`tw_switch_role` or the dedicated prompt. The routine 80% case
(refactors, infra, bug fixes, server-side work) bypasses it entirely.
The new skill file is intentionally ≤ 80 lines so even active runs
stay token-frugal — comparable to `skill-researcher` (24 lines) +
`skill-pm` (44 lines). No new MCP tools added; the role reuses
existing `tw_*` surface.

## [3.7.4] - 2026-05-21

### Added
- **`skill-pm` Visual Tokens H2** (Spec Schema, between Copy / Strings
  and Out of Scope). Every concrete literal-valued visual property —
  hex color, sp font size, dp dimension, weight, radius, stroke,
  opacity — must be enumerated in a 4-column table `token id |
  property | value | source` with the source quoted from a Figma node
  id, fill / text-style name, design-system token name, or
  `authored-here` with a one-line justification. Layout proportions
  (`weight(1f)`), runtime values, and platform defaults are explicitly
  excluded. PM blocks if any literal lacks a source.
- **`skill-qa-engineer` Visual Audit Gate** (Phase 1 step 3b). QA
  greps the source tree for each spec'd literal and FAILs on drift
  (impl ≠ spec), coverage gap (impl literal missing from spec —
  bounces to PM), or — when Figma MCP is available — source rot
  (Figma value changed after spec was written).

### Why
v3.7.3's Copy Audit Gate fixed text drift. Visual properties (colors,
spacing, typography literals) still relied on PM-authored stylistic
ACs, which only catch what the spec already enumerates. An unsourced
hex slipping into `OobeTheme.kt` — exactly what kicked off the
`cde-oobe-figma-alignment` re-work — stayed invisible. v3.7.4 makes
every literal a tracked, sourced contract, audited at QA time. This is
the cheapest of the four design-fidelity options surveyed in
`research/design-fidelity-enforcement.md`; pixel-baseline approaches
(Paparazzi against Figma exports) remain out of scope.

## [3.7.3] - 2026-05-21

### Added
- **`skill-pm` Copy / Strings H2** (Spec Schema). Every spec must now
  enumerate every user-facing string the feature introduces or changes
  in a 3-column table `string id | exact text | source`. *Source* must
  be a PRD section number, a Figma node id, a CSV/ticket ref, or the
  literal token `authored-here` with a one-line justification. PM
  blocks if any string lacks a source.
- **`skill-qa-engineer` Copy Audit Gate** (Phase 1 step 3a). QA now
  greps the source tree for each spec'd string and FAILs on either
  drift (impl ≠ spec) or coverage gap (impl introduces a string not in
  the spec — bounces back to PM, not sr-engineer).

### Why
The `cde-oobe` implementation shipped titles like `"Select your language"`
that the engineer (correctly) had no source for — the PRD only said
"功能：選取系統主要語系". The Figma title was literally `"Language"`.
Stylistic ACs (font/color/size) passed cleanly because they tested
the *style*, not the *text*. v3.5.3 closed the "did anyone fetch the
design?" gap; v3.7.3 closes the "did anyone audit the words?" gap.

## [3.7.2] - 2026-05-21

### Added
- **Constitution v3.5.3 — External-reference policy** (`content/constitution.md` §7).
  A spec referencing external artifacts (URLs, Figma/Sketch files, ticket IDs,
  mockups, "see XYZ" prose) is presumed *incomplete* until each reference is
  (a) fetched, (b) indexed via `tw_index_prd`, or (c) user-confirmed as
  ignorable. No role may unilaterally treat a reference as out-of-scope.
- **`skill-pm` Resource Audit Gate** (new SOP step 3). PM must grep every
  supplied requirement doc for `http(s)://`, `figma`, `sketch`, `mockup`,
  `設計圖`, `URL`, `link`, `Azure DevOps`, `JIRA` and ask the user
  `fetch / index / ignore` per hit before writing the spec. Decisions are
  recorded in the spec's *Dependencies / Prerequisites* section.
- **`skill-architect` Deferred Resources section + Sanity Gate** (Artifact
  Schema + new SOP step 4). Architect must cross-check every PM-deferred
  reference against the spec and block if any spec reference is missing
  from `Deferred Resources` — closes the loophole where architect
  silently dropped a Figma URL during the `cde-oobe` rollout (2026-05-20).

### Why
First triggered when the CDE OOBE wizard shipped without ever loading the
Figma mockup linked seven times in the PRD. Architect's own design doc had
unilaterally declared the link out-of-scope; nothing in the SOPs forced a
user confirmation. These three changes turn "did anyone fetch the link?"
into a server-enforced gate via the spec/architecture artifacts.

## [3.7.1] - 2026-05-20

### Changed
- **`handoff.md` write path emits English headers.** `bin/agc-init.mjs`
  scaffold and `tools/handoff.ts` `writeHandoffState` now produce
  `# Handoff State / ## Completed / ## Pending & Handoff Notes` (and
  `- (none)` empty-section sentinel) instead of the mixed Chinese +
  English template. Parser keeps bilingual section regex and continues
  to recognize the legacy `無` sentinel, so existing handoff.md files
  parse unchanged. No tool surface or schema change.

## [3.7.0] - 2026-05-20

### Added
- **`agc init` CLI** (`bin/agc-init.mjs`). Scaffolds an
  agent-governance-managed workspace in one command:
  `.current/handoff.md`, `.current/.config.json`, and `tasks.md` with
  sane defaults. Idempotent — existing files are skipped, no `--force`
  flag. Wired as the `agc` bin in `package.json`; invoke via
  `npx -y --package=github:Paul-hengChen/agent-governance-mcp#v3.7.0 agc init`.
  Closes P0 onboarding item from `research/agc-value-proposition-2026-05-20.md`.

### Changed
- **SessionStart hook defaults to `skill-coordinator-lite.md`**
  (`bin/agent-governance-context.mjs`). Solo-dev direct-execute is now
  the default boot mode; the intro prose names "Coordinator-Lite mode"
  and points at `/teamwork` for cross-module work. Existing managed
  workspaces see the lite skill on next session start with no config
  change.
- **Full coordinator opt-in via `AGC_DEFAULT_SKILL=full`**. Setting this
  env var in the Claude Code session env restores the previous full
  coordinator skill + intro prose verbatim. No breaking change to the
  `/teamwork` or `/teamwork-lite` prompts themselves — both keep their
  v3.6.x behavior; only the hook default flipped.

### Tests
- 8 new tests in `test/p0-onboarding-lite-default.test.mjs` covering
  scaffold happy path, idempotency, parseHandoff round-trip, bin
  wiring, both hook variants, and CLI usage/silent-no-op smoke tests.
  Suite: 243/243 passing.

## [3.6.1] - 2026-05-20

### Fixed
- **`skill-coordinator-lite.md` slimmed** (2502 → 1097 bytes, -56%). The
  v3.6.0 lite skill was paradoxically *larger* than the full coordinator
  skill, making the `teamwork-lite` prompt 120 tokens heavier than
  `teamwork` at load time — contradicting the lite-mode value
  proposition. Trimmed to essentials while preserving the section
  contract (`Persona`, `When to use`, `Hard rules`, `SOP`, `Output rule`)
  the integration tests rely on.
- **Result**: `teamwork-lite` prompt is now ~228 tokens (-13%) smaller
  than `teamwork` at load time. Per-task savings (chain skipping) are
  unchanged from v3.6.0.

## [3.6.0] - 2026-05-20

### Added — Lite Mode Coordinator (`/teamwork-lite`)
First architectural response to the post-fusion value audit
(`research/value-assessment.md`), which identified the multi-role chain
as net overhead for solo-dev daily work. Spec:
`specs/lite-mode-coordinator.md`.

- **New prompt `teamwork-lite`** — solo-dev minimal-overhead entry
  point. Loads the full constitution (single source of truth preserved)
  plus a new lighter skill `content/skill-coordinator-lite.md` that
  documents direct-execute orientation: no `tw_switch_role`, no
  `tw_detect_drift` by default, no chain routing.
- **Lite is server-read-only by design.** `tools/transitions.ts`
  `AgentName` is intentionally unchanged — lite has no valid `agent_id`
  in the routing chain, so it cannot call `tw_update_state` /
  `tw_complete_task` / `tw_add_task` / `tw_rollback_task`. This is
  documented as a hard rule in the skill. Work that needs handoff
  tracking should use `/teamwork` (full).
- **`RAG_SKIP_ROLES`** now also skips `teamwork-lite` — triage doesn't
  need PRD chunks.
- **6 new integration tests** (`test/teamwork-lite.test.mjs`) exercise
  the prompt registration, dispatch, RAG skip, and skill content.
  Total suite: 235/235 pass.
- **README Step 5** documents when to use lite vs full and what lite
  skips.

### Migration
- Additive only — existing prompts and behavior unchanged. Users opt
  into lite mode by invoking the new prompt; no config flag, no
  workspace change.

## [3.5.2] - 2026-05-20

### Added — YAGNI Single-Use (Constitution v3.5.2)
Closes the single remaining medium-high gap from the post-v3.5.1 audit
(`research/post-v3.5.1-coverage-audit.md`). Spec:
`specs/constitution-v3.5.2-yagni-single-use.md`.

- **§1 MVP strict** extended (from R2): `No abstractions for single-use
  code.` Concrete YAGNI rule — distinct from "no speculative refactors"
  (which targets *edits*) by targeting *new code shape* (e.g. a base
  class with one subclass, a helper hook with one caller).

### Status
- The 12-rule template fusion cycle is now considered **complete**. R5
  and R6 remain deferred (need server-side enforcement); all other
  rules either fully covered or correctly scoped to skill files.

### Migration
- Content-only. No code or schema changes.

## [3.5.1] - 2026-05-20

### Added — Rule Completeness (Constitution v3.5.1)
Three gaps in the v3.5.0 fusion (vs the original 12-rule template) closed —
spec: `specs/constitution-v3.5.1-rule-completeness.md`.

- **§1 Surgical changes** (new bullet, from R3): "Touch only what the task
  requires. Don't 'improve' adjacent code, comments, or formatting. Clean
  up only your own mess." Complements `MVP strict` (which limits *what*
  is added) by limiting *what is edited*.
- **§2 Match conventions** extended (from R11): "Conformance > personal
  taste; if a convention is genuinely harmful, surface it — don't fork
  silently." Prevents agents from quietly drifting from house style.
- **§7 Fail loud** extended (from R12): `"Tests pass" is wrong if any
  were skipped.` Explicit qa-engineer guardrail against partial-test PASS.

### Migration
- Content-only — no code or schema changes. Pin to `#v3.5.1` to receive
  the updated constitution; agents will see the new rules on next
  session-start.

## [3.5.0] - 2026-05-20

### Added — Cognitive Discipline (Constitution v3.5.0)
Cross-references: research `research/claude-md-12-rule-fusion.md`, spec
`specs/constitution-v3.5-cognitive-discipline.md`. Five high-value rules
extracted from the 12-rule CLAUDE.md template (R1, R4, R7, R8, R12) and
fused into a new constitution §7 — ~100-token addition for the
"thinking quality" dimension the prior process-compliance rules lacked.

- **New §7 Cognitive Discipline** with 5 bullets: Think first,
  Goal-driven, Surface conflicts, Read before write, Fail loud.
- **§2 new bullet — Match conventions** (from R11): follow existing
  codebase style before introducing new patterns; grep when in doubt.
- **`skill-qa-engineer` new Hard rule — Tests verify intent** (from R9):
  tests must encode WHY (contract/invariant), not just WHAT.

### Deferred (intentional)
- R5 (use model only for judgment) — implicitly satisfied by the
  tool-driven MCP architecture.
- R6 (token budgets 4k/task, 30k/session) — needs server-side tracking
  to be enforceable; deferred per research open question #1.

### Migration
- Content-only — no code or schema changes. No action required.

## [3.4.0] - 2026-05-20

### Added — Schema Versioning (Phase 4)
- **Lazy migrate-on-read** across all four persisted artifacts: handoff YAML
  frontmatter, `tasks.md` sentinel, SQLite (`PRAGMA user_version`), and
  `.current/.config.json`. Older files are detected by missing/lower
  `schema_version` and upgraded transparently on the next read; no manual
  migration step.
- New module `schema/versions.ts` (current version constants, registries).
- New migration runners — `schema/migrations-handoff.ts`,
  `schema/migrations-tasks.ts`, `schema/migrations-sqlite.ts`,
  `schema/migrations-config.ts` — each exporting an ordered `MIGRATIONS`
  array keyed by `from → to`.
- `tw_detect_drift` now also surfaces schema-version skew (e.g. handoff at
  v2 but tasks.md still at v1) so cross-artifact drift is visible.
- New doc `docs/schema-versions.md` explaining how to ship a new schema
  version (when to bump, where migrations live, test expectations).

### Added — Token-Efficiency Improvements
- **Drift response compression** (`tools/drift.ts:compressDriftDetails`)
  collapses repeated drift lines and caps the response payload so
  `tw_detect_drift` stops bloating per-turn context.
- **`pending_notes` truncation** (`tools/handoff.ts`) enforces a total
  character budget on `pending_notes` returned by `readState()`. Older
  notes are dropped first; truncation metadata is attached so callers can
  see what was trimmed.

### Migration
- All format upgrades are read-side and idempotent — no maintenance step
  required. Files written by older versions continue to load; files
  written by 3.4.0 carry the new `schema_version` field.
- SQLite databases gain a `schema_version` row via additive migration on
  first boot.

## [3.3.0] - 2026-05-19

### Changed
- Project renamed from `teamwork-mcp-server` to `agent-governance-mcp` — package name, GitHub repo, bin commands (`agent-governance-mcp`, `agent-governance-context`), and all internal references updated.

## [3.2.0] - 2026-05-18

### Added — QA-Flow Enforcement
- **Routing-chain state machine**: `tw_update_state` now validates every write
  against an `ALLOWED_TRANSITIONS` matrix keyed on `(prev_last_agent,
  prev_status)`. Illegal edges (e.g. `sr-engineer → PASS`) reject with a
  structured envelope listing the attempted tuple and allowed alternatives.
  Self-loop on same-agent `In_Progress→In_Progress` is fast-pathed.
- **QA round counter**: `qa_round` is now persisted in handoff frontmatter
  (file mode) and the `handoff_state` table (SQLite). Increments on
  `(qa-engineer, FAIL)`, resets on PASS or PM re-entry. Round 4 triggers
  forced rollback to PM — only `(pm, In_Progress)` is accepted thereafter.
- **Evidence-of-QA**: PASS path now requires `qa_reports/review_<id>.md`
  (file mode) or a `reports` table row (SQLite) for every `completed_tasks`
  id. `tw_update_state` gained an optional `qa_review` field; when set with
  `agent_id="qa-engineer"` and status in {PASS, FAIL}, the server records
  the review automatically.
- **`tw_complete_task` agent gate**: `agent_id="qa-engineer"` now required.
  Symmetric to the PASS gate; closes the bypass where any role could flip
  `[x]` directly.
- **`UpdateStateArgs` schema refinement**: `status="PASS"` requires
  `agent_id="qa-engineer"` at the zod layer, so the constraint is visible
  in the MCP client error envelope, not just a handler `if`.
- New module `tools/transitions.ts` (pure: ALLOWED_TRANSITIONS,
  validateTransition, computeNewRound, requireQaEngineer).
- New module `tools/evidence-file.ts` (file-mode recordReview/hasEvidence).
- `HandoffStorage` interface gained `recordReview` + `hasEvidence`;
  `writeState` gained a trailing `qaRound` parameter.

### Migration
- SQLite databases upgrade automatically on first boot: the schema gets a
  `qa_round` column (additive `ALTER`) and a new `reports` table.
- File-mode `handoff.md` without `qa_round` frontmatter loads as `qa_round=0`.
- No tool-name changes; client code keeps working.

### Out of Scope (deferred)
- Server-side session role snapshot (option C). Without MCP caller identity
  binding it only relocates the self-declaration; revisit when MCP gains a
  caller-id field.

## [3.1.2] - 2026-05-16

### Changed
- Constitution heading bumped to `v3.1.2` (`content/constitution.md`) so the
  in-prompt version label stays aligned with the server package version. Going
  forward, each release bumps both together; no semantic change to the rules
  themselves in this release.

## [3.1.1] - 2026-05-16

### Fixed
- SessionStart hook hint now lists `/architect` alongside the other four roles
  (`bin/agent-governance-context.mjs`). Previously, users were never told the architect
  role existed via the auto-injected coordinator briefing, even though
  constitution §4 and the coordinator routing table both include it.
- `markStateRead()` (`guards/session.ts`) no longer scans the workspace
  filesystem when the workspace path doesn't exist on the host. In SQLite/HTTP
  mode the server may handle workspace paths it can't see locally; previously
  every `tw_get_state` call there did wasted `stat()` syscalls (and risked
  EACCES noise on hostile mounts). Freshness in that mode still rides on the
  `extra` snapshot map.
- `CLAUDE.md` no longer claims the SessionStart hook is a silent no-op in this
  repo. The repo dogfoods its own server (`.current/`, `tasks.md` are present);
  the hook fires here exactly as in any managed workspace.
- `skill-sr-engineer.md` "Hard rules" no longer restates constitution §2 and §3
  verbatim — both bullets now point at the relevant constitution section. This
  honors constitution §1's "skills MUST NOT restate these rules".

## [3.1.0] - 2026-05-15

### Added
- `tw_add_task` MCP tool — append tasks to the active list. Works in stdio (markdown)
  and HTTP/SQLite modes. Required for seeding tasks remotely without filesystem access.
- SQLite storage adapter for HTTP mode (`SqliteHandoffStorage`) implements the same
  `HandoffStorage` interface as the markdown file storage — no workspace files needed
  on the server host.

### Changed
- Constitution and skills slimmed (v3.1.0): removed redundancy, fixed role gaps,
  consolidated repeated prompts. Net token budget per role ≈ 1.4k.
- `tools/tasks.ts` is now a thin delegator through `getActiveStorage()`. File-system
  task ops live in `tools/tasks-file.ts`; SQLite task ops live in `tools/storage-sqlite.ts`.
- `tools/drift.ts` rewritten to use `storage.listTasks()` — no direct fs access, so
  drift detection works identically in stdio and HTTP modes.
- README clarifies first-time install timing, hook ordering, and the `Step 4: Verify`
  pass.

### Fixed
- Architect role prompt registered in `index.ts` (previously missing from the
  `ListPrompts` handler).
- Stable hook bin path: `bin/agent-governance-context.mjs` exposed as a `bin` entry so users
  no longer have to dig into `~/.npm/_npx/<hash>/…`.
- `better-sqlite3` is loaded lazily — stdio users without a C++ toolchain are no
  longer blocked at install time. HTTP mode still requires it.
- Per-IDE install docs (Claude Code, Claude Desktop, Cursor, Continue, Zed, Windsurf,
  Cline, Gemini, Antigravity) reconciled to a single canonical install command.
- Token policy + tool schema synced across all role prompts.

## [3.0.x and earlier]

This is the first release under a version-pinned distribution policy. Prior history is
preserved in `git log` and the GitHub commit graph; future entries will live in this file.
