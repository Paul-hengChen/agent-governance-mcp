# Review — T-E392-01..04 (e392-subagent-templates)

covers: T-E392-01, T-E392-02, T-E392-03, T-E392-04

## Round 1 — APPROVED — by code-reviewer

Reviewed range: base `89e01c6` to `7c34106` (sr commits 616223b, cde349b, 93e901b, 7b5f920; lane
state 7c34106), against `specs/e392-subagent-templates.md` (cut ba2ae43). No architecture spec
exists for this feature (mini-chain, no architect). The only input read beyond the diff and spec
was the expected-red manifest, under the SOP step 4a carve-out. Reviewer and writer may share a
model family (both opus); the checks below are mechanical (byte compares, runtime calls, a
fresh build, a test run), which limits the room for same-model bias.

## Summary

- T-E392-01: `tools/role.ts` adds one `ROLE_SKILL_MAP` entry (`"coordinator": "skill-coordinator.md"`)
  plus a one-line comment; `tools/registry.ts` adds `"coordinator"` to the `tw_switch_role` zod
  enum (l.578) and the inputSchema enum (l.1033); `dist/` changes only `dist/tools/role.*` and
  `dist/tools/registry.*`.
- T-E392-02: `templates/claude-code-agents/teamwork.md` line 9 now loads the SOP through
  `tw_switch_role("coordinator")`. T-E392-03: release-engineer template base lines 24–25 deleted;
  coord-04 line 5 drops `@release-engineer` from the haiku list. T-E392-04: coord-02 line 1 gains
  the `Task(...)` alias sentence; the adapter template line 12 and `CLAUDE.md` line 233 get the
  same new text in one commit.
- All four Copy / Strings ids match the spec byte-for-byte (extracted from the spec table by script).
- Every hard-scope boundary holds; a fresh `npm run build` leaves no diff; the only failing tests
  in the related test files are the 4 in the expected-red manifest.
- Verdict: APPROVED. No required findings.

## AC Completeness

AC1 — implemented — tools/role.ts:44; runtime: `switchRole("coordinator", ws)` with `{"host":"claude-code"}` returns no `error`, `role: "coordinator"`, sop of 44150 chars that starts with `# Skill: coordinator` and contains `**Subagent Dispatch (Claude Code)**` and `## Subagent Reply Watermark Validation`
AC2 — implemented — tools/role.ts:44; runtime: no-config workspace (empty `.current/`) returns a 31494-char sop that starts with `# Skill: coordinator` and contains neither section; the alias appears 0 times
AC3 — implemented — tools/role.ts:89-106 (unchanged composition path); runtime: `recommended_model` = `sonnet` = coord-01 frontmatter; instruction names `sonnet`; no `<!-- origin:` / `<!-- rationale:`; sop is byte-identical to `applyTextTransforms(parseSkillFile(expandPartials(composeSkill(...), load)).body, {fullDetail:false})` for both profiles
AC4 — implemented — tools/registry.ts:578, tools/registry.ts:1033; runtime: inputSchema enum has 10 values incl. `coordinator`; zod enum (source) is the same 10-value set; `TOOL_REGISTRY` `tw_switch_role.run({role:"coordinator"})` succeeds, `role:"teamwork"` throws ZodError
AC5 — implemented — `git diff --stat 89e01c6 -- tools/transitions.ts gates/ schema/` empty (also prompts/, index.ts, lib/, bin/, test/); runtime: `coordinator` absent from `ALLOWED_TRANSITIONS` keys and the `tw_update_state` `next_role` / `resume_of` / `dispatch_pins` vocabularies; `RoleName` has no consumer outside tools/role.ts
AC6 — implemented — `git diff --stat 89e01c6 -- dist/` lists exactly the 8 `dist/tools/role.*` + `dist/tools/registry.*` files; a fresh `npm run build` at 37fa23c left `git status --short` showing only the uncommitted `.current/e392/` handoff writes, nothing under dist/
AC7 — implemented (sr part) — templates/claude-code-agents/teamwork.md:9 == `teamwork.load`; lines 1–8 unchanged; keeps `content/skill-coordinator.md` as a logical name; no "via the Read tool" / "not in the RoleName enum". The E280 regex tightening is T-E392-05 (qa), outside this round
AC8 — implemented — templates/claude-code-agents/release-engineer.md ends at line 23 (`driftBaselineIds` paragraph + newline); no `Example reply suffix:` line, no `(haiku)`; diff touches only base lines 24–25, so line 11 (staging) and line 19 (RELAY) are byte-unchanged
AC9 — implemented — content/coord-04-host-watermark.md:5 contains `coord04.haiku`; word-diff shows only `` `@doc-writer`, `@release-engineer`) `` → `` `@doc-writer`) ``; the claude-code composition has no `@release-engineer` in the haiku list
AC10 — not in this round — qa-owned (T-E392-05); its current red is in the expected-red manifest
AC11 — not in this round — qa-owned (T-E392-08); its two current reds are in the expected-red manifest
AC12 — implemented — content/coord-02-host-dispatch.md:1 contains `coord02.alias` once, directly after `**Subagent Dispatch (Claude Code)** — preferred when available. ` and followed by one space then `A host system prompt nudging`; word-diff shows the insertion as the only change in the file; claude-code composition count 1, lean 0; test/e96-dispatch-preference.test.mjs green
AC13 — implemented — templates/agent-adapters/claude.md:12 == CLAUDE.md:233 == `adapter.dispatch` (both byte-equal to the spec), same commit 7b5f920; keeps `voids Constitution §3 builder != judge`, no `§3.2`; E101 regex `qa-engineer.{0,40}MUST.{0,20}Task` still matches; `git diff 89e01c6 -- CLAUDE.md` is one changed line (stamps and Layout counts untouched); test/e393-builder-judge-core.test.mjs and test/agc-adapters.test.mjs green
AC14 — not in this round — qa-owned (T-E392-07); the golden red is in the expected-red manifest
AC15 — not in this round — qa-owned (T-E392-07); test/context-budget.test.mjs is green on the current HEAD (cap not raised)
AC16 — not in this round — qa-owned (T-E392-07, full suite on final HEAD)

