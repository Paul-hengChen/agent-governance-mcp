# Spec: Subagent Short Names (`@lite` + `@teamwork`)

## Problem Statement

v3.20.0 shipped Claude Code subagent templates with verbose role names:
`@coordinator-lite` (16 chars) for lite-mode dispatch, and **deliberately
no coordinator template at all** (v3.20.0 spec AC2 — recursive-spawn
avoidance). Two pain points surfaced in production use: (1) `@coordinator-lite`
is too long to type comfortably for everyday solo-doer work; (2) the
absence of a coordinator subagent means **the full `/teamwork` chain
still runs the orchestrator in the user's main session model**, which
is usually Opus — even though `content/skill-coordinator.md` declares
`recommended_model: sonnet`. Claude Code's **Dynamic Workflows research
preview (May 2026)** confirms subagents CAN spawn nested subagents (up
to 1,000 in parallel), invalidating v3.20.0 AC2's recursive-spawn worry.
This release adds a `@teamwork` coordinator subagent (Sonnet-pinned) and
renames `@coordinator-lite` to the shorter `@lite` (Haiku-pinned),
without touching the server-side identifiers (`content/skill-*.md`,
`prompts/*.ts`, `tools/transitions.ts`, `/teamwork-lite` MCP prompt name).
This is a **template-layer-only rename**; server contracts are unchanged.

## User Stories

- As a Claude Code user typing 50 `@coordinator-lite` invocations a day,
  I want `@lite` so that I save 11 keystrokes per call without losing
  any functionality.
- As a Claude Code user starting cross-module work, I want `@teamwork`
  to spawn a Sonnet-pinned coordinator subagent in a fresh context so
  that the orchestrator runs on the tier its skill recommends, and the
  full chain enjoys per-role model routing end-to-end (not just from
  pm onward).
- As an existing v3.20.0 user with `~/.claude/agents/coordinator-lite.md`
  already installed, I want a clear migration note so that I can either
  keep my old install OR migrate to the new short name without
  surprises.
- As a non-Claude-Code user, I want zero impact — server-side
  identifiers unchanged, fallback paths intact.

## Acceptance Criteria

### AC1: Subagent name `coordinator-lite` → `lite` (file + frontmatter)

- **Given** `templates/claude-code-agents/coordinator-lite.md` from v3.20.0.
- **When** v3.21.0 ships.
- **Then** that file is renamed to `templates/claude-code-agents/lite.md`
  AND the frontmatter `name:` field reads `lite` (no longer
  `coordinator-lite`).
- **And** the file's `model:`, `description:`, and body content are
  preserved exactly — only the identifier changes.

### AC2: New `templates/claude-code-agents/teamwork.md`

- **Given** v3.20.0 deliberately had no coordinator template (former AC2).
- **When** v3.21.0 ships.
- **Then** a NEW file `templates/claude-code-agents/teamwork.md` exists
  carrying frontmatter `name: teamwork`, `model: sonnet`,
  `description: <one-line>`, with a body that delegates to
  `content/skill-coordinator.md` directly (paralleling the `lite`
  template's file-path delegation — see *Out of Scope* on
  `tw_switch_role` usage).
- **And** the tier `sonnet` matches `content/skill-coordinator.md`'s
  `recommended_model: sonnet` (regression-guard contract from v3.19.0).

### AC3: Former v3.20.0 AC2 (no-coordinator-template) is officially reversed

- **Given** v3.20.0 spec `subagent-dispatch.md` AC2 stated the full
  coordinator MUST NOT have a template (recursive-spawn avoidance).
- **When** v3.21.0 ships.
- **Then** the CHANGELOG explicitly notes the reversal with the
  citation: Claude Code Dynamic Workflows research preview (May 2026)
  confirms nested subagent spawn is supported (up to 1,000 in parallel)
  — see `research/multi-agent-auto-model-routing-directions.md` §E1.
- **And** the v3.21.0 spec (this file) supersedes that AC2 rule with
  the affirmative AC2 above.

### AC4: README + install snippet updated

- **Given** the `### Claude Code subagent install (auto model-routing)`
  sub-section in `README.md` (added v3.20.0).
- **When** v3.21.0 ships.
- **Then** the install snippet now installs the renamed `lite.md` AND
  the new `teamwork.md`; the prose lists `@lite` and `@teamwork` as the
  primary entry points alongside the existing per-role `@pm`, `@sr-engineer`, etc.
