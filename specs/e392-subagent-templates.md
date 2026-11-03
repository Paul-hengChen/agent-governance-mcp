# e392-subagent-templates

Tickets E392 + E280 (merged; lane `e392`, fan-out manifest `specs/fanout-e392-e394.md`, branch
`feat/e392-subagent-templates`, base `89e01c6`). Sources: `docs/backlog.md` rows E392 and E280;
`docs/prompt-audit-2026-11-02.md` findings G2-01, G2-09 and G2-16 plus its section 4 notes
(report only, not modified). Human ruling 2026-11-03 (manifest *人類裁定*): option (i), add the
mechanism; E280 merged into this lane. Mini-chain: pm → sr-engineer → code-reviewer →
qa-engineer, no architect (one map entry, two enum literals, text edits; no new module, no data
model, no cross-cutting API). Line numbers are at the lane base unless marked otherwise.

## Problem Statement

Three Claude Code subagent-facing texts contradict the code or their own frontmatter.
(a) `templates/claude-code-agents/teamwork.md` line 9 tells a `teamwork` subagent to Read
`content/skill-coordinator.md`, which does not exist — the coordinator SOP is the
`content/coord-01..07-*.md` fragments composed under the logical key `skill-coordinator.md` by
`prompts/skill-manifest.ts` — and says the SOP cannot come through `tw_switch_role` because
`coordinator` is not in its role enum; so a Task-dispatched `@teamwork` cannot load its SOP at
all (no MCP resource, a subagent cannot call a prompt, it does not know the agc install path).
`tools/role.ts` `switchRole` already composes split skills through `composeSkill` with the
workspace's `.current/.config.json` `host` (`isSplit` branch, lines 75–92), so one
`ROLE_SKILL_MAP` entry plus the two `tw_switch_role` enum literals closes the gap with no new
composition code. E280 is the same defect seen from the test side: the
`FILE_PATH_DELEGATES.teamwork` regex in `test/subagent-templates.test.mjs` pins the dead text.
(b) `templates/claude-code-agents/release-engineer.md` is `model: opus` (as are
`skill-release-engineer.md` `recommended_model` and the live pins) but its line 25 example reply
suffix says `(haiku)`, `content/coord-04-host-watermark.md` line 5 lists `@release-engineer` as a
haiku-tier subagent, and `HAIKU_ROLES` in the test still holds it. (c) Claude Code names its
subagent tool `Agent`; `coord-02` and the adapter block (template line 12 = `CLAUDE.md` line 233)
write `Task` without ever defining it.

## User Stories

- As a human who dispatches `@teamwork` as a Claude Code subagent, I want its template to load
  the coordinator SOP through a tool call that exists, so that the subagent does not fail on its
  first step.
- As a coordinator, I want `tw_switch_role("coordinator")` to return the same host-filtered
  coordinator SOP the `teamwork` prompt composes, so that the SOP has one source of truth.
- As a coordinator validating watermarks, I want the haiku-tier list and the release-engineer
  template to agree with the release-engineer's opus pin, so that I do not expect a `(haiku)`
  suffix from an opus subagent.
- As an agent reading coord-02 or the adapter block on today's Claude Code, I want `Task(...)`
  defined once as the name for the `Agent` tool, so that I map every `Task(...)` instruction to
  the tool I actually have.

## Acceptance Criteria

Site → AC → task mapping is in *Site map* below. All `node --test` proofs run on a built tree
(`npm run build` first). New tests live in `test/e392-subagent-templates.test.mjs`
(qa-authored, T-E392-06) unless the proof names another file.

- **AC1 (a: claude-code profile)** — Given a temp workspace whose `.current/.config.json` is
  `{"host":"claude-code"}`, when `switchRole("coordinator", ws)` runs, then the JSON has no
  `error`, `role` is `"coordinator"`, `sop` is non-empty, starts with `# Skill: coordinator`,
  and contains `**Subagent Dispatch (Claude Code)**` (coord-02) and
  `## Subagent Reply Watermark Validation` (coord-04).
  proof: `node --test test/e392-subagent-templates.test.mjs` (AC1 test green).
- **AC2 (a: no-config profile)** — Given a temp workspace with an empty `.current/` and no
  `.config.json`, when `switchRole("coordinator", ws)` runs, then `sop` is non-empty, starts
  with `# Skill: coordinator`, and contains neither `**Subagent Dispatch (Claude Code)**` nor
  `## Subagent Reply Watermark Validation` (the lean profile drops every `host:claude-code`
  fragment).
  proof: `node --test test/e392-subagent-templates.test.mjs` (AC2 test green).
