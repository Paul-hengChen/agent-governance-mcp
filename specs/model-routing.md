# Spec: Per-Role Model Routing

## Problem Statement

The framework currently has no per-role model tier assignment — every role
(researcher / pm / architect / sr-engineer / code-reviewer / qa-engineer /
design-auditor / doc-writer / release-engineer / coordinator / coordinator-lite)
runs on whatever model the client happens to be using, typically the
flagship (Opus). Industry-comparison research lists this as one of the three
biggest gaps versus 2025–2026 best practice (see
`research/agent-governance-framework-industry-comparison.md` Q1–Q5 and
`research/token-economics.md` §Model-routing). Concrete consequence
already observed: a deep-research run burned out on token cost because every
hop ran on Opus. Anthropic's own multi-agent system uses an orchestrator-worker
topology with a heterogeneous tier (Opus lead, Sonnet / Haiku workers) and
reports the heterogeneous routing is both cheaper and higher-quality. The MVP
here is **advisory**: the server cannot enforce client-side inference, so this
feature surfaces a per-role `recommended_model` hint through the existing
skill / role-switch / SessionStart channels and documents how Claude Code
users wire it into `~/.claude/agents/*.md`. Honoring the hint remains the
client's responsibility.

## User Stories

- As a solo developer, I want each role to declare a recommended model tier
  so that I can configure my client (Claude Code subagents, manual `/model`
  switches) to stop burning Opus tokens on Haiku-class work.
- As a framework maintainer, I want the tier mapping in one source of truth
  (skill frontmatter) so that updates ship via the same `content/skill-*.md`
  files we already version.
- As a client integration author, I want `tw_switch_role` to return the
  recommended model alongside the SOP so that thin wrappers can auto-set
  `--model` on the next call.
- As an existing user, I want the hint to be additive — old clients that
  ignore the new field keep working unchanged.

## Tier Mapping

| Role             | Tier   | Recommended model | Rationale                                                                   |
| ---------------- | ------ | ----------------- | --------------------------------------------------------------------------- |
| researcher       | high   | `opus`            | Heavy reasoning, long-context synthesis across multiple research artifacts. |
| architect        | high   | `opus`            | Cross-module design decisions; subtle interface-contract trade-offs.        |
| code-reviewer    | high   | `opus`            | Detail sensitivity; correctness gate before QA.                             |
| design-auditor   | high   | `opus`            | Verbatim copy/tokens extraction; precision on visual contracts.             |
| sr-engineer      | high   | `opus`            | Hot path — every FAIL re-runs the whole chain; quality > marginal cost.     |
| coordinator      | medium | `sonnet`          | Triage + routing; structured decisions but not deep reasoning.              |
| pm               | medium | `sonnet`          | Spec drafting; structured output but bounded scope per call.                |
| qa-engineer      | medium | `sonnet`          | Test execution & evidence; high determinism, moderate reasoning.            |
| qa-visual        | medium | `sonnet`          | Lazy-loaded sub-mode of qa-engineer; inherits its tier.                     |
| coordinator-lite | low    | `haiku`           | Single-file doer; no chain, no design decisions.                            |
| doc-writer       | low    | `haiku`           | Doc-only side-channel; deterministic formatting work.                       |
| release-engineer | low    | `haiku`           | Mechanical release packaging; no novel reasoning.                           |

## Copy / Strings

| string id | exact text (quote verbatim)                                                                                 | source         |
| --------- | ----------------------------------------------------------------------------------------------------------- | -------------- |
| S01       | `recommended_model: <tier>`                                                                                  | authored-here — frontmatter key in `content/skill-*.md`. |
| S02       | `Recommended model for this role: <model>. Honor via client subagent config or /model switch.`              | authored-here — appended to `tw_switch_role` `instruction` string when a recommendation is present. |
| S03       | `Recommended model: <model> (tier <tier>)`                                                                   | authored-here — single line appended to SessionStart hook output under the role banner. |

## Visual Tokens

| token id | property | value (quote verbatim) | source |
| -------- | -------- | ---------------------- | ------ |
| N/A      | —        | feature has no visual tokens (server-side text-only feature) | authored-here |

## Visual Widgets

| widget id | description | source-node |
| --------- | ----------- | ----------- |
| N/A | — | feature has no non-primitive widgets |

## Acceptance Criteria

### AC1: Every skill file carries `recommended_model` frontmatter

- **Given** the 12 skill files under `content/` (`skill-pm.md`,
  `skill-researcher.md`, `skill-architect.md`, `skill-design-auditor.md`,
  `skill-sr-engineer.md`, `skill-code-reviewer.md`, `skill-qa-engineer.md`,
  `skill-qa-visual.md`, `skill-doc-writer.md`, `skill-release-engineer.md`,
  `skill-coordinator.md`, `skill-coordinator-lite.md`).
- **When** each file is inspected.
- **Then** the file starts with a YAML frontmatter block bracketed by `---`
  fences containing exactly the key `recommended_model` set to one of
  `opus` | `sonnet` | `haiku` matching the *Tier Mapping* table above; the
  rest of the file content below the closing `---` is unchanged.

### AC2: `tools/role.ts` parses and returns `recommended_model`

- **Given** a `tw_switch_role` call for any role in the existing enum
  (`pm` | `researcher` | `design-auditor` | `sr-engineer` | `code-reviewer`
  | `qa-engineer` | `architect` | `doc-writer` | `release-engineer`).