- **And** a one-line **migration note** for v3.20.0 users explains:
  "If you previously installed v3.20.0 templates, run
  `rm ~/.claude/agents/coordinator-lite.md` then re-copy from
  `templates/claude-code-agents/`. Your existing `coordinator-lite.md`
  install will keep working (Claude Code reads the `name:` field) — but
  `@lite` will not resolve until you re-copy."

### AC5: `test/subagent-templates.test.mjs` updated

- **Given** the v3.20.0 regression-guard test (EXPECTED_ROLES,
  LITE_EXEMPT, ROLE_TO_SKILL constants).
- **When** v3.21.0 ships.
- **Then** `EXPECTED_ROLES` is updated: remove `coordinator-lite`, add
  `lite` AND `teamwork`. Total count remains: was 11, becomes 12.
- **And** `LITE_EXEMPT` Set is updated to `{ "lite", "teamwork" }`
  (both delegate by file path — `lite` because lite mode is
  server-read-only, `teamwork` because the full coordinator role is not
  in the `RoleName` enum exposed by `tw_switch_role`).
- **And** `ROLE_TO_SKILL` map is updated: `lite → skill-coordinator-lite.md`,
  `teamwork → skill-coordinator.md`. The map key is the subagent name;
  the value is still the server-side skill file (unchanged).
- **And** the AC2-equivalent test (`full coordinator template is NOT
  shipped`) is **removed** — its FORBIDDEN_ROLES set becomes empty and
  the test deletes accordingly (since v3.20.0 AC2 is reversed).

### AC6: Server-side identifiers UNCHANGED

- **Given** all server-side `coordinator-lite` / `coordinator`
  references (`content/skill-coordinator-lite.md`, `prompts/coordinator-lite.ts`,
  `prompts/coordinator.ts`, `/teamwork-lite` MCP prompt name,
  `/teamwork` MCP prompt name, `tools/transitions.ts` lite-mode
  detection if any).
- **When** v3.21.0 ships.
- **Then** NONE of those identifiers change. The rename is template-
  layer-only; the server's wire contract is byte-identical to v3.20.0.
- **Rationale**: server-side rename = MAJOR (v4.0.0); template rename
  alone = MINOR (additive identifier on the client side, backwards-
  compatible via fallback).

### AC7: Version bump 3.20.0 → 3.21.0 + CHANGELOG entry

- **Given** the change set is template-layer-only (no `tw_*` tool surface,
  no persisted schema, no server identifier change).
- **When** `schema/versions.ts` is inspected.
- **Then** no schema constant changes.
- **And** `package.json` + `index.ts` Server literal bump 3.20.0 → 3.21.0;
  `CHANGELOG.md` gets a `[3.21.0]` H2 entry documenting AC1–AC6 and the
  AC3 reversal of v3.20.0 AC2.

### AC8: Build + tests pass; dependency audit clean

- **Given** the full change set.
- **When** `npm run build && npm test` run.
- **Then** zero TypeScript errors, all prior tests still pass, no test
  skipped. The updated regression-guard test now asserts 12 templates
  (was 11).
- **And** `npm audit --audit-level=high` reports zero HIGH/CRITICAL
  findings.

## Copy / Strings

| string id | exact text (quote verbatim)                                                                                                                                                                                                                                              | source         |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------- |
| S01       | `name: lite`                                                                                                                                                                                                                                                            | authored-here — replaces v3.20.0's `name: coordinator-lite` in the renamed file. |
| S02       | `name: teamwork`                                                                                                                                                                                                                                                        | authored-here — new template for the coordinator subagent (reverses v3.20.0 AC2). |
| S03       | `model: sonnet`                                                                                                                                                                                                                                                         | authored-here — matches `content/skill-coordinator.md` `recommended_model` per v3.19.0 tier table. |
| S04       | `Sonnet-pinned coordinator subagent — runs the agc /teamwork chain orchestrator in a fresh context.`                                                                                                                                                                    | authored-here — `description:` value for `teamwork.md`. |
| S05       | `This subagent runs the agc coordinator (full) SOP from \`content/skill-coordinator.md\` under a pinned Sonnet tier. On invocation, call \`tw_get_state\` then \`tw_detect_drift\`, then follow the coordinator SOP exclusively (load it via the Read tool, NOT via tw_switch_role — coordinator is not in the RoleName enum).` | authored-here — body of `teamwork.md`. Mirrors lite's file-path delegation pattern. |
| S06       | `If you previously installed v3.20.0 templates, run \`rm ~/.claude/agents/coordinator-lite.md\` then re-copy from \`templates/claude-code-agents/\`. Your existing \`coordinator-lite.md\` install will keep working (Claude Code reads the \`name:\` field) — but \`@lite\` will not resolve until you re-copy.` | authored-here — README migration note. |

