# Spec: Claude Code Subagent Dispatch (Track 1 + 1.a + 1.b)

## Problem Statement

v3.19.0 surfaced a `recommended_model` hint per role, but `/teamwork`'s
auto-routing still calls `tw_switch_role` — a text-loading no-op that runs
the whole chain in **one client context with one model**. Research
(`research/multi-agent-auto-model-routing-directions.md` §Recommendation
Track 1+1.b) identified the gap: Claude Code's subagent dispatch
(via the Task tool with `subagent_type=<role>`, reading per-agent
`model:` frontmatter under `~/.claude/agents/`) is the only existing
mechanism a Claude Code user can leverage **today** to get true
per-role model switching. Subagent dispatch spawns a fresh context with
the pinned model — turning agc's tier mapping from advisory into actual
cost savings (Anthropic-cited 40% vs all-Opus baseline). This feature
ships two coupled pieces: (1.a) the 11 subagent template files agc users
copy into `~/.claude/agents/`, and (1.b) a coordinator-skill upgrade that
prefers Task-tool dispatch over `tw_switch_role` when subagents are
available, with graceful fallback for non-Claude-Code clients.

## User Stories

- As a Claude Code user, I want agc to ship pre-pinned subagent
  templates (one per role with the right `model:` tier) so that I get
  per-role model switching by copying 11 files instead of authoring
  them.
- As a Claude Code user running `/teamwork`, I want the coordinator to
  dispatch to subagents via the Task tool so that each role runs in a
  fresh context with its tier-pinned model, instead of the whole chain
  running on the single model I happened to launch with.
- As a Cursor / Continue / Anti-Gravity user, I want the existing
  `tw_switch_role` path to keep working unchanged so that I am
  unaffected — agc's auto-routing degrades to the v3.19.0 behavior I
  already had.
- As a framework maintainer, I want one source of truth for the tier
  mapping so that the subagent frontmatter `model:` value is consistent
  with `content/skill-*.md`'s `recommended_model`.

## Acceptance Criteria

### AC1: 11 subagent templates exist under `templates/claude-code-agents/`

- **Given** the repo.
- **When** `ls templates/claude-code-agents/` runs.
- **Then** the directory contains exactly these 11 files:
  `pm.md`, `researcher.md`, `architect.md`, `design-auditor.md`,
  `sr-engineer.md`, `code-reviewer.md`, `qa-engineer.md`,
  `qa-visual.md`, `doc-writer.md`, `release-engineer.md`,
  `coordinator-lite.md`.
- **And** each file starts with a YAML frontmatter block declaring
  `name: <role>`, `model: <tier>`, and `description: <one-line>`, with
  `<tier>` matching the corresponding `content/skill-<role>.md`
  `recommended_model` frontmatter value (regression-guard: if the tier
  mapping in `content/` ever changes, the templates must change in
  lock-step).
- **And** each template's body contains a brief instruction telling the
  subagent to call `tw_get_state` first then follow the SOP returned by
  `tw_switch_role(<role>)` — the SOP body is NOT duplicated into the
  template (single source of truth stays in `content/skill-*.md`).

### AC2: `coordinator` (NOT `coordinator-lite`) excluded from the template pack

- **Given** AC1's 11 files.
- **When** the list is compared against the full role enum.
- **Then** the **full coordinator** does NOT have a template, because
  the coordinator IS the parent agent doing dispatch — it must run in
  the main session, not in a subagent fresh context. (`coordinator-lite`
  IS included because it serves as a solo-doer subagent for lite-mode
  hosts that *do* want to pin a Haiku tier for everyday work.)

### AC3: `content/skill-coordinator.md` upgraded with Task-tool dispatch path

- **Given** the existing `## Auto-Routing` section.
- **When** inspected.
- **Then** the section gains a new sub-bullet labelled
  **Subagent Dispatch (Claude Code)** describing the preferred path:
  when the host advertises a `Task` tool with `subagent_type=<role>`
  AND a subagent named `<role>` is registered (heuristic: try the call;
  on tool-error → fall back), the coordinator MUST dispatch via the
  Task tool with `subagent_type=<role>` and a prompt summarising the
  upstream `pending_notes`, INSTEAD of calling `tw_switch_role`. The
  existing `tw_switch_role` step is retained as the fallback path for
  non-Claude-Code hosts.
- **And** the section explicitly states that the **server-enforced
  routing chain is unchanged** — Task-tool dispatch only changes
  WHO/WHICH MODEL runs the role; the `ALLOWED_TRANSITIONS` matrix in
  `tools/transitions.ts` still gates `tw_update_state` writes from
  inside the subagent.
- **And** the dispatched subagent's first action remains `tw_get_state`
  → `tw_detect_drift` per Constitution §3 (the subagent inherits the
  agc pre-flight protocol, just in a fresh context with a pinned
  model).

### AC4: `content/skill-coordinator.md` documents the fallback envelope

- **Given** AC3's new sub-bullet.
- **When** read end-to-end.
- **Then** there is a 1-paragraph note explaining that hosts without
  Task tool / subagent mechanism (Cursor, Continue, Anti-Gravity, plain
  MCP clients) automatically degrade to the existing `tw_switch_role`
  text-load path — same behavior as v3.19.0. No tw_* tool surface has
  changed; the upgrade is purely a coordinator-side preference order.

### AC5: README documents the install + dispatch flow

- **Given** the existing `## Per-Role Model Routing` section in
  `README.md` (added in v3.19.0).
- **When** inspected after this feature.
- **Then** a new sub-section titled `### Claude Code subagent install
  (auto model-routing)` exists with:
  1. A one-line install snippet: `cp -r node_modules/.../templates/claude-code-agents/* ~/.claude/agents/` (or equivalent for npx users).
  2. A bullet list of what each tier costs roughly (referencing the
     existing tier table — do NOT duplicate the table).
  3. A "what changes" callout: with subagents installed AND `/teamwork`
     run inside Claude Code, the chain auto-routes per-role models;
     without subagents OR outside Claude Code, behavior is identical to
     v3.19.0.