- **AC3 (a: frontmatter + render parity)** — Given either workspace from AC1/AC2, when
  `switchRole("coordinator", ws)` runs, then `recommended_model` equals
  `parseSkillFile(<content/coord-01-core-head.md>).frontmatter.recommended_model` (today
  `sonnet`), `instruction` names that tier, `sop` carries no `<!-- origin:` and no
  `<!-- rationale:` marker, and `sop` is byte-identical to
  `applyTextTransforms(parseSkillFile(expandPartials(composeSkill("skill-coordinator.md", hostCapabilitiesFor(<host>), load), load)).body, { fullDetail: false })`.
  proof: `node --test test/e392-subagent-templates.test.mjs` (AC3 tests green).
- **AC4 (a: both enums)** — Given the built registry, when the `tw_switch_role` entry of
  `TOOL_REGISTRY` is read, then its `inputSchema.properties.role.enum` contains `"coordinator"`,
  its `zodSchema` accepts `{ workspace_path: <abs>, role: "coordinator" }`, and the inputSchema
  enum and the zod enum options are the same set (10 values: the 9 existing roles plus
  `coordinator`).
  proof: `node --test test/e392-subagent-templates.test.mjs` (AC4 test green).
- **AC5 (a: not a chain role — hard scope)** — Given the change, then `tools/transitions.ts`,
  the `AgentName` union, `ALLOWED_TRANSITIONS`, the `tw_update_state` `agent_id` / `next_role` /
  `resume_of` / `dispatch_pins` vocabularies and every error code are unchanged; `"coordinator"`
  is not a key of `ALLOWED_TRANSITIONS` and not in the `next_role` enum or the `dispatch_pins`
  properties.
  proof: `node --test test/e392-subagent-templates.test.mjs` (AC5 test green) plus reviewer
  check `git diff --stat 89e01c6 -- tools/transitions.ts gates/ schema/` prints nothing.
- **AC6 (a: dist)** — Given `npm run build` on the lane HEAD, then the only `dist/` paths that
  differ from base are `dist/tools/role.{js,js.map,d.ts,d.ts.map}` and
  `dist/tools/registry.{js,js.map,d.ts,d.ts.map}` (any subset of those), all committed, and a
  fresh `npm run build` leaves `git status --short dist/` empty.
  proof: `git diff --stat 89e01c6 -- dist/` lists no other `dist/` path (reviewer + qa command,
  not a test — tests must not diff against a fixed base sha).
- **AC7 (a: teamwork template + E280)** — Given `templates/claude-code-agents/teamwork.md`, then
  line 9 equals string `teamwork.load` (Copy / Strings) byte-for-byte: it loads the SOP via
  `tw_switch_role("coordinator")`, keeps the string `content/skill-coordinator.md` stated as a
  logical name with no file on disk, and no longer says "via the Read tool" or "coordinator is
  not in the RoleName enum"; lines 1–8 are unchanged. `FILE_PATH_DELEGATES.teamwork` in
  `test/subagent-templates.test.mjs` is tightened (E280 part 2) so it matches the new sentence
  (at minimum the `tw_switch_role("coordinator")` call and the logical-name clause) and does NOT
  match the base line 9.
  proof: `node --test test/subagent-templates.test.mjs` green, and the e392 test asserts the
  tightened regex rejects the base line 9 text (quoted as a fixture string in the test).
- **AC8 (b: release-engineer template)** — Given
  `templates/claude-code-agents/release-engineer.md`, then it contains no
  `Example reply suffix:` line and no `(haiku)` text; the file ends with line 23 (the
  `driftBaselineIds` paragraph) and its newline — base lines 24 (blank) and 25 (the example) are
  deleted; base lines 1–23, including the line 11 staging paragraph and the line 19 no-MCP-path
  RELAY paragraph, are byte-unchanged.
  proof: `node --test test/subagent-templates.test.mjs` (the non-haiku reverse test now covers
  release-engineer) and `node --test test/e392-subagent-templates.test.mjs` (AC8 test).
- **AC9 (b: coord-04 list)** — Given `content/coord-04-host-watermark.md`, then line 5 reads
  `Haiku-tier subagents (`@lite`, `@doc-writer`)` where base had
  `Haiku-tier subagents (`@lite`, `@doc-writer`, `@release-engineer`)`, and the rest of the file
  is byte-unchanged.
  proof: `node --test test/e392-subagent-templates.test.mjs` (AC9 test: `@release-engineer`
  absent from the haiku list in coord-04 and in the claude-code composition).