## Visual Tokens

| token id | property | value (quote verbatim) | source |
| -------- | -------- | ---------------------- | ------ |
| N/A      | —        | feature has no visual tokens (template + docs only) | authored-here |

## Visual Widgets

| widget id | description | source-node |
| --------- | ----------- | ----------- |
| N/A | — | feature has no non-primitive widgets |

## Out of Scope

- **Renaming server-side `coordinator-lite` / `coordinator`** —
  `content/skill-coordinator-lite.md`, `prompts/coordinator-lite.ts`,
  `prompts/coordinator.ts`, `/teamwork-lite` MCP prompt name,
  `/teamwork` MCP prompt name. Those identifiers stay. Renaming the
  server side would be a MAJOR (v4.0.0) breaking change; this MINOR
  release intentionally limits scope to the template layer.
- **Using `tw_switch_role("coordinator")` in `teamwork.md` body** —
  "coordinator" is not in `ROLE_SKILL_MAP` (`tools/role.ts:18-33`), so
  the call would return an error envelope. The `teamwork.md` body must
  delegate by reading `content/skill-coordinator.md` directly, parallel
  to lite's exemption (v3.20.0 spec AC1's S04 contract documented this
  pattern for lite; v3.21.0 extends the exemption set to include
  teamwork).
- **Adding `tw_switch_role("coordinator")` enum entry** — out of scope.
  The coordinator role is the dispatcher, not a destination; adding it
  to the enum would invite `ALLOWED_TRANSITIONS` ambiguity that the
  v3.2.0 server-enforced chain was explicitly designed to avoid.
- **Auto-removing the v3.20.0-installed `~/.claude/agents/coordinator-lite.md`**
  — users own their home directory; the migration note in README
  documents the cleanup step but never executes it.
- **A migration CLI (`agc migrate-subagents`)** — MVP-strict per
  Constitution §1. Manual `rm` + `cp` is sufficient documentation.
- **Bumping any persisted `schema_version`** — template-layer-only.

## Dependencies / Prerequisites

- `research/multi-agent-auto-model-routing-directions.md` §E1 — confirms
  Claude Code Dynamic Workflows research preview (May 2026) supports
  nested subagent spawn up to 1,000 in parallel. Load-bearing for AC3
  (v3.20.0 AC2 reversal). Status: **indexed-in-workspace**.
- `specs/subagent-dispatch.md` (v3.20.0 PRD) — the AC2 rule being
  reversed in AC3. Status: **indexed-in-workspace**.
- `content/skill-coordinator.md` frontmatter `recommended_model: sonnet`
  — load-bearing source-of-truth for AC2's `model: sonnet` template
  field. **Implicit contract**: any future change to skill tier MUST
  cascade to template via the v3.20.0 regression-guard test (updated
  per AC5).
- `tools/role.ts` `ROLE_SKILL_MAP` constant — load-bearing for the AC2
  "no `tw_switch_role("coordinator")`" exemption. Coordinator is
  intentionally absent from this map (it's the dispatcher, not a
  destination).
- Resource Audit Gate (Constitution §7): **CLEAR** — no external URLs
  / Figma / tickets / mockup attachments. All sources are
  in-workspace.
- Decision log (PM inline, per workspace `feedback-no-askuserquestion`
  memory):
  - **Template rename only, no server rename** — chosen to keep this a
    MINOR release; full identifier rename would be MAJOR (v4.0.0) and
    is deferred indefinitely.
  - **`@teamwork` as the coordinator subagent name** — user's
    explicit choice. Matches the existing `/teamwork` slash command for
    mental-model consistency. Note: this is a verb-like subagent name
    (others are role nouns); accepted as a deliberate naming exception
    for the dispatcher entry point.
  - **AC2 reversal cited to Dynamic Workflows** — necessary to justify
    why the v3.20.0 worry no longer applies. Citation is internal
    (`research/multi-agent-auto-model-routing-directions.md`) and
    transitively cites Anthropic's May 2026 research preview as [T2].