### AC6: `schema_version` untouched + version bump 3.19.1 → 3.20.0

- **Given** the change set is content + skill SOP only (no `tw_*` tool
  surface, no persisted schema bump).
- **When** `schema/versions.ts` is inspected.
- **Then** no constant value changes.
- **And** `package.json` bumps `3.19.1` → `3.20.0`, `index.ts`
  `Server({ version: "3.20.0" })`, and `CHANGELOG.md` gets a
  `[3.20.0]` H2 entry.

### AC7: Build + tests pass; no test skipped

- **Given** the full change set.
- **When** `npm run build && npm test` run.
- **Then** zero TypeScript errors and all 449 prior tests still pass.
- **And** new unit coverage is added by qa-engineer for the **template
  set's tier consistency with `content/skill-*.md`** (the only
  programmatically verifiable contract — the coordinator SOP change is
  a markdown-prose update that qa verifies by Read + assert grep).

### AC8: Dependency audit passes

- **Given** AC7 ran `npm run build`.
- **When** `npm audit --audit-level=high` runs immediately after.
- **Then** zero HIGH or CRITICAL findings (Constitution §6).

## Copy / Strings

| string id | exact text (quote verbatim)                                                                                                                                                  | source         |
| --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------- |
| S01       | `name: <role>`                                                                                                                                                              | authored-here — YAML frontmatter key in each `templates/claude-code-agents/<role>.md`. |
| S02       | `model: <tier>`                                                                                                                                                             | authored-here — YAML frontmatter key in each template file. |
| S03       | `description: <one-line>`                                                                                                                                                   | authored-here — YAML frontmatter key in each template file. |
| S04       | `This subagent runs the agc <role> SOP under a pinned model tier. On invocation, call \`tw_get_state\` then \`tw_switch_role("<role>")\` and follow the returned SOP exclusively.` | authored-here — boilerplate body for every template file. Single sentence to keep tokens minimal; SOP body lives in `content/skill-<role>.md` (single source of truth). |
| S05       | `### Claude Code subagent install (auto model-routing)`                                                                                                                     | authored-here — README sub-section heading under existing `## Per-Role Model Routing`. |
| S06       | `Subagent Dispatch (Claude Code)`                                                                                                                                           | authored-here — new sub-bullet label inside `content/skill-coordinator.md` `## Auto-Routing` section. |

## Visual Tokens

| token id | property | value (quote verbatim) | source |
| -------- | -------- | ---------------------- | ------ |
| N/A      | —        | feature has no visual tokens (server / SOP / docs only) | authored-here |

## Visual Widgets

| widget id | description | source-node |
| --------- | ----------- | ----------- |
| N/A | — | feature has no non-primitive widgets |

## Out of Scope

- **`agc init-subagents` CLI bootstrap** — users copy templates
  manually for MVP. Adding a CLI subcommand is a follow-up if the
  manual copy turns out to be a friction point. (Constitution §1 MVP
  strict.)
- **`tw_dispatch_role` MCP tool** — Track 2 in the research file;
  pushes the dispatch directive over the MCP wire for non-Claude-Code
  hosts that implement a custom dispatch protocol. Deliberate next
  release.
- **Cross-IDE subagent shims** (Cursor "rules + Composer", Continue
  "context providers", etc.) — out of MVP. These IDEs don't have an
  equivalent dispatch primitive that can pin model per agent; they
  stay on the `tw_switch_role` fallback for now.
- **Cost telemetry / `dispatch_ack` audit** — research file flagged
  observability as the next-next concern. Not in this MVP.
- **Server-side enforcement that a subagent actually got dispatched**
  — agc cannot verify which model ran a tool call; this remains
  client-honored.
- **Removing or deprecating `tw_switch_role`** — fallback path stays
  unchanged forever (or until a hard-MAJOR bump). No back-compat
  breakage.
- **Bumping any persisted `schema_version`** — content + skill SOP +
  templates only.

## Dependencies / Prerequisites

- `research/multi-agent-auto-model-routing-directions.md` — internal
  artifact; sole motivation source. Status: **indexed-in-workspace**.
- `specs/model-routing.md` (v3.19.0 PRD) — internal artifact; the tier
  mapping defined there is reused verbatim. Status:
  **indexed-in-workspace**.
- `content/skill-*.md` frontmatter `recommended_model` values — load-
  bearing source-of-truth for the template `model:` field. **Implicit
  contract**: this spec's AC1 binds the template tier to the skill
  tier; any future change to one MUST change the other (qa-engineer
  enforces via AC7 regression test).
- Resource Audit Gate (Constitution §7): **CLEAR** — no external
  URLs / Figma / tickets / mockup attachments referenced. All sources
  are in-workspace.
- Decision log (PM inline, per workspace `feedback-no-askuserquestion`
  memory):
  - **Coordinator template excluded**: the full coordinator is the
    parent dispatcher itself; spawning it as a subagent would be
    recursive. `coordinator-lite` IS included as a tier-pinned
    solo-doer for lite mode (see AC2).
  - **`tw_switch_role` retained as fallback**: graceful degradation for
    non-Claude-Code hosts; no back-compat break (see AC4).
  - **Manual copy over CLI bootstrap**: MVP-strict; revisit if
    friction reports come in (see Out of Scope).
  - **Single-sentence template body**: SOP duplication is the failure
    mode v3.19.0's `parseSkillFile` was designed to prevent; templates
    delegate to `tw_switch_role` for the body (see AC1 + S04).