- **AC10 (b: HAIKU_ROLES)** — Given `test/subagent-templates.test.mjs`, then `HAIKU_ROLES` is
  `["lite", "doc-writer"]`, and both "v3.21.2 AC2" tests pass (haiku forward assertion for lite
  and doc-writer; non-haiku reverse assertion for the other 10 templates, release-engineer
  included).
  proof: `node --test test/subagent-templates.test.mjs`.
- **AC11 (b: second pin — PENDING RULING R1)** — Given `test/feature-lease.test.mjs` lines
  1533–1540 and 1680–1687, which assert the `Example reply suffix: … — @release-engineer (haiku)`
  line is still present, then after AC8 they no longer assert it (each block is removed or
  inverted to assert absence). This file is OUTSIDE the e392 owned set (it belongs to e394); see
  *Dependencies / Prerequisites* R1. AC8 cannot land green until R1 is ruled.
  proof: `node --test test/feature-lease.test.mjs` green on the lane HEAD.
- **AC12 (c: coord-02 alias)** — Given `content/coord-02-host-dispatch.md`, then line 1 contains
  string `coord02.alias` exactly once, inserted directly after
  `**Subagent Dispatch (Claude Code)** — preferred when available. ` with the rest of line 1
  byte-unchanged; lines 3, 9, 11 and 22 (and every other line) are byte-unchanged — their `Task`
  wording is now covered by the definition (lines 9 and 11 are Dispatch Brief invariant lines
  pinned verbatim by `test/subagent-templates.test.mjs` c17 and mirrored by const-01, so they
  stay); the claude-code composition of `skill-coordinator.md` contains the alias exactly once
  and the lean composition zero times.
  proof: `node --test test/e392-subagent-templates.test.mjs` (AC12 test) and
  `node --test test/e96-dispatch-preference.test.mjs` green unchanged.
- **AC13 (c: adapter block)** — Given `templates/agent-adapters/claude.md` line 12 and
  `CLAUDE.md` line 233, then both equal string `adapter.dispatch` byte-for-byte, changed in the
  same commit; the line still contains `voids Constitution §3 builder != judge` and no `§3.2`;
  `CLAUDE.md` differs from base on line 233 only.
  proof: `node --test test/e393-builder-judge-core.test.mjs test/agc-adapters.test.mjs` green
  unchanged (AC-B11 equality + anchor; E101 `qa-engineer.{0,40}MUST.{0,20}Task` still matches
  because the text keeps "MUST be dispatched via `Task`"), plus `git diff 89e01c6 -- CLAUDE.md`
  shows one changed line (reviewer).
- **AC14 (goldens)** — Given `npm run build && node scripts/capture-constitution-golden.mjs`,
  then of the 12 files in `test/fixtures/compose-golden/` only `skill-coordinator-monolith.txt`
  differs, by exactly two hunks (the coord-02 alias insertion and the coord-04 haiku list), each
  explained in the qa report.
  proof: `git status --short test/fixtures/compose-golden/` after recapture lists only
  `skill-coordinator-monolith.txt`; `node --test test/skill-manifest.test.mjs` green.
- **AC15 (budget)** — Given `test/context-budget.test.mjs`, then the teamwork stripped bundle
  measures 21515 ~tok (base 21479, +36; cap 21715 unchanged, headroom 200), and the lean (5711),
  non-design (8476) and design-arm (10475) constitution figures are unchanged; no cap is raised.
  proof: `node --test test/context-budget.test.mjs` green unchanged; qa records before/after
  from the test's own formula (and `node scripts/measure-context-cost.mjs` for lean).
- **AC16 (suite)** — Given the lane HEAD, then `node scripts/test-lock.mjs -- npm test` passes
  with zero failures, run last on the final HEAD.
  proof: `node scripts/test-lock.mjs -- npm test`.

## Site map

