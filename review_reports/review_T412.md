# Review T410–T413 — Claude Code Subagent Dispatch

## Round 1 — APPROVED — by code-reviewer

## Summary

- 11 pre-pinned subagent templates added under `templates/claude-code-agents/` (architect, code-reviewer, coordinator-lite, design-auditor, doc-writer, pm, qa-engineer, qa-visual, release-engineer, researcher, sr-engineer). Full coordinator deliberately absent per AC2 (recursive-spawn avoidance); `coordinator-lite` deliberately included (lite-mode Haiku tier).
- `content/skill-coordinator.md` §Auto-Routing gains two new sub-bullets: **Subagent Dispatch (Claude Code)** (preferred path via Task tool) and **Fallback (`tw_switch_role`)** (existing behavior for non-Claude-Code hosts).
- README gains `### Claude Code subagent install (auto model-routing)` sub-section under existing `## Per-Role Model Routing`; install snippet + degradation callout + design link.
- Version bumped 3.19.1 → 3.20.0 (`package.json`, `index.ts` Server literal, `CHANGELOG.md`); lock refreshed.

## Correctness

- `templates/claude-code-agents/*.md` × 11 files verified by programmatic tier-consistency check: `model:` in every template matches `recommended_model` in the corresponding `content/skill-<role>.md` (AC1 regression-guard contract). No drift.
- Coordinator template confirmed **absent** by direct filesystem check (`fs.existsSync('templates/claude-code-agents/coordinator.md') === false`) — AC2 satisfied.
- `templates/claude-code-agents/qa-visual.md:7` correctly uses `tw_switch_role("qa-engineer")` (NOT `qa-visual`) because qa-visual is a lazy sub-skill, not a top-level role in `RoleName` enum (`tools/role.ts:20-33`). The Claude Code subagent `name:` is `qa-visual` (frontmatter), the agc server-side role is `qa-engineer`. Boundary correctly observed.
- `templates/claude-code-agents/coordinator-lite.md:7` adds defensive note "Do NOT call any tw_* write tools (server rejects lite-mode writes)" — matches `tools/transitions.ts` lite agent_id absence. Defensive doc; correct.
- `content/skill-coordinator.md:79` — preference-order language ("dispatch to the next role per the preference order below") is internally consistent with the new Subagent Dispatch + Fallback paragraphs that follow.
- `content/skill-coordinator.md:81` — the new sub-bullet explicitly reiterates **server-enforced `ALLOWED_TRANSITIONS` in `tools/transitions.ts` still gates every `tw_update_state` write**. AC3's "routing chain unchanged" requirement satisfied.
- `content/skill-coordinator.md:83` — fallback paragraph cites pre-v3.20.0 behavior preservation; AC4's degradation envelope explicit.
- `content/skill-coordinator.md:104` — SOP §5 gate-triggered branch now reads "dispatch via the Auto-Routing preference order"; consistent with the §Auto-Routing rewrite.

No off-by-one, no missed edge case (Claude Code without templates installed correctly degrades — the heuristic "attempt the call once; on tool-error or unknown-subagent-type, fall back" covers it).

## Quality

- Template body length: every file is a single sentence (S04 contract) — no SOP duplication risk; single source of truth stays in `content/skill-<role>.md`.
- Naming consistent: subagent file basenames match `name:` frontmatter values.
- README sub-section follows existing prose style (sentence-case headings, `mkdir -p ~/.claude/agents` install pattern matches the `claude mcp add` snippets earlier in the doc).
- CHANGELOG `[3.20.0]` entry follows the established Added / Changed / Notes structure used in `[3.19.0]`, `[3.19.1]`, `[3.18.0]`.
- Skill SOP wording: switched from imperative "call `tw_switch_role`" to descriptive "dispatch via the Auto-Routing preference order" — slight loss of single-call directness, recovered by the explicit parenthetical "(Task-tool subagent if available, else `tw_switch_role(<role>)`)". Acceptable.

## Architecture

- Implementation follows `specs/subagent-dispatch.md` exactly:
  - AC1: 11 files ✓
  - AC2: full coordinator excluded ✓
  - AC3: Subagent Dispatch sub-bullet + ALLOWED_TRANSITIONS preservation ✓
  - AC4: Fallback paragraph ✓
  - AC5: README sub-section ✓
  - AC6: version bump, no schema_version bump ✓
- No `tw_*` tool surface change — `tools/role.ts`, `tools/transitions.ts`, `tools/skill-frontmatter.ts` untouched. Backwards-compat guarantee preserved.
- No persisted-state schema change — `schema/versions.ts` untouched.

## Security

- Templates carry no credentials, API keys, or secrets.
- No new input-parsing surface introduced (frontmatter parsing reuses existing `tools/skill-frontmatter.ts` from v3.19.0).
- Subagent bodies cite `tw_get_state` + `tw_switch_role` — both existing tools with established zod validation in `index.ts`.
- No injection vector (markdown content, no execution).
- Fallback path explicitly handles unknown-subagent-type tool errors — no error-swallow attack surface.

## Performance

- Markdown-only change set in shipped runtime artifacts (templates ship as static files); no algorithmic surface introduced.
- `dist/index.js` rebuild is a 2-byte version string change (`3.19.1` → `3.20.0`) — no behavioral diff.
- README + CHANGELOG additions add ~20 + ~45 lines respectively; well within doc-page budgets.
- `content/skill-coordinator.md` adds ~4 lines to the full-coordinator (chain) bundle; full-mode bundle is NOT subject to the lean 2000-token budget enforced by `test/context-budget.test.mjs` AC2 (that test inspects the lite bundle only). Confirmed by inspection of `test/context-budget.test.mjs:48-55` — the test reads `skill-coordinator-lite.md` for the lean bundle calculation, not the full coordinator.

No regression vs base.

## Verdict

`APPROVED` — implementation matches PRD AC1–AC6, tier-consistency contract verified programmatically, server-enforced routing semantics preserved, fallback path documented for non-Claude-Code clients, build + suite + audit all green. Unit tests for tier consistency + coordinator skill grep + full-suite re-run remain for qa-engineer per T414.