- **When** the server reads the corresponding skill file.
- **Then** the JSON response contains an additional `recommended_model`
  string field with the value parsed from the skill's frontmatter; the
  `instruction` string additionally includes string S02 with `<model>`
  substituted; and the `sop` field returns the file body **with the
  frontmatter stripped** (so existing SOP-rendering callers see no change).
- **Given** a skill file with no frontmatter (legacy / partial install).
- **When** the same call is made.
- **Then** the response omits `recommended_model` (field absent, not `null`),
  the `instruction` string omits S02, and `sop` is the full file body —
  backwards-compatible behavior.

### AC3: `prompts/build.ts` strips frontmatter and surfaces the recommendation

- **Given** any of the 7 registered prompts (`teamwork`, `teamwork-lite`,
  `sr-engineer`, `pm`, `architect`, `researcher`, `qa-engineer`).
- **When** `buildPromptForRole()` loads its skill file.
- **Then** the YAML frontmatter is stripped before concatenation with the
  constitution and handoff state (no `---` block leaks into the prompt
  body); AND a single line `Recommended model for this role: <model>.` is
  appended once, after the skill body, before the handoff state block —
  only when frontmatter declared `recommended_model`.

### AC4: SessionStart hook prints the recommended model

- **Given** a managed workspace (markers present per existing hook logic).
- **When** `bin/agent-governance-context.mjs` runs and loads the
  `skill-coordinator.md` or `skill-coordinator-lite.md` variant.
- **Then** the emitted `additionalContext` includes string S03 with
  `<model>` and `<tier>` substituted, placed on its own line directly after
  the auto-context banner (before the constitution dump); AND if the
  selected skill file lacks frontmatter, no S03 line is emitted (the rest
  of the hook output is unchanged).

### AC5: README documents the tier table and client wiring

- **Given** the repo's `README.md` (or `docs/` if README delegates to a
  per-topic doc, matching existing convention — see `docs/` split commit
  `abf5baf`).
- **When** inspected.
- **Then** a new H2 section titled `## Per-Role Model Routing` exists,
  containing: (a) the full Tier Mapping table verbatim from this spec,
  (b) a short prose paragraph stating the recommendation is advisory and
  client-honored, (c) a fenced code block showing the minimal
  `~/.claude/agents/<role>.md` example for one role (sr-engineer / opus)
  so users can copy the pattern.

### AC6: `schema_version` bump + migration entry

- **Given** the skill frontmatter is a new wire-level addition consumed by
  `tools/role.ts` and `prompts/build.ts`.
- **When** `schema/versions.ts` and the migration registries are inspected.
- **Then** no handoff/tasks/sqlite/config schema_version is bumped (the
  frontmatter sits in `content/`, not in the persisted state artifacts);
  `package.json` bumps from `3.18.x` → `3.19.0` (SemVer minor — additive,
  backwards-compatible); `scripts/check-version.mjs` continues to pass
  against the `Server()` literal in `index.ts`.

### AC7: Build + tests pass

- **Given** the full change set.
- **When** `npm run build` and `npm test` run.
- **Then** zero TypeScript errors, all existing tests pass, no test is
  skipped. New unit coverage MUST be added for `tools/role.ts`
  frontmatter parsing (positive: returns recommended_model; negative: no
  frontmatter → field omitted; malformed: invalid value rejected with a
  clear error) — qa-engineer authors per Constitution §2.

### AC8: Dependency audit passes

- **Given** AC7 ran `npm run build`.
- **When** `npm audit --audit-level=high` runs immediately after.
- **Then** zero HIGH or CRITICAL findings (per Constitution §6 build-gate
  dep-audit rule). If a finding pre-exists, it MUST be documented under
  the PR description with a waiver rationale.

## Out of Scope

- Server-side enforcement of client model selection. The server cannot
  inspect which model executed a tool call; the hint stays advisory.
- Cursor / Continue / Anti-Gravity / Gemini Code client configuration.
  Documentation covers Claude Code only in this MVP; other IDEs are
  follow-up work.
- Auto-injection of `~/.claude/agents/*.md` template files into the user's
  home directory. Users copy the README snippet manually.
- A `fallback_model` field on skill frontmatter. Single-value MVP per
  Constitution §1 *MVP strict*; layered fallbacks revisit when a concrete
  need surfaces.
- Per-task model overrides. Tier is per-role; tasks within a role share
  the role's tier.
- Bumping handoff / tasks / sqlite / config `schema_version`. Content
  changes only.

## Dependencies / Prerequisites

- `research/agent-governance-framework-industry-comparison.md` — internal
  artifact, already in workspace; load-bearing for the tier-mapping
  rationale. Status: **indexed-in-workspace**, no external fetch needed.
- `research/token-economics.md` — internal artifact, already
  in workspace; corroborates Anthropic Claude Code "route to cheaper Haiku"
  guidance citation. Status: **indexed-in-workspace**.
- No Figma / Sketch / external URLs / ticket IDs / mockup attachments are
  referenced by this spec. Resource Audit Gate (Constitution §7,
  skill-pm §Resource Audit Gate): **CLEAR**.
- Decision log (PM batched inline, per workspace feedback memory):
  - **Tier for sr-engineer**: user explicitly chose `opus` over `sonnet`
    on 2026-06-01 — rationale: sr-engineer is the chain's hot path; a
    FAIL re-runs the whole loop, so quality dominates marginal cost.
  - **Client templates**: doc-only (README snippet) chosen over shipping
    11 `templates/claude-code-agents/*.md` files — MVP strict per
    Constitution §1; users copy one example into their own
    `~/.claude/agents/`.