| site | AC | task |
|---|---|---|
| `tools/role.ts` `ROLE_SKILL_MAP` (+ `"coordinator": "skill-coordinator.md"`) | AC1, AC2, AC3, AC5 | T-E392-01 |
| `tools/registry.ts` `SwitchRoleArgs` zod `role` enum (line 578) | AC4 | T-E392-01 |
| `tools/registry.ts` `tw_switch_role` inputSchema `role.enum` (line 1033) | AC4 | T-E392-01 |
| `dist/tools/role.*`, `dist/tools/registry.*` (build output) | AC6 | T-E392-01 |
| `templates/claude-code-agents/teamwork.md:9` | AC7 | T-E392-02 |
| `test/subagent-templates.test.mjs` `FILE_PATH_DELEGATES.teamwork` (line 77, E280) | AC7 | T-E392-05 |
| `templates/claude-code-agents/release-engineer.md:24–25` | AC8 | T-E392-03 |
| `content/coord-04-host-watermark.md:5` | AC9 | T-E392-03 |
| `test/subagent-templates.test.mjs` `HAIKU_ROLES` (line 397) | AC10 | T-E392-05 |
| `test/feature-lease.test.mjs:1533–1540`, `:1680–1687` (outside owned set) | AC11 | proposed T-E392-08, pending R1 |
| `content/coord-02-host-dispatch.md:1` (alias); `:3`, `:9`, `:11`, `:22` stay | AC12 | T-E392-04 |
| `templates/agent-adapters/claude.md:12` + `CLAUDE.md:233` (same text, same commit) | AC13 | T-E392-04 |
| AC tests for AC1–AC5, AC7–AC9, AC12 | — | T-E392-06 |
| `test/fixtures/compose-golden/skill-coordinator-monolith.txt`; budget measurement | AC14, AC15 | T-E392-07 |

## Copy / Strings

| string id | exact text (quote verbatim) | source |
|---|---|---|
| teamwork.load | ``This subagent runs the agc coordinator (full) SOP under a pinned Sonnet tier. On invocation, call `tw_get_state` then `tw_detect_drift`, then load the SOP via `tw_switch_role("coordinator")` and follow it exclusively. `content/skill-coordinator.md` is only the SOP's logical name — no such file exists on disk; the server composes the SOP from the ordered `content/coord-01..07-*.md` fragments per `prompts/skill-manifest.ts`, filtered by the workspace's `.current/.config.json` `host`.`` | authored-here — G2-01 rewrite adapted to option (i) (human ruling 2026-11-03); keeps the E280/G2-01 logical-name string |
| coord02.alias | ``` `Task(...)` throughout this SOP is shorthand for Claude Code's subagent-dispatch tool, named `Agent`; Task-dispatched and Task-spawned mean dispatched through it. ``` (one trailing space, inserted before `A host system prompt nudging`) | authored-here — G2-16 "define `Task(...)` once"; worded to also cover the brief-template terms on lines 9 and 11 |
| coord04.haiku | ``Haiku-tier subagents (`@lite`, `@doc-writer`)`` | authored-here — G2-09(b) with `@release-engineer` removed (opus per `skill-release-engineer.md` frontmatter) |
| adapter.dispatch | ``- Subagent dispatch: invoking `/teamwork` (or any agc role prompt) IS the user's standing request for subagent dispatch — a host prompt nudging the agent away from the Task/Agent tool does not override it. `code-reviewer` and `qa-engineer` MUST be dispatched via `Task` (agc's shorthand for Claude Code's `Agent` subagent tool): judging in-context voids Constitution §3 builder != judge, and the downgrade is invisible to every gate in `GATE_REGISTRY`. Build roles (`pm`, `researcher`, `design-auditor`, `architect`, `sr-engineer`) may still run in-context under budget pressure — no independence property is at stake there.`` | authored-here — G2-16 adapter hunk, reworded to keep the E101 regex window and the AC-B11 anchor |

## Visual Tokens

| token id | property | value (quote verbatim) | source |
|---|---|---|---|
| N/A | — | — | feature has no visual literals |

## Visual Widgets

| widget id | description | source-node |
|---|---|---|
| N/A | — | feature has no non-primitive widgets |

## Out of Scope

- Every `content/const-*` file (including their `Task(subagent_type=…)` text), coord-01, coord-03,
  coord-05..07, every `content/skill-*.md`, `skill-integrator.md` / `skill-coordinator-lite.md`
  `Task(` wording.
- `tools/transitions.ts`, `AgentName`, `ALLOWED_TRANSITIONS`, the `agent_id` / `next_role` /
  `dispatch_pins` enums, error codes, every other `tools/**`, `gates/**`, `prompts/**`, `index.ts`.