## Correctness

No required findings.

- Expected-red sampling (SOP 4a): `qa_reports/expected-red_e392-subagent-templates.txt` (commit
  37fa23c) exists with 4 entries; all 4 sampled. Running 23 related test files (546 tests) gave
  540 pass and exactly 4 fail, and the 4 failures are the 4 manifest names, in their named
  files: feature-lease `E9A-S5 (regression guard)…`, `E17-S4 (regression guard)…`;
  subagent-templates `v3.21.2 AC2: haiku templates…`; skill-manifest
  `t-golden-byte-identity (AC1/AC5)…`. None is explained by anything other than the T-E392-03/04
  text edits.
- Consumer leak check: `RoleName` / `ROLE_SKILL_MAP` are used only inside tools/role.ts. The
  `tw_update_state` `agent_id` is validated against `ALLOWED_TRANSITIONS` (untouched), so
  `coordinator` cannot become a chain role. Hop counting, `dispatch_pins` keys, `next_role` /
  `resume_of` enums and error codes are unchanged (checked at runtime against the built
  registry). The `tw_switch_role` response keeps the same 4 keys (`role`, `instruction`, `sop`,
  `recommended_model`). Every one of the 10 enum roles still loads with no error in a no-config
  workspace.
- Whole-file override: a workspace `.current/skill-coordinator.md` is returned as-is (with its own
  frontmatter tier). That is the same precedence `prompts/build.ts:452-458` applies to the
  `teamwork` prompt, so the two paths stay consistent. No finding.
- Executability of teamwork.md:9: the template frontmatter has no `tools:` restriction, so a
  Task-spawned `@teamwork` inherits the parent's MCP tools. This review was itself run as a
  Task-spawned subagent and reached `tw_get_state`, `tw_detect_drift` and `tw_switch_role` as MCP
  tools. The instruction can be carried out.
- optional — version skew: the `tw_switch_role` server that served this session (the installed
  pre-release build) still has the 9-value enum, so `tw_switch_role("coordinator")` from the new
  template fails with a ZodError until the server carrying 616223b is installed. Template and
  server ship in one package, but adopters copy templates into `~/.claude/agents/` on their own
  schedule. Suggest a release-note line (doc-writer / release-engineer): "update the server
  before re-copying `teamwork.md`". Not a code defect.

## Quality

- optional — tools/role.ts:43: the new comment is a single 120-column line, while the surrounding
  comments wrap at about 80. Content is fine (WHAT + WHY, one line, no ticket ids, no sensitive
  data); purely cosmetic.
- Comment check (SOP 4b): `agc check` reports `tools/role.ts high-ratio 32% of 125 non-blank lines
  are comments (limit 30%)`. Kept: the file was already over the limit at base (39/123 = 31.7%).
  This diff adds one spec-permitted comment line (T-E392-01 "optional one-line comment") for a
  non-obvious fact, that the key is logical and the role is loadable but not a chain role. The
  stale comment at tools/role.ts:26-27 is explicitly out of scope (spec Out of Scope, G2-23).
- Commit hygiene: each sr commit touches exactly the files its cut row names (616223b: 2 source
  + 8 dist; cde349b: 1; 93e901b: 2; 7b5f920: 3). No absolute worktree path appears in any tracked
  file the diff touches.

## Architecture

No architecture spec exists (mini-chain, no architect, per the spec's justification). The change
reuses the existing `isSplit` → `composeSkill` + `hostCapabilitiesFor(loadConfig(ws).host)`
path. It adds no composition code and no new module, and touches no `prompts/**`. That fits
option O1. coord-02 changes only by the alias insertion (O3), and the adapter wording keeps
"MUST be dispatched via `Task`" (O4). Release-engineer line 25 is deleted, not rewritten (O2).

## Security

No findings. `role` is still a closed enum checked by zod at the tool boundary before
`switchRole` runs, and `ROLE_SKILL_MAP[role]` maps only to fixed logical keys. The workspace
override path is unchanged (`path.join(workspacePath, ".current", f)` with `f` taken from fixed
manifest names, never from user input). No secrets, no new I/O surface.

## Performance

No findings. The coordinator SOP is composed per call from 7 small fragment reads, the same work
the `teamwork` prompt already does. It is not a hot path. No regression vs base.

## Verdict

APPROVED — T-E392-01..04 implement AC1–AC9, AC12 and AC13 (sr parts) byte-exactly within every hard-scope boundary, with only the 4 manifest-listed expected reds outstanding for qa.