- The stale comment in `tools/role.ts` lines 26–27 and 36–40 (outside the one map entry; G2-23).
- The other 10 subagent templates, the other adapter templates, `CLAUDE.md` outside line 233
  (stamps, Layout counts — E395).
- E394 (4) release-engineer template slimming (post-integration NEW-1).
- Raising any context-budget cap (human ruling only; not needed — AC15).
- Backlog done-marks for E392 / E280 and queue #208 / #101 (integrator, Stage 5c).
- coord-03's lean-profile mention of a `Task` tool (core fragment, no alias in the lean profile):
  noted for a later ticket, not changed here.

## Dependencies / Prerequisites

None blocking except R1. (Visual Structural Assertions omitted: no `design/<feature>.md`, mode
= no-design.) Lane base `89e01c6`; `.current/.config.json` has `host: "claude-code"`, so
`agc init` workspaces get the AC1 profile.

**Option choices made in this cut (integrator pre-review, human approval):**
- O1 — switch-role key: `coordinator` (integrator's suggestion). Maps to the logical key
  `skill-coordinator.md`, already in `SKILL_SEGMENTS`; verified `switchRole`'s `isSplit` branch
  skips the on-disk existence check and composes it via `composeSkill` +
  `hostCapabilitiesFor(loadConfig(ws).host)`. `"coordinator"` is used elsewhere only as a
  `last_agent` string in test fixtures, never as a `RoleName` / `AgentName`.
- O2 — release-engineer template line 25: DELETE (with the blank line 24), not rewrite to
  `(opus)`. The manifest's 範圍切線 requires the non-haiku reverse assertion to hold for
  release-engineer once it leaves `HAIKU_ROLES`; that assertion forbids any
  `Example reply suffix:` line, so the audit's `(opus)` hunk would fail it.
- O3 — coord-02: the alias is one inserted sentence on line 1; lines 3, 9, 11, 22 keep `Task`
  (covered by the definition). Lines 9 and 11 are Dispatch Brief invariant lines pinned verbatim
  by `test/subagent-templates.test.mjs` c17 and mirrored in const-01 (`Task-spawned`), so
  changing them would widen into const-* and into every brief issued.
- O4 — adapter wording keeps "MUST be dispatched via `Task`" and appends the alias in
  parentheses, so `test/agc-adapters.test.mjs` E101 (`MUST.{0,20}Task`) and
  `test/e393-builder-judge-core.test.mjs` AC-B11 pass unchanged.

**needs human ruling — R1 (`test/feature-lease.test.mjs` is outside the e392 owned set).**
Lines 1533–1540 (inside test `E9A-S5 (regression guard)`, line 1513) and 1680–1687 (inside
test `E17-S4 (regression guard)`, line 1648) assert
`Example reply suffix: … — @release-engineer (haiku)` is still present and preceded by a blank
line. Any E392 (b) change to the template line (delete or `(opus)`) turns both red. The file is
owned by e394 and forbidden to e392; the manifest's E392 test list missed it. Options:
(A) re-cut: give e392 those two blocks only (e392 qa removes them or inverts them to assert
absence; e394 must not touch those lines; integration merges disjoint hunks of one file) —
recommended, keeps the human's "three sites together" ruling in this wave;
(B) e394's qa edits the two blocks — e392's lane suite is red on 2 tests until integration;
(C) defer the template line + `HAIKU_ROLES` to post-integration NEW-1 (same file, same test),
landing only coord-04 line 5 here. Until R1 is ruled, T-E392-03's template half and
T-E392-05's `HAIKU_ROLES` half wait; the rest of the cut is unaffected.

**Test files, file by file (owned-set check against the e392 row):**

| test file | touched? | why | in e392 owned set |
|---|---|---|---|
| `test/subagent-templates.test.mjs` | yes (T-E392-05) | E280 regex (line 77) + stale comment lines 69–74; `HAIKU_ROLES` (397) | yes |
| `test/e392-subagent-templates.test.mjs` | new (T-E392-06) | AC1–AC5, AC7–AC9, AC12 | yes (`test/e392-*.test.mjs`) |
| `test/skill-manifest.test.mjs` | yes, comments only (T-E392-06) | line 36 "The 9 keys of ROLE_SKILL_MAP" and lines 320–322 "No switchRole-reachable role maps to a split skill yet" become false; its loops iterate a hard-coded 9-role list, so behaviour is unaffected (do NOT append `coordinator` to that list: the witness test reads `skill-${role}.md` from disk and would throw) | yes |
| `test/fixtures/compose-golden/skill-coordinator-monolith.txt` | yes (T-E392-07) | recapture | yes (`test/fixtures/compose-golden/**`) |
| `test/feature-lease.test.mjs` | needed (AC11) | pins the `(haiku)` example line | **NO — R1** |
| `test/context-budget.test.mjs` | no | 21515 ≤ 21715 | yes (not needed) |
| `test/e393-builder-judge-core.test.mjs` | no | AC-B11 holds (identical lines, anchor kept) | yes, conditional (not triggered) |
| `test/e96-dispatch-preference.test.mjs` | no | lines 32–77 patterns untouched by the line-1 insertion | yes, conditional (not triggered) |
| `test/agc-adapters.test.mjs` | no | E101 regex still matches (O4) | yes, conditional (not triggered) |
| `test/skill-frontmatter.test.mjs` | no | only `sr-engineer` / `pm` response shapes; no map iteration | yes, conditional (not triggered) |
| `test/skill-evolution-v3.11.test.mjs` | no | its zod-enum regexes still match with an extra value | no (e394) — unaffected |
| `test/render-structure.test.mjs` | no | hard-coded `ROLE_TO_SKILLFILE`, not the map | no — unaffected |
| `test/watermark-check.test.mjs`, `test/eval-assertions.test.mjs` | no | do not pin coord-04 line 5 | no — unaffected |
| `test/e43-…`, `test/e295-…`, `test/e308-…`, `test/error-code-contract.test.mjs` | no | read coord-02 but not line 1's first sentence; no new error code | no — unaffected |

**Budget:** teamwork stripped bundle (the `test/context-budget.test.mjs` formula) 21479 → 21515
~tok (+36: coord-02 alias +~41, coord-04 list −~5); cap 21715, headroom 236 → 200. No cap
change. The constitution-only figures do not move (no `const-*` edit).

## Cut

| id | desc | depends_on | est. files | touches | design-link |
|---|---|---|---|---|---|
| T-E392-01 | sr-engineer: add `"coordinator": "skill-coordinator.md"` to `ROLE_SKILL_MAP` (one entry, optional one-line comment: composed coordinator, logical key, not a chain role); add `"coordinator"` to the `tw_switch_role` zod enum and inputSchema enum; `npm run build`; commit the two sources and only `dist/tools/role.*` + `dist/tools/registry.*` (AC1–AC6) | none | 2 source + up to 8 generated | `tools/role.ts` `tools/registry.ts` `dist/tools/role.*` `dist/tools/registry.*` | — |
| T-E392-02 | sr-engineer: rewrite teamwork template line 9 to string `teamwork.load` (AC7) | T-E392-01 | 1 | `templates/claude-code-agents/teamwork.md` | — |
| T-E392-03 | sr-engineer: delete release-engineer template lines 24–25 (O2; waits on R1) and set coord-04 line 5 to string `coord04.haiku` (AC8, AC9) | none | 2 | `templates/claude-code-agents/release-engineer.md` `content/coord-04-host-watermark.md` | — |
| T-E392-04 | sr-engineer: insert string `coord02.alias` in coord-02 line 1; set adapter template line 12 and `CLAUDE.md` line 233 to string `adapter.dispatch`, same commit (AC12, AC13) | none | 3 | `content/coord-02-host-dispatch.md` `templates/agent-adapters/claude.md` `CLAUDE.md` | — |
| T-E392-05 | qa-engineer: E280 — tighten `FILE_PATH_DELEGATES.teamwork` to the new sentence and refresh its stale comment; drop release-engineer from `HAIKU_ROLES` (waits on R1) (AC7, AC10) | T-E392-02, T-E392-03 | 1 | `test/subagent-templates.test.mjs` | — |
| T-E392-06 | qa-engineer: new AC test file for AC1–AC5, AC7–AC9, AC12; refresh the two stale comments in skill-manifest test | T-E392-01, T-E392-02, T-E392-03, T-E392-04 | 2 | `test/e392-subagent-templates.test.mjs` `test/skill-manifest.test.mjs` | — |
| T-E392-07 | qa-engineer: recapture the 12 compose goldens (only the coordinator monolith may differ, each hunk explained); record budget before/after; final `node scripts/test-lock.mjs -- npm test` on the last HEAD (AC14–AC16) | T-E392-05, T-E392-06 | 1 | `test/fixtures/compose-golden/skill-coordinator-monolith.txt` | — |
